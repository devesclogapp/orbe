import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import RetornoBancario from "@/pages/Financeiro/RetornoBancario";
import { ConciliacaoReceitasBlock } from "@/pages/Financeiro/components/ConciliacaoReceitasBlock";
import { OperacaoVolumeDrawer, OperacaoVolumeReal } from "@/components/operacoes/OperacaoVolumeDrawer";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock de AppShell e AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-01", email: "admin@orbe.com" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

// Mock de Tenant
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    role: "admin",
    currentTenant: { id: "tenant-esc-01" },
  }),
}));

// Mock de Access Control
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "admin",
    isAdmin: true,
    status: "ativo",
    permissions: {},
    loading: false,
    canAccess: () => true,
    refetch: vi.fn(),
  }),
}));

// Mock do BaseService
vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-esc-01"),
  };
});

// Mock de CnabRetornoService e ConciliacaoService
vi.mock("@/services/cnab/cnabRetorno.service", () => ({
  CnabRetornoService: {
    listarHistorico: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/services/financial.service", () => ({
  CNABService: {
    processRetorno: vi.fn(),
  },
  ConciliacaoService: {
    getItensRetorno: vi.fn().mockResolvedValue([]),
    getConciliacoesByArquivo: vi.fn().mockResolvedValue([]),
    conciliarItemRetorno: vi.fn(),
    reverterConciliacao: vi.fn(),
  },
}));

// Mock do Supabase
const mockReceitasData = [
  {
    id: "rec-001",
    tenant_id: "tenant-esc-01",
    empresa_id: "emp-teste-01",
    modalidade: "CAIXA_IMEDIATO",
    status: "recebido",
    valor_total: 42.0,
    created_at: "2026-10-17T12:00:00Z",
    updated_at: "2026-10-17T15:00:00Z",
    empresas: { nome: "Empresa Teste - Homologação" },
  },
  {
    id: "rec-002",
    tenant_id: "tenant-esc-01",
    empresa_id: "emp-outra-02",
    modalidade: "DUPLICATA",
    status: "conciliado",
    valor_total: 360.0,
    created_at: "2026-10-16T10:00:00Z",
    updated_at: "2026-10-17T14:00:00Z",
    empresas: { nome: "Empresa Secundária" },
  },
];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "receitas_operacionais") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: mockReceitasData,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "receitas_operacionais_itens") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "item-rec-01",
                  receita_id: "rec-001",
                  valor_item: 42.0,
                  receitas_operacionais: {
                    id: "rec-001",
                    status: "recebido",
                    modalidade: "CAIXA_IMEDIATO",
                    valor_total: 42.0,
                    data_recebimento: "2026-10-17",
                  },
                },
                error: null,
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("FIX-UX-03 — Navegação Financeira, Aba Faturamentos e Status Real de Conciliação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Central de Conciliações (RetornoBancario) — Seleção Automática de Abas", () => {
    it("1.1 Abre por padrão na aba 'Pagamentos & CNAB' quando acessado sem parâmetros (preserva CNAB)", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={["/financeiro/retorno"]}>
            <RetornoBancario />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Aba Pagamentos & CNAB deve estar selecionada
      expect(screen.getByRole("tab", { name: /Pagamentos & CNAB/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByText(/Passo 4 de 5 – Aguardar o Banco/i)).toBeInTheDocument();
    });

    it("1.2 Seleciona automaticamente 'Faturamentos (Receitas)' quando acessado com tab=receitas", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={["/financeiro/retorno?tab=receitas"]}>
            <RetornoBancario />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Aba Faturamentos (Receitas) deve estar selecionada
      expect(screen.getByRole("tab", { name: /Faturamentos \(Receitas\)/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByText(/Auditoria de Faturamento/i)).toBeInTheDocument();
    });

    it("1.3 Seleciona 'Faturamentos (Receitas)' quando origem=operacoes ou origem=receitas é informado", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={["/financeiro/retorno?origem=operacoes&empresaId=emp-teste-01"]}>
            <RetornoBancario />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole("tab", { name: /Faturamentos \(Receitas\)/i })).toHaveAttribute("data-state", "active");
    });
  });

  describe("2. ConciliacaoReceitasBlock — Destaque Contextual e Filtro de Empresa", () => {
    it("2.1 Filtra por empresa quando empresaId é informado na navegação", async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ConciliacaoReceitasBlock empresaId="emp-teste-01" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Empresa Teste - Homologação")).toBeInTheDocument();
      });

      // Empresa Secundária não deve aparecer pois o filtro é emp-teste-01
      expect(screen.queryByText("Empresa Secundária")).not.toBeInTheDocument();
    });

    it("2.2 Destaca a receita recebida quando highlightReceitaId é informado", async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ConciliacaoReceitasBlock highlightReceitaId="rec-001" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Empresa Teste - Homologação")).toBeInTheDocument();
      });

      // Deve exibir o badge animado de Foco no item destacado
      expect(screen.getByText("Foco")).toBeInTheDocument();
    });
  });

  describe("3. OperacaoVolumeDrawer — Separação Rigorosa entre Status Operacional e Conciliação", () => {
    const sampleOpConcluida: OperacaoVolumeReal = {
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
      status: "CONCLUIDO",
      status_rh: "VALIDADO_RH",
      status_pagamento: "RECEBIDO",
      data_pagamento: "2026-10-17",
      atualizado_em: "2026-10-17T12:00:00Z",
    };

    it("3.1 Apresenta 'Concluído (Conciliação Pendente)' quando receita não foi conciliada no extrato", async () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpConcluida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Badge no card contextual deve sinalizar conciliação pendente
      expect(screen.getByText("Concluído (Conciliação Pendente)")).toBeInTheDocument();

      // Textos contextuais devem ser precisos quanto à etapa
      expect(screen.getByText(/Operação concluída — Aguardando conciliação bancária/i)).toBeInTheDocument();
      expect(screen.getByText(/Controladoria \/ Conciliação Bancária/i)).toBeInTheDocument();
      expect(screen.getByText(/Localizar crédito no extrato bancário e confirmar a conciliação na Central Bancária\./i)).toBeInTheDocument();

      // CTA prioritário no card de situação deve ser "Abrir Conciliação"
      const btnConciliar = screen.getByRole("button", { name: /Abrir Conciliação/i });
      expect(btnConciliar).toBeInTheDocument();

      // Não deve ter botões duplicados no rodapé
      expect(screen.queryByRole("button", { name: /^Receitas$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^DRE$/i })).not.toBeInTheDocument();
    });

    it("3.2 Apresenta 'Ciclo Concluído & Conciliado' somente após confirmação da conciliação", () => {
      const sampleOpConciliada: OperacaoVolumeReal = {
        ...sampleOpConcluida,
        status_conciliacao: "conciliado",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpConciliada}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Badge deve confirmar ciclo conciliado
      expect(screen.getByText("Ciclo Concluído & Conciliado")).toBeInTheDocument();
      expect(screen.getByText(/Ciclo 100% concluído e conciliado/i)).toBeInTheDocument();
      expect(screen.getByText(/Processo finalizado \(Sem ações pendentes\)/i)).toBeInTheDocument();

      // Não exibe botão "Abrir Conciliação", pois já está conciliado
      expect(screen.queryByRole("button", { name: /Abrir Conciliação/i })).not.toBeInTheDocument();

      // Ação primária é Ver no DRE
      expect(screen.getByRole("button", { name: /Ver no DRE/i })).toBeInTheDocument();
    });
  });
});
