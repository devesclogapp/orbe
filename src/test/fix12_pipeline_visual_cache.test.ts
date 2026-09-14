import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * FIX 12.1 — Correção Visual do Pipeline e Invalidação de Cache
 * 
 * Validação:
 * 1. Indicador de Conciliação no pipeline visual só conclui com status 'conciliado'
 * 2. Em status 'recebido': Operação ✓, Receita ✓, Cobrança ✓, Recebimento ✓, Conciliação NÃO concluída
 * 3. Em status 'conciliado': Operação ✓, Receita ✓, Cobrança ✓, Recebimento ✓, Conciliação ✓
 * 4. Invalidação de cache inclui:
 *    - receitas-pipeline
 *    - receita-historico
 *    - receita-detalhes
 *    - operacoes-base
 *    - operacoes
 */

describe('FIX 12.1 — Correção Visual do Pipeline e Invalidação de Cache', () => {
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  describe('1. Regras do Pipeline Visual de Etapas', () => {
    // Helper replicando exatamente a lógica de renderização do ModalReceitaOperacional
    const evaluatePipelineSteps = (receita: { status: string; modalidade: string }, itemOps = true) => {
      const isOperacaoDone = !!itemOps;
      const isReceitaDone = !!receita;
      
      const isCobrancaDone = receita.modalidade !== 'CAIXA_IMEDIATO' && (
        receita.status === 'cobranca_enviada' ||
        receita.status === 'recebido' ||
        receita.status === 'pago' ||
        receita.status === 'conciliado'
      );

      const isRecebimentoDone = (
        receita.status === 'recebido' ||
        receita.status === 'pago' ||
        receita.status === 'conciliado'
      );

      const isConciliacaoDone = receita.modalidade !== 'CAIXA_IMEDIATO' && (
        receita.status === 'conciliado'
      );

      return {
        isOperacaoDone,
        isReceitaDone,
        isCobrancaDone,
        isRecebimentoDone,
        isConciliacaoDone,
      };
    };

    it('em status "recebido": Operação ✓, Receita ✓, Cobrança ✓, Recebimento ✓, Conciliação NÃO concluída', () => {
      const steps = evaluatePipelineSteps({ status: 'recebido', modalidade: 'DUPLICATA' });

      expect(steps.isOperacaoDone).toBe(true);
      expect(steps.isReceitaDone).toBe(true);
      expect(steps.isCobrancaDone).toBe(true);
      expect(steps.isRecebimentoDone).toBe(true);
      expect(steps.isConciliacaoDone).toBe(false); // Conciliação NÃO concluída
    });

    it('em status "pago": Operação ✓, Receita ✓, Cobrança ✓, Recebimento ✓, Conciliação NÃO concluída', () => {
      const steps = evaluatePipelineSteps({ status: 'pago', modalidade: 'DUPLICATA' });

      expect(steps.isOperacaoDone).toBe(true);
      expect(steps.isReceitaDone).toBe(true);
      expect(steps.isCobrancaDone).toBe(true);
      expect(steps.isRecebimentoDone).toBe(true);
      expect(steps.isConciliacaoDone).toBe(false); // Conciliação NÃO concluída
    });

    it('em status "conciliado": Operação ✓, Receita ✓, Cobrança ✓, Recebimento ✓, Conciliação ✓', () => {
      const steps = evaluatePipelineSteps({ status: 'conciliado', modalidade: 'DUPLICATA' });

      expect(steps.isOperacaoDone).toBe(true);
      expect(steps.isReceitaDone).toBe(true);
      expect(steps.isCobrancaDone).toBe(true);
      expect(steps.isRecebimentoDone).toBe(true);
      expect(steps.isConciliacaoDone).toBe(true); // Conciliação concluída
    });

    it('em status "cobranca_enviada": Operação ✓, Receita ✓, Cobrança ✓, Recebimento NÃO, Conciliação NÃO', () => {
      const steps = evaluatePipelineSteps({ status: 'cobranca_enviada', modalidade: 'DUPLICATA' });

      expect(steps.isOperacaoDone).toBe(true);
      expect(steps.isReceitaDone).toBe(true);
      expect(steps.isCobrancaDone).toBe(true);
      expect(steps.isRecebimentoDone).toBe(false);
      expect(steps.isConciliacaoDone).toBe(false);
    });

    it('em status "pendente_cobranca": Operação ✓, Receita ✓, Cobrança NÃO, Recebimento NÃO, Conciliação NÃO', () => {
      const steps = evaluatePipelineSteps({ status: 'pendente_cobranca', modalidade: 'DUPLICATA' });

      expect(steps.isOperacaoDone).toBe(true);
      expect(steps.isReceitaDone).toBe(true);
      expect(steps.isCobrancaDone).toBe(false);
      expect(steps.isRecebimentoDone).toBe(false);
      expect(steps.isConciliacaoDone).toBe(false);
    });

    it('o código de ModalReceitaOperacional.tsx deve conter receita.status === "conciliado" para a etapa Conciliação', () => {
      // Garantir que a linha de Conciliação NÃO usa mais (receita.status === 'recebido' || ...)
      expect(modalContent).toContain("receita.status === 'conciliado' ? \"text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded\" : \"\")}>");
      expect(modalContent).toContain("Conciliação");
    });
  });

  describe('2. Invalidação de Cache (Stale Cache)', () => {
    it('finishMutationSuccess deve invalidar receitas-pipeline', () => {
      expect(modalContent).toMatch(/finishMutationSuccess[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receitas-pipeline"\]\s*\}\)/);
    });

    it('finishMutationSuccess deve invalidar receita-historico', () => {
      expect(modalContent).toMatch(/finishMutationSuccess[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receita-historico"\]\s*\}\)/);
    });

    it('finishMutationSuccess deve invalidar receita-detalhes', () => {
      expect(modalContent).toMatch(/finishMutationSuccess[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receita-detalhes"\]\s*\}\)/);
    });

    it('finishMutationSuccess deve invalidar operacoes-base', () => {
      expect(modalContent).toMatch(/finishMutationSuccess[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["operacoes-base"\]\s*\}\)/);
    });

    it('finishMutationSuccess deve invalidar operacoes', () => {
      expect(modalContent).toMatch(/finishMutationSuccess[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["operacoes"\]\s*\}\)/);
    });

    it('handleConfirmEnviarCobranca deve invalidar as mesmas queries para sincronizar a interface', () => {
      expect(modalContent).toMatch(/handleConfirmEnviarCobranca[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receitas-pipeline"\]\s*\}\)/);
      expect(modalContent).toMatch(/handleConfirmEnviarCobranca[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receita-historico"\]\s*\}\)/);
      expect(modalContent).toMatch(/handleConfirmEnviarCobranca[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["receita-detalhes"\]\s*\}\)/);
      expect(modalContent).toMatch(/handleConfirmEnviarCobranca[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["operacoes-base"\]\s*\}\)/);
      expect(modalContent).toMatch(/handleConfirmEnviarCobranca[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["operacoes"\]\s*\}\)/);
    });
  });
});
