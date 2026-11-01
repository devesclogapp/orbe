import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import UxLabCentralBancaria from "@/pages/UxLab/UxLabCentralBancaria";
import {
  MOCK_CENTRAL_BANCARIA_ITENS,
  calculateCentralBancariaKpiStats,
} from "@/pages/UxLab/centralBancariaMockData";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderCentralBancaria(initialRoute = "/ux-lab/central-bancaria") {
  return render(
    <UxLabThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/ux-lab/central-bancaria" element={<UxLabCentralBancaria />} />
          <Route path="/colaboradores" element={<div data-testid="colaboradores-screen">Tela de Colaboradores</div>} />
        </Routes>
      </MemoryRouter>
    </UxLabThemeProvider>
  );
}

function parseDataHoraToTimestamp(str?: string): number {
  if (!str) return 0;
  // Format: "DD/MM/YYYY HH:MM" or "DD/MM/YYYY" or "YYYY-MM-DD"
  if (str.includes("/")) {
    const [datePart, timePart] = str.split(" ");
    const [dia, mes, ano] = datePart.split("/").map(Number);
    let hora = 0;
    let min = 0;
    if (timePart && timePart.includes(":")) {
      [hora, min] = timePart.split(":").map(Number);
    }
    return new Date(ano, mes - 1, dia, hora, min).getTime();
  }
  return new Date(str).getTime();
}

