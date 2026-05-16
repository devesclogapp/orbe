import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = {
  fetch: {
    status: string;
    status_rh: string;
    total_inconsistencias: number;
    status_remessa: string;
    tenant_id: string;
  };
  updates: any[];
  auditoriaInserts: any[];
};

const ctx: Ctx = {
  fetch: {
    status: "fechado",
    status_rh: "validado_rh",
    total_inconsistencias: 0,
    status_remessa: "nao_gerada",
    tenant_id: "tenant-1",
  },
  updates: [],
  auditoriaInserts: [],
};

const resetCtx = () => {
  ctx.fetch = {
    status: "fechado",
    status_rh: "validado_rh",
    total_inconsistencias: 0,
    status_remessa: "nao_gerada",
    tenant_id: "tenant-1",
  };
  ctx.updates = [];
  ctx.auditoriaInserts = [];
};

const qb = (table: string) => {
  const state: any = { action: "select", updateData: null, hasPendingUpdate: false };
  const api: any = {
    select: () => {
      state.action = "select";
      return api;
    },
    update: (payload: any) => {
      state.action = "update";
      state.updateData = payload;
      state.hasPendingUpdate = true;
      return api;
    },
    eq: () => api,
    insert: async (payload: any) => {
      if (table === "auditoria_workflow_ciclos") {
        ctx.auditoriaInserts.push(payload);
      }
      return { data: payload, error: null };
    },
    single: async () => {
      if (table === "ciclos_operacionais" && state.action === "select") {
        if (state.hasPendingUpdate) {
          ctx.updates.push(state.updateData);
          state.hasPendingUpdate = false;
          return { data: { id: "ciclo-1", ...state.updateData }, error: null };
        }
        return { data: { ...ctx.fetch }, error: null };
      }
      if (table === "ciclos_operacionais" && state.action === "update") {
        ctx.updates.push(state.updateData);
        return { data: { id: "ciclo-1", ...state.updateData }, error: null };
      }
      return { data: null, error: null };
    },
    then: (resolve: any, reject: any) => {
      try {
        if (table === "ciclos_operacionais" && state.action === "update") {
          ctx.updates.push(state.updateData);
          resolve({ data: null, error: null });
          return;
        }
        resolve({ data: null, error: null });
      } catch (e) {
        reject(e);
      }
    },
  };
  return api;
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => qb(table)),
  },
}));

import { CicloOperacionalService } from "@/services/operationalEngine/CicloOperacionalService";

describe("CicloOperacionalService.validarFinanceiro", () => {
  beforeEach(() => resetCtx());

  it("bloqueia quando ciclo nao esta fechado", async () => {
    ctx.fetch.status = "aberto";
    await expect(CicloOperacionalService.validarFinanceiro("ciclo-1", "user-1")).rejects.toThrow(/fechado operacionalmente/i);
  });

  it("bloqueia quando RH nao validou", async () => {
    ctx.fetch.status_rh = "pendente";
    await expect(CicloOperacionalService.validarFinanceiro("ciclo-1", "user-1")).rejects.toThrow(/validado pelo RH/i);
  });

  it("bloqueia quando ha inconsistencias", async () => {
    ctx.fetch.total_inconsistencias = 2;
    await expect(CicloOperacionalService.validarFinanceiro("ciclo-1", "user-1")).rejects.toThrow(/inconsist/i);
  });

  it("atualiza para enviado_financeiro e remessa pronta quando valido", async () => {
    await CicloOperacionalService.validarFinanceiro("ciclo-1", "user-1", "ok");

    expect(ctx.updates.length).toBeGreaterThan(0);
    const payload = ctx.updates[0];
    expect(payload.status_financeiro).toBe("validado_financeiro");
    expect(payload.status).toBe("enviado_financeiro");
    expect(payload.status_remessa).toBe("pronta");
    expect(ctx.auditoriaInserts.length).toBe(1);
    expect(ctx.auditoriaInserts[0].etapa).toBe("FINANCEIRO");
    expect(ctx.auditoriaInserts[0].acao).toBe("APROVAR");
  });
});
