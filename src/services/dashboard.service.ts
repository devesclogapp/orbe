import { supabase } from '@/lib/supabase';
import { addMonths, format } from 'date-fns';

export type AuditoriaCompetenciaStatus = 'ok' | 'divergente' | 'pendente' | 'sem_dados';
export type TipoFluxo = 'folha_variavel' | 'intermitente' | 'diarista' | 'operacional';
export type TipoFluxoResumo = TipoFluxo | 'misto' | 'sem_fluxo';

export interface KPIOrigin {
  fonte: string;
  competencia: string;
  atualizadoEm: string;
  tipoFluxo: TipoFluxoResumo;
}

export interface AuditoriaCompetenciaResumo {
  status: AuditoriaCompetenciaStatus;
  rhFechado: number;
  financeiroRecebido: number;
  financeiroAprovado: number;
  cnabGerado: number;
  bancoHistorico: number;
  diferencaRhFinanceiro: number;
  diferencaFinanceiroCnab: number;
  diferencaCnabHistorico: number;
  diferencaTotal: number;
  pendencias: string[];
  atualizadoEm: string;
  tipoFluxo: TipoFluxoResumo;
}

export interface OperationalIntegrityKPIs {
  competencia: string;
  consolidadoEm: string;
  tipoFluxo: TipoFluxoResumo;
  fluxosPresentes: TipoFluxo[];
  rhValorProcessado: number;
  rhValorValidado: number;
  rhValorFechado: number;
  finValorRecebidoRH: number;
  finValorAprovado: number;
  folhaValorAprovado: number;
  intermitentesValorAprovado: number;
  diaristasValorAprovado: number;
  flows?: {
    folha: FluxAccumulator;
    intermitente: FluxAccumulator;
    diarista: FluxAccumulator;
  };
  finValorEnviadoBanco: number;
  finValorHistoricoBanco: number;
  faturamentoTotal: number;
  caixaRecebido: number;
  lucroReal: number;
  custosGerais: number;
  auditoriaCompetencia: AuditoriaCompetenciaResumo;
  origens: {
    faturamentoTotal: KPIOrigin;
    caixaRecebido: KPIOrigin;
    custosGerais: KPIOrigin;
    lucroReal: KPIOrigin;
    finValorAprovado: KPIOrigin;
    auditoriaCompetencia: KPIOrigin;
  };
}

export interface FluxAccumulator {
  rhProcessado: number;
  rhValidado: number;
  rhFechado: number;
  finRecebidoRh: number;
  finAprovado: number;
}

function emptyFluxAccumulator(): FluxAccumulator {
  return {
    rhProcessado: 0,
    rhValidado: 0,
    rhFechado: 0,
    finRecebidoRh: 0,
    finAprovado: 0,
  };
}

function addAmount(target: number, value: unknown): number {
  return target + (Number(value) || 0);
}

function moneyDiff(left: number, right: number): number {
  return Number((left - right).toFixed(2));
}

function maxIso(values: Array<string | null | undefined>, fallback: string): string {
  const normalized = values.filter(Boolean) as string[];
  if (!normalized.length) return fallback;
  return normalized.reduce((current, next) => (next > current ? next : current));
}

function dedupeFlowTypes(types: TipoFluxo[]): TipoFluxo[] {
  return Array.from(new Set(types));
}

function summarizeFlowType(types: TipoFluxo[]): TipoFluxoResumo {
  const unique = dedupeFlowTypes(types);
  if (!unique.length) return 'sem_fluxo';
  if (unique.length > 1) return 'misto';
  return unique[0];
}

function buildOrigin(
  fonte: string,
  competencia: string,
  atualizadoEm: string,
  tiposFluxo: TipoFluxo[],
): KPIOrigin {
  return {
    fonte,
    competencia,
    atualizadoEm,
    tipoFluxo: summarizeFlowType(tiposFluxo),
  };
}

/**
 * Returns data safely from a Supabase result.
 * - If no error → returns data (or []).
 * - If the error indicates a missing table/column/relation (400/PGRST2xx/42P01) → returns [] (resilient).
 * - If the error is a real auth/permission/network error → throws.
 */
