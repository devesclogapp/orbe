/**
 * pontoRegularizacao.service.ts
 *
 * Motor Operacional — FIX CP04.8: Regularização Controlada de Marcações pelo RH/Admin.
 *
 * Princípio Fundamental:
 * BATIDA ORIGINAL IMPORTADA ≠ BATIDA REGULARIZADA PELO RH.
 * O dado importado do RHiD é evidência factual da origem e NUNCA é sobrescrito.
 * A intervenção RH fica integralmente registrada com autoria, justificativa,
 * data/hora e preservação do dado factual anterior.
 */

import { supabase } from "@/lib/supabase";
import { AuditoriaService } from "@/services/v4.service";
import { normalizeRole, normalizePermissionMatrix, canAccessModule } from "@/lib/access-control";
import {
  CampoMarcacaoRegularizavel,
  PontoRegularizacao,
  RegularizarMarcacaoInput,
  RegularizacoesAtivasPontoMap,
} from "@/types/pontoRegularizacao.types";

const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const CAMPOS_VALIDOS: CampoMarcacaoRegularizavel[] = [
  "entrada",
  "saida_almoco",
  "retorno_almoco",
  "saida",
];

export class PontoRegularizacaoServiceClass {
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
   * Validação de autorização Fail-Closed no nível de serviço (Lacuna 2 do CP04.7).
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
   * Registra uma regularização individual controlada para um registro de ponto.
   *
   * Regras:
   * 1. Preservação: NÃO altera registros_ponto diretamente.
   * 2. Formato: Horário deve ser válido (HH:MM).
   * 3. Justificativa obrigatória (mínimo 5 caracteres).
   * 4. Idempotência / Histórico: Se já existia uma regularização ativa para o mesmo campo,
   *    ela é marcada como inativa (ativo = false) e ligada pelo campo `substituido_por`.
   * 5. Governança: Somente Admin ou RH autorizados. Encarregado é bloqueado.
   * 6. Isolamento: Proibido acesso ou mutação cross-tenant.
   */
  async regularizarMarcacao(input: RegularizarMarcacaoInput): Promise<PontoRegularizacao> {
    const { registroPontoId, campo, novoHorario, justificativa } = input;

    // 1. Validações sintáticas básicas
    if (!registroPontoId) {
      throw new Error("ID do registro de ponto é obrigatório.");
    }

    if (!CAMPOS_VALIDOS.includes(campo)) {
      throw new Error(
        `Campo '${campo}' inválido para regularização. Campos permitidos: ${CAMPOS_VALIDOS.join(", ")}.`
      );
    }

    const horarioTrimmed = String(novoHorario || "").trim();
    if (!TIME_REGEX.test(horarioTrimmed)) {
      throw new Error(
        `Formato de horário inválido: "${novoHorario}". O horário deve estar no formato HH:MM (00:00 a 23:59).`
      );
    }

    const justificativaTrimmed = String(justificativa || "").trim();
    if (justificativaTrimmed.length < 5) {
      throw new Error(
        "A justificativa é obrigatória para regularizar uma marcação (mínimo de 5 caracteres)."
      );
    }

    // 2. Validação de Autorização e Contexto de Execução
    const contexto = await this.getExecutionContext();
    this.assertAdminOrRh(contexto, "regularizar marcações de ponto");

    // 3. Busca o registro de ponto original para extrair o dado factual e validar tenant
    const { data: pontoOriginal, error: errPonto } = await supabase
      .from("registros_ponto")
      .select("id, tenant_id, colaborador_id, data, entrada, saida_almoco, retorno_almoco, saida")
      .eq("id", registroPontoId)
      .single();

    if (errPonto || !pontoOriginal) {
      throw new Error("Registro de ponto não encontrado.");
    }

    if (pontoOriginal.tenant_id !== contexto.tenantId) {
      throw new Error("Acesso não autorizado: o registro de ponto pertence a outro tenant.");
    }

    const valorOriginalFactual = pontoOriginal[campo] ? String(pontoOriginal[campo]).trim() : null;

    // 4. Inativação da regularização ativa anterior para o mesmo campo, se existir
    const { data: regAnterior } = await supabase
      .from("registros_ponto_regularizacoes")
      .select("id")
      .eq("registro_ponto_id", registroPontoId)
      .eq("campo_alterado", campo)
      .eq("ativo", true)
      .maybeSingle();

    // 5. Inserção da nova regularização vigente
    const novaRegPayload = {
      tenant_id: contexto.tenantId,
      registro_ponto_id: registroPontoId,
      colaborador_id: input.colaboradorId || pontoOriginal.colaborador_id,
      data: input.data || pontoOriginal.data,
      campo_alterado: campo,
      valor_original: valorOriginalFactual,
      valor_regularizado: horarioTrimmed,
      justificativa: justificativaTrimmed,
      executado_por: contexto.userId,
      executado_por_nome: contexto.userName,
      ativo: true,
      updated_at: new Date().toISOString(),
    };

    const { data: novaReg, error: errInsert } = await supabase
      .from("registros_ponto_regularizacoes")
      .insert(novaRegPayload)
      .select()
      .single();

    if (errInsert || !novaReg) {
      throw new Error(
        `Erro ao registrar regularização: ${errInsert?.message || "falha na gravação"}`
      );
    }

    // Se havia uma anterior, atualiza para inativa apontando para a nova
    if (regAnterior?.id) {
      await supabase
        .from("registros_ponto_regularizacoes")
        .update({
          ativo: false,
          substituido_por: novaReg.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", regAnterior.id);
    }

    // 6. Auditoria Central do Sistema
    try {
      await AuditoriaService.log(
        "regularizar_marcacao_ponto",
        "processamento_rh",
        "medio",
        {
          registro_ponto_id: registroPontoId,
          colaborador_id: novaReg.colaborador_id,
          data_ponto: novaReg.data,
          campo_alterado: campo,
          valor_original: valorOriginalFactual,
          valor_regularizado: horarioTrimmed,
          justificativa: justificativaTrimmed,
          regularizacao_anterior_id: regAnterior?.id || null,
          nova_regularizacao_id: novaReg.id,
          executado_por: contexto.userId,
          executado_por_nome: contexto.userName,
        }
      );
    } catch (auditErr) {
      console.warn("[PontoRegularizacaoService] Auditoria não pôde ser gravada:", auditErr);
    }

    return novaReg as PontoRegularizacao;
  }

  /**
   * Busca as regularizações ativas dentro de um período e tenant.
   */
  async getRegularizacoesAtivasPorPeriodo(params: {
    tenantId: string;
    startDate: string;
    endDate: string;
    colaboradorId?: string | null;
  }): Promise<PontoRegularizacao[]> {
    const { tenantId, startDate, endDate, colaboradorId } = params;

    let query = supabase
      .from("registros_ponto_regularizacoes")
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
      console.error("[PontoRegularizacaoService] Erro ao buscar regularizações:", error);
      return [];
    }

    return (data || []) as PontoRegularizacao[];
  }

  /**
   * Busca todo o histórico (vigentes e inativadas) de regularizações de um ponto.
   */
  async getHistoricoPonto(registroPontoId: string): Promise<PontoRegularizacao[]> {
    const { data, error } = await supabase
      .from("registros_ponto_regularizacoes")
      .select("*")
      .eq("registro_ponto_id", registroPontoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PontoRegularizacaoService] Erro ao buscar histórico de regularizações:", error);
      return [];
    }

    return (data || []) as PontoRegularizacao[];
  }

