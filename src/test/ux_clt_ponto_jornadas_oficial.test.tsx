import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PontoJornadasClt } from "@/pages/Clt/PontoJornadasClt";
import { resolvePontoPresentation } from "@/services/rhPresentation.service";
import { JornadaResolver } from "@/services/operationalEngine/JornadaResolver";

// Mock AppShell to isolate page testing
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
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

// Mock Base Services
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-1", nome: "ESC Log Matriz" },
      { id: "emp-2", nome: "ESC Log Filial SP" },
    ]),
  },
  ColaboradorService: {
    getWithEmpresa: vi.fn().mockResolvedValue([
      { id: "colab-1", nome: "Carlos Eduardo Silva", matricula: "CLT-001", empresa_id: "emp-1" },
      { id: "colab-2", nome: "Mariana Souza Santos", matricula: "CLT-002", empresa_id: "emp-1" },
    ]),
  },
  PontoService: {
    importarPontos: vi.fn().mockResolvedValue({ totalProcessados: 10 }),
    getByMonth: vi.fn().mockResolvedValue([]),
    getMonthsWithData: vi.fn().mockResolvedValue(["2026-10", "2026-09"]),
  },
}));

// Mock V4 Service
vi.mock("@/services/v4.service", () => ({
  BHRegraService: {
    getWithEmpresa: vi.fn().mockResolvedValue([
      { id: "regra-1", nome: "Jornada 8h Padrão", bh_ativo: true, carga_horaria_diaria: 8 },
    ]),
  },
  BHEventoService: {
    getSaldosGerais: vi.fn().mockResolvedValue([
      {
        id: "colab-1",
        colaborador_id: "colab-1",
        nome: "Carlos Eduardo Silva",
        matricula: "CLT-001",
        empresa: "ESC Log Matriz",
        saldo_minutos: 180,
        creditos_minutos: 300,
        debitos_minutos: -120,
        minutos_a_vencer_30d: 0,
        status: "saldo_positivo",
      },
      {
        id: "colab-2",
        colaborador_id: "colab-2",
        nome: "Mariana Souza Santos",
        matricula: "CLT-002",
        empresa: "ESC Log Matriz",
        saldo_minutos: -45,
        creditos_minutos: 60,
        debitos_minutos: -105,
        minutos_a_vencer_30d: 0,
        status: "debito_leve",
      },
    ]),
    createEvento: vi.fn().mockResolvedValue({ id: "evt-1" }),
  },
}));

// Mock RH Processing Service
vi.mock("@/services/rhProcessing.service", () => ({
  reprocessRhPeriod: vi.fn().mockResolvedValue({ processados: 42 }),
  rhProcessingUtils: {
    calculateWorkedMinutes: vi.fn().mockReturnValue(480),
  },
}));

// Mock PreCadastro Colaborador
vi.mock("@/services/preCadastroColaborador.service", () => ({
  ensurePreCadastrosFromImportedPontos: vi.fn().mockResolvedValue({ criados: 0 }),
}));

