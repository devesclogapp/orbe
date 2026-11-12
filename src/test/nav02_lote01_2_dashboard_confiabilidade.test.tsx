import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";

import Dashboard from "@/pages/Dashboard";
import { ExecutiveKpiDrawer } from "@/components/dashboard/ExecutiveKpiDrawer";
import { DashboardConsolidadoService, OperationalIntegrityKPIs } from "@/services/dashboard.service";
import { EmpresaService } from "@/services/domain/cadastros.service";
import {
  InadimplenciaOficialService,
  calcularTotalInadimplenteContextual,
} from "@/services/inadimplenciaOficial.service";
import { supabase } from "@/lib/supabase";

let mockTenantId = "tenant-esc-log-123";
let mockEnvironment: "PRODUCAO" | "HOMOLOGACAO" | "TODOS" = "PRODUCAO";

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: mockTenantId },
    tenantId: mockTenantId,
    loading: false,
  }),
}));

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

// Mock leve e deterministico de Select para interacoes de filtro no jsdom
vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value?: string;
    onValueChange?: (val: string) => void;
  }>({});

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (val: string) => void;
      children: React.ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div data-selected-value={value}>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(SelectContext);
      return (
        <button
          type="button"
          role="option"
          aria-selected={ctx.value === value}
          onClick={() => ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

function buildKpiSnapshot(overrides: Partial<OperationalIntegrityKPIs> = {}): OperationalIntegrityKPIs {
  return {
    competencia: "2026-10",
    consolidadoEm: "2026-10-31T12:00:00Z",
    tipoFluxo: "consolidado",
    fluxosPresentes: ["operacional", "folha_clt"],
    rhValorProcessado: 50000,
    rhValorValidado: 50000,
    rhValorFechado: 50000,
    finValorRecebidoRH: 50000,
    finValorAprovado: 60000,
    folhaValorAprovado: 40000,
    intermitentesValorAprovado: 5000,
    diaristasValorAprovado: 15000,
    flows: {
      folha: { rhProcessado: 40000, rhValidado: 40000, rhFechado: 40000, finRecebido: 40000, finAprovado: 40000, cnabGerado: 0, bancoPago: 0 },
      intermitente: { rhProcessado: 5000, rhValidado: 5000, rhFechado: 5000, finRecebido: 5000, finAprovado: 5000, cnabGerado: 0, bancoPago: 0 },
      diarista: { rhProcessado: 15000, rhValidado: 15000, rhFechado: 15000, finRecebido: 15000, finAprovado: 15000, cnabGerado: 0, bancoPago: 0 },
    },
    finValorEnviadoBanco: 0,
    finValorHistoricoBanco: 0,
    faturamentoTotal: 150000,
    caixaRecebido: 90000,
    custosGerais: 10000,
    lucroReal: 80000,
    qtdPendentesEnvio: 0,
    qtdPendentesRetorno: 0,
    totalConfirmadoBanco: 90000,
    auditoriaCompetencia: {
      status: "ok",
      rhFechado: 50000,
      financeiroRecebido: 50000,
      financeiroAprovado: 60000,
      cnabGerado: 0,
      bancoHistorico: 0,
      diferencaRhFinanceiro: 0,
      diferencaFinanceiroCnab: 0,
      diferencaCnabHistorico: 0,
      diferencaTotal: 0,
      pendencias: [],
      atualizadoEm: "2026-10-31T12:00:00Z",
      tipoFluxo: "consolidado",
    },
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface MockChainQuery {
  [key: string]: unknown;
  eq: (col: string, val: unknown) => MockChainQuery;
  then: (resolve: (value: { data: unknown; error: unknown }) => void) => unknown;
}

function createChainableQuery(data: unknown = [], error: unknown = null): MockChainQuery {
  const chain = {} as MockChainQuery;
  const methods = [
    "select", "gte", "lt", "or", "in", "is", "neq", "eq",
    "not", "maybeSingle", "single", "order", "limit",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockImplementation(() => chain);
  });
  chain.then = (resolve) => resolve({ data, error });
  return chain;
}

describe("NAV-02-L01.2 — CONFIABILIDADE DO DASHBOARD EXECUTIVO, DRAWERS E INADIMPLÊNCIA", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
    localStorage.clear();
    localStorage.setItem("orbe_dashboard_year", "2026");
    localStorage.setItem("orbe_dashboard_month", "10");
    mockTenantId = "tenant-esc-log-123";
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

    vi.spyOn(EmpresaService, "getAll").mockResolvedValue([
      { id: "emp-prod-1", nome: "Empresa Alpha", is_teste: false } as unknown as Awaited<ReturnType<typeof EmpresaService.getAll>>[number],
      { id: "emp-prod-2", nome: "Empresa Beta", is_teste: false } as unknown as Awaited<ReturnType<typeof EmpresaService.getAll>>[number],
    ]);
    vi.spyOn(DashboardConsolidadoService, "getRadarAlertas").mockResolvedValue([]);
    vi.spyOn(DashboardConsolidadoService, "getStatusCiclos").mockResolvedValue({
      clt: { status: "aberto", diasRestantesFechamento: 10 },
      diaristas: { lotesEmAnalise: 0 },
      financeiro: { titulosVencerSemana: 0 },
      ultimoSyncRhid: "Hoje 07:00",
    });
    vi.spyOn(DashboardConsolidadoService, "getMotoresData").mockResolvedValue({
      volume: {
        totalDescargas: 0,
        volumeCaixas: 0,
        aprovadasPercent: 100,
        pendentesConferencia: 0,
        modalidades: { caixaImediato: 0, duplicatas: 0, mensal: 0 },
      },
      rhClt: {
        totalColaboradores: 0,
        horasExtrasTotal: 0,
        horasExtras50: 0,
        adicionalNoturnoHoras: 0,
        saldoBancoGeralMinutos: 0,
        colaboradoresSaldoCritico: 0,
      },
      diaristas: {
        totalAtivos: 0,
        presencasSemanaAtual: 0,
        valorSemanaAtual: 0,
        valorAcumuladoMes: 0,
        statusCicloSemanal: "Ativo",
        previsaoPagamento: "Sexta-feira",
        lotesConcluidosMes: 0,
      },
      intermitentes: {
        totalCadastrados: 0,
        valorPrevistoMes: 0,
        statusLote: "Consolidado",
        remessaCnabStatus: "Regular",
      },
    });
    vi.spyOn(DashboardConsolidadoService, "getEvolucaoSemanal").mockResolvedValue([
      { semana: "Sem 1", receita: 150000, custos: 70000, lucro: 80000, status: "ok" },
    ]);
    vi.spyOn(InadimplenciaOficialService, "getTotalInadimplenteByContexto").mockResolvedValue({
      totalInadimplente: 15000,
      quantidadeTitulos: 2,
    });
  });

  const renderDashboard = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

  // =========================================================================
  // GRUPO A — ESTADOS DE ERRO DOS KPIs E DRAWERS
  // =========================================================================
  describe("Grupo A — Tratamento Explícito de Erro e Retry", () => {
    it("A1. Falha na consulta dos KPIs exibe estado explícito de erro e nunca R$ 0,00 ou 'Sem movimentação'", async () => {
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockRejectedValue(
        new Error("Timeout na conexão com PostgreSQL")
      );

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-error")).toBeDefined();
      });

      expect(screen.getByText("Não foi possível carregar os indicadores financeiros")).toBeDefined();
      expect(screen.getByText("Timeout na conexão com PostgreSQL")).toBeDefined();
      expect(
        screen.queryByText(/Sem movimentação financeira ou operacional registrada/i)
      ).toBeNull();
      expect(screen.queryByText("Faturamento Total")).toBeNull();
      expect(screen.queryByText("Composição dos Custos de Operação")).toBeDefined();
      expect(screen.getByText("Composição indisponível no momento")).toBeDefined();
    });

    it("A2. Botão 'Tentar novamente' aciona refetch dos KPIs e restaura indicadores após recuperação", async () => {
      let attempt = 0;
      const getKpisSpy = vi
        .spyOn(DashboardConsolidadoService, "getKpisAggregate")
        .mockImplementation(async (_year, month) => {
          attempt += 1;
          if (attempt <= 2) {
            throw new Error("Falha temporária de rede");
          }
          if (month === "10") {
            return buildKpiSnapshot({ competencia: "2026-10", faturamentoTotal: 210000, lucroReal: 140000 });
          }
          return buildKpiSnapshot({ competencia: "2026-09", faturamentoTotal: 175000, lucroReal: 105000 });
        });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-error")).toBeDefined();
      });

      const retryBtns = screen.getAllByRole("button", { name: /Tentar novamente/i });
      fireEvent.click(retryBtns[0]);

      await waitFor(() => {
        expect(screen.getByText("Faturamento Total")).toBeDefined();
      });

      expect(getKpisSpy).toHaveBeenCalledTimes(4);
      expect(screen.getByText(/210\.000,00/)).toBeDefined();
      expect(screen.queryByTestId("dashboard-kpis-error")).toBeNull();
    });

    it("A3. Consulta que retorna legitimamente zero continua exibindo empty state real", async () => {
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockResolvedValue(
        buildKpiSnapshot({
          faturamentoTotal: 0,
          finValorAprovado: 0,
          custosGerais: 0,
          lucroReal: 0,
          caixaRecebido: 0,
        })
      );

      renderDashboard();

      await waitFor(() => {
        expect(
          screen.getByText("Sem movimentação financeira ou operacional registrada para esta competência e filtro selecionados.")
        ).toBeDefined();
      });

      expect(screen.queryByTestId("dashboard-kpis-error")).toBeNull();
      expect(screen.getByText("Faturamento Total")).toBeDefined();
    });

    it("A4. ExecutiveKpiDrawer bloqueia valores fictícios quando está em erro ou carregando", () => {
      const onRetry = vi.fn();
      const { rerender } = render(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          isError={true}
          errorMessage="API indisponível"
          onRetry={onRetry}
        />
      );

      expect(screen.getByTestId("drawer-error-state")).toBeDefined();
      expect(screen.getByText("API indisponível")).toBeDefined();
      expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);

      rerender(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          isLoading={true}
          data={{
            faturamentoTotal: 999999,
            custosTotais: 1000,
            resultadoOperacional: 998999,
            margemOperacional: 99,
            caixaRecebido: 500000,
            aReceber: 499999,
          }}
        />
      );

      expect(screen.getByTestId("drawer-loading-state")).toBeDefined();
      expect(screen.queryByText(/999\.999,00/)).toBeNull();
    });
  });

  // =========================================================================
  // GRUPO B — ISOLAMENTO VISUAL DURANTE TROCAS DE CONTEXTO E CACHE
  // =========================================================================
  describe("Grupo B — Isolamento Visual em Troca de Competência, Empresa e Ambiente", () => {
    it("B1. Troca de competência oculta imediatamente dados anteriores durante carregamento", async () => {
      const sepAtual = createDeferred<OperationalIntegrityKPIs>();
      const sepAnterior = createDeferred<OperationalIntegrityKPIs>();

      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation((_year, month) => {
        if (month === "10") {
          return Promise.resolve(buildKpiSnapshot({ competencia: "2026-10", faturamentoTotal: 150000 }));
        }
        if (month === "09") return sepAtual.promise;
        if (month === "08") return sepAnterior.promise;
        return Promise.resolve(buildKpiSnapshot({ competencia: "2026-09", faturamentoTotal: 80000 }));
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/150\.000,00/)).toBeDefined();
      });

      // Troca de Outubro -> Setembro
      fireEvent.click(screen.getByRole("option", { name: "Setembro" }));

      // Enquanto Setembro ainda não respondeu, Outubro (150.000,00) NÃO pode permanecer visível
      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-loading")).toBeDefined();
      });
      expect(screen.queryByText(/150\.000,00/)).toBeNull();

      sepAtual.resolve(buildKpiSnapshot({ competencia: "2026-09", faturamentoTotal: 82000, lucroReal: 32000 }));
      sepAnterior.resolve(buildKpiSnapshot({ competencia: "2026-08", faturamentoTotal: 41000, lucroReal: 16000 }));

      await waitFor(() => {
        expect(screen.getByText(/82\.000,00/)).toBeDefined();
      });
    });

    it("B2. Troca de empresa oculta dados consolidados anteriores enquanto consulta empresa específica", async () => {
      const empAlphaAtual = createDeferred<OperationalIntegrityKPIs>();
      const empAlphaAnterior = createDeferred<OperationalIntegrityKPIs>();

      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation((_year, month, empresaId) => {
        if (!empresaId) {
          return Promise.resolve(
            buildKpiSnapshot({
              competencia: month === "10" ? "2026-10" : "2026-09",
              faturamentoTotal: 320000,
            })
          );
        }
        if (month === "10") return empAlphaAtual.promise;
        return empAlphaAnterior.promise;
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/320\.000,00/)).toBeDefined();
      });

      fireEvent.click(screen.getByRole("option", { name: "Empresa Alpha" }));

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-loading")).toBeDefined();
      });
      expect(screen.queryByText(/320\.000,00/)).toBeNull();

      empAlphaAtual.resolve(buildKpiSnapshot({ competencia: "2026-10", faturamentoTotal: 45000, lucroReal: 15000 }));
      empAlphaAnterior.resolve(buildKpiSnapshot({ competencia: "2026-09", faturamentoTotal: 30000, lucroReal: 10000 }));

      await waitFor(() => {
        expect(screen.getByText(/45\.000,00/)).toBeDefined();
      });
    });

    it("B3. Troca de ambiente (PRODUCAO -> HOMOLOGACAO) reseta empresa selecionada e isola valores e queryKeys", async () => {
      const hmlAtual = createDeferred<OperationalIntegrityKPIs>();
      const hmlAnt = createDeferred<OperationalIntegrityKPIs>();
      const seenEmpresaArgsInHml: Array<string | undefined> = [];

      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation((_year, month, empresaId) => {
        if (mockEnvironment === "HOMOLOGACAO") {
          seenEmpresaArgsInHml.push(empresaId);
          return month === "10" ? hmlAtual.promise : hmlAnt.promise;
        }
        return Promise.resolve(
          buildKpiSnapshot({
            competencia: month === "10" ? "2026-10" : "2026-09",
            faturamentoTotal: empresaId ? 95000 : 400000,
          })
        );
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/400\.000,00/)).toBeDefined();
      });

      // Seleciona empresa de Produção antes de trocar ambiente
      fireEvent.click(screen.getByRole("option", { name: "Empresa Alpha" }));
      await waitFor(() => {
        expect(screen.getByText(/95\.000,00/)).toBeDefined();
      });

      // Alterna para HOMOLOGACAO
      mockEnvironment = "HOMOLOGACAO";
      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-loading")).toBeDefined();
      });
      // Não deve manter 95.000 da Produção durante a troca
      expect(screen.queryByText(/95\.000,00/)).toBeNull();

      hmlAtual.resolve(buildKpiSnapshot({ competencia: "2026-10", faturamentoTotal: 12345 }));
      hmlAnt.resolve(buildKpiSnapshot({ competencia: "2026-09", faturamentoTotal: 10000 }));

      await waitFor(() => {
        expect(screen.getByText(/12\.345,00/)).toBeDefined();
      });

      // Após o reset de ambiente, a consulta de HML deve usar escopo resetado (undefined = Consolidado)
      expect(seenEmpresaArgsInHml).toContain(undefined);
    });

    it("B4. Deltas não são exibidos com dados incompatíveis ou enquanto competência anterior está carregando/falhou", async () => {
      const antDeferred = createDeferred<OperationalIntegrityKPIs>();

      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation((_year, month) => {
        if (month === "10") {
          return Promise.resolve(buildKpiSnapshot({ competencia: "2026-10", faturamentoTotal: 200000 }));
        }
        return antDeferred.promise;
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/200\.000,00/)).toBeDefined();
      });

      // Enquanto kpisAnterior não resolveu, NÃO deve fabricar "+100%"
      expect(screen.queryByText("+100%")).toBeNull();

      // Se kpisAnterior retornar competência incompatível por qualquer razão, continua ocultando delta
      antDeferred.resolve(buildKpiSnapshot({ competencia: "2026-01", faturamentoTotal: 50000 }));

      await waitFor(() => {
        expect(screen.queryByText("+300.0%")).toBeNull();
      });
    });
  });

  // =========================================================================
  // GRUPO C — INADIMPLÊNCIA OFICIAL E COERÊNCIA NOS DRAWERS
  // =========================================================================
  describe("Grupo C — Fonte Oficial de Inadimplência e Coerência A Receber", () => {
    it("C1. Soma corretamente recebíveis vencidos válidos e exclui hoje, futuros, quitados, cancelados e duplicados", () => {
      const resultado = calcularTotalInadimplenteContextual(
        [
          // Válido 1: vencimento anterior ao corte
          {
            id: "rec-1",
            competencia: "2026-10",
            vencimento: "2026-10-15",
            status: "pendente_cobranca",
            data_recebimento: null,
            valor_total: 1200.55,
          },
          // Duplicidade do mesmo ID (não pode somar duas vezes)
          {
            id: "rec-1",
            competencia: "2026-10",
            vencimento: "2026-10-15",
            status: "pendente_cobranca",
            data_recebimento: null,
            valor_total: 1200.55,
          },
          // Válido 2: vencido em cobrança enviada
          {
            id: "rec-2",
            competencia: "2026-10",
            vencimento: "2026-10-20",
            status: "cobranca_enviada",
            data_recebimento: null,
            valor_total: 799.45,
          },
          // Não vencido: vence exatamente na data de corte
          {
            id: "rec-3",
            competencia: "2026-10",
            vencimento: "2026-11-11",
            status: "pendente_cobranca",
            data_recebimento: null,
            valor_total: 5000,
          },
          // Não vencido: futuro
          {
            id: "rec-4",
            competencia: "2026-10",
            vencimento: "2026-11-25",
            status: "cobranca_gerada",
            data_recebimento: null,
            valor_total: 3000,
          },
          // Quitado por status e/ou data_recebimento
          {
            id: "rec-5",
            competencia: "2026-10",
            vencimento: "2026-10-10",
            status: "recebido",
            data_recebimento: "2026-10-11",
            valor_total: 4000,
          },
          {
            id: "rec-6",
            competencia: "2026-10",
            vencimento: "2026-10-10",
            status: "pendente_recebimento",
            data_recebimento: "2026-10-12",
            valor_total: 2500,
          },
          // Cancelado e estornado
          {
            id: "rec-7",
            competencia: "2026-10",
            vencimento: "2026-10-05",
            status: "cancelado",
            data_recebimento: null,
            valor_total: 900,
          },
          {
            id: "rec-8",
            competencia: "2026-10",
            vencimento: "2026-10-05",
            status: "estornado",
            data_recebimento: null,
            valor_total: 900,
          },
          // Valor negativo ou zerado ignorado
          {
            id: "rec-9",
            competencia: "2026-10",
            vencimento: "2026-10-05",
            status: "pendente_cobranca",
            data_recebimento: null,
            valor_total: -150,
          },
          // Outra competência fora do recorte
          {
            id: "rec-10",
            competencia: "2026-09",
            vencimento: "2026-09-25",
            status: "pendente_cobranca",
            data_recebimento: null,
            valor_total: 8000,
          },
        ],
        { competencia: "2026-10", dataCorte: "2026-11-11" }
      );

      // Apenas rec-1 (1200.55) + rec-2 (799.45) = 2000.00
      // Obs: schema atual de receitas_operacionais liquida integralmente via status='recebido' (sem recebimento parcial).
      expect(resultado.totalInadimplente).toBe(2000);
      expect(resultado.quantidadeTitulos).toBe(2);
    });

    it("C2. InadimplenciaOficialService.getTotalInadimplenteByContexto aplica tenant, competencia, empresa e propaga erro", async () => {
      vi.restoreAllMocks();
      const eqCalls: Array<[string, unknown]> = [];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas") return createChainableQuery([]) as unknown as ReturnType<typeof supabase.from>;
        if (table === "receitas_operacionais") {
          const chain = createChainableQuery([
            {
              id: "r-valid",
              empresa_id: "emp-prod-1",
              competencia: "2026-10",
              vencimento: "2026-10-10",
              data_recebimento: null,
              status: "cobranca_enviada",
              valor_total: 3500,
            },
          ]);
          const origEq = chain.eq;
          chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
            eqCalls.push([col, val]);
            return origEq(col, val);
          });
          return chain as unknown as ReturnType<typeof supabase.from>;
        }
        return createChainableQuery([]) as unknown as ReturnType<typeof supabase.from>;
      });

      const res = await InadimplenciaOficialService.getTotalInadimplenteByContexto({
        tenantId: "tenant-esc-log-123",
        empresaId: "emp-prod-1",
        competencia: "2026-10",
        dataCorte: "2026-11-11",
        environment: "PRODUCAO",
      });

      expect(res.totalInadimplente).toBe(3500);
      expect(res.quantidadeTitulos).toBe(1);
      expect(eqCalls).toContainEqual(["tenant_id", "tenant-esc-log-123"]);
      expect(eqCalls).toContainEqual(["empresa_id", "emp-prod-1"]);

      // Fonte falhando deve lançar erro (nunca mascarar com zero)
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas") return createChainableQuery([]) as unknown as ReturnType<typeof supabase.from>;
        return createChainableQuery(null, { message: "Erro RLS receitas_operacionais" }) as unknown as ReturnType<typeof supabase.from>;
      });

      await expect(
        InadimplenciaOficialService.getTotalInadimplenteByContexto({
          tenantId: "tenant-esc-log-123",
          competencia: "2026-10",
          environment: "PRODUCAO",
        })
      ).rejects.toThrow();
    });

    it("C3. Drawers de Faturamento e Caixa exibem No Prazo + Vencido coerente com A Receber", () => {
      const { rerender } = render(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          inadimplenciaStatus="ok"
          data={{
            faturamentoTotal: 100000,
            caixaRecebido: 40000,
            aReceber: 60000,
            inadimplenteTotal: 15000,
            custosTotais: 50000,
            resultadoOperacional: 50000,
            margemOperacional: 50,
          }}
        />
      );

      // Recebido = 40k, A Receber No Prazo = 45k (60k - 15k), Vencido = 15k => soma = 100k
      expect(screen.getByText(/40\.000,00/)).toBeDefined();
      expect(screen.getByText(/45\.000,00/)).toBeDefined();
      expect(screen.getByText(/15\.000,00/)).toBeDefined();

      // Ausência legítima de inadimplência (0 com status ok) mostra R$ 0,00 legítimo e 60k no prazo
      rerender(
        <ExecutiveKpiDrawer
          type="caixa"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          inadimplenciaStatus="ok"
          data={{
            faturamentoTotal: 100000,
            caixaRecebido: 40000,
            aReceber: 60000,
            inadimplenteTotal: 0,
            custosTotais: 50000,
            resultadoOperacional: 50000,
            margemOperacional: 50,
          }}
        />
      );

      expect(screen.getByText("A Receber no Prazo")).toBeDefined();
      expect(screen.getByText(/60\.000,00/)).toBeDefined();
      expect(screen.getByText(/^R\$\s*0,00$/)).toBeDefined();
    });

    it("C4. Quando fonte de inadimplência falha ou está indisponível, Drawer exibe 'Indisponível' (jamais R$ 0,00 fictício)", () => {
      const onRetryInad = vi.fn();
      const { rerender } = render(
        <ExecutiveKpiDrawer
          type="faturamento"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          inadimplenciaStatus="error"
          onRetryInadimplencia={onRetryInad}
          data={{
            faturamentoTotal: 100000,
            caixaRecebido: 40000,
            aReceber: 60000,
            custosTotais: 50000,
            resultadoOperacional: 50000,
            margemOperacional: 50,
          }}
        />
      );

      expect(screen.getByText("Indisponível")).toBeDefined();
      expect(screen.getByText(/60\.000,00/)).toBeDefined();
      expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Tentar" }));
      expect(onRetryInad).toHaveBeenCalledTimes(1);

      rerender(
        <ExecutiveKpiDrawer
          type="caixa"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={vi.fn()}
          competencia="Outubro / 2026"
          inadimplenciaStatus="unavailable"
          data={{
            faturamentoTotal: 100000,
            caixaRecebido: 40000,
            aReceber: 60000,
            custosTotais: 50000,
            resultadoOperacional: 50000,
            margemOperacional: 50,
          }}
        />
      );

      expect(screen.getByText("Indisponível")).toBeDefined();
      expect(screen.getByText("A Receber (Total)")).toBeDefined();
      expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();
    });
  });

  // =========================================================================
  // GRUPO D — NÃO REGRESSÃO DE FÓRMULAS E NAVEGAÇÃO DRE (NAV-02-L01)
  // =========================================================================
  describe("Grupo D — Não Regressão de Cálculos Financeiros e Navegação DRE", () => {
    it("D1. Preserva fórmulas dos KPIs principais mesmo com inadimplência ativa no Drawer", async () => {
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation(async (_y, month) =>
        buildKpiSnapshot({
          competencia: month === "10" ? "2026-10" : "2026-09",
          faturamentoTotal: 250000,
          caixaRecebido: 150000,
          finValorAprovado: 100000,
          custosGerais: 25000,
          lucroReal: 125000,
        })
      );
      vi.spyOn(InadimplenciaOficialService, "getTotalInadimplenteByContexto").mockResolvedValue({
        totalInadimplente: 35000,
        quantidadeTitulos: 3,
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/250\.000,00/)).toBeDefined();
      });

      // Custos = 100k + 25k = 125k; Resultado = 125k; Margem = 50.0%; Recebido = 150k; A Receber = 100k
      expect(screen.getByText("50.0%")).toBeDefined();
      expect(screen.getByText(/150\.000,00/)).toBeDefined();
      expect(screen.getByText(/100\.000,00/)).toBeDefined();

      // Abre Drawer de Faturamento e valida inadimplência oficial repassada sem alterar totais
      fireEvent.click(screen.getByText("Faturamento Total"));

      await waitFor(() => {
        expect(screen.getByText("Faturamento Total — Outubro / 2026")).toBeDefined();
      });
      // Recebido 150k, No prazo 65k (100k - 35k), Vencido 35k
      expect(screen.getByText(/65\.000,00/)).toBeDefined();
      expect(screen.getByText(/35\.000,00/)).toBeDefined();
    });

    it("D2. Preserva exatamente os links NAV-02-L01 para DRE Gerencial (mensal, anual e consolidado)", () => {
      const onNavigateMock = vi.fn();

      const { rerender } = render(
        <ExecutiveKpiDrawer
          type="lucro"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Setembro / 2026"
          canonicalCompetencia="2026-09"
          empresaId="emp-prod-1"
          data={{
            faturamentoTotal: 100000,
            custosTotais: 60000,
            resultadoOperacional: 40000,
            margemOperacional: 40,
            caixaRecebido: 80000,
            aReceber: 20000,
          }}
        />
      );

      fireEvent.click(screen.getByText("Abrir DRE Gerencial"));
      expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre?mes=2026-09&empresa=emp-prod-1");

      rerender(
        <ExecutiveKpiDrawer
          type="margem"
          open={true}
          onOpenChange={vi.fn()}
          onNavigate={onNavigateMock}
          competencia="Ano Consolidado de 2026"
          canonicalCompetencia="2026-all"
          empresaId="all"
          data={{
            faturamentoTotal: 1000000,
            custosTotais: 700000,
            resultadoOperacional: 300000,
            margemOperacional: 30,
            caixaRecebido: 900000,
            aReceber: 100000,
          }}
        />
      );

      fireEvent.click(screen.getByText("Abrir DRE Gerencial"));
      expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre?mes=2026-all");
    });
  });

  describe("FIX-NAV-02-L01.2-01 — Tratamento de falhas de rede, offline, refetch stale e Radar", () => {
    it("F1. safeData propaga falha de rede mesmo quando error.details contém 'table' ou 'undefined' no stack, preservando schema ausente", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas" || table === "contas_bancarias_empresa") {
          return createChainableQuery([]) as never;
        }
        const chain = createChainableQuery();
        chain.then = (resolve: (value: { data: unknown; error: unknown; status?: number }) => void) =>
          resolve({
            data: null,
            status: 0,
            error: {
              code: "",
              message: "TypeError: Failed to fetch",
              details: "TypeError: Failed to fetch\n    at queryTable (src/lib/table.ts:10:5)\n    at undefinedHandler",
            },
          });
        return chain as never;
      });

      await expect(
        DashboardConsolidadoService.getKpisByCompetencia("2026-08", undefined, "PRODUCAO")
      ).rejects.toThrow("Failed to fetch");

      // Preserva tolerância legítima a tabela/migração ausente sem erro de transporte
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas" || table === "contas_bancarias_empresa") {
          return createChainableQuery([]) as never;
        }
        if (table === "servicos_extras_operacionais") {
          return createChainableQuery(null, {
            code: "PGRST205",
            message: "Could not find the table 'public.servicos_extras_operacionais' in the schema cache",
          }) as never;
        }
        return createChainableQuery([]) as never;
      });

      const zeroValid = await DashboardConsolidadoService.getKpisByCompetencia(
        "2026-08",
        undefined,
        "PRODUCAO"
      );
      expect(zeroValid.faturamentoTotal).toBe(0);
      expect(zeroValid.auditoriaCompetencia.status).toBe("sem_dados");
      consoleErrorSpy.mockRestore();
    });

    it("F2. Offline ao trocar Setembro -> Agosto bloqueia R$ 0,00 / Sem movimentação e recupera Agosto ao tentar novamente", async () => {
      localStorage.setItem("orbe_dashboard_year", "2026");
      localStorage.setItem("orbe_dashboard_month", "09");

      vi.spyOn(EmpresaService, "getAll").mockResolvedValue([
        { id: "emp-prod-1", nome: "Empresa Alpha", is_teste: false } as unknown as Awaited<
          ReturnType<typeof EmpresaService.getAll>
        >[number],
      ]);

      let offline = false;
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation(
        async (year, month, empresaId) => {
          const comp = `${year}-${month}`;
          if (offline) {
            throw new Error("TypeError: Failed to fetch");
          }
          if (comp === "2026-09") {
            return buildKpiSnapshot({
              competencia: "2026-09",
              faturamentoTotal: empresaId === "emp-prod-1" ? 95000 : 190000,
              caixaRecebido: 70000,
            });
          }
          if (comp === "2026-08") {
            return buildKpiSnapshot({
              competencia: "2026-08",
              faturamentoTotal: empresaId === "emp-prod-1" ? 64000 : 120000,
              caixaRecebido: 40000,
            });
          }
          return buildKpiSnapshot({ competencia: comp, faturamentoTotal: 0, caixaRecebido: 0 });
        }
      );

      renderDashboard();

      // Seleciona Empresa Alpha e confirma dados de Setembro
      await waitFor(() => {
        expect(screen.getByText(/190\.000,00/)).toBeDefined();
      });
      fireEvent.click(screen.getByRole("option", { name: "Empresa Alpha" }));
      await waitFor(() => {
        expect(screen.getByText(/95\.000,00/)).toBeDefined();
      });

      // Simula DevTools Offline + troca para Agosto
      offline = true;
      onlineManager.setOnline(false);
      fireEvent.click(screen.getByRole("option", { name: "Agosto" }));

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-error")).toBeDefined();
      });

      expect(screen.getByText("Não foi possível carregar os indicadores financeiros")).toBeDefined();
      expect(screen.getByText("Composição indisponível no momento")).toBeDefined();
      expect(screen.queryByText("Faturamento Total")).toBeNull();
      expect(screen.queryByText("Custos & Despesas")).toBeNull();
      expect(screen.queryByText("Resultado Operacional")).toBeNull();
      expect(screen.queryByText("Margem Operacional")).toBeNull();
      expect(screen.queryByText("Caixa & Contas")).toBeNull();
      expect(screen.queryByText(/95\.000,00/)).toBeNull();
      expect(screen.queryByText(/Sem movimentação financeira ou operacional registrada/i)).toBeNull();

      // Restaura rede e clica em Tentar novamente mantendo Empresa Alpha e Agosto/2026
      offline = false;
      onlineManager.setOnline(true);
      const retryButtons = screen.getAllByRole("button", { name: /Tentar novamente/i });
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/64\.000,00/)).toBeDefined();
      });
      expect(screen.queryByTestId("dashboard-kpis-error")).toBeNull();
      expect(screen.getByText(/Agosto \/ 2026/)).toBeDefined();
    });

    it("F3. Erro de refetch no mesmo contexto sinaliza dados desatualizados no Dashboard e no Drawer sem deltas inválidos", async () => {
      localStorage.setItem("orbe_dashboard_year", "2026");
      localStorage.setItem("orbe_dashboard_month", "09");

      let shouldFailAtual = false;
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation(
        async (year, month) => {
          const comp = `${year}-${month}`;
          if (comp === "2026-09") {
            if (shouldFailAtual) {
              throw new Error("Sem conexão ao atualizar indicadores");
            }
            return buildKpiSnapshot({
              competencia: "2026-09",
              faturamentoTotal: 180000,
              caixaRecebido: 110000,
              finValorAprovado: 70000,
              custosGerais: 10000,
              lucroReal: 100000,
            });
          }
          return buildKpiSnapshot({
            competencia: comp,
            faturamentoTotal: 120000,
          });
        }
      );

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/180\.000,00/)).toBeDefined();
      });
      // Delta visível enquanto válido (+50.0% de 120k para 180k)
      expect(screen.getByText("+50.0%")).toBeDefined();

      // Falha ao atualizar o mesmo contexto
      shouldFailAtual = true;
      fireEvent.click(screen.getByRole("button", { name: /Atualizar/i }));

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-refetch-error")).toBeDefined();
      });
      expect(screen.getByText(/exibindo dados desatualizados/i)).toBeDefined();
      // Não exibe delta potencialmente inconsistente quando refetch falha
      expect(screen.queryByText("+50.0%")).toBeNull();

      // Drawer do mesmo contexto exibe aviso explícito de dado desatualizado
      fireEvent.click(screen.getByText("Faturamento Total"));
      await waitFor(() => {
        expect(screen.getByTestId("drawer-stale-warning")).toBeDefined();
      });
      expect(screen.getByText(/Dados desatualizados — falha ao atualizar/i)).toBeDefined();
    });

    it("F4. Erro na troca de ambiente PRODUCAO -> HOMOLOGACAO não vaza valores anteriores nem exibe zeros", async () => {
      localStorage.setItem("orbe_dashboard_year", "2026");
      localStorage.setItem("orbe_dashboard_month", "09");
      mockEnvironment = "PRODUCAO";

      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation(
        async (year, month) => {
          const env = localStorage.getItem("esc-log-environment") || "PRODUCAO";
          if (env === "HOMOLOGACAO") {
            throw new Error("Rede indisponível em homologação");
          }
          return buildKpiSnapshot({
            competencia: `${year}-${month}`,
            faturamentoTotal: 222000,
          });
        }
      );

      const { rerender } = renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/222\.000,00/)).toBeDefined();
      });

      mockEnvironment = "HOMOLOGACAO";
      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-kpis-error")).toBeDefined();
      });
      expect(screen.queryByText(/222\.000,00/)).toBeNull();
      expect(screen.queryByText("Faturamento Total")).toBeNull();
      expect(screen.getByText("Composição indisponível no momento")).toBeDefined();
      expect(
        screen.queryByText(/Sem movimentação financeira ou operacional registrada/i)
      ).toBeNull();
    });

    it("F5. Radar de Atenção preserva alertas válidos quando uma consulta independente falha e nunca conclui 'Nenhuma pendência'", async () => {
      vi.mocked(DashboardConsolidadoService.getRadarAlertas).mockRestore();
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockResolvedValue(
        buildKpiSnapshot()
      );

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "empresas") {
          return createChainableQuery([]) as never;
        }
        if (table === "receitas_operacionais") {
          const chain = createChainableQuery();
          chain.then = (resolve: (value: { data: unknown; error: unknown; status?: number }) => void) =>
            resolve({
              data: null,
              status: 0,
              error: {
                code: "",
                message: "TypeError: Failed to fetch",
              },
            });
          return chain as never;
        }
        if (table === "diaristas_lotes_fechamento") {
          return createChainableQuery([
            {
              id: "lote-d-1",
              valor_total: 4200,
              status: "AGUARDANDO_VALIDACAO_RH",
              total_registros: 6,
            },
          ]) as never;
        }
        return createChainableQuery([]) as never;
      });

      const radarComStatus = await DashboardConsolidadoService.getRadarAlertasComStatus(
        "2026-10",
        undefined,
        "PRODUCAO"
      );
      expect(radarComStatus.alertas).toHaveLength(1);
      expect(radarComStatus.alertas[0].id).toBe("alt-diaristas-rh");
      expect(radarComStatus.falhas).toHaveLength(1);
      expect(radarComStatus.falhas[0].modulo).toBe("Financeiro / Cobrança");

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-radar-partial-error")).toBeDefined();
      });
      expect(screen.getByText(/Financeiro \/ Cobrança/)).toBeDefined();
      expect(screen.getByText("Lote semanal de diaristas pendente de validação")).toBeDefined();
      expect(
        screen.queryByText(/Nenhuma pendência crítica ou alerta ativo registrado/i)
      ).toBeNull();
    });

    it("F6. Radar de Atenção em falha total exibe indisponibilidade e Tentar novamente sem falso positivo de tudo ok", async () => {
      vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockResolvedValue(
        buildKpiSnapshot()
      );
      vi.spyOn(DashboardConsolidadoService, "getRadarAlertas").mockRejectedValue(
        new Error("Falha de rede ao consultar Radar")
      );

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-radar-error")).toBeDefined();
      });
      expect(
        screen.getByText("Não foi possível carregar o Radar de Atenção Operacional & Financeira")
      ).toBeDefined();
      expect(
        screen.queryByText(/Nenhuma pendência crítica ou alerta ativo registrado/i)
      ).toBeNull();
    });
  });
});
