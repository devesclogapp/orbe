/**
 * pontoDecisao.service.ts
 *
 * Motor Operacional — FIX CP06.6-A: Camada Auditável de Decisão RH do Ponto.
 *
 * Princípio Fundamental:
 * DECISÃO RH = OVERLAY DE GOVERNANÇA ≠ SOBRESCRITA DO DADO FACTUAL.
 * O dado importado e suas batidas factuais NUNCA são sobrescritos ou alterados
 * arbitrariamente para contornar os Gates.
 * A decisão RH fica formalmente registrada com autoria, justificativa,
 * data/hora e preservação do estado factual original.
 */

import { supabase } from "@/lib/supabase";
import { AuditoriaService } from "@/services/v4.service";
import { normalizeRole, normalizePermissionMatrix, canAccessModule } from "@/lib/access-control";
import {
  PontoDecisao,
  RegistrarDecisaoInput,
  RevogarDecisaoInput,
  TipoDecisaoPonto,
} from "@/types/pontoDecisao.types";

const TIPOS_VALIDOS: TipoDecisaoPonto[] = [
  "FALTA_INJUSTIFICADA_CONFIRMADA",
  "FALTA_JUSTIFICADA_ABONADA",
  "DSR_DIRECIONADO_BANCO_HORAS",
  "DSR_DIRECIONADO_HORA_EXTRA",
];

export class PontoDecisaoServiceClass {
  /**
   * Obtém o contexto autenticado seguro do usuário, validando tenant e papel.
   */
  async getExecutionContext() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      throw new Error("Sessão inválida. Faça login novamente para continuar.");
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("tenant_id, full_name, role")
      .eq("user_id", user.id)
      .single();

    if (error || !profile?.tenant_id) {
      throw new Error("Usuário sem tenant associado. Contate o administrador.");
    }

    const { data: userPerm } = await supabase
      .from("user_permissions")
      .select("role, permissions, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const effectiveRole = normalizeRole(userPerm?.role || profile?.role || "user");

    return {
      userId: user.id,
      tenantId: profile.tenant_id as string,
      userName: String(
        profile.full_name ?? user.user_metadata?.full_name ?? user.email ?? "Usuário RH"
      ),
      role: effectiveRole,
      permissions: userPerm?.permissions,
    };
  }

  /**
   * Validação de autorização Fail-Closed no nível de serviço.
   * O perfil operacional (encarregado) é estritamente bloqueado.
   */
  assertAdminOrRh(contexto: { role: string; permissions?: any }, acao: string) {
    if (contexto.role === "encarregado") {
      throw new Error(
        `Acesso negado: perfil operacional (encarregado) não possui autorização para ${acao}.`
      );
    }

    const isAuthorized = contexto.role === "admin" || contexto.role === "rh";
    if (!isAuthorized) {
      const permissions = normalizePermissionMatrix(contexto.permissions, contexto.role as any);
      const hasPermission =
        canAccessModule(permissions, "processamento_rh", "processar") ||
        canAccessModule(permissions, "banco_de_horas", "editar");

      if (!hasPermission) {
        throw new Error(`Acesso negado: usuário não possui permissão para ${acao}.`);
      }
    }
  }

