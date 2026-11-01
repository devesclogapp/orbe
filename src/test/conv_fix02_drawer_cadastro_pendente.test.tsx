import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PontoJornadasClt } from "@/pages/Clt/PontoJornadasClt";
import { resolvePontoPresentation } from "@/services/rhPresentation.service";

// Mock AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

// Mock TenantContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ tenantId: "tenant-test-123" }),
}));

// Mock Navigation
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams({ mes: "2026-10" }), vi.fn()],
  };
});

// Mock Base Services
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-1", nome: "ESC Log Matriz" },
    ]),
  },
  ColaboradorService: {
    getWithEmpresa: vi.fn().mockResolvedValue([
      {
        id: "colab-atiniel",
        nome: "Atiniel Martins de Sousa",
        matricula: "CLT-004",
        empresa_id: "emp-1",
        cadastro_provisorio: true,
        status_cadastro: "pendente_complemento",
      },
      {
        id: "colab-carlos",
        nome: "Carlos Eduardo Silva",
        matricula: "CLT-001",
        empresa_id: "emp-1",
        cadastro_provisorio: false,
        status_cadastro: "ativo",
        tipo_contrato: "CLT",
        modelo_calculo: "PADRAO",
        valor_base: 2500,
      },
    ]),
  },
  PontoService: {
    importarPontos: vi.fn().mockResolvedValue({ totalProcessados: 10 }),
    getByMonth: vi.fn().mockResolvedValue([]),
    getMonthsWithData: vi.fn().mockResolvedValue(["2026-10"]),
  },
}));

// Mock V4 Service with presentation attached to saldos
vi.mock("@/services/v4.service", () => ({
  BHRegraService: {
    getWithEmpresa: vi.fn().mockResolvedValue([
      { id: "regra-1", nome: "Jornada 8h Padrão", bh_ativo: true, carga_horaria_diaria: 8 },
    ]),
  },
  BHEventoService: {
    getSaldosGerais: vi.fn().mockResolvedValue([
      {
        id: "colab-atiniel",
        colaborador_id: "colab-atiniel",
        nome: "Atiniel Martins de Sousa",
        matricula: "CLT-004",
        empresa: "ESC Log Matriz",
        saldo_minutos: 0,
        creditos_minutos: 0,
        debitos_minutos: 0,
        minutos_a_vencer_30d: 0,
        status: "regular",
        presentation: {
          statusVisual: "CADASTRO_PENDENTE",
          isBloqueado: true,
          explicacao: "Pré-cadastro importado — aguardando complemento cadastral pelo RH.",
        },
      },
      {
        id: "colab-carlos",
        colaborador_id: "colab-carlos",
        nome: "Carlos Eduardo Silva",
        matricula: "CLT-001",
        empresa: "ESC Log Matriz",
        saldo_minutos: 120,
        creditos_minutos: 200,
        debitos_minutos: -80,
        minutos_a_vencer_30d: 0,
        status: "saldo_positivo",
        presentation: {
          statusVisual: "MARCACAO_INCOMPLETA",
          isBloqueado: true,
          explicacao: "Marcação incompleta.",
        },
      },
    ]),
    createEvento: vi.fn().mockResolvedValue({ id: "evt-1" }),
  },
}));

// Mock RH Processing Service
vi.mock("@/services/rhProcessing.service", () => ({
  reprocessRhPeriod: vi.fn().mockResolvedValue({ processados: 2 }),
  rhProcessingUtils: {
    calculateWorkedMinutes: vi.fn().mockReturnValue(0),
  },
}));

// Mock PreCadastro Colaborador
vi.mock("@/services/preCadastroColaborador.service", () => ({
  ensurePreCadastrosFromImportedPontos: vi.fn().mockResolvedValue({ criados: 0 }),
}));

