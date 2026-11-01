import { describe, it, expect } from "vitest";
import {
  getDRESnapshot,
  getDREByEmpresaForCompetencia,
  DRE_DATASET_POR_EMPRESA,
  DRE_EMPRESAS_INFO,
} from "../pages/UxLab/dreMockData";

describe("HOTFIX 04.1 — Integridade dos Mocks por Empresa e Fechamento Aritmético", () => {
  const competencias = ["2026-10", "2026-09", "2026-08", "2026-07"];

  competencias.forEach((comp) => {
    describe(`Competência ${comp}`, () => {
      it(`deve garantir que o consolidado fecha matematicamente com a soma das 3 empresas em ${comp}`, () => {
        const snapConsolidado = getDRESnapshot(comp, "all");
        const compData = DRE_DATASET_POR_EMPRESA[comp];
        const empresaIds = Object.keys(DRE_EMPRESAS_INFO);

        expect(empresaIds.length).toBe(3);

        const sumReceita = empresaIds.reduce(
          (acc, id) => acc + compData[id].receitaOperacional,
          0
        );
        const sumCLT = empresaIds.reduce(
          (acc, id) => acc + compData[id].folhaCLT,
          0
        );
        const sumDiaristas = empresaIds.reduce(
          (acc, id) => acc + compData[id].diaristas,
          0
        );
        const sumIntermitentes = empresaIds.reduce(
          (acc, id) => acc + compData[id].intermitentes,
          0
        );
        const sumCustosExtras = empresaIds.reduce(
          (acc, id) => acc + compData[id].custosExtras,
          0
        );

        // 1. Prova da soma de cada componente individual
        expect(snapConsolidado.receita).toBe(sumReceita);
        expect(snapConsolidado.clt).toBe(sumCLT);
        expect(snapConsolidado.diaristas).toBe(sumDiaristas);
        expect(snapConsolidado.intermitentes).toBe(sumIntermitentes);
        expect(snapConsolidado.custosExtras).toBe(sumCustosExtras);

        // 2. Prova de Custos Diretos
        const expectedCustos = sumCLT + sumDiaristas + sumIntermitentes + sumCustosExtras;
        expect(snapConsolidado.custos).toBe(expectedCustos);

        // 3. Prova de Resultado Operacional
        const expectedResultado = sumReceita - expectedCustos;
        expect(snapConsolidado.resultado).toBe(expectedResultado);

        // 4. Prova de Margem Operacional (sem média simples das margens)
        const expectedMargem = (expectedResultado / sumReceita) * 100;
        expect(snapConsolidado.margem).toBeCloseTo(expectedMargem, 4);
      });

      it(`deve garantir consistência interna para cada empresa individual em ${comp}`, () => {
        const empresaIds = Object.keys(DRE_EMPRESAS_INFO);

        empresaIds.forEach((id) => {
          const snap = getDRESnapshot(comp, id);
          expect(snap.empresaId).toBe(id);

          // Custos diretos = soma dos componentes da empresa
          const calculatedCustos =
            snap.clt + snap.diaristas + snap.intermitentes + snap.custosExtras;
          expect(snap.custos).toBe(calculatedCustos);

          // Resultado = receita - custos
          const calculatedResultado = snap.receita - calculatedCustos;
          expect(snap.resultado).toBe(calculatedResultado);

          // Margem = resultado / receita * 100
          const calculatedMargem = (calculatedResultado / snap.receita) * 100;
          expect(snap.margem).toBeCloseTo(calculatedMargem, 4);
        });
      });
    });
  });

  describe("Cenário de Referência Específico — Outubro / 2026 (Consolidado)", () => {
    it("deve fechar exatamente nos valores de referência acordados", () => {
      const snap = getDRESnapshot("2026-10", "all");

      expect(snap.receita).toBe(380000);
      expect(snap.custos).toBe(266000);
      expect(snap.resultado).toBe(114000);
      expect(snap.margem).toBe(30.0);

      // Verificação dos componentes individuais de custo
      expect(snap.clt).toBe(140000);
      expect(snap.diaristas).toBe(64000);
      expect(snap.intermitentes).toBe(32000);
      expect(snap.custosExtras).toBe(30000);
      expect(snap.clt + snap.diaristas + snap.intermitentes + snap.custosExtras).toBe(266000);
    });
  });

  describe("Cenário de Referência Específico — Setembro / 2026 (Consolidado)", () => {
    it("deve fechar exatamente nos valores de referência acordados", () => {
      const snap = getDRESnapshot("2026-09", "all");

      expect(snap.receita).toBe(350000);
      expect(snap.custos).toBe(249000);
      expect(snap.resultado).toBe(101000);
      expect(snap.margem).toBeCloseTo(28.857, 2);

      expect(snap.clt).toBe(135000);
      expect(snap.diaristas).toBe(62000);
      expect(snap.intermitentes).toBe(30000);
      expect(snap.custosExtras).toBe(22000);
      expect(snap.clt + snap.diaristas + snap.intermitentes + snap.custosExtras).toBe(249000);
    });
  });

  describe("Comparação Analítica por Empresa (Out/26 x Set/26)", () => {
    it("deve comparar datasets discretos da empresa selecionada sem usar rateio do consolidado", () => {
      // Exemplo: ESC - Porto
      const portoOut = getDRESnapshot("2026-10", "esc-porto");
      const portoSet = getDRESnapshot("2026-09", "esc-porto");

      expect(portoOut.receita).toBe(125000);
      expect(portoSet.receita).toBe(115000);
      const deltaReceitaNominal = portoOut.receita - portoSet.receita;
      expect(deltaReceitaNominal).toBe(10000);

      expect(portoOut.custos).toBe(89000);
      expect(portoSet.custos).toBe(83000);
      const deltaCustosNominal = portoOut.custos - portoSet.custos;
      expect(deltaCustosNominal).toBe(6000);

      expect(portoOut.resultado).toBe(36000);
      expect(portoSet.resultado).toBe(32000);
      const deltaResultadoNominal = portoOut.resultado - portoSet.resultado;
      expect(deltaResultadoNominal).toBe(4000);

      // Variação de margem calculada estritamente em pontos percentuais (pp)
      const deltaMargemPP = portoOut.margem - portoSet.margem;
      expect(deltaMargemPP).toBeCloseTo(0.97, 2);
    });
  });

  describe("Aba Por Empresa — getDREByEmpresaForCompetencia", () => {
    it("deve somar exatamente ao consolidado na competência atual", () => {
      const empresas = getDREByEmpresaForCompetencia("2026-10");
      const snapConsolidado = getDRESnapshot("2026-10", "all");

      const sumReceita = empresas.reduce((acc, e) => acc + e.receita, 0);
      const sumCustos = empresas.reduce((acc, e) => acc + e.custos, 0);
      const sumResultado = empresas.reduce((acc, e) => acc + e.resultado, 0);

      expect(sumReceita).toBe(snapConsolidado.receita);
      expect(sumCustos).toBe(snapConsolidado.custos);
      expect(sumResultado).toBe(snapConsolidado.resultado);
    });
  });
});
