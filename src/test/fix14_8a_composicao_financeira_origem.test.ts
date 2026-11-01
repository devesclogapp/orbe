import { describe, it, expect } from 'vitest';
import { calcularValoresOperacao } from '@/utils/financeiro';

// ==============================================================================
// SUÍTE FIX 14.8A — UNIFICAÇÃO DA COMPOSIÇÃO FINANCEIRA NA ORIGEM
// ==============================================================================

describe('FIX 14.8A — Regra Financeira Canônica para Operações por Volume', () => {
  // Cenário base da auditoria FIX 14.8
  const CENARIO_AUDITORIA = {
    quantidade: 150,
    valorUnitario: 0.42,
    issPercentual: 5,
    nfRaw: 'SIM',
    materiais: 0,
  };

  it('1. Deve calcular exatamente o cenário da auditoria: 150 × 0,42 = 63,00 + ISS 5% (3,15) = R$ 66,15', () => {
    const res = calcularValoresOperacao({
      quantidade: CENARIO_AUDITORIA.quantidade,
      valorUnitario: CENARIO_AUDITORIA.valorUnitario,
      percentualIss: CENARIO_AUDITORIA.issPercentual / 100,
      nfRaw: CENARIO_AUDITORIA.nfRaw,
      valorTotalMateriais: CENARIO_AUDITORIA.materiais,
    });

    expect(res.valorDescargaCalculado).toBe(63.00);
    expect(res.percentualCalculado).toBe(0.05);
    expect(res.custoIssCalculado).toBe(3.15);
    expect(res.valorTotalMateriais).toBe(0.00);
    expect(res.totalFinalCalculado).toBe(66.15);
  });

  it('2. Deve aceitar percentualIss tanto em formato decimal (0.05) quanto inteiro (5)', () => {
    const resDecimal = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      percentualIss: 0.05,
      nfRaw: 'SIM',
    });

    const resInteiro = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      percentualIss: 5,
      nfRaw: 'SIM',
    });

    expect(resDecimal.custoIssCalculado).toBe(3.15);
    expect(resDecimal.totalFinalCalculado).toBe(66.15);

    expect(resInteiro.custoIssCalculado).toBe(3.15);
    expect(resInteiro.totalFinalCalculado).toBe(66.15);
  });

  it('3. Deve preservar comportamento quando NÃO há ISS (nf_emite = false ou nfRaw = "NÃO")', () => {
    const resNao = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      percentualIss: 0.05,
      nfRaw: 'NÃO',
      valorTotalMateriais: 0,
    });

    expect(resNao.valorDescargaCalculado).toBe(63.00);
    expect(resNao.percentualCalculado).toBe(0);
    expect(resNao.custoIssCalculado).toBe(0);
    expect(resNao.totalFinalCalculado).toBe(63.00);

    const resVazio = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      nfRaw: '',
    });
    expect(resVazio.custoIssCalculado).toBe(0);
    expect(resVazio.totalFinalCalculado).toBe(63.00);

    const resFalse = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      nfRaw: 'FALSE',
    });
    expect(resFalse.custoIssCalculado).toBe(0);
    expect(resFalse.totalFinalCalculado).toBe(63.00);
  });

  it('4. Deve preservar comportamento quando há ISS + materiais', () => {
    const res = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      percentualIss: 0.05,
      nfRaw: 'SIM',
      valorTotalMateriais: 27.00,
    });

    expect(res.valorDescargaCalculado).toBe(63.00);
    expect(res.custoIssCalculado).toBe(3.15);
    expect(res.valorTotalMateriais).toBe(27.00);
    // 63.00 (descarga) + 3.15 (ISS) + 27.00 (materiais) = 93.15
    expect(res.totalFinalCalculado).toBe(93.15);
  });

  it('5. Deve preservar comportamento quando há somente serviço (sem ISS e sem materiais)', () => {
    const res = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      nfRaw: 'NÃO',
      valorTotalMateriais: 0,
    });

    expect(res.valorDescargaCalculado).toBe(63.00);
    expect(res.custoIssCalculado).toBe(0);
    expect(res.valorTotalMateriais).toBe(0);
    expect(res.totalFinalCalculado).toBe(63.00);
  });

  describe('Unificação across modalidades financeiras', () => {
    const modalidades = ['CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL'] as const;

    modalidades.forEach((mod) => {
      it(`Deve aplicar a mesma composição canônica para a modalidade ${mod}`, () => {
        // Simulando a extração do payload no OperacaoForm para cada modalidade
        const formData = {
          modalidade_financeira: mod,
          quantidade: 150,
          valor_unitario: 0.42,
          iss_percentual: 5,
          nf_emite: true,
        };

        const selectedMateriais: any[] = [];
        const totalMateriais = selectedMateriais.reduce((acc, m) => acc + m.valor_total, 0);

        const valoresCalculados = calcularValoresOperacao({
          quantidade: Number(formData.quantidade),
          valorUnitario: Number(formData.valor_unitario),
          percentualIss: Number(formData.iss_percentual) / 100,
          nfRaw: formData.nf_emite ? 'SIM' : 'NÃO',
          valorTotalMateriais: totalMateriais,
        });

        const payload = {
          modalidade_financeira: formData.modalidade_financeira,
          valor_unitario_snapshot: formData.valor_unitario,
          percentual_iss: valoresCalculados.percentualCalculado,
          custo_com_iss: valoresCalculados.custoIssCalculado,
          valor_total_materiais: valoresCalculados.valorTotalMateriais,
          valor_total: valoresCalculados.totalFinalCalculado,
          valor_descarga: valoresCalculados.valorDescargaCalculado,
        };

        expect(payload.valor_descarga).toBe(63.00);
        expect(payload.custo_com_iss).toBe(3.15);
        expect(payload.valor_total_materiais).toBe(0);
        expect(payload.valor_total).toBe(66.15);
      });

      it(`Deve aplicar a mesma composição com materiais para a modalidade ${mod}`, () => {
        const formData = {
          modalidade_financeira: mod,
          quantidade: 100,
          valor_unitario: 1.50,
          iss_percentual: 5,
          nf_emite: true,
        };

        const selectedMateriais = [
          { material_id: 'mat-1', valor_total: 15.00 },
          { material_id: 'mat-2', valor_total: 10.50 },
        ];
        const totalMateriais = selectedMateriais.reduce((acc, m) => acc + m.valor_total, 0);

        const valoresCalculados = calcularValoresOperacao({
          quantidade: Number(formData.quantidade),
          valorUnitario: Number(formData.valor_unitario),
          percentualIss: Number(formData.iss_percentual) / 100,
          nfRaw: formData.nf_emite ? 'SIM' : 'NÃO',
          valorTotalMateriais: totalMateriais,
        });

        // 100 * 1.50 = 150.00 descarga
        // ISS 5% = 7.50
        // Materiais = 25.50
        // Total = 150.00 + 7.50 + 25.50 = 183.00
        expect(valoresCalculados.valorDescargaCalculado).toBe(150.00);
        expect(valoresCalculados.custoIssCalculado).toBe(7.50);
        expect(valoresCalculados.valorTotalMateriais).toBe(25.50);
        expect(valoresCalculados.totalFinalCalculado).toBe(183.00);
      });
    });
  });

  it('6. Garante que o ISS nunca seja subtraído na origem', () => {
    // Caso de auditoria: antigamente fazia bruto - iss = 63 - 3.15 = 59.85
    const bruto = 150 * 0.42;
    const taxa = 0.05;
    const iss = bruto * taxa;
    const formulaAntigaDivergente = bruto - iss; // 59.85 (ERRADO)

    const res = calcularValoresOperacao({
      quantidade: 150,
      valorUnitario: 0.42,
      percentualIss: taxa,
      nfRaw: 'SIM',
    });

    expect(res.totalFinalCalculado).not.toBe(formulaAntigaDivergente);
    expect(res.totalFinalCalculado).toBe(66.15); // formula canônica: bruto + iss
  });
});