// Mock Navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe("RH-01 — Nova Central CLT: Ponto & Jornadas CLT (/clt/pontos)", () => {
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

  it("1. Renderiza o título oficial e subtítulo canônico do ORBE Design System", async () => {
    renderComponent();

    expect(await screen.findByText("Ponto & Jornadas CLT")).toBeInTheDocument();
    expect(
      screen.getByText("Apuração de jornadas, marcações e banco de horas.")
    ).toBeInTheDocument();
    expect(screen.getByText("Módulo Pessoas & RH")).toBeInTheDocument();
  });

  it("2. Apresenta os 4 KPIs compactos da Síntese Superior", async () => {
    renderComponent();

    expect(await screen.findByText("Colaboradores Apurados")).toBeInTheDocument();
    expect(screen.getByText("Jornadas com Pendência")).toBeInTheDocument();
    expect(screen.getByText("Horas Extras no Período")).toBeInTheDocument();
    expect(screen.getByText("Saldo de Banco de Horas")).toBeInTheDocument();
  });

  it("3. Disponibiliza as 2 visões principais [Apuração & Batidas] e [Saldos & Banco de Horas]", async () => {
    renderComponent();

    const tabApuracao = await screen.findByRole("button", { name: /Apuração & Batidas/i });
    const tabSaldos = screen.getByRole("button", { name: /Saldos & Banco de Horas/i });

    expect(tabApuracao).toBeInTheDocument();
    expect(tabSaldos).toBeInTheDocument();
  });

  it("4. Permite alternar para a visão [Saldos & Banco de Horas] e exibe colunas consolidadas", async () => {
    renderComponent();

    const tabSaldos = await screen.findByRole("button", { name: /Saldos & Banco de Horas/i });
    fireEvent.click(tabSaldos);

    expect(await screen.findByText("Carlos Eduardo Silva")).toBeInTheDocument();
    expect(screen.getByText("Mariana Souza Santos")).toBeInTheDocument();
    expect(screen.getByText("Saldo Atual")).toBeInTheDocument();
    expect(screen.getByText("Créditos (+)")).toBeInTheDocument();
    expect(screen.getByText("Débitos (-)")).toBeInTheDocument();
    expect(screen.getByText("A Vencer (30d)")).toBeInTheDocument();
  });

  it("5. Header contém CTAs contextuais sem fechamento inline", async () => {
    renderComponent();

    const btnImportar = await screen.findByText("Importar marcações");
    const btnInconsistencias = screen.getByText("Central de Inconsistências");
    const btnFechamento = screen.getByText("Ir para Fechamento Mensal");

    expect(btnImportar).toBeInTheDocument();
    expect(btnInconsistencias).toBeInTheDocument();
    expect(btnFechamento).toBeInTheDocument();

    // Clicar em Ir para Fechamento despacha para a rota de fechamento
    fireEvent.click(btnFechamento);
    expect(mockNavigate).toHaveBeenCalledWith("/banco-horas/fechamento");

    // Clicar em Central de Inconsistências despacha para a rota transversal
    fireEvent.click(btnInconsistencias);
    expect(mockNavigate).toHaveBeenCalledWith("/inconsistencias");

    // Garantir que NÃO há botão 'Fechar Competência RH' inline na apuração
    expect(screen.queryByText("Fechar Competência RH")).not.toBeInTheDocument();
  });

  it("6. Abre o Drawer do Colaborador com as 3 abas canônicas e jornada read-only", async () => {
    renderComponent();

    const tabSaldos = await screen.findByRole("button", { name: /Saldos & Banco de Horas/i });
    fireEvent.click(tabSaldos);

    const btnExtrato = (await screen.findAllByText("Extrato / Ações"))[0];
    fireEvent.click(btnExtrato);

    // O Drawer deve abrir
    expect(await screen.findByText("1. Apuração da Competência")).toBeInTheDocument();
    expect(screen.getByText("2. Ações RH")).toBeInTheDocument();
    expect(screen.getByText("3. Histórico & Auditoria")).toBeInTheDocument();
    expect(screen.getByText("Configurar jornadas")).toBeInTheDocument();
  });

  it("7. Clicar em 'Configurar jornadas' no Drawer despacha para Regras Operacionais", async () => {
    renderComponent();

    const tabSaldos = await screen.findByRole("button", { name: /Saldos & Banco de Horas/i });
    fireEvent.click(tabSaldos);

    const btnExtrato = (await screen.findAllByText("Extrato / Ações"))[0];
    fireEvent.click(btnExtrato);

    const btnConfigurar = await screen.findByText("Configurar jornadas");
    fireEvent.click(btnConfigurar);

    expect(mockNavigate).toHaveBeenCalledWith("/cadastros/regras-operacionais");
  });

  it("8. Gate Cadastral: Colaborador válido e completo NÃO é bloqueado como CADASTRO_PENDENTE", () => {
    const validColab = {
      id: "colab-valid-01",
      nome: "Colaborador Completo",
      matricula: "CLT-100",
      cadastro_provisorio: false,
      status_cadastro: "ativo",
      empresa_id: "emp-1",
      tipo_contrato: "CLT",
      modelo_calculo: "PADRAO",
      valor_base: 2500,
    };

    const ponto = {
      id: "ponto-1",
      colaborador_id: "colab-valid-01",
      data: "2026-10-02", // Sexta-feira
      entrada: "08:00",
      saida_almoco: "12:00",
      retorno_almoco: "13:00",
      saida: "17:00",
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto,
      colaborador: validColab,
      regras: [{ id: "reg-1", bh_ativo: true, carga_horaria_diaria: 8 }],
      jornadas: [],
      tenantId: "tenant-test-123",
    });

    expect(pres.statusVisual).not.toBe("CADASTRO_PENDENTE");
  });

  it("9. Pre-cadastro: Colaborador com cadastro_provisorio ou pendente_complemento PERMANECE em CADASTRO_PENDENTE com mensagem neutra", () => {
    const preCadastroColab = {
      id: "colab-atiniel",
      nome: "Atiniel Martins de Sousa",
      matricula: "CLT-004",
      cadastro_provisorio: true,
      status_cadastro: "pendente_complemento",
      empresa_id: "emp-1",
      tipo_contrato: null,
      modelo_calculo: null,
      valor_base: null,
    };

    const ponto = {
      id: "ponto-atiniel",
      colaborador_id: "colab-atiniel",
      data: "2026-10-03", // Sábado
      entrada: null,
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto,
      colaborador: preCadastroColab,
      tenantId: "tenant-test-123",
    });

    expect(pres.statusVisual).toBe("CADASTRO_PENDENTE");
    expect(pres.isBloqueado).toBe(true);
    expect(pres.jornadaNome).toBe("Aguardando cadastro");
    expect(pres.explicacao).toBe("Pré-cadastro importado — aguardando complemento cadastral pelo RH.");
    expect(pres.horasExtra).toBe("—");
    expect(pres.saldoDia).toBe("—");
  });

  it("10. Camilo com marcação incompleta e cadastro pendente preserva batida factual e não calcula horas", () => {
    const camiloColab = {
      id: "colab-camilo",
      nome: "Camilo Pedrosa de Sousa",
      matricula: "CLT-005",
      cadastro_provisorio: true,
      status_cadastro: "pendente_complemento",
    };

    const pontoCamilo = {
      id: "ponto-camilo",
      colaborador_id: "colab-camilo",
      data: "2026-10-03",
      entrada: "07:00",
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto: pontoCamilo,
      colaborador: camiloColab,
      tenantId: "tenant-test-123",
    });

    expect(pres.statusVisual).toBe("CADASTRO_PENDENTE");
    expect(pres.marcacoes.entrada).toBe("07:00");
    expect(pres.marcacoes.saida_almoco).toBe("—");
    expect(pres.marcacoes.retorno_almoco).toBe("—");
    expect(pres.marcacoes.saida).toBe("—");
    expect(pres.horasBrutas).toBe("—");
    expect(pres.saldoDia).toBe("—");
  });

  it("11. Ausência de fallbacks '8h Diárias' e '8h Diárias (Padrão)' na apresentação", () => {
    const colabPendente = {
      id: "colab-pend",
      nome: "Colab Pendente",
      cadastro_provisorio: true,
    };

    const ponto = {
      id: "p-1",
      data: "2026-10-03",
      status_processamento: "PENDENTE",
    };

    const pres = resolvePontoPresentation({
      ponto,
      colaborador: colabPendente,
    });

    expect(pres.jornadaNome).not.toContain("8h Diárias");
    expect(pres.jornadaNome).not.toContain("8h Diárias (Padrão)");
    expect(pres.jornadaNome).toBe("Aguardando cadastro");
  });
});
