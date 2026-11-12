import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import { fetchAllSupabasePages } from "@/lib/supabasePagination";
import {
  ReceitasOficialService,
  calcularKpisReceitas,
} from "@/services/receitasOficial.service";
import { DashboardConsolidadoService } from "@/services/dashboard.service";
import {
  InadimplenciaOficialService,
  calcularKpisInadimplencia,
} from "@/services/inadimplenciaOficial.service";

function createPaginatedMockQuery(
  rows: any[],
  options?: {
    failOnRange?: (from: number, to: number) => any;
    onCall?: (calls: { filters: Array<{ op: string; args: any[] }>; orders: Array<{ col: string; opts: any }>; range?: [number, number] }) => void;
  },
) {
  const state: {
    filters: Array<{ op: string; args: any[] }>;
    orders: Array<{ col: string; opts: any }>;
    range?: [number, number];
  } = { filters: [], orders: [] };

  const chain: any = {};
  const filterMethods = ["select", "eq", "neq", "in", "not", "lt", "gte", "lte", "is", "or"];
  for (const m of filterMethods) {
    chain[m] = vi.fn((...args: any[]) => {
      state.filters.push({ op: m, args });
      return chain;
    });
  }
  chain.order = vi.fn((col: string, opts?: any) => {
    state.orders.push({ col, opts });
    return chain;
  });
  chain.range = vi.fn((from: number, to: number) => {
    state.range = [from, to];
    options?.onCall?.(state);
    if (options?.failOnRange) {
      const err = options.failOnRange(from, to);
      if (err) {
        return Promise.resolve({ data: null, error: err, status: 500 });
      }
    }
    return Promise.resolve({
      data: rows.slice(from, to + 1),
      error: null,
      status: 200,
    });
  });
  chain.then = (resolve: any) => {
    options?.onCall?.(state);
    return resolve({ data: rows, error: null, status: 200 });
  };
  return chain;
}

