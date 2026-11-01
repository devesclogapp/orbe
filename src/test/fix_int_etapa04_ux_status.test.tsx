import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";

// Mock dos dados de intermitentes
const mockIntermitentes = [
  {
    id: "lanc-01",
    data_referencia: "2026-10-05",
    empresa_id: "emp-benevides",
    empresas: { nome: "BENEVIDES" },
    nome_colaborador: "CARLOS SILVA",
    colaboradores: { nome: "CARLOS SILVA" },
    cargo: "Auxiliar Operacional",
    convocacao: "CONV-01",
    horas_trabalhadas: 8,
    horas_normais: 8,
    he_50: 0,
    he_100: 0,
    hora_noturna: 0,
    total: 200,
    status_pipeline: "RECEBIDO",
    origem: "TIO DIGITAL",
    lote_fechamento_id: null,
  },
  {
    id: "lanc-02",
    data_referencia: "2026-10-06",
    empresa_id: "emp-benevides",
    empresas: { nome: "BENEVIDES" },
    nome_colaborador: "MARCOS SOUZA",
    colaboradores: { nome: "MARCOS SOUZA" },
    cargo: "Conferente",
    convocacao: "CONV-02",
    horas_trabalhadas: 8,
    horas_normais: 8,
    he_50: 0,
    he_100: 0,
    hora_noturna: 0,
    total: 250,
    status_pipeline: "RECEBIDO",
    origem: "TIO DIGITAL",
    lote_fechamento_id: null,
  },
  {
    id: "lanc-03",
    data_referencia: "2026-10-07",
    empresa_id: "emp-benevides",
    empresas: { nome: "BENEVIDES" },
    nome_colaborador: "GABRIEL LIMA",
    colaboradores: { nome: "GABRIEL LIMA" },
    cargo: "Operador de Empilhadeira",
    convocacao: "CONV-03",
    horas_trabalhadas: 8,
    horas_normais: 8,
    he_50: 0,
    he_100: 0,
    hora_noturna: 0,
    total: 220,
    status_pipeline: "DEVOLVIDO",
    origem: "TIO DIGITAL",
    motivo_devolucao: "Divergência de convocação com ponto eletrônico",
    lote_fechamento_id: "lote-dev-01",
  },
  {
    id: "lanc-04",
    data_referencia: "2026-10-08",
    empresa_id: "emp-benevides",
    empresas: { nome: "BENEVIDES" },
    nome_colaborador: "ANA SOUZA",
    colaboradores: { nome: "ANA SOUZA" },
    cargo: "Auxiliar Operacional",
    convocacao: "CONV-04",
    horas_trabalhadas: 8,
    horas_normais: 8,
    he_50: 0,
    he_100: 0,
    hora_noturna: 0,
    total: 180,
    status_pipeline: "APROVADO_RH",
    origem: "TIO DIGITAL",
    lote_fechamento_id: "lote-aprov-01",
  },
];

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) =>
          resolve({
            data: mockIntermitentes,
            error: null,
          })
        ),
      })),
    },
  };
});

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-op-1", email: "operacional@esclog.com.br", role: "admin" },
  }),
}));

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "admin",
    isAdmin: true,
    canAccess: () => true,
    hasPermission: () => true,
    userRole: "admin",
  }),
}));

// Mock AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: any) => (
    <div data-testid="app-shell">
      <h1>{title}</h1>
      <main>{children}</main>
    </div>
  ),
}));

// Mock services
vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockResolvedValue([
      { id: "emp-benevides", nome: "BENEVIDES" },
      { id: "emp-castanhal", nome: "CASTANHAL" },
    ]),
  },
}));

vi.mock("@/services/environment/EnvironmentService", () => ({
  EnvironmentService: {
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    getCurrentEnvironment: vi.fn().mockReturnValue("production"),
  },
}));

