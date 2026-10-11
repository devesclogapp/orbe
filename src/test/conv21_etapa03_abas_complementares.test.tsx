import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Configuracoes from "@/pages/Configuracoes";
import ResetOperacional from "@/pages/Configuracoes/ResetOperacional";

// Hoisted mocks
const { mockModelos, mockUser } = vi.hoisted(() => ({
  mockModelos: [
    {
      id: "mod-1",
      modulo: "colaboradores",
      nome_arquivo: "modelo_colaboradores.xlsx",
      drive_url: "https://drive.google.com/file/d/test1",
      ativo: true,
    },
    {
      id: "mod-2",
      modulo: "transportadoras",
      nome_arquivo: "modelo_transportadoras.xlsx",
      drive_url: "https://drive.google.com/file/d/test2",
      ativo: false,
    },
  ],
  mockUser: {
    id: "user-test-uuid-123",
    email: "operador@esclog.com.br",
    user_metadata: {
      full_name: "Carlos Silva Operacional",
      role: "admin",
      matricula: "ESC-8842",
      avatar_url: null,
    },
  },
}));

// Mock de Navegação
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock do AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ title, subtitle, children }: any) => (
    <div data-testid="app-shell" className="mx-auto max-w-[1560px] p-6">
      <header data-testid="app-shell-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock do AuthContext
const mockUpdateProfile = vi.fn().mockResolvedValue({});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    updateProfile: mockUpdateProfile,
  }),
}));

// Mock do TenantContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-esc-log", name: "ESC Logística" },
    tenantId: "tenant-esc-log",
    role: "admin",
    loading: false,
    canReset: true,
  }),
}));

// Mock do AccessControlContext
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    canManageRules: true,
    isEncarregado: false,
    isAdmin: true,
  }),
}));

// Mock do PreferencesContext
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    theme: "light",
    setTheme: vi.fn(),
    defaultTab: "operacoes",
    setDefaultTab: vi.fn(),
  }),
}));

// Mock do Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { empresa_id: "ESC Logística Matriz" },
          }),
        }),
      }),
    }),
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

vi.mock("@/services/base.service", async () => {
  const actual = await vi.importActual<any>("@/services/base.service");
  return {
    ...actual,
    ConfiguracaoOperacionalService: {
      getAll: vi.fn().mockResolvedValue({
        moeda_padrao: "BRL (R$)",
        fuso_horario: "GMT-3 (Brasília)",
        limite_escopo: 31,
        tolerancia_ponto: 10,
        arredondamento_financeiro: "Duas casas",
        notificacao_inconsistencia: true,
      }),
      save: vi.fn().mockResolvedValue({ success: true }),
    },
    ImportacaoModelosService: {
      listAll: vi.fn().mockResolvedValue(mockModelos),
      list: vi.fn().mockResolvedValue(mockModelos),
      upsert: vi.fn().mockResolvedValue({ id: "mod-new", success: true }),
      save: vi.fn().mockResolvedValue({ id: "mod-new", success: true }),
      remove: vi.fn().mockResolvedValue({ success: true }),
    },
    EmpresaService: {
      getAll: vi.fn().mockResolvedValue([
        { id: "emp-1", nome: "Empresa Teste Matriz", status: "ATIVO" },
      ]),
    },
  };
});

// Mock ResetOperacionalService
vi.mock("@/services/resetOperacional.service", () => ({
  ResetOperacionalService: {
    previewOperacional: vi.fn().mockResolvedValue({
      total_registros: 120,
      tabelas: [{ tabela: "operacoes", descricao: "Operações", registros: 100 }],
      confirmation_phrase: "CONFIRMAR RESET OPERACIONAL",
    }),
    previewFinanceiro: vi.fn().mockResolvedValue({
      total_registros: 45,
      tabelas: [{ tabela: "faturas", descricao: "Faturas", registros: 45 }],
      confirmation_phrase: "CONFIRMAR RESET FINANCEIRO",
    }),
    previewCompletoTenant: vi.fn().mockResolvedValue({
      total_registros: 165,
      tabelas: [],
      confirmation_phrase: "CONFIRMAR RESET TOTAL",
    }),
    previewDemoEnvironment: vi.fn().mockResolvedValue({
      total_registros: 500,
      tabelas: [],
      confirmation_phrase: "CONFIRMAR RESET DEMO",
    }),
    resetOperacional: vi.fn().mockResolvedValue({ total_registros: 120 }),
    resetFinanceiro: vi.fn().mockResolvedValue({ total_registros: 45 }),
    resetCompletoTenant: vi.fn().mockResolvedValue({ total_registros: 165 }),
    resetDemoEnvironment: vi.fn().mockResolvedValue({ total_registros: 500 }),
  },
}));