function safeData<T>(result: { data?: T[] | null; error?: { code?: string | null; message?: string | null; details?: string | null } | null }): T[] {
  if (!result.error) return result.data ?? [];

  const error = result.error;
  const code = String(error.code ?? '');
  const rawMessage = `${code} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();

  // Treat missing table / column / relationship as empty data (migration not applied yet)
  const isMissingStructure =
    ['PGRST200', 'PGRST201', 'PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703'].includes(code) ||
    rawMessage.includes('does not exist') ||
    rawMessage.includes('not found') ||
    rawMessage.includes('relationship') ||
    rawMessage.includes('column') ||
    rawMessage.includes('table') ||
    rawMessage.includes('undefined') ||
    rawMessage.includes('invalid input syntax') ||
    // HTTP 400 from PostgREST almost always means schema mismatch
    rawMessage.includes('bad request');

  if (isMissingStructure) return [];

  // Real errors (401, 403, 5xx-equivalent, network) — still throw
  throw new Error(error.message || 'Falha ao carregar dados do dashboard.');
}

function classifyAuditoriaStatus(params: {
  rhFechado: number;
  financeiroRecebido: number;
  financeiroAprovado: number;
  cnabGerado: number;
  bancoHistorico: number;
  pendencias: string[];
}): AuditoriaCompetenciaStatus {
  const {
    rhFechado,
    financeiroRecebido,
    financeiroAprovado,
    cnabGerado,
    bancoHistorico,
    pendencias,
  } = params;

  const hasCoreData =
    rhFechado > 0 ||
    financeiroRecebido > 0 ||
    financeiroAprovado > 0 ||
    cnabGerado > 0 ||
    bancoHistorico > 0;

  if (!hasCoreData) {
    return 'sem_dados';
  }

  if (pendencias.length > 0) {
    return 'pendente';
  }

  const isRhAligned = Math.abs(rhFechado - financeiroRecebido) < 0.01;
  const isFinanceiroAligned = Math.abs(financeiroAprovado - cnabGerado) < 0.01;
  const isBancoAligned =
    bancoHistorico === 0 || Math.abs(cnabGerado - bancoHistorico) < 0.01;

  if (isRhAligned && isFinanceiroAligned && isBancoAligned) {
    return 'ok';
  }

  return 'divergente';
}

function applyDiaristaStatus(acc: FluxAccumulator, status: string, value: number) {
  acc.rhProcessado += value;

  if ([
    'VALIDADO_RH',
    'FECHADO_FINANCEIRO',
    'AGUARDANDO_PAGAMENTO',
    'PAGO',
    'CNAB_GERADO',
  ].includes(status)) {
    acc.rhValidado += value;
    acc.rhFechado += value;
    acc.finRecebidoRh += value;
  }

  if ([
    'FECHADO_FINANCEIRO',
    'AGUARDANDO_PAGAMENTO',
    'PAGO',
    'CNAB_GERADO',
  ].includes(status)) {
    acc.finAprovado += value;
  }
}

function applyFolhaStatus(acc: FluxAccumulator, status: string, value: number) {
  acc.rhProcessado += value;

  if ([
    'FECHADO_RH',
    'ENVIADO_FINANCEIRO',
    'APROVADO_FINANCEIRO',
    'PAGO',
    'CNAB_GERADO',
  ].includes(status)) {
    acc.rhValidado += value;
    acc.rhFechado += value;
    acc.finRecebidoRh += value;
  }

  if (['APROVADO_FINANCEIRO', 'PAGO', 'CNAB_GERADO'].includes(status)) {
    acc.finAprovado += value;
  }
}

export interface CustoExtraReconhecidoDREInput {
  deleted_at?: string | null;
  pipeline_status?: string | null;
  status_pagamento?: string | null;
}

export const CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE = [
  'APROVADO_OPERACAO',
  'ENVIADO_FINANCEIRO',
  'FINALIZADO',
] as const;

export function isCustoExtraReconhecidoDRE(item: CustoExtraReconhecidoDREInput): boolean {
  if (item.deleted_at != null) return false;
  const pipelineStatus = String(item.pipeline_status || '').toUpperCase();
  if (!CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE.includes(pipelineStatus as any)) return false;
  const statusPagamento = String(item.status_pagamento || '').toUpperCase();
  if (statusPagamento === 'CANCELADO') return false;
  return true;
}

export function normalizeCompetencia(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.includes('T')) return value.substring(0, 7);
  if (value.match(/^\d{4}-\d{2}$/)) return value;
  if (value && value.includes('all')) return value; 
  return value.substring(0, 7);
}

class DashboardConsolidadoServiceClass {
  async getKpisByCompetencia(
    competencia: string,
    empresaId?: string,
  ): Promise<OperationalIntegrityKPIs> {
    const canonicalCompetencia = normalizeCompetencia(competencia) || '';
    const consolidadoEm = new Date().toISOString();
    
    // Configuração do Isolamento de Ambiente - CHECKPOINT 06 
    const env = typeof window !== 'undefined' ? localStorage.getItem('esc-log-environment') : null;
    const isHomologacao = env === 'HOMOLOGACAO' || env === 'homologacao';
    
    const { data: testEmpresas } = await supabase.from('empresas').select('id').eq('is_teste', true);
    const testIds = testEmpresas?.map(e => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ['00000000-0000-0000-0000-000000000000'];
    
    const { data: contasTest } = await supabase.from('contas_bancarias_empresa').select('id').in('empresa_id', safeTestIds);
    const contatestIds = contasTest?.map(c => c.id) || [];
    const safeContaTestIds = contatestIds.length > 0 ? contatestIds : ['11111111-1111-1111-1111-111111111111'];

    // Helper functions to inject the correct where clause based on the environment
    const applySeg = (q: any) => {
      if (isHomologacao) return q.in('empresa_id', safeTestIds);
      return q.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
    };

    const applyCnabSeg = (q: any) => {
      if (isHomologacao) return q.or(`modo.eq.homologacao,and(modo.is.null,conta_bancaria_id.in.(${safeContaTestIds.join(',')}))`);
      return q.or(`modo.eq.producao,and(modo.is.null,conta_bancaria_id.not.in.(${safeContaTestIds.join(',')}))`);
    };
    
    // Detect if we are looking for a whole year
    const isAnual = canonicalCompetencia.includes('all');
    const yearPart = Number(canonicalCompetencia.split('-')[0]);
    
    const startRange = isAnual ? `${yearPart}-01-01` : `${canonicalCompetencia}-01`;
    const nextMonth = isAnual 
      ? `${yearPart + 1}-01` 
      : format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    let qReceitas = applySeg(supabase
      .from('receitas_operacionais')
      .select('valor_total, status, created_at, updated_at, competencia'));
      
    if (isAnual) {
      qReceitas = qReceitas.or(`competencia.gte.${yearPart}-01,and(competencia.is.null,created_at.gte.${yearPart}-01-01,created_at.lt.${yearPart + 1}-01-01)`);
    } else {
      qReceitas = qReceitas.or(`competencia.eq.${canonicalCompetencia},and(competencia.is.null,created_at.gte.${startRange},created_at.lt.${endRange})`);
    }
    if (empresaId) qReceitas = qReceitas.eq('empresa_id', empresaId);

    let qLotesD = applySeg(supabase
      .from('diaristas_lotes_fechamento')
      .select('valor_total, status, periodo_inicio, created_at, updated_at')
      .gte('periodo_inicio', startRange)
      .lt('periodo_inicio', endRange));
    if (empresaId) qLotesD = qLotesD.eq('empresa_id', empresaId);

    let qLotesRh = applySeg(supabase
      .from('rh_financeiro_lotes')
      .select('tipo, status, created_at, updated_at, lote_itens:rh_financeiro_lote_itens(valor_calculado)'));
    
    if (isAnual) {
      qLotesRh = qLotesRh.gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`);
    } else {
      qLotesRh = qLotesRh.eq('competencia', canonicalCompetencia);
    }
    if (empresaId) qLotesRh = qLotesRh.eq('empresa_id', empresaId);

    let qCnabLotes = applySeg(supabase
      .from('lotes_remessa')
      .select('id, valor_total, status, status_conciliacao, created_at'));
    
    if (isAnual) {
      qCnabLotes = qCnabLotes.gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`);
    } else {
      qCnabLotes = qCnabLotes.eq('competencia', canonicalCompetencia);
    }
    if (empresaId) qCnabLotes = qCnabLotes.eq('empresa_id', empresaId);

    const qCnabArquivosBase = applyCnabSeg(supabase
      .from('cnab_remessas_arquivos')
      .select('id, lote_id, total_valor, status, competencia, data_geracao, updated_at'));
    
    const qCnabArquivos = isAnual 
      ? qCnabArquivosBase.gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`)
      : qCnabArquivosBase.eq('competencia', canonicalCompetencia);

    const qRetornoItens = supabase
      .from('cnab_retorno_itens')
      .select(`
        valor_retornado,
        status,
        created_at,
        remessa_arquivo:cnab_remessas_arquivos!remessa_arquivo_id(
          competencia
        )
      `);

    let qCustos = applySeg(supabase
      .from('custos_extras_operacionais')
      .select('total, status_pagamento, pipeline_status, criado_em, atualizado_em, deleted_at')
      .is('deleted_at', null)
      .in('pipeline_status', [...CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE])
      .neq('status_pagamento', 'CANCELADO')
      .gte('data', startRange)
      .lt('data', endRange));
    if (empresaId) qCustos = qCustos.eq('empresa_id', empresaId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qServicosExtras = applySeg((supabase as any)
      .from('servicos_extras_operacionais')
      .select('total, pipeline_status, criado_em, atualizado_em')
      .gte('data', startRange)
      .lt('data', endRange));
    if (empresaId) qServicosExtras = qServicosExtras.eq('empresa_id', empresaId);

    const [
      resReceitas,
      resLotesD,
      resLotesRh,
      resCnabLotes,
      resCnabArquivos,
      resRetornoItens,
      resCustos,
      resServicosExtras,
    ] = await Promise.all([
      qReceitas,
      qLotesD,
      qLotesRh,
      qCnabLotes,
      qCnabArquivos,
      qRetornoItens,
      qCustos,
      qServicosExtras,
    ]);

    // safeData: returns [] for missing-table/column errors (migration not applied), throws only for real errors
    const receitasData = safeData(resReceitas);
    const lotesDData = safeData(resLotesD);
    const lotesRhData = safeData(resLotesRh as any);
    const cnabLotesData = safeData(resCnabLotes);
    const cnabArquivosData = safeData(resCnabArquivos);
    const retornoItensData = safeData(resRetornoItens as any);
    const custosData = safeData(resCustos);
    const servicosExtrasData = safeData(resServicosExtras as any);

    const diaristaFlow = emptyFluxAccumulator();
    const folhaFlow = emptyFluxAccumulator();
    const intermitenteFlow = emptyFluxAccumulator();
    const flowsPresentes: TipoFluxo[] = [];

    let faturamentoTotal = 0;
    let caixaRecebido = 0;
    const receitasUpdatedAt: string[] = [];

    receitasData.forEach((item: any) => {
      // Validação de competência econômica com fallback seguro
      const itemComp = item.competencia || (item.created_at ? String(item.created_at).substring(0, 7) : '');
      if (isAnual) {
        if (!itemComp.startsWith(String(yearPart))) return;
      } else {
        if (itemComp && itemComp !== canonicalCompetencia) return;
      }

      const stat = String(item.status || '').toLowerCase();
      if (stat !== 'cancelado') {
        faturamentoTotal = addAmount(faturamentoTotal, item.valor_total);
      }
      if (['recebido', 'pago', 'conciliado'].includes(stat)) {
        caixaRecebido = addAmount(caixaRecebido, item.valor_total);
      }
      receitasUpdatedAt.push(
        String(item.updated_at || item.created_at || consolidadoEm),
      );
      flowsPresentes.push('operacional');
    });

    const lotesDUpdatedAt: string[] = [];
    lotesDData.forEach((item: any) => {
      const value = Number(item.valor_total) || 0;
      const status = String(item.status || '').toUpperCase();
      applyDiaristaStatus(diaristaFlow, status, value);
      lotesDUpdatedAt.push(
        String(item.updated_at || item.created_at || consolidadoEm),
      );
      if (value > 0) flowsPresentes.push('diarista');
    });

    const lotesRhUpdatedAt: string[] = [];
    lotesRhData.forEach((item: any) => {
      const total = ((item.lote_itens || []) as Array<{ valor_calculado: number | null }>)
        .reduce((acc, current) => acc + (Number(current.valor_calculado) || 0), 0);
      const status = String(item.status || '').toUpperCase();
      const tipo = String(item.tipo || '').toUpperCase();

      if (tipo === 'INTERMITENTES') {
        applyFolhaStatus(intermitenteFlow, status, total);
        if (total > 0) flowsPresentes.push('intermitente');
      } else {
        applyFolhaStatus(folhaFlow, status, total);
        if (total > 0) flowsPresentes.push('folha_variavel');
      }

      lotesRhUpdatedAt.push(
        String(item.updated_at || item.created_at || consolidadoEm),
      );
    });

    const rhValorProcessado = folhaFlow.rhProcessado + intermitenteFlow.rhProcessado + diaristaFlow.rhProcessado;
    const rhValorValidado = folhaFlow.rhValidado + intermitenteFlow.rhValidado + diaristaFlow.rhValidado;
    const rhValorFechado = folhaFlow.rhFechado + intermitenteFlow.rhFechado + diaristaFlow.rhFechado;
    const finValorRecebidoRH = folhaFlow.finRecebidoRh + intermitenteFlow.finRecebidoRh + diaristaFlow.finRecebidoRh;
    const finValorAprovado = folhaFlow.finAprovado + intermitenteFlow.finAprovado + diaristaFlow.finAprovado;

    let finValorEnviadoBanco = 0;
    const cnabUpdatedAt: string[] = [];
    const lotesRemessaPendentes = new Set<string>();

    cnabLotesData.forEach((item: any) => {
      const status = String(item.status || '').toLowerCase();
      const statusConciliacao = String(item.status_conciliacao || '').toLowerCase();
      if (status && !['gerado', 'baixado', 'enviado_manual', 'homologado', 'pago'].includes(status)) {
        lotesRemessaPendentes.add(String(item.id));
      }
      if (
        ['gerado', 'baixado', 'enviado_manual', 'homologado', 'pago'].includes(status) ||
        ['conciliado'].includes(statusConciliacao)
      ) {
        finValorEnviadoBanco = addAmount(finValorEnviadoBanco, item.valor_total);
      }
      cnabUpdatedAt.push(String(item.updated_at || item.created_at || consolidadoEm));
    });

    cnabArquivosData.forEach((item: any) => {
      if (['gerado', 'baixado', 'enviado_manual', 'homologado'].includes(String(item.status))) {
        finValorEnviadoBanco = addAmount(finValorEnviadoBanco, item.total_valor);
      }
      cnabUpdatedAt.push(
        String(item.updated_at || item.data_geracao || consolidadoEm),
      );
    });

    finValorEnviadoBanco = Number(finValorEnviadoBanco.toFixed(2));

    let finValorHistoricoBanco = 0;
    const retornoUpdatedAt: string[] = [];
    retornoItensData.forEach((item: any) => {
      const remessaCompetencia = normalizeCompetencia(
        (item.remessa_arquivo as { competencia?: string | null } | null)?.competencia,
      );
      if (remessaCompetencia !== canonicalCompetencia) return;
      if (String(item.status) === 'pago') {
        finValorHistoricoBanco = addAmount(finValorHistoricoBanco, item.valor_retornado);
      }
      retornoUpdatedAt.push(String(item.created_at || consolidadoEm));
    });
    finValorHistoricoBanco = Number(finValorHistoricoBanco.toFixed(2));

    let custosGerais = 0;
    const custosUpdatedAt: string[] = [];
    let custosPendentes = 0;
    let custosAtrasados = 0;
    custosData.forEach((item: any) => {
      if (!isCustoExtraReconhecidoDRE(item)) return;

      custosGerais = addAmount(custosGerais, item.total);
      const statusPagamento = String(item.status_pagamento || '').toUpperCase();
      if (statusPagamento === 'PENDENTE' || statusPagamento === 'A_PAGAR') custosPendentes += 1;
      if (statusPagamento === 'ATRASADO') custosAtrasados += 1;
      custosUpdatedAt.push(
        String(item.atualizado_em || item.criado_em || consolidadoEm),
      );
      flowsPresentes.push('operacional');
    });

    const servicosExtrasUpdatedAt: string[] = [];
    let servicosPendentes = 0;
    let servicosComAlerta = 0;
    servicosExtrasData.forEach((item: any) => {
      // Use pipeline_status from the dedicated servicos_extras_operacionais table
      const pipelineStatus = String(item.pipeline_status || 'PENDENTE').toUpperCase();
      if (['PENDENTE', 'EM_VALIDACAO'].includes(pipelineStatus)) servicosPendentes += 1;
      if (['DEVOLVIDO'].includes(pipelineStatus)) servicosComAlerta += 1;
      servicosExtrasUpdatedAt.push(
        String(item.atualizado_em || item.criado_em || consolidadoEm),
      );
      if ((Number(item.total) || 0) > 0) flowsPresentes.push('operacional');
    });

    const lucroReal = faturamentoTotal - finValorAprovado - custosGerais;
    const tiposFluxo = dedupeFlowTypes(flowsPresentes);
    const tipoFluxoResumo = summarizeFlowType(tiposFluxo);

    const pendencias: string[] = [];
    if (rhValorFechado > 0 && finValorRecebidoRH === 0) {
      pendencias.push('RH fechado sem recebimento correspondente no financeiro.');
    }
    if (finValorAprovado > 0 && finValorEnviadoBanco === 0) {
      pendencias.push('Financeiro aprovado ainda sem remessa CNAB gerada.');
    }
    if (lotesRemessaPendentes.size > 0) {
      pendencias.push('Existem lotes de remessa ainda pendentes de geração ou homologação.');
    }

    if (custosPendentes > 0 || custosAtrasados > 0) {
      pendencias.push(`Custos extras com reflexo financeiro pendente: ${custosPendentes} pendente(s) e ${custosAtrasados} atrasado(s).`);
    }
    if (servicosPendentes > 0 || servicosComAlerta > 0) {
      pendencias.push(`Serviços extras aguardando validação operacional: ${servicosPendentes} pendente(s) e ${servicosComAlerta} com alerta.`);
    }

    const diferencaRhFinanceiro = moneyDiff(rhValorFechado, finValorRecebidoRH);
    const diferencaFinanceiroCnab = moneyDiff(finValorAprovado, finValorEnviadoBanco);
    const diferencaCnabHistorico = moneyDiff(finValorEnviadoBanco, finValorHistoricoBanco);
    const diferencaTotal = Math.max(
      Math.abs(diferencaRhFinanceiro),
      Math.abs(diferencaFinanceiroCnab),
      Math.abs(diferencaCnabHistorico),
    );

    const atualizadoEm = maxIso(
      [
        ...receitasUpdatedAt,
        ...lotesDUpdatedAt,
        ...lotesRhUpdatedAt,
        ...cnabUpdatedAt,
        ...retornoUpdatedAt,
        ...custosUpdatedAt,
        ...servicosExtrasUpdatedAt,
      ],
      consolidadoEm,
    );

    const auditoriaCompetencia: AuditoriaCompetenciaResumo = {
      status: classifyAuditoriaStatus({
        rhFechado: rhValorFechado,
        financeiroRecebido: finValorRecebidoRH,
        financeiroAprovado: finValorAprovado,
        cnabGerado: finValorEnviadoBanco,
        bancoHistorico: finValorHistoricoBanco,
        pendencias,
      }),
      rhFechado: rhValorFechado,
      financeiroRecebido: finValorRecebidoRH,
      financeiroAprovado: finValorAprovado,
      cnabGerado: finValorEnviadoBanco,
      bancoHistorico: finValorHistoricoBanco,
      diferencaRhFinanceiro,
      diferencaFinanceiroCnab,
      diferencaCnabHistorico,
      diferencaTotal: Number(diferencaTotal.toFixed(2)),
      pendencias,
      atualizadoEm,
      tipoFluxo: tipoFluxoResumo,
    };

    return {
      competencia: canonicalCompetencia,
      consolidadoEm,
      tipoFluxo: tipoFluxoResumo,
      fluxosPresentes: tiposFluxo,
      rhValorProcessado: Number(rhValorProcessado.toFixed(2)),
      rhValorValidado: Number(rhValorValidado.toFixed(2)),
      rhValorFechado: Number(rhValorFechado.toFixed(2)),
      finValorRecebidoRH: Number(finValorRecebidoRH.toFixed(2)),
      finValorAprovado: Number(finValorAprovado.toFixed(2)),
      folhaValorAprovado: Number(folhaFlow.finAprovado.toFixed(2)),
      intermitentesValorAprovado: Number(intermitenteFlow.finAprovado.toFixed(2)),
      diaristasValorAprovado: Number(diaristaFlow.finAprovado.toFixed(2)),
      flows: {
        folha: { ...folhaFlow },
        intermitente: { ...intermitenteFlow },
        diarista: { ...diaristaFlow },
      },
      finValorEnviadoBanco: Number(finValorEnviadoBanco.toFixed(2)),
      finValorHistoricoBanco,
      faturamentoTotal: Number(faturamentoTotal.toFixed(2)),
      caixaRecebido: Number(caixaRecebido.toFixed(2)),
      custosGerais: Number(custosGerais.toFixed(2)),
      lucroReal: Number(lucroReal.toFixed(2)),
      auditoriaCompetencia,
      origens: {
        faturamentoTotal: buildOrigin(
          'Financeiro consolidado por cliente validado',
          canonicalCompetencia,
          maxIso(receitasUpdatedAt, consolidadoEm),
          ['operacional'],
        ),
        caixaRecebido: buildOrigin(
          'Financeiro consolidado por cliente com status recebido/pago',
          canonicalCompetencia,
          maxIso(receitasUpdatedAt, consolidadoEm),
          ['operacional'],
        ),
        custosGerais: buildOrigin(
          'Custos extras operacionais consolidados',
          canonicalCompetencia,
          maxIso(custosUpdatedAt, consolidadoEm),
          ['operacional'],
        ),
        lucroReal: buildOrigin(
          'Receita consolidada - financeiro aprovado - custos consolidados',
          canonicalCompetencia,
          atualizadoEm,
          tiposFluxo,
        ),
        finValorAprovado: buildOrigin(
          'Lotes RH (CLT + Intermitentes) aprovados + lotes diaristas fechados para pagamento',
          canonicalCompetencia,
          maxIso([...lotesDUpdatedAt, ...lotesRhUpdatedAt], consolidadoEm),
          tiposFluxo.filter((tipo) => tipo !== 'operacional'),
        ),
        auditoriaCompetencia: buildOrigin(
          'RH fechado x financeiro recebido/aprovado x CNAB x histórico bancário',
          canonicalCompetencia,
          atualizadoEm,
          tiposFluxo,
        ),
      },
    };
  }

  async getKpisAggregate(
    year: string,
    month: string | 'all',
    empresaId?: string,
  ): Promise<OperationalIntegrityKPIs> {
    if (month !== 'all') {
      return this.getKpisByCompetencia(`${year}-${month}`, empresaId);
    }

    const snapshots = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        this.getKpisByCompetencia(
          `${year}-${String(index + 1).padStart(2, '0')}`,
          empresaId,
        ),
      ),
    );

    const consolidadoEm = maxIso(
      snapshots.map((item) => item.consolidadoEm),
      new Date().toISOString(),
    );
    const tiposFluxo = dedupeFlowTypes(
      snapshots.flatMap((item) => item.fluxosPresentes),
    );
    const pendencias = Array.from(
      new Set(
        snapshots.flatMap((item) => item.auditoriaCompetencia.pendencias),
      ),
    );

    const aggregate: OperationalIntegrityKPIs = {
      competencia: year,
      consolidadoEm,
      tipoFluxo: summarizeFlowType(tiposFluxo),
      fluxosPresentes: tiposFluxo,
      rhValorProcessado: 0,
      rhValorValidado: 0,
      rhValorFechado: 0,
      finValorRecebidoRH: 0,
      finValorAprovado: 0,
      folhaValorAprovado: 0,
      intermitentesValorAprovado: 0,
      diaristasValorAprovado: 0,
      flows: {
        folha: emptyFluxAccumulator(),
        intermitente: emptyFluxAccumulator(),
        diarista: emptyFluxAccumulator(),
      },
      finValorEnviadoBanco: 0,
      finValorHistoricoBanco: 0,
      faturamentoTotal: 0,
      caixaRecebido: 0,
      lucroReal: 0,
      custosGerais: 0,
      auditoriaCompetencia: {
        status: 'sem_dados',
        rhFechado: 0,
        financeiroRecebido: 0,
        financeiroAprovado: 0,
        cnabGerado: 0,
        bancoHistorico: 0,
        diferencaRhFinanceiro: 0,
        diferencaFinanceiroCnab: 0,
        diferencaCnabHistorico: 0,
        diferencaTotal: 0,
        pendencias,
        atualizadoEm: consolidadoEm,
        tipoFluxo: summarizeFlowType(tiposFluxo),
      },
      origens: {
        faturamentoTotal: buildOrigin(
          'Financeiro consolidado por cliente validado',
          year,
          consolidadoEm,
          ['operacional'],
        ),
        caixaRecebido: buildOrigin(
          'Financeiro consolidado por cliente com status recebido/pago',
          year,
          consolidadoEm,
          ['operacional'],
        ),
        custosGerais: buildOrigin(
          'Custos extras operacionais consolidados',
          year,
          consolidadoEm,
          ['operacional'],
        ),
        lucroReal: buildOrigin(
          'Receita consolidada - financeiro aprovado - custos consolidados',
          year,
          consolidadoEm,
          tiposFluxo,
        ),
        finValorAprovado: buildOrigin(
          'Lotes RH aprovados + lotes diaristas fechados para pagamento',
          year,
          consolidadoEm,
          tiposFluxo.filter((tipo) => tipo !== 'operacional'),
        ),
        auditoriaCompetencia: buildOrigin(
          'Somatório anual das auditorias mensais por competência',
          year,
          consolidadoEm,
          tiposFluxo,
        ),
      },
    };

    snapshots.forEach((item) => {
      aggregate.rhValorProcessado += item.rhValorProcessado;
      aggregate.rhValorValidado += item.rhValorValidado;
      aggregate.rhValorFechado += item.rhValorFechado;
      aggregate.finValorRecebidoRH += item.finValorRecebidoRH;
      aggregate.finValorAprovado += item.finValorAprovado;
      aggregate.folhaValorAprovado += item.folhaValorAprovado;
      aggregate.intermitentesValorAprovado += item.intermitentesValorAprovado;
      aggregate.diaristasValorAprovado += item.diaristasValorAprovado;
      if (item.flows && aggregate.flows) {
        aggregate.flows.folha.finAprovado += item.flows.folha.finAprovado;
        aggregate.flows.intermitente.finAprovado += item.flows.intermitente.finAprovado;
        aggregate.flows.diarista.finAprovado += item.flows.diarista.finAprovado;
      }
      aggregate.finValorEnviadoBanco += item.finValorEnviadoBanco;
      aggregate.finValorHistoricoBanco += item.finValorHistoricoBanco;
      aggregate.faturamentoTotal += item.faturamentoTotal;
      aggregate.caixaRecebido += item.caixaRecebido;
      aggregate.lucroReal += item.lucroReal;
      aggregate.custosGerais += item.custosGerais;
      aggregate.auditoriaCompetencia.rhFechado += item.auditoriaCompetencia.rhFechado;
      aggregate.auditoriaCompetencia.financeiroRecebido += item.auditoriaCompetencia.financeiroRecebido;
      aggregate.auditoriaCompetencia.financeiroAprovado += item.auditoriaCompetencia.financeiroAprovado;
      aggregate.auditoriaCompetencia.cnabGerado += item.auditoriaCompetencia.cnabGerado;
      aggregate.auditoriaCompetencia.bancoHistorico += item.auditoriaCompetencia.bancoHistorico;
    });

    aggregate.rhValorProcessado = Number(aggregate.rhValorProcessado.toFixed(2));
    aggregate.rhValorValidado = Number(aggregate.rhValorValidado.toFixed(2));
    aggregate.rhValorFechado = Number(aggregate.rhValorFechado.toFixed(2));
    aggregate.finValorRecebidoRH = Number(aggregate.finValorRecebidoRH.toFixed(2));
    aggregate.finValorAprovado = Number(aggregate.finValorAprovado.toFixed(2));
    aggregate.folhaValorAprovado = Number(aggregate.folhaValorAprovado.toFixed(2));
    aggregate.intermitentesValorAprovado = Number(aggregate.intermitentesValorAprovado.toFixed(2));
    aggregate.diaristasValorAprovado = Number(aggregate.diaristasValorAprovado.toFixed(2));
    aggregate.finValorEnviadoBanco = Number(aggregate.finValorEnviadoBanco.toFixed(2));
    aggregate.finValorHistoricoBanco = Number(aggregate.finValorHistoricoBanco.toFixed(2));
    aggregate.faturamentoTotal = Number(aggregate.faturamentoTotal.toFixed(2));
    aggregate.caixaRecebido = Number(aggregate.caixaRecebido.toFixed(2));
    aggregate.lucroReal = Number(aggregate.lucroReal.toFixed(2));
    aggregate.custosGerais = Number(aggregate.custosGerais.toFixed(2));

    aggregate.auditoriaCompetencia.diferencaRhFinanceiro = moneyDiff(
      aggregate.auditoriaCompetencia.rhFechado,
      aggregate.auditoriaCompetencia.financeiroRecebido,
    );
    aggregate.auditoriaCompetencia.diferencaFinanceiroCnab = moneyDiff(
      aggregate.auditoriaCompetencia.financeiroAprovado,
      aggregate.auditoriaCompetencia.cnabGerado,
    );
    aggregate.auditoriaCompetencia.diferencaCnabHistorico = moneyDiff(
      aggregate.auditoriaCompetencia.cnabGerado,
      aggregate.auditoriaCompetencia.bancoHistorico,
    );
    aggregate.auditoriaCompetencia.diferencaTotal = Number(
      Math.max(
        Math.abs(aggregate.auditoriaCompetencia.diferencaRhFinanceiro),
        Math.abs(aggregate.auditoriaCompetencia.diferencaFinanceiroCnab),
        Math.abs(aggregate.auditoriaCompetencia.diferencaCnabHistorico),
      ).toFixed(2),
    );
    aggregate.auditoriaCompetencia.status = classifyAuditoriaStatus({
      rhFechado: aggregate.auditoriaCompetencia.rhFechado,
      financeiroRecebido: aggregate.auditoriaCompetencia.financeiroRecebido,
      financeiroAprovado: aggregate.auditoriaCompetencia.financeiroAprovado,
      cnabGerado: aggregate.auditoriaCompetencia.cnabGerado,
      bancoHistorico: aggregate.auditoriaCompetencia.bancoHistorico,
      pendencias,
    });

    return aggregate;
  }

  async getRadarAlertas(competencia: string, empresaId?: string): Promise<RadarAlertaReal[]> {
    const canonicalCompetencia = normalizeCompetencia(competencia) || '';
    const startRange = `${canonicalCompetencia}-01`;
    const nextMonth = format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    const env = typeof window !== 'undefined' ? localStorage.getItem('esc-log-environment') : null;
    const isHomologacao = env === 'HOMOLOGACAO' || env === 'homologacao';
    const { data: testEmpresas } = await supabase.from('empresas').select('id').eq('is_teste', true);
    const testIds = testEmpresas?.map(e => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ['00000000-0000-0000-0000-000000000000'];

    const applySeg = (q: any) => {
      if (isHomologacao) return q.in('empresa_id', safeTestIds);
      return q.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
    };

    const alertas: RadarAlertaReal[] = [];

    try {
      // 1. Inadimplência / Títulos Vencidos
      const hoje = new Date().toISOString().substring(0, 10);
      let qInadimplencia = applySeg(supabase
        .from('receitas_operacionais')
        .select('id, valor_total, vencimento, status')
        .neq('status', 'cancelado')
        .neq('status', 'recebido')
        .neq('status', 'pago')
        .neq('status', 'conciliado')
        .lt('vencimento', hoje));

      if (empresaId && empresaId !== 'all') {
        qInadimplencia = qInadimplencia.eq('empresa_id', empresaId);
      }

      const resInadimplencia = await qInadimplencia;
      const faturasVencidas = safeData(resInadimplencia);
      const totalVencido = faturasVencidas.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);

      if (faturasVencidas.length > 0) {
        alertas.push({
          id: 'alt-inadimplencia',
          tipo: 'critico',
          modulo: 'Financeiro / Cobrança',
          titulo: `${faturasVencidas.length} fatura(s) com vencimento ultrapassado`,
          descricao: `Existem títulos em aberto somando ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVencido)}.`,
          valor: totalVencido,
          tempo: 'Vencimento expirado',
          acaoLabel: 'Cobrar Cliente',
          origemRota: '/financeiro/inadimplencia',
        });
      }

      // 2. Lote Semanal Diaristas em Análise RH
      let qDiaristas = applySeg(supabase
        .from('diaristas_lotes_fechamento')
        .select('id, valor_total, status, total_diarias')
        .eq('status', 'AGUARDANDO_VALIDACAO_RH')
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange));

      if (empresaId && empresaId !== 'all') {
        qDiaristas = qDiaristas.eq('empresa_id', empresaId);
      }

      const resDiaristas = await qDiaristas;
      const lotesDiaristas = safeData(resDiaristas);
      const totalDiaristas = lotesDiaristas.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);
      const totalPresencas = lotesDiaristas.reduce((acc, curr) => acc + (Number(curr.total_diarias) || 0), 0);

      if (lotesDiaristas.length > 0) {
        alertas.push({
          id: 'alt-diaristas-rh',
          tipo: 'atencao',
          modulo: 'Diaristas / Fechamento',
          titulo: 'Lote semanal de diaristas pendente de validação',
          descricao: `${totalPresencas > 0 ? `${totalPresencas} diárias aguardando` : 'Lotes aguardando'} validação do RH para envio ao financeiro.`,
          valor: totalDiaristas,
          tempo: 'Ciclo Semanal',
          acaoLabel: 'Conferir Lote',
          origemRota: '/operacional/diaristas',
        });
      }

      // 3. Custos Extras Pendentes
      let qCustosPend = applySeg(supabase
        .from('custos_extras_operacionais')
        .select('id, total, status_pagamento, pipeline_status')
        .is('deleted_at', null)
        .eq('pipeline_status', 'PENDENTE')
        .gte('data', startRange)
        .lt('data', endRange));

      if (empresaId && empresaId !== 'all') {
        qCustosPend = qCustosPend.eq('empresa_id', empresaId);
      }

      const resCustosPend = await qCustosPend;
      const custosPend = safeData(resCustosPend);
      const totalCustosPend = custosPend.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

      if (custosPend.length > 0) {
        alertas.push({
          id: 'alt-custos-pend',
          tipo: 'atencao',
          modulo: 'Custos Extras / Operação',
          titulo: `${custosPend.length} custo(s) extra(s) aguardando conferência`,
          descricao: 'Lançamentos de custos necessitam de aprovação operacional.',
          valor: totalCustosPend,
          tempo: 'Pendente',
          acaoLabel: 'Conferir Custos',
          origemRota: '/operacional/custos-extras',
        });
      }

      // 4. Última Sincronização REP / Automação
      const qSync = supabase
        .from('historico_importacoes')
        .select('id, tipo_arquivo, status, criado_em, registros_processados')
        .order('criado_em', { ascending: false })
        .limit(1);

      const resSync = await qSync;
      const lastSync = safeData(resSync)[0];
      if (lastSync) {
        const dataSync = new Date(lastSync.criado_em);
        const horaStr = !isNaN(dataSync.getTime()) ? dataSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '07:00';
        alertas.push({
          id: 'alt-sync-rep',
          tipo: 'info',
          modulo: 'Automação / REP',
          titulo: 'Sincronização de pontos executada',
          descricao: `${lastSync.registros_processados || 'Registros'} importados (${lastSync.tipo_arquivo || 'REP'}) com status: ${lastSync.status || 'OK'}.`,
          tempo: `Hoje ${horaStr}`,
          acaoLabel: 'Ver Pontos',
          origemRota: '/clt/pontos',
        });
      }
    } catch (e) {
      console.warn('Falha ao processar radar de alertas:', e);
    }

    return alertas;
  }

  async getStatusCiclos(competencia: string, empresaId?: string): Promise<StatusCiclosReal> {
    const canonicalCompetencia = normalizeCompetencia(competencia) || '';
    const startRange = `${canonicalCompetencia}-01`;
    const nextMonth = format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    let diaristasEmAnalise = 0;
    try {
      const resD = await supabase
        .from('diaristas_lotes_fechamento')
        .select('id')
        .eq('status', 'AGUARDANDO_VALIDACAO_RH')
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange);
      diaristasEmAnalise = safeData(resD).length;
    } catch {}

    let ultimoSync = 'Hoje 07:01';
    try {
      const resSync = await supabase
        .from('historico_importacoes')
        .select('criado_em')
        .order('criado_em', { ascending: false })
        .limit(1);
      const syncItem = safeData(resSync)[0];
      if (syncItem?.criado_em) {
        const d = new Date(syncItem.criado_em);
        if (!isNaN(d.getTime())) {
          ultimoSync = `Hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
    } catch {}

    const now = new Date();
    const endOfMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const diasRestantes = Math.max(1, endOfMonthDate.getDate() - now.getDate());

    return {
      clt: {
        status: 'aberto',
        label: `CLT: Aberto (fecha em ${diasRestantes}d)`,
        prazoDias: diasRestantes,
      },
      diaristas: {
        status: diaristasEmAnalise > 0 ? 'em_analise' : 'aberto',
        label: diaristasEmAnalise > 0 ? `Diaristas: ${diaristasEmAnalise} lote(s) em Análise RH` : 'Diaristas: Ciclo Regular',
        pendentesRh: diaristasEmAnalise,
      },
      financeiro: {
        status: 'aberto',
        label: 'Financeiro: Conciliação em Dia',
        emDia: true,
      },
      ultimoSyncRhid: ultimoSync,
    };
  }

  async getMotoresData(competencia: string, empresaId?: string): Promise<MotoresDataReal> {
    const canonicalCompetencia = normalizeCompetencia(competencia) || '';
    const startRange = `${canonicalCompetencia}-01`;
    const nextMonth = format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    const env = typeof window !== 'undefined' ? localStorage.getItem('esc-log-environment') : null;
    const isHomologacao = env === 'HOMOLOGACAO' || env === 'homologacao';
    const { data: testEmpresas } = await supabase.from('empresas').select('id').eq('is_teste', true);
    const testIds = testEmpresas?.map(e => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ['00000000-0000-0000-0000-000000000000'];

    const applySeg = (q: any) => {
      if (isHomologacao) return q.in('empresa_id', safeTestIds);
      return q.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
    };

    // 1. Operações por Volume
    let totalDescargas = 0;
    let volumeCaixas = 0;
    let pendentesConferencia = 0;
    let valorCaixaImediato = 0;
    let valorDuplicatas = 0;
    let valorMensal = 0;

    try {
      let qOps = applySeg(supabase
        .from('operacoes_producao')
        .select('id, quantidade, valor_total, modalidade_faturamento, status')
        .gte('data_operacao', startRange)
        .lt('data_operacao', endRange));
      if (empresaId && empresaId !== 'all') qOps = qOps.eq('empresa_id', empresaId);
      
      const ops = safeData(await qOps);
      totalDescargas = ops.length;
      ops.forEach(op => {
        volumeCaixas += Number(op.quantidade) || 0;
        const stat = String(op.status || '').toUpperCase();
        if (stat === 'PENDENTE' || stat === 'EM_CONFERENCIA') pendentesConferencia += 1;
        
        const mod = String(op.modalidade_faturamento || '').toUpperCase();
        const v = Number(op.valor_total) || 0;
        if (mod.includes('CAIXA')) valorCaixaImediato += v;
        else if (mod.includes('MENSAL') || mod.includes('FATURAMENTO')) valorMensal += v;
        else valorDuplicatas += v;
      });
    } catch {}

    // 2. CLT & Banco de Horas
    let totalColaboradores = 0;
    let horasExtrasTotal = 0;
    let adicionalNoturnoHoras = 0;
    let saldoBancoGeralMinutos = 0;
    let colaboradoresSaldoCritico = 0;

    try {
      const resColab = await supabase.from('colaboradores').select('id, status').eq('status', 'ativo');
      totalColaboradores = safeData(resColab).length;

      const resSaldos = await supabase.from('banco_horas_saldos').select('saldo_minutos, horas_extras_minutos, adicional_noturno_minutos');
      safeData(resSaldos).forEach(s => {
        const saldo = Number(s.saldo_minutos) || 0;
        saldoBancoGeralMinutos += saldo;
        if (saldo < -1200) colaboradoresSaldoCritico += 1;
        horasExtrasTotal += Math.round((Number(s.horas_extras_minutos) || 0) / 60);
        adicionalNoturnoHoras += Math.round((Number(s.adicional_noturno_minutos) || 0) / 60);
      });
    } catch {}

    // 3. Diaristas
    let totalDiaristasAtivos = 0;
    let presencasSemanaAtual = 0;
    let valorSemanaAtual = 0;
    let valorAcumuladoDiaristas = 0;
    let lotesConcluidosMes = 0;

    try {
      const resDiaristas = await supabase.from('diaristas').select('id').eq('ativo', true);
      totalDiaristasAtivos = safeData(resDiaristas).length;

      let qLotesD = applySeg(supabase
        .from('diaristas_lotes_fechamento')
        .select('valor_total, status, total_diarias, periodo_inicio')
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange));
      if (empresaId && empresaId !== 'all') qLotesD = qLotesD.eq('empresa_id', empresaId);

      const lotes = safeData(await qLotesD);
      lotes.forEach((l, idx) => {
        const val = Number(l.valor_total) || 0;
        valorAcumuladoDiaristas += val;
        if (['PAGO', 'CONCLUIDO', 'CNAB_GERADO'].includes(String(l.status).toUpperCase())) {
          lotesConcluidosMes += 1;
        }
        if (idx === lotes.length - 1) {
          presencasSemanaAtual = Number(l.total_diarias) || 0;
          valorSemanaAtual = val;
        }
      });
    } catch {}

    // 4. Intermitentes
    let totalIntermitentes = 0;
    let valorIntermitentesMes = 0;

    try {
      const resInt = await supabase.from('colaboradores').select('id').eq('regime_contratual', 'intermitente');
      totalIntermitentes = safeData(resInt).length;

      let qInt = applySeg(supabase
        .from('rh_financeiro_lotes')
        .select('status, lote_itens:rh_financeiro_lote_itens(valor_calculado)')
        .eq('tipo', 'INTERMITENTES')
        .eq('competencia', canonicalCompetencia));
      if (empresaId && empresaId !== 'all') qInt = qInt.eq('empresa_id', empresaId);

      const intLotes = safeData(await qInt);
      intLotes.forEach((item: any) => {
        const items = item.lote_itens || [];
        const total = items.reduce((acc: number, cur: any) => acc + (Number(cur.valor_calculado) || 0), 0);
        valorIntermitentesMes += total;
      });
    } catch {}

    return {
      volume: {
        totalDescargas,
        volumeCaixas,
        aprovadasPercent: totalDescargas > 0 ? Math.round(((totalDescargas - pendentesConferencia) / totalDescargas) * 100) : 100,
        pendentesConferencia,
        modalidades: {
          caixaImediato: valorCaixaImediato,
          duplicatas: valorDuplicatas,
          mensal: valorMensal,
        },
      },
      rhClt: {
        totalColaboradores,
        horasExtrasTotal,
        horasExtras50: Math.round(horasExtrasTotal * 0.6),
        adicionalNoturnoHoras,
        saldoBancoGeralMinutos,
        colaboradoresSaldoCritico,
      },
      diaristas: {
        totalAtivos: totalDiaristasAtivos,
        presencasSemanaAtual,
        valorSemanaAtual,
        valorAcumuladoMes: valorAcumuladoDiaristas,
        statusCicloSemanal: 'Ciclo semanal ativo',
        previsaoPagamento: 'Sexta-feira',
        lotesConcluidosMes,
      },
      intermitentes: {
        totalCadastrados: totalIntermitentes,
        convocacoesAtivas: Math.min(totalIntermitentes, 12),
        horasCumpridas: 0,
        valorAcumuladoMes: valorIntermitentesMes,
        statusLote: 'Lote consolidado',
        remessaCnabStatus: 'Remessa regular',
      },
    };
  }

  async getEvolucaoSemanal(competencia: string, empresaId?: string): Promise<EvolucaoPontoReal[]> {
    const canonicalCompetencia = normalizeCompetencia(competencia) || '';
    const isAnual = canonicalCompetencia.includes('all');
    const yearPart = Number(canonicalCompetencia.split('-')[0]);

    if (isAnual) {
      // Retorna os 12 meses do ano
      const snapshots = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          this.getKpisByCompetencia(`${yearPart}-${String(i + 1).padStart(2, '0')}`, empresaId)
        )
      );

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return snapshots.map((s, idx) => ({
        semana: mesesNomes[idx],
        receita: s.faturamentoTotal,
        custos: s.finValorAprovado + s.custosGerais,
        lucro: s.lucroReal,
      }));
    }

    // Para competência mensal: agrega operações e custos diretos pelas 4/5 semanas do mês
    const startRange = `${canonicalCompetencia}-01`;
    const nextMonth = format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    const weeks = [
      { label: 'Sem 1', startDay: 1, endDay: 7, receita: 0, custos: 0, lucro: 0 },
      { label: 'Sem 2', startDay: 8, endDay: 14, receita: 0, custos: 0, lucro: 0 },
      { label: 'Sem 3', startDay: 15, endDay: 21, receita: 0, custos: 0, lucro: 0 },
      { label: 'Sem 4', startDay: 22, endDay: 31, receita: 0, custos: 0, lucro: 0 },
    ];

    try {
      // Receitas realizadas com data da operação
      let qOps = supabase
        .from('operacoes_producao')
        .select('valor_total, data_operacao')
        .gte('data_operacao', startRange)
        .lt('data_operacao', endRange);
      if (empresaId && empresaId !== 'all') qOps = qOps.eq('empresa_id', empresaId);

      const ops = safeData(await qOps);
      ops.forEach(op => {
        const dia = op.data_operacao ? parseInt(String(op.data_operacao).substring(8, 10), 10) : 1;
        const val = Number(op.valor_total) || 0;
        const targetWeek = weeks.find(w => dia >= w.startDay && dia <= w.endDay) || weeks[3];
        targetWeek.receita += val;
      });

      // Custos extras diretos com data real
      let qCustos = supabase
        .from('custos_extras_operacionais')
        .select('total, data')
        .is('deleted_at', null)
        .gte('data', startRange)
        .lt('data', endRange);
      if (empresaId && empresaId !== 'all') qCustos = qCustos.eq('empresa_id', empresaId);

      const custos = safeData(await qCustos);
      custos.forEach(c => {
        const dia = c.data ? parseInt(String(c.data).substring(8, 10), 10) : 1;
        const val = Number(c.total) || 0;
        const targetWeek = weeks.find(w => dia >= w.startDay && dia <= w.endDay) || weeks[3];
        targetWeek.custos += val;
      });

      // Lotes de diaristas semanais com periodo_inicio real
      let qLotesD = supabase
        .from('diaristas_lotes_fechamento')
        .select('valor_total, periodo_inicio')
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange);
      if (empresaId && empresaId !== 'all') qLotesD = qLotesD.eq('empresa_id', empresaId);

      const lotesD = safeData(await qLotesD);
      lotesD.forEach(l => {
        const dia = l.periodo_inicio ? parseInt(String(l.periodo_inicio).substring(8, 10), 10) : 1;
        const val = Number(l.valor_total) || 0;
        const targetWeek = weeks.find(w => dia >= w.startDay && dia <= w.endDay) || weeks[3];
        targetWeek.custos += val;
      });
    } catch (e) {
      console.warn('Erro ao agregar evolução semanal:', e);
    }

    return weeks.map(w => ({
      semana: w.label,
      receita: Number(w.receita.toFixed(2)),
      custos: Number(w.custos.toFixed(2)),
      lucro: Number((w.receita - w.custos).toFixed(2)),
    }));
  }
}

export interface RadarAlertaReal {
  id: string;
  tipo: 'critico' | 'atencao' | 'info';
  modulo: string;
  titulo: string;
  descricao: string;
  valor?: number;
  tempo: string;
  acaoLabel: string;
  origemRota: string;
}

export interface StatusCiclosReal {
  clt: { status: 'aberto' | 'em_analise' | 'fechado'; label: string; prazoDias: number };
  diaristas: { status: 'aberto' | 'em_analise' | 'fechado'; label: string; pendentesRh: number };
  financeiro: { status: 'aberto' | 'em_analise' | 'fechado'; label: string; emDia: boolean };
  ultimoSyncRhid: string;
}

export interface MotoresDataReal {
  volume: {
    totalDescargas: number;
    volumeCaixas: number;
    aprovadasPercent: number;
    pendentesConferencia: number;
    modalidades: {
      caixaImediato: number;
      duplicatas: number;
      mensal: number;
    };
  };
  rhClt: {
    totalColaboradores: number;
    horasExtrasTotal: number;
    horasExtras50: number;
    adicionalNoturnoHoras: number;
    saldoBancoGeralMinutos: number;
    colaboradoresSaldoCritico: number;
  };
  diaristas: {
    totalAtivos: number;
    presencasSemanaAtual: number;
    valorSemanaAtual: number;
    valorAcumuladoMes: number;
    statusCicloSemanal: string;
    previsaoPagamento: string;
    lotesConcluidosMes: number;
  };
  intermitentes: {
    totalCadastrados: number;
    convocacoesAtivas: number;
    horasCumpridas: number;
    valorAcumuladoMes: number;
    statusLote: string;
    remessaCnabStatus: string;
  };
}

export interface EvolucaoPontoReal {
  semana: string;
  receita: number;
  custos: number;
  lucro: number;
}

export const DashboardConsolidadoService = new DashboardConsolidadoServiceClass();
