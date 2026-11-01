import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { OperacaoVolumeDrawer, OperacaoVolumeReal } from "@/components/operacoes/OperacaoVolumeDrawer";
import { OperacaoProducaoService } from "@/services/base.service";
import { toast } from "sonner";

// Mock de controle de acesso (AccessControlContext)
let mockRole = "admin";
let mockIsAdmin = true;

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: mockRole,
    isAdmin: mockIsAdmin,
    status: "ativo",
    permissions: {},
    loading: false,
    isBlocked: false,
    canAccess: () => true,
    refetch: vi.fn(),
  }),
}));

// Mock do Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "op-test-123",
              status: "AGUARDANDO_FATURAMENTO",
              status_rh: "PENDENTE_RH",
              atualizado_em: "2026-10-17T15:00:00Z",
            },
            error: null,
          }),
        })),
      })),
    })),
  },
}));

// Mock do Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleOperacaoRecebida: OperacaoVolumeReal = {
  id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
  codigo: "OP-0328D4A8",
  data_operacao: "2026-10-17",
  empresa_id: "emp-teste-01",
  empresa_nome: "Empresa Teste - Homologação",
  unidade_nome: "Galpão Principal",
  tipo_servico_nome: "Descarga",
  fornecedor_nome: "Fornecedor Alfa",
  transportadora_nome: "Transportadora Beta",
  placa: "ABC-1234",
  quantidade: 100,
  unidade_medida: "cx",
  valor_unitario_snapshot: 0.42,
  valor_descarga: 42.0,
  valor_total: 42.0,
  quantidade_colaboradores: 1,
  entrada_ponto: "08:00:00",
  saida_ponto: "12:00:00",
  status: "RECEBIDO",
  status_rh: "PENDENTE_RH",
  status_pagamento: "RECEBIDO",
  data_pagamento: "2026-10-17",
  atualizado_em: "2026-10-17T12:00:00Z",
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("FIX-LOTE2-01 — Aprovação Operacional no OperacaoVolumeDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "admin";
    mockIsAdmin = true;
  });

  // ── 1. TESTES DE PERMISSÃO POR PERFIL ──
  describe("1. Permissões por Perfil (RBAC)", () => {
    it("1.1 Admin pode visualizar e acionar o botão 'Aprovar Operação'", () => {
      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Operação/i });
      expect(btnAprovar).toBeInTheDocument();
    });

    it("1.2 Gestor e Financeiro podem visualizar o botão 'Aprovar Operação'", () => {
      mockRole = "gestor";
      mockIsAdmin = false;

      const { unmount } = render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole("button", { name: /Aprovar Operação/i })).toBeInTheDocument();
      unmount();

      mockRole = "financeiro";
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole("button", { name: /Aprovar Operação/i })).toBeInTheDocument();
    });

    it("1.3 Encarregado NÃO pode visualizar o botão 'Aprovar Operação'", () => {
      mockRole = "encarregado";
      mockIsAdmin = false;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });

    it("1.4 Usuário de RH NÃO pode visualizar a aprovação operacional", () => {
      mockRole = "rh";
      mockIsAdmin = false;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });
  });

  // ── 2. TESTES DE VISIBILIDADE POR ESTADO ──
  describe("2. Elegibilidade e Visibilidade por Estado", () => {
    it("2.1 Operação em RECEBIDO com horários válidos exibe o botão", () => {
      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole("button", { name: /Aprovar Operação/i })).toBeInTheDocument();
    });

    it("2.2 Operação em EM_RESTRICAO NÃO exibe o botão", () => {
      mockRole = "admin";
      mockIsAdmin = true;
      const opRestrita: OperacaoVolumeReal = {
        ...sampleOperacaoRecebida,
        status: "EM_RESTRICAO",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={opRestrita}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });

    it("2.3 Operação com horários incompletos NÃO exibe o botão", () => {
      mockRole = "admin";
      mockIsAdmin = true;
      const opSemHorario: OperacaoVolumeReal = {
        ...sampleOperacaoRecebida,
        entrada_ponto: null,
        saida_ponto: null,
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={opSemHorario}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });

    it("2.4 Operação já em AGUARDANDO_FATURAMENTO NÃO exibe o botão (já aprovada)", () => {
      mockRole = "admin";
      mockIsAdmin = true;
      const opAprovada: OperacaoVolumeReal = {
        ...sampleOperacaoRecebida,
        status: "AGUARDANDO_FATURAMENTO",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={opAprovada}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });

    it("2.5 Operação em estado terminal FATURADO ou CONCLUIDO NÃO exibe o botão", () => {
      mockRole = "admin";
      mockIsAdmin = true;
      const opConcluida: OperacaoVolumeReal = {
        ...sampleOperacaoRecebida,
        status: "CONCLUIDO",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={opConcluida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole("button", { name: /Aprovar Operação/i })).not.toBeInTheDocument();
    });
  });

  // ── 3. TESTES DE CONFIRMAÇÃO E FLUXO DE SUCESSO ──
  describe("3. Diálogo de Confirmação e Sucesso da Aprovação", () => {
    it("3.1 Clicar em 'Aprovar Operação' abre o modal de confirmação com detalhes", async () => {
      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Operação/i });
      fireEvent.click(btnAprovar);

      // Modal de confirmação aberto
      expect(screen.getByText(/Aprovar Operação Operacional\?/i)).toBeInTheDocument();
      expect(screen.getAllByText(/OP-0328D4A8/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Faturamento \/ Receitas/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar Aprovação/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    });

    it("3.2 Cancelar a confirmação não chama o service e fecha o modal", async () => {
      const aprovarSpy = vi.spyOn(OperacaoProducaoService, "aprovar");
      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

      expect(aprovarSpy).not.toHaveBeenCalled();
    });

    it("3.3 Confirmar aprovação chama OperacaoProducaoService.aprovar e exibe toast de sucesso", async () => {
      const aprovarSpy = vi.spyOn(OperacaoProducaoService, "aprovar").mockResolvedValue({
        success: true,
        operacao_id: sampleOperacaoRecebida.id,
        status: "AGUARDANDO_FATURAMENTO",
        status_rh: "PENDENTE_RH",
        updated_at: "2026-10-17T15:00:00Z",
      });

      const onUpdatedMock = vi.fn();
      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
              onOperacaoUpdated={onUpdatedMock}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

      await waitFor(() => {
        expect(aprovarSpy).toHaveBeenCalledWith(
          sampleOperacaoRecebida.id,
          sampleOperacaoRecebida.atualizado_em
        );
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Operação aprovada com sucesso!",
          expect.objectContaining({
            description: expect.stringContaining("faturamento"),
          })
        );
      });

      expect(onUpdatedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "AGUARDANDO_FATURAMENTO",
        })
      );
    });
  });

  // ── 4. TRATAMENTO DE ERROS E CASOS DE BORDA ──
  describe("4. Tratamento de Exceções e Resiliência", () => {
    it("4.1 Trata CONCURRENCY_CONFLICT exibindo aviso específico", async () => {
      vi.spyOn(OperacaoProducaoService, "aprovar").mockRejectedValue(
        new Error("CONCURRENCY_CONFLICT: O registro de operação alterou na base.")
      );

      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Conflito de Concorrência",
          expect.objectContaining({
            description: expect.stringContaining("alterada por outro usuário ou processo"),
          })
        );
      });
    });

    it("4.2 Trata ESTADO_FECHADO exibindo aviso de operação imutável", async () => {
      vi.spyOn(OperacaoProducaoService, "aprovar").mockRejectedValue(
        new Error("ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro.")
      );

      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Operação Imutável",
          expect.objectContaining({
            description: expect.stringContaining("processada"),
          })
        );
      });
    });

    it("4.3 Trata PERMISSION_DENIED exibindo aviso de falta de permissão", async () => {
      vi.spyOn(OperacaoProducaoService, "aprovar").mockRejectedValue(
        new Error("PERMISSION_DENIED: Perfil não possui autorização.")
      );

      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Permissão Negada",
          expect.objectContaining({
            description: expect.stringContaining("não possui autorização"),
          })
        );
      });
    });

    it("4.4 Trata restrição operacional exibindo aviso específico", async () => {
      vi.spyOn(OperacaoProducaoService, "aprovar").mockRejectedValue(
        new Error("OPERACAO_EM_RESTRICAO: Operação possui restrições pendentes.")
      );

      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Restrição Operacional",
          expect.objectContaining({
            description: expect.stringContaining("pendências operacionais"),
          })
        );
      });
    });

    it("4.5 Previne cliques múltiplos durante o processamento (dupla submissão)", async () => {
      let resolvePromise: any;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const aprovarSpy = vi.spyOn(OperacaoProducaoService, "aprovar").mockReturnValue(pendingPromise as any);

      mockRole = "admin";
      mockIsAdmin = true;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOperacaoRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /Aprovar Operação/i }));
      const btnConfirmar = screen.getByRole("button", { name: /Confirmar Aprovação/i });

      // Primeiro clique
      fireEvent.click(btnConfirmar);
      expect(aprovarSpy).toHaveBeenCalledTimes(1);

      // Enquanto pendente, botão fica desabilitado
      expect(btnConfirmar).toBeDisabled();

      // Segundo clique acidental
      fireEvent.click(btnConfirmar);
      expect(aprovarSpy).toHaveBeenCalledTimes(1); // Não disparou novamente

      // Resolve a promessa
      resolvePromise({ success: true, status: "AGUARDANDO_FATURAMENTO" });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });
  });
});