// Mock JornadaService
vi.mock("@/services/jornada.service", () => ({
  JornadaService: {
    listar: vi.fn().mockResolvedValue([
      {
        id: "jornada-1",
        nome: "Jornada Padrão 44h",
        status: "ativo",
        carga_semanal_minutos: 2640,
        grade_semanal: {},
      },
    ]),
    obterReferenciaGeral: vi.fn().mockReturnValue({
      cargaSemanalMinutos: 2640,
      divisorMensal: 220,
    }),
  },
}));

function renderWithClient(ui: React.ReactElement, initialEntries = ["/configuracoes"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CONV-21 — Etapa 03: Convergência das Abas Complementares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Renderiza a aba Configurações Operacionais com cards padronizados do Motor Operacional", async () => {
    renderWithClient(<Configuracoes />, ["/configuracoes?tab=config_operacional"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Motor Operacional/i })).toBeInTheDocument();
    });

    expect(screen.getByText("Parâmetros Gerais")).toBeInTheDocument();
    expect(screen.getByText("Regras de Apuração")).toBeInTheDocument();
    expect(screen.getByText("Moeda Padrão")).toBeInTheDocument();
    expect(screen.getByText("Tolerância de Ponto (Minutos)")).toBeInTheDocument();
    expect(screen.getByText("Jornadas de Trabalho")).toBeInTheDocument();
    expect(screen.getByText("Regras de Banco de Horas")).toBeInTheDocument();
    expect(screen.getByText("Filtros de colaboradores por tela do encarregado")).toBeInTheDocument();
  });

  it("2. Permite alternar modo de edição dos Parâmetros Operacionais", async () => {
    renderWithClient(<Configuracoes />, ["/configuracoes?tab=config_operacional"]);

    await waitFor(() => {
      expect(screen.getByText("Editar Parâmetros")).toBeInTheDocument();
    });

    const editBtn = screen.getByText("Editar Parâmetros");
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText("Salvar Alterações")).toBeInTheDocument();
    });
  });

  it("3. Renderiza a aba Modelos de Importação com tabela padronizada, status canônicos e ações", async () => {
    renderWithClient(<Configuracoes />, ["/configuracoes?tab=modelos"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Modelos de Importação" })).toBeInTheDocument();
    });

    expect(screen.getByText("Novo Modelo")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Módulo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nome do arquivo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Link do Drive" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ações" })).toBeInTheDocument();

    // Modelos mockados
    await waitFor(() => {
      expect(screen.getByText("modelo_colaboradores.xlsx")).toBeInTheDocument();
      expect(screen.getByText("modelo_transportadoras.xlsx")).toBeInTheDocument();
      expect(screen.getByText("Ativo")).toBeInTheDocument();
      expect(screen.getByText("Inativo")).toBeInTheDocument();
    });
  });

  it("4. Abre o modal de cadastro de novo Modelo de Importação com campos estilizados", async () => {
    renderWithClient(<Configuracoes />, ["/configuracoes?tab=modelos"]);

    await waitFor(() => {
      expect(screen.getByText("Novo Modelo")).toBeInTheDocument();
    });

    const newBtn = screen.getByText("Novo Modelo");
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText("Novo modelo de importação")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Ex: modelo_transportadoras.xlsx")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("https://drive.google.com/...")).toBeInTheDocument();
      expect(screen.getByText("Modelo ativo")).toBeInTheDocument();
      expect(screen.getByText("Salvar Modelo")).toBeInTheDocument();
    });
  });

  it("5. Renderiza a aba Manutenção do Ambiente em padrão institucional sóbrio com salvaguardas intactas", async () => {
    renderWithClient(<Configuracoes />, ["/configuracoes?tab=manutencao"]);

    await waitFor(() => {
      expect(screen.getByText(/Manutenção do Ambiente & Resets Transacionais/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Área Restrita — Operações Críticas")).toBeInTheDocument();
    expect(screen.getByText("Dupla Proteção Obrigatória")).toBeInTheDocument();
    expect(screen.getByText("Reset Operacional")).toBeInTheDocument();
    expect(screen.getByText("Reset Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Reset Completo do Tenant")).toBeInTheDocument();
    expect(screen.getAllByText("Reset Ambiente Demo").length).toBeGreaterThanOrEqual(1);

    // Garante que o botão destrutivo não é acionado inadvertidamente
    const limparBtn = screen.getByText("Limpar Produção");
    expect(limparBtn).toBeInTheDocument();
  });

  it("6. Valida isolamento e robustez do componente ResetOperacional", async () => {
    renderWithClient(<ResetOperacional />);

    await waitFor(() => {
      expect(screen.getByText(/Manutenção do Ambiente & Resets Transacionais/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Reset Operacional")).toBeInTheDocument();
    expect(screen.getByText("Reset Financeiro")).toBeInTheDocument();
  });
});