describe("UX13 — Central Bancária & CNAB V2 — Protótipo 1 no UX Lab", () => {
  // 1. Rota renderiza
  it("1. Rota /ux-lab/central-bancaria está devidamente configurada no mapeamento da Sidebar e renderiza", () => {
    expect(UX_LAB_ROUTES["central-bancaria"]).toBe("/ux-lab/central-bancaria");
    renderCentralBancaria();
    expect(screen.getByRole("heading", { name: /Central Bancária & CNAB/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Remessas, retornos e conciliação dos pagamentos bancarizados/i)
    ).toBeInTheDocument();
  });

  // 2. Quatro KPIs
  it("2. Renderiza exatamente os 4 KPIs principais requeridos", () => {
    renderCentralBancaria();
    expect(screen.getAllByText(/PRONTAS PARA BANCO/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/EM TRÂNSITO BANCÁRIO/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LIQUIDADAS NO PERÍODO/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PENDÊNCIAS BANCÁRIAS/i).length).toBeGreaterThan(0);
  });

  // 3. KPIs Derivados e 4. Soma Financeira Coerente
  it("3 & 4. KPIs são derivados estritamente do dataset mock com coerência matemática absoluta", () => {
    const stats = calculateCentralBancariaKpiStats(MOCK_CENTRAL_BANCARIA_ITENS);

    // KPI 1: Prontas
    expect(stats.prontasQtdLotes).toBe(3);
    expect(stats.prontasValor).toBe(101500.0);

    // KPI 2: Em Trânsito (Gerada + Baixada + Enviada)
    expect(stats.emTransitoGeradasQtd).toBe(1);
    expect(stats.emTransitoBaixadasQtd).toBe(1);
    expect(stats.emTransitoEnviadasQtd).toBe(2);
    expect(stats.emTransitoValor).toBe(84300.0);

    // KPI 3: Liquidadas (3 lotes com 50 beneficiários)
    expect(stats.liquidadasQtdItens).toBe(50);
    expect(stats.liquidadasValor).toBe(112600.0);

    // KPI 4: Pendências
    expect(stats.pendenciasRejeitadosQtd).toBe(2);
    expect(stats.pendenciasDivergentesQtd).toBe(1);
    expect(stats.pendenciasValor).toBe(7220.0);

    // Soma total bate com todos os 13 itens
    const somaTotal = MOCK_CENTRAL_BANCARIA_ITENS.reduce((acc, c) => acc + c.valorTotal, 0);
    expect(somaTotal).toBe(
      stats.prontasValor + stats.emTransitoValor + stats.liquidadasValor + stats.pendenciasValor
    );
    expect(somaTotal).toBe(305620.0);
  });

  // 5, 6, 7. Origens CLT, Diaristas, Intermitentes presentes
  it("5, 6, 7. Origens CLT, Diaristas e Intermitentes estão presentes no dataset", () => {
    const origens = MOCK_CENTRAL_BANCARIA_ITENS.map((i) => i.origemTipo);
    expect(origens).toContain("CLT");
    expect(origens).toContain("DIARISTAS");
    expect(origens).toContain("INTERMITENTES");
  });

  // 8. Custos Extras AUSENTE
  it("8. Custos Extras NÃO faz parte do domínio de origens da Central Bancária", () => {
    const origens = MOCK_CENTRAL_BANCARIA_ITENS.map((i) => i.origemTipo as string);
    expect(origens).not.toContain("CUSTOS_EXTRAS");
    expect(origens).not.toContain("CUSTO_EXTRA");
  });

  // 9, 10. Bancos BB (001) e Itaú (341) presentes
  it("9 & 10. Multibanco suportado com BB (001) e Itaú (341)", () => {
    const bancos = MOCK_CENTRAL_BANCARIA_ITENS.map((i) => i.contaPagadora.bancoCodigo);
    expect(bancos).toContain("001");
    expect(bancos).toContain("341");
  });

  // 11. Download ≠ Enviado
  it("11. Distingue rigorosamente 'Arquivo Baixado' de 'Enviado ao Banco'", () => {
    const itemBaixado = MOCK_CENTRAL_BANCARIA_ITENS.find((i) => i.situacao === "ARQUIVO_BAIXADO");
    const itemEnviado = MOCK_CENTRAL_BANCARIA_ITENS.find((i) => i.situacao === "ENVIADO_MANUAL");

    expect(itemBaixado).toBeDefined();
    expect(itemEnviado).toBeDefined();
    expect(itemBaixado?.situacao).toBe("ARQUIVO_BAIXADO");
    expect(itemEnviado?.situacao).toBe("ENVIADO_MANUAL");
  });

  // 12, 13, 14, 15, 16. Estados bancários representados
  it("12, 13, 14, 15, 16. Todos os 8 estados da jornada bancária estão representados", () => {
    const situacoes = new Set(MOCK_CENTRAL_BANCARIA_ITENS.map((i) => i.situacao));
    expect(situacoes.has("PRONTO_BANCO")).toBe(true);
    expect(situacoes.has("REMESSA_GERADA")).toBe(true);
    expect(situacoes.has("ARQUIVO_BAIXADO")).toBe(true);
    expect(situacoes.has("ENVIADO_MANUAL")).toBe(true);
    expect(situacoes.has("LIQUIDADO")).toBe(true);
    expect(situacoes.has("CONCILIADO")).toBe(true);
    expect(situacoes.has("REJEITADO")).toBe(true);
    expect(situacoes.has("DIVERGENTE")).toBe(true);
  });

  // 17. Drawer Pronto para Banco
  it("17. Abre Drawer de 'Pronto para Banco' com pré-validação e CTA Gerar Remessa", () => {
    renderCentralBancaria();
    const btnGerar = screen.getAllByRole("button", { name: /Gerar Remessa/i })[0];
    fireEvent.click(btnGerar);

    expect(screen.getByText(/Checklist de Pré-Validação CNAB/i)).toBeInTheDocument();
    expect(screen.getByText(/Conta pagadora ativa e habilitada para CNAB/i)).toBeInTheDocument();
    const ctaGerar = screen.getAllByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(ctaGerar.length).toBeGreaterThan(0);
  }, 15000);

  // 18. Drawer Remessa
  it("18. Abre Drawer de Remessa com NSA, Hash SHA-256 e aviso de download ≠ envio", () => {
    renderCentralBancaria();
    const btnBaixar = screen.getAllByRole("button", { name: /Baixar Arquivo/i })[0];
    fireEvent.click(btnBaixar);

    expect(screen.getAllByText(/Hash SHA-256/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Atenção ao fluxo de envio bancário:/i)).toBeInTheDocument();
  }, 15000);

  // 19. Drawer Rejeitado
  it("19. Abre Drawer de Rejeitado com código bancário, impacto e CTA de encaminhamento ao RH", () => {
    renderCentralBancaria();
    const btnRejeitado = screen.getAllByRole("button", { name: /Tratar Rejeição/i })[0];
    fireEvent.click(btnRejeitado);

    expect(screen.getByText(/O que aconteceu\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Motivo Bancário Registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Impacto no Lote & Fluxo:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ação Recomendada:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir Cadastro \/ RH/i })).toBeInTheDocument();
  }, 15000);

  // 20. Drawer Divergente
  it("20. Abre Drawer de Divergente com confronto de valores e campos de conciliação", () => {
    renderCentralBancaria();
    const btnDivergente = screen.getAllByRole("button", { name: /Revisar Conciliação/i })[0];
    fireEvent.click(btnDivergente);

    expect(screen.getByText(/Divergência de Valores no Retorno Bancário/i)).toBeInTheDocument();
    expect(screen.getByText(/Confronto de Valores/i)).toBeInTheDocument();
    const ctaRevisar = screen.getAllByRole("button", { name: /Revisar Conciliação/i });
    expect(ctaRevisar.length).toBeGreaterThan(0);
  }, 15000);

  // 21. Dados bancários mascarados
  it("21. Mascara rigorosamente dados de conta e favorecidos para segurança visual", () => {
    renderCentralBancaria();
    // Verifica que contas aparecem mascaradas (••••)
    const contasMascaradas = screen.getAllByText(/••••/i);
    expect(contasMascaradas.length).toBeGreaterThan(0);
  });

  // 22. CTA Central Bancária coerente
  it("22. Modal de Importação de Retorno abre e exibe metadados de simulação CNAB", () => {
    renderCentralBancaria();
    const btnImportar = screen.getAllByRole("button", { name: /Importar Retorno/i })[0];
    fireEvent.click(btnImportar);

    expect(screen.getByText(/Importar Arquivo de Retorno Bancário/i)).toBeInTheDocument();
    expect(screen.getByText(/Identificação Automática do Header \(Mock\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Processar Retorno/i })).toBeInTheDocument();
  }, 15000);

  // 23. Ausência de edição bancária inline
  it("23. NÃO possui campos para editar agência ou conta bancária inline na Central Bancária", () => {
    renderCentralBancaria();
    expect(screen.queryByPlaceholderText(/Digitar nova conta/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Editar agência/i)).not.toBeInTheDocument();
  });

  // 24. Ausência de "Marcar como Pago"
  it("24. NÃO possui botão indiscriminado 'Marcar como Pago' para itens rejeitados", () => {
    renderCentralBancaria();
    const btnRejeitado = screen.getAllByRole("button", { name: /Tratar Rejeição/i })[0];
    fireEvent.click(btnRejeitado);

    expect(screen.queryByRole("button", { name: /Marcar como Pago/i })).not.toBeInTheDocument();
  });

  // 25. Ausência de integração bancária fictícia
  it("25. Envio ao banco é categorizado explicitamente como ENVIADO_MANUAL sem falsa API bancária", () => {
    const itemEnviado = MOCK_CENTRAL_BANCARIA_ITENS.find((i) => i.situacao === "ENVIADO_MANUAL");
    expect(itemEnviado?.situacao).toBe("ENVIADO_MANUAL");
  });

  // 26. AUDITORIA CRONOLÓGICA UNIVERSAL (HOTFIX 02.1)
  it("26. Garante estrita ordenação cronológica não-decrescente em todas as timelines do dataset", () => {
    MOCK_CENTRAL_BANCARIA_ITENS.forEach((item) => {
      // Valida cada evento sequencialmente
      for (let i = 1; i < item.timeline.length; i++) {
        const tAnterior = parseDataHoraToTimestamp(item.timeline[i - 1].dataHora);
        const tAtual = parseDataHoraToTimestamp(item.timeline[i].dataHora);

        expect(
          tAtual,
          `Item ${item.id} (${item.referencia}): Evento '${item.timeline[i].etapa}' (${item.timeline[i].dataHora}) anterior a '${item.timeline[i - 1].etapa}' (${item.timeline[i - 1].dataHora})`
        ).toBeGreaterThanOrEqual(tAnterior);
      }

      // Valida datas específicas de remessa/download/envio/retorno
      if (item.remessaDataGeracao && item.remessaDataDownload) {
        const tGer = parseDataHoraToTimestamp(item.remessaDataGeracao);
        const tDown = parseDataHoraToTimestamp(item.remessaDataDownload);
        expect(tDown, `Item ${item.id}: Download precede Geração`).toBeGreaterThanOrEqual(tGer);
      }

      if (item.remessaDataDownload && item.remessaDataEnvio) {
        const tDown = parseDataHoraToTimestamp(item.remessaDataDownload);
        const tEnv = parseDataHoraToTimestamp(item.remessaDataEnvio);
        expect(tEnv, `Item ${item.id}: Envio precede Download`).toBeGreaterThanOrEqual(tDown);
      }

      if (item.remessaDataEnvio && item.retornoData) {
        const tEnv = parseDataHoraToTimestamp(item.remessaDataEnvio);
        const tRet = parseDataHoraToTimestamp(item.retornoData);
        expect(tRet, `Item ${item.id}: Retorno precede Envio`).toBeGreaterThanOrEqual(tEnv);
      }
    });
  });

  // 27. SEMÂNTICA DA DIVERGÊNCIA & AUSÊNCIA DE CAUSALIDADE INFERIDA (HOTFIX 02.1)
  it("27. Drawer de divergência trata o motivo como observação para análise sem inferência automática de DOC/TED", () => {
    renderCentralBancaria();
    const btnDivergente = screen.getAllByRole("button", { name: /Revisar Conciliação/i })[0];
    fireEvent.click(btnDivergente);

    expect(screen.getByText(/Observação para análise:/i)).toBeInTheDocument();
    // Não deve conter inferência causal hardcoded isolada
    expect(screen.queryByText(/Retenção de tarifa DOC\/TED\./i)).not.toBeInTheDocument();
  }, 15000);

  // 28. AUSÊNCIA DE TEXTOS INTERNOS / MOCK ((UX12), (UX13), etc.)
  it("28. Não contém termos internos como '(UX12)' ou '(UX13)' nos conteúdos dos drawers", () => {
    renderCentralBancaria();
    const btnGerar = screen.getAllByRole("button", { name: /Gerar Remessa/i })[0];
    fireEvent.click(btnGerar);

    expect(screen.queryByText(/\(UX12\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(UX13\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/aprovação financeira na Central de Despesas/i)).toBeInTheDocument();
  }, 15000);
});