  /**
   * Registra uma decisão formal de RH para um registro de ponto retido/bloqueado.
   *
   * Regras:
   * 1. Preservação: NÃO altera registros_ponto diretamente.
   * 2. Tipo de decisão válido (FALTA_INJUSTIFICADA_CONFIRMADA, FALTA_JUSTIFICADA_ABONADA,
   *    DSR_DIRECIONADO_BANCO_HORAS, DSR_DIRECIONADO_HORA_EXTRA).
   * 3. Justificativa obrigatória (mínimo 5 caracteres).
   * 4. Idempotência / Histórico: Se já existia uma decisão ativa para o mesmo registro de ponto,
   *    ela é marcada como inativa (ativo = false) e ligada pelo campo `substituido_por`.
   * 5. Governança: Somente Admin ou RH autorizados. Encarregado é bloqueado.
   * 6. Isolamento: Proibido acesso ou mutação cross-tenant.
   */
  async registrarDecisao(input: RegistrarDecisaoInput): Promise<PontoDecisao> {
    const { registroPontoId, tipoDecisao, justificativa } = input;

    // 1. Validações sintáticas básicas
    if (!registroPontoId) {
      throw new Error("ID do registro de ponto é obrigatório.");
    }

    if (!TIPOS_VALIDOS.includes(tipoDecisao)) {
      throw new Error(
        `Tipo de decisão '${tipoDecisao}' inválido. Tipos permitidos: ${TIPOS_VALIDOS.join(", ")}.`
      );
    }

    const justificativaTrimmed = String(justificativa || "").trim();
    if (justificativaTrimmed.length < 5) {
      throw new Error(
        "A justificativa é obrigatória para registrar uma decisão de RH (mínimo de 5 caracteres)."
      );
    }

    // 2. Validação de Autorização e Contexto de Execução
    const contexto = await this.getExecutionContext();
    this.assertAdminOrRh(contexto, "registrar decisão de RH para ponto bloqueado");

    // 3. Busca o registro de ponto original para validar tenant e obter integridade relacional
    const { data: pontoOriginal, error: errPonto } = await supabase
      .from("registros_ponto")
      .select("id, tenant_id, colaborador_id, data")
      .eq("id", registroPontoId)
      .single();

    if (errPonto || !pontoOriginal) {
      throw new Error("Registro de ponto não encontrado.");
    }

    if (pontoOriginal.tenant_id !== contexto.tenantId) {
      throw new Error("Acesso não autorizado: o registro de ponto pertence a outro tenant.");
    }

    // 4. Inativação da decisão ativa anterior para o mesmo registro de ponto, se existir
    const { data: decisaoAnterior } = await supabase
      .from("registros_ponto_decisoes")
      .select("id")
      .eq("registro_ponto_id", registroPontoId)
      .eq("ativo", true)
      .maybeSingle();

    // 5. Inserção da nova decisão vigente
    const novaDecisaoPayload = {
      tenant_id: contexto.tenantId,
      registro_ponto_id: registroPontoId,
      colaborador_id: input.colaboradorId || pontoOriginal.colaborador_id,
      data: input.data || pontoOriginal.data,
      tipo_decisao: tipoDecisao,
      justificativa: justificativaTrimmed,
      executado_por: contexto.userId,
      executado_por_nome: contexto.userName,
      ativo: true,
      updated_at: new Date().toISOString(),
    };

    const { data: novaDecisao, error: errInsert } = await supabase
      .from("registros_ponto_decisoes")
      .insert(novaDecisaoPayload)
      .select()
      .single();

    if (errInsert || !novaDecisao) {
      throw new Error(
        `Erro ao registrar decisão de RH: ${errInsert?.message || "falha na gravação"}`
      );
    }

    // Se havia uma anterior, atualiza para inativa apontando para a nova
    if (decisaoAnterior?.id) {
      await supabase
        .from("registros_ponto_decisoes")
        .update({
          ativo: false,
          substituido_por: novaDecisao.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", decisaoAnterior.id);
    }

    // 6. Auditoria Central do Sistema
    try {
      await AuditoriaService.log(
        "decisao_rh_ponto",
        "processamento_rh",
        "medio",
        {
          registro_ponto_id: registroPontoId,
          colaborador_id: novaDecisao.colaborador_id,
          data_ponto: novaDecisao.data,
          tipo_decisao: tipoDecisao,
          justificativa: justificativaTrimmed,
          decisao_anterior_id: decisaoAnterior?.id || null,
          nova_decisao_id: novaDecisao.id,
          executado_por: contexto.userId,
          executado_por_nome: contexto.userName,
        }
      );
    } catch (auditErr) {
      console.warn("[PontoDecisaoService] Auditoria não pôde ser gravada:", auditErr);
    }

    return novaDecisao as PontoDecisao;
  }

  /**
   * Revoga uma decisão de RH ativa, reabrindo o bloqueio factual do ponto.
   */
  async revogarDecisao(input: RevogarDecisaoInput): Promise<PontoDecisao> {
    const { decisaoId, motivoRevogacao } = input;

    if (!decisaoId) {
      throw new Error("ID da decisão é obrigatório para revogação.");
    }

    const motivoTrimmed = String(motivoRevogacao || "").trim();
    if (motivoTrimmed.length < 5) {
      throw new Error("O motivo da revogação é obrigatório (mínimo de 5 caracteres).");
    }

    const contexto = await this.getExecutionContext();
    this.assertAdminOrRh(contexto, "revogar decisão de RH");

    const { data: decisaoExistente, error: errFetch } = await supabase
      .from("registros_ponto_decisoes")
      .select("*")
      .eq("id", decisaoId)
      .single();

    if (errFetch || !decisaoExistente) {
      throw new Error("Decisão de RH não encontrada.");
    }

    if (decisaoExistente.tenant_id !== contexto.tenantId) {
      throw new Error("Acesso não autorizado: a decisão pertence a outro tenant.");
    }

    if (!decisaoExistente.ativo) {
      throw new Error("Esta decisão de RH já se encontra inativa ou revogada.");
    }

    const { data: decisaoRevogada, error: errUpdate } = await supabase
      .from("registros_ponto_decisoes")
      .update({
        ativo: false,
        revogado_por: contexto.userId,
        revogado_em: new Date().toISOString(),
        motivo_revogacao: motivoTrimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", decisaoId)
      .select()
      .single();

    if (errUpdate || !decisaoRevogada) {
      throw new Error(`Erro ao revogar decisão: ${errUpdate?.message || "falha na atualização"}`);
    }

    try {
      await AuditoriaService.log(
        "revogar_decisao_rh_ponto",
        "processamento_rh",
        "medio",
        {
          decisao_id: decisaoId,
          registro_ponto_id: decisaoExistente.registro_ponto_id,
          colaborador_id: decisaoExistente.colaborador_id,
          tipo_decisao: decisaoExistente.tipo_decisao,
          motivo_revogacao: motivoTrimmed,
          executado_por: contexto.userId,
          executado_por_nome: contexto.userName,
        }
      );
    } catch (auditErr) {
      console.warn("[PontoDecisaoService] Auditoria de revogação não pôde ser gravada:", auditErr);
    }

    return decisaoRevogada as PontoDecisao;
  }

  /**
   * Busca as decisões RH ativas dentro de um período e tenant.
   */
  async getDecisoesAtivasPorPeriodo(params: {
    tenantId: string;
    startDate: string;
    endDate: string;
    colaboradorId?: string | null;
  }): Promise<PontoDecisao[]> {
    const { tenantId, startDate, endDate, colaboradorId } = params;

    let query = supabase
      .from("registros_ponto_decisoes")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .gte("data", startDate)
      .lte("data", endDate);

    if (colaboradorId) {
      query = query.eq("colaborador_id", colaboradorId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[PontoDecisaoService] Erro ao buscar decisões RH:", error);
      return [];
    }

    return (data || []) as PontoDecisao[];
  }

  /**
   * Busca todo o histórico (vigentes, substituídas e revogadas) de decisões de um ponto.
   */
  async getHistoricoDecisoesPonto(registroPontoId: string): Promise<PontoDecisao[]> {
    const { data, error } = await supabase
      .from("registros_ponto_decisoes")
      .select("*")
      .eq("registro_ponto_id", registroPontoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PontoDecisaoService] Erro ao buscar histórico de decisões:", error);
      return [];
    }

    return (data || []) as PontoDecisao[];
  }

  /**
   * Agrupa decisões ativas por ID do registro de ponto para lookup imediato O(1).
   */
  mapearDecisoesPorPonto(decisoes: PontoDecisao[]): Map<string, PontoDecisao> {
    const map = new Map<string, PontoDecisao>();

    for (const dec of decisoes) {
      if (!dec.ativo) continue;
      map.set(dec.registro_ponto_id, dec);
    }

    return map;
  }

  /**
   * Constrói o objeto de ponto com a decisão RH ativa anexada para avaliação segura nos Gates.
   */
  anexarDecisao(ponto: any, decisao?: PontoDecisao | null): any {
    if (!decisao || !decisao.ativo) {
      return ponto;
    }

    return {
      ...ponto,
      decisao: {
        id: decisao.id,
        tipo_decisao: decisao.tipo_decisao,
        justificativa: decisao.justificativa,
        executado_por: decisao.executado_por,
        executado_por_nome: decisao.executado_por_nome,
        created_at: decisao.created_at,
      },
      possuiDecisaoRh: true,
    };
  }
}

export const PontoDecisaoService = new PontoDecisaoServiceClass();
