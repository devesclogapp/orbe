import { describe, it, expect } from 'vitest';

// ==============================================================================
// SUÍTE FIX 14.6 — CORREÇÃO SEMÂNTICA DO RESUMO FINANCEIRO (A RECEBER)
// ==============================================================================

interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  competencia: string;
  vencimento: string;
  valor_total: number;
  status: string;
}

// Configuração canônica das colunas do Kanban no ReceitasPipeline.tsx
const KANBAN_CONFIGS = {
  'CAIXA_IMEDIATO': [
    { id: "pendente_recebimento", label: "Em aberto" },
    { id: "recebido", label: "Recebido" },
  ],
  'DUPLICATA': [
    { id: "pendente_cobranca", label: "Cobrança gerada" },
    { id: "cobranca_enviada", label: "Cobrança enviada" },
    { id: "recebido", label: "Recebido" },
  ],
  'FATURAMENTO_MENSAL': [
    { id: "aguardando_fechamento", label: "Em aberto" },
    { id: "pendente_cobranca", label: "Cobrança gerada" },
    { id: "cobranca_enviada", label: "Cobrança enviada" },
    { id: "recebido", label: "Recebido" },
  ]
};

// Labels dos cards de KPI superiores no ReceitasPipeline.tsx
const KPI_CARDS_LABELS = {
  count: 'Receitas',
  total: 'Valor Total',
  recebido: 'Recebido',
  aberto: 'A Receber', // FIX 14.6: Renomeado de "Em Aberto" para "A Receber"
  vencidas: 'Vencidas'
};

// Simulador dos cálculos de KPI do ReceitasPipeline.tsx
function calcularKpis(receitas: ReceitaOperacional[]) {
  let count = 0;
  let total = 0;
  let recebido = 0;
  let aberto = 0; // valor financeiro pendente de recebimento ("A Receber")
  let vencidas = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  receitas.forEach((r) => {
    count++;
    const valor = Number(r.valor_total || 0);
    total += valor;
    if (r.status === 'recebido' || r.status === 'pago' || r.status === 'conciliado') {
      recebido += valor;
    } else {
      aberto += valor;
      if (r.vencimento) {
        const [ano, mes, dia] = r.vencimento.split('-');
        const vDate = new Date(Number(ano), Number(mes) - 1, Number(dia));
        if (vDate.getTime() < today.getTime()) {
          vencidas += valor;
        }
      }
    }
  });

  return { count, total, recebido, aberto, vencidas };
}

// Simulador da distribuição nas colunas Kanban
function distribuirNoKanban(modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL', receitas: ReceitaOperacional[]) {
  const stages = KANBAN_CONFIGS[modalidade];
  const cols: Record<string, ReceitaOperacional[]> = {};
  stages.forEach(col => cols[col.id] = []);

  receitas.forEach(r => {
    let st = r.status || stages[0].id;
    if (st === 'pago' || st === 'conciliado' || st === 'fechado') {
      st = 'recebido';
    }
    if (cols[st]) {
      cols[st].push(r);
    } else if (cols[stages[0].id]) {
      cols[stages[0].id].push(r);
    }
  });

  return cols;
}

