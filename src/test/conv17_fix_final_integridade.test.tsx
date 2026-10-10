import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IntermitentesLotes, { getFinanceiroStatusBadge } from "@/pages/Operacional/IntermitentesLotes";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "financeiro@esclog.com.br", role: "admin" },
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

vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: () =>
      Promise.resolve([
        { id: "emp-benevides", nome: "BENEVIDES" },
        { id: "emp-castanhal", nome: "Operacional,Castanhal" },
      ]),
  },
}));

vi.mock("@/services/environment/EnvironmentService", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    EnvironmentService: {
      ...actual.EnvironmentService,
      getTestEmpresaIds: () => Promise.resolve([]),
      getCurrentEnvironment: () => "production",
    },
  };
});

vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: () => Promise.resolve("tenant-esc-log"),
  };
});

describe("CONV-17 / FIX FINAL DE INTEGRIDADE", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("FIX 01 — Lotes cancelados no Drawer", () => {
    it("deve exibir badge Cancelado para status financeiro CANCELADO", () => {
      const { container } = render(<div>{getFinanceiroStatusBadge("CANCELADO")}</div>);
      expect(container.textContent).toContain("Cancelado");
    });

    it("deve renderizar o Drawer primário preservando histórico e informando desvinculação em lote CANCELADO com 0 itens", async () => {
      const loteCanceladoMock = {
        id: "lote-canc-01",
        competencia: "2026-08",
        periodo_inicio: "2026-08-01",
        periodo_fim: "2026-08-31",
        quantidade_registros: 16,
        valor_total: 4500.0,
        horas_trabalhadas: 0,
        horas_normais: 0,
        he_50: 0,
        status: "CANCELADO",
        status_financeiro: "CANCELADO",
        observacoes: "Devolvido pelo RH via Painel Global",
        empresa_id: "emp-benevides",
        empresa: { id: "emp-benevides", nome: "BENEVIDES" },
        itens: [], // Itens desvinculados na devolução
      };

      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteCanceladoMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteCanceladoMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-canc-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Aguarda abertura do drawer pelo state
      await waitFor(() => {
        expect(screen.getByText(/Lançamentos desvinculados durante a devolução do RH/i)).toBeInTheDocument();
      });

      // Valida preservação da contagem histórica e diferenciação com itens atualmente vinculados
      expect(screen.getByText(/Registros históricos:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Registros atualmente vinculados:/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/16 lançamentos/i)).toBeInTheDocument();
      expect(screen.getByText(/0 lançamentos vinculados/i)).toBeInTheDocument();
      expect(screen.getByText(/Lote Cancelado \/ Devolvido pelo RH/i)).toBeInTheDocument();
    });
  });

  describe("FIX 02 — Status financeiro em intermitentes.service.ts", () => {
    it("deve garantir que listarLotes atribua status_financeiro CANCELADO quando lote.status for CANCELADO", async () => {
      const createChainableMock = (resolvedData: any) => {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.in = vi.fn().mockReturnValue(obj);
        obj.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
        obj.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
        obj.then = (resolve: any) => resolve({ data: resolvedData, error: null });
        return obj;
      };

      const fakeSupabase = {
        from: vi.fn((table: string) => {
          if (table === "intermitentes_lotes_fechamento") {
            return createChainableMock([
              {
                id: "lote-canc-01",
                status: "CANCELADO",
                empresa_id: "emp-01",
                competencia: "2026-08",
              },
              {
                id: "lote-ativo-01",
                status: "AGUARDANDO_VALIDACAO_RH",
                empresa_id: "emp-02",
                competencia: "2026-08",
              },
            ]);
          }
          if (table === "lancamentos_intermitentes") {
            return createChainableMock([]);
          }
          if (table === "rh_financeiro_lotes") {
            return createChainableMock([
              // Mesmo se existir espelho com outro status em rh_financeiro_lotes:
              { id: "rh-01", empresa_id: "emp-01", competencia: "2026-08", status: "AGUARDANDO_FINANCEIRO" },
            ]);
          }
          return createChainableMock([]);
        }),
      };

      const originalSupabase = (IntermitentesLoteService as any).supabase;
      (IntermitentesLoteService as any).supabase = fakeSupabase;

      try {
        const lotes = await IntermitentesLoteService.listarLotes({ competencia: "2026-08" });
        const loteCanc = lotes.find((l: any) => l.id === "lote-canc-01");
        const loteAtivo = lotes.find((l: any) => l.id === "lote-ativo-01");

        expect(loteCanc).toBeDefined();
        // Condição de cancelamento tem precedência sobre espelho financeiro
        expect(loteCanc?.status_financeiro).toBe("CANCELADO");

        expect(loteAtivo).toBeDefined();
        expect(loteAtivo?.status_financeiro).toBe("PENDENTE_RH");
      } finally {
        (IntermitentesLoteService as any).supabase = originalSupabase;
      }
    });

    it("deve garantir que getLoteDetalhe retorne status_financeiro CANCELADO quando lote for CANCELADO", async () => {
      const createChainableMock = (resolvedData: any) => {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.in = vi.fn().mockReturnValue(obj);
        obj.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
        obj.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
        obj.then = (resolve: any) => resolve({ data: resolvedData, error: null });
        return obj;
      };

      const fakeSupabase = {
        from: vi.fn((table: string) => {
          if (table === "intermitentes_lotes_fechamento") {
            return createChainableMock({
              id: "lote-canc-02",
              status: "CANCELADO",
              empresa_id: "emp-01",
              competencia: "2026-08",
              quantidade_registros: 16,
              valor_total: 2000,
            });
          }
          if (table === "lancamentos_intermitentes") {
            return createChainableMock([]);
          }
          if (table === "rh_financeiro_lotes") {
            return createChainableMock({ status: "AGUARDANDO_FINANCEIRO" });
          }
          return createChainableMock({});
        }),
      };

      const originalSupabase = (IntermitentesLoteService as any).supabase;
      (IntermitentesLoteService as any).supabase = fakeSupabase;

      try {
        const detalhe = await IntermitentesLoteService.getLoteDetalhe("lote-canc-02");
        expect(detalhe.status).toBe("CANCELADO");
        expect(detalhe.status_financeiro).toBe("CANCELADO");
      } finally {
        (IntermitentesLoteService as any).supabase = originalSupabase;
      }
    });
  });

  describe("FIX 03 — KPIs executivos (Competência 08/2026)", () => {
    it("deve excluir lotes cancelados dos acumuladores de registros, horas e montante", async () => {
      // Cenário real mapeado na competência 08/2026:
      // Lote 1: CANCELADO, 16 registros, R$ 1600, 80h trab, BENEVIDES
      // Lote 2: CANCELADO, 16 registros, R$ 1600, 80h trab, BENEVIDES
      // Lote 3: AGUARDANDO_VALIDACAO_RH, 3 registros, R$ 300, 15h trab, Operacional,Castanhal
      const lotesCompetencia08 = [
        {
          id: "6dfdace3-lote-canc-1",
          competencia: "2026-08",
          quantidade_registros: 16,
          valor_total: 1600.0,
          horas_trabalhadas: 80,
          horas_normais: 80,
          he_50: 0,
          status: "CANCELADO",
          status_financeiro: "CANCELADO",
          empresa: { id: "emp-benevides", nome: "BENEVIDES" },
        },
        {
          id: "d4715652-lote-canc-2",
          competencia: "2026-08",
          quantidade_registros: 16,
          valor_total: 1600.0,
          horas_trabalhadas: 80,
          horas_normais: 80,
          he_50: 0,
          status: "CANCELADO",
          status_financeiro: "CANCELADO",
          empresa: { id: "emp-benevides", nome: "BENEVIDES" },
        },
        {
          id: "6e48aa95-lote-ativo-3",
          competencia: "2026-08",
          quantidade_registros: 3,
          valor_total: 300.0,
          horas_trabalhadas: 15,
          horas_normais: 15,
          he_50: 0,
          status: "AGUARDANDO_VALIDACAO_RH",
          status_financeiro: "PENDENTE_RH",
          empresa: { id: "emp-castanhal", nome: "Operacional,Castanhal" },
        },
      ];

      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue(lotesCompetencia08 as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Espera carregar lotes e atualizar KPIs
      await waitFor(() => {
        expect(screen.getByText("1 ativos • 2 cancelados")).toBeInTheDocument();
      });

      // 1. Total de lotes preserva os 3 históricos e Registros Fechados é 3:
      const elementsWith3 = screen.getAllByText("3");
      expect(elementsWith3.length).toBeGreaterThanOrEqual(2);

      // 2. Registros Fechados: EXCLUI os 32 dos dois cancelados e soma APENAS o lote ativo (3)
      // Não pode ser 35!
      expect(screen.queryByText("35")).not.toBeInTheDocument();
      expect(screen.getByText("Jornadas em lotes ativos no ciclo")).toBeInTheDocument();

      // 3. Montante total: R$ 300,00 (exclui R$ 3.200 dos cancelados)
      const montanteElements = screen.getAllByText(/R\$\s*300,00/);
      expect(montanteElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Apurado em lotes ativos")).toBeInTheDocument();

      // 4. Horas consolidadas: 15:00 (exclui 160h dos cancelados)
      expect(screen.getByText("15:00")).toBeInTheDocument();
    });
  });
});
