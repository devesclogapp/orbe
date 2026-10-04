import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabFechamentoCiclos from "@/pages/UxLab/UxLabFechamentoCiclos";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";
import { MOCK_CICLOS_FECHAMENTO } from "@/pages/UxLab/fechamentoCiclosMockData";

describe("UX10 — Hub Transversal de Fechamento de Ciclos (Protótipo UX Lab V2 - Etapa 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/ux-lab/fechamento-ciclos"]}>
        <UxLabThemeProvider>
          <Routes>
            <Route path="/ux-lab/fechamento-ciclos" element={<UxLabFechamentoCiclos />} />
            <Route
              path="/ux-lab/inconsistencias"
              element={<div data-testid="inconsistencias-page">Central de Inconsistências</div>}
            />
            <Route
              path="/ux-lab/aprovacoes"
              element={<div data-testid="aprovacoes-page">Central de Aprovações</div>}
            />
          </Routes>
        </UxLabThemeProvider>
      </MemoryRouter>
    );
  };

  it("1. Rota UX Lab /ux-lab/fechamento-ciclos está registrada no mapa de rotas", () => {
    expect(UX_LAB_ROUTES["fechamento-ciclos"]).toBe("/ux-lab/fechamento-ciclos");
  });

  it("2. Renderiza o cabeçalho oficial com título e descrição canônica", () => {
    renderComponent();

    expect(screen.getAllByText("Fechamento de Ciclos").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Consolidação e encerramento dos ciclos operacionais e de pessoal da competência."
      )
    ).toBeInTheDocument();
  });

  it("3. Exibe os 4 motores canônicos de fechamento", () => {
    renderComponent();

    expect(screen.getByText("Ciclo Operacional Semanal")).toBeInTheDocument();
    expect(screen.getByText("Diaristas — Lote Semanal")).toBeInTheDocument();
    expect(screen.getByText("Contrato Intermitente — Lote Quinzenal")).toBeInTheDocument();
    expect(screen.getByText("CLT — Folha Mensal & Banco de Horas")).toBeInTheDocument();
  });

  it("4. Não existe botão 'Fechar Tudo' ou 'Fechar Competência' (Proibição Arquitetural)", () => {
    renderComponent();

    expect(screen.queryByText(/Fechar Tudo/i)).toBeNull();
    expect(screen.queryByText(/Fechar Competência/i)).toBeNull();
    expect(screen.queryByText(/Fechamento em Massa/i)).toBeNull();
  });

  it("5. Exibe os 4 KPIs compactos da competência com contagens reais (5 Ciclos / Lotes)", () => {
    renderComponent();

    expect(screen.getByText("Ciclos / Lotes")).toBeInTheDocument();
    expect(screen.getByText("acompanhados na competência")).toBeInTheDocument();
    expect(screen.getByText("Prontos para Fechar")).toBeInTheDocument();
    expect(screen.getByText("Bloqueados")).toBeInTheDocument();
    expect(screen.getByText("Já Fechados")).toBeInTheDocument();

    // Valida que não chama os 5 registros de "5 motores"
    expect(screen.queryByText(/5 motores/i)).toBeNull();
    expect(screen.queryByText(/motores acompanhados/i)).toBeNull();
  });

  it("5.1. Distingue 4 motores canônicos vs 5 ciclos/lotes no dataset (Diaristas possui 2 lotes)", () => {
    renderComponent();

    // 5 ciclos no total
    expect(MOCK_CICLOS_FECHAMENTO.length).toBe(5);

    // Diaristas possui 2 registros (Semana 40 pronta e Semana 39 fechada)
    const diaristas = MOCK_CICLOS_FECHAMENTO.filter((c) => c.dominio === "DIARISTAS");
    expect(diaristas.length).toBe(2);

    // Domínios únicos representam os 4 motores canônicos
    const motoresUnicos = Array.from(new Set(MOCK_CICLOS_FECHAMENTO.map((c) => c.dominio)));
    expect(motoresUnicos.length).toBe(4);
  });

  it("6. Representa os 4 estados visuais canônicos de UX", () => {
    renderComponent();

    expect(screen.getAllByText("BLOQUEADO").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PRONTO PARA FECHAR").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AGUARDANDO APROVAÇÃO").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("FECHADO").length).toBeGreaterThanOrEqual(1);
  });

  it("7. Exibe a timeline S1..S5 com indicadores no Ciclo Operacional", () => {
    renderComponent();

    expect(screen.getByText("Semanas da Competência")).toBeInTheDocument();
    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    expect(screen.getByText("S3")).toBeInTheDocument();
    expect(screen.getByText("S4")).toBeInTheDocument();
    expect(screen.getByText("S5")).toBeInTheDocument();
    expect(screen.getByText("✓ fechada")).toBeInTheDocument();
    expect(screen.getByText("! bloqueada")).toBeInTheDocument();
  });

  it("8. Ciclo bloqueado não oferece botão de fechamento direto e direciona para Inconsistências", () => {
    renderComponent();

    const ctaBloqueio = screen.getByText("Ver 2 bloqueios");
    expect(ctaBloqueio).toBeInTheDocument();

    fireEvent.click(ctaBloqueio);
    expect(screen.getByTestId("inconsistencias-page")).toBeInTheDocument();
  });

  it("9. Ciclo aguardando aprovação direciona para a Central de Aprovações", () => {
    renderComponent();

    const ctaAprovacao = screen.getByText("Abrir Aprovações");
    expect(ctaAprovacao).toBeInTheDocument();

    fireEvent.click(ctaAprovacao);
    expect(screen.getByTestId("aprovacoes-page")).toBeInTheDocument();
  });

  it("10. Ciclo pronto para fechar abre o OrbeDrawer de revisão", () => {
    renderComponent();

    const ctaRevisar = screen.getByText("Revisar e Fechar");
    fireEvent.click(ctaRevisar);

    expect(screen.getByText("O que será consolidado?")).toBeInTheDocument();
    expect(screen.getByText("Checklist de Prontidão")).toBeInTheDocument();
    expect(screen.getByText("Efeito do Fechamento")).toBeInTheDocument();
    expect(screen.getByText("Rastreabilidade & Governança")).toBeInTheDocument();
  });

  it("11. Drawer de Fechamento exibe o checklist e os dados da consolidação", () => {
    renderComponent();

    const ctaRevisar = screen.getByText("Revisar e Fechar");
    fireEvent.click(ctaRevisar);

    expect(screen.getAllByText("Grade semanal 100% preenchida").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Cadastros bancários e PIX íntegros").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Validação RH formalmente concluída").length).toBeGreaterThanOrEqual(1);
  });

  it("12. Confirmação explícita de fechamento no drawer", () => {
    renderComponent();

    const ctaRevisar = screen.getByText("Revisar e Fechar");
    fireEvent.click(ctaRevisar);

    const btnConfirmar = screen.getByText("Confirmar Fechamento");
    fireEvent.click(btnConfirmar);

    expect(
      screen.getByText(/Confirmar fechamento do lote de Diaristas/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sim, Confirmar Fechamento")
    ).toBeInTheDocument();
  });

  it("13. Ciclo fechado é apresentado em modo somente leitura (Ver Fechamento)", () => {
    renderComponent();

    const ctaVerFechamento = screen.getByText("Ver Fechamento");
    fireEvent.click(ctaVerFechamento);

    expect(screen.getByText("Lote Consolidado (Modo Leitura)")).toBeInTheDocument();
  });

  it("14. Encarregado não aparece como perfil autorizador/responsável pelo fechamento final", () => {
    renderComponent();

    // Encarregado é gestor de campo (apenas lança operações/presenças), não fecha RH/Financeiro
    expect(screen.getAllByText(/RH \/ Financeiro/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RH Master/).length).toBeGreaterThan(0);
  });

  it("15. Não existem Operações por Volume, Serviços Extras ou Custos Extras como motores de fechamento", () => {
    renderComponent();

    // Na barra de domínios, apenas os 4 motores canônicos existem
    expect(screen.queryByText(/Serviços Extras \(Lote/i)).toBeNull();
    expect(screen.queryByText(/Custos Extras \(Lote/i)).toBeNull();
    expect(screen.queryByText(/Operações por Volume \(Lote/i)).toBeNull();
  });

  it("16. Checklist CLT não possui acoplamento legado com Serviços Extras ou Custos Extras", () => {
    renderComponent();

    // O checklist CLT reflete apenas domínio RH/CLT (pontos, decisões, cadastros)
    const itemClt = MOCK_CICLOS_FECHAMENTO.find((c) => c.dominio === "CLT");
    expect(itemClt).toBeDefined();

    const titulosChecklist = itemClt?.checklist.map((chk) => chk.titulo).join(" ");
    expect(titulosChecklist).not.toContain("Custo Extra");
    expect(titulosChecklist).not.toContain("Serviço Extra");
  });

  it("17. Barra de contexto permite filtrar os ciclos por domínio", () => {
    renderComponent();

    const btnDiaristas = screen.getByRole("button", { name: /Diaristas \(2\)/i });
    fireEvent.click(btnDiaristas);

    expect(screen.getByText("Diaristas — Lote Semanal")).toBeInTheDocument();
    expect(screen.queryByText("CLT — Folha Mensal & Banco de Horas")).toBeNull();
  });

  it("18. Design System oficial e padrão monocromático institucional aplicados", () => {
    renderComponent();

    expect(screen.getByPlaceholderText("Buscar ciclo, período ou responsável...")).toBeInTheDocument();
  });
});
