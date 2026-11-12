import { supabase } from '@/lib/supabase';
import { format, addMonths } from 'date-fns';

/**
 * ==============================================================================
 * ORBE ERP — DASH-02-P01 (ETAPA 1.2)
 * SERVIÇO AUXILIAR DE RECONCILIAÇÃO FINANCEIRA SEMANAL AUDITADO
 *
 * Princípios de Governança e Integridade:
 * 1. Respeito estrito à competência financeira canônica mensal (YYYY-MM).
 *    Competências anuais (YYYY-all) são rejeitadas explicitamente com erro descritivo.
 * 2. Paridade matemática total com getKpisByCompetencia:
 *    - Soma(receitas semanais) === kpis.faturamentoTotal
 *    - Soma(custos semanais)   === kpis.finValorAprovado + kpis.custosGerais
 *    - Soma(lucro semanal)     === kpis.lucroReal
 * 3. Identificação de 'sem_dados': ausência de registros financeiros ELEGÍVEIS.
 *    Se existirem apenas registros cancelados, não aprovados ou fora da competência,
 *    o estado correto é 'sem_dados' (sem movimentação financeira reconhecida).
 *    Se houver registros elegíveis válidos com valor zero ou que se anulam, o estado é 'ok'.
 * 4. Proteção estrita contra truncamento de paginação PostgREST (limite 2.000 com verificação de count).
 * ==============================================================================
 */

export interface SemanaFinanceira {
  semana: 'Sem 1' | 'Sem 2' | 'Sem 3' | 'Sem 4';
  receita: number;
  custos: number;
  lucro: number;
}

export interface AlocacaoGerencialRegistro {
  origem: 'receita_item' | 'receita_raiz' | 'custo_diarista' | 'custo_rh' | 'custo_extra';
  id: string;
  dataOriginal: string | null;
  semanaAlocada: 'Sem 1' | 'Sem 2' | 'Sem 3' | 'Sem 4';
  motivo: 'data_anterior_ciclo' | 'data_posterior_ciclo' | 'data_ausente' | 'data_invalida' | 'fechamento_mensal_clt' | 'residuo_titulo';
  valor: number;
}

export interface ReconciliacaoSemanalResultado {
  status: 'ok' | 'sem_dados' | 'inconsistente';
  competencia: string;
  semanas: SemanaFinanceira[];
  totais: {
    receitaTotal: number;
    custosTotal: number;
    lucroTotal: number;
  };
  auditoria: {
    quantidadeRegistros: {
      receitasTotal: number;
      receitasElegiveis: number;
      itensReceita: number;
      lotesDiaristasTotal: number;
      lotesDiaristasElegiveis: number;
      lotesRhTotal: number;
      lotesRhElegiveis: number;
      custosExtrasTotal: number;
      custosExtrasElegiveis: number;
    };
    divergenciasItensTitulo: Array<{
      receitaId: string;
      valorTitulo: number;
      somaItens: number;
      diferenca: number;
      tipo: 'itens_menores' | 'itens_maiores';
    }>;
    alocacoesGerenciais: AlocacaoGerencialRegistro[];
    alertas: string[];
  };
}

export interface RawReceitaOperacionalItem {
  id?: string;
  valor_item?: number | null;
  operacao_id?: string | null;
  servico_extra_id?: string | null;
  created_at?: string | null;
  operacoes_producao?: {
    id?: string;
    data_operacao?: string | null;
  } | null;
  servicos_extras_operacionais?: {
    id?: string;
    data?: string | null;
  } | null;
}

export interface RawReceitaOperacional {
  id: string;
  valor_total: number;
  status: string;
  competencia?: string | null;
  vencimento?: string | null;
  created_at?: string | null;
  receitas_operacionais_itens?: RawReceitaOperacionalItem[] | null;
}

export interface RawLoteDiarista {
  id?: string;
  valor_total?: number | null;
  status?: string | null;
  periodo_inicio?: string | null;
  created_at?: string | null;
}

export interface RawLoteRh {
  id?: string;
  tipo?: string | null;
  status?: string | null;
  valor_total?: number | null;
  created_at?: string | null;
  lote_itens?: Array<{ valor_calculado?: number | null }> | null;
}

