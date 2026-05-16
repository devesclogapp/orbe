import { supabase } from '@/lib/supabase';

export interface KPIIndicadoresGlobais {
  totalOperacional: number;
  totalFaturavel: number;
  totalFolha: number;
  totalDiaristas: number;
  totalCiclos: number;
  ciclosPendentes: number;
  ciclosRejeitados: number;
  remessasProntas: number;
  inconsistenciasCriticas: number;
}

export interface TimelineEvent {
  id: string;
  acao: string;
  usuario: string | null;
  modulo: string;
  competencia?: string | null;
  impacto: 'baixo' | 'medio' | 'critico';
  data_hora: string;
  observacao?: string | null;
}

export interface TimelineFilters {
  tenantId?: string;
  modulo?: string;
  impacto?: string;
  competencia?: string;
  usuario?: string;
  limit?: number;
  offset?: number;
}

export interface GovernancaTransicoesDiarias {
  aprovouRh: number;
  aprovouFinanceiro: number;
  preparouCnab: number;
  devolveuRh: number;
}

class GovernanceServiceClass {
  async getIndicadoresGlobais(tenantId?: string): Promise<KPIIndicadoresGlobais> {
    const { data, error } = await supabase.rpc('get_executive_governance_kpis', {
      p_tenant_id: tenantId || null
    });

    if (error) {
      console.error("Erro ao carregar KPIs executivos via RPC, fazendo fallback...", error);
      // Fallback pra garantir funcionamento caso RPC nao exista (antes de aplicar DB Migration)
      return {
        totalOperacional: 0,
        totalFaturavel: 0,
        totalFolha: 0,
        totalDiaristas: 0,
        totalCiclos: 0,
        ciclosPendentes: 0,
        ciclosRejeitados: 0,
        remessasProntas: 0,
        inconsistenciasCriticas: 0
      };
    }

    return data as KPIIndicadoresGlobais;
  }

  async getTimelineCorporativa(filters: TimelineFilters): Promise<TimelineEvent[]> {
    const { tenantId, modulo = 'TODOS', impacto = 'TODOS', competencia = 'TODAS', usuario = 'TODOS', limit = 50, offset = 0 } = filters;

    const { data, error } = await supabase.rpc('get_governance_timeline', {
      p_tenant_id: tenantId || null,
      p_modulo: modulo,
      p_impacto: impacto,
      p_competencia: competencia,
      p_usuario: usuario,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error("Erro ao carregar Timeline via RPC:", error);
      return [];
    }

    return data as TimelineEvent[];
  }

  async getTransicoesDiarias(tenantId?: string): Promise<GovernancaTransicoesDiarias> {
    let effectiveTenantId = tenantId || null;

    if (!effectiveTenantId) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();
        effectiveTenantId = profile?.tenant_id || null;
      }
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    let query = (supabase as any)
      .from("rh_financeiro_lote_historico")
      .select("acao, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .in("acao", ["APROVOU_RH", "APROVOU_FINANCEIRO", "PREPAROU_CNAB", "DEVOLVEU"]);

    if (effectiveTenantId) {
      query = query.eq("tenant_id", effectiveTenantId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar transições diárias de governança:", error);
      return {
        aprovouRh: 0,
        aprovouFinanceiro: 0,
        preparouCnab: 0,
        devolveuRh: 0,
      };
    }

    const rows = data || [];
    return {
      aprovouRh: rows.filter((r: any) => r.acao === "APROVOU_RH").length,
      aprovouFinanceiro: rows.filter((r: any) => r.acao === "APROVOU_FINANCEIRO").length,
      preparouCnab: rows.filter((r: any) => r.acao === "PREPAROU_CNAB").length,
      devolveuRh: rows.filter((r: any) => r.acao === "DEVOLVEU").length,
    };
  }

  // Prepara arquitetura de exportação
  async exportTimelineToXLS(filters: TimelineFilters): Promise<Blob | null> {
    console.log("Preparando exportação XLS com filtros:", filters);
    // Placeholder para Fase 8: Geração do Blob XLS a partir de endpoint server-side ou lib local
    return null;
  }

  async exportTimelineToPDF(filters: TimelineFilters): Promise<Blob | null> {
    console.log("Preparando exportação PDF com filtros:", filters);
    // Placeholder para Fase 8: Geração do Blob PDF 
    return null;
  }
}

export const GovernanceService = new GovernanceServiceClass();
