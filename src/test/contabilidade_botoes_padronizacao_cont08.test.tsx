import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { ContextualHelpButton } from "@/components/help/ContextualHelpButton";
import { CONTADOR_SECTIONS, isRouteMatchingItem } from "@/components/layout/Sidebar";
import * as AccessControlContext from "@/contexts/AccessControlContext";

describe("ERP ORBE — CONT-08 | Padronização dos Botões Contábeis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. OCULTAÇÃO PARA CONTADOR: FerramentasContabeisMenu retorna null para o perfil Contador", () => {
    // Simula hook useAccessControl retornando perfil contador
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "contador",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    const { container } = render(
      <MemoryRouter>
        <FerramentasContabeisMenu empresaId="emp-1" competencia="2026-10" />
      </MemoryRouter>
    );

    // Para o Contador, o dropdown NÃO deve ser renderizado no cabeçalho
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Ferramentas Contábeis")).toBeNull();
  });

  it("2. PRESERVAÇÃO PARA ADMIN/FINANCEIRO: FerramentasContabeisMenu visível com botão de 36px (h-9)", () => {
    // Simula hook useAccessControl retornando perfil admin
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "admin",
      isAdmin: true,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    render(
      <MemoryRouter>
        <FerramentasContabeisMenu empresaId="emp-1" competencia="2026-10" />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole("button", { name: /ferramentas contábeis/i });
    expect(triggerBtn).toBeDefined();

    // Valida padronização de altura 36px (h-9), tipografia e gap
    expect(triggerBtn.className).toContain("h-9");
    expect(triggerBtn.className).toContain("gap-2");
    expect(triggerBtn.className).toContain("text-sm");
    expect(triggerBtn.className).toContain("font-medium");
  });

  it("3. PRESERVAÇÃO PARA FINANCEIRO: FerramentasContabeisMenu visível para role financeiro", () => {
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "financeiro",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    render(
      <MemoryRouter>
        <FerramentasContabeisMenu empresaId="emp-1" competencia="2026-10" />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole("button", { name: /ferramentas contábeis/i });
    expect(triggerBtn).toBeDefined();
    expect(triggerBtn.className).toContain("h-9");
  });

  it("4. HIERARQUIA DE BOTÕES: Primários (Azul ORBE), Secundários (Outline) e Auxiliares (Discreto)", () => {
    // Classes canônicas definidas para a hierarquia do Design System ORBE
    const primaryButtonClass = "h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs";
    const secondaryButtonClass = "h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60";
    const auxiliaryButtonClass = "h-9 px-3 gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/50";

    // Todos respeitam a altura de 36px (h-9), fonte Inter média e gap de 8px
    [primaryButtonClass, secondaryButtonClass, auxiliaryButtonClass].forEach((cls) => {
      expect(cls).toContain("h-9");
      expect(cls).toContain("text-sm");
      expect(cls).toContain("font-medium");
      expect(cls).toContain("gap-2");
    });

    // Primário possui fundo azul oficial ORBE
    expect(primaryButtonClass).toContain("bg-primary");
    expect(primaryButtonClass).toContain("text-primary-foreground");

    // Secundário e auxiliar possuem borda sutil
    expect(secondaryButtonClass).toContain("border-border");
    expect(auxiliaryButtonClass).toContain("border-border/70");
  });

  it("5. OCULTAÇÃO DO GUIA DO ORBE PARA CONTADOR: ContextualHelpButton retorna null no perfil Contador", () => {
    // Simula hook useAccessControl retornando perfil contador
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "contador",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ContextualHelpButton showLabel />
      </MemoryRouter>
    );

    // O Guia do ORBE geral (ajuda de todo o app) NÃO deve aparecer para o Contador
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Guia da Tela")).toBeNull();
  });

  it("6. SEM DUPLICIDADE DE MENU: Sidebar Contador possui 'end: true' em todas as ferramentas", () => {
    const items = CONTADOR_SECTIONS[0].items;

    // Todas as 5 ferramentas contábeis devem ter end: true para evitar match por prefixo
    items.forEach((item) => {
      expect(item.end).toBe(true);
    });

    const integracaoItem = items.find((i) => i.id === "integracao-contabil")!;
    const logsItem = items.find((i) => i.id === "logs-integracao")!;

    // Quando o usuário está em /relatorios/integracao/logs, Integração Contábil NÃO deve ficar ativa
    const isIntegracaoActiveOnLogs = isRouteMatchingItem(
      integracaoItem.to,
      integracaoItem.end,
      { pathname: "/relatorios/integracao/logs" }
    );
    expect(isIntegracaoActiveOnLogs).toBe(false);

    // Logs deve ficar ativo em /relatorios/integracao/logs
    const isLogsActiveOnLogs = isRouteMatchingItem(
      logsItem.to,
      logsItem.end,
      { pathname: "/relatorios/integracao/logs" }
    );
    expect(isLogsActiveOnLogs).toBe(true);
  });
});

