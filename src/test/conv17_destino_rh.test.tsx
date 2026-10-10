import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AprovacoesRh from "@/pages/Rh/AprovacoesRh";
import { AprovacoesService } from "@/services/domain/aprovacoes.service";

// Mock das dependências contextuais
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-rh-01", email: "rh@esclog.com" } }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ role: "RH", isAdmin: true }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({ openPipeline: vi.fn() }),
  buildServicosExtrasPipeline: vi.fn(),
}));

vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-castanhal", nome: "Operacional,Castanhal" },
      { id: "emp-benevides", nome: "BENEVIDES" },
    ]),
  },
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    validarLote: vi.fn().mockResolvedValue(true),
    devolverLote: vi.fn().mockResolvedValue(true),
    verificarCompletudeLote: vi.fn().mockResolvedValue({ podeAprovar: true, pendencias: [] }),
    getLoteDetalhe: vi.fn().mockResolvedValue({
      id: "6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c",
      competencia: "2026-08",
      empresa_id: "emp-castanhal",
      status: "AGUARDANDO_VALIDACAO_RH",
      quantidade_registros: 3,
      valor_total: 184.08,
      itens: [],
    }),
  },
}));

describe("CONV-17 — Verificação Final do Destino RH (Lote 6e48aa)", () => {
  let queryClient: QueryClient;

  const mockLote6e48aa = {
    id: "6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c",
    tipo: "INTERMITENTE" as const,
    referencia: "Lote 6e48aa",
    colaborador: "Lote com 3 registros",
    descricao: "Fechamento Intermitentes",
    empresa: "Operacional,Castanhal",
    operacao: "Folha Intermitente",
    valor: 184.08,
    horas: "-",
    competencia: "2026-08",
    data_recebimento: "2026-08-30T02:12:25.39967+00:00",
    raw_status: "AGUARDANDO_VALIDACAO_RH",
    empresa_id: "emp-castanhal",
    filter_data: "2026-08-01",
    raw_lote_id: null,
    situacao: "Em análise" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  it("1.1 Central de Aprovações busca tipo='INTERMITENTE' quando renderizada via /intermitentes/aprovacoes (flowType='INTERMITENTE')", async () => {
    const getSpy = vi.spyOn(AprovacoesService, "getAprovacoesRh").mockResolvedValue({
      data: [mockLote6e48aa as any],
      count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/intermitentes/aprovacoes"]}>
          <AprovacoesRh flowType="INTERMITENTE" lockedFlow={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "INTERMITENTE",
          situacao: undefined,
        })
      );
    });
  });

  it("1.2 Lote 6e48aa é renderizado na tabela e na contagem de decisões pendentes", async () => {
    vi.spyOn(AprovacoesService, "getAprovacoesRh").mockResolvedValue({
      data: [mockLote6e48aa as any],
      count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/intermitentes/aprovacoes"]}>
          <AprovacoesRh flowType="INTERMITENTE" lockedFlow={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Lote 6e48aa").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Operacional,Castanhal").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Lote com 3 registros").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("1.3 Navegação contextual via CTA 'Ir para Validação RH' abre automaticamente o Drawer de Decisão do Lote 6e48aa", async () => {
    vi.spyOn(AprovacoesService, "getAprovacoesRh").mockResolvedValue({
      data: [mockLote6e48aa as any],
      count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/intermitentes/aprovacoes",
              state: {
                selectedLoteId: "6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c",
                loteId: "6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c",
                empresaId: "emp-castanhal",
                competencia: "2026-08",
              },
            },
          ]}
        >
          <AprovacoesRh flowType="INTERMITENTE" lockedFlow={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(
      () => {
        // O drawer deve estar aberto exibindo o botão de Aprovar Lote e Devolver
        expect(screen.getByRole("button", { name: /Aprovar Lote/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Devolver$/i })).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });

  it("1.4 Lote 6e48aa é elegível para decisão no Drawer e exibe badge de Aguardando Decisão", async () => {
    vi.spyOn(AprovacoesService, "getAprovacoesRh").mockResolvedValue({
      data: [mockLote6e48aa as any],
      count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/intermitentes/aprovacoes",
              state: {
                selectedLoteId: "6e48aa95-4f0e-43db-bf2b-5e39ea7dd53c",
              },
            },
          ]}
        >
          <AprovacoesRh flowType="INTERMITENTE" lockedFlow={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(
      () => {
        expect(screen.getAllByText("Aguardando Decisão").length).toBeGreaterThanOrEqual(1);
        const btnAprovar = screen.getByRole("button", { name: /Aprovar Lote/i });
        expect(btnAprovar).not.toBeDisabled();
      },
      { timeout: 4000 }
    );
  });
});
