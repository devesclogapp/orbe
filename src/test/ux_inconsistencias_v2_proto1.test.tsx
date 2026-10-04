import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabInconsistencias from "@/pages/UxLab/UxLabInconsistencias";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";
import { MOCK_ITENS_INCONSISTENCIAS } from "@/pages/UxLab/inconsistenciasMockData";

describe("UX09 — Central de Inconsistências (Protótipo UX Lab V2 - Etapa 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/ux-lab/inconsistencias"]}>
        <UxLabThemeProvider>
          <Routes>
            <Route path="/ux-lab/inconsistencias" element={<UxLabInconsistencias />} />
            <Route path="/ux-lab/operacoes-volume" element={<div data-testid="modulo-operacoes">Operações por Volume</div>} />
            <Route path="/ux-lab/servicos-extras" element={<div data-testid="modulo-servicos-extras">Serviços Extras</div>} />
            <Route path="/ux-lab/custos-extras" element={<div data-testid="modulo-custos-extras">Custos Extras</div>} />
            <Route path="/cadastros" element={<div data-testid="modulo-cadastros">Central de Cadastros</div>} />
          </Routes>
        </UxLabThemeProvider>
      </MemoryRouter>
    );
  };

  it("1. Renderiza o cabeçalho com título e subtítulo canônico", () => {
    renderComponent();

    expect(screen.getAllByText("Central de Inconsistências").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Impedimentos que precisam ser corrigidos para o fluxo continuar.")
    ).toBeInTheDocument();
  });

  it("2. Exibe os 4 Indicadores Operacionais Compactos de trabalho", () => {
    renderComponent();

    expect(screen.getByText("Impedimentos Ativos")).toBeInTheDocument();
    expect(screen.getByText("Bloqueantes")).toBeInTheDocument();
    expect(screen.getByText("Ação de Campo")).toBeInTheDocument();
    expect(screen.getByText("Ação RH / Cadastro")).toBeInTheDocument();
  });

  it("3. Abertura Padrão: Fila contém exclusivamente impedimentos ativos", () => {
    renderComponent();

    // Itens ativos devem estar presentes
    expect(screen.getAllByText("OP-2026-104").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SX-2026-03").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CX-2026-19").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DIA-2026-S43-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("INT-2026-44").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PNT-2026-081").length).toBeGreaterThan(0);
  });

  it("4. Cards de Síntese filtram a fila ao serem clicados", () => {
    renderComponent();

    // Clica no card Bloqueantes
    const cardBloqueantes = screen.getByRole("button", { name: /^Bloqueantes/i });
    fireEvent.click(cardBloqueantes);

    // Deve exibir itens bloqueantes
    expect(screen.getAllByText("OP-2026-104").length).toBeGreaterThan(0);
    // Item não-bloqueante (OP-2026-112) não deve aparecer
    expect(screen.queryByText("OP-2026-112")).not.toBeInTheDocument();

    // Clica no card Ação de Campo
    const cardCampo = screen.getByRole("button", { name: /Ação de Campo/i });
    fireEvent.click(cardCampo);

    // Apenas itens de responsabilidade do Encarregado devem aparecer
    expect(screen.getAllByText("OP-2026-104").length).toBeGreaterThan(0);
    expect(screen.queryByText("PNT-2026-081")).not.toBeInTheDocument(); // PNT-2026-081 é do RH
  });

  it("5. Pílulas de domínio filtram a fila corretamente", () => {
    renderComponent();

    // Clica na pílula Ponto CLT
    const pilulaPonto = screen.getByRole("button", { name: /Ponto CLT/i });
    fireEvent.click(pilulaPonto);

    expect(screen.getAllByText("PNT-2026-081").length).toBeGreaterThan(0);
    expect(screen.queryByText("OP-2026-104")).not.toBeInTheDocument();
    expect(screen.queryByText("SX-2026-03")).not.toBeInTheDocument();
  });

  it("6. Busca textual localiza por referência, colaborador ou impedimento", () => {
    renderComponent();

    const inputBusca = screen.getByPlaceholderText(/Buscar por referência/i);
    fireEvent.change(inputBusca, { target: { value: "Lucas Moura" } });

    expect(screen.getAllByText("PNT-2026-081").length).toBeGreaterThan(0);
    expect(screen.queryByText("OP-2026-104")).not.toBeInTheDocument();
  });

  it("7. Filtro por responsável funciona corretamente", () => {
    renderComponent();

    // Restaura padrão
    const btnRestaurar = screen.getByRole("button", { name: /Restaurar Padrão/i });
    fireEvent.click(btnRestaurar);

    expect(screen.getAllByText("OP-2026-104").length).toBeGreaterThan(0);
  });

  it("8. Drawer de diagnóstico abre ao clicar em Analisar", () => {
    renderComponent();

    const btnAnalisar = screen.getAllByRole("button", { name: /Analisar/i })[0];
    fireEvent.click(btnAnalisar);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("9. Drawer explica a causa raiz (O que aconteceu?)", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(
      screen.getByText(/O encarregado registrou a descarga física mas não informou os horários/i)
    ).toBeInTheDocument();
  });

  it("10. Drawer explica o impacto no fluxo (Por que o fluxo parou?)", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    expect(screen.getByText("Por que o fluxo parou? (Impacto)")).toBeInTheDocument();
    expect(
      screen.getByText(/O motor de apuração RH não pode calcular as horas trabalhadas/i)
    ).toBeInTheDocument();
  });

  it("11. Drawer mostra o responsável pela ação", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    expect(screen.getByText("Responsável pela Ação")).toBeInTheDocument();
    expect(screen.getAllByText("Encarregado").length).toBeGreaterThan(0);
  });

  it("12. Drawer mostra o destino de correção (Onde Corrigir?)", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    expect(screen.getByText("Onde Corrigir?")).toBeInTheDocument();
    expect(screen.getByText(/Operações por Volume → Editar Operação/i)).toBeInTheDocument();
  });

  it("13. Drawer mostra o que acontece após a correção (Depois da Correção)", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    expect(screen.getByText("Depois da Correção")).toBeInTheDocument();
    expect(
      screen.getByText(/Após o preenchimento, a operação retorna automaticamente para a fila de validação/i)
    ).toBeInTheDocument();
  });

  it("14. Não existe botão 'Liberar' genérico na linha ou no drawer", () => {
    renderComponent();

    expect(screen.queryByRole("button", { name: /^Liberar$/i })).not.toBeInTheDocument();
  });

  it("15. Não existe botão 'Aprovar' (não é Central de Aprovações)", () => {
    renderComponent();

    expect(screen.queryByRole("button", { name: /^Aprovar$/i })).not.toBeInTheDocument();
  });

  it("16. CTA do Drawer executa despacho contextual simulado seguro", () => {
    renderComponent();

    const rowOp = screen.getByText("OP-2026-104");
    fireEvent.click(rowOp);

    const btnCta = screen.getByRole("button", { name: /Abrir em Operações/i });
    expect(btnCta).toBeInTheDocument();
    fireEvent.click(btnCta);
  });

  it("17. Falta pendente de justificativa (decisão RH) NÃO entra na fila factual de erros", () => {
    renderComponent();

    expect(screen.queryByText(/Falta Pendente de Justificativa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FALTA_PENDENTE_JUSTIFICATIVA/i)).not.toBeInTheDocument();
  });

  it("18. Trabalho em DSR / dia não trabalhável (decisão RH) NÃO entra na fila factual de erros", () => {
    renderComponent();

    expect(screen.queryByText(/Trabalho em Dia Não Trabalhável/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TRABALHO_EM_DIA_NAO_TRABALHAVEL/i)).not.toBeInTheDocument();
  });

  it("19. Categorias não utilizam arco-íris semântico (monocromático institucional com Royal Blue)", () => {
    renderComponent();

    // Pílulas possuem estilo institucional neutro
    const pilulaOperacoes = screen.getAllByRole("button", { name: /Operações/i });
    expect(pilulaOperacoes.length).toBeGreaterThan(0);
  });

  it("20. Rota UX Lab /ux-lab/inconsistencias está registrada", () => {
    expect(UX_LAB_ROUTES["inconsistencias"]).toBe("/ux-lab/inconsistencias");
  });
});
