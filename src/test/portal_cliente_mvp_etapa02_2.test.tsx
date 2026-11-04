import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ClientDashboard from "@/pages/Cliente/ClientDashboard";
import ClientReports from "@/pages/Cliente/ClientReports";
import { PortalGuard } from "@/components/Auth/PortalGuard";
import { PortalOperacionalService, PortalOperacaoItem } from "@/services/portal/portalOperacional.service";

// Mock do Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock do ContextualHelpButton para isolamento do teste
vi.mock("@/components/help/ContextualHelpButton", () => ({
  ContextualHelpButton: () => null,
}));

// Mock do useAuth
const mockUser = { id: "user-client-123", email: "gestor@empresa-alpha.com" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { user: mockUser },
    user: mockUser,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mock do ClientContext customizável por teste
let mockClientContextValue = {
  cliente: {
    id: "vinc-1",
    nome: "Empresa Alpha Contratante",
    user_id: "user-client-123",
    empresa_id: "emp-alpha-1111",
    status: "ativo",
  },
  isLoading: false,
  isClientUser: true,
  userRole: "cliente",
  isInternalUser: false,
  hasNoActiveVinculo: false,
  error: null,
  adminEmpresas: [
    { id: "emp-alpha-1111", nome: "Empresa Alpha Contratante" },
    { id: "emp-beta-2222", nome: "Empresa Beta Distribuidora" },
  ],
  selectedAdminEmpresaId: null as string | null,
  setSelectedAdminEmpresaId: vi.fn(),
};

vi.mock("@/contexts/ClientContext", () => ({
  useClient: () => mockClientContextValue,
  ClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock do PortalOperacionalService
vi.mock("@/services/portal/portalOperacional.service", () => ({
  PortalOperacionalService: {
    fetchStats: vi.fn(),
    fetchOperacoes: vi.fn(),
    fetchAllPeriodOperacoes: vi.fn(),
    getTiposServico: vi.fn(),
    getMyVinculo: vi.fn(),
  },
}));

const mockOperacoes: PortalOperacaoItem[] = [
  {
    id: "op-1",
    data_operacao: "2026-11-03",
    empresa_nome: "Empresa Alpha Contratante",
    transportadora_nome: "Transp Rápido",
    fornecedor_nome: "Fornecedor Central",
    tipo_servico_nome: "Descarga Paletizada",
    produto_nome: "Alimentos Secos",
    quantidade: 1500,
    placa: "ABC-1234",
    nf_numero: "NF-99881",
    ctrc: "CT-5544",
    horario_inicio: "08:00:00",
    horario_fim: "11:30:00",
    status_operacional: "Concluído",
    observacao: "Descarga realizada sem divergências na doca 03.",
    total_count: 1,
  },
];

const mockStats = {
  total_operacoes: 1,
  volume_total: 1500,
  operacoes_hoje: 1,
  empresa_nome: "Empresa Alpha Contratante",
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("ETAPA 02.2 — IMPLEMENTAÇÃO INTEGRAL DO PORTAL DO CLIENTE (MVP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (PortalOperacionalService.fetchStats as any).mockResolvedValue(mockStats);
    (PortalOperacionalService.fetchOperacoes as any).mockResolvedValue({
      itens: mockOperacoes,
      total: 1,
    });
    (PortalOperacionalService.fetchAllPeriodOperacoes as any).mockResolvedValue({
      itens: mockOperacoes,
      total: 1,
    });
  });

  describe("FASE A: Dashboard Operacional do Cliente", () => {
    it("1. Renderiza indicadores reais conectados sem expor dados financeiros", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/cliente/dashboard"]}>
            <ClientDashboard />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Aguardar carregamento dos dados da RPC
      await waitFor(() => {
        expect(screen.getAllByText("Descarga Paletizada").length).toBeGreaterThan(0);
      });

      // Identificação da Empresa Contratante
      expect(screen.getAllByText("Empresa Alpha Contratante").length).toBeGreaterThan(0);

      // KPIs Operacionais
      expect(screen.getByText("Operações no Período")).toBeInTheDocument();
      expect(screen.getByText("Volume Total Movimentado")).toBeInTheDocument();
      expect(screen.getByText("Operações de Hoje")).toBeInTheDocument();
      expect(
        screen.getAllByText((content) =>
          content.replace(/\s/g, "").includes("1.500") ||
          content.replace(/\s/g, "").includes("1,500") ||
          content.includes("1500")
        ).length
      ).toBeGreaterThan(0);

      // Histórico de Operações Recentes
      expect(screen.getByText("Alimentos Secos")).toBeInTheDocument();
      expect(screen.getByText("Transp Rápido")).toBeInTheDocument();

      // Blindagem estrita: Garantir ausência de valores monetários ou dados de colaboradores
      expect(screen.queryByText(/R\$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Diarista/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Salário/i)).not.toBeInTheDocument();
    });
  });

  describe("FASE B: Consulta de Operações", () => {
    it("2. Renderiza tabela completa com filtros, campos autorizados e modal de detalhes", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/cliente/operacoes"]}>
            <ClientReports />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("NF: NF-99881")).toBeInTheDocument();
        expect(screen.getByText("ABC-1234")).toBeInTheDocument();
        expect(screen.getByText("Descarga Paletizada")).toBeInTheDocument();
      });

      // Clicar em Detalhes
      const detalhesBtn = screen.getByRole("button", { name: /Detalhes/i });
      fireEvent.click(detalhesBtn);

      // Modal de Detalhes deve exibir observações autorizadas e horários
      await waitFor(() => {
        expect(screen.getByText("Detalhamento da Operação")).toBeInTheDocument();
        expect(screen.getByText(/Descarga realizada sem divergências na doca 03/i)).toBeInTheDocument();
        expect(screen.getAllByText(/CT-5544/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe("FASE C: Pré-Visualização Administrativa (Admin Mode)", () => {
    it("3. Renderiza banner administrativo e seletor de empresa quando usuário é Admin", async () => {
      // Simular contexto de Admin acessando a prévia do Portal do Cliente
      mockClientContextValue = {
        ...mockClientContextValue,
        userRole: "admin",
        isInternalUser: true,
        isClientUser: false,
        selectedAdminEmpresaId: "emp-alpha-1111",
      };

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/cliente/dashboard"]}>
            <ClientDashboard />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Visualização Administrativa/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Voltar ao ERP/i)).toBeInTheDocument();
      });
    });
  });

  describe("FASE D: Proteção de Acesso & Tratamento de Vínculo Inativo", () => {
    it("4. Exibe tela de vínculo não localizado se papel for cliente mas sem empresa ativa", async () => {
      // Restaurar contexto para cliente sem vínculo ativo
      mockClientContextValue = {
        ...mockClientContextValue,
        cliente: null,
        userRole: "cliente",
        isInternalUser: false,
        hasNoActiveVinculo: true,
      };

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/cliente/dashboard"]}>
            <PortalGuard>
              <ClientDashboard />
            </PortalGuard>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Vínculo com Empresa Não Localizado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sair da conta/i })).toBeInTheDocument();
      });
    });
  });
});
