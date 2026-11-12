import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.setConfig({ testTimeout: 15000 });
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutiveKpiDrawer } from "@/components/dashboard/ExecutiveKpiDrawer";
import CentralFinanceira from "@/pages/CentralFinanceira";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { DespesasContasPagarOficialService } from "@/services/despesasOficial.service";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let mockTenantId = "tenant-esc-log-123";
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: mockTenantId },
    tenantId: mockTenantId,
    role: "admin",
    loading: false,
  }),
}));

let mockEnvironment: "PRODUCAO" | "HOMOLOGACAO" | "TODOS" = "PRODUCAO";
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    environment: mockEnvironment,
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "admin@esclog.com.br" },
    session: {},
    hasPermission: () => true,
    hasRole: () => true,
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

vi.mock("@/contexts/ClientContext", () => ({
  useClient: () => ({
    currentClient: null,
    isClientUser: false,
  }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
    isOpen: false,
  }),
  buildFolhaVariavelPipeline: vi.fn(),
  buildDiaristasPipeline: vi.fn(),
}));

const mockEmpresas = [
  { id: "emp-prod-1", nome: "Empresa Producao Real 1", is_teste: false },
  { id: "emp-prod-2", nome: "Empresa Producao Real 2", is_teste: false },
  { id: "emp-test-1", nome: "Empresa Homologacao Teste", is_teste: true },
];

const emptyStats = {
  totalFolha: 0,
  totalDiaristas: 0,
  totalIntermitentes: 0,
  totalCustosExtras: 0,
  totalGeral: 0,
  aPagar: 0,
  aguardandoPagamento: 0,
  pago: 0,
  pendenteAprovacao: 0,
  qtdTotal: 0,
};

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="current-location">{`${loc.pathname}${loc.search}`}</div>;
}

function renderWithProviders(ui: React.ReactNode, initialEntries = ["/financeiro"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NAV-02 | LOTE 01.3-B — NAVEGAÇÃO CONTEXTUAL DASHBOARD → CENTRAL FINANCEIRA", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockTenantId = "tenant-esc-log-123";
    mockEnvironment = "PRODUCAO";
    vi.spyOn(EmpresaService, "getAll").mockResolvedValue(mockEmpresas as any);
  });

  it("1. Drawer de Custos gera URL contextual para Consolidado Geral e Empresa Específica", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <ExecutiveKpiDrawer
        open={true}
        onOpenChange={vi.fn()}
        type="custos"
        data={{ custosTotais: 50000, faturamentoTotal: 100000 }}
        competenciaLabel="Setembro / 2026"
        canonicalCompetencia="2026-09"
        empresaId="all"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("Abrir Central Financeira"));
    expect(onNavigate).toHaveBeenCalledWith("/financeiro?mes=2026-09");

    onNavigate.mockClear();
    rerender(
      <ExecutiveKpiDrawer
        open={true}
        onOpenChange={vi.fn()}
        type="custos"
        data={{ custosTotais: 50000, faturamentoTotal: 100000 }}
        competenciaLabel="Setembro / 2026"
        canonicalCompetencia="2026-09"
        empresaId="emp-prod-2"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("Abrir Central Financeira"));
    expect(onNavigate).toHaveBeenCalledWith("/financeiro?mes=2026-09&empresa=emp-prod-2");
  });

  it("2. Navegação com competência mensal (2026-09) e Consolidado Geral NÃO auto-seleciona empresas[0]", async () => {
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-09"],
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({
        competenciaMes: "2026-09",
        empresaId: undefined,
      });
    });

    await waitFor(() => {
      const selectEmpresa = screen.getByDisplayValue("Todas as Empresas") as HTMLSelectElement;
      expect(selectEmpresa.value).toBe("all");
    });
  });

  it("3. Navegação com empresa específica (?mes=2026-09&empresa=emp-prod-2) preserva empresa e competência", async () => {
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-09&empresa=emp-prod-2"],
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({
        competenciaMes: "2026-09",
        empresaId: "emp-prod-2",
      });
    });

    const selectEmpresa = screen.getByDisplayValue("Empresa Producao Real 2") as HTMLSelectElement;
    expect(selectEmpresa.value).toBe("emp-prod-2");
  });

  it("4. Persistência após F5: aplicar filtros atualiza a URL e recarregar na URL mantém os mesmos filtros", async () => {
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    const { unmount } = renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-09"],
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Todas as Empresas")).toBeInTheDocument();
    });

    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: "2026-08" } });

    const empSelect = screen.getByDisplayValue("Todas as Empresas") as HTMLSelectElement;
    fireEvent.change(empSelect, { target: { value: "emp-prod-2" } });

    fireEvent.click(screen.getByText(/Aplicar/i));

    await waitFor(() => {
      expect(screen.getByTestId("current-location").textContent).toBe(
        "/financeiro?mes=2026-08&empresa=emp-prod-2",
      );
    });

    const persistedUrl = screen.getByTestId("current-location").textContent!;
    unmount();
    fetchSpy.mockClear();

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      [persistedUrl],
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith({
        competenciaMes: "2026-08",
        empresaId: "emp-prod-2",
      });
    });
  });

  it("5. Preservação de ambiente: empresa de homologação em PRODUCAO é bloqueada e revertida para Consolidado Geral com aviso", async () => {
    mockEnvironment = "PRODUCAO";
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-09&empresa=emp-test-1"],
    );

    await waitFor(() => {
      expect(screen.getByTestId("central-financeira-context-warning")).toBeInTheDocument();
    });

    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ empresaId: "emp-test-1" }),
    );
    expect(screen.getByTestId("current-location").textContent).toBe("/financeiro?mes=2026-09");
  });

  it("6. Parâmetro de competência inválido (?mes=2026-13) aciona fallback seguro com aviso explícito", async () => {
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-13"],
    );

    await waitFor(() => {
      expect(screen.getByTestId("central-financeira-context-warning")).toBeInTheDocument();
    });

    expect(screen.getByTestId("central-financeira-context-warning").textContent).toContain(
      "inválida",
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        competenciaMes: expect.stringMatching(/^\d{4}-(0[1-9]|1[0-2])$/),
      }),
    );
  });

  it("7. Contexto anual (?mes=2026-all) exibe aviso explícito de operação mensal e ajusta com segurança", async () => {
    const fetchSpy = vi
      .spyOn(DespesasContasPagarOficialService, "fetchDespesasFederadas")
      .mockResolvedValue({ itens: [], stats: emptyStats as any });

    renderWithProviders(
      <Routes>
        <Route path="/financeiro" element={<CentralFinanceira />} />
      </Routes>,
      ["/financeiro?mes=2026-all&empresa=emp-prod-1"],
    );

    await waitFor(() => {
      expect(screen.getByTestId("central-financeira-context-warning")).toBeInTheDocument();
    });

    expect(screen.getByTestId("central-financeira-context-warning").textContent).toContain(
      "2026-all",
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          competenciaMes: expect.stringMatching(/^2026-(0[1-9]|1[0-2])$/),
          empresaId: "emp-prod-1",
        }),
      );
    });
  });
});
