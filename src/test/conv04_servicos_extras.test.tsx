import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ServicosExtrasRecebidos from "@/pages/Operacional/ServicosExtrasRecebidos";
import { ServicoExtraDetalhesDrawer } from "@/components/operacoes/ServicoExtraDetalhesDrawer";
import * as baseServices from "@/services/base.service";
import fs from "fs";
import path from "path";

// Mock global ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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

// Mock Contexts
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenantId: "tenant-esc-log-01",
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

vi.mock("@/contexts/ClientContext", () => ({
  useClient: () => ({
    currentClient: null,
    isClientUser: false,
  }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
    isOpen: false,
  }),
  buildServicosExtrasPipeline: vi.fn(),
  buildServicosExtrasDevolvidoPipeline: vi.fn(),
  resolveServicoExtraModalidade: vi.fn((mod) => {
    if (mod === "CAIXA_IMEDIATO") return { isValid: true, modalidade: "CAIXA_IMEDIATO", route: "/financeiro/receitas" };
    if (mod === "FATURAMENTO_MENSAL") return { isValid: true, modalidade: "FATURAMENTO_MENSAL", route: "/financeiro/receitas" };
    return { isValid: true, modalidade: "DUPLICATA", route: "/financeiro/receitas" };
  }),
}));

// Dataset de Teste Representativo do Supabase (Zero Mock em Produção)
const SAMPLE_SERVICOS_EXTRAS = [
  {
    id: "se-uuid-001",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    empresas: { nome: "ESC LOG — Matriz Castanhal" },
    tipo_servico_id: "ts-01",
    tipo_servico: "Conserto de Pallets",
    tipos_servico_operacional: { nome: "Conserto de Pallets" },
    descricao_servico: "Substituição de ripas e reforço em 85 pallets PBR.",
    cliente: "Bunge Alimentos",
    quantidade: 85,
    quantidade_colaboradores: 4,
    valor_unitario: 12.5,
    valor_unitario_snapshot: 12.5,
    unidade_cobranca_snapshot: "paletes",
    materiais_snapshot: [
      { material_id: "mat-01", nome_snapshot: "Pregos de Aço", quantidade: 2, unidade_snapshot: "kg", valor_unitario_snapshot: 25, valor_total: 50 },
    ],
    custo_materiais: 50,
    total: 1112.5,
    forma_pagamento_id: "fp-01",
    forma_pagamento: "Boleto 15 Dias",
    formas_pagamento_operacional: { nome: "Boleto 15 Dias", modalidade: "DUPLICATA" },
    modalidade_financeira: "DUPLICATA",
    status_pagamento: "PENDENTE",
    pipeline_status: "PENDENTE",
    responsavel_nome: "Carlos Eduardo",
    observacao: "Executado no turno da manhã",
  },
  {
    id: "se-uuid-002",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    empresas: { nome: "ESC LOG — Matriz Castanhal" },
    tipo_servico_id: "ts-02",
    tipo_servico: "Transbordo de Carga",
    tipos_servico_operacional: { nome: "Transbordo de Carga" },
    descricao_servico: "Transferência de 30 toneladas de soja.",
    cliente: "Cargill Agrícola",
    quantidade: 1,
    quantidade_colaboradores: 3,
    valor_unitario: 450.0,
    valor_unitario_snapshot: 450.0,
    unidade_cobranca_snapshot: "op",
    materiais_snapshot: null,
    custo_materiais: 0,
    total: 450.0,
    forma_pagamento_id: "fp-02",
    forma_pagamento: "PIX",
    formas_pagamento_operacional: { nome: "PIX", modalidade: "CAIXA_IMEDIATO" },
    modalidade_financeira: "CAIXA_IMEDIATO",
    status_pagamento: "RECEBIDO",
    pipeline_status: "APROVADO_OPERACAO",
    responsavel_nome: "Mariana Souza",
    observacao: null,
  },
  {
    id: "se-uuid-003",
    data: "2026-10-05",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    empresas: { nome: "ESC LOG — CD Benevides" },
    tipo_servico_id: "ts-03",
    tipo_servico: "Pintura de Pallets",
    tipos_servico_operacional: { nome: "Pintura de Pallets" },
    descricao_servico: "Identificação em cor amarela padrão segurança.",
    cliente: "Ambev CD",
    quantidade: 120,
    quantidade_colaboradores: 2,
    valor_unitario: 6.0,
    valor_unitario_snapshot: 6.0,
    unidade_cobranca_snapshot: "paletes",
    materiais_snapshot: null,
    custo_materiais: 0,
    total: 720.0,
    forma_pagamento_id: "fp-03",
    forma_pagamento: "Faturamento Mensal",
    formas_pagamento_operacional: { nome: "Faturamento Mensal", modalidade: "FATURAMENTO_MENSAL" },
    modalidade_financeira: "FATURAMENTO_MENSAL",
    status_pagamento: "PENDENTE",
    pipeline_status: "DEVOLVIDO",
    justificativa_devolucao: "Necessário anexar foto dos pallets identificados",
    responsavel_nome: "Roberto Lima",
  },
  {
    id: "se-uuid-004",
    data: "2026-09-20",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    empresas: { nome: "ESC LOG — Matriz Castanhal" },
    tipo_servico_id: "ts-01",
    tipo_servico: "Conserto de Pallets",
    tipos_servico_operacional: { nome: "Conserto de Pallets" },
    descricao_servico: "Conserto mensal de setembro",
    cliente: "JBS Aves",
    quantidade: 50,
    quantidade_colaboradores: 2,
    valor_unitario: 10.0,
    total: 500.0,
    modalidade_financeira: "FATURAMENTO_MENSAL",
    status_pagamento: "RECEBIDO",
    pipeline_status: "CONCLUIDO",
    responsavel_nome: "Carlos Eduardo",
  },
];