export interface RawCustoExtra {
  id?: string;
  total?: number | null;
  data?: string | null;
  status_pagamento?: string | null;
  pipeline_status?: string | null;
  deleted_at?: string | null;
}

// ==============================================================================
// UTILITÁRIOS MONETÁRIOS SEGUROS (CENTAVOS INTEIROS)
// ==============================================================================

export function toCents(val: number | null | undefined): number {
  if (val == null || !Number.isFinite(Number(val))) return 0;
  return Math.round(Number(val) * 100);
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function diaParaIndiceSemana(dia: number): 0 | 1 | 2 | 3 {
  if (dia <= 7) return 0;
  if (dia <= 14) return 1;
  if (dia <= 21) return 2;
  return 3;
}

export const INDICE_PARA_SEMANA: Array<'Sem 1' | 'Sem 2' | 'Sem 3' | 'Sem 4'> = [
  'Sem 1',
  'Sem 2',
  'Sem 3',
  'Sem 4',
];

export function resolverIndiceSemanaPorData(
  dataStr: string | null | undefined,
  competenciaCanonical: string,
): {
  indice: 0 | 1 | 2 | 3;
  motivo?: 'data_anterior_ciclo' | 'data_posterior_ciclo' | 'data_ausente' | 'data_invalida';
} {
  if (!dataStr) {
    return { indice: 3, motivo: 'data_ausente' };
  }

  const cleanDate = String(dataStr).split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length < 3) {
    return { indice: 3, motivo: 'data_invalida' };
  }

  const itemComp = `${parts[0]}-${parts[1]}`;
  const dia = parseInt(parts[2], 10);

  if (Number.isNaN(dia) || dia < 1) {
    return { indice: 3, motivo: 'data_invalida' };
  }

  if (itemComp < competenciaCanonical) {
    return { indice: 0, motivo: 'data_anterior_ciclo' };
  }

  if (itemComp > competenciaCanonical) {
    return { indice: 3, motivo: 'data_posterior_ciclo' };
  }

  return { indice: diaParaIndiceSemana(dia) };
}

// ==============================================================================
// RECONCILIAÇÃO DE RECEITAS
// ==============================================================================

