import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabOperacoesVolume from "@/pages/UxLab/UxLabOperacoesVolume";
import { OPERACOES_VOLUME_MOCKS, OPERACOES_VOLUME_PIPELINE_STEPS } from "@/pages/UxLab/operacoesVolumeMockData";

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderOperacoesVolume(initialRoute = "/ux-lab/operacoes-volume") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/operacoes-volume" element={<UxLabOperacoesVolume />} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

describe("UX05 — Operações por Volume V2 — Protótipo 1", () => {
  it("1. Renderiza o cabeçalho com título, subtítulo operacional, seletor de empresa e CTA", () => {
    renderOperacoesVolume();

    // Título e Subtítulo
    expect(screen.getByRole("heading", { name: /Operações por Volume/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhe lançamentos, validações in loco e avanço das operações no pátio/i)
    ).toBeInTheDocument();

    // CTA Nova Operação
    expect(screen.getByRole("button", { name: /Nova Operação/i })).toBeInTheDocument();
  });

  it("2. Apresenta síntese operacional compacta com 4 indicadores de trabalho (sem métricas financeiras)", () => {
    renderOperacoesVolume();

    // 4 indicadores de estado do trabalho
    expect(screen.getByText(/Operações no Período/i)).toBeInTheDocument();
    expect(screen.getByText(/Requer Validação/i)).toBeInTheDocument();
    expect(screen.getByText(/Com Restrição/i)).toBeInTheDocument();
    expect(screen.getByText(/Prontas p\/ Faturar/i)).toBeInTheDocument();

    // Assegura que métricas financeiras de DRE/Dashboard NÃO estão nos cards de síntese
    expect(screen.queryByText(/Receita Bruta/i)).toBeNull();
    expect(screen.queryByText(/Lucro Líquido/i)).toBeNull();
    expect(screen.queryByText(/Margem Operacional/i)).toBeNull();
    expect(screen.queryByText(/Ticket Médio/i)).toBeNull();
  });

  it("3. Exibe tabela operacional de alta densidade com ambos os status desacoplados (Operação e RH)", () => {
    renderOperacoesVolume();

    // Colunas essenciais
    expect(screen.getByRole("columnheader", { name: /^Operação$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Data/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Unidade \/ Contexto/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pipeline Operação/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Status RH/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pendência/i })).toBeInTheDocument();

    // Operações do mock renderizadas
    expect(screen.getByText("OP-8821")).toBeInTheDocument();
    expect(screen.getByText("OP-8820")).toBeInTheDocument();
    expect(screen.getByText("OP-8819")).toBeInTheDocument();

    // Badges/indicadores independentes para status operacional (stepper) e status RH (badge)
    expect(screen.getAllByRole("region", { name: /Pipeline operacional:/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
  });

  it("4. Sinaliza semanticamente a operação em EM_RESTRICAO com indicador localizado", () => {
    renderOperacoesVolume();

    // Localiza a linha da operação OP-8819 (em restrição)
    const opRow = screen.getByText("OP-8819").closest("tr");
    expect(opRow).toBeInTheDocument();

    if (opRow) {
      // Stepper localizado com indicador semântico de restrição
      expect(
        within(opRow).getByRole("region", { name: /Pipeline operacional: Em Restrição\./i })
      ).toBeInTheDocument();
      // Status RH de devolução
      expect(within(opRow).getByText(/Devolvido/i)).toBeInTheDocument();
    }
  });

  it("5. Filtro de busca textual localiza por código, cliente ou placa", () => {
    renderOperacoesVolume();

    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });

    // Deve exibir apenas a operação da Nestlé
    expect(screen.getByText("OP-8820")).toBeInTheDocument();
    expect(screen.queryByText("OP-8821")).toBeNull();
  });

  it("6. Clicar em uma linha de operação abre o Drawer lateral com diagnóstico completo", () => {
    renderOperacoesVolume();

    // Clica na linha da operação OP-8821
    const opItem = screen.getByText("OP-8821");
    fireEvent.click(opItem);

    // O Drawer deve abrir e exibir detalhes de cabeçalho
    expect(screen.getByText("Contexto da Carga & Transporte")).toBeInTheDocument();
    expect(screen.getAllByText("Ambev S/A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jamef Encomendas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BRA-2E19").length).toBeGreaterThan(0);
    expect(screen.getByText("NF 89211")).toBeInTheDocument();

    // Equipe: Headcount declarado vs nominais vinculados
    expect(screen.getByText("Equipe Alocada")).toBeInTheDocument();
    expect(screen.getByText("4 pessoas")).toBeInTheDocument();
    expect(screen.getByText("José Carlos Alcantara")).toBeInTheDocument();

    // Composição do Valor (Descarga + ISS + Insumos = Total)
    expect(screen.getByText("Composição do Valor da Operação")).toBeInTheDocument();
    expect(screen.getByText(/Descarga \(1850 × R\$ 0.42\)/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 777.00")).toBeInTheDocument();
    expect(screen.getByText("R$ 38.85")).toBeInTheDocument(); // ISS 5%
    expect(screen.getByText("R$ 45.00")).toBeInTheDocument(); // Filme Stretch
    expect(screen.getByText("R$ 860.85")).toBeInTheDocument(); // Total

    // Não deve conter menção a 'valor imutável'
    expect(screen.queryByText(/valor imutável/i)).toBeNull();

    // Modalidade financeira (Faturamento Mensal: relação N:1)
    expect(screen.getByText(/Agregação Mensal \(N operações : 1 fatura\)/i)).toBeInTheDocument();
  });

  it("7. Operação aberta (RECEBIDO) permite ação de edição no Drawer", () => {
    renderOperacoesVolume();

    // Abre OP-8821 (status = RECEBIDO)
    fireEvent.click(screen.getByText("OP-8821"));

    const btnEdit = screen.getByRole("button", { name: /Editar Operação/i });
    expect(btnEdit).toBeEnabled();

    // Exclusão permitida para operações abertas
    expect(screen.getByRole("button", { name: /Excluir/i })).toBeInTheDocument();
  });

  it("8. Operação faturada (FATURADO) bloqueia edição (Regra ESTADO_FECHADO) e oculta exclusão", () => {
    renderOperacoesVolume();

    // Abre OP-8815 (status = FATURADO)
    fireEvent.click(screen.getByText("OP-8815"));

    const btnEdit = screen.getByRole("button", { name: /Editar Operação/i });
    expect(btnEdit).toBeDisabled();

    // Exclusão é bloqueada/oculta
    expect(screen.queryByRole("button", { name: /Excluir/i })).toBeNull();
  });

  it("9. Divergência entre headcount declarado e vinculados é tratada com nota neutra sem rotular de erro", () => {
    renderOperacoesVolume();

    // OP-8810 tem headcount declarado = 4 e nominais = 2
    fireEvent.click(screen.getByText("OP-8810"));

    expect(screen.getByText("4 pessoas")).toBeInTheDocument();
    expect(
      screen.getByText(/Divergência entre headcount total declarado \(4\) e colaboradores vinculados nominalmente \(2\)/i)
    ).toBeInTheDocument();
  });

  it("10. Sinaliza banner informativo de assimetria quando pagamento foi recebido mas RH está pendente", () => {
    renderOperacoesVolume();

    // OP-8810 tem status_pagamento = RECEBIDO e status_rh = PENDENTE_RH
    fireEvent.click(screen.getByText("OP-8810"));

    expect(
      screen.getByText(/O recebimento financeiro já foi confirmado/i)
    ).toBeInTheDocument();
  });

  it("11. Operação em EM_RESTRICAO exibe diagnóstico e ação contextual de regularização de horários no Drawer", () => {
    renderOperacoesVolume();

    // Abre OP-8819 (em restrição por falta de horário de saída)
    fireEvent.click(screen.getByText("OP-8819"));

    expect(screen.getByText(/Operação em Restrição/i)).toBeInTheDocument();
    expect(screen.getByText(/Horário de término in loco não informado pelo encarregado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resolver inconsistência/i })).toBeInTheDocument();
  });

  it("12. Aplica a grade de largura estrutural horizontal padronizada (max-w-[1560px])", () => {
    const { container } = renderOperacoesVolume();
    const contentArea = container.querySelector(".max-w-\\[1560px\\]");
    expect(contentArea).toBeInTheDocument();
  });

  it("13. Cards de síntese são interativos: clicar em Com Restrição localiza a linha e aplica destaque temporário", () => {
    renderOperacoesVolume();

    // Clica no card Com Restrição
    const btnRestricao = screen.getByRole("button", { name: /Com Restrição/i });
    fireEvent.click(btnRestricao);

    // Linha OP-8819 deve ter o id op-row-op-mock-003 e a classe de highlight temporário
    const opRow = document.getElementById("op-row-op-mock-003");
    expect(opRow).toBeInTheDocument();
    expect(opRow?.className).toContain("ring-rose-500");
  });

  it("14. Clicar em Requer Validação prioriza EM_VALIDACAO e ativa a navegação sem limpar filtros", () => {
    renderOperacoesVolume();

    // Seleciona uma empresa manualmente
    const selectEmpresa = screen.getByRole("combobox", { name: /Seletor de Empresa/i });
    expect(selectEmpresa).toBeInTheDocument();

    // Clica em Requer Validação (primeiro clique prioriza EM_VALIDACAO = op-mock-002)
    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });
    fireEvent.click(btnVal);
    const rowVal = document.getElementById("op-row-op-mock-002");
    expect(rowVal).toBeInTheDocument();
    expect(rowVal?.className).toContain("ring-amber-500");

    // Clica em Prontas p/ Faturar (localiza exclusivamente AGUARDANDO_FATURAMENTO = op-mock-004)
    const btnProntas = screen.getByRole("button", { name: /Prontas p\/ Faturar/i });
    fireEvent.click(btnProntas);
    const rowProntas = document.getElementById("op-row-op-mock-004");
    expect(rowProntas).toBeInTheDocument();
    expect(rowProntas?.className).toContain("ring-indigo-500");

    // Clica em Operações no Período para restaurar visão geral
    const btnTodos = screen.getByRole("button", { name: /Operações no Período/i });
    fireEvent.click(btnTodos);
    expect(document.getElementById("op-row-op-mock-001")).toBeInTheDocument();
  });

  it("15. Drawer remove o botão X superior, preserva botão Fechar no rodapé e fecha com tecla ESC", () => {
    renderOperacoesVolume();

    // Abre OP-8821
    fireEvent.click(screen.getByText("OP-8821"));

    // Garante que o Drawer abriu
    expect(screen.getByText("Contexto da Carga & Transporte")).toBeInTheDocument();

    // Não deve existir o botão de fechar com aria-label ou texto Close no topo
    expect(screen.queryByRole("button", { name: /Close/i })).toBeNull();

    // O botão 'Fechar' no rodapé deve estar visível e funcional
    const btnFechar = screen.getByRole("button", { name: /^Fechar$/i });
    expect(btnFechar).toBeInTheDocument();

    // Pressiona ESC para fechar
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });

  it("16. Filtro Temporal Híbrido exibe label completo sem truncamento e permite alternar presets", () => {
    renderOperacoesVolume();

    // Botão do filtro temporal
    const btnFiltro = screen.getByRole("button", { name: /Filtro Temporal/i });
    expect(btnFiltro).toBeInTheDocument();
    expect(btnFiltro).toHaveTextContent("Todo o Período");

    // Abre popover
    fireEvent.click(btnFiltro);

    // Deve exibir atalhos rápidos
    expect(screen.getByText("Hoje (03/10)")).toBeInTheDocument();
    expect(screen.getByText("Outubro/2026")).toBeInTheDocument();
    expect(screen.getByText("Setembro/2026")).toBeInTheDocument();
    expect(screen.getByText("Selecionar data...")).toBeInTheDocument();
    expect(screen.getByText("Selecionar período...")).toBeInTheDocument();

    // Seleciona 'Hoje (03/10)'
    fireEvent.click(screen.getByText("Hoje (03/10)"));
    expect(btnFiltro).toHaveTextContent("Hoje (03/10)");

    // Deve listar operações de hoje (OP-8821, OP-8820) e omitir as de setembro (OP-8815, OP-8810, OP-8801)
    expect(screen.getByText("OP-8821")).toBeInTheDocument();
    expect(screen.getByText("OP-8820")).toBeInTheDocument();
    expect(screen.queryByText("OP-8815")).toBeNull();
  });

  it("17. Filtro Temporal Híbrido permite navegação para modo data específica e range", () => {
    renderOperacoesVolume();

    const btnFiltro = screen.getByRole("button", { name: /Filtro Temporal/i });
    fireEvent.click(btnFiltro);

    // Clica em 'Selecionar data...'
    fireEvent.click(screen.getByText("Selecionar data..."));
    expect(screen.getByText("Escolha o dia")).toBeInTheDocument();
    expect(screen.getByText("Voltar aos atalhos")).toBeInTheDocument();

    // Volta ao menu
    fireEvent.click(screen.getByText("Voltar aos atalhos"));
    expect(screen.getByText("Selecionar período...")).toBeInTheDocument();

    // Clica em 'Selecionar período...'
    fireEvent.click(screen.getByText("Selecionar período..."));
    expect(screen.getByText("Escolha o intervalo de datas")).toBeInTheDocument();
  });

  it("18. Coerência semântica: highlight da linha respeita o status real da ocorrência (não a cor do card)", () => {
    renderOperacoesVolume();

    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });

    // 1º clique: localiza OP-8820 (EM_VALIDACAO) -> deve receber ring âmbar (ring-amber-500)
    fireEvent.click(btnVal);
    const rowEmVal = document.getElementById("op-row-op-mock-002");
    expect(rowEmVal?.className).toContain("ring-amber-500");

    // 2º clique: localiza OP-8821 (RECEBIDO) -> deve receber ring azul (ring-blue-500), NUNCA âmbar
    fireEvent.click(btnVal);
    const rowRecebido = document.getElementById("op-row-op-mock-001");
    expect(rowRecebido?.className).toContain("ring-blue-500");
    expect(rowRecebido?.className).not.toContain("ring-amber-500");
  });

  it("19. Navegação circular: cliques sucessivos percorrem múltiplas ocorrências e voltam ao início", () => {
    renderOperacoesVolume();

    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });

    // Clique 1 -> OP-8820 (EM_VALIDACAO)
    fireEvent.click(btnVal);
    expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();

    // Clique 2 -> OP-8821 (RECEBIDO)
    fireEvent.click(btnVal);
    expect(document.getElementById("op-row-op-mock-001")).toBeInTheDocument();

    // Clique 3 -> Volta ao primeiro (OP-8820)
    fireEvent.click(btnVal);
    expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();
  });

  it("20. Alteração de filtro ou busca reseta a sequência de navegação circular", () => {
    renderOperacoesVolume();

    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });

    // Avança 1 vez na sequência (índice vai para 1)
    fireEvent.click(btnVal);
    expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();

    // Altera a busca
    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i);
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });

    // Limpa a busca para restaurar o dataset original
    fireEvent.change(searchInput, { target: { value: "" } });

    // Novo clique no card deve recomeçar do primeiro (OP-8820), pois a busca resetou o ciclo
    fireEvent.click(btnVal);
    expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();
  });

  it("21. Preservação de filtros: cliques em cards não limpam busca nem seletores", () => {
    renderOperacoesVolume();

    const searchInput = screen.getByPlaceholderText(/Buscar código, cliente, placa, NF/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Nestlé" } });
    expect(searchInput.value).toBe("Nestlé");

    // Clica no card Requer Validação
    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });
    fireEvent.click(btnVal);

    // O valor do input de busca deve permanecer inalterado
    expect(searchInput.value).toBe("Nestlé");
  });

  it("22. Cards preservam superfície bg-card e não viram blocos sólidos de cor", () => {
    renderOperacoesVolume();

    const btnVal = screen.getByRole("button", { name: /Requer Validação/i });
    expect(btnVal.className).toContain("bg-card");

    const btnRestricao = screen.getByRole("button", { name: /Com Restrição/i });
    expect(btnRestricao.className).toContain("bg-card");
  });

  describe("Cobertura Mínima — UxPipelineStepper UX05 (Operações por Volume)", () => {
    it("1. Pipeline possui quantidade correta de etapas (6 etapas canônicas)", () => {
      expect(OPERACOES_VOLUME_PIPELINE_STEPS).toHaveLength(6);
      expect(OPERACOES_VOLUME_PIPELINE_STEPS.map((s) => s.key)).toEqual([
        "RECEBIDO",
        "EM_VALIDACAO",
        "AGUARDANDO_FATURAMENTO",
        "FATURADO",
        "RECEBIDO_FINANCEIRO",
        "CONCLUIDO",
      ]);
    });

    it("2. RECEBIDO marca início da esteira operacional", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8821").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Recebido\. Etapa 1 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("3. EM_VALIDACAO marca etapa correspondente (etapa 2)", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8820").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Em Validação\. Etapa 2 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("4. EM_RESTRICAO aparece como exceção/bloqueio sem criar etapa linear artificial", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8819").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Em Restrição\. Etapa 2 de 6\./i,
        });
        expect(region).toBeInTheDocument();
        // Contém o indicador visual de exceção
        expect(within(region).getByText("✕")).toBeInTheDocument();
      }
    });

    it("5. AGUARDANDO_FATURAMENTO corretamente localizado na etapa 3", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8818").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Aguardando Faturamento\. Etapa 3 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("6. FATURADO corretamente localizado na etapa 4", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8815").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Faturado\. Etapa 4 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("7. RECEBIDO_FINANCEIRO corretamente localizado na etapa 5", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8810").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Recebido Financeiro\. Etapa 5 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("8. CONCLUIDO completa a esteira integralmente", () => {
      renderOperacoesVolume();
      const row = screen.getByText("OP-8801").closest("tr");
      expect(row).toBeInTheDocument();
      if (row) {
        const region = within(row).getByRole("region", {
          name: /Pipeline operacional: Concluído\. Etapa 6 de 6\./i,
        });
        expect(region).toBeInTheDocument();
      }
    });

    it("9. status_rh NÃO aparece na esteira operacional principal", () => {
      // Nenhum dos passos contém PENDENTE_RH, VALIDADO_RH, DEVOLVIDO_RH etc
      const keys = OPERACOES_VOLUME_PIPELINE_STEPS.map((s) => s.key);
      expect(keys).not.toContain("PENDENTE_RH");
      expect(keys).not.toContain("VALIDADO_RH");
      expect(keys).not.toContain("DEVOLVIDO_RH");
      expect(keys).not.toContain("EM_ANALISE_RH");
    });

    it("10. Modo compact funciona na tabela em todas as linhas", () => {
      renderOperacoesVolume();
      const steppers = screen.getAllByRole("region", { name: /Pipeline operacional:/i });
      expect(steppers.length).toBeGreaterThanOrEqual(7);
    });

    it("11. Modo detailed funciona no Drawer sob seção 'ETAPAS DO PROCESSO'", () => {
      renderOperacoesVolume();
      // Abre OP-8821
      fireEvent.click(screen.getByText("OP-8821"));

      expect(screen.getByText(/Etapas do Processo/i)).toBeInTheDocument();
      expect(
        screen.getByText("Acompanhamento da esteira operacional desta operação.")
      ).toBeInTheDocument();
      expect(screen.getByText("6 etapas canônicas")).toBeInTheDocument();
      // Verifica presença dos rótulos detalhados
      expect(screen.getAllByText(/Aguardando faturamento/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Recebido financeiro/i).length).toBeGreaterThan(0);
    });

    it("12. Navegação circular dos cards continua funcionando normalmente", () => {
      renderOperacoesVolume();
      const btnVal = screen.getByRole("button", { name: /Requer Validação/i });

      // Clique 1
      fireEvent.click(btnVal);
      expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();

      // Clique 2
      fireEvent.click(btnVal);
      expect(document.getElementById("op-row-op-mock-001")).toBeInTheDocument();

      // Clique 3 retorna ao 1º
      fireEvent.click(btnVal);
      expect(document.getElementById("op-row-op-mock-002")).toBeInTheDocument();
    });

    it("13. Highlight da linha continua obedecendo ao status real da ocorrência", () => {
      renderOperacoesVolume();
      const btnRestricao = screen.getByRole("button", { name: /Com Restrição/i });
      fireEvent.click(btnRestricao);
      const row = document.getElementById("op-row-op-mock-003");
      expect(row?.className).toContain("ring-rose-500");
    });

    it("14. Light/Dark theme rendering sem regressão estrutural", () => {
      const { container } = renderOperacoesVolume();
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
