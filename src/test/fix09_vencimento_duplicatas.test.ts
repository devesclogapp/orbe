import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolverPrazoDias,
  classificarFinanceiroSync,
  setCachedRegrasFinanceiras,
  processarOperacao,
} from '../utils/financeiro';
import { OperacaoProducaoService } from '../services/domain/producao.service';

describe('FIX 09 — Prazos de Vencimento e Source of Truth de Duplicatas', () => {
  const mockRegrasGlobais = [
    {
      id: 'regra-global-caixa',
      nome: 'Pagamento à Vista (Caixa)',
      empresa_id: null,
      modalidade_financeira: 'CAIXA_IMEDIATO',
      tipo_liquidacao: 'imediata',
      prazo_dias: 0,
      ativo: true,
    },
    {
      id: 'regra-global-duplicata',
      nome: 'Pagamento a Prazo (Boleto)',
      empresa_id: null,
      modalidade_financeira: 'DUPLICATA',
      tipo_liquidacao: 'futura',
      prazo_dias: 7, // D+7 da regra global no banco
      ativo: true,
    },
  ];

  const mockRegrasComEmpresas = [
    ...mockRegrasGlobais,
    {
      id: 'regra-empresa-a',
      nome: 'Boleto Empresa A',
      empresa_id: 'empresa-a-uuid',
      modalidade_financeira: 'DUPLICATA',
      tipo_liquidacao: 'futura',
      prazo_dias: 15, // D+15 personalizado
      ativo: true,
    },
    {
      id: 'regra-empresa-b',
      nome: 'Boleto Empresa B',
      empresa_id: 'empresa-b-uuid',
      modalidade_financeira: 'DUPLICATA',
      tipo_liquidacao: 'futura',
      prazo_dias: 30, // D+30 personalizado
      ativo: true,
    },
  ];

  beforeEach(() => {
    setCachedRegrasFinanceiras([]);
  });

  describe('1. resolverPrazoDias — Hierarquia de Prazos', () => {
    it('deve retornar o prazo específico da empresa quando existir (D+15 para Empresa A)', () => {
      const prazo = resolverPrazoDias({
        modalidade: 'DUPLICATA',
        empresaId: 'empresa-a-uuid',
        regrasFinanceiras: mockRegrasComEmpresas,
      });
      expect(prazo).toBe(15);
    });

    it('deve retornar o prazo específico da empresa quando existir (D+30 para Empresa B)', () => {
      const prazo = resolverPrazoDias({
        modalidade: 'DUPLICATA',
        empresaId: 'empresa-b-uuid',
        regrasFinanceiras: mockRegrasComEmpresas,
      });
      expect(prazo).toBe(30);
    });

    it('deve recorrer à regra padrão global quando a empresa não tiver regra específica (D+7)', () => {
      const prazo = resolverPrazoDias({
        modalidade: 'DUPLICATA',
        empresaId: 'empresa-sem-regra-uuid',
        regrasFinanceiras: mockRegrasComEmpresas,
      });
      expect(prazo).toBe(7);
    });

    it('deve retornar null explicitamente quando não houver regra configurada (sem D+7 hardcoded)', () => {
      const prazo = resolverPrazoDias({
        modalidade: 'DUPLICATA',
        empresaId: 'empresa-qualquer',
        regrasFinanceiras: [], // Nenhuma regra no banco
      });
      expect(prazo).toBeNull();
    });
  });

  describe('2. classificarFinanceiroSync — Source of Truth e Resolução de Vencimento', () => {
    it('Cenário 1 (Source of Truth): deve priorizar operacao.data_vencimento física gravada no lançamento', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        data_vencimento: '2026-09-25', // Source of truth gravada
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
        empresa_id: 'empresa-a-uuid',
      };

      const res = classificarFinanceiroSync(operacao, { id: 'empresa-a-uuid' }, mockRegrasComEmpresas);
      expect(res.modalidade).toBe('DUPLICATA_FORNECEDOR');
      expect(res.vencimento).toEqual(new Date('2026-09-25T12:00:00Z'));
    });

    it('Cenário 2 (Override manual): deve respeitar override manual quando não houver data_vencimento física', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        avaliacao_json: {
          contexto_importacao: {
            data_vencimento_override: '2026-09-22',
          },
        },
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
      };

      const res = classificarFinanceiroSync(operacao, {}, mockRegrasComEmpresas);
      expect(res.vencimento).toEqual(new Date('2026-09-22T12:00:00Z'));
    });

    it('Cenário 3 (Regra por Empresa): calcula vencimento com D+15 para Empresa A', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
        empresa_id: 'empresa-a-uuid',
      };

      const res = classificarFinanceiroSync(operacao, { id: 'empresa-a-uuid' }, mockRegrasComEmpresas);
      expect(res.vencimento).toEqual(new Date('2026-09-27T12:00:00Z')); // 12 + 15 = 27/09
    });

    it('Cenário 4 (Regra Global): calcula vencimento com D+7 para empresa sem regra individual', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
        empresa_id: 'empresa-padrao-uuid',
      };

      const res = classificarFinanceiroSync(operacao, { id: 'empresa-padrao-uuid' }, mockRegrasComEmpresas);
      expect(res.vencimento).toEqual(new Date('2026-09-19T12:00:00Z')); // 12 + 7 = 19/09
    });

    it('Cenário 5 (Caixa Imediato): vencimento é a própria data da operação', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'PIX' },
      };

      const res = classificarFinanceiroSync(operacao, {}, mockRegrasComEmpresas);
      expect(res.modalidade).toBe('CAIXA_IMEDIATO');
      expect(res.vencimento).toEqual(new Date('2026-09-12T12:00:00Z'));
    });

    it('Cenário 6 (Ausência de Configuração): não gera data fantasma e retorna null', () => {
      const operacao = {
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
      };

      const res = classificarFinanceiroSync(operacao, {}, []); // Sem regras
      expect(res.vencimento).toBeNull();
    });
  });

  describe('3. processarOperacao — Compatibilidade e Formatação', () => {
    it('deve formatar dataVencimento como string YYYY-MM-DD quando calculada', () => {
      const operacao = {
        id: 'op-1',
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
        empresa_id: 'empresa-a-uuid',
      };

      const processado = processarOperacao(operacao, [{ id: 'empresa-a-uuid' }], mockRegrasComEmpresas);
      expect(processado.dataVencimento).toBe('2026-09-27');
      expect(processado.modalidadeFinanceira).toBe('DUPLICATA_FORNECEDOR');
    });

    it('deve manter dataVencimento como null sem quebrar quando não houver regra', () => {
      const operacao = {
        id: 'op-2',
        data_operacao: '2026-09-12',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
      };

      const processado = processarOperacao(operacao, [], []);
      expect(processado.dataVencimento).toBeNull();
      expect(processado.statusPagamento).toBe('PENDENTE');
    });
  });

  describe('4. OperacaoProducaoService — Preservação de data_vencimento', () => {
    it('sanitizeOperacaoPayload deve preservar data_vencimento no payload', () => {
      const service = OperacaoProducaoService as any;
      const rawPayload = {
        empresa_id: 'emp-1',
        data_operacao: '2026-09-12',
        data_vencimento: '2026-09-19',
        tipo_servico_id: 'srv-1',
        quantidade: 10,
        horario_inicio: '08:00',
        horario_fim: '12:00',
      };

      const sanitized = service.sanitizeOperacaoPayload(rawPayload);
      expect(sanitized.data_vencimento).toBe('2026-09-19');
      expect(sanitized.entrada_ponto).toBe('08:00');
      expect(sanitized.saida_ponto).toBe('12:00');
    });
  });
});
