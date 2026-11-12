import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.setConfig({ testTimeout: 15000 });
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutiveKpiDrawer } from "@/components/dashboard/ExecutiveKpiDrawer";
import ReceitasPipeline from "@/pages/Financeiro/ReceitasPipeline";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { ReceitasOficialService, ReceitaItemUI } from "@/services/receitasOficial.service";
import { supabase } from "@/lib/supabase";

// Mock resize observer
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock de Contextos
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
    status: {},
    refresh: vi.fn(),
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
  }),
}));

vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn(),
  },
}));

const mockEmpresas = [
  { id: "emp-prod-1", nome: "Empresa Producao Real 1", is_teste: false, tenant_id: "tenant-esc-log-123" },
  { id: "emp-prod-2", nome: "Empresa Producao Real 2", is_teste: false, tenant_id: "tenant-esc-log-123" },
  { id: "emp-test-1", nome: "Empresa Homologacao Sintetica", is_teste: true, tenant_id: "tenant-esc-log-123" },
  { id: "emp-outro-tenant", nome: "Empresa Outro Tenant", is_teste: false, tenant_id: "tenant-externo-999" },
];

const sampleReceitaSetembro: ReceitaItemUI = {
  id: "rec-set-01",
  clienteNome: "Empresa Producao Real 1",
  clienteId: "emp-prod-1",
  modalidade: "FATURAMENTO_MENSAL",
  origemPrincipal: "Operação por Volume",
  competencia: "2026-09",
  competenciaFormatada: "Setembro / 2026",
  vencimento: "2026-10-10",
  valorTotal: 42500,
  status: "cobranca_enviada",
  observacao: null,
  itens: [],
};

const drawerData = {
  faturamentoTotal: 42500,
  custosTotais: 21000,
  resultadoOperacional: 21500,
  margemOperacional: 50.59,
  caixaRecebido: 18000,
  aReceber: 24500,
};

function NavigatorHarness({ targetUrl }: { targetUrl: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(targetUrl)}>
      Ir para nova rota
    </button>
  );
}

