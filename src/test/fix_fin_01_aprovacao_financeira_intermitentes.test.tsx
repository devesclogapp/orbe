import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IntermitentesLotes from "@/pages/Operacional/IntermitentesLotes";
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
    user: { id: "user-financeiro-01", email: "financeiro@esclog.com.br", role: "financeiro" },
  }),
}));

// Mock TenantContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    currentTenant: { id: "tenant-test" },
    role: "financeiro",
    isAdmin: false,
  }),
}));

// Mock AccessControlContext
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "financeiro",
    isAdmin: false,
    canAccess: () => true,
    hasPermission: () => true,
    userRole: "financeiro",
  }),
}));

// Mock AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

// Mock EmpresaService
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: () =>
      Promise.resolve([
        { id: "28a560b5-37ef-403d-ae4f-b28a608b6a68", nome: "Empresa Teste - Homologação" },
      ]),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseLoteMock = {
  id: "183c011a-53ea-41da-b76f-aea686362f38",
  tenant_id: "09ccafb6-2cf2-4c83-ac3d-a2913947693c",
  empresa_id: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
  competencia: "2026-11",
  periodo_inicio: "2026-11-01",
  periodo_fim: "2026-11-30",
  quantidade_registros: 2,
  valor_total: 350.0,
  status: "VALIDADO_RH",
  status_financeiro: "AGUARDANDO_FINANCEIRO",
  created_at: "2026-10-15T10:00:00.000Z",
  updated_at: "2026-10-15T13:53:39.000Z",
  validated_at: "2026-10-15T13:53:39.000Z",
  validated_by: "user-rh-01",
  empresa: { nome: "Empresa Teste - Homologação" },
  itens: [
    {
      id: "80224654-3a19-4f81-b520-a56b3df7fa48",
      colaborador_id: "7eaf4402-8954-471b-a2c8-914f12265c98",
      nome_colaborador: "Homologação Itaú 001",
      horas_trabalhadas: 6,
      total: 150.0,
      status_pipeline: "APROVADO_RH",
    },
    {
      id: "f832ee60-0d19-4821-93f7-067e0ca5955f",
      colaborador_id: "7035d08d-74b5-4172-87c2-3ba9a27d8b02",
      nome_colaborador: "Homologação Itaú 002",
      horas_trabalhadas: 8,
      total: 200.0,
      status_pipeline: "APROVADO_RH",
    },
  ],
};

describe("ERP ORBE — FIX-FIN-01: Aprovação Financeira de Lote de Intermitentes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  it("1. Abre o modal 'Confirmar Aprovação Financeira' e exibe os dados do lote alvo", async () => {
    vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([baseLoteMock as any]);
    vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(baseLoteMock as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/operacional/intermitentes/lotes",
              state: { selectedLoteId: baseLoteMock.id },
            },
          ]}
        >
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
    });

    const btnAprovar = screen.getByRole("button", { name: /Aprovar Financeiro/i });
    fireEvent.click(btnAprovar);

    expect(screen.getByRole("heading", { name: /Confirmar Aprovação Financeira/i })).toBeInTheDocument();
    expect(screen.getAllByText("Empresa Teste - Homologação").length).toBeGreaterThan(0);
    expect(screen.getByText("2 registros")).toBeInTheDocument();
  });

  it("2. Ao confirmar aprovação financeira, executa IntermitentesLoteService.aprovarFinanceiro com o ID correto do lote e usuário", async () => {
    vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([baseLoteMock as any]);
    vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(baseLoteMock as any);
    const aprovarSpy = vi
      .spyOn(IntermitentesLoteService, "aprovarFinanceiro")
      .mockResolvedValue(true as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/operacional/intermitentes/lotes",
              state: { selectedLoteId: baseLoteMock.id },
            },
          ]}
        >
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
    });

    // 1. Abre modal
    fireEvent.click(screen.getByRole("button", { name: /Aprovar Financeiro/i }));

    // 2. Localiza botão dentro do modal de confirmação
    const btnConfirmar = screen.getByRole("button", { name: /Confirmar Aprovação Financeira/i });
    expect(btnConfirmar).toBeInTheDocument();

    // 3. Clica para aprovar
    fireEvent.click(btnConfirmar);

    // 4. Confirma que aprovarFinanceiro foi chamado com o UUID exato do lote, sem perder a referência
    await waitFor(() => {
      expect(aprovarSpy).toHaveBeenCalledTimes(1);
      expect(aprovarSpy).toHaveBeenCalledWith(baseLoteMock.id, "user-financeiro-01");
    });
  });

  it("3. Se o modal for cancelado, nenhuma mutação ou escrita é disparada", async () => {
    vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([baseLoteMock as any]);
    vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue(baseLoteMock as any);
    const aprovarSpy = vi.spyOn(IntermitentesLoteService, "aprovarFinanceiro");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/operacional/intermitentes/lotes",
              state: { selectedLoteId: baseLoteMock.id },
            },
          ]}
        >
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Aprovar Financeiro/i }));
    expect(screen.getByRole("heading", { name: /Confirmar Aprovação Financeira/i })).toBeInTheDocument();

    const btnCancelar = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(btnCancelar);

    expect(aprovarSpy).not.toHaveBeenCalled();
  });
});
