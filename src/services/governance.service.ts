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
