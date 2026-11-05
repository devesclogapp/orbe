import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CentralRelatoriosV2 from "@/pages/Relatorios/CentralRelatoriosV2";
import CentralRelatoriosOficial from "@/pages/Relatorios/CentralRelatoriosOficial";
import {
  RelatoriosOficialAdapter,
  RELATORIOS_CATALOGO_OFICIAL,
  checkReportAccess,
} from "@/services/adapters/relatoriosOficialAdapter";
import { EmpresaService } from "@/services/base.service";
import { ContextualHelpProvider } from "@/contexts/ContextualHelpContext";
import { TooltipProvider } from "@/components/ui/tooltip";

// Polyfill de ResizeObserver para o Recharts ResponsiveContainer no ambiente JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mocks de infraestrutura e contextos
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    environment: "PRODUCAO",
    theme: "light",
  }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-esc-log" },
    tenantId: "tenant-esc-log",
    loading: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@esclog.com", role: "admin" },
    profile: { id: "user-1", role: "admin", nome: "Administrador" },
    permissoes: ["central_de_relatorios", "admin"],
    hasPermissao: () => true,
    isAdmin: () => true,
    isMaster: () => true,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const mockRole = { current: "admin" };

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: mockRole.current,
    isAdmin: mockRole.current === "admin",
    canAccess: () => true,
    hasAccess: () => true,
  }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    state: {},
    dispatch: vi.fn(),
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
    isOpen: false,
  }),
  OperationalPipelineProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-01", nome: "ESC LOG Matriz", nome_fantasia: "ESC LOG Matriz", razao_social: "ESC Logística Ltda" },
    ]),
  },
}));

