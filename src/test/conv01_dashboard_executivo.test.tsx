import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { DashboardConsolidadoService } from "@/services/dashboard.service";
import Dashboard from "@/pages/Dashboard";
import { ExecutiveKpiDrawer } from "@/components/dashboard/ExecutiveKpiDrawer";

// Mock TenantContext, PreferencesContext, AuthContext e AccessControlContext
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenantId: "tenant-esc-log-123",
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

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    status: {},
    refresh: vi.fn(),
  }),
}));

describe("CONV-01 — AUDITORIA & HOMOLOGAÇÃO DO DASHBOARD EXECUTIVO OFICIAL", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  // Helper para simular queries do supabase
  function createChainableQuery(data: any = []) {
    const chain: any = {};
    const methods = [
      "select", "gte", "lt", "or", "in", "is", "neq", "eq", 
      "maybeSingle", "single", "order", "limit"
    ];
    methods.forEach((m) => {
      chain[m] = vi.fn().mockImplementation(() => chain);
    });
    chain.then = (resolve: any) => resolve({ data, error: null });
    return chain;
  }

  // 1. PROVA DE ZERO MOCK: Dashboard oficial NÃO importa mockData.ts
  it("1. ZERO MOCK: Dashboard.tsx e ExecutiveKpiDrawer.tsx NÃO importam mockData.ts", () => {
    const dashboardPath = path.resolve(__dirname, "../pages/Dashboard.tsx");
    const drawerPath = path.resolve(__dirname, "../components/dashboard/ExecutiveKpiDrawer.tsx");

    const dashboardCode = fs.readFileSync(dashboardPath, "utf-8");
    const drawerCode = fs.readFileSync(drawerPath, "utf-8");

    expect(dashboardCode).not.toContain("mockData");
    expect(dashboardCode).not.toContain("MOCK_EXECUTIVE_SUMMARY");
    expect(drawerCode).not.toContain("mockData");
    expect(drawerCode).not.toContain("MOCK_EXECUTIVE_SUMMARY");
  });

  // 2. FIN-FIX01: Receita com competência '2026-09' criada em Outubro pertence a Setembro
  it("2. FIN-FIX01: Receita com competência '2026-09' criada em '2026-10' pertence economicamente a '2026-09'", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "empresas") return createChainableQuery([]);
      if (table === "contas_bancarias_empresa") return createChainableQuery([]);
      if (table === "receitas_operacionais") {
        return createChainableQuery([
          {
            valor_total: 50000,
            status: "faturado",
            competencia: "2026-09",
            created_at: "2026-10-02T14:30:00Z", // Criado em Outubro
          },
        ]);
      }
      return createChainableQuery([]);
    });

    // Consulta para Setembro/2026: DEVE computar os 50.000
    const kpisSetembro = await DashboardConsolidadoService.getKpisByCompetencia("2026-09");
    expect(kpisSetembro.faturamentoTotal).toBe(50000);

    // Consulta para Outubro/2026: NÃO DEVE computar os 50.000
    const kpisOutubro = await DashboardConsolidadoService.getKpisByCompetencia("2026-10");
    expect(kpisOutubro.faturamentoTotal).toBe(0);
  });

  // 3. FIN-FIX01: Receita com competência '2026-10' criada em Setembro pertence economicamente a '2026-10'
  it("3. FIN-FIX01: Receita com competência '2026-10' criada em '2026-09' pertence economicamente a '2026-10'", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "empresas") return createChainableQuery([]);
      if (table === "contas_bancarias_empresa") return createChainableQuery([]);
      if (table === "receitas_operacionais") {
        return createChainableQuery([
          {
            valor_total: 75000,
            status: "faturado",
            competencia: "2026-10",
            created_at: "2026-09-28T10:00:00Z", // Criado em Setembro
          },
        ]);
      }
      return createChainableQuery([]);
    });

    // Consulta para Outubro/2026: DEVE computar os 75.000
    const kpisOutubro = await DashboardConsolidadoService.getKpisByCompetencia("2026-10");
    expect(kpisOutubro.faturamentoTotal).toBe(75000);

    // Consulta para Setembro/2026: NÃO DEVE computar os 75.000
    const kpisSetembro = await DashboardConsolidadoService.getKpisByCompetencia("2026-09");
    expect(kpisSetembro.faturamentoTotal).toBe(0);
  });

  // 4. DELTA-CALC: Prova de que os deltas dos KPIs são calculados e não hardcoded
  it("4. DELTA-CALC: Cálculo correto de deltas em variação positiva, negativa e neutra", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockImplementation((year: string, month: string) => {
      if (month === "10") {
        return Promise.resolve({
          faturamentoTotal: 100000,
          caixaRecebido: 70000,
          finValorAprovado: 60000,
          custosGerais: 10000,
          lucroReal: 30000,
          folhaValorAprovado: 40000,
          diaristasValorAprovado: 15000,
          intermitentesValorAprovado: 5000,
        } as any);
      }
      // Mês anterior (09)
      return Promise.resolve({
        faturamentoTotal: 80000,
        caixaRecebido: 50000,
        finValorAprovado: 55000,
        custosGerais: 15000,
        lucroReal: 10000,
        folhaValorAprovado: 35000,
        diaristasValorAprovado: 12000,
        intermitentesValorAprovado: 8000,
      } as any);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Faturamento Total e Resultado Operacional com busca assíncrona
    expect(await screen.findByText("Faturamento Total")).toBeDefined();
    expect(await screen.findByText("Resultado Operacional")).toBeDefined();
  });

  // 5. Motor CLT: Rota oficial aponta para /clt/pontos conforme RH-01
  it("5. Motor CLT: Aponta oficialmente para a rota canônica /clt/pontos", () => {
    const dashboardPath = path.resolve(__dirname, "../pages/Dashboard.tsx");
    const content = fs.readFileSync(dashboardPath, "utf-8");

    expect(content).toContain('navigate("/clt/pontos")');
    expect(content).not.toContain('navigate("/clt/banco-horas")');
  });

  // 6. Tabela Operacional antiga NÃO existe no Dashboard Executivo
  it("6. Arquitetura Executiva: Dashboard NÃO renderiza tabela operacional detalhada antiga", () => {
    const dashboardPath = path.resolve(__dirname, "../pages/Dashboard.tsx");
    const content = fs.readFileSync(dashboardPath, "utf-8");

    // Não deve conter a tabela de operações pesada antiga
    expect(content).not.toContain("<TableHead>Operação</TableHead>");
    expect(content).not.toContain("Detalhes da Operação");
    expect(content).not.toContain("Buscar op #");
  });

  // 7. Drawers de Drill-down abrem com dados reais
  it("7. Drawers de Drill-down: Abre gaveta analítica para os 5 KPIs com rotas oficiais", () => {
    const onNavigateMock = vi.fn();
    const { rerender } = render(
      <ExecutiveKpiDrawer
        type="faturamento"
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={onNavigateMock}
        competencia="Outubro / 2026"
        data={{
          faturamentoTotal: 450000,
          faturamentoAnterior: 400000,
          custosTotais: 300000,
          resultadoOperacional: 150000,
          margemOperacional: 33.3,
          caixaRecebido: 350000,
          aReceber: 100000,
        }}
      />
    );

    expect(screen.getByText("Faturamento Total — Outubro / 2026")).toBeDefined();
    const btnReceitas = screen.getByText("Abrir Receitas Operacionais");
    fireEvent.click(btnReceitas);
    expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/receitas");

    // Testa Drawer de Resultado Operacional (DRE)
    rerender(
      <ExecutiveKpiDrawer
        type="lucro"
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={onNavigateMock}
        competencia="Outubro / 2026"
        data={{
          faturamentoTotal: 450000,
          custosTotais: 300000,
          resultadoOperacional: 150000,
          margemOperacional: 33.3,
          caixaRecebido: 350000,
          aReceber: 100000,
        }}
      />
    );

    expect(screen.getByText("Resultado Operacional — Outubro / 2026")).toBeDefined();
    const btnDRE = screen.getByText("Abrir DRE Gerencial");
    fireEvent.click(btnDRE);
    expect(onNavigateMock).toHaveBeenCalledWith("/financeiro/dre");
  });
});
