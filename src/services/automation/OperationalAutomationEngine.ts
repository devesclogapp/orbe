/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export type AutomacaoStatus = 'pendente' | 'executando' | 'concluido' | 'falhou' | 'cancelado';
export type AutomacaoTipo = 'PROCESSAMENTO_RH' | 'SUGESTAO_FECHAMENTO' | 'VALIDACAO_FINANCEIRA' | 'AUTO_CURA';

export interface AutomacaoExecucao {
  id?: string;
  empresa_id: string;
  tenant_id?: string | null;
  tipo: AutomacaoTipo;
  status: AutomacaoStatus;
  prioridade?: number;
  contexto_json?: any;
  resultado_json?: any;
  erro?: string;
  iniciado_em?: string;
  finalizado_em?: string;
  executado_por?: string;
}

export type AlertaTipo =
  | 'colaborador_sem_regra'
  | 'excesso_horas'
  | 'conta_bancaria_invalida'
  | 'fechamento_atrasado'
  | 'remessa_rejeitada'
  | 'ponto_incompleto'
  | 'ciclo_sem_aprovacao'
  | 'falta_nao_justificada'
  | 'cpf_invalido'
  | 'favorecido_invalido'
  | 'producao_inconsistente'
  | 'ciclo_invalidado_automaticamente';

export type AlertaSeveridade = 'low' | 'medium' | 'high' | 'critical' | 'resolvido';

export interface AutomacaoAlerta {
  id?: string;
  empresa_id: string;
  tenant_id?: string | null;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  mensagem: string;
  contexto_json?: any;
  resolvido?: boolean;
}

interface EscopoAutomacao {
  tenantId: string | null;
  empresaIds: string[];
  empresaPrincipalId: string;
}

interface AvaliacaoAutoCura {
  estado: 'ativo' | 'parcial' | 'resolvido' | 'ignorado';
  mensagem?: string;
  novaSeveridade?: AlertaSeveridade;
  detalhes?: Record<string, unknown>;
}

export interface AutoCuraResultado {
  alertasReavaliados: number;
  alertasResolvidos: number;
  severidadesReduzidas: number;
  ciclosLiberados: number;
  jobsOrfaosEncerrados: number;
  locksExpiradosRemovidos: number;
  heartbeatsRecuperados: number;
  retriesAbandonados: number;
  ignoradosPorAntiLoop: number;
}

export interface SaudeOperacional {
  alertasAtivos: number;
  alertasAutoCurados: number;
  bloqueiosRemovidos: number;
  severidadeMedia: number;
  tempoMedioResolucaoMinutos: number;
}

const AUTO_CURA_COOLDOWN_MS = 30 * 60 * 1000;
const AUTO_CURA_MAX_BATCH = 100;
const SEVERIDADE_PESO: Record<AlertaSeveridade, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
  resolvido: 0,
};

const SEVERIDADE_REVERSA: Record<AlertaSeveridade, AlertaSeveridade> = {
  critical: 'high',
  high: 'medium',
  medium: 'low',
  low: 'low',
  resolvido: 'resolvido',
};

const STATUS_PONTO_OK = new Set([
  'ok',
  'ajustado',
  'Processado',
  'Presente',
  'Atestado',
  'Folga',
  'Ferias',
  'Férias',
  'Banco de Horas',
  'Home Office',
]);

const STATUS_PROBLEMA_PONTO = new Set([
  'incompleto',
  'Incompleto',
  'inconsistente',
  'Inconsistente',
  'Falta',
  'Ausente',
  'falta_injustificada',
]);

const onlyDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');

