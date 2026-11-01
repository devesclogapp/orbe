import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CentralBancariaDrawerOficial } from "@/components/bancario/CentralBancariaDrawerOficial";
import { ItemObrigacaoBancariaOficial } from "@/services/bancarioOficialAdapter";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { CnabRemessaArquivoService } from "@/services/cnab/cnabRemessaArquivo.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";

// Mock do tenant
vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-test-uuid"),
  };
});

describe("FIX DIA-CNAB-04 — Testes de Reentrância, Idempotência e Bloqueio de Concorrência", () => {
  const mockItemDiarista: ItemObrigacaoBancariaOficial = {
    id: "dia-371806e7-91e4-49ed-b6df-e7e0e5fcd68a",
    referencia: "DIA-2026-10",
    origemTipo: "DIARISTAS",
    loteId: "371806e7-91e4-49ed-b6df-e7e0e5fcd68a",
    loteCodigo: "DIA-371806E7",
    empresaId: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
    empresaNome: "Empresa Teste - Homologação",
    isEmpresaTeste: true,
    competencia: "2026-10",
    favorecidoDescricao: "1 Diarista(s) Semanal",
    favorecidoNomeMascarado: "Pagamento Semanal de Diárias",
    documentoFavorecidoMascarado: "Chaves PIX / Contas Bancárias",
    dadosBancariosFavorecidoMascarado: "Contas Corrente / PIX Diversas",
    quantidadeFavorecidos: 1,
    valorTotal: 350,
    valorEsperado: 350,
    situacao: "PRONTO_BANCO",
    estagioTab: "PRONTAS_BANCO",
    contaPagadora: {
      id: "faecb252-7b9e-407d-93a5-e10466d35b0e",
      empresaId: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
      bancoCodigo: "341",
      bancoNome: "Itaú Unibanco S.A.",
      agencia: "1234",
      agenciaMascarada: "1234",
      conta: "56789",
      contaMascarada: "56789-0",
      cedenteNome: "Empresa Teste - Homologação",
      permiteCnab: true,
      ativo: true,
    },
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(EnvironmentService, "getCurrentEnvironment").mockReturnValue("homologacao");
    vi.spyOn(EnvironmentService, "assertEmpresaAllowed").mockResolvedValue(undefined as any);
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: {
        user: {
          id: "user-financeiro-123",
          email: "financeiro@esclog.com.br",
        } as any,
      },
      error: null,
    });
  });

  // =========================================================================
  // 1. FRONTEND: BLOQUEIO SÍNCRONO DE REENTRÂNCIA (useRef)
  // =========================================================================
  describe("1. Bloqueio Síncrono de Reentrância no Drawer Bancário", () => {
    it("Impede múltiplos disparos simultâneos ao clicar repetidamente em 'Confirmar e Gerar Remessa'", async () => {
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "contas_bancarias_empresa") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "faecb252-7b9e-407d-93a5-e10466d35b0e",
                empresa_id: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
                banco_codigo: "341",
                banco_nome: "Itaú",
                agencia: "1234",
                conta: "56789",
                ativo: true,
                permite_cnab: true,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "empresas") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
                nome: "Empresa Teste - Homologação",
                cnpj: "12345678000199",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      let resolvePromise: (val: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const spyGerarCNAB = vi
        .spyOn(LoteFechamentoDiaristaService, "gerarCNABParaLote")
        .mockImplementation(() => delayedPromise as any);

      render(
        <MemoryRouter>
          <CentralBancariaDrawerOficial
            item={mockItemDiarista}
            open={true}
            onOpenChange={() => {}}
          />
        </MemoryRouter>
      );

      // Abre modal de confirmação
      const btnGerarCnab = screen.getByText("Gerar Remessa CNAB");
      fireEvent.click(btnGerarCnab);

      const btnConfirmar = await screen.findByText("Confirmar e Gerar Remessa");

      // Simula múltiplos cliques rápidos (duplo clique / spam de cliques)
      fireEvent.click(btnConfirmar);
      fireEvent.click(btnConfirmar);
      fireEvent.click(btnConfirmar);

      // Confirma que a mutation foi chamada APENAS UMA VEZ
      await waitFor(() => {
        expect(spyGerarCNAB).toHaveBeenCalledTimes(1);
      });

      // Resolve a promessa e verifica liberação segura
      resolvePromise!({
        nomeArquivo: "SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt",
        totalRegistros: 3,
        valorTotal: 350,
      });

      await waitFor(() => {
        expect(spyGerarCNAB).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // 2. BACKEND/SERVICE: IDEMPOTÊNCIA E DIFERENCIAÇÃO DE STATUS
  // =========================================================================
  describe("2. Idempotência e Diferenciação de Status em diaristas.service.ts", () => {
    it("Retorna remessa existente de forma idempotente sem criar nova remessa nem consumir NSA", async () => {
      const mockSupabase = (LoteFechamentoDiaristaService as any).supabase;

      vi.spyOn(mockSupabase, "from").mockImplementation((table: string) => {
        if (table === "diaristas_lotes_fechamento") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "lote-hml-123",
                empresa_id: "emp-hml-1",
                tenant_id: "tenant-test-uuid",
                status: "cnab_gerado",
                valor_total: 350,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "cnab_remessas_arquivos") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "rem-existente-1",
                nome_arquivo: "SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt",
                total_registros: 3,
                total_valor: 350,
                sequencial_arquivo: 11,
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const spyRegistrar = vi.spyOn(CnabRemessaArquivoService, "registrar");

      const result = await LoteFechamentoDiaristaService.gerarCNABParaLote({
        loteId: "lote-hml-123",
        empresaId: "emp-hml-1",
        geradoPor: "user-1",
        geradoPorNome: "Operador",
        empresaRemetente: {
          cnpj: "12345678000199",
          razao_social: "Empresa",
          banco_codigo: "341",
          agencia: "1234",
          agencia_digito: "0",
          conta: "12345",
          digito_conta: "6",
        },
      });

      // 1. Retornou o resultado existente
      expect(result).toEqual({
        nomeArquivo: "SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt",
        totalRegistros: 3,
        valorTotal: 350,
      });

      // 2. NÃO chamou CnabRemessaArquivoService.registrar (idempotência preservada)
      expect(spyRegistrar).not.toHaveBeenCalled();
    });

    it("Lança erro específico se o lote estiver em status PAGO", async () => {
      const mockSupabase = (LoteFechamentoDiaristaService as any).supabase;

      vi.spyOn(mockSupabase, "from").mockImplementation((table: string) => {
        if (table === "diaristas_lotes_fechamento") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "lote-pago-1",
                empresa_id: "emp-1",
                tenant_id: "tenant-test-uuid",
                status: "PAGO",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      await expect(
        LoteFechamentoDiaristaService.gerarCNABParaLote({
          loteId: "lote-pago-1",
          empresaId: "emp-1",
          geradoPor: "user-1",
          geradoPorNome: "Operador",
          empresaRemetente: { cnpj: "12345678000199", razao_social: "Emp", banco_codigo: "341", agencia: "1", agencia_digito: "", conta: "1", digito_conta: "" },
        })
      ).rejects.toThrow("Geração de CNAB bloqueada: o lote já foi liquidado/pago.");
    });

    it("Lança erro específico se o lote ainda estiver em VALIDADO_RH (sem aprovação financeira)", async () => {
      const mockSupabase = (LoteFechamentoDiaristaService as any).supabase;

      vi.spyOn(mockSupabase, "from").mockImplementation((table: string) => {
        if (table === "diaristas_lotes_fechamento") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "lote-sem-aprov-1",
                empresa_id: "emp-1",
                tenant_id: "tenant-test-uuid",
                status: "VALIDADO_RH",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "cnab_remessas_arquivos") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {} as any;
      });

      await expect(
        LoteFechamentoDiaristaService.gerarCNABParaLote({
          loteId: "lote-sem-aprov-1",
          empresaId: "emp-1",
          geradoPor: "user-1",
          geradoPorNome: "Operador",
          empresaRemetente: { cnpj: "12345678000199", razao_social: "Emp", banco_codigo: "341", agencia: "1", agencia_digito: "", conta: "1", digito_conta: "" },
        })
      ).rejects.toThrow("Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro antes da remessa.");
    });

    it("Lança erro se o lote se encontrar cancelado", async () => {
      const mockSupabase = (LoteFechamentoDiaristaService as any).supabase;

      vi.spyOn(mockSupabase, "from").mockImplementation((table: string) => {
        if (table === "diaristas_lotes_fechamento") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "lote-canc-1",
                empresa_id: "emp-1",
                tenant_id: "tenant-test-uuid",
                status: "CANCELADO",
                cancelado_em: new Date().toISOString(),
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      await expect(
        LoteFechamentoDiaristaService.gerarCNABParaLote({
          loteId: "lote-canc-1",
          empresaId: "emp-1",
          geradoPor: "user-1",
          geradoPorNome: "Operador",
          empresaRemetente: { cnpj: "12345678000199", razao_social: "Emp", banco_codigo: "341", agencia: "1", agencia_digito: "", conta: "1", digito_conta: "" },
        })
      ).rejects.toThrow("Geração de CNAB rejeitada: lote se encontra cancelado.");
    });
  });

  // =========================================================================
  // 3. REGRESSÃO: PRESERVAÇÃO CLT E INTERMITENTES
  // =========================================================================
  describe("3. Preservação dos Fluxos CLT e Intermitentes", () => {
    it("Fluxo CLT no drawer não é impactado pelas correções de Diaristas", () => {
      const mockItemClt: ItemObrigacaoBancariaOficial = {
        ...mockItemDiarista,
        origemTipo: "CLT",
        id: "clt-123",
        referencia: "CLT-2026-10",
      };

      render(
        <MemoryRouter>
          <CentralBancariaDrawerOficial
            item={mockItemClt}
            open={true}
            onOpenChange={() => {}}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("CLT")).toBeInTheDocument();
      expect(screen.getByText("Gerar Remessa CNAB")).toBeInTheDocument();
    });

    it("Fluxo Intermitentes no drawer não é impactado pelas correções de Diaristas", () => {
      const mockItemIntermitente: ItemObrigacaoBancariaOficial = {
        ...mockItemDiarista,
        origemTipo: "INTERMITENTES",
        id: "int-123",
        referencia: "INT-2026-10",
      };

      render(
        <MemoryRouter>
          <CentralBancariaDrawerOficial
            item={mockItemIntermitente}
            open={true}
            onOpenChange={() => {}}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("Intermitentes")).toBeInTheDocument();
      expect(screen.getByText("Gerar Remessa CNAB")).toBeInTheDocument();
    });
  });
});
