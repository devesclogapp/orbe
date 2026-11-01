import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UxLabRelatorioView from "@/pages/UxLab/UxLabRelatorioView";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";

describe("UX04 — HOTFIX 04.1 | R01: Template Documental Oficial ORBE", () => {
  const renderR01 = () => {
    return render(
      <UxLabThemeProvider>
        <MemoryRouter initialEntries={["/ux-lab/relatorios/r01-operacoes-volume"]}>
          <Routes>
            <Route path="/ux-lab/relatorios/:reportId" element={<UxLabRelatorioView />} />
          </Routes>
        </MemoryRouter>
      </UxLabThemeProvider>
    );
  };

  it("1. Segue o padrão horizontal do Dashboard e renderiza a Faixa Documental Oficial sem H1 duplicado", () => {
    renderR01();

    // Badge de código e denominação oficial
    expect(screen.getAllByText("R01").length).toBeGreaterThan(0);
    expect(screen.getByText("RELATÓRIO ANALÍTICO OFICIAL")).toBeInTheDocument();

    // Metadados documentais
    expect(screen.getAllByText("ESC Logística").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Matriz Castanhal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Setembro\/2026/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Emitido em:/i)).toBeInTheDocument();

    // Garante que não há H1 duplicado dentro do corpo documental (título principal reside na topbar do Shell)
    const headings = screen.queryAllByRole("heading", { level: 1 });
    // Em impressão/shell pode haver headers próprios, mas o corpo documental não duplica o título em H1
    const duplicateH1 = headings.find(
      (h) => h.textContent?.trim() === "ANALÍTICO DE OPERAÇÕES POR VOLUME"
    );
    expect(duplicateH1).toBeUndefined();
  });

  it("2. Renderiza ações documentais de forma única no topo (sem duplicação no rodapé)", () => {
    renderR01();

    // Ações superiores
    const exportCsvButtons = screen.getAllByText("Exportar CSV");
    expect(exportCsvButtons.length).toBe(1);

    const pdfButtons = screen.getAllByText("Gerar PDF");
    expect(pdfButtons.length).toBe(1);

    const printButtons = screen.getAllByText("Imprimir");
    expect(printButtons.length).toBe(1);
  });

  it("3. Renderiza os 5 parâmetros de consulta (Empresa, Data De, Data Até, Serviço, Status)", () => {
    renderR01();

    expect(screen.getByText("Parâmetros de Consulta")).toBeInTheDocument();
    expect(screen.getByText("Empresa / Filial")).toBeInTheDocument();
    expect(screen.getByText("Data Inicial (De)")).toBeInTheDocument();
    expect(screen.getByText("Data Final (Até)")).toBeInTheDocument();
    expect(screen.getAllByText("Serviço").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Status").length).toBeGreaterThanOrEqual(1);
  });

  it("4. Renderiza a Composição Analítica 50/50 com Resumo 2x2 na esquerda e Análise na direita", () => {
    renderR01();

    // Coluna Esquerda: Resumo do Período
    expect(screen.getByText("Resumo do Período")).toBeInTheDocument();
    expect(screen.getByText("6 operações")).toBeInTheDocument();
    expect(screen.getByText(/10\.110 unidades/i)).toBeInTheDocument();

    // Grid 2x2 interno
    expect(screen.getByText("Total de Operações")).toBeInTheDocument();
    expect(screen.getByText("Volume Movimentado")).toBeInTheDocument();
    expect(screen.getByText("Total Bruto Apurado")).toBeInTheDocument();
    expect(screen.getByText("Materiais Agregados")).toBeInTheDocument();

    // Coluna Direita: Análise / Distribuição
    expect(screen.getByText("Análise / Distribuição")).toBeInTheDocument();

    // Linha 1 da direita: Serviço + Transportadora lado a lado
    expect(screen.getByText("Por Tipo de Serviço")).toBeInTheDocument();
    expect(screen.getByText("Por Cliente / Transportadora")).toBeInTheDocument();

    // Linha 2 da direita: Status Operacional ocupando a largura
    expect(screen.getByText("Status Operacional")).toBeInTheDocument();
    expect(screen.getAllByText("CONCLUÍDO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FATURADO").length).toBeGreaterThan(0);
  });

  it("5. Renderiza a tabela de registros com 14 colunas e alinhamentos adequados", () => {
    renderR01();

    expect(screen.getByText("Registros que Compõem o Relatório")).toBeInTheDocument();
    expect(screen.getByText("Dataset de Consulta")).toBeInTheDocument();

    // Colunas homologadas
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Unidade")).toBeInTheDocument();
    expect(screen.getByText("Transportadora")).toBeInTheDocument();
    expect(screen.getAllByText("Serviço").length).toBeGreaterThan(0);
    expect(screen.getByText("Produto / Carga")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Unitário")).toBeInTheDocument();
    expect(screen.getByText("Total Bruto")).toBeInTheDocument();
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    expect(screen.getByText("ISS")).toBeInTheDocument();
    expect(screen.getByText("Placa")).toBeInTheDocument();
    expect(screen.getByText("NF")).toBeInTheDocument();
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);

    // Paginação
    expect(screen.getByText(/Página 1 de/i)).toBeInTheDocument();
  });

  it("6. Renderiza o Controle Documental compacto como rodapé técnico de governança", () => {
    renderR01();

    expect(screen.getByText("Controle Documental")).toBeInTheDocument();
    expect(screen.getByText(/Rastreabilidade: ORBE-DOC-R01/i)).toBeInTheDocument();
    expect(screen.getByText(/6 operações apuradas/i)).toBeInTheDocument();
    expect(screen.getByText(/Operações por Volume \(operacoes_producao\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Critérios aplicados:/i)).toBeInTheDocument();
  });
});
