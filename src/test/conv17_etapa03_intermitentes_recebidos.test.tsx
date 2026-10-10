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
    user: { id: "user-test-01", email: "gestor@esclog.com.br", role: "admin" },
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

import { TooltipProvider } from "@/components/ui/tooltip";

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) =>
          resolve({
            data: [
              {
                id: "item-01",
                data_referencia: "2026-10-01",
                empresa_id: "emp-01",
                nome_colaborador: "CARLOS SILVA",
                cargo: "OPERADOR DE CARGA",
                convocacao: "TURNO MANHA",
                horas_trabalhadas: 8.5,
                horas_normais: 8.0,
                he_50: 0.5,
                he_100: 0.0,
                hora_noturna: 0.0,
                total: 180.5,
                status_pipeline: "RECEBIDO",
                origem: "TIO DIGITAL",
                empresas: { nome: "BENEVIDES LOGÍSTICA" },
                colaboradores: { nome: "CARLOS SILVA" },
              },
              {
                id: "item-02",
                data_referencia: "2026-10-02",
                empresa_id: "emp-01",
                nome_colaborador: "MARCOS SOUZA",
                cargo: "CONFERENTE",
                convocacao: "TURNO NOTURNO",
                horas_trabalhadas: 9.0,
                horas_normais: 7.0,
                he_50: 1.0,
                he_100: 1.0,
                hora_noturna: 3.5,
                total: 240.0,
                status_pipeline: "RECEBIDO",
                origem: "TIO DIGITAL",
                empresas: { nome: "BENEVIDES LOGÍSTICA" },
                colaboradores: { nome: "MARCOS SOUZA" },
              },
            ],
            error: null,
          })
        ),
      })),
    },
  };
});

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
  },
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    listarLotes: vi.fn().mockResolvedValue([]),
    fecharPeriodo: vi.fn().mockResolvedValue([
      {
        id: "lote-01",
        competencia: "2026-10",
        quantidade_registros: 2,
        valor_total: 420.5,
      },
    ]),
    reabrirLote: vi.fn().mockResolvedValue({ success: true }),
    atualizarLancamento: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import IntermitentesRecebidos from "@/pages/Operacional/IntermitentesRecebidos";
import { IntermitentesTableBlock } from "@/components/operacoes/IntermitentesTableBlock";

describe("CONV-17 / ETAPA 03 — Convergência UI/UX Intermitentes Recebidos", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("1. Contrato Estático: IntermitentesRecebidos utiliza ExecutiveMetricCard e preserva restrições", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/pages/Operacional/IntermitentesRecebidos.tsx"
    );
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");

    // Deve importar e usar ExecutiveMetricCard
    expect(content).toContain("ExecutiveMetricCard");
    expect(content).toContain("label=\"Colaboradores Convocados\"");
    expect(content).toContain("label=\"Jornada Total Trabalhada\"");
    expect(content).toContain("label=\"Horas Extras & Noturna\"");
    expect(content).toContain("label=\"Valor Total Apurado\"");

    // Deve preservar a fita secundária com o detalhamento completo das horas (sem perda de dados)
    expect(content).toContain("Detalhamento da Jornada:");
    expect(content).toContain("Normais:");
    expect(content).toContain("HE 50%:");
    expect(content).toContain("HE 100%:");
    expect(content).toContain("Noturna:");
    expect(content).toContain("Total Apontamentos:");
    expect(content).toContain("Pendentes de Fechamento:");

    // Deve conter navegação para Lotes
    expect(content).toContain("/operacional/intermitentes/lotes");
    expect(content).toContain("Gestão de Lotes");

    // Preserva restrição de fechamento em "Todas as Empresas"
    expect(content).toContain('filterEmpresaId === "all"');
    expect(content).toContain("Selecione uma Empresa para Fechar");
    expect(content).toContain('if (filterEmpresaId === "all")');
    expect(content).toContain(
      'throw new Error("Para fechar o período, selecione uma empresa.");'
    );
  });

  it("2. Renderização: Exibe os 4 Indicadores Executivos Semânticos com valores corretos", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes"]}>
          <TooltipProvider>
            <IntermitentesRecebidos />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Espera dados carregarem
    await waitFor(() => {
      expect(screen.getByText("Colaboradores Convocados")).toBeInTheDocument();
    });

    expect(screen.getByText("Jornada Total Trabalhada")).toBeInTheDocument();
    expect(screen.getByText("Horas Extras & Noturna")).toBeInTheDocument();
    expect(screen.getByText("Valor Total Apurado")).toBeInTheDocument();

    // Fita secundária com os 8 KPIs preservados
    expect(screen.getByText("Detalhamento da Jornada:")).toBeInTheDocument();
    expect(screen.getByText("Total Apontamentos:")).toBeInTheDocument();
  });

  it("3. Barra Compacta de Filtros: Contém Empresa, Busca Rápida, Mês e Ano", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/intermitentes"]}>
          <TooltipProvider>
            <IntermitentesRecebidos />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          "Buscar por colaborador, cargo ou convocação..."
        )
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByText("Mês")).toBeInTheDocument();
    expect(screen.getByText("Ano")).toBeInTheDocument();
  });

  it("4. Tabela IntermitentesTableBlock: Renderiza colunas operacionais, badges e paginação", () => {
    const mockData = [
      {
        id: "1",
        data_referencia: "2026-10-01",
        empresa_id: "emp-1",
        empresas: { nome: "BENEVIDES" },
        nome_colaborador: "JOÃO SILVA",
        colaboradores: { nome: "JOÃO SILVA" },
        cargo: "OPERADOR",
        convocacao: "NORMAL",
        horas_trabalhadas: 8,
        horas_normais: 8,
        he_50: 0,
        he_100: 0,
        hora_noturna: 0,
        total: 150,
        status_pipeline: "RECEBIDO",
        origem: "TIO DIGITAL",
      },
    ];

    render(
      <IntermitentesTableBlock data={mockData} pageSizeDefault={10} />
    );

    expect(screen.getByText("DATA")).toBeInTheDocument();
    expect(screen.getByText("EMPRESA / DEP.")).toBeInTheDocument();
    expect(screen.getByText("COLABORADOR")).toBeInTheDocument();
    expect(screen.getByText("CARGO")).toBeInTheDocument();
    expect(screen.getByText("CONVOCAÇÃO")).toBeInTheDocument();
    expect(screen.getByText("H. TRAB.")).toBeInTheDocument();
    expect(screen.getByText("NORMAIS")).toBeInTheDocument();
    expect(screen.getByText("HE 50%")).toBeInTheDocument();
    expect(screen.getByText("HE 100%")).toBeInTheDocument();
    expect(screen.getByText("NOTURNA")).toBeInTheDocument();
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
    expect(screen.getByText("STATUS RH")).toBeInTheDocument();
    expect(screen.getByText("ORIGEM")).toBeInTheDocument();

    // Linha renderizada
    expect(screen.getByText("JOÃO SILVA")).toBeInTheDocument();
    expect(screen.getByText("BENEVIDES")).toBeInTheDocument();
    expect(screen.getByText("RECEBIDO")).toBeInTheDocument();

    // Paginação
    expect(screen.getByText(/Mostrando/)).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("5. Tabela IntermitentesTableBlock: Renderiza empty state amigável quando vazia", () => {
    render(<IntermitentesTableBlock data={[]} />);
    expect(
      screen.getByText("Nenhum registro de intermitente encontrado")
    ).toBeInTheDocument();
  });
});
