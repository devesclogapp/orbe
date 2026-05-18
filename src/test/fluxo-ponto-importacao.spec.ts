import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mocks & context for the pre-cadastro import pipeline.
 * Validates: empresa auto-creation, collaborator pre-cadastro,
 * deduplication, and correct counters in the result.
 */

type MockRow = {
  id: string;
  tenant_id: string;
  nome: string;
  cpf?: string;
};

type MockEmpresa = { id: string; nome: string };

type InsertedRecord = {
  table: string;
  payload: any;
};

const ctx = {
  existingEmpresas: [] as MockEmpresa[],
  existingColaboradores: [] as MockRow[],
  insertedRecords: [] as InsertedRecord[],
  profile: { tenant_id: "tenant-1" },
};

const resetCtx = () => {
  ctx.existingEmpresas = [];
  ctx.existingColaboradores = [];
  ctx.insertedRecords = [];
  ctx.profile = { tenant_id: "tenant-1" };
};

let autoIncrementId = 1;

const builder = (table: string) => {
  const state: any = { table, filters: {}, selectCols: "*" };

  const api: any = {
    select: (cols?: string) => {
      state.selectCols = cols || "*";
      return api;
    },
    insert: (payload: any) => {
      const record = Array.isArray(payload) ? payload[0] : payload;
      const id = `auto-${autoIncrementId++}`;
      const inserted = { id, ...record };
      ctx.insertedRecords.push({ table, payload: inserted });

      if (table === "empresas") {
        ctx.existingEmpresas.push({ id, nome: record.nome });
      }
      if (table === "colaboradores") {
        ctx.existingColaboradores.push({
          id,
          tenant_id: record.tenant_id,
          nome: record.nome,
          cpf: record.cpf,
        });
      }

      return {
        select: () => ({
          single: async () => ({ data: inserted, error: null }),
        }),
      };
    },
    eq: (col: string, val: any) => {
      state.filters[col] = val;
      return api;
    },
    single: async () => {
      if (table === "profiles") {
        return { data: ctx.profile, error: null };
      }
      return { data: null, error: null };
    },
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: any) => {
      // For select queries that resolve as thenable
      if (table === "colaboradores") {
        resolve({ data: ctx.existingColaboradores, error: null });
        return;
      }
      if (table === "empresas") {
        resolve({ data: ctx.existingEmpresas, error: null });
        return;
      }
      resolve({ data: [], error: null });
    },
  };

  return api;
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "test@test.com" } },
      })),
    },
    from: vi.fn((table: string) => builder(table)),
  },
}));

import {
  ensurePreCadastrosFromImportedPontos,
  type PontoPreCadastroRow,
} from "@/services/preCadastroColaborador.service";

describe("Fluxo de Importação de Pontos — Pré-Cadastro", () => {
  beforeEach(() => {
    resetCtx();
    autoIncrementId = 1;
  });

  it("cria empresa e colaboradores automaticamente quando base está limpa", async () => {
    const rows: PontoPreCadastroRow[] = [
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Nova LTDA",
        nome_colaborador: "João Silva",
        cpf_colaborador: "12345678901",
        matricula_colaborador: "001",
        cargo_colaborador: "Operador",
      },
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Nova LTDA",
        nome_colaborador: "Maria Santos",
        cpf_colaborador: "98765432100",
        matricula_colaborador: "002",
        cargo_colaborador: "Auxiliar",
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    // Should create 1 empresa (deduplicated)
    expect(result.empresasCriadas).toBe(1);

    // Should detect 2 new collaborators
    expect(result.novosDetectados).toBe(2);
    expect(result.preCadastrosCriados).toBe(2);

    // Both rows should have colaborador_id set
    expect(result.rowsWithColaboradorId.length).toBe(2);
    result.rowsWithColaboradorId.forEach((row) => {
      expect(row.colaborador_id).toBeTruthy();
    });
  });

  it("deduplica colaboradores com mesmo CPF no mesmo batch", async () => {
    const rows: PontoPreCadastroRow[] = [
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa X",
        nome_colaborador: "Pedro Alves",
        cpf_colaborador: "11111111111",
        matricula_colaborador: null,
        cargo_colaborador: null,
      },
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa X",
        nome_colaborador: "Pedro Alves",
        cpf_colaborador: "11111111111",
        matricula_colaborador: null,
        cargo_colaborador: null,
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    // Should only create 1 collaborator (deduped by CPF)
    expect(result.novosDetectados).toBe(1);
    expect(result.preCadastrosCriados).toBe(1);

    // Both rows should point to same colaborador
    expect(result.rowsWithColaboradorId[0].colaborador_id).toBe(
      result.rowsWithColaboradorId[1].colaborador_id,
    );
  });

  it("preserva colaborador_id existente sem re-criar", async () => {
    const rows: PontoPreCadastroRow[] = [
      {
        colaborador_id: "existing-collab-1",
        empresa_id: "existing-empresa-1",
        empresa_nome: null,
        nome_colaborador: "Existente",
        cpf_colaborador: null,
        matricula_colaborador: null,
        cargo_colaborador: null,
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    expect(result.novosDetectados).toBe(0);
    expect(result.preCadastrosCriados).toBe(0);
    expect(result.empresasCriadas).toBe(0);
    expect(result.rowsWithColaboradorId[0].colaborador_id).toBe("existing-collab-1");
  });

  it("retorna zerado para lista vazia", async () => {
    const result = await ensurePreCadastrosFromImportedPontos([], "planilha", "ponto");

    expect(result.novosDetectados).toBe(0);
    expect(result.preCadastrosCriados).toBe(0);
    expect(result.empresasCriadas).toBe(0);
    expect(result.rowsWithColaboradorId.length).toBe(0);
  });
});