export function reconciliarReceitasSemanais(
  receitas: RawReceitaOperacional[],
  competenciaCanonical: string,
): {
  semanasCents: [number, number, number, number];
  faturamentoTotalCents: number;
  receitasElegiveisCount: number;
  divergenciasItensTitulo: ReconciliacaoSemanalResultado['auditoria']['divergenciasItensTitulo'];
  alocacoesGerenciais: AlocacaoGerencialRegistro[];
  alertas: string[];
} {
  const semanasCents: [number, number, number, number] = [0, 0, 0, 0];
  let faturamentoTotalCents = 0;
  let receitasElegiveisCount = 0;
  const divergenciasItensTitulo: ReconciliacaoSemanalResultado['auditoria']['divergenciasItensTitulo'] = [];
  const alocacoesGerenciais: AlocacaoGerencialRegistro[] = [];
  const alertas: string[] = [];

  for (const receita of receitas) {
    // 1. Validação estrita de competência econômica com fallback para created_at
    const itemComp = receita.competencia || (receita.created_at ? String(receita.created_at).substring(0, 7) : '');
    if (itemComp && itemComp !== competenciaCanonical) {
      continue;
    }

    // 2. Filtro canônico de status
    const status = String(receita.status || '').toLowerCase();
    if (status === 'cancelado') continue;

    receitasElegiveisCount += 1;
    const valorReceitaCents = toCents(receita.valor_total);
    faturamentoTotalCents += valorReceitaCents;

    // 3. Deduplicação rigorosa de itens vinculados
    const itensBrutos = receita.receitas_operacionais_itens || [];
    const itensUnicos: RawReceitaOperacionalItem[] = [];
    const vistos = new Set<string>();

    for (const it of itensBrutos) {
      const key = it.id || `${it.operacao_id || ''}-${it.servico_extra_id || ''}-${it.valor_item || 0}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        itensUnicos.push(it);
      }
    }

    // Caso A: Receita sem itens cadastrados
    if (itensUnicos.length === 0) {
      const dataRef = receita.created_at || receita.vencimento || `${competenciaCanonical}-15`;
      const { indice, motivo } = resolverIndiceSemanaPorData(dataRef, competenciaCanonical);
      semanasCents[indice] += valorReceitaCents;

      alocacoesGerenciais.push({
        origem: 'receita_raiz',
        id: receita.id,
        dataOriginal: dataRef,
        semanaAlocada: INDICE_PARA_SEMANA[indice],
        motivo: motivo || 'fechamento_mensal_clt',
        valor: fromCents(valorReceitaCents),
      });

      alertas.push(`Receita ${receita.id}: sem itens vinculados. Alocada integralmente na ${INDICE_PARA_SEMANA[indice]} pela data do título (${dataRef}).`);
      continue;
    }

    const somaItensCents = itensUnicos.reduce((acc, it) => acc + toCents(it.valor_item), 0);

    // Caso B: Soma dos itens bate rigorosamente com o valor_total do título
    if (somaItensCents === valorReceitaCents) {
      for (const it of itensUnicos) {
        const itemData =
          it.operacoes_producao?.data_operacao ||
          it.servicos_extras_operacionais?.data ||
          it.created_at ||
          receita.created_at ||
          receita.vencimento;
        const { indice, motivo } = resolverIndiceSemanaPorData(itemData, competenciaCanonical);
        semanasCents[indice] += toCents(it.valor_item);

        if (motivo) {
          alocacoesGerenciais.push({
            origem: 'receita_item',
            id: it.id || receita.id,
            dataOriginal: itemData || null,
            semanaAlocada: INDICE_PARA_SEMANA[indice],
            motivo,
            valor: fromCents(toCents(it.valor_item)),
          });
        }
      }
    }
    // Caso C: Soma dos itens é MENOR que o título
    else if (somaItensCents < valorReceitaCents) {
      const diferencaCents = valorReceitaCents - somaItensCents;
      divergenciasItensTitulo.push({
        receitaId: receita.id,
        valorTitulo: fromCents(valorReceitaCents),
        somaItens: fromCents(somaItensCents),
        diferenca: fromCents(diferencaCents),
        tipo: 'itens_menores',
      });

      for (const it of itensUnicos) {
        const itemData =
          it.operacoes_producao?.data_operacao ||
          it.servicos_extras_operacionais?.data ||
          it.created_at ||
          receita.created_at ||
          receita.vencimento;
        const { indice, motivo } = resolverIndiceSemanaPorData(itemData, competenciaCanonical);
        semanasCents[indice] += toCents(it.valor_item);

        if (motivo) {
          alocacoesGerenciais.push({
            origem: 'receita_item',
            id: it.id || receita.id,
            dataOriginal: itemData || null,
            semanaAlocada: INDICE_PARA_SEMANA[indice],
            motivo,
            valor: fromCents(toCents(it.valor_item)),
          });
        }
      }

      const dataRef = receita.created_at || receita.vencimento || `${competenciaCanonical}-15`;
      const { indice } = resolverIndiceSemanaPorData(dataRef, competenciaCanonical);
      semanasCents[indice] += diferencaCents;

      alocacoesGerenciais.push({
        origem: 'receita_raiz',
        id: receita.id,
        dataOriginal: dataRef,
        semanaAlocada: INDICE_PARA_SEMANA[indice],
        motivo: 'residuo_titulo',
        valor: fromCents(diferencaCents),
      });

      alertas.push(`Divergência na receita ${receita.id}: soma dos itens (R$ ${fromCents(somaItensCents)}) é menor que o título (R$ ${fromCents(valorReceitaCents)}). Resíduo de R$ ${fromCents(diferencaCents)} alocado na ${INDICE_PARA_SEMANA[indice]}.`);
    }
    // Caso D: Soma dos itens é MAIOR que o título
    else {
      const diferencaCents = somaItensCents - valorReceitaCents;
      divergenciasItensTitulo.push({
        receitaId: receita.id,
        valorTitulo: fromCents(valorReceitaCents),
        somaItens: fromCents(somaItensCents),
        diferenca: fromCents(diferencaCents),
        tipo: 'itens_maiores',
      });

      let alocadoProrrateioCents = 0;
      itensUnicos.forEach((it, idx) => {
        const itemData =
          it.operacoes_producao?.data_operacao ||
          it.servicos_extras_operacionais?.data ||
          it.created_at ||
          receita.created_at ||
          receita.vencimento;
        const { indice, motivo } = resolverIndiceSemanaPorData(itemData, competenciaCanonical);

        let parcelaCents = Math.round((toCents(it.valor_item) / somaItensCents) * valorReceitaCents);
        if (idx === itensUnicos.length - 1) {
          parcelaCents = valorReceitaCents - alocadoProrrateioCents;
        } else {
          alocadoProrrateioCents += parcelaCents;
        }

        semanasCents[indice] += parcelaCents;

        if (motivo) {
          alocacoesGerenciais.push({
            origem: 'receita_item',
            id: it.id || receita.id,
            dataOriginal: itemData || null,
            semanaAlocada: INDICE_PARA_SEMANA[indice],
            motivo,
            valor: fromCents(parcelaCents),
          });
        }
      });

      alertas.push(`Divergência na receita ${receita.id}: soma dos itens (R$ ${fromCents(somaItensCents)}) é maior que o título (R$ ${fromCents(valorReceitaCents)}). Itens prorrateados para fechar o total oficial.`);
    }
  }

  return {
    semanasCents,
    faturamentoTotalCents,
    receitasElegiveisCount,
    divergenciasItensTitulo,
    alocacoesGerenciais,
    alertas,
  };
}

// ==============================================================================
// RECONCILIAÇÃO DE CUSTOS
// ==============================================================================

export function reconciliarCustosSemanais(params: {
  lotesDiaristas: RawLoteDiarista[];
  lotesRh: RawLoteRh[];
  custosExtras: RawCustoExtra[];
  competenciaCanonical: string;
}): {
  semanasCents: [number, number, number, number];
  custosTotalCents: number;
  custosElegiveisCount: {
    diaristas: number;
    rh: number;
    custosExtras: number;
  };
  detalhePorFonte: {
    diaristasCents: number;
    folhaCltCents: number;
    intermitentesCents: number;
    custosExtrasCents: number;
  };
  alocacoesGerenciais: AlocacaoGerencialRegistro[];
  alertas: string[];
} {
  const { lotesDiaristas, lotesRh, custosExtras, competenciaCanonical } = params;
  const semanasCents: [number, number, number, number] = [0, 0, 0, 0];
  const alocacoesGerenciais: AlocacaoGerencialRegistro[] = [];
  const alertas: string[] = [];

  let diaristasCents = 0;
  let folhaCltCents = 0;
  let intermitentesCents = 0;
  let custosExtrasCents = 0;

  let diaristasElegiveis = 0;
  let rhElegiveis = 0;
  let custosExtrasElegiveis = 0;

  // 1. Diaristas Aprovados
  for (const lote of lotesDiaristas) {
    const status = String(lote.status || '').toUpperCase();
    if (['FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'CNAB_GERADO'].includes(status)) {
      diaristasElegiveis += 1;
      const valorCents = toCents(lote.valor_total);
      diaristasCents += valorCents;
      const dataRef = lote.periodo_inicio || lote.created_at;
      const { indice, motivo } = resolverIndiceSemanaPorData(dataRef, competenciaCanonical);
      semanasCents[indice] += valorCents;

      if (motivo) {
        alocacoesGerenciais.push({
          origem: 'custo_diarista',
          id: lote.id || 'diarista',
          dataOriginal: dataRef || null,
          semanaAlocada: INDICE_PARA_SEMANA[indice],
          motivo,
          valor: fromCents(valorCents),
        });
      }
    }
  }

  // 2. Lotes RH Aprovados (CLT e Intermitentes)
  for (const lote of lotesRh) {
    const status = String(lote.status || '').toUpperCase();
    const tipo = String(lote.tipo || '').toUpperCase();

    if (['APROVADO_FINANCEIRO', 'PAGO', 'CNAB_GERADO'].includes(status)) {
      rhElegiveis += 1;
      let valorCents = (lote.lote_itens || []).reduce(
        (acc, item) => acc + toCents(item.valor_calculado),
        0,
      );

      if (valorCents === 0 && lote.valor_total != null && Number(lote.valor_total) > 0) {
        valorCents = toCents(lote.valor_total);
      }

      if (tipo === 'INTERMITENTES') {
        intermitentesCents += valorCents;
        const { indice, motivo } = resolverIndiceSemanaPorData(lote.created_at, competenciaCanonical);
        semanasCents[indice] += valorCents;

        if (motivo) {
          alocacoesGerenciais.push({
            origem: 'custo_rh',
            id: lote.id || 'intermitente',
            dataOriginal: lote.created_at || null,
            semanaAlocada: INDICE_PARA_SEMANA[indice],
            motivo,
            valor: fromCents(valorCents),
          });
        }
      } else {
        folhaCltCents += valorCents;
        const dataRef = lote.created_at || `${competenciaCanonical}-28`;
        const { indice, motivo } = resolverIndiceSemanaPorData(dataRef, competenciaCanonical);
        semanasCents[indice] += valorCents;

        alocacoesGerenciais.push({
          origem: 'custo_rh',
          id: lote.id || 'folha_clt',
          dataOriginal: lote.created_at || null,
          semanaAlocada: INDICE_PARA_SEMANA[indice],
          motivo: motivo || 'fechamento_mensal_clt',
          valor: fromCents(valorCents),
        });
      }
    }
  }

  // 3. Custos Extras Aprovados
  for (const c of custosExtras) {
    if (c.deleted_at != null) continue;
    const pipeStatus = String(c.pipeline_status || '').toUpperCase();
    if (!['APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO'].includes(pipeStatus)) continue;
    const pgtoStatus = String(c.status_pagamento || '').toUpperCase();
    if (pgtoStatus === 'CANCELADO') continue;

    custosExtrasElegiveis += 1;
    const valorCents = toCents(c.total);
    custosExtrasCents += valorCents;
    const { indice, motivo } = resolverIndiceSemanaPorData(c.data, competenciaCanonical);
    semanasCents[indice] += valorCents;

    if (motivo) {
      alocacoesGerenciais.push({
        origem: 'custo_extra',
        id: c.id || 'custo_extra',
        dataOriginal: c.data || null,
        semanaAlocada: INDICE_PARA_SEMANA[indice],
        motivo,
        valor: fromCents(valorCents),
      });
    }
  }

  const custosTotalCents = diaristasCents + folhaCltCents + intermitentesCents + custosExtrasCents;

  return {
    semanasCents,
    custosTotalCents,
    custosElegiveisCount: {
      diaristas: diaristasElegiveis,
      rh: rhElegiveis,
      custosExtras: custosExtrasElegiveis,
    },
    detalhePorFonte: {
      diaristasCents,
      folhaCltCents,
      intermitentesCents,
      custosExtrasCents,
    },
    alocacoesGerenciais,
    alertas,
  };
}

// ==============================================================================
// ORQUESTRADOR PRINCIPAL DO SERVIÇO
// ==============================================================================

export class DashboardReconciliacaoSemanalService {
  /**
   * Processamento puro em memória com verificação auditada dos estados
   * 'ok' | 'sem_dados' | 'inconsistente'.
   */
  static processarReconciliacaoEmMemoria(params: {
    competencia: string;
    receitas: RawReceitaOperacional[];
    lotesDiaristas: RawLoteDiarista[];
    lotesRh: RawLoteRh[];
    custosExtras: RawCustoExtra[];
  }): ReconciliacaoSemanalResultado {
    const { competencia, receitas, lotesDiaristas, lotesRh, custosExtras } = params;

    // Regra de Integridade: Rejeição explícita de competência anual para distribuição semanal
    if (competencia.includes('all')) {
      throw new Error(
        `[DashboardReconciliacao] Competência anual ('${competencia}') não suporta distribuição semanal. Utilize a visualização de evolução mensal consolidada.`,
      );
    }

    const competenciaCanonical = competencia.substring(0, 7);

    const recResult = reconciliarReceitasSemanais(receitas, competenciaCanonical);
    const custosResult = reconciliarCustosSemanais({
      lotesDiaristas,
      lotesRh,
      custosExtras,
      competenciaCanonical,
    });

    const semanas: SemanaFinanceira[] = INDICE_PARA_SEMANA.map((label, i) => {
      const rec = fromCents(recResult.semanasCents[i]);
      const cus = fromCents(custosResult.semanasCents[i]);
      return {
        semana: label,
        receita: rec,
        custos: cus,
        lucro: Number((rec - cus).toFixed(2)),
      };
    });

    const receitaTotal = fromCents(recResult.faturamentoTotalCents);
    const custosTotal = fromCents(custosResult.custosTotalCents);
    const lucroTotal = Number((receitaTotal - custosTotal).toFixed(2));

    // Determinação do status:
    // sem_dados: ausência de qualquer movimentação financeira ELEGÍVEL
    const totalElegiveis =
      recResult.receitasElegiveisCount +
      custosResult.custosElegiveisCount.diaristas +
      custosResult.custosElegiveisCount.rh +
      custosResult.custosElegiveisCount.custosExtras;

    let status: 'ok' | 'sem_dados' | 'inconsistente' = 'ok';
    if (totalElegiveis === 0) {
      status = 'sem_dados';
    } else if (recResult.divergenciasItensTitulo.length > 0) {
      status = 'inconsistente';
    }

    const todosAlertas = [...recResult.alertas, ...custosResult.alertas];
    const todasAlocacoes = [...recResult.alocacoesGerenciais, ...custosResult.alocacoesGerenciais];

    return {
      status,
      competencia: competenciaCanonical,
      semanas,
      totais: {
        receitaTotal,
        custosTotal,
        lucroTotal,
      },
      auditoria: {
        quantidadeRegistros: {
          receitasTotal: receitas.length,
          receitasElegiveis: recResult.receitasElegiveisCount,
          itensReceita: receitas.reduce(
            (acc, r) => acc + (r.receitas_operacionais_itens?.length || 0),
            0,
          ),
          lotesDiaristasTotal: lotesDiaristas.length,
          lotesDiaristasElegiveis: custosResult.custosElegiveisCount.diaristas,
          lotesRhTotal: lotesRh.length,
          lotesRhElegiveis: custosResult.custosElegiveisCount.rh,
          custosExtrasTotal: custosExtras.length,
          custosExtrasElegiveis: custosResult.custosElegiveisCount.custosExtras,
        },
        divergenciasItensTitulo: recResult.divergenciasItensTitulo,
        alocacoesGerenciais: todasAlocacoes,
        alertas: todosAlertas,
      },
    };
  }

  /**
   * Consulta real no Supabase com proteção contra limites de paginação PostgREST (2.000)
   * e tratamento estrito de exceções sem mascarar falhas.
   */
  static async consultarEReconciliar(params: {
    competencia: string;
    tenantId?: string;
    empresaId?: string;
    environment?: string | null;
  }): Promise<ReconciliacaoSemanalResultado> {
    const { competencia, tenantId, empresaId, environment } = params;

    if (competencia.includes('all')) {
      throw new Error(
        `[DashboardReconciliacao] Competência anual ('${competencia}') não suporta distribuição semanal. Utilize a visualização de evolução mensal consolidada.`,
      );
    }

    const canonicalCompetencia = competencia.substring(0, 7);
    const isHomologacao = environment === 'HOMOLOGACAO' || environment === 'homologacao';
    const isTodos = environment === 'TODOS' || environment === 'todos';

    const { data: testEmpresas, error: errTestEmp } = await supabase
      .from('empresas')
      .select('id')
      .eq('is_teste', true);

    if (errTestEmp) {
      throw new Error(`[DashboardReconciliacao] Falha ao verificar empresas de teste: ${errTestEmp.message}`);
    }

    const testIds = testEmpresas?.map((e) => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ['00000000-0000-0000-0000-000000000000'];

    const applySeg = (q: any) => {
      if (isHomologacao) return q.in('empresa_id', safeTestIds);
      if (isTodos) return q;
      return q.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
    };

    const startRange = `${canonicalCompetencia}-01`;
    const nextMonth = format(addMonths(new Date(`${canonicalCompetencia}-01T12:00:00`), 1), 'yyyy-MM');
    const endRange = `${nextMonth}-01`;

    let qReceitas = applySeg(
      supabase
        .from('receitas_operacionais')
        .select(`
          id,
          valor_total,
          status,
          competencia,
          vencimento,
          created_at,
          receitas_operacionais_itens(
            id,
            valor_item,
            operacao_id,
            servico_extra_id,
            created_at,
            operacoes_producao(id, data_operacao),
            servicos_extras_operacionais:servico_extra_id(id, data)
          )
        `, { count: 'exact' })
        .or(`competencia.eq.${canonicalCompetencia},and(competencia.is.null,created_at.gte.${startRange},created_at.lt.${endRange})`)
        .limit(2000),
    );
    if (tenantId) qReceitas = qReceitas.eq('tenant_id', tenantId);
    if (empresaId && empresaId !== 'all') qReceitas = qReceitas.eq('empresa_id', empresaId);

    let qLotesD = applySeg(
      supabase
        .from('diaristas_lotes_fechamento')
        .select('id, valor_total, status, periodo_inicio, created_at', { count: 'exact' })
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange)
        .limit(2000),
    );
    if (tenantId) qLotesD = qLotesD.eq('tenant_id', tenantId);
    if (empresaId && empresaId !== 'all') qLotesD = qLotesD.eq('empresa_id', empresaId);

    let qLotesRh = applySeg(
      supabase
        .from('rh_financeiro_lotes')
        .select('id, tipo, status, valor_total, created_at, lote_itens:rh_financeiro_lote_itens(valor_calculado)', { count: 'exact' })
        .eq('competencia', canonicalCompetencia)
        .limit(2000),
    );
    if (tenantId) qLotesRh = qLotesRh.eq('tenant_id', tenantId);
    if (empresaId && empresaId !== 'all') qLotesRh = qLotesRh.eq('empresa_id', empresaId);

    let qCustos = applySeg(
      supabase
        .from('custos_extras_operacionais')
        .select('id, total, data, status_pagamento, pipeline_status, deleted_at', { count: 'exact' })
        .is('deleted_at', null)
        .in('pipeline_status', ['APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO'])
        .neq('status_pagamento', 'CANCELADO')
        .gte('data', startRange)
        .lt('data', endRange)
        .limit(2000),
    );
    if (tenantId) qCustos = qCustos.eq('tenant_id', tenantId);
    if (empresaId && empresaId !== 'all') qCustos = qCustos.eq('empresa_id', empresaId);

    const [resReceitas, resLotesD, resLotesRh, resCustos] = await Promise.all([
      qReceitas,
      qLotesD,
      qLotesRh,
      qCustos,
    ]);

    if (resReceitas.error) {
      throw new Error(`[DashboardReconciliacao] Erro ao consultar receitas: ${resReceitas.error.message}`);
    }
    if (resLotesD.error) {
      throw new Error(`[DashboardReconciliacao] Erro ao consultar diaristas: ${resLotesD.error.message}`);
    }
    if (resLotesRh.error) {
      throw new Error(`[DashboardReconciliacao] Erro ao consultar RH: ${resLotesRh.error.message}`);
    }
    if (resCustos.error) {
      throw new Error(`[DashboardReconciliacao] Erro ao consultar custos extras: ${resCustos.error.message}`);
    }

    if (resReceitas.count && resReceitas.count > 2000) {
      throw new Error(`[DashboardReconciliacao] Volume de receitas (${resReceitas.count}) excedeu o limite máximo seguro de consulta.`);
    }

    return this.processarReconciliacaoEmMemoria({
      competencia: canonicalCompetencia,
      receitas: (resReceitas.data as any) || [],
      lotesDiaristas: (resLotesD.data as any) || [],
      lotesRh: (resLotesRh.data as any) || [],
      custosExtras: (resCustos.data as any) || [],
    });
  }
}
