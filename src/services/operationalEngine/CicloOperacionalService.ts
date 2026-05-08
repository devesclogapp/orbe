import { supabase } from "@/lib/supabase";
import { Competencia } from "../../types/motor.types";

export type StatusCiclo = 'aberto' | 'processando' | 'validacao' | 'fechado' | 'enviado_financeiro';
export type StatusWorkflowRH = 'pendente' | 'validado_rh' | 'rejeitado_rh';
export type StatusWorkflowFinanceiro = 'pendente' | 'validado_financeiro' | 'rejeitado_financeiro';
export type StatusWorkflowRemessa = 'nao_gerada' | 'pronta' | 'remetida' | 'retornada';
export type StatusAutomacao = 'aguardando_validacao' | 'inconsistencias_detectadas' | 'pronto_para_fechamento' | 'bloqueado_automacao';

export interface CicloOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  semana_operacional: number;
  data_inicio: string;
  data_fim: string;
  status: StatusCiclo;
  status_rh: StatusWorkflowRH;
  status_financeiro: StatusWorkflowFinanceiro;
  status_remessa: StatusWorkflowRemessa;
  status_automacao?: StatusAutomacao;
  valor_operacional: number;
  valor_faturavel: number;
  valor_folha: number;
  total_registros: number;
  total_processados: number;
  total_inconsistencias: number;
  criado_em: string;
  fechado_em: string | null;
  fechado_por: string | null;
  updated_at: string;
}

export interface AuditoriaWorkflowCiclo {
  id: string;
  tenant_id: string;
  ciclo_id: string;
  usuario_id: string;
  etapa: 'OPERACIONAL' | 'RH' | 'FINANCEIRO' | 'REMESSA';
  acao: 'APROVAR' | 'REJEITAR' | 'REABRIR' | 'GERAR';
  observacao?: string;
  criado_em: string;
}

export class CicloOperacionalService {
  /**
   * Helper: Descobre a qual semana do mês (1 a 5/6) pertence uma data.
   * Consideramos que a semana inicia na Segunda-feira (1) e termina no Domingo (0).
   */
  static getSemanaOperacionalDaData(dataStr: string): number {
    const date = new Date(`${dataStr}T00:00:00`);
    const day = date.getDate();
    // Identificar que dia da semana a competência começou para offset
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    // getDay: 0 = domingo, 1 = seg ... 6 = sab
    // Para iniciar na segunda, ajustamos: Seg=0, Ter=1 ... Dom=6
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7; 
    
    return Math.ceil((day + firstDayOfWeek) / 7);
  }

