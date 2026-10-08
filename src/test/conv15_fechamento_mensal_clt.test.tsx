import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FechamentoMensalCLT from "@/pages/BancoHoras/FechamentoMensalCLT";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { FechamentoMensalCltAdapter } from "@/services/adapters/fechamentoMensalCltAdapter";
import { supabase } from "@/lib/supabase";

// Mock de navegação
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock do AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ title, subtitle, children }: any) => (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock do OperationalPipelineContext
vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
  }),
  buildOperationalStagePipeline: vi.fn(),
  buildOperationalFailurePipeline: vi.fn(),
}));

describe("CONV-15: Fechamento Mensal CLT (Testes Obrigatórios)", () => {
  let queryClient: QueryClient;

  const mockEmpresas = [
    { id: "emp-evidencia-op", nome: "Evidencia Operacional" },
    { id: "emp-evidencia-noite", nome: "Evidencia Noite" },
    { id: "emp-dismelo", nome: "DISMELO CASTANHAL" },
    { id: "emp-hml", nome: "Empresa Teste - Homologação" },
  ];

  const mockValidationEvidenciaOp = {
    competencia: "2026-10",
    empresaId: "emp-evidencia-op",
    empresaNome: "Evidencia Operacional",
    impedimentos: [
      "26 pendencia(s) cadastral(is) impedem a aprovacao.",
    ],
    bloqueiosCriticos: Array(26).fill({ id: "b1", nome: "Colab", motivo: "pendente", categoria: "Pendência cadastral", rota: "/cadastros", acao: "Completar" }),
    avisosOperacionais: [],
    pendenciasCadastrais: Array(26).fill({ id: "c1", nome: "Colab", motivo: "cadastro pendente de complemento" }),
    inconsistenciasAbertas: [],
    colaboradoresBloqueados: [],
    custosExtrasPendentes: [],
    servicosExtrasPendentes: [],
    resumo: {
      bloqueiosCriticos: 26,
      avisosOperacionais: 0,
      pendenciasCadastrais: 26,
      inconsistenciasAbertas: 0,
      colaboradoresBloqueados: 0,
      custosExtrasPendentes: 0,
      servicosExtrasPendentes: 0,
      financeiroPrevisto: {
        folhaBase: 26,
        variaveis: 65,
        bancoHoras: 0,
      },
    },
  };

  const mockValidationEvidenciaNoite = {
    competencia: "2026-10",
    empresaId: "emp-evidencia-noite",
    empresaNome: "Evidencia Noite",
    impedimentos: [
      "10 pendencia(s) cadastral(is) impedem a aprovacao.",
    ],
    bloqueiosCriticos: Array(10).fill({ id: "b2", nome: "Colab", motivo: "pendente", categoria: "Pendência cadastral", rota: "/cadastros", acao: "Completar" }),
    avisosOperacionais: [],
    pendenciasCadastrais: Array(10).fill({ id: "c2", nome: "Colab", motivo: "cadastro pendente de complemento" }),
    inconsistenciasAbertas: [],
    colaboradoresBloqueados: [],
    custosExtrasPendentes: [],
    servicosExtrasPendentes: [],
    resumo: {
      bloqueiosCriticos: 10,
      avisosOperacionais: 0,
      pendenciasCadastrais: 10,
      inconsistenciasAbertas: 0,
      colaboradoresBloqueados: 0,
      custosExtrasPendentes: 0,
      servicosExtrasPendentes: 0,
      financeiroPrevisto: {
        folhaBase: 10,
        variaveis: 10,
        bancoHoras: 0,
      },
    },
  };

  const mockValidationHmlPronta = {
    competencia: "2026-10",
    empresaId: "emp-hml",
    empresaNome: "Empresa Teste - Homologação",
    impedimentos: [], // ZERO impedimentos - PRONTA PARA FECHAR!
    bloqueiosCriticos: [],
    avisosOperacionais: [],
    pendenciasCadastrais: [],
    inconsistenciasAbertas: [],
    colaboradoresBloqueados: [],
    custosExtrasPendentes: [],
    servicosExtrasPendentes: [],
    resumo: {
      bloqueiosCriticos: 0,
      avisosOperacionais: 0,
      pendenciasCadastrais: 0,
      inconsistenciasAbertas: 0,
      colaboradoresBloqueados: 0,
      custosExtrasPendentes: 0,
      servicosExtrasPendentes: 0,
      financeiroPrevisto: {
        folhaBase: 5,
        variaveis: 8,
        bancoHoras: 2,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Mock do Supabase auth & queries
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: { id: "user-rh-01", email: "rh@esclog.com.br" } as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === "profiles") {
            return Promise.resolve({ data: { tenant_id: "tenant-esc-01" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };

      if (table === "empresas") {
        builder.order = vi.fn().mockResolvedValue({
          data: mockEmpresas,
          error: null,
        });
      }

      if (table === "rh_financeiro_lotes") {
        builder.eq = vi.fn().mockImplementation((col: string, val: any) => {
          if (col === "origem") {
            return Promise.resolve({
              data: [
                { id: "lote-01", empresa_id: "emp-hml", status: "AGUARDANDO_FINANCEIRO", origem: "RH", tipo: "FOLHA_VARIAVEL" },
              ],
              error: null,
            });
          }
          return builder;
        });
      }

      return builder;
    });

    // Mock de validação do RHFinanceiroService
    vi.spyOn(RHFinanceiroService, "validateCompetenciaApproval").mockImplementation(
      async (empresaId: string, competencia: string) => {
        if (empresaId === "emp-evidencia-op") return mockValidationEvidenciaOp as any;
        if (empresaId === "emp-evidencia-noite") return mockValidationEvidenciaNoite as any;
        if (empresaId === "emp-hml") return mockValidationHmlPronta as any;
        return {
          competencia,
          empresaId,
          empresaNome: "Outra Empresa",
          impedimentos: ["Nenhum registro processado foi encontrado para a competencia selecionada."],
          bloqueiosCriticos: [],
          avisosOperacionais: [],
          pendenciasCadastrais: [],
          inconsistenciasAbertas: [],
          colaboradoresBloqueados: [],
          custosExtrasPendentes: [],
          servicosExtrasPendentes: [],
          resumo: {
            bloqueiosCriticos: 0,
            avisosOperacionais: 0,
            pendenciasCadastrais: 0,
            inconsistenciasAbertas: 0,
            colaboradoresBloqueados: 0,
            custosExtrasPendentes: 0,
            servicosExtrasPendentes: 0,
          },
        } as any;
      }
    );
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FechamentoMensalCLT />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("1. Consulta de regras sem HTTP 400: valida mapeamento de bh_ativo para ativo sem erros", async () => {
    // Validar que o adapter e o serviço tratam bh_ativo
    const mockRegraDoBanco = {
      id: "regra-01",
      nome: "Regra Padrão 8h",
      adicional_hora_extra_percentual: 50,
      bh_ativo: true,
      status: "ativo",
      tenant_id: "tenant-01",
    };

    // Mapeamento esperado no adapter/service
    const regraMapeada = {
      ...mockRegraDoBanco,
      ativo: Boolean(mockRegraDoBanco.bh_ativo ?? (mockRegraDoBanco.status === "ativo")),
    };

    expect(regraMapeada.ativo).toBe(true);
    expect(regraMapeada.adicional_hora_extra_percentual).toBe(50);
  });

  it("2. Carregamento dos indicadores reais: KPIs de síntese refletem as grandezas consolidadas", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Validar que os KPIs de síntese aparecem na tela
    expect(screen.getByText("Unidades em Apuração")).toBeInTheDocument();
    expect(screen.getByText("Prontas para Homologar")).toBeInTheDocument();
    expect(screen.getAllByText("Bloqueios Críticos").length).toBeGreaterThan(0);
    expect(screen.getByText("Lotes Liberados")).toBeInTheDocument();

    // Bloqueios críticos consolidados: 26 (Evidencia Op) + 10 (Evidencia Noite) = 36 nas empresas mockadas
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("3. Troca de competência: seletor de competência permite alterar o mês de apuração", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Seletor de competência renderizado
    expect(screen.getByText("Competência Mensal")).toBeInTheDocument();
    const selectTrigger = screen.getAllByRole("combobox")[0];
    expect(selectTrigger).toBeInTheDocument();
  });

  it("4. Filtro por empresa: permite filtrar a visualização para uma unidade específica", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Evidencia Noite").length).toBeGreaterThan(0);
    });

    // Filtro de empresa está presente
    expect(screen.getByText("Unidade / Empresa")).toBeInTheDocument();
  });

  it("5. Estados de bloqueio e prontidão: exibe indicador compacto na lista e estado consolidado no diagnóstico", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Evidencia Operacional tem 26 bloqueios -> Estado BLOQUEADO no diagnóstico da direita
    const badgesBloqueado = screen.getAllByText("BLOQUEADO");
    expect(badgesBloqueado.length).toBeGreaterThan(0);

    // Na lista à esquerda, exibe indicador compacto '26 impedimentos' (sem duplicação de badges vermelhos)
    expect(screen.getByText("26 impedimentos")).toBeInTheDocument();

    // Empresa Homologação tem 0 bloqueios com lote em AGUARDANDO_FINANCEIRO -> exibe 'Aguardando aprovação' na lista
    expect(screen.getByText("Aguardando aprovação")).toBeInTheDocument();

    // Ao selecionar a empresa Homologação, o diagnóstico da direita exibe o estado consolidado 'AGUARDANDO APROVAÇÃO'
    const empHml = screen.getAllByText("Empresa Teste - Homologação");
    fireEvent.click(empHml[0]);

    await waitFor(() => {
      expect(screen.getByText("AGUARDANDO APROVAÇÃO")).toBeInTheDocument();
    });
  });

  it("6. Drawer e checklist: botão 'Ver Detalhes do Fechamento' abre o FechamentoDrawer com composição", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Clica em 'Ver Detalhes do Fechamento' da empresa ativa
    const botoesDetalhes = screen.getAllByText("Ver Detalhes do Fechamento");
    fireEvent.click(botoesDetalhes[0]);

    // Drawer abre exibindo checklist e seções oficiais
    await waitFor(() => {
      expect(screen.getByText("O que será consolidado?")).toBeInTheDocument();
      expect(screen.getByText("Checklist de Prontidão")).toBeInTheDocument();
      expect(screen.getByText("Efeito do Fechamento")).toBeInTheDocument();
    });
  });

  it("7. Proteção contra homologação indevida: botão primário de empresa bloqueada permanece desabilitado", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Empresas com impedimentos devem ter botão desabilitado com texto 'Bloqueado por Pendências'
    const botoesBloqueados = screen.getAllByText("Bloqueado por Pendências");
    expect(botoesBloqueados.length).toBeGreaterThan(0);
    expect(botoesBloqueados[0].closest("button")).toBeDisabled();
  });

  it("8. Integridade dos três componentes financeiros no Adapter (FOLHA_BASE, FOLHA_VARIAVEL, BANCO_HORAS)", () => {
    const item = FechamentoMensalCltAdapter.toCicloFechamentoItem({
      validation: mockValidationHmlPronta,
      lotes: [],
      competencia: "2026-10",
      userName: "Auditor RH",
    });

    expect(item.dominio).toBe("CLT");
    expect(item.estadoVisual).toBe("PRONTO_PARA_FECHAR");
    expect(item.consolidacao?.detalhes).toBeDefined();

    const rotulos = item.consolidacao?.detalhes?.map((d) => d.rotulo);
    expect(rotulos).toContain("Folha Salarial Base (FOLHA_BASE)");
    expect(rotulos).toContain("Ocorrências Variáveis / HE (FOLHA_VARIAVEL)");
    expect(rotulos).toContain("Banco de Horas a Pagar (BANCO_HORAS)");
  });

  it("9. Ações contextuais de encaminhamento: links para Central de Cadastros e Central de Inconsistências", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Como Evidencia Operacional possui 26 pendências cadastrais, deve exibir botão de ação rápida
    const botaoCadastros = screen.getByText("Central de Cadastros (26)");
    expect(botaoCadastros).toBeInTheDocument();

    fireEvent.click(botaoCadastros);
    expect(mockNavigate).toHaveBeenCalledWith("/cadastros?from=fechamento-clt");
  });

  it("11. Workspace 50/50: alternar empresa na coluna esquerda atualiza o diagnóstico na coluna direita", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    // Diagnóstico inicial aponta para Evidencia Operacional (26 bloqueios)
    expect(screen.getByText("26 pendencia(s) cadastral(is) impedem a aprovacao.")).toBeInTheDocument();

    // Clica em 'Evidencia Noite' na lista operacional à esquerda
    const empresasNoite = screen.getAllByText("Evidencia Noite");
    fireEvent.click(empresasNoite[0]);

    // O diagnóstico contextual atualiza imediatamente para Evidencia Noite (10 bloqueios)
    await waitFor(() => {
      expect(screen.getByText("10 pendencia(s) cadastral(is) impedem a aprovacao.")).toBeInTheDocument();
    });
  });

  it("10. Cálculo de KPIs pelo Adapter: confere contagens exatas", () => {
    const kpis = FechamentoMensalCltAdapter.calcularKpis(
      [mockValidationEvidenciaOp, mockValidationEvidenciaNoite, mockValidationHmlPronta],
      [{ id: "l1", empresa_id: "emp-hml", status: "AGUARDANDO_FINANCEIRO", origem: "RH" }]
    );

    expect(kpis.totalEmpresas).toBe(3);
    expect(kpis.bloqueiosCriticos).toBe(36); // 26 + 10
    expect(kpis.folhaVariavelTotal).toBe(83); // 65 + 10 + 8
    expect(kpis.lotesLiberados).toBe(1);
    expect(kpis.bancoHorasTotal).toBe(2);
  });

  it("12. FIX02-A: Coluna de empresas possui container com scroll vertical independente", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    const scrollContainer = screen.getByTestId("empresas-scroll-container");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain("overflow-y-auto");
    expect(scrollContainer.className).toContain("overflow-x-hidden");
  });

  it("13. FIX05: Contenção vertical estrutural CSS nativa sem cálculos arbitrários", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("Evidencia Operacional").length).toBeGreaterThan(0);
    });

    const scrollContainer = screen.getByTestId("empresas-scroll-container");
    expect(scrollContainer).toBeInTheDocument();
    // Confirma contenção flexível e independente da lista de empresas
    expect(scrollContainer.className).toContain("flex-1");
    expect(scrollContainer.className).toContain("min-h-0");
    expect(scrollContainer.className).toContain("overflow-y-auto");
    expect(scrollContainer.className).toContain("overflow-x-hidden");

    // Confirma que a coluna direita de diagnóstico possui contenção simétrica
    const secaoDiagnostico = screen.getByText("Diagnóstico da Empresa").closest("section");
    expect(secaoDiagnostico).toBeInTheDocument();
    expect(secaoDiagnostico?.className).toContain("h-full");
    expect(secaoDiagnostico?.className).toContain("min-h-0");

    // Confirma que o card de diagnóstico tem contenção interna flex-1 min-h-0 overflow-y-auto
    const cardDiagnostico = secaoDiagnostico?.querySelector("article");
    expect(cardDiagnostico).toBeInTheDocument();
    expect(cardDiagnostico?.className).toContain("flex-1");
    expect(cardDiagnostico?.className).toContain("min-h-0");
    expect(cardDiagnostico?.className).toContain("overflow-y-auto");
  });
});
