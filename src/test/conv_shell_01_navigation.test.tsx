import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Sidebar,
  TOP_LEVEL_ITEMS,
  SECTIONS,
  isRouteMatchingItem,
} from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AppShell } from "@/components/layout/AppShell";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { getBreadcrumbs, getRouteLabel, getSectionLabel } from "@/components/layout/navigationMeta";

// Mock do AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "gestor@esclog.com.br",
      user_metadata: { full_name: "Gestor Executivo" },
    },
    signOut: vi.fn(),
  }),
}));

// Mock do AccessControlContext
const mockCanAccess = vi.fn((module: string) => true);
const mockIsAdmin = true;
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    canAccess: mockCanAccess,
    isAdmin: mockIsAdmin,
    role: "admin",
  }),
}));

// Mock do PreferencesContext
const mockSetEnvironment = vi.fn();
const mockToggleTheme = vi.fn();
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    theme: "light",
    toggleTheme: mockToggleTheme,
    environment: "PRODUCAO",
    setEnvironment: mockSetEnvironment,
  }),
}));

// Mock do OperationalPulse
vi.mock("@/hooks/useOperationalPulse", () => ({
  useOperationalPulse: () => ({
    items: {
      dashboard: { count: 0, tone: "gray", hint: "Normal", details: [] },
      operacoes_recebidas: { count: 0, tone: "gray", hint: "Normal", details: [] },
      pontos_recebidos: { count: 0, tone: "gray", hint: "Normal", details: [] },
      diaristas_recebidos: { count: 0, tone: "gray", hint: "Normal", details: [] },
    },
    stages: {
      entradas: { tone: "gray" },
      rh: { tone: "gray" },
      financeiro: { tone: "gray" },
    },
  }),
}));

// Mock do OperationalPipelineContext
vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
  }),
}));

