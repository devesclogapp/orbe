import { supabase } from '@/lib/supabase';
import { OcorrenciaDecisaoRecord } from './ocorrenciasDecisao.service';

export type TipoVinculoColaborador = 'CLT' | 'INTERMITENTE' | 'DIARISTA';

export type StatusEventoFinanceiro =
  | 'PENDENTE_APLICACAO'
  | 'APLICADO'
  | 'CANCELADO'
  | 'ESTORNADO';

export interface EventoFinanceiroOcorrencia {
  id: string;
  tenant_id: string;
  empresa_id: string;
  decisao_id: string;
  collaborator_id: string;
  tipo_vinculo: TipoVinculoColaborador;
  competencia: string;
  valor_desconto: number;
  status: StatusEventoFinanceiro;
  lote_pagamento_id?: string | null;
  aplicado_em?: string | null;
  aplicado_por?: string | null;
  detalhes_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GerarEventoDescontoParams {
  decisao: OcorrenciaDecisaoRecord;
  tipo_vinculo: TipoVinculoColaborador;
  competencia: string; // YYYY-MM
  saldoRemuneracaoDisponivel: number;
  usuario_id: string;
}

export class DescontosOcorrenciasIntegracaoService {
  /**
   * Gera um evento financeiro de desconto a partir de uma deliberação formalmente AUTORIZADA pelo RH.
   * Regras:
   * 1. Apenas decisões AUTORIZADAS com fundamentação do Art. 462 da CLT.
   * 2. Idempotência estrita: não gera evento duplicado.
   * 3. Proíbe criar líquido negativo.
   * 4. Não utiliza códigos ou rubricas contábeis inventadas.
   */
  static async gerarEventoFinanceiro(
    params: GerarEventoDescontoParams
  ): Promise<EventoFinanceiroOcorrencia> {
    const {
      decisao,
      tipo_vinculo,
      competencia,
      saldoRemuneracaoDisponivel,
      usuario_id,
    } = params;

    // 1. Validação estrita de autorização prévia e fundamentação
    if (!decisao || decisao.status !== 'AUTORIZADO') {
      throw new Error(
        'Operação rejeitada: Apenas deliberações com status AUTORIZADO podem gerar eventos financeiros de desconto.'
      );
    }

    if (decisao.tipo_decisao !== 'PROPOSTA_RESSARCIMENTO' || Number(decisao.valor_autorizado || 0) <= 0) {
      throw new Error(
        'Operação rejeitada: A deliberação não possui valor de ressarcimento pecuniário autorizado.'
      );
    }

    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      throw new Error('Competência financeira inválida. Formato exigido: AAAA-MM.');
    }

    // 2. Proteção contra Líquido Negativo (Art. 462 CLT e limites de retenção)
    const valorDesconto = Number(decisao.valor_autorizado);
    if (valorDesconto > saldoRemuneracaoDisponivel) {
      throw new Error(
        `Valor do desconto (R$ ${valorDesconto.toFixed(2)}) excede a remuneração disponível do colaborador (R$ ${saldoRemuneracaoDisponivel.toFixed(2)}). É vedada a criação de saldo líquido negativo ou transferência automática sem base jurídica.`
      );
    }

    // 3. Idempotência: Checa se já existe evento financeiro gerado para esta decisão
    const { data: eventoExistente, error: errExistente } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .select('id, status')
      .eq('decisao_id', decisao.id)
      .in('status', ['PENDENTE_APLICACAO', 'APLICADO'])
      .maybeSingle();

    if (eventoExistente && !errExistente) {
      throw new Error(
        `Idempotência violada: Já existe um evento financeiro ativo (${eventoExistente.status}) vinculado a esta deliberação.`
      );
    }

    // 4. Criação do evento financeiro vinculado
    const payload = {
      tenant_id: decisao.tenant_id,
      empresa_id: decisao.empresa_id,
      decisao_id: decisao.id,
      collaborator_id: decisao.collaborator_id,
      tipo_vinculo,
      competencia,
      valor_desconto: valorDesconto,
      status: 'PENDENTE_APLICACAO' as StatusEventoFinanceiro,
      aplicado_por: usuario_id,
      detalhes_json: {
        infracao_codigo: decisao.infracao_codigo,
        fundamento_legal: decisao.fundamento_legal,
        decidido_por: decisao.decidido_por_nome,
        valor_provisorio_original: decisao.valor_provisorio_snapshot,
        descricao_operacional: this.resolverDescricaoOperacional(tipo_vinculo),
      },
    };

