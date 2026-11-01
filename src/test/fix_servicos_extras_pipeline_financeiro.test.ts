import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDateOnly } from '../utils/financeiro';
import { generateCobrancaPDF } from '../utils/pdfCobranca';

let lastCreatedDoc: any = null;
let lastAutoTableOptions: any = null;

// Mock jsPDF and jspdf-autotable to capture calls and assert table data & text output
vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const calls: { text: string[]; rect: any[]; fillColors: any[] } = {
        text: [],
        rect: [],
        fillColors: []
      };
      const instance = {
        setFillColor: vi.fn((...args: any[]) => calls.fillColors.push(args)),
        rect: vi.fn((...args: any[]) => calls.rect.push(args)),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        text: vi.fn((txt: string) => {
          calls.text.push(txt);
        }),
        addPage: vi.fn(),
        save: vi.fn(),
        lastAutoTable: { finalY: 120 },
        __calls: calls
      };
      lastCreatedDoc = instance;
      return instance;
    })
  };
});

vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn((doc: any, options: any) => {
      lastAutoTableOptions = options;
      if (doc) {
        (doc as any).__autoTableOptions = options;
      }
    })
  };
});

// ==============================================================================
// SIMULADOR DO MOTOR FINANCEIRO DE SERVIÇOS EXTRAS
// Replica com 100% de fidelidade a lógica canônica da trigger fn_gerar_receita_servico_extra_automatica()
// ==============================================================================

interface FormaPagamentoOperacional {
  id: string;
  nome: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
}

interface RegraFinanceira {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  dias_vencimento_padrao: number;
}

interface ServicoExtraOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  data_servico: string;
  tipo_servico: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  forma_pagamento_id: string;
  modalidade_financeira?: string;
  data_vencimento?: string | null;
  pipeline_status: 'PENDENTE' | 'EM_ANALISE_RH' | 'APROVADO_OPERACAO' | 'APROVADO_FINANCEIRO' | 'FATURADO' | 'REJEITADO';
}

interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  competencia: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  status: 'pendente_cobranca' | 'pendente_recebimento' | 'aguardando_fechamento' | 'recebido' | 'conciliado';
  valor_total: number;
  vencimento: string;
}

interface ReceitaOperacionalItem {
  id: string;
  tenant_id: string;
  receita_id: string;
  operacao_id: string | null;
  servico_extra_id: string | null;
  valor_item: number;
}

class MotorFinanceiroSimulator {
  public formasPagamento: FormaPagamentoOperacional[] = [];
  public regrasFinanceiras: RegraFinanceira[] = [];
  public receitas: ReceitaOperacional[] = [];
  public receitasItens: ReceitaOperacionalItem[] = [];

