import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { ServicosExtrasOperacionaisService } from "@/services/receitas/receitas.service";
import { CustoExtraOperacionalService } from "@/services/domain/despesas.service";
import { ServicosEspecificosLancamentoService } from "@/services/domain/servicos_especificos.service";

export type TipoLancamentoHoje =
  | "OPERACAO"
  | "SERVICO_EXTRA"
  | "CUSTO_EXTRA"
  | "PERIODO_OPERACIONAL";

export interface LancamentoHojePortal {
  id: string;
  tipo: TipoLancamentoHoje;
  tipoLabel: string;
  tipoBadgeClass: string;
  horario: string;
  empresaNome: string;
  titulo: string;
  subtitulo?: string;
  valor?: number;
  statusLabel: string;
  statusColorClass: string;
  createdAt: string;
}

export function formatTimeLocal(isoString?: string): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString.includes("T") ? isoString : isoString + "T12:00:00");
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function mapStatusOperacao(status?: string, statusRh?: string): { label: string; className: string } {
  const s = String(status || "").toLowerCase();
  const sRh = String(statusRh || "").toLowerCase();

  if (s === "bloqueado" || s === "com_alerta" || s === "em_restricao" || sRh === "com_alerta") {
    return { label: "Com restrição", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (s === "processado" || s === "ok" || s === "validado" || s === "aprovado" || s === "aprovado_operacao") {
    return { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "em_validacao" || s === "em_analise" || sRh === "em_analise") {
    return { label: "Em validação", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

export function mapStatusServicoExtra(status?: string): { label: string; className: string } {
  const s = String(status || "").toUpperCase();
  if (s === "APROVADO_OPERACAO") {
    return { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "EM_VALIDACAO") {
    return { label: "Em validação", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (s === "CONCLUIDO" || s === "FECHADO" || s === "FATURADO" || s === "APROVADO_FINANCEIRO") {
    return { label: "Concluído", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

export function mapStatusCustoExtra(status?: string): { label: string; className: string } {
  const s = String(status || "").toUpperCase();
  if (s === "APROVADO_OPERACAO" || s === "APROVADO") {
    return { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "EM_VALIDACAO" || s === "EM_ANALISE") {
    return { label: "Em validação", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (s === "PAGO" || s === "CONCLUIDO") {
    return { label: "Pago", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

export function mapStatusPeriodoOperacional(status?: string): { label: string; className: string } {
  const s = String(status || "").toUpperCase();
  if (s === "CONCLUIDO" || s === "APROVADO") {
    return { label: "Concluído", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "EM_VALIDACAO") {
    return { label: "Em validação", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

interface UseLancamentosHojePortalProps {
  date?: string;
  contextEmpresaId?: string | null;
}

export function useLancamentosHojePortal({ date, contextEmpresaId }: UseLancamentosHojePortalProps = {}) {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  // 1. Resolução Canônica das Empresas Autorizadas
  const { data: empresasAutorizadas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  // 2. Resolução do Perfil do Usuário
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile_portal_encarregado", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, role, empresa_id, tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Resolução Segura do Escopo de Empresa (Fail-Closed)
  const effectiveEmpresaId = useMemo(() => {
    // a) Contexto explícito válido
    if (contextEmpresaId && contextEmpresaId !== "all") {
      return contextEmpresaId;
    }
    // b) Empresa fixa no perfil do usuário
    if (userProfile?.empresa_id) {
      return userProfile.empresa_id;
    }
    // c) Fallback de metadados do JWT
    if (user?.user_metadata?.empresa_id) {
      return user.user_metadata.empresa_id;
    }
    // d) REGRA PREFERENCIAL: Se existe exatamente 1 empresa operacional autorizada, usar automaticamente
    if (empresasAutorizadas.length === 1) {
      return empresasAutorizadas[0].id;
    }
    // e) Se existirem múltiplas empresas ou nenhuma, NÃO escolher arbitrariamente
    return null;
  }, [contextEmpresaId, userProfile?.empresa_id, user?.user_metadata?.empresa_id, empresasAutorizadas]);

  const isLoadingConfig = isLoadingProfile || isLoadingEmpresas;
  const isIndeterminateScope = !isLoadingConfig && !effectiveEmpresaId;
  const hasMultipleAuthorizedEmpresas = empresasAutorizadas.length > 1;
  const hasNoAuthorizedEmpresas = !isLoadingEmpresas && empresasAutorizadas.length === 0;

  const effectiveDate = date || new Date().toLocaleDateString("en-CA");

  // 4. Query Agregada dos 4 Domínios
  const {
    data: launches = [],
    isLoading: isLoadingLaunches,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["lancamentos_hoje_portal", effectiveDate, effectiveEmpresaId, tenantId],
    queryFn: async () => {
      if (!effectiveEmpresaId) return [];

      const [operacoes, servicosExtras, custosExtras, servicosEspecificos] = await Promise.all([
        // 1. Operações por Volume
        OperacaoProducaoService.getByDate(effectiveDate, effectiveEmpresaId).catch((err) => {
          console.error("[useLancamentosHojePortal] Erro ao buscar operacoes:", err);
          return [];
        }),
        // 2. Serviços Extras
        ServicosExtrasOperacionaisService.getWithEmpresas(effectiveEmpresaId, effectiveDate).catch((err) => {
          console.error("[useLancamentosHojePortal] Erro ao buscar servicos extras:", err);
          return [];
        }),
        // 3. Custos Extras
        CustoExtraOperacionalService.getByDate(effectiveDate, effectiveEmpresaId).catch((err) => {
          console.error("[useLancamentosHojePortal] Erro ao buscar custos extras:", err);
          return [];
        }),
        // 4. Períodos Operacionais
        ServicosEspecificosLancamentoService.getByPeriodo(effectiveDate, effectiveDate, effectiveEmpresaId).catch((err) => {
          console.error("[useLancamentosHojePortal] Erro ao buscar periodos operacionais:", err);
          return [];
        }),
      ]);

      const normalized: LancamentoHojePortal[] = [];

      // Mapeamento: Operações por Volume
      for (const op of (operacoes || []) as any[]) {
        const statusInfo = mapStatusOperacao(op.status, op.status_rh);
        const createdAt = op.criado_em || op.data_operacao || new Date().toISOString();
        normalized.push({
          id: `op-${op.id}`,
          tipo: "OPERACAO",
          tipoLabel: "Operação",
          tipoBadgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
          horario: formatTimeLocal(op.criado_em || op.entrada_ponto),
          empresaNome: op.empresas?.nome || "Empresa",
          titulo: op.tipos_servico_operacional?.nome || op.tipo_servico_label || "Carga/Descarga",
          subtitulo: op.fornecedores?.nome || op.transportadoras_clientes?.nome || undefined,
          valor: typeof op.valor_total === "number" ? op.valor_total : Number(op.valor_total || 0),
          statusLabel: statusInfo.label,
          statusColorClass: statusInfo.className,
          createdAt,
        });
      }

      // Mapeamento: Serviços Extras
      for (const se of (servicosExtras || []) as any[]) {
        const statusInfo = mapStatusServicoExtra(se.pipeline_status);
        const createdAt = se.criado_em || se.created_at || se.data || new Date().toISOString();
        normalized.push({
          id: `se-${se.id}`,
          tipo: "SERVICO_EXTRA",
          tipoLabel: "Serviço Extra",
          tipoBadgeClass: "bg-purple-50 text-purple-700 border-purple-200",
          horario: formatTimeLocal(se.criado_em || se.created_at),
          empresaNome: se.empresas?.nome || "Empresa",
          titulo: se.descricao_servico || se.tipo_servico || "Serviço Extra",
          subtitulo: se.tipo_servico && se.descricao_servico ? se.tipo_servico : undefined,
          valor: typeof se.total === "number" ? se.total : Number(se.total || se.valor_total || 0),
          statusLabel: statusInfo.label,
          statusColorClass: statusInfo.className,
          createdAt,
        });
      }

      // Mapeamento: Custos / Despesas
      for (const ce of (custosExtras || []) as any[]) {
        const statusInfo = mapStatusCustoExtra(ce.pipeline_status || ce.status);
        const createdAt = ce.created_at || ce.criado_em || ce.data || new Date().toISOString();
        normalized.push({
          id: `ce-${ce.id}`,
          tipo: "CUSTO_EXTRA",
          tipoLabel: "Custo / Despesa",
          tipoBadgeClass: "bg-orange-50 text-orange-700 border-orange-200",
          horario: formatTimeLocal(ce.created_at || ce.criado_em),
          empresaNome: ce.empresas?.nome || "Empresa",
          titulo: ce.descricao || ce.categoria_custo || "Custo Extra",
          subtitulo: ce.categoria_custo || undefined,
          valor: typeof ce.total === "number" ? ce.total : Number(ce.total || ce.valor_total || ce.valor || 0),
          statusLabel: statusInfo.label,
          statusColorClass: statusInfo.className,
          createdAt,
        });
      }

      // Mapeamento: Períodos Operacionais
      for (const po of (servicosEspecificos || []) as any[]) {
        const statusInfo = mapStatusPeriodoOperacional(po.status);
        const createdAt = po.criado_em || po.created_at || po.data_operacao || new Date().toISOString();
        normalized.push({
          id: `po-${po.id}`,
          tipo: "PERIODO_OPERACIONAL",
          tipoLabel: "Período Operacional",
          tipoBadgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          horario: formatTimeLocal(po.criado_em || po.created_at),
          empresaNome: po.empresas?.nome || "Empresa",
          titulo: po.codigo_operacional || po.servicos_especificos_regras?.descricao || "Período Operacional",
          subtitulo: po.servicos_especificos_regras?.codigo || undefined,
          valor: typeof po.valor_total === "number" ? po.valor_total : Number(po.valor_total || 0),
          statusLabel: statusInfo.label,
          statusColorClass: statusInfo.className,
          createdAt,
        });
      }

      // Ordenação unificada: createdAt DESC (mais recente primeiro)
      normalized.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      return normalized;
    },
    enabled: Boolean(effectiveEmpresaId && !isLoadingConfig),
  });

  const isLoading = isLoadingConfig || isLoadingLaunches;

  return {
    launches,
    isLoading,
    isError,
    error,
    isIndeterminateScope,
    hasMultipleAuthorizedEmpresas,
    hasNoAuthorizedEmpresas,
    empresasAutorizadas,
    refetch,
    effectiveEmpresaId,
  };
}
