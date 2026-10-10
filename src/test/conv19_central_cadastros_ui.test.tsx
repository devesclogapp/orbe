import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CentralCadastros from "@/pages/CentralCadastros";
import Colaboradores from "@/pages/Colaboradores";
import {
  ColaboradorService,
  EmpresaService,
  ColetorService,
  TransportadoraClienteService,
  FornecedorService,
  TipoServicoOperacionalService,
  ConfigTipoOperacaoService,
  ConfigProdutoService,
  ConfigTipoDiaService,
  ImportacaoModelosService,
  UnidadeOperacionalService,
  ProdutoCargaService,
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
    <div data-testid="app-shell" className="mx-auto max-w-[1560px] p-6">
      <header data-testid="app-shell-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

const VALID_EMPRESA_UUID = "11111111-1111-4111-8111-111111111111";

// Mock do AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-admin-123",
      email: "admin@esclog.com.br",
      user_metadata: { empresa_id: VALID_EMPRESA_UUID, tenant_id: "tenant-esc" },
    },
  }),
}));

// Mock do OperationalPipelineContext
vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
  }),
  buildOperationalStagePipeline: vi.fn(),
  buildOperationalStageReviewPipeline: vi.fn(),
  buildOperationalFailurePipeline: vi.fn(),
}));

// Mock do hook useOperationalPipelineAutoTrigger
vi.mock("@/hooks/useOperationalPipelineAutoTrigger", () => ({
  useOperationalPipelineAutoTrigger: vi.fn(),
  buildOperationalPipelineSeenKey: vi.fn(() => "mock-seen-key"),
}));

// Mock do hook useOnboardingCallback
vi.mock("@/hooks/useOnboardingCallback", () => ({
  useOnboardingCallback: () => ({
    isOnboardingReturn: false,
    handleOnboardingReturn: vi.fn(),
    showSuccessModal: false,
    setShowSuccessModal: vi.fn(),
  }),
}));

