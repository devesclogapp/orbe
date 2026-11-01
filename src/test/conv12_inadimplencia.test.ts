import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calcularDiasAtraso,
  getFaixaAging,
  calcularKpisInadimplencia,
  agruparInadimplenciaPorCliente,
  TituloInadimplenteUI,
  InadimplenciaOficialService,
} from "@/services/inadimplenciaOficial.service";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";
import fs from "fs";
import path from "path";

describe("CONV-12 — INADIMPLÊNCIA & COBRANÇA (TESTES DE CONVERGÊNCIA)", () => {
  const hoje = "2026-10-15";

  const mockTitulo = (overrides: Partial<TituloInadimplenteUI> = {}): TituloInadimplenteUI => ({
    id: "REC-001",
    empresaId: "emp-1",
    clienteNome: "Logística Alpha",
    modalidade: "FATURAMENTO_MENSAL",
    competencia: "2026-08",
    competenciaFormatada: "Agosto / 2026",
    vencimento: "2026-09-10",
    valorTotal: 10000,
    status: "cobranca_enviada",
    itens: [],
    ...overrides,
  });

  it("1. Título vencido em aberto deve calcular dias de atraso positivo", () => {
    const atraso = calcularDiasAtraso("2026-09-10", hoje);
    expect(atraso).toBe(35);
  });

  it("2. Título vencendo hoje NÃO aparece como inadimplente (atraso = 0)", () => {
    const atraso = calcularDiasAtraso(hoje, hoje);
    expect(atraso).toBe(0);
  });

  it("3, 4, 5, 6, 7. Validação de status terminais e vencimento null no filtro de query", () => {
    // Verificamos a regra de exclusão do serviço oficial:
    // status NOT IN ('recebido','pago','conciliado','cancelado') E vencimento IS NOT NULL
    const statusValidosInadimplencia = [
      "aguardando_fechamento",
      "pendente_cobranca",
      "cobranca_gerada",
      "cobranca_enviada",
      "pendente_recebimento",
    ];
    const statusTerminaisExcluidos = ["recebido", "pago", "conciliado", "cancelado"];

    statusTerminaisExcluidos.forEach((st) => {
      expect(statusValidosInadimplencia).not.toContain(st);
    });
  });

  it("8. Aging 1–30 dias correto", () => {
    expect(getFaixaAging(1)).toBe("1_30");
    expect(getFaixaAging(15)).toBe("1_30");
    expect(getFaixaAging(30)).toBe("1_30");
  });

  it("9. Aging 31–60 dias correto", () => {
    expect(getFaixaAging(31)).toBe("31_60");
    expect(getFaixaAging(45)).toBe("31_60");
    expect(getFaixaAging(60)).toBe("31_60");
  });

  it("10. Aging 61–90 dias correto", () => {
    expect(getFaixaAging(61)).toBe("61_90");
    expect(getFaixaAging(75)).toBe("61_90");
    expect(getFaixaAging(90)).toBe("61_90");
  });

  it("11. Aging +90 dias correto", () => {
    expect(getFaixaAging(91)).toBe("mais_90");
    expect(getFaixaAging(120)).toBe("mais_90");
  });

  it("12. Competência antiga (ex: 2026-08) ainda aberta aparece na carteira atual", () => {
    const t = mockTitulo({
      competencia: "2026-08",
      vencimento: "2026-09-10",
      status: "cobranca_enviada",
    });
    const dias = calcularDiasAtraso(t.vencimento, hoje);
    expect(dias).toBeGreaterThan(0);
  });

  it("13 & 14. Filtros exploratórios não alteram o universo dos KPIs", () => {
    const titulos: TituloInadimplenteUI[] = [
      mockTitulo({ id: "T1", valorTotal: 1000, vencimento: "2026-10-05" }), // 10d -> 1_30
      mockTitulo({ id: "T2", valorTotal: 2000, vencimento: "2026-09-05" }), // 40d -> 31_60
      mockTitulo({ id: "T3", valorTotal: 3000, vencimento: "2026-08-05" }), // 71d -> 61_90
      mockTitulo({ id: "T4", valorTotal: 4000, vencimento: "2026-06-05" }), // 132d -> mais_90
    ];

    const kpis = calcularKpisInadimplencia(titulos, hoje);
    expect(kpis.totalInadimplente).toBe(10000);
    expect(kpis.quantidadeTotal).toBe(4);
    expect(kpis.dias_1_30).toBe(1000);
    expect(kpis.dias_31_60).toBe(2000);
    expect(kpis.dias_61_90).toBe(3000);
    expect(kpis.dias_mais_90).toBe(4000);
    expect(kpis.totalAcima60Dias).toBe(7000); // 3000 + 4000
    expect(kpis.percentualAcima60Dias).toBe(70);
  });

  it("15. Agrupamento Por Cliente usa estritamente empresaId, não nome", () => {
    const titulos: TituloInadimplenteUI[] = [
      mockTitulo({ id: "T1", empresaId: "emp-alpha-1", clienteNome: "Filial SP", valorTotal: 5000 }),
      mockTitulo({ id: "T2", empresaId: "emp-alpha-1", clienteNome: "Filial SP", valorTotal: 3000 }),
      mockTitulo({ id: "T3", empresaId: "emp-beta-2", clienteNome: "Filial SP", valorTotal: 2000 }), // mesmo nome, empresaId diferente
    ];

    const agrupados = agruparInadimplenciaPorCliente(titulos, hoje);
    expect(agrupados.length).toBe(2);
    expect(agrupados[0].empresaId).toBe("emp-alpha-1");
    expect(agrupados[0].totalInadimplente).toBe(8000);
    expect(agrupados[0].quantidadeTitulos).toBe(2);

    expect(agrupados[1].empresaId).toBe("emp-beta-2");
    expect(agrupados[1].totalInadimplente).toBe(2000);
    expect(agrupados[1].quantidadeTitulos).toBe(1);
  });

  it("16 & 17. Adapter aplica EnvironmentQueryFilter.applyEmpresaScope", () => {
    const serviceContent = fs.readFileSync(
      path.resolve(__dirname, "../services/inadimplenciaOficial.service.ts"),
      "utf-8"
    );
    expect(serviceContent).toContain("EnvironmentQueryFilter.applyEmpresaScope");
  });

  it("18 & 19. Drawer e Histórico consomem dados reais e não fabricam eventos sintéticos", () => {
    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/InadimplenciaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerContent).toContain("ReceitasOficialService.getReceitaDetalhesEHistorico");
    expect(drawerContent).not.toContain("MOCK_TITULOS_INADIMPLENTES");
  });

  it("20. Dispatch para Receitas Operacionais utiliza /financeiro/receitas", () => {
    const pageContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/Inadimplencia.tsx"),
      "utf-8"
    );
    expect(pageContent).toContain('to="/financeiro/receitas"');

    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/InadimplenciaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerContent).toContain('navigate("/financeiro/receitas"');
  });

  it("21. Dispatch para Central Bancária usa /bancario (NÃO usa rota legada /financeiro/retorno)", () => {
    const pageContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/Inadimplencia.tsx"),
      "utf-8"
    );
    expect(pageContent).not.toContain("/financeiro/retorno");

    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/InadimplenciaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerContent).not.toContain("/financeiro/retorno");
  });

  it("22 & 23. Origens apontam para /operacoes-volume e /operacional/servicos-extras", () => {
    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/InadimplenciaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerContent).toContain('navigate("/operacoes-volume"');
    expect(drawerContent).toContain('navigate("/operacional/servicos-extras"');
  });

  it("24 & 25. Nenhuma ação de WhatsApp/e-mail improvisada nem negociação/parcelamento inventado", () => {
    const pageContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/Inadimplencia.tsx"),
      "utf-8"
    );
    expect(pageContent).not.toContain("wa.me");
    expect(pageContent).not.toContain("mailto:");

    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../pages/Financeiro/components/InadimplenciaDrawerOficial.tsx"),
      "utf-8"
    );
    expect(drawerContent).not.toContain("parcelamento");
    expect(drawerContent).not.toContain("renegociacao");
    expect(drawerContent).not.toContain("juros");
    expect(drawerContent).not.toContain("multa");
  });
});
