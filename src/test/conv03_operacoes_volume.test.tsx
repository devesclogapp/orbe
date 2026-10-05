import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Operacoes from "@/pages/Operacoes";
import { OperacaoVolumeDrawer } from "@/components/operacoes/OperacaoVolumeDrawer";
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
    status: {},
    refresh: vi.fn(),
    openPipeline: vi.fn(),
  }),
}));

// Mock dos Services
vi.mock("@/services/base.service", async () => {
  const actual = await vi.importActual<any>("@/services/base.service");
  return {
    ...actual,
    EmpresaService: {
      getAll: vi.fn(),
    },
    TipoServicoOperacionalService: {
      getAllActive: vi.fn(),
    },
    OperacaoProducaoService: {
      getAll: vi.fn(),
      getByIdWithDetails: vi.fn(),
      delete: vi.fn(),
      regularizarHorarios: vi.fn(),
    },
  };
});

const sampleEmpresas = [
  { id: "emp-01", nome: "Benevides Participações" },
  { id: "emp-02", nome: "ESC Log Matriz" },
];

const sampleServicos = [
  { id: "srv-01", nome: "Descarga Paletizada" },
  { id: "srv-02", nome: "Descarga Granel" },
];

const sampleOperacoes = [
  {
    id: "8821a001-0000-0000-0000-000000000001",
    empresa_id: "emp-01",
    unidade_id: "un-01",
    data_operacao: "2026-10-03",
    tipo_servico_id: "srv-01",
    transportadora_id: "transp-01",
    fornecedor_id: "forn-01",
    produto_carga_id: "prod-01",
    placa: "BRA-2E19",
    ctrc: "CTRC-104921",
    nf_numero: "89211",
    quantidade_colaboradores: 4,
    entrada_ponto: "07:45:00",
    saida_ponto: "12:15:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 1850,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.42,
    valor_descarga: 777.0,
    percentual_iss: 0.05,
    custo_com_iss: 38.85,
    valor_total_materiais: 45.0,
    valor_total: 860.85,
    status: "RECEBIDO",
    status_rh: "PENDENTE_RH",
    status_pagamento: "PENDENTE",
    responsavel_nome: "Claudio Encarregado",
    empresas: { id: "emp-01", nome: "Benevides Participações" },
    unidades: { id: "un-01", nome: "CD São Paulo - Doca 04" },
    tipos_servico_operacional: { nome: "Descarga Paletizada" },
    fornecedores: { nome: "Ambev S/A" },
    transportadoras_clientes: { nome: "Jamef Encomendas" },
    produtos_carga: { nome: "Cervejas e Bebidas" },
    formas_pagamento_operacional: { nome: "Faturamento Mensal 30d" },
    production_entry_collaborators: [
      {
        had_infraction: false,
        colaboradores: { id: "col-01", nome: "José Carlos Alcantara", cargo: "Ajudante", cpf: "33211122233" },
      },
      {
        had_infraction: false,
        colaboradores: { id: "col-02", nome: "Marcos Vinicius", cargo: "Ajudante", cpf: "44122233344" },
      },
    ],
    operacao_producao_materiais: [
      {
        id: "mat-01",
        nome_snapshot: "Filme Stretch 500x25",
        unidade_snapshot: "bobina",
        quantidade: 1,
        valor_unitario_snapshot: 45.0,
        valor_total: 45.0,
      },
    ],
  },
  {
    id: "8820a002-0000-0000-0000-000000000002",
    empresa_id: "emp-01",
    unidade_id: "un-02",
    data_operacao: "2026-10-02",
    tipo_servico_id: "srv-02",
    transportadora_id: "transp-02",
    fornecedor_id: "forn-02",
    placa: "RTE-4E21",
    nf_numero: "SIM",
    quantidade_colaboradores: 3,
    entrada_ponto: "06:00:00",
    saida_ponto: "11:00:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 3200,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.38,
    valor_descarga: 1216.0,
    percentual_iss: 0.05,
    custo_com_iss: 60.8,
    valor_total_materiais: 0,
    valor_total: 1276.8,
    status: "AGUARDANDO_FATURAMENTO",
    status_rh: "VALIDADO_RH",
    status_pagamento: "PENDENTE",
    responsavel_nome: "Fernanda Supervisora",
    empresas: { id: "emp-01", nome: "Benevides Participações" },
    unidades: { id: "un-02", nome: "CD São Paulo - Doca 02" },
    tipos_servico_operacional: { nome: "Descarga Granel" },
    fornecedores: { nome: "Nestlé Brasil" },
    transportadoras_clientes: { nome: "Braspress" },
    formas_pagamento_operacional: { nome: "Faturamento Mensal 30d" },
    production_entry_collaborators: [],
  },
  {
    id: "8819a003-0000-0000-0000-000000000003",
    empresa_id: "emp-01",
    unidade_id: "un-03",
    data_operacao: "2026-10-01",
    tipo_servico_id: "srv-01",
    transportadora_id: "transp-03",
    fornecedor_id: "forn-03",
    placa: "QWE-8821",
    nf_numero: null,
    quantidade_colaboradores: 2,
    entrada_ponto: "08:10:00",
    saida_ponto: null, // RESTRIÇÃO!
    tipo_calculo_snapshot: "volume",
    quantidade: 1400,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.45,
    valor_descarga: 630.0,
    percentual_iss: 0.05,
    custo_com_iss: 31.5,
    valor_total_materiais: 0,
    valor_total: 661.5,
    status: "EM_RESTRICAO",
    status_rh: "DEVOLVIDO_RH",
    status_pagamento: "PENDENTE",
    responsavel_nome: "Claudio Encarregado",
    empresas: { id: "emp-01", nome: "Benevides Participações" },
    unidades: { id: "un-03", nome: "Filial Campinas" },
    tipos_servico_operacional: { nome: "Descarga Paletizada" },
    fornecedores: { nome: "Mondelez Brasil" },
    transportadoras_clientes: { nome: "Rodonaves" },
    formas_pagamento_operacional: { nome: "Boleto Faturado 15d" },
    avaliacao_json: {
      motivo_restricao: "Horário de término in loco não informado pelo encarregado",
      motivo_devolucao_rh: "Horário de encerramento divergente",
    },
    production_entry_collaborators: [
      {
        had_infraction: true,
        infraction_notes: "Sem EPI",
        colaboradores: { id: "col-03", nome: "Fernando Gomes", cargo: "Ajudante", cpf: "31288899900" },
      },
    ],
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
}

function renderOperacoesVolume(initialRoute = "/operacoes-volume") {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/operacoes-volume" element={<Operacoes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CONV-03 — Operações por Volume Oficial (Convergência UX05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (baseServices.EmpresaService.getAll as any).mockResolvedValue(sampleEmpresas);
    (baseServices.TipoServicoOperacionalService.getAllActive as any).mockResolvedValue(sampleServicos);
    (baseServices.OperacaoProducaoService.getAll as any).mockResolvedValue(sampleOperacoes);
  });

  it("1. ZERO MOCK: Garante que os arquivos oficiais não importam dados mock do UX Lab", () => {
    const pageContent = fs.readFileSync(path.resolve(__dirname, "../pages/Operacoes.tsx"), "utf8");
    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../components/operacoes/OperacaoVolumeDrawer.tsx"),
      "utf8"
    );

    expect(pageContent).not.toContain("OPERACOES_VOLUME_MOCKS");
    expect(pageContent).not.toContain("operacoesVolumeMockData");
    expect(drawerContent).not.toContain("OPERACOES_VOLUME_MOCKS");
    expect(drawerContent).not.toContain("operacoesVolumeMockData");
  });

  it("2. Renderiza o cabeçalho oficial com título, subtítulo e CTA de Nova Operação", async () => {
    renderOperacoesVolume();

    expect(await screen.findByRole("heading", { name: /Operações por Volume/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhe lançamentos, validações in loco e avanço das operações no pátio/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova Operação/i })).toBeInTheDocument();
  });

  it("3. Exibe os 4 Cards de Síntese Operacional e assegura a ausência dos KPIs financeiros legados", async () => {
    renderOperacoesVolume();

    // 4 Cards Operacionais esperados
    expect(await screen.findByText(/Operações no Período/i)).toBeInTheDocument();
    expect(screen.getByText(/Requer Validação/i)).toBeInTheDocument();
    expect(screen.getByText(/Com Restrição/i)).toBeInTheDocument();
    expect(screen.getByText(/Prontas p\/ Faturar/i)).toBeInTheDocument();

    // Ausência dos KPIs financeiros executivos
    expect(screen.queryByText(/Faturamento Total/i)).toBeNull();
    expect(screen.queryByText(/Caixa Real/i)).toBeNull();
    expect(screen.queryByText(/Provisionado/i)).toBeNull();
    expect(screen.queryByText(/A Receber/i)).toBeNull();
  });

  it("4. Deriva as contagens dos cards a partir do dataset real filtrado por data_operacao", async () => {
    renderOperacoesVolume();

    // Total: 3 operações
    const cardTotal = (await screen.findByText(/Operações no Período/i)).closest("button");
    expect(cardTotal).toBeInTheDocument();
    if (cardTotal) {
      expect(await within(cardTotal).findByText("3")).toBeInTheDocument();
    }

    // Requer validação (RECEBIDO): 1
    const cardValidacao = screen.getByText(/Requer Validação/i).closest("button");
    expect(cardValidacao).toBeInTheDocument();
    if (cardValidacao) {
      expect(await within(cardValidacao).findByText("1")).toBeInTheDocument();
    }
  });

  it("5. Renderiza a Tabela Densa de 10 colunas com código formatado e status desacoplados", async () => {
    renderOperacoesVolume();

    expect(await screen.findByRole("columnheader", { name: /^Operação$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Data$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Unidade \/ Contexto$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Fornecedor & Transporte$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Serviço & Volume$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Equipe$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Pipeline Operação$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Status RH$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Pendência$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Ação$/i })).toBeInTheDocument();

    // Linhas renderizadas com código derivado do ID
    expect(screen.getByText("OP-8821A001")).toBeInTheDocument();
    expect(screen.getByText("OP-8820A002")).toBeInTheDocument();
    expect(screen.getByText("OP-8819A003")).toBeInTheDocument();
  });

  it("6. Preserva a distinção entre Headcount declarado e colaboradores nominais vinculados", async () => {
    renderOperacoesVolume();

    // OP-8821 tem 4 declarados e 2 nominais vinculados
    expect(await screen.findByText("4 pess.")).toBeInTheDocument();
    expect(screen.getByText("(2 nom.)")).toBeInTheDocument();
  });

  it("7. Filtro de busca textual localiza por código, cliente ou placa", async () => {
    renderOperacoesVolume();

    await screen.findByText("OP-8821A001");

    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });

    // Deve exibir apenas OP-8820A002
    expect(screen.getByText("OP-8820A002")).toBeInTheDocument();
    expect(screen.queryByText("OP-8821A001")).toBeNull();
  });

  it("8. Clicar em uma linha de operação abre o Drawer Especialista com diagnóstico completo", async () => {
    renderOperacoesVolume();

    const opRow = await screen.findByText("OP-8821A001");
    fireEvent.click(opRow);

    // Detalhes do Drawer
    expect(await screen.findByText("Contexto da Carga & Transporte")).toBeInTheDocument();
    expect(screen.getAllByText("Ambev S/A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jamef Encomendas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BRA-2E19").length).toBeGreaterThan(0);
    expect(screen.getByText("NF 89211")).toBeInTheDocument();

    // Equipe alocada com CPF mascarado
    expect(screen.getByText("Equipe Alocada")).toBeInTheDocument();
    expect(screen.getByText("José Carlos Alcantara")).toBeInTheDocument();
    expect(screen.getByText("332.***.***-33")).toBeInTheDocument();

    // Composição financeira oficial dos snapshots
    expect(screen.getByText("Composição do Valor da Operação")).toBeInTheDocument();
    expect(screen.getByText("R$ 777.00")).toBeInTheDocument();
    expect(screen.getByText("R$ 38.85")).toBeInTheDocument(); // ISS
    expect(screen.getByText("R$ 45.00")).toBeInTheDocument(); // Materiais
    expect(screen.getByText("R$ 860.85")).toBeInTheDocument(); // Total
  });

  it("9. Trava de estado fechado desabilita edição para operações faturadas/aguardando faturamento", async () => {
    renderOperacoesVolume();

    // OP-8820A002 está AGUARDANDO_FATURAMENTO
    const opFaturar = await screen.findByText("OP-8820A002");
    fireEvent.click(opFaturar);

    const btnEdit = await screen.findByRole("button", { name: /Editar Operação/i });
    expect(btnEdit).toBeDisabled();
  });

  it("10. Filtros exploratórios (busca, serviço) refinam a tabela sem zerar os 4 cards macro", async () => {
    renderOperacoesVolume();

    await screen.findByText("OP-8821A001");

    // Cards exibem 3 no total macro do período
    const cardTotal = (await screen.findByText(/Operações no Período/i)).closest("button");
    expect(within(cardTotal!).getByText("3")).toBeInTheDocument();

    // Aplica busca que retorna apenas 1 registro
    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });

    // Tabela exibe apenas 1 linha
    expect(screen.getByText("OP-8820A002")).toBeInTheDocument();
    expect(screen.queryByText("OP-8821A001")).toBeNull();

    // Cards MACRO continuam preservando o contexto do período (Total: 3, Requer Validação: 1, etc.)
    expect(within(cardTotal!).getByText("3")).toBeInTheDocument();
  });

  it("11. Clicar em um card filtra a tabela sem alterar os números de síntese dos 4 cards", async () => {
    renderOperacoesVolume();

    await screen.findByText("OP-8821A001");

    const cardProntas = screen.getByText(/Prontas p\/ Faturar/i).closest("button");
    expect(cardProntas).toBeInTheDocument();

    // Clica no card "Prontas p/ Faturar"
    fireEvent.click(cardProntas!);

    // Tabela filtra para exibir apenas a operação pronta para faturar (OP-8820A002)
    expect(screen.getByText("OP-8820A002")).toBeInTheDocument();
    expect(screen.queryByText("OP-8821A001")).toBeNull();
    expect(screen.queryByText("OP-8819A003")).toBeNull();

    // Os cards continuam com os valores macro estáveis
    const cardTotal = (await screen.findByText(/Operações no Período/i)).closest("button");
    expect(within(cardTotal!).getByText("3")).toBeInTheDocument();
  });

  it("12. Empty state exibe mensagem contextual quando filtros exploratórios zeram os resultados", async () => {
    renderOperacoesVolume();

    await screen.findByText("OP-8821A001");

    // Busca inexistente
    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "XYZ_INEXISTENTE_999" } });

    expect(screen.getByText(/Nenhuma operação encontrada com os filtros selecionados/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limpar Filtros/i })).toBeInTheDocument();

    // Cards macro permanecem com os números do período
    const cardTotal = (await screen.findByText(/Operações no Período/i)).closest("button");
    expect(within(cardTotal!).getByText("3")).toBeInTheDocument();
  });

  it("13. Botão Limpar Filtros restaura a listagem completa e os estados default", async () => {
    renderOperacoesVolume();

    await screen.findByText("OP-8821A001");

    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "XYZ_INEXISTENTE_999" } });
    expect(screen.queryByText("OP-8821A001")).toBeNull();

    const btnLimpar = screen.getByRole("button", { name: /Limpar Filtros/i });
    fireEvent.click(btnLimpar);

    // Todas as 3 operações voltam a ser exibidas
    expect(await screen.findByText("OP-8821A001")).toBeInTheDocument();
    expect(screen.getByText("OP-8820A002")).toBeInTheDocument();
    expect(screen.getByText("OP-8819A003")).toBeInTheDocument();
  });

  it("14. Drawer oferece CTA 'Abrir Validação RH' que despacha para /rh/aprovacoes sem aprovação direta", async () => {
    const handleNavigateRhMock = vi.fn();
    const queryClient = createTestQueryClient();
    const opComAssimetria = {
      ...sampleOperacoes[0],
      status: "AGUARDANDO_FATURAMENTO",
      status_rh: "PENDENTE_RH",
      status_pagamento: "RECEBIDO",
      data_pagamento: "2026-09-17",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OperacaoVolumeDrawer
            operacao={opComAssimetria as any}
            open={true}
            onOpenChange={vi.fn()}
            onNavigateRh={handleNavigateRhMock}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Banner de assimetria presente
    expect(screen.getByText(/Atenção ao encerramento/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-17/i)).toBeInTheDocument();

    // CTA de despacho RH presente
    const btnsRh = screen.getAllByRole("button", { name: /Abrir Validação RH/i });
    expect(btnsRh.length).toBeGreaterThan(0);

    // Clica no CTA de despacho RH
    fireEvent.click(btnsRh[0]);
    expect(handleNavigateRhMock).toHaveBeenCalledTimes(1);
  });

  it("15. Drawer mantém a ação de 'Regularizar apontamento' para correções in loco", async () => {
    const handleEditMock = vi.fn();
    const queryClient = createTestQueryClient();
    const opRestrita = sampleOperacoes[2]; // EM_RESTRICAO

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OperacaoVolumeDrawer
            operacao={opRestrita as any}
            open={true}
            onOpenChange={vi.fn()}
            onEditRequest={handleEditMock}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btnRegularizar = screen.getByRole("button", { name: /Regularizar apontamento/i });
    expect(btnRegularizar).toBeInTheDocument();

    fireEvent.click(btnRegularizar);
    expect(handleEditMock).toHaveBeenCalledWith(expect.objectContaining({ id: opRestrita.id }));
  });
});
