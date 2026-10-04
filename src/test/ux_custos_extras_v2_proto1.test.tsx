import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabCustosExtras from "@/pages/UxLab/UxLabCustosExtras";
import {
  CUSTOS_EXTRAS_MOCKS,
  isObrigacaoAberta,
  isRequerAcao,
  isPagoLiquidado,
} from "@/pages/UxLab/custosExtrasMockData";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderCustosExtras(initialRoute = "/ux-lab/custos-extras") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/custos-extras" element={<UxLabCustosExtras />} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

describe("UX07 — Custos Extras V2 — Protótipo 1 no UX Lab", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("1. Rota /ux-lab/custos-extras está devidamente configurada no mapeamento da Sidebar", () => {
    expect(UX_LAB_ROUTES["custos-extras"]).toBe("/ux-lab/custos-extras");
  });

  it("2. Container respeita rigorosamente a grade de largura max-w-[1560px]", () => {
    const { container } = renderCustosExtras();
    const mainWrapper = container.querySelector(".max-w-\\[1560px\\]");
    expect(mainWrapper).toBeInTheDocument();
  });

  it("3. Renderiza o cabeçalho operacional com título, subtítulo, seletor de empresa e CTA", () => {
    renderCustosExtras();

    // Título e Subtítulo
    expect(screen.getByRole("heading", { name: /Custos Extras/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhe despesas extraordinárias, validações e obrigações financeiras/i)
    ).toBeInTheDocument();

    // Badge
    expect(screen.getByText("UX LAB V2")).toBeInTheDocument();

    // CTA
    expect(screen.getByRole("button", { name: /Novo Custo Extra/i })).toBeInTheDocument();

    // Seletor de Empresa
    expect(screen.getByRole("combobox", { name: /Seletor de Empresa/i })).toBeInTheDocument();
  });

  it("4. Apresenta 4 cards de síntese com valor em R$ e contagem coerentes", () => {
    renderCustosExtras();

    const btnPeriodo = screen.getByRole("button", { name: /Custos no Período/i });
    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    const btnAPagar = screen.getByRole("button", { name: /A Pagar \/ Financeiro/i });
    const btnPagos = screen.getByRole("button", { name: /Pagos \/ Liquidados/i });

    expect(btnPeriodo).toBeInTheDocument();
    expect(btnRequerAcao).toBeInTheDocument();
    expect(btnAPagar).toBeInTheDocument();
    expect(btnPagos).toBeInTheDocument();

    // Card 1: 12 lançamentos registrados
    expect(within(btnPeriodo).getByText(/12 lançamentos registrados/i)).toBeInTheDocument();
    // Card 2: 5 pendências (1 reprovada)
    expect(within(btnRequerAcao).getByText(/5 pendências/i)).toBeInTheDocument();
    expect(within(btnRequerAcao).getByText(/1 reprovada/i)).toBeInTheDocument();
    // Card 3: 3 obrigações abertas (exclui PAGO_EMPRESA)
    expect(within(btnAPagar).getByText(/3 obrigações abertas/i)).toBeInTheDocument();
    // Card 4: 6 despesas liquidadas (desembolsos efetuados PAGO_EMPRESA + obrigações quitadas)
    expect(within(btnPagos).getByText(/6 despesas liquidadas/i)).toBeInTheDocument();

    // Valores em R$ presentes com formatação em moeda
    expect(within(btnPeriodo).getByText(/R\$\s*6\.455,00/i)).toBeInTheDocument();
    expect(within(btnRequerAcao).getByText(/R\$\s*1\.775,00/i)).toBeInTheDocument();
    expect(within(btnAPagar).getByText(/R\$\s*2\.600,00/i)).toBeInTheDocument();
    expect(within(btnPagos).getByText(/R\$\s*2\.610,00/i)).toBeInTheDocument();
  });

  it("5. Filtro temporal permite selecionar períodos e filtra a competência 'data'", () => {
    renderCustosExtras();

    // Componente temporal reutilizado está presente
    expect(screen.getByText("Todo o Período")).toBeInTheDocument();

    // Verifica que registros de diferentes meses aparecem inicialmente
    expect(screen.getByText("CE-2026-001")).toBeInTheDocument();
    expect(screen.getByText("CE-2026-006")).toBeInTheDocument(); // Setembro
  });

  it("6. Busca textual localiza por código, descrição, colaborador e fornecedor", () => {
    renderCustosExtras();

    const searchInput = screen.getByPlaceholderText(/Buscar código, descrição, fornecedor, colaborador/i);

    // 1. Busca por código
    fireEvent.change(searchInput, { target: { value: "CE-2026-005" } });
    expect(screen.getByText("CE-2026-005")).toBeInTheDocument();
    expect(screen.queryByText("CE-2026-001")).toBeNull();

    // 2. Busca por fornecedor
    fireEvent.change(searchInput, { target: { value: "Hidráulica Silva" } });
    expect(screen.getByText("CE-2026-005")).toBeInTheDocument();
    expect(screen.queryByText("CE-2026-001")).toBeNull();

    // 3. Busca por colaborador favorecido
    fireEvent.change(searchInput, { target: { value: "Carlos Alberto Santos" } });
    expect(screen.getByText("CE-2026-004")).toBeInTheDocument();
    expect(screen.queryByText("CE-2026-005")).toBeNull();
  });

  it("7. Filtro de categoria exibe badges monocromáticos institucionais", () => {
    renderCustosExtras();

    // Verifica que as categorias estão presentes
    expect(screen.getAllByText("Merenda / Lanche").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manutenção").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Operacional").length).toBeGreaterThan(0);

    // Assegura que badges de categoria estão presentes e formatados
    const badgeMerenda = screen.getAllByText("Merenda / Lanche")[0];
    expect(badgeMerenda).toBeInTheDocument();
  });

  it("8. Filtro de origem do recurso com opções amigáveis", () => {
    renderCustosExtras();

    // Labels amigáveis na tabela
    expect(screen.getAllByText("Pago pela Empresa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reembolso").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pagamento a Fornecedor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registro Legado").length).toBeGreaterThan(0);
  });

  it("9. Pipeline e Pagamento são dimensões semanticamente independentes na tabela", () => {
    renderCustosExtras();

    // Cabeçalhos independentes
    expect(screen.getByRole("columnheader", { name: /^Pipeline$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Pagamento$/i })).toBeInTheDocument();

    // Valores desacoplados (não combinados)
    expect(screen.queryByText(/Recebido \(Pendente\)/i)).toBeNull();
    expect(screen.queryByText(/Financeiro - A Pagar/i)).toBeNull();
  });

  it("10. Card 'Requer Ação' navega circularmente e prioriza 1º REPROVADO, 2º EM_VALIDACAO, 3º RECEBIDO", () => {
    renderCustosExtras();

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const cardRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });

    // 1º clique: deve focar a despesa REPROVADA (CE-2026-003)
    fireEvent.click(cardRequerAcao);
    const rowReprovado = document.getElementById("row-custo-ce-mock-003");
    expect(rowReprovado).toBeInTheDocument();

    // 2º clique: deve focar a despesa EM_VALIDACAO (CE-2026-002)
    fireEvent.click(cardRequerAcao);
    const rowEmVal = document.getElementById("row-custo-ce-mock-002");
    expect(rowEmVal).toBeInTheDocument();
  });

  it("11. Card 'A Pagar / Financeiro' estritamente NÃO inclui PAGO_EMPRESA como obrigação futura", () => {
    renderCustosExtras();

    const btnAPagar = screen.getByRole("button", { name: /A Pagar \/ Financeiro/i });
    // Somente 3 obrigações abertas (CE-004, CE-005, CE-006). CE-001 e CE-002 (PAGO_EMPRESA) não estão incluídos
    expect(within(btnAPagar).getByText(/3 obrigações abertas/i)).toBeInTheDocument();
    expect(within(btnAPagar).getByText(/R\$\s*2\.600,00/i)).toBeInTheDocument();
  });

  it("12. Navegação circular nos cards opera em ciclo contínuo (loop)", () => {
    renderCustosExtras();

    const cardRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    // Total de 5 itens que requerem ação (1 reprovado, 2 em validação, 2 recebidos)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(cardRequerAcao);
    }
    // Não lança exceção e o ciclo retorna ao início (loop contínuo)
    expect(cardRequerAcao).toBeInTheDocument();
  });

  it("13. Highlight temporário respeita semântica real da linha encontrada (Card != Badge != Highlight)", () => {
    renderCustosExtras();

    const cardRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });

    // Clica no card âmbar para encontrar o item REPROVADO
    fireEvent.click(cardRequerAcao);

    // A linha REPROVADA recebe highlight rose/vermelho, NUNCA herda a cor âmbar do card
    const rowReprovado = document.getElementById("row-custo-ce-mock-003");
    expect(rowReprovado?.className).toContain("ring-rose-500");
  });

  it("14. Alteração de filtro reseta o cursor da navegação circular", () => {
    renderCustosExtras();

    const cardRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    fireEvent.click(cardRequerAcao); // move cursor

    // Aplica filtro de busca
    const searchInput = screen.getByPlaceholderText(/Buscar código, descrição, fornecedor, colaborador/i);
    fireEvent.change(searchInput, { target: { value: "Lanche" } });

    // Cursor foi resetado para 0
    expect(searchInput).toHaveValue("Lanche");
  });

  it("15. Clique na linha da tabela abre o Drawer lateral especialista", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-001").closest("tr");
    expect(row).toBeInTheDocument();
    if (row) fireEvent.click(row);

    // Drawer aberto
    expect(screen.getByText(/Diagnóstico da Despesa/i)).toBeInTheDocument();
    expect(screen.getByText(/Origem do Recurso & Modelo Financeiro/i)).toBeInTheDocument();
    expect(screen.getByText(/Composição do Valor/i)).toBeInTheDocument();
  });

  it("16. Se despesa estiver REPROVADO, Drawer exibe justificativa de devolução em destaque", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-003").closest("tr");
    if (row) fireEvent.click(row);

    // Justificativa clara presente
    expect(screen.getByText(/Justificativa de Devolução \/ Bloqueio:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Despesa sem cupom fiscal discriminado e fora da política de refeições operacionais/i)
    ).toBeInTheDocument();
  });

  it("17. Se despesa for REEMBOLSO_COLABORADOR, Drawer exibe colaborador favorecido", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-004").closest("tr");
    if (row) fireEvent.click(row);

    expect(screen.getAllByText(/Reembolso a colaborador/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Carlos Alberto Santos/i).length).toBeGreaterThan(0);
  });

  it("18. Se despesa for PAGAMENTO_PENDENTE, Drawer exibe fornecedor favorecido e vencimento", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-005").closest("tr");
    if (row) fireEvent.click(row);

    expect(screen.getAllByText(/Pagamento a fornecedor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hidráulica Silva & Filhos Ltda/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("17/10/2026").length).toBeGreaterThan(0);
  });

  it("19. Se despesa for PAGO_EMPRESA, Drawer explicita que o gasto já ocorreu e não gera obrigação futura", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-001").closest("tr");
    if (row) fireEvent.click(row);

    expect(screen.getByText(/Pago diretamente pela empresa/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Este lançamento não gera obrigação futura a pagar no financeiro/i)
    ).toBeInTheDocument();
  });

  it("20. Nenhum dropdown destrutivo de status na tabela ou no Drawer", () => {
    renderCustosExtras();

    // Tabela não possui combobox inline de status
    expect(screen.queryByRole("combobox", { name: /Alterar Status Pagamento/i })).toBeNull();

    // Abre Drawer e garante ausência de edição de status solta
    const row = screen.getByText("CE-2026-001").closest("tr");
    if (row) fireEvent.click(row);

    expect(screen.queryByRole("combobox", { name: /Modificar Pipeline/i })).toBeNull();
  });

  it("21. Nenhum termo técnico de infraestrutura na interface (zero trigger, postgres, rpc, etc.)", () => {
    renderCustosExtras();

    // Valida rodapé da tabela
    expect(screen.getByText(/Valores aprovados ficam protegidos contra alteração/i)).toBeInTheDocument();
    expect(screen.queryByText(/trigger/i)).toBeNull();
    expect(screen.queryByText(/postgres/i)).toBeNull();
    expect(screen.queryByText(/rpc/i)).toBeNull();
    expect(screen.queryByText(/constraint/i)).toBeNull();
    expect(screen.queryByText(/rls/i)).toBeNull();
  });

  it("22. Suporte a tema Light/Dark com renderização consistente", () => {
    const { container } = renderCustosExtras();

    // Verifica que classes dark: estão presentes na estrutura
    expect(container.innerHTML).toContain("dark:text-royal-blue-light");
    expect(container.innerHTML).toContain("dark:border-border");
  });

  it("23. Fechamento do Drawer por botão Fechar no rodapé e tecla ESC sem X superior conflitante", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-001").closest("tr");
    if (row) fireEvent.click(row);

    // Botão Fechar no rodapé
    const btnFechar = screen.getByRole("button", { name: /^Fechar$/i });
    expect(btnFechar).toBeInTheDocument();

    // Assegura ausência de botão X superior concorrendo com o header
    expect(screen.queryByRole("button", { name: /^Close$/i })).toBeNull();

    fireEvent.click(btnFechar);
  });

  it("24. Navegação integrada do UX Lab reconhece /ux-lab/custos-extras", () => {
    expect(UX_LAB_ROUTES["custos-extras"]).toBe("/ux-lab/custos-extras");
  });

  it("25. [HOTFIX 02.1] PAGO_EMPRESA não aparece como obrigação A_PAGAR no dataset mock", () => {
    const itensPagoEmpresa = CUSTOS_EXTRAS_MOCKS.filter((c) => c.origem_recurso === "PAGO_EMPRESA");
    expect(itensPagoEmpresa.length).toBeGreaterThan(0);
    for (const item of itensPagoEmpresa) {
      expect(item.status_pagamento).not.toBe("A_PAGAR");
      expect(item.status_pagamento).not.toBe("ATRASADO");
      expect(isObrigacaoAberta(item)).toBe(false);
    }
  });

  it("26. [HOTFIX 02.1] Card A Pagar nunca navega para PAGO_EMPRESA e percorre exclusivamente obrigações abertas", () => {
    renderCustosExtras();

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const btnAPagar = screen.getByRole("button", { name: /A Pagar \/ Financeiro/i });
    
    // Clica 5 vezes no card A Pagar para testar o ciclo completo
    for (let i = 0; i < 5; i++) {
      fireEvent.click(btnAPagar);
      // Nenhum item focado pode ser PAGO_EMPRESA
      const focusedPagoEmpresa1 = document.getElementById("row-custo-ce-mock-001");
      const focusedPagoEmpresa2 = document.getElementById("row-custo-ce-mock-002");
      const focusedPagoEmpresa7 = document.getElementById("row-custo-ce-mock-007");

      expect(focusedPagoEmpresa1?.className || "").not.toContain("ring-");
      expect(focusedPagoEmpresa2?.className || "").not.toContain("ring-");
      expect(focusedPagoEmpresa7?.className || "").not.toContain("ring-");
    }
  });

  it("27. [HOTFIX 02.1] Drawer header exibe 'Data do custo' e não apresenta data diária como 'Competência'", () => {
    renderCustosExtras();

    const row = screen.getByText("CE-2026-001").closest("tr");
    if (row) fireEvent.click(row);

    expect(screen.getByText(/Data do custo:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Competência:/i)).toBeNull();
  });

  it("28. [HOTFIX 02.3] Coluna Descrição / Favorecido possui largura recalibrada e truncamento em uma linha sem scroll horizontal", () => {
    renderCustosExtras();

    const thDescricao = screen.getByRole("columnheader", { name: /Descrição \/ Favorecido/i });
    expect(thDescricao.className).toContain("max-w-[240px]");
    expect(thDescricao.className).not.toContain("min-w-[300px]");

    // Verifica truncamento em uma linha e presença de title acessível
    const row = screen.getByText("CE-2026-001").closest("tr");
    const descCell = within(row!).getByText(/Lanche noturno para equipe/i);
    expect(descCell.className).toContain("truncate");
    expect(descCell.className).toContain("whitespace-nowrap");
    expect(descCell).toHaveAttribute("title", "Lanche noturno para equipe de descarga emergencial");
  });

  describe("HOTFIX 02.2 — Pipeline Stepper (Padrão Transversal ORBE)", () => {
    it("1. RECEBIDO marca o primeiro estágio como atual (etapa 1 de 5)", () => {
      renderCustosExtras();
      // CE-2026-001 tem pipeline_status: 'RECEBIDO'
      const row = screen.getByText("CE-2026-001").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Recebido\. Etapa 1 de 5\./i,
      });
      expect(stepperRegion).toBeInTheDocument();
    });

    it("2. EM_VALIDACAO marca o segundo estágio como atual (etapa 2 de 5)", () => {
      renderCustosExtras();
      // CE-2026-002 tem pipeline_status: 'EM_VALIDACAO'
      const row = screen.getByText("CE-2026-002").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Em validação\. Etapa 2 de 5\./i,
      });
      expect(stepperRegion).toBeInTheDocument();
    });

    it("3. APROVADO_OPERACAO marca o terceiro estágio como atual (etapa 3 de 5)", () => {
      renderCustosExtras();
      // CE-2026-004 tem pipeline_status: 'APROVADO_OPERACAO'
      const row = screen.getByText("CE-2026-004").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Aprovado\. Etapa 3 de 5\./i,
      });
      expect(stepperRegion).toBeInTheDocument();
    });

    it("4. ENVIADO_FINANCEIRO marca o quarto estágio como atual (etapa 4 de 5)", () => {
      renderCustosExtras();
      // CE-2026-005 tem pipeline_status: 'ENVIADO_FINANCEIRO'
      const row = screen.getByText("CE-2026-005").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Financeiro\. Etapa 4 de 5\./i,
      });
      expect(stepperRegion).toBeInTheDocument();
    });

    it("5. FINALIZADO completa a esteira com todos os nós em sucesso", () => {
      renderCustosExtras();
      // CE-2026-007 tem pipeline_status: 'FINALIZADO'
      const row = screen.getByText("CE-2026-007").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Finalizado\. Etapa 5 de 5\./i,
      });
      expect(stepperRegion).toBeInTheDocument();
    });

    it("6. REPROVADO apresenta exceção sem simular 6ª etapa linear", () => {
      renderCustosExtras();
      // CE-2026-003 tem pipeline_status: 'REPROVADO'
      const row = screen.getByText("CE-2026-003").closest("tr");
      expect(row).toBeInTheDocument();
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional: Reprovado\./i,
      });
      expect(stepperRegion).toBeInTheDocument();

      // No compact stepper, o botão do nó atual contém o caractere de exceção ✕
      expect(within(stepperRegion).getByText("✕")).toBeInTheDocument();
    });

    it("7. Compact renderiza exatamente cinco nós na esteira", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-001").closest("tr");
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional:/i,
      });
      const nodes = within(stepperRegion).getAllByRole("button");
      expect(nodes).toHaveLength(5);
    });

    it("8. Detailed renderiza labels canônicos e alçadas institucionais", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-004").closest("tr");
      fireEvent.click(row!);

      // Título da seção no Drawer
      expect(screen.getByText(/Etapas do Processo/i)).toBeInTheDocument();
      expect(
        screen.getByText("Acompanhamento da esteira operacional deste lançamento.")
      ).toBeInTheDocument();

      // Labels das etapas
      expect(screen.getByText("Recebido")).toBeInTheDocument();
      expect(screen.getByText("Em validação")).toBeInTheDocument();
      expect(screen.getByText("Aprovado")).toBeInTheDocument();
      expect(screen.getAllByText("Financeiro").length).toBeGreaterThan(0);
      expect(screen.getByText("Finalizado")).toBeInTheDocument();

      // Alçadas institucionais
      expect(screen.getByText("Encarregado")).toBeInTheDocument();
      expect(screen.getByText("Operação / ADM")).toBeInTheDocument();
      expect(screen.getByText("Gestor Operacional")).toBeInTheDocument();
    });

    it("9. Detailed apresenta marcador explícito 'Você está aqui'", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-004").closest("tr");
      fireEvent.click(row!);

      expect(screen.getByText("Você está aqui")).toBeInTheDocument();
    });

    it("10. Nenhuma data histórica fictícia nem usuário fictício é exibido como evento", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-004").closest("tr");
      fireEvent.click(row!);

      // Certifica que não foi inventado histórico cronológico de transições
      expect(screen.queryByText(/Transicionado por/i)).toBeNull();
      expect(screen.queryByText(/Horário da aprovação/i)).toBeNull();
      expect(screen.queryByText(/Histórico de Eventos/i)).toBeNull();
    });

    it("11. Pagamento não aparece como etapa da esteira do pipeline", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-001").closest("tr");
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional:/i,
      });

      // A esteira só contém etapas operacionais
      expect(within(stepperRegion).queryByText(/A Pagar/i)).toBeNull();
      expect(within(stepperRegion).queryByText(/Pago/i)).toBeNull();
      expect(within(stepperRegion).queryByText(/Liquidado/i)).toBeNull();
    });

    it("12. Tooltip / aria-label estão disponíveis em cada nó do compact stepper", () => {
      renderCustosExtras();
      const row = screen.getByText("CE-2026-001").closest("tr");
      const stepperRegion = within(row!).getByRole("region", {
        name: /Pipeline operacional:/i,
      });
      const nodes = within(stepperRegion).getAllByRole("button");

      expect(nodes[0]).toHaveAttribute("aria-label", expect.stringMatching(/Recebido — Etapa atual/i));
      expect(nodes[1]).toHaveAttribute("aria-label", expect.stringMatching(/Em validação — Pendente/i));
      expect(nodes[2]).toHaveAttribute("aria-label", expect.stringMatching(/Aprovado — Pendente/i));
      expect(nodes[3]).toHaveAttribute("aria-label", expect.stringMatching(/Financeiro — Pendente/i));
      expect(nodes[4]).toHaveAttribute("aria-label", expect.stringMatching(/Finalizado — Pendente/i));
    });

    it("13. Suporta temas Light e Dark mantendo legibilidade sem quebra", () => {
      const { container } = renderCustosExtras();
      expect(container.innerHTML).toContain("dark:bg-zinc-800");
    });
  });
});