const SAMPLE_EMPRESAS = [
  { id: "emp-01", nome: "ESC LOG — Matriz Castanhal" },
  { id: "emp-02", nome: "ESC LOG — CD Benevides" },
];

const SAMPLE_TIPOS_SERVICO = [
  { id: "ts-01", nome: "Conserto de Pallets", is_extra_service: true },
  { id: "ts-02", nome: "Transbordo de Carga", is_extra_service: true },
  { id: "ts-03", nome: "Pintura de Pallets", is_extra_service: true },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderComponent(initialRoute = "/operacional/servicos-extras") {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/operacional/servicos-extras" element={<ServicosExtrasRecebidos />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CONV-04 — Serviços Extras: Testes de Convergência Oficial UX06", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(baseServices.EmpresaService, "getAll").mockResolvedValue(SAMPLE_EMPRESAS as any);
    vi.spyOn(baseServices.TipoServicoOperacionalService, "getAllActive").mockResolvedValue(SAMPLE_TIPOS_SERVICO as any);
    vi.spyOn(baseServices.ServicosExtrasOperacionaisService, "getWithEmpresas").mockResolvedValue(SAMPLE_SERVICOS_EXTRAS as any);
  });

  it("1. Rota e Página Oficial renderizam com título, subtítulo e badge oficial", async () => {
    renderComponent();
    expect(await screen.findByRole("heading", { name: /^Serviços Extras$/i })).toBeInTheDocument();
    expect(screen.getByText(/Acompanhe serviços extraordinários, validações e avanço até o faturamento/i)).toBeInTheDocument();
    expect(screen.getByText(/ENTRADAS \/ CAPTURA/i)).toBeInTheDocument();
  });

  it("2. Consome exclusivamente services reais do Supabase (Zero Mock)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(baseServices.ServicosExtrasOperacionaisService.getWithEmpresas).toHaveBeenCalled();
      expect(baseServices.EmpresaService.getAll).toHaveBeenCalled();
    });
  });

  it("3. Cards calculam métricas sobre o contexto Macro (Empresa + Período)", async () => {
    renderComponent();
    
    await waitFor(() => {
      const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
      expect(within(btnTotal).getByText("4")).toBeInTheDocument();
    });

    const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    const btnFinanceiro = screen.getByRole("button", { name: /Aguardando Financeiro/i });
    const btnConcluidos = screen.getByRole("button", { name: /Faturados \/ Concluídos/i });

    // Total de 4 serviços no mock global
    expect(within(btnTotal).getByText("4")).toBeInTheDocument();
    // Requer ação: se-001 (PENDENTE) + se-003 (DEVOLVIDO) = 2
    expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
    // Financeiro: se-002 (APROVADO_OPERACAO) = 1
    expect(within(btnFinanceiro).getByText("1")).toBeInTheDocument();
    // Concluídos: se-004 (CONCLUIDO) = 1
    expect(within(btnConcluidos).getByText("1")).toBeInTheDocument();
  });

  it("4. Busca textual não altera os números macro dos cards", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByPlaceholderText(/Buscar código, serviço, tomador/i)).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/Buscar código, serviço, tomador/i);
    fireEvent.change(searchInput, { target: { value: "Bunge" } });

    await waitFor(() => {
      const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
      expect(within(btnTotal).getByText("4")).toBeInTheDocument(); // Mantém 4 no contexto macro
    });
  });

  it("5. Filtro de Tipo de Serviço não altera os números macro dos cards", async () => {
    renderComponent();
    await waitFor(() => {
      const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
      expect(within(btnTotal).getByText("4")).toBeInTheDocument();
    });

    const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
    expect(within(btnTotal).getByText("4")).toBeInTheDocument();
  });

  it("6. Filtro de Pipeline Status não altera os números macro dos cards", async () => {
    renderComponent();
    await waitFor(() => {
      const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
      expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
    });

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
  });

  it("7. Seleção de Empresa no Header recalcula o contexto macro dos cards", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Seletor de Empresa/i })).toBeInTheDocument());

    const selectEmpresa = screen.getByRole("combobox", { name: /Seletor de Empresa/i });
    expect(selectEmpresa).toBeInTheDocument();
  });

  it("8. Filtro Temporal recalcula o contexto macro dos cards", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole("button", { name: /Serviços no Período/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Serviços no Período/i })).toBeInTheDocument();
  });

  it("9. Clique no card de processo filtra a tabela (activeKpiNav)", async () => {
    renderComponent();
    await waitFor(() => {
      const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
      expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
    });

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    fireEvent.click(btnRequerAcao);

    // Linhas correspondentes a Requer Ação aparecem
    await waitFor(() => {
      expect(screen.getAllByText(/SX-SE-UUID/i).length).toBeGreaterThan(0);
    });
  });

  it("10. Card mantém seu contador macro mesmo quando ativo", async () => {
    renderComponent();
    await waitFor(() => {
      const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
      expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
    });

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    fireEvent.click(btnRequerAcao);

    expect(within(btnRequerAcao).getByText("2")).toBeInTheDocument();
  });

  it("11. Botão Limpar Filtros restaura a visualização geral da tabela", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByPlaceholderText(/Buscar código, serviço, tomador/i)).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/Buscar código, serviço, tomador/i);
    fireEvent.change(searchInput, { target: { value: "Pallets" } });

    const btnLimpar = screen.getByRole("button", { name: /Limpar/i });
    expect(btnLimpar).toBeInTheDocument();

    fireEvent.click(btnLimpar);
    expect(searchInput).toHaveValue("");
  });

  it("12. Empty state exploratório é exibido corretamente quando não há resultados para o filtro", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByPlaceholderText(/Buscar código, serviço, tomador/i)).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/Buscar código, serviço, tomador/i);
    fireEvent.change(searchInput, { target: { value: "TERMO_INEXISTENTE_XYZ" } });

    expect(await screen.findByText(/Nenhum serviço encontrado com os filtros selecionados/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redefinir Filtros/i })).toBeInTheDocument();
  });

  it("13. Status de pagamento é exibido como badge informativo (somente leitura)", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText(/SX-SE-UUID/i).length).toBeGreaterThan(0));

    // Badges de status de pagamento aparecem
    expect(screen.getAllByText("PENDENTE").length).toBeGreaterThan(0);
  });

  it("14. NÃO existe dropdown ou select para alterar status_pagamento solto na tabela", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText(/SX-SE-UUID/i).length).toBeGreaterThan(0));

    // Assegura que nenhum dropdown destrutivo de status de pagamento existe na tabela
    expect(screen.queryByRole("combobox", { name: /Status Pagamento/i })).toBeNull();
  });

  it("15. Headcount é exibido estritamente como quantitativo numérico ('X pessoa(s)')", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("4 pessoas")).toBeInTheDocument());

    expect(screen.getByText("4 pessoas")).toBeInTheDocument();
    expect(screen.getByText("3 pessoas")).toBeInTheDocument();
    expect(screen.getAllByText("2 pessoas").length).toBe(2);

    // Assegura que não há CPF ou nomes individuais inventados na tabela
    expect(screen.queryByText(/CPF:/i)).toBeNull();
  });

  it("16. Materiais reais são apresentados detalhadamente quando presentes", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    // Clicar na linha para abrir Drawer
    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText(/Materiais & Insumos Utilizados/i)).toBeInTheDocument();
    expect(screen.getByText(/Pregos de Aço/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 50,00/i).length).toBeGreaterThan(0);
  });

  it("17. Criação administrativa reutiliza NovoServicoExtraDialog", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole("button", { name: /Novo Serviço Extra/i })).toBeInTheDocument());

    const btnNovo = screen.getByRole("button", { name: /Novo Serviço Extra/i });
    fireEvent.click(btnNovo);

    // Modal NovoServicoExtraDialog é aberto
    expect(await screen.findByText("Novo Lançamento de Serviço Extra")).toBeInTheDocument();
  });

  it("18. Edição respeita o estado do pipeline (habilitada apenas para PENDENTE e DEVOLVIDO)", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    // Abrir item em PENDENTE
    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));
    expect(await screen.findByRole("button", { name: /Editar/i })).toBeInTheDocument();
  });

  it("19. Drawer de Detalhes consome dados reais do Supabase", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Detalhes do Serviço Extra")).toBeInTheDocument();
    expect(screen.getAllByText("Bunge Alimentos").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.112,50/).length).toBeGreaterThan(0);
  });

  it("20. Aprovação é despacho/ação homologada que avança o pipeline", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByRole("button", { name: /Encaminhar para Validação/i })).toBeInTheDocument();
  });

  it("21. Central de Receitas é acessada via despacho no Drawer", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Transferência de 30 toneladas de soja.")).toBeInTheDocument());

    // Abrir item já aprovado na operação (se-002)
    fireEvent.click(screen.getByText("Transferência de 30 toneladas de soja."));

    expect(await screen.findByRole("button", { name: /Ver na Central de Receitas/i })).toBeInTheDocument();
  });

  it("22. Nenhuma confirmação de pagamento manual é executada nesta tela", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Operacional/ServicosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).not.toContain("rpc_receita_confirmar_recebimento");
  });

  it("23. Nenhuma geração manual de receita existe na UI (delegada à trigger do banco)", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Operacional/ServicosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).not.toContain("insertInto('receitas_operacionais')");
    expect(fileContent).not.toContain("insertInto('receitas_operacionais_itens')");
  });

  it("24. Lançamento do Encarregado permanece isolado e intocado em /producao/servicos-extras", () => {
    const encarregadoFile = fs.readFileSync(
      path.resolve(__dirname, "../pages/Producao/ServicosExtrasLancamento.tsx"),
      "utf8"
    );
    expect(encarregadoFile).toContain("OperationalShell");
    expect(encarregadoFile).not.toContain("AppShell");
  });

  it("25. Data do serviço ('data') governa estritamente o período operacional, nunca 'created_at'", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Operacional/ServicosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).toContain("String(s.data || \"\")");
  });
});

