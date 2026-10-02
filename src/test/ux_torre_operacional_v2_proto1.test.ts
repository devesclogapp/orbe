import { describe, it, expect } from "vitest";
import {
  MOCK_RADAR_OPERACIONAL,
  MOCK_TRILHA_RECEITAS,
  MOCK_TRILHA_CUSTOS,
} from "../pages/UxLab/torreMockData";

describe("UX02 — Torre Operacional V2 (Protótipo 1)", () => {
  it("1. O Radar Operacional é compacto e não contém métricas financeiras de Dashboard", () => {
    expect(MOCK_RADAR_OPERACIONAL.aguardandoAcao).toBeGreaterThan(0);
    expect(MOCK_RADAR_OPERACIONAL.foraDoSla).toBeGreaterThan(0);
    expect(MOCK_RADAR_OPERACIONAL.inconsistenciasImpeditivas).toBeGreaterThan(0);
    expect(MOCK_RADAR_OPERACIONAL.emAndamento).toBeGreaterThan(0);

    // Garante que não foram incluídos campos de faturamento/lucro/margem no radar
    const radarKeys = Object.keys(MOCK_RADAR_OPERACIONAL);
    expect(radarKeys).not.toContain("faturamentoTotal");
    expect(radarKeys).not.toContain("margemOperacional");
    expect(radarKeys).not.toContain("lucroOperacional");
  });

  it("2. A Trilha A (Operações & Receitas) possui exatamente 4 etapas canônicas e não contém CNAB ou RH", () => {
    expect(MOCK_TRILHA_RECEITAS.etapas).toHaveLength(4);
    const nomesEtapas = MOCK_TRILHA_RECEITAS.etapas.map((e) => e.nome);
    expect(nomesEtapas).toEqual([
      "Entrada de Campo",
      "Validação Operacional",
      "Pronto para Faturar",
      "Faturado / Recebimento",
    ]);

    // Não deve conter termos bancários ou de folha/RH nesta trilha
    nomesEtapas.forEach((nome) => {
      expect(nome.toLowerCase()).not.toContain("cnab");
      expect(nome.toLowerCase()).not.toContain("folha");
      expect(nome.toLowerCase()).not.toContain("banco de horas");
    });
  });

  it("3. A Trilha B (Mão de Obra & Custos) possui exatamente 4 etapas e contempla Diaristas, Intermitentes, Custos e Fechamento CLT", () => {
    expect(MOCK_TRILHA_CUSTOS.etapas).toHaveLength(4);
    const nomesEtapas = MOCK_TRILHA_CUSTOS.etapas.map((e) => e.nome);
    expect(nomesEtapas).toEqual([
      "Lançamento de Campo",
      "Validação Operacional / RH",
      "Lote Homologado",
      "Direcionamento Financeiro",
    ]);

    // Verifica que os tipos de processo contemplados na Trilha B são de despesas e mão de obra
    const tipos = MOCK_TRILHA_CUSTOS.etapas.flatMap((e) =>
      e.itensExemplo.map((item) => item.tipo)
    );
    expect(tipos).toContain("Diarista");
    expect(tipos).toContain("Custo Extra");
    expect(tipos).toContain("Intermitente");
    expect(tipos).toContain("Fechamento CLT");
  });

  it("4. Todas as etapas definem responsabilidade setorial explícita (Operação, RH ou Financeiro)", () => {
    const todasEtapas = [
      ...MOCK_TRILHA_RECEITAS.etapas,
      ...MOCK_TRILHA_CUSTOS.etapas,
    ];
    const responsaveisValidos = ["Operação", "RH", "Financeiro", "Governança"];

    todasEtapas.forEach((etapa) => {
      expect(responsaveisValidos).toContain(etapa.responsavelSetorial);
      expect(etapa.tempoMedio).toBeDefined();
      expect(etapa.resumoSituacao).toBeDefined();
      expect(etapa.totalProcessos).toBeGreaterThan(0);
    });
  });

  it("5. Existem cenários completos de normalidade, atenção, atraso (fora do SLA) e bloqueio impeditivo", () => {
    const todasEtapas = [
      ...MOCK_TRILHA_RECEITAS.etapas,
      ...MOCK_TRILHA_CUSTOS.etapas,
    ];
    const situacoes = todasEtapas.map((e) => e.situacao);

    expect(situacoes).toContain("normal");
    expect(situacoes).toContain("atencao");
    expect(situacoes).toContain("atrasado");
    expect(situacoes).toContain("bloqueado");
    expect(situacoes).toContain("concluido");
  });
});
