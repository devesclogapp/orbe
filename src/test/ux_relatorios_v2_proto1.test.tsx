import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UxLabRelatoriosHub from "@/pages/UxLab/UxLabRelatoriosHub";
import UxLabRelatorioView from "@/pages/UxLab/UxLabRelatorioView";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import { RELATORIOS_CATALOGO } from "@/pages/UxLab/relatoriosMockData";

describe("UX04 — Relatórios V2: Protótipo 1 (UX Lab)", () => {
  const renderWithProviders = (initialRoute: string) => {
    return render(
      <UxLabThemeProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/ux-lab/relatorios" element={<UxLabRelatoriosHub />} />
            <Route path="/ux-lab/relatorios/:reportId" element={<UxLabRelatorioView />} />
          </Routes>
        </MemoryRouter>
      </UxLabThemeProvider>
    );
  };

  it("1. Central de Relatórios exibe os 3 domínios corretos e lista os 6 relatórios autorizados", () => {
    renderWithProviders("/ux-lab/relatorios");

    // Valida domínios
    expect(screen.getByText("OPERACIONAL")).toBeInTheDocument();
    expect(screen.getByText("PESSOAS & RH")).toBeInTheDocument();
    expect(screen.getByText("FINANCEIRO & FATURAMENTO")).toBeInTheDocument();

    // Valida os 6 relatórios autorizados no catálogo
    const catalogSection = screen.getByText("Relatórios Oficiais").closest("section");
    expect(within(catalogSection!).getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Custos Extras Operacionais")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Analítico de Serviços Extras")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Fechamento de Diaristas")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Consolidado de Banco de Horas")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Faturamento e Receitas")).toBeInTheDocument();

    // Valida que R06 (Produtividade) está categoricamente BLOQUEADO / inexistente
    expect(screen.queryByText(/Produtividade da Equipe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/R06/i)).not.toBeInTheDocument();
  });

  it("2. Busca rápida filtra relatórios por código, título ou descrição", () => {
    renderWithProviders("/ux-lab/relatorios");

    const searchInput = screen.getByPlaceholderText(/Buscar por código, nome ou palavra-chave/i);
    fireEvent.change(searchInput, { target: { value: "Banco de Horas" } });

    const catalogSection = screen.getByText("Relatórios Oficiais").closest("section");
    expect(within(catalogSection!).getByText("Consolidado de Banco de Horas")).toBeInTheDocument();
    expect(within(catalogSection!).queryByText("Analítico de Operações por Volume")).not.toBeInTheDocument();
    expect(within(catalogSection!).queryByText("Fechamento de Diaristas")).not.toBeInTheDocument();
  });

  it("3. R01 — Operações por Volume renderiza colunas homologadas e totalizadores", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    expect(screen.getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(screen.getByText("Dataset de Consulta")).toBeInTheDocument();

    // Valida cabeçalhos de colunas homologadas
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Transportadora")).toBeInTheDocument();
    expect(screen.getByText("Total Bruto")).toBeInTheDocument();
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    expect(screen.getByText("ISS")).toBeInTheDocument();
    expect(screen.getByText("Placa")).toBeInTheDocument();
    expect(screen.getByText("NF")).toBeInTheDocument();

    // Valida totalizadores contextuais
    expect(screen.getByText("Total de Operações")).toBeInTheDocument();
    expect(screen.getByText("Volume Movimentado")).toBeInTheDocument();
    expect(screen.getByText("Total Bruto Apurado")).toBeInTheDocument();
  });

  it("4. R05 — Banco de Horas opera ESTRITAMENTE em Horas/Minutos (sem R$, sem Passivo)", () => {
    renderWithProviders("/ux-lab/relatorios/r05-banco-horas");

    expect(screen.getByText("Consolidado de Banco de Horas")).toBeInTheDocument();

    // Valida colunas de horas
    expect(screen.getByText("Saldo Atual")).toBeInTheDocument();
    expect(screen.getByText("Créditos")).toBeInTheDocument();
    expect(screen.getByText("Débitos")).toBeInTheDocument();
    expect(screen.getAllByText("A Vencer (30d)").length).toBeGreaterThan(0);
    expect(screen.getByText("Vencidas")).toBeInTheDocument();
    expect(screen.getAllByText("Situação de Risco").length).toBeGreaterThan(0);

    // Proibido: R$, Passivo, Provisão, Encargos
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/Passivo Trabalhista/i);
    expect(containerText).not.toMatch(/Provisão Financeira/i);
    expect(containerText).not.toMatch(/Encargos/i);

    // Valida dados formatados em Horas/Minutos
    expect(screen.getAllByText("+18h 30m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-08h 30m").length).toBeGreaterThan(0);
  });

  it("5. R03 — Faturamento e Receitas exibe faturamento correto e NÃO inclui Custos Extras", () => {
    renderWithProviders("/ux-lab/relatorios/r03-faturamento-receitas");

    expect(screen.getByText("Faturamento e Receitas")).toBeInTheDocument();

    // Valida colunas
    expect(screen.getByText("Cliente Tomador")).toBeInTheDocument();
    expect(screen.getAllByText("Modalidade").length).toBeGreaterThan(0);
    expect(screen.getByText("Origem do Faturamento")).toBeInTheDocument();
    expect(screen.getByText("Valor Faturado")).toBeInTheDocument();
    expect(screen.getByText("Vencimento")).toBeInTheDocument();
    expect(screen.getByText("Recebimento")).toBeInTheDocument();
    expect(screen.getAllByText("Status Financeiro").length).toBeGreaterThan(0);

    // Valida origens permitidas
    expect(screen.getAllByText("Operação por Volume").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Serviço Extra").length).toBeGreaterThan(0);

    // Proibido Custos Extras como receita
    const tableText = document.querySelector("table")?.textContent || "";
    expect(tableText).not.toContain("Custo Extra");
  });

  it("6. Nenhum dos 6 relatórios mostra 'Em Preparação' e todos estão funcionais", () => {
    renderWithProviders("/ux-lab/relatorios");

    // Valida que nenhum card exibe badge "Em Preparação"
    expect(screen.queryByText("Em Preparação")).not.toBeInTheDocument();
  });

  it("7. R02 — Fechamento de Diaristas abre, possui colunas homologadas, CPF minimizado e NÃO inventa vínculo com operação", () => {
    renderWithProviders("/ux-lab/relatorios/r02-fechamento-diaristas");

    expect(screen.getByText("Fechamento de Diaristas")).toBeInTheDocument();
    expect(screen.queryByText("Protótipo em Preparação no UX Lab")).not.toBeInTheDocument();

    // Colunas homologadas
    expect(screen.getByText("Colaborador")).toBeInTheDocument();
    expect(screen.getByText("CPF")).toBeInTheDocument();
    expect(screen.getAllByText("Função").length).toBeGreaterThan(0);
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Qtd Diárias")).toBeInTheDocument();
    expect(screen.getByText("Valor Diária")).toBeInTheDocument();
    expect(screen.getByText("Lote")).toBeInTheDocument();
    expect(screen.getAllByText("Status do Lote").length).toBeGreaterThan(0);

    // Dados e minimização visual do CPF
    expect(screen.getAllByText("Raimundo Nonato Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("***.***.812-44").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LOTE-DIA-2026-39-01").length).toBeGreaterThan(0);

    // Funções e status reais
    expect(screen.getAllByText("Ajudante Geral").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Movimentador").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);

    // KPIs discretos de Diaristas
    expect(screen.getByText("Diaristas no Período")).toBeInTheDocument();
    expect(screen.getByText("Total de Diárias")).toBeInTheDocument();
    expect(screen.getByText("Valor Consolidado")).toBeInTheDocument();

    // PROIBIDO: caminhão, carga, produtividade, operação específica
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/Placa do Caminhão/i);
    expect(containerText).not.toMatch(/Produtividade/i);
  });

  it("8. R04 — Custos Extras Operacionais abre, segrega despesas, exibe Favorecido e NÃO aparece como receita", () => {
    renderWithProviders("/ux-lab/relatorios/r04-custos-extras");

    expect(screen.getByText("Custos Extras Operacionais")).toBeInTheDocument();
    expect(screen.queryByText("Protótipo em Preparação no UX Lab")).not.toBeInTheDocument();

    // Colunas homologadas
    expect(screen.getByText("Unidade")).toBeInTheDocument();
    expect(screen.getAllByText(/Categoria/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Descrição")).toBeInTheDocument();
    expect(screen.getByText("Favorecido")).toBeInTheDocument();
    expect(screen.getByText("Origem Recurso")).toBeInTheDocument();
    expect(screen.getByText("Lançador")).toBeInTheDocument();

    // Favorecido com badge discreto Colaborador / Fornecedor
    expect(screen.getAllByText("Colaborador").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fornecedor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carlos Eduardo (Encarregado)").length).toBeGreaterThan(0);
    expect(screen.getByText("Metalúrgica Castanhal Ltda")).toBeInTheDocument();

    // Categorias e origens reais
    expect(screen.getAllByText("Merenda / Lanche").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Operacional").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAIXINHA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BOLETO").length).toBeGreaterThan(0);

    // KPIs de despesas
    expect(screen.getByText("Lançamentos de Custos")).toBeInTheDocument();
    expect(screen.getByText("Despesas Consolidadas")).toBeInTheDocument();

    // PROIBIDO: centro de custo contábil complexo, cliente tomador como receita
    const tableText = document.querySelector("table")?.textContent || "";
    expect(tableText).not.toContain("Cliente Tomador");
    expect(tableText).not.toContain("Centro de Custo Gerencial Nível 4");
  });

  it("9. R07 — Analítico de Serviços Extras abre, domínio operacional e campos auditados", () => {
    renderWithProviders("/ux-lab/relatorios/r07-servicos-extras");

    expect(screen.getByText("Analítico de Serviços Extras")).toBeInTheDocument();
    expect(screen.queryByText("Protótipo em Preparação no UX Lab")).not.toBeInTheDocument();

    // Colunas homologadas
    expect(screen.getAllByText("Tipo de Serviço").length).toBeGreaterThan(0);
    expect(screen.getByText("Cliente / Tomador")).toBeInTheDocument();
    expect(screen.getAllByText("Modalidade").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status Pipeline").length).toBeGreaterThan(0);

    // Serviços extras reais
    expect(screen.getAllByText("Conserto de Pallets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transbordo de Carga").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pintura de Pallets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enlonamento de Carga").length).toBeGreaterThan(0);

    // Status pipeline reais
    expect(screen.getAllByText("Concluído").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Faturado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aprov. Financeiro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aprov. Operação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);

    // KPIs operacionais
    expect(screen.getByText("Total de Serviços")).toBeInTheDocument();
    expect(screen.getByText("Total Operacional")).toBeInTheDocument();
  });

  it("10. Filtro de Empresa é obrigatório e segrega dados entre filiais sem rateio em todos os relatórios", () => {
    // Valida no R02
    renderWithProviders("/ux-lab/relatorios/r02-fechamento-diaristas");
    expect(screen.getByText("ESC LOG — Matriz Castanhal")).toBeInTheDocument();
    expect(screen.getAllByText("Raimundo Nonato Silva").length).toBeGreaterThan(0);
    expect(screen.queryByText("Edilson Barbosa Lima")).not.toBeInTheDocument(); // É de Benevides
    expect(screen.queryByText("Waldir Souza Ramos")).not.toBeInTheDocument(); // É de Belém

    // Valida no R04
    renderWithProviders("/ux-lab/relatorios/r04-custos-extras");
    expect(screen.getByText("Metalúrgica Castanhal Ltda")).toBeInTheDocument();
    expect(screen.queryByText("Auto Peças e Hidráulica Benevides")).not.toBeInTheDocument();

    // Valida no R07
    renderWithProviders("/ux-lab/relatorios/r07-servicos-extras");
    expect(screen.getAllByText("Bunge Alimentos Regional").length).toBeGreaterThan(0);
    expect(screen.queryByText("Exportadora Portuária Norte")).not.toBeInTheDocument();
  });

  it("11. Hotfix 02.1: R03 não contém modalidades ou status inventados e diferencia estado derivado", () => {
    renderWithProviders("/ux-lab/relatorios/r03-faturamento-receitas");

    const bodyText = document.body.textContent || "";
    expect(bodyText).not.toMatch(/Boleto 15d/i);
    expect(bodyText).not.toMatch(/Boleto 30d/i);
    expect(bodyText).not.toMatch(/À Vista/i);

    expect(screen.getAllByText("Faturamento Mensal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Duplicata").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Caixa Imediato").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Conciliado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recebido").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cobrança Enviada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aguardando Fechamento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Em Atraso (Derivado)").length).toBeGreaterThan(0);
  });

  it("12. Hotfix 02.1: R01 apresenta número de NF real ou travessão e status operacional real", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    expect(screen.getByText("89211")).toBeInTheDocument();
    expect(screen.getByText("10492")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    expect(screen.getAllByText("CONCLUÍDO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FATURADO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AGUARD. FATURAMENTO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EM VALIDAÇÃO").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Descarga").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carga").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Movimentação").length).toBeGreaterThan(0);
  });

  it("13. Paginação canônica compacta exibe contador de registros, página atual e botões Anterior/Próxima", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    expect(screen.getByText(/Mostrando 1 a \d+ de \d+ registros/i)).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Página anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Próxima página/i })).toBeInTheDocument();
    // Botão anterior deve estar desabilitado na página 1
    expect(screen.getByRole("button", { name: /Página anterior/i })).toBeDisabled();
  });

  it("14. Estado canônico sem dados (Empty State) exibe mensagem padronizada e botão Limpar filtros", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    // Aplica um filtro temporal no futuro que resulta em zero registros
    const dataDeInput = screen.getByLabelText(/Data Inicial/i) as HTMLInputElement;
    fireEvent.change(dataDeInput, { target: { value: "2029-01-01" } });

    // Verifica Empty State canônico
    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();
    expect(screen.getByText("Não existem dados para os filtros selecionados.")).toBeInTheDocument();
    expect(screen.getAllByText("Limpar filtros").length).toBeGreaterThan(0);
  });

  it("15. Botão Limpar filtros reseta parâmetros temporais e específicos preservando a empresa", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    // Altera filtro temporal
    const dataDeInput = screen.getByLabelText(/Data Inicial/i) as HTMLInputElement;
    fireEvent.change(dataDeInput, { target: { value: "2029-01-01" } });

    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();

    // Clica em Limpar filtros no empty state
    const clearButtons = screen.getAllByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(clearButtons[0]);

    // Registros devem retornar
    expect(screen.queryByText("Nenhum registro encontrado")).not.toBeInTheDocument();
    expect(screen.getByText("89211")).toBeInTheDocument();
    // Empresa ativa deve permanecer preservada
    expect(screen.getByText("ESC LOG — Matriz Castanhal")).toBeInTheDocument();
  });

  it("16. Cabeçalho de impressão (@media print) contém identificação institucional, empresa e período", () => {
    renderWithProviders("/ux-lab/relatorios/r01-operacoes-volume");

    expect(screen.getByText(/ORBE ERP — ESC LOGÍSTICA/i)).toBeInTheDocument();
    expect(screen.getByText(/R01 — Analítico de Operações por Volume/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Empresa: ESC LOG — Matriz Castanhal/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Período:/i)).toBeInTheDocument();
  });

  it("17. Todos os 6 relatórios abrem via URL sem erro e renderizam tabela canônica e exportação", () => {
    const reportIds = [
      "r01-operacoes-volume",
      "r02-fechamento-diaristas",
      "r03-faturamento-receitas",
      "r04-custos-extras",
      "r05-banco-horas",
      "r07-servicos-extras",
    ];

    reportIds.forEach((id) => {
      const { unmount } = renderWithProviders(`/ux-lab/relatorios/${id}`);
      expect(screen.getByText("Dataset de Consulta")).toBeInTheDocument();
      expect(screen.getByText(/Exportar/i)).toBeInTheDocument();
      expect(screen.getByText(/Página 1 de/i)).toBeInTheDocument();
      unmount();
    });
  });

  it("18. Hub da Central suporta navegação por teclado e possui acessibilidade em cards e busca", () => {
    renderWithProviders("/ux-lab/relatorios");

    const searchInput = screen.getByLabelText(/Buscar relatórios por código/i);
    expect(searchInput).toBeInTheDocument();

    const r01Card = screen.getByLabelText(/Abrir relatório R01/i);
    expect(r01Card).toHaveAttribute("tabIndex", "0");
    expect(r01Card).toHaveAttribute("role", "button");
  });
});

