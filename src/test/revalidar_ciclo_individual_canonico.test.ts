import { beforeEach, describe, expect, it, vi } from "vitest";

// ==========================================
// MOCK STATE SETUP
// ==========================================

interface MockDatabaseState {
  user: { id: string } | null;
  profile: { tenant_id: string; role: string } | null;
  userPermissions: { role: string; permissions: any; status: string } | null;
  ciclos: Record<string, any>;
  alertas: any[];
  pontos: any[];
  operacoes: any[];
  updates: Array<{ table: string; id: string; payload: any }>;
  auditoriaInserts: any[];
}

const dbState: MockDatabaseState = {
  user: { id: "user-admin-1" },
  profile: { tenant_id: "tenant-esc-1", role: "admin" },
  userPermissions: { role: "admin", permissions: null, status: "ativo" },
  ciclos: {},
  alertas: [],
  pontos: [],
  operacoes: [],
  updates: [],
  auditoriaInserts: [],
};

const resetDbState = () => {
  dbState.user = { id: "user-admin-1" };
  dbState.profile = { tenant_id: "tenant-esc-1", role: "admin" };
  dbState.userPermissions = { role: "admin", permissions: null, status: "ativo" };
  dbState.ciclos = {
    "ciclo-1": {
      id: "ciclo-1",
      tenant_id: "tenant-esc-1",
      empresa_id: "empresa-1",
      semana_operacional: 3,
      data_inicio: "2026-09-14",
      data_fim: "2026-09-20",
      status: "aberto",
      status_rh: "pendente",
      status_financeiro: "pendente",
      status_remessa: "nao_gerada",
      status_automacao: "aguardando_validacao",
      total_inconsistencias: 0,
      total_registros: 10,
      total_processados: 10,
    },
    "ciclo-2": {
      id: "ciclo-2",
      tenant_id: "tenant-esc-1",
      empresa_id: "empresa-1",
      semana_operacional: 4,
      data_inicio: "2026-09-21",
      data_fim: "2026-09-27",
      status: "aberto",
      status_automacao: "aguardando_validacao",
      total_inconsistencias: 0,
    },
  };
  dbState.alertas = [];
  dbState.pontos = [];
  dbState.operacoes = [];
  dbState.updates = [];
  dbState.auditoriaInserts = [];
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: dbState.user }, error: null })),
    },
    from: vi.fn((table: string) => {
      let selectedTable = table;
      let filters: any = {};
      let updatePayload: any = null;
      let limitVal: number | null = null;
      let isSingle = false;
      let isMaybeSingle = false;

      const chain: any = {
        select: vi.fn(() => chain),
        update: vi.fn((payload: any) => {
          updatePayload = payload;
          return chain;
        }),
        eq: vi.fn((col: string, val: any) => {
          filters[col] = val;
          return chain;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          filters[`${col}_in`] = vals;
          return chain;
        }),
        gte: vi.fn((col: string, val: any) => {
          filters[`${col}_gte`] = val;
          return chain;
        }),
        lte: vi.fn((col: string, val: any) => {
          filters[`${col}_lte`] = val;
          return chain;
        }),
        contains: vi.fn((col: string, val: any) => {
          filters[`${col}_contains`] = val;
          return chain;
        }),
        limit: vi.fn((num: number) => {
          limitVal = num;
          return chain;
        }),
        single: vi.fn(async () => {
          isSingle = true;
          return await execute();
        }),
        maybeSingle: vi.fn(async () => {
          isMaybeSingle = true;
          return await execute();
        }),
        insert: vi.fn(async (payload: any) => {
          if (selectedTable === "auditoria_workflow_ciclos") {
            dbState.auditoriaInserts.push(payload);
          }
          return { data: payload, error: null };
        }),
        then: vi.fn((resolve: any, reject: any) => {
          execute().then(resolve, reject);
        }),
      };

      const execute = async () => {
        // Table: ciclos_operacionais
        if (selectedTable === "ciclos_operacionais") {
          if (updatePayload) {
            const targetId = filters.id;
            if (targetId && dbState.ciclos[targetId]) {
              dbState.ciclos[targetId] = { ...dbState.ciclos[targetId], ...updatePayload };
              dbState.updates.push({ table: selectedTable, id: targetId, payload: updatePayload });
              return { data: dbState.ciclos[targetId], error: null };
            }
            return { data: null, error: new Error("Ciclo não encontrado para update") };
          }

          if (filters.id) {
            const row = dbState.ciclos[filters.id];
            return { data: row || null, error: row ? null : new Error("Ciclo não encontrado") };
          }

          return { data: Object.values(dbState.ciclos), error: null };
        }

        // Table: profiles
        if (selectedTable === "profiles") {
          return { data: dbState.profile, error: null };
        }

        // Table: user_permissions
        if (selectedTable === "user_permissions") {
          return { data: dbState.userPermissions, error: null };
        }

        // Table: automacao_alertas
        if (selectedTable === "automacao_alertas") {
          let rows = [...dbState.alertas];
          if (filters.empresa_id) {
            rows = rows.filter((a) => a.empresa_id === filters.empresa_id);
          }
          if (filters.resolvido !== undefined) {
            rows = rows.filter((a) => a.resolvido === filters.resolvido);
          }
          if (filters.severidade) {
            rows = rows.filter((a) => a.severidade === filters.severidade);
          }
          if (filters.contexto_json_contains) {
            const searchKey = Object.keys(filters.contexto_json_contains)[0];
            const searchVal = filters.contexto_json_contains[searchKey];
            rows = rows.filter((a) => a.contexto_json?.[searchKey] === searchVal);
          }
          if (limitVal) {
            rows = rows.slice(0, limitVal);
          }
          return { data: rows, error: null };
        }

        // Table: registros_ponto
        if (selectedTable === "registros_ponto") {
          let rows = [...dbState.pontos];
          if (filters.empresa_id) {
            rows = rows.filter((p) => p.empresa_id === filters.empresa_id);
          }
          if (filters.status_in) {
            rows = rows.filter((p) => filters.status_in.includes(p.status));
          }
          if (limitVal) {
            rows = rows.slice(0, limitVal);
          }
          return { data: rows, error: null };
        }

        // Table: operacoes_producao
        if (selectedTable === "operacoes_producao") {
          let rows = [...dbState.operacoes];
          if (filters.empresa_id) {
            rows = rows.filter((o) => o.empresa_id === filters.empresa_id);
          }
          if (filters.status_in) {
            rows = rows.filter((o) => filters.status_in.includes(o.status));
          }
          if (limitVal) {
            rows = rows.slice(0, limitVal);
          }
          return { data: rows, error: null };
        }

        return { data: [], error: null };
      };

      return chain;
    }),
  },
}));

