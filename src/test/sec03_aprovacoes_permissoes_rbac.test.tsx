import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AprovacaoDecisaoDrawer, ApprovalItem } from "@/components/aprovacoes/AprovacaoDecisaoDrawer";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { AccessControlContext } from "@/contexts/AccessControlContext";
import { buildPresetPermissions, normalizePermissionMatrix, canAccessModule } from "@/lib/access-control";

// Mock do OperacaoProducaoService
vi.mock("@/services/domain/producao.service", () => ({
  OperacaoProducaoService: {
    getByIdWithDetails: vi.fn(),
  },
}));

// Mock do Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("SEC-03 — Permissões de Aprovação na Central de Aprovações (RBAC / Fail-Closed)", () => {
  const itemPonto: ApprovalItem = {
    id: "ponto-test-123",
    tipo: "PONTO",
    referencia: "Ponto CLT 2026-10",
    colaborador: "João da Silva",
    descricao: "Inconsistência de Batida",
    empresa: "ESC Logística",
    operacao: "Apontamento",
    valor: 0,
    horas: "8.5h",
    competencia: "2026-10",
    data_recebimento: "2026-10-20T10:00:00Z",
    raw_status: "PENDENTE",
    situacao: "Em análise",
    empresa_id: "emp-1",
    filter_data: "2026-10-20",
    raw_lote_id: null,
  };

  const itemOperacao: ApprovalItem = {
    id: "op-test-456",
    tipo: "OPERAÇÃO",
    referencia: "OP-456",
    colaborador: "ESC Logística",
    descricao: "Descarga 500 caixas",
    empresa: "ESC Logística",
    operacao: "Descarga",
    valor: 250.0,
    horas: "—",
    competencia: "2026-10",
    data_recebimento: "2026-10-20T11:00:00Z",
    raw_status: "AGUARDANDO_FATURAMENTO",
    situacao: "Em análise",
    empresa_id: "emp-1",
    filter_data: "2026-10-20",
    raw_lote_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (OperacaoProducaoService.getByIdWithDetails as any).mockResolvedValue({
      id: "op-test-456",
      status: "AGUARDANDO_FATURAMENTO",
      status_rh: "PENDENTE_RH",
      entrada_ponto: "08:00:00",
      saida_ponto: "17:00:00",
    });
  });

  describe("1. Matriz de Permissões: Resolução de Permissão Efetiva", () => {
    it("1.1 Preset RH padrão concede 'aprovar' no módulo 'processamento_rh'", () => {
      const presetRh = buildPresetPermissions("rh");
      expect(canAccessModule(presetRh, "processamento_rh", "ver")).toBe(true);
      expect(canAccessModule(presetRh, "processamento_rh", "aprovar")).toBe(true);
    });

    it("1.2 Permissão customizada exclusivamente 'ver' revoga 'aprovar' para o usuário RH", () => {
      const customPermissions = {
        processamento_rh: {
          ver: true,
          aprovar: false,
          processar: false,
          exportar: false,
        },
      };

      const effectiveMatrix = normalizePermissionMatrix(customPermissions, "rh");
      expect(canAccessModule(effectiveMatrix, "processamento_rh", "ver")).toBe(true);
      expect(canAccessModule(effectiveMatrix, "processamento_rh", "aprovar")).toBe(false);
    });

    it("1.3 Perfil Admin sempre possui 'aprovar' concedido incondicionalmente", () => {
      const adminMatrix = buildPresetPermissions("admin");
      expect(canAccessModule(adminMatrix, "processamento_rh", "aprovar")).toBe(true);
      expect(canAccessModule(adminMatrix, "processamento_rh", "ver")).toBe(true);
    });
  });

  describe("2. Cenário 1: Usuário RH com Permissão Exclusiva de Leitura (canApprove = false)", () => {
    it("2.1 Desabilita o botão 'Devolver' e impede ação de devolução", async () => {
      const onDevolverMock = vi.fn();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemPonto}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={vi.fn()}
              onDevolver={onDevolverMock}
              isAprovando={false}
              isDevolvendo={false}
              canApprove={false}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const btnDevolver = screen.getByRole("button", { name: /Devolver/i });
      expect(btnDevolver).toBeDisabled();
      expect(btnDevolver).toHaveAttribute("title", expect.stringContaining("somente leitura"));

      fireEvent.click(btnDevolver);
      expect(onDevolverMock).not.toHaveBeenCalled();
    });

    it("2.2 Bloqueia o botão 'Aprovar Decisão' e exibe aviso de somente leitura", async () => {
      const onAprovarMock = vi.fn();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemPonto}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={onAprovarMock}
              onDevolver={vi.fn()}
              isAprovando={false}
              isDevolvendo={false}
              canApprove={false}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Deve renderizar o botão desabilitado com o rótulo de bloqueio por leitura
      const btnBloqueado = screen.getByRole("button", { name: /Aprovação Não Autorizada \(Somente Leitura\)/i });
      expect(btnBloqueado).toBeInTheDocument();
      expect(btnBloqueado).toBeDisabled();

      fireEvent.click(btnBloqueado);
      expect(onAprovarMock).not.toHaveBeenCalled();

      // Deve exibir a faixa de aviso no header do Drawer
      expect(screen.getByText(/Modo Somente Leitura/i)).toBeInTheDocument();
    });
  });

  describe("3. Cenário 2: Usuário RH com Permissão de Aprovação Concedida (canApprove = true)", () => {
    it("3.1 Mantém botões 'Devolver' e 'Aprovar Decisão' habilitados para execução", async () => {
      const onAprovarMock = vi.fn();
      const onDevolverMock = vi.fn();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemOperacao}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={onAprovarMock}
              onDevolver={onDevolverMock}
              isAprovando={false}
              isDevolvendo={false}
              canApprove={true}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Decisão/i })).toBeInTheDocument();
      });

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Decisão/i });
      const btnDevolver = screen.getByRole("button", { name: /Devolver/i });

      expect(btnAprovar).not.toBeDisabled();
      expect(btnDevolver).not.toBeDisabled();

      fireEvent.click(btnAprovar);
      expect(onAprovarMock).toHaveBeenCalledWith(itemOperacao);
    });
  });

  describe("4. Cenário 3: Administrador (Admin)", () => {
    it("4.1 Contexto com role 'admin' resolve canApprove = true e autoriza decisões", async () => {
      const onAprovarMock = vi.fn();

      const mockAdminContext: any = {
        role: "admin",
        isAdmin: true,
        status: "ativo",
        permissions: buildPresetPermissions("admin"),
        loading: false,
        isBlocked: false,
        canAccess: () => true,
        refetch: vi.fn(),
      };

      render(
        <AccessControlContext.Provider value={mockAdminContext}>
          <QueryClientProvider client={createTestQueryClient()}>
            <MemoryRouter>
              <AprovacaoDecisaoDrawer
                item={itemOperacao}
                open={true}
                onOpenChange={vi.fn()}
                onAprovar={onAprovarMock}
                onDevolver={vi.fn()}
                isAprovando={false}
                isDevolvendo={false}
              />
            </MemoryRouter>
          </QueryClientProvider>
        </AccessControlContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Decisão/i })).toBeInTheDocument();
      });

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Decisão/i });
      expect(btnAprovar).not.toBeDisabled();

      fireEvent.click(btnAprovar);
      expect(onAprovarMock).toHaveBeenCalledWith(itemOperacao);
    });
  });
});

