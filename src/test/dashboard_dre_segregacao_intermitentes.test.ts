import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { DashboardConsolidadoService } from '@/services/dashboard.service';

describe('SEGREGAÇÃO GERENCIAL CLT × INTERMITENTES × DIARISTAS — DASHBOARD / DRE', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Helper para simular queries do supabase para getKpisByCompetencia
  function createChainableQuery(data: any = []) {
    const chain: any = {};
    const methods = [
      'select', 'gte', 'lt', 'or', 'in', 'is', 'neq', 'eq', 
      'maybeSingle', 'single', 'order', 'limit'
    ];
    methods.forEach((m) => {
      chain[m] = vi.fn().mockImplementation(() => chain);
    });
    chain.then = (resolve: any) => resolve({ data, error: null });
    return chain;
  }

  function mockDashboardQueries(params: {
    lotesRh?: Array<{ tipo: string; status: string; lote_itens: Array<{ valor_calculado: number }> }>;
    lotesDiaristas?: Array<{ valor_total: number; status: string; periodo_inicio: string }>;
    receitas?: Array<{ valor_total: number; status: string }>;
    custos?: Array<{ total: number; status_pagamento: string; pipeline_status: string }>;
    cnabArquivos?: Array<{ total_valor: number; status: string; competencia: string }>;
    cnabLotes?: Array<{ valor_total: number; status: string }>;
    retornoItens?: Array<{ valor_retornado: number; status: string; remessa_arquivo: { competencia: string } }>;
  }) {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'empresas') return createChainableQuery([]);
      if (table === 'contas_bancarias_empresa') return createChainableQuery([]);
      if (table === 'receitas_operacionais') return createChainableQuery(params.receitas || []);
      if (table === 'diaristas_lotes_fechamento') return createChainableQuery(params.lotesDiaristas || []);
      if (table === 'rh_financeiro_lotes') return createChainableQuery(params.lotesRh || []);
      if (table === 'lotes_remessa') return createChainableQuery(params.cnabLotes || []);
      if (table === 'cnab_remessas_arquivos') return createChainableQuery(params.cnabArquivos || []);
      if (table === 'cnab_retorno_itens') return createChainableQuery(params.retornoItens || []);
      if (table === 'custos_extras_operacionais') return createChainableQuery(params.custos || []);
      if (table === 'servicos_extras_operacionais') return createChainableQuery([]);
      return createChainableQuery([]);
    });
  }

  // Caso A — somente Intermitentes
  it('Caso A — Somente Intermitentes: folhaFlow=0, intermitenteFlow=570, diaristaFlow=0, finValorAprovado=570', async () => {
    mockDashboardQueries({
      lotesRh: [
        {
          tipo: 'INTERMITENTES',
          status: 'PAGO',
          lote_itens: [
            { valor_calculado: 240 },
            { valor_calculado: 330 },
          ],
        },
      ],
      lotesDiaristas: [],
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

    expect(kpis.folhaValorAprovado).toBe(0);
    expect(kpis.intermitentesValorAprovado).toBe(570);
    expect(kpis.diaristasValorAprovado).toBe(0);
    expect(kpis.finValorAprovado).toBe(570);
    expect(kpis.flows?.folha.finAprovado).toBe(0);
    expect(kpis.flows?.intermitente.finAprovado).toBe(570);
    expect(kpis.flows?.diarista.finAprovado).toBe(0);
    expect(kpis.fluxosPresentes).toContain('intermitente');
    expect(kpis.fluxosPresentes).not.toContain('folha_variavel');
  });

  // Caso B — CLT + Intermitentes (prova de não-duplicação: 1000 + 570 = 1570, NUNCA 2140)
  it('Caso B — CLT + Intermitentes: folhaFlow=1000, intermitenteFlow=570, finValorAprovado=1570 (nunca 2140)', async () => {
    mockDashboardQueries({
      lotesRh: [
        {
          tipo: 'FOLHA',
          status: 'PAGO',
          lote_itens: [{ valor_calculado: 1000 }],
        },
        {
          tipo: 'INTERMITENTES',
          status: 'PAGO',
          lote_itens: [{ valor_calculado: 570 }],
        },
      ],
      lotesDiaristas: [],
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

    expect(kpis.folhaValorAprovado).toBe(1000);
    expect(kpis.intermitentesValorAprovado).toBe(570);
    expect(kpis.diaristasValorAprovado).toBe(0);
    expect(kpis.finValorAprovado).toBe(1570);
    expect(kpis.finValorAprovado).not.toBe(2140);
    expect(kpis.fluxosPresentes).toContain('folha_variavel');
    expect(kpis.fluxosPresentes).toContain('intermitente');
  });

  // Caso C — CLT + Intermitentes + Diaristas (total = CLT + Intermitentes + Diaristas)
  it('Caso C — CLT + Intermitentes + Diaristas: TOTAL = CLT + INTERMITENTES + DIARISTAS exatamente uma vez', async () => {
    mockDashboardQueries({
      lotesRh: [
        {
          tipo: 'FOLHA',
          status: 'PAGO',
          lote_itens: [{ valor_calculado: 1200 }],
        },
        {
          tipo: 'INTERMITENTES',
          status: 'PAGO',
          lote_itens: [{ valor_calculado: 570 }],
        },
      ],
      lotesDiaristas: [
        {
          valor_total: 450,
          status: 'PAGO',
          periodo_inicio: '2026-10-01',
        },
      ],
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

    const expectedTotal = 1200 + 570 + 450; // 2220
    expect(kpis.folhaValorAprovado).toBe(1200);
    expect(kpis.intermitentesValorAprovado).toBe(570);
    expect(kpis.diaristasValorAprovado).toBe(450);
    expect(kpis.finValorAprovado).toBe(expectedTotal);
    expect(kpis.finValorAprovado).toBe(
      kpis.folhaValorAprovado + kpis.intermitentesValorAprovado + kpis.diaristasValorAprovado
    );
  });

  // Caso D — Invariância do Lucro e Margem no Consolidado Anual e Mensal
  it('Caso D — Invariância do Lucro e Agregação Anual preserva estritamente a soma das 3 partes', async () => {
    mockDashboardQueries({
      receitas: [{ valor_total: 5000, status: 'recebido' }],
      custos: [{ total: 300, status_pagamento: 'PAGO', pipeline_status: 'FINALIZADO' }],
      lotesRh: [
        {
          tipo: 'INTERMITENTES',
          status: 'PAGO',
          lote_itens: [{ valor_calculado: 570 }],
        },
      ],
      lotesDiaristas: [],
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

    // faturamento = 5000, maoDeObra = 570 (intermitente), custos = 300 -> lucroReal = 5000 - 570 - 300 = 4130
    expect(kpis.faturamentoTotal).toBe(5000);
    expect(kpis.finValorAprovado).toBe(570);
    expect(kpis.custosGerais).toBe(300);
    expect(kpis.lucroReal).toBe(4130);
    expect(kpis.intermitentesValorAprovado).toBe(570);
    expect(kpis.folhaValorAprovado).toBe(0);
    expect(kpis.diaristasValorAprovado).toBe(0);
  });

  // Caso E — Preservação de tipo desconhecido/nulo que permanece como folhaFlow (CLT)
  it('Caso E — Tipo nulo ou não-intermitente cai legitimamente em folhaFlow (CLT preservado)', async () => {
    mockDashboardQueries({
      lotesRh: [
        {
          tipo: '',
          status: 'APROVADO_FINANCEIRO',
          lote_itens: [{ valor_calculado: 800 }],
        },
      ],
      lotesDiaristas: [],
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

    expect(kpis.folhaValorAprovado).toBe(800);
    expect(kpis.intermitentesValorAprovado).toBe(0);
    expect(kpis.finValorAprovado).toBe(800);
    expect(kpis.fluxosPresentes).toContain('folha_variavel');
    expect(kpis.fluxosPresentes).not.toContain('intermitente');
  });

  // Caso F — Regressão Dashboard.tsx: Dashboard global NÃO passa tenantId como empresaId
  it('Caso F — Dashboard.tsx chama getKpisAggregate sem passar tenantId como empresaId', () => {
    const dashboardPath = path.resolve(__dirname, '../pages/Dashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // Deve chamar sem o 3o argumento tenantId
    expect(content).toContain('DashboardConsolidadoService.getKpisAggregate(selectedYear, selectedMonthNumber)');
    // Não pode conter a chamada antiga com tenantId
    expect(content).not.toContain('DashboardConsolidadoService.getKpisAggregate(selectedYear, selectedMonthNumber, tenantId)');
  });

  // Caso G — getKpisAggregate sem empresaId NÃO filtra por empresa_id; com empresaId, filtra
  it('Caso G — getKpisAggregate preserva escopo global quando empresaId é omitido', async () => {
    const interceptedEqCalls: Array<[string, any]> = [];

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const chain: any = {};
      const methods = [
        'select', 'gte', 'lt', 'or', 'in', 'is', 'neq', 
        'maybeSingle', 'single', 'order', 'limit'
      ];
      methods.forEach((m) => {
        chain[m] = vi.fn().mockImplementation(() => chain);
      });
      chain.eq = vi.fn().mockImplementation((col: string, val: any) => {
        if (table === 'rh_financeiro_lotes') {
          interceptedEqCalls.push([col, val]);
        }
        return chain;
      });
      chain.then = (resolve: any) => resolve({ data: [], error: null });
      return chain;
    });

    // 1. Chamada global (sem empresaId)
    await DashboardConsolidadoService.getKpisAggregate('2026', '10');
    const empresaIdCallsSemEmpresa = interceptedEqCalls.filter(([col]) => col === 'empresa_id');
    expect(empresaIdCallsSemEmpresa.length).toBe(0);

    // 2. Chamada específica (com empresaId)
    interceptedEqCalls.length = 0;
    await DashboardConsolidadoService.getKpisAggregate('2026', '10', 'empresa-xyz');
    const empresaIdCallsComEmpresa = interceptedEqCalls.filter(([col]) => col === 'empresa_id');
    expect(empresaIdCallsComEmpresa.length).toBeGreaterThan(0);
    expect(empresaIdCallsComEmpresa[0][1]).toBe('empresa-xyz');
  });
});
