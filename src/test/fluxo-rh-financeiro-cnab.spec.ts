import { beforeEach, describe, expect, it, vi } from "vitest";

type MockContext = {
  loteStatus?: string;
  loteItens?: Array<{ id: string }>;
  updatePayloads: any[];
  historicoAcoes: string[];
  rpcCalls: string[];
};

const ctx: MockContext = {
  loteStatus: "AGUARDANDO_FINANCEIRO",
  loteItens: [{ id: "item-1" }],
  updatePayloads: [],
  historicoAcoes: [],
  rpcCalls: [],
};

const resetCtx = () => {
  ctx.loteStatus = "AGUARDANDO_FINANCEIRO";
  ctx.loteItens = [{ id: "item-1" }];
  ctx.updatePayloads = [];
  ctx.historicoAcoes = [];
  ctx.rpcCalls = [];
};

const builder = (table: string) => {
  const state: any = { table, action: "select", updateData: null };

  const api: any = {
    select: () => {
      state.action = "select";
      return api;
    },
    update: (payload: any) => {
      state.action = "update";
      state.updateData = payload;
      return api;
    },
    insert: (payload: any) => {
      state.action = "insert";
      if (table === "rh_financeiro_lote_historico") {
        if (Array.isArray(payload)) {
          payload.forEach((p) => ctx.historicoAcoes.push(String(p.acao)));
        } else {
          ctx.historicoAcoes.push(String(payload.acao));
        }
      }
      return Promise.resolve({ data: payload, error: null });
    },
    eq: () => api,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => {
      if (state.action === "select" && table === "profiles") {
        return { data: { tenant_id: "tenant-1", full_name: "Tester" }, error: null };
      }
      if (state.action === "select" && table === "rh_financeiro_lotes") {
        return {
          data: {
            id: "lote-1",
            status: ctx.loteStatus,
            total_colaboradores: 3,
            valor_total: 1500,
            itens: ctx.loteItens,
          },
          error: null,
        };
      }
      if (state.action === "update" && table === "rh_financeiro_lotes") {
        ctx.updatePayloads.push(state.updateData);
        return { data: { id: "lote-1", ...state.updateData }, error: null };
      }
      return { data: null, error: null };
    },
    order: () => api,
    gte: () => api,
    lte: () => api,
    limit: () => api,
    then: (resolve: any, reject: any) => {
      try {
        if (state.action === "update" && table === "rh_financeiro_lotes") {
          ctx.updatePayloads.push(state.updateData);
          resolve({ data: null, error: null });
          return;
        }
        resolve({ data: null, error: null });
      } catch (err) {
        reject(err);
      }
    },
  };

  return api;
};

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "user@test.com" } } })),
      },
      from: vi.fn((table: string) => builder(table)),
      rpc: vi.fn(async (action: string) => {
        ctx.rpcCalls.push(action);
        return { data: null, error: null };
      }),
    },
  };
});

import { RHFinanceiroService } from "@/services/rhFinanceiro.service";

describe("Fluxo RH -> Financeiro -> CNAB-ready", () => {
  beforeEach(() => {
    resetCtx();
  });

  it("aprova no financeiro e envia para AGUARDANDO_PAGAMENTO", async () => {
    await RHFinanceiroService.aprovarFinanceiro("lote-1", "ok");

    expect(ctx.updatePayloads.length).toBe(1);
    expect(ctx.updatePayloads[0].status).toBe("AGUARDANDO_PAGAMENTO");
    expect(ctx.historicoAcoes).toContain("APROVOU_FINANCEIRO");
    expect(ctx.historicoAcoes).toContain("PREPAROU_CNAB");
    expect(ctx.rpcCalls).toContain("log_audit");
  });

  it("bloqueia devolucao sem motivo", async () => {
    await expect(RHFinanceiroService.devolverAoRH("lote-1", "")).rejects.toThrow(
      "O motivo da devolução é obrigatório."
    );
  });
});
