import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CentralBancariaDrawerOficial } from "@/components/bancario/CentralBancariaDrawerOficial";
import { ItemObrigacaoBancariaOficial } from "@/services/bancarioOficialAdapter";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  getRouteAccessRule,
  canAccessModule,
  isRouteForbiddenForRole,
  ACCESS_PRESETS,
} from "@/lib/access-control";

// Mock do Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock do EnvironmentService
vi.mock("@/services/environment/EnvironmentService", () => ({
  EnvironmentService: {
    getCurrentEnvironment: vi.fn(() => "production"),
  },
}));

describe("CONV-17 / FIX 01 — Testes Comportamentais de Contratos CNAB e Segurança de Rotas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockItemIntermitente: ItemObrigacaoBancariaOficial = {
    id: "int-12345678",
    referencia: "INT-2026/10",
    origemTipo: "INTERMITENTES",
    loteId: "12345678-aaaa-bbbb-cccc-1234567890ab",
    loteCodigo: "INT-12345678",
    empresaId: "22222222-2222-2222-2222-222222222222",
    empresaNome: "Empresa Teste Logística",
    isEmpresaTeste: false,
    competencia: "2026-10",
    favorecidoDescricao: "5 Intermitentes Convocados",
    favorecidoNomeMascarado: "Remuneração Contrato Intermitente",
    documentoFavorecidoMascarado: "Contas Corrente Diversas",
    dadosBancariosFavorecidoMascarado: "Transferência Bancária TED/PIX",
    quantidadeFavorecidos: 5,
    valorTotal: 12500,
    valorEsperado: 12500,
    contaPagadora: {
      id: "33333333-3333-3333-3333-333333333333",
      empresaId: "22222222-2222-2222-2222-222222222222",
      bancoCodigo: "001",
      bancoNome: "Banco do Brasil",
      agencia: "1234",
      agenciaMascarada: "1234",
      conta: "56789",
      contaMascarada: "56789-0",
      cedenteNome: "Empresa Teste Logística",
      cedenteCnpjMascarado: "12.***.***/0001-**",
      permiteCnab: true,
      ativo: true,
    },
    situacao: "PRONTO_BANCO",
    estagioTab: "PRONTAS_BANCO",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      qtdFavorecidosAptos: 5,
      qtdFavorecidosInaptos: 0,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [],
  };

  const mockItemDiarista: ItemObrigacaoBancariaOficial = {
    ...mockItemIntermitente,
    id: "dia-87654321",
    referencia: "DIA-2026/W40",
    origemTipo: "DIARISTAS",
    loteId: "87654321-bbbb-cccc-dddd-1234567890cd",
  };

  // =========================================================================
  // 1. COMPORTAMENTO CNAB — INTERMITENTES
  // =========================================================================
  describe("1. Geração CNAB Intermitentes (Contrato Canônico)", () => {
    it("Chama diretamente IntermitentesLoteService.gerarCNABParaLote com os parâmetros corretos", async () => {
      // Mock da sessão de usuário
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-operador-123",
            email: "financeiro@esclog.com.br",
          } as any,
        },
        error: null,
      });

      // Mock da busca de conta bancária e empresa
      const mockFrom = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "contas_bancarias_empresa") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "33333333-3333-3333-3333-333333333333",
                empresa_id: "22222222-2222-2222-2222-222222222222",
                banco_codigo: "001",
                agencia: "1234",
                agencia_digito: "5",
                conta: "56789",
                conta_digito: "0",
                convenio: "1234567",
                cedente_cnpj: "12345678000199",
                cedente_nome: "Empresa Teste Logística",
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
                id: "22222222-2222-2222-2222-222222222222",
                nome: "Empresa Teste Logística",
                cnpj: "12345678000199",
              },
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      // Mock do método canônico
      const spyGerarCNAB = vi
        .spyOn(IntermitentesLoteService, "gerarCNABParaLote")
        .mockResolvedValue({
          nomeArquivo: "CB091001.REM",
          totalRegistros: 5,
          valorTotal: 12500,
        });

      render(
        <BrowserRouter>
          <CentralBancariaDrawerOficial
            item={mockItemIntermitente}
            open={true}
            onOpenChange={vi.fn()}
          />
        </BrowserRouter>
      );

      // Clica no botão "Gerar Remessa CNAB" para abrir o modal de confirmação
      const btnGerarModal = screen.getByText("Gerar Remessa CNAB");
      fireEvent.click(btnGerarModal);

      // No modal de confirmação, clica em "Confirmar e Gerar Remessa"
      const btnConfirmar = screen.getByText("Confirmar e Gerar Remessa");
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyGerarCNAB).toHaveBeenCalledTimes(1);
      });

      expect(spyGerarCNAB).toHaveBeenCalledWith({
        loteId: "12345678-aaaa-bbbb-cccc-1234567890ab",
        empresaId: "22222222-2222-2222-2222-222222222222",
        geradoPor: "user-operador-123",
        geradoPorNome: "financeiro@esclog.com.br",
        empresaRemetente: {
          cnpj: "12345678000199",
          razao_social: "Empresa Teste Logística",
          banco_codigo: "001",
          agencia: "1234",
          agencia_digito: "5",
          conta: "56789",
          digito_conta: "0",
          convenio_bancario: "1234567",
        },
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Remessa CNAB de Intermitentes gerada com sucesso: CB091001.REM")
      );
    }, 15000);

    it("Ausência de sessão de usuário autenticado bloqueia a operação (fail-closed)", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const spyGerarCNAB = vi.spyOn(IntermitentesLoteService, "gerarCNABParaLote");

      render(
        <BrowserRouter>
          <CentralBancariaDrawerOficial
            item={mockItemIntermitente}
            open={true}
            onOpenChange={vi.fn()}
          />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText("Gerar Remessa CNAB"));
      fireEvent.click(screen.getByText("Confirmar e Gerar Remessa"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Sessão de usuário não autenticada")
        );
      });

      expect(spyGerarCNAB).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. COMPORTAMENTO CNAB — DIARISTAS
  // =========================================================================
  describe("2. Geração CNAB Diaristas (Isolamento de Domínio)", () => {
    it("Chama LoteFechamentoDiaristaService.gerarCNABParaLote e não afeta Intermitentes", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-diaristas-456",
            email: "rh@esclog.com.br",
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "contas_bancarias_empresa") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "33333333-3333-3333-3333-333333333333",
                banco_codigo: "001",
                agencia: "1234",
                conta: "56789",
                cedente_cnpj: "12345678000199",
                cedente_nome: "Empresa Teste Logística",
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
                id: "22222222-2222-2222-2222-222222222222",
                nome: "Empresa Teste Logística",
                cnpj: "12345678000199",
              },
              error: null,
            }),
          } as any;
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any;
      });

      const spyDiaristas = vi
        .spyOn(LoteFechamentoDiaristaService, "gerarCNABParaLote")
        .mockResolvedValue({
          nomeArquivo: "DIA09101.REM",
          totalRegistros: 8,
          valorTotal: 18000,
        });
      const spyIntermitentes = vi.spyOn(IntermitentesLoteService, "gerarCNABParaLote");

      render(
        <BrowserRouter>
          <CentralBancariaDrawerOficial
            item={mockItemDiarista}
            open={true}
            onOpenChange={vi.fn()}
          />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText("Gerar Remessa CNAB"));
      fireEvent.click(screen.getByText("Confirmar e Gerar Remessa"));

      await waitFor(() => {
        expect(spyDiaristas).toHaveBeenCalledTimes(1);
      });

      expect(spyIntermitentes).not.toHaveBeenCalled();
      expect(spyDiaristas).toHaveBeenCalledWith(
        expect.objectContaining({
          loteId: "87654321-bbbb-cccc-dddd-1234567890cd",
          contaBancariaId: "33333333-3333-3333-3333-333333333333",
        })
      );
    });
  });

  // =========================================================================
  // 3. SEGURANÇA E MAPEAMENTO DE ROTAS (BLOCO 2)
  // =========================================================================
  describe("3. Segurança de Rotas e Matriz de Permissões", () => {
    it("/intermitentes/lotes está mapeado para operacoes_recebidas e bloqueia encarregado", () => {
      const rule = getRouteAccessRule("/intermitentes/lotes");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("operacoes_recebidas");

      const encarregadoPerms = ACCESS_PRESETS.encarregado;
      expect(canAccessModule(encarregadoPerms, "operacoes_recebidas")).toBe(false);

      const gestorPerms = ACCESS_PRESETS.gestor;
      expect(canAccessModule(gestorPerms, "operacoes_recebidas")).toBe(true);
    });

    it("/intermitentes/inconsistencias está mapeado para operacoes_recebidas e bloqueia encarregado", () => {
      const rule = getRouteAccessRule("/intermitentes/inconsistencias");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("operacoes_recebidas");

      const encarregadoPerms = ACCESS_PRESETS.encarregado;
      expect(canAccessModule(encarregadoPerms, "operacoes_recebidas")).toBe(false);
    });

    it("/inconsistencias está mapeado para fechamento_mensal e permite RH e Financeiro, bloqueando Encarregado", () => {
      const rule = getRouteAccessRule("/inconsistencias");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("fechamento_mensal");

      // RH tem fechamento_mensal
      expect(canAccessModule(ACCESS_PRESETS.rh, "fechamento_mensal")).toBe(true);

      // Financeiro tem fechamento_mensal
      expect(canAccessModule(ACCESS_PRESETS.financeiro, "fechamento_mensal")).toBe(true);

      // Gestor tem fechamento_mensal
      expect(canAccessModule(ACCESS_PRESETS.gestor, "fechamento_mensal")).toBe(true);

      // Encarregado NÃO tem fechamento_mensal
      expect(canAccessModule(ACCESS_PRESETS.encarregado, "fechamento_mensal")).toBe(false);

      // E possui bloqueio explícito em isRouteForbiddenForRole
      expect(isRouteForbiddenForRole("encarregado", "/inconsistencias")).toBe(true);
      expect(isRouteForbiddenForRole("encarregado", "/inconsistencias/detalhe")).toBe(true);
      expect(isRouteForbiddenForRole("rh", "/inconsistencias")).toBe(false);
    });
  });
});