describe("CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros", () => {
  let queryClient: QueryClient;

  // Base mock com diferentes perfis de colaboradores para auditar os KPIs
  const mockColaboradores = [
    // 1. Colaborador 100% Apto (Pronto para Operação/Folha)
    // Requer: CPF matematicamente válido, UUID válido de empresa, dados completos em RH e Finanças
    {
      id: "colab-apto-1",
      nome: "Carlos Silva Sauro",
      nome_completo: "Carlos Silva Sauro",
      cpf: "52998224725", // CPF válido pelo algoritmo mod 11
      telefone: "91988887777",
      matricula: "MAT-001",
      cargo: "Operador de Empilhadeira",
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "CLT",
      regime_trabalho: "CLT",
      modelo_calculo: "Mensal",
      tipo_contrato: "Mensal",
      salario_base: 2500,
      valor_base: 2500,
      pis: "12345678901",
      status: "ativo",
      status_cadastro: "completo",
      cadastro_provisorio: false,
      banco_codigo: "001",
      agencia: "1234",
      agencia_digito: "5",
      conta: "123456",
      conta_digito: "7",
      tipo_conta: "corrente",
      chave_pix: "carlos@esclog.com.br",
      flag_faturamento: true,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    },
    // 2. Colaborador com Pendência Cadastral/RH (Cadastro Provisório / Sem PIS)
    {
      id: "colab-pend-rh",
      nome: "Marcos Pendente RH",
      nome_completo: "Marcos Pendente RH",
      cpf: "98765432100",
      matricula: "MAT-002",
      cargo: "", // Sem cargo
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "CLT",
      regime_trabalho: "CLT",
      modelo_calculo: "Mensal",
      tipo_contrato: "Mensal",
      salario_base: 2000,
      valor_base: 2000,
      pis: "", // Sem PIS
      status: "ativo",
      status_cadastro: "pendente_complemento",
      cadastro_provisorio: true, // FAIL-CLOSED: Nunca pode ser Pronto
      banco_codigo: "341",
      agencia: "1234",
      agencia_digito: "0",
      conta: "12345",
      conta_digito: "6",
      tipo_conta: "corrente",
      chave_pix: "marcos@esclog.com.br",
      flag_faturamento: true,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    },
    // 3. Colaborador com Pendência Bancária/Fin (Sem conta válida)
    {
      id: "colab-pend-fin",
      nome: "Joana Sem Banco",
      nome_completo: "Joana Sem Banco",
      cpf: "11144477735", // CPF matematicamente válido
      telefone: "91977776666",
      matricula: "MAT-003",
      cargo: "Auxiliar de Carga",
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "INTERMITENTE",
      regime_trabalho: "INTERMITENTE",
      modelo_calculo: "Horista",
      tipo_contrato: "Hora",
      valor_hora: 15,
      valor_base: 15,
      status: "ativo",
      status_cadastro: "completo",
      cadastro_provisorio: false,
      banco_codigo: "", // Sem banco
      agencia: "",
      conta: "",
      tipo_conta: "",
      chave_pix: "",
      flag_faturamento: false,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    },
    // 4. Colaborador Inativo (Não deve inflar os aptos nem pendências de ativos)
    {
      id: "colab-inativo",
      nome: "Roberto Desligado",
      nome_completo: "Roberto Desligado",
      cpf: "11122233344",
      matricula: "MAT-004",
      cargo: "Conferente",
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "CLT",
      status: "inativo",
      status_cadastro: "completo",
      cadastro_provisorio: false,
      banco_codigo: "104",
      agencia: "1111",
      conta: "22222",
      conta_digito: "3",
      tipo_conta: "corrente",
      flag_faturamento: false,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    },
  ];

  const mockEmpresas = [
    { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz", cnpj: "12.345.678/0001-90", cidade: "Belém", estado: "PA", status: "ativo" },
    { id: "22222222-2222-4222-8222-222222222222", nome: "ESC Log Castanhal", cnpj: "98.765.432/0001-10", cidade: "Castanhal", estado: "PA", status: "ativo" },
  ];

  const mockTransportadoras = [
    { id: "transp-1", nome: "TransLog Express", cnpj: "11.222.333/0001-44", ativo: true },
  ];

  const mockFornecedores = [
    { id: "forn-1", nome: "Pallets do Norte", cpf_cnpj: "55.666.777/0001-88", ativo: true },
  ];

  const mockServicos = [
    { id: "serv-1", nome: "Descarga de Carreta", codigo: "DESC-01", ativo: true },
  ];

  const mockColetores = [
    { id: "col-1", modelo: "Control iD", serie: "REP-9988", status: "online", integracao_ativa: true },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mocks dos Serviços de Base
    vi.spyOn(ColaboradorService, "getWithEmpresa").mockResolvedValue(mockColaboradores as any);
    vi.spyOn(EmpresaService, "getWithCounts").mockResolvedValue(mockEmpresas as any);
    vi.spyOn(ColetorService, "getWithEmpresa").mockResolvedValue(mockColetores as any);
    vi.spyOn(TransportadoraClienteService, "getByEmpresa").mockResolvedValue(mockTransportadoras as any);
    vi.spyOn(FornecedorService, "getByEmpresa").mockResolvedValue(mockFornecedores as any);
    vi.spyOn(TipoServicoOperacionalService, "getAllActive").mockResolvedValue(mockServicos as any);
    vi.spyOn(ConfigTipoOperacaoService, "getAll").mockResolvedValue([] as any);
    vi.spyOn(ConfigProdutoService, "getAll").mockResolvedValue([] as any);
    vi.spyOn(ProdutoCargaService, "getAll").mockResolvedValue([] as any);
    vi.spyOn(ConfigTipoDiaService, "getAll").mockResolvedValue([] as any);
    vi.spyOn(ImportacaoModelosService, "listAll").mockResolvedValue([] as any);
    vi.spyOn(UnidadeOperacionalService, "getByEmpresa").mockResolvedValue([] as any);
  });

  const renderComponent = (initialEntries = ["/cadastros"]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <CentralCadastros />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const getKpiCard = (labelText: string): HTMLElement => {
    return screen.getByText(labelText).parentElement?.parentElement?.parentElement!;
  };

  // 1. HEADER EXECUTIVO E IDENTIDADE VISUAL
  it("1. Renderiza o cabeçalho executivo institucional e as ações globais sob o AppShell", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Central de Cadastros")).toBeInTheDocument();
      expect(screen.getByText("Administração Operacional e Parametrização")).toBeInTheDocument();
      expect(screen.getByText("Cadastros & Sistema")).toBeInTheDocument();
      expect(screen.getByText("Gestão Mestre Centralizada")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Atualizar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar Planilha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regras Operacionais/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gestão Detalhada/i })).toBeInTheDocument();
  });

  it("1.1 Botões de ação global navegam para as rotas corretas sem regressão", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Administração Operacional e Parametrização")).toBeInTheDocument();
    });

    // Clica em Regras Operacionais
    const btnRegras = screen.getByRole("button", { name: /Regras Operacionais/i });
    fireEvent.click(btnRegras);
    expect(mockNavigate).toHaveBeenCalledWith("/cadastros/regras-operacionais");

    // Clica em Gestão Detalhada
    const btnGestao = screen.getByRole("button", { name: /Gestão Detalhada/i });
    fireEvent.click(btnGestao);
    expect(mockNavigate).toHaveBeenCalledWith("/colaboradores");
  });

  // 2. KPIS EXECUTIVOS OFICIAIS (OrbeKpiCard)
  it("2. Renderiza exatamente os 4 cards executivos oficiais do Design System", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Total de Colaboradores")).toBeInTheDocument();
      expect(screen.getByText("Prontos para Operação/Folha")).toBeInTheDocument();
      expect(screen.getByText("Pendências Cadastrais / RH")).toBeInTheDocument();
      expect(screen.getByText("Pendências Bancárias / Fin")).toBeInTheDocument();
    });
  });

  it("2.1 Coerência rigorosa de dados: Total, Prontos e Pendências calculam com precisão", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Total de Colaboradores")).toBeInTheDocument();
    });

    // Total geral na base = 4 colaboradores (3 ativos)
    const cardTotal = getKpiCard("Total de Colaboradores");
    expect(cardTotal).toHaveTextContent("4");
    expect(cardTotal).toHaveTextContent("3 colaboradores ativos");

    // Prontos para Operação/Folha = 1 (Carlos Silva Sauro, 100% completo e sem bloqueios)
    const cardProntos = getKpiCard("Prontos para Operação/Folha");
    expect(cardProntos).toHaveTextContent("1");
    expect(cardProntos).toHaveTextContent("Completude integral (RH + Fin)");

    // Pendências Cadastrais / RH = 1 (Marcos Pendente RH, cadastro provisório)
    const cardPendRh = getKpiCard("Pendências Cadastrais / RH");
    expect(cardPendRh).toHaveTextContent("1");
    expect(cardPendRh).toHaveTextContent("Bloqueiam fechamento de folha");

    // Pendências Bancárias / Fin = 2 (Joana sem banco + Marcos cujo bloqueio de RH cascateia para bloqueio financeiro)
    const cardPendFin = getKpiCard("Pendências Bancárias / Fin");
    expect(cardPendFin).toHaveTextContent("2");
    expect(cardPendFin).toHaveTextContent("Bancário ou bloqueio por RH");
  });

  it("2.2 Regra Fail-Closed: Colaborador com cadastro provisório NUNCA é classificado como Pronto", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Prontos para Operação/Folha")).toBeInTheDocument();
    });

    const cardProntos = getKpiCard("Prontos para Operação/Folha");
    // Dos 3 ativos, 1 é provisório e 1 é sem banco. Apenas 1 é apto!
    expect(cardProntos).toHaveTextContent("1");
    expect(cardProntos).not.toHaveTextContent("3");
  });

  // 3. INTERATIVIDADE E FILTRAGEM DOS KPIS
  it("3. Clicar nos cards filtra a tabela de colaboradores por status", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Carlos Silva Sauro/i)).toBeInTheDocument();
      expect(screen.getByText(/Marcos Pendente RH/i)).toBeInTheDocument();
      expect(screen.getByText(/Joana Sem Banco/i)).toBeInTheDocument();
    });

    // Clica no card de Aptos
    const cardProntos = getKpiCard("Prontos para Operação/Folha");
    fireEvent.click(cardProntos);

    // Na lista filtrada, apenas Carlos Silva Sauro deve permanecer visível
    await waitFor(() => {
      expect(screen.getByText(/Carlos Silva Sauro/i)).toBeInTheDocument();
      expect(screen.queryByText(/Marcos Pendente RH/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Joana Sem Banco/i)).not.toBeInTheDocument();
    });

    // Clica no card de Total para restabelecer
    const cardTotal = getKpiCard("Total de Colaboradores");
    fireEvent.click(cardTotal);

    await waitFor(() => {
      expect(screen.getByText(/Carlos Silva Sauro/i)).toBeInTheDocument();
      expect(screen.getByText(/Marcos Pendente RH/i)).toBeInTheDocument();
      expect(screen.getByText(/Joana Sem Banco/i)).toBeInTheDocument();
    });
  });

  // 4. PRESERVAÇÃO DAS 8 ENTIDADES CADASTRADAS
  it("4. Preserva integralmente as 8 abas funcionais do sistema com contadores confiáveis", async () => {
    renderComponent();

    await waitFor(() => {
      const tabColaboradores = screen.getByRole("tab", { name: /Colaboradores/i });
      expect(tabColaboradores).toBeInTheDocument();
      expect(tabColaboradores).toHaveTextContent("4"); // 4 colaboradores no mock

      const tabEmpresas = screen.getByRole("tab", { name: /Empresas/i });
      expect(tabEmpresas).toBeInTheDocument();
      expect(tabEmpresas).toHaveTextContent("2"); // 2 empresas no mock

      const tabColetores = screen.getByRole("tab", { name: /Coletores/i });
      expect(tabColetores).toBeInTheDocument();
      expect(tabColetores).toHaveTextContent("1"); // 1 coletor no mock

      const tabTransp = screen.getByRole("tab", { name: /Transportadoras/i });
      expect(tabTransp).toBeInTheDocument();
      expect(tabTransp).toHaveTextContent("1"); // 1 transportadora

      const tabForn = screen.getByRole("tab", { name: /Fornecedores/i });
      expect(tabForn).toBeInTheDocument();
      expect(tabForn).toHaveTextContent("1"); // 1 fornecedor

      const tabServ = screen.getByRole("tab", { name: /Serviços/i });
      expect(tabServ).toBeInTheDocument();
      expect(tabServ).toHaveTextContent("1"); // 1 serviço

      expect(screen.getByRole("tab", { name: /Materiais/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Parâmetros operacionais/i })).toBeInTheDocument();
    });
  });

  it("4.1 Alternância para a aba Empresas renderiza a tabela de empresas sem quebras", async () => {
    renderComponent(["/cadastros?tab=empresas"]);

    await waitFor(() => {
      expect(screen.getAllByText("ESC Log Matriz").length).toBeGreaterThan(0);
      expect(screen.getByText("ESC Log Castanhal")).toBeInTheDocument();
    });
  });

  it("4.2 Alternância para a aba Transportadoras renderiza os parceiros cadastrados", async () => {
    renderComponent(["/cadastros?tab=transportadoras"]);

    await waitFor(() => {
      expect(screen.getByText("TransLog Express")).toBeInTheDocument();
    });
  });

  it("4.3 Alternância para a aba Fornecedores renderiza os fornecedores cadastrados", async () => {
    renderComponent(["/cadastros?tab=fornecedores"]);

    await waitFor(() => {
      expect(screen.getByText("Pallets do Norte")).toBeInTheDocument();
    });
  });

  // ==========================================
  // ETAPA 03: NOVOS TESTES ESPECÍFICOS
  // ==========================================

  it("5. Distinção Semântica: Faixa Operacional compacta distingue Aptos p/ Campo de Prontidão Integral", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Filtros rápidos de prontidão operacional")).toBeInTheDocument();
    });

    // Card Executivo do Topo: Prontos para Operação/Folha = 1 (exige tríplice completude e zero bloqueios)
    const cardProntos = getKpiCard("Prontos para Operação/Folha");
    expect(cardProntos).toHaveTextContent("1");
    expect(cardProntos).toHaveTextContent("Completude integral (RH + Fin)");

    // Faixa Operacional Compacta: Aptos p/ Campo = 3 (Carlos, Joana e Roberto Inativo ou aptos operacionais)
    expect(screen.getByText("Aptos p/ Campo")).toBeInTheDocument();
    expect(screen.getByText("* Aptos para Operação afere capacidade de escala em campo; fechamento de folha exige completude integral.")).toBeInTheDocument();
  });

  it("6. Faixa Operacional compacta responde a cliques e filtra os colaboradores", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Carlos Silva Sauro")).toBeInTheDocument();
    });

    // Clicar no botão 'Pendências RH' da faixa compacta
    const btnPendRh = screen.getByRole("button", { name: /Pendências RH/i });
    fireEvent.click(btnPendRh);

    await waitFor(() => {
      // Marcos tem cadastro provisório -> pendência RH
      expect(screen.getByText("Marcos Pendente RH")).toBeInTheDocument();
      // Carlos é 100% completo -> não deve aparecer na filtragem de pendências de RH
      expect(screen.queryByText("Carlos Silva Sauro")).not.toBeInTheDocument();
    });
  });

  it("7. Busca de colaboradores por texto (Nome, CPF ou Matrícula) com botão de limpeza rápida", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Carlos Silva Sauro")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Nome, CPF ou Matrícula...");
    fireEvent.change(searchInput, { target: { value: "Joana" } });

    await waitFor(() => {
      expect(screen.getByText("Joana Sem Banco")).toBeInTheDocument();
      expect(screen.queryByText("Carlos Silva Sauro")).not.toBeInTheDocument();
      expect(screen.queryByText("Marcos Pendente RH")).not.toBeInTheDocument();
    });

    // Deve exibir tag de filtro ativo
    expect(screen.getByText('Busca: "Joana"')).toBeInTheDocument();

    // Deve exibir botão 'Limpar busca' (botão X)
    const btnLimparBusca = screen.getByTitle("Limpar busca");
    fireEvent.click(btnLimparBusca);

    await waitFor(() => {
      expect(screen.getByText("Carlos Silva Sauro")).toBeInTheDocument();
      expect(screen.getByText("Joana Sem Banco")).toBeInTheDocument();
    });
  });

  it("8. Botão 'Limpar filtros' restaura o estado inicial quando há filtros ativos", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Carlos Silva Sauro")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Nome, CPF ou Matrícula...");
    fireEvent.change(searchInput, { target: { value: "Marcos" } });

    await waitFor(() => {
      expect(screen.getByText("Limpar filtros")).toBeInTheDocument();
    });

    const btnClearAll = screen.getByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(btnClearAll);

    await waitFor(() => {
      expect(screen.getByText("Carlos Silva Sauro")).toBeInTheDocument();
      expect(screen.getByText("Joana Sem Banco")).toBeInTheDocument();
      expect(screen.queryByText("Limpar filtros")).not.toBeInTheDocument();
    });
  });

  // ==========================================
  // CONV-19 / FIX 03: PARÂMETROS OPERACIONAIS
  // ==========================================

  it("9. CONV-19 / FIX 03: Renderiza cabeçalho oficial e navegação secundária na aba Parâmetros operacionais", async () => {
    renderComponent(["/cadastros?tab=parametros"]);

    await waitFor(() => {
      // Cabeçalho oficial e descrição
      expect(screen.getByRole("heading", { name: "Parâmetros operacionais" })).toBeInTheDocument();
      expect(screen.getByText("Configure os tipos de operação, produtos e classificações de dias utilizados pelo ERP.")).toBeInTheDocument();

      // Navegação secundária (subabas)
      expect(screen.getByRole("tab", { name: "Tipos de operação" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Produtos" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tipos de dia" })).toBeInTheDocument();

      // Ação contextual padrão da subaba ativa (operacao)
      expect(screen.getByRole("button", { name: /Novo tipo de operação/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar tipo de operação...")).toBeInTheDocument();
    });
  });

  it("9.1 Ações contextuais de criação são atualizadas para 'Novo produto' e 'Novo tipo de dia' nas respectivas subabas", async () => {
    // 1. Subaba Produtos via rota
    const { unmount } = renderComponent(["/cadastros?tab=parametros&subtab=produtos"]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Novo produto/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar produto...")).toBeInTheDocument();
    });

    unmount();

    // 2. Subaba Tipos de dia via rota
    renderComponent(["/cadastros?tab=parametros&subtab=dia"]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Novo tipo de dia/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar tipo de dia...")).toBeInTheDocument();
    });
  });

  it("9.2 Estado vazio compacto nas subabas de parâmetros permanece alinhado à tabela sem grandes áreas artificiais", async () => {
    renderComponent(["/cadastros?tab=parametros"]);

    await waitFor(() => {
      expect(screen.getByText("Nenhum tipo de operação cadastrado.")).toBeInTheDocument();
    });

    // Testar filtro com busca inexistente
    const searchInput = screen.getByPlaceholderText("Buscar tipo de operação...");
    fireEvent.change(searchInput, { target: { value: "XPTO_INEXISTENTE" } });

    await waitFor(() => {
      expect(screen.getByText("Nenhum tipo de operação encontrado para a busca.")).toBeInTheDocument();
    });
  });

  // ==========================================
  // CONV-19 / FIX 04: PAGINAÇÃO E GESTÃO DETALHADA
  // ==========================================

  describe("CONV-19 / FIX 04: Paginação Oficial e Gestão Detalhada", () => {
    // 35 colaboradores fictícios para testar paginação 15, 25, 50
    const mock35Colaboradores = Array.from({ length: 35 }, (_, idx) => ({
      id: `colab-pg-${idx + 1}`,
      nome: `Colaborador Teste ${String(idx + 1).padStart(2, "0")}`,
      matricula: `MAT-${String(idx + 1).padStart(3, "0")}`,
      cargo: "Operador Logístico",
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "CLT",
      regime_trabalho: "CLT",
      modelo_calculo: "Mensal",
      tipo_contrato: "Mensal",
      salario_base: 2200,
      valor_base: 2200,
      status: "ativo",
      status_cadastro: "completo",
      cadastro_provisorio: false,
      banco_codigo: "001",
      agencia: "1234",
      agencia_digito: "5",
      conta: "123456",
      conta_digito: "7",
      tipo_conta: "corrente",
      flag_faturamento: true,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    }));

    it("10.1 Central de Cadastros: Pagina inicialmente 15 colaboradores e exibe 'Exibindo 1–15 de 35'", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock35Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 35/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 01")).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 15")).toBeInTheDocument();
        // O 16º não deve estar na primeira página
        expect(screen.queryByText("Colaborador Teste 16")).not.toBeInTheDocument();
      });
    });

    it("10.2 Central de Cadastros: Navega para a segunda página e exibe 'Exibindo 16–30 de 35'", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock35Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 35/i)).toBeInTheDocument();
      });

      const nextBtn = screen.getByRole("button", { name: /Próxima página/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 16–30 de 35/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 16")).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 30")).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Teste 01")).not.toBeInTheDocument();
      });
    });

    it("10.3 Central de Cadastros: KPIs executivos superiores permanecem calculados sobre o universo integral (não apenas 15 visíveis)", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock35Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        // Total de colaboradores no card executivo deve ser 35
        const totalCard = getKpiCard("Total de Colaboradores");
        expect(totalCard).toHaveTextContent("35");
        // E a listagem visível paginada é de 15
        expect(screen.getByText(/Exibindo 1–15 de 35/i)).toBeInTheDocument();
      });
    });

    it("10.4 Central de Cadastros: Reset de página ocorre ao mudar filtros de busca", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock35Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 35/i)).toBeInTheDocument();
      });

      // Navegar para pág 2
      const nextBtn = screen.getByRole("button", { name: /Próxima página/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 16–30 de 35/i)).toBeInTheDocument();
      });

      // Aplicar busca
      const searchInput = screen.getByPlaceholderText("Nome, CPF ou Matrícula...");
      fireEvent.change(searchInput, { target: { value: "Colaborador Teste 01" } });

      await waitFor(() => {
        // Deve voltar para a página 1 e exibir o resultado
        expect(screen.getByText(/Exibindo 1–1 de 1/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 01")).toBeInTheDocument();
      });
    });

    it("10.5 Gestão Detalhada (/colaboradores): Renderiza cabeçalho oficial, tabela administrativa e paginação funcional", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock35Colaboradores as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/colaboradores"]}>
            <Colaboradores />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Cabeçalho e breadcrumb oficiais
        expect(screen.getByText("Gestão Detalhada de Colaboradores")).toBeInTheDocument();
        expect(screen.getByText("Central de Cadastros")).toBeInTheDocument();

        // Paginação funcional
        expect(screen.getByText(/Exibindo 1–15 de 35/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Teste 01")).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Teste 16")).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // CONV-19 / FIX 05: SELETOR DE LINHAS POR PÁGINA E PRESERVAÇÃO DE ESTADO
  // =========================================================================

  describe("CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem", () => {
    // 95 colaboradores fictícios exatamente conforme o cenário do prompt
    const mock95Colaboradores = Array.from({ length: 95 }, (_, idx) => ({
      id: `colab-fix05-${idx + 1}`,
      nome: `Colaborador Fix05 ${String(idx + 1).padStart(2, "0")}`,
      matricula: `MAT-${String(idx + 1).padStart(3, "0")}`,
      cargo: "Operador Logístico",
      empresa_id: VALID_EMPRESA_UUID,
      tipo_colaborador: "CLT",
      regime_trabalho: "CLT",
      modelo_calculo: "Mensal",
      tipo_contrato: "Mensal",
      salario_base: 2200,
      valor_base: 2200,
      status: "ativo",
      status_cadastro: "completo",
      cadastro_provisorio: false,
      banco_codigo: "001",
      agencia: "1234",
      agencia_digito: "5",
      conta: "123456",
      conta_digito: "7",
      tipo_conta: "corrente",
      flag_faturamento: true,
      empresas: { id: VALID_EMPRESA_UUID, nome: "ESC Log Matriz" },
    }));

    it("11.1 Central de Cadastros: Mudança progressiva de 15 -> 25 -> 50 -> 100 e retorno para 15", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock95Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 7/i)).toBeInTheDocument();
      });

      const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });
      expect(pageSizeSelect).toHaveValue("15");

      // 1. Mudança de 15 para 25 registros
      fireEvent.change(pageSizeSelect, { target: { value: "25" } });
      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–25 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 4/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 01")).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 25")).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Fix05 26")).not.toBeInTheDocument();
      });

      // 2. Mudança de 25 para 50 registros
      fireEvent.change(pageSizeSelect, { target: { value: "50" } });
      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–50 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 2/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 50")).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Fix05 51")).not.toBeInTheDocument();
      });

      // 3. Mudança de 50 para 100 registros (exibe todos os 95)
      fireEvent.change(pageSizeSelect, { target: { value: "100" } });
      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–95 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 1/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 95")).toBeInTheDocument();
      });

      // 4. Retorno para 15 registros
      fireEvent.change(pageSizeSelect, { target: { value: "15" } });
      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 7/i)).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Fix05 16")).not.toBeInTheDocument();
      });
    });

    it("11.2 Central de Cadastros: Reseta para a Página 1 imediatamente após alteração de pageSize", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock95Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 95/i)).toBeInTheDocument();
      });

      // Avançar para página 2 (16–30)
      const nextBtn = screen.getByRole("button", { name: /Próxima página/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 16–30 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 2 de 7/i)).toBeInTheDocument();
      });

      // Avançar para página 3 (31–45)
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(screen.getByText(/Exibindo 31–45 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 3 de 7/i)).toBeInTheDocument();
      });

      // Alterar pageSize para 25: deve resetar imediatamente para Página 1 (1–25 de 95)
      const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });
      fireEvent.change(pageSizeSelect, { target: { value: "25" } });

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–25 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 4/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 01")).toBeInTheDocument();
      });
    });

    it("11.3 Central de Cadastros: Preserva filtros de busca ativos ao alterar pageSize", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock95Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–15 de 95/i)).toBeInTheDocument();
      });

      // Aplica busca por "Colaborador Fix05 0" (deve encontrar Fix05 01 até Fix05 09 = 9 colaboradores)
      const searchInput = screen.getByPlaceholderText("Nome, CPF ou Matrícula...");
      fireEvent.change(searchInput, { target: { value: "Colaborador Fix05 0" } });

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–9 de 9/i)).toBeInTheDocument();
      });

      // Altera pageSize para 50 mantendo o filtro ativo
      const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });
      fireEvent.change(pageSizeSelect, { target: { value: "50" } });

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–9 de 9/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 1/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 01")).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 09")).toBeInTheDocument();
      });
    });

    it("11.4 Central de Cadastros: KPIs executivos preservam cálculo integral com qualquer pageSize", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock95Colaboradores as any);
      renderComponent(["/cadastros?tab=colaboradores"]);

      await waitFor(() => {
        const totalCard = getKpiCard("Total de Colaboradores");
        expect(totalCard).toHaveTextContent("95");
      });

      const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });

      // Mudar para 50
      fireEvent.change(pageSizeSelect, { target: { value: "50" } });
      await waitFor(() => {
        const totalCard = getKpiCard("Total de Colaboradores");
        expect(totalCard).toHaveTextContent("95");
      });

      // Mudar para 100
      fireEvent.change(pageSizeSelect, { target: { value: "100" } });
      await waitFor(() => {
        const totalCard = getKpiCard("Total de Colaboradores");
        expect(totalCard).toHaveTextContent("95");
      });
    });

    it("11.5 Gestão Detalhada (/colaboradores): Seletor de linhas por página funciona identicamente", async () => {
      vi.mocked(ColaboradorService.getWithEmpresa).mockResolvedValueOnce(mock95Colaboradores as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/colaboradores"]}>
            <Colaboradores />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Gestão Detalhada de Colaboradores")).toBeInTheDocument();
        expect(screen.getByText(/Exibindo 1–15 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 7/i)).toBeInTheDocument();
      });

      const pageSizeSelect = screen.getByRole("combobox", { name: /Linhas por página/i });

      // Muda para 50
      fireEvent.change(pageSizeSelect, { target: { value: "50" } });

      await waitFor(() => {
        expect(screen.getByText(/Exibindo 1–50 de 95/i)).toBeInTheDocument();
        expect(screen.getByText(/Página 1 de 2/i)).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 01")).toBeInTheDocument();
        expect(screen.getByText("Colaborador Fix05 50")).toBeInTheDocument();
        expect(screen.queryByText("Colaborador Fix05 51")).not.toBeInTheDocument();
      });
    });
  });
});

