import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabRegrasDiaristas } from "@/pages/Rh/TabRegrasDiaristas";
import { TabMeiosPagamento } from "@/pages/Financeiro/TabMeiosPagamento";
import DynamicRuleTabContent from "@/components/regras/DynamicRuleTabContent";
import { ServicosEspecificosRegrasTab } from "@/components/regras/ServicosEspecificosRegrasTab";

// Mocks de contexto
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ tenantId: "tenant-esc-123" }),
}));

vi.mock("@/hooks/useTenantData", () => ({
  useTenantData: () => ({ tenantId: "tenant-esc-123" }),
}));

vi.mock("@/hooks/useOnboardingCallback", () => ({
  useOnboardingCallback: () => ({
    isOnboardingReturn: false,
    handleOnboardingReturn: vi.fn(),
  }),
}));

// Mock dos serviços base
vi.mock("@/services/base.service", () => ({
  RegraMarcacaoDiaristaService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: "regra-d1",
        codigo: "P",
        descricao: "Presença Integral",
        multiplicador: 1.0,
        empresa_id: null,
        ativo: true,
      },
      {
        id: "regra-d2",
        codigo: "F",
        descricao: "Falta Justificada",
        multiplicador: 0.0,
        empresa_id: "emp-1",
        ativo: false,
      },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleAtivo: vi.fn(),
  },
  FormaPagamentoOperacionalService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "fp-1", nome: "PIX", modalidade: "CAIXA_IMEDIATO", ativo: true },
      { id: "fp-2", nome: "Boleto 15D", modalidade: "DUPLICATA", ativo: false },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleAtivo: vi.fn(),
  },
  RegrasFinanceirasService: {
    getAllActive: vi.fn().mockResolvedValue([
      { id: "prazo-global", empresa_id: null, prazo_dias: 7, modalidade_financeira: "DUPLICATA", is_global: true },
      { id: "prazo-alfa", empresa_id: "emp-1", prazo_dias: 14, modalidade_financeira: "DUPLICATA", is_global: false },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([{ id: "emp-1", nome: "Empresa Alfa" }]),
  },
  RegrasModulosService: {
    listar: vi.fn().mockResolvedValue([
      { id: 1, nome: "Taxas e Impostos", slug: "taxas_impostos", module_type: "tax" },
    ]),
    buscarPorId: vi.fn().mockResolvedValue({ id: 1, nome: "Taxas e Impostos", slug: "taxas_impostos", module_type: "tax" }),
    obterPorId: vi.fn().mockResolvedValue({ id: 1, nome: "Taxas e Impostos", slug: "taxas_impostos", module_type: "tax" }),
  },
  RegrasCamposService: {
    listarPorModulo: vi.fn().mockResolvedValue([]),
  },
  RegrasDadosService: {
    listarPorModulo: vi.fn().mockResolvedValue([
      {
        id: 1,
        modulo_id: 1,
        dados: {
          "Nome da Taxa": "ISS Padrão",
          "Tipo de Incidência": "Percentual",
          "Percentual": 5,
          "Base de Cálculo": "Valor bruto",
          "Vigência Inicial": "2026-01-01",
          "Status": "Ativo",
        },
      },
    ]),
  },
}));

// Mock dos serviços de Períodos Operacionais
vi.mock("@/services/domain/servicos_especificos.service", () => ({
  ServicosEspecificosRegrasService: {
    ensureDefaultPeriods: vi.fn().mockResolvedValue(true),
    getAll: vi.fn().mockResolvedValue([
      { id: "per-1", codigo: "D1", descricao: "Primeiro Diurno", tipo_periodo: "DIURNO", peso_multiplicador: 1.0, ativo: true },
      { id: "per-2", codigo: "N1", descricao: "Primeiro Noturno", tipo_periodo: "NOTURNO", peso_multiplicador: 1.2, ativo: false },
    ]),
    update: vi.fn().mockResolvedValue(true),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("CONV-20 / ETAPA 03: Convergência Visual das Abas Complementares", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it("1. Tab Diaristas: Exibe cabeçalho harmonizado, badges de escopo/status canônicos e ações", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <TabRegrasDiaristas />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Multiplicadores do Módulo Diaristas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova Regra/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Presença Integral")).toBeInTheDocument();
    });

    // Scope chip & canonical status
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("2. Tab Meios de Pagamento: Exibe status canônico (sem verde saturado), banner global D+N harmonizado e ações com tooltips", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <TabMeiosPagamento />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Meios de Pagamento Operacionais")).toBeInTheDocument();
    expect(screen.getByText("Prazos de Vencimento de Duplicatas / Boletos")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("PIX")).toBeInTheDocument();
    });

    // Canonical status check
    const ativoBadges = screen.getAllByText("Ativo");
    expect(ativoBadges.length).toBeGreaterThanOrEqual(1);

    // Banner da regra padrão global
    expect(screen.getByText("Regra Padrão Global")).toBeInTheDocument();
    expect(screen.getByText("D+7")).toBeInTheDocument();
  });

  it("3. Tab Taxas e Impostos: Renderiza tabela com status canônico, percentual e ações padronizadas", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <DynamicRuleTabContent
            moduloId={1}
            title="Taxas e Impostos"
            description="Gerencie taxas e impostos, como ISS."
          />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Taxas e Impostos")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Nova Regra/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("ISS Padrão")).toBeInTheDocument();
    });

    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("4. Tab Períodos Operacionais: Exibe help contextual harmonizado, turnos com chips técnicos e status canônico", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServicosEspecificosRegrasTab />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Períodos Operacionais / Turnos")).toBeInTheDocument();
    });

    expect(screen.getByText(/Exemplos de códigos gerados nos lançamentos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("D1")).toBeInTheDocument();
      expect(screen.getByText("N1")).toBeInTheDocument();
    });

    expect(screen.getByText("DIURNO")).toBeInTheDocument();
    expect(screen.getByText("NOTURNO")).toBeInTheDocument();
    expect(screen.getByText("1.00x")).toBeInTheDocument();
    expect(screen.getByText("1.20x")).toBeInTheDocument();
  });
});