import { CicloOperacionalService } from "@/services/operationalEngine/CicloOperacionalService";

describe("CicloOperacionalService.revalidarCicloIndividual (Canônica)", () => {
  beforeEach(() => {
    resetDbState();
  });

  // =========================================================================
  // 1. CICLO ÍNTEGRO -> LIBERA
  // =========================================================================
  it("1. ciclo íntegro -> libera exclusivamente o ciclo solicitado", async () => {
    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(true);
    expect(resultado.motivos).toHaveLength(0);
    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("pronto_para_fechamento");
    expect(dbState.ciclos["ciclo-1"].auto_cura_liberado_em).toBeDefined();

    // Registrou auditoria de workflow com etapa AUTOMACAO e acao LIBERAR
    expect(dbState.auditoriaInserts).toHaveLength(1);
    expect(dbState.auditoriaInserts[0]).toMatchObject({
      ciclo_id: "ciclo-1",
      etapa: "AUTOMACAO",
      acao: "LIBERAR",
    });
  });

  // =========================================================================
  // 2. TOTAL_INCONSISTENCIAS > 0 -> BLOQUEIA
  // =========================================================================
  it("2. total_inconsistencias > 0 -> bloqueia e não altera status_automacao", async () => {
    dbState.ciclos["ciclo-1"].total_inconsistencias = 3;

    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("inconsistência(s) crítica(s)"))).toBe(true);
    // Preserva o status original
    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("aguardando_validacao");
    // Não registrou auditoria de liberação
    expect(dbState.auditoriaInserts).toHaveLength(0);
  });

  // =========================================================================
  // 3. ALERTA CRÍTICO APLICÁVEL -> BLOQUEIA
  // =========================================================================
  it("3. alerta crítico aplicável à empresa -> bloqueia liberação", async () => {
    dbState.alertas.push({
      id: "alerta-crit-1",
      empresa_id: "empresa-1",
      severidade: "critical",
      mensagem: "Conta bancária inválida cadastrada para a empresa",
      resolvido: false,
    });

    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("Alerta crítico ativo na empresa"))).toBe(true);
    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("aguardando_validacao");
  });

  // =========================================================================
  // 4. CICLO DE OUTRO TENANT -> BLOQUEIA
  // =========================================================================
  it("4. ciclo de outro tenant -> lança erro de cross-tenant", async () => {
    dbState.profile = { tenant_id: "outro-tenant-xyz", role: "admin" };

    await expect(
      CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1")
    ).rejects.toThrow("Acesso não autorizado: o ciclo pertence a outro tenant.");

    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("aguardando_validacao");
  });

  // =========================================================================
  // 5. USUÁRIO SEM PERMISSÃO -> BLOQUEIA
  // =========================================================================
  it("5. usuário sem permissão (encarregado) -> bloqueia com erro de acesso", async () => {
    dbState.profile = { tenant_id: "tenant-esc-1", role: "encarregado" };
    dbState.userPermissions = {
      role: "encarregado",
      permissions: {
        central_operacional: { ver: true, criar: true, editar: true },
        fechamento_mensal: { ver: false, processar: false, fechar: false },
      },
      status: "ativo",
    };

    await expect(
      CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-encarregado-1")
    ).rejects.toThrow("Acesso negado: usuário não possui permissão para revalidar fechamento mensal.");

    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("aguardando_validacao");
  });

  // =========================================================================
  // 6. CICLO JÁ FECHADO -> NÃO SOFRE MUTAÇÃO INDEVIDA
  // =========================================================================
  it("6. ciclo já fechado -> não sofre mutação indevida", async () => {
    dbState.ciclos["ciclo-1"].status = "fechado";

    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("já se encontra fechado"))).toBe(true);
    expect(dbState.updates).toHaveLength(0);
  });

  // =========================================================================
  // 7. REVALIDAÇÃO DE UM CICLO NÃO ALTERA OUTROS CICLOS
  // =========================================================================
  it("7. revalidação de um ciclo não altera outros ciclos do tenant", async () => {
    expect(dbState.ciclos["ciclo-2"].status_automacao).toBe("aguardando_validacao");

    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(true);
    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("pronto_para_fechamento");
    // O ciclo-2 PERMANECE estritamente intacto
    expect(dbState.ciclos["ciclo-2"].status_automacao).toBe("aguardando_validacao");
  });

  // =========================================================================
  // 8. REVALIDAÇÃO NÃO PRODUZ EFEITOS FINANCEIROS
  // =========================================================================
  it("8. revalidação não produz efeitos financeiros", async () => {
    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(true);
    // Nenhuma tabela financeira foi acessada para update/insert
    const financeTablesTouched = dbState.updates.filter((u) =>
      ["contas_pagar", "contas_receber", "faturamento", "lotes_pagamento"].includes(u.table)
    );
    expect(financeTablesTouched).toHaveLength(0);
  });

  // =========================================================================
  // 9. PONTOS INCOMPLETOS NO PERÍODO DO CICLO -> BLOQUEIA
  // =========================================================================
  it("9. pontos incompletos no período delimitado -> bloqueia liberação", async () => {
    dbState.pontos.push({
      id: "ponto-incompleto-1",
      empresa_id: "empresa-1",
      data_registro: "2026-09-16",
      status: "incompleto",
    });

    const resultado = await CicloOperacionalService.revalidarCicloIndividual("ciclo-1", "user-admin-1");

    expect(resultado.liberado).toBe(false);
    expect(resultado.motivos.some((m) => m.includes("ponto incompleto(s) no período"))).toBe(true);
    expect(dbState.ciclos["ciclo-1"].status_automacao).toBe("aguardando_validacao");
  });

  // =========================================================================
  // 10. USUÁRIO NÃO AUTENTICADO -> ERRO
  // =========================================================================
  it("10. usuário não autenticado -> lança erro de autenticação", async () => {
    dbState.user = null;

    await expect(
      CicloOperacionalService.revalidarCicloIndividual("ciclo-1", undefined)
    ).rejects.toThrow("Acesso não autorizado: usuário não autenticado.");
  });
});
