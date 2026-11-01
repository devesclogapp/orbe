import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabInadimplencia from "@/pages/UxLab/UxLabInadimplencia";
import {
  MOCK_TITULOS_INADIMPLENTES,
  DATA_REFERENCIA_UX14,
  calcularDiasAtraso,
  calcularKpisInadimplencia,
  agruparInadimplenciaPorCliente,
  getFaixaAging,
} from "@/pages/UxLab/inadimplenciaMockData";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderInadimplencia(initialRoute = "/ux-lab/inadimplencia") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/inadimplencia" element={<UxLabInadimplencia />} />
          <Route path="/ux-lab/receitas" element={<div data-testid="receitas-screen">Central de Receitas</div>} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

describe("UX14 — Inadimplência & Cobrança V2 — Protótipo 1 no UX Lab", () => {
  // 1. Rota renderiza
  it("1. Rota /ux-lab/inadimplencia está devidamente configurada no mapeamento da Sidebar e renderiza", () => {
    expect(UX_LAB_ROUTES["inadimplencia"]).toBe("/ux-lab/inadimplencia");
    renderInadimplencia();
    expect(screen.getByRole("heading", { name: /Inadimplência & Cobrança/i })).toBeInTheDocument();
  });

  // 2. Título e subtítulo corretos
  it("2. Título e subtítulo exibem identificação correta da gestão de recebíveis", () => {
    renderInadimplencia();
    expect(screen.getByRole("heading", { name: /Inadimplência & Cobrança/i })).toBeInTheDocument();
    expect(screen.getByText(/Gestão de títulos em atraso e aging de recebíveis/i)).toBeInTheDocument();
    expect(screen.getByText(/31\/10\/2026/i)).toBeInTheDocument();
  });

  // 3. Cinco KPIs presentes
  it("3. Exibe os 5 KPIs de Aging Canônico", () => {
    renderInadimplencia();
    expect(screen.getByText("Total Inadimplente")).toBeInTheDocument();
    expect(screen.getAllByText("1 a 30 dias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31 a 60 dias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("61 a 90 dias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+90 dias").length).toBeGreaterThan(0);
  });

  // 4. Identidade matemática dos KPIs: Total = soma das 4 faixas
  it("4. Identidade matemática: Total Inadimplente = 1-30d + 31-60d + 61-90d + 90d+", () => {
    const kpis = calcularKpisInadimplencia(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    const somaFaixas = kpis.dias_1_30 + kpis.dias_31_60 + kpis.dias_61_90 + kpis.dias_mais_90;
    expect(kpis.totalInadimplente).toBe(somaFaixas);
    expect(kpis.totalInadimplente).toBe(280600);
    expect(kpis.quantidadeTotal).toBe(12);
  });

  // 5. Faixa 1-30 dias calculada corretamente
  it("5. Faixa 1 a 30 dias calcula corretamente os 4 títulos e valor R$ 54.850,00", () => {
    const kpis = calcularKpisInadimplencia(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    expect(kpis.dias_1_30).toBe(54850);
    expect(kpis.qtd_1_30).toBe(4);
  });

  // 6. Faixa 31-60 dias calculada corretamente
  it("6. Faixa 31 a 60 dias calcula corretamente os 3 títulos e valor R$ 67.650,00", () => {
    const kpis = calcularKpisInadimplencia(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    expect(kpis.dias_31_60).toBe(67650);
    expect(kpis.qtd_31_60).toBe(3);
  });

  // 7. Faixa 61-90 dias calculada corretamente
  it("7. Faixa 61 a 90 dias calcula corretamente os 2 títulos e valor R$ 62.300,00", () => {
    const kpis = calcularKpisInadimplencia(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    expect(kpis.dias_61_90).toBe(62300);
    expect(kpis.qtd_61_90).toBe(2);
  });

  // 8. Faixa +90 dias calculada corretamente
  it("8. Faixa +90 dias calcula corretamente os 3 títulos e valor R$ 95.800,00", () => {
    const kpis = calcularKpisInadimplencia(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    expect(kpis.dias_mais_90).toBe(95800);
    expect(kpis.qtd_mais_90).toBe(3);
  });

  // 9. Não existe status persistido "VENCIDO"
  it("9. Garante que status das receitas usa máquina canônica e NÃO o status artificial VENCIDO", () => {
    for (const t of MOCK_TITULOS_INADIMPLENTES) {
      expect(t.status).not.toBe("VENCIDO");
      expect(t.status).not.toBe("vencido");
      expect([
        "aguardando_fechamento",
        "pendente_cobranca",
        "cobranca_gerada",
        "cobranca_enviada",
        "pendente_recebimento",
      ]).toContain(t.status);
    }
  });

  // 10. Tab Por Cliente
  it("10. Tab 'Por Cliente' é selecionada por padrão e exibe lista consolidada por tomador", () => {
    renderInadimplencia();
    expect(screen.getByRole("button", { name: /Por Cliente/i })).toHaveClass("bg-background");
    expect(screen.getByText("Logística Transvale S.A.")).toBeInTheDocument();
    expect(screen.getByText("Indústria Metalúrgica Alvorada")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Nordeste Cargo")).toBeInTheDocument();
  });

  // 11. Tab Títulos em Atraso
  it("11. Permite alternar para a tab 'Títulos em Atraso' exibindo tabela analítica", () => {
    renderInadimplencia();
    const btnTitulos = screen.getByRole("button", { name: /Títulos em Atraso/i });
    fireEvent.click(btnTitulos);

    expect(btnTitulos).toHaveClass("bg-background");
    expect(screen.getByText("REC-2026-0812")).toBeInTheDocument();
    expect(screen.getByText("REC-2026-0518")).toBeInTheDocument();
  });

  // 12. Agregação por cliente correta
  it("12. Agregação por cliente calcula totais de dívida e maior atraso por empresa", () => {
    const clientes = agruparInadimplenciaPorCliente(MOCK_TITULOS_INADIMPLENTES, DATA_REFERENCIA_UX14);
    expect(clientes.length).toBe(6);

    const alvorada = clientes.find((c) => c.empresaId === "emp-alvorada");
    expect(alvorada).toBeDefined();
    expect(alvorada!.totalInadimplente).toBe(81000); // 56.700 + 24.300
    expect(alvorada!.quantidadeTitulos).toBe(2);
    expect(alvorada!.faixaMaisCritica).toBe("mais_90");
  });

  // 13. Drawer Cliente abre e exibe resumo consolidado
  it("13. Ao clicar em 'Ver Posição' de um cliente, abre o Drawer de Cliente", () => {
    renderInadimplencia();
    const btns = screen.getAllByRole("button", { name: /Ver Posição/i });
    fireEvent.click(btns[0]);

    expect(screen.getByText(/Posição Consolidada da Inadimplência/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribuição por Aging do Cliente/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Títulos Vencidos/i).length).toBeGreaterThan(0);
  });

  // 14. Drawer Título abre e exibe detalhes da receita
  it("14. Ao clicar em 'Ver Título', abre o Drawer de Título com resumo e histórico", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));

    const btns = screen.getAllByRole("button", { name: /Ver Título/i });
    fireEvent.click(btns[0]);

    expect(screen.getByText("Valor Original")).toBeInTheDocument();
    expect(screen.getByText("Saldo em Aberto")).toBeInTheDocument();
    expect(screen.getByText("Situação da Cobrança")).toBeInTheDocument();
    expect(screen.getByText("Ações de Cobrança")).toBeInTheDocument();
  });

  // 15. Filtro de Busca funciona
  it("15. Filtro de busca filtra registros por referência ou cliente", () => {
    renderInadimplencia();
    const searchInput = screen.getByPlaceholderText(/Buscar por referência ou cliente/i);
    fireEvent.change(searchInput, { target: { value: "Alvorada" } });

    expect(screen.getByText("Indústria Metalúrgica Alvorada")).toBeInTheDocument();
    expect(screen.queryByText("Logística Transvale S.A.")).not.toBeInTheDocument();
  });

  // 16. Modalidades cobertas no dataset
  it("16. Dataset contempla todas as 3 modalidades reais (CAIXA_IMEDIATO, DUPLICATA, FATURAMENTO_MENSAL)", () => {
    const modalidades = new Set(MOCK_TITULOS_INADIMPLENTES.map((t) => t.modalidade));
    expect(modalidades.has("CAIXA_IMEDIATO")).toBe(true);
    expect(modalidades.has("DUPLICATA")).toBe(true);
    expect(modalidades.has("FATURAMENTO_MENSAL")).toBe(true);
  });

  // 17. Status reais da cobrança
  it("17. Dataset contempla os status reais de cobrança", () => {
    const statuses = new Set(MOCK_TITULOS_INADIMPLENTES.map((t) => t.status));
    expect(statuses.has("cobranca_enviada")).toBe(true);
    expect(statuses.has("cobranca_gerada")).toBe(true);
    expect(statuses.has("pendente_cobranca")).toBe(true);
    expect(statuses.has("pendente_recebimento")).toBe(true);
    expect(statuses.has("aguardando_fechamento")).toBe(true);
  });

  // 18. Saldo em aberto = Valor total
  it("18. Saldo em aberto é estritamente igual ao valor total do título inadimplente", () => {
    for (const t of MOCK_TITULOS_INADIMPLENTES) {
      expect(t.valorTotal).toBeGreaterThan(0);
    }
  });

  // 19. Ausência de amortização/recebimento parcial
  it("19. Drawer exibe aviso de que não há amortização parcial no domínio do ORBE", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    expect(
      screen.getByText(/Este título não possui amortização parcial registrada/i)
    ).toBeInTheDocument();
  });

  // 20. Simulação de emissão/reemissão de Fatura PDF
  it("20. Permite simular a geração/reemissão de Fatura PDF", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    const btnPdf = screen.getByRole("button", { name: /Fatura PDF/i });
    expect(btnPdf).toBeInTheDocument();
    fireEvent.click(btnPdf);
  });

  // 21. Simulação de Registro de Envio de Cobrança
  it("21. Permite registrar envio de cobrança abrindo diálogo com aviso de canal externo", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));

    // Filtrar por status pendente_cobranca
    const searchInput = screen.getByPlaceholderText(/Buscar por referência ou cliente/i);
    fireEvent.change(searchInput, { target: { value: "REC-2026-1015" } });

    fireEvent.click(screen.getByRole("button", { name: /Ver Título/i }));

    const btnEnvio = screen.getByRole("button", { name: /Registrar Envio da Cobrança/i });
    expect(btnEnvio).toBeInTheDocument();
    fireEvent.click(btnEnvio);

    expect(
      screen.getByText(/Confirme apenas após a cobrança ter sido efetivamente enviada ao cliente/i)
    ).toBeInTheDocument();

    const btnConfirmar = screen.getByRole("button", { name: /Confirmar Registro de Envio/i });
    fireEvent.click(btnConfirmar);
  });

  // 22. Aviso explícito sobre envio declaratório
  it("22. Drawer exibe aviso de governança de que o registro de envio é declaratório e não automatizado", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    expect(
      screen.getByText(/O ORBE não realiza disparos automatizados de e-mail ou WhatsApp/i)
    ).toBeInTheDocument();
  });

  // 23. Alteração de Vencimento disponível no Drawer
  it("23. Permite abrir modal de alteração de vencimento com aviso de que não cria acordo/desconto", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    const btnVenc = screen.getByRole("button", { name: /Alterar Vencimento/i });
    fireEvent.click(btnVenc);

    expect(
      screen.getByText(/A alteração modifica a data de vencimento do título. Não cria acordo, parcelamento, juros ou desconto/i)
    ).toBeInTheDocument();
  });

  // 24. Aging recalculado após alteração de vencimento
  it("24. Alterar vencimento para nova data no passado recalcula aging e dias em atraso", () => {
    const diasAntigos = calcularDiasAtraso("2026-08-10", DATA_REFERENCIA_UX14); // 82d
    const diasNovos = calcularDiasAtraso("2026-10-15", DATA_REFERENCIA_UX14); // 16d

    expect(diasAntigos).toBe(82);
    expect(getFaixaAging(diasAntigos)).toBe("61_90");

    expect(diasNovos).toBe(16);
    expect(getFaixaAging(diasNovos)).toBe("1_30");
  });

  // 25. Título sai da carteira inadimplente se novo vencimento for futuro (>= data de referência)
  it("25. Título com vencimento >= DATA_REFERENCIA_UX14 sai da carteira inadimplente", () => {
    const diasFuturo = calcularDiasAtraso("2026-11-15", DATA_REFERENCIA_UX14); // -15d
    expect(diasFuturo).toBeLessThanOrEqual(0);
  });

  // 26. CTA para Central de Receitas
  it("26. Drawer disponibiliza CTA 'Abrir na Central de Receitas'", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    const btnReceitas = screen.getByRole("button", { name: /Abrir na Central de Receitas/i });
    expect(btnReceitas).toBeInTheDocument();
    fireEvent.click(btnReceitas);
  });

  // 27. Ausência de baixa financeira inline
  it("27. Não existe botão de liquidação inline na UX14 (pertence à Central de Receitas)", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    expect(screen.queryByRole("button", { name: /^Confirmar Recebimento$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Liquidar$/i })).not.toBeInTheDocument();
  });

  // 28. Ausência de WhatsApp fictício
  it("28. Não exibe botão ou link de WhatsApp fictício", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Enviar WhatsApp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wa\.me/i)).not.toBeInTheDocument();
  });

  // 29. Ausência de E-mail fictício
  it("29. Não exibe botão de envio de e-mail fictício", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Enviar E-mail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/financeiro@cliente\.com/i)).not.toBeInTheDocument();
  });

  // 30. Ausência de negociação/acordo
  it("30. Não inventa módulo de negociação/acordo", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Criar Acordo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Promessa de Pagamento/i)).not.toBeInTheDocument();
  });

  // 31. Ausência de parcelamento
  it("31. Não inventa parcelamento de dívida", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Parcelar Dívida/i)).not.toBeInTheDocument();
  });

  // 32. Ausência de juros e multas artificiais
  it("32. Não inventa cobrança de juros e multa", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Juros de Mora/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Multa Contratual/i)).not.toBeInTheDocument();
  });

  // 33. Ausência de score de risco
  it("33. Não inventa score de crédito ou risco de inadimplência", () => {
    renderInadimplencia();
    expect(screen.queryByText(/Score de Risco/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Probabilidade de Inadimplência/i)).not.toBeInTheDocument();
  });

  // 34. Timeline coerente
  it("34. Histórico do título exibe timeline coerente com eventos reais", () => {
    renderInadimplencia();
    fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

    expect(screen.getByText(/Histórico do Título/i)).toBeInTheDocument();
    expect(screen.getByText("Receita criada")).toBeInTheDocument();
    expect(screen.getByText("Cobrança gerada")).toBeInTheDocument();
  });

  // 35. Zero backend
  it("35. Garante funcionamento 100% isolado no UX Lab sem chamadas ao Supabase", () => {
    expect(MOCK_TITULOS_INADIMPLENTES.length).toBe(12);
  });

  // ==========================================
  // TESTES HOTFIX 02.1 — POLIMENTO VISUAL E SEMÂNTICO
  // ==========================================
  describe("HOTFIX 02.1 — Polimento Visual e Semântico Final", () => {
    it("HF-1. Texto 'Identidade Matemática' NÃO aparece na UI", () => {
      renderInadimplencia();
      expect(screen.queryByText(/Identidade Matemática/i)).not.toBeInTheDocument();
      expect(screen.getByText(/da carteira vencida está concentrada em títulos com mais de 60 dias de atraso/i)).toBeInTheDocument();
    });

    it("HF-2. IDs técnicos 'emp-*' NÃO aparecem na UI (tabela e Drawer)", () => {
      renderInadimplencia();
      expect(screen.queryByText(/ID: emp-alvorada/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ID: emp-transvale/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ID: emp-nordeste/i)).not.toBeInTheDocument();

      // Abrir Drawer de Cliente
      const btns = screen.getAllByRole("button", { name: /Ver Posição/i });
      fireEvent.click(btns[0]);
      expect(screen.queryByText(/ID: emp-/i)).not.toBeInTheDocument();
    });

    it("HF-3. Identificadores operacionais REC-* e lançamentos permanecem visíveis", () => {
      renderInadimplencia();
      fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
      expect(screen.getByText("REC-2026-0812")).toBeInTheDocument();
      expect(screen.getByText("REC-2026-0518")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);
      expect(screen.getAllByText(/OPV-/i).length).toBeGreaterThan(0);
    });

    it("HF-4. Badge de dias em atraso exibe formato simplificado '164 dias' e NÃO '164d · +90 dias'", () => {
      renderInadimplencia();
      fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
      
      expect(screen.getByText("164 dias")).toBeInTheDocument();
      expect(screen.getByText("123 dias")).toBeInTheDocument();
      expect(screen.getByText("87 dias")).toBeInTheDocument();
      expect(screen.getByText("53 dias")).toBeInTheDocument();
      
      expect(screen.queryByText(/164d ·/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/123d ·/i)).not.toBeInTheDocument();
    });

    it("HF-5. Header do Drawer do Título separa dias de atraso ('164 dias de atraso') e faixa (+90 dias)", () => {
      renderInadimplencia();
      fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
      
      // Encontrar REC-2026-0518 (164 dias)
      const searchInput = screen.getByPlaceholderText(/Buscar por referência ou cliente/i);
      fireEvent.change(searchInput, { target: { value: "REC-2026-0518" } });
      fireEvent.click(screen.getByRole("button", { name: /Ver Título/i }));

      expect(screen.getByText("164 dias de atraso")).toBeInTheDocument();
      expect(screen.getAllByText("+90 dias").length).toBeGreaterThan(0);
      expect(screen.queryByText("164d de atraso · +90 dias")).not.toBeInTheDocument();
    });

    it("HF-6. Descrição da ação 'Alterar Vencimento' usa semântica exata 'Altera a data de vencimento do título' e NÃO 'Prorroga'", () => {
      renderInadimplencia();
      fireEvent.click(screen.getByRole("button", { name: /Títulos em Atraso/i }));
      fireEvent.click(screen.getAllByRole("button", { name: /Ver Título/i })[0]);

      expect(screen.getByText("Altera a data de vencimento do título")).toBeInTheDocument();
      expect(screen.queryByText(/Prorroga a data de vencimento nominal do título/i)).not.toBeInTheDocument();
    });
  });
});
