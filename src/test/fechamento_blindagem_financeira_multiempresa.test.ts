import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

// Contexto compartilhado para os testes do Service
type MockCustoExtra = {
  id: string;
  empresa_id: string;
  data: string;
  pipeline_status: string;
  status_pagamento: string;
  deleted_at?: string | null;
  tenant_id?: string;
};

type TestCtx = {
  ciclo: {
    id: string;
    tenant_id: string;
    empresa_id: string;
    competencia: string;
    data_inicio: string;
    data_fim: string;
    status: string;
    status_rh: string;
    status_financeiro: string;
    status_remessa: string;
    total_inconsistencias: number;
  };
  custosExtras: MockCustoExtra[];
  updates: any[];
  auditoriaInserts: any[];
  motorFinanceiroChamadas: any[];
};

const ctx: TestCtx = {
  ciclo: {
    id: "ciclo-sem-3",
    tenant_id: "tenant-1",
    empresa_id: "emp-benevides",
    competencia: "2026-09",
    data_inicio: "2026-09-14",
    data_fim: "2026-09-20",
    status: "fechado",
    status_rh: "validado_rh",
    status_financeiro: "pendente",
    status_remessa: "nao_gerada",
    total_inconsistencias: 0,
  },
  custosExtras: [],
  updates: [],
  auditoriaInserts: [],
  motorFinanceiroChamadas: [],
};

const resetCtx = () => {
  ctx.ciclo = {
    id: "ciclo-sem-3",
    tenant_id: "tenant-1",
    empresa_id: "emp-benevides",
    competencia: "2026-09",
    data_inicio: "2026-09-14",
    data_fim: "2026-09-20",
    status: "fechado",
    status_rh: "validado_rh",
    status_financeiro: "pendente",
    status_remessa: "nao_gerada",
    total_inconsistencias: 0,
  };
  ctx.custosExtras = [];
  ctx.updates = [];
  ctx.auditoriaInserts = [];
  ctx.motorFinanceiroChamadas = [];
};

// Mock do supabase query builder
const qb = (table: string) => {
  let action = "select";
  let updateData: any = null;
  let hasPendingUpdate = false;
  const filters: { [key: string]: any } = {};
  let gteFilter: { field: string; val: any } | null = null;
  let lteFilter: { field: string; val: any } | null = null;
  let inFilter: { field: string; vals: any[] } | null = null;
  let isFilter: { field: string; val: any } | null = null;

  const api: any = {
    select: () => {
      action = "select";
      return api;
    },
    update: (payload: any) => {
      action = "update";
      updateData = payload;
      hasPendingUpdate = true;
      return api;
    },
    eq: (field: string, val: any) => {
      filters[field] = val;
      return api;
    },
    gte: (field: string, val: any) => {
      gteFilter = { field, val };
      return api;
    },
    lte: (field: string, val: any) => {
      lteFilter = { field, val };
      return api;
    },
    in: (field: string, vals: any[]) => {
      inFilter = { field, vals };
      return api;
    },
    is: (field: string, val: any) => {
      isFilter = { field, val };
      return api;
    },
    insert: async (payload: any) => {
      if (table === "auditoria_workflow_ciclos") {
        ctx.auditoriaInserts.push(payload);
      }
      return { data: payload, error: null };
    },
    single: async () => {
      if (table === "ciclos_operacionais") {
        if (hasPendingUpdate || action === "update") {
          ctx.updates.push(updateData);
          Object.assign(ctx.ciclo, updateData);
          hasPendingUpdate = false;
          return { data: { ...ctx.ciclo }, error: null };
        }
        return { data: { ...ctx.ciclo }, error: null };
      }
      return { data: null, error: null };
    },
    then: (resolve: any, reject: any) => {
      try {
        if (table === "custos_extras_operacionais") {
          let items = [...ctx.custosExtras];

          if (filters.empresa_id) {
            items = items.filter((c) => c.empresa_id === filters.empresa_id);
          }
          if (filters.tenant_id) {
            items = items.filter((c) => !c.tenant_id || c.tenant_id === filters.tenant_id);
          }
          if (gteFilter) {
            items = items.filter((c) => (c as any)[gteFilter!.field] >= gteFilter!.val);
          }
          if (lteFilter) {
            items = items.filter((c) => (c as any)[lteFilter!.field] <= lteFilter!.val);
          }
          if (isFilter) {
            items = items.filter((c) => (c as any)[isFilter!.field] === isFilter!.val);
          }
          if (inFilter) {
            items = items.filter((c) => inFilter!.vals.includes((c as any)[inFilter!.field]));
          }

          resolve({ data: items, error: null });
          return;
        }

        if (table === "ciclos_operacionais" && (hasPendingUpdate || action === "update")) {
          ctx.updates.push(updateData);
          Object.assign(ctx.ciclo, updateData);
          hasPendingUpdate = false;
          resolve({ data: { ...ctx.ciclo }, error: null });
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

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => qb(table)),
  },
}));

