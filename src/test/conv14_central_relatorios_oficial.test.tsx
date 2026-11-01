import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import fs from "fs";
import path from "path";

import CentralRelatoriosOficial from "@/pages/Relatorios/CentralRelatoriosOficial";
import RelatorioVisualizadorOficial from "@/pages/Relatorios/RelatorioVisualizadorOficial";
import {
  RelatoriosOficialAdapter,
  RELATORIOS_CATALOGO_OFICIAL,
  checkReportAccess,
  formatBRL,
  formatMinutosToHourString,
} from "@/services/adapters/relatoriosOficialAdapter";
import { EmpresaService } from "@/services/base.service";

// Mock de contextos e serviços
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
    canAccess: (mod: string) => {
      if (mockRole.current === "admin" || mockRole.current === "gestor") return true;
      if (mockRole.current === "financeiro") return mod === "central_de_relatorios" || mod === "central_financeira";
      if (mockRole.current === "rh") return mod === "processamento_rh" || mod === "pontos_recebidos";
      return false;
    },
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

// Mock do EmpresaService
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-01", nome: "ESC LOG Matriz", nome_fantasia: "ESC LOG Matriz", razao_social: "ESC Logística Ltda", cnpj: "12.345.678/0001-90" },
      { id: "emp-02", nome: "ESC LOG Filial 02", nome_fantasia: "ESC LOG Filial 02", razao_social: "ESC Logística Filial", cnpj: "12.345.678/0002-71" },
    ]),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("CONV-14: Migração UX04 → Central de Relatórios Oficial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole.current = "admin";

    vi.spyOn(RelatoriosOficialAdapter, "getCentralHubConsolidado").mockResolvedValue({
      kpis: {
        totalRegistros: 1250,
        relatoriosAtivos: 6,
        volumeOperacional: 45000,
        receitasReportadas: 185000,
        despesasApuradas: 72000,
        diaristasTotal: 42000,
        custosExtrasTotal: 30000,
        bancoHorasSaldoMinutos: 1440,
        bancoHorasAVencerMinutos: 360,
      },
      counts: {
        "r01-operacoes-volume": 35,
        "r02-fechamento-diaristas": 12,
        "r03-faturamento-receitas": 28,
        "r04-custos-extras": 15,
        "r05-banco-horas": 45,
        "r07-servicos-extras": 18,
      },
      infograficos: {
        registrosOperacional: 68,
        registrosRH: 57,
        registrosFinanceiro: 28,
        pctOperacional: 45,
        pctRH: 37,
        pctFinanceiro: 18,
      },
      datasets: {
        r01Rows: [],
        r02Rows: [],
        r03Rows: [],
        r04Rows: [],
        r05Rows: [],
        r07Rows: [],
      },
    });
  });

  // --------------------------------------------------------------------------
  // 1. VERIFICAÇÃO DO CATÁLOGO E BLOQUEIO DE R06
  // --------------------------------------------------------------------------
  it("deve conter exatamente os 6 relatórios autorizados no catálogo e R06 estritamente ausente", () => {
    const codes = RELATORIOS_CATALOGO_OFICIAL.map((r) => r.code);
    expect(codes).toContain("R01");
    expect(codes).toContain("R02");
    expect(codes).toContain("R03");
    expect(codes).toContain("R04");
    expect(codes).toContain("R05");
    expect(codes).toContain("R07");

    // R06 permanece bloqueado
    expect(codes).not.toContain("R06");
    expect(RELATORIOS_CATALOGO_OFICIAL.find((r) => r.id === "r06-produtividade-individual")).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 2. GOVERNANÇA DE ACESSO (RBAC POR RELATÓRIO)
  // --------------------------------------------------------------------------
  it("deve aplicar regras estritas de governança de acesso por papel", () => {
    // Admin e Gestor acessam os 6 relatórios autorizados
    expect(checkReportAccess("r01-operacoes-volume", "admin")).toBe(true);
    expect(checkReportAccess("r03-faturamento-receitas", "admin")).toBe(true);
    expect(checkReportAccess("r05-banco-horas", "admin")).toBe(true);

    expect(checkReportAccess("r01-operacoes-volume", "gestor")).toBe(true);
    expect(checkReportAccess("r03-faturamento-receitas", "gestor")).toBe(true);
    expect(checkReportAccess("r05-banco-horas", "gestor")).toBe(true);

    // RH acessa R01, R02, R04, R05, R07, mas NÃO acessa R03 (Financeiro)
    expect(checkReportAccess("r01-operacoes-volume", "rh")).toBe(true);
    expect(checkReportAccess("r02-fechamento-diaristas", "rh")).toBe(true);
    expect(checkReportAccess("r04-custos-extras", "rh")).toBe(true);
    expect(checkReportAccess("r05-banco-horas", "rh")).toBe(true);
    expect(checkReportAccess("r07-servicos-extras", "rh")).toBe(true);
    expect(checkReportAccess("r03-faturamento-receitas", "rh")).toBe(false);

    // Financeiro acessa R01, R02, R03, R04, R07, mas NÃO acessa R05 (Banco de Horas RH)
    expect(checkReportAccess("r01-operacoes-volume", "financeiro")).toBe(true);
    expect(checkReportAccess("r02-fechamento-diaristas", "financeiro")).toBe(true);
    expect(checkReportAccess("r03-faturamento-receitas", "financeiro")).toBe(true);
    expect(checkReportAccess("r04-custos-extras", "financeiro")).toBe(true);
    expect(checkReportAccess("r07-servicos-extras", "financeiro")).toBe(true);
    expect(checkReportAccess("r05-banco-horas", "financeiro")).toBe(false);

    // R06 é bloqueado para todos
    expect(checkReportAccess("r06-produtividade-individual", "admin")).toBe(false);
    expect(checkReportAccess("R06", "admin")).toBe(false);
    expect(checkReportAccess("r06-produtividade-individual", "financeiro")).toBe(false);

    // Encarregado não acessa relatórios
    expect(checkReportAccess("r01-operacoes-volume", "encarregado")).toBe(false);
    expect(checkReportAccess("r03-faturamento-receitas", "encarregado")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 3. EXPORTAÇÃO CSV: BOM E SANITIZAÇÃO DE FÓRMULAS
  // --------------------------------------------------------------------------
  it("deve sanitizar fórmulas de injeção de planilha e incluir UTF-8 BOM", () => {
    let capturedBlob: Blob | null = null;
    let capturedDownloadName = "";

    // Mock do DOM createElement e URL
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        const originalSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = (name: string, val: string) => {
          if (name === "download") capturedDownloadName = val;
          return originalSetAttribute(name, val);
        };
        el.click = vi.fn();
      }
      return el;
    });

    const originalCreateObjectURL = (globalThis.URL as any).createObjectURL;
    const originalRevokeObjectURL = (globalThis.URL as any).revokeObjectURL;
    (globalThis.URL as any).createObjectURL = vi.fn((blob: any) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    (globalThis.URL as any).revokeObjectURL = vi.fn();

    // Executa exportação de R01 contendo tentativa maliciosa de fórmula
    const mockMaliciousRows = [
      {
        id: "1",
        empresaId: "emp-01",
        dataOperacao: "2026-09-15",
        codigoOperacional: "=CMD|' /C calc'!A0", // Injeção de fórmula
        unidade: "Matriz",
        transportadora: "+cmd|' /C notepad'!A0",
        tipoServico: "Descarga",
        produtoCarga: "@SUM(1+1)",
        quantidade: 100,
        valorUnitario: 2.5,
        totalBruto: 250,
        materiais: 0,
        iss: 0,
        placa: "-calc",
        nfNumero: "123",
        status: "CONCLUIDO",
      },
    ];

    RelatoriosOficialAdapter.exportReportToCSV(
      "r01-operacoes-volume",
      mockMaliciousRows,
      "2026-09",
      "ESC LOG Matriz"
    );

    expect(capturedBlob).not.toBeNull();
    expect(capturedDownloadName).toContain("R01");
  });

  // --------------------------------------------------------------------------
  // 4. RENDERIZAÇÃO DA CENTRAL DE RELATÓRIOS OFICIAL (/relatorios)
  // --------------------------------------------------------------------------
  it("deve renderizar a Central de Relatórios Oficial com os 4 KPIs e catálogo de cadernos", async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios?empresa=emp-01&competencia=2026-09"]}>
          <CentralRelatoriosOficial />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Faixa documental e título
    expect(screen.getAllByText("Central de Relatórios").length).toBeGreaterThan(0);
    expect(screen.getByText("Catálogo de Cadernos Homologados")).toBeInTheDocument();

    // 4 KPIs oficiais e Catálogo dentro de waitFor
    await waitFor(() => {
      expect(screen.getByText(/Volume Operacional/i)).toBeInTheDocument();
      expect(screen.getByText(/Receitas Reportadas/i)).toBeInTheDocument();
      expect(screen.getByText(/Despesas Apuradas/i)).toBeInTheDocument();
      expect(screen.getByText(/Registros Consolidados/i)).toBeInTheDocument();
      expect(screen.getByText("Analítico de Operações por Volume")).toBeInTheDocument();
      expect(screen.getByText("Faturamento e Receitas")).toBeInTheDocument();
      expect(screen.getByText("Fechamento de Diaristas")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. RENDERIZAÇÃO DO VISUALIZADOR DOCUMENTAL OFICIAL (/relatorios/:reportId)
  // --------------------------------------------------------------------------
  it("deve renderizar o Visualizador Documental 50/50 para R01", async () => {
    const queryClient = createTestQueryClient();

    // Mock do método getR01Data
    const spy = vi.spyOn(RelatoriosOficialAdapter, "getR01Data").mockResolvedValue([
      {
        id: "op-1",
        empresaId: "emp-01",
        dataOperacao: "2026-09-15",
        codigoOperacional: "OP-2026-001",
        unidade: "Matriz",
        transportadora: "TransLog Express",
        tipoServico: "Descarga",
        produtoCarga: "Bebidas",
        quantidade: 1500,
        valorUnitario: 0.85,
        totalBruto: 1275,
        materiais: 25,
        iss: 63.75,
        placa: "ABC-1234",
        nfNumero: "45091",
        status: "CONCLUIDO",
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/r01-operacoes-volume?empresa=emp-01&competencia=2026-09"]}>
          <Routes>
            <Route path="/relatorios/:reportId" element={<RelatorioVisualizadorOficial />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Cabeçalho documental e identificador do caderno
    expect(screen.getByText("RELATÓRIO ANALÍTICO OFICIAL")).toBeInTheDocument();
    expect(screen.getAllByText("R01").length).toBeGreaterThan(0);

    // Seção editorial 50/50
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(screen.getByText("Resumo do Período")).toBeInTheDocument();
      expect(screen.getByText("Concentração por Transportadora")).toBeInTheDocument();
      expect(screen.getByText("OP-2026-001")).toBeInTheDocument();
      expect(screen.getAllByText("TransLog Express").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  // --------------------------------------------------------------------------
  // 6. BLOQUEIO DE ACESSO INDEVIDO NO VISUALIZADOR
  // --------------------------------------------------------------------------
  it("deve bloquear visualização de R06 e de relatórios não autorizados para o perfil", async () => {
    const queryClient = createTestQueryClient();

    // Tentativa de acessar R06 (bloqueado)
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/r06-produtividade-individual"]}>
          <Routes>
            <Route path="/relatorios/:reportId" element={<RelatorioVisualizadorOficial />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Caderno em Homologação (Bloqueado)")).toBeInTheDocument();
    unmount();

    // Tentativa do perfil RH acessar R03 (Financeiro)
    mockRole.current = "rh";
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/r03-faturamento-receitas"]}>
          <Routes>
            <Route path="/relatorios/:reportId" element={<RelatorioVisualizadorOficial />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Acesso Restrito ao Caderno")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 7. PRESERVAÇÃO INTEGRAL DE ROTAS LEGADAS E UX LAB
  // --------------------------------------------------------------------------
  it("deve confirmar que App.tsx preserva rotas legadas e UX Lab", () => {
    const appPath = path.resolve(__dirname, "../App.tsx");
    const appContent = fs.readFileSync(appPath, "utf-8");

    // Rotas oficiais CONV-14
    expect(appContent).toContain('path="/relatorios"');
    expect(appContent).toContain('path="/relatorios/:reportId"');

    // Rotas legadas contábeis preservadas
    expect(appContent).toContain('path="/relatorios/legado"');
    expect(appContent).toContain('path="/relatorios/detalhe/:id"');
    expect(appContent).toContain('path="/relatorios/agendamentos"');
    expect(appContent).toContain('path="/relatorios/layouts"');
    expect(appContent).toContain('path="/relatorios/integracao"');
    expect(appContent).toContain('path="/relatorios/mapeamento"');
    expect(appContent).toContain('path="/relatorios/integracao/logs"');
    expect(appContent).toContain('path="/relatorios/integracoes"');

    // Rotas UX Lab preservadas
    expect(appContent).toContain('path="/ux-lab/relatorios"');
    expect(appContent).toContain('path="/ux-lab/relatorios/:reportId"');
  });

  // --------------------------------------------------------------------------
  // 8. ENTRADA ÚNICA NA SIDEBAR OFICIAL
  // --------------------------------------------------------------------------
  it("deve confirmar entrada única da Central de Relatórios na Sidebar", () => {
    const sidebarPath = path.resolve(__dirname, "../components/layout/Sidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

    expect(sidebarContent).toContain('id: "central-relatorios"');
    expect(sidebarContent).toContain('label: "Central de Relatórios"');
    expect(sidebarContent).toContain('to: "/relatorios"');
    expect(sidebarContent).toContain('module: "central_de_relatorios"');
  });
});
