import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDateOnly } from '../utils/financeiro';

let lastCreatedDoc: any = null;
let lastAutoTableOptions: any = null;

// Mock jsPDF e jspdf-autotable para capturar chamadas e validar o texto gerado
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

describe('FIX 10 & 10.1 — Auditoria do Documento de Cobrança / Fatura Comercial (PDF)', () => {
  beforeEach(() => {
    lastCreatedDoc = null;
    lastAutoTableOptions = null;
  });

  describe('1. formatDateOnly — Imunidade a Timezone para PostgreSQL DATE', () => {
    it('deve formatar 2026-09-13 estritamente como 13/09/2026 sem recuar -1 dia', () => {
      const result = formatDateOnly('2026-09-13');
      expect(result).toBe('13/09/2026');
    });

    it('deve formatar a data de vencimento 2026-09-28 estritamente como 28/09/2026', () => {
      const result = formatDateOnly('2026-09-28');
      expect(result).toBe('28/09/2026');
    });

    it('deve retornar hífen para valores nulos, vazios ou indefinidos', () => {
      expect(formatDateOnly(null)).toBe('-');
      expect(formatDateOnly(undefined)).toBe('-');
      expect(formatDateOnly('')).toBe('-');
    });

    it('deve aceitar strings ISO com sufixo temporal extraindo os 10 primeiros caracteres', () => {
      expect(formatDateOnly('2026-09-13T00:00:00Z')).toBe('13/09/2026');
    });
  });

  describe('2. Memória de Cálculo e Fechamento Matemático (FIX 10.1)', () => {
    // Cenário Real Homologado no Banco:
    // Operação cad8552a-5fc1-47f4-9ca7-77f27e12bea5 (BENEVIDES)
    // valor_total_materiais = 27.00, valor_total_filme = 0 (default DB)
    const mockReceitaHomologacao = {
      id: '1caa3450-d445-4ab9-930c-9c4ef2ac8076',
      empresas: { nome: 'BENEVIDES' },
      competencia: '2026-09',
      vencimento: '2026-09-28',
      valor_total: 159.30,
      modalidade: 'DUPLICATA',
      status: 'pendente_cobranca'
    };

    const mockDetalhesHomologacao = {
      receitas_operacionais_itens: [
        {
          id: 'item-1-uuid',
          valor_item: 159.30,
          operacoes_producao: {
            id: 'cad8552a-5fc1-47f4-9ca7-77f27e12bea5',
            data_operacao: '2026-09-13',
            quantidade: 300,
            valor_unitario_snapshot: 0.42,
            valor_descarga: 126.00,
            valor_total_materiais: 27.00, // Coluna real utilizada no cadastro/lançamento
            valor_total_filme: 0,        // Default no schema PostgreSQL (não deve bloquear valor_total_materiais)
            custo_com_iss: 6.30,
            percentual_iss: 0.05,
            valor_total: 159.30,
            servicos: { nome: 'Descarga' },
            produtos: { nome: 'Carga Geral' }
          }
        }
      ]
    };

    it('deve exibir a linha de Materiais com R$ 27,00 mesmo quando valor_total_filme for 0', () => {
      generateCobrancaPDF(
        mockReceitaHomologacao,
        mockDetalhesHomologacao,
        'Fatura Comercial (PDF)',
        '2026-09-28'
      );

      expect(lastAutoTableOptions).toBeDefined();

      const rows = lastAutoTableOptions.body;
      expect(rows).toHaveLength(3); // 1: Descarga, 2: Materiais, 3: ISS

      // Linha 1: Descarga (Qtd 300 x R$ 0,42 = R$ 126,00)
      const [data, desc, qtd, vUnit, subtotal] = rows[0];
      expect(data).toBe('13/09/2026'); // Imune ao fuso!
      expect(desc).toContain('Descarga');
      expect(qtd).toBe('300');
      expect(vUnit).toContain('0,42');
      expect(vUnit).not.toContain('0,53'); // Não mascara dividindo total por quantidade!
      expect(subtotal).toContain('126,00');

      // Linha 2: Materiais (R$ 27,00)
      const [, descMat, , , subtotalMat] = rows[1];
      expect(descMat).toBe('Materiais');
      expect(subtotalMat).toContain('27,00');

      // Linha 3: ISS (R$ 6,30)
      const [, descIss, , , subtotalIss] = rows[2];
      expect(descIss).toBe('ISS (5%)');
      expect(subtotalIss).toContain('6,30');

      // Rodapé da Tabela: Total R$ 159,30
      const foot = lastAutoTableOptions.foot;
      expect(foot[0][4]).toContain('159,30');

      // Fechamento Matemático Estrito:
      const vServico = 126.00;
      const vMateriais = 27.00;
      const vIss = 6.30;
      const vTotalEsperado = 159.30;
      expect(vServico + vMateriais + vIss).toBeCloseTo(vTotalEsperado, 2);
    });

    it('deve omitir linhas de Materiais ou ISS caso os respectivos valores sejam 0', () => {
      const mockSemOpcionais = {
        receitas_operacionais_itens: [
          {
            id: 'item-2-uuid',
            valor_item: 126.00,
            operacoes_producao: {
              id: 'op-pura',
              data_operacao: '2026-09-13',
              quantidade: 300,
              valor_unitario_snapshot: 0.42,
              valor_descarga: 126.00,
              valor_total_materiais: 0,
              valor_total_filme: 0,
              custo_com_iss: 0,
              valor_total: 126.00,
              servicos: { nome: 'Descarga' }
            }
          }
        ]
      };

      generateCobrancaPDF(
        { ...mockReceitaHomologacao, valor_total: 126.00 },
        mockSemOpcionais,
        'Fatura Comercial (PDF)',
        '2026-09-28'
      );

      const rows = lastAutoTableOptions.body;
      expect(rows).toHaveLength(1); // Apenas a linha de Descarga
      expect(rows[0][0]).toBe('13/09/2026');
      expect(rows[0][4]).toContain('126,00');
    });
  });

  describe('3. Remoção de Dados Fictícios e Semântica Honesta', () => {
    const mockReceita = {
      id: '1caa3450-d445-4ab9-930c-9c4ef2ac8076',
      empresas: { nome: 'BENEVIDES' },
      competencia: '2026-09',
      vencimento: '2026-09-28',
      valor_total: 159.30
    };

    it('não deve conter chave PIX ou CNPJ fictício 00.000.000/0001-00', () => {
      generateCobrancaPDF(
        mockReceita,
        { receitas_operacionais_itens: [] },
        'Fatura Comercial (PDF)',
        '2026-09-28'
      );

      expect(lastCreatedDoc).toBeDefined();
      const allTexts = lastCreatedDoc.__calls.text.join(' ');

      expect(allTexts).not.toContain('00.000.000/0001-00');
      expect(allTexts).not.toContain('Pagamento via PIX');
      expect(allTexts).not.toContain('Boleto (PDF)');

      // Deve conter semântica legítima de Fatura Comercial
      expect(allTexts).toContain('Formato: Fatura Comercial (PDF)');
      expect(allTexts).toContain('Fatura referente aos serviços operacionais prestados.');
      expect(allTexts).toContain('Pagamento conforme condições comerciais acordadas.');
      expect(allTexts).toContain('28/09/2026'); // Vencimento preservado
    });
  });
});
