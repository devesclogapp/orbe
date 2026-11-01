import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import IntermitentesRecebidos from "@/pages/Operacional/IntermitentesRecebidos";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "operacional@esclog.com.br", role: "admin" },
  }),
}));

// Mock AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title, subtitle }: any) => (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock EmpresaService
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: () =>
      Promise.resolve([
        { id: "emp-benevides", nome: "BENEVIDES" },
        { id: "emp-castanhal", nome: "Operacional,Castanhal" },
      ]),
  },
}));

vi.mock("@/services/environment/EnvironmentService", () => ({
  EnvironmentService: {
    getTestEmpresaIds: () => Promise.resolve([]),
    getCurrentEnvironment: () => "production",
  },
}));

vi.mock("@/services/domain/base.service", () => ({
  getCurrentTenantId: () => Promise.resolve("tenant-esc-log"),
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    listarLotes: () => Promise.resolve([]),
  },
}));

describe("CONV-17 / FIX CTA Jornadas Devolvidas — Contexto de Competência e Empresa", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Ao navegar com contexto de lote cancelado (08/2026), inicializa e exibe Competência 08/2026 e aplica empresa", async () => {
    const createChainableMock = (resolvedData: any) => {
      const obj: any = {};
      obj.select = vi.fn().mockReturnValue(obj);
      obj.order = vi.fn().mockReturnValue(obj);
      obj.gte = vi.fn().mockReturnValue(obj);
      obj.lte = vi.fn().mockReturnValue(obj);
      obj.eq = vi.fn().mockReturnValue(obj);
      obj.in = vi.fn().mockReturnValue(obj);
      obj.then = (resolve: any) => resolve({ data: resolvedData, error: null });
      return obj;
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "lancamentos_intermitentes") {
        return createChainableMock([
          {
            id: "lanc-01",
            data_referencia: "2026-08-15",
            nome_colaborador: "CARLOS SOUZA",
            cargo: "Auxiliar Operacional",
            convocacao: "CONV-01",
            horas_trabalhadas: 8,
            horas_normais: 8,
            he_50: 0,
            he_100: 0,
            hora_noturna: 0,
            total: 200,
            status_pipeline: "RECEBIDO",
            empresa_id: "emp-benevides",
            empresas: { nome: "BENEVIDES" },
            colaboradores: { nome: "CARLOS SOUZA" },
          },
        ]);
      }
      return createChainableMock([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/operacional/intermitentes",
                search: "?competencia=2026-08&empresaId=emp-benevides&loteId=lote-canc-01&origem=lote_cancelado",
                state: {
                  loteId: "lote-canc-01",
                  empresaId: "emp-benevides",
                  competencia: "2026-08",
                  origem: "lote_cancelado",
                },
              },
            ]}
          >
            <IntermitentesRecebidos />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Deve exibir Competência: 08/2026 no topo
    await waitFor(() => {
      expect(screen.getByText("08/2026")).toBeInTheDocument();
    });

    // Confirma que a tela NÃO abriu na competência atual (ex: 10/2026)
    const currentMonthYear = `${format(new Date(), "MM")}/${format(new Date(), "yyyy")}`;
    if (currentMonthYear !== "08/2026") {
      expect(screen.queryByText(new RegExp(`Competência:.*${currentMonthYear}`, "i"))).not.toBeInTheDocument();
    }

    // O registro de agosto/2026 deve ser exibido
    await waitFor(() => {
      expect(screen.getByText("CARLOS SOUZA")).toBeInTheDocument();
    });
  });

  it("2. Ao acessar sem parâmetros (menu normal), preserva comportamento padrão na competência atual", async () => {
    const createChainableMock = (resolvedData: any) => {
      const obj: any = {};
      obj.select = vi.fn().mockReturnValue(obj);
      obj.order = vi.fn().mockReturnValue(obj);
      obj.gte = vi.fn().mockReturnValue(obj);
      obj.lte = vi.fn().mockReturnValue(obj);
      obj.eq = vi.fn().mockReturnValue(obj);
      obj.in = vi.fn().mockReturnValue(obj);
      obj.then = (resolve: any) => resolve({ data: resolvedData, error: null });
      return obj;
    };

    (supabase.from as any).mockReturnValue(createChainableMock([]));

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={["/operacional/intermitentes"]}>
            <IntermitentesRecebidos />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );

    const expectedDefaultCompetencia = `${format(new Date(), "MM")}/${format(new Date(), "yyyy")}`;
    await waitFor(() => {
      expect(screen.getByText(expectedDefaultCompetencia)).toBeInTheDocument();
    });
  });

  it("3. Se não houver registros na competência selecionada, apresenta estado vazio normalmente", async () => {
    const createChainableMock = (resolvedData: any) => {
      const obj: any = {};
      obj.select = vi.fn().mockReturnValue(obj);
      obj.order = vi.fn().mockReturnValue(obj);
      obj.gte = vi.fn().mockReturnValue(obj);
      obj.lte = vi.fn().mockReturnValue(obj);
      obj.eq = vi.fn().mockReturnValue(obj);
      obj.in = vi.fn().mockReturnValue(obj);
      obj.then = (resolve: any) => resolve({ data: resolvedData, error: null });
      return obj;
    };

    (supabase.from as any).mockReturnValue(createChainableMock([]));

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/operacional/intermitentes",
                state: {
                  loteId: "lote-canc-vazio",
                  empresaId: "emp-benevides",
                  competencia: "2026-08",
                  origem: "lote_cancelado",
                },
              },
            ]}
          >
            <IntermitentesRecebidos />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("08/2026")).toBeInTheDocument();
    });

    // Verifica presença de estado vazio de intermitentes
    await waitFor(() => {
      expect(screen.getByText(/Nenhum registro de intermitente encontrado/i)).toBeInTheDocument();
    });
  });
});
