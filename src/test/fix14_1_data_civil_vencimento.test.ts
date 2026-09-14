import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  classificarFinanceiroSync,
  processarOperacao,
} from '../utils/financeiro';

describe('FIX 14.1 — Validação de Data Civil no Faturamento Mensal', () => {
  const mockRegrasCompletas = [
    {
      id: 'regra-duplicata',
      nome: 'Boleto Padrão',
      empresa_id: null,
      modalidade_financeira: 'DUPLICATA',
      tipo_liquidacao: 'futura',
      prazo_dias: 7,
      ativo: true,
    },
    {
      id: 'regra-caixa',
      nome: 'Pix Imediato',
      empresa_id: null,
      modalidade_financeira: 'CAIXA_IMEDIATO',
      tipo_liquidacao: 'imediata',
      prazo_dias: 0,
      ativo: true,
    },
  ];

  describe('1. Datas Civis de Fechamento Mensal (Sem Conversão Indevida UTC)', () => {
    it('1.1. Operação em 13/09/2026 deve vencer estritamente em 30/09/2026', () => {
      const operacao = {
        id: 'op-set-26',
        data_operacao: '2026-09-13',
        forma_pagamento: { nome: 'Faturamento Mensal' },
        empresa_id: 'emp-benevides',
      };

      const classif = classificarFinanceiroSync(operacao, { id: 'emp-benevides' }, mockRegrasCompletas);
      expect(classif.modalidade).toBe('FECHAMENTO_MENSAL_EMPRESA');
      expect(classif.vencimento).not.toBeNull();

      const dataStr = format(classif.vencimento!, 'yyyy-MM-dd');
      expect(dataStr).toBe('2026-09-30');

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.dataVencimento).toBe('2026-09-30');
    });

    it('1.2. Operação em 05/10/2026 deve vencer estritamente em 31/10/2026', () => {
      const operacao = {
        id: 'op-out-26',
        data_operacao: '2026-10-05',
        forma_pagamento: { nome: 'Faturamento Mensal' },
        empresa_id: 'emp-benevides',
      };

      const classif = classificarFinanceiroSync(operacao, { id: 'emp-benevides' }, mockRegrasCompletas);
      const dataStr = format(classif.vencimento!, 'yyyy-MM-dd');
      expect(dataStr).toBe('2026-10-31');

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.dataVencimento).toBe('2026-10-31');
    });

    it('1.3. Operação em 10/02/2027 (fevereiro não bissexto) deve vencer estritamente em 28/02/2027', () => {
      const operacao = {
        id: 'op-fev-27',
        data_operacao: '2027-02-10',
        forma_pagamento: { nome: 'Faturamento Mensal' },
        empresa_id: 'emp-benevides',
      };

      const classif = classificarFinanceiroSync(operacao, { id: 'emp-benevides' }, mockRegrasCompletas);
      const dataStr = format(classif.vencimento!, 'yyyy-MM-dd');
      expect(dataStr).toBe('2027-02-28');

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.dataVencimento).toBe('2027-02-28');
    });

    it('1.4. Operação em 14/02/2028 (fevereiro bissexto) deve vencer estritamente em 29/02/2028', () => {
      const operacao = {
        id: 'op-fev-28',
        data_operacao: '2028-02-14',
        forma_pagamento: { nome: 'Faturamento Mensal' },
        empresa_id: 'emp-benevides',
      };

      const classif = classificarFinanceiroSync(operacao, { id: 'emp-benevides' }, mockRegrasCompletas);
      const dataStr = format(classif.vencimento!, 'yyyy-MM-dd');
      expect(dataStr).toBe('2028-02-29');

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.dataVencimento).toBe('2028-02-29');
    });
  });

  describe('2. Não-Regressão de Outras Modalidades', () => {
    it('2.1. DUPLICATA continua respeitando prazo D+ configurado (D+7)', () => {
      const operacao = {
        id: 'op-dup',
        data_operacao: '2026-09-13',
        forma_pagamento: { nome: 'BOLETO BANCÁRIO' },
        empresa_id: 'emp-benevides',
      };

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.modalidadeFinanceira).toBe('DUPLICATA_FORNECEDOR');
      expect(processado.dataVencimento).toBe('2026-09-20');
    });

    it('2.2. CAIXA_IMEDIATO permanece inalterado (vencimento = data_operacao)', () => {
      const operacao = {
        id: 'op-caixa',
        data_operacao: '2026-09-13',
        forma_pagamento: { nome: 'PIX IMEDIATO' },
        empresa_id: 'emp-benevides',
      };

      const processado = processarOperacao(operacao, [{ id: 'emp-benevides' }], mockRegrasCompletas);
      expect(processado.modalidadeFinanceira).toBe('CAIXA_IMEDIATO');
      expect(processado.dataVencimento).toBe('2026-09-13');
    });
  });
});
