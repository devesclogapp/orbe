import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabSidebar, UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";
import UxLabDashboard from "@/pages/UxLab/UxLabDashboard";
import UxLabTorreOperacional from "@/pages/UxLab/UxLabTorreOperacional";
import UxLabDRE from "@/pages/UxLab/UxLabDRE";
import UxLabRelatoriosHub from "@/pages/UxLab/UxLabRelatoriosHub";
import UxLabRelatorioView from "@/pages/UxLab/UxLabRelatorioView";
import UxLabOperacoesVolume from "@/pages/UxLab/UxLabOperacoesVolume";
import UxLabServicosExtras from "@/pages/UxLab/UxLabServicosExtras";
import UxLabCustosExtras from "@/pages/UxLab/UxLabCustosExtras";

// Mock ResizeObserver for Recharts in JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Navegação Integrada do UX LAB", () => {
  it("1. Mapeamento de rotas do UX_LAB_ROUTES contempla exclusivamente as telas transversais homologadas", () => {
    expect(UX_LAB_ROUTES["dashboard"]).toBe("/ux-lab");
    expect(UX_LAB_ROUTES["torre-operacional"]).toBe("/ux-lab/torre");
    expect(UX_LAB_ROUTES["operacoes-volume"]).toBe("/ux-lab/operacoes-volume");
    expect(UX_LAB_ROUTES["dre"]).toBe("/ux-lab/dre");
    expect(UX_LAB_ROUTES["relatorios"]).toBe("/ux-lab/relatorios");

    expect(UX_LAB_ROUTES["servicos-extras"]).toBe("/ux-lab/servicos-extras");
    expect(UX_LAB_ROUTES["custos-extras"]).toBe("/ux-lab/custos-extras");
    expect(UX_LAB_ROUTES["receitas"]).toBe("/ux-lab/receitas");
    expect(UX_LAB_ROUTES["despesas"]).toBe("/ux-lab/despesas");
    expect(UX_LAB_ROUTES["central-bancaria"]).toBe("/ux-lab/central-bancaria");
    expect(UX_LAB_ROUTES["inadimplencia"]).toBe("/ux-lab/inadimplencia");
    expect(UX_LAB_ROUTES["design-system"]).toBe("/ux-lab/design-system");
    expect(UX_LAB_ROUTES["diaristas"]).toBeUndefined();
    expect(UX_LAB_ROUTES["banco-horas"]).toBeUndefined();
  });

  it("2. Clicar em itens na Sidebar dispara callback e navegação sem travar telas", () => {
    const onSelect = vi.fn();

    render(
      <MemoryRouter initialEntries={["/ux-lab"]}>
        <UxLabSidebar activeItem="dashboard" onSelectItem={onSelect} />
      </MemoryRouter>
    );

    // Clicar em Torre Operacional
    const btnTorre = screen.getByText("Torre Operacional");
    fireEvent.click(btnTorre);
    expect(onSelect).toHaveBeenCalledWith("torre-operacional", "Torre Operacional");

    // Clicar em Operações por Volume
    const btnOpVolume = screen.getByText("Operações por Volume");
    fireEvent.click(btnOpVolume);
    expect(onSelect).toHaveBeenCalledWith("operacoes-volume", "Operações por Volume");

    // Clicar em Diaristas
    const btnDiaristas = screen.getByText("Diaristas (Grade & Lotes)");
    fireEvent.click(btnDiaristas);
    expect(onSelect).toHaveBeenCalledWith("diaristas", "Diaristas (Grade & Lotes)");
  });

  it("3. Renderização de todas as rotas do UX Lab sem exceções em cascata", () => {
    const routesToTest = [
      "/ux-lab",
      "/ux-lab/torre",
      "/ux-lab/operacoes-volume",
      "/ux-lab/servicos-extras",
      "/ux-lab/custos-extras",
      "/ux-lab/dre",
      "/ux-lab/relatorios",
      "/ux-lab/relatorios/r01-operacoes-volume",
      "/ux-lab/relatorios/r02-fechamento-diaristas",
      "/ux-lab/relatorios/r03-faturamento-receitas",
      "/ux-lab/relatorios/r04-custos-extras",
      "/ux-lab/relatorios/r05-banco-horas",
      "/ux-lab/relatorios/r07-servicos-extras",
    ];

    routesToTest.forEach((route) => {
      const { unmount } = render(
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/ux-lab" element={<UxLabDashboard />} />
            <Route path="/ux-lab/torre" element={<UxLabTorreOperacional />} />
            <Route path="/ux-lab/operacoes-volume" element={<UxLabOperacoesVolume />} />
            <Route path="/ux-lab/servicos-extras" element={<UxLabServicosExtras />} />
            <Route path="/ux-lab/custos-extras" element={<UxLabCustosExtras />} />
            <Route path="/ux-lab/dre" element={<UxLabDRE />} />
            <Route path="/ux-lab/relatorios" element={<UxLabRelatoriosHub />} />
            <Route path="/ux-lab/relatorios/:reportId" element={<UxLabRelatorioView />} />
          </Routes>
        </MemoryRouter>
      );
      unmount();
    });
  }, 20000);
});
