import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ContabilOficialService,
  PreviaContabilConsolidada,
} from "@/services/contabilOficial.service";
import { RelatoriosOficialAdapter } from "@/services/adapters/relatoriosOficialAdapter";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { supabase } from "@/lib/supabase";

vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("mock-tenant-123"),
  };
});

describe("ERP ORBE — CONT-02 | Testes Oficiais de Integração Contábil", () => {
  const mockEmpresaId = "28a560b5-37ef-403d-ae4f-b28a608b6a68";
  const mockCompetencia = "2026-09";

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    // Mock tenant & isolation
    vi.spyOn(EnvironmentService, "assertEmpresaAllowed").mockResolvedValue(undefined);

    // Mock padrão do Supabase contabil_mapeamento para retornar vazio
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "contabil_mapeamento") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any;
    });
  });

  // 1. ISOLAMENTO POR TENANT E EMPRESA
  it("1. deve garantir isolamento por tenant e empresa através de assertEmpresaAllowed", async () => {
    const assertSpy = vi
      .spyOn(EnvironmentService, "assertEmpresaAllowed")
      .mockRejectedValueOnce(new Error("EMPRESA_NOT_ALLOWED"));

    await expect(
      ContabilOficialService.gerarPreviaContabil("empresa-bloqueada", mockCompetencia)
    ).rejects.toThrow("EMPRESA_NOT_ALLOWED");

    expect(assertSpy).toHaveBeenCalled();
  });

  // 2. PERMISSÕES E ACESSO
  it("2. deve exigir empresa_id e competência válidos para iniciar a apuração contábil", async () => {
    await expect(
      ContabilOficialService.gerarPreviaContabil("", mockCompetencia)
    ).rejects.toThrow(/empresa_id obrigatório/i);

    await expect(
      ContabilOficialService.gerarPreviaContabil(mockEmpresaId, "")
    ).rejects.toThrow(/competência obrigatório/i);
  });

  // 3. PRÉVIA EM COMPETÊNCIA ABERTA
  it("3. deve gerar prévia com status EM_ABERTO quando houver lotes/itens em tramitação", async () => {
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([
      {
        id: "dia-1",
        empresaId: mockEmpresaId,
        cicloId: "ciclo-1",
        cicloLabel: "Semana 1",
        dataLancamento: "2026-09-05",
        colaboradorNome: "João Diarista",
        cpfMascarado: "***.123.456-**",
        funcao: "Chapa",
        codigoMarcacao: "P",
        quantidadeDiarias: 1,
        valorDiariaBase: 150,
        total: 150,
        loteCodigo: "LOTE-DIA-01",
        statusLote: "em_aberto", // Aberto
      },
    ]);

    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia,
      "ESC Log Matriz"
    );

    expect(previa.status_fechamento).toBe("EM_ABERTO");
    expect(previa.total_lancamentos).toBe(1);
    expect(previa.total_debito).toBe(150);
    expect(previa.total_credito).toBe(150);
    expect(previa.diferenca).toBe(0);
    // Prévia acessível, mas exportação bloqueada
    expect(previa.elegivel_exportacao).toBe(false);
    expect(previa.bloqueios.some((b) => b.includes("fechamento financeiro homologado"))).toBe(true);
  });

  // 4. BLOQUEIO DE EXPORTAÇÃO SEM FECHAMENTO HOMOLOGADO
  it("4. deve bloquear exportação definitiva quando status de fechamento for diferente de FECHADO_FINANCEIRO", async () => {
    const previaIncompleta: PreviaContabilConsolidada = {
      empresa_id: mockEmpresaId,
      empresa_nome: "ESC Log Matriz",
      competencia: mockCompetencia,
      status_fechamento: "EM_ABERTO",
      fechamento_detalhe: "Itens em aberto",
      total_lancamentos: 1,
      total_debito: 1000,
      total_credito: 1000,
      diferenca: 0,
      lancamentos_nao_mapeados: 0,
      inconsistencias: [],
      elegivel_exportacao: false,
      bloqueios: ["A competência não possui fechamento financeiro homologado."],
      lancamentos: [],
      content_hash: "hash123",
    };

    await expect(
      ContabilOficialService.exportarCSV(previaIncompleta, "admin@orbe.com")
    ).rejects.toThrow(/Exportação bloqueada/i);
  });

  // 5. BLOQUEIO DE LANÇAMENTOS NÃO MAPEADOS
  it("5. deve identificar e bloquear exportação se existirem lançamentos sem conta contábil configurada", async () => {
    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([
      {
        id: "rec-1",
        empresaId: mockEmpresaId,
        competencia: mockCompetencia,
        competenciaFormatada: "09/2026",
        clienteNome: "Cliente Alfa",
        modalidade: "FATURAMENTO_MENSAL",
        origem: "Operação por Volume",
        valorFaturado: 5000,
        vencimento: "2026-09-28",
        dataRecebimento: null,
        status: "FATURADO",
      },
    ]);
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);

    // Sem contas cadastradas para RECEITA_OPERACAO_VOLUME
    vi.spyOn(ContabilOficialService, "getMapeamentos").mockResolvedValue([
      {
        operacao_tipo: "RECEITA_OPERACAO_VOLUME",
        titulo: "Receita de Operações",
        descricao: "",
        natureza: "RECEITA",
        conta_debito: "",
        conta_credito: "",
        status: "INCOMPLETO",
      },
    ]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia
    );

    expect(previa.lancamentos_nao_mapeados).toBe(1);
    expect(previa.elegivel_exportacao).toBe(false);
    expect(
      previa.bloqueios.some((b) => b.includes("sem contas de débito ou crédito"))
    ).toBe(true);
  });

  // 6. EQUILÍBRIO ENTRE DÉBITO E CRÉDITO (PARTIDAS DOBRADAS)
  it("6. deve assegurar que cada fato contábil possui Débito e Crédito de mesmo valor (Diferença = 0)", async () => {
    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([
      {
        id: "rec-1",
        empresaId: mockEmpresaId,
        competencia: mockCompetencia,
        competenciaFormatada: "09/2026",
        clienteNome: "Cliente Alfa",
        modalidade: "FATURAMENTO_MENSAL",
        origem: "Operação por Volume",
        valorFaturado: 12500.5,
        vencimento: "2026-09-28",
        dataRecebimento: null,
        status: "FATURADO",
      },
    ]);
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);

    vi.spyOn(ContabilOficialService, "getMapeamentos").mockResolvedValue([
      {
        operacao_tipo: "RECEITA_OPERACAO_VOLUME",
        titulo: "Receita",
        descricao: "",
        natureza: "RECEITA",
        conta_debito: "1.1.02.001",
        conta_credito: "3.1.01.001",
        status: "COMPLETO",
      },
    ]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia
    );

    expect(previa.total_debito).toBe(12500.5);
    expect(previa.total_credito).toBe(12500.5);
    expect(previa.diferenca).toBe(0);
    expect(previa.lancamentos[0].conta_debito).toBe("1.1.02.001");
    expect(previa.lancamentos[0].conta_credito).toBe("3.1.01.001");
  });

  // 7. PREVENÇÃO DE DUPLICIDADE CONTÁBIL
  it("7. deve detectar reexportações determinísticas da mesma competência e conteúdo", async () => {
    const mockHash = "a1b2c3d4";
    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "log-1",
                tipo_envio: "Mensal",
                status: "sucesso",
                sistema_destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
                created_at: "2026-11-04T10:00:00Z",
                payload: {
                  empresa_id: mockEmpresaId,
                  competencia: mockCompetencia,
                  content_hash: mockHash,
                  arquivo_nome: "ORBE_CONTABIL_matriz_2026-09.csv",
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    } as any);

    const dupCheck = await ContabilOficialService.verificarDuplicidadeExportacao(
      mockEmpresaId,
      mockCompetencia,
      mockHash
    );

    expect(dupCheck.duplicado).toBe(true);
    expect(dupCheck.logAnterior?.arquivo_nome).toBe("ORBE_CONTABIL_matriz_2026-09.csv");
  });

  // 8. GERAÇÃO CORRETA DO CSV
  it("8. deve gerar o conteúdo CSV com cabeçalho canônico e dados formatados em UTF-8", async () => {
    const previaValida: PreviaContabilConsolidada = {
      empresa_id: mockEmpresaId,
      empresa_nome: "ESC Log Matriz",
      competencia: mockCompetencia,
      status_fechamento: "FECHADO_FINANCEIRO",
      fechamento_detalhe: "Homologado",
      total_lancamentos: 1,
      total_debito: 2500,
      total_credito: 2500,
      diferenca: 0,
      lancamentos_nao_mapeados: 0,
      inconsistencias: [],
      elegivel_exportacao: true,
      bloqueios: [],
      content_hash: "hash_ok",
      lancamentos: [
        {
          id: "L1",
          data: "2026-09-28",
          origem: "Faturamento",
          origem_tipo: "RECEITA_OPERACAO_VOLUME",
          documento: "REC-001",
          historico: "Faturamento Transporte Linha 1",
          conta_debito: "1.1.02.001",
          conta_credito: "3.1.01.001",
          valor: 2500.0,
          empresa_id: mockEmpresaId,
          empresa_nome: "ESC Log Matriz",
          centro_custo: "OPERACIONAL",
          mapeado: true,
          status_origem: "FATURADO",
        },
      ],
    };

    // Mock insert log
    vi.spyOn(supabase, "from").mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "log-export-999" },
            error: null,
          }),
        }),
      }),
    } as any);

    const result = await ContabilOficialService.exportarCSV(previaValida, "financeiro@orbe.com");

    expect(result.fileName).toContain("ORBE_CONTABIL_esc-log-matriz_2026-09");
    expect(result.csvContent).toContain("Data;ContaDebito;ContaCredito;Valor;Historico;Documento;Empresa;CentroCusto");
    expect(result.csvContent).toContain("2026-09-28;1.1.02.001;3.1.01.001;2500.00;Faturamento Transporte Linha 1;REC-001;ESC Log Matriz;OPERACIONAL");
  });

  // 9. HISTÓRICO COM STATUS VERDADEIRO
  it("9. deve consultar contabil_logs_integracao e retornar status e métricas reais", async () => {
    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "log-abc",
                execucao_data: "2026-11-04T14:00:00Z",
                tipo_envio: "Mensal",
                status: "sucesso",
                sistema_destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
                payload: {
                  empresa_id: mockEmpresaId,
                  empresa_nome: "ESC Log Matriz",
                  competencia: "2026-09",
                  total_lancamentos: 42,
                  total_debito: 85000,
                  arquivo_nome: "ORBE_CONTABIL_2026-09.csv",
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    } as any);

    const logs = await ContabilOficialService.getLogs(mockEmpresaId, "2026-09");
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("sucesso");
    expect(logs[0].total_lancamentos).toBe(42);
    expect(logs[0].total_valor).toBe(85000);
  });

  // 10. SEGURANÇA E PERSISTÊNCIA REAL: FALHA NO SUPABASE DEVE LANÇAR ERRO E NÃO RETORNAR SUCESSO (CONT-02.1 / CONT-02.2)
  it("10. deve disparar erro explícito e NÃO tratar como sucesso quando Supabase falhar ao salvar mapeamento (sem fallback)", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: { message: "function rpc_salvar_mapeamento_contabil_par not found" } as any,
    });
    vi.spyOn(supabase, "from").mockReturnValue({
      upsert: vi.fn().mockResolvedValue({
        error: { message: 'new row violates row-level security policy for table "contabil_mapeamento"' },
      }),
    } as any);

    // Tentativa deve lançar erro explícito
    await expect(
      ContabilOficialService.salvarMapeamento(
        mockEmpresaId,
        "RECEITA_OPERACAO_VOLUME",
        "1.1.02.001",
        "3.1.01.001"
      )
    ).rejects.toThrow(/Falha de persistência atômica no Supabase/i);

    // Garantir que nada foi salvo em localStorage
    expect(localStorage.getItem(`orbe_contabil_map_${mockEmpresaId}`)).toBeNull();
  });

  // 11. CONFIRMAÇÃO DE PERSISTÊNCIA ATÔMICA REAL NO BANCO DE DADOS (CONT-02.2)
  it("11. deve persistir com sucesso no Supabase via UPSERT atômico em lote único preservando modelo de duas linhas", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: { message: "function not found" } as any,
    });

    const upsertSpy = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(supabase, "from").mockReturnValue({
      upsert: upsertSpy,
    } as any);

    const res = await ContabilOficialService.salvarMapeamento(
      mockEmpresaId,
      "DESPESA_DIARISTAS",
      "4.1.02.001",
      "2.1.02.001"
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain("UPSERT atômico");
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          operacao_tipo: "DESPESA_DIARISTAS",
          conta_contabil: "4.1.02.001",
          classificacao: "DEBITO",
          empresa_id: mockEmpresaId,
        }),
        expect.objectContaining({
          operacao_tipo: "DESPESA_DIARISTAS",
          conta_contabil: "2.1.02.001",
          classificacao: "CREDITO",
          empresa_id: mockEmpresaId,
        }),
      ],
      { onConflict: "empresa_id,operacao_tipo,classificacao" }
    );
  });

  // 11b. CONFIRMAÇÃO DE PERSISTÊNCIA ATÔMICA VIA RPC TRANSACIONAL (CONT-02.2)
  it("11b. deve priorizar RPC transacional atômica quando disponível no banco de dados", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const res = await ContabilOficialService.salvarMapeamento(
      mockEmpresaId,
      "DESPESA_FOLHA_CLT",
      "4.1.01.001",
      "2.1.01.001"
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain("RPC");
    expect(rpcSpy).toHaveBeenCalledWith("rpc_salvar_mapeamento_contabil_par", {
      p_empresa_id: mockEmpresaId,
      p_operacao_tipo: "DESPESA_FOLHA_CLT",
      p_conta_debito: "4.1.01.001",
      p_conta_credito: "2.1.01.001",
    });
  });

  // 12. LEITURA ESTRITA DO BANCO (SEM LOCALSTORAGE)
  it("12. deve ler mapeamentos estritamente do banco de dados e ignorar qualquer cache no localStorage", async () => {
    // Tentar poluir localStorage
    localStorage.setItem(
      `orbe_contabil_map_${mockEmpresaId}`,
      JSON.stringify({ RECEITA_OPERACAO_VOLUME: { debito: "FAKE", credito: "FAKE" } })
    );

    // Banco de dados retorna vazio
    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any);

    const mappings = await ContabilOficialService.getMapeamentos(mockEmpresaId);
    const r03 = mappings.find((m) => m.operacao_tipo === "RECEITA_OPERACAO_VOLUME");

    // Deve ser INCOMPLETO e ignorar o localStorage
    expect(r03?.conta_debito).toBe("");
    expect(r03?.conta_credito).toBe("");
    expect(r03?.status).toBe("INCOMPLETO");
  });
});
