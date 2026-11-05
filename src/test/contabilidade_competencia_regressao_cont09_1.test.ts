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

describe("ERP ORBE — CONT-09.2 | Separação entre Data Contábil e Vencimento", () => {
  const mockEmpresaId = "4d4c1328-a8e7-4c5b-875d-924b416fa13a"; // BENEVIDES
  const mockCompetencia = "2026-09";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(EnvironmentService, "assertEmpresaAllowed").mockResolvedValue(undefined);
  });

  // 1. LANÇAMENTO COM DATA OPERACIONAL E COMPETÊNCIA NO MESMO MÊS
  it("1. mesmo mês: lançamento com data operacional em setembro mantém data contábil e vencimento coincidentes", async () => {
    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([
      {
        id: "rec-mesmo-mes",
        empresaId: mockEmpresaId,
        competencia: "2026-09",
        competenciaFormatada: "09/2026",
        clienteNome: "BENEVIDES",
        modalidade: "CAIXA_IMEDIATO",
        origem: "Operação por Volume",
        valorFaturado: 1200.0,
        dataEmissao: "2026-09-20",
        dataOperacao: "2026-09-20",
        vencimento: "2026-09-20",
        dataRecebimento: "2026-09-20",
        status: "conciliado",
      },
    ]);
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);

    vi.spyOn(ContabilOficialService, "getMapeamentos").mockResolvedValue([
      {
        operacao_tipo: "RECEITA_OPERACAO_VOLUME",
        titulo: "Receita de Operações",
        descricao: "",
        natureza: "RECEITA",
        conta_debito: "1.1.02.001",
        conta_credito: "3.1.01.001",
        status: "COMPLETO",
      },
    ]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia,
      "BENEVIDES"
    );

    expect(previa.total_lancamentos).toBe(1);
    expect(previa.lancamentos[0].data).toBe("2026-09-20");
    expect(previa.lancamentos[0].data_vencimento).toBe("2026-09-20");
    expect(previa.lancamentos[0].valor).toBe(1200.0);
    expect(previa.competencia).toBe("2026-09");
  });

  // 2. DUPLICATA COM VENCIMENTO EM OUTUBRO (CASO REAL BENEVIDES)
  it("2. CONT-09.2: duplicata emitida em setembro com vencimento em outubro possui data contábil em setembro e vencimento separado", async () => {
    // Reproduz fielmente os registros de BENEVIDES com data de criação/faturamento em 17/09/2026 e vencimento em 01/10/2026
    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([
      {
        id: "cf1c2b5e-c47d-4f48-b6eb-4d8b8b5df46f",
        empresaId: mockEmpresaId,
        competencia: "2026-09",
        competenciaFormatada: "09/2026",
        clienteNome: "BENEVIDES",
        modalidade: "DUPLICATA",
        origem: "Operação por Volume",
        valorFaturado: 247.5,
        dataEmissao: "2026-09-17", // Data oficial do faturamento
        dataOperacao: "2026-09-17",
        vencimento: "2026-10-01", // Vencimento comercial da duplicata
        dataRecebimento: null,
        status: "pendente_cobranca",
      },
      {
        id: "1f6f0403-1b4e-4ceb-bb49-be9874713c5b",
        empresaId: mockEmpresaId,
        competencia: "2026-09",
        competenciaFormatada: "09/2026",
        clienteNome: "BENEVIDES",
        modalidade: "DUPLICATA",
        origem: "Serviço Extra",
        valorFaturado: 20.0,
        dataEmissao: "2026-09-17", // Data oficial do faturamento
        dataOperacao: "2026-09-17",
        vencimento: "2026-10-02", // Vencimento comercial da duplicata
        dataRecebimento: "2026-09-17",
        status: "conciliado",
      },
    ]);
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);

    vi.spyOn(ContabilOficialService, "getMapeamentos").mockResolvedValue([
      {
        operacao_tipo: "RECEITA_OPERACAO_VOLUME",
        titulo: "Receita de Operações",
        descricao: "",
        natureza: "RECEITA",
        conta_debito: "1.1.02.001",
        conta_credito: "3.1.01.001",
        status: "COMPLETO",
      },
    ]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia,
      "BENEVIDES"
    );

    expect(previa.total_lancamentos).toBe(2);
    expect(previa.competencia).toBe("2026-09");

    // CORREÇÃO PONTUAL: Data Contábil é estritamente 17/09/2026 (dentro da competência setembro)
    expect(previa.lancamentos[0].data).toBe("2026-09-17");
    expect(previa.lancamentos[1].data).toBe("2026-09-17");

    // Vencimento preservado como campo separado
    expect(previa.lancamentos[0].data_vencimento).toBe("2026-10-01");
    expect(previa.lancamentos[1].data_vencimento).toBe("2026-10-02");
  });

  // 3. NÃO INVENÇÃO DE DATAS: AUSÊNCIA DE DATA CONTÁBIL CONFIÁVEL GERA IMPEDIMENTO
  it("3. confiabilidade: quando não houver data contábil oficial, gera inconsistência sem inventar data fictícia", async () => {
    vi.spyOn(RelatoriosOficialAdapter, "getR03Data").mockResolvedValue([
      {
        id: "rec-sem-data",
        empresaId: mockEmpresaId,
        competencia: "2026-09",
        competenciaFormatada: "09/2026",
        clienteNome: "BENEVIDES",
        modalidade: "DUPLICATA",
        origem: "Operação por Volume",
        valorFaturado: 350.0,
        dataEmissao: "", // Sem data contábil
        dataOperacao: "",
        vencimento: "2026-11-15", // Vencimento em mês totalmente posterior
        dataRecebimento: null,
        status: "FATURADO",
      },
    ]);
    vi.spyOn(RelatoriosOficialAdapter, "getR02Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR04Data").mockResolvedValue([]);
    vi.spyOn(RelatoriosOficialAdapter, "getR07Data").mockResolvedValue([]);
    vi.spyOn(ContabilOficialService, "getMapeamentos").mockResolvedValue([]);

    const previa = await ContabilOficialService.gerarPreviaContabil(
      mockEmpresaId,
      mockCompetencia,
      "BENEVIDES"
    );

    // Deve registrar inconsistência clara em vez de inventar uma data como '2026-09-28'
    expect(previa.inconsistencias.length).toBeGreaterThan(0);
    expect(previa.inconsistencias[0]).toContain("ausência de data contábil oficial confiável");
    expect(previa.elegivel_exportacao).toBe(false);
  });

  // 4. EXPORTAÇÃO CSV DE PRÉVIA COM DATA CONTÁBIL CORRIGIDA
  it("4. exportação CSV: o arquivo gerado apresenta a data contábil de setembro (2026-09-17) e não outubro", () => {
    const mockPrevia: PreviaContabilConsolidada = {
      empresa_id: mockEmpresaId,
      empresa_nome: "BENEVIDES",
      competencia: "2026-09",
      status_fechamento: "EM_ABERTO",
      fechamento_detalhe: "Competência aberta",
      total_lancamentos: 2,
      total_debito: 267.5,
      total_credito: 267.5,
      diferenca: 0,
      lancamentos_nao_mapeados: 0,
      inconsistencias: [],
      elegivel_exportacao: false,
      bloqueios: ["Competência em aberto."],
      lancamentos: [
        {
          id: "LANC-R03-1",
          data: "2026-09-17", // Data contábil corrigida
          data_vencimento: "2026-10-01", // Vencimento separado
          origem: "Operação por Volume",
          origem_tipo: "RECEITA_OPERACAO_VOLUME",
          documento: "REC-CF1C2B5E",
          historico: "Faturamento Ref. Operação por Volume - Cliente BENEVIDES",
          conta_debito: "1.1.02.001",
          conta_credito: "3.1.01.001",
          valor: 247.5,
          empresa_id: mockEmpresaId,
          empresa_nome: "BENEVIDES",
          centro_custo: "OPERACIONAL",
          mapeado: true,
          status_origem: "pendente_cobranca",
        },
        {
          id: "LANC-R03-2",
          data: "2026-09-17", // Data contábil corrigida
          data_vencimento: "2026-10-02", // Vencimento separado
          origem: "Serviço Extra",
          origem_tipo: "RECEITA_OPERACAO_VOLUME",
          documento: "REC-1F6F0403",
          historico: "Faturamento Ref. Serviço Extra - Cliente BENEVIDES",
          conta_debito: "1.1.02.001",
          conta_credito: "3.1.01.001",
          valor: 20.0,
          empresa_id: mockEmpresaId,
          empresa_nome: "BENEVIDES",
          centro_custo: "OPERACIONAL",
          mapeado: true,
          status_origem: "conciliado",
        },
      ],
      content_hash: "hash_benevides_123",
    };

    const res = ContabilOficialService.gerarCSVPrevia(mockPrevia);

    // CSV deve conter a data contábil de setembro (2026-09-17)
    const lines = res.csvContent.split("\r\n");
    expect(lines[1]).toContain("BENEVIDES;2026-09;2026-09-17;Operação por Volume;REC-CF1C2B5E;");
    expect(lines[2]).toContain("BENEVIDES;2026-09;2026-09-17;Serviço Extra;REC-1F6F0403;");

    // Nenhuma linha deve possuir data contábil em outubro (2026-10)
    expect(res.csvContent).not.toContain(";2026-10-01;");
    expect(res.csvContent).not.toContain(";2026-10-02;");
  });

  // 5. AUSÊNCIA DE DUPLICIDADE E ALTERAÇÕES FINANCEIRAS (READ-ONLY)
  it("5. segurança read-only: consolidação e exportação de prévia não alteram tabelas nem inserem logs", async () => {
    const supabaseFromSpy = vi.spyOn(supabase, "from");

    const mockPrevia: PreviaContabilConsolidada = {
      empresa_id: mockEmpresaId,
      empresa_nome: "BENEVIDES",
      competencia: "2026-09",
      status_fechamento: "EM_ABERTO",
      fechamento_detalhe: "Competência aberta",
      total_lancamentos: 1,
      total_debito: 100,
      total_credito: 100,
      diferenca: 0,
      lancamentos_nao_mapeados: 0,
      inconsistencias: [],
      elegivel_exportacao: false,
      bloqueios: [],
      lancamentos: [
        {
          id: "LANC-R03-1",
          data: "2026-09-17",
          data_vencimento: "2026-10-01",
          origem: "Operação por Volume",
          origem_tipo: "RECEITA_OPERACAO_VOLUME",
          documento: "REC-01",
          historico: "Teste",
          conta_debito: "1.1.01",
          conta_credito: "3.1.01",
          valor: 100,
          empresa_id: mockEmpresaId,
          empresa_nome: "BENEVIDES",
          centro_custo: "OPERACIONAL",
          mapeado: true,
          status_origem: "pendente_cobranca",
        },
      ],
      content_hash: "hash",
    };

    ContabilOficialService.gerarCSVPrevia(mockPrevia);

    // Nenhuma gravação de log ou alteração no banco
    expect(supabaseFromSpy).not.toHaveBeenCalledWith("contabil_logs_integracao");
    expect(supabaseFromSpy).not.toHaveBeenCalledWith("receitas_operacionais");
  });
});
