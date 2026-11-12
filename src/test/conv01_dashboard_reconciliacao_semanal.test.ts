import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toCents,
  fromCents,
  diaParaIndiceSemana,
  resolverIndiceSemanaPorData,
  reconciliarReceitasSemanais,
  reconciliarCustosSemanais,
  DashboardReconciliacaoSemanalService,
  RawReceitaOperacional,
  RawLoteDiarista,
  RawLoteRh,
  RawCustoExtra,
} from '@/services/dashboardReconciliacaoSemanal.service';
import { DashboardConsolidadoService } from '@/services/dashboard.service';
import { supabase } from '@/lib/supabase';

describe('DASH-02-P01 — Reconciliação Financeira Semanal (ETAPA 1.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Precisão monetária e conversões em centavos
  describe('1. Precisão Monetária em Centavos', () => {
    it('deve converter valores monetários em centavos sem perda por ponto flutuante', () => {
      expect(toCents(10.99)).toBe(1099);
      expect(toCents(0.1 + 0.2)).toBe(30);
      expect(toCents(1234567.89)).toBe(123456789);
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
    });

    it('deve converter centavos para reais formatados com 2 casas decimais', () => {
      expect(fromCents(1099)).toBe(10.99);
      expect(fromCents(30)).toBe(0.3);
      expect(fromCents(0)).toBe(0);
      expect(fromCents(10050)).toBe(100.5);
    });
  });

  // 2. Determinação de Semanas e Datas de Borda
  describe('2. Mapeamento de Semanas e Tratamento de Datas', () => {
    it('deve mapear os dias 01 a 07 para Semana 1 (índice 0)', () => {
      expect(diaParaIndiceSemana(1)).toBe(0);
      expect(diaParaIndiceSemana(7)).toBe(0);
    });

    it('deve mapear os dias 08 a 14 para Semana 2 (índice 1)', () => {
      expect(diaParaIndiceSemana(8)).toBe(1);
      expect(diaParaIndiceSemana(14)).toBe(1);
    });

    it('deve mapear os dias 15 a 21 para Semana 3 (índice 2)', () => {
      expect(diaParaIndiceSemana(15)).toBe(2);
      expect(diaParaIndiceSemana(21)).toBe(2);
    });

    it('deve mapear os dias 22 a 31 para Semana 4 (índice 3)', () => {
      expect(diaParaIndiceSemana(22)).toBe(3);
      expect(diaParaIndiceSemana(31)).toBe(3);
    });

    it('deve alocar datas anteriores à competência na Semana 1 com auditoria', () => {
      const res = resolverIndiceSemanaPorData('2026-09-30', '2026-10');
      expect(res.indice).toBe(0);
      expect(res.motivo).toBe('data_anterior_ciclo');
    });

    it('deve alocar datas posteriores à competência na Semana 4 com auditoria', () => {
      const res = resolverIndiceSemanaPorData('2026-11-02', '2026-10');
      expect(res.indice).toBe(3);
      expect(res.motivo).toBe('data_posterior_ciclo');
    });

    it('deve alocar datas nulas ou inválidas na Semana 4 com motivo rastreável', () => {
      expect(resolverIndiceSemanaPorData(null, '2026-10')).toEqual({ indice: 3, motivo: 'data_ausente' });
      expect(resolverIndiceSemanaPorData('', '2026-10')).toEqual({ indice: 3, motivo: 'data_ausente' });
      expect(resolverIndiceSemanaPorData('data-invalida', '2026-10')).toEqual({ indice: 3, motivo: 'data_invalida' });
    });
  });

  // 3. Reconciliação de Receitas Individuais
  describe('3. Reconciliação de Receitas Individuais (Duplicata e Caixa Imediato)', () => {
    it('deve distribuir receitas individuais pelas semanas e fechar 100% da soma', () => {
      const receitas: RawReceitaOperacional[] = [
        {
          id: 'rec-01',
          valor_total: 1500.5,
          status: 'faturado',
          competencia: '2026-10',
          created_at: '2026-10-03T10:00:00Z',
          receitas_operacionais_itens: [
            { id: 'it-1', valor_item: 1500.5, operacoes_producao: { data_operacao: '2026-10-03' } },
          ],
        },
        {
          id: 'rec-02',
          valor_total: 2400.0,
          status: 'pendente_recebimento',
          competencia: '2026-10',
          created_at: '2026-10-12T10:00:00Z',
          receitas_operacionais_itens: [
            { id: 'it-2', valor_item: 2400.0, operacoes_producao: { data_operacao: '2026-10-12' } },
          ],
        },
      ];

      const res = reconciliarReceitasSemanais(receitas, '2026-10');

      expect(fromCents(res.semanasCents[0])).toBe(1500.5);
      expect(fromCents(res.semanasCents[1])).toBe(2400.0);
      expect(fromCents(res.semanasCents[2])).toBe(0);
      expect(fromCents(res.semanasCents[3])).toBe(0);

      const somaSemanal = res.semanasCents.reduce((a, b) => a + b, 0);
      expect(somaSemanal).toBe(res.faturamentoTotalCents);
      expect(fromCents(res.faturamentoTotalCents)).toBe(3900.5);
    });

    it('deve ignorar receitas com status cancelado', () => {
      const receitas: RawReceitaOperacional[] = [
        {
          id: 'rec-cancelada',
          valor_total: 5000,
          status: 'cancelado',
          competencia: '2026-10',
          created_at: '2026-10-05T10:00:00Z',
        },
        {
          id: 'rec-ativa',
          valor_total: 2000,
          status: 'faturado',
          competencia: '2026-10',
          created_at: '2026-10-05T10:00:00Z',
        },
      ];

      const res = reconciliarReceitasSemanais(receitas, '2026-10');
      expect(fromCents(res.faturamentoTotalCents)).toBe(2000);
      expect(fromCents(res.semanasCents[0])).toBe(2000);
      expect(res.receitasElegiveisCount).toBe(1);
    });

    it('deve descartar em memória receitas que pertencem a outra competência', () => {
      const receitas: RawReceitaOperacional[] = [
        {
          id: 'rec-setembro',
          valor_total: 5000,
          status: 'faturado',
          competencia: '2026-09',
          created_at: '2026-10-02T10:00:00Z',
        },
        {
          id: 'rec-outubro',
          valor_total: 3000,
          status: 'faturado',
          competencia: '2026-10',
          created_at: '2026-10-05T10:00:00Z',
        },
      ];

      const res = reconciliarReceitasSemanais(receitas, '2026-10');
      expect(fromCents(res.faturamentoTotalCents)).toBe(3000);
      expect(res.receitasElegiveisCount).toBe(1);
    });
  });

  // 4. Faturamento Mensal Consolidado
  describe('4. Faturamento Mensal Consolidado', () => {
    it('deve decompor fatura mensal consolidada entre as semanas conforme a data de cada item', () => {
      const faturaConsolidada: RawReceitaOperacional = {
        id: 'fat-mensal-01',
        valor_total: 10000,
        status: 'faturado',
        competencia: '2026-10',
        vencimento: '2026-10-31',
        receitas_operacionais_itens: [
          { id: 'item-1', valor_item: 2000, operacoes_producao: { data_operacao: '2026-10-02' } },
          { id: 'item-2', valor_item: 3000, operacoes_producao: { data_operacao: '2026-10-09' } },
          { id: 'item-3', valor_item: 4000, operacoes_producao: { data_operacao: '2026-10-18' } },
          { id: 'item-4', valor_item: 1000, operacoes_producao: { data_operacao: '2026-10-25' } },
        ],
      };

      const res = reconciliarReceitasSemanais([faturaConsolidada], '2026-10');

      expect(fromCents(res.semanasCents[0])).toBe(2000);
      expect(fromCents(res.semanasCents[1])).toBe(3000);
      expect(fromCents(res.semanasCents[2])).toBe(4000);
      expect(fromCents(res.semanasCents[3])).toBe(1000);

      const somaSemanal = res.semanasCents.reduce((a, b) => a + b, 0);
      expect(somaSemanal).toBe(toCents(10000));
      expect(somaSemanal).toBe(res.faturamentoTotalCents);
    });

    it('deve deduplicar itens com mesmo ID decorrentes de joins repetidos', () => {
      const faturaComJoinDuplicado: RawReceitaOperacional = {
        id: 'fat-join-dup',
        valor_total: 5000,
        status: 'faturado',
        competencia: '2026-10',
        receitas_operacionais_itens: [
          { id: 'it-dup-1', valor_item: 5000, operacoes_producao: { data_operacao: '2026-10-05' } },
          { id: 'it-dup-1', valor_item: 5000, operacoes_producao: { data_operacao: '2026-10-05' } },
        ],
      };

      const res = reconciliarReceitasSemanais([faturaComJoinDuplicado], '2026-10');
      expect(fromCents(res.faturamentoTotalCents)).toBe(5000);
      expect(fromCents(res.semanasCents[0])).toBe(5000);
    });
  });

  // 5. Divergência entre Itens e Título e Registro de Auditoria
  describe('5. Tratamento de Divergência entre Itens e Título', () => {
    it('deve registrar na auditoria quando a soma dos itens for menor que o título e preservar o total', () => {
      const receitaComResiduo: RawReceitaOperacional = {
        id: 'rec-residuo',
        valor_total: 1000,
        status: 'faturado',
        competencia: '2026-10',
        created_at: '2026-10-25T14:00:00Z',
        receitas_operacionais_itens: [
          { id: 'it-p1', valor_item: 700, operacoes_producao: { data_operacao: '2026-10-05' } },
        ],
      };

      const res = reconciliarReceitasSemanais([receitaComResiduo], '2026-10');

      expect(fromCents(res.semanasCents[0])).toBe(700);
      expect(fromCents(res.semanasCents[3])).toBe(300);

      const somaSemanal = res.semanasCents.reduce((a, b) => a + b, 0);
      expect(somaSemanal).toBe(toCents(1000));

      expect(res.divergenciasItensTitulo).toHaveLength(1);
      expect(res.divergenciasItensTitulo[0]).toEqual({
        receitaId: 'rec-residuo',
        valorTitulo: 1000,
        somaItens: 700,
        diferenca: 300,
        tipo: 'itens_menores',
      });
    });

    it('deve registrar na auditoria quando a soma dos itens for maior que o título e prorratear exatamente', () => {
      const receitaComDesconto: RawReceitaOperacional = {
        id: 'rec-desc',
        valor_total: 900,
        status: 'faturado',
        competencia: '2026-10',
        receitas_operacionais_itens: [
          { id: 'it-a', valor_item: 500, operacoes_producao: { data_operacao: '2026-10-02' } },
          { id: 'it-b', valor_item: 500, operacoes_producao: { data_operacao: '2026-10-10' } },
        ],
      };

      const res = reconciliarReceitasSemanais([receitaComDesconto], '2026-10');

      expect(fromCents(res.semanasCents[0])).toBe(450);
      expect(fromCents(res.semanasCents[1])).toBe(450);

      const somaSemanal = res.semanasCents.reduce((a, b) => a + b, 0);
      expect(somaSemanal).toBe(toCents(900));

      expect(res.divergenciasItensTitulo).toHaveLength(1);
      expect(res.divergenciasItensTitulo[0]).toEqual({
        receitaId: 'rec-desc',
        valorTitulo: 900,
        somaItens: 1000,
        diferenca: 100,
        tipo: 'itens_maiores',
      });
    });
  });

  // 6. Reconciliação dos Custos (4 Fontes) e Precisão RH
  describe('6. Reconciliação das Quatro Fontes de Custos', () => {
    it('deve somar itens de RH estritamente em centavos evitando resíduos flutuantes', () => {
      const lotesRh: RawLoteRh[] = [
        {
          id: 'rh-1',
          tipo: 'BANCO_HORAS',
          status: 'APROVADO_FINANCEIRO',
          created_at: '2026-10-28',
          lote_itens: [
            { valor_calculado: 100.1 },
            { valor_calculado: 200.2 },
            { valor_calculado: 300.3 },
          ],
        },
      ];

      const res = reconciliarCustosSemanais({
        lotesDiaristas: [],
        lotesRh,
        custosExtras: [],
        competenciaCanonical: '2026-10',
      });

      expect(res.custosTotalCents).toBe(60060);
      expect(fromCents(res.custosTotalCents)).toBe(600.6);
      expect(fromCents(res.semanasCents[3])).toBe(600.6);
    });

    it('deve reconciliar Diaristas, Custos Extras, Intermitentes e Folha CLT', () => {
      const lotesDiaristas: RawLoteDiarista[] = [
        { id: 'd-1', valor_total: 1200, status: 'FECHADO_FINANCEIRO', periodo_inicio: '2026-10-04' },
        { id: 'd-2', valor_total: 1500, status: 'PAGO', periodo_inicio: '2026-10-16' },
      ];

      const lotesRh: RawLoteRh[] = [
        {
          id: 'rh-clt',
          tipo: 'BANCO_HORAS',
          status: 'APROVADO_FINANCEIRO',
          created_at: '2026-10-28',
          lote_itens: [{ valor_calculado: 4000 }],
        },
        {
          id: 'rh-inter',
          tipo: 'INTERMITENTES',
          status: 'PAGO',
          created_at: '2026-10-10',
          lote_itens: [{ valor_calculado: 800 }],
        },
      ];

      const custosExtras: RawCustoExtra[] = [
        {
          id: 'ce-1',
          total: 350.5,
          data: '2026-10-06',
          pipeline_status: 'FINALIZADO',
          status_pagamento: 'PAGO',
        },
      ];

      const res = reconciliarCustosSemanais({
        lotesDiaristas,
        lotesRh,
        custosExtras,
        competenciaCanonical: '2026-10',
      });

      expect(fromCents(res.semanasCents[0])).toBe(1550.5);
      expect(fromCents(res.semanasCents[1])).toBe(800.0);
      expect(fromCents(res.semanasCents[2])).toBe(1500.0);
      expect(fromCents(res.semanasCents[3])).toBe(4000.0);

      const somaSemanal = res.semanasCents.reduce((a, b) => a + b, 0);
      expect(somaSemanal).toBe(res.custosTotalCents);
      expect(fromCents(res.custosTotalCents)).toBe(7850.5);
    });
  });

  // 7. Registros Não Elegíveis e Estado sem_dados
  describe('7. Registros Não Elegíveis e Estado sem_dados', () => {
    it('deve retornar status sem_dados quando existirem exclusivamente registros não elegíveis', () => {
      const res = DashboardReconciliacaoSemanalService.processarReconciliacaoEmMemoria({
        competencia: '2026-10',
        receitas: [
          // Receita cancelada
          { id: 'r-canc', valor_total: 5000, status: 'cancelado', competencia: '2026-10' },
          // Receita de outra competência
          { id: 'r-set', valor_total: 3000, status: 'faturado', competencia: '2026-09' },
        ],
        lotesDiaristas: [
          // Lote em rascunho / não aprovado
          { id: 'd-rascunho', valor_total: 1000, status: 'RASCUNHO', periodo_inicio: '2026-10-05' },
        ],
        lotesRh: [
          // Lote em análise / não aprovado
          { id: 'rh-analise', tipo: 'FOLHA_VARIAVEL', status: 'EM_ANALISE', lote_itens: [{ valor_calculado: 4000 }] },
        ],
        custosExtras: [
          // Custo cancelado ou pendente
          { id: 'ce-canc', total: 500, data: '2026-10-10', pipeline_status: 'APROVADO_OPERACAO', status_pagamento: 'CANCELADO' },
          { id: 'ce-pend', total: 600, data: '2026-10-10', pipeline_status: 'PENDENTE', status_pagamento: 'PENDENTE' },
        ],
      });

      expect(res.status).toBe('sem_dados');
      expect(res.totais.receitaTotal).toBe(0);
      expect(res.totais.custosTotal).toBe(0);
      expect(res.auditoria.quantidadeRegistros.receitasElegiveis).toBe(0);
      expect(res.auditoria.quantidadeRegistros.lotesDiaristasElegiveis).toBe(0);
      expect(res.auditoria.quantidadeRegistros.lotesRhElegiveis).toBe(0);
      expect(res.auditoria.quantidadeRegistros.custosExtrasElegiveis).toBe(0);
    });

    it('NÃO deve classificar como sem_dados quando existirem registros elegíveis válidos com valor zero ou que se anulam', () => {
      const res = DashboardReconciliacaoSemanalService.processarReconciliacaoEmMemoria({
        competencia: '2026-10',
        receitas: [
          {
            id: 'r-ajuste-pos',
            valor_total: 1000,
            status: 'faturado',
            competencia: '2026-10',
            created_at: '2026-10-05T10:00:00Z',
          },
          {
            id: 'r-ajuste-neg',
            valor_total: -1000,
            status: 'faturado',
            competencia: '2026-10',
            created_at: '2026-10-05T10:00:00Z',
          },
        ],
        lotesDiaristas: [],
        lotesRh: [],
        custosExtras: [],
      });

      expect(res.totais.receitaTotal).toBe(0);
      expect(res.auditoria.quantidadeRegistros.receitasElegiveis).toBe(2);
      expect(res.status).toBe('ok');
    });
  });

  // 8. Rejeição Explícita de Competência Anual (YYYY-all)
  describe('8. Tratamento de Competência Anual (YYYY-all)', () => {
    it('deve lançar erro explícito ao receber competência anual YYYY-all', () => {
      expect(() => {
        DashboardReconciliacaoSemanalService.processarReconciliacaoEmMemoria({
          competencia: '2026-all',
          receitas: [],
          lotesDiaristas: [],
          lotesRh: [],
          custosExtras: [],
        });
      }).toThrow(/Competência anual \('2026-all'\) não suporta distribuição semanal/);
    });

    it('deve rejeitar competência anual no método assíncrono consultarEReconciliar', async () => {
      await expect(
        DashboardReconciliacaoSemanalService.consultarEReconciliar({
          competencia: '2026-all',
          tenantId: 'tenant-123',
        }),
      ).rejects.toThrow(/Competência anual \('2026-all'\) não suporta distribuição semanal/);
    });
  });

  // 9. Paridade Real com os Cartões Financeiros (getKpisByCompetencia)
  describe('9. Paridade Matemática Real contra getKpisByCompetencia', () => {
    it('deve comprovar paridade exata com getKpisByCompetencia sobre o mesmo conjunto de dados', async () => {
      // Mock unificado do Supabase para ambos os serviços
      const mockReceitas = [
        {
          id: 'rec-01',
          valor_total: 35000,
          status: 'faturado',
          competencia: '2026-10',
          created_at: '2026-10-04T10:00:00Z',
          receitas_operacionais_itens: [
            { id: 'it-1', valor_item: 15000, operacoes_producao: { data_operacao: '2026-10-04' } },
            { id: 'it-2', valor_item: 20000, operacoes_producao: { data_operacao: '2026-10-18' } },
          ],
        },
      ];

      const mockLotesDiaristas = [
        {
          id: 'd-1',
          valor_total: 8000,
          status: 'PAGO',
          periodo_inicio: '2026-10-06',
          created_at: '2026-10-06T10:00:00Z',
        },
      ];

      const mockLotesRh = [
        {
          id: 'rh-1',
          tipo: 'BANCO_HORAS',
          status: 'APROVADO_FINANCEIRO',
          competencia: '2026-10',
          created_at: '2026-10-28T10:00:00Z',
          lote_itens: [{ valor_calculado: 12000 }],
        },
      ];

      const mockCustosExtras = [
        {
          id: 'c-1',
          total: 2500,
          data: '2026-10-12',
          pipeline_status: 'FINALIZADO',
          status_pagamento: 'PAGO',
          deleted_at: null,
        },
      ];

      const createChainableMock = (data: any) => {
        const q: any = {};
        q.select = vi.fn().mockReturnValue(q);
        q.eq = vi.fn().mockReturnValue(q);
        q.or = vi.fn().mockReturnValue(q);
        q.in = vi.fn().mockReturnValue(q);
        q.gte = vi.fn().mockReturnValue(q);
        q.lt = vi.fn().mockReturnValue(q);
        q.is = vi.fn().mockReturnValue(q);
        q.neq = vi.fn().mockReturnValue(q);
        q.limit = vi.fn().mockReturnValue(q);
        q.then = (onFulfilled: any) => Promise.resolve({ data, error: null, count: data?.length || 0 }).then(onFulfilled);
        return q;
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'empresas') return createChainableMock([]);
        if (table === 'contas_bancarias_empresa') return createChainableMock([]);
        if (table === 'receitas_operacionais') return createChainableMock(mockReceitas);
        if (table === 'diaristas_lotes_fechamento') return createChainableMock(mockLotesDiaristas);
        if (table === 'rh_financeiro_lotes') return createChainableMock(mockLotesRh);
        if (table === 'custos_extras_operacionais') return createChainableMock(mockCustosExtras);
        return createChainableMock([]);
      });

      // 1. Executa o serviço canônico oficial dos cartões
      const kpisCartoes = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');

      // 2. Executa o novo serviço de reconciliação semanal
      const reconciliacaoSemanal = await DashboardReconciliacaoSemanalService.consultarEReconciliar({
        competencia: '2026-10',
        tenantId: 'tenant-test',
        environment: 'TODOS',
      });

      // Cálculos dos cartões
      const faturamentoCartoes = kpisCartoes.faturamentoTotal;
      const custosCartoes = kpisCartoes.finValorAprovado + kpisCartoes.custosGerais;
      const lucroCartoes = kpisCartoes.lucroReal;

      // Somas das 4 semanas
      const somaReceitasSemanas = reconciliacaoSemanal.semanas.reduce((a, s) => a + s.receita, 0);
      const somaCustosSemanas = reconciliacaoSemanal.semanas.reduce((a, s) => a + s.custos, 0);
      const somaLucroSemanas = reconciliacaoSemanal.semanas.reduce((a, s) => a + s.lucro, 0);

      // 3. Prova formal de paridade matemática
      expect(faturamentoCartoes).toBe(35000);
      expect(somaReceitasSemanas).toBe(faturamentoCartoes);
      expect(reconciliacaoSemanal.totais.receitaTotal).toBe(faturamentoCartoes);

      // Custos Cartões: Diaristas 8000 + RH 12000 + Extras 2500 = 22500
      expect(custosCartoes).toBe(22500);
      expect(somaCustosSemanas).toBe(custosCartoes);
      expect(reconciliacaoSemanal.totais.custosTotal).toBe(custosCartoes);

      // Lucro Cartões: 35000 - 22500 = 12500
      expect(lucroCartoes).toBe(12500);
      expect(somaLucroSemanas).toBe(lucroCartoes);
      expect(reconciliacaoSemanal.totais.lucroTotal).toBe(lucroCartoes);
    });
  });

  // 10. Proteção contra Truncamento de Paginação
  describe('10. Limites de Paginação e Integridade de Consultas', () => {
    it('deve disparar exceção quando o volume exceder o limite seguro de 2.000 registros', async () => {
      const createOverflowQuery = () => {
        const q: any = {};
        q.select = vi.fn().mockReturnValue(q);
        q.eq = vi.fn().mockReturnValue(q);
        q.or = vi.fn().mockReturnValue(q);
        q.in = vi.fn().mockReturnValue(q);
        q.gte = vi.fn().mockReturnValue(q);
        q.lt = vi.fn().mockReturnValue(q);
        q.is = vi.fn().mockReturnValue(q);
        q.neq = vi.fn().mockReturnValue(q);
        q.limit = vi.fn().mockReturnValue(q);
        q.then = (onFulfilled: any) =>
          Promise.resolve({ data: [], error: null, count: 2050 }).then(onFulfilled);
        return q;
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'empresas') return createOverflowQuery();
        if (table === 'receitas_operacionais') return createOverflowQuery();
        return createOverflowQuery();
      });

      await expect(
        DashboardReconciliacaoSemanalService.consultarEReconciliar({
          competencia: '2026-10',
          tenantId: 'tenant-test',
        }),
      ).rejects.toThrow(/Volume de receitas \(2050\) excedeu o limite máximo seguro/);
    });

    it('REGRESSÃO FIX-DASH-02-SQL-01: consulta de receitas_operacionais NÃO deve selecionar data_operacao na tabela raiz', async () => {
      let selectArgsReceitas = '';
      const createDummyQuery = () => {
        const q: any = {};
        q.select = vi.fn().mockReturnValue(q);
        q.eq = vi.fn().mockReturnValue(q);
        q.or = vi.fn().mockReturnValue(q);
        q.in = vi.fn().mockReturnValue(q);
        q.gte = vi.fn().mockReturnValue(q);
        q.lt = vi.fn().mockReturnValue(q);
        q.is = vi.fn().mockReturnValue(q);
        q.neq = vi.fn().mockReturnValue(q);
        q.limit = vi.fn().mockReturnValue(q);
        q.then = (onFulfilled: any) =>
          Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled);
        return q;
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'receitas_operacionais') {
          const qReceitas: any = {};
          qReceitas.select = vi.fn().mockImplementation((fields: string) => {
            selectArgsReceitas = fields;
            return qReceitas;
          });
          qReceitas.eq = vi.fn().mockReturnValue(qReceitas);
          qReceitas.or = vi.fn().mockReturnValue(qReceitas);
          qReceitas.in = vi.fn().mockReturnValue(qReceitas);
          qReceitas.gte = vi.fn().mockReturnValue(qReceitas);
          qReceitas.lt = vi.fn().mockReturnValue(qReceitas);
          qReceitas.is = vi.fn().mockReturnValue(qReceitas);
          qReceitas.neq = vi.fn().mockReturnValue(qReceitas);
          qReceitas.limit = vi.fn().mockReturnValue(qReceitas);
          qReceitas.then = (onFulfilled: any) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled);
          return qReceitas;
        }
        return createDummyQuery();
      });

      await DashboardReconciliacaoSemanalService.consultarEReconciliar({
        competencia: '2026-10',
        tenantId: 'tenant-test',
      });

      // Extrai os campos do select de receitas_operacionais antes do bloco aninhado receitas_operacionais_itens
      const partes = selectArgsReceitas.split('receitas_operacionais_itens');
      const camposRaiz = partes[0];

      // A coluna raiz NÃO pode referenciar data_operacao
      expect(camposRaiz).not.toContain('data_operacao');

      // Mas data_operacao deve continuar presente na relação de itens com operacoes_producao
      expect(selectArgsReceitas).toContain('operacoes_producao(id, data_operacao)');
    });
  });
});
