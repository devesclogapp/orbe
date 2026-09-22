import { supabase } from "@/lib/supabase";
import { Competencia } from "../../types/motor.types";
import { MotorFinanceiro } from "./MotorFinanceiro";
import { normalizeRole, normalizePermissionMatrix, canAccessModule } from "@/lib/access-control";

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

export interface ResultadoRevalidacaoCiclo {
  liberado: boolean;
  motivo?: string;
  motivos: string[];
  ciclo?: CicloOperacional;
}

export interface AuditoriaWorkflowCiclo {
  id: string;
  tenant_id: string;
  ciclo_id: string;
  usuario_id: string;
  etapa: 'OPERACIONAL' | 'RH' | 'FINANCEIRO' | 'REMESSA' | 'AUTOMACAO';
  acao: 'APROVAR' | 'REJEITAR' | 'REABRIR' | 'GERAR' | 'AUTO_CURAR' | 'LIBERAR' | 'RECUPERAR';
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
   * Obtém os ciclos de uma competência.
   * Suporta isolamento por empresa: se `empresaId` for fornecido, filtra somente os ciclos
   * daquela empresa. Caso contrário, retorna todos os ciclos do tenant para a competência.
   * Se não existirem ciclos, são criados automaticamente.
   */
  static async getCiclosDaCompetencia(
    tenantId: string,
    competencia: string,
    empresaId?: string | null,
  ): Promise<CicloOperacional[]> {
    let query = supabase
      .from('ciclos_operacionais')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('competencia', competencia)
      .order('semana_operacional', { ascending: true });

    // Isolamento opcional por empresa
    if (empresaId) {
      query = (query as any).eq('empresa_id', empresaId);
    }

    const { data: ciclos, error } = await query;
    if (error) throw error;

    // Se já existem registros de ciclos, apenas retornar
    if (ciclos && ciclos.length > 0) {
      return ciclos as CicloOperacional[];
    }

    // Se não existem, criar automaticamente para o tenant (ou empresa específica)
    return this.gerarCiclosAutomaticosDaCompetencia(tenantId, competencia, empresaId);
  }

  /**
   * Obtém o ciclo operacional aplicável a uma data, criando-o se necessário.
   * Respeita o isolamento por empresa.
   */
  static async getCicloIdParaData(
    tenantId: string,
    dataProcessamento: string,
    empresaId?: string | null,
  ): Promise<CicloOperacional> {
    const competencia = dataProcessamento.substring(0, 7);
    const semana = this.getSemanaOperacionalDaData(dataProcessamento);
    const ciclos = await this.getCiclosDaCompetencia(tenantId, competencia, empresaId);

    const ciclo = ciclos.find(c => c.semana_operacional === semana);
    if (!ciclo) {
      throw new Error(`Ciclo não encontrado para semana ${semana} de ${competencia}`);
    }
    return ciclo;
  }

  private static async gerarCiclosAutomaticosDaCompetencia(
    tenantId: string,
    competencia: string,
    empresaId?: string | null,
  ): Promise<CicloOperacional[]> {
    const [year, month] = competencia.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0);
    const numberOfWeeks = this.getSemanaOperacionalDaData(
      `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`,
    );

    const ciclosParaInserir = [];

    for (let sem = 1; sem <= numberOfWeeks; sem++) {
      const { data_inicio, data_fim } = this.getLimitesSemana(competencia, sem);
      const ciclo: Record<string, unknown> = {
        tenant_id: tenantId,
        competencia,
        semana_operacional: sem,
        data_inicio,
        data_fim,
        status: 'aberto',
      };
      // Vincula à empresa específica quando fornecida
      if (empresaId) ciclo.empresa_id = empresaId;
      ciclosParaInserir.push(ciclo);
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
      .select('status, tenant_id, status_automacao, total_inconsistencias')
      .eq('id', cicloId)
      .single();
      
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status === 'fechado' || ciclo.status === 'enviado_financeiro') {
      throw new Error("Ciclo já está fechado.");
    }

    if ((ciclo.total_inconsistencias || 0) > 0) {
      throw new Error("Não é possível fechar: existem inconsistências críticas no ciclo.");
    }

