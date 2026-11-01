import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";

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
  AppShell: ({ children, title, subtitle, badge }: any) => (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span>{badge}</span>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock services
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-01", nome: "BENEVIDES LOGÍSTICA" },
      { id: "emp-02", nome: "ESC ANANINDEUA" },
    ]),
  },
}));

vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-esc-log"),
  };
});

vi.mock("@/services/environment/EnvironmentService", () => ({
  EnvironmentService: {
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    getCurrentEnvironment: vi.fn().mockReturnValue("production"),
  },
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    listarLotes: vi.fn().mockResolvedValue([
      {
        id: "930915d6-cb8f-4739-8001-7fa49d3009e4",
        competencia: "2026-10",
        periodo_inicio: "2026-10-01",
        periodo_fim: "2026-10-31",
        quantidade_registros: 12,
        valor_total: 3500.5,
        horas_trabalhadas: 96,
        horas_normais: 80,
        he_50: 16,
        status: "VALIDADO_RH",
        status_financeiro: "AGUARDANDO_FINANCEIRO",
        empresa_id: "emp-01",
        empresa: { id: "emp-01", nome: "BENEVIDES LOGÍSTICA" },
      },
      {
        id: "b21849a1-55fa-42f1-9442-8aa123b456c7",
        competencia: "2026-10",
        periodo_inicio: "2026-10-01",
        periodo_fim: "2026-10-31",
        quantidade_registros: 8,
        valor_total: 2100.0,
        horas_trabalhadas: 64,
        horas_normais: 60,
        he_50: 4,
        status: "PAGO",
        status_financeiro: "PAGO",
        empresa_id: "emp-02",
        empresa: { id: "emp-02", nome: "ESC ANANINDEUA" },
      },
    ]),
    getLoteDetalhe: vi.fn().mockResolvedValue({
      id: "930915d6-cb8f-4739-8001-7fa49d3009e4",
      competencia: "2026-10",
      periodo_inicio: "2026-10-01",
      periodo_fim: "2026-10-31",
      quantidade_registros: 2,
      valor_total: 570,
      horas_trabalhadas: 18,
      horas_normais: 16,
      he_50: 2,
      status: "VALIDADO_RH",
      status_financeiro: "AGUARDANDO_FINANCEIRO",
      empresa: { id: "emp-01", nome: "BENEVIDES LOGÍSTICA" },
      created_at: "2026-10-05T14:30:00Z",
      validated_at: "2026-10-06T10:00:00Z",
      itens: [
        {
          id: "item-01",
          nome_colaborador: "CARLOS SILVA",
          cargo: "OPERADOR",
          convocacao: "TURNO MANHA",
          horas_trabalhadas: 8,
          horas_normais: 8,
          he_50: 0,
          total: 240,
          status_pipeline: "APROVADO_RH",
          data_referencia: "2026-10-05",
        },
      ],
    }),
    aprovarFinanceiro: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import IntermitentesLotes, { getIntermitentesTimelineSteps } from "@/pages/Operacional/IntermitentesLotes";

describe("CONV-17 / ETAPA 04 — Convergência UI/UX Lotes de Intermitentes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("1. Contrato Estático: IntermitentesLotes utiliza AppShell, ExecutiveMetricCard e preserva Drawers", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/pages/Operacional/IntermitentesLotes.tsx"
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");

    // Deve importar e usar ExecutiveMetricCard
    expect(content).toContain("ExecutiveMetricCard");
    expect(content).toContain('label="Total de Lotes"');
    expect(content).toContain('label="Registros Fechados"');
    expect(content).toContain('label="Horas Consolidadas"');
    expect(content).toContain('label="Montante Total"');

    // Deve preservar o drawer primário e eliminar o secundário redundante
    expect(content).toContain("<DrawerPrimarioShell");
    expect(content).not.toContain("<DrawerSecundarioShell");

    // Deve preservar a navegação e atalhos
    expect(content).toContain('navigate("/operacional/intermitentes")');
    expect(content).toContain('Jornadas / Processamento');
    expect(content).toContain('Pagamentos e Remessas');
    expect(content).toContain('/bancario?tab=intermitentes&origem=INTERMITENTE');

    // Tabela e colunas canônicas exigidas pelo teste E2E
    expect(content).toContain('th className="py-3 px-4 font-semibold">Lote</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Empresa</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Competência</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold text-center">Registros</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Composição Horas</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold text-right">Valor Total</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Status RH</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Status Financeiro</th>');
  });

  it("2. Renderização: Exibe Cabeçalho padronizado e os 4 Indicadores Executivos Semânticos", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes/lotes"]}>
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Cabeçalho
    expect(screen.getByText("Lotes de Intermitentes")).toBeInTheDocument();
    expect(screen.getByText("Jornadas / Processamento")).toBeInTheDocument();
    expect(screen.getByText("Pagamentos e Remessas")).toBeInTheDocument();

    // Aguarda carregar dados de lotes
    await waitFor(() => {
      expect(screen.getByText("160:00")).toBeInTheDocument();
    });

    expect(screen.getByText("Total de Lotes")).toBeInTheDocument();
    expect(screen.getByText("Registros Fechados")).toBeInTheDocument();
    expect(screen.getByText("Horas Consolidadas")).toBeInTheDocument();
    expect(screen.getByText("Montante Total")).toBeInTheDocument();

    // Valores dos KPIs consolidados (2 lotes, 12+8=20 registros, 96+64=160h)
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("3. Barra de Filtros: Renderiza busca, empresa, mês, ano e status", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes/lotes"]}>
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Buscar por código do lote ou empresa...")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByText("Mês")).toBeInTheDocument();
    expect(screen.getByText("Ano")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("4. Listagem de Lotes: Exibe os lotes com dados consolidados e badges", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes/lotes"]}>
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("BENEVIDES LOGÍSTICA")).toBeInTheDocument();
    });

    expect(screen.getByText("ESC ANANINDEUA")).toBeInTheDocument();

    // Badges de Status (pelo menos um na tabela)
    expect(screen.getAllByText("Aprovado RH").length).toBeGreaterThan(0);
    expect(screen.getByText("Aguardando Financeiro")).toBeInTheDocument();

    // Botões de Detalhes
    const detailButtons = screen.getAllByRole("button", { name: /detalhes/i });
    expect(detailButtons.length).toBeGreaterThan(0);
  });

  it("5. Drawer Primário: Abre detalhes do lote ao clicar na linha e exibe governança", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes/lotes"]}>
          <IntermitentesLotes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("BENEVIDES LOGÍSTICA")).toBeInTheDocument();
    });

    // Clica no primeiro botão de detalhes
    const detailButtons = screen.getAllByRole("button", { name: /detalhes/i });
    fireEvent.click(detailButtons[0]);

    // Espera o drawer primário carregar
    await waitFor(() => {
      expect(screen.getByText("Pipeline do Lote")).toBeInTheDocument();
    });

    // Verifica bloco de governança com padrão de diagnóstico
    expect(screen.getByText(/Lote Homologado pelo RH/i)).toBeInTheDocument();
    expect(screen.getByText(/Aprovar Financeiro/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ver fluxo completo/i)).not.toBeInTheDocument();
  });

  it("6. Helper de Linha do Tempo: Gera 6 etapas canônicas com descrições e status", () => {
    const steps = getIntermitentesTimelineSteps("VALIDADO_RH", {
      quantidade_registros: 10,
      valor_total: 2500,
      empresa: { nome: "TESTE EMPRESA" },
    });

    expect(steps).toHaveLength(6);
    expect(steps[0].title).toBe("1. Importação Tio Digital");
    expect(steps[1].title).toBe("2. Fechamento de Período");
    expect(steps[2].title).toBe("3. Validação do RH");
    expect(steps[3].title).toBe("4. Aprovação Financeira / Remessa");
    expect(steps[4].title).toBe("5. Geração de Arquivo CNAB 240");
    expect(steps[5].title).toBe("6. Retorno Bancário & Quitação (PAGO)");
  });
});
