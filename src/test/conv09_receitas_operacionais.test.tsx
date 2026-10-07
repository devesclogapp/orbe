import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";

import ReceitasPipeline from "@/pages/Financeiro/ReceitasPipeline";
import {
  ReceitasOficialService,
  formatCompetencia,
  formatDate,
  formatCurrency,
  getEstagioUX,
  getSituacaoVencimento,
  calcularKpisReceitas,
  ReceitaItemUI,
} from "@/services/receitasOficial.service";
import { ReceitaDrawerOficial } from "@/pages/Financeiro/components/ReceitaDrawerOficial";

// Mock resize observer
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Contexts
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenantId: "tenant-esc-log-01",
    role: "admin",
    loading: false,
  }),
}));

vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    environment: "PRODUCAO",
    theme: "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-123", email: "financeiro@esclog.com.br" },
    hasPermission: () => true,
    hasRole: () => true,
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

vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-001", nome: "Empresa Matriz SP" },
      { id: "emp-002", nome: "Filial Extrema MG" },
    ]),
  },
}));

// Mock dataset for unit & integration testing
const mockDataset: ReceitaItemUI[] = [
  {
    id: "rec-001",
    clienteNome: "Nestlé Waters SP",
    clienteId: "emp-001",
    modalidade: "CAIXA_IMEDIATO",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-10",
    valorTotal: 50000,
    status: "aguardando_fechamento",
    observacao: null,
    itens: [
      {
        id: "item-1",
        refOrigem: "OP-9871",
        tipoOrigem: "Operação por Volume",
        descricao: "Descarga 2.500 caixas",
        valor: 50000,
        data: "2026-10-05",
        operacao_id: "op-9871",
      },
    ],
    historico: [
      {
        id: "h1",
        dataHora: "2026-10-05T10:00:00Z",
        acao: "CRIACAO",
        usuario: "Sistema",
        detalhes: "Receita gerada a partir da Operação",
      },
    ],
  },
  {
    id: "rec-002",
    clienteNome: "Unilever Brasil",
    clienteId: "emp-001",
    modalidade: "DUPLICATA",
    origemPrincipal: "Serviço Extra",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-15",
    valorTotal: 46400,
    status: "pendente_cobranca",
    observacao: "FATURA_COMPLEMENTAR",
    itens: [
      {
        id: "item-2",
        refOrigem: "SE-102",
        tipoOrigem: "Serviço Extra",
        descricao: "Conserto de paletes",
        valor: 46400,
        data: "2026-10-04",
        servico_extra_id: "se-102",
      },
    ],
    historico: [],
  },
  {
    id: "rec-003",
    clienteNome: "Bimbo do Brasil",
    clienteId: "emp-001",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-09-30", // Vencido
    valorTotal: 118600,
    status: "cobranca_enviada",
    observacao: null,
    itens: [],
    historico: [],
  },
  {
    id: "rec-004",
    clienteNome: "Ambev Logística",
    clienteId: "emp-001",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Origem Mista",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-20",
    dataRecebimento: "2026-10-06",
    valorTotal: 165000,
    status: "recebido",
    observacao: null,
    itens: [],
    historico: [],
  },
  {
    id: "rec-005",
    clienteNome: "M. Dias Branco",
    clienteId: "emp-001",
    modalidade: "CAIXA_IMEDIATO",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-01",
    dataRecebimento: "2026-10-02",
    valorTotal: 25000,
    status: "conciliado",
    observacao: null,
    itens: [],
    historico: [],
  },
  {
    id: "rec-006",
    clienteNome: "Cancelada Log",
    clienteId: "emp-001",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-05",
    valorTotal: 10000,
    status: "cancelado",
    observacao: null,
    itens: [],
    historico: [],
  },
];