describe("NAV-02 | LOTE 01.3-A — NAVEGAÇÃO CONTEXTUAL DASHBOARD → RECEITAS OPERACIONAIS", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTenantId = "tenant-esc-log-123";
    mockEnvironment = "PRODUCAO";
    localStorage.setItem("esc-log-environment", "PRODUCAO");

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(EmpresaService, "getAll").mockResolvedValue(mockEmpresas as any);
  });

  const renderWithProviders = (ui: React.ReactElement, initialEntries = ["/"]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe("A. Drawer Faturamento Total → Abrir Receitas Operacionais", () => {
    it("A1. Setembro/2026 e empresa específica geram URL contextual /financeiro/receitas?mes=2026-09&empresa=emp-prod-1", () => {
      const onNavigateMock = vi.fn();
      renderWithProviders(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Setembro / 2026"
          canonicalCompetencia="2026-09"
          empresaId="emp-prod-1"
          data={drawerData}
        />
      );

      fireEvent.click(screen.getByText("Abrir Receitas Operacionais"));
      expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/receitas?mes=2026-09&empresa=emp-prod-1");
    });

    it("A2. Consolidado Geral gera URL sem empresa individual e abre Receitas em Setembro/2026 consolidado", async () => {
      const onNavigateMock = vi.fn();
      const { unmount } = renderWithProviders(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Setembro / 2026"
          canonicalCompetencia="2026-09"
          empresaId="all"
          data={drawerData}
        />
      );

      fireEvent.click(screen.getByText("Abrir Receitas Operacionais"));
      expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/receitas?mes=2026-09");
      const targetUrl = onNavigateMock.mock.calls[0][0];
      unmount();

      const spy = vi
        .spyOn(ReceitasOficialService, "getReceitasContextuais")
        .mockResolvedValue([sampleReceitaSetembro]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        [targetUrl]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-09");
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Setembro / 2026");
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Todas as Empresas");
    });

    it("A3. Empresa específica e F5 (novo mount com mesma URL) mantêm Setembro/2026 e empresa selecionada", async () => {
      const spy = vi
        .spyOn(ReceitasOficialService, "getReceitasContextuais")
        .mockResolvedValue([sampleReceitaSetembro]);

      const { unmount } = renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-prod-1"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", "emp-prod-1", "2026-09");
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Setembro / 2026");
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Empresa Producao Real 1");

      // Simula F5 preservando exatamente a mesma URL
      unmount();
      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-prod-1"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(2);
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Setembro / 2026");
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Empresa Producao Real 1");
    });
  });

  describe("B. Drawer Caixa & Contas → Abrir Receitas & Cobranças", () => {
    it("B1. Preserva competência e empresa específica no botão de Receitas & Cobranças sem alterar Central Bancária", () => {
      const onNavigateMock = vi.fn();
      renderWithProviders(
        <ExecutiveKpiDrawer
          type="caixa"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Setembro / 2026"
          canonicalCompetencia="2026-09"
          empresaId="emp-prod-2"
          inadimplenciaStatus="ok"
          data={{ ...drawerData, inadimplenteTotal: 4500 }}
        />
      );

      expect(screen.queryByText("Abrir Central Bancária")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Abrir Receitas & Cobranças"));
      expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/receitas?mes=2026-09&empresa=emp-prod-2");
    });

    it("B2. Preserva Consolidado Geral e sobrevive a F5 em Caixa & Contas → Receitas", async () => {
      const onNavigateMock = vi.fn();
      const { unmount } = renderWithProviders(
        <ExecutiveKpiDrawer
          type="caixa"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Outubro / 2026"
          canonicalCompetencia="2026-10"
          empresaId="all"
          inadimplenciaStatus="ok"
          data={{ ...drawerData, inadimplenteTotal: 0 }}
        />
      );

      fireEvent.click(screen.getByText("Abrir Receitas & Cobranças"));
      const targetUrl = onNavigateMock.mock.calls[0][0];
      expect(targetUrl).toBe("/financeiro/receitas?mes=2026-10");
      unmount();

      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);
      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        [targetUrl]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-10");
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Outubro / 2026");
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Todas as Empresas");
    });
  });

  describe("C. Seletor de Competência, Parâmetros e Competência Anual (YYYY-all)", () => {
    it("C1. Novembro/2026 (?mes=2026-11) não deixa seletor vazio e consulta Novembro/2026", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-11"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-11");
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Novembro / 2026");
    });

    it("C2. Competência inválida na URL faz fallback seguro para mês atual com aviso explícito", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);
      const currentMonth = new Date().toISOString().substring(0, 7);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-99"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, currentMonth);
      });
      expect(screen.getByTestId("receitas-context-warning")).toBeInTheDocument();
      expect(screen.getByTestId("receitas-competencia-select").textContent).not.toContain("2026-99");
    });

    it("C3. Mudança reativa de parâmetros na URL atualiza competência, empresa e consulta", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route
            path="/financeiro/receitas"
            element={
              <>
                <NavigatorHarness targetUrl="/financeiro/receitas?mes=2026-08&empresa=emp-prod-2" />
                <ReceitasPipeline />
              </>
            }
          />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-prod-1"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", "emp-prod-1", "2026-09");
      });

      fireEvent.click(screen.getByText("Ir para nova rota"));

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", "emp-prod-2", "2026-08");
      });
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Agosto / 2026");
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Empresa Producao Real 2");
    });

    it("C4. Competência anual 2026-all preserva modo anual com banner explícito e filtro Jan..Dez no service", async () => {
      const anualSpy = vi
        .spyOn(ReceitasOficialService, "getReceitasContextuais")
        .mockResolvedValue([sampleReceitaSetembro]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-all"]
      );

      await waitFor(() => {
        expect(anualSpy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-all");
      });
      expect(screen.getByTestId("receitas-annual-banner")).toBeInTheDocument();
      expect(screen.getByTestId("receitas-competencia-select").textContent).toContain("Ano 2026");
    });

    it("C5. Serviço oficial em 2026-all consolida somente receitas do ano selecionado (Jan..Dez)", async () => {
      const mockRows = [
        {
          id: "rec-2026-01",
          empresa_id: "emp-prod-1",
          modalidade: "FATURAMENTO_MENSAL",
          competencia: "2026-01",
          valor_total: 10000,
          status: "recebido",
          created_at: "2026-01-15T10:00:00Z",
          empresas: { id: "emp-prod-1", nome: "Empresa Producao Real 1" },
          receitas_operacionais_itens: [],
        },
        {
          id: "rec-2026-09",
          empresa_id: "emp-prod-1",
          modalidade: "DUPLICATA",
          competencia: "2026-09",
          valor_total: 25000,
          status: "cobranca_enviada",
          created_at: "2026-09-15T10:00:00Z",
          empresas: { id: "emp-prod-1", nome: "Empresa Producao Real 1" },
          receitas_operacionais_itens: [],
        },
        {
          id: "rec-2025-12",
          empresa_id: "emp-prod-1",
          modalidade: "FATURAMENTO_MENSAL",
          competencia: "2025-12",
          valor_total: 99999,
          status: "recebido",
          created_at: "2025-12-20T10:00:00Z",
          empresas: { id: "emp-prod-1", nome: "Empresa Producao Real 1" },
          receitas_operacionais_itens: [],
        },
      ];

      const fromSpy = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [{ id: "emp-test-1" }], error: null }),
              }),
            }),
          } as any;
        }
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          or: () => chain,
          order: () => chain,
          limit: async () => ({ data: mockRows, error: null }),
        };
        return chain;
      });

      const result = await ReceitasOficialService.getReceitasContextuais(
        "tenant-esc-log-123",
        undefined,
        "2026-all"
      );

      expect(fromSpy).toHaveBeenCalledWith("receitas_operacionais");
      expect(result.map((r) => r.id)).toEqual(["rec-2026-01", "rec-2026-09"]);
    });

    it("C6. Ano sem movimentação (2024-all) mantém seleção anual e exibe empty state sem erro", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2024-all"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2024-all");
        expect(screen.getByText("Nenhuma receita operacional encontrada")).toBeInTheDocument();
      });
      expect(screen.getByTestId("receitas-annual-banner")).toBeInTheDocument();
    });
  });

  describe("D. Segurança, Tenant e Isolamento PRODUCAO / HOMOLOGACAO", () => {
    it("D1. Empresa inválida ou inexistente faz fallback seguro para Consolidado Geral e não dispara consulta para ID inválido", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=empresa-inexistente-999"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-09");
      });
      expect(spy).not.toHaveBeenCalledWith("tenant-esc-log-123", "empresa-inexistente-999", expect.anything());
      expect(screen.getByTestId("receitas-context-warning")).toBeInTheDocument();
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Todas as Empresas");
    });

    it("D2. Empresa pertencente a outro tenant é rejeitada e revertida para Todas as Empresas", async () => {
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-outro-tenant"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-09");
      });
      expect(spy).not.toHaveBeenCalledWith("tenant-esc-log-123", "emp-outro-tenant", expect.anything());
      expect(screen.getByTestId("receitas-context-warning")).toBeInTheDocument();
    });

    it("D3. Empresa de HOMOLOGAÇÃO na URL em ambiente PRODUCAO é bloqueada na UI e no serviço oficial", async () => {
      mockEnvironment = "PRODUCAO";
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-test-1"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", undefined, "2026-09");
      });
      expect(spy).not.toHaveBeenCalledWith("tenant-esc-log-123", "emp-test-1", expect.anything());
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Todas as Empresas");

      // Defesa em profundidade diretamente no serviço oficial
      spy.mockRestore();
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [{ id: "emp-test-1" }], error: null }),
              }),
            }),
          } as any;
        }
        throw new Error("Não deveria consultar receitas_operacionais para empresa fora do ambiente");
      });

      const blockedResult = await ReceitasOficialService.getReceitasContextuais(
        "tenant-esc-log-123",
        "emp-test-1",
        "2026-09"
      );
      expect(blockedResult).toEqual([]);
    });

    it("D4. Troca PRODUCAO → HOMOLOGACAO atualiza ambiente, limpa empresa de produção e reconsulta com novo contexto", async () => {
      mockEnvironment = "PRODUCAO";
      const spy = vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);

      const { rerender } = renderWithProviders(
        <Routes>
          <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
        </Routes>,
        ["/financeiro/receitas?mes=2026-09&empresa=emp-prod-1"]
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith("tenant-esc-log-123", "emp-prod-1", "2026-09");
      });

      mockEnvironment = "HOMOLOGACAO";
      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/financeiro/receitas?mes=2026-09&empresa=emp-prod-1"]}>
            <Routes>
              <Route path="/financeiro/receitas" element={<ReceitasPipeline />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(localStorage.getItem("esc-log-environment")).toBe("HOMOLOGACAO");
        expect(spy).toHaveBeenLastCalledWith("tenant-esc-log-123", undefined, "2026-09");
      });
      expect(screen.getByTestId("receitas-empresa-select").textContent).toContain("Todas as Empresas");
    });
  });
});

