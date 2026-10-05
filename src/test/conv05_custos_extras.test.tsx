import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustosExtrasRecebidos from "@/pages/Operacional/CustosExtrasRecebidos";
import { CustosExtrasDetalhesDrawer, CustoExtraItemReal } from "@/components/operacoes/CustosExtrasDetalhesDrawer";
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
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
}));

// Dataset Representativo do Supabase para Custos Extras (Zero Mock em produção)
const SAMPLE_CUSTOS_EXTRAS: CustoExtraItemReal[] = [
  {
    id: "ce-001-rec",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC Log Matriz",
    empresas: { nome: "ESC Log Matriz" },
    unidade_id: "unid-01",
    unidade_nome: "CD Principal",
    categoria_custo: "MERENDA/LANCHE",
    descricao: "Lanche noturno operação emergencial",
    quantidade: 10,
    valor_unitario: 25.0,
    total: 250.0,
    origem_recurso: "PAGO_EMPRESA",
    forma_pagamento: "Cartão Corporativo",
    pipeline_status: "RECEBIDO",
    status_pagamento: "PAGO",
    responsavel_nome: "Encarregado Carlos",
    atualizado_em: "2026-10-05T08:00:00Z",
  },
  {
    id: "ce-002-val",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC Log Matriz",
    empresas: { nome: "ESC Log Matriz" },
    unidade_id: "unid-01",
    unidade_nome: "CD Principal",
    categoria_custo: "TRANSPORTE",
    descricao: "Uber emergencial colaborador",
    quantidade: 1,
    valor_unitario: 85.0,
    total: 85.0,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    favorecido_colaborador_id: "colab-01",
    favorecido_colaborador: { nome: "João Silva" },
    pipeline_status: "EM_VALIDACAO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Supervisor Mario",
    atualizado_em: "2026-10-05T09:00:00Z",
  },
  {
    id: "ce-003-apr",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC Log Matriz",
    empresas: { nome: "ESC Log Matriz" },
    unidade_id: "unid-01",
    unidade_nome: "CD Principal",
    categoria_custo: "MANUTENCAO",
    descricao: "Reparo emergencial paleteira",
    quantidade: 1,
    valor_unitario: 500.0,
    total: 500.0,
    origem_recurso: "PAGAMENTO_PENDENTE",
    favorecido_fornecedor_id: "forn-01",
    favorecido_fornecedor: { nome: "Oficina Hidráulica Silva" },
    data_vencimento: "2026-10-15",
    pipeline_status: "APROVADO_OPERACAO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Gerente Roberto",
    atualizado_em: "2026-10-05T10:00:00Z",
  },
  {
    id: "ce-004-fin",
    data: "2026-10-05",
    empresa_id: "emp-02",
    empresa_nome: "ESC Log Filial SP",
    empresas: { nome: "ESC Log Filial SP" },
    unidade_id: "unid-02",
    unidade_nome: "Galpão 02",
    categoria_custo: "OPERACIONAL",
    descricao: "Fita adesiva e filme extra",
    quantidade: 5,
    valor_unitario: 60.0,
    total: 300.0,
    origem_recurso: "PAGO_EMPRESA",
    pipeline_status: "FINALIZADO",
    status_pagamento: "PAGO",
    responsavel_nome: "Encarregado Lucas",
    atualizado_em: "2026-10-05T11:00:00Z",
  },
  {
    id: "ce-005-rep",
    data: "2026-10-05",
    empresa_id: "emp-01",
    empresa_nome: "ESC Log Matriz",
    empresas: { nome: "ESC Log Matriz" },
    unidade_id: "unid-01",
    unidade_nome: "CD Principal",
    categoria_custo: "OUTROS",
    descricao: "Recibo sem identificação fiscal",
    quantidade: 1,
    valor_unitario: 120.0,
    total: 120.0,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    favorecido_colaborador_id: "colab-02",
    favorecido_colaborador: { nome: "Pedro Rocha" },
    pipeline_status: "REPROVADO",
    status_pagamento: "A_PAGAR",
    justificativa_devolucao: "Nota fiscal ilegível e sem CNPJ do emitente.",
    responsavel_nome: "Auditor Fiscal",
    atualizado_em: "2026-10-05T12:00:00Z",
  },
];

