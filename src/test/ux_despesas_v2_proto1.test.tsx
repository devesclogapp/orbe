import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import UxLabDespesas from "@/pages/UxLab/UxLabDespesas";
import {
  MOCK_DESPESAS_OBRIGACOES,
  calculateDespesasKpiStats,
  calcularDiasVencimento,
} from "@/pages/UxLab/despesasMockData";

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("UX12 — Central de Despesas & Contas a Pagar (Protótipo Visual V2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Renderiza a tela principal com título, subtítulo e contexto oficial com Período Financeiro", () => {
    renderWithProviders(<UxLabDespesas />);

    expect(screen.getByText("Central de Despesas & Contas a Pagar")).toBeInTheDocument();
    expect(
      screen.getByText("Gestão de obrigações, desembolsos e contas a pagar.")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Período Financeiro/i).length).toBeGreaterThan(0);
  });

  it("2. Renderiza os 4 KPIs principais com integridade matemática e Prontas para Execução", () => {
    renderWithProviders(<UxLabDespesas />);

    const stats = calculateDespesasKpiStats(MOCK_DESPESAS_OBRIGACOES);

    // KPI 1: Despesas no Período (Royal Blue Institucional)
    expect(screen.getAllByText("Despesas no Período").length).toBeGreaterThan(0);
    expect(stats.despesasNoPeriodo).toBe(148100);

    // KPI 2: A Pagar
    expect(screen.getAllByText("A Pagar").length).toBeGreaterThan(0);
    expect(stats.aPagar).toBe(74830);

    // KPI 3: Prontas para Execução (R$ 74.410,00 derivado)
    expect(screen.getAllByText("Prontas para Execução").length).toBeGreaterThan(0);
    expect(stats.prontasExecucao).toBe(74410);
    expect(stats.prontasLiquidacaoDireta).toBe(9400);
    expect(stats.prontasViaBanco).toBe(65010);
    expect(stats.prontasLiquidacaoDireta + stats.prontasViaBanco).toBe(stats.prontasExecucao);

    // Prontas para Execução é subconjunto estrito de A Pagar
    expect(stats.prontasExecucao).toBeLessThan(stats.aPagar);
    expect(stats.aPagar - stats.prontasExecucao).toBe(420); // Reembolso de R$ 420 aguardando liberação

    // KPI 4: Pagas / Liquidadas
    expect(screen.getAllByText("Pagas / Liquidadas").length).toBeGreaterThan(0);
    expect(stats.pagasLiquidadas).toBe(73270);
  });

  it("3. Renderiza o indicador secundário bancário com valor exato da mão de obra pronta para banco", () => {
    renderWithProviders(<UxLabDespesas />);

    const stats = calculateDespesasKpiStats(MOCK_DESPESAS_OBRIGACOES);
    expect(stats.maoDeObraProntaBanco).toBe(65010);

    expect(screen.getByText(/em obrigações de mão de obra estão prontas para processamento bancário/i)).toBeInTheDocument();
    expect(screen.getAllByText("Abrir Central Bancária").length).toBeGreaterThan(0);
  });

  it("4. Dataset mock contém 16 ou mais registros cobrindo os 4 motores de saída", () => {
    expect(MOCK_DESPESAS_OBRIGACOES.length).toBeGreaterThanOrEqual(16);

    const origens = new Set(MOCK_DESPESAS_OBRIGACOES.map((d) => d.origem));
    expect(origens.has("CUSTOS_EXTRAS")).toBe(true);
    expect(origens.has("DIARISTAS")).toBe(true);
    expect(origens.has("INTERMITENTES")).toBe(true);
    expect(origens.has("CLT")).toBe(true);
  });

  it("5. PAGO_EMPRESA é reconhecido economicamente mas NÃO entra em A PAGAR", () => {
    const itemPagoEmpresa = MOCK_DESPESAS_OBRIGACOES.find((d) => d.tipo === "PAGO_EMPRESA");
    expect(itemPagoEmpresa).toBeDefined();
    expect(itemPagoEmpresa?.situacao).toBe("PAGA");

    const stats = calculateDespesasKpiStats(MOCK_DESPESAS_OBRIGACOES);
    expect(stats.despesasReconhecidas).toBeGreaterThanOrEqual(itemPagoEmpresa!.valor);
    // PAGO_EMPRESA is already paid, so it is in pagasLiquidadas, not aPagar
    expect(stats.pagasLiquidadas).toBeGreaterThanOrEqual(itemPagoEmpresa!.valor);
  });

  it("6. Suporta Reembolso a Colaborador e Pagamento Pendente a Fornecedor", () => {
    const reembolso = MOCK_DESPESAS_OBRIGACOES.find((d) => d.tipo === "REEMBOLSO_COLABORADOR");
    expect(reembolso).toBeDefined();
    expect(reembolso?.beneficiarioNome).toContain("João M****");

    const fornecedor = MOCK_DESPESAS_OBRIGACOES.find((d) => d.tipo === "PAGAMENTO_PENDENTE");
    expect(fornecedor).toBeDefined();
    expect(fornecedor?.dataVencimento).toBeDefined();
  });

  it("7. Calcula condição derivada de VENCIDO quando data de vencimento é anterior à data de referência", () => {
    const itemVencido = MOCK_DESPESAS_OBRIGACOES.find((d) => d.codigo === "CE-2026-189");
    expect(itemVencido).toBeDefined();

    const { isVencido, diasAtraso } = calcularDiasVencimento(itemVencido?.dataVencimento, itemVencido?.situacao);
    expect(isVencido).toBe(true);
    expect(diasAtraso).toBeGreaterThan(0);
  });

  it("8. Mão de Obra (Diaristas, Intermitentes, CLT) é representada por lotes homologados", () => {
    const loteDiarista = MOCK_DESPESAS_OBRIGACOES.find((d) => d.origem === "DIARISTAS");
    expect(loteDiarista?.quantidadePessoas).toBeDefined();
    expect(loteDiarista?.quantidadeUnidades).toContain("diárias");

    const loteIntermitente = MOCK_DESPESAS_OBRIGACOES.find((d) => d.origem === "INTERMITENTES");
    expect(loteIntermitente?.quantidadeUnidades).toContain("h apuradas");

    const loteClt = MOCK_DESPESAS_OBRIGACOES.find((d) => d.origem === "CLT");
    expect(loteClt?.quantidadeUnidades).toContain("colaboradores");
  });

  it("9. Busca textual filtra os registros da tabela corretamente", () => {
    renderWithProviders(<UxLabDespesas />);

    const searchInput = screen.getByPlaceholderText("Buscar referência, beneficiário ou documento...");
    fireEvent.change(searchInput, { target: { value: "CE-2026-184" } });

    expect(screen.getAllByText("CE-2026-184").length).toBeGreaterThan(0);
    expect(screen.queryByText("CE-2026-181")).not.toBeInTheDocument();
  });

  it("10. Pills de situação financeira filtram os registros", () => {
    renderWithProviders(<UxLabDespesas />);

    // Clicar em "Aguardando Liberação"
    const pillAguardando = screen.getByRole("button", { name: /Aguardando Liberação/i });
    fireEvent.click(pillAguardando);

    // Deve exibir itens aguardando liberação
    expect(screen.getAllByText("CE-2026-184").length).toBeGreaterThan(0);
    // Não deve exibir lotes prontos para banco
    expect(screen.queryByText("LT-DIA-SEM40")).not.toBeInTheDocument();
  });

  it("11. Drawer de Custo Extra / Reembolso abre e exibe CTAs de Liberar e Devolver", () => {
    renderWithProviders(<UxLabDespesas />);

    // Abrir item CE-2026-184 (Aguardando Liberação)
    const itemRow = screen.getAllByText("CE-2026-184")[0];
    fireEvent.click(itemRow);

    // Drawer aberto
    expect(screen.getAllByText("Refeição de Equipe em Horário Extraordinário").length).toBeGreaterThan(0);
    expect(screen.getByText("Valor da Obrigação")).toBeInTheDocument();
    expect(screen.getByText("Liberar para Pagamento")).toBeInTheDocument();
    expect(screen.getByText("Devolver p/ Operação")).toBeInTheDocument();
  });

  it("12. Drawer de Fornecedor a Pagar abre e exibe CTA de Confirmar Pagamento", () => {
    renderWithProviders(<UxLabDespesas />);

    // Abrir item CE-2026-187 (A_PAGAR)
    const itemRow = screen.getAllByText("CE-2026-187")[0];
    fireEvent.click(itemRow);

    expect(screen.getAllByText("Locação Mensal de Empilhadeira Elétrica").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirmar Pagamento")).toBeInTheDocument();
    // Não deve conter menção a CNAB
    expect(screen.queryByText("Gerar CNAB")).not.toBeInTheDocument();
  });

  it("13. Drawer de Mão de Obra abre e exibe CTA para Abrir Central Bancária (sem Pagar direto)", () => {
    renderWithProviders(<UxLabDespesas />);

    // Abrir item LT-DIA-SEM40
    const itemRow = screen.getAllByText("LT-DIA-SEM40")[0];
    fireEvent.click(itemRow);

    expect(screen.getAllByText("Lote Diaristas — Semana 40 (05 a 11/10)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Abrir Central Bancária").length).toBeGreaterThan(0);
    // Não deve oferecer Confirmar Pagamento manual nem Gerar CNAB
    expect(screen.queryByText("Confirmar Pagamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Gerar CNAB")).not.toBeInTheDocument();
    expect(screen.queryByText("Fechar Semana")).not.toBeInTheDocument();
    expect(screen.queryByText("Validar RH")).not.toBeInTheDocument();
  });

  it("14. Tabela contém a coluna Competência indicando o período econômico original", () => {
    renderWithProviders(<UxLabDespesas />);

    expect(screen.getAllByText("Competência").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outubro / 2026").length).toBeGreaterThan(0);
  });

  it("15. Lotes com competência econômica anterior (Setembro/2026) aparecem no período financeiro atual", () => {
    renderWithProviders(<UxLabDespesas />);

    // Lotes de setembro presentes no dataset
    expect(screen.getAllByText("LT-DIA-SEM39").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LT-INT-2026-09-Q2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LT-CLT-2026-09").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Setembro / 2026").length).toBeGreaterThan(0);
  });

  it("16. Contagens dos KPIs são estritamente derivadas dos mesmos predicados de valor", () => {
    const stats = calculateDespesasKpiStats(MOCK_DESPESAS_OBRIGACOES);

    // Contagens canônicas auditadas
    expect(stats.qtdReconhecidas).toBe(16);
    expect(stats.qtdAPagar).toBe(8);
    expect(stats.qtdProntasExecucao).toBe(7);
    expect(stats.qtdPagasLiquidadas).toBe(8);
    expect(stats.qtdProntasBanco).toBe(3);

    // Verificação de predicados de contagem vs soma
    const itemsAPagar = MOCK_DESPESAS_OBRIGACOES.filter(
      (d) => d.situacao === "AGUARDANDO_LIBERACAO" || d.situacao === "A_PAGAR" || d.situacao === "PRONTA_BANCO"
    );
    expect(itemsAPagar.length).toBe(stats.qtdAPagar);
    expect(itemsAPagar.reduce((acc, d) => acc + d.valor, 0)).toBe(stats.aPagar);

    const itemsPagas = MOCK_DESPESAS_OBRIGACOES.filter((d) => d.situacao === "PAGA");
    expect(itemsPagas.length).toBe(stats.qtdPagasLiquidadas);
    expect(itemsPagas.reduce((acc, d) => acc + d.valor, 0)).toBe(stats.pagasLiquidadas);

    const itemsProntas = MOCK_DESPESAS_OBRIGACOES.filter(
      (d) => (d.tipo !== "MAO_DE_OBRA" && d.situacao === "A_PAGAR") || (d.tipo === "MAO_DE_OBRA" && d.situacao === "PRONTA_BANCO")
    );
    expect(itemsProntas.length).toBe(stats.qtdProntasExecucao);
    expect(itemsProntas.reduce((acc, d) => acc + d.valor, 0)).toBe(stats.prontasExecucao);
  });

  it("17. Drawer de despesa paga exibe botão 'Fechar' e não contém 'Fechar Detalhes'", () => {
    renderWithProviders(<UxLabDespesas />);

    // Abrir item CE-2026-181 (PAGO_EMPRESA)
    const itemRow = screen.getAllByText("CE-2026-181")[0];
    fireEvent.click(itemRow);

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar Detalhes" })).not.toBeInTheDocument();
    expect(screen.getByText("Desembolso Direto da Empresa")).toBeInTheDocument();
  });

  it("18. KPI Prontas para Execução exibe breakdown integral de liquidação direta e via banco", () => {
    renderWithProviders(<UxLabDespesas />);

    expect(screen.getByText(/liquidação direta •/i)).toBeInTheDocument();
    expect(screen.getByText(/via banco/i)).toBeInTheDocument();
  });
});
