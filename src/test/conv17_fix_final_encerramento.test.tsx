import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IntermitentesLotes, {
  getDrawerFooterActions,
  getIntermitentesPipelineStages,
} from "@/pages/Operacional/IntermitentesLotes";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "financeiro@esclog.com.br", role: "admin" },
  }),
}));

// Mock AccessControlContext
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "admin",
    isAdmin: true,
    canAccess: () => true,
    hasPermission: () => true,
    userRole: "admin",
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

describe("CONV-17 / FIX FINAL E ENCERRAMENTO DA HOMOLOGAÇÃO", () => {
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

  describe("1. Matriz Canônica de CTAs (getDrawerFooterActions)", () => {
    it("1.1 Status AGUARDANDO_VALIDACAO_RH: habilita 'Ir para Validação RH' e desabilita 'Ver fluxo completo'", () => {
      const actions = getDrawerFooterActions("AGUARDANDO_VALIDACAO_RH");
      expect(actions.canIrValidacaoRh).toBe(true);
      expect(actions.canConsultarDevolvidas).toBe(false);
      expect(actions.canAprovarFinanceiro).toBe(false);
      expect(actions.canAvancarRemessa).toBe(false);
      expect(actions.canVerConciliacao).toBe(false);
      expect(actions.hasAvancoAction).toBe(true);
      expect(actions.canVerFluxoCompleto).toBe(false);
    });

    it("1.2 Status EM_ANALISE_RH: habilita 'Ir para Validação RH'", () => {
      const actions = getDrawerFooterActions("EM_ANALISE_RH");
      expect(actions.canIrValidacaoRh).toBe(true);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.3 Status CANCELADO: habilita 'Consultar Jornadas Devolvidas' e bloqueia ações financeiras", () => {
      const actions = getDrawerFooterActions("CANCELADO");
      expect(actions.canIrValidacaoRh).toBe(false);
      expect(actions.canConsultarDevolvidas).toBe(true);
      expect(actions.canAprovarFinanceiro).toBe(false);
      expect(actions.canAvancarRemessa).toBe(false);
      expect(actions.canVerConciliacao).toBe(false);
      expect(actions.hasAvancoAction).toBe(true);
      expect(actions.canVerFluxoCompleto).toBe(false);
    });

    it("1.4 Status DEVOLVIDO_RH: habilita 'Consultar Jornadas Devolvidas'", () => {
      const actions = getDrawerFooterActions("DEVOLVIDO_RH");
      expect(actions.canConsultarDevolvidas).toBe(true);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.5 Status VALIDADO_RH: habilita 'Aprovar Financeiro'", () => {
      const actions = getDrawerFooterActions("VALIDADO_RH");
      expect(actions.canAprovarFinanceiro).toBe(true);
      expect(actions.canAvancarRemessa).toBe(false);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.6 Status FECHADO_FINANCEIRO: habilita 'Avançar para Remessa'", () => {
      const actions = getDrawerFooterActions("FECHADO_FINANCEIRO");
      expect(actions.canAvancarRemessa).toBe(true);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.7 Status AGUARDANDO_PAGAMENTO: habilita 'Avançar para Remessa'", () => {
      const actions = getDrawerFooterActions("AGUARDANDO_PAGAMENTO");
      expect(actions.canAvancarRemessa).toBe(true);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.8 Status CNAB_GERADO: habilita 'Ver Conciliação Bancária'", () => {
      const actions = getDrawerFooterActions("CNAB_GERADO");
      expect(actions.canVerConciliacao).toBe(true);
      expect(actions.hasAvancoAction).toBe(true);
    });

    it("1.9 Status PAGO ou LIQUIDADO: sem CTA de avanço (hasAvancoAction = false)", () => {
      const actionsPago = getDrawerFooterActions("PAGO");
      expect(actionsPago.hasAvancoAction).toBe(false);
      expect(actionsPago.canVerFluxoCompleto).toBe(false);

      const actionsLiq = getDrawerFooterActions("LIQUIDADO");
      expect(actionsLiq.hasAvancoAction).toBe(false);
      expect(actionsLiq.canVerFluxoCompleto).toBe(false);
    });
  });

  describe("2. Semântica do Pipeline para Lotes Cancelados / Devolvidos", () => {
    it("2.1 Lote CANCELADO apresenta etapa Validação RH com status error e rótulo 'Cancelado RH'", () => {
      const { stages } = getIntermitentesPipelineStages("CANCELADO");
      expect(stages).toHaveLength(5);
      expect(stages[0].status).toBe("done"); // Importação Tio Digital
      expect(stages[1].status).toBe("done"); // Fechamento
      expect(stages[2].status).toBe("error"); // Validação RH
      expect(stages[2].label).toBe("Cancelado RH");
      expect(stages[3].status).toBe("pending"); // Aprovação Financeira
      expect(stages[4].status).toBe("pending"); // Pagamento
    });

    it("2.2 Lote DEVOLVIDO apresenta etapa Validação RH com status error e rótulo 'Devolvido RH'", () => {
      const { stages } = getIntermitentesPipelineStages("DEVOLVIDO");
      expect(stages[2].status).toBe("error");
      expect(stages[2].label).toBe("Devolvido RH");
      expect(stages[3].status).toBe("pending");
      expect(stages[4].status).toBe("pending");
    });
  });

  describe("3. Comportamento e Navegação do Drawer Primário na Interface Oficial", () => {
    const baseLoteMock = {
      id: "lote-cta-01",
      competencia: "2026-08",
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-08-31",
      quantidade_registros: 10,
      valor_total: 2500.0,
      horas_trabalhadas: 44,
      horas_normais: 40,
      he_50: 4,
      empresa_id: "emp-benevides",
      empresa: { id: "emp-benevides", nome: "BENEVIDES" },
      itens: [{ id: "it-1", colaborador: { nome: "JOAO SILVA" }, total_horas: "8h", valor_total: 250 }],
    };

    it("3.1 Não renderiza botão 'Ver fluxo completo' nem o Drawer Secundário na tela oficial", async () => {
      const loteMock = { ...baseLoteMock, status: "VALIDADO_RH", status_financeiro: "AGUARDANDO_FINANCEIRO" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Pipeline do Lote")).toBeInTheDocument();
      });

      // Confirma que 'Ver fluxo completo' NÃO existe
      expect(screen.queryByText(/Ver fluxo completo/i)).not.toBeInTheDocument();
      // Confirma que Drawer Secundário NÃO existe no DOM
      expect(screen.queryByTestId("drawer-secundario-shell")).not.toBeInTheDocument();
      expect(screen.queryByText("Linha do Tempo Detalhada")).not.toBeInTheDocument();
    });

    it("3.2 Lote AGUARDANDO_VALIDACAO_RH: CTA 'Ir para Validação RH' navega para /intermitentes/aprovacoes com estado", async () => {
      const loteMock = { ...baseLoteMock, status: "AGUARDANDO_VALIDACAO_RH", status_financeiro: "PENDENTE" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Ir para Validação RH/i })).toBeInTheDocument();
      });

      const btnIrRh = screen.getByRole("button", { name: /Ir para Validação RH/i });
      fireEvent.click(btnIrRh);

      expect(mockNavigate).toHaveBeenCalledWith("/intermitentes/aprovacoes", {
        state: {
          selectedLoteId: "lote-cta-01",
          loteId: "lote-cta-01",
          empresaId: "emp-benevides",
          competencia: "2026-08",
        },
      });
    });

    it("3.3 Lote CANCELADO: CTA 'Consultar Jornadas Devolvidas' navega para /operacional/intermitentes com estado", async () => {
      const loteMock = { ...baseLoteMock, status: "CANCELADO", status_financeiro: "CANCELADO", itens: [] };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Consultar Jornadas Devolvidas/i })).toBeInTheDocument();
      });

      const btnConsultar = screen.getByRole("button", { name: /Consultar Jornadas Devolvidas/i });
      fireEvent.click(btnConsultar);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/operacional/intermitentes"),
        {
          state: {
            loteId: "lote-cta-01",
            empresaId: "emp-benevides",
            competencia: "2026-08",
            origem: "lote_cancelado",
          },
        }
      );
    });

    it("3.4 Lote VALIDADO_RH: CTA 'Aprovar Financeiro' abre modal de confirmação canônico", async () => {
      const loteMock = { ...baseLoteMock, status: "VALIDADO_RH", status_financeiro: "AGUARDANDO_FINANCEIRO" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
      });

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Financeiro/i });
      fireEvent.click(btnAprovar);

      // Modal de confirmação canônico deve ser exibido (título h2)
      expect(screen.getByRole("heading", { name: /Confirmar Aprovação Financeira/i })).toBeInTheDocument();
      expect(screen.getByText(/Aprovação formal da obrigação contábil/i)).toBeInTheDocument();
    });

    it("3.5 Lote FECHADO_FINANCEIRO: CTA 'Avançar para Remessa' navega para /bancario com query params e estado", async () => {
      const loteMock = { ...baseLoteMock, status: "FECHADO_FINANCEIRO", status_financeiro: "AGUARDANDO_PAGAMENTO" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Avançar para Remessa/i })).toBeInTheDocument();
      });

      const btnRemessa = screen.getByRole("button", { name: /Avançar para Remessa/i });
      fireEvent.click(btnRemessa);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/bancario?tab=remessa&origem=INTERMITENTE"),
        expect.objectContaining({
          state: expect.objectContaining({
            loteId: "lote-cta-01",
          }),
        })
      );
    });

    it("3.6 Lote CNAB_GERADO: CTA 'Ver Conciliação Bancária' navega para /bancario com query params e estado", async () => {
      const loteMock = { ...baseLoteMock, status: "CNAB_GERADO", status_financeiro: "REMESSA_GERADA" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Ver Conciliação Bancária/i })).toBeInTheDocument();
      });

      const btnConciliacao = screen.getByRole("button", { name: /Ver Conciliação Bancária/i });
      fireEvent.click(btnConciliacao);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/bancario?tab=retorno&origem=INTERMITENTE"),
        expect.objectContaining({
          state: expect.objectContaining({
            loteId: "lote-cta-01",
          }),
        })
      );
    });

    it("3.7 Lote PAGO: exibe apenas o botão 'Fechar' no rodapé do drawer", async () => {
      const loteMock = { ...baseLoteMock, status: "PAGO", status_financeiro: "PAGO" };
      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([loteMock as any]);
      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(loteMock as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes/lotes", state: { selectedLoteId: "lote-cta-01" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Pipeline do Lote")).toBeInTheDocument();
      });

      // Não há botões de avanço
      expect(screen.queryByRole("button", { name: /Ir para Validação RH/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Consultar Jornadas Devolvidas/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Aprovar Financeiro/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Avançar para Remessa/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Ver Conciliação Bancária/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Ver fluxo completo/i })).not.toBeInTheDocument();

      // Botão Fechar está disponível (no rodapé e no header)
      expect(screen.getAllByRole("button", { name: /fechar/i }).length).toBeGreaterThanOrEqual(1);
    });
  });
});