    if (ciclo.status_automacao !== 'pronto_para_fechamento') {
      throw new Error("Não é possível fechar: o motor operacional ainda não liberou esta semana.");
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
      .select('status, status_rh, total_inconsistencias, status_remessa, tenant_id, empresa_id, competencia, data_inicio, data_fim')
      .eq('id', cicloId)
      .single();
    if (errFetch || !ciclo) throw new Error("Ciclo não encontrado");
    
    if (ciclo.status !== 'fechado') {
      throw new Error("O ciclo precisa estar fechado operacionalmente antes da validação Financeira.");
    }

    if (ciclo.status_rh !== 'validado_rh') {
       throw new Error("O ciclo precisa estar validado pelo RH antes da validação Financeira.");
    }

    if ((ciclo.total_inconsistencias || 0) > 0) {
      throw new Error("Não é possível validar no Financeiro: existem inconsistências no ciclo.");
    }

    // Blindagem canônica: Custos Extras pendentes no período da semana
    if (ciclo.empresa_id && ciclo.data_inicio && ciclo.data_fim) {
      let queryCustos = supabase
        .from('custos_extras_operacionais')
        .select('id, data, pipeline_status, status_pagamento')
        .eq('empresa_id', ciclo.empresa_id)
        .gte('data', ciclo.data_inicio)
        .lte('data', ciclo.data_fim)
        .is('deleted_at', null)
        .in('pipeline_status', ['RECEBIDO', 'EM_VALIDACAO']);

      if (ciclo.tenant_id) {
        queryCustos = queryCustos.eq('tenant_id', ciclo.tenant_id);
      }

      const { data: custosPendentes, error: errCustos } = await queryCustos;
      if (errCustos) {
        throw new Error(`Erro ao verificar custos extras pendentes: ${errCustos.message}`);
      }

      const ativosPendentes = (custosPendentes || []).filter(
        (item: any) => String(item.status_pagamento || '').toUpperCase() !== 'CANCELADO'
      );

      if (ativosPendentes.length > 0) {
        throw new Error(
          `Não é possível aprovar no Financeiro: existe(m) ${ativosPendentes.length} custo(s) extra(s) pendente(s) de validação operacional neste período.`
        );
      }
    }

    const { data, error } = await supabase
      .from('ciclos_operacionais')
      .update({
        status_financeiro: 'validado_financeiro',
        status: 'enviado_financeiro',
        status_remessa: ciclo.status_remessa === 'nao_gerada' ? 'pronta' : ciclo.status_remessa
      })
      .eq('id', cicloId)
      .select()
      .single();

    if (error) throw error;
    await this.registrarAuditoria(ciclo.tenant_id, cicloId, usuarioId, 'FINANCEIRO', 'APROVAR', observacao);
    
    // Integração com o MotorFinanceiro:
    if (ciclo.empresa_id && ciclo.competencia && ciclo.tenant_id) {
       await MotorFinanceiro.processarFechamento(ciclo.competencia, ciclo.empresa_id, ciclo.tenant_id);
    }
    
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
   * Revalidação Canônica Individual do Ciclo Operacional
   * Executa verificações de integridade estritas para um ciclo específico antes de liberá-lo.
   */
  static async revalidarCicloIndividual(
    cicloId: string,
    usuarioId?: string,
  ): Promise<ResultadoRevalidacaoCiclo> {
    // 1. Identificar e validar usuário autenticado
    let effectiveUserId = usuarioId;
    if (!effectiveUserId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    if (!effectiveUserId) {
      throw new Error("Acesso não autorizado: usuário não autenticado.");
    }

    // 2. Carregar o ciclo operacional alvo
    const { data: ciclo, error: errFetch } = await supabase
      .from('ciclos_operacionais')
      .select('*')
      .eq('id', cicloId)
      .single();

    if (errFetch || !ciclo) {
      throw new Error("Ciclo operacional não encontrado.");
    }

    // 3. Validar tenant e autorização RBAC
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    const { data: userPerm } = await supabase
      .from('user_permissions')
      .select('role, permissions, status')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    const userTenantId = profile?.tenant_id;
    if (userTenantId && ciclo.tenant_id && userTenantId !== ciclo.tenant_id) {
      throw new Error("Acesso não autorizado: o ciclo pertence a outro tenant.");
    }

    const effectiveRole = normalizeRole(userPerm?.role || profile?.role || 'user');
    let hasPermission = effectiveRole === 'admin';

    if (!hasPermission) {
      const permissions = normalizePermissionMatrix(userPerm?.permissions, effectiveRole);
      hasPermission = canAccessModule(permissions, 'fechamento_mensal', 'processar') ||
                      canAccessModule(permissions, 'fechamento_mensal', 'fechar') ||
                      canAccessModule(permissions, 'fechamento_mensal', 'aprovar');
    }

    if (!hasPermission) {
      throw new Error("Acesso negado: usuário não possui permissão para revalidar fechamento mensal.");
    }

    // 4. Verificar estado elegível do ciclo (não sofrer mutação se fechado/enviado)
    if (ciclo.status === 'fechado' || ciclo.status === 'enviado_financeiro') {
      return {
        liberado: false,
        motivo: "Ciclo já se encontra fechado ou enviado ao financeiro.",
        motivos: ["Ciclo já se encontra fechado ou enviado ao financeiro."],
        ciclo: ciclo as CicloOperacional,
      };
    }

    const motivos: string[] = [];

    // 5. Verificar total_inconsistencias do próprio ciclo
    if (Number(ciclo.total_inconsistencias || 0) > 0) {
      motivos.push(`Ciclo possui ${ciclo.total_inconsistencias} inconsistência(s) crítica(s) registrada(s).`);
    }

    // 6. Verificar alertas críticos ativos da empresa
    if (ciclo.empresa_id) {
      const { data: alertasCriticos } = await supabase
        .from('automacao_alertas')
        .select('id, tipo, severidade, mensagem')
        .eq('empresa_id', ciclo.empresa_id)
        .eq('resolvido', false)
        .eq('severidade', 'critical');

      if (alertasCriticos && alertasCriticos.length > 0) {
        for (const alerta of alertasCriticos) {
          motivos.push(`Alerta crítico ativo na empresa: ${alerta.mensagem}`);
        }
      }
    }

    // 7. Verificar alertas ativos vinculados explicitamente a este ciclo
    const { data: alertasCiclo } = await supabase
      .from('automacao_alertas')
      .select('id, tipo, severidade, mensagem')
      .eq('resolvido', false)
      .contains('contexto_json', { ciclo_id: cicloId });

    if (alertasCiclo && alertasCiclo.length > 0) {
      for (const alerta of alertasCiclo) {
        if (alerta.severidade !== 'resolvido') {
          motivos.push(`Alerta ativo no ciclo: ${alerta.mensagem}`);
        }
      }
    }

    // 8. Verificações delimitadas pelo período operacional do ciclo (data_inicio a data_fim)
    if (ciclo.data_inicio && ciclo.data_fim && ciclo.empresa_id) {
      // 8.1 Batidas de ponto incompletas no período
      const { data: pontosProblematicos } = await supabase
        .from('registros_ponto')
        .select('id, status')
        .eq('empresa_id', ciclo.empresa_id)
        .gte('data_registro', ciclo.data_inicio)
        .lte('data_registro', ciclo.data_fim)
        .in('status', ['incompleto', 'Incompleto'])
        .limit(10);

      if (pontosProblematicos && pontosProblematicos.length > 0) {
        motivos.push(`${pontosProblematicos.length} registro(s) de ponto incompleto(s) no período do ciclo.`);
      }

      // 8.2 Operações de produção com erro ou status inconsistente no período
      const { data: operacoesProblematicas } = await supabase
        .from('operacoes_producao')
        .select('id, status')
        .eq('empresa_id', ciclo.empresa_id)
        .gte('data_operacao', ciclo.data_inicio)
        .lte('data_operacao', ciclo.data_fim)
        .in('status', ['INCONSISTENTE', 'erro'])
        .limit(10);

      if (operacoesProblematicas && operacoesProblematicas.length > 0) {
        motivos.push(`${operacoesProblematicas.length} operação(ões) de produção inconsistente(s) no período do ciclo.`);
      }
    }

    // 9. Se encontrar qualquer bloqueio, NÃO alterar status_automacao
    if (motivos.length > 0) {
      return {
        liberado: false,
        motivo: motivos.join("; "),
        motivos,
        ciclo: ciclo as CicloOperacional,
      };
    }

    // 10. Quando todas as verificações forem aprovadas, transicionar exclusivamente este ciclo
    const now = new Date().toISOString();
    const { data: cicloAtualizado, error: errUpdate } = await supabase
      .from('ciclos_operacionais')
      .update({
        status_automacao: 'pronto_para_fechamento',
        status_automacao_atualizado_em: now,
        auto_cura_liberado_em: now,
      })
      .eq('id', cicloId)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    // 11. Registrar auditoria de workflow
    await this.registrarAuditoria(
      ciclo.tenant_id,
      cicloId,
      effectiveUserId,
      'AUTOMACAO',
      'LIBERAR',
      'Ciclo revalidado e liberado individualmente via validação canônica'
    );

    return {
      liberado: true,
      motivo: "Ciclo revalidado e liberado com sucesso.",
      motivos: [],
      ciclo: cicloAtualizado as CicloOperacional,
    };
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


