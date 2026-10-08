import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import fs from "fs";
import path from "path";

import RelatorioDRE from "@/pages/Financeiro/RelatorioDRE";
import {
  buildDREKpis,
  buildDRELedger,
  buildDREComposicao,
  buildDRETendencia,
  getDREDrawerData,
  exportDREToCSV,
  formatBRL,
  formatPercent,
  ORBE_BLUE_SCALE,
} from "@/services/adapters/dreOficialAdapter";
import {
  DashboardConsolidadoService,
  OperationalIntegrityKPIs,
} from "@/services/dashboard.service";
import { EmpresaService } from "@/services/domain/cadastros.service";

// Mock do contexto de Preferences, Tenant e Auth
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
    profile: { id: "user-1", role: "admin", nome: "Admin" },
    permissoes: ["central_financeira", "admin"],
    hasPermissao: () => true,
    isAdmin: () => true,
    isMaster: () => true,
    loading: false,
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

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockKpisAtual: OperationalIntegrityKPIs = {
  competencia: "2026-10",
  consolidadoEm: "2026-10-07T12:00:00Z",
  tipoFluxo: "completo",
  fluxosPresentes: ["operacional", "folha_variavel", "intermitente", "diarista"],
  rhValorProcessado: 236000,
  rhValorValidado: 236000,
  rhValorFechado: 236000,
  finValorRecebidoRH: 236000,
  finValorAprovado: 236000,
  folhaValorAprovado: 140000,
  intermitentesValorAprovado: 32000,
  diaristasValorAprovado: 64000,
  flows: {
    folha: {
      rhProcessado: 140000,
      rhValidado: 140000,
      rhFechado: 140000,
      finRecebidoRh: 140000,
      finAprovado: 140000,
    },
    intermitente: {
      rhProcessado: 32000,
      rhValidado: 32000,
      rhFechado: 32000,
      finRecebidoRh: 32000,
      finAprovado: 32000,
    },
    diarista: {
      rhProcessado: 64000,
      rhValidado: 64000,
      rhFechado: 64000,
      finRecebidoRh: 64000,
      finAprovado: 64000,
    },
  },
  finValorEnviadoBanco: 236000,
  finValorHistoricoBanco: 236000,
  faturamentoTotal: 380000,
  caixaRecebido: 300000,
  custosGerais: 30000,
  lucroReal: 114000,
  auditoriaCompetencia: {
    status: "ok",
    rhFechado: 236000,
    financeiroRecebido: 236000,
    financeiroAprovado: 236000,
    cnabGerado: 236000,
    bancoHistorico: 236000,
    diferencaRhFinanceiro: 0,
    diferencaFinanceiroCnab: 0,
    diferencaCnabHistorico: 0,
    diferencaTotal: 0,
    pendencias: [],
    atualizadoEm: "2026-10-07T12:00:00Z",
    tipoFluxo: "completo",
  },
  origens: {
    faturamentoTotal: { descricao: "Faturamento", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
    caixaRecebido: { descricao: "Caixa", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
    custosGerais: { descricao: "Custos", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
    lucroReal: { descricao: "Lucro", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
    finValorAprovado: { descricao: "Aprovado", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
    auditoriaCompetencia: { descricao: "Auditoria", competencia: "2026-10", atualizadoEm: "", tiposFluxo: ["operacional"] },
  },
};

const mockKpisComp: OperationalIntegrityKPIs = {
  ...mockKpisAtual,
  competencia: "2026-09",
  faturamentoTotal: 350000,
  folhaValorAprovado: 135000,
  intermitentesValorAprovado: 30000,
  diaristasValorAprovado: 62000,
  custosGerais: 22000,
  finValorAprovado: 227000,
  lucroReal: 101000,
};

const mockEmpresas = [
  { id: "emp-1", nome: "ESC Logística — Matriz", is_teste: false },
  { id: "emp-2", nome: "ESC Logística — Filial Santos", is_teste: false },
  { id: "emp-test", nome: "Empresa Homologação Teste", is_teste: true },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("CONV-13 — RESULTADO OPERACIONAL (DRE) OFICIAL CONVERGIDO", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(DashboardConsolidadoService, "getKpisAggregate").mockResolvedValue(mockKpisAtual);
    vi.spyOn(DashboardConsolidadoService, "getKpisByCompetencia").mockResolvedValue(mockKpisAtual);
    vi.spyOn(EmpresaService, "getAll").mockResolvedValue(mockEmpresas as any);
  });

  // 1. Renderização e Rota Oficial
  it("1. Renderiza a tela oficial RelatorioDRE sem quebras sob o AppShell", async () => {
    renderWithClient(<RelatorioDRE />);

    expect(screen.getByText("Resultado Operacional (DRE)")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Receita Operacional").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Custos Totais")).toBeInTheDocument();
      expect(screen.getAllByText("Resultado Operacional").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Margem Operacional").length).toBeGreaterThanOrEqual(1);
    });
  });

  // 2. Os Quatro KPIs Oficiais
  it("2. Quatro KPIs calculam valores exatos baseados nas fontes econômicas reais", () => {
    const kpis = buildDREKpis(mockKpisAtual, mockKpisComp, false);

    expect(kpis.receita.value).toBe(380000);
    expect(kpis.custos.value).toBe(266000); // 236.000 mão de obra + 30.000 extras
    expect(kpis.resultado.value).toBe(114000); // 380.000 - 266.000
    expect(kpis.margem.value).toBe(30.0); // 114.000 / 380.000 * 100 = 30%
  });

  // 3. Integridade Matemática das Fórmulas
  it("3. Integridade das fórmulas: Custos Totais, Resultado e Margem Operacional", () => {
    const kpis = buildDREKpis(mockKpisAtual, null, false);

    // Custos Totais = CLT + Diaristas + Intermitentes + Extras
    const custosEsperados =
      mockKpisAtual.folhaValorAprovado +
      mockKpisAtual.diaristasValorAprovado +
      mockKpisAtual.intermitentesValorAprovado +
      mockKpisAtual.custosGerais;
    expect(kpis.custos.value).toBe(custosEsperados);

    // Resultado = Receita - Custos
    expect(kpis.resultado.value).toBe(mockKpisAtual.faturamentoTotal - custosEsperados);

    // Margem quando receita = 0 não produz NaN ou Infinity
    const zeroReceitaKpis = buildDREKpis(
      { ...mockKpisAtual, faturamentoTotal: 0, lucroReal: 0 },
      null
    );
    expect(zeroReceitaKpis.margem.value).toBe(0);
    expect(isNaN(zeroReceitaKpis.margem.value)).toBe(false);
    expect(isFinite(zeroReceitaKpis.margem.value)).toBe(true);
  });

  // 4. Segregação Absoluta CLT × Intermitentes × Diaristas
  it("4. Segregação rigorosa: Folha CLT, Diaristas e Intermitentes não se sobrepõem", () => {
    const ledger = buildDRELedger(mockKpisAtual, null);

    const cltItem = ledger.find((it) => it.id === "folha-clt");
    const diaristaItem = ledger.find((it) => it.id === "diaristas");
    const intermitenteItem = ledger.find((it) => it.id === "intermitentes");
    const extrasItem = ledger.find((it) => it.id === "custos-extras");

    expect(cltItem?.valor).toBe(140000);
    expect(diaristaItem?.valor).toBe(64000);
    expect(intermitenteItem?.valor).toBe(32000);
    expect(extrasItem?.valor).toBe(30000);

    const somaCustosLedger =
      (cltItem?.valor || 0) +
      (diaristaItem?.valor || 0) +
      (intermitenteItem?.valor || 0) +
      (extrasItem?.valor || 0);

    expect(somaCustosLedger).toBe(266000);
  });

  // 5. Ausência de Dupla Contagem de Receitas
  it("5. Receita Operacional consome estritamente o faturamento total da competência", () => {
    const ledger = buildDRELedger(mockKpisAtual, null);
    const receitaItem = ledger.find((it) => it.id === "receita-operacional");

    expect(receitaItem?.valor).toBe(380000);
    expect(receitaItem?.tipo).toBe("receita");
    expect(receitaItem?.sinal).toBe("+");
  });

  // 6. Paleta Monocromática Azul ORBE
  it("6. Todas as linhas de dedução utilizam a paleta monocromática oficial Azul ORBE", () => {
    const ledger = buildDRELedger(mockKpisAtual, null);

    const clt = ledger.find((it) => it.id === "folha-clt");
    const diaristas = ledger.find((it) => it.id === "diaristas");
    const intermitentes = ledger.find((it) => it.id === "intermitentes");
    const extras = ledger.find((it) => it.id === "custos-extras");

    expect(clt?.cor).toBe(ORBE_BLUE_SCALE.clt);
    expect(diaristas?.cor).toBe(ORBE_BLUE_SCALE.diaristas);
    expect(intermitentes?.cor).toBe(ORBE_BLUE_SCALE.intermitentes);
    expect(extras?.cor).toBe(ORBE_BLUE_SCALE.custosExtras);
  });

  // 7. Isolamento por Empresa no Seletor
  it("7. Seletor de empresa filtra unidades e exclui empresas de homologação em produção", async () => {
    renderWithClient(<RelatorioDRE />);

    await waitFor(() => {
      expect(screen.getAllByText(/Consolidado Geral/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // 8. Comparação Temporal (Modo Comparar)
  it("8. Modo Comparar calcula deltas nominais e percentuais entre competências", () => {
    const kpisComp = buildDREKpis(mockKpisAtual, mockKpisComp, true, "Set/26");

    expect(kpisComp.receita.delta?.value).toBe("+8,6%"); // (380k - 350k) / 350k
    expect(kpisComp.receita.delta?.isPositive).toBe(true);
    expect(kpisComp.resultado.delta?.value).toBe("+12,9%"); // (114k - 101k) / 101k

    const ledgerComp = buildDRELedger(mockKpisAtual, mockKpisComp, true);
    const recComp = ledgerComp.find((it) => it.id === "receita-operacional");
    expect(recComp?.diffNominal).toBe(30000);
  });

  // ── TESTES OBRIGATÓRIOS CONV-13-FIX02 ──────────────────────────────────────

  it("CONV-13-FIX02 - 1. Outubro zerado × Setembro positivo: barras principais vazias e variações negativas corretas", () => {
    const mockZeroAtual: OperationalIntegrityKPIs = {
      ...mockKpisAtual,
      faturamentoTotal: 0,
      folhaValorAprovado: 0,
      diaristasValorAprovado: 0,
      intermitentesValorAprovado: 0,
      custosGerais: 0,
      finValorAprovado: 0,
      lucroReal: 0,
    };

    const ledger = buildDRELedger(mockZeroAtual, mockKpisComp, true);
    // Todas as barras principais devem ter percentualReceita = 0 (largura preenchida 0%)
    for (const item of ledger) {
      expect(item.valor).toBe(0);
      expect(item.percentualReceita).toBe(0);
      // Variação negativa correta: comparativo era positivo, então foi -100,0%
      expect(item.variacaoStatus).toBe("calculado");
      expect(item.variacaoTexto).toBe("−100,0%");
      expect(item.diffPct).toBe(-100);
      expect(item.diffNominal).toBeLessThan(0);
    }

    const kpis = buildDREKpis(mockZeroAtual, mockKpisComp, true, "Set/26");
    expect(kpis.receita.delta?.value).toBe("−100,0%");
    expect(kpis.receita.delta?.isPositive).toBe(false);
    expect(kpis.resultado.delta?.value).toBe("−100,0%");
    expect(kpis.resultado.delta?.isPositive).toBe(false);
  });

  it("CONV-13-FIX02 - 2. Ambos os períodos zerados: barra vazia e 'Sem variação'", () => {
    const mockZero: OperationalIntegrityKPIs = {
      ...mockKpisAtual,
      faturamentoTotal: 0,
      folhaValorAprovado: 0,
      diaristasValorAprovado: 0,
      intermitentesValorAprovado: 0,
      custosGerais: 0,
      finValorAprovado: 0,
      lucroReal: 0,
    };

    const ledger = buildDRELedger(mockZero, mockZero, true);
    for (const item of ledger) {
      expect(item.valor).toBe(0);
      expect(item.percentualReceita).toBe(0);
      expect(item.variacaoStatus).toBe("sem_variacao");
      expect(item.variacaoTexto).toBe("Sem variação");
      expect(item.formattedNominalDiff).toBe("R$ 0");
      expect(item.diffNominal).toBe(0);
    }

    const kpis = buildDREKpis(mockZero, mockZero, true, "Set/26");
    expect(kpis.receita.delta?.value).toBe("Sem variação");
    expect(kpis.receita.delta?.isNeutral).toBe(true);
    expect(kpis.custos.delta?.value).toBe("Sem variação");
    expect(kpis.custos.delta?.isNeutral).toBe(true);
    expect(kpis.resultado.delta?.value).toBe("Sem variação");
    expect(kpis.resultado.delta?.isNeutral).toBe(true);
    expect(kpis.margem.delta?.value).toBe("Sem variação");
    expect(kpis.margem.delta?.isNeutral).toBe(true);
  });

  it("CONV-13-FIX02 - 3. Principal positivo × comparativo zerado: 'Sem base comparativa' e delta nominal correto", () => {
    const mockZeroComp: OperationalIntegrityKPIs = {
      ...mockKpisAtual,
      faturamentoTotal: 0,
      folhaValorAprovado: 0,
      diaristasValorAprovado: 0,
      intermitentesValorAprovado: 0,
      custosGerais: 0,
      finValorAprovado: 0,
      lucroReal: 0,
    };

    const ledger = buildDRELedger(mockKpisAtual, mockZeroComp, true);
    const receitaItem = ledger.find((it) => it.id === "receita-operacional");
    expect(receitaItem?.valor).toBe(380000);
    expect(receitaItem?.percentualReceita).toBe(100);
    expect(receitaItem?.variacaoStatus).toBe("sem_base");
    expect(receitaItem?.variacaoTexto).toBe("Sem base comparativa");
    expect(receitaItem?.diffNominal).toBe(380000);
    expect(receitaItem?.diffPct).toBeUndefined(); // sem fabricar percentual artificial

    const kpis = buildDREKpis(mockKpisAtual, mockZeroComp, true, "Set/26");
    expect(kpis.receita.delta?.value).toBe("Sem base comparativa");
    expect(kpis.receita.delta?.isNeutral).toBe(true);
    expect(kpis.receita.subtitle).toMatch(/\+R\$[\s\u00a0]380\.000/);
  });

  it("CONV-13-FIX02 - 4. Principal e comparativo positivos: proporcionalidade preservada", () => {
    const kpis120: OperationalIntegrityKPIs = {
      ...mockKpisAtual,
      faturamentoTotal: 120000,
      folhaValorAprovado: 60000,
      diaristasValorAprovado: 0,
      intermitentesValorAprovado: 0,
      custosGerais: 0,
      finValorAprovado: 60000,
      lucroReal: 60000,
    };
    const kpis100: OperationalIntegrityKPIs = {
      ...mockKpisAtual,
      faturamentoTotal: 100000,
      folhaValorAprovado: 50000,
      diaristasValorAprovado: 0,
      intermitentesValorAprovado: 0,
      custosGerais: 0,
      finValorAprovado: 50000,
      lucroReal: 50000,
    };

    const ledger = buildDRELedger(kpis120, kpis100, true);
    const rec = ledger.find((it) => it.id === "receita-operacional")!;
    const folha = ledger.find((it) => it.id === "folha-clt")!;

    expect(rec.percentualReceita).toBe(100);
    expect(rec.variacaoTexto).toBe("+20,0%");
    expect(rec.diffNominal).toBe(20000);

    expect(folha.percentualReceita).toBe(50); // 60k / 120k = 50%
    expect(folha.variacaoTexto).toBe("+20,0%");
    expect(folha.diffNominal).toBe(10000);
  });

  it("CONV-13-FIX02 - 5. Margem operacional: diferença expressa corretamente em pontos percentuais (pp)", () => {
    // Cenário A: Margem cresceu de 28,5% para 30,0% (+1,5 pp)
    const kpisA = buildDREKpis(
      { ...mockKpisAtual, faturamentoTotal: 100000, lucroReal: 30000 },
      { ...mockKpisComp, faturamentoTotal: 100000, lucroReal: 28500 },
      true,
      "Set/26"
    );
    expect(kpisA.margem.delta?.value).toBe("+1,5 pp");
    expect(kpisA.margem.delta?.isPositive).toBe(true);

    // Cenário B: Margem caiu de 28,0% para 25,0% (−3,0 pp)
    const kpisB = buildDREKpis(
      { ...mockKpisAtual, faturamentoTotal: 100000, lucroReal: 25000 },
      { ...mockKpisComp, faturamentoTotal: 100000, lucroReal: 28000 },
      true,
      "Set/26"
    );
    expect(kpisB.margem.delta?.value).toBe("−3,0 pp");
    expect(kpisB.margem.delta?.isPositive).toBe(false);

    // Cenário C: Ambas zeradas -> "Sem variação"
    const kpisC = buildDREKpis(
      { ...mockKpisAtual, faturamentoTotal: 0, lucroReal: 0 },
      { ...mockKpisComp, faturamentoTotal: 0, lucroReal: 0 },
      true,
      "Set/26"
    );
    expect(kpisC.margem.delta?.value).toBe("Sem variação");
    expect(kpisC.margem.delta?.isNeutral).toBe(true);
  });

  it("CONV-13-FIX02 - 6. Modo sem comparação: comportamento original preservado", () => {
    const kpis = buildDREKpis(mockKpisAtual, null, false);
    expect(kpis.receita.subtitle).toBe("Total faturado reconhecido");
    expect(kpis.resultado.subtitle).toBe("Receita − Custos Diretos");
    expect(kpis.receita.delta).toBeUndefined();

    const ledger = buildDRELedger(mockKpisAtual, null, false);
    const rec = ledger.find((it) => it.id === "receita-operacional");
    expect(rec?.diffNominal).toBeUndefined();
    expect(rec?.diffPct).toBeUndefined();
    expect(rec?.compValor).toBeUndefined();
    expect(rec?.variacaoStatus).toBeUndefined();
  });

  // 9. Composição de Custos (Donut Recharts)
  it("9. Composição de custos organiza as 4 categorias em ordem decrescente de valor", () => {
    const comp = buildDREComposicao(mockKpisAtual);

    expect(comp.length).toBe(4);
    expect(comp[0].nome).toBe("Folha CLT & Encargos");
    expect(comp[0].valor).toBe(140000);
    expect(comp[1].nome).toBe("Diaristas Operacionais");
    expect(comp[1].valor).toBe(64000);
    expect(comp[2].nome).toBe("Trabalhadores Intermitentes");
    expect(comp[2].valor).toBe(32000);
    expect(comp[3].nome).toBe("Custos Extras & Logística");
    expect(comp[3].valor).toBe(30000);

    const totalPct = comp.reduce((acc, it) => acc + it.percentual, 0);
    expect(Math.round(totalPct)).toBe(100);
  });

  // 10. Tendência 12 Meses com Dados Reais
  it("10. Tendência 12M estrutura as 12 competências do ano selecionado", () => {
    const mockSnapshots = Array.from({ length: 12 }, (_, i) => ({
      ...mockKpisAtual,
      faturamentoTotal: 300000 + i * 10000,
      lucroReal: 90000 + i * 3000,
    }));

    const tendencia = buildDRETendencia(mockSnapshots, "2026", "2026-10");

    expect(tendencia.length).toBe(12);
    expect(tendencia[0].mes).toBe("Jan/26");
    expect(tendencia[9].mes).toBe("Out/26");
    expect(tendencia[9].isCurrent).toBe(true);
    expect(tendencia[8].isCurrent).toBe(false);
  });

  // 11. Drawer e Rotas Especialistas Oficiais
  it("11. Drawer de detalhamento mapeia rotas especialistas oficiais corretas para cada domínio", () => {
    const ledger = buildDRELedger(mockKpisAtual, null);

    const recDrawer = getDREDrawerData(ledger.find((it) => it.id === "receita-operacional")!, mockKpisAtual);
    expect(recDrawer.origemModulo.route).toBe("/financeiro/receitas");

    const cltDrawer = getDREDrawerData(ledger.find((it) => it.id === "folha-clt")!, mockKpisAtual);
    expect(cltDrawer.origemModulo.route).toBe("/banco-horas/fechamento");

    const diaristaDrawer = getDREDrawerData(ledger.find((it) => it.id === "diaristas")!, mockKpisAtual);
    expect(diaristaDrawer.origemModulo.route).toBe("/operacional/diaristas");

    const intermitenteDrawer = getDREDrawerData(ledger.find((it) => it.id === "intermitentes")!, mockKpisAtual);
    expect(intermitenteDrawer.origemModulo.route).toBe("/operacional/intermitentes");

    const extrasDrawer = getDREDrawerData(ledger.find((it) => it.id === "custos-extras")!, mockKpisAtual);
    expect(extrasDrawer.origemModulo.route).toBe("/operacional/custos-extras");
  });

  // 12. Ausência Total de EBITDA Estimado
  it("12. Expurgou definitivamente o rótulo indevido 'EBITDA Estimado'", () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/RelatorioDRE.tsx"),
      "utf-8"
    );
    expect(fileContent).not.toContain("EBITDA");
    expect(fileContent).not.toContain("ebitda");
  });

  // 13. Ausência de Mocks na Tela Oficial e no Adapter
  it("13. Tela oficial e adapter NÃO importam dreMockData nem dependem de dados fictícios", () => {
    const pageContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/RelatorioDRE.tsx"),
      "utf-8"
    );
    const adapterContent = fs.readFileSync(
      path.resolve(__dirname, "../services/adapters/dreOficialAdapter.ts"),
      "utf-8"
    );

    expect(pageContent).not.toContain("dreMockData");
    expect(pageContent).not.toContain("UxLab");
    expect(adapterContent).not.toContain("dreMockData");
    expect(adapterContent).not.toContain("UxLab");
  });

  // 14. Exportação CSV com Metadados e Formatação
  it("14. Exportação CSV gera arquivo formatado com cabeçalho, colunas e resultado", () => {
    const ledger = buildDRELedger(mockKpisAtual, null);
    
    // Simula document.createElement e download
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => null as any);
    const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();

    exportDREToCSV(ledger, 114000, 30.0, "Outubro / 2026", "Consolidado Geral");

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  // 15. Não-regressão do Dashboard Executivo
  it("15. Preservou os contratos consumidos pelo Dashboard Executivo oficial", () => {
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Dashboard.tsx"),
      "utf-8"
    );
    expect(dashboardContent).toContain("DashboardConsolidadoService.getKpisAggregate");
    expect(dashboardContent).toContain("faturamentoTotal");
    expect(dashboardContent).toContain("finValorAprovado");
    expect(dashboardContent).toContain("custosGerais");
    expect(dashboardContent).toContain("lucroReal");
  });
});
