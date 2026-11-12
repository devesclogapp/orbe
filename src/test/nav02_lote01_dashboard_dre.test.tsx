import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutiveKpiDrawer } from "@/components/dashboard/ExecutiveKpiDrawer";
import RelatorioDRE from "@/pages/Financeiro/RelatorioDRE";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { DashboardConsolidadoService } from "@/services/dashboard.service";

// Mock dos Contextos
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-esc-log-123" },
    tenantId: "tenant-esc-log-123",
    loading: false,
  }),
}));

let mockEnvironment = "PRODUCAO";
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    environment: mockEnvironment,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "admin@esclog.com.br" },
    session: {},
    signOut: vi.fn(),
  }),
}));

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "admin",
    isAdmin: true,
    canAccess: () => true,
    hasPermission: () => true,
    userRole: "admin",
  }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    status: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn(),
  },
}));

vi.mock("@/services/dashboard.service", () => ({
  DashboardConsolidadoService: {
    getKpisAggregate: vi.fn().mockResolvedValue({
      faturamentoTotal: 100000,
      finValorAprovado: 60000,
      custosGerais: 10000,
      lucroReal: 30000,
    }),
    getKpisByCompetencia: vi.fn().mockResolvedValue({
      faturamentoTotal: 100000,
      finValorAprovado: 60000,
      custosGerais: 10000,
      lucroReal: 30000,
    }),
  },
}));

const mockEmpresas = [
  { id: "emp-prod-1", nome: "Empresa Producao Real 1", is_teste: false, tenant_id: "tenant-esc-log-123" },
  { id: "emp-prod-2", nome: "Empresa Producao Real 2", is_teste: false, tenant_id: "tenant-esc-log-123" },
  { id: "emp-test-1", nome: "Empresa Homologacao Sintetica", is_teste: true, tenant_id: "tenant-esc-log-123" },
];

