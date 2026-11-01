import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastCreatedDoc: any = null;
let lastAutoTableOptions: any = null;

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
        save: vi.fn(),
        addPage: vi.fn(),
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

import { generateCobrancaPDF } from '../utils/pdfCobranca';

describe('FIX 14.7A — Composição do PDF sem Truncamento e Alinhamentos', () => {
  beforeEach(() => {
    lastCreatedDoc = null;
    lastAutoTableOptions = null;
  });

  const mockReceitaConsolidada = {
    id: 'f105f927-f165-40e5-97af-c3fa9e0d0f04',
    empresas: { nome: 'BENEVIDES' },
    competencia: '2026-09',
    vencimento: '2026-09-30',
    valor_total: 415.62,
    modalidade: 'FATURAMENTO_MENSAL',
    status: 'pendente_cobranca'
  };

  const mockDetalhesConsolidados = {
    receitas_operacionais_itens: [
      {
        id: 'item-1',
        valor_item: 124.02,
        operacoes_producao: {
          id: 'op-1',
          data_operacao: '2026-09-14',
          quantidade: 220,
          valor_unitario_snapshot: 0.42,
          valor_descarga: 92.40,
          valor_total_materiais: 27.00,
          custo_com_iss: 4.62,
          percentual_iss: 0.05,
          valor_total: 124.02,
          servicos: { nome: 'Descarga' },
          produtos: { nome: 'Produto Genérico (Fictício - Onboarding)' }
        }
      },
      {
        id: 'item-2',
        valor_item: 291.60,
        operacoes_producao: {
          id: 'op-2',
          data_operacao: '2026-09-14',
          quantidade: 600,
          valor_unitario_snapshot: 0.42,
          valor_descarga: 252.00,
          valor_total_materiais: 27.00,
          custo_com_iss: 12.60,
          percentual_iss: 0.05,
          valor_total: 291.60,
          servicos: { nome: 'Descarga' },
          produtos: { nome: 'Produto Genérico (Fictício - Onboarding)' }
        }
      }
    ]
  };

  it('1. Deve preservar descrições longas sem corte arbitrário (elimina substring 0..45)', () => {
    generateCobrancaPDF(
      mockReceitaConsolidada,
      mockDetalhesConsolidados,
      'Fatura Consolidada (PDF)',
      '2026-09-30'
    );

    expect(lastAutoTableOptions).toBeDefined();
    const rows = lastAutoTableOptions.body;

    // Linha 1 (Descarga Op 1)
    const descOp1 = rows[0][1];
    expect(descOp1).toBe('Descarga - Produto Genérico (Fictício - Onboarding)');
    expect(descOp1.length).toBeGreaterThan(45); // 51 caracteres preservados na íntegra!

    // Linha 4 (Descarga Op 2)
    const descOp2 = rows[3][1];
    expect(descOp2).toBe('Descarga - Produto Genérico (Fictício - Onboarding)');
  });

  it('2. Deve configurar quebra automática de linha (linebreak) e alinhamento vertical', () => {
    generateCobrancaPDF(
      mockReceitaConsolidada,
      mockDetalhesConsolidados,
      'Fatura Consolidada (PDF)',
      '2026-09-30'
    );

    const styles = lastAutoTableOptions.styles;
    expect(styles.overflow).toBe('linebreak');
    expect(styles.valign).toBe('middle');
  });

  it('3. Deve aplicar larguras e alinhamentos adequados para cada coluna', () => {
    generateCobrancaPDF(
      mockReceitaConsolidada,
      mockDetalhesConsolidados,
      'Fatura Consolidada (PDF)',
      '2026-09-30'
    );

    const colStyles = lastAutoTableOptions.columnStyles;
    expect(colStyles[0].halign).toBe('center'); // Data centralizada
    expect(colStyles[1].halign).toBe('left');   // Descrição alinhada à esquerda com espaço para quebra
    expect(colStyles[2].halign).toBe('center'); // Quantidade
    expect(colStyles[3].halign).toBe('right');  // Valor unitário alinhado à direita
    expect(colStyles[4].halign).toBe('right');  // Subtotal alinhado à direita

    // Largura total respeitando margens A4 (182mm)
    const totalWidth = colStyles[0].cellWidth + colStyles[1].cellWidth + colStyles[2].cellWidth + colStyles[3].cellWidth + colStyles[4].cellWidth;
    expect(totalWidth).toBe(182);
  });

  it('4. Deve preservar fechamento matemático exato da Fatura Consolidada (R$ 415,62)', () => {
    generateCobrancaPDF(
      mockReceitaConsolidada,
      mockDetalhesConsolidados,
      'Fatura Consolidada (PDF)',
      '2026-09-30'
    );

    const foot = lastAutoTableOptions.foot;
    expect(foot[0][4]).toContain('415,62');

    // Total dos itens: (92,40 + 27,00 + 4,62) + (252,00 + 27,00 + 12,60) = 124,02 + 291,60 = 415,62
    const totalCalculado = 92.40 + 27.00 + 4.62 + 252.00 + 27.00 + 12.60;
    expect(totalCalculado).toBeCloseTo(415.62, 2);
  });
});