describe('FIX 14.6 — Resumo Financeiro e Desambiguação Semântica (A Receber)', () => {
  it('1. Deve nomear o card de saldo financeiro pendente como "A Receber" para evitar ambiguidade', () => {
    expect(KPI_CARDS_LABELS.aberto).toBe('A Receber');
    expect(KPI_CARDS_LABELS.aberto).not.toBe('Em Aberto');
  });

  it('2. Deve preservar integralmente o nome da coluna Kanban "Em aberto" para manter o fluxo operacional', () => {
    expect(KANBAN_CONFIGS['CAIXA_IMEDIATO'][0].label).toBe('Em aberto');
    expect(KANBAN_CONFIGS['FATURAMENTO_MENSAL'][0].label).toBe('Em aberto');
    expect(KANBAN_CONFIGS['DUPLICATA'][0].label).toBe('Cobrança gerada');
  });

  it('3. Cenário de Homologação: Receita Mensal fechada (BENEVIDES / Setembro 2026 / R$ 415,62)', () => {
    const receitaMensalFechada: ReceitaOperacional = {
      id: 'f105f927-f165-40e5-97af-c3fa9e0d0f04',
      tenant_id: 'tenant-01',
      empresa_id: 'empresa-benevides',
      modalidade: 'FATURAMENTO_MENSAL',
      competencia: '2026-09',
      vencimento: '2026-09-30',
      valor_total: 415.62,
      status: 'pendente_cobranca' // Fechada pelo FIX 14.5
    };

    // Cálculo dos KPIs superiores
    const kpis = calcularKpis([receitaMensalFechada]);

    expect(kpis.count).toBe(1);
    expect(kpis.total).toBe(415.62);
    expect(kpis.recebido).toBe(0.00);
    expect(kpis.aberto).toBe(415.62); // Exibido no card "A RECEBER"
    expect(kpis.vencidas).toBe(0.00);

    // Distribuição nas colunas do Kanban
    const kanban = distribuirNoKanban('FATURAMENTO_MENSAL', [receitaMensalFechada]);

    // Coluna "Em aberto" deve ter 0 cards
    expect(kanban['aguardando_fechamento'].length).toBe(0);

    // Coluna "Cobrança gerada" deve ter 1 card com R$ 415,62
    expect(kanban['pendente_cobranca'].length).toBe(1);
    expect(kanban['pendente_cobranca'][0].valor_total).toBe(415.62);

    // Demais colunas zeradas
    expect(kanban['cobranca_enviada'].length).toBe(0);
    expect(kanban['recebido'].length).toBe(0);
  });

  it('4. Deve funcionar semanticamente de forma perfeita para Caixa Imediato', () => {
    const receitaCaixaPendente: ReceitaOperacional = {
      id: 'rec-caixa-01',
      tenant_id: 'tenant-01',
      empresa_id: 'empresa-01',
      modalidade: 'CAIXA_IMEDIATO',
      competencia: '2026-09',
      vencimento: '2026-09-15',
      valor_total: 100.00,
      status: 'pendente_recebimento'
    };

    const kpis = calcularKpis([receitaCaixaPendente]);
    expect(kpis.total).toBe(100.00);
    expect(kpis.aberto).toBe(100.00); // A Receber: R$ 100,00
    expect(kpis.recebido).toBe(0.00);

    const kanban = distribuirNoKanban('CAIXA_IMEDIATO', [receitaCaixaPendente]);
    expect(kanban['pendente_recebimento'].length).toBe(1);
    expect(kanban['recebido'].length).toBe(0);

    // Após liquidação
    receitaCaixaPendente.status = 'recebido';
    const kpisRecebido = calcularKpis([receitaCaixaPendente]);
    expect(kpisRecebido.aberto).toBe(0.00); // A Receber: R$ 0,00
    expect(kpisRecebido.recebido).toBe(100.00); // Recebido: R$ 100,00
  });

  it('5. Deve funcionar semanticamente de forma perfeita para Duplicata', () => {
    const receitaDuplicata: ReceitaOperacional = {
      id: 'rec-dup-01',
      tenant_id: 'tenant-01',
      empresa_id: 'empresa-01',
      modalidade: 'DUPLICATA',
      competencia: '2026-09',
      vencimento: '2026-09-25',
      valor_total: 250.00,
      status: 'pendente_cobranca'
    };

    const kpis = calcularKpis([receitaDuplicata]);
    expect(kpis.total).toBe(250.00);
    expect(kpis.aberto).toBe(250.00); // A Receber: R$ 250,00
    expect(kpis.recebido).toBe(0.00);

    const kanban = distribuirNoKanban('DUPLICATA', [receitaDuplicata]);
    expect(kanban['pendente_cobranca'].length).toBe(1); // Coluna "Cobrança gerada"
    expect(kanban['cobranca_enviada'].length).toBe(0);
    expect(kanban['recebido'].length).toBe(0);
  });
});