  /**
   * Helper: Retorna as datas de início e fim da semana operacional do mês.
   */
  static getLimitesSemana(competencia: string, semana: number): { data_inicio: string, data_fim: string } {
    const [year, month] = competencia.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    // Início da semana solicitada
    const startOffset = (semana - 1) * 7 - firstDayOfWeek;
    let startDay = startOffset + 1;
    if (startDay < 1) startDay = 1;
    
    let endDay = startOffset + 7;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (endDay > lastDayOfMonth) endDay = lastDayOfMonth;

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      data_inicio: `${year}-${pad(month)}-${pad(startDay)}`,
      data_fim: `${year}-${pad(month)}-${pad(endDay)}`
    };
  }

  /**
   * Obtém os ciclos de uma competência. Se não existirem, são criados automaticamente.
   */
  static async getCiclosDaCompetencia(tenantId: string, competencia: string): Promise<CicloOperacional[]> {
    const { data: ciclos, error } = await supabase
      .from('ciclos_operacionais')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('competencia', competencia)
      .order('semana_operacional', { ascending: true });

    if (error) throw error;
    
    // Se já existem registros de ciclos, apenas retornar
    if (ciclos && ciclos.length > 0) {
      return ciclos as CicloOperacional[];
    }

    // Se não existem, vamos criar até 5 ou 6 semanas do mês
    return this.gerarCiclosAutomaticosDaCompetencia(tenantId, competencia);
  }

  /**
   * Obtém o ciclo operacional aplicável a uma data, criando-o se necessário.
   */
  static async getCicloIdParaData(tenantId: string, dataProcessamento: string): Promise<CicloOperacional> {
    const competencia = dataProcessamento.substring(0, 7);
    const semana = this.getSemanaOperacionalDaData(dataProcessamento);
    const ciclos = await this.getCiclosDaCompetencia(tenantId, competencia);
    
    const ciclo = ciclos.find(c => c.semana_operacional === semana);
    if (!ciclo) {
       throw new Error(`Ciclo não encontrado para semana ${semana} de ${competencia}`);
    }
    return ciclo;
  }

  private static async gerarCiclosAutomaticosDaCompetencia(tenantId: string, competencia: string): Promise<CicloOperacional[]> {
    const [year, month] = competencia.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0); // último dia do mês
    const numberOfWeeks = this.getSemanaOperacionalDaData(`${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`);
    
    const ciclosParaInserir = [];

    for (let sem = 1; sem <= numberOfWeeks; sem++) {
      const { data_inicio, data_fim } = this.getLimitesSemana(competencia, sem);
      ciclosParaInserir.push({
        tenant_id: tenantId,
        competencia,
        semana_operacional: sem,
        data_inicio,
        data_fim,
        status: 'aberto',
      });
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .insert(ciclosParaInserir)
      .select('*')
      .order('semana_operacional', { ascending: true });
      
    if (error) throw error;
    return data as CicloOperacional[];
  }

  /**
   * Atualiza totais ou status do ciclo
   */
  static async updateCiclo(id: string, updates: Partial<CicloOperacional>) {
    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CicloOperacional;
  }

  /**
   * Trava de fechamento da semana operacional
   */
  static async fecharSemana(cicloId: string, usuarioId: string): Promise<CicloOperacional> {
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('status, tenant_id, status_automacao')
      .eq('id', cicloId)
      .single();
      
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status === 'fechado' || ciclo.status === 'enviado_financeiro') {
      throw new Error("Ciclo já está fechado.");
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({
        status: 'fechado',
        fechado_em: new Date().toISOString(),
        fechado_por: usuarioId
      })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'OPERACIONAL', 'APROVAR', 'Fechamento operacional da semana');
    
    return data as CicloOperacional;
  }

  /**
   * Reabertura de semana (protegido se tiver validado_financeiro)
   */
  static async reabrirSemana(cicloId: string, usuarioId: string, observacao: string = 'Reabertura solicitada'): Promise<CicloOperacional> {
     const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('status, status_financeiro, tenant_id')
      .eq('id', cicloId)
      .single();
      
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status_financeiro === 'validado_financeiro') {
      throw new Error("Ciclo possui validação financeira ativa e não pode ser reaberto diretamente sem autorização avançada.");
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({
        status: 'aberto',
        status_rh: 'pendente',
        status_financeiro: 'pendente',
        fechado_em: null,
        fechado_por: null
      })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'OPERACIONAL', 'REABRIR', observacao);
    
    return data as CicloOperacional;
  }

  /**
   * Workflow RH - Validar
   */
  static async validarRH(cicloId: string, usuarioId: string, observacao: string = 'Validação de RH realizada'): Promise<CicloOperacional> {
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('status, tenant_id')
      .eq('id', cicloId)
      .single();
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status !== 'fechado') {
       throw new Error("O ciclo precisa estar fechado operacionalmente para validação do RH.");
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({ status_rh: 'validado_rh' })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'RH', 'APROVAR', observacao);
    return data as CicloOperacional;
  }

  /**
   * Workflow RH - Rejeitar
   */
  static async rejeitarRH(cicloId: string, usuarioId: string, motivo: string): Promise<CicloOperacional> {
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('status, tenant_id')
      .eq('id', cicloId)
      .single();
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({ status_rh: 'rejeitado_rh' })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'RH', 'REJEITAR', motivo);
    return data as CicloOperacional;
  }

  /**
   * Workflow Financeiro - Validar
   */
  static async validarFinanceiro(cicloId: string, usuarioId: string, observacao: string = 'Validação financeira concluída'): Promise<CicloOperacional> {
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('status_rh, tenant_id')
      .eq('id', cicloId)
      .single();
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status_rh !== 'validado_rh') {
       throw new Error("O ciclo precisa estar validado pelo RH antes da validação Financeira.");
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({ status_financeiro: 'validado_financeiro' })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'FINANCEIRO', 'APROVAR', observacao);
    return data as CicloOperacional;
  }

  /**
   * Workflow Financeiro - Rejeitar
   */
  static async rejeitarFinanceiro(cicloId: string, usuarioId: string, motivo: string): Promise<CicloOperacional> {
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('tenant_id')
      .eq('id', cicloId)
      .single();
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({ status_financeiro: 'rejeitado_financeiro' })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'FINANCEIRO', 'REJEITAR', motivo);
    return data as CicloOperacional;
  }

  /**
   * Registrar auditoria de workflow
   */
  private static async registrarAuditoria(tenantId: string, cicloId: string, usuarioId: string, etapa: string, acao: string, observacao?: string) {
    await supabase.from('auditoria_workflow_ciclos').insert({
      tenant_id: tenantId,
      ciclo_id: cicloId,
      usuario_id: usuarioId,
      etapa,
      acao,
      observacao
    });
  }
}

