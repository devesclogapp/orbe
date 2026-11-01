import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RegrasOperacionais from "@/pages/RegrasOperacionais";
import {
  EmpresaService,
  FormaPagamentoOperacionalService,
  FornecedorService,
  ProdutoCargaService,
  RegraOperacionalService,
  TipoServicoOperacionalService,
  TransportadoraClienteService,
  TipoRegraOperacionalService,
  RegrasModulosService,
  RegrasDadosService,
  ImportacaoModelosService,
} from "@/services/base.service";

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
    <div data-testid="app-shell">
      <header data-testid="app-shell-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock do AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-admin-123",
      email: "admin@esclog.com.br",
    },
    loading: false,
  }),
}));

// Mock do AccessControlContext
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    isAdmin: true,
    role: "admin",
    loading: false,
  }),
}));

// Mock do TenantContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenantId: "tenant-esc",
    loading: false,
  }),
}));

// Mock do Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { role: "admin", empresa_id: "emp-1" },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

// Mock sub-tabs to isolate tab Operacional
vi.mock("@/pages/Rh/TabRegrasDiaristas", () => ({
  TabRegrasDiaristas: () => <div data-testid="tab-diaristas-mock">Diaristas Mock</div>,
}));

vi.mock("@/pages/Financeiro/TabMeiosPagamento", () => ({
  TabMeiosPagamento: () => <div data-testid="tab-meios-mock">Meios Mock</div>,
}));

vi.mock("@/pages/Financeiro/TabTaxasImpostos", () => ({
  TabTaxasImpostos: () => <div data-testid="tab-taxas-mock">Taxas Mock</div>,
}));

vi.mock("@/components/regras/ServicosEspecificosRegrasTab", () => ({
  ServicosEspecificosRegrasTab: () => <div data-testid="tab-periodos-mock">Períodos Mock</div>,
}));

vi.mock("@/components/regras/DynamicRuleTabsContainer", () => ({
  default: () => <div data-testid="dynamic-tabs-container-mock">Dynamic Mock</div>,
}));

const MOCK_EMPRESAS = [
  { id: "emp-1", nome: "Benevides Matriz" },
  { id: "emp-2", nome: "Castanhal Filial" },
];

const MOCK_TIPOS_SERVICO = [
  { id: "srv-1", nome: "Descarga", ativo: true },
  { id: "srv-2", nome: "Carregamento", ativo: true },
];

const MOCK_TIPOS_REGRA = [
  { id: "tr-1", nome: "Taxa Operacional", unidade_medida: "monetario", ativo: true },
  { id: "tr-2", nome: "Percentual ISS", unidade_medida: "percentual", ativo: true },
];

const createMockRules = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `rule-${i + 1}`,
    empresa_id: i % 3 === 0 ? null : i % 2 === 0 ? "emp-1" : "emp-2",
    empresas: i % 3 === 0 ? null : { nome: i % 2 === 0 ? "Benevides Matriz" : "Castanhal Filial" },
    tipo_servico_id: "srv-1",
    tipos_servico_operacional: { nome: "Descarga" },
    transportadora_id: `transp-${i + 1}`,
    transportadoras_clientes: { nome: `Transportadora ${i + 1}` },
    fornecedor_id: `forn-${i + 1}`,
    fornecedores: { nome: `Fornecedor ${i + 1}` },
    produto_carga_id: null,
    produtos_carga: { nome: "Geral" },
    tipo_regra_id: "tr-1",
    tipos_regra_operacional: { nome: "Taxa Operacional", unidade_medida: "monetario" },
    tipo_calculo: "operation",
    valor_unitario: 10 + i * 2,
    forma_pagamento_id: null,
    formas_pagamento_operacional: null,
    vigencia_inicio: "2026-01-01",
    vigencia_fim: "2026-12-31",
    ativo: i % 4 !== 0, // alguns inativos
  }));
};

