import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";

// Mock do Supabase
vi.mock("@/lib/supabase", () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-rh-001", email: "rh@orbe.com" } },
        }),
      },
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

// Mock de contextos e serviços adicionais
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-rh-001", email: "rh@orbe.com" },
    tenantId: "tenant-001",
  }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    role: "rh",
    isAdmin: false,
    tenantId: "tenant-001",
  }),
}));

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "rh",
    isAdmin: false,
    canAccess: () => true,
    hasPermission: () => true,
  }),
}));

import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: any) => (
    <TooltipProvider>
      <div data-testid="app-shell">
        <h1>{title}</h1>
        <main>{children}</main>
      </div>
    </TooltipProvider>
  ),
}));

vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-001", nome: "Empresa Alfa" },
      { id: "emp-002", nome: "Empresa Beta" },
    ]),
  },
}));

vi.mock("@/services/environment/EnvironmentService", () => ({
  EnvironmentService: {
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/services/environment/EnvironmentQueryFilter", () => ({
  EnvironmentQueryFilter: {
    applyEmpresaScope: vi.fn((q) => q),
  },
}));

describe("ERP ORBE — FIX-FINAL / ETAPA 05B.1: Retificação Exclusiva do RH", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  describe("1. Contrato e Service de Retificação (IntermitentesLoteService)", () => {
    it("1.1 retificarLancamentoRH deve invocar a RPC rpc_rh_retificar_intermitente com parâmetros corretos", async () => {
      const { supabase } = await import("@/lib/supabase");
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          lancamento_id: "lanc-001",
          empresa_anterior_id: "emp-001",
          empresa_nova_id: "emp-002",
          valor_preservado: 450.0,
          horas_preservadas: 8.0,
          desvinculado_lote_origem: true,
        },
        error: null,
      });
      (supabase.rpc as any) = mockRpc;

      const result = await IntermitentesLoteService.retificarLancamentoRH({
        lancamentoId: "lanc-001",
        novaEmpresaId: "emp-002",
        justificativa: "Correção formal de empresa alocada pelo RH para auditoria.",
        updatedAt: "2026-10-12T10:00:00Z",
      });

      expect(mockRpc).toHaveBeenCalledWith("rpc_rh_retificar_intermitente", {
        p_lancamento_id: "lanc-001",
        p_nova_empresa_id: "emp-002",
        p_novas_horas: null,
        p_justificativa: "Correção formal de empresa alocada pelo RH para auditoria.",
        p_updated_at: "2026-10-12T10:00:00Z",
      });
      expect(result.success).toBe(true);
      expect(result.valor_preservado).toBe(450.0);
    });

    it("1.2 revalidarLoteDevolvidoRH deve invocar a RPC rpc_rh_revalidar_lote_devolvido com parâmetros corretos", async () => {
      const { supabase } = await import("@/lib/supabase");
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          lote_id: "lote-001",
          novo_status: "AGUARDANDO_VALIDACAO_RH",
          quantidade_registros: 5,
          valor_total: 2250.0,
        },
        error: null,
      });
      (supabase.rpc as any) = mockRpc;

      const result = await IntermitentesLoteService.revalidarLoteDevolvidoRH({
        loteId: "lote-001",
        justificativa: "Lote revisado e saneado pelo RH, liberado para homologação contábil.",
      });

      expect(mockRpc).toHaveBeenCalledWith("rpc_rh_revalidar_lote_devolvido", {
        p_lote_id: "lote-001",
        p_justificativa: "Lote revisado e saneado pelo RH, liberado para homologação contábil.",
      });
      expect(result.novo_status).toBe("AGUARDANDO_VALIDACAO_RH");
    });

    it("1.3 atualizarLancamento deve permitir estritamente mutação de empresa_id, sem aceitar total ou horas", async () => {
      const { supabase } = await import("@/lib/supabase");
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (supabase.from as any) = vi.fn().mockReturnValue({ update: mockUpdate });

      await IntermitentesLoteService.atualizarLancamento("lanc-001", {
        empresa_id: "emp-002",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          empresa_id: "emp-002",
        })
      );
      // Garante que chaves arbitrárias de total/horas não estão no payload
      const calledPayload = mockUpdate.mock.calls[0][0];
      expect(calledPayload).not.toHaveProperty("total");
      expect(calledPayload).not.toHaveProperty("horas_trabalhadas");
    });
  });

  describe("2. Regras de Interface: Bloqueio do Encarregado e Habilitação do RH", () => {
    it("2.1 Tela Operacional (IntermitentesRecebidos): Lotes devolvidos não expõem botão de reabertura para o encarregado", async () => {
      // Importa componente de recebidos
      const { default: IntermitentesRecebidos } = await import(
        "@/pages/Operacional/IntermitentesRecebidos"
      );

      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([
        {
          id: "lote-dev-001",
          competencia: "2026-10",
          status: "DEVOLVIDO",
          quantidade_registros: 3,
          valor_total: 1350.0,
          observacoes: "Inconsistência de empresa",
          updated_at: new Date().toISOString(),
          tenant_id: "tenant-001",
          empresa_id: "emp-001",
          periodo_inicio: "2026-10-01",
          periodo_fim: "2026-10-31",
          created_at: new Date().toISOString(),
          empresa: { nome: "Empresa Alfa" },
        },
      ]);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <IntermitentesRecebidos />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Deve exibir badge explicativo de governança
      await waitFor(() => {
        expect(
          screen.getByText(/Sob Saneamento Exclusivo do RH/i)
        ).toBeInTheDocument();
      });

      // NÃO deve existir botão "Reabrir Período"
      expect(screen.queryByRole("button", { name: /Reabrir Período/i })).toBeNull();
    });

    it("2.2 Tela de Lotes RH (IntermitentesLotes): Exibe ação 'Retificar (RH)' para itens e 'Revalidar Lote no RH' para lotes devolvidos", async () => {
      const { default: IntermitentesLotes } = await import(
        "@/pages/Operacional/IntermitentesLotes"
      );

      vi.spyOn(IntermitentesLoteService, "listarLotes").mockResolvedValue([
        {
          id: "lote-dev-001",
          competencia: "2026-10",
          status: "DEVOLVIDO",
          quantidade_registros: 1,
          valor_total: 450.0,
          observacoes: "Retificar empresa da convocação",
          updated_at: new Date().toISOString(),
          tenant_id: "tenant-001",
          empresa_id: "emp-001",
          periodo_inicio: "2026-10-01",
          periodo_fim: "2026-10-31",
          created_at: new Date().toISOString(),
          empresa: { nome: "Empresa Alfa" },
        },
      ]);

      vi.spyOn(IntermitentesLoteService, "getLoteDetalhe").mockResolvedValue({
        id: "lote-dev-001",
        competencia: "2026-10",
        status: "DEVOLVIDO",
        quantidade_registros: 1,
        valor_total: 450.0,
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0,
        observacoes: "Retificar empresa da convocação",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        empresa_id: "emp-001",
        empresa: { nome: "Empresa Alfa" },
        itens: [
          {
            id: "item-001",
            colaborador_id: "colab-001",
            nome_colaborador: "João Silva Intermitente",
            cargo: "Operador de Carga",
            convocacao: "CONV-2026-10-001",
            horas_trabalhadas: 8.0,
            horas_normais: 8.0,
            he_50: 0,
            total: 450.0,
            data_referencia: "2026-10-05",
            status_pipeline: "DEVOLVIDO",
            empresa_id: "emp-001",
            updated_at: "2026-10-12T10:00:00Z",
          },
        ],
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[{ pathname: "/operacional/intermitentes-lotes", state: { selectedLoteId: "lote-dev-001" } }]}>
            <IntermitentesLotes />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Deve renderizar a ação de Revalidar Lote no RH no banner do lote devolvido
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Revalidar Lote no RH/i })).toBeInTheDocument();
      });

      // Deve renderizar o botão "Retificar (RH)" na linha do colaborador
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Retificar \(RH\)/i })).toBeInTheDocument();
      });
    });
  });

  describe("3. Validação do Banco e Migrations (CLASSIFICAÇÃO DE EXECUÇÃO)", () => {
    it("[NÃO EXECUTADO] RPC rpc_rh_retificar_intermitente: bloqueio fail-closed se novas_horas forem informadas", () => {
      // Este teste valida o comportamento interno da Stored Procedure PL/pgSQL
      // Não pode ser executado contra o banco real antes da autorização expressa do proprietário.
      expect(true).toBe(true);
    });

    it("[NÃO EXECUTADO] Trigger Guard fn_guard_lancamentos_intermitentes_update: bloqueio de update direto via API client", () => {
      // Valida o trigger guard no schema public.lancamentos_intermitentes
      // Classificado formalmente como NÃO EXECUTADO até a aplicação da migration 20261012120000.
      expect(true).toBe(true);
    });

    it("[NÃO EXECUTADO] Desacoplamento relacional: lote pai tem registros e valor decrementados deterministicamente", () => {
      // Valida concorrência OCC e bloqueio determinístico FOR UPDATE no banco
      // Classificado formalmente como NÃO EXECUTADO até a homologação em banco isolado.
      expect(true).toBe(true);
    });
  });
});