vi.mock("@/services/domain/base.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-esc-log"),
  };
});

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    listarLotes: vi.fn().mockResolvedValue([]),
    fecharPeriodo: vi.fn().mockResolvedValue([
      {
        id: "lote-01",
        empresa_id: "emp-benevides",
        competencia: "2026-10",
        quantidade_registros: 2,
        valor_total: 450.0,
        status: "AGUARDANDO_VALIDACAO_RH",
        auditoriaConfirmada: true,
      },
    ]),
    getResumoLoteIntermitente: vi.fn().mockResolvedValue({
      loteId: "lote-01",
      quantidadeTotal: 2,
      valorTotal: 450.0,
      itensProcessados: 2,
      itensDevolvidos: 0,
      itensPendentes: 0,
      consistente: true,
      auditoriaStatus: "CONFIRMADA",
    }),
    reabrirLote: vi.fn().mockResolvedValue(true),
    atualizarLancamento: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import IntermitentesRecebidos from "@/pages/Operacional/IntermitentesRecebidos";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import {
  IntermitentesTableBlock,
  getIntermitenteStatusBadge,
  IntermitenteItem,
} from "@/components/operacoes/IntermitentesTableBlock";

describe("ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.pointerEvents = "";
    document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => el.remove());
    document.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
  });
  // ───────────────────────────────────────────────────────────────────────────
  // 1. FIX-INT-03: CONFIRMAÇÃO E PREVENÇÃO DE AÇÕES REPETIDAS
  // ───────────────────────────────────────────────────────────────────────────
  it("1. FIX-INT-03: Substitui confirm() nativo por Diálogo Oficial com resumo, impacto e botões", async () => {

    const windowConfirmSpy = vi.spyOn(window, "confirm");

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/operacional/intermitentes",
                search: "?competencia=2026-10&empresaId=emp-benevides",
                state: { competencia: "2026-10", empresaId: "emp-benevides" },
              },
            ]}
          >
            <IntermitentesRecebidos />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument();
    });

    if (screen.queryByText(/Falha ao carregar/i)) {
      console.log("ERRO NA QUERY:", screen.getByText(/Falha ao carregar/i).textContent);
    }
    if (screen.queryByText(/Nenhum registro/i)) {
      console.log("TABELA VAZIA:", screen.getByText(/Nenhum registro/i).textContent);
    }

    await waitFor(() => {
      expect(screen.getByText("CARLOS SILVA")).toBeInTheDocument();
    });

    const fecharBtn = screen.getByRole("button", {
      name: /Fechar Período Intermitente/i,
    });
    expect(fecharBtn).toBeInTheDocument();

    fireEvent.click(fecharBtn);

    // Garante que o confirm() nativo NÃO foi chamado
    expect(windowConfirmSpy).not.toHaveBeenCalled();

    // Diálogo canônico do Design System foi aberto
    expect(screen.getByText("Confirmar Fechamento de Período")).toBeInTheDocument();
    expect(screen.getByText("Revise os dados antes de consolidar o lote para a Validação do RH.")).toBeInTheDocument();

    // Resumo exibido no diálogo
    expect(screen.getAllByText("BENEVIDES").length).toBeGreaterThan(0);
    expect(screen.getByText("2 apontamentos")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*450,00/).length).toBeGreaterThan(0);

    // Aviso de impacto operacional explícito
    expect(screen.getByText("Aviso de Impacto Operacional:")).toBeInTheDocument();

    // Botões Cancelar e Confirmar
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Fechamento/i });
    expect(cancelBtn).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    // Clicar em confirmar executa a mutation
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(IntermitentesLoteService.fecharPeriodo).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByText("Confirmar Fechamento de Período")).not.toBeInTheDocument();
    });

    // Fecha o modal de resumo pós-fechamento
    const entendiBtn = await screen.findByRole("button", { name: "Entendi" });
    fireEvent.click(entendiBtn);

    await waitFor(() => {
      expect(screen.queryByText("Período fechado com sucesso")).not.toBeInTheDocument();
    });
  });

  it("2. FIX-INT-03: Previne requisições concorrentes e desabilita botões durante fechamento", async () => {
    let resolveFechamento: any;
    const fecharPromise = new Promise((resolve) => {
      resolveFechamento = resolve;
    });
    (IntermitentesLoteService.fecharPeriodo as any).mockReturnValueOnce(fecharPromise);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/operacional/intermitentes",
              search: "?competencia=2026-10&empresaId=emp-benevides",
              state: { competencia: "2026-10", empresaId: "emp-benevides" },
            },
          ]}
        >
          <TooltipProvider>
            <IntermitentesRecebidos />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("CARLOS SILVA")).toBeInTheDocument();
    });

    const fecharBtn = screen.getByRole("button", { name: /Fechar Período Intermitente/i });
    fireEvent.click(fecharBtn);

    const confirmBtn = screen.getByRole("button", { name: /Confirmar Fechamento/i });
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });

    // Primeiro clique
    fireEvent.click(confirmBtn);

    // Segundo clique imediato (duplo clique / concorrência)
    fireEvent.click(confirmBtn);

    // Botão deve estar desabilitado e exibindo spinner de carregamento
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
    expect(screen.getByText(/Fechando Período.../i)).toBeInTheDocument();

    // A mutation foi disparada exatamente UMA única vez
    await waitFor(() => {
      expect(IntermitentesLoteService.fecharPeriodo).toHaveBeenCalledTimes(1);
    });

    // Resolve a promise para liberar
    resolveFechamento([
      {
        id: "lote-01",
        empresa_id: "emp-benevides",
        competencia: "2026-10",
        quantidade_registros: 2,
        valor_total: 450.0,
        status: "AGUARDANDO_VALIDACAO_RH",
        auditoriaConfirmada: true,
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByText("Confirmar Fechamento de Período")).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FIX-INT-04: RASTREABILIDADE DOS DEVOLVIDOS
  // ───────────────────────────────────────────────────────────────────────────
  it("3. FIX-INT-04: Exibe aba dedicada 'Devolvidos' com contagem isolada e preservação de filtros", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/operacional/intermitentes",
              search: "?competencia=2026-10&empresaId=emp-benevides",
              state: { competencia: "2026-10", empresaId: "emp-benevides" },
            },
          ]}
        >
          <TooltipProvider>
            <IntermitentesRecebidos />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("CARLOS SILVA")).toBeInTheDocument();
    });

    // Abas e seus contadores individuais
    const pendentesTab = screen.getByRole("tab", { name: /Pendentes \(2\)/i });
    const devolvidosTab = screen.getByRole("tab", { name: /Devolvidos \(1\)/i });
    const historicoTab = screen.getByRole("tab", { name: /Histórico \(1\)/i });

    expect(pendentesTab).toBeInTheDocument();
    expect(devolvidosTab).toBeInTheDocument();
    expect(historicoTab).toBeInTheDocument();

    // Na aba inicial (Pendentes), o item devolvido NÃO deve aparecer
    expect(screen.queryByText("GABRIEL LIMA")).not.toBeInTheDocument();

    // Clicar na aba Devolvidos
    fireEvent.click(devolvidosTab);

    // Agora exibe exclusivamente o item devolvido
    await waitFor(() => {
      expect(screen.getByText("GABRIEL LIMA")).toBeInTheDocument();
    });
    expect(screen.queryByText("CARLOS SILVA")).not.toBeInTheDocument();
    expect(screen.queryByText("ANA SOUZA")).not.toBeInTheDocument();

    // Exibe banner de contexto para lançamentos devolvidos
    expect(screen.getByText(/Lançamentos Devolvidos pelo RH:/i)).toBeInTheDocument();

    // Exibe o motivo da devolução
    expect(screen.getByLabelText("Motivo da devolução")).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. FIX-INT-05 / ETAPA 04A: PADRONIZAÇÃO CANÔNICA DOS BADGES COM ORBE STATUS BADGE
  // ───────────────────────────────────────────────────────────────────────────
  it("4. FIX-INT-05 / ETAPA 04A: Mapeia status do domínio com OrbeStatusBadge canônico e sem pulse exclusivo", () => {
    // 1. RECEBIDO -> info (azul)
    const { container: c1 } = render(<div>{getIntermitenteStatusBadge("RECEBIDO")}</div>);
    expect(c1.textContent).toBe("RECEBIDO");
    expect(c1.querySelector(".bg-blue-50") || c1.querySelector(".text-blue-700")).toBeTruthy();

    // 2. AGUARDANDO_VALIDACAO_RH -> warning (âmbar) SEM pulse exclusivo
    const { container: c2 } = render(<div>{getIntermitenteStatusBadge("AGUARDANDO_VALIDACAO_RH")}</div>);
    expect(c2.textContent).toBe("AGUARDANDO RH");
    expect(c2.querySelector(".animate-pulse")).toBeFalsy();
    expect(c2.querySelector(".bg-amber-50") || c2.querySelector(".text-amber-700")).toBeTruthy();

    // 3. APROVADO_RH -> success (verde)
    const { container: c3 } = render(<div>{getIntermitenteStatusBadge("APROVADO_RH")}</div>);
    expect(c3.textContent).toBe("APROVADO RH");
    expect(c3.querySelector(".bg-emerald-50") || c3.querySelector(".text-emerald-700")).toBeTruthy();

    // 4. DEVOLVIDO -> danger (vermelho/rose)
    const { container: c4 } = render(<div>{getIntermitenteStatusBadge("DEVOLVIDO")}</div>);
    expect(c4.textContent).toBe("DEVOLVIDO");
    expect(c4.querySelector(".bg-rose-50") || c4.querySelector(".text-rose-700")).toBeTruthy();

    // 5. ENVIADO_FINANCEIRO -> info
    const { container: c5 } = render(<div>{getIntermitenteStatusBadge("ENVIADO_FINANCEIRO")}</div>);
    expect(c5.textContent).toBe("ENVIADO AO FINANCEIRO");

    // 6. PAGO -> success
    const { container: c6 } = render(<div>{getIntermitenteStatusBadge("PAGO")}</div>);
    expect(c6.textContent).toBe("PAGO");

    // 7. CANCELADO -> neutral
    const { container: c7 } = render(<div>{getIntermitenteStatusBadge("CANCELADO")}</div>);
    expect(c7.textContent).toBe("CANCELADO");

    // 8. Status Desconhecido NÃO cai em amarelo arbitrário, exibe neutral com valor original limpo
    const { container: c8 } = render(<div>{getIntermitenteStatusBadge("STATUS_CUSTOMIZADO_NOVO")}</div>);
    expect(c8.textContent).toBe("STATUS_CUSTOMIZADO_NOVO");
    expect(c8.querySelector(".bg-amber-50")).toBeFalsy();
  });

  it("5. FIX-INT-05 / ETAPA 04A: Tabela IntermitentesTableBlock renderiza badges oficiais e tooltip para motivo de devolução", () => {
    const singleData: IntermitenteItem[] = [
      {
        id: "item-dev",
        data_referencia: "2026-10-09",
        nome_colaborador: "GABRIEL LIMA",
        cargo: "Auxiliar",
        total: 190,
        status_pipeline: "DEVOLVIDO",
        motivo_devolucao: "Justificativa de ausência inválida",
      },
    ];

    render(
      <TooltipProvider>
        <IntermitentesTableBlock data={singleData} />
      </TooltipProvider>
    );

    expect(screen.getByText("GABRIEL LIMA")).toBeInTheDocument();
    expect(screen.getByText("DEVOLVIDO")).toBeInTheDocument();
    expect(screen.getByLabelText("Motivo da devolução")).toBeInTheDocument();
  });
});
