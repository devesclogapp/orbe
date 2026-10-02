import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("UX02 — Torre Operacional V2 (Protótipo 1.1 — Refinamentos)", () => {
  it("1. O item correspondente na Sidebar foi renomeado para 'Torre Operacional' (sem '(Esteira)')", () => {
    const sidebarPath = path.resolve(__dirname, "../components/ux-lab/UxLabSidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

    expect(sidebarContent).toContain('label: "Torre Operacional"');
    expect(sidebarContent).not.toContain('label: "Torre Operacional (Esteira)"');
  });

  it("2. O Painel de Foco Contextual inferior foi removido, preservando estabilidade vertical na seleção", () => {
    const pagePath = path.resolve(__dirname, "../pages/UxLab/UxLabTorreOperacional.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    // Verifica que a seção do painel de foco inferior não existe mais
    expect(pageContent).not.toContain('aria-label="Detalhes da Etapa Selecionada"');
    expect(pageContent).not.toContain('Amostra de Processos no Estágio');
    expect(pageContent).not.toContain('Etapa em Foco:');
  });

  it("3. Os cabeçalhos das trilhas não renderizam mais as pills de 'Ciclo de Faturamento' e 'Ciclo de Despesas'", () => {
    const pagePath = path.resolve(__dirname, "../pages/UxLab/UxLabTorreOperacional.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    expect(pageContent).not.toContain('trilha.badgeTrilha');
    expect(pageContent).toContain('trilha.titulo');
    expect(pageContent).toContain('trilha.descricao');
  });

  it("4. A seleção de nó (selectedStageId) permanece ativa para aplicar o anel/borda Azul Royal sem expansão", () => {
    const pagePath = path.resolve(__dirname, "../pages/UxLab/UxLabTorreOperacional.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    expect(pageContent).toContain('selectedStageId');
    expect(pageContent).toContain('ring-2 ring-blue-600/20');
  });
});