const isCpfValido = (cpf?: string | null) => {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;

  const calc = (size: number) => {
    const sum = digits
      .slice(0, size)
      .split('')
      .reduce((acc, digit, index) => acc + Number(digit) * (size + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
};

const hasValidCnpj = (cnpj?: string | null) => onlyDigits(cnpj).length === 14;

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

export const OperationalAutomationEngine = {
  // ==========================================
  // ESCOPO TENANT / EMPRESA
  // ==========================================

  async resolverEscopo(scopeId: string): Promise<EscopoAutomacao> {
    const { data: empresaDireta } = await supabase
      .from('empresas')
      .select('id, tenant_id')
      .eq('id', scopeId)
      .limit(1);

    if (empresaDireta && empresaDireta.length > 0) {
      return {
        tenantId: empresaDireta[0].tenant_id || null,
        empresaIds: [empresaDireta[0].id],
        empresaPrincipalId: empresaDireta[0].id,
      };
    }

    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, tenant_id')
      .eq('tenant_id', scopeId)
      .order('created_at', { ascending: true })
      .limit(50);

    const empresaIds = (empresas || []).map((empresa: any) => empresa.id);
    if (empresaIds.length === 0) {
      return { tenantId: scopeId, empresaIds: [], empresaPrincipalId: scopeId };
    }

    return {
      tenantId: scopeId,
      empresaIds,
      empresaPrincipalId: empresaIds[0],
    };
  },

  // ==========================================
  // FILA E AGENDAMENTO
  // ==========================================

  async agendarExecucao(execucao: Partial<AutomacaoExecucao>): Promise<string> {
    if (!execucao.empresa_id) throw new Error('Empresa/tenant obrigatorio para agendar automacao.');

    const escopo = await this.resolverEscopo(execucao.empresa_id);
    if (escopo.empresaIds.length === 0) {
      throw new Error('Nenhuma empresa operacional encontrada para o tenant informado.');
    }

    const { data, error } = await supabase.from('automacao_execucoes').insert({
      empresa_id: escopo.empresaPrincipalId,
      tenant_id: escopo.tenantId,
      tipo: execucao.tipo,
      status: 'pendente',
      contexto_json: execucao.contexto_json || {},
      prioridade: execucao.prioridade || 0,
    }).select('id').single();

    if (error) throw error;
    return data.id;
  },

  async agendarLoteAssincrono(scopeId: string): Promise<void> {
    await this.agendarExecucao({ empresa_id: scopeId, tipo: 'PROCESSAMENTO_RH', prioridade: 10 });
    await this.agendarExecucao({ empresa_id: scopeId, tipo: 'SUGESTAO_FECHAMENTO', prioridade: 5 });
    await this.agendarExecucao({ empresa_id: scopeId, tipo: 'VALIDACAO_FINANCEIRA', prioridade: 3 });
    await this.agendarExecucao({ empresa_id: scopeId, tipo: 'AUTO_CURA', prioridade: 1 });
  },

  async processarFila(scopeId: string): Promise<void> {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return;

    const { data: pendentes, error } = await supabase
      .from('automacao_execucoes')
      .select('*')
      .in('empresa_id', escopo.empresaIds)
      .eq('status', 'pendente')
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;
    if (!pendentes || pendentes.length === 0) return;

    for (const job of pendentes) {
      await this.executarJob(job);
    }
  },

  async executarJob(job: any): Promise<void> {
    try {
      await supabase.from('automacao_execucoes').update({
        status: 'executando',
        iniciado_em: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      }).eq('id', job.id);

      const resultado = await this.executarTipoAutomacao(job.tipo, job.empresa_id);

      await supabase.from('automacao_execucoes').update({
        status: 'concluido',
        finalizado_em: new Date().toISOString(),
        resultado_json: resultado,
        locked_at: null,
        locked_by: null,
        heartbeat_at: null,
      }).eq('id', job.id);
    } catch (err: any) {
      await supabase.from('automacao_execucoes').update({
        status: 'falhou',
        finalizado_em: new Date().toISOString(),
        erro: err.message || JSON.stringify(err),
        locked_at: null,
        locked_by: null,
      }).eq('id', job.id);
    }
  },

  async executarTipoAutomacao(tipo: AutomacaoTipo, empresaId: string) {
    switch (tipo) {
      case 'PROCESSAMENTO_RH':
        return this.automatizarProcessamentoRH(empresaId);
      case 'SUGESTAO_FECHAMENTO':
        return this.sugerirFechamento(empresaId);
      case 'VALIDACAO_FINANCEIRA':
        return this.validarFinanceiro(empresaId);
      case 'AUTO_CURA':
        return this.executarAutoCura(empresaId);
      default:
        throw new Error('Tipo automacao nao suportado');
    }
  },

  // ==========================================
  // CONECTORES DE NEGOCIO DA AUTOMACAO
  // ==========================================

  async automatizarProcessamentoRH(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return { verificados: 0, colabsSemRegra: 0, faltasCount: 0, pontosIncompletos: 0 };

    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('id, nome, cpf, regras_operacionais_id, status, empresa_id, tenant_id')
      .in('empresa_id', escopo.empresaIds);

    let colabsSemRegra = 0;
    if (colabs) {
      for (const colab of colabs as any[]) {
        if (!colab.regras_operacionais_id) {
          colabsSemRegra++;
          await this.registrarAlerta({
            empresa_id: colab.empresa_id || escopo.empresaPrincipalId,
            tenant_id: colab.tenant_id || escopo.tenantId,
            tipo: 'colaborador_sem_regra',
            severidade: 'high',
            mensagem: `Colaborador ${colab.nome} nao possui regra operacional vinculada.`,
            contexto_json: { colaborador_id: colab.id },
          });
        }

        if (colab.cpf && !isCpfValido(colab.cpf)) {
          await this.registrarAlerta({
            empresa_id: colab.empresa_id || escopo.empresaPrincipalId,
            tenant_id: colab.tenant_id || escopo.tenantId,
            tipo: 'cpf_invalido',
            severidade: 'high',
            mensagem: `CPF invalido detectado para ${colab.nome}.`,
            contexto_json: { colaborador_id: colab.id },
          });
        }
      }
    }

    const { data: pontos } = await supabase
      .from('registros_ponto')
      .select('id, colaborador_id, empresa_id, tenant_id, status, falta, entrada, saida, cpf_colaborador')
      .in('empresa_id', escopo.empresaIds)
      .in('status', Array.from(STATUS_PROBLEMA_PONTO));

    let faltasCount = 0;
    let pontosIncompletos = 0;

    for (const ponto of (pontos || []) as any[]) {
      if (ponto.status === 'Falta' || ponto.status === 'Ausente' || ponto.status === 'falta_injustificada' || ponto.falta) {
        faltasCount++;
        await this.registrarAlerta({
          empresa_id: ponto.empresa_id || escopo.empresaPrincipalId,
          tenant_id: ponto.tenant_id || escopo.tenantId,
          tipo: 'falta_nao_justificada',
          severidade: 'medium',
          mensagem: 'Falta nao justificada detectada para o registro de ponto.',
          contexto_json: { ponto_id: ponto.id, colaborador_id: ponto.colaborador_id },
        });
      }

      if (!ponto.entrada || !ponto.saida || ponto.status === 'incompleto' || ponto.status === 'Incompleto') {
        pontosIncompletos++;
        await this.registrarAlerta({
          empresa_id: ponto.empresa_id || escopo.empresaPrincipalId,
          tenant_id: ponto.tenant_id || escopo.tenantId,
          tipo: 'ponto_incompleto',
          severidade: 'high',
          mensagem: 'Registro de ponto incompleto aguardando correcao.',
          contexto_json: { ponto_id: ponto.id, colaborador_id: ponto.colaborador_id },
        });
      }

      if (ponto.cpf_colaborador && !isCpfValido(ponto.cpf_colaborador)) {
        await this.registrarAlerta({
          empresa_id: ponto.empresa_id || escopo.empresaPrincipalId,
          tenant_id: ponto.tenant_id || escopo.tenantId,
          tipo: 'cpf_invalido',
          severidade: 'high',
          mensagem: 'CPF invalido detectado no ponto importado.',
          contexto_json: { ponto_id: ponto.id, colaborador_id: ponto.colaborador_id },
        });
      }
    }

    await this.escalonarAlertas(scopeId);
    return { verificados: colabs?.length || 0, colabsSemRegra, faltasCount, pontosIncompletos };
  },

  async escalonarAlertas(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return;

    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: antigos } = await supabase
      .from('automacao_alertas')
      .select('*')
      .in('empresa_id', escopo.empresaIds)
      .eq('resolvido', false)
      .lt('criado_em', ontem)
      .neq('severidade', 'critical');

    for (const alerta of (antigos || []) as any[]) {
      let novaSeveridade: AlertaSeveridade = 'medium';
      if (alerta.severidade === 'low') novaSeveridade = 'medium';
      else if (alerta.severidade === 'medium') novaSeveridade = 'high';
      else if (alerta.severidade === 'high') novaSeveridade = 'critical';

      await supabase.from('automacao_alertas').update({
        severidade: novaSeveridade,
        severidade_anterior: alerta.severidade,
        severidade_original: alerta.severidade_original || alerta.severidade,
        mensagem: alerta.mensagem?.startsWith('[ESCALADO]') ? alerta.mensagem : `[ESCALADO] ${alerta.mensagem}`,
        atualizado_em: new Date().toISOString(),
      }).eq('id', alerta.id);
    }
  },

  async sugerirFechamento(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    if (!escopo.tenantId) return { ciclosSugeridos: 0 };

    const { data: ciclos } = await supabase
      .from('ciclos_operacionais')
      .select('*')
      .eq('tenant_id', escopo.tenantId)
      .in('status', ['aberto', 'processando', 'validacao']);

    if (!ciclos || ciclos.length === 0) return { ciclosSugeridos: 0 };

    const { data: alertasCriticos } = await supabase
      .from('automacao_alertas')
      .select('id')
      .in('empresa_id', escopo.empresaIds)
      .eq('resolvido', false)
      .eq('severidade', 'critical')
      .limit(1);

    let count = 0;
    for (const ciclo of ciclos as any[]) {
      if (!alertasCriticos || alertasCriticos.length === 0) {
        await supabase.from('ciclos_operacionais').update({
          status_automacao: 'pronto_para_fechamento',
          status_automacao_atualizado_em: new Date().toISOString(),
        }).eq('id', ciclo.id);
        count++;
      } else {
        await supabase.from('ciclos_operacionais').update({
          status_automacao: 'bloqueado_automacao',
          status_automacao_atualizado_em: new Date().toISOString(),
        }).eq('id', ciclo.id);
      }
    }

    return { ciclosQuePodemFechar: count };
  },

  async validarFinanceiro(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return { contasVistoriadas: 0, alertas_gerados: 0 };

    let alertas = 0;
    const { data: contas } = await supabase
      .from('contas_bancarias_empresa')
      .select('*')
      .in('empresa_id', escopo.empresaIds);

    for (const conta of (contas || []) as any[]) {
      const contaValida = Boolean(conta.conta && String(conta.conta).length >= 4);
      const agenciaValida = Boolean(conta.agencia && String(conta.agencia).length >= 3);
      const cnpjValido = hasValidCnpj(conta.cedente_cnpj);

      if (!contaValida || !agenciaValida || !cnpjValido) {
        alertas++;
        await this.registrarAlerta({
          empresa_id: conta.empresa_id || escopo.empresaPrincipalId,
          tenant_id: conta.tenant_id || escopo.tenantId,
          tipo: 'conta_bancaria_invalida',
          severidade: 'critical',
          mensagem: `Conta bancaria ${conta.banco_nome || conta.banco_codigo || ''} precisa de correcao antes da remessa.`,
          contexto_json: { conta_id: conta.id },
        });
      }
    }

    return { contasVistoriadas: contas?.length || 0, alertas_gerados: alertas };
  },

  // ==========================================
  // AUTO-CURA SUPERVISIONADA
  // ==========================================

  async executarAutoCura(scopeId: string): Promise<AutoCuraResultado> {
    const escopo = await this.resolverEscopo(scopeId);
    const resultado: AutoCuraResultado = {
      alertasReavaliados: 0,
      alertasResolvidos: 0,
      severidadesReduzidas: 0,
      ciclosLiberados: 0,
      jobsOrfaosEncerrados: 0,
      locksExpiradosRemovidos: 0,
      heartbeatsRecuperados: 0,
      retriesAbandonados: 0,
      ignoradosPorAntiLoop: 0,
    };

    if (escopo.empresaIds.length === 0) return resultado;

    const limpeza = await this.limparFilaInteligente(scopeId);
    resultado.jobsOrfaosEncerrados = limpeza.jobsOrfaosEncerrados;
    resultado.locksExpiradosRemovidos = limpeza.locksExpiradosRemovidos;
    resultado.heartbeatsRecuperados = limpeza.heartbeatsRecuperados;
    resultado.retriesAbandonados = limpeza.retriesAbandonados;

    const { data: alertas } = await supabase
      .from('automacao_alertas')
      .select('*')
      .in('empresa_id', escopo.empresaIds)
      .eq('resolvido', false)
      .order('criado_em', { ascending: true })
      .limit(AUTO_CURA_MAX_BATCH);

    for (const alerta of (alertas || []) as any[]) {
      if (this.deveIgnorarPorAntiLoop(alerta)) {
        resultado.ignoradosPorAntiLoop++;
        continue;
      }

      resultado.alertasReavaliados++;
      const avaliacao = await this.avaliarAlertaParaAutoCura(alerta);

      if (avaliacao.estado === 'resolvido') {
        await this.resolverAlertaAutomaticamente(alerta, avaliacao);
        resultado.alertasResolvidos++;
      } else if (avaliacao.estado === 'parcial') {
        await this.reduzirSeveridadeAlerta(alerta, avaliacao);
        resultado.severidadesReduzidas++;
      } else if (avaliacao.estado === 'ativo') {
        await this.marcarAutoCuraTentada(alerta, avaliacao);
      }
    }

    resultado.ciclosLiberados = await this.autoRevalidarCiclos(scopeId);

    await this.registrarAuditoriaAutomacao(
      escopo.tenantId,
      'Auto-cura executada',
      'baixo',
      { scopeId, ...resultado },
    );

    return resultado;
  },

  async avaliarAlertaParaAutoCura(alerta: any): Promise<AvaliacaoAutoCura> {
    const contexto = alerta.contexto_json || {};

    try {
      switch (alerta.tipo as AlertaTipo) {
        case 'colaborador_sem_regra':
          return this.avaliarColaboradorSemRegra(contexto);
        case 'falta_nao_justificada':
          return this.avaliarFaltaNaoJustificada(contexto);
        case 'ponto_incompleto':
          return this.avaliarPontoIncompleto(contexto);
        case 'excesso_horas':
          return this.avaliarExcessoHoras(contexto);
        case 'conta_bancaria_invalida':
          return this.avaliarContaBancaria(contexto);
        case 'cpf_invalido':
          return this.avaliarCpf(contexto);
        case 'favorecido_invalido':
          return this.avaliarFavorecido(contexto);
        case 'remessa_rejeitada':
          return this.avaliarRemessa(contexto);
        case 'producao_inconsistente':
          return this.avaliarProducao(contexto);
        case 'ciclo_invalidado_automaticamente':
        case 'ciclo_sem_aprovacao':
        case 'fechamento_atrasado':
          return this.avaliarCiclo(contexto);
        default:
          return { estado: 'ignorado', mensagem: 'Tipo de alerta sem regra de auto-cura.' };
      }
    } catch (error: any) {
      return {
        estado: 'ativo',
        mensagem: `Auto-cura nao conseguiu reavaliar o alerta: ${error.message || String(error)}`,
        detalhes: { erro: error.message || String(error) },
      };
    }
  },

  async avaliarColaboradorSemRegra(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.colaborador_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('colaboradores')
      .select('id, regras_operacionais_id, status')
      .eq('id', contexto.colaborador_id)
      .limit(1);

    const colab = data?.[0] as any;
    if (!colab) return { estado: 'resolvido', mensagem: 'Colaborador removido; alerta encerrado.' };
    if (colab.regras_operacionais_id) {
      return { estado: 'resolvido', mensagem: 'Regra operacional vinculada ao colaborador.' };
    }
    if (colab.status === 'ajustado') {
      return { estado: 'parcial', mensagem: 'Colaborador ajustado, mas regra operacional ainda nao foi vinculada.', novaSeveridade: 'medium' };
    }
    return { estado: 'ativo' };
  },

  async avaliarFaltaNaoJustificada(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.ponto_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('registros_ponto')
      .select('id, status, falta, observacoes')
      .eq('id', contexto.ponto_id)
      .limit(1);

    const ponto = data?.[0] as any;
    if (!ponto) return { estado: 'resolvido', mensagem: 'Registro de ponto removido; alerta encerrado.' };

    const observacao = String(ponto.observacoes || '').toLowerCase();
    if (STATUS_PONTO_OK.has(ponto.status) || observacao.includes('justific')) {
      return { estado: 'resolvido', mensagem: 'Falta justificada ou ponto regularizado.' };
    }
    if (ponto.status !== 'Falta' && ponto.status !== 'Ausente' && ponto.status !== 'falta_injustificada') {
      return { estado: 'parcial', mensagem: 'Falta saiu do estado critico, mas ainda demanda revisao.', novaSeveridade: 'low' };
    }
    return { estado: 'ativo' };
  },

  async avaliarPontoIncompleto(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.ponto_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('registros_ponto')
      .select('id, status, entrada, saida')
      .eq('id', contexto.ponto_id)
      .limit(1);

    const ponto = data?.[0] as any;
    if (!ponto) return { estado: 'resolvido', mensagem: 'Registro de ponto removido; alerta encerrado.' };
    if (ponto.entrada && ponto.saida && !STATUS_PROBLEMA_PONTO.has(ponto.status)) {
      return { estado: 'resolvido', mensagem: 'Ponto completado e status regularizado.' };
    }
    if (ponto.entrada || ponto.saida) {
      return { estado: 'parcial', mensagem: 'Ponto parcialmente corrigido; ainda falta batida ou validacao.', novaSeveridade: 'medium' };
    }
    return { estado: 'ativo' };
  },

  async avaliarExcessoHoras(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.ponto_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('registros_ponto')
      .select('id, status, saldo_dia, hora_extra')
      .eq('id', contexto.ponto_id)
      .limit(1);

    const ponto = data?.[0] as any;
    if (!ponto) return { estado: 'resolvido', mensagem: 'Registro de ponto removido; alerta encerrado.' };

    const saldoDia = Number(ponto.saldo_dia || 0);
    const horaExtra = Number(String(ponto.hora_extra || '0').replace(',', '.')) || 0;
    if (Math.abs(saldoDia) <= 120 && horaExtra <= 2 && !STATUS_PROBLEMA_PONTO.has(ponto.status)) {
      return { estado: 'resolvido', mensagem: 'Excesso de horas regularizado.' };
    }
    if (Math.abs(saldoDia) <= 240 || ponto.status === 'ajustado') {
      return { estado: 'parcial', mensagem: 'Excesso reduzido, mantendo alerta em severidade menor.', novaSeveridade: 'medium' };
    }
    return { estado: 'ativo' };
  },

  async avaliarContaBancaria(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.conta_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('contas_bancarias_empresa')
      .select('id, ativo, agencia, conta, cedente_cnpj')
      .eq('id', contexto.conta_id)
      .limit(1);

    const conta = data?.[0] as any;
    if (!conta) return { estado: 'resolvido', mensagem: 'Conta bancaria removida; alerta encerrado.' };

    const agenciaValida = Boolean(conta.agencia && String(conta.agencia).length >= 3);
    const contaValida = Boolean(conta.conta && String(conta.conta).length >= 4);
    const cnpjValido = hasValidCnpj(conta.cedente_cnpj);

    if (conta.ativo && agenciaValida && contaValida && cnpjValido) {
      return { estado: 'resolvido', mensagem: 'Conta bancaria corrigida e pronta para revalidacao.' };
    }
    if (agenciaValida && contaValida) {
      return { estado: 'parcial', mensagem: 'Dados bancarios principais corrigidos; documento ainda precisa revisao.', novaSeveridade: 'high' };
    }
    return { estado: 'ativo' };
  },

  async avaliarCpf(contexto: any): Promise<AvaliacaoAutoCura> {
    if (contexto.colaborador_id) {
      const { data } = await supabase.from('colaboradores').select('id, cpf').eq('id', contexto.colaborador_id).limit(1);
      const colab = data?.[0] as any;
      if (!colab || isCpfValido(colab.cpf)) return { estado: 'resolvido', mensagem: 'CPF valido reapareceu no cadastro.' };
    }

    if (contexto.ponto_id) {
      const { data } = await supabase.from('registros_ponto').select('id, cpf_colaborador').eq('id', contexto.ponto_id).limit(1);
      const ponto = data?.[0] as any;
      if (!ponto || isCpfValido(ponto.cpf_colaborador)) return { estado: 'resolvido', mensagem: 'CPF valido reapareceu no ponto.' };
    }

    return { estado: 'ativo' };
  },

  async avaliarFavorecido(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.lote_item_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('lote_pagamento_itens')
      .select('id, nome_colaborador, cpf, banco, agencia, conta')
      .eq('id', contexto.lote_item_id)
      .limit(1);

    const item = data?.[0] as any;
    if (!item) return { estado: 'resolvido', mensagem: 'Favorecido removido do lote; alerta encerrado.' };
    if (item.nome_colaborador && isCpfValido(item.cpf) && item.agencia && item.conta) {
      return { estado: 'resolvido', mensagem: 'Favorecido corrigido para remessa.' };
    }
    if (item.nome_colaborador && isCpfValido(item.cpf)) {
      return { estado: 'parcial', mensagem: 'Favorecido identificado; dados bancarios ainda pendentes.', novaSeveridade: 'medium' };
    }
    return { estado: 'ativo' };
  },

  async avaliarRemessa(contexto: any): Promise<AvaliacaoAutoCura> {
    if (contexto.remessa_id) {
      const { data } = await supabase.from('cnab_remessas_arquivos').select('id, status').eq('id', contexto.remessa_id).limit(1);
      const remessa = data?.[0] as any;
      if (!remessa || !['erro_homologacao', 'rejeitada', 'erro'].includes(remessa.status)) {
        return { estado: 'resolvido', mensagem: 'Remessa revalidada ou substituida.' };
      }
    }

    if (contexto.lote_id) {
      const { data } = await supabase.from('lotes_remessa').select('id, status').eq('id', contexto.lote_id).limit(1);
      const lote = data?.[0] as any;
      if (!lote || !String(lote.status || '').toLowerCase().includes('erro')) {
        return { estado: 'resolvido', mensagem: 'Lote de remessa revalidado.' };
      }
    }

    return { estado: 'ativo' };
  },

  async avaliarProducao(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.operacao_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('operacoes_producao')
      .select('id, status, status_processamento')
      .eq('id', contexto.operacao_id)
      .limit(1);

    const operacao = data?.[0] as any;
    if (!operacao) return { estado: 'resolvido', mensagem: 'Producao removida; alerta encerrado.' };
    if (!['inconsistente', 'Inconsistente', 'erro'].includes(operacao.status) && operacao.status_processamento !== 'inconsistente') {
      return { estado: 'resolvido', mensagem: 'Producao corrigida ou ciclo reprocessado.' };
    }
    return { estado: 'ativo' };
  },

  async avaliarCiclo(contexto: any): Promise<AvaliacaoAutoCura> {
    if (!contexto.ciclo_id) return { estado: 'ignorado' };

    const { data } = await supabase
      .from('ciclos_operacionais')
      .select('id, status_automacao, total_inconsistencias')
      .eq('id', contexto.ciclo_id)
      .limit(1);

    const ciclo = data?.[0] as any;
    if (!ciclo) return { estado: 'resolvido', mensagem: 'Ciclo removido; alerta encerrado.' };
    if (ciclo.status_automacao === 'pronto_para_fechamento' || Number(ciclo.total_inconsistencias || 0) === 0) {
      return { estado: 'resolvido', mensagem: 'Ciclo reprocessado e sem bloqueios criticos.' };
    }
    if (ciclo.status_automacao === 'aguardando_validacao') {
      return { estado: 'parcial', mensagem: 'Ciclo retornou para validacao, aguardando ultima checagem.', novaSeveridade: 'medium' };
    }
    return { estado: 'ativo' };
  },

  deveIgnorarPorAntiLoop(alerta: any) {
    const cooldownAte = alerta.cooldown_ate ? new Date(alerta.cooldown_ate).getTime() : 0;
    if (cooldownAte > Date.now()) return true;

    const ultimaAutoCura = alerta.ultima_auto_cura_em ? new Date(alerta.ultima_auto_cura_em).getTime() : 0;
    const tentativas = Number(alerta.auto_cura_tentativas || 0);
    const flapping = Number(alerta.flapping_count || 0);

    return flapping >= 3 && tentativas >= 3 && Date.now() - ultimaAutoCura < 24 * 60 * 60 * 1000;
  },

  async resolverAlertaAutomaticamente(alerta: any, avaliacao: AvaliacaoAutoCura) {
    const now = new Date();
    const update = {
      resolvido: true,
      resolvido_em: now.toISOString(),
      data_resolucao: now.toISOString(),
      resolvido_automaticamente: true,
      severidade_original: alerta.severidade_original || alerta.severidade,
      severidade_anterior: alerta.severidade,
      severidade: 'resolvido',
      mensagem: avaliacao.mensagem || alerta.mensagem,
      resolucao_contexto_json: avaliacao.detalhes || {},
      ultima_auto_cura_em: now.toISOString(),
      cooldown_ate: addMinutes(now, 30).toISOString(),
      auto_cura_tentativas: Number(alerta.auto_cura_tentativas || 0) + 1,
      atualizado_em: now.toISOString(),
    };

    await supabase.from('automacao_alertas').update(update).eq('id', alerta.id);
    await this.registrarAuditoriaAutomacao(
      alerta.tenant_id || null,
      'Alerta resolvido automaticamente',
      alerta.severidade === 'critical' ? 'medio' : 'baixo',
      { alerta_id: alerta.id, tipo: alerta.tipo, mensagem: avaliacao.mensagem },
    );
  },

  async reduzirSeveridadeAlerta(alerta: any, avaliacao: AvaliacaoAutoCura) {
    const now = new Date();
    const novaSeveridade = avaliacao.novaSeveridade || SEVERIDADE_REVERSA[alerta.severidade as AlertaSeveridade] || 'low';

    if (SEVERIDADE_PESO[novaSeveridade] >= SEVERIDADE_PESO[alerta.severidade as AlertaSeveridade]) {
      await this.marcarAutoCuraTentada(alerta, avaliacao);
      return;
    }

    await supabase.from('automacao_alertas').update({
      severidade_original: alerta.severidade_original || alerta.severidade,
      severidade_anterior: alerta.severidade,
      severidade: novaSeveridade,
      mensagem: avaliacao.mensagem || alerta.mensagem,
      reducoes_severidade: Number(alerta.reducoes_severidade || 0) + 1,
      auto_cura_tentativas: Number(alerta.auto_cura_tentativas || 0) + 1,
      ultima_auto_cura_em: now.toISOString(),
      cooldown_ate: addMinutes(now, 30).toISOString(),
      atualizado_em: now.toISOString(),
    }).eq('id', alerta.id);

    await this.registrarAuditoriaAutomacao(
      alerta.tenant_id || null,
      'Severidade reduzida automaticamente',
      'baixo',
      { alerta_id: alerta.id, tipo: alerta.tipo, de: alerta.severidade, para: novaSeveridade },
    );
  },

  async marcarAutoCuraTentada(alerta: any, avaliacao: AvaliacaoAutoCura) {
    await supabase.from('automacao_alertas').update({
      auto_cura_tentativas: Number(alerta.auto_cura_tentativas || 0) + 1,
      ultima_auto_cura_em: new Date().toISOString(),
      resolucao_contexto_json: avaliacao.detalhes || {},
      atualizado_em: new Date().toISOString(),
    }).eq('id', alerta.id);
  },

  async autoRevalidarCiclos(scopeId: string): Promise<number> {
    const escopo = await this.resolverEscopo(scopeId);
    if (!escopo.tenantId || escopo.empresaIds.length === 0) return 0;

    const { data: bloqueios } = await supabase
      .from('automacao_alertas')
      .select('id')
      .in('empresa_id', escopo.empresaIds)
      .eq('resolvido', false)
      .in('severidade', ['critical'])
      .limit(1);

    if (bloqueios && bloqueios.length > 0) return 0;

    const { data: ciclos } = await supabase
      .from('ciclos_operacionais')
      .select('id, status_automacao, tenant_id')
      .eq('tenant_id', escopo.tenantId)
      .in('status_automacao', ['aguardando_validacao', 'inconsistencias_detectadas', 'bloqueado_automacao']);

    let liberados = 0;
    for (const ciclo of (ciclos || []) as any[]) {
      await supabase.from('ciclos_operacionais').update({
        status_automacao: 'pronto_para_fechamento',
        status_automacao_atualizado_em: new Date().toISOString(),
        auto_cura_liberado_em: new Date().toISOString(),
      }).eq('id', ciclo.id);

      await this.registrarTimelineCiclo(ciclo.tenant_id, ciclo.id, 'Ciclo liberado apos auto-cura supervisionada');
      liberados++;
    }

    if (liberados > 0) {
      await this.registrarAuditoriaAutomacao(escopo.tenantId, 'Ciclo liberado automaticamente', 'medio', { liberados });
    }

    return liberados;
  },

  async limparFilaInteligente(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    const resultado = {
      jobsOrfaosEncerrados: 0,
      locksExpiradosRemovidos: 0,
      heartbeatsRecuperados: 0,
      retriesAbandonados: 0,
    };

    if (escopo.empresaIds.length === 0) return resultado;

    const now = new Date();
    const heartbeatExpirado = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const jobOrfao = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const retryAbandonado = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stalled } = await supabase
      .from('automacao_execucoes')
      .select('id, tentativas')
      .in('empresa_id', escopo.empresaIds)
      .eq('status', 'executando')
      .lt('heartbeat_at', heartbeatExpirado);

    for (const job of (stalled || []) as any[]) {
      await supabase.from('automacao_execucoes').update({
        status: Number(job.tentativas || 0) >= 3 ? 'falhou' : 'pendente',
        erro: Number(job.tentativas || 0) >= 3 ? 'Heartbeat expirado apos limite de retries.' : null,
        finalizado_em: Number(job.tentativas || 0) >= 3 ? now.toISOString() : null,
        locked_at: null,
        locked_by: null,
        heartbeat_at: null,
      }).eq('id', job.id);
      resultado.heartbeatsRecuperados++;
    }

    const { data: orfaos } = await supabase
      .from('automacao_execucoes')
      .select('id')
      .in('empresa_id', escopo.empresaIds)
      .eq('status', 'executando')
      .lt('locked_at', jobOrfao);

    for (const job of (orfaos || []) as any[]) {
      await supabase.from('automacao_execucoes').update({
        status: 'falhou',
        erro: 'Job orfao encerrado automaticamente pela auto-cura.',
        finalizado_em: now.toISOString(),
        locked_at: null,
        locked_by: null,
        heartbeat_at: null,
      }).eq('id', job.id);
      resultado.jobsOrfaosEncerrados++;
    }

    const { data: locksPendentes } = await supabase
      .from('automacao_execucoes')
      .select('id')
      .in('empresa_id', escopo.empresaIds)
      .eq('status', 'pendente')
      .not('locked_at', 'is', null);

    for (const job of (locksPendentes || []) as any[]) {
      await supabase.from('automacao_execucoes').update({
        locked_at: null,
        locked_by: null,
        heartbeat_at: null,
      }).eq('id', job.id);
      resultado.locksExpiradosRemovidos++;
    }

    const { data: abandonados } = await supabase
      .from('automacao_execucoes')
      .select('id')
      .in('empresa_id', escopo.empresaIds)
      .eq('status', 'pendente')
      .gte('tentativas', 3)
      .lt('created_at', retryAbandonado);

    for (const job of (abandonados || []) as any[]) {
      await supabase.from('automacao_execucoes').update({
        status: 'cancelado',
        erro: 'Retry abandonado limpo automaticamente.',
        finalizado_em: now.toISOString(),
        locked_at: null,
        locked_by: null,
        heartbeat_at: null,
      }).eq('id', job.id);
      resultado.retriesAbandonados++;
    }

    if (Object.values(resultado).some((value) => value > 0)) {
      await this.registrarAuditoriaAutomacao(escopo.tenantId, 'Fila inteligente limpa', 'baixo', resultado);
    }

    return resultado;
  },

  // ==========================================
  // HELPERS E GOVERNANCA
  // ==========================================

  async registrarAlerta(alerta: AutomacaoAlerta): Promise<string> {
    const escopo = await this.resolverEscopo(alerta.empresa_id);
    const contexto = alerta.contexto_json || {};

    let query = supabase
      .from('automacao_alertas')
      .select('id, severidade')
      .eq('empresa_id', alerta.empresa_id)
      .eq('tipo', alerta.tipo)
      .eq('resolvido', false);

    if (Object.keys(contexto).length > 0) {
      query = query.contains('contexto_json', contexto);
    }

    const { data: existentes } = await query.limit(1);
    const existente = existentes?.[0] as any;

    if (existente) {
      if (SEVERIDADE_PESO[alerta.severidade] > SEVERIDADE_PESO[existente.severidade as AlertaSeveridade]) {
        await supabase.from('automacao_alertas').update({
          severidade: alerta.severidade,
          severidade_anterior: existente.severidade,
          mensagem: alerta.mensagem,
          atualizado_em: new Date().toISOString(),
        }).eq('id', existente.id);
      }
      return existente.id;
    }

    const { data, error } = await supabase.from('automacao_alertas').insert({
      empresa_id: alerta.empresa_id,
      tenant_id: alerta.tenant_id || escopo.tenantId,
      tipo: alerta.tipo,
      severidade: alerta.severidade,
      severidade_original: alerta.severidade,
      mensagem: alerta.mensagem,
      contexto_json: contexto,
      resolvido: false,
    }).select('id').single();

    if (error) throw error;
    return data.id;
  },

  async listarAlertas(scopeId: string, options?: { incluirResolvidos?: boolean; limit?: number }) {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return [];

    let query = supabase
      .from('automacao_alertas')
      .select('*')
      .in('empresa_id', escopo.empresaIds)
      .order('criado_em', { ascending: false })
      .limit(options?.limit || 50);

    if (!options?.incluirResolvidos) {
      query = query.eq('resolvido', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async listarExecucoes(scopeId: string) {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) return [];

    const { data, error } = await supabase
      .from('automacao_execucoes')
      .select('*')
      .in('empresa_id', escopo.empresaIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  },

  async getSaudeOperacional(scopeId: string): Promise<SaudeOperacional> {
    const escopo = await this.resolverEscopo(scopeId);
    if (escopo.empresaIds.length === 0) {
      return { alertasAtivos: 0, alertasAutoCurados: 0, bloqueiosRemovidos: 0, severidadeMedia: 0, tempoMedioResolucaoMinutos: 0 };
    }

    const { data: alertas } = await supabase
      .from('automacao_alertas')
      .select('resolvido, resolvido_automaticamente, severidade, severidade_original, criado_em, resolvido_em, data_resolucao')
      .in('empresa_id', escopo.empresaIds)
      .order('criado_em', { ascending: false })
      .limit(1000);

    const rows = (alertas || []) as any[];
    const ativos = rows.filter((alerta) => !alerta.resolvido);
    const autoCurados = rows.filter((alerta) => alerta.resolvido_automaticamente);
    const bloqueiosRemovidos = autoCurados.filter((alerta) => ['critical', 'high'].includes(alerta.severidade_original)).length;
    const severidadeMedia = ativos.length
      ? ativos.reduce((acc, alerta) => acc + (SEVERIDADE_PESO[alerta.severidade as AlertaSeveridade] || 0), 0) / ativos.length
      : 0;

    const resolucoes = autoCurados
      .map((alerta) => {
        const fim = alerta.data_resolucao || alerta.resolvido_em;
        if (!alerta.criado_em || !fim) return null;
        return (new Date(fim).getTime() - new Date(alerta.criado_em).getTime()) / 60000;
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

    return {
      alertasAtivos: ativos.length,
      alertasAutoCurados: autoCurados.length,
      bloqueiosRemovidos,
      severidadeMedia: Number(severidadeMedia.toFixed(1)),
      tempoMedioResolucaoMinutos: resolucoes.length
        ? Math.round(resolucoes.reduce((acc, value) => acc + value, 0) / resolucoes.length)
        : 0,
    };
  },

  async registrarAuditoriaAutomacao(
    tenantId: string | null,
    acao: string,
    impacto: 'baixo' | 'medio' | 'critico',
    detalhes: Record<string, unknown>,
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('auditoria').insert({
        tenant_id: tenantId,
        user_id: user?.id || null,
        acao,
        modulo: 'AUTOMACAO',
        impacto,
        detalhes,
      });
    } catch (error) {
      console.warn('[OperationalAutomationEngine] Auditoria nao registrada:', error);
    }
  },

  async registrarTimelineCiclo(tenantId: string, cicloId: string, observacao: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('auditoria_workflow_ciclos').insert({
        tenant_id: tenantId,
        ciclo_id: cicloId,
        usuario_id: user?.id || null,
        etapa: 'AUTOMACAO',
        acao: 'LIBERAR',
        observacao,
      });
    } catch (error) {
      console.warn('[OperationalAutomationEngine] Timeline do ciclo nao registrada:', error);
    }
  },
};
