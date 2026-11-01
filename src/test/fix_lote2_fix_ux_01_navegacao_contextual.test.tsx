import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OperacaoVolumeDrawer, OperacaoVolumeReal } from "@/components/operacoes/OperacaoVolumeDrawer";
import { AprovacaoDecisaoDrawer, ApprovalItem } from "@/components/aprovacoes/AprovacaoDecisaoDrawer";
import { OperacaoProducaoService } from "@/services/domain/producao.service";

// Mock de controle de acesso
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
              id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
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

// Mock dos serviços
vi.mock("@/services/domain/producao.service", () => ({
  OperacaoProducaoService: {
    getByIdWithDetails: vi.fn(),
    aprovar: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/services/domain/intermitentes.service", () => ({
  IntermitentesLoteService: {
    verificarCompletudeLote: vi.fn().mockResolvedValue({ podeAprovar: true, pendencias: [] }),
    getLoteDetalhe: vi.fn(),
  },
}));

vi.mock("@/services/domain/diaristas.service", () => ({
  LoteFechamentoDiaristaService: {
    getLoteDetalhe: vi.fn(),
  },
}));

vi.mock("@/services/base.service", () => ({
  OperacaoProducaoService: {
    getByIdWithDetails: vi.fn(),
    aprovar: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const sampleOpRecebida: OperacaoVolumeReal = {
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
  status_pagamento: "PENDENTE",
  atualizado_em: "2026-10-17T12:00:00Z",
};

const sampleOpAguardandoFaturamento: OperacaoVolumeReal = {
  ...sampleOpRecebida,
  status: "AGUARDANDO_FATURAMENTO",
  status_rh: "PENDENTE_RH",
};

const sampleOpFaturada: OperacaoVolumeReal = {
  ...sampleOpRecebida,
  status: "FATURADO",
  status_rh: "VALIDADO_RH",
  status_pagamento: "PENDENTE",
};

const sampleOpLiquidada: OperacaoVolumeReal = {
  ...sampleOpRecebida,
  status: "RECEBIDO_FINANCEIRO",
  status_rh: "VALIDADO_RH",
  status_pagamento: "RECEBIDO",
  data_pagamento: "2026-10-17",
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("FIX-UX-01 — Navegação Contextual e Regras de Esteira Operação por Volume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "admin";
    mockIsAdmin = true;
  });

  describe("1. OperacaoVolumeDrawer — Painel Contextual de Situação & Próxima Etapa", () => {
    it("1.1 Exibe informações de Onde Está, O que foi feito e Responsável para operação em RECEBIDO", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Situação no Processo & Próxima Etapa/i)).toBeInTheDocument();
      expect(screen.getByText(/Lançamento inicial concluído na doca/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestor \/ Supervisor Operacional/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor\/Gestor confirmar aprovação operacional/i)).toBeInTheDocument();
    });

    it("1.2 Exibe botões de próxima etapa (Acompanhar em Receitas / Validação RH) quando aprovada", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpAguardandoFaturamento}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Deve ter botão de ir para receitas na esteira contextual
      const btnReceitas = screen.getAllByRole("button", { name: /Receitas/i });
      expect(btnReceitas.length).toBeGreaterThan(0);

      // Clicar em Acompanhar em Receitas navega para a rota canônica /financeiro/receitas
      fireEvent.click(btnReceitas[0]);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/financeiro/receitas?operacaoId=0328d4a8-6ed2-47f7-b45d-531af9a0674c&empresa=emp-teste-01"),
        expect.objectContaining({
          state: expect.objectContaining({
            highlightOperacaoId: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
          }),
        })
      );

      // Deve ter botão para validação RH pois status_rh é PENDENTE_RH
      const btnRh = screen.getByRole("button", { name: /Ir para Validação RH/i });
      expect(btnRh).toBeInTheDocument();

      // Clicar em Ir para Validação RH aciona navegação com parâmetros da operação
      fireEvent.click(btnRh);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/rh/aprovacoes?tipo=OPERAÇÃO&empresaId=emp-teste-01&operacaoId=0328d4a8-6ed2-47f7-b45d-531af9a0674c"),
        expect.objectContaining({
          state: expect.objectContaining({
            operacaoId: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
            empresaId: "emp-teste-01",
          }),
        })
      );
    });

    it("1.3 Exibe ação primária 'Abrir Conciliação' quando recebimento é confirmado com conciliação pendente", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpLiquidada}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Botão primário contextual no card de situação deve ser "Abrir Conciliação"
      const btnConciliacao = screen.getByRole("button", { name: /Abrir Conciliação/i });
      expect(btnConciliacao).toBeInTheDocument();

      fireEvent.click(btnConciliacao);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/financeiro/retorno?tab=receitas&origem=operacoes&empresaId=emp-teste-01"),
        expect.objectContaining({
          state: expect.objectContaining({
            activeTab: "receitas",
            empresaId: "emp-teste-01",
          }),
        })
      );

      // Deve ter botão secundário Ver no DRE
      const btnDre = screen.getByRole("button", { name: /Ver no DRE/i });
      expect(btnDre).toBeInTheDocument();

      fireEvent.click(btnDre);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/financeiro/dre?mes=2026-10&empresa=emp-teste-01")
      );

      // Deve ter botão secundário Ver em Receitas
      const btnReceitas = screen.getByRole("button", { name: /Ver em Receitas/i });
      expect(btnReceitas).toBeInTheDocument();

      // No rodapé, NÃO deve haver duplicação dos botões "Receitas" ou "DRE"
      expect(screen.queryByRole("button", { name: /^Receitas$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^DRE$/i })).not.toBeInTheDocument();
    });

    it("1.4 Trata acesso negado (RBAC fail-closed) no rodapé quando perfil não é autorizado", () => {
      mockRole = "operador";
      mockIsAdmin = false;

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpRecebida}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Botão de aprovação fica desabilitado com indicador de restrição de perfil
      const btnBloqueado = screen.getByRole("button", { name: /Aprovação Restrita ao Gestor/i });
      expect(btnBloqueado).toBeInTheDocument();
      expect(btnBloqueado).toBeDisabled();
    });

    it("1.5 Operação CONCLUIDO com conciliação pendente separa status operacional da conciliação", () => {
      const sampleOpConcluidaPendenteConciliacao: OperacaoVolumeReal = {
        ...sampleOpRecebida,
        status: "CONCLUIDO",
        status_rh: "VALIDADO_RH",
        status_pagamento: "RECEBIDO",
        data_pagamento: "2026-10-17",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpConcluidaPendenteConciliacao}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Badge deve explicitar que conciliação está pendente
      expect(screen.getByText("Concluído (Conciliação Pendente)")).toBeInTheDocument();

      // Onde está e responsável refletem a etapa real
      expect(screen.getByText(/Operação concluída — Aguardando conciliação bancária/i)).toBeInTheDocument();
      expect(screen.getByText(/Controladoria \/ Conciliação Bancária/i)).toBeInTheDocument();
      expect(screen.getByText(/Localizar crédito no extrato bancário e confirmar a conciliação na Central Bancária\./i)).toBeInTheDocument();

      // CTA primário deve ser "Abrir Conciliação"
      const btnConciliacao = screen.getByRole("button", { name: /Abrir Conciliação/i });
      expect(btnConciliacao).toBeInTheDocument();
      fireEvent.click(btnConciliacao);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/financeiro/retorno?tab=receitas&origem=operacoes"),
        expect.anything()
      );

      // Não exibe validação RH
      expect(screen.queryByRole("button", { name: /Ir para Validação RH/i })).not.toBeInTheDocument();
    });

    it("1.6 Operação CONCLUIDO com conciliação confirmada apresenta 'Ciclo Concluído & Conciliado'", () => {
      const sampleOpConcluidaConciliada: OperacaoVolumeReal = {
        ...sampleOpRecebida,
        status: "CONCLUIDO",
        status_rh: "VALIDADO_RH",
        status_pagamento: "RECEBIDO",
        status_conciliacao: "conciliado",
        data_pagamento: "2026-10-17",
      };

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <OperacaoVolumeDrawer
              operacao={sampleOpConcluidaConciliada}
              open={true}
              onOpenChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Badge deve ser "Ciclo Concluído & Conciliado"
      expect(screen.getByText("Ciclo Concluído & Conciliado")).toBeInTheDocument();

      // Onde está e responsável refletem ciclo 100% finalizado
      expect(screen.getByText(/Ciclo 100% concluído e conciliado/i)).toBeInTheDocument();
      expect(screen.getByText(/Processo finalizado \(Sem ações pendentes\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Nenhuma pendência\. Crédito conciliado no extrato e ciclo arquivado\./i)).toBeInTheDocument();

      // Não deve exibir botão de abrir conciliação pois já está conciliado
      expect(screen.queryByRole("button", { name: /Abrir Conciliação/i })).not.toBeInTheDocument();

      // Ação primária é Ver no DRE
      const btnDre = screen.getByRole("button", { name: /Ver no DRE/i });
      expect(btnDre).toBeInTheDocument();
      fireEvent.click(btnDre);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/financeiro/dre?mes=2026-10&empresa=emp-teste-01")
      );
    });
  });

  describe("2. AprovacaoDecisaoDrawer — Bloqueio de Aprovação Prematura pelo RH", () => {
    const itemAprovacaoOp: ApprovalItem = {
      id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
      tipo: "OPERAÇÃO",
      referencia: "Op 0328D4",
      colaborador: "Empresa Teste - Homologação",
      descricao: "Descarga",
      empresa: "Empresa Teste - Homologação",
      operacao: "Descarga",
      valor: 42.0,
      horas: "—",
      competencia: "2026-10",
      data_recebimento: "2026-10-17T12:00:00Z",
      raw_status: "PENDENTE_RH",
      situacao: "Em análise",
      empresa_id: "emp-teste-01",
      filter_data: "2026-10-17",
      raw_lote_id: null,
    };

    it("2.1 Bloqueia aprovação RH quando operação ainda está em RECEBIDO no operacional", async () => {
      // Mock do getByIdWithDetails retornando status RECEBIDO
      (OperacaoProducaoService.getByIdWithDetails as any).mockResolvedValueOnce({
        id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
        status: "RECEBIDO",
        status_rh: "PENDENTE_RH",
        entrada_ponto: "08:00:00",
        saida_ponto: "12:00:00",
      });

      const onAprovarMock = vi.fn();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemAprovacaoOp}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={onAprovarMock}
              onDevolver={vi.fn()}
              isAprovando={false}
              isDevolvendo={false}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Aguarda carregar dados da sub-query opData
      await waitFor(() => {
        expect(screen.getByText(/Aguardando Aprovação Operacional \(Pré-requisito RH\)/i)).toBeInTheDocument();
      });

      // Botão de aprovação fica bloqueado
      const btnAprovarBloqueado = screen.getByRole("button", { name: /Aguardando Aprovação Operacional/i });
      expect(btnAprovarBloqueado).toBeInTheDocument();
      expect(btnAprovarBloqueado).toBeDisabled();

      // Clicar no botão não dispara callback de aprovação
      fireEvent.click(btnAprovarBloqueado);
      expect(onAprovarMock).not.toHaveBeenCalled();
    });

    it("2.2 Oferece botão direto para abrir a operação na tela de Operações por Volume", async () => {
      (OperacaoProducaoService.getByIdWithDetails as any).mockResolvedValueOnce({
        id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
        status: "RECEBIDO",
        status_rh: "PENDENTE_RH",
        entrada_ponto: "08:00:00",
        saida_ponto: "12:00:00",
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemAprovacaoOp}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={vi.fn()}
              onDevolver={vi.fn()}
              isAprovando={false}
              isDevolvendo={false}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Abrir Aprovação Operacional/i })).toBeInTheDocument();
      });

      const btnAbrirOperacional = screen.getByRole("button", { name: /Abrir Aprovação Operacional/i });
      fireEvent.click(btnAbrirOperacional);

      // Verifica se navegou com opId e empresa
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/operacoes-volume?opId=0328d4a8-6ed2-47f7-b45d-531af9a0674c&empresa=emp-teste-01"),
        expect.objectContaining({
          state: expect.objectContaining({
            selectedOpId: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
          }),
        })
      );
    });

    it("2.3 Libera aprovação RH quando operação já está em AGUARDANDO_FATURAMENTO", async () => {
      (OperacaoProducaoService.getByIdWithDetails as any).mockResolvedValueOnce({
        id: "0328d4a8-6ed2-47f7-b45d-531af9a0674c",
        status: "AGUARDANDO_FATURAMENTO",
        status_rh: "PENDENTE_RH",
        entrada_ponto: "08:00:00",
        saida_ponto: "12:00:00",
      });

      const onAprovarMock = vi.fn();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AprovacaoDecisaoDrawer
              item={itemAprovacaoOp}
              open={true}
              onOpenChange={vi.fn()}
              onAprovar={onAprovarMock}
              onDevolver={vi.fn()}
              isAprovando={false}
              isDevolvendo={false}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Decisão/i })).toBeInTheDocument();
      });

      const btnAprovar = screen.getByRole("button", { name: /Aprovar Decisão/i });
      expect(btnAprovar).not.toBeDisabled();

      fireEvent.click(btnAprovar);
      expect(onAprovarMock).toHaveBeenCalledWith(itemAprovacaoOp);
    });
  });
});
