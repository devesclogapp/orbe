import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UxLabRelatoriosHub from "@/pages/UxLab/UxLabRelatoriosHub";
import UxLabRelatorioView from "@/pages/UxLab/UxLabRelatorioView";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import {
  MOCK_R01_DATA,
  MOCK_R02_DATA,
  MOCK_R03_DATA,
  MOCK_R04_DATA,
  MOCK_R05_DATA,
  MOCK_R07_DATA,
} from "@/pages/UxLab/relatoriosMockData";

describe("UX04 — Central de Relatórios V2: Fase 02 (UX Lab)", () => {
  const renderWithProviders = (initialRoute: string = "/ux-lab/relatorios") => {
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

  it("1. Renderiza os 4 KPIs da Faixa de Síntese Analítica com métricas oficiais", () => {
    renderWithProviders();

    // 01 — REGISTROS CONSOLIDADOS
    expect(screen.getByText(/01 · Registros Consolidados/i)).toBeInTheDocument();
    expect(screen.getByText(/6\/6 relatórios com movimentação/i)).toBeInTheDocument();

    // 02 — VOLUME OPERACIONAL
    expect(screen.getByText(/02 · Volume Operacional/i)).toBeInTheDocument();
    expect(screen.getByText(/Operações por Volume · R01/i)).toBeInTheDocument();

    // 03 — RECEITAS REPORTADAS
    expect(screen.getByText(/03 · Receitas Reportadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Livro de Faturamento · R03/i)).toBeInTheDocument();

    // 04 — DESPESAS APURADAS
    expect(screen.getByText(/04 · Despesas Apuradas/i)).toBeInTheDocument();
    expect(screen.getByText(/Diaristas:/i)).toBeInTheDocument();
    expect(screen.getByText(/Custos:/i)).toBeInTheDocument();
  });

  it("2. Volume Operacional utiliza EXCLUSIVAMENTE R01 (soma física correta)", () => {
    renderWithProviders();

    // Soma manual esperada dos itens de Castanhal (emp-01) em Setembro 2026 de R01
    const r01Castanhal = MOCK_R01_DATA.filter(
      (r) => r.empresaId === "emp-01" && r.dataOperacao.startsWith("2026-09")
    );
    const expectedVolumeR01 = r01Castanhal.reduce((acc, r) => acc + r.quantidade, 0);

    // Soma de R07 (não deve ser incluída no volume)
    const r07Castanhal = MOCK_R07_DATA.filter(
      (r) => r.empresaId === "emp-01" && r.data.startsWith("2026-09")
    );
    const r07Qtd = r07Castanhal.reduce((acc, r) => acc + r.quantidade, 0);

    // O valor na tela deve ser exatamente o volume de R01 (10.110 unid.)
    expect(screen.getByText(`${expectedVolumeR01.toLocaleString("pt-BR")}`)).toBeInTheDocument();

    // Garante que não é a soma de R01 + R07
    const mixedVolume = (expectedVolumeR01 + r07Qtd).toLocaleString("pt-BR");
    expect(expectedVolumeR01).toBe(10110);
    expect(mixedVolume).not.toBe("10.110");
  });

  it("3. Receitas Reportadas utiliza EXCLUSIVAMENTE o Livro R03", () => {
    renderWithProviders();

    const r03Castanhal = MOCK_R03_DATA.filter(
      (r) => r.empresaId === "emp-01" && r.competencia === "2026-09"
    );
    const expectedReceitas = r03Castanhal.reduce((acc, r) => acc + r.valorFaturado, 0);

    // Faturamento esperado de R03: R$ 55.460,50
    expect(expectedReceitas).toBe(55460.5);
    expect(screen.getAllByText(/55\.460,50/).length).toBeGreaterThanOrEqual(1);
  });

  it("4. Despesas Apuradas consolida Diaristas (R02) + Custos Extras (R04) com composição secundária", () => {
    renderWithProviders();

    const r02Castanhal = MOCK_R02_DATA.filter(
      (r) => r.empresaId === "emp-01" && r.dataLancamento.startsWith("2026-09")
    );
    const r04Castanhal = MOCK_R04_DATA.filter(
      (r) => r.empresaId === "emp-01" && r.data.startsWith("2026-09")
    );

    const diaristasTotal = r02Castanhal.reduce((acc, r) => acc + r.total, 0);
    const custosTotal = r04Castanhal.reduce((acc, r) => acc + r.total, 0);
    const despesasTotal = diaristasTotal + custosTotal;

    expect(despesasTotal).toBe(3335);
    expect(diaristasTotal).toBe(1390);
    expect(custosTotal).toBe(1945);

    expect(screen.getAllByText(/3\.335,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1\.390,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1\.945,00/).length).toBeGreaterThanOrEqual(1);
  });

  it("5. Banco de Horas (R05) opera em Horas/Minutos fora dos valores monetários", () => {
    renderWithProviders();

    // Valida que Banco de Horas é exibido em horas/minutos
    expect(screen.getByText(/Banco de Horas \(CLT\) · R05:/i)).toBeInTheDocument();
    const r05Castanhal = MOCK_R05_DATA.filter((r) => r.empresaId === "emp-01" && r.competencia === "2026-09");
    const totalMinutos = r05Castanhal.reduce((acc, r) => acc + r.saldoMinutos, 0);
    const h = Math.floor(Math.abs(totalMinutos) / 60);
    const m = Math.abs(totalMinutos) % 60;
    const expectedSaldoStr = `+${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    expect(screen.getByText(expectedSaldoStr)).toBeInTheDocument();
    expect(screen.getByText(/a vencer \(30d\)/i)).toBeInTheDocument();

    // Valida que não existe passivo financeiro em R$ ou provisão
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/Passivo Trabalhista/i);
    expect(containerText).not.toMatch(/Provisão Financeira/i);
  });

  it("6. Infográfico 01 — Atividade Documental exibe proporção por domínio e cadernos", () => {
    renderWithProviders();

    expect(screen.getByText(/Atividade Documental do Período/i)).toBeInTheDocument();
    expect(screen.getByText(/Origem e proporção dos registros apurados nos livros oficiais/i)).toBeInTheDocument();

    // Domínios presentes na legenda do infográfico
    expect(screen.getByText(/Operacional:/i)).toBeInTheDocument();
    expect(screen.getByText(/Financeiro:/i)).toBeInTheDocument();

    // Mini cartões dos relatórios
    expect(screen.getAllByText("R01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R04").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R07").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R05").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R03").length).toBeGreaterThan(0);
  });

  it("7. Infográfico 02 — Valores Documentados compara grandezas sem executar subtração contábil (Anti-DRE)", () => {
    renderWithProviders();

    expect(screen.getByText(/Valores Documentados no Período/i)).toBeInTheDocument();
    expect(screen.getByText(/Grandezas Oficiais/i)).toBeInTheDocument();
    expect(screen.getByText(/Não representa resultado contábil ou apuração de margem/i)).toBeInTheDocument();

    // As três grandezas oficiais
    expect(screen.getByText("Receitas Reportadas")).toBeInTheDocument();
    expect(screen.getByText("Diaristas Apurados")).toBeInTheDocument();
    expect(screen.getAllByText("Custos Extras").length).toBeGreaterThan(0);

    // PROIBIDO: Margem, Lucro, Saldo Líquido, EBITDA, Resultado contábil
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/Margem de Contribuição/i);
    expect(containerText).not.toMatch(/Lucro Operacional/i);
    expect(containerText).not.toMatch(/EBITDA/i);
    expect(containerText).not.toMatch(/Entradas menos Saídas/i);
  });

  it("8. Catálogo exibe os 6 relatórios com dimensões auditáveis e badges de formato CSV/PDF", () => {
    renderWithProviders();

    expect(screen.getByText("Relatórios Oficiais")).toBeInTheDocument();

    // Dimensões do R01
    expect(screen.getByText("Unidade / Doca")).toBeInTheDocument();
    expect(screen.getByText("Transportadora")).toBeInTheDocument();
    expect(screen.getByText("Placa")).toBeInTheDocument();

    // Dimensões do R02
    expect(screen.getByText("Lote Semanal")).toBeInTheDocument();

    // Dimensões do R05
    expect(screen.getByText("Matrícula CLT")).toBeInTheDocument();

    // Formatos oficiais
    expect(screen.getAllByText("CSV").length).toBe(6);
    expect(screen.getAllByText("PDF").length).toBe(6);
  });

  it("9. Busca avançada do catálogo filtra por código, título ou dimensão (ex: Placa, Lote, Matrícula)", () => {
    renderWithProviders();

    const searchInput = screen.getByLabelText(/Buscar relatórios por código, título ou palavra-chave/i);

    // Busca por dimensão "Placa" -> Deve exibir R01
    fireEvent.change(searchInput, { target: { value: "Placa" } });
    expect(screen.getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(screen.queryByText("Consolidado de Banco de Horas")).not.toBeInTheDocument();

    // Busca por dimensão "Matrícula" -> Deve exibir R05
    fireEvent.change(searchInput, { target: { value: "Matrícula" } });
    expect(screen.getByText("Consolidado de Banco de Horas")).toBeInTheDocument();
    expect(screen.queryByText("Analítico de Operações por Volume")).not.toBeInTheDocument();

    // Limpa busca
    const clearButton = screen.getByTitle("Limpar termo");
    fireEvent.click(clearButton);
    expect(screen.getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(screen.getByText("Consolidado de Banco de Horas")).toBeInTheDocument();
  });

  it("10. Interação Infográfico -> Catálogo destaca o relatório fonte", () => {
    renderWithProviders();

    // Clica no mini card de R04 dentro do infográfico
    const r04Button = screen.getByRole("button", { name: "Destacar relatório R04 no catálogo" });
    fireEvent.click(r04Button);

    // Verifica que o badge de foco no catálogo foi ativado
    expect(screen.getByText(/Foco: R04/i)).toBeInTheDocument();
    expect(screen.getByText("Foco no Infográfico")).toBeInTheDocument();
  });

  it("11. NÃO utiliza UxPipelineStepper na Central", () => {
    renderWithProviders();

    // Garante que o componente stepper de esteiras não existe na página
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/UxPipelineStepper/i);
    expect(document.querySelector(".pipeline-stepper")).toBeNull();
  });

  it("12. Navegação para relatório individual propaga empresa e competência via query params", () => {
    renderWithProviders("/ux-lab/relatorios?empresa=emp-02&competencia=2026-09");

    // Valida que os seletores leram o contexto da URL
    expect(screen.getByText("ESC LOG — CD Benevides")).toBeInTheDocument();

    // Ao clicar em abrir relatório R01
    const openButtons = screen.getAllByRole("button", { name: /Abrir relatório/i });
    fireEvent.click(openButtons[0]);

    // O relatório individual carrega respeitando o contexto de Benevides
    expect(screen.getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(screen.getAllByText("ESC LOG — CD Benevides").length).toBeGreaterThan(0);
  });

  it("13. Cabeçalho exibe CTA institucional 'Gerar Dossiê da Competência' e abre modal de emissão", () => {
    renderWithProviders();

    const dossierBtn = screen.getByRole("button", { name: /Gerar Dossiê da Competência/i });
    expect(dossierBtn).toBeInTheDocument();

    fireEvent.click(dossierBtn);

    // O modal deve ser exibido com os relatórios oficiais e opções de saída
    expect(screen.getByText("Dossiê da Competência")).toBeInTheDocument();
    expect(screen.getByText(/Compilação documental e consolidação dos livros canônicos do ORBE ERP/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF Consolidado/i)).toBeInTheDocument();
    expect(screen.getByText(/PDFs Individuais/i)).toBeInTheDocument();
    expect(screen.getByText("Dados Estruturados")).toBeInTheDocument();

    // Valida que o dossiê lista os cadernos oficiais
    expect(screen.getByText("Síntese Geral da Competência")).toBeInTheDocument();
    expect(screen.getAllByText("Analítico de Operações por Volume").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fechamento de Diaristas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Faturamento e Receitas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Custos Extras Operacionais").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Consolidado de Banco de Horas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Analítico de Serviços Extras").length).toBeGreaterThanOrEqual(1);

    // Fecha modal
    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
  });

  it("14. Seção 'Integridade da Competência' exibe status real de dados dos 6 relatórios sem inventar validações", () => {
    renderWithProviders();

    expect(screen.getByText(/Integridade Documental da Competência/i)).toBeInTheDocument();
    expect(screen.getByText(/Verificação de disponibilidade e consistência dos cadernos canônicos/i)).toBeInTheDocument();

    // Valida que os status exibidos são legítimos: "Com dados"
    const comDadosBadges = screen.getAllByText(/Com dados/i);
    expect(comDadosBadges.length).toBeGreaterThanOrEqual(6);

    // Garante que não foram inventados status de auditoria fiscal ou contábil
    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/Certificado Digitalmente/i);
    expect(containerText).not.toMatch(/Autenticado em Cartório/i);
    expect(containerText).not.toMatch(/Validado pela Receita/i);
  });

  it("15. Seção 'Movimentação da Competência' (Ementa Documental) resume grandezas em formato compacto", () => {
    renderWithProviders();

    expect(screen.getByText(/Ementa Documental do Período:/i)).toBeInTheDocument();

    // Ementas específicas
    expect(screen.getByText(/Operações:/i)).toBeInTheDocument();
    expect(screen.getByText(/Pessoas \/ RH:/i)).toBeInTheDocument();
    expect(screen.getByText(/Receitas:/i)).toBeInTheDocument();
    expect(screen.getByText(/Despesas Campo:/i)).toBeInTheDocument();
  });

  it("16. Filtros de visualização do catálogo suportam 'Todos', 'Favoritos' e 'Recentes'", () => {
    renderWithProviders();

    const catalogSection = screen.getByText("Relatórios Oficiais").closest("section");
    const viewTodosButtons = within(catalogSection!).getAllByRole("button", { name: "Todos" });
    const viewModeTodosBtn = viewTodosButtons[0];
    const favBtn = within(catalogSection!).getByRole("button", { name: /^Favoritos/i });
    const recBtn = within(catalogSection!).getByRole("button", { name: "Recentes" });

    expect(viewModeTodosBtn).toBeInTheDocument();
    expect(favBtn).toBeInTheDocument();
    expect(recBtn).toBeInTheDocument();

    // Clica em Favoritos (filtra apenas favoritos padrão R01 e R03)
    fireEvent.click(favBtn);
    expect(within(catalogSection!).getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Faturamento e Receitas")).toBeInTheDocument();
    expect(within(catalogSection!).queryByText("Consolidado de Banco de Horas")).not.toBeInTheDocument();

    // Retorna a Todos pelo filtro de exibição
    fireEvent.click(viewModeTodosBtn);
    expect(within(catalogSection!).getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("Consolidado de Banco de Horas")).toBeInTheDocument();
  });

  it("17. Não exibe relatórios não homologados (R06, logs de auditoria brutos, contabilidade inventada)", () => {
    renderWithProviders();

    const containerText = document.body.textContent || "";
    expect(containerText).not.toMatch(/R06/i);
    expect(containerText).not.toMatch(/Lançamentos Contábeis/i);
    expect(containerText).not.toMatch(/Auditoria do Sistema/i);
    expect(containerText).not.toMatch(/Balancete/i);
  });

  it("18. Botões de ação direta CSV e PDF estão presentes no catálogo e acionáveis", () => {
    renderWithProviders();

    const csvButtons = screen.getAllByTitle(/Emitir dados estruturados em CSV/i);
    const pdfButtons = screen.getAllByTitle(/Emitir documento gerencial em PDF/i);

    expect(csvButtons.length).toBe(6);
    expect(pdfButtons.length).toBe(6);
  });

  it("19. Catálogo organiza os relatórios em grid de 2 colunas no desktop (lg:grid-cols-2) respeitando os 3 agrupamentos", () => {
    renderWithProviders();

    const catalogSection = screen.getByText("Relatórios Oficiais").closest("section");
    expect(catalogSection).toBeInTheDocument();

    // Valida os 3 grupos com contagens oficiais
    expect(within(catalogSection!).getByText("OPERACIONAL")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("PESSOAS & RH")).toBeInTheDocument();
    expect(within(catalogSection!).getByText("FINANCEIRO & FATURAMENTO")).toBeInTheDocument();

    // Valida que os containers de grid possuem a classe lg:grid-cols-2
    const gridContainers = catalogSection!.querySelectorAll(".lg\\:grid-cols-2");
    expect(gridContainers.length).toBe(3);

    // Valida a distribuição em Operacional: R01, R04, R07
    const opGroup = within(catalogSection!).getByText("OPERACIONAL").closest("section");
    expect(within(opGroup!).getByText("R01")).toBeInTheDocument();
    expect(within(opGroup!).getByText("R04")).toBeInTheDocument();
    expect(within(opGroup!).getByText("R07")).toBeInTheDocument();

    // Valida a distribuição em Pessoas & RH: R02, R05
    const rhGroup = within(catalogSection!).getByText("PESSOAS & RH").closest("section");
    expect(within(rhGroup!).getByText("R02")).toBeInTheDocument();
    expect(within(rhGroup!).getByText("R05")).toBeInTheDocument();

    // Valida a distribuição em Financeiro: R03
    const finGroup = within(catalogSection!).getByText("FINANCEIRO & FATURAMENTO").closest("section");
    expect(within(finGroup!).getByText("R03")).toBeInTheDocument();

    // Valida a anatomia do card no R01 (Código, Favorito, Nome, Dimensões, Contador, CSV, PDF, Abrir)
    const r01Card = document.getElementById("report-row-r01-operacoes-volume");
    expect(r01Card).toBeInTheDocument();
    expect(within(r01Card!).getByText("R01")).toBeInTheDocument();
    expect(within(r01Card!).getByRole("button", { name: /Remover R01 dos favoritos/i })).toBeInTheDocument();
    expect(within(r01Card!).getByText("Analítico de Operações por Volume")).toBeInTheDocument();
    expect(within(r01Card!).getByText(/Unidade \/ Doca/i)).toBeInTheDocument();
    expect(within(r01Card!).getByText(/6 registros/i)).toBeInTheDocument();
    expect(within(r01Card!).getByTitle(/Emitir dados estruturados em CSV de R01/i)).toBeInTheDocument();
    expect(within(r01Card!).getByTitle(/Emitir documento gerencial em PDF de R01/i)).toBeInTheDocument();
    expect(within(r01Card!).getByRole("button", { name: /Abrir relatório/i })).toBeInTheDocument();
  });

  // ============================================================
  // HOTFIX 03.2 — FILTRO GLOBAL POR FLUXO (EMPRESA + COMP + FLUXO)
  // ============================================================

  it("20. Seletor Global de Fluxo está presente no cabeçalho documental com 'Todos os Fluxos' como default", () => {
    renderWithProviders();

    const fluxoTrigger = screen.getByLabelText(/Selecione o fluxo/i);
    expect(fluxoTrigger).toBeInTheDocument();
    expect(within(fluxoTrigger).getByText("Todos os Fluxos")).toBeInTheDocument();
  });

  it("21. Filtro global por fluxo propaga para os KPIs superiores com grandezas específicas do fluxo (ex: operacoes-volume)", () => {
    renderWithProviders("/ux-lab/relatorios?empresa=emp-01&competencia=2026-09&fluxo=operacoes-volume");

    // Valida KPIs específicos do fluxo Operações por Volume (R01)
    expect(screen.getByText(/01 · Operações Registradas/i)).toBeInTheDocument();
    expect(screen.getByText(/6 descargas/i)).toBeInTheDocument();

    expect(screen.getByText(/02 · Volume Físico Movimentado/i)).toBeInTheDocument();
    expect(screen.getByText("10.110")).toBeInTheDocument();

    expect(screen.getByText(/03 · Faturamento Bruto Previsto/i)).toBeInTheDocument();
    expect(screen.getByText(/04 · Materiais & ISS Documentados/i)).toBeInTheDocument();

    // Valida rodapé contextual
    expect(screen.getByText(/Subtotal Líquido Apurado:/i)).toBeInTheDocument();
    expect(screen.getByText(/Caderno Oficial: R01/i)).toBeInTheDocument();

    // Garante que o KPI genérico transversal foi substituído
    expect(screen.queryByText(/01 · Registros Consolidados/i)).not.toBeInTheDocument();
  });

  it("22. Filtro global por fluxo filtra o Catálogo de Relatórios para o caderno correspondente (R04 para custos-extras)", () => {
    renderWithProviders("/ux-lab/relatorios?empresa=emp-01&competencia=2026-09&fluxo=custos-extras");

    const catalogSection = screen.getByText("Relatórios Oficiais").closest("section");
    expect(catalogSection).toBeInTheDocument();

    // Deve exibir exclusivamente R04
    expect(within(catalogSection!).getByText("R04")).toBeInTheDocument();
    expect(within(catalogSection!).queryByText("R01")).not.toBeInTheDocument();
    expect(within(catalogSection!).queryByText("R02")).not.toBeInTheDocument();
    expect(within(catalogSection!).queryByText("R03")).not.toBeInTheDocument();
    expect(within(catalogSection!).queryByText("R05")).not.toBeInTheDocument();
    expect(within(catalogSection!).queryByText("R07")).not.toBeInTheDocument();

    // KPIs adaptados para Custos Extras
    expect(screen.getByText(/01 · Lançamentos de Despesa/i)).toBeInTheDocument();
    expect(screen.getByText(/02 · Total Desembolsado/i)).toBeInTheDocument();
    expect(screen.getByText(/03 · Categorias Ativas/i)).toBeInTheDocument();
  });

  it("23. Fluxos em homologação sem dataset documental (intermitentes e clt-ponto) exibem estado honesto e backlog sem fabricar dados", () => {
    renderWithProviders("/ux-lab/relatorios?empresa=emp-01&competencia=2026-09&fluxo=intermitentes");

    // Verifica estado honesto na Síntese e no Catálogo
    expect(screen.getAllByText(/Caderno Oficial em Homologação Operacional/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/UX04-FLOW-INTERMITENTES-01/i).length).toBeGreaterThanOrEqual(1);

    // Não fabrica relatórios R08/R09 fictícios
    expect(screen.queryByText("R08")).not.toBeInTheDocument();
    expect(screen.queryByText("R09")).not.toBeInTheDocument();
  });

  // ============================================================
  // HOTFIX 03.3 — MAPA DE MOVIMENTAÇÃO DO PERÍODO (HEATMAP DOCUMENTAL)
  // ============================================================

  it("24. Mapa de Movimentação do Período renderiza 30 colunas de dias e processos suportados na visão Todos os Fluxos", () => {
    renderWithProviders();

    expect(screen.getByText("Mapa de Movimentação do Período")).toBeInTheDocument();

    // Dias 01 a 30
    expect(screen.getByRole("button", { name: /Filtrar pelo dia 01/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtrar pelo dia 15/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtrar pelo dia 30/i })).toBeInTheDocument();

    // Processos suportados na visão Todos os Fluxos no heatmap
    const heatmapSection = screen.getByText("Mapa de Movimentação do Período").closest("section")!;
    expect(within(heatmapSection).getByText("VOL")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("SERV")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("CUST")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("DIAR")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("FAT")).toBeInTheDocument();
  });

  it("25. Modos do Mapa de Movimentação (Movimentação, Valores, Pendências) alternam visualização e badges informativos", () => {
    renderWithProviders();

    const btnMov = screen.getByRole("button", { name: "Movimentação" });
    const btnVal = screen.getByRole("button", { name: "Valores" });
    const btnPend = screen.getByRole("button", { name: "Pendências" });

    expect(btnMov).toBeInTheDocument();
    expect(btnVal).toBeInTheDocument();
    expect(btnPend).toBeInTheDocument();

    // Default: Movimentação
    expect(screen.getByText("Volume de Lançamentos")).toBeInTheDocument();

    // Alterna para Valores
    fireEvent.click(btnVal);
    expect(screen.getByText("Intensidade Financeira")).toBeInTheDocument();

    // Alterna para Pendências
    fireEvent.click(btnPend);
    expect(screen.getByText("Concentração de Pendências")).toBeInTheDocument();
  });

  it("26. Clique no dia do Mapa ativa recorte temporal analítico com badge de filtro e ação de limpar", () => {
    renderWithProviders();

    const dia04Button = screen.getByRole("button", { name: /Filtrar pelo dia 04/i });
    fireEvent.click(dia04Button);

    // Exibe badge de recorte ativo
    expect(screen.getByText(/Recorte: Dia 04\/09\/2026/i)).toBeInTheDocument();

    // Botão Limpar recorte
    const clearButtons = screen.getAllByRole("button", { name: /Limpar recorte/i });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);

    // Clica para limpar
    fireEvent.click(clearButtons[0]);
    expect(screen.queryByText(/Recorte: Dia 04\/09\/2026/i)).not.toBeInTheDocument();
  });

  it("27. No modo de fluxo específico (operacoes-volume), o Mapa exibe subdimensões operacionais de R01", () => {
    renderWithProviders("/ux-lab/relatorios?empresa=emp-01&competencia=2026-09&fluxo=operacoes-volume");

    // Subdimensões operacionais de R01 dentro da seção do heatmap
    const heatmapSection = screen.getByText("Mapa de Movimentação do Período").closest("section")!;
    expect(within(heatmapSection).getByText("CARRETA")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("TRUCK")).toBeInTheDocument();
    expect(within(heatmapSection).getByText("TRANSB")).toBeInTheDocument();
  });
});
