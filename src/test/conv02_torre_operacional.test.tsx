import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PipelineOperacional from "@/pages/PipelineOperacional";
import { ExecutiveTorreDrawer } from "@/components/torre/ExecutiveTorreDrawer";
import { TorreOperacionalService, EtapaOperacional } from "@/services/torreOperacional.service";
import * as fs from "fs";
import * as path from "path";

// Mock do Supabase
vi.mock("@/lib/supabase", () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve({ data: [] })),
    then: vi.fn((resolve) => resolve({ data: [] })),
  };

  return {
    supabase: {
      from: vi.fn(() => queryBuilder),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-id" } },
        }),
      },
    },
  };
});

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenantId: "test-tenant-id",
    loading: false,
  }),
}));

vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    environment: "PRODUCAO",
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

vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/domain/base.service")>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("test-tenant-id"),
  };
});

vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-1", nome: "Empresa Alpha Log" },
      { id: "emp-2", nome: "Empresa Beta Distribuidora" },
    ]),
  },
}));

describe("CONV-02 — TORRE OPERACIONAL OFICIAL (HOTFIX 01)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it("1. Garante ZERO import de torreMockData.ts e mock do UX Lab nos arquivos oficiais", () => {
    const pipelineFilePath = path.resolve(__dirname, "../pages/PipelineOperacional.tsx");
    const serviceFilePath = path.resolve(__dirname, "../services/torreOperacional.service.ts");
    const drawerFilePath = path.resolve(__dirname, "../components/torre/ExecutiveTorreDrawer.tsx");

    const pipelineContent = fs.readFileSync(pipelineFilePath, "utf-8");
    const serviceContent = fs.readFileSync(serviceFilePath, "utf-8");
    const drawerContent = fs.readFileSync(drawerFilePath, "utf-8");

    expect(pipelineContent).not.toContain("torreMockData");
    expect(pipelineContent).not.toContain("MOCK_RADAR_OPERACIONAL");
    expect(pipelineContent).not.toContain("MOCK_TRILHA_RECEITAS");
    expect(pipelineContent).not.toContain("MOCK_TRILHA_CUSTOS");

    expect(serviceContent).not.toContain("torreMockData");
    expect(drawerContent).not.toContain("torreMockData");
  });

  it("2. Renderiza a Torre Oficial com Radar de 4 Indicadores e as 2 Trilhas com 4 Nós cada", async () => {
    vi.spyOn(TorreOperacionalService, "getTorreData").mockResolvedValue({
      radar: {
        aguardandoAcao: 5,
        maiorEspera: "2d 4h",
        inconsistenciasImpeditivas: 1,
        emAndamento: 12,
      },
      trilhaReceitas: {
        id: "trilha-receitas",
        titulo: "Trilha A · Operações & Receitas",
        badgeTrilha: "Ciclo de Faturamento",
        descricao: "Acompanhamento de volume e receitas",
        etapas: [
          {
            id: "rec-1",
            ordem: 1,
            nome: "Entrada de Campo",
            subtitulo: "Descargas & Serviços Realizados",
            trilhaId: "trilha-receitas",
            trilhaTitulo: "Trilha A · Operações & Receitas",
            totalProcessos: 3,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "Operação",
            resumoSituacao: "3 em andamento regular",
            itens: [],
          },
          {
            id: "rec-2",
            ordem: 2,
            nome: "Validação Operacional",
            subtitulo: "Conferência",
            trilhaId: "trilha-receitas",
            trilhaTitulo: "Trilha A · Operações & Receitas",
            totalProcessos: 2,
            processosEmAtencao: 1,
            situacao: "atencao",
            responsavelSetorial: "Operação",
            resumoSituacao: "1 aguardando decisão",
            itens: [],
          },
          {
            id: "rec-3",
            ordem: 3,
            nome: "Pronto para Faturar",
            subtitulo: "Liberação Comercial",
            trilhaId: "trilha-receitas",
            trilhaTitulo: "Trilha A · Operações & Receitas",
            totalProcessos: 4,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "Financeiro",
            resumoSituacao: "4 em andamento",
            itens: [],
          },
          {
            id: "rec-4",
            ordem: 4,
            nome: "Faturado / Recebimento",
            subtitulo: "Títulos Emitidos",
            trilhaId: "trilha-receitas",
            trilhaTitulo: "Trilha A · Operações & Receitas",
            totalProcessos: 6,
            processosEmAtencao: 0,
            situacao: "concluido",
            responsavelSetorial: "Financeiro",
            resumoSituacao: "6 concluídos",
            itens: [],
          },
        ],
      },
      trilhaCustos: {
        id: "trilha-custos",
        titulo: "Trilha B · Mão de Obra & Custos",
        badgeTrilha: "Ciclo de Despesas",
        descricao: "Acompanhamento de custos",
        etapas: [
          {
            id: "cst-1",
            ordem: 1,
            nome: "Lançamento de Campo",
            subtitulo: "Presenças e Diárias",
            trilhaId: "trilha-custos",
            trilhaTitulo: "Trilha B · Mão de Obra & Custos",
            totalProcessos: 2,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "Operação",
            resumoSituacao: "2 em andamento",
            itens: [],
          },
          {
            id: "cst-2",
            ordem: 2,
            nome: "Validação Operacional / RH",
            subtitulo: "Conferência RH",
            trilhaId: "trilha-custos",
            trilhaTitulo: "Trilha B · Mão de Obra & Custos",
            totalProcessos: 1,
            processosEmAtencao: 1,
            situacao: "bloqueado",
            responsavelSetorial: "RH",
            resumoSituacao: "1 com bloqueio",
            itens: [],
          },
          {
            id: "cst-3",
            ordem: 3,
            nome: "Lote Homologado",
            subtitulo: "Aprovado RH",
            trilhaId: "trilha-custos",
            trilhaTitulo: "Trilha B · Mão de Obra & Custos",
            totalProcessos: 3,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "RH",
            resumoSituacao: "3 em andamento",
            itens: [],
          },
          {
            id: "cst-4",
            ordem: 4,
            nome: "Direcionamento Financeiro",
            subtitulo: "Preparação CNAB",
            trilhaId: "trilha-custos",
            trilhaTitulo: "Trilha B · Mão de Obra & Custos",
            totalProcessos: 5,
            processosEmAtencao: 0,
            situacao: "concluido",
            responsavelSetorial: "Financeiro",
            resumoSituacao: "5 concluídos",
            itens: [],
          },
        ],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PipelineOperacional />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Torre de Controle Operacional")).toBeInTheDocument();
      // Validar os 4 indicadores do Radar (com Maior Espera observacional)
      expect(screen.getByText("Aguardando Ação")).toBeInTheDocument();
      expect(screen.getByText("Maior Espera")).toBeInTheDocument();
      expect(screen.getByText("2d 4h")).toBeInTheDocument();
      expect(screen.getByText("Inconsistências Impeditivas")).toBeInTheDocument();
      expect(screen.getByText("Em Andamento Regular")).toBeInTheDocument();

      // Validar Trilha A e seus 4 nós
      expect(screen.getByText("Trilha A · Operações & Receitas")).toBeInTheDocument();
      expect(screen.getByText("Entrada de Campo")).toBeInTheDocument();
      expect(screen.getByText("Validação Operacional")).toBeInTheDocument();
      expect(screen.getByText("Pronto para Faturar")).toBeInTheDocument();
      expect(screen.getByText("Faturado / Recebimento")).toBeInTheDocument();

      // Validar Trilha B e seus 4 nós
      expect(screen.getByText("Trilha B · Mão de Obra & Custos")).toBeInTheDocument();
      expect(screen.getByText("Lançamento de Campo")).toBeInTheDocument();
      expect(screen.getByText("Validação Operacional / RH")).toBeInTheDocument();
      expect(screen.getByText("Lote Homologado")).toBeInTheDocument();
      expect(screen.getByText("Direcionamento Financeiro")).toBeInTheDocument();
    });
  });

  it("3. Garante ausência do kanban legado de 7 estágios e da tabela analítica inferior antiga", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PipelineOperacional />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByText("Esteira Operacional")).not.toBeInTheDocument();
    expect(screen.queryByText("Top 5 por Empresa")).not.toBeInTheDocument();
    expect(screen.queryByText("Gargalos Operacionais")).not.toBeInTheDocument();
  });

  it("4. Valida ExecutiveTorreDrawer aberto: diagnóstico, dados reais e princípio DETECTAR -> DIAGNOSTICAR -> DESPACHAR", () => {
    const mockStage: EtapaOperacional = {
      id: "rec-2",
      ordem: 2,
      nome: "Validação Operacional",
      subtitulo: "Conferência de Volume & Avarias",
      trilhaId: "trilha-receitas",
      trilhaTitulo: "Trilha A · Operações & Receitas",
      totalProcessos: 1,
      processosEmAtencao: 1,
      situacao: "bloqueado",
      responsavelSetorial: "Operação",
      resumoSituacao: "1 com bloqueio impeditivo",
      itens: [
        {
          id: "op-123456",
          codigo: "OP-123456",
          tipo: "Operação por Volume",
          cliente: "Empresa Alpha Log",
          unidade: "CD Logístico Principal",
          tempoRegistro: "Registrado há 2h",
          idadeHoras: 2,
          responsavelSetor: "Operação",
          situacaoCategoria: "bloqueado",
          situacaoTexto: "Restrição Operacional",
          motivo: "Operação de 500 caixas retida por inconsistência cadastral.",
          detalhe: "Valor de R$ 15.000,00",
          ctaLabel: "Resolver Inconsistência",
          rotaSugerida: "/inconsistencias",
          isBloqueado: true,
        },
      ],
    };

    render(
      <MemoryRouter>
        <ExecutiveTorreDrawer stage={mockStage} open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText("ETAPA 02")).toBeInTheDocument();
    expect(screen.getByText("OP-123456")).toBeInTheDocument();
    expect(screen.getByText("Empresa Alpha Log")).toBeInTheDocument();
    expect(screen.getByText("Registrado há 2h")).toBeInTheDocument();
    expect(screen.getByText("Resolver Inconsistência")).toBeInTheDocument();

    // PROIBIDO: Nenhuma ação especialista executada no Drawer
    expect(screen.queryByRole("button", { name: "Aprovar Lote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Faturar" })).not.toBeInTheDocument();
  });

  it("5. Valida mapeamento de CLT despachando exclusivamente para /clt/pontos", () => {
    const cltStage: EtapaOperacional = {
      id: "cst-2",
      ordem: 2,
      nome: "Validação Operacional / RH",
      subtitulo: "Conferência de Presença & Horas",
      trilhaId: "trilha-custos",
      trilhaTitulo: "Trilha B · Mão de Obra & Custos",
      totalProcessos: 1,
      processosEmAtencao: 1,
      situacao: "bloqueado",
      responsavelSetorial: "RH",
      resumoSituacao: "1 com bloqueio impeditivo",
      itens: [
        {
          id: "pto-789",
          codigo: "PTO-PTO789",
          tipo: "Ponto CLT",
          cliente: "Empresa Alpha Log",
          unidade: "João da Silva",
          tempoRegistro: "Registrado há 1d 4h",
          idadeHoras: 28,
          responsavelSetor: "RH",
          situacaoCategoria: "bloqueado",
          situacaoTexto: "Marcação com Inconsistência",
          motivo: "Espelho de ponto requer regularização.",
          detalhe: "Inconsistência cadastral ou batida incompleta",
          ctaLabel: "Abrir em Ponto & Jornadas",
          rotaSugerida: "/clt/pontos",
          isBloqueado: true,
        },
      ],
    };

    render(
      <MemoryRouter>
        <ExecutiveTorreDrawer stage={cltStage} open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText("PTO-PTO789")).toBeInTheDocument();
    expect(screen.getByText("Abrir em Ponto & Jornadas")).toBeInTheDocument();
    expect(cltStage.itens[0].rotaSugerida).toBe("/clt/pontos");
  });

  it("6. Valida Empty State quando não há processos retornados", async () => {
    vi.spyOn(TorreOperacionalService, "getTorreData").mockResolvedValue({
      radar: { aguardandoAcao: 0, maiorEspera: "—", inconsistenciasImpeditivas: 0, emAndamento: 0 },
      trilhaReceitas: {
        id: "trilha-receitas",
        titulo: "Trilha A · Operações & Receitas",
        badgeTrilha: "",
        descricao: "",
        etapas: [
          {
            id: "rec-1",
            ordem: 1,
            nome: "Entrada de Campo",
            subtitulo: "",
            trilhaId: "trilha-receitas",
            trilhaTitulo: "Trilha A",
            totalProcessos: 0,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "Operação",
            resumoSituacao: "Sem processos",
            itens: [],
          },
        ],
      },
      trilhaCustos: {
        id: "trilha-custos",
        titulo: "Trilha B · Mão de Obra & Custos",
        badgeTrilha: "",
        descricao: "",
        etapas: [
          {
            id: "cst-1",
            ordem: 1,
            nome: "Lançamento de Campo",
            subtitulo: "",
            trilhaId: "trilha-custos",
            trilhaTitulo: "Trilha B",
            totalProcessos: 0,
            processosEmAtencao: 0,
            situacao: "normal",
            responsavelSetorial: "Operação",
            resumoSituacao: "Sem processos",
            itens: [],
          },
        ],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PipelineOperacional />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Nenhum processo em andamento para esta competência e filtros selecionados.")
      ).toBeInTheDocument();
    });
  });

  it("7. Teste Semântico: Prova ausência de SLA arbitrário (>= 3 dias) e não inventa tempo médio", () => {
    const serviceFilePath = path.resolve(__dirname, "../services/torreOperacional.service.ts");
    const serviceContent = fs.readFileSync(serviceFilePath, "utf-8");

    // Prova que não há limiares arbitrários de 3 dias ou 72h
    expect(serviceContent).not.toContain(">= 3");
    expect(serviceContent).not.toContain("> 3");
    expect(serviceContent).not.toContain("72");
    expect(serviceContent).not.toContain("isAtrasado");
    expect(serviceContent).not.toContain("tempoParado");
    expect(serviceContent).not.toContain("tempoMedio");
  });
});
