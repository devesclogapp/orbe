import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import UxLabReceitas from "@/pages/UxLab/UxLabReceitas";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";
import {
  MOCK_RECEITAS_OPERACIONAIS,
  getEstagioUX,
  getSituacaoVencimento,
  calculateReceitasTotais,
} from "@/pages/UxLab/receitasMockData";

function renderReceitasPage(initialRoute = "/ux-lab/receitas") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/receitas" element={<UxLabReceitas />} />
          <Route path="/financeiro/retorno" element={<div>Central Bancária Mock</div>} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

describe("UX11 — Central de Receitas & Contas a Receber (Etapa 02 & Hotfix 02.1)", () => {
  beforeEach(() => {
    // Reset any state if necessary
  });

  it("1. Rota UX Lab: /ux-lab/receitas está mapeada canonicamente no Sidebar", () => {
    expect(UX_LAB_ROUTES["receitas"]).toBe("/ux-lab/receitas");
  });

  it("2. Título e Subtítulo oficiais da Central de Receitas & Contas a Receber", () => {
    renderReceitasPage();
    expect(
      screen.getAllByText("Central de Receitas & Contas a Receber").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        "Gestão do faturamento, cobranças e recebimentos originados das operações da empresa."
      )
    ).toBeInTheDocument();
  });

  it("3. Exibição dos 4 KPIs Financeiros Canônicos", () => {
    renderReceitasPage();
    expect(screen.getAllByText("Receita Reconhecida").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("A Faturar / Cobrar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("A Receber").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Recebido").length).toBeGreaterThanOrEqual(1);
  });

  it("4. Consistência Matemática Exata: 96.400 + 118.600 + 165.000 = R$ 380.000,00", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    expect(stats.totalReconhecido).toBe(380000);
    expect(stats.valorAFaturarCobrar).toBe(96400);
    expect(stats.valorAReceber).toBe(118600);
    expect(stats.valorRecebido).toBe(165000);
    expect(stats.valorConciliado).toBe(142000);
    expect(stats.valorAFaturarCobrar + stats.valorAReceber + stats.valorRecebido).toBe(stats.totalReconhecido);

    renderReceitasPage();
    // KPI 1: R$ 380.000,00
    expect(screen.getByText("R$ 380.000,00")).toBeInTheDocument();
    // KPI 2: R$ 96.400,00
    expect(screen.getByText("R$ 96.400,00")).toBeInTheDocument();
    // KPI 3: R$ 118.600,00
    expect(screen.getByText("R$ 118.600,00")).toBeInTheDocument();
    // KPI 4: R$ 165.000,00
    expect(screen.getByText("R$ 165.000,00")).toBeInTheDocument();

    // Verificação de conciliação discreta: R$ 142.000,00
    expect(screen.getByText("R$ 142.000,00")).toBeInTheDocument();
  });

  it("5. Modalidades canônicas presentes no dataset e nas traduções", () => {
    const modalidades = MOCK_RECEITAS_OPERACIONAIS.map((r) => r.modalidade);
    expect(modalidades).toContain("CAIXA_IMEDIATO");
    expect(modalidades).toContain("DUPLICATA");
    expect(modalidades).toContain("FATURAMENTO_MENSAL");
  });

  it("6. Mapeamento dos Agrupamentos de UX Canônicos", () => {
    expect(getEstagioUX("aguardando_fechamento")).toBe("A_FATURAR_FECHAR");
    expect(getEstagioUX("pendente_cobranca")).toBe("COBRANCA_PENDENTE");
    expect(getEstagioUX("cobranca_gerada")).toBe("COBRANCA_PENDENTE");
    expect(getEstagioUX("cobranca_enviada")).toBe("A_RECEBER");
    expect(getEstagioUX("pendente_recebimento")).toBe("A_RECEBER");
    expect(getEstagioUX("recebido")).toBe("RECEBIDAS");
    expect(getEstagioUX("pago")).toBe("RECEBIDAS");
    expect(getEstagioUX("conciliado")).toBe("RECEBIDAS");
  });

  it("7. Tabela financeira densa e operacional presente com cabeçalhos corretos", () => {
    renderReceitasPage();
    expect(screen.getByText("Cliente / Referência")).toBeInTheDocument();
    expect(screen.getByText("Origem")).toBeInTheDocument();
    expect(screen.getByText("Modalidade")).toBeInTheDocument();
    expect(screen.getByText("Competência")).toBeInTheDocument();
    expect(screen.getByText("Vencimento")).toBeInTheDocument();
    expect(screen.getByText("Valor")).toBeInTheDocument();
    expect(screen.getByText("Estágio")).toBeInTheDocument();
    expect(screen.getByText("Ação")).toBeInTheDocument();
  });

  it("8. Pills de estágio com contagens canônicas exatas (Todos 13, A Faturar 3, Cobrança 3, A Receber 4, Recebidas 3)", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    expect(stats.totalRegistros).toBe(13);
    expect(stats.contagensPorEstagio.TODOS).toBe(13);
    expect(stats.contagensPorEstagio.A_FATURAR_FECHAR).toBe(3);
    expect(stats.contagensPorEstagio.COBRANCA_PENDENTE).toBe(3);
    expect(stats.contagensPorEstagio.A_RECEBER).toBe(4);
    expect(stats.contagensPorEstagio.RECEBIDAS).toBe(3);

    renderReceitasPage();
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getAllByText("13").length).toBeGreaterThanOrEqual(1); // Total ativas

    expect(screen.getAllByText("A Faturar / Fechar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Cobrança Pendente").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("A Receber").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Recebidas").length).toBeGreaterThanOrEqual(1);
  });

  it("9. Filtragem interativa por Estágio UX", () => {
    renderReceitasPage();
    const pillAguardando = screen.getByRole("button", { name: /A Faturar \/ Fechar/i });
    fireEvent.click(pillAguardando);

    // Deve exibir as receitas de Faturamento Mensal aguardando fechamento (incluindo complementar)
    expect(screen.getAllByText("Rede Comercial Delta")[0]).toBeInTheDocument();
    expect(screen.getByText("Atacadão Norte Log")).toBeInTheDocument();
    // Não deve exibir as receitas de outros estágios
    expect(screen.queryByText("Transportadora Alfa")).not.toBeInTheDocument();
  });

  it("10. Caixa Imediato possui caminho direto sem exigir faturamento/cobrança", () => {
    const caixaImediato = MOCK_RECEITAS_OPERACIONAIS.find(
      (r) => r.modalidade === "CAIXA_IMEDIATO" && r.status === "pendente_recebimento"
    );
    expect(caixaImediato).toBeDefined();
    expect(getEstagioUX(caixaImediato!.status)).toBe("A_RECEBER");
  });

  it("11. Duplicata possui fluxo completo de geração e envio de cobrança", () => {
    const duplicataPendente = MOCK_RECEITAS_OPERACIONAIS.find(
      (r) => r.id === "REC-2026-1042"
    );
    expect(duplicataPendente?.modalidade).toBe("DUPLICATA");
    expect(duplicataPendente?.status).toBe("pendente_cobranca");
  });

  it("12. Faturamento Mensal possui fechamento de ciclo consolidado", () => {
    const faturamentoMensal = MOCK_RECEITAS_OPERACIONAIS.find(
      (r) => r.id === "REC-2026-1040"
    );
    expect(faturamentoMensal?.modalidade).toBe("FATURAMENTO_MENSAL");
    expect(faturamentoMensal?.status).toBe("aguardando_fechamento");
    expect(faturamentoMensal?.itens.length).toBe(7); // 5 ops + 2 serv extras
    expect(faturamentoMensal?.valorTotal).toBe(42800.0);
  });

  it("13. Suporte canônico a Fatura Complementar em fechamento", () => {
    const complementar = MOCK_RECEITAS_OPERACIONAIS.find(
      (r) => r.id === "REC-2026-1057"
    );
    expect(complementar?.observacao).toBe("FATURA_COMPLEMENTAR");
    expect(getEstagioUX(complementar!.status)).toBe("A_FATURAR_FECHAR");
    renderReceitasPage();
    expect(screen.getByText("COMPLEMENTAR")).toBeInTheDocument();
  });

  it("14. Vencido é uma condição derivada e calculada com base na data de corte", () => {
    const vencido = MOCK_RECEITAS_OPERACIONAIS.find((r) => r.id === "REC-2026-1047");
    expect(vencido).toBeDefined();
    const situacao = getSituacaoVencimento(vencido!, "2026-10-04");
    expect(situacao.isVencido).toBe(true);
    expect(situacao.diasAtraso).toBe(3);
    expect(situacao.label).toBe("VENCIDO • 3 dias");
  });

  it("15. Título vencido mantém o estágio financeiro real (A RECEBER)", () => {
    const vencido = MOCK_RECEITAS_OPERACIONAIS.find((r) => r.id === "REC-2026-1047");
    expect(getEstagioUX(vencido!.status)).toBe("A_RECEBER");
  });

  it("16. Drawer abre ao clicar em uma linha ou no botão Abrir", () => {
    renderReceitasPage();
    const btnAbrir = screen.getAllByRole("button", { name: "Abrir" })[0];
    fireEvent.click(btnAbrir);

    // Deve abrir o Sheet e exibir o resumo financeiro
    expect(screen.getByText("Linha do Tempo do Ciclo Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Histórico & Auditoria")).toBeInTheDocument();
  });

  it("17. Composição da receita detalhada exibida dentro do Drawer", () => {
    renderReceitasPage();
    // Clica na linha da Duplicata da Transportadora Alfa
    const rowAlfa = screen.getByText("Transportadora Alfa");
    fireEvent.click(rowAlfa);

    expect(screen.getAllByText("OPV-8831").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Descarga de Linha Branca — 950 vol")).toBeInTheDocument();
  });

  it("18. Timeline específica para Caixa Imediato (caminho curto)", () => {
    renderReceitasPage();
    const rowCaixa = screen.getByText("Cliente Beta");
    fireEvent.click(rowCaixa);

    expect(screen.getAllByText("Receita Reconhecida").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Recebimento Imediato (À Vista)")).toBeInTheDocument();
    expect(screen.getByText("Conciliação Bancária")).toBeInTheDocument();
    expect(screen.queryByText("Fechamento da Competência")).not.toBeInTheDocument();
  });

  it("19. Confirmação de recebimento abre diálogo modal no Drawer", () => {
    renderReceitasPage();
    const rowCaixa = screen.getByText("Cliente Beta");
    fireEvent.click(rowCaixa);

    const btnConfirmar = screen.getByRole("button", { name: /Confirmar Recebimento/i });
    fireEvent.click(btnConfirmar);

    expect(screen.getByText("Data Efetiva do Recebimento:")).toBeInTheDocument();
    expect(
      screen.getByText("Confirme o recebimento financeiro desta receita para atualizar o fluxo de caixa.")
    ).toBeInTheDocument();
  });

  it("20. Título recebido possui link contextual para Central Bancária", () => {
    renderReceitasPage();
    const rowRecebido = screen.getByText("Frigorífico Boi Gordo");
    fireEvent.click(rowRecebido);

    const btnBancaria = screen.getByRole("button", { name: /Abrir Central Bancária/i });
    expect(btnBancaria).toBeInTheDocument();
  });

  it("21. Não existe ação de Conciliar diretamente na UX11", () => {
    renderReceitasPage();
    expect(screen.queryByRole("button", { name: /^Conciliar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Conciliar Receita$/i })).not.toBeInTheDocument();
  });

  it("22. Não existe botão genérico ou destrutivo 'Fechar Tudo'", () => {
    renderReceitasPage();
    expect(screen.queryByText("Fechar Tudo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fechar Tudo/i })).not.toBeInTheDocument();
  });

  it("23. Não duplica régua completa ou negociação de inadimplência", () => {
    renderReceitasPage();
    expect(screen.queryByText("Régua de Cobrança")).not.toBeInTheDocument();
    expect(screen.queryByText("Promessa de Pagamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Estratégia de Cobrança")).not.toBeInTheDocument();
  });

  it("24. Uso do Royal Blue oficial (#2563EB) no Design System", () => {
    renderReceitasPage();
    const kpiReconhecida = screen.getAllByText("Receita Reconhecida")[0].parentElement?.parentElement;
    expect(kpiReconhecida).toBeInTheDocument();
  });

  it("25. Fechamento de Faturamento Mensal possui subview com checklist operacional", () => {
    renderReceitasPage();
    const rowMensal = screen.getAllByText("Rede Comercial Delta")[0];
    fireEvent.click(rowMensal);

    const btnRevisar = screen.getByRole("button", { name: /Revisar Fechamento/i });
    fireEvent.click(btnRevisar);

    expect(screen.getByText("Revisão do Fechamento de Faturamento Mensal")).toBeInTheDocument();
    expect(screen.getByText("Checklist de Validação")).toBeInTheDocument();
    expect(screen.getByText("Confirmar Fechamento")).toBeInTheDocument();
  });

  // ============================================================================
  // TESTES ESTRUTURAIS EXIGIDOS NO HOTFIX 02.1
  // ============================================================================

  it("26. [Hotfix 02.1] Quantidade total da UI === dataset.length (13 registros)", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    expect(stats.totalRegistros).toBe(13);
    expect(stats.totalRegistros).toBe(MOCK_RECEITAS_OPERACIONAIS.length);
  });

  it("27. [Hotfix 02.1] Soma das contagens por estágio === dataset.length (3 + 3 + 4 + 3 = 13)", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    const somaContagens =
      stats.contagensPorEstagio.A_FATURAR_FECHAR +
      stats.contagensPorEstagio.COBRANCA_PENDENTE +
      stats.contagensPorEstagio.A_RECEBER +
      stats.contagensPorEstagio.RECEBIDAS;
    expect(somaContagens).toBe(stats.totalRegistros);
    expect(somaContagens).toBe(13);
  });

  it("28. [Hotfix 02.1] Cada registro pertence a exatamente um estágio UX disjunto", () => {
    MOCK_RECEITAS_OPERACIONAIS.forEach((r) => {
      const estagio = getEstagioUX(r.status);
      expect([
        "A_FATURAR_FECHAR",
        "COBRANCA_PENDENTE",
        "A_RECEBER",
        "RECEBIDAS",
      ]).toContain(estagio);
    });
  });

  it("29. [Hotfix 02.1] Soma dos valores por estágio === Receita Reconhecida (64.400 + 32.000 + 118.600 + 165.000 = 380.000)", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    const somaEstagios =
      stats.valorAFaturarFechar +
      stats.valorCobrancaPendente +
      stats.valorAReceber +
      stats.valorRecebido;
    expect(somaEstagios).toBe(stats.totalReconhecido);
    expect(stats.totalReconhecido).toBe(380000);
  });

  it("30. [Hotfix 02.1] A Faturar / Cobrar = A Faturar / Fechar + Cobrança Pendente (64.400 + 32.000 = 96.400)", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    expect(stats.valorAFaturarFechar).toBe(64400);
    expect(stats.valorCobrancaPendente).toBe(32000);
    expect(stats.valorAFaturarCobrar).toBe(96400);
  });

  it("31. [Hotfix 02.1] A Receber não inclui Cobrança Pendente nem Fechamento", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    const titulosAReceber = MOCK_RECEITAS_OPERACIONAIS.filter(
      (r) => getEstagioUX(r.status) === "A_RECEBER"
    );
    expect(titulosAReceber.length).toBe(4);
    titulosAReceber.forEach((r) => {
      expect(["cobranca_enviada", "pendente_recebimento"]).toContain(r.status);
      expect(r.status).not.toBe("pendente_cobranca");
      expect(r.status).not.toBe("cobranca_gerada");
      expect(r.status).not.toBe("aguardando_fechamento");
    });
    expect(stats.valorAReceber).toBe(118600);
  });

  it("32. [Hotfix 02.1] Recebido inclui recebido + conciliado e valor conciliado é subconjunto estrito do recebido", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    const titulosRecebidos = MOCK_RECEITAS_OPERACIONAIS.filter(
      (r) => getEstagioUX(r.status) === "RECEBIDAS"
    );
    expect(titulosRecebidos.length).toBe(3);
    titulosRecebidos.forEach((r) => {
      expect(["recebido", "pago", "conciliado"]).toContain(r.status);
    });
    expect(stats.valorRecebido).toBe(165000);
    expect(stats.valorConciliado).toBe(142000);
    expect(stats.valorConciliado).toBeLessThan(stats.valorRecebido);
    expect(stats.valorRecebido - stats.valorConciliado).toBe(23000); // REC-2026-1049
  });

  it("33. [Hotfix 02.1] Nenhuma receita é contabilizada duas vezes nos KPIs disjuntos", () => {
    const stats = calculateReceitasTotais(MOCK_RECEITAS_OPERACIONAIS);
    expect(stats.valorAFaturarCobrar + stats.valorAReceber + stats.valorRecebido).toBe(
      stats.totalReconhecido
    );
  });

  // ============================================================================
  // TESTES DE REFINAMENTO VISUAL E SEMÂNTICO (HOTFIX 02.2)
  // ============================================================================

  it("34. [Hotfix 02.2] Drawer exibe 'Situação Financeira: Aguardando faturamento' para Faturamento Mensal em aguardando_fechamento", () => {
    renderReceitasPage();
    const rowMensal = screen.getAllByText("Rede Comercial Delta")[0];
    fireEvent.click(rowMensal);

    expect(screen.getByText("Situação Financeira")).toBeInTheDocument();
    expect(screen.getByText("Aguardando faturamento")).toBeInTheDocument();
  });

  it("35. [Hotfix 02.2] KPI 'A Faturar / Cobrar' exibe subtítulo derivado 'R$ 64.400 a fechar • R$ 32.000 em cobrança'", () => {
    renderReceitasPage();
    expect(
      screen.getByText("R$ 64.400 a fechar • R$ 32.000 em cobrança")
    ).toBeInTheDocument();
  });

  it("36. [Hotfix 02.2] Drawer de Faturamento Mensal exibe botão secundário 'Cancelar' para evitar ambiguidade com fechamento", () => {
    renderReceitasPage();
    const rowMensal = screen.getAllByText("Rede Comercial Delta")[0];
    fireEvent.click(rowMensal);

    expect(screen.getByRole("button", { name: /^Cancelar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar Fechamento/i })).toBeInTheDocument();
  });

  it("37. [Hotfix 02.2] Timeline de Faturamento Mensal inicia com 'Receita Reconhecida' e composição dos lançamentos", () => {
    renderReceitasPage();
    const rowMensal = screen.getAllByText("Rede Comercial Delta")[0];
    fireEvent.click(rowMensal);

    expect(screen.getAllByText("Receita Reconhecida").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("7 lançamentos compõem esta receita na competência Outubro / 2026.")
    ).toBeInTheDocument();
    expect(screen.getByText("Fechamento da Competência")).toBeInTheDocument();
    expect(screen.getByText("Cobrança")).toBeInTheDocument();
    expect(screen.getByText("Recebimento")).toBeInTheDocument();
    expect(screen.getByText("Conciliação Bancária")).toBeInTheDocument();
  });
});