describe("CONV-20 — ETAPA 02: Convergência Visual de Regras Operacionais", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(EmpresaService, "getAll").mockResolvedValue(MOCK_EMPRESAS as any);
    vi.spyOn(TipoServicoOperacionalService, "getAllActive").mockResolvedValue(MOCK_TIPOS_SERVICO as any);
    vi.spyOn(TipoRegraOperacionalService, "getAllActive").mockResolvedValue(MOCK_TIPOS_REGRA as any);
    vi.spyOn(TransportadoraClienteService, "getByEmpresa").mockResolvedValue([] as any);
    vi.spyOn(FornecedorService, "getByEmpresa").mockResolvedValue([] as any);
    vi.spyOn(ProdutoCargaService, "getByFornecedor").mockResolvedValue([] as any);
    vi.spyOn(FormaPagamentoOperacionalService, "getAllActive").mockResolvedValue([] as any);
    vi.spyOn(RegrasModulosService, "listar").mockResolvedValue([] as any);
    vi.spyOn(RegrasDadosService, "listarPorModulo").mockResolvedValue([] as any);
    vi.spyOn(ImportacaoModelosService, "listAll").mockResolvedValue([] as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/cadastros/regras-operacionais?tab=operacional"]}>
          <RegrasOperacionais />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("1. Renderiza o cabeçalho institucional, abas limpas sem dropdowns inúteis e botão '+ Nova aba dinâmica'", async () => {
    vi.spyOn(RegraOperacionalService, "getAll").mockResolvedValue(createMockRules(5) as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Regras & Tabelas Operacionais")).toBeInTheDocument();
      expect(screen.getByText("Operacional")).toBeInTheDocument();
      expect(screen.getByText("Diaristas")).toBeInTheDocument();
      expect(screen.getByText("Meios de Pagamento")).toBeInTheDocument();
      expect(screen.getByText("Taxas e Impostos")).toBeInTheDocument();
      expect(screen.getByText("Períodos Operacionais")).toBeInTheDocument();
    });

    // O botão '+ Nova aba dinâmica' deve existir fora dos triggers de abas fixas
    const novaAbaBtn = screen.getByRole("button", { name: /Nova aba dinâmica/i });
    expect(novaAbaBtn).toBeInTheDocument();

    // Abas fixas não possuem o dropdown menu 'Abas fixas não podem ser editadas'
    expect(screen.queryByText("Abas fixas não podem ser editadas")).not.toBeInTheDocument();
  });

  it("2. Renderiza a toolbar corporativa da aba Operacional com busca, select de Empresa e select de Status", async () => {
    vi.spyOn(RegraOperacionalService, "getAll").mockResolvedValue(createMockRules(10) as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar por empresa, serviço/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Nova regra/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Importar planilha/i })).toBeInTheDocument();
      // Contador de regras encontradas
      expect(screen.getByText(/10 regras encontradas/i)).toBeInTheDocument();
    });
  });

  it("3. Paginação Canônica: Exibe 15 registros por padrão e permite navegar e alterar pageSize", async () => {
    const mockRules = createMockRules(35); // 35 regras no total
    vi.spyOn(RegraOperacionalService, "getAll").mockResolvedValue(mockRules as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Exibindo 1–15 de 35 regras")).toBeInTheDocument();
      expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    });

    // Altera pageSize para 25
    const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });

    await waitFor(() => {
      expect(screen.getByText("Exibindo 1–25 de 35 regras")).toBeInTheDocument();
      expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    });

    // Avança para página 2
    const nextBtn = screen.getByRole("button", { name: /Próxima página/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("Exibindo 26–35 de 35 regras")).toBeInTheDocument();
      expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    });
  });

  it("4. Filtro por Busca de Texto refina registros e reseta a paginação para a página 1", async () => {
    const mockRules = createMockRules(20);
    vi.spyOn(RegraOperacionalService, "getAll").mockResolvedValue(mockRules as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Exibindo 1–15 de 20 regras")).toBeInTheDocument();
    });

    // Digita no input de busca
    const searchInput = screen.getByPlaceholderText(/Buscar por empresa, serviço/i);
    fireEvent.change(searchInput, { target: { value: "Transportadora 3" } });

    await waitFor(() => {
      // Deve filtrar apenas as regras correspondentes
      expect(screen.getByText(/regra.*encontrada/i)).toBeInTheDocument();
      // Botão Limpar filtros aparece
      expect(screen.getByRole("button", { name: /Limpar filtros/i })).toBeInTheDocument();
    });

    // Clica em Limpar filtros
    const clearBtn = screen.getByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText("Exibindo 1–15 de 20 regras")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Limpar filtros/i })).not.toBeInTheDocument();
    });
  });

  it("5. Ações na linha possuem acessibilidade com botões de ícone Tooltip e status badges padronizados", async () => {
    const mockRules = createMockRules(3);
    vi.spyOn(RegraOperacionalService, "getAll").mockResolvedValue(mockRules as any);
    renderComponent();

    await waitFor(() => {
      // Botões de ação têm aria-labels acessíveis
      expect(screen.getAllByRole("button", { name: /Editar regra/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Duplicar regra/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Excluir regra/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /(Inativar|Ativar) regra/i }).length).toBeGreaterThan(0);
      // Badges de status têm textos Ativo / Inativo
      expect(screen.getAllByText(/(Ativo|Inativo)/i).length).toBeGreaterThan(0);
    });
  });
});
