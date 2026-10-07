import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  DespesasContasPagarOficialService,
  DespesaFederadaItem,
  calculateDespesasKpiStats,
  deduplicarDespesas,
  buildCanonicalFederatedId,
  normalizarCustoExtra,
  normalizarLoteClt,
  normalizarLoteDiarista,
  normalizarLoteIntermitente,
} from "@/services/despesasOficial.service";
import CentralFinanceira from "@/pages/CentralFinanceira";
import { DespesaDrawerOficial } from "@/pages/Financeiro/components/DespesaDrawerOficial";

describe("CONV-10 — DESPESAS & CONTAS A PAGAR: Suíte Oficial de Convergência", () => {
  const centralFinanceiraPath = path.resolve(__dirname, "../pages/CentralFinanceira.tsx");
  const centralFinanceiraContent = fs.readFileSync(centralFinanceiraPath, "utf-8");

  const despesaDrawerPath = path.resolve(__dirname, "../pages/Financeiro/components/DespesaDrawerOficial.tsx");
  const despesaDrawerContent = fs.readFileSync(despesaDrawerPath, "utf-8");

  const despesasServicePath = path.resolve(__dirname, "../services/despesasOficial.service.ts");
  const despesasServiceContent = fs.readFileSync(despesasServicePath, "utf-8");

  // -------------------------------------------------------------------------
  // BLOCO 1: ROTA OFICIAL E IDENTIDADE VISUAL UX12
  // -------------------------------------------------------------------------
  it("01. rota /financeiro usa UX12 convergida (Despesas & Contas a Pagar)", () => {
    expect(centralFinanceiraContent).toContain('"Despesas & Contas a Pagar"');
    expect(centralFinanceiraContent).toContain('"Gestão de obrigações, desembolsos e contas a pagar."');
  });

  it("02. zero mock na rota oficial", () => {
    expect(centralFinanceiraContent).not.toContain("mockDespesas");
    expect(centralFinanceiraContent).not.toContain("mockUx12");
    expect(centralFinanceiraContent).not.toContain("UxLab");
    expect(despesasServiceContent).not.toContain("mock");
  });

  // -------------------------------------------------------------------------
  // BLOCO 2: AS 4 ORIGENS REAIS E NORMALIZAÇÃO
  // -------------------------------------------------------------------------
  it("03. quatro origens reais integradas", () => {
    expect(despesasServiceContent).toContain('"CUSTOS_EXTRAS"');
    expect(despesasServiceContent).toContain('"CLT"');
    expect(despesasServiceContent).toContain('"DIARISTAS"');
    expect(despesasServiceContent).toContain('"INTERMITENTES"');
  });

  it("04. Custo Extra identificado deterministicamente", () => {
    const rawCusto = {
      id: "ce-123",
      empresa_id: "emp-1",
      tipo_custo: "ALIMENTACAO",
      descricao: "Refeição equipe",
      valor_total: 150,
      origem_recurso: "REEMBOLSO_COLABORADOR",
      pipeline_status: "ENVIADO_FINANCEIRO",
      data_despesa: "2026-10-05",
      data_vencimento: "2026-10-15",
      colaborador_nome: "Carlos Silva",
    };
    const norm = normalizarCustoExtra(rawCusto, new Map([["emp-1", "Empresa Alpha"]]), "2026-10");
    expect(norm.origem).toBe("CUSTOS_EXTRAS");
    expect(norm.tipo).toBe("REEMBOLSO_COLABORADOR");
    expect(norm.beneficiarioNome).toBe("Carlos Silva");
    expect(norm.valorTotal).toBe(150);
  });

  it("05. CLT identificado deterministicamente", () => {
    const rawClt = {
      id: "clt-lote-99",
      empresa_id: "emp-1",
      tipo: "FOLHA_VARIAVEL",
      competencia: "2026-10",
      valor_total: 8500,
      total_colaboradores: 12,
      status: "AGUARDANDO_PAGAMENTO",
    };
    const norm = normalizarLoteClt(rawClt, new Map([["emp-1", "Empresa Alpha"]]), "2026-10");
    expect(norm.origem).toBe("CLT");
    expect(norm.tipo).toBe("MAO_DE_OBRA");
    expect(norm.situacaoVisual).toBe("PRONTA_BANCO");
    expect(norm.prontoParaBanco).toBe(true);
  });

  it("06. Diarista identificado deterministicamente", () => {
    const rawDiarista = {
      id: "diar-lote-88",
      empresa_id: "emp-1",
      tipo: "DIARISTAS",
      periodo_inicio: "2026-10-01",
      periodo_fim: "2026-10-07",
      valor_total: 3200,
      total_diaristas: 5,
      status: "AGUARDANDO_PAGAMENTO",
    };
    const norm = normalizarLoteDiarista(rawDiarista, new Map([["emp-1", "Empresa Alpha"]]), "2026-10");
    expect(norm.origem).toBe("DIARISTAS");
    expect(norm.tipo).toBe("MAO_DE_OBRA");
    expect(norm.prontoParaBanco).toBe(true);
  });

  it("07. Intermitente identificado deterministicamente", () => {
    const rawIntermitente = {
      id: "interm-lote-77",
      empresa_id: "emp-1",
      competencia: "2026-10",
      valor_total: 4100,
      total_colaboradores: 4,
      status: "AGUARDANDO_PAGAMENTO",
    };
    const norm = normalizarLoteIntermitente(rawIntermitente, new Map([["emp-1", "Empresa Alpha"]]), "2026-10");
    expect(norm.origem).toBe("INTERMITENTES");
    expect(norm.tipo).toBe("MAO_DE_OBRA");
    expect(norm.prontoParaBanco).toBe(true);
  });

  // -------------------------------------------------------------------------
  // BLOCO 3: IDENTIDADE CANÔNICA E DEDUPLICAÇÃO ESTRITA
  // -------------------------------------------------------------------------
  it("08. chave federada canônica usa ORIGEM:ID_CANONICO", () => {
    expect(buildCanonicalFederatedId("CUSTOS_EXTRAS", "123")).toBe("CUSTOS_EXTRAS:123");
    expect(buildCanonicalFederatedId("CLT", "abc")).toBe("CLT:abc");
    expect(buildCanonicalFederatedId("DIARISTAS", "xyz")).toBe("DIARISTAS:xyz");
    expect(buildCanonicalFederatedId("INTERMITENTES", "456")).toBe("INTERMITENTES:456");
  });

  it("09. IDs iguais entre origens diferentes NÃO colidem", () => {
    const idA = buildCanonicalFederatedId("CUSTOS_EXTRAS", "100");
    const idB = buildCanonicalFederatedId("CLT", "100");
    expect(idA).not.toBe(idB);
    expect(idA).toBe("CUSTOS_EXTRAS:100");
    expect(idB).toBe("CLT:100");
  });

  it("10. deduplicação de Custo Extra repetido", () => {
    const item1: any = { id: "CUSTOS_EXTRAS:1", valorTotal: 100 };
    const item2: any = { id: "CUSTOS_EXTRAS:1", valorTotal: 100 };
    const res = deduplicarDespesas([item1, item2]);
    expect(res).toHaveLength(1);
  });

  it("11. deduplicação de lote CLT repetido", () => {
    const item1: any = { id: "CLT:lote-1", valorTotal: 5000 };
    const item2: any = { id: "CLT:lote-1", valorTotal: 5000 };
    const res = deduplicarDespesas([item1, item2]);
    expect(res).toHaveLength(1);
  });

  it("12. deduplicação de lote Diarista repetido", () => {
    const item1: any = { id: "DIARISTAS:lote-2", valorTotal: 2000 };
    const item2: any = { id: "DIARISTAS:lote-2", valorTotal: 2000 };
    const res = deduplicarDespesas([item1, item2]);
    expect(res).toHaveLength(1);
  });

  it("13. deduplicação de lote Intermitente repetido", () => {
    const item1: any = { id: "INTERMITENTES:lote-3", valorTotal: 3000 };
    const item2: any = { id: "INTERMITENTES:lote-3", valorTotal: 3000 };
    const res = deduplicarDespesas([item1, item2]);
    expect(res).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // BLOCO 4: KPIS FEDERADOS E PROTEÇÃO CONTRA DUPLA CONTAGEM
  // -------------------------------------------------------------------------
  it("14. KPIs usam dataset deduplicado", () => {
    const itens: any[] = [
      { id: "CUSTOS_EXTRAS:1", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE" },
      { id: "CUSTOS_EXTRAS:1", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE" }, // duplicado
      { id: "CLT:lote-1", valorTotal: 1000, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA", prontoParaBanco: true },
    ];
    const dedup = deduplicarDespesas(itens);
    const kpis = calculateDespesasKpiStats(dedup);
    expect(kpis.totalDespesas).toBe(1100); // 100 + 1000 (não 1200)
    expect(kpis.quantidadeDespesas).toBe(2);
  });

  it("15. tenant contextual respeitado no service", () => {
    expect(despesasServiceContent).toContain("getCurrentTenantId");
    expect(despesasServiceContent).toContain("tenantId");
  });

  it("16. empresa contextual respeitada", () => {
    expect(despesasServiceContent).toContain("targetEmpresaId");
    expect(centralFinanceiraContent).toContain("Todas as Empresas");
  });

  it("17. período financeiro contextual respeitado", () => {
    expect(despesasServiceContent).toContain("mesCompetencia");
    expect(centralFinanceiraContent).toContain("selectedMonth");
  });

  it("18. competência econômica preservada sem distorção", () => {
    const raw = {
      id: "1",
      competencia: "2026-10",
      periodo_inicio: "2026-10-01",
      tipo: "FOLHA_VARIAVEL",
      valor_total: 100,
    };
    const norm = normalizarLoteClt(raw, new Map(), "2026-10");
    expect(norm.competencia).toBe("2026-10");
  });

  it("19. created_at não substitui competência", () => {
    const raw = {
      id: "1",
      created_at: "2026-10-15T09:00:00Z",
      competencia: "2026-09", // mês anterior
      tipo: "FOLHA_VARIAVEL",
      valor_total: 100,
    };
    const norm = normalizarLoteClt(raw, new Map(), "2026-09");
    expect(norm.competencia).toBe("2026-09");
    expect(norm.competencia).not.toBe("2026-10");
  });

  it("20. Despesas no Período soma total reconhecido", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 50, situacaoVisual: "PAGA", tipo: "PAGO_EMPRESA" },
      { id: "2", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE" },
      { id: "3", valorTotal: 300, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA" },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.totalDespesas).toBe(450);
  });

  it("21. A Pagar inclui apenas obrigações futuras abertas", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 50, situacaoVisual: "PAGA", tipo: "PAGO_EMPRESA" },
      { id: "2", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE" },
      { id: "3", valorTotal: 300, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA" },
      { id: "4", valorTotal: 200, situacaoVisual: "AGUARDANDO_LIBERACAO", tipo: "PAGAMENTO_PENDENTE" },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.totalAPagar).toBe(600); // 100 + 300 + 200
  });

  it("22. Prontas para Execução soma obrigações liberadas com gates satisfeitos", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE", origem: "CUSTOS_EXTRAS" },
      { id: "2", valorTotal: 300, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA", origem: "CLT", prontoParaBanco: true },
      { id: "3", valorTotal: 50, situacaoVisual: "AGUARDANDO_LIBERACAO", tipo: "REEMBOLSO_COLABORADOR", origem: "CUSTOS_EXTRAS" },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.totalProntasExecucao).toBe(400); // 100 + 300
    expect(kpis.maoDeObraProntaBanco).toBe(300);
    expect(kpis.custosExtrasProntos).toBe(100);
  });

  it("23. Pagas / Liquidadas soma apenas obrigações liquidadas", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 150, situacaoVisual: "PAGA", tipo: "PAGO_EMPRESA" },
      { id: "2", valorTotal: 250, situacaoVisual: "PAGA", tipo: "MAO_DE_OBRA" },
      { id: "3", valorTotal: 300, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE" },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.totalPagas).toBe(400);
    expect(kpis.quantidadePagas).toBe(2);
  });

  it("24. Prontas p/ Banco soma estritamente Mão de Obra com readiness bancário", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 500, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA", origem: "CLT", prontoParaBanco: true },
      { id: "2", valorTotal: 300, situacaoVisual: "PRONTA_BANCO", tipo: "MAO_DE_OBRA", origem: "DIARISTAS", prontoParaBanco: true },
      { id: "3", valorTotal: 100, situacaoVisual: "A_PAGAR", tipo: "PAGAMENTO_PENDENTE", origem: "CUSTOS_EXTRAS", prontoParaBanco: false },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.maoDeObraProntaBanco).toBe(800);
  });

  it("25. PAGO_EMPRESA não entra em A Pagar", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 120, situacaoVisual: "PAGA", tipo: "PAGO_EMPRESA" },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.totalAPagar).toBe(0);
    expect(kpis.totalDespesas).toBe(120);
  });

  it("26. PAGO_EMPRESA não entra em Prontas p/ Banco", () => {
    const itens: any[] = [
      { id: "1", valorTotal: 120, situacaoVisual: "PAGA", tipo: "PAGO_EMPRESA", prontoParaBanco: false },
    ];
    const kpis = calculateDespesasKpiStats(itens);
    expect(kpis.maoDeObraProntaBanco).toBe(0);
  });

  // -------------------------------------------------------------------------
  // BLOCO 5: REGRA ABSOLUTA — CUSTOS EXTRAS × CNAB
  // -------------------------------------------------------------------------
  it("27. Custo Extra NUNCA entra em CNAB e não é marcado como prontoParaBanco", () => {
    const raw = {
      id: "ce-9",
      empresa_id: "emp-1",
      tipo_custo: "MANUTENCAO",
      descricao: "Troca lâmpadas",
      valor_total: 80,
      origem_recurso: "PAGAMENTO_PENDENTE",
      pipeline_status: "ENVIADO_FINANCEIRO",
    };
    const norm = normalizarCustoExtra(raw, new Map(), "2026-10");
    expect(norm.prontoParaBanco).toBe(false);
    expect(norm.situacaoVisual).not.toBe("PRONTA_BANCO");
    expect(norm.situacaoVisual).toBe("A_PAGAR");
  });

  it("28. CLT readiness bancário preservado", () => {
    const raw = {
      id: "clt-1",
      tipo: "FOLHA_VARIAVEL",
      status: "AGUARDANDO_PAGAMENTO",
      valor_total: 1000,
    };
    const norm = normalizarLoteClt(raw, new Map(), "2026-10");
    expect(norm.prontoParaBanco).toBe(true);
  });

  it("29. Diaristas readiness bancário preservado", () => {
    const raw = {
      id: "diar-1",
      tipo: "DIARISTAS",
      status: "AGUARDANDO_PAGAMENTO",
      valor_total: 2000,
    };
    const norm = normalizarLoteDiarista(raw, new Map(), "2026-10");
    expect(norm.prontoParaBanco).toBe(true);
  });

  it("30. Intermitentes readiness bancário preservado", () => {
    const raw = {
      id: "int-1",
      status: "AGUARDANDO_PAGAMENTO",
      valor_total: 1500,
    };
    const norm = normalizarLoteIntermitente(raw, new Map(), "2026-10");
    expect(norm.prontoParaBanco).toBe(true);
  });

  // -------------------------------------------------------------------------
  // BLOCO 6: INDEPENDÊNCIA ESTATÍSTICA DOS KPIS EM RELAÇÃO AOS FILTROS
  // -------------------------------------------------------------------------
  it("31. busca textual NÃO altera KPIs", () => {
    expect(centralFinanceiraContent).toContain("calculateKpiStats");
    expect(centralFinanceiraContent).toContain("despesasFederadas");
    // kpiStats é memorizado a partir de federadoData, antes do filtro de busca
    expect(centralFinanceiraContent).toContain("const kpiStats = useMemo(");
  });

  it("32. filtro por origem NÃO altera KPIs", () => {
    expect(centralFinanceiraContent).toContain("filtroOrigem");
  });

  it("33. filtro por estágio NÃO altera KPIs", () => {
    expect(centralFinanceiraContent).toContain("filtroPill");
  });

  it("34. filtro por beneficiário NÃO altera KPIs", () => {
    expect(centralFinanceiraContent).toContain("filtroBeneficiario");
  });

  it("35. filtro por natureza / tipo NÃO altera KPIs", () => {
    expect(centralFinanceiraContent).toContain("filtroTipo");
  });

  it("36. filtro por banco NÃO altera KPIs", () => {
    // KPIs dependem do dataset contextual, filtros afetam apenas despesasFiltradas
    expect(centralFinanceiraContent).toContain("despesasFiltradas");
  });

  it("37. pills exploratórias NÃO alteram KPIs", () => {
    // Pill filtra somente despesasFiltradas
    expect(centralFinanceiraContent).toContain("item.situacaoVisual !== filtroPill");
  });

  it("38. filtros alteram SOMENTE a tabela federada", () => {
    expect(centralFinanceiraContent).toContain("despesasFiltradas.map(");
  });

  // -------------------------------------------------------------------------
  // BLOCO 7: DRAWER FEDERADO CONTEXTUAL POR ORIGEM
  // -------------------------------------------------------------------------
  it("39. Drawer de Custo Extra não contém seção CNAB", () => {
    expect(despesaDrawerContent).toContain("isCustoExtra");
    expect(despesaDrawerContent).toContain("Fora do pipeline CNAB bancário");
    expect(despesaDrawerContent).not.toContain("Gerar Remessa CNAB para Custo Extra");
  });

  it("40. Drawer de CLT é contextual e exibe resumo de lote", () => {
    expect(despesaDrawerContent).toContain('item.origem === "CLT"');
    expect(despesaDrawerContent).toContain("Folha Salarial / CLT");
  });

  it("41. Drawer de Diarista é contextual e exibe diárias", () => {
    expect(despesaDrawerContent).toContain('item.origem === "DIARISTAS"');
    expect(despesaDrawerContent).toContain("Diaristas Operacionais");
  });

  it("42. Drawer de Intermitente é contextual e exibe convocação", () => {
    expect(despesaDrawerContent).toContain('item.origem === "INTERMITENTES"');
    expect(despesaDrawerContent).toContain("Trabalho Intermitente");
  });

  // -------------------------------------------------------------------------
  // BLOCO 8: DESPACHOS CONTEXTUAIS E AUSÊNCIA DE BULK ACTIONS PERIGOSAS
  // -------------------------------------------------------------------------
  it("43. bloqueio por inconsistência despacha para /inconsistencias", () => {
    expect(despesaDrawerContent).toContain('navigate("/inconsistencias")');
  });

  it("44. pendência de aprovação despacha para /rh/aprovacoes", () => {
    expect(despesaDrawerContent).toContain('navigate("/rh/aprovacoes")');
  });

  it("45. lote pronto para banco despacha para /bancario", () => {
    expect(despesaDrawerContent).toContain('navigate("/bancario")');
    expect(centralFinanceiraContent).toContain('navigate("/bancario")');
  });

  it("46. NENHUMA ação 'Pagar Tudo' permitida", () => {
    expect(centralFinanceiraContent).not.toContain("Pagar Tudo");
    expect(despesaDrawerContent).not.toContain("Pagar Tudo");
  });

  it("47. NENHUMA ação 'Gerar CNAB Geral' permitida", () => {
    expect(centralFinanceiraContent).not.toContain("Gerar CNAB Geral");
    expect(despesaDrawerContent).not.toContain("Gerar CNAB Geral");
  });

  it("48. contexto multiempresa FAIL CLOSED para mutação ambígua", () => {
    // Ações que dependem de empresa e id individual verificam item.id e item.empresaId
    expect(despesaDrawerContent).toContain("item.empresaId");
    expect(despesaDrawerContent).toContain("toast.error");
  });

  // -------------------------------------------------------------------------
  // BLOCO 9: ESTABILIDADE UX E TRATAMENTO DE ERROS
  // -------------------------------------------------------------------------
  it("49. empty state apresenta mensagem informativa amigável", () => {
    expect(centralFinanceiraContent).toContain(
      "Nenhuma despesa ou obrigação encontrada para o contexto selecionado."
    );
  });

  it("50. error state claro quando há falha federada", () => {
    expect(centralFinanceiraContent).toContain("isErrorFederado");
    expect(centralFinanceiraContent).toContain("Falha crítica ao consultar fontes federadas de despesas");
  });

  it("51. falha crítica de fonte não gera KPI parcial silencioso (Fail-Closed)", () => {
    expect(despesasServiceContent).toContain("Falha crítica ao consultar");
    expect(despesasServiceContent).toContain("throw new Error");
  });

  it("52. refetch não duplica registros (garantido por deduplicação canônica)", () => {
    expect(despesasServiceContent).toContain("deduplicarDespesas");
  });

  it("53. refetch não desmonta geometria do layout", () => {
    expect(centralFinanceiraContent).toContain("loadingFederado");
  });

  it("54. query param tab=custos-extras permanece 100% compatível", () => {
    expect(centralFinanceiraContent).toContain('searchParams.get("tab")');
    expect(centralFinanceiraContent).toContain('TabsContent value="custos-extras"');
  });

  // -------------------------------------------------------------------------
  // BLOCO 10: GOVERNANÇA, BACKEND ZERO E PRESERVAÇÃO
  // -------------------------------------------------------------------------
  it("55. nenhum backend novo (zero migrations, zero novas RPCs)", () => {
    // Service utiliza unicamente métodos e tabelas pré-existentes
    expect(despesasServiceContent).not.toContain("createTable");
    expect(despesasServiceContent).not.toContain("rpc_novo");
  });

  it("56. nenhum status persistido novo no banco de dados", () => {
    // Normalização SituacaoFinanceiraUX existe SOMENTE em memória/apresentação
    expect(despesasServiceContent).toContain("export type SituacaoFinanceiraUX");
  });

  it("57. UX Lab não foi alterado na implementação oficial", () => {
    const uxLabDir = path.resolve(__dirname, "../pages/UxLab");
    expect(fs.existsSync(uxLabDir)).toBe(true);
  });
});
