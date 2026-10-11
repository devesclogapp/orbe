import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Configuracoes from "@/pages/Configuracoes";
import {
  ConfiguracaoOperacionalService,
  ImportacaoModelosService,
  EmpresaService,
} from "@/services/base.service";
import { supabase } from "@/lib/supabase";

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
const mockUser = {
  id: "user-test-uuid-123",
  email: "operador@esclog.com.br",
  user_metadata: {
    full_name: "Carlos Silva Operacional",
    role: "Administrador Geral",
    matricula: "ESC-8842",
    avatar_url: null,
  },
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    updateProfile: mockUpdateProfile,
  }),
}));

// Mock do PreferencesContext
const mockSetTheme = vi.fn();
const mockSetDefaultTab = vi.fn();
let currentTheme = "light";
let currentDefaultTab = "operacoes";

vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    theme: currentTheme,
    setTheme: (t: string) => {
      currentTheme = t;
      mockSetTheme(t);
    },
    defaultTab: currentDefaultTab,
    setDefaultTab: (tab: string) => {
      currentDefaultTab = tab;
      mockSetDefaultTab(tab);
    },
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

// Mock de Services
vi.mock("@/services/base.service", async () => {
  const actual = await vi.importActual<any>("@/services/base.service");
  return {
    ...actual,
    ConfiguracaoOperacionalService: {
      getByEmpresa: vi.fn().mockResolvedValue({
        moeda_padrao: "BRL (R$)",
        fuso_horario: "GMT-3 (Brasília)",
        tolerancia_ponto: 10,
        limite_escopo: 31,
        filtros_colaboradores_encarregado: {},
      }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    ImportacaoModelosService: {
      listAll: vi.fn().mockResolvedValue([
        { id: "1", modulo: "colaboradores", nome_arquivo: "modelo_colaboradores.xlsx", drive_url: "https://drive.google.com/...", ativo: true },
      ]),
      upsert: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
    },
    EmpresaService: {
      getAll: vi.fn().mockResolvedValue([
        { id: "empresa-1", nome: "ESC Logística Matriz" },
      ]),
    },
    StorageService: {
      uploadFile: vi.fn().mockResolvedValue({}),
      getPublicUrl: vi.fn().mockResolvedValue("https://storage/avatar.jpg"),
    },
  };
});

// Mock de subcomponentes pesados para isolamento de teste
vi.mock("@/pages/Configuracoes/ResetOperacional", () => ({
  default: () => <div data-testid="reset-operacional-mock">Reset Operacional Ativo</div>,
}));
vi.mock("@/pages/Configuracoes/JornadasTrabalhoSection", () => ({
  default: () => <div data-testid="jornadas-section-mock">Jornadas Trabalho Ativo</div>,
}));
vi.mock("@/pages/Configuracoes/RegrasBancoHorasSection", () => ({
  default: () => <div data-testid="regras-bh-section-mock">Regras BH Ativo</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

const renderComponent = (initialEntries = ["/configuracoes"]) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Configuracoes />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("CONV-21 — Etapa 02: Convergência Visual de Preferências Gerais e Meu Perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTheme = "light";
    currentDefaultTab = "operacoes";
  });

  it("1. Renderiza o cabeçalho executivo padronizado e a trilha canônica de 5 abas", async () => {
    renderComponent();

    // Cabeçalho padronizado
    expect(screen.getByText("Preferências & Perfil")).toBeInTheDocument();
    expect(
      screen.getByText("Personalize sua experiência de uso, tema visual e dados do perfil corporativo")
    ).toBeInTheDocument();

    // 5 Abas canônicas
    expect(screen.getByRole("tab", { name: /Preferências Gerais/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Configurações Operacionais/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Manutenção do Ambiente/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Modelos de Importação/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Meu Perfil/i })).toBeInTheDocument();
  });

  it("2. Aba Preferências Gerais exibe os blocos de Aparência e Navegação Padrão com OptionCards", async () => {
    renderComponent();

    // Bloco Aparência
    expect(screen.getByText("Aparência")).toBeInTheDocument();
    expect(screen.getByText("Personalize o visual e a luminosidade da interface do ERP.")).toBeInTheDocument();
    expect(screen.getByText("Modo Claro")).toBeInTheDocument();
    expect(screen.getByText("Modo Escuro")).toBeInTheDocument();

    // Bloco Navegação Padrão
    expect(screen.getByText("Navegação Padrão")).toBeInTheDocument();
    expect(screen.getByText("Ponto & Jornadas")).toBeInTheDocument();
    expect(screen.getByText("Operações de Campo")).toBeInTheDocument();

    // Banner de Manutenção do Ambiente
    expect(screen.getAllByText("Manutenção do Ambiente").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /Abrir Manutenção do Ambiente/i })).toBeInTheDocument();
  });

  it("3. Alternância entre Modo Claro e Modo Escuro aciona o setTheme do PreferencesContext", async () => {
    renderComponent();

    const modoEscuroBtn = screen.getByText("Modo Escuro").closest("button");
    expect(modoEscuroBtn).toBeInTheDocument();

    fireEvent.click(modoEscuroBtn!);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("4. Alternância entre visões de tela inicial aciona o setDefaultTab do PreferencesContext", async () => {
    renderComponent();

    const pontoBtn = screen.getByText("Ponto & Jornadas").closest("button");
    expect(pontoBtn).toBeInTheDocument();

    fireEvent.click(pontoBtn!);
    expect(mockSetDefaultTab).toHaveBeenCalledWith("ponto");
  });

  it("5. OptionCards exibem microindicador Ativo no item atualmente selecionado", async () => {
    renderComponent();

    // Com currentTheme = "light" e currentDefaultTab = "operacoes":
    const claroCard = screen.getByText("Modo Claro").closest("button");
    expect(claroCard).toHaveTextContent("Ativo");

    const operacoesCard = screen.getByText("Operações de Campo").closest("button");
    expect(operacoesCard).toHaveTextContent("Ativo");

    const pontoCard = screen.getByText("Ponto & Jornadas").closest("button");
    expect(pontoCard).not.toHaveTextContent("Ativo");
  });

  it("6. Aba Meu Perfil renderiza dados de identidade, matrícula, papel e tenant em grid responsivo", async () => {
    renderComponent(["/configuracoes?tab=conta"]);

    // Identidade do usuário
    expect(screen.getByText("Identidade & Dados Cadastrais")).toBeInTheDocument();
    expect(screen.getByText("Carlos Silva Operacional")).toBeInTheDocument();
    expect(screen.getByText("operador@esclog.com.br")).toBeInTheDocument();
    expect(screen.getByText("Administrador Geral")).toBeInTheDocument();

    // Matrícula e Tenant
    expect(screen.getByText("Matrícula Corporativa")).toBeInTheDocument();
    expect(screen.getByText("ESC-8842")).toBeInTheDocument();
    expect(screen.getByText("Organização / Tenant")).toBeInTheDocument();
  });

  it("7. Permite edição inline do nome corporativo com cancelamento e salvamento", async () => {
    renderComponent(["/configuracoes?tab=conta"]);

    const editBtn = screen.getByTitle("Editar nome");
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    // Deve exibir input com o nome atual
    const inputName = screen.getByDisplayValue("Carlos Silva Operacional");
    expect(inputName).toBeInTheDocument();

    // Alterar o valor
    fireEvent.change(inputName, { target: { value: "Carlos Silva Atualizado" } });

    // Clicar no botão de confirmação
    const confirmBtn = screen.getByTitle("Salvar nome");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "Carlos Silva Atualizado" });
    });
  });

  it("8. Card de Segurança permite solicitar redefinição de senha e exibe aviso de 2FA", async () => {
    renderComponent(["/configuracoes?tab=conta"]);

    expect(screen.getByText("Segurança & Credenciais")).toBeInTheDocument();
    expect(screen.getByText("Senha de Acesso")).toBeInTheDocument();
    expect(screen.getByText("Autenticação em Duas Etapas (2FA)")).toBeInTheDocument();
    expect(screen.getByText("Em breve")).toBeInTheDocument();

    const resetPassBtn = screen.getByRole("button", { name: /Solicitar Redefinição de Senha/i });
    expect(resetPassBtn).toBeInTheDocument();

    fireEvent.click(resetPassBtn);

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("operador@esclog.com.br");
    });
  });

  it("9. Botão de atalho no banner de Manutenção alterna diretamente para a aba manutenção", async () => {
    renderComponent(["/configuracoes?tab=preferencias"]);

    const openManutencaoBtn = screen.getByRole("button", { name: /Abrir Manutenção do Ambiente/i });
    fireEvent.click(openManutencaoBtn);

    // Deve alternar a aba ativa para manutenção
    await waitFor(() => {
      expect(screen.getByTestId("reset-operacional-mock")).toBeInTheDocument();
    });
  });
});
