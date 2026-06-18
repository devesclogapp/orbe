import { supabase } from '@/lib/supabase';
import { BaseService, getCurrentTenantId } from './base.service';

export type StatusLoteIntermitente =
  | 'AGUARDANDO_VALIDACAO_RH'
  | 'VALIDADO_RH'
  | 'DEVOLVIDO'
  | 'CANCELADO'
  | 'FECHADO_FINANCEIRO'
  | 'CNAB_GERADO'
  | 'PAGO';

export interface IntermitenteLoteFechamento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_registros: number;
  valor_total: number;
  status: StatusLoteIntermitente;
  observacoes?: string | null;
  created_by?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { nome: string } | null;
}

class IntermitentesLoteServiceClass extends BaseService<'intermitentes_lotes_fechamento'> {
  constructor() {
    super('intermitentes_lotes_fechamento');
  }

  async fecharPeriodo(params: {
    empresaId: string | null;
    periodoInicio: string;
    periodoFim: string;
    fechadoPor: string;
    observacoes?: string;
  }) {
    const tenantId = await getCurrentTenantId();

    // Buscar lançamentos abertos
    let query = supabase
      .from('lancamentos_intermitentes')
      .select('id, total')
      .eq('status_pipeline', 'RECEBIDO')
      .is('lote_fechamento_id', null)
      .gte('data_referencia', params.periodoInicio)
      .lte('data_referencia', params.periodoFim);

    if (params.empresaId) {
       query = query.eq('empresa_id', params.empresaId);
    }

    const { data: lancamentos, error: queryError } = await query;
    if (queryError) throw queryError;

    if (!lancamentos || lancamentos.length === 0) {
      throw new Error('Nenhum lançamento pendente encontrado para o período/filtro informado.');
    }

    const quantidade_registros = lancamentos.length;
    const valor_total = lancamentos.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const competencia = params.periodoInicio.substring(0, 7); // yyyy-MM

    // Criar o Lote
    const { data: lote, error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .insert({
        tenant_id: tenantId,
        empresa_id: params.empresaId ?? null,
        competencia,
        periodo_inicio: params.periodoInicio,
        periodo_fim: params.periodoFim,
        quantidade_registros,
        valor_total,
        status: 'AGUARDANDO_VALIDACAO_RH',
        observacoes: params.observacoes,
        created_by: params.fechadoPor,
      })
      .select()
      .single();

    if (loteError) throw loteError;

    const lancamentoIds = lancamentos.map(l => l.id);

    // TODO: Num cenário de altíssima volumetria seria ideal uma RPC transaction (como nos diaristas). 
    // Como estamos na Fase 1, o update massivo usando IN serve perfeitamente.
    const { error: updateError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({
        lote_fechamento_id: lote.id,
        status_pipeline: 'EM_ANALISE_RH'
      })
      .in('id', lancamentoIds);

    if (updateError) throw updateError;

    return lote as IntermitenteLoteFechamento;
  }

  async listarLotes(filtros?: { status?: string, competencia?: string }) {
    let query = this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .order('created_at', { ascending: false });

    if (filtros?.status) query = query.eq('status', filtros.status);
    if (filtros?.competencia) query = query.eq('competencia', filtros.competencia);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getLoteDetalhe(loteId: string) {
    const { data: lote, error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('id', loteId)
      .single();

    if (loteError) throw loteError;

    const { data: itens, error: itensError } = await this.supabase
      .from('lancamentos_intermitentes')
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .order('nome_colaborador', { ascending: true });

    if (itensError) throw itensError;

    return { ...lote, itens: itens ?? [] };
  }

  async getByEmpresaParaFinanceiro(empresaId: string) {
    const { data, error } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('empresa_id', empresaId)
      .in('status', ['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'cnab_gerado'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async aprovarFinanceiro(loteId: string, validadoPor: string) {
    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({
        status: 'FECHADO_FINANCEIRO',
        validated_by: validadoPor,
        validated_at: new Date().toISOString()
      })
      .eq('id', loteId);

    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'ENVIADO_FINANCEIRO' }) // Equivalente local, a instrução disse ENVIADO_FINANCEIRO ou equivalente
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async validarLote(loteId: string, validadoPor: string) {
    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({
        status: 'VALIDADO_RH',
        validated_by: validadoPor,
        validated_at: new Date().toISOString()
      })
      .eq('id', loteId);

    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'APROVADO_RH' }) // Ou APROVADO_RH dependendo do enum
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async devolverLote(loteId: string, observacao: string) {
    if (!observacao) throw new Error('A observação é obrigatória para devolver um lote.');

    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({ status: 'DEVOLVIDO', observacoes: observacao })
      .eq('id', loteId);
    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'DEVOLVIDO' })
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async reabrirLote(loteId: string) {
    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'RECEBIDO', lote_fechamento_id: null })
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;

    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({ status: 'CANCELADO' })
      .eq('id', loteId);

    if (loteError) throw loteError;
    return true;
  }
}

export const IntermitentesLoteService = new IntermitentesLoteServiceClass();