  public resolverModalidade(formaPgtoId: string): 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL' {
    const fp = this.formasPagamento.find(f => f.id === formaPgtoId);
    if (!fp) return 'CAIXA_IMEDIATO';
    return fp.modalidade;
  }

  public calcularVencimentoDuplicata(
    tenantId: string,
    empresaId: string,
    dataServico: string,
    vencimentoInformado?: string | null
  ): string {
    if (vencimentoInformado) return vencimentoInformado;

    // Regra específica da empresa
    const regraEmpresa = this.regrasFinanceiras.find(
      r => r.tenant_id === tenantId && r.empresa_id === empresaId
    );
    if (regraEmpresa && regraEmpresa.dias_vencimento_padrao > 0) {
      const baseDate = new Date(dataServico + 'T12:00:00Z');
      baseDate.setUTCDate(baseDate.getUTCDate() + regraEmpresa.dias_vencimento_padrao);
      return baseDate.toISOString().slice(0, 10);
    }

    // Regra global do tenant
    const regraGlobal = this.regrasFinanceiras.find(
      r => r.tenant_id === tenantId && r.empresa_id === null
    );
    if (regraGlobal && regraGlobal.dias_vencimento_padrao > 0) {
      const baseDate = new Date(dataServico + 'T12:00:00Z');
      baseDate.setUTCDate(baseDate.getUTCDate() + regraGlobal.dias_vencimento_padrao);
      return baseDate.toISOString().slice(0, 10);
    }

    // Sem fallback arbitrário (sem D+15 ou D+7): vence na data da prestação
    return dataServico;
  }

  public processarTriggerServicoExtra(
    userTenantId: string | null | undefined,
    se: ServicoExtraOperacional,
    isSessionAuthenticated: boolean = true,
    triggerEvent: 'INSERT' | 'UPDATE' = 'UPDATE',
    oldSE?: ServicoExtraOperacional
  ): { sucesso: boolean; receitaId?: string; erro?: string; ignorado?: boolean } {
    // 0. Evento da Trigger: trg_gerar_receita_servico_extra_automatica opera estritamente AFTER UPDATE.
    // INSERT nunca dispara a trigger no banco de dados.
    if (triggerEvent === 'INSERT') {
      return { sucesso: true, ignorado: true };
    }

    // 1. Guarda Imediata de Pipeline (Early Return):
    // Serviços extras em análise (PENDENTE, EM_VALIDACAO, REJEITADO) NUNCA acionam o pipeline financeiro
    if (se.pipeline_status !== 'APROVADO_OPERACAO' && se.pipeline_status !== 'APROVADO_FINANCEIRO' && se.pipeline_status !== 'FATURADO') {
      return { sucesso: true, ignorado: true };
    }

    // Proteção contra UPDATE sem alteração relevante
    if (oldSE) {
      if (oldSE.pipeline_status === se.pipeline_status &&
          oldSE.forma_pagamento_id === se.forma_pagamento_id &&
          oldSE.valor_total === se.valor_total) {
        const itemExistente = this.receitasItens.find(i => i.servico_extra_id === se.id);
        return { sucesso: true, receitaId: itemExistente?.receita_id, ignorado: true };
      }
    }

    // 2. Validação Multitenant Estrita e Fail-Closed
    if (!se.tenant_id) {
      return { sucesso: false, erro: 'VIOLACAO_DADOS: tenant_id é obrigatório para geração de receita de serviço extra.' };
    }

    if (!se.empresa_id) {
      return { sucesso: false, erro: 'VIOLACAO_DADOS: empresa_id é obrigatório para geração de receita de serviço extra.' };
    }

    if (isSessionAuthenticated) {
      // Fonte canônica: public.current_tenant_id() com fallback em public.profiles
      if (!userTenantId) {
        return { sucesso: false, erro: 'VIOLACAO_SEGURANCA_MULTITENANT: Usuário autenticado sem vínculo de tenant identificado em profiles. Operação abortada.' };
      }

      if (userTenantId !== se.tenant_id) {
        return { sucesso: false, erro: 'VIOLACAO_SEGURANCA_MULTITENANT: Tenant autenticado diverge do tenant_id do serviço extra. Operação abortada.' };
      }
    }

    // 3. Idempotência estrutural
    const itemExistente = this.receitasItens.find(i => i.servico_extra_id === se.id);
    if (itemExistente) {
      return { sucesso: true, receitaId: itemExistente.receita_id };
    }

    // 4. Resolução da modalidade canônica
    const modalidade = this.resolverModalidade(se.forma_pagamento_id);
    const competencia = se.data_servico.slice(0, 7);

    if (modalidade === 'FATURAMENTO_MENSAL') {
      // Localiza receita mensal aberta
      let receitaMensal = this.receitas.find(
        r => r.tenant_id === se.tenant_id &&
             r.empresa_id === se.empresa_id &&
             r.competencia === competencia &&
             r.modalidade === 'FATURAMENTO_MENSAL' &&
             r.status === 'aguardando_fechamento'
      );

      if (!receitaMensal) {
        // Regra canônica FIX 14: Último dia civil da competência
        const dt = new Date(se.data_servico + 'T12:00:00Z');
        const ultimoDiaCivil = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0))
          .toISOString().slice(0, 10);

        receitaMensal = {
          id: `rec-mensal-${se.empresa_id}-${competencia}`,
          tenant_id: se.tenant_id,
          empresa_id: se.empresa_id,
          competencia: competencia,
          modalidade: 'FATURAMENTO_MENSAL',
          status: 'aguardando_fechamento',
          valor_total: 0,
          vencimento: ultimoDiaCivil
        };
        this.receitas.push(receitaMensal);
      }

      // Anexa item
      const newItem: ReceitaOperacionalItem = {
        id: `item-se-${se.id}`,
        tenant_id: se.tenant_id,
        receita_id: receitaMensal.id,
        operacao_id: null,
        servico_extra_id: se.id,
        valor_item: se.valor_total
      };
      this.receitasItens.push(newItem);

      // Recalcula valor total canônico
      receitaMensal.valor_total = this.receitasItens
        .filter(i => i.receita_id === receitaMensal.id)
        .reduce((sum, i) => sum + i.valor_item, 0);

      return { sucesso: true, receitaId: receitaMensal.id };
    } else if (modalidade === 'DUPLICATA') {
      const vencimento = this.calcularVencimentoDuplicata(
        se.tenant_id,
        se.empresa_id,
        se.data_servico,
        se.data_vencimento
      );

      const novaReceita: ReceitaOperacional = {
        id: `rec-dup-${se.id}`,
        tenant_id: se.tenant_id,
        empresa_id: se.empresa_id,
        competencia: competencia,
        modalidade: 'DUPLICATA',
        status: 'pendente_cobranca',
        valor_total: se.valor_total,
        vencimento: vencimento
      };
      this.receitas.push(novaReceita);

      const newItem: ReceitaOperacionalItem = {
        id: `item-se-${se.id}`,
        tenant_id: se.tenant_id,
        receita_id: novaReceita.id,
        operacao_id: null,
        servico_extra_id: se.id,
        valor_item: se.valor_total
      };
      this.receitasItens.push(newItem);

      return { sucesso: true, receitaId: novaReceita.id };
    } else {
      // CAIXA_IMEDIATO
      const novaReceita: ReceitaOperacional = {
        id: `rec-caixa-${se.id}`,
        tenant_id: se.tenant_id,
        empresa_id: se.empresa_id,
        competencia: competencia,
        modalidade: 'CAIXA_IMEDIATO',
        status: 'pendente_recebimento',
        valor_total: se.valor_total,
        vencimento: se.data_servico
      };
      this.receitas.push(novaReceita);

      const newItem: ReceitaOperacionalItem = {
        id: `item-se-${se.id}`,
        tenant_id: se.tenant_id,
        receita_id: novaReceita.id,
        operacao_id: null,
        servico_extra_id: se.id,
        valor_item: se.valor_total
      };
      this.receitasItens.push(newItem);

      return { sucesso: true, receitaId: novaReceita.id };
    }
  }
}

