import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CORREÇÃO UI — Arquitetura de Drawers Sem Corte Vertical (UX-DRAWER-VERTICAL)", () => {
  const custosTableBlockPath = path.resolve(__dirname, "../components/operacoes/CustosExtrasTableBlock.tsx");
  const custosContinuityDrawerPath = path.resolve(__dirname, "../components/operacoes/CustosExtrasContinuityDrawer.tsx");
  const servicosContinuityDrawerPath = path.resolve(__dirname, "../components/operacoes/ServicosExtrasContinuityDrawer.tsx");
  const receitaDetalhesDrawerPath = path.resolve(__dirname, "../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx");
  const conciliacaoReceitaDrawerPath = path.resolve(__dirname, "../pages/Financeiro/components/ConciliacaoReceitaDrawer.tsx");
  const modalReceitaPath = path.resolve(__dirname, "../pages/Financeiro/components/ModalReceitaOperacional.tsx");

  const custosTableContent = fs.readFileSync(custosTableBlockPath, "utf-8");
  const custosContinuityContent = fs.readFileSync(custosContinuityDrawerPath, "utf-8");
  const servicosContinuityContent = fs.readFileSync(servicosContinuityDrawerPath, "utf-8");
  const receitaDetalhesContent = fs.readFileSync(receitaDetalhesDrawerPath, "utf-8");
  const conciliacaoReceitaContent = fs.readFileSync(conciliacaoReceitaDrawerPath, "utf-8");
  const modalReceitaContent = fs.readFileSync(modalReceitaPath, "utf-8");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CustosExtrasTableBlock — Drawer "Detalhes do Custo Extra"
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. CustosExtrasTableBlock: Drawer Detalhes do Custo Extra", () => {
    it("1.1. SheetContent usa h-[100dvh] max-h-[100dvh] e overflow-hidden para não estourar a viewport", () => {
      expect(custosTableContent).toContain("h-[100dvh]");
      expect(custosTableContent).toContain("max-h-[100dvh]");
      expect(custosTableContent).toContain("overflow-hidden");
      expect(custosTableContent).toContain("w-full sm:max-w-lg");
    });

    it("1.2. Possui header fixo com shrink-0 que não rola com o conteúdo", () => {
      expect(custosTableContent).toContain("<header className=\"p-6 pb-4 border-b border-border bg-card shrink-0\">");
      expect(custosTableContent).toContain("<SheetHeader>");
      expect(custosTableContent).toContain("Detalhes do Custo Extra");
    });

    it("1.3. Área central possui flex-1 min-h-0 overflow-y-auto evitando corte no footer", () => {
      expect(custosTableContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-5");
    });

    it("1.4. Footer permanece fixo e sempre visível com shrink-0 fora do container de scroll", () => {
      expect(custosTableContent).toContain("<footer className=\"p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 w-full\">");
      expect(custosTableContent).toContain("<SheetFooter className=\"m-0 p-0 border-0 flex-col gap-2.5 sm:flex-col sm:space-x-0 w-full min-w-0\">");
      expect(custosTableContent).toContain("Registrar Pagamento");
      expect(custosTableContent).toContain("Devolver para Operação");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CustosExtrasContinuityDrawer — Drawer "Status do Custo Extra"
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. CustosExtrasContinuityDrawer: Drawer Status do Custo Extra", () => {
    it("2.1. Container principal aside usa h-[100dvh] max-h-[100dvh] e overflow-hidden", () => {
      expect(custosContinuityContent).toContain("h-[100dvh]");
      expect(custosContinuityContent).toContain("max-h-[100dvh]");
      expect(custosContinuityContent).toContain("overflow-hidden");
    });

    it("2.2. Header possui shrink-0 evitando compressão vertical", () => {
      expect(custosContinuityContent).toContain("header className=\"flex items-start justify-between border-b border-border/80 px-6 py-5 bg-muted/20 shrink-0\"");
    });

    it("2.3. Corpo de scroll possui flex-1 min-h-0 overflow-y-auto overflow-x-hidden", () => {
      expect(custosContinuityContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 pb-8 space-y-6");
    });

    it("2.4. Footer possui shrink-0 e respiro adequado", () => {
      expect(custosContinuityContent).toContain("py-5 bg-muted/25 shrink-0");
      expect(custosContinuityContent).toContain("Continuar nesta tela");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Demais Drawers Canônicos Padronizados
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Demais Drawers Canônicos com Arquitetura de 3 Camadas Blindada", () => {
    it("3.1. ServicosExtrasContinuityDrawer usa h-[100dvh] e min-h-0", () => {
      expect(servicosContinuityContent).toContain("h-[100dvh]");
      expect(servicosContinuityContent).toContain("max-h-[100dvh]");
      expect(servicosContinuityContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });

    it("3.2. ReceitaDetalhesDrawer usa max-h-[100dvh] e min-h-0", () => {
      expect(receitaDetalhesContent).toContain("max-h-[100dvh]");
      expect(receitaDetalhesContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });

    it("3.3. ConciliacaoReceitaDrawer usa max-h-[100dvh] e min-h-0", () => {
      expect(conciliacaoReceitaContent).toContain("max-h-[100dvh]");
      expect(conciliacaoReceitaContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });

    it("3.4. ModalReceitaOperacional usa max-h-[100dvh] e min-h-0", () => {
      expect(modalReceitaContent).toContain("max-h-[100dvh]");
      expect(modalReceitaContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });
  });
});
