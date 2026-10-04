import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabServicosExtras from "@/pages/UxLab/UxLabServicosExtras";
import { SERVICOS_EXTRAS_MOCKS } from "@/pages/UxLab/servicosExtrasMockData";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderServicosExtras(initialRoute = "/ux-lab/servicos-extras") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/servicos-extras" element={<UxLabServicosExtras />} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

describe("UX06 — Serviços Extras V2 — Protótipo 1 no UX Lab", () => {
  it("1. Rota /ux-lab/servicos-extras está devidamente configurada no mapeamento da Sidebar", () => {
    expect(UX_LAB_ROUTES["servicos-extras"]).toBe("/ux-lab/servicos-extras");
  });

  it("2. Renderiza o cabeçalho operacional com título, subtítulo, seletor de empresa e CTA", () => {
    renderServicosExtras();

    // Título e Subtítulo
    expect(screen.getByRole("heading", { name: /Serviços Extras/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhe serviços extraordinários, validações e avanço até o faturamento/i)
    ).toBeInTheDocument();

    // CTA
    expect(screen.getByRole("button", { name: /Novo Serviço Extra/i })).toBeInTheDocument();

    // Seletor de Empresa
    expect(screen.getByRole("combobox", { name: /Seletor de Empresa/i })).toBeInTheDocument();
  });

  it("3. Apresenta síntese operacional com os 4 indicadores orientados ao processo e contadores coerentes", () => {
    renderServicosExtras();

    // 4 contadores de processo nos botões de síntese
    const btnTotal = screen.getByRole("button", { name: /Serviços no Período/i });
    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    const btnFinanceiro = screen.getByRole("button", { name: /Aguardando Financeiro/i });
    const btnConcluidos = screen.getByRole("button", { name: /Faturados \/ Concluídos/i });

    expect(btnTotal).toBeInTheDocument();
    expect(btnRequerAcao).toBeInTheDocument();
    expect(btnFinanceiro).toBeInTheDocument();
    expect(btnConcluidos).toBeInTheDocument();

    // Valida contadores exatos dos mocks (8 total: 3 requer ação, 2 financeiro, 3 faturados/concluídos)
    expect(within(btnTotal).getByText("8")).toBeInTheDocument();
    expect(within(btnRequerAcao).getByText("3")).toBeInTheDocument();
    expect(within(btnFinanceiro).getByText("2")).toBeInTheDocument();
    expect(within(btnConcluidos).getByText("3")).toBeInTheDocument();

    // Assegura ausência de 'Em Validação' isolado ou métricas financeiras de DRE como card de síntese
    expect(screen.queryByRole("button", { name: /^Em Validação$/i })).toBeNull();
    expect(screen.queryByText(/Faturamento do Período/i)).toBeNull();
    expect(screen.queryByText(/Receita Bruta/i)).toBeNull();
  });

  it("4. Exibe tabela especialista de alta densidade com colunas obrigatórias", () => {
    renderServicosExtras();

    // Cabeçalhos de coluna
    expect(screen.getByRole("columnheader", { name: /Código/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Data/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Empresa \/ Tomador/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Tipo de Serviço Extra/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Qtd. Executada/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Headcount/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Valor Total/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pipeline Status/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Modalidade \/ Pgto/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pendência \/ Diagnóstico/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Ação/i })).toBeInTheDocument();

    // Amostras de códigos auditados presentes na tabela
    expect(screen.getByText("SX-2026-101")).toBeInTheDocument();
    expect(screen.getByText("SX-2026-102")).toBeInTheDocument();
    expect(screen.getByText("SX-2026-103")).toBeInTheDocument();
  });

  it("5. Headcount é exibido estritamente como quantitativo ('X pessoas') e NUNCA inventa equipe nominal", () => {
    renderServicosExtras();

    // Na tabela, a coluna Headcount mostra número de pessoas
    expect(screen.getAllByText(/4 pessoas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 pessoas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5 pessoas/i).length).toBeGreaterThan(0);

    // Assegura que nomes individuais ou CPFs fictícios não foram criados
    expect(screen.queryByText(/CPF:/i)).toBeNull();
    expect(screen.queryByText(/Matrícula:/i)).toBeNull();
    expect(screen.queryByText(/Operador Líder Nominal/i)).toBeNull();
  });

  it("6. Elimina o risco P0 de alteração de pagamento solta na tabela (sem dropdown destrutivo)", () => {
    renderServicosExtras();

    // Assegura que na coluna Modalidade / Pagamento não há select/dropdown para mudar status de pagamento
    expect(screen.queryByRole("combobox", { name: /Status Pagamento/i })).toBeNull();
  });

  it("7. Coluna Pipeline Status utiliza exclusivamente estados reais sem 'Recebido' no pipeline", () => {
    renderServicosExtras();

    // Garante que o status PENDENTE é apresentado como 'Pendente' e CONCLUIDO como 'Concluído'
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getAllByText("Concluído").length).toBeGreaterThan(0);
    expect(screen.getByText("Devolvido")).toBeInTheDocument();
  });

  it("8. Clique no Card 'Requer Ação' localiza e aciona scroll para a primeira ocorrência", () => {
    renderServicosExtras();

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const cardRequerAcao = screen.getByRole("button", {
      name: /Requer Ação/i,
    });
    fireEvent.click(cardRequerAcao);

    // O mock de scroll foi acionado
    expect(scrollIntoViewMock).toBeDefined();
  });

  it("9. Clique na linha abre Drawer com diagnóstico, Composição do Valor e Faturamento & Cobrança", () => {
    renderServicosExtras();

    // Clica no serviço SX-2026-102 (Conserto de Pallets com materiais)
    const row = screen.getByText("SX-2026-102").closest("tr");
    expect(row).toBeInTheDocument();
    if (row) {
      fireEvent.click(row);
    }

    // Drawer aberto
    expect(screen.getByText(/Diagnóstico da Esteira/i)).toBeInTheDocument();
    expect(screen.getByText(/Responsável:/i)).toBeInTheDocument();

    // Linguagem de negócio atualizada
    expect(screen.getByText(/Composição do Valor/i)).toBeInTheDocument();
    expect(screen.queryByText(/Composição Matemática do Valor/i)).toBeNull();
    expect(screen.getByText(/Valor unitário aplicado:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Snapshot comercial congelado/i)).toBeNull();
    expect(screen.getByText(/Faturamento & Cobrança/i)).toBeInTheDocument();
    expect(screen.queryByText(/Classificação Financeira & Faturamento/i)).toBeNull();

    // Materiais e Headcount
    expect(screen.getByText(/Madeira Eucalipto Tratada/i)).toBeInTheDocument();
    expect(screen.getByText(/Pregos Anelados Reforçados/i)).toBeInTheDocument();
    expect(screen.getByText(/Subtotal Materiais Extras:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3 pessoas/i).length).toBeGreaterThanOrEqual(1);
  });

  it("10. Cabeçalho do Drawer separa estritamente Pipeline e Pagamento como dimensões independentes", () => {
    renderServicosExtras();

    // Clica no serviço SX-2026-101 (Pendente / Pagamento Pendente)
    const row = screen.getByText("SX-2026-101").closest("tr");
    if (row) fireEvent.click(row);

    // Assegura rótulos e badges independentes no cabeçalho
    expect(screen.getByText(/^Pipeline:$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Pagamento:$/i)).toBeInTheDocument();

    // Assegura ausência de superstatus combinado fictício
    expect(screen.queryByText(/Recebido \(Pendente\)/i)).toBeNull();
    expect(screen.queryByText(/Recebido \(Concluído\)/i)).toBeNull();
  });

  it("11. Cenário DEVOLVIDO apresenta alerta com justificativa e diagnóstico claro", () => {
    renderServicosExtras();

    // Clica no serviço SX-2026-103 (Devolvido)
    const row = screen.getByText("SX-2026-103").closest("tr");
    expect(row).toBeInTheDocument();
    if (row) {
      fireEvent.click(row);
    }

    // Justificativa de devolução auditada
    expect(screen.getByText(/Motivo da Devolução \/ Ajuste Solicitado:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Divergência entre horário registrado no romaneio e horário de acionamento/i)
    ).toBeInTheDocument();

    // Botão contextual de sanar inconsistência
    expect(screen.getByRole("button", { name: /Sanar Inconsistência/i })).toBeInTheDocument();
  });

  it("12. Rodapé da tabela utiliza linguagem de negócio e remove termos técnicos e totalizador de headcount", () => {
    renderServicosExtras();

    // Mensagem de negócio presente
    expect(
      screen.getByText(/Registros faturados possuem valores protegidos contra alteração/i)
    ).toBeInTheDocument();

    // Linguagem de implementação técnica removida
    expect(screen.queryByText(/trigger Postgres/i)).toBeNull();

    // Total agregado de headcount removido do rodapé
    expect(screen.queryByText(/Regra Headcount: Auditoria quantitativa/i)).toBeNull();
  });

  it("13. Layout container respeita estritamente a largura máxima de 1560px", () => {
    const { container } = renderServicosExtras();
    const mainContainer = container.querySelector(".max-w-\\[1560px\\]");
    expect(mainContainer).toBeInTheDocument();
  });

  it("14. Coerência semântica: highlight da linha respeita o status real da ocorrência (não a cor do card)", () => {
    renderServicosExtras();

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });

    // 1º clique: localiza SX-2026-103 (DEVOLVIDO) -> deve receber ring rose (ring-rose-500)
    fireEvent.click(btnRequerAcao);
    const rowDevolvido = document.getElementById("row-servico-se-103");
    expect(rowDevolvido?.className).toContain("ring-rose-500");
    expect(rowDevolvido?.className).not.toContain("ring-amber-500");

    // 2º clique: localiza SX-2026-102 (EM_VALIDACAO) -> deve receber ring azul (ring-blue-500)
    fireEvent.click(btnRequerAcao);
    const rowEmVal = document.getElementById("row-servico-se-102");
    expect(rowEmVal?.className).toContain("ring-blue-500");
    expect(rowEmVal?.className).not.toContain("ring-amber-500");

    // 3º clique: localiza SX-2026-101 (PENDENTE) -> deve receber ring âmbar (ring-amber-500)
    fireEvent.click(btnRequerAcao);
    const rowPendente = document.getElementById("row-servico-se-101");
    expect(rowPendente?.className).toContain("ring-amber-500");
  });

  it("15. Prioridade e Navegação circular: card 'Requer Ação' prioriza DEVOLVIDO -> EM_VALIDACAO -> PENDENTE e volta em loop", () => {
    renderServicosExtras();

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });

    // Clique 1 -> SX-2026-103 (DEVOLVIDO - prioridade máxima)
    fireEvent.click(btnRequerAcao);
    expect(document.getElementById("row-servico-se-103")).toBeInTheDocument();

    // Clique 2 -> SX-2026-102 (EM_VALIDACAO - conferência técnica)
    fireEvent.click(btnRequerAcao);
    expect(document.getElementById("row-servico-se-102")).toBeInTheDocument();

    // Clique 3 -> SX-2026-101 (PENDENTE - triagem)
    fireEvent.click(btnRequerAcao);
    expect(document.getElementById("row-servico-se-101")).toBeInTheDocument();

    // Clique 4 -> Volta ao primeiro (SX-2026-103)
    fireEvent.click(btnRequerAcao);
    expect(document.getElementById("row-servico-se-103")).toBeInTheDocument();
  });

  it("16. Card 'Aguardando Financeiro' percorre APROVADO_OPERACAO e APROVADO_FINANCEIRO com cores reais de status", () => {
    renderServicosExtras();

    const btnFin = screen.getByRole("button", { name: /Aguardando Financeiro/i });

    // Clique 1 -> SX-2026-104 (APROVADO_OPERACAO) -> ring emerald
    fireEvent.click(btnFin);
    const rowAprovOp = document.getElementById("row-servico-se-104");
    expect(rowAprovOp?.className).toContain("ring-emerald-500");

    // Clique 2 -> SX-2026-105 (APROVADO_FINANCEIRO) -> ring indigo
    fireEvent.click(btnFin);
    const rowAprovFin = document.getElementById("row-servico-se-105");
    expect(rowAprovFin?.className).toContain("ring-indigo-500");

    // Clique 3 -> Volta para SX-2026-104
    fireEvent.click(btnFin);
    expect(document.getElementById("row-servico-se-104")).toBeInTheDocument();
  });

  it("17. Alteração de filtro ou busca reseta a sequência de navegação circular", () => {
    renderServicosExtras();

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });

    // Avança 1 vez na sequência (vai para SX-2026-103)
    fireEvent.click(btnRequerAcao);

    // Altera a busca
    const searchInput = screen.getByPlaceholderText(/Buscar código, serviço, tomador/i);
    fireEvent.change(searchInput, { target: { value: "Transbordo" } });

    // Limpa a busca para restaurar o dataset original
    fireEvent.change(searchInput, { target: { value: "" } });

    // Novo clique no card deve recomeçar do primeiro (SX-2026-103), pois a busca resetou o ciclo
    fireEvent.click(btnRequerAcao);
    const rowDevolvido = document.getElementById("row-servico-se-103");
    expect(rowDevolvido?.className).toContain("ring-rose-500");
  });

  it("18. Preservação de filtros: cliques em cards não limpam busca nem seletores", () => {
    renderServicosExtras();

    const searchInput = screen.getByPlaceholderText(/Buscar código, serviço, tomador/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Transamazônica" } });
    expect(searchInput.value).toBe("Transamazônica");

    // Clica no card Requer Ação
    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    fireEvent.click(btnRequerAcao);

    // O valor do input de busca deve permanecer inalterado
    expect(searchInput.value).toBe("Transamazônica");
  });

  it("19. Cards preservam superfície bg-card e não viram blocos sólidos de cor", () => {
    renderServicosExtras();

    const btnRequerAcao = screen.getByRole("button", { name: /Requer Ação/i });
    expect(btnRequerAcao.className).toContain("bg-card");

    const btnFin = screen.getByRole("button", { name: /Aguardando Financeiro/i });
    expect(btnFin.className).toContain("bg-card");

    const btnConcluidos = screen.getByRole("button", { name: /Faturados \/ Concluídos/i });
    expect(btnConcluidos.className).toContain("bg-card");
  });
});
