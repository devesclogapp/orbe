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

describe("Fluxo de Importação de Pontos — Pré-Cadastro (P0-01)", () => {
  beforeEach(() => {
    resetCtx();
    autoIncrementId = 1;
  });

  it("Cenário 1: Empresa válida — colaborador processado normalmente", async () => {
    ctx.existingEmpresas = [
      { id: "emp-legitima-1", nome: "Empresa Legítima LTDA" },
    ];

    const rows: PontoPreCadastroRow[] = [
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Legítima LTDA",
        nome_colaborador: "João Silva",
        cpf_colaborador: "12345678901",
        matricula_colaborador: "001",
        cargo_colaborador: "Operador",
      },
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Legítima LTDA",
        nome_colaborador: "Maria Santos",
        cpf_colaborador: "98765432100",
        matricula_colaborador: "002",
        cargo_colaborador: "Auxiliar",
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    // Zero empresas criadas (empresa legítima já existia)
    expect(result.empresasCriadas).toBe(0);

    // Detecta e cria 2 colaboradores vinculados à empresa válida
    expect(result.novosDetectados).toBe(2);
    expect(result.preCadastrosCriados).toBe(2);

    // Ambas as linhas têm colaborador_id e empresa_id resolvidos
    expect(result.rowsWithColaboradorId.length).toBe(2);
    result.rowsWithColaboradorId.forEach((row) => {
      expect(row.colaborador_id).toBeTruthy();
      expect(row.empresa_id).toBe("emp-legitima-1");
    });

    // Nenhuma empresa foi inserida
    const insertedEmpresas = ctx.insertedRecords.filter((r) => r.table === "empresas");
    expect(insertedEmpresas.length).toBe(0);
  });

  it("Cenário 2: Empresa desconhecida — nenhuma empresa fictícia criada; registro tratado como pendente", async () => {
    ctx.existingEmpresas = [
      { id: "emp-legitima-1", nome: "Empresa Legítima LTDA" },
    ];

    const rows: PontoPreCadastroRow[] = [
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Departamento Desconhecido RHID",
        nome_colaborador: "Desconhecido 1",
        cpf_colaborador: "11122233344",
        matricula_colaborador: "991",
        cargo_colaborador: "Operador",
      },
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Departamento Desconhecido RHID",
        nome_colaborador: "Desconhecido 2",
        cpf_colaborador: "55566677788",
        matricula_colaborador: "992",
        cargo_colaborador: "Auxiliar",
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    // Nenhuma empresa fictícia criada
    expect(result.empresasCriadas).toBe(0);

    // Nenhum colaborador novo ativado indevidamente
    expect(result.novosDetectados).toBe(0);
    expect(result.preCadastrosCriados).toBe(0);

    // Registros isolados como pendentes / inconsistentes sem empresa incorreta
    expect(result.rowsWithColaboradorId.length).toBe(2);
    result.rowsWithColaboradorId.forEach((row) => {
      expect(row.colaborador_id).toBeNull();
      expect(row.empresa_id).toBeNull();
      expect((row as any).status_processamento).toBe("INCONSISTENTE");
      expect((row as any).status).toBe("Pendente");
      expect((row as any).motivo_inconsistencia).toContain("Departamento Desconhecido RHID");
    });

    // Zero inserts de empresas ou colaboradores no banco
    expect(ctx.insertedRecords.length).toBe(0);
  });

  it("Cenário 3: Arquivo misto — registros válidos processados e registros inválidos isolados", async () => {
    ctx.existingEmpresas = [
      { id: "emp-legitima-1", nome: "Empresa Legítima LTDA" },
    ];

    const rows: PontoPreCadastroRow[] = [
      // Linha 1: Válida
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Legítima LTDA",
        nome_colaborador: "João Válido",
        cpf_colaborador: "10020030040",
        matricula_colaborador: "101",
        cargo_colaborador: "Operador",
      },
      // Linha 2: Inválida / Empresa desconhecida
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Filial Fantasma 99",
        nome_colaborador: "Fantasma da Silva",
        cpf_colaborador: "99988877766",
        matricula_colaborador: "999",
        cargo_colaborador: "Indefinido",
      },
      // Linha 3: Válida
      {
        colaborador_id: null,
        empresa_id: null,
        empresa_nome: "Empresa Legítima LTDA",
        nome_colaborador: "Maria Válida",
        cpf_colaborador: "50060070080",
        matricula_colaborador: "102",
        cargo_colaborador: "Analista",
      },
    ];

    const result = await ensurePreCadastrosFromImportedPontos(rows, "planilha", "ponto");

    // Zero empresas criadas
    expect(result.empresasCriadas).toBe(0);

    // Apenas os 2 colaboradores válidos foram detectados e criados
    expect(result.novosDetectados).toBe(2);
    expect(result.preCadastrosCriados).toBe(2);

    expect(result.rowsWithColaboradorId.length).toBe(3);

    // Linha 1: Processada normalmente
    const linha1 = result.rowsWithColaboradorId[0];
    expect(linha1.colaborador_id).toBeTruthy();
    expect(linha1.empresa_id).toBe("emp-legitima-1");

    // Linha 2: Isolada como pendente / inconsistente sem poluir o banco
    const linha2 = result.rowsWithColaboradorId[1];
    expect(linha2.colaborador_id).toBeNull();
    expect(linha2.empresa_id).toBeNull();
    expect((linha2 as any).status_processamento).toBe("INCONSISTENTE");
    expect((linha2 as any).motivo_inconsistencia).toContain("Filial Fantasma 99");

    // Linha 3: Processada normalmente
    const linha3 = result.rowsWithColaboradorId[2];
    expect(linha3.colaborador_id).toBeTruthy();
    expect(linha3.empresa_id).toBe("emp-legitima-1");

    // No banco, apenas os 2 colaboradores válidos foram inseridos (nenhuma empresa)
    const insertedEmpresas = ctx.insertedRecords.filter((r) => r.table === "empresas");
    const insertedColaboradores = ctx.insertedRecords.filter((r) => r.table === "colaboradores");
    expect(insertedEmpresas.length).toBe(0);
    expect(insertedColaboradores.length).toBe(2);
  });

  it("deduplica colaboradores com mesmo CPF no mesmo batch para empresa válida", async () => {
    ctx.existingEmpresas = [
      { id: "emp-legitima-1", nome: "Empresa X" },
    ];

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

    expect(result.empresasCriadas).toBe(0);
    expect(result.novosDetectados).toBe(1);
    expect(result.preCadastrosCriados).toBe(1);

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
