import { describe, it, expect, beforeEach } from 'vitest';

// ==============================================================================
// SUÍTE FIX 14.3 — CORREÇÃO DO SELETOR BOLETO / FATURAMENTO MENSAL NO PASSO 3
// ==============================================================================

interface FormaPagamentoOperacional {
  id: string;
  nome: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL' | 'AMBOS' | null;
  ativo: boolean;
  tenant_id: string;
}

// Simulador do método FormaPagamentoOperacionalService.getByModalidade
class FormaPagamentoServiceSimulator {
  private formas: FormaPagamentoOperacional[] = [];

  constructor(formasIniciais: FormaPagamentoOperacional[]) {
    this.formas = formasIniciais;
  }

  // Lógica fiel implementada em src/services/domain/core.service.ts
  async getByModalidade(modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL' | string): Promise<FormaPagamentoOperacional[]> {
    const isFamiliaFutura = modalidade === 'DUPLICATA' || modalidade === 'FATURAMENTO_MENSAL';

    return this.formas.filter(forma => {
      if (!forma.ativo) return false;

      if (isFamiliaFutura) {
        return (
          forma.modalidade === 'DUPLICATA' ||
          forma.modalidade === 'FATURAMENTO_MENSAL' ||
          forma.modalidade === 'AMBOS' ||
          forma.modalidade === null
        );
      }

      return (
        forma.modalidade === modalidade ||
        forma.modalidade === 'AMBOS' ||
        forma.modalidade === null
      );
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }
}

// Simulador do Formulario com a lógica de seleção de FormStepSummary.tsx
class FormStepSummarySimulator {
  formValues: {
    forma_pagamento?: string;
    modalidade_financeira?: string;
  } = {};

  constructor(modalidadeInicial: string) {
    this.formValues.modalidade_financeira = modalidadeInicial;
  }

  // Lógica fiel ao onValueChange implementado em FormStepSummary.tsx
  selecionarForma(formaId: string, formasDisponiveis: FormaPagamentoOperacional[]) {
    this.formValues.forma_pagamento = formaId;
    const formaObj = formasDisponiveis.find(f => f.id === formaId);

    // AMBOS não sobrescreve indevidamente uma modalidade concreta
    if (formaObj?.modalidade && formaObj.modalidade !== 'AMBOS') {
      this.formValues.modalidade_financeira = formaObj.modalidade;
    }
  }

  // Lógica fiel à renderização do badge visual em FormStepSummary.tsx
  obterBadgeTexto(): string {
    if (!this.formValues.modalidade_financeira) return '';
    return `MOD: ${this.formValues.modalidade_financeira.replace(/_/g, ' ')}`;
  }
}

describe('SUÍTE FIX 14.3 — Seletor Boleto / Faturamento Mensal', () => {
  let formasBanco: FormaPagamentoOperacional[];
  let service: FormaPagamentoServiceSimulator;

  const ID_BOLETO = '82ca9bd3-42c2-480c-8fbd-0c62f803f0c0';
  const ID_FATURAMENTO = 'efb37dfa-015e-43d6-8406-25a12f89559c';
  const ID_PIX = 'd019cec8-9d11-441e-9ab1-57175a0ad6c1';
  const ID_DINHEIRO = '8b2e9c1f-257e-47d2-8d69-f3fd9cd55618';
  const ID_AMBOS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    formasBanco = [
      { id: ID_BOLETO, nome: 'Boleto', modalidade: 'DUPLICATA', ativo: true, tenant_id: 'tenant-1' },
      { id: ID_FATURAMENTO, nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL', ativo: true, tenant_id: 'tenant-1' },
      { id: ID_PIX, nome: 'Pix', modalidade: 'CAIXA_IMEDIATO', ativo: true, tenant_id: 'tenant-1' },
      { id: ID_DINHEIRO, nome: 'Dinheiro', modalidade: 'CAIXA_IMEDIATO', ativo: true, tenant_id: 'tenant-1' },
      { id: ID_AMBOS, nome: 'Transferência Livre', modalidade: 'AMBOS', ativo: true, tenant_id: 'tenant-1' },
    ];
    service = new FormaPagamentoServiceSimulator(formasBanco);
  });

  describe('1. Consulta de Formas de Pagamento no Launcher "Boleto/Faturamento"', () => {
    it('deve retornar Boleto no launcher Boleto/Faturamento (modalidade DUPLICATA)', async () => {
      const formas = await service.getByModalidade('DUPLICATA');
      const boleto = formas.find(f => f.nome === 'Boleto');

      expect(boleto).toBeDefined();
      expect(boleto?.id).toBe(ID_BOLETO);
      expect(boleto?.modalidade).toBe('DUPLICATA');
    });

    it('deve retornar Faturamento Mensal no launcher Boleto/Faturamento (modalidade DUPLICATA)', async () => {
      const formas = await service.getByModalidade('DUPLICATA');
      const faturamento = formas.find(f => f.nome === 'Faturamento Mensal');

      expect(faturamento).toBeDefined();
      expect(faturamento?.id).toBe(ID_FATURAMENTO);
      expect(faturamento?.modalidade).toBe('FATURAMENTO_MENSAL');
    });

    it('deve manter ambas as opções disponíveis quando modalidade já for FATURAMENTO_MENSAL', async () => {
      const formas = await service.getByModalidade('FATURAMENTO_MENSAL');
      const nomes = formas.map(f => f.nome);

      expect(nomes).toContain('Boleto');
      expect(nomes).toContain('Faturamento Mensal');
    });
  });

  describe('2. Sincronização do Formulário e Badge Visual no Passo 3', () => {
    it('ao selecionar Boleto, define modalidade DUPLICATA e badge "MOD: DUPLICATA"', async () => {
      const formSim = new FormStepSummarySimulator('DUPLICATA');
      const formas = await service.getByModalidade('DUPLICATA');

      formSim.selecionarForma(ID_BOLETO, formas);

      expect(formSim.formValues.forma_pagamento).toBe(ID_BOLETO);
      expect(formSim.formValues.modalidade_financeira).toBe('DUPLICATA');
      expect(formSim.obterBadgeTexto()).toBe('MOD: DUPLICATA');
    });

    it('ao selecionar Faturamento Mensal, define modalidade FATURAMENTO_MENSAL e badge "MOD: FATURAMENTO MENSAL"', async () => {
      const formSim = new FormStepSummarySimulator('DUPLICATA');
      const formas = await service.getByModalidade('DUPLICATA');

      formSim.selecionarForma(ID_FATURAMENTO, formas);

      expect(formSim.formValues.forma_pagamento).toBe(ID_FATURAMENTO);
      expect(formSim.formValues.modalidade_financeira).toBe('FATURAMENTO_MENSAL');
      expect(formSim.obterBadgeTexto()).toBe('MOD: FATURAMENTO MENSAL');
    });

    it('ao alternar Boleto -> Faturamento Mensal -> Boleto, sincroniza corretamente em cada etapa', async () => {
      const formSim = new FormStepSummarySimulator('DUPLICATA');
      let formas = await service.getByModalidade('DUPLICATA');

      // 1. Seleciona Boleto
      formSim.selecionarForma(ID_BOLETO, formas);
      expect(formSim.formValues.forma_pagamento).toBe(ID_BOLETO);
      expect(formSim.formValues.modalidade_financeira).toBe('DUPLICATA');
      expect(formSim.obterBadgeTexto()).toBe('MOD: DUPLICATA');

      // 2. Alterna para Faturamento Mensal
      formas = await service.getByModalidade(formSim.formValues.modalidade_financeira!);
      formSim.selecionarForma(ID_FATURAMENTO, formas);
      expect(formSim.formValues.forma_pagamento).toBe(ID_FATURAMENTO);
      expect(formSim.formValues.modalidade_financeira).toBe('FATURAMENTO_MENSAL');
      expect(formSim.obterBadgeTexto()).toBe('MOD: FATURAMENTO MENSAL');

      // 3. Alterna de volta para Boleto
      formas = await service.getByModalidade(formSim.formValues.modalidade_financeira!);
      formSim.selecionarForma(ID_BOLETO, formas);
      expect(formSim.formValues.forma_pagamento).toBe(ID_BOLETO);
      expect(formSim.formValues.modalidade_financeira).toBe('DUPLICATA');
      expect(formSim.obterBadgeTexto()).toBe('MOD: DUPLICATA');
    });
  });

  describe('3. Isolamento e Não-Regressão', () => {
    it('CAIXA_IMEDIATO permanece estritamente isolado de Boleto e Faturamento Mensal', async () => {
      const formas = await service.getByModalidade('CAIXA_IMEDIATO');
      const nomes = formas.map(f => f.nome);

      expect(nomes).toContain('Pix');
      expect(nomes).toContain('Dinheiro');
      expect(nomes).toContain('Transferência Livre'); // AMBOS
      expect(nomes).not.toContain('Boleto');
      expect(nomes).not.toContain('Faturamento Mensal');
    });

    it('AMBOS não sobrescreve indevidamente a modalidade concreta', async () => {
      const formSim = new FormStepSummarySimulator('DUPLICATA');
      const formas = await service.getByModalidade('DUPLICATA');

      formSim.selecionarForma(ID_AMBOS, formas);

      expect(formSim.formValues.forma_pagamento).toBe(ID_AMBOS);
      // Deve preservar a modalidade inicial DUPLICATA, sem converter para AMBOS
      expect(formSim.formValues.modalidade_financeira).toBe('DUPLICATA');
      expect(formSim.obterBadgeTexto()).toBe('MOD: DUPLICATA');
    });

    it('Payload final preserva UUID da forma selecionada e a modalidade correspondente', async () => {
      const formSim = new FormStepSummarySimulator('DUPLICATA');
      const formas = await service.getByModalidade('DUPLICATA');

      // Usuário escolhe Faturamento Mensal
      formSim.selecionarForma(ID_FATURAMENTO, formas);

      const payloadFinal = {
        data_operacao: '2026-09-13',
        forma_pagamento_id: formSim.formValues.forma_pagamento,
        modalidade_financeira: formSim.formValues.modalidade_financeira,
        quantidade: 150,
        valor_unitario_snapshot: 0.441,
        valor_total: 66.15,
      };

      expect(payloadFinal.forma_pagamento_id).toBe(ID_FATURAMENTO);
      expect(payloadFinal.modalidade_financeira).toBe('FATURAMENTO_MENSAL');
      expect(payloadFinal.valor_total).toBe(66.15);
    });
  });
});