describe("CONV-SHELL-01 — APPLICATION SHELL (SIDEBAR + HEADER OFICIAL)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderSidebar = (initialPath = "/operacional/dashboard") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // 1. INÍCIO: Dashboard Executivo e Torre Operacional
  it("1. Contém Dashboard Executivo e Torre Operacional no grupo de 1º nível (INÍCIO)", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard Executivo")).toBeInTheDocument();
    expect(screen.getByText("Torre Operacional")).toBeInTheDocument();

    const dashboardItem = TOP_LEVEL_ITEMS.find((i) => i.id === "dashboard");
    const torreItem = TOP_LEVEL_ITEMS.find((i) => i.id === "torre-operacional");

    expect(dashboardItem?.to).toBe("/operacional/dashboard");
    expect(torreItem?.to).toBe("/operacional/pipeline");
  });

  // 2. OPERAÇÕES DE CAMPO
  it("2. Contém a seção Operações de Campo com Volume, Serviços Extras e Custos Extras", () => {
    renderSidebar("/operacoes-volume");
    expect(screen.getByText("Operações de Campo")).toBeInTheDocument();
    expect(screen.getByText("Operações por Volume")).toBeInTheDocument();
    expect(screen.getByText("Serviços Extras")).toBeInTheDocument();
    expect(screen.getByText("Custos Extras")).toBeInTheDocument();
  });

  // 3. PESSOAS & RH: Consolidação CLT
  it("3. Contém Pessoas & RH com Ponto & Jornadas CLT apontando para /clt/pontos", () => {
    renderSidebar("/clt/pontos");
    expect(screen.getByText("Pessoas & RH")).toBeInTheDocument();
    expect(screen.getByText("Ponto & Jornadas CLT")).toBeInTheDocument();
    expect(screen.getByText("Fechamento Mensal CLT")).toBeInTheDocument();
    expect(screen.getByText("Diaristas")).toBeInTheDocument();
    expect(screen.getByText("Intermitentes")).toBeInTheDocument();

    const rhSection = SECTIONS.find((s) => s.id === "pessoas-rh");
    const cltItem = rhSection?.items.find((i) => i.id === "ponto-clt");
    expect(cltItem?.to).toBe("/clt/pontos");
  });

  // 4. NÃO REINTRODUÇÃO DE FRAGMENTAÇÃO CLT
  it("4. Não reintroduz Banco de Horas, Jornadas legadas ou Reprocessamento como itens primários", () => {
    renderSidebar("/clt/pontos");
    const allItemLabels = SECTIONS.flatMap((s) => s.items.map((i) => i.label));

    expect(allItemLabels).not.toContain("Banco de Horas");
    expect(allItemLabels).not.toContain("Jornadas Processadas");
    expect(allItemLabels).not.toContain("Reprocessamento");
    expect(allItemLabels).not.toContain("Pontos / Importações");
  });

  // 5. APROVAÇÕES & FECHAMENTO
  it("5. Contém a seção Aprovações & Fechamento com os 3 módulos transversais", () => {
    renderSidebar("/rh/aprovacoes");
    expect(screen.getByText("Aprovações & Fechamento")).toBeInTheDocument();
    expect(screen.getByText("Central de Aprovações")).toBeInTheDocument();
    expect(screen.getByText("Central de Inconsistências")).toBeInTheDocument();
    expect(screen.getByText("Fechamento de Ciclos")).toBeInTheDocument();
  });

  // 6. FINANCEIRO & CONTROLADORIA
  it("6. Contém Financeiro & Controladoria com 5 módulos econômicos", () => {
    renderSidebar("/financeiro/receitas");
    expect(screen.getByText("Financeiro & Controladoria")).toBeInTheDocument();
    expect(screen.getByText("Receitas Operacionais")).toBeInTheDocument();
    expect(screen.getByText("Despesas & Contas a Pagar")).toBeInTheDocument();
    expect(screen.getByText("Central Bancária")).toBeInTheDocument();
    expect(screen.getByText("Inadimplência & Cobrança")).toBeInTheDocument();
    expect(screen.getByText("Resultado Operacional (DRE)")).toBeInTheDocument();
  });

  // 7. CADASTROS & SISTEMA
  it("7. Contém Cadastros & Sistema com Cadastros, Regras e Preferências", () => {
    renderSidebar("/cadastros");
    expect(screen.getByText("Cadastros & Sistema")).toBeInTheDocument();
    expect(screen.getByText("Central de Cadastros")).toBeInTheDocument();
    expect(screen.getByText("Regras & Tabelas Operacionais")).toBeInTheDocument();
    expect(screen.getByText("Preferências")).toBeInTheDocument();
  });

  // 8. ZERO ROTAS UX LAB NA SIDEBAR OFICIAL
  it("8. ZERO ROTAS UX LAB: Sidebar oficial não possui nenhum link para /ux-lab", () => {
    const allRoutes = [
      ...TOP_LEVEL_ITEMS.map((i) => i.to),
      ...SECTIONS.flatMap((s) => s.items.map((i) => i.to)),
    ];

    allRoutes.forEach((route) => {
      expect(route).not.toContain("/ux-lab");
      expect(route).not.toContain("/uxlab");
    });
  });

  // 9. CORRESPONDÊNCIA DE ROTA ATIVA (isRouteMatchingItem)
  it("9. isRouteMatchingItem identifica corretamente rotas ativas canônicas e subrotas", () => {
    // Dashboard
    expect(isRouteMatchingItem("/operacional/dashboard", false, { pathname: "/operacional/dashboard" })).toBe(true);
    expect(isRouteMatchingItem("/operacional/dashboard", false, { pathname: "/" })).toBe(true);

    // CLT Consolidado
    expect(isRouteMatchingItem("/clt/pontos", false, { pathname: "/clt/pontos" })).toBe(true);
    expect(isRouteMatchingItem("/clt/pontos", false, { pathname: "/clt/banco-horas" })).toBe(true);
    expect(isRouteMatchingItem("/clt/pontos", false, { pathname: "/operacional/pontos" })).toBe(true);

    // Distinção entre /financeiro e /financeiro/receitas
    expect(isRouteMatchingItem("/financeiro", true, { pathname: "/financeiro" })).toBe(true);
    expect(isRouteMatchingItem("/financeiro", true, { pathname: "/financeiro/receitas" })).toBe(false);
    expect(isRouteMatchingItem("/financeiro/receitas", false, { pathname: "/financeiro/receitas" })).toBe(true);
  });

  // 10. TOPBAR / HEADER: Contexto, Ambiente, Tema e Busca
  it("10. Topbar renderiza contexto hierárquico, seletor de base/ambiente e busca ⌘K", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/operacional/dashboard"]}>
          <Topbar title="Dashboard Executivo" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Dashboard Executivo")).toBeInTheDocument();
    expect(screen.getByText("Início")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar atalho (⌘K)")).toBeInTheDocument();
    expect(screen.getByText("Base de Produção")).toBeInTheDocument();
  });

  // 11. ENCARREGADO: Shell isolado
  it("11. OperationalShell é exclusivo do Encarregado e não renderiza a Sidebar administrativa", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/producao"]}>
          <OperationalShell title="Coletor Orbe">
            <div>Formulário Encarregado</div>
          </OperationalShell>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Coletor Orbe")).toBeInTheDocument();
    expect(screen.getByText("Formulário Encarregado")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Executivo")).not.toBeInTheDocument();
    expect(screen.queryByText("Financeiro & Controladoria")).not.toBeInTheDocument();
  });

  // 12. AUDITORIA DE BADGES: Sem contadores brutos (1412, 93)
  it("12. Auditoria de Badges: Não exibe contadores brutos (1412 em Pontos ou 93 em Cadastros)", () => {
    renderSidebar("/clt/pontos");
    expect(screen.queryByText("1412")).not.toBeInTheDocument();
    expect(screen.queryByText("93")).not.toBeInTheDocument();
  });
});