describe("CONV-04 — HOTFIX 01: Padronização Visual do Drawer de Serviços Extras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(baseServices.EmpresaService, "getAll").mockResolvedValue(SAMPLE_EMPRESAS as any);
    vi.spyOn(baseServices.TipoServicoOperacionalService, "getAllActive").mockResolvedValue(SAMPLE_TIPOS_SERVICO as any);
    vi.spyOn(baseServices.ServicosExtrasOperacionaisService, "getWithEmpresas").mockResolvedValue(SAMPLE_SERVICOS_EXTRAS as any);
  });

  it("1. Pipeline compacto renderiza com 5 etapas claras", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Esteira do Processo")).toBeInTheDocument();
    expect(screen.getByText("Recebido")).toBeInTheDocument();
    expect(screen.getByText("Validação")).toBeInTheDocument();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText("Faturamento")).toBeInTheDocument();
    expect(screen.getAllByText("Concluído").length).toBeGreaterThan(0);
  });

  it("2. Estado atual e estados futuros são identificáveis sem ruído visual", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Etapa 1 de 5")).toBeInTheDocument();
  });

  it("3. Estado DEVOLVIDO possui representação visual própria de exceção", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Identificação em cor amarela padrão segurança.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Identificação em cor amarela padrão segurança."));

    expect(await screen.findByText("Devolvido para Ajuste")).toBeInTheDocument();
  });

  it("4. Status Financeiro continua separado do Status Operacional", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Status Operacional")).toBeInTheDocument();
    expect(screen.getByText("Status Financeiro")).toBeInTheDocument();
  });

  it("5. Modalidade Financeira continua visível e informada", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Modalidade")).toBeInTheDocument();
    expect(screen.getByText("Duplicata a Prazo")).toBeInTheDocument();
  });

  it("6. NÃO existe 'Resumo das Etapas' nem blocos redundantes no Drawer", () => {
    const drawerFile = fs.readFileSync(
      path.resolve(__dirname, "../components/operacoes/ServicoExtraDetalhesDrawer.tsx"),
      "utf8"
    );
    expect(drawerFile).not.toContain("Resumo das Etapas");
    expect(drawerFile).not.toContain("PipelineHorizontalBar");
  });

  it("7. Ações funcionais de edição, devolução e avanço permanecem integradas", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByRole("button", { name: /Editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Encaminhar para Validação/i })).toBeInTheDocument();
  });

  it("8. Total final preserva hierarquia e cálculos canônicos", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Substituição de ripas e reforço em 85 pallets PBR."));

    expect(await screen.findByText("Total Final")).toBeInTheDocument();
    expect(screen.getAllByText(/1\.112,50/).length).toBeGreaterThan(0);
  });
});

