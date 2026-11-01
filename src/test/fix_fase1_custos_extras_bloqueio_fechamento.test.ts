import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("FASE 1 — REGRA CANÔNICA DE BLOQUEIO DE CUSTOS EXTRAS NO FECHAMENTO", () => {
  const fechamentoPath = path.resolve(__dirname, "../pages/Fechamento.tsx");
  const fechamentoContent = fs.readFileSync(fechamentoPath, "utf-8");

  const rhFinanceiroPath = path.resolve(__dirname, "../services/rhFinanceiro.service.ts");
  const rhFinanceiroContent = fs.readFileSync(rhFinanceiroPath, "utf-8");

  describe("1. Inspeção Estática do Código Fonte", () => {
    it("Fechamento.tsx deve incluir pipeline_status no select de custos_extras_operacionais", () => {
      expect(fechamentoContent).toContain('.select("id, empresa_id, data, status_pagamento, pipeline_status")');
    });

    it("Fechamento.tsx NÃO deve mais comparar status_pagamento com RECEBIDO", () => {
      expect(fechamentoContent).not.toContain('item.status_pagamento !== "RECEBIDO"');
      expect(fechamentoContent).not.toContain("item.status_pagamento !== 'RECEBIDO'");
    });

    it("Fechamento.tsx deve filtrar pendências estritamente por RECEBIDO e EM_VALIDACAO", () => {
      expect(fechamentoContent).toContain('["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase())');
      expect(fechamentoContent).toContain('String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"');
    });

    it("rhFinanceiro.service.ts deve incluir pipeline_status no select de custos_extras_operacionais", () => {
      expect(rhFinanceiroContent).toContain('.select("id, data, status_pagamento, pipeline_status")');
    });

    it("rhFinanceiro.service.ts NÃO deve mais comparar status_pagamento com RECEBIDO", () => {
      expect(rhFinanceiroContent).not.toContain('!== "RECEBIDO"');
      expect(rhFinanceiroContent).not.toContain("!== 'RECEBIDO'");
    });

    it("rhFinanceiro.service.ts deve filtrar pendências estritamente por RECEBIDO e EM_VALIDACAO", () => {
      expect(rhFinanceiroContent).toContain('["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase())');
      expect(rhFinanceiroContent).toContain('String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"');
    });
  });

  describe("2. Validação Funcional dos Estados de Bloqueio (Regra Canônica)", () => {
    // Função canônica espelhada das implementações corrigidas em Fechamento.tsx e rhFinanceiro.service.ts
    const isCustoPendente = (item: {
      pipeline_status?: string | null;
      status_pagamento?: string | null;
    }) => {
      return (
        ["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase()) &&
        String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"
      );
    };

    it("Cenário 1: RECEBIDO / A_PAGAR → DEVE BLOQUEAR", () => {
      const item = { pipeline_status: "RECEBIDO", status_pagamento: "A_PAGAR" };
      expect(isCustoPendente(item)).toBe(true);
    });

    it("Cenário 2: EM_VALIDACAO / A_PAGAR → DEVE BLOQUEAR (Ex: registro teste R$ 60,00 BENEVIDES)", () => {
      const item = { pipeline_status: "EM_VALIDACAO", status_pagamento: "A_PAGAR" };
      expect(isCustoPendente(item)).toBe(true);
    });

    it("Cenário 3: APROVADO_OPERACAO / A_PAGAR → NÃO BLOQUEIA (Custo já reconhecido)", () => {
      const item = { pipeline_status: "APROVADO_OPERACAO", status_pagamento: "A_PAGAR" };
      expect(isCustoPendente(item)).toBe(false);
    });

    it("Cenário 4: ENVIADO_FINANCEIRO / A_PAGAR → NÃO BLOQUEIA (Obrigação em fluxo financeiro)", () => {
      const item = { pipeline_status: "ENVIADO_FINANCEIRO", status_pagamento: "A_PAGAR" };
      expect(isCustoPendente(item)).toBe(false);
    });

    it("Cenário 5: FINALIZADO / PAGO → NÃO BLOQUEIA (Custo liquidado)", () => {
      const item = { pipeline_status: "FINALIZADO", status_pagamento: "PAGO" };
      expect(isCustoPendente(item)).toBe(false);
    });

    it("Cenário 6: CANCELADO → NÃO BLOQUEIA (Mesmo se estivesse em RECEBIDO ou EM_VALIDACAO)", () => {
      const item1 = { pipeline_status: "RECEBIDO", status_pagamento: "CANCELADO" };
      const item2 = { pipeline_status: "EM_VALIDACAO", status_pagamento: "CANCELADO" };
      const item3 = { pipeline_status: "CANCELADO", status_pagamento: "CANCELADO" };
      expect(isCustoPendente(item1)).toBe(false);
      expect(isCustoPendente(item2)).toBe(false);
      expect(isCustoPendente(item3)).toBe(false);
    });
  });

  describe("3. Simulação Exata da Base de Homologação BENEVIDES (2026-09)", () => {
    const baseHomologacaoBenevides = [
      { id: "dcba0376", valor: 60.0, pipeline_status: "EM_VALIDACAO", status_pagamento: "A_PAGAR", data: "2026-09-17" },
      { id: "ebb71dda", valor: 20.0, pipeline_status: "FINALIZADO", status_pagamento: "PAGO", data: "2026-09-17" },
      { id: "16417729", valor: 25.0, pipeline_status: "FINALIZADO", status_pagamento: "PAGO", data: "2026-09-18" },
      { id: "b5b65cec", valor: 30.0, pipeline_status: "FINALIZADO", status_pagamento: "PAGO", data: "2026-09-18" },
      { id: "791f90fe", valor: 35.0, pipeline_status: "FINALIZADO", status_pagamento: "PAGO", data: "2026-09-21" },
    ];

    it("apenas o registro de R$ 60,00 (dcba0376) em EM_VALIDACAO deve ser apontado como pendência", () => {
      const pendencias = baseHomologacaoBenevides.filter(
        (item) =>
          ["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase()) &&
          String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"
      );

      expect(pendencias).toHaveLength(1);
      expect(pendencias[0].id).toBe("dcba0376");
      expect(pendencias[0].valor).toBe(60.0);
    });

    it("os 4 registros finalizados e pagos (R$ 110,00 total) não são bloqueadores", () => {
      const liberados = baseHomologacaoBenevides.filter(
        (item) =>
          !(
            ["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase()) &&
            String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"
          )
      );

      expect(liberados).toHaveLength(4);
      const somaLiberados = liberados.reduce((acc, cur) => acc + cur.valor, 0);
      expect(somaLiberados).toBe(110.0);
    });
  });
});