describe("NAV-02 | LOTE 01 — TESTES DE NAVEGAÇÃO DASHBOARD → DRE GERENCIAL", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockEnvironment = "PRODUCAO";

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(EmpresaService, "getAll").mockResolvedValue(mockEmpresas as any);
    vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockResolvedValue({
      faturamentoTotal: 100000,
      caixaRecebido: 70000,
      finValorAprovado: 60000,
      custosGerais: 10000,
      lucroReal: 30000,
      folhaValorAprovado: 40000,
      diaristasValorAprovado: 15000,
      intermitentesValorAprovado: 5000,
    } as any);

    vi.spyOn(DashboardConsolidadoService, "getKpisByCompetencia").mockResolvedValue({
      faturamentoTotal: 100000,
      caixaRecebido: 70000,
      finValorAprovado: 60000,
      custosGerais: 10000,
      lucroReal: 30000,
      folhaValorAprovado: 40000,
      diaristasValorAprovado: 15000,
      intermitentesValorAprovado: 5000,
    } as any);
  });

  const renderWithProviders = (ui: React.ReactElement, initialEntries = ["/"]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // 1. Setembro/2026 no Dashboard abre setembro/2026 no DRE
  it("1. Setembro/2026 no Dashboard abre setembro/2026 no DRE com empresa selecionada", () => {
    const onNavigateMock = vi.fn();

    renderWithProviders(
      <ExecutiveKpiDrawer
        type="lucro"
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={onNavigateMock}
        competencia="Setembro / 2026"
        canonicalCompetencia="2026-09"
        empresaId="emp-prod-1"
        data={{
          faturamentoTotal: 50000,
          custosTotais: 30000,
          resultadoOperacional: 20000,
          margemOperacional: 40,
          caixaRecebido: 40000,
          aReceber: 10000,
        }}
      />
    );

    const btnDRE = screen.getByText("Abrir DRE Gerencial");
    fireEvent.click(btnDRE);

    expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre?mes=2026-09&empresa=emp-prod-1");
  });

  // 2. Consolidado Geral permanece consolidado
  it("2. Consolidado Geral no Dashboard abre DRE sem parâmetro empresa redundante", () => {
    const onNavigateMock = vi.fn();

    renderWithProviders(
      <ExecutiveKpiDrawer
        type="margem"
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={onNavigateMock}
        competencia="Outubro / 2026"
        canonicalCompetencia="2026-10"
        empresaId="all"
        data={{
          faturamentoTotal: 80000,
          custosTotais: 50000,
          resultadoOperacional: 30000,
          margemOperacional: 37.5,
          caixaRecebido: 70000,
          aReceber: 10000,
        }}
      />
    );

    const btnDRE = screen.getByText("Abrir DRE Gerencial");
    fireEvent.click(btnDRE);

    expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre?mes=2026-10");
  });

  // 3. Competência anual YYYY-all é preservada corretamente
  it("3. Competência anual YYYY-all no Dashboard abre DRE no modo anual", () => {
    const onNavigateMock = vi.fn();

    renderWithProviders(
      <ExecutiveKpiDrawer
        type="lucro"
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={onNavigateMock}
        competencia="Ano Consolidado de 2026"
        canonicalCompetencia="2026-all"
        empresaId="all"
        data={{
          faturamentoTotal: 500000,
          custosTotais: 300000,
          resultadoOperacional: 200000,
          margemOperacional: 40,
          caixaRecebido: 450000,
          aReceber: 50000,
        }}
      />
    );

    const btnDRE = screen.getByText("Abrir DRE Gerencial");
    fireEvent.click(btnDRE);

    expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre?mes=2026-all");
  });

  // 4. DRE inicializa com parâmetros de URL recebidos (Setembro/2026 e Empresa Prod 1)
  it("4. DRE Gerencial interpreta corretamente searchParams (?mes=2026-09&empresa=emp-prod-1)", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/financeiro/dre" element={<RelatorioDRE />} />
      </Routes>,
      ["/financeiro/dre?mes=2026-09&empresa=emp-prod-1"]
    );

    await waitFor(() => {
      // Verifica o label de competência apurada exibido no cabeçalho
      expect(screen.getByText(/Setembro \/ 2026/i)).toBeDefined();
      // Confirma que a empresa selecionada é refletida no cabeçalho e no seletor
      expect(screen.getAllByText("Empresa Producao Real 1").length).toBeGreaterThan(0);
    });
  });

  // 5. DRE sem parâmetros na URL utiliza fallback dinâmico baseado na data atual (não outubro/2026 fixo)
  it("5. DRE Gerencial sem parâmetros utiliza fallback dinâmico (ano e mês correntes)", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/financeiro/dre" element={<RelatorioDRE />} />
      </Routes>,
      ["/financeiro/dre"]
    );

    const now = new Date();
    const currentYear = String(now.getFullYear());

    await waitFor(() => {
      // Deve conter o ano atual
      expect(screen.getAllByText(new RegExp(currentYear, "i")).length).toBeGreaterThan(0);
    });
  });

  // 6. DRE com competência anual (?mes=2026-all) inicializa no modo anual
  it("6. DRE Gerencial com ?mes=2026-all inicializa no modo ano inteiro", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/financeiro/dre" element={<RelatorioDRE />} />
      </Routes>,
      ["/financeiro/dre?mes=2026-all"]
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Ano 2026/i).length).toBeGreaterThan(0);
    });
  });

  // 7. Empresa incompatível com ambiente/tenant não é aplicada (fallback seguro para Consolidado Geral)
  it("7. DRE em PRODUÇÃO ignora empresa de homologação sintética (fallback seguro para all)", async () => {
    mockEnvironment = "PRODUCAO";

    renderWithProviders(
      <Routes>
        <Route path="/financeiro/dre" element={<RelatorioDRE />} />
      </Routes>,
      ["/financeiro/dre?mes=2026-09&empresa=emp-test-1"]
    );

    await waitFor(() => {
      // Como emp-test-1 é is_teste=true e ambiente é PRODUCAO, o DRE deve reverter para "Consolidado Geral"
      expect(screen.getAllByText("Consolidado Geral (Todas Unidades)").length).toBeGreaterThan(0);
    });
  });

  // 8. Empresa inexistente/inválida reverte para Consolidado Geral
  it("8. DRE com ID de empresa inexistente faz fallback para Consolidado Geral", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/financeiro/dre" element={<RelatorioDRE />} />
      </Routes>,
      ["/financeiro/dre?mes=2026-09&empresa=id-empresa-inexistente-xyz"]
    );

    await waitFor(() => {
      expect(screen.getAllByText("Consolidado Geral (Todas Unidades)").length).toBeGreaterThan(0);
    });
  });
});