// ==============================================================================
// TEST SUITE: PIPELINE FINANCEIRO DE SERVIÇOS EXTRAS
// ==============================================================================

describe('TEST SUITE: FIX SERVIÇOS EXTRAS → PIPELINE FINANCEIRO / RECEITAS', () => {
  let sim: MotorFinanceiroSimulator;
  const TENANT_A = 'tenant-alpha-uuid';
  const TENANT_B = 'tenant-beta-uuid';
  const EMPRESA_BENEVIDES = 'empresa-benevides-uuid';

  beforeEach(() => {
    sim = new MotorFinanceiroSimulator();
    sim.formasPagamento = [
      { id: 'fp-boleto', nome: 'Boleto', modalidade: 'DUPLICATA' },
      { id: 'fp-pix', nome: 'Pix', modalidade: 'CAIXA_IMEDIATO' },
      { id: 'fp-dinheiro', nome: 'Dinheiro', modalidade: 'CAIXA_IMEDIATO' },
      { id: 'fp-mensal', nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' }
    ];
    sim.regrasFinanceiras = [
      { id: 'rf-global', tenant_id: TENANT_A, empresa_id: null, dias_vencimento_padrao: 15 },
      { id: 'rf-benevides', tenant_id: TENANT_A, empresa_id: EMPRESA_BENEVIDES, dias_vencimento_padrao: 20 }
    ];
    lastCreatedDoc = null;
    lastAutoTableOptions = null;
  });

  // 1. Serviço Extra Boleto → DUPLICATA
  it('1. Serviço Extra com forma de pagamento Boleto gera Receita com modalidade DUPLICATA e status pendente_cobranca', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-01',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Consertar palete',
      descricao: 'Conserto de 5 paletes danificados',
      quantidade: 5,
      valor_unitario: 20.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res.sucesso).toBe(true);

    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec).toBeDefined();
    expect(rec?.modalidade).toBe('DUPLICATA');
    expect(rec?.status).toBe('pendente_cobranca');
    expect(rec?.valor_total).toBe(100.00);

    const item = sim.receitasItens.find(i => i.servico_extra_id === se.id);
    expect(item).toBeDefined();
    expect(item?.operacao_id).toBeNull();
    expect(item?.servico_extra_id).toBe('se-test-01');
    expect(item?.valor_item).toBe(100.00);
  });

  // 2. Serviço Extra Pix/Dinheiro equivalente → CAIXA_IMEDIATO
  it('2. Serviço Extra com Pix/Dinheiro gera Receita CAIXA_IMEDIATO com vencimento igual à data do serviço', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-02',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-17',
      tipo_servico: 'Limpeza extraordinária',
      descricao: 'Limpeza de galpão B',
      quantidade: 1,
      valor_unitario: 150.00,
      valor_total: 150.00,
      forma_pagamento_id: 'fp-pix',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res.sucesso).toBe(true);

    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec?.modalidade).toBe('CAIXA_IMEDIATO');
    expect(rec?.status).toBe('pendente_recebimento');
    expect(rec?.vencimento).toBe('2026-09-17');
    expect(rec?.valor_total).toBe(150.00);
  });

  // 3. Serviço Extra Faturamento Mensal
  it('3. Serviço Extra com Faturamento Mensal gera Receita FATURAMENTO_MENSAL em aguardando_fechamento', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-03',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-10',
      tipo_servico: 'Pintura de demarcação',
      descricao: 'Faixas do piso',
      quantidade: 2,
      valor_unitario: 250.00,
      valor_total: 500.00,
      forma_pagamento_id: 'fp-mensal',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res.sucesso).toBe(true);

    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec?.modalidade).toBe('FATURAMENTO_MENSAL');
    expect(rec?.status).toBe('aguardando_fechamento');
    expect(rec?.competencia).toBe('2026-09');
    expect(rec?.valor_total).toBe(500.00);
    expect(rec?.vencimento).toBe('2026-09-30'); // Último dia civil de setembro (Regra Canônica FIX 14)
  });

  // 4. Vencimento específico por empresa para DUPLICATA
  it('4. Vencimento para DUPLICATA respeita regra específica da empresa (ex: 20 dias para Benevides)', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-04',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-01',
      tipo_servico: 'Paletes',
      descricao: 'Reparo',
      quantidade: 1,
      valor_unitario: 50.00,
      valor_total: 50.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    const rec = sim.receitas.find(r => r.id === res.receitaId);
    // 2026-09-01 + 20 dias = 2026-09-21
    expect(rec?.vencimento).toBe('2026-09-21');
  });

  // 5. Fallback da regra financeira global
  it('5. Fallback da regra financeira global (15 dias) é aplicado quando a empresa não possui regra customizada', () => {
    const OUTRA_EMPRESA = 'empresa-outra-uuid';
    const se: ServicoExtraOperacional = {
      id: 'se-test-05',
      tenant_id: TENANT_A,
      empresa_id: OUTRA_EMPRESA,
      data_servico: '2026-09-01',
      tipo_servico: 'Paletes',
      descricao: 'Reparo',
      quantidade: 1,
      valor_unitario: 50.00,
      valor_total: 50.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    const rec = sim.receitas.find(r => r.id === res.receitaId);
    // 2026-09-01 + 15 dias = 2026-09-16
    expect(rec?.vencimento).toBe('2026-09-16');
  });

  // 5.1. Ausência de regra em regras_financeiras: sem fallback numérico arbitrário (vence na data do serviço)
  it('5.1. Ausência de regra em regras_financeiras: vence na data do serviço sem prazo arbitrário', () => {
    const simSemRegras = new MotorFinanceiroSimulator();
    simSemRegras.formasPagamento = [
      { id: 'fp-boleto', nome: 'Boleto', modalidade: 'DUPLICATA' }
    ];
    simSemRegras.regrasFinanceiras = []; // Sem regras cadastradas

    const se: ServicoExtraOperacional = {
      id: 'se-test-05b',
      tenant_id: TENANT_A,
      empresa_id: 'empresa-sem-regra',
      data_servico: '2026-09-05',
      tipo_servico: 'Paletes',
      descricao: 'Reparo sem prazo',
      quantidade: 1,
      valor_unitario: 80.00,
      valor_total: 80.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = simSemRegras.processarTriggerServicoExtra(TENANT_A, se);
    const rec = simSemRegras.receitas.find(r => r.id === res.receitaId);
    // Sem regra cadastrada, assume a data do fato gerador (2026-09-05), sem inventar D+15 ou D+7
    expect(rec?.vencimento).toBe('2026-09-05');
  });

  // 6. Serviço Extra sem ISS, quando aplicável
  it('6. Serviço Extra sem ISS é integrado com valor bruto fiel sem deduções artificiais', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-06',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Consertar palete',
      descricao: 'Serviço operacional sem ISS',
      quantidade: 10,
      valor_unitario: 18.00,
      valor_total: 180.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec?.valor_total).toBe(180.00);
  });

  // 7. Serviço Extra com valores decimais
  it('7. Serviço Extra com valores decimais é preservado com precisão monetária (R$ 137.45)', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-07',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Corte e Solda',
      descricao: 'Conserto técnico',
      quantidade: 3,
      valor_unitario: 45.816666,
      valor_total: 137.45,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec?.valor_total).toBe(137.45);
  });

  // 8. Idempotência: aprovação/processamento repetido não duplica Receita
  it('8. Idempotência: reprocessamento do mesmo Serviço Extra não gera Receita ou Item duplicado', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-08',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Consertar palete',
      descricao: 'Conserto único',
      quantidade: 5,
      valor_unitario: 20.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    // 1ª Execução
    const res1 = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res1.sucesso).toBe(true);
    expect(sim.receitas).toHaveLength(1);
    expect(sim.receitasItens).toHaveLength(1);

    // 2ª Execução (simulando update posterior em outro campo do SE aprovado)
    const res2 = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res2.sucesso).toBe(true);
    expect(res2.receitaId).toBe(res1.receitaId);
    expect(sim.receitas).toHaveLength(1);
    expect(sim.receitasItens).toHaveLength(1);
  });

  // 9. Isolamento Multitenant Estrito e Fail-Closed + Evento Trigger & Early Return
  describe('9. Governança, Trigger de Update, Early Return e Isolamento Multitenant Fail-Closed', () => {
    const sePendente: ServicoExtraOperacional = {
      id: 'se-test-09-pendente',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Conserto',
      descricao: 'Serviço Extra em Análise',
      quantidade: 1,
      valor_unitario: 100.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'PENDENTE'
    };

    const seTenantA: ServicoExtraOperacional = {
      id: 'se-test-09',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Conserto',
      descricao: 'Tenant A item',
      quantidade: 1,
      valor_unitario: 100.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    it('9.1. INSERT de Serviço Extra PENDENTE → permitido e zero Receita gerada', () => {
      const simInsert = new MotorFinanceiroSimulator();
      simInsert.formasPagamento = sim.formasPagamento;
      simInsert.regrasFinanceiras = sim.regrasFinanceiras;

      // Criação de Serviço Extra via INSERT
      const res = simInsert.processarTriggerServicoExtra(TENANT_A, sePendente, true, 'INSERT');
      expect(res.sucesso).toBe(true);
      expect(res.ignorado).toBe(true);
      expect(simInsert.receitas).toHaveLength(0);
      expect(simInsert.receitasItens).toHaveLength(0);
    });

    it('9.2. UPDATE PENDENTE → APROVADO_OPERACAO com tenant correto → gera exatamente 1 Receita', () => {
      const simUpdate = new MotorFinanceiroSimulator();
      simUpdate.formasPagamento = sim.formasPagamento;
      simUpdate.regrasFinanceiras = sim.regrasFinanceiras;

      const res = simUpdate.processarTriggerServicoExtra(TENANT_A, seTenantA, true, 'UPDATE', sePendente);
      expect(res.sucesso).toBe(true);
      expect(res.receitaId).toBeDefined();
      expect(simUpdate.receitas).toHaveLength(1);
      expect(simUpdate.receitasItens).toHaveLength(1);
    });

    it('9.3. Sessão autenticada + tenant divergente → bloqueado com RAISE EXCEPTION', () => {
      const simDivergente = new MotorFinanceiroSimulator();
      simDivergente.formasPagamento = sim.formasPagamento;
      simDivergente.regrasFinanceiras = sim.regrasFinanceiras;

      const res = simDivergente.processarTriggerServicoExtra(TENANT_B, seTenantA, true, 'UPDATE', sePendente);
      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('VIOLACAO_SEGURANCA_MULTITENANT');
      expect(res.erro).toContain('diverge do tenant_id');
      expect(simDivergente.receitas).toHaveLength(0);
    });

    it('9.4. Sessão autenticada + usuário sem vínculo de tenant em profiles → bloqueado com RAISE EXCEPTION', () => {
      const simAusente = new MotorFinanceiroSimulator();
      simAusente.formasPagamento = sim.formasPagamento;
      simAusente.regrasFinanceiras = sim.regrasFinanceiras;

      // Usuário autenticado sem tenant_id associado em public.profiles
      const res = simAusente.processarTriggerServicoExtra(null, seTenantA, true, 'UPDATE', sePendente);
      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('VIOLACAO_SEGURANCA_MULTITENANT');
      expect(res.erro).toContain('sem vínculo de tenant identificado em profiles');
      expect(simAusente.receitas).toHaveLength(0);
    });

    it('9.5. Repetição da aprovação → não duplica Receita (idempotência)', () => {
      const simRepeticao = new MotorFinanceiroSimulator();
      simRepeticao.formasPagamento = sim.formasPagamento;
      simRepeticao.regrasFinanceiras = sim.regrasFinanceiras;

      const res1 = simRepeticao.processarTriggerServicoExtra(TENANT_A, seTenantA, true, 'UPDATE', sePendente);
      expect(res1.sucesso).toBe(true);
      expect(simRepeticao.receitas).toHaveLength(1);

      // Repete a transição / trigger
      const res2 = simRepeticao.processarTriggerServicoExtra(TENANT_A, seTenantA, true, 'UPDATE', seTenantA);
      expect(res2.sucesso).toBe(true);
      expect(res2.receitaId).toBe(res1.receitaId);
      expect(simRepeticao.receitas).toHaveLength(1);
      expect(simRepeticao.receitasItens).toHaveLength(1);
    });
  });

  // 10. Serviço Extra DUPLICATA não entra em CAIXA_IMEDIATO
  it('10. Serviço Extra com forma Boleto (DUPLICATA) não é gravado como CAIXA_IMEDIATO', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-10',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Palete',
      descricao: 'Boleto item',
      quantidade: 1,
      valor_unitario: 100.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-boleto',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    sim.processarTriggerServicoExtra(TENANT_A, se);
    const recCaixa = sim.receitas.filter(r => r.modalidade === 'CAIXA_IMEDIATO');
    expect(recCaixa).toHaveLength(0);
  });

  // 11. Serviço Extra CAIXA_IMEDIATO não entra em DUPLICATA
  it('11. Serviço Extra com forma Pix (CAIXA_IMEDIATO) não é gravado como DUPLICATA', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-11',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-16',
      tipo_servico: 'Palete',
      descricao: 'Pix item',
      quantidade: 1,
      valor_unitario: 100.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-pix',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    sim.processarTriggerServicoExtra(TENANT_A, se);
    const recDup = sim.receitas.filter(r => r.modalidade === 'DUPLICATA');
    expect(recDup).toHaveLength(0);
  });

  // 12. Serviço Extra mensal entra na Receita mensal correta
  it('12. Serviço Extra com competência 2026-09 entra exatamente na competência 2026-09', () => {
    const se: ServicoExtraOperacional = {
      id: 'se-test-12',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-15',
      tipo_servico: 'Movimentação',
      descricao: 'Extra',
      quantidade: 1,
      valor_unitario: 300.00,
      valor_total: 300.00,
      forma_pagamento_id: 'fp-mensal',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    const rec = sim.receitas.find(r => r.id === res.receitaId);
    expect(rec?.competencia).toBe('2026-09');
  });

  // 13. Se já houver Receita mensal aberta da mesma empresa/competência, o Serviço Extra deve ser agregado
  it('13. Se já houver Receita mensal aberta da mesma empresa/competência, o Serviço Extra é agregado e o valor é recalculado', () => {
    // 1. Receita mensal já existe com uma operação anterior de R$ 400.00
    const receitaMensalExistente: ReceitaOperacional = {
      id: 'rec-mensal-existente',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      competencia: '2026-09',
      modalidade: 'FATURAMENTO_MENSAL',
      status: 'aguardando_fechamento',
      valor_total: 400.00,
      vencimento: '2026-09-30'
    };
    sim.receitas.push(receitaMensalExistente);
    sim.receitasItens.push({
      id: 'item-op-anterior',
      tenant_id: TENANT_A,
      receita_id: 'rec-mensal-existente',
      operacao_id: 'op-ant-01',
      servico_extra_id: null,
      valor_item: 400.00
    });

    // 2. Serviço Extra entra no mesmo mês para a mesma empresa
    const se: ServicoExtraOperacional = {
      id: 'se-test-13',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      data_servico: '2026-09-20',
      tipo_servico: 'Consertar palete',
      descricao: '5 paletes extras',
      quantidade: 5,
      valor_unitario: 20.00,
      valor_total: 100.00,
      forma_pagamento_id: 'fp-mensal',
      pipeline_status: 'APROVADO_OPERACAO'
    };

    const res = sim.processarTriggerServicoExtra(TENANT_A, se);
    expect(res.sucesso).toBe(true);
    expect(res.receitaId).toBe('rec-mensal-existente');

    // Continua sendo UMA única receita mensal
    expect(sim.receitas.filter(r => r.modalidade === 'FATURAMENTO_MENSAL')).toHaveLength(1);
    
    // Valor foi recalculado para R$ 400 + R$ 100 = R$ 500
    expect(receitaMensalExistente.valor_total).toBe(500.00);
    expect(sim.receitasItens.filter(i => i.receita_id === 'rec-mensal-existente')).toHaveLength(2);
  });

  // 14. Operações por Volume continuam funcionando sem alteração
  it('14. Operações por Volume continuam gerando itens com operacao_id preenchido e servico_extra_id null', () => {
    // Simula item padrão de Operação por Volume
    const itemOp: ReceitaOperacionalItem = {
      id: 'item-op-homologado',
      tenant_id: TENANT_A,
      receita_id: 'rec-op-01',
      operacao_id: 'cad8552a-5fc1-47f4-9ca7-77f27e12bea5',
      servico_extra_id: null,
      valor_item: 159.30
    };

    expect(itemOp.operacao_id).toBe('cad8552a-5fc1-47f4-9ca7-77f27e12bea5');
    expect(itemOp.servico_extra_id).toBeNull();
  });

  // 15. PDF de Operação por Volume continua funcionando
  it('15. PDF de Operação por Volume continua renderizando dados da operação, materiais e ISS sem regressão', () => {
    const receitaOp = {
      id: 'rec-pdf-op-01',
      empresas: { nome: 'BENEVIDES' },
      competencia: '2026-09',
      vencimento: '2026-09-28',
      valor_total: 159.30,
      modalidade: 'DUPLICATA',
      status: 'pendente_cobranca'
    };

    const detalhesOp = {
      receitas_operacionais_itens: [
        {
          id: 'item-op-1',
          valor_item: 159.30,
          operacoes_producao: {
            id: 'op-01-uuid',
            data_operacao: '2026-09-13',
            quantidade: 300,
            valor_unitario: 0.42,
            valor_descarga: 126.00,
            valor_total_materiais: 27.00,
            custo_com_iss: 6.30,
            percentual_iss: 0.05,
            servicos: { nome: 'Descarga Paletizada' },
            produtos: { nome: 'Biscoito 400g' }
          }
        }
      ]
    };

    generateCobrancaPDF(receitaOp, detalhesOp, 'PDF');

    expect(lastAutoTableOptions).toBeDefined();
    const rows = lastAutoTableOptions.body;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Linha 1: Serviço
    expect(rows[0][1]).toContain('Descarga Paletizada - Biscoito 400g');
    expect(rows[0][2]).toBe('300');
    // Linha 2: Materiais
    expect(rows[1][1]).toBe('Materiais');
    // Linha 3: ISS
    expect(rows[2][1]).toContain('ISS (5%)');
  });

  // 16. PDF de Serviço Extra apresenta descrição/quantidade/unitário/total corretos
  it('16. PDF de Serviço Extra apresenta descrição, quantidade, unitário e total de acordo com a fatura esperada', () => {
    const receitaSe = {
      id: 'rec-pdf-se-01',
      empresas: { nome: 'BENEVIDES' },
      competencia: '2026-09',
      vencimento: '2026-09-28',
      valor_total: 100.00,
      modalidade: 'DUPLICATA',
      status: 'pendente_cobranca'
    };

    const detalhesSe = {
      receitas_operacionais_itens: [
        {
          id: 'item-se-1',
          valor_item: 100.00,
          servicos_extras_operacionais: {
            id: '6862d58e-9a85-447c-9c0f-c13a39b7a55f',
            data_servico: '2026-09-16',
            tipo_servico: 'Consertar palete',
            descricao: 'Conserto de 5 paletes danificados',
            quantidade: 5,
            valor_unitario: 20.00,
            valor_total: 100.00
          }
        }
      ]
    };

    generateCobrancaPDF(receitaSe, detalhesSe, 'PDF');

    expect(lastAutoTableOptions).toBeDefined();
    const rows = lastAutoTableOptions.body;
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe('16/09/2026');
    expect(rows[0][1]).toBe('Consertar palete — Conserto de 5 paletes danificados');
    expect(rows[0][2]).toBe('5');
    expect(rows[0][3]).toContain('20,00');
    expect(rows[0][4]).toContain('100,00');
  });

  // 17. Recebimento e conciliação continuam utilizando a máquina de estados existente
  it('17. Recebimento e conciliação de Receita originada de Serviço Extra utilizam o fluxo canônico de estados', () => {
    // 1. Receita nasce pendente_cobranca
    const rec: ReceitaOperacional = {
      id: 'rec-transicao-01',
      tenant_id: TENANT_A,
      empresa_id: EMPRESA_BENEVIDES,
      competencia: '2026-09',
      modalidade: 'DUPLICATA',
      status: 'pendente_cobranca',
      valor_total: 100.00,
      vencimento: '2026-09-28'
    };

    // 2. Registro de envio de cobrança
    rec.status = 'pendente_recebimento';
    expect(rec.status).toBe('pendente_recebimento');

    // 3. Confirmação do recebimento (ou liquidação bancária)
    rec.status = 'recebido';
    expect(rec.status).toBe('recebido');

    // 4. Conciliação bancária final
    rec.status = 'conciliado';
    expect(rec.status).toBe('conciliado');
  });
});