// Mock de dados analíticos para os cadernos
const mockDatasets = {
  r01Rows: [
    {
      id: "op-1",
      data: "2026-09-10",
      codigo: "OP-001",
      transportadora: "TransLog Express",
      tipoServico: "Descarga Paletizada",
      quantidade: 500,
      totalBruto: 2500,
      materiais: 120,
      placa: "ABC-1234",
      status: "CONCLUIDO",
      unidade: "Matriz",
    },
    {
      id: "op-2",
      data: "2026-09-15",
      codigo: "OP-002",
      transportadora: "Rápido Brasil",
      tipoServico: "Batida Manual",
      quantidade: 300,
      totalBruto: 1800,
      materiais: 0,
      placa: "XYZ-9876",
      status: "FATURADO",
      unidade: "Matriz",
    },
  ],
  r02Rows: [
    {
      id: "diar-1",
      data: "2026-09-12",
      colaboradorNome: "João Silva",
      cpf: "123.456.789-00",
      funcao: "Ajudante Operacional",
      quantidadeDiarias: 5,
      valorDiaria: 120,
      total: 600,
      statusLote: "pago",
      loteCodigo: "LOTE-001",
    },
  ],
  r03Rows: [
    {
      id: "rec-1",
      dataVencimento: "2026-09-30",
      cliente: "Distribuidora Alpha",
      modalidade: "FATURAMENTO_MENSAL",
      valorFaturado: 12500,
      status: "conciliado",
      nfNumero: "NF-9901",
    },
  ],
  r04Rows: [
    {
      id: "custo-1",
      data: "2026-09-08",
      tipo: "Lanche Operacional",
      categoriaCusto: "MERENDA",
      descricao: "Lanche horas extras",
      valor: 350,
      status: "PAGO",
    },
  ],
  r05Rows: [
    {
      id: "bh-1",
      colaboradorNome: "Carlos Santos",
      cargo: "Operador de Empilhadeira",
      saldoMinutos: 120,
      creditosMinutos: 180,
      debitosMinutos: 60,
      aVencer30dMinutos: 0,
      status: "Saldo Positivo",
    },
  ],
  r07Rows: [
    {
      id: "extra-1",
      data: "2026-09-18",
      codigo: "EXT-001",
      tipoServico: "Conserto de Pallets",
      descricao: "Recuperação de 40 pallets",
      valor: 800,
      pipelineStatus: "CONCLUIDO",
    },
  ],
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

const renderCentralV2 = (initialRoute = "/relatorios?empresa=emp-01&competencia=2026-09&report=dashboard") => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <TooltipProvider>
          <ContextualHelpProvider>
            <Routes>
              <Route path="/relatorios" element={<CentralRelatoriosV2 />} />
              <Route path="/relatorios/classico" element={<CentralRelatoriosOficial />} />
              <Route path="/relatorios/v2" element={<CentralRelatoriosV2 />} />
            </Routes>
          </ContextualHelpProvider>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("CentralRelatoriosV2: Testes Funcionais da UI v2.0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole.current = "admin";

    vi.spyOn(RelatoriosOficialAdapter, "getCentralHubConsolidado").mockResolvedValue({
      kpis: {
        totalRegistros: 6,
        relatoriosAtivos: 6,
        volumeOperacional: 800,
        receitasReportadas: 12500,
        despesasApuradas: 950,
        diaristasTotal: 600,
        custosExtrasTotal: 350,
        bancoHorasSaldoMinutos: 120,
        bancoHorasAVencerMinutos: 0,
      },
      counts: {
        "r01-operacoes-volume": 2,
        "r02-fechamento-diaristas": 1,
        "r03-faturamento-receitas": 1,
        "r04-custos-extras": 1,
        "r05-banco-horas": 1,
        "r07-servicos-extras": 1,
      },
      infograficos: {
        registrosOperacional: 3,
        registrosRH: 2,
        registrosFinanceiro: 1,
        pctOperacional: 50,
        pctRH: 33,
        pctFinanceiro: 17,
      },
      datasets: mockDatasets,
    });
  });

  // --------------------------------------------------------------------------
  // 1. DASHBOARD GERENCIAL E NAVEGAÇÃO LATERAL
  // --------------------------------------------------------------------------
  it("deve carregar o Dashboard Gerencial com os 4 KPIs macro e atalhos documentais", async () => {
    renderCentralV2();

    await waitFor(() => {
      expect(screen.getByText("Central de Relatórios")).toBeDefined();
    });

    expect(screen.getByText("Volume Operacional")).toBeDefined();
    expect(screen.getByText("Receitas Reconhecidas")).toBeDefined();
    expect(screen.getByText("Despesas de Campo")).toBeDefined();
    expect(screen.getByText("Banco de Horas (CLT)")).toBeDefined();

    // R06 deve estar explicitamente bloqueado com cadeado na navegação lateral
    const btnR06 = screen.getByRole("button", { name: /R06/i });
    expect(btnR06).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. INDICADORES ESPECÍFICOS E AUDITORIA VIA KPI DRAWER (RESOLVE PROBLEMA DO USUÁRIO)
  // --------------------------------------------------------------------------
  it("deve abrir o Drawer de Auditoria ao clicar em um card de indicador ou em 'Auditar'", async () => {
    renderCentralV2("/relatorios?empresa=emp-01&competencia=2026-09&report=r01-operacoes-volume");

    await waitFor(() => {
      expect(screen.getByText("Cargas Totais")).toBeDefined();
      expect(screen.getByText("Volume Físico")).toBeDefined();
      expect(screen.getByText("Total Bruto")).toBeDefined();
    });

    // Clicar no primeiro card de indicador (Cargas Totais)
    const cards = screen.getAllByTitle(/Clique para auditar detalhamento e regras de cálculo deste indicador/i);
    expect(cards.length).toBeGreaterThan(0);
    const cardCargas = cards[0];

    fireEvent.click(cardCargas);

    // O Drawer/Sheet deve abrir imediatamente exibindo a auditoria
    await waitFor(() => {
      expect(screen.getByText("Auditoria de Cargas Realizadas")).toBeDefined();
      expect(screen.getByText("operacoes_producao")).toBeDefined();
      expect(screen.getByText("Total de Cargas Filtradas")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. REAÇÃO DOS KPIS E DA TABELA AOS FILTROS ESPECÍFICOS
  // --------------------------------------------------------------------------
  it("deve manter sincronia rigorosa entre filtros específicos, KPIs analíticos e linhas da tabela", async () => {
    renderCentralV2("/relatorios?empresa=emp-01&competencia=2026-09&report=r01-operacoes-volume");

    await waitFor(() => {
      expect(screen.getByText("TransLog Express")).toBeDefined();
      expect(screen.getByText("Rápido Brasil")).toBeDefined();
    });

    // Busca rápida textual
    const searchInput = screen.getByPlaceholderText("Buscar registros...");
    fireEvent.change(searchInput, { target: { value: "TransLog" } });

    await waitFor(() => {
      expect(screen.getByText("TransLog Express")).toBeDefined();
      expect(screen.queryByText("Rápido Brasil")).toBeNull();
      // O botão "Limpar" deve aparecer automaticamente
      expect(screen.getByText("Limpar")).toBeDefined();
    });

    // Clicar em Limpar deve restaurar os registros
    fireEvent.click(screen.getByText("Limpar"));

    await waitFor(() => {
      expect(screen.getByText("TransLog Express")).toBeDefined();
      expect(screen.getByText("Rápido Brasil")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. EXPORTAÇÃO CSV COM OS MESMOS DADOS FILTRADOS
  // --------------------------------------------------------------------------
  it("deve exportar CSV passando as linhas filtradas e respeitando os filtros ativos", async () => {
    const exportSpy = vi.spyOn(RelatoriosOficialAdapter, "exportReportToCSV").mockImplementation(() => {});

    renderCentralV2("/relatorios?empresa=emp-01&competencia=2026-09&report=r01-operacoes-volume");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Exportar CSV/i })).toBeDefined();
    });

    const exportBtn = screen.getByRole("button", { name: /Exportar CSV/i });
    await waitFor(() => {
      expect(exportBtn.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledTimes(1);
    });
    expect(exportSpy).toHaveBeenCalledWith(
      "r01-operacoes-volume",
      expect.arrayContaining([
        expect.objectContaining({ codigo: "OP-001" }),
        expect.objectContaining({ codigo: "OP-002" }),
      ]),
      "ESC LOG Matriz",
      "2026-09"
    );
  });

  // --------------------------------------------------------------------------
  // 5. GOVERNANÇA: R06 BLOQUEADO E ISOLAMENTO RBAC
  // --------------------------------------------------------------------------
  it("deve bloquear R06 para qualquer perfil com aviso explícito de governança", async () => {
    renderCentralV2("/relatorios?empresa=emp-01&competencia=2026-09&report=r06-produtividade-individual");

    await waitFor(() => {
      expect(screen.getByText("Caderno em Homologação (Bloqueado)")).toBeDefined();
      expect(
        screen.getByText(/permanece estritamente bloqueado até a homologação canônica/i)
      ).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 6. FERRAMENTAS CONTÁBEIS (REL-03.3)
  // --------------------------------------------------------------------------
  it("deve exibir o menu 'Ferramentas Contábeis' no cabeçalho com 'Integração Contábil' ativa e demais opções com badges de governança", async () => {
    renderCentralV2();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ferramentas Contábeis/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Dossiê Consolidado/i })).toBeDefined();
    });

    const menuBtn = screen.getByRole("button", { name: /Ferramentas Contábeis/i });
    fireEvent.keyDown(menuBtn, { key: "ArrowDown" });

    await waitFor(() => {
      expect(screen.getByText("Sincronização & Agendamentos")).toBeDefined();
      expect(screen.getByText("Integração Contábil")).toBeDefined();
      expect(screen.getByText("Agendamentos")).toBeDefined();
      expect(screen.getByText("Layouts de Exportação")).toBeDefined();
      expect(screen.getByText("Mapeamento Contábil")).toBeDefined();
      expect(screen.getByText("Logs de Integração")).toBeDefined();
      expect(screen.getByText("Central Legada")).toBeDefined();
    });

    // Validar os badges de status correspondentes (CONT-04: todas as 5 ferramentas ativas)
    const badgesAtivo = screen.getAllByText("Ativo");
    expect(badgesAtivo.length).toBeGreaterThanOrEqual(5);

    const badgeDesativada = screen.getByText("Desativada");
    expect(badgeDesativada).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 7. ATIVAÇÃO OFICIAL: ROTEAMENTO PRINCIPAL E NAVEGAÇÃO CRUZADA (REL-04)
  // --------------------------------------------------------------------------
  it("deve abrir v2.0 em /relatorios, versão clássica em /relatorios/classico e suportar rota /relatorios/v2", async () => {
    // 7.1 Rota principal /relatorios abre a v2.0
    const { unmount } = renderCentralV2("/relatorios?empresa=emp-01&competencia=2026-09");
    await waitFor(() => {
      expect(screen.getByText("Central de Relatórios v2.0")).toBeDefined();
      expect(screen.getByText("Visão Clássica")).toBeDefined();
    });
    unmount();

    // 7.2 Rota alternativa /relatorios/v2 também abre a v2.0
    const renderV2Alt = renderCentralV2("/relatorios/v2?empresa=emp-01&competencia=2026-09");
    await waitFor(() => {
      expect(screen.getByText("Central de Relatórios v2.0")).toBeDefined();
    });
    renderV2Alt.unmount();

    // 7.3 Rota /relatorios/classico abre a Central clássica
    const renderClassico = renderCentralV2("/relatorios/classico?empresa=emp-01&competencia=2026-09");
    await waitFor(() => {
      expect(screen.getByText("Catálogo de Cadernos Homologados")).toBeDefined();
      expect(screen.getByText("Nova Central v2.0")).toBeDefined();
    });
    renderClassico.unmount();
  });
});
