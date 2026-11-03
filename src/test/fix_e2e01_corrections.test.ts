import { describe, it, expect } from "vitest";
import {
  getRouteAccessRule,
  isRouteForbiddenForRole,
  canAccessModule,
  buildPresetPermissions,
  normalizeRole,
} from "@/lib/access-control";

describe("FIX E2E-01 — Correções Pós-Auditoria Visual", () => {
  describe("Correção 1: P1 | Bloqueio de Acesso às Configurações (/configuracoes)", () => {
    it("1.1 Rota /configuracoes está mapeada para o módulo 'governanca'", () => {
      const rule = getRouteAccessRule("/configuracoes");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("governanca");
    });

    it("1.2 Perfil RH é explicitamente bloqueado de acessar /configuracoes", () => {
      const isForbidden = isRouteForbiddenForRole("rh", "/configuracoes");
      expect(isForbidden).toBe(true);
    });

    it("1.3 Perfil Encarregado é explicitamente bloqueado de acessar /configuracoes", () => {
      const isForbidden = isRouteForbiddenForRole("encarregado", "/configuracoes");
      expect(isForbidden).toBe(true);
    });

    it("1.4 Perfil Admin tem permissão para acessar /configuracoes", () => {
      const isForbidden = isRouteForbiddenForRole("admin", "/configuracoes");
      expect(isForbidden).toBe(false);

      const adminPerms = buildPresetPermissions("admin");
      expect(canAccessModule(adminPerms, "governanca", "ver")).toBe(true);
    });

    it("1.5 Perfil RH não possui permissão no módulo governanca", () => {
      const rhPerms = buildPresetPermissions("rh");
      expect(canAccessModule(rhPerms, "governanca", "ver")).toBe(false);
    });

    it("1.6 Rotas administrativas adicionais estão protegidas (/diag-tenant, /operacional/pipeline)", () => {
      const diagRule = getRouteAccessRule("/diag-tenant");
      expect(diagRule?.module).toBe("governanca");

      const pipeRule = getRouteAccessRule("/operacional/pipeline");
      expect(pipeRule?.module).toBe("central_operacional");
    });
  });

  describe("Correção 2: P2 | Acesso Seguro do RH a Colaboradores (/colaboradores)", () => {
    it("2.1 Rota /colaboradores autoriza explicitamente as roles 'admin' e 'rh'", () => {
      const rule = getRouteAccessRule("/colaboradores");
      expect(rule).toBeDefined();
      expect(rule?.allowedRoles).toContain("admin");
      expect(rule?.allowedRoles).toContain("rh");
    });

    it("2.2 Rota /colaboradores NÃO autoriza role 'encarregado'", () => {
      const rule = getRouteAccessRule("/colaboradores");
      expect(rule?.allowedRoles).not.toContain("encarregado");
    });

    it("2.3 Central de Cadastros (/cadastros) permanece restrita e NÃO concede acesso irrestrito ao RH", () => {
      const rule = getRouteAccessRule("/cadastros");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("central_de_cadastros");
      expect(rule?.allowedRoles).toBeUndefined();

      const rhPerms = buildPresetPermissions("rh");
      expect(canAccessModule(rhPerms, "central_de_cadastros", "ver")).toBe(false);
    });
  });

  describe("Correção 3: P2 | Paridade de Formulário entre Admin e Encarregado", () => {
    it("3.1 Role normalization diferencia corretamente 'admin' e 'encarregado'", () => {
      expect(normalizeRole("admin")).toBe("admin");
      expect(normalizeRole("encarregado")).toBe("encarregado");
      expect(normalizeRole("rh")).toBe("rh");
    });
  });
});