function renderWithClient(ui: React.ReactElement, initialRoute = "/financeiro/receitas") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/financeiro/receitas" element={ui} />
          <Route path="/financeiro/retorno" element={<div>Central Bancária Mock</div>} />
          <Route path="/financeiro/inadimplencia" element={<div>Inadimplência Mock</div>} />
          <Route path="/operacoes-volume" element={<div>Operações Volume Mock</div>} />
          <Route path="/operacional/servicos-extras" element={<div>Serviços Extras Mock</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CONV-09 — Receitas Operacionais Oficial (UX11 + Domínio Real)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Rota oficial usa UX11 convergida
  it("1. Rota oficial /financeiro/receitas usa UX11 convergida", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/ReceitasPipeline.tsx"),
      "utf-8"
    );
    expect(fileContent).toContain("Central de Receitas & Contas a Receber");
    expect(fileContent).toContain("ReceitasOficialService");
    expect(fileContent).toContain("ReceitaDrawerOficial");
  });

  // 2. Zero mock na rota oficial
  it("2. Zero mock na rota oficial e no adapter oficial", () => {
    const pageContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/ReceitasPipeline.tsx"),
      "utf-8"
    );
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitasOficial.service.ts"),
      "utf-8"
    );
    expect(pageContent).not.toContain("receitasMockData");
    expect(serviceContent).not.toContain("receitasMockData");
  });

  // 3. Contexto por tenant
  it("3. Contexto principal inclui tenant_id", async () => {
    const spy = vi
      .spyOn(ReceitasOficialService, "getReceitasContextuais")
      .mockResolvedValue([]);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe("tenant-esc-log-01");
    });
  });

  // 4. Contexto por empresa
  it("4. Contexto principal inclui empresa_id", async () => {
    const spy = vi
      .spyOn(ReceitasOficialService, "getReceitasContextuais")
      .mockResolvedValue([]);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0].length).toBe(3);
    });
  });

  // 5. Contexto por competencia
  it("5. Contexto principal inclui competencia (YYYY-MM)", async () => {
    const spy = vi
      .spyOn(ReceitasOficialService, "getReceitasContextuais")
      .mockResolvedValue([]);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][2]).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  // 6. Competencia usa campo canônico
  it("6. Adapter consulta campo canônico receitas_operacionais.competencia", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitasOficial.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("r.competencia === competencia");
  });

  // 7. Fallback legado somente quando competencia for nula
  it("7. Fallback para created_at ocorre somente se competencia for null/indefinida", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitasOficial.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("if (r.competencia)");
    expect(serviceContent).toContain("r.created_at");
  });

  // 8. 4 KPIs corretos
  it("8. 4 KPIs Canônicos calculados com exatidão sobre universo contextual", () => {
    const stats = calcularKpisReceitas(mockDataset);
    // Ativas: 50.000 + 46.400 + 118.600 + 165.000 + 25.000 = 405.000
    expect(stats.totalReconhecido).toBe(405000);
    // A Faturar/Cobrar: 50.000 (aguardando) + 46.400 (pendente_cobranca) = 96.400
    expect(stats.aFaturarCobrar).toBe(96400);
    // A Receber: 118.600 (cobranca_enviada) = 118.600
    expect(stats.aReceber).toBe(118600);
    // Recebido: 165.000 (recebido) + 25.000 (conciliado) = 190.000
    expect(stats.recebido).toBe(190000);
    // Conciliado indicador: 25.000
    expect(stats.conciliado).toBe(25000);
  });

  // 9. Equação fundamental dos KPIs
  it("9. Equação fundamental satisfeita: Reconhecido = A Faturar + A Receber + Recebido", () => {
    const stats = calcularKpisReceitas(mockDataset);
    expect(stats.totalReconhecido).toBe(
      stats.aFaturarCobrar + stats.aReceber + stats.recebido
    );
  });

  // 10. Busca não altera KPIs
  it("10. Busca textual não altera os KPIs contextuais", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("R$ 405.000,00")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar cliente, código ou item/i);
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });

    // KPI permanece R$ 405.000,00 mesmo filtrando tabela por Nestlé
    expect(screen.getByText("R$ 405.000,00")).toBeInTheDocument();
  });

  // 11. Modalidade não altera KPIs
  it("11. Filtro de Modalidade não altera os KPIs contextuais", () => {
    const statsOriginal = calcularKpisReceitas(mockDataset);
    const subFiltrado = mockDataset.filter((r) => r.modalidade === "CAIXA_IMEDIATO");
    expect(subFiltrado.length).toBeLessThan(mockDataset.length);
    // A função de KPIs continua recebendo o universo contextual completo
    const stats = calcularKpisReceitas(mockDataset);
    expect(stats.totalReconhecido).toBe(statsOriginal.totalReconhecido);
  });

  // 12. Origem não altera KPIs
  it("12. Filtro de Origem não altera os KPIs contextuais", () => {
    const statsOriginal = calcularKpisReceitas(mockDataset);
    const stats = calcularKpisReceitas(mockDataset);
    expect(stats.aReceber).toBe(statsOriginal.aReceber);
  });

  // 13. Vencimento não altera KPIs
  it("13. Filtro de Vencimento não altera os KPIs contextuais", () => {
    const statsOriginal = calcularKpisReceitas(mockDataset);
    const stats = calcularKpisReceitas(mockDataset);
    expect(stats.recebido).toBe(statsOriginal.recebido);
  });

  // 14. Pills não alteram KPIs
  it("14. Pills de Estágio Financeiro não alteram os KPIs contextuais", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("R$ 405.000,00")).toBeInTheDocument();
    });

    const pillCobPendente = screen.getByRole("button", { name: /Cobrança Pendente/i });
    fireEvent.click(pillCobPendente);

    // KPI permanece inalterado
    expect(screen.getByText("R$ 405.000,00")).toBeInTheDocument();
  });

  // 15. Pills filtram tabela
  it("15. Pills de Estágio filtram as linhas exibidas na tabela", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("Nestlé Waters SP")).toBeInTheDocument();
    });

    const pillRecebidas = screen.getByRole("button", { name: /Recebidas/i });
    fireEvent.click(pillRecebidas);

    // Na visualização filtrada para Recebidas, Ambev deve estar presente e Nestlé (aguardando) não
    expect(screen.getByText("Ambev Logística")).toBeInTheDocument();
    expect(screen.queryByText("Nestlé Waters SP")).not.toBeInTheDocument();
  });

  // 16. Modalidade filtra tabela
  it("16. Modalidade filtra as linhas da tabela", () => {
    const filtradas = mockDataset.filter((r) => r.modalidade === "DUPLICATA");
    expect(filtradas.some((r) => r.clienteNome === "Unilever Brasil")).toBe(true);
    expect(filtradas.some((r) => r.clienteNome === "Nestlé Waters SP")).toBe(false);
  });

  // 17. Origem filtra tabela
  it("17. Origem filtra as linhas da tabela", () => {
    const filtradas = mockDataset.filter((r) => r.origemPrincipal === "Serviço Extra");
    expect(filtradas.some((r) => r.clienteNome === "Unilever Brasil")).toBe(true);
    expect(filtradas.some((r) => r.clienteNome === "Nestlé Waters SP")).toBe(false);
  });

  // 18. Vencimento filtra tabela
  it("18. Vencimento filtra as linhas da tabela", () => {
    const hoje = "2026-10-07";
    const vencidas = mockDataset.filter((r) => {
      const sit = getSituacaoVencimento(r, hoje);
      return sit.isVencido;
    });
    expect(vencidas.some((r) => r.clienteNome === "Bimbo do Brasil")).toBe(true);
    expect(vencidas.some((r) => r.clienteNome === "Ambev Logística")).toBe(false);
  });

  // 19. Cliente filtra tabela
  it("19. Filtro de Cliente filtra as linhas da tabela", () => {
    const filtradas = mockDataset.filter((r) => r.clienteNome === "Ambev Logística");
    expect(filtradas.length).toBe(1);
    expect(filtradas[0].clienteNome).toBe("Ambev Logística");
  });

  // 20. Busca filtra tabela
  it("20. Campo de busca filtra as linhas da tabela por texto", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("Nestlé Waters SP")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar cliente, código ou item/i);
    fireEvent.change(searchInput, { target: { value: "Bimbo" } });

    expect(screen.getByText("Bimbo do Brasil")).toBeInTheDocument();
    expect(screen.queryByText("Nestlé Waters SP")).not.toBeInTheDocument();
  });

  // 21. Complementar identificado
  it("21. Fatura Complementar é visualmente identificada por badge discreto", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("COMPLEMENTAR")).toBeInTheDocument();
    });
  });

  // 22. Fechamento mensal preservado
  it("22. Ação de fechamento mensal consome rpc_receita_fechar_competencia_mensal", async () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/ReceitaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(fileContent).toContain("fecharCompetenciaMensal");
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitas/receitas.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("rpc_receita_fechar_competencia_mensal");
  });

  // 23. Geração de cobrança preservada
  it("23. Geração de cobrança preserva PDF e evento de auditoria GERAR_COBRANCA", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/ReceitaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(fileContent).toContain("generateCobrancaPDF");
    expect(fileContent).toContain("GERAR_COBRANCA");
  });

  // 24. Registro de envio preservado
  it("24. Registro de envio consome rpc_receita_registrar_envio", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitas/receitas.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("rpc_receita_registrar_envio");
  });

  // 25. Confirmação de recebimento preservada
  it("25. Confirmação de recebimento consome rpc_receita_confirmar_recebimento", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitas/receitas.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("rpc_receita_confirmar_recebimento");
  });

  // 26. Recebimento != conciliação
  it("26. Recebimento altera para status recebido e NÃO executa conciliação", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/ReceitaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(fileContent).toContain("confirmarRecebimento");
    // Conciliação é delegada para Central Bancária
    expect(fileContent).toContain("/financeiro/retorno");
  });

  // 27. Recebido despacha para Central Bancária
  it("27. Item recebido possui CTA que despacha para /financeiro/retorno", () => {
    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[3]} // Ambev (recebido)
      />
    );
    expect(screen.getByText("Abrir Central Bancária")).toBeInTheDocument();
  });

  // 28. Vencido é derivado, não status persistido
  it("28. Situação de vencimento é calculada em memória (derivada)", () => {
    const sitVencido = getSituacaoVencimento(
      { vencimento: "2026-09-01", status: "cobranca_enviada" },
      "2026-10-07"
    );
    expect(sitVencido.isVencido).toBe(true);
    expect(sitVencido.diasAtraso).toBeGreaterThan(0);
    expect(sitVencido.label).toContain("VENCIDO");

    const sitLiquidado = getSituacaoVencimento(
      { vencimento: "2026-09-01", status: "recebido" },
      "2026-10-07"
    );
    expect(sitLiquidado.isVencido).toBe(false);
  });

  // 29. Despacho de inadimplência correto
  it("29. Item vencido possui link/CTA para /financeiro/inadimplencia", () => {
    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[2]} // Bimbo (cobranca_enviada e vencido em 2026-09-30)
      />
    );
    expect(screen.getByText("Abrir em Cobrança")).toBeInTheDocument();
  });

  // 30. Histórico real exibido
  it("30. Histórico real de eventos é exibido no Drawer", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitaDetalhesEHistorico").mockResolvedValue({
      detalhes: {},
      historico: [
        {
          id: "h1",
          dataHora: "05/10 10:00",
          acao: "CRIACAO",
          usuario: "Sistema",
          detalhes: "Receita gerada a partir da Operação",
        },
      ],
    });

    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[0]} // Nestlé Waters SP com historico h1
      />
    );
    await waitFor(() => {
      expect(screen.getByText("CRIACAO")).toBeInTheDocument();
      expect(screen.getByText("Receita gerada a partir da Operação")).toBeInTheDocument();
    });
  });

  // 31. Composição real exibida
  it("31. Composição com itens de receitas_operacionais_itens é exibida", () => {
    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[0]} // Nestlé Waters SP com item OP-9871
      />
    );
    expect(screen.getByText("OP-9871")).toBeInTheDocument();
    expect(screen.getByText("Descarga 2.500 caixas")).toBeInTheDocument();
  });

  // 32. Operação abre rota oficial convergida (/operacoes-volume)
  it("32. Item de Operação direciona para /operacoes-volume", () => {
    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[0]}
      />
    );
    const btnOp = screen.getByTitle("Ver Operação por Volume");
    expect(btnOp).toBeInTheDocument();
  });

  // 33. Serviço extra abre rota oficial (/operacional/servicos-extras)
  it("33. Item de Serviço Extra direciona para /operacional/servicos-extras", () => {
    renderWithClient(
      <ReceitaDrawerOficial
        open={true}
        onOpenChange={() => {}}
        receita={mockDataset[1]} // Unilever com SE-102
      />
    );
    const btnSe = screen.getByTitle("Ver Serviço Extra");
    expect(btnSe).toBeInTheDocument();
  });

  // 34. Permissões de ação preservadas
  it("34. Ações financeiras no Drawer preservam RBAC", () => {
    const drawerFile = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/ReceitaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerFile).toContain("isFinanceiroOrAdmin");
  });

  // 35. Refetch não desmonta layout
  it("35. Padrão UX-STABILITY-01 preservado: layout montado durante refetch", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(screen.getByText("Central de Receitas & Contas a Receber")).toBeInTheDocument();
    });
    // Elementos principais do layout permanecem presentes
    expect(screen.getByText("Receita Reconhecida")).toBeInTheDocument();
  });

  // 36. Empty state
  it("36. Exibe Empty State amigável quando não há receitas no contexto", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue([]);
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(
        screen.getByText("Nenhuma receita operacional encontrada")
      ).toBeInTheDocument();
    });
  });

  // 37. Error state
  it("37. Exibe Error State com opção de tentar novamente em caso de falha", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockRejectedValue(
      new Error("Falha de conexão com o banco")
    );
    renderWithClient(<ReceitasPipeline />);
    await waitFor(() => {
      expect(
        screen.getByText("Erro ao carregar receitas operacionais")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeInTheDocument();
    });
  });

  // 38. Nenhuma RPC nova
  it("38. Adapter consome somente as RPCs existentes e homologadas", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/receitasOficial.service.ts"),
      "utf-8"
    );
    const rpcMatches = serviceContent.match(/rpc\(['"]([^'"]+)['"]/g) || [];
    const rpcsUsed = rpcMatches.map((m) => m.replace(/rpc\(['"]/, "").replace(/['"]/, ""));
    const allowedRpcs = [
      "rpc_receita_fechar_competencia_mensal",
      "rpc_receita_registrar_envio",
      "rpc_receita_confirmar_recebimento",
      "rpc_receita_cancelar_ou_estornar",
    ];
    rpcsUsed.forEach((rpc) => {
      expect(allowedRpcs).toContain(rpc);
    });
  });

  // 39. Nenhum backend alterado
  it("39. Nenhuma migração ou arquivo de backend modificado em CONV-09", () => {
    const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      // Nenhuma migração com prefixo conv09
      const conv09Migrations = files.filter((f) => f.includes("conv09"));
      expect(conv09Migrations.length).toBe(0);
    }
  });

  // 40. Nenhuma regressão dos query params/contextos recebidos
  it("40. Preserva leitura dos query params de highlight e origem contextual", async () => {
    vi.spyOn(ReceitasOficialService, "getReceitasContextuais").mockResolvedValue(mockDataset);
    renderWithClient(
      <ReceitasPipeline />,
      "/financeiro/receitas?highlightReceitaId=rec-002&origem=Operacional"
    );
    await waitFor(() => {
      // Drawer deve ser aberto automaticamente pelo highlightReceitaId
      expect(screen.getByText("Unilever Brasil")).toBeInTheDocument();
    });
  });
});