describe("FIX-GATE-ENTREGA-01 — Paginação Completa e Integridade Financeira", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      localStorage.setItem("esc-log-environment", "PRODUCAO");
    }
  });

  it("1. Consulta com menos de 1.000 registros retorna todos em 1 página", async () => {
    const rows = Array.from({ length: 350 }, (_, i) => ({
      id: `row-${String(i).padStart(4, "0")}`,
      valor_total: 100,
    }));

    const ranges: Array<[number, number]> = [];
    const result = await fetchAllSupabasePages(() =>
      createPaginatedMockQuery(rows, {
        onCall: (s) => {
          if (s.range) ranges.push(s.range);
        },
      }),
    );

    expect(result).toHaveLength(350);
    expect(ranges).toEqual([[0, 999]]);
  });

  it("2. Consulta com exatamente 1.000 registros verifica página seguinte e retorna todos sem perda", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: `row-${String(i).padStart(4, "0")}`,
      valor_total: 50,
    }));

    const ranges: Array<[number, number]> = [];
    const result = await fetchAllSupabasePages(() =>
      createPaginatedMockQuery(rows, {
        onCall: (s) => {
          if (s.range) ranges.push(s.range);
        },
      }),
    );

    expect(result).toHaveLength(1000);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("3. Consulta com mais de 1.000 registros (2.350 linhas) pagina integralmente e preserva totais em ReceitasOficialService", async () => {
    const totalRows = 2350;
    const receitasRows = Array.from({ length: totalRows }, (_, i) => ({
      id: `rec-${String(i).padStart(4, "0")}`,
      tenant_id: "tenant-1",
      empresa_id: "emp-prod-1",
      empresas: { id: "emp-prod-1", nome: "Empresa Prod" },
      modalidade: "CAIXA_IMEDIATO",
      competencia: `2026-${String((i % 12) + 1).padStart(2, "0")}`,
      created_at: "2026-06-15T12:00:00Z", // Datas iguais para validar ordenação determinística
      vencimento: "2026-06-20",
      valor_total: 100,
      status: i % 2 === 0 ? "recebido" : "pendente_recebimento",
      receitas_operacionais_itens: [],
    }));

    const capturedOrders: Array<Array<{ col: string; opts: any }>> = [];
    const capturedFilters: Array<Array<{ op: string; args: any[] }>> = [];

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "empresas") {
        return createPaginatedMockQuery([{ id: "emp-test-1" }]);
      }
      if (table === "receitas_operacionais") {
        return createPaginatedMockQuery(receitasRows, {
          onCall: (s) => {
            capturedOrders.push(s.orders);
            capturedFilters.push(s.filters);
          },
        });
      }
      return createPaginatedMockQuery([]);
    });

    const result = await ReceitasOficialService.getReceitasContextuais(
      "tenant-1",
      "emp-prod-1",
      "2026-all",
    );

    expect(result).toHaveLength(2350);
    expect(new Set(result.map((r) => r.id)).size).toBe(2350);

    // Ordenação determinística com desempate por id
    expect(capturedOrders[0]).toEqual([
      { col: "created_at", opts: { ascending: false } },
      { col: "id", opts: { ascending: false } },
    ]);

    // Preservação de filtros de tenant e empresa
    expect(capturedFilters[0]).toEqual(
      expect.arrayContaining([
        { op: "eq", args: ["tenant_id", "tenant-1"] },
        { op: "eq", args: ["empresa_id", "emp-prod-1"] },
      ]),
    );

    // Integridade exata dos KPIs sobre > 1.000 linhas
    const kpis = calcularKpisReceitas(result);
    expect(kpis.totalReconhecido).toBe(235000);
    expect(kpis.recebido).toBe(117500);
    expect(kpis.aReceber).toBe(117500);
  });

  it("4. Paginação sem duplicação mesmo se página retornar registro sobreposto", async () => {
    const page0 = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}`, val: 1 }));
    // Simula sobreposição do último item da página 0 no início da página 1
    const page1 = [{ id: "id-999", val: 1 }, { id: "id-1000", val: 1 }];

    let call = 0;
    const result = await fetchAllSupabasePages(() => ({
      range: vi.fn(() => {
        const data = call === 0 ? page0 : page1;
        call++;
        return Promise.resolve({ data, error: null });
      }),
    }));

    expect(result).toHaveLength(1001);
    expect(new Set(result.map((r: any) => r.id)).size).toBe(1001);
  });

  it("5. Falha em página intermediária (página 2) lança erro e nunca retorna dados parciais", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      id: `rec-${i}`,
      tenant_id: "tenant-1",
      empresa_id: "emp-prod-1",
      empresas: { id: "emp-prod-1", nome: "Empresa Prod" },
      modalidade: "FATURAMENTO_MENSAL",
      competencia: "2026-09",
      created_at: "2026-09-10T10:00:00Z",
      vencimento: "2026-09-30",
      valor_total: 200,
      status: "pendente_recebimento",
      receitas_operacionais_itens: [],
    }));

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "empresas") return createPaginatedMockQuery([]);
      if (table === "receitas_operacionais") {
        return createPaginatedMockQuery(rows, {
          failOnRange: (from) => (from >= 1000 ? new Error("Timeout na página 2") : null),
        });
      }
      return createPaginatedMockQuery([]);
    });

    await expect(
      ReceitasOficialService.getReceitasContextuais("tenant-1", "all", "2026-09"),
    ).rejects.toThrow("Timeout na página 2");
  });

  it("6. Bloqueio de ambiente em ReceitasOficialService impede empresa de teste em PRODUCAO", async () => {
    localStorage.setItem("esc-log-environment", "PRODUCAO");
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "empresas") return createPaginatedMockQuery([{ id: "emp-teste-99" }]);
      throw new Error("Não deveria consultar receitas_operacionais para empresa incompatível");
    });

    const result = await ReceitasOficialService.getReceitasContextuais(
      "tenant-1",
      "emp-teste-99",
      "2026-all",
    );
    expect(result).toEqual([]);
  });

  it("7. Dashboard qRetornoItens filtra por competência na origem e pagina > 1.000 itens sem perda de total", async () => {
    const retornoRows = Array.from({ length: 1250 }, (_, i) => ({
      id: `ret-${String(i).padStart(4, "0")}`,
      valor_retornado: 10,
      status: "pago",
      created_at: "2026-09-20T10:00:00Z",
      remessa_arquivo: { competencia: "2026-09" },
    }));

    const retornoFilters: Array<Array<{ op: string; args: any[] }>> = [];
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "cnab_retorno_itens") {
        return createPaginatedMockQuery(retornoRows, {
          onCall: (s) => retornoFilters.push(s.filters),
        });
      }
      return createPaginatedMockQuery([]);
    });

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia("2026-09");
    expect(kpis.finValorHistoricoBanco).toBe(12500);
    expect(retornoFilters[0]).toEqual(
      expect.arrayContaining([{ op: "eq", args: ["remessa_arquivo.competencia", "2026-09"] }]),
    );
  });

  it("8. InadimplenciaOficialService pagina > 1.000 títulos vencidos preservando soma financeira", async () => {
    const overdueRows = Array.from({ length: 1150 }, (_, i) => ({
      id: `inad-${String(i).padStart(4, "0")}`,
      empresa_id: "emp-1",
      empresas: { id: "emp-1", nome: "Cliente 1" },
      modalidade: "DUPLICATA",
      competencia: "2026-08",
      vencimento: "2026-08-15",
      valor_total: 100,
      status: "pendente_recebimento",
      receitas_operacionais_itens: [],
    }));

    vi.spyOn(supabase, "auth", "get").mockReturnValue({
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }),
    } as any);

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "perfis" || table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { tenant_id: "11111111-1111-1111-1111-111111111111" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { tenant_id: "11111111-1111-1111-1111-111111111111" }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === "empresas") return createPaginatedMockQuery([]);
      if (table === "receitas_operacionais") return createPaginatedMockQuery(overdueRows);
      return createPaginatedMockQuery([]);
    });

    const titulos = await InadimplenciaOficialService.getTitulosInadimplentesContextuais("all", "2026-09-01");
    expect(titulos).toHaveLength(1150);
    const kpis = calcularKpisInadimplencia(titulos, "2026-09-01");
    expect(kpis.quantidadeTotal).toBe(1150);
    expect(kpis.totalInadimplente).toBe(115000);
  });
});
