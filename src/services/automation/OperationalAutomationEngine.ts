import { supabase } from '@/lib/supabase';

export type AutomacaoStatus = 'pendente' | 'executando' | 'concluido' | 'falhou' | 'cancelado';
export type AutomacaoTipo = 'PROCESSAMENTO_RH' | 'SUGESTAO_FECHAMENTO' | 'VALIDACAO_FINANCEIRA';

export interface AutomacaoExecucao {
  id?: string;
  empresa_id: string;
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

export type AlertaTipo = 'colaborador_sem_regra' | 'excesso_horas' | 'conta_bancaria_invalida' | 
                         'fechamento_atrasado' | 'remessa_rejeitada' | 'ponto_incompleto' | 'ciclo_sem_aprovacao' |
                         'falta_nao_justificada' | 'cpf_invalido' | 'ciclo_invalidado_automaticamente';
export type AlertaSeveridade = 'low' | 'medium' | 'high' | 'critical';

export interface AutomacaoAlerta {
  id?: string;
  empresa_id: string;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  mensagem: string;
  contexto_json?: any;
  resolvido?: boolean;
}

export const OperationalAutomationEngine = {
  
  // ==========================================
  // FILA E AGENDAMENTO
  // ==========================================

  async agendarExecucao(execucao: Partial<AutomacaoExecucao>): Promise<string> {
    const { data, error } = await supabase.from('automacao_execucoes').insert({
      empresa_id: execucao.empresa_id,
      tipo: execucao.tipo,
      status: 'pendente',
      contexto_json: execucao.contexto_json || {},
      prioridade: execucao.prioridade || 0
    }).select('id').single();

    if (error) throw error;
    return data.id;
  },

  async agendarLoteAssincrono(empresaId: string): Promise<void> {
     // Enfileira os jobs base
     await this.agendarExecucao({ empresa_id: empresaId, tipo: 'PROCESSAMENTO_RH', prioridade: 10 });
     await this.agendarExecucao({ empresa_id: empresaId, tipo: 'SUGESTAO_FECHAMENTO', prioridade: 5 });
     await this.agendarExecucao({ empresa_id: empresaId, tipo: 'VALIDACAO_FINANCEIRA', prioridade: 1 });
     
     // O frontend não processará a fila, apenas agendará.
     // Um worker em background (AutomationWorker) deverá ser invocado ou estar rodando para puxar isso.
  },

  async processarFila(empresaId: string): Promise<void> {
    // Busca automacoes pendentes
    const { data: pendentes, error } = await supabase
      .from('automacao_execucoes')
      .select('*')
      .eq('empresa_id', empresaId)
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
      // Setup executing
      await supabase.from('automacao_execucoes').update({
        status: 'executando',
        iniciado_em: new Date().toISOString()
      }).eq('id', job.id);

      let resultado = {};

      switch (job.tipo) {
        case 'PROCESSAMENTO_RH':
          resultado = await this.automatizarProcessamentoRH(job.empresa_id);
          break;
        case 'SUGESTAO_FECHAMENTO':
          resultado = await this.sugerirFechamento(job.empresa_id);
          break;
        case 'VALIDACAO_FINANCEIRA':
          resultado = await this.validarFinanceiro(job.empresa_id);
          break;
        default:
          throw new Error('Tipo automação não suportado');
      }

      // Finish Executing
      await supabase.from('automacao_execucoes').update({
        status: 'concluido',
        finalizado_em: new Date().toISOString(),
        resultado_json: resultado
      }).eq('id', job.id);

    } catch (err: any) {
      await supabase.from('automacao_execucoes').update({
        status: 'falhou',
        finalizado_em: new Date().toISOString(),
        erro: err.message || JSON.stringify(err)
      }).eq('id', job.id);
    }
  },

  // ==========================================
  // CONECTORES DE NEGÓCIO DA AUTOMAÇÃO
  // ==========================================

  async automatizarProcessamentoRH(empresaId: string) {
    // Fake RH processing rules
    const alertasGerados: string[] = [];

    // Checa colaboradores sem regra (mock)
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome, regras_operacionais_id').eq('empresa_id', empresaId);
    let colabsSemRegra = 0;
    
    if (colabs) {
      for (const colab of colabs) {
        if (!colab.regras_operacionais_id) {
          colabsSemRegra++;
          await this.registrarAlerta({
            empresa_id: empresaId,
            tipo: 'colaborador_sem_regra',
            severidade: 'high',
            mensagem: `Colaborador ${colab.nome} não possui regra operacional vinculada!`,
            contexto_json: { colaborador_id: colab.id }
          });
        }
      }
    }

    // Buscar pontos pendentes/incompletos ou faltas
    const { data: faltas } = await supabase.from('registros_ponto').select('id, colaborador_id').eq('empresa_id', empresaId).eq('status', 'falta_injustificada');
    let faltasCount = 0;
    if (faltas && faltas.length > 0) {
      for (const f of faltas) {
        faltasCount++;
        await this.registrarAlerta({
          empresa_id: empresaId,
          tipo: 'falta_nao_justificada',
          severidade: 'medium',
          mensagem: `Falta não justificada detectada para o registro.`,
          contexto_json: { ponto_id: f.id, colaborador_id: f.colaborador_id }
        });
      }
    }

    // Escalonar alertas pendentes
    await this.escalonarAlertas(empresaId);

    return { verificados: colabs?.length || 0, colabsSemRegra, faltasCount };
  },