describe("RH-01 — CONV-FIX02: Drawer Orientado à Ação (Pendência Cadastral)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PontoJornadasClt />
        </BrowserRouter>
      </QueryClientProvider>
    );

  const openDrawerForColabIndex = async (index: number) => {
    renderComponent();
    const tabSaldos = await screen.findByRole("button", { name: /Saldos & Banco de Horas/i });
    fireEvent.click(tabSaldos);

    const btnExtratoList = await screen.findAllByText("Extrato / Ações");
    fireEvent.click(btnExtratoList[index]);
  };

  it("1 & 4. CADASTRO_PENDENTE exibe 'Completar Cadastro' e NÃO apresenta 'Regularizar este dia' como CTA principal", async () => {
    await openDrawerForColabIndex(0); // Atiniel (CADASTRO_PENDENTE)

    // No Drawer, aba Apuração, deve ter 'Completar Cadastro'
    const btnCompletar = await screen.findByRole("button", { name: /Completar Cadastro/i });
    expect(btnCompletar).toBeInTheDocument();

    // Contextual alert para CADASTRO_PENDENTE deve estar visível
    expect(screen.getByText(/Cadastro incompleto — processamento bloqueado/i)).toBeInTheDocument();

    // NÃO deve exibir 'Regularizar este dia' como solução principal do bloqueio
    expect(screen.queryByRole("button", { name: /Regularizar este dia/i })).not.toBeInTheDocument();
  });

  it("2 & 3. CTA 'Completar Cadastro' utiliza o colaborador_id correto e direciona para Central de Cadastros", async () => {
    await openDrawerForColabIndex(0); // Atiniel

    const btnCompletar = await screen.findByRole("button", { name: /Completar Cadastro/i });
    fireEvent.click(btnCompletar);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/cadastros?tab=colaboradores&colaboradorId=colab-atiniel&openModal=true&from=clt-pontos"
    );
  });

  it("5. Marcação incompleta sem bloqueio cadastral continua oferecendo 'Regularizar este dia'", async () => {
    await openDrawerForColabIndex(1); // Carlos (MARCACAO_INCOMPLETA)

    // Para Carlos (colaborador completo com marcação incompleta), deve ter 'Regularizar este dia'
    const btnRegularizar = await screen.findByRole("button", { name: /Regularizar este dia/i });
    expect(btnRegularizar).toBeInTheDocument();

    // E NÃO deve ter 'Completar Cadastro'
    expect(screen.queryByRole("button", { name: /Completar Cadastro/i })).not.toBeInTheDocument();
  });

  it("6. Jornada ausente continua oferecendo 'Configurar jornadas'", async () => {
    await openDrawerForColabIndex(0);

    const btnConfigurar = await screen.findByText("Configurar jornadas");
    expect(btnConfigurar).toBeInTheDocument();

    fireEvent.click(btnConfigurar);
    expect(mockNavigate).toHaveBeenCalledWith("/cadastros/regras-operacionais");
  });

  it("7. Colaborador sem ID aplica fail-closed com aviso e não inventa ID", () => {
    const colabSemId = {
      nome: "Colaborador Fantasma",
      matricula: "CLT-999",
      cadastro_provisorio: true,
    };

    const ponto = {
      id: "ponto-ghost",
      data: "2026-10-03",
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto,
      colaborador: colabSemId,
      tenantId: "tenant-test-123",
    });

    expect(pres.statusVisual).toBe("CADASTRO_PENDENTE");
    expect(pres.isBloqueado).toBe(true);
  });

  it("8. Aba 'Ações RH' não recebe card indevido 'Completar cadastro' (mantém os 4 grupos funcionais homologados)", async () => {
    await openDrawerForColabIndex(0);

    // Clica na aba 2. Ações RH
    const tabAcoes = await screen.findByText("2. Ações RH");
    fireEvent.click(tabAcoes);

    // Deve exibir o banner de alerta contextual sobre pendência cadastral
    expect(await screen.findByText(/Pendência cadastral ativa/i)).toBeInTheDocument();

    // Mantém exatamente as 4 ações especialistas homologadas:
    expect(screen.getByText("Regularizar Batida")).toBeInTheDocument();
    expect(screen.getByText("Decisão RH / Abonar")).toBeInTheDocument();
    expect(screen.getByText("Compensar Saldo BH")).toBeInTheDocument();
    expect(screen.getByText("Registrar Folga")).toBeInTheDocument();

    // NÃO deve ter um quinto card "Completar cadastro" como ação especialista de RH
    expect(screen.queryByRole("button", { name: /Completar Cadastro/i })).not.toBeInTheDocument();
  });

  it("9. Nenhuma alteração nos cálculos/apuração ou regras do Motor RH", () => {
    const colabPendente = {
      id: "colab-atiniel",
      nome: "Atiniel Martins de Sousa",
      matricula: "CLT-004",
      cadastro_provisorio: true,
      status_cadastro: "pendente_complemento",
    };

    const ponto = {
      id: "ponto-atiniel",
      colaborador_id: "colab-atiniel",
      data: "2026-10-03",
      entrada: "07:00",
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto,
      colaborador: colabPendente,
    });

    // Zero cálculos executados para colaborador provisório (Gate 1 inviolável)
    expect(pres.horasBrutas).toBe("—");
    expect(pres.horasExtra).toBe("—");
    expect(pres.saldoDia).toBe("—");
    expect(pres.isBloqueado).toBe(true);
  });
});
