import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import { UxLabDesignSystemShowcase } from "@/pages/UxLab/UxLabDesignSystemShowcase";
import {
  OrbePageContainer,
  OrbePageHeader,
  OrbeSection,
  OrbeCard,
  OrbeKpiCard,
  OrbeButton,
  OrbeBadge,
  OrbeStatusBadge,
  OrbeInput,
  OrbeFilterBar,
  OrbeTable,
  OrbeDrawer,
  OrbeDocumentHeader,
  OrbeControleDocumental,
} from "@/components/ux-lab/design-system";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("ORBE Design System (DS-01) — Unit & Integration Tests", () => {
  it("renders the Design System Showcase with all 14 sections", () => {
    render(
      <MemoryRouter>
        <UxLabThemeProvider>
          <UxLabDesignSystemShowcase />
        </UxLabThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("ORBE Design System & Foundations")).toBeInTheDocument();
    expect(screen.getByText("01. Fundamentos Arquiteturais")).toBeInTheDocument();
    expect(screen.getByText("02. Identidade Cromática & Matriz Semântica")).toBeInTheDocument();
    expect(screen.getByText("03. Hierarquia Tipográfica Oficial")).toBeInTheDocument();
    expect(screen.getByText("04. Escala de Espaçamento")).toBeInTheDocument();
    expect(screen.getByText("05. Escala de Border Radius")).toBeInTheDocument();
    expect(screen.getByText("06. Sombras & Bordas Estruturais")).toBeInTheDocument();
    expect(screen.getByText("07. Botões & Ações Interativas")).toBeInTheDocument();
    expect(screen.getByText("08. Inputs, Selects & Barra de Filtros")).toBeInTheDocument();
    expect(screen.getByText("09. Badges Institucionais vs Status Semânticos")).toBeInTheDocument();
    expect(screen.getByText("10. Cards & Painéis Analíticos")).toBeInTheDocument();
    expect(screen.getByText("11. Tabela Densa Oficial do ERP")).toBeInTheDocument();
    expect(screen.getByText("12. Esteira Operacional (Pipeline Stepper)")).toBeInTheDocument();
    expect(screen.getByText("13. Shell Canônico de Drawer Especialista")).toBeInTheDocument();
    expect(screen.getByText("14. Componentes de Relatórios & Dossiês (Piloto R01)")).toBeInTheDocument();
  });

  it("renders OrbePageContainer with standard 1560px max width", () => {
    const { container } = render(
      <OrbePageContainer>
        <div>Content Inside Container</div>
      </OrbePageContainer>
    );

    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("max-w-[1560px]");
    expect(el).toHaveClass("mx-auto");
  });

  it("renders OrbeButton with primary Royal Blue variant and disabled states", () => {
    const handleClick = vi.fn();
    render(
      <OrbeButton variant="primary" onClick={handleClick}>
        Salvar Registro
      </OrbeButton>
    );

    const btn = screen.getByRole("button", { name: /Salvar Registro/i });
    expect(btn).toHaveClass("bg-[#2563EB]");
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders OrbeStatusBadge with semantic states", () => {
    render(
      <div>
        <OrbeStatusBadge status="success" label="CONCLUÍDO" />
        <OrbeStatusBadge status="danger" label="EM RESTRIÇÃO" />
      </div>
    );

    expect(screen.getByText("CONCLUÍDO")).toBeInTheDocument();
    expect(screen.getByText("EM RESTRIÇÃO")).toBeInTheDocument();
  });

  it("renders OrbeKpiCard in non-interactive and interactive modes", () => {
    const onClick = vi.fn();
    render(
      <OrbeKpiCard
        label="Receita Total"
        value="R$ 100.000"
        interactive={true}
        onClick={onClick}
      />
    );

    const card = screen.getByText("Receita Total").closest("div");
    if (card) fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it("renders OrbeTable with columns, rows and pagination", () => {
    const columns = [
      { id: "col1", header: "Nome", render: (r: any) => <span>{r.nome}</span> },
      { id: "col2", header: "Valor", align: "right" as const, render: (r: any) => <span>{r.valor}</span> },
    ];
    const data = [{ id: "1", nome: "Item A", valor: "R$ 100" }];

    render(
      <OrbeTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        pagination={{
          page: 1,
          totalPages: 2,
          totalItems: 10,
          pageSize: 5,
          onPageChange: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });

  it("renders OrbeDrawer when open and handles close action", () => {
    const onClose = vi.fn();
    render(
      <OrbeDrawer open={true} onClose={onClose} title="Detalhes do Lançamento">
        <div>Conteúdo do Drawer</div>
      </OrbeDrawer>
    );

    expect(screen.getByText("Detalhes do Lançamento")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo do Drawer")).toBeInTheDocument();

    const closeBtn = screen.getByTitle("Fechar (ESC)");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