    const { data, error } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .insert(payload)
      .select()
      .single();

    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('relation') || msg.includes('does not exist')) {
        throw new Error(
          'Tabela operacoes_ocorrencias_eventos_financeiros não encontrada. Aplique a migration consolidada.'
        );
      }
      throw error;
    }

    return data as EventoFinanceiroOcorrencia;
  }

  /**
   * Busca eventos autorizados e pendentes de aplicação para um tipo de vínculo e competência.
   */
  static async buscarEventosAptosParaLote(
    tenantId: string,
    empresaId: string,
    competencia: string,
    tipoVinculo: TipoVinculoColaborador
  ): Promise<EventoFinanceiroOcorrencia[]> {
    try {
      const { data, error } = await supabase
        .from('operacoes_ocorrencias_eventos_financeiros')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('empresa_id', empresaId)
        .eq('competencia', competencia)
        .eq('tipo_vinculo', tipoVinculo)
        .eq('status', 'PENDENTE_APLICACAO');

      if (error) {
        return [];
      }

      return (data || []) as EventoFinanceiroOcorrencia[];
    } catch {
      return [];
    }
  }

  /**
   * Integração com motor de DIARISTAS:
   * Insere um lançamento de ajuste na grade de diaristas (`lancamentos_diaristas`) com valor negativo
   * e marca o evento de desconto como APLICADO.
   */
  static async aplicarDescontoDiarista(params: {
    eventoId: string;
    empresaId: string;
    diaristaId: string;
    referenciaLancamentoId: string;
    loteId: string;
    valorDesconto: number;
    usuarioId: string;
    usuarioNome: string;
    motivo?: string;
  }): Promise<{ ajusteId: string; eventoAtualizado: EventoFinanceiroOcorrencia }> {
    const {
      eventoId,
      empresaId,
      diaristaId,
      referenciaLancamentoId,
      loteId,
      valorDesconto,
      usuarioId,
      usuarioNome,
      motivo,
    } = params;

    // 1. Valida se o evento existe e está apto
    const { data: evento, error: errEvento } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .select('*')
      .eq('id', eventoId)
      .eq('status', 'PENDENTE_APLICACAO')
      .single();

    if (errEvento || !evento) {
      throw new Error('Evento financeiro de desconto não encontrado ou já aplicado.');
    }

    // 2. Busca lançamento original para herdar dados cadastrais
    const { data: original, error: errOrig } = await supabase
      .from('lancamentos_diaristas')
      .select('*')
      .eq('id', referenciaLancamentoId)
      .single();

    if (errOrig || !original) {
      throw new Error('Lançamento original de diarista não encontrado.');
    }

    // 3. Insere o registro de ajuste negativo em lancamentos_diaristas
    const payloadAjuste = {
      tenant_id: original.tenant_id,
      empresa_id: empresaId,
      diarista_id: diaristaId,
      nome_colaborador: original.nome_colaborador,
      funcao_colaborador: original.funcao_colaborador,
      data_lancamento: original.data_lancamento,
      codigo_marcacao: original.codigo_marcacao,
      quantidade_diaria: 0,
      valor_calculado: -Math.abs(Number(valorDesconto)),
      tipo_registro: 'ajuste',
      status: 'EM_ABERTO',
      referencia_lancamento_id: referenciaLancamentoId,
      lote_fechamento_id: loteId,
      motivo_ajuste: motivo || `Desconto por ocorrência autorizada: ${evento.detalhes_json?.infracao_codigo || 'Avaria'} (Art. 462 CLT)`,
      adjusted_by: usuarioId,
      adjusted_by_nome: usuarioNome,
      adjusted_at: new Date().toISOString(),
    };

    const { data: ajusteInserido, error: errAjuste } = await supabase
      .from('lancamentos_diaristas')
      .insert([payloadAjuste])
      .select('id')
      .single();

    if (errAjuste) throw errAjuste;

    // 4. Atualiza o status do evento financeiro para APLICADO
    const { data: eventoAtualizado, error: errUpd } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .update({
        status: 'APLICADO',
        lote_pagamento_id: loteId,
        aplicado_em: new Date().toISOString(),
        aplicado_por: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventoId)
      .select()
      .single();

    if (errUpd) throw errUpd;

    return { ajusteId: ajusteInserido.id, eventoAtualizado: eventoAtualizado as EventoFinanceiroOcorrencia };
  }

  /**
   * Integração com motor de INTERMITENTES:
   * Insere ajuste negativo em `lancamentos_intermitentes` e marca o evento como APLICADO.
   */
  static async aplicarDescontoIntermitente(params: {
    eventoId: string;
    empresaId: string;
    colaboradorId: string;
    loteId: string;
    valorDesconto: number;
    usuarioId: string;
    motivo?: string;
  }): Promise<EventoFinanceiroOcorrencia> {
    const { eventoId, empresaId, colaboradorId, loteId, valorDesconto, usuarioId, motivo } = params;

    const { data: evento, error: errEvento } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .select('*')
      .eq('id', eventoId)
      .eq('status', 'PENDENTE_APLICACAO')
      .single();

    if (errEvento || !evento) {
      throw new Error('Evento de desconto intermitente não encontrado ou já aplicado.');
    }

    // Insere no histórico de lançamentos do intermitente
    const payloadIntermitente = {
      tenant_id: evento.tenant_id,
      empresa_id: empresaId,
      colaborador_id: colaboradorId,
      total: -Math.abs(Number(valorDesconto)),
      lote_fechamento_id: loteId,
      status_pipeline: 'PROCESSADO',
      data_referencia: new Date().toISOString().slice(0, 10),
      observacao: motivo || `Desconto por ocorrência autorizada: ${evento.detalhes_json?.infracao_codigo || 'Avaria'} (Art. 462 CLT)`,
    };

    const { error: errInsert } = await supabase
      .from('lancamentos_intermitentes')
      .insert([payloadIntermitente]);

    if (errInsert) {
      console.warn('[DescontosOcorrenciasIntegracaoService] Falha ao registrar em lancamentos_intermitentes:', errInsert);
    }

    // Atualiza status do evento financeiro
    const { data: eventoAtualizado, error: errUpd } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .update({
        status: 'APLICADO',
        lote_pagamento_id: loteId,
        aplicado_em: new Date().toISOString(),
        aplicado_por: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventoId)
      .select()
      .single();

    if (errUpd) throw errUpd;
    return eventoAtualizado as EventoFinanceiroOcorrencia;
  }

  /**
   * Integração com motor de CLT:
   * Vincula evento de desconto aos lotes de pagamento de folha (`rh_financeiro_lote_itens`)
   * e proíbe terminantemente alteração de lotes fechados, pagos ou com remessa bancária gerada.
   */
  static async vincularAoLotePagamento(
    eventoId: string,
    loteId: string,
    statusLote: string,
    usuarioId: string
  ): Promise<EventoFinanceiroOcorrencia> {
    const s = (statusLote || '').toLowerCase();
    const lotesBloqueados = ['pago', 'remessa_gerada', 'concluido', 'fechado', 'liquidado'];

    if (lotesBloqueados.includes(s)) {
      throw new Error(
        `Violação de segurança bancária: Não é permitido vincular descontos a um lote no status '${statusLote}'. Lotes com remessa ou concluídos são imutáveis.`
      );
    }

    const { data, error } = await supabase
      .from('operacoes_ocorrencias_eventos_financeiros')
      .update({
        lote_pagamento_id: loteId,
        status: 'APLICADO',
        aplicado_em: new Date().toISOString(),
        aplicado_por: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventoId)
      .eq('status', 'PENDENTE_APLICACAO')
      .select()
      .single();

    if (error) throw error;
    return data as EventoFinanceiroOcorrencia;
  }

  /**
   * Busca eventos financeiros de ocorrências para um colaborador em determinada competência.
   */
  static async listarPorColaboradorECompetencia(
    collaboratorId: string,
    competencia: string
  ): Promise<EventoFinanceiroOcorrencia[]> {
    try {
      const { data, error } = await supabase
        .from('operacoes_ocorrencias_eventos_financeiros')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .eq('competencia', competencia)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []) as EventoFinanceiroOcorrencia[];
    } catch {
      return [];
    }
  }

  private static resolverDescricaoOperacional(tipo: TipoVinculoColaborador): string {
    switch (tipo) {
      case 'CLT':
        return 'Desconto Autorizado por Ressarcimento de Avaria / Dano Material (Art. 462 CLT)';
      case 'INTERMITENTE':
        return 'Desconto Autorizado por Ressarcimento Operacional (Intermitente)';
      case 'DIARISTA':
        return 'Ajuste de Ressarcimento Operacional (Diarista)';
      default:
        return 'Desconto de Ressarcimento Operacional';
    }
  }
}