  /**
   * Agrupa regularizações ativas por ID do registro de ponto para lookup imediato O(1).
   */
  mapearRegularizacoesPorPonto(
    regularizacoes: PontoRegularizacao[]
  ): Map<string, RegularizacoesAtivasPontoMap> {
    const map = new Map<string, RegularizacoesAtivasPontoMap>();

    for (const reg of regularizacoes) {
      if (!reg.ativo) continue;
      const pontoMap = map.get(reg.registro_ponto_id) || {};
      pontoMap[reg.campo_alterado] = reg;
      map.set(reg.registro_ponto_id, pontoMap);
    }

    return map;
  }

  /**
   * Constrói o objeto de ponto com regularizações ativas anexadas para avaliação segura nos Gates.
   */
  anexarRegularizacoes(ponto: any, regularizacoesDoPonto?: RegularizacoesAtivasPontoMap): any {
    if (!regularizacoesDoPonto || Object.keys(regularizacoesDoPonto).length === 0) {
      return ponto;
    }

    const regularizacoesFormatted: Record<string, any> = {};

    for (const [campo, reg] of Object.entries(regularizacoesDoPonto)) {
      if (reg && reg.ativo) {
        regularizacoesFormatted[campo] = {
          valor: reg.valor_regularizado,
          valorOriginal: reg.valor_original,
          justificativa: reg.justificativa,
          executadoPorNome: reg.executado_por_nome,
          created_at: reg.created_at,
        };
      }
    }

    return {
      ...ponto,
      regularizacoes: regularizacoesFormatted,
      possuiRegularizacao: Object.keys(regularizacoesFormatted).length > 0,
    };
  }
}

export const PontoRegularizacaoService = new PontoRegularizacaoServiceClass();
