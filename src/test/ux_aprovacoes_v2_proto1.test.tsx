import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabAprovacoes from "@/pages/UxLab/UxLabAprovacoes";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";

describe("UX08 — Central de Aprovações (Protótipo UX Lab V2 - Hotfix 02.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/ux-lab/aprovacoes"]}>
        <UxLabThemeProvider>
          <Routes>
            <Route path="/ux-lab/aprovacoes" element={<UxLabAprovacoes />} />
            <Route path="/operacional/servicos-extras" element={<div data-testid="modulo-servicos-extras">Serviços Extras</div>} />
            <Route path="/operacional/diaristas" element={<div data-testid="modulo-diaristas">Diaristas</div>} />
            <Route path="/colaboradores" element={<div data-testid="modulo-colaboradores">Colaboradores</div>} />
          </Routes>
        </UxLabThemeProvider>
      </MemoryRouter>
    );
  };

  it("1. Renderiza a Central de Aprovações com cabeçalho e subtítulo canônico", () => {
    renderComponent();

    expect(screen.getAllByText("Central de Aprovações").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Decisões pendentes que aguardam autorização para o fluxo continuar.")
    ).toBeInTheDocument();
  });

  it("2. Exibe os 4 Indicadores Operacionais Compactos canônicos (sem SLA fictício de 48h)", () => {
    renderComponent();

    expect(screen.getAllByText("Aguardando Decisão").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aguardando há mais tempo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Devolvidos").length).toBeGreaterThan(0);
    expect(screen.getByText("Impacto Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Soma real dos itens com valor monetário")).toBeInTheDocument();

    // Garante que a menção artificial de 48h ou inconsistência nos KPIs foi removida
    expect(screen.queryByText(/48h/i)).not.toBeInTheDocument();
  });

  it("3. Abertura Padrão: Fila contém exclusivamente decisões acionáveis (sem devolvidos nem fail-closed)", () => {
    renderComponent();

    // Itens acionáveis pendentes presentes na abertura
    expect(screen.getAllByText("SX-2026-08").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DIA-2026-S40-01").length).toBeGreaterThan(0);

    // Itens Devolvidos (SX-2026-05) e Fail-Closed (INT-2026-S40-02, OP-2026-10-019) NÃO aparecem na fila padrão
    expect(screen.queryByText("SX-2026-05")).not.toBeInTheDocument();
    expect(screen.queryByText("INT-2026-S40-02")).not.toBeInTheDocument();
    expect(screen.queryByText("OP-2026-10-019")).not.toBeInTheDocument();
  });

  it("4. Exibe as 5 Filas de Decisão Transversais com contadores vivos", () => {
    renderComponent();

    expect(screen.getByText("Todas as Filas")).toBeInTheDocument();
    expect(screen.getAllByText("Serviços Extras").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custos Extras").length).toBeGreaterThan(0);
    expect(screen.getByText("Diaristas (Lotes)")).toBeInTheDocument();
    expect(screen.getAllByText("Intermitentes").length).toBeGreaterThan(0);
    expect(screen.getByText("Operações")).toBeInTheDocument();
  });

  it("5. Filtra a listagem ao clicar nas pílulas de domínio", () => {
    renderComponent();

    // Clica na pílula de Diaristas
    const diaristasTab = screen.getByText("Diaristas (Lotes)");
    fireEvent.click(diaristasTab);

    // Deve exibir lotes de diaristas
    expect(screen.getAllByText("DIA-2026-S40-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DIA-2026-S40-02").length).toBeGreaterThan(0);

    // Não deve exibir itens de outros domínios na lista
    expect(screen.queryByText("SX-2026-08")).not.toBeInTheDocument();
    expect(screen.queryByText("CE-2026-14")).not.toBeInTheDocument();
  });

  it("6. Trata Lotes de Diaristas e Intermitentes como Unidades de Decisão (e não diárias individuais)", () => {
    renderComponent();

    // Filtra Diaristas
    fireEvent.click(screen.getByText("Diaristas (Lotes)"));

    // Verifica que o item é o LOTE SEMANAL consolidado
    expect(screen.getAllByText(/Lote Semanal Diaristas · Semana 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18 diárias · 6 diaristas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 2.160,00").length).toBeGreaterThan(0);
  });

  it("7. Busca textual filtra por referência, título ou empresa", () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/Buscar por referência, título, empresa/i);
    fireEvent.change(searchInput, { target: { value: "SX-2026-08" } });

    expect(screen.getAllByText("SX-2026-08").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reforma de 85 Pallets PBR Avariados").length).toBeGreaterThan(0);
    expect(screen.queryByText("CE-2026-14")).not.toBeInTheDocument();
  });

  it("8. Abre o Drawer de Decisão Adaptativo com diagnóstico, integridade e composição ao clicar no item", () => {
    renderComponent();

    // Clica no item de Serviço Extra SX-2026-08
    const row = screen.getAllByText("SX-2026-08")[0];
    fireEvent.click(row);

    // Verifica seções do Drawer
    expect(screen.getByText("O que está sendo autorizado?")).toBeInTheDocument();
    expect(screen.getByText("Validação de Integridade & Regras de Negócio")).toBeInTheDocument();
    expect(screen.getByText(/Composição do Item \/ Lote/i)).toBeInTheDocument();
    expect(screen.getByText("Histórico de Eventos & Auditoria")).toBeInTheDocument();

    // Verifica composição do serviço
    expect(screen.getByText("Mão de Obra Reforma")).toBeInTheDocument();
    expect(screen.getByText("Materiais Extras (Tocos/Pregos)")).toBeInTheDocument();
  });

  it("9. Exibe composição completa de colaboradores ao abrir o Drawer de um Lote de Diaristas", () => {
    renderComponent();

    // Clica no lote de Diaristas
    fireEvent.click(screen.getAllByText("DIA-2026-S40-01")[0]);

    expect(screen.getByText("Antônio Silva Santos")).toBeInTheDocument();
    expect(screen.getByText("Benedito Costa Lima")).toBeInTheDocument();
    expect(screen.getByText("Cláudio José Ferreira")).toBeInTheDocument();
    expect(screen.getAllByText("4 diárias").length).toBeGreaterThan(0);
    expect(screen.getByText("Aprovar Lote (R$ 2.160,00)")).toBeInTheDocument();
  });

  it("10. Visão contextual de Devolvidos: Exibe banner e NÃO oferece botão Aprovar", () => {
    renderComponent();

    // Clica no KPI card de Devolvidos
    const devolvidosCard = screen.getByRole("button", { name: /Devolvidos/i });
    fireEvent.click(devolvidosCard);

    // Exibe banner contextual de histórico
    expect(screen.getByText(/VISÃO CONTEXTUAL DE HISTÓRICO/i)).toBeInTheDocument();
    expect(screen.getAllByText("SX-2026-05").length).toBeGreaterThan(0);

    // Abre o Drawer do item devolvido
    fireEvent.click(screen.getAllByText("SX-2026-05")[0]);

    // Verifica que NÃO existe botão Aprovar
    expect(screen.queryByRole("button", { name: /Aprovar/i })).not.toBeInTheDocument();
    expect(screen.getByText("Registro em Correção na Origem")).toBeInTheDocument();
  });

  it("11. Exige justificativa obrigatória ao devolver uma decisão", () => {
    renderComponent();

    // Abre o item de Custo Extra
    fireEvent.click(screen.getAllByText("CE-2026-14")[0]);

    // Clica no botão Devolver no Drawer
    const devolverBtn = screen.getByRole("button", { name: /Devolver/i });
    fireEvent.click(devolverBtn);

    // Modal de justificativa abre
    expect(screen.getByText("Devolver Decisão para Correção")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Confirmar Devolução" });
    expect(confirmBtn).toBeDisabled();

    // Digita a justificativa
    const textarea = screen.getByPlaceholderText(/Descreva a divergência encontrada/i);
    fireEvent.change(textarea, { target: { value: "Nota fiscal ilegível. Favor reenviar foto nítida do cupom." } });

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    // Verifica que o modal fechou
    expect(screen.queryByText("Devolver Decisão para Correção")).not.toBeInTheDocument();
  });

  it("12. Ausência de aprovação em massa: Não renderiza checkboxes de seleção múltipla", () => {
    renderComponent();

    // Não deve existir checkbox para seleção em lote
    const checkboxes = screen.queryAllByRole("checkbox");
    expect(checkboxes.length).toBe(0);

    expect(screen.queryByText("Aprovar Selecionados")).not.toBeInTheDocument();
    expect(screen.queryByText("Devolver Selecionados")).not.toBeInTheDocument();
  });

  it("13. Rota do UX Lab mapeada corretamente na Sidebar e Routes", () => {
    expect(UX_LAB_ROUTES["aprovacoes"]).toBe("/ux-lab/aprovacoes");
  });
});
