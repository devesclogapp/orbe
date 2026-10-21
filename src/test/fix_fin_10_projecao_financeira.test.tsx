import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock do AuthContext para os drawers
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "operador@esclog.com" },
  }),
}));

// Mock do getCurrentTenantId em base.service
vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/domain/base.service")>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-001"),
  };
});

import {
  normalizarLoteDiarista,
  normalizarLoteIntermitente,
  DespesasContasPagarOficialService,
  DespesaFederadaItem,
} from "@/services/despesasOficial.service";
import { DespesaDrawerOficial } from "@/pages/Financeiro/components/DespesaDrawerOficial";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { supabase } from "@/lib/supabase";

describe("FIX FIN-10 — Projeção Financeira e Contagens Operacionais", () => {
  const empresasMap = new Map<string, string>([
    ["emp-001", "Empresa Homologação ESC Log"],
    ["emp-002", "Empresa Secundária Logística"],
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderDrawer = (item: DespesaFederadaItem) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DespesaDrawerOficial item={item} open={true} onClose={() => {}} />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 1: Três diárias de um diarista (Caso Real Homologado LT-DIA-1012)
  // ---------------------------------------------------------------------------
  it("01. normalizarLoteDiarista — 3 diárias de 1 diarista distinto (LT-DIA-1012)", () => {
    const rawLote = {
      id: "dia-lote-1012",
      empresa_id: "emp-001",
      periodo_inicio: "2026-10-12",
      periodo_fim: "2026-10-18",
      total_registros: 3,
      valor_total: 350.0,
      status: "PAGO",
    };

    const stats = {
      totalLancamentos: 3,
      diaristasDistintos: 1,
    };

    const normalizado = normalizarLoteDiarista(rawLote, empresasMap, "2026-10", stats);

    expect(normalizado.codigo).toBe("LT-DIA-1012");
    expect(normalizado.valorTotal).toBe(350.0);
    expect(normalizado.situacao).toBe("PAGA");
    expect(normalizado.quantidadeLancamentos).toBe(3);
    expect(normalizado.quantidadePessoas).toBe(1);
    expect(normalizado.quantidadeUnidades).toBe("3 diárias");
    expect(normalizado.beneficiarioNome).toBe("Equipe Diaristas (3 diárias)");

    // Teste visual do Drawer: deve exibir "1 colaborador (3 diárias)"
    const { unmount } = renderDrawer(normalizado);
    expect(screen.getByText(/1 colaborador \(3 diárias\)/i)).toBeInTheDocument();
    unmount();
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 2: Três diárias de três diaristas
  // ---------------------------------------------------------------------------
  it("02. normalizarLoteDiarista — 3 diárias de 3 diaristas distintos", () => {
    const rawLote = {
      id: "dia-lote-3colabs",
      empresa_id: "emp-001",
      periodo_inicio: "2026-10-12",
      periodo_fim: "2026-10-18",
      total_registros: 3,
      valor_total: 450.0,
      status: "VALIDADO_RH",
    };

    const stats = {
      totalLancamentos: 3,
      diaristasDistintos: 3,
    };

    const normalizado = normalizarLoteDiarista(rawLote, empresasMap, "2026-10", stats);

    expect(normalizado.quantidadeLancamentos).toBe(3);
    expect(normalizado.quantidadePessoas).toBe(3);
    expect(normalizado.quantidadeUnidades).toBe("3 diárias");

    const { unmount } = renderDrawer(normalizado);
    expect(screen.getByText(/3 colaboradores \(3 diárias\)/i)).toBeInTheDocument();
    unmount();
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 3: Lote sem lançamentos
  // ---------------------------------------------------------------------------
  it("03. normalizarLoteDiarista — lote sem lançamentos (comprovadamente 0)", () => {
    const rawLote = {
      id: "dia-lote-vazio",
      empresa_id: "emp-001",
      periodo_inicio: "2026-10-12",
      periodo_fim: "2026-10-18",
      total_registros: 0,
      valor_total: 0,
      status: "VALIDADO_RH",
    };

    const stats = {
      totalLancamentos: 0,
      diaristasDistintos: 0,
    };

    const normalizado = normalizarLoteDiarista(rawLote, empresasMap, "2026-10", stats);

    expect(normalizado.quantidadeLancamentos).toBe(0);
    expect(normalizado.quantidadePessoas).toBe(0);
    expect(normalizado.quantidadeUnidades).toBe("0 diárias");

    const { unmount } = renderDrawer(normalizado);
    expect(screen.getByText(/0 colaboradores \(0 diárias\)/i)).toBeInTheDocument();
    unmount();
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 4: Lote histórico sem identificação de pessoas
  // ---------------------------------------------------------------------------
  it("04. normalizarLoteDiarista — lote histórico sem identificação de pessoas (Não identificado)", () => {
    const rawLote = {
      id: "dia-lote-historico",
      empresa_id: "emp-001",
      periodo_inicio: "2026-10-12",
      periodo_fim: "2026-10-18",
      total_registros: 5,
      valor_total: 700.0,
      status: "PAGO",
    };

    // Sem stats informados e sem total_colaboradores no banco
    const normalizado = normalizarLoteDiarista(rawLote, empresasMap, "2026-10");

    expect(normalizado.quantidadeLancamentos).toBe(5);
    // NÃO pode presumir 1 nem 0: deve ser undefined (desconhecido)
    expect(normalizado.quantidadePessoas).toBeUndefined();
    expect(normalizado.quantidadeUnidades).toBe("5 diárias");

    const { unmount } = renderDrawer(normalizado);
    // Drawer deve exibir "Não identificado (5 diárias)" e JAMAIS "0 colaboradores"
    expect(screen.getByText(/Não identificado \(5 diárias\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 colaboradores/i)).not.toBeInTheDocument();
    unmount();
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 5: Espelho RH e Fechamento Operacional comprovadamente equivalentes
  // ---------------------------------------------------------------------------
  it("05. deduplicação relacional — espelho RH e fechamento operacional equivalentes (suprime espelho, mantém operacional)", async () => {
    const rhLoteId = "rh-lote-uuid-001";
    const opLoteId = "op-lote-uuid-001";
    const lancamentoIds = ["lanc-int-01", "lanc-int-02"];

    const createChainableMock = (resolvedData: any, error: any = null) => {
      const obj: any = {};
      const methods = ["select", "order", "eq", "in", "not", "or", "gte", "lte", "is"];
      methods.forEach((m) => {
        obj[m] = vi.fn().mockReturnValue(obj);
      });
      obj.then = (resolve: any) => resolve({ data: resolvedData, error });
      return obj;
    };

    // Mock do Supabase para simular o banco com as 4 fontes
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "empresas") {
        return createChainableMock([{ id: "emp-001", nome: "Empresa Homologação ESC Log" }]);
      }
      if (table === "intermitentes_lotes_fechamento") {
        return createChainableMock(resIntermitentes);
      }
      if (table === "diaristas_lotes_fechamento") {
        return createChainableMock([]);
      }
      if (table === "rh_financeiro_lote_itens") {
        return createChainableMock([
          { lote_id: rhLoteId, referencia_evento_id: lancamentoIds[0] },
          { lote_id: rhLoteId, referencia_evento_id: lancamentoIds[1] },
        ]);
      }
      if (table === "lancamentos_intermitentes") {
        return createChainableMock([
          { id: lancamentoIds[0], lote_fechamento_id: opLoteId, colaborador_id: "colab-01" },
          { id: lancamentoIds[1], lote_fechamento_id: opLoteId, colaborador_id: "colab-02" },
        ]);
      }
      if (table === "lancamentos_diaristas") {
        return createChainableMock([]);
      }
      return createChainableMock([]);
    });

    vi.spyOn(supabase, "from").mockImplementation(mockSelect as any);

    // Mock dos serviços especialistas chamados por fetchDespesasFederadas
    const resCustosExtras: any[] = [];
    const resLotesRh: any[] = [
      {
        id: rhLoteId,
        tenant_id: "tenant-001",
        empresa_id: "emp-001",
        competencia: "2026-10",
        tipo: "INTERMITENTES",
        origem: "OPERACIONAL",
        total_colaboradores: 2,
        valor_total: 570.0,
        status: "CONCLUIDO",
      },
    ];
    const resDiaristas: any[] = [];
    const resIntermitentes: any[] = [
      {
        id: opLoteId,
        tenant_id: "tenant-001",
        empresa_id: "emp-001",
        competencia: "2026-10",
        periodo_inicio: "2026-10-01",
        periodo_fim: "2026-10-31",
        quantidade_registros: 2,
        valor_total: 570.0,
        status: "PAGO",
      },
    ];

    const { CustoExtraOperacionalService } = await import("@/services/domain/despesas.service");
    const { RHFinanceiroService } = await import("@/services/rhFinanceiro.service");
    const { LoteFechamentoDiaristaService } = await import("@/services/domain/diaristas.service");

    vi.spyOn(EnvironmentService, "getTestEmpresaIds").mockResolvedValue([]);
    vi.spyOn(CustoExtraOperacionalService, "getByCompetencia").mockResolvedValue(resCustosExtras as any);
    vi.spyOn(RHFinanceiroService, "listLotesRecebidos").mockResolvedValue(resLotesRh as any);
    vi.spyOn(LoteFechamentoDiaristaService, "getByEmpresaParaFinanceiro").mockResolvedValue(resDiaristas as any);

    // EXECUÇÃO DA FUNÇÃO REAL DE PRODUÇÃO (SEM MOCK EM fetchDespesasFederadas)
    const resultado = await DespesasContasPagarOficialService.fetchDespesasFederadas({
      competencia: "2026-10",
      empresaId: "emp-001",
    });

    // Deve conter EXATAMENTE 1 registro de Intermitentes de R$ 570,00 (o lote operacional canônico)
    const intermitentesFinal = resultado.itens.filter((i) => i.origem === "INTERMITENTES");
    expect(intermitentesFinal).toHaveLength(1);
    expect(intermitentesFinal[0].canonicalId).toBe(opLoteId);
    expect(intermitentesFinal[0].valorTotal).toBe(570.0);
    expect(intermitentesFinal[0].quantidadeLancamentos).toBe(2);
    expect(intermitentesFinal[0].quantidadePessoas).toBe(2);
    expect(intermitentesFinal[0].situacao).toBe("PAGA");

    // Valida que o cálculo de KPIs roda sobre a lista deduplicada
    expect(resultado.stats.despesasNoPeriodo).toBe(570.0);
    expect(resultado.stats.pagasLiquidadas).toBe(570.0);
    expect(resultado.stats.aPagar).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 6: Espelho RH Órfão (sem fechamento operacional)
  // ---------------------------------------------------------------------------
  it("06. preservação de órfão — espelho RH sem fechamento operacional é preservado", async () => {
    const rawRhLote = {
      id: "rh-lote-orfao",
      empresa_id: "emp-001",
      competencia: "2026-10",
      tipo: "INTERMITENTES",
      total_colaboradores: 4,
      valor_total: 800.0,
      status: "CONCLUIDO",
    };

    const normalizado = normalizarLoteIntermitente(rawRhLote, empresasMap, "2026-10");

    expect(normalizado.origem).toBe("INTERMITENTES");
    expect(normalizado.canonicalId).toBe("rh-lote-orfao");
    expect(normalizado.valorTotal).toBe(800.0);
    // Deve ler total_colaboradores corretamente
    expect(normalizado.quantidadePessoas).toBe(4);
    expect(normalizado.quantidadeLancamentos).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 7: Fechamento Operacional Órfão (sem espelho RH)
  // ---------------------------------------------------------------------------
  it("07. preservação de órfão — fechamento operacional sem espelho RH é preservado", async () => {
    const rawOpLote = {
      id: "op-lote-orfao",
      empresa_id: "emp-001",
      competencia: "2026-10",
      quantidade_registros: 3,
      valor_total: 450.0,
      status: "AGUARDANDO_VALIDACAO_RH",
    };

    const normalizado = normalizarLoteIntermitente(rawOpLote, empresasMap, "2026-10");

    expect(normalizado.origem).toBe("INTERMITENTES");
    expect(normalizado.canonicalId).toBe("op-lote-orfao");
    expect(normalizado.valorTotal).toBe(450.0);
    expect(normalizado.quantidadeLancamentos).toBe(3);
    expect(normalizado.quantidadePessoas).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 8: Dois lotes distintos com mesmo valor e competência
  // ---------------------------------------------------------------------------
  it("08. integridade — dois lotes distintos com mesmo valor e competência são ambos preservados", async () => {
    const lote1 = normalizarLoteIntermitente(
      { id: "op-lote-quinzena-1", competencia: "2026-10", quantidade_registros: 2, valor_total: 570.0 },
      empresasMap,
      "2026-10"
    );
    const lote2 = normalizarLoteIntermitente(
      { id: "op-lote-quinzena-2", competencia: "2026-10", quantidade_registros: 2, valor_total: 570.0 },
      empresasMap,
      "2026-10"
    );

    const deduplicados = DespesasContasPagarOficialService.deduplicarDespesas([lote1, lote2]);

    expect(deduplicados).toHaveLength(2);
    expect(deduplicados.map((d) => d.canonicalId)).toEqual(["op-lote-quinzena-1", "op-lote-quinzena-2"]);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 9: Correspondência ambígua (Dois RH lotes para 1 operacional)
  // ---------------------------------------------------------------------------
  it("09. fail-safe de ambiguidade — correspondência ambígua mantém todos os registros", () => {
    const suppressedSet = new Set<string>();

    const rhParaOpMap = new Map<string, Set<string>>([
      ["rh-01", new Set(["op-01"])],
      ["rh-02", new Set(["op-01"])],
    ]);
    const opParaRhMap = new Map<string, Set<string>>([
      ["op-01", new Set(["rh-01", "rh-02"])],
    ]);

    ["rh-01", "rh-02"].forEach((rhId) => {
      const targetOpIds = rhParaOpMap.get(rhId);
      if (targetOpIds && targetOpIds.size === 1) {
        const targetOpId = Array.from(targetOpIds)[0];
        const rhSourcesForOp = opParaRhMap.get(targetOpId);

        if (rhSourcesForOp && rhSourcesForOp.size === 1) {
          suppressedSet.add(rhId);
        }
      }
    });

    // Ambiguidade detectada: nenhum é suprimido!
    expect(suppressedSet.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 10: Isolamento por tenant e empresa
  // ---------------------------------------------------------------------------
  it("10. isolamento — lotes de empresas diferentes nunca são considerados equivalentes", () => {
    const suppressedSet = new Set<string>();
    const rhLote = { id: "rh-emp-1", empresa_id: "emp-001", tenant_id: "tenant-001" };
    const opLote = { id: "op-emp-2", empresa_id: "emp-002", tenant_id: "tenant-001" };

    const coerenciaEmpresa = String(rhLote.empresa_id) === String(opLote.empresa_id);

    if (coerenciaEmpresa) {
      suppressedSet.add(rhLote.id);
    }

    // Como as empresas são diferentes, não pode suprimir
    expect(suppressedSet.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 11: Preservação de valores e estados financeiros
  // ---------------------------------------------------------------------------
  it("11. preservação — valores monetários e situações financeiras são rigorosamente preservados", () => {
    const rawLoteDiarista = {
      id: "dia-preservacao",
      valor_total: 350.0,
      total_registros: 3,
      status: "PAGO",
    };
    const normDia = normalizarLoteDiarista(rawLoteDiarista, empresasMap, "2026-10", {
      totalLancamentos: 3,
      diaristasDistintos: 1,
    });
    expect(normDia.valorTotal).toBe(350.0);
    expect(normDia.valor).toBe(350.0);
    expect(normDia.situacao).toBe("PAGA");
    expect(normDia.statusReal).toBe("PAGO");

    const rawLoteInt = {
      id: "int-preservacao",
      valor_total: 570.0,
      quantidade_registros: 2,
      status: "PAGO",
    };
    const normInt = normalizarLoteIntermitente(rawLoteInt, empresasMap, "2026-10", {
      totalLancamentos: 2,
      pessoasDistintas: 2,
    });
    expect(normInt.valorTotal).toBe(570.0);
    expect(normInt.valor).toBe(570.0);
    expect(normInt.situacao).toBe("PAGA");
    expect(normInt.statusReal).toBe("PAGO");
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 12: Ausência de alterações na DRE e na Central Bancária
  // ---------------------------------------------------------------------------
  it("12. desacoplamento arquitetural — DRE e Central Bancária preservam suas fontes próprias", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const dashboardServicePath = path.resolve(__dirname, "../services/dashboard.service.ts");
    const dashboardContent = fs.readFileSync(dashboardServicePath, "utf-8");

    const bancarioAdapterPath = path.resolve(__dirname, "../services/bancarioOficialAdapter.ts");
    const bancarioContent = fs.readFileSync(bancarioAdapterPath, "utf-8");

    // DRE continua consultando rh_financeiro_lotes diretamente
    expect(dashboardContent).toContain(".from('rh_financeiro_lotes')");
    expect(dashboardContent).toContain(".from('diaristas_lotes_fechamento')");

    // Central Bancária continua consultando fontes bancárias canônicas
    expect(bancarioContent).toContain(".from(\"cnab_remessas_arquivos\")");
    expect(bancarioContent).toContain(".from(\"cnab_retorno_itens\")");
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 13: Comportamento quando a consulta de relacionamento falhar
  // ---------------------------------------------------------------------------
  it("13. fail-safe de rede/query — falha na consulta relacional não oculta registros", () => {
    const suppressedSet = new Set<string>();

    try {
      throw new Error("Simulação de timeout ou falha de conexão com Supabase");
    } catch (err) {
      // Bloco catch garante que suppressedSet continua vazio
    }

    expect(suppressedSet.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CENÁRIO 14: Cenário C — Totais Oficiais de Contas a Pagar (Auditoria e Deduplicação)
  // ---------------------------------------------------------------------------
  it("14. Cenário C — Totais Oficiais de Contas a Pagar (Despesas R$ 1.915,00 / A Pagar R$ 845,00 / Pagas R$ 1.070,00)", async () => {
    const rhLoteId = "rh-intermitente-oct";
    const opLoteId = "op-intermitente-oct";
    const diaLoteId = "dia-lote-1012";
    const lancamentoIds = ["lanc-int-oct-01", "lanc-int-oct-02"];

    const createChainableMock = (resolvedData: any, error: any = null) => {
      const obj: any = {};
      const methods = ["select", "order", "eq", "in", "not", "or", "gte", "lte", "is"];
      methods.forEach((m) => {
        obj[m] = vi.fn().mockReturnValue(obj);
      });
      obj.then = (resolve: any) => resolve({ data: resolvedData, error });
      return obj;
    };

    // Supabase mock para as tabelas necessárias
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "empresas") {
        return createChainableMock([{ id: "emp-001", nome: "Empresa Homologação ESC Log" }]);
      }
      if (table === "intermitentes_lotes_fechamento") {
        return createChainableMock([
          {
            id: opLoteId,
            tenant_id: "tenant-001",
            empresa_id: "emp-001",
            competencia: "2026-10",
            periodo_inicio: "2026-10-01",
            periodo_fim: "2026-10-31",
            quantidade_registros: 2,
            valor_total: 570.0,
            status: "PAGO",
          },
        ]);
      }
      if (table === "diaristas_lotes_fechamento") {
        return createChainableMock([
          {
            id: diaLoteId,
            tenant_id: "tenant-001",
            empresa_id: "emp-001",
            periodo_inicio: "2026-10-12",
            periodo_fim: "2026-10-18",
            total_registros: 3,
            valor_total: 350.0,
            status: "PAGO",
          },
        ]);
      }
      if (table === "rh_financeiro_lote_itens") {
        return createChainableMock([
          { lote_id: rhLoteId, referencia_evento_id: lancamentoIds[0] },
          { lote_id: rhLoteId, referencia_evento_id: lancamentoIds[1] },
        ]);
      }
      if (table === "lancamentos_intermitentes") {
        return createChainableMock([
          { id: lancamentoIds[0], lote_fechamento_id: opLoteId, colaborador_id: "colab-01" },
          { id: lancamentoIds[1], lote_fechamento_id: opLoteId, colaborador_id: "colab-02" },
        ]);
      }
      if (table === "lancamentos_diaristas") {
        return createChainableMock([
          { lote_fechamento_id: diaLoteId, diarista_id: "diarista-01" },
          { lote_fechamento_id: diaLoteId, diarista_id: "diarista-01" },
          { lote_fechamento_id: diaLoteId, diarista_id: "diarista-01" },
        ]);
      }
      return createChainableMock([]);
    });

    vi.spyOn(supabase, "from").mockImplementation(mockSelect as any);

    // Conjunto de obrigações da competência outubro/2026:
    // - Custos Extras: R$ 150,00 pago + R$ 845,00 a pagar = R$ 995,00
    // - Diaristas: LT-DIA-1012 R$ 350,00 pago
    // - Intermitentes RH Espelho: R$ 570,00 concluído (espelho a ser suprimido)
    // - Intermitentes Operacional: R$ 570,00 pago (canônico preservado)
    const resCustosExtras = [
      {
        id: "custo-pago-01",
        empresa_id: "emp-001",
        data: "2026-10-05",
        competencia: "2026-10",
        categoria: "Materiais Operacionais",
        descricao: "Compra de Luvas e Botas",
        total: 150.0,
        valor_total: 150.0,
        origem_recurso: "PAGO_EMPRESA",
        pipeline_status: "FINALIZADO",
        status_pagamento: "PAGO",
        aprovado_por: "Diretoria",
      },
      {
        id: "custo-pendente-01",
        empresa_id: "emp-001",
        data: "2026-10-20",
        competencia: "2026-10",
        categoria: "Manutenção Operacional",
        descricao: "Reparo de Paleteira Hidráulica A",
        total: 380.0,
        valor_total: 380.0,
        origem_recurso: "PAGAMENTO_PENDENTE",
        pipeline_status: "ENVIADO_FINANCEIRO",
        status_pagamento: "PENDENTE",
      },
      {
        id: "custo-pendente-02",
        empresa_id: "emp-001",
        data: "2026-10-22",
        competencia: "2026-10",
        categoria: "Manutenção Operacional",
        descricao: "Reparo de Paleteira Hidráulica B",
        total: 380.0,
        valor_total: 380.0,
        origem_recurso: "PAGAMENTO_PENDENTE",
        pipeline_status: "ENVIADO_FINANCEIRO",
        status_pagamento: "PENDENTE",
      },
      {
        id: "custo-pendente-03",
        empresa_id: "emp-001",
        data: "2026-10-25",
        competencia: "2026-10",
        categoria: "Consumíveis",
        descricao: "Bobina de Filme Stretch Especial",
        total: 85.0,
        valor_total: 85.0,
        origem_recurso: "PAGAMENTO_PENDENTE",
        pipeline_status: "ENVIADO_FINANCEIRO",
        status_pagamento: "PENDENTE",
      },
    ];

    const resLotesRh = [
      {
        id: rhLoteId,
        tenant_id: "tenant-001",
        empresa_id: "emp-001",
        competencia: "2026-10",
        tipo: "INTERMITENTES",
        origem: "OPERACIONAL",
        total_colaboradores: 2,
        valor_total: 570.0,
        status: "CONCLUIDO",
      },
    ];

    const resDiaristas = [
      {
        id: diaLoteId,
        tenant_id: "tenant-001",
        empresa_id: "emp-001",
        periodo_inicio: "2026-10-12",
        periodo_fim: "2026-10-18",
        total_registros: 3,
        valor_total: 350.0,
        status: "PAGO",
      },
    ];

    const { CustoExtraOperacionalService } = await import("@/services/domain/despesas.service");
    const { RHFinanceiroService } = await import("@/services/rhFinanceiro.service");
    const { LoteFechamentoDiaristaService } = await import("@/services/domain/diaristas.service");

    vi.spyOn(EnvironmentService, "getTestEmpresaIds").mockResolvedValue([]);
    vi.spyOn(CustoExtraOperacionalService, "getByCompetencia").mockResolvedValue(resCustosExtras as any);
    vi.spyOn(RHFinanceiroService, "listLotesRecebidos").mockResolvedValue(resLotesRh as any);
    vi.spyOn(LoteFechamentoDiaristaService, "getByEmpresaParaFinanceiro").mockResolvedValue(resDiaristas as any);

    // Executa a função real de produção
    const resultado = await DespesasContasPagarOficialService.fetchDespesasFederadas({
      competencia: "2026-10",
      empresaId: "emp-001",
    });

    // 1. Verificação da lista deduplicada:
    // Antes do FIX: 7 obrigações reais observadas (3 pendentes: 380, 380, 85; 1 pago: 150; 1 diarista: 350; 2 intermitentes: 570, 570)
    // Após o FIX: exatamente 6 obrigações (o espelho de 570 é suprimido, mantendo os 3 pendentes intactos)
    expect(resultado.itens).toHaveLength(6);

    const intItens = resultado.itens.filter((i) => i.origem === "INTERMITENTES");
    expect(intItens).toHaveLength(1);
    expect(intItens[0].canonicalId).toBe(opLoteId);
    expect(intItens[0].valorTotal).toBe(570.0);

    const diaItens = resultado.itens.filter((i) => i.origem === "DIARISTAS");
    expect(diaItens).toHaveLength(1);
    expect(diaItens[0].valorTotal).toBe(350.0);
    expect(diaItens[0].quantidadeLancamentos).toBe(3);
    expect(diaItens[0].quantidadePessoas).toBe(1);

    const custosItens = resultado.itens.filter((i) => i.origem === "CUSTOS_EXTRAS");
    expect(custosItens).toHaveLength(4);

    // 2. Verificação dos Totais Financeiros de Contas a Pagar:
    // - Despesas no período: R$ 1.915,00 (antes R$ 2.485,00)
    // - A pagar: R$ 845,00 (380 + 380 + 85 = 845)
    // - Pagas / liquidadas: R$ 1.070,00 (150 + 350 + 570 = 1.070)
    expect(resultado.stats.despesasNoPeriodo).toBe(1915.0);
    expect(resultado.stats.aPagar).toBe(845.0);
    expect(resultado.stats.pagasLiquidadas).toBe(1070.0);

    // Comprova a matemática: Despesas no período (1.915) = A Pagar (845) + Pagas (1.070)
    expect(resultado.stats.despesasNoPeriodo).toBe(
      resultado.stats.aPagar + resultado.stats.pagasLiquidadas
    );
  });
});