vi.mock("@/services/operationalEngine/MotorFinanceiro", () => ({
  MotorFinanceiro: {
    processarFechamento: vi.fn(async (comp: string, empId: string, tenantId: string) => {
      ctx.motorFinanceiroChamadas.push({ comp, empId, tenantId });
      return { success: true };
    }),
  },
}));

import { CicloOperacionalService } from "@/services/operationalEngine/CicloOperacionalService";

describe("FECHAMENTO MULTIEMPRESA + BLINDAGEM FINANCEIRA (12 CENÁRIOS)", () => {
  beforeEach(() => {
    resetCtx();
  });

  // -------------------------------------------------------------
  // CENÁRIOS 1 A 9: BLINDAGEM NO SERVICE (validarFinanceiro)
  // -------------------------------------------------------------

  it("1. RECEBIDO dentro do período → validarFinanceiro bloqueia", async () => {
    ctx.custosExtras = [
      {
        id: "c-rec",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "RECEBIDO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    await expect(
      CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin")
    ).rejects.toThrow(/não é possível aprovar no financeiro: existe\(m\) 1 custo\(s\) extra\(s\) pendente\(s\)/i);

    expect(ctx.updates.length).toBe(0);
    expect(ctx.motorFinanceiroChamadas.length).toBe(0);
  });

  it("2. EM_VALIDACAO dentro do período → validarFinanceiro bloqueia", async () => {
    // Cenário idêntico ao Custo Extra de R$ 60,00 da BENEVIDES (17/09/2026)
    ctx.custosExtras = [
      {
        id: "dcba0376-4743-4d04-bc84-b7f65cec41ae",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "EM_VALIDACAO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    await expect(
      CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin")
    ).rejects.toThrow(/custo\(s\) extra\(s\) pendente\(s\) de validação operacional neste período/i);

    expect(ctx.updates.length).toBe(0);
    expect(ctx.motorFinanceiroChamadas.length).toBe(0);
  });

  it("3. APROVADO_OPERACAO + A_PAGAR → validarFinanceiro permite", async () => {
    ctx.custosExtras = [
      {
        id: "c-aprov",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "APROVADO_OPERACAO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin", "Aprovado com sucesso");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(res.status).toBe("enviado_financeiro");
    expect(ctx.updates.length).toBe(1);
    expect(ctx.updates[0].status_financeiro).toBe("validado_financeiro");
  });

  it("4. ENVIADO_FINANCEIRO + A_PAGAR → validarFinanceiro permite", async () => {
    ctx.custosExtras = [
      {
        id: "c-env-fin",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-18",
        pipeline_status: "ENVIADO_FINANCEIRO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(ctx.updates.length).toBe(1);
  });

  it("5. FINALIZADO + PAGO → permite", async () => {
    ctx.custosExtras = [
      {
        id: "c-pago-1",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "FINALIZADO",
        status_pagamento: "PAGO",
        deleted_at: null,
      },
      {
        id: "c-pago-2",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-18",
        pipeline_status: "FINALIZADO",
        status_pagamento: "PAGO",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(ctx.updates.length).toBe(1);
  });

  it("6. Custo de outra empresa → não bloqueia", async () => {
    // Custo em EM_VALIDACAO, porém da "emp-outra"
    ctx.custosExtras = [
      {
        id: "c-outra-empresa",
        empresa_id: "emp-outra-teste",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "EM_VALIDACAO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(ctx.updates.length).toBe(1);
  });

  it("7. Custo fora do período da semana → não bloqueia", async () => {
    // Custo em EM_VALIDACAO da BENEVIDES, mas do dia 21/09 (Semana 4)
    ctx.custosExtras = [
      {
        id: "c-fora-semana",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-21",
        pipeline_status: "EM_VALIDACAO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
      {
        id: "c-antes-semana",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-10",
        pipeline_status: "RECEBIDO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(ctx.updates.length).toBe(1);
  });

  it("8. Custo cancelado → não bloqueia", async () => {
    ctx.custosExtras = [
      {
        id: "c-cancelado",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "EM_VALIDACAO",
        status_pagamento: "CANCELADO",
        deleted_at: null,
      },
    ];

    const res = await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");

    expect(res.status_financeiro).toBe("validado_financeiro");
    expect(ctx.updates.length).toBe(1);
  });

  it("9. Tentativa bloqueada → NÃO altera: status, status_financeiro, status_remessa, financeiro, remessas", async () => {
    ctx.custosExtras = [
      {
        id: "c-bloqueador",
        empresa_id: "emp-benevides",
        tenant_id: "tenant-1",
        data: "2026-09-17",
        pipeline_status: "EM_VALIDACAO",
        status_pagamento: "A_PAGAR",
        deleted_at: null,
      },
    ];

    // Salva o estado original do ciclo
    const estadoOriginal = { ...ctx.ciclo };

    try {
      await CicloOperacionalService.validarFinanceiro("ciclo-sem-3", "user-admin");
      expect.fail("Deveria ter lançado erro de bloqueio");
    } catch (err: any) {
      expect(err.message).toContain("custo(s) extra(s) pendente(s)");
    }

    // Garante que absolutamente nenhum estado foi alterado
    expect(ctx.ciclo.status).toBe(estadoOriginal.status);
    expect(ctx.ciclo.status_financeiro).toBe(estadoOriginal.status_financeiro);
    expect(ctx.ciclo.status_remessa).toBe(estadoOriginal.status_remessa);
    expect(ctx.updates).toHaveLength(0);
    expect(ctx.motorFinanceiroChamadas).toHaveLength(0);
    expect(ctx.auditoriaInserts).toHaveLength(0);
  });

  // -------------------------------------------------------------
  // CENÁRIOS 10 A 12: TELA /fechamento (MULTIEMPRESA E VISUAL)
  // -------------------------------------------------------------

  describe("Inspeção de Contrato da Tela /fechamento", () => {
    const fechamentoPath = path.resolve(__dirname, "../pages/Fechamento.tsx");
    const fechamentoContent = fs.readFileSync(fechamentoPath, "utf-8");

    it("10. Tela /fechamento: possui seletor de empresa e filtra ciclos da empresa selecionada", () => {
      // Verifica presença de seletor de empresa
      expect(fechamentoContent).toContain("<Select");
      expect(fechamentoContent).toContain("selectedEmpresaId");
      expect(fechamentoContent).toContain("effectiveEmpresaId");
      // Verifica que getCiclosDaCompetencia recebe effectiveEmpresaId
      expect(fechamentoContent).toContain("CicloOperacionalService.getCiclosDaCompetencia(tenantId, currentMonth, effectiveEmpresaId)");
      // Verifica busca de empresas do tenant ordenada por nome
      expect(fechamentoContent).toContain(".from('empresas')");
      expect(fechamentoContent).toContain(".order('nome', { ascending: true })");
    });

    it("11. Cada card mostra explicitamente a empresa com identificação visual", () => {
      // Verifica presença de ícone Building2 e nome da empresa no card
      expect(fechamentoContent).toContain("<Building2");
      expect(fechamentoContent).toContain("empresaNomeMap.get(c.empresa_id || '')");
      expect(fechamentoContent).toContain("Semana {c.semana_operacional}");
    });

    it("12. Trocar de empresa altera o contexto e consulta exclusivamente os ciclos e custos dela", () => {
      // Verifica que onValueChange atualiza setSelectedEmpresaId
      expect(fechamentoContent).toContain("onValueChange={(val) => setSelectedEmpresaId(val)}");
      // Verifica queryKeys parametrizadas com effectiveEmpresaId
      expect(fechamentoContent).toContain('queryKey: ["ciclos_operacionais", currentMonth, effectiveEmpresaId]');
      expect(fechamentoContent).toContain('queryKey: ["custos_extras_fechamento", currentMonth, effectiveEmpresaId]');
      expect(fechamentoContent).toContain('queryKey: ["servicos_extras_fechamento", currentMonth, effectiveEmpresaId]');
      // Verifica que a query de custos extras filtra por empresa_id
      expect(fechamentoContent).toContain('query.eq("empresa_id", effectiveEmpresaId)');
    });
  });
});