  async escalonarAlertas(empresaId: string) {
    // Escalonamento: se um alerta 'low' ou 'medium' ou 'high' estiver criado há mais de 24h, sobe um nível.
    // Para simplificar, vamos escalar qualquer alerta não resolvido antigo.
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: antigos } = await supabase
      .from('automacao_alertas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('resolvido', false)
      .lt('criado_em', ontem)
      .neq('severidade', 'critical');

    if (antigos) {
      for (const alerta of antigos) {
        let novaSeveridade: AlertaSeveridade = 'medium';
        if (alerta.severidade === 'low') novaSeveridade = 'medium';
        else if (alerta.severidade === 'medium') novaSeveridade = 'high';
        else if (alerta.severidade === 'high') novaSeveridade = 'critical';

        await supabase.from('automacao_alertas').update({
          severidade: novaSeveridade,
          mensagem: `[ESCALADO] ${alerta.mensagem}`
        }).eq('id', alerta.id);
      }
    }
  },

  async sugerirFechamento(empresaId: string) {
    // Busca ciclos abertos
    const { data: ciclos, error } = await supabase
      .from('ciclos_operacionais')
      .select('*')
      .eq('empresa_id', empresaId)
      .in('status', ['aberto', 'em_processamento']);

    if (!ciclos || ciclos.length === 0) return { ciclosSugeridos: 0 };

    let count = 0;
    for (const c of ciclos) {
      // Verifica inconsistencias criticas
      const { data: alertas } = await supabase
        .from('automacao_alertas')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('resolvido', false)
        .eq('severidade', 'critical')
        .limit(1);
      
      if (!alertas || alertas.length === 0) {
        // Marca como pronto_para_fechamento e status_automacao soberano
        await supabase.from('ciclos_operacionais').update({
          status: 'pronto_para_fechamento',
          status_automacao: 'pronto_para_fechamento'
        }).eq('id', c.id);
        count++;
      } else {
        // Bloqueia fechamento se houver erros criticos
        await supabase.from('ciclos_operacionais').update({
          status_automacao: 'bloqueado_automacao'
        }).eq('id', c.id);
      }
    }

    return { ciclosQuePodemFechar: count };
  },

  async validarFinanceiro(empresaId: string) {
    // Verifica contas inválidas
    let alertas = 0;
    const { data: contas } = await supabase.from('contas_bancarias_empresa').select('*').eq('empresa_id', empresaId);
    if(contas) {
      for (const conta of contas) {
        if (!conta.conta || conta.conta.length < 4) {
          alertas++;
          await this.registrarAlerta({
            empresa_id: empresaId,
            tipo: 'conta_bancaria_invalida',
            severidade: 'critical',
            mensagem: `Conta bancária da empresa ${conta.banco} parece inválida pré-remessa.`,
            contexto_json: { conta_id: conta.id }
          });
        }
      }
    }
    return { contasVistoriadas: contas?.length || 0, alertas_gerados: alertas };
  },

  // ==========================================
  // HELPERS e GOVERNANCE
  // ==========================================
  
  async registrarAlerta(alerta: AutomacaoAlerta): Promise<string> {
    // Evitar duplicidade de alerta ativo
    const { data: existente } = await supabase
      .from('automacao_alertas')
      .select('id')
      .eq('empresa_id', alerta.empresa_id)
      .eq('tipo', alerta.tipo)
      .eq('resolvido', false)
      .contains('contexto_json', alerta.contexto_json)
      .limit(1)
      .single();

    if (existente) return existente.id;

    const { data, error } = await supabase.from('automacao_alertas').insert({
      empresa_id: alerta.empresa_id,
      tipo: alerta.tipo,
      severidade: alerta.severidade,
      mensagem: alerta.mensagem,
      contexto_json: alerta.contexto_json || {}
    }).select('id').single();

    if (error) throw error;
    return data.id;
  },

  async listarAlertas(empresaId: string) {
    const { data, error } = await supabase
      .from('automacao_alertas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('resolvido', false)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data;
  },
  
  async listarExecucoes(empresaId: string) {
    const { data, error } = await supabase
      .from('automacao_execucoes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  }
};
