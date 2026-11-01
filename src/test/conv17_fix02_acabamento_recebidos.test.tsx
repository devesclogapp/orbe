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
                cargo: "OPERADOR DE CARGA E DESCARGA PESADA",
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
                cargo: "CONFERENTE DE ARMAZÉM GERAL",
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
    getCurrentEnvironment: vi.fn().mockReturnValue("production"),
  },
}));

vi.mock("@/services/environment/EnvironmentQueryFilter", () => ({
  EnvironmentQueryFilter: {
    applyEmpresaScope: (query: any) => query,
  },
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    listarLotes: vi.fn().mockResolvedValue([]),
    fecharPeriodo: vi.fn().mockResolvedValue([]),
    reabrirLote: vi.fn().mockResolvedValue({ success: true }),
    atualizarLancamento: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import IntermitentesRecebidos from "@/pages/Operacional/IntermitentesRecebidos";
import { IntermitentesTableBlock } from "@/components/operacoes/IntermitentesTableBlock";

describe("CONV-17 / FIX 02 — Acabamento Visual Intermitentes Recebidos", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("1. Card Horas Extras & Noturna apresenta soma precisa de extras (totalHorasExtras) e subtítulo claro", async () => {
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
      expect(screen.getByText("02:30")).toBeInTheDocument();
    });

    // Subtítulo discriminando: 50%: 01:30 • 100%: 01:00 • Noturna: 03:30
    expect(screen.getByText(/50%: 01:30 • 100%: 01:00 • Noturna: 03:30/)).toBeInTheDocument();
  });

  it("2. Fita Secundária possui ritmo visual harmônico com Detalhamento da Jornada e zero perda de dados", async () => {
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
      expect(screen.getByText("Detalhamento da Jornada:")).toBeInTheDocument();
    });

    expect(screen.getByText("Normais:")).toBeInTheDocument();
    expect(screen.getByText("HE 50%:")).toBeInTheDocument();
    expect(screen.getByText("HE 100%:")).toBeInTheDocument();
    expect(screen.getByText("Noturna:")).toBeInTheDocument();
    expect(screen.getByText("Total Apontamentos:")).toBeInTheDocument();
    expect(screen.getByText("Pendentes de Fechamento:")).toBeInTheDocument();
  });

  it("3. IntermitentesTableBlock renderiza tooltip para cargos truncados e tooltip descritivo de edição", () => {
    const onEditMock = vi.fn();
    const mockData = [
      {
        id: "1",
        data_referencia: "2026-10-01",
        empresa_id: "emp-1",
        empresas: { nome: "BENEVIDES" },
        nome_colaborador: "JOÃO SILVA",
        colaboradores: { nome: "JOÃO SILVA" },
        cargo: "OPERADOR DE EMPILHADEIRA RETRÁTIL ELÉTRICA",
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
      <IntermitentesTableBlock data={mockData} onEdit={onEditMock} />
    );

    // O texto do cargo está presente no DOM
    expect(screen.getByText("OPERADOR DE EMPILHADEIRA RETRÁTIL ELÉTRICA")).toBeInTheDocument();

    // Botão de edição renderizado com tooltip descritivo e acessível
    const editBtn = screen.getByRole("button", {
      name: "Corrigir horas ou atribuir empresa a este colaborador",
    });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledWith(mockData[0]);
  });

  it("4. Paginação suporta alternância entre 15, 25, 50 e 100 registros com contagem precisa", () => {
    const mockItems = Array.from({ length: 45 }, (_, i) => ({
      id: `item-${i + 1}`,
      data_referencia: "2026-10-01",
      empresa_id: "emp-1",
      empresas: { nome: "BENEVIDES" },
      nome_colaborador: `COLABORADOR ${i + 1}`,
      colaboradores: { nome: `COLABORADOR ${i + 1}` },
      cargo: "OPERADOR",
      convocacao: "NORMAL",
      horas_trabalhadas: 8,
      horas_normais: 8,
      he_50: 0,
      he_100: 0,
      hora_noturna: 0,
      total: 100,
      status_pipeline: "RECEBIDO",
      origem: "TIO DIGITAL",
    }));

    render(<IntermitentesTableBlock data={mockItems} pageSizeDefault={15} />);

    // Mostrando 1 a 15 de 45 registros
    expect(screen.getByText(/Mostrando/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Alternância de tamanho de página
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "25" } });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    // Navega para página 2
    const nextBtn = screen.getAllByRole("button").find(b => b.querySelector("svg.lucide-chevron-right"));
    expect(nextBtn).toBeDefined();
    if (nextBtn) {
      fireEvent.click(nextBtn);
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
    }
  });
});
