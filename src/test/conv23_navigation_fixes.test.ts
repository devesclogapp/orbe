import { describe, it, expect } from "vitest";
import { getRouteMeta, getRouteLabel, getBreadcrumbs, getSectionLabel, getBackTarget } from "@/components/layout/navigationMeta";
import { RELATORIOS_CATALOGO_OFICIAL } from "@/services/adapters/relatoriosOficialAdapter";

describe("CONV-23 — ETAPA 02: Validação das FIXs de Navegação e Breadcrumbs", () => {
  it("1. Resolução de breadcrumb e label para rotas oficiais de relatórios (/relatorios/:reportId)", () => {
    // R01
    const r01Meta = getRouteMeta("/relatorios/r01-operacoes-volume");
    expect(r01Meta).toBeDefined();
    expect(r01Meta?.section).toBe("Cadastros & Sistema");
    expect(r01Meta?.parentPath).toBe("/relatorios");

    const r01Label = getRouteLabel("/relatorios/r01-operacoes-volume");
    expect(r01Label).toBe("Analítico de Operações por Volume");

    const r01Section = getSectionLabel("/relatorios/r01-operacoes-volume");
    expect(r01Section).toBe("Cadastros & Sistema");

    const r01Back = getBackTarget("/relatorios/r01-operacoes-volume");
    expect(r01Back).toBe("/relatorios");

    // Breadcrumbs sem título explícito (deve usar catálogo oficial)
    const breadcrumbsAuto = getBreadcrumbs("/relatorios/r01-operacoes-volume");
    expect(breadcrumbsAuto).toHaveLength(2);
    expect(breadcrumbsAuto[0]).toEqual({ label: "Central de Relatórios", path: "/relatorios" });
    expect(breadcrumbsAuto[1]).toEqual({ label: "Analítico de Operações por Volume", path: undefined });

    // Breadcrumbs com título customizado vindo do AppShell
    const breadcrumbsExplicit = getBreadcrumbs("/relatorios/r01-operacoes-volume", "R01 — Operações por Volume (Custom)");
    expect(breadcrumbsExplicit).toHaveLength(2);
    expect(breadcrumbsExplicit[0]).toEqual({ label: "Central de Relatórios", path: "/relatorios" });
    expect(breadcrumbsExplicit[1]).toEqual({ label: "R01 — Operações por Volume (Custom)", path: undefined });
  });

  it("2. Valida todos os cadernos da família oficial R01 a R07 sem títulos fictícios", () => {
    for (const report of RELATORIOS_CATALOGO_OFICIAL) {
      const path = `/relatorios/${report.id}`;
      const label = getRouteLabel(path);
      expect(label).toBe(report.title);

      const crumbs = getBreadcrumbs(path);
      expect(crumbs).toHaveLength(2);
      expect(crumbs[0].label).toBe("Central de Relatórios");
      expect(crumbs[0].path).toBe("/relatorios");
      expect(crumbs[1].label).toBe(report.title);
      expect(crumbs[1].path).toBeUndefined();
    }
  });

  it("3. Preserva comportamento das demais rotas transversais", () => {
    // Dashboard
    const dashCrumbs = getBreadcrumbs("/operacional/dashboard");
    expect(dashCrumbs[0].label).toBe("Dashboard Executivo");

    // Operações por Volume
    const opCrumbs = getBreadcrumbs("/operacoes-volume");
    expect(opCrumbs[0].label).toBe("Operações por Volume");

    // Ponto & Jornadas CLT
    const cltCrumbs = getBreadcrumbs("/clt/pontos");
    expect(cltCrumbs[0].label).toBe("Ponto & Jornadas CLT");

    // Central Bancária
    const bancarioCrumbs = getBreadcrumbs("/bancario");
    expect(bancarioCrumbs[0].label).toBe("Central Bancária");
  });
});