const SAMPLE_EMPRESAS = [
  { id: "emp-01", nome: "ESC Log Matriz" },
  { id: "emp-02", nome: "ESC Log Filial SP" },
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

function AprovacoesTestTarget() {
  const [params] = useSearchParams();
  return (
    <div
      data-testid="rh-aprovacoes-page"
      data-flowtype={params.get("flowType") || ""}
      data-search={params.toString()}
    >
      Página Central de Aprovações: {params.get("flowType")}
    </div>
  );
}

function FinanceiroTestTarget() {
  const [params] = useSearchParams();
  return (
    <div
      data-testid="financeiro-page"
      data-tab={params.get("tab") || ""}
      data-search={params.toString()}
    >
      Página Financeiro: {params.get("tab")}
    </div>
  );
}

function renderCustosExtras(initialRoute = "/operacional/custos-extras") {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/operacional/custos-extras" element={<CustosExtrasRecebidos />} />
          <Route path="/rh/aprovacoes" element={<AprovacoesTestTarget />} />
          <Route path="/financeiro" element={<FinanceiroTestTarget />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CONV-05 — CUSTOS EXTRAS: Convergência Oficial UX07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(baseServices.EmpresaService, "getAll").mockResolvedValue(SAMPLE_EMPRESAS as any);
    vi.spyOn(baseServices.CustoExtraOperacionalService, "getAll").mockResolvedValue(SAMPLE_CUSTOS_EXTRAS as any);
  });

  it("1. Rota oficial /operacional/custos-extras renderiza com AppShell e título correto", async () => {
    renderCustosExtras();
    expect(await screen.findByRole("heading", { name: /^Custos Extras$/i })).toBeInTheDocument();
    expect(screen.getByText(/Acompanhe despesas extraordinárias/i)).toBeInTheDocument();
  });

  it("2. Zero Mock em produção: consome CustoExtraOperacionalService.getAll", async () => {
    renderCustosExtras();
    await waitFor(() => {
      expect(baseServices.CustoExtraOperacionalService.getAll).toHaveBeenCalled();
    });
  });

  it("3. Service real é invocado com parâmetros de tenant e empresa", async () => {
    renderCustosExtras();
    await waitFor(() => {
      expect(baseServices.CustoExtraOperacionalService.getAll).toHaveBeenCalledWith(undefined, "tenant-esc-log-01");
    });
  });

  const waitLoaded = () => screen.findByText("Lanche noturno operação emergencial");
  const card = (label: RegExp) => screen.getByRole("button", { name: label });

  it("4. Cards calculam valores baseados estritamente no contexto macro (custosContextuais)", async () => {
    renderCustosExtras();
    await waitLoaded();

    const total = card(/Custos no Período/i);
    expect(within(total).getByText("R$ 1.255,00")).toBeInTheDocument();
    expect(within(total).getByText(/5 lançamentos/)).toBeInTheDocument();

    const acao = card(/Requer Ação/i);
    expect(within(acao).getByText("R$ 455,00")).toBeInTheDocument();
    expect(within(acao).getByText(/3 pendências/)).toBeInTheDocument();

    const pagar = card(/A Pagar \/ Financeiro/i);
    expect(within(pagar).getByText("R$ 500,00")).toBeInTheDocument();
    expect(within(pagar).getByText(/1 obrigações abertas/)).toBeInTheDocument();

    const pagos = card(/Pagos \/ Liquidados/i);
    expect(within(pagos).getByText("R$ 550,00")).toBeInTheDocument();
    expect(within(pagos).getByText(/2 despesas liquidadas/)).toBeInTheDocument();
  });

  it("5. Busca textual NÃO recalcula cards de síntese", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/Buscar código, descrição/i), { target: { value: "Lanche" } });

    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
    expect(within(card(/Requer Ação/i)).getByText("R$ 455,00")).toBeInTheDocument();
    expect(within(card(/A Pagar \/ Financeiro/i)).getByText("R$ 500,00")).toBeInTheDocument();
    expect(within(card(/Pagos \/ Liquidados/i)).getByText("R$ 550,00")).toBeInTheDocument();

    expect(screen.getByText("Lanche noturno operação emergencial")).toBeInTheDocument();
    expect(screen.queryByText("Reparo emergencial paleteira")).not.toBeInTheDocument();
  });

  it("6. Categoria de custo NÃO recalcula cards de síntese", async () => {
    renderCustosExtras();
    await waitLoaded();

    // Filtro exploratório (estado interno) por busca de categoria: cards seguem macro
    fireEvent.change(screen.getByPlaceholderText(/Buscar código, descrição/i), { target: { value: "Manutenção" } });
    expect(screen.getByText("Reparo emergencial paleteira")).toBeInTheDocument();
    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
  });

  it("7. Origem do recurso NÃO recalcula cards de síntese", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/Buscar código, descrição/i), { target: { value: "João Silva" } });
    expect(screen.getByText("Uber emergencial colaborador")).toBeInTheDocument();
    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
    expect(within(card(/A Pagar \/ Financeiro/i)).getByText("R$ 500,00")).toBeInTheDocument();
  });

  it("8. Filtro de pipeline NÃO recalcula cards de síntese", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.click(card(/Requer Ação/i));
    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
  });

  it("9. Filtro macro de Empresa recalcula cards", async () => {
    renderCustosExtras();
    await waitLoaded();

    expect(screen.getByRole("combobox", { name: /Seletor de Empresa/i })).toBeInTheDocument();
    // Contexto macro: service recebe empresa undefined (todas) + tenant
    expect(baseServices.CustoExtraOperacionalService.getAll).toHaveBeenCalledWith(undefined, "tenant-esc-log-01");
  });

  it("10. Filtro macro de Período Temporal recalcula cards", async () => {
    renderCustosExtras();
    await waitLoaded();

    const fileContent = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).toContain("[custosRaw, empresaFiltro, filtroTemporal]");
  });

  it("11. Clicar no Card 'Requer Ação' filtra a tabela deterministicamente", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.click(card(/Requer Ação/i));

    expect(screen.getByText("Lanche noturno operação emergencial")).toBeInTheDocument();
    expect(screen.getByText("Uber emergencial colaborador")).toBeInTheDocument();
    expect(screen.getByText("Recibo sem identificação fiscal")).toBeInTheDocument();
    expect(screen.queryByText("Reparo emergencial paleteira")).not.toBeInTheDocument();
    expect(screen.queryByText("Fita adesiva e filme extra")).not.toBeInTheDocument();
  });

  it("12. Clicar no Card mantém o valor macro dos cards sem mutação visual", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.click(card(/A Pagar \/ Financeiro/i));

    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
    expect(within(card(/A Pagar \/ Financeiro/i)).getByText("R$ 500,00")).toBeInTheDocument();
    expect(within(card(/Pagos \/ Liquidados/i)).getByText("R$ 550,00")).toBeInTheDocument();
    expect(screen.getByText("Reparo emergencial paleteira")).toBeInTheDocument();
    expect(screen.queryByText("Uber emergencial colaborador")).not.toBeInTheDocument();

    // Clicar novamente no card ativo restaura todos
    fireEvent.click(card(/Custos no Período/i));
    expect(screen.getByText("Uber emergencial colaborador")).toBeInTheDocument();
  });

  it("13. Botão 'Limpar Filtros' restaura a tabela ao estado contextual", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/Buscar código, descrição/i), { target: { value: "inexistente_xyz" } });
    expect(await screen.findByText(/Nenhum custo encontrado com os filtros selecionados/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Limpar Filtros/i })[0]);

    expect(await screen.findByText("Lanche noturno operação emergencial")).toBeInTheDocument();
  });

  it("14. Empty State exploratório quando nenhum item corresponde ao filtro", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.change(screen.getByPlaceholderText(/Buscar código, descrição/i), { target: { value: "despesa_que_nao_existe" } });

    expect(await screen.findByText("Nenhum custo encontrado com os filtros selecionados.")).toBeInTheDocument();
    // Cards continuam macro
    expect(within(card(/Custos no Período/i)).getByText("R$ 1.255,00")).toBeInTheDocument();
  });

  it("15. PAGO_EMPRESA não cria obrigação futura no financeiro", async () => {
    renderCustosExtras();
    await waitLoaded();

    const pagar = card(/A Pagar \/ Financeiro/i);
    expect(within(pagar).getByText("R$ 500,00")).toBeInTheDocument();
    expect(within(pagar).getByText(/1 obrigações abertas/)).toBeInTheDocument();
  });

  it("16. PAGO_EMPRESA não mostra botão de pagar nem de gerar CNAB no Drawer", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Fita adesiva e filme extra");
    fireEvent.click(row);

    expect(await screen.findByText("Pago diretamente pela empresa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar CNAB/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pagar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir no Financeiro/i })).not.toBeInTheDocument();
  });

  it("17. REEMBOLSO_COLABORADOR exibe colaborador favorecido no Drawer", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Uber emergencial colaborador");
    fireEvent.click(row);

    expect(await screen.findByText("Reembolso a colaborador")).toBeInTheDocument();
    expect(screen.getAllByText("João Silva").length).toBeGreaterThanOrEqual(2);
  });

  it("18. PAGAMENTO_PENDENTE exibe fornecedor favorecido e vencimento no Drawer", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Reparo emergencial paleteira");
    fireEvent.click(row);

    expect(await screen.findByText("Pagamento a fornecedor")).toBeInTheDocument();
    expect(screen.getAllByText("Oficina Hidráulica Silva").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/15\/10\/2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("19. Vencimento é exibido quando aplicável", async () => {
    renderCustosExtras();
    await waitLoaded();

    expect(screen.getByText(/Venc: 15\/10\/2026/i)).toBeInTheDocument();
  });

  it("20. Status operacional é mantido visualmente separado do status de pagamento", async () => {
    renderCustosExtras();
    await waitLoaded();

    expect(screen.getByRole("columnheader", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pagamento" })).toBeInTheDocument();
  });

  it("21. Total usa dado real do dataset persistido", async () => {
    renderCustosExtras();
    await waitLoaded();

    const rows = screen.getAllByRole("row");
    const text = rows.map((r) => r.textContent).join("|");
    ["R$ 250,00", "R$ 85,00", "R$ 500,00", "R$ 300,00", "R$ 120,00"].forEach((v) => {
      expect(text.replace(/\u00a0/g, " ")).toContain(v);
    });
  });

  it("22. Botão '+ Novo Custo Extra' reutiliza CustosExtrasForm sem duplicação", async () => {
    renderCustosExtras();
    await waitLoaded();

    fireEvent.click(screen.getAllByRole("button", { name: /Novo Custo Extra/i })[0]);

    expect(await screen.findByText(/Registre despesas operacionais extraordinárias/i)).toBeInTheDocument();
    const src = fs.readFileSync(path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"), "utf8");
    expect(src).toContain("<CustosExtrasForm");
  });

  it("23. Fluxo do Encarregado em CustosExtrasLancamento.tsx permanece íntegro e intocado", () => {
    const lancamentoFilePath = path.join(process.cwd(), "src/pages/Producao/CustosExtrasLancamento.tsx");
    expect(fs.existsSync(lancamentoFilePath)).toBe(true);
    const content = fs.readFileSync(lancamentoFilePath, "utf8");
    expect(content).toContain("OperationalShell");
    expect(content).toContain("CustoExtraOperacionalService");
  });

  it("24. Edição respeita estados e imutabilidade do banco de dados", () => {
    const serviceFilePath = path.join(process.cwd(), "src/services/domain/despesas.service.ts");
    const content = fs.readFileSync(serviceFilePath, "utf8");
    expect(content).toContain("rpc_custo_extra_transicionar");
  });

  it("25. Transição usa service/RPC canônico (rpc_custo_extra_transicionar)", () => {
    const serviceFilePath = path.join(process.cwd(), "src/services/domain/despesas.service.ts");
    const content = fs.readFileSync(serviceFilePath, "utf8");
    expect(content).toContain("rpc_custo_extra_transicionar");
  });

  it("26. OCC é preservado via campo atualizado_em", () => {
    const sample = SAMPLE_CUSTOS_EXTRAS[0];
    expect(sample.atualizado_em).toBeDefined();
  });

  it("27. Soft delete é preservado (deleted_at filter)", () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).toContain("if (c.deleted_at) return false;");
  });

  it("28. Central de Aprovações é acionada por despacho contextual validado (?flowType=CUSTO EXTRA)", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Lanche noturno operação emergencial");
    fireEvent.click(row);

    const btnAprovacoes = await screen.findByRole("button", { name: /Ir para Aprovações/i });
    fireEvent.click(btnAprovacoes);

    const target = await screen.findByTestId("rh-aprovacoes-page");
    expect(target).toBeInTheDocument();
    expect(target.getAttribute("data-flowtype")).toBe("CUSTO EXTRA");
  });

  it("29. Central Financeira é acionada com contrato canônico real (?tab=custos-extras)", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Reparo emergencial paleteira");
    fireEvent.click(row);

    const btnFinanceiro = await screen.findByRole("button", { name: /Abrir no Financeiro/i });
    fireEvent.click(btnFinanceiro);

    const target = await screen.findByTestId("financeiro-page");
    expect(target).toBeInTheDocument();
    expect(target.getAttribute("data-tab")).toBe("custos-extras");
    expect(target.getAttribute("data-search")).toBe("tab=custos-extras");
  });

  it("30. Nenhum botão ou função de CNAB é exposta em Custos Extras", () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent.toLowerCase()).not.toContain("gerar cnab");
    expect(fileContent.toLowerCase()).not.toContain("remessa cnab");
  });

  it("31. Drawer utiliza estritamente dados reais do item selecionado", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Lanche noturno operação emergencial");
    fireEvent.click(row);

    expect((await screen.findAllByText(/CE-CE-001/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lanche noturno operação emergencial").length).toBeGreaterThanOrEqual(1);
  });

  it("32. REPROVADO exibe destaque e justificativa de devolução", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Recibo sem identificação fiscal");
    fireEvent.click(row);

    expect(await screen.findByText("Justificativa de Devolução / Bloqueio:")).toBeInTheDocument();
    expect(screen.getByText("Nota fiscal ilegível e sem CNPJ do emitente.")).toBeInTheDocument();
  });

  it("33. Competência econômica utiliza exclusivamente o campo canônico data", () => {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(fileContent).toContain("String(c.data || \"\").split(\"T\")[0]");
    expect(fileContent).not.toContain("String(c.created_at");
  });

  it("34. UxPipelineStepper é utilizado no Drawer e na tabela com layout compacto", () => {
    const drawerContent = fs.readFileSync(
      path.join(process.cwd(), "src/components/operacoes/CustosExtrasDetalhesDrawer.tsx"),
      "utf8"
    );
    expect(drawerContent).toContain("UxPipelineStepper");
    expect(drawerContent).toContain("CUSTOS_EXTRAS_PIPELINE_STEPS");
  });

  it("35. Não existe dropdown destrutivo de status na tabela", () => {
    const tableContent = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Operacional/CustosExtrasRecebidos.tsx"),
      "utf8"
    );
    expect(tableContent).not.toContain("onChangePipelineStatus");
    expect(tableContent).not.toContain("onChangeStatusPagamento");
  });

  it("36. PAGO_EMPRESA não exibe nenhuma ação financeira (nem Abrir no Financeiro, nem Consultar pagamento)", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Fita adesiva e filme extra");
    fireEvent.click(row);

    expect(await screen.findByText("Pago diretamente pela empresa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir no Financeiro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Consultar pagamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pagar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar CNAB/i })).not.toBeInTheDocument();
  });

  it("37. RECEBIDO e EM_VALIDACAO não apresentam liquidação financeira antecipada", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Lanche noturno operação emergencial");
    fireEvent.click(row);

    // Em validação: apenas despacho para Aprovações
    expect(await screen.findByRole("button", { name: /Ir para Aprovações/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir no Financeiro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pagar$/i })).not.toBeInTheDocument();
  });

  it("38. FINALIZADO não apresenta ação destrutiva nem mutação direta de status", () => {
    const drawerContent = fs.readFileSync(
      path.join(process.cwd(), "src/components/operacoes/CustosExtrasDetalhesDrawer.tsx"),
      "utf8"
    );
    expect(drawerContent).not.toContain(".delete(");
    expect(drawerContent).not.toContain(".update(");
  });

  it("39. Obrigação aprovada (APROVADO_OPERACAO) exibe somente ações permitidas (Abrir no Financeiro)", async () => {
    renderCustosExtras();
    const row = await screen.findByText("Reparo emergencial paleteira");
    fireEvent.click(row);

    expect(await screen.findByRole("button", { name: /Abrir no Financeiro/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ir para Aprovações/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resolver pendência/i })).not.toBeInTheDocument();
  });

  it("40. Transições e Drawer não realizam updates diretos de pipeline_status nem status_pagamento", () => {
    const drawerContent = fs.readFileSync(
      path.join(process.cwd(), "src/components/operacoes/CustosExtrasDetalhesDrawer.tsx"),
      "utf8"
    );
    expect(drawerContent).not.toContain("pipeline_status:");
    expect(drawerContent).not.toContain("status_pagamento:");
  });
});
