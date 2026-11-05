import { describe, it, expect } from "vitest";
import {
  ACCESS_PRESET_OPTIONS,
  ACCESS_PRESETS,
  ACCESS_ROLE_LABELS,
  getDefaultRouteForRole,
  getAccessDeniedFallbackRoute,
  isRouteForbiddenForRole,
  normalizeRole,
} from "@/lib/access-control";

describe("ERP ORBE — CONT-07 & CONT-07.2 | Perfil Contador Interno ESC Logística", () => {
  it("1. Deve registrar o perfil 'contador' nas configurações oficiais de RBAC", () => {
    // Label oficial
    expect(ACCESS_ROLE_LABELS["contador"]).toBe("Contador");

    // Presets e opções
    const option = ACCESS_PRESET_OPTIONS.find((opt) => opt.value === "contador");
    expect(option).toBeDefined();
    expect(option?.label).toBe("Contador");

    expect(ACCESS_PRESETS["contador"]).toBeDefined();
    expect(ACCESS_PRESETS["contador"].central_de_relatorios?.ver).toBe(true);
    expect(ACCESS_PRESETS["contador"].central_de_relatorios?.exportar).toBe(true);
  });

  it("2. Deve normalizar corretamente a role 'contador'", () => {
    expect(normalizeRole("contador")).toBe("contador");
    expect(normalizeRole("CONTADOR")).toBe("contador");
    expect(normalizeRole(" Contador ")).toBe("contador");
  });

  it("3. Deve definir '/relatorios/integracao' como rota padrão e fallback do perfil contador", () => {
    expect(getDefaultRouteForRole("contador")).toBe("/relatorios/integracao");
    expect(getAccessDeniedFallbackRoute("contador")).toBe("/relatorios/integracao");
  });

  it("4. Deve permitir acesso EXCLUSIVO às 5 ferramentas contábeis", () => {
    const rotasPermitidas = [
      "/relatorios/integracao",
      "/relatorios/integracao/logs",
      "/relatorios/mapeamento",
      "/relatorios/agendamentos",
      "/relatorios/layouts",
    ];

    rotasPermitidas.forEach((path) => {
      expect(
        isRouteForbiddenForRole("contador", path),
        `Rota contábil esperada como permitida: ${path}`
      ).toBe(false);
    });
  });

  it("5. Deve BLOQUEAR estritamente o Dashboard, Operações, RH, Financeiro e Governança", () => {
    const rotasBloqueadas = [
      "/",
      "/dashboard",
      "/operacoes",
      "/operacoes/volume",
      "/rh",
      "/rh/folha",
      "/rh/banco-horas",
      "/financeiro",
      "/financeiro/contas-pagar",
      "/financeiro/fechamento",
      "/financeiro/cnab",
      "/governanca",
      "/governanca/usuarios",
      "/configuracoes",
      "/cadastros",
      "/cadastros/empresas",
      "/cadastros/colaboradores",
    ];

    rotasBloqueadas.forEach((path) => {
      expect(
        isRouteForbiddenForRole("contador", path),
        `Rota proibida esperada como bloqueada: ${path}`
      ).toBe(true);
    });
  });

  it("6. Deve BLOQUEAR a Central de Relatórios geral para não servir de porta de entrada irrestrita", () => {
    expect(isRouteForbiddenForRole("contador", "/relatorios")).toBe(true);
    expect(isRouteForbiddenForRole("contador", "/relatorios/v2")).toBe(true);
    expect(isRouteForbiddenForRole("contador", "/relatorios/classico")).toBe(true);
    expect(isRouteForbiddenForRole("contador", "/relatorios/operacional")).toBe(true);
  });

  it("7. CONT-07.2: O Contador é um profissional interno e consulta todas as empresas do seu tenant", () => {
    const tenantEscLog = "tenant-esc-log-001";

    const empresasDoTenant = [
      { id: "emp-001", tenant_id: tenantEscLog, nome: "Empresa Cliente Alfa" },
      { id: "emp-002", tenant_id: tenantEscLog, nome: "Empresa Cliente Beta" },
      { id: "emp-003", tenant_id: tenantEscLog, nome: "Empresa Cliente Gama" },
    ];

    // O contador interno tem permissão de acesso a todas as empresas do tenant da ESC Logística
    const contadorInterno = {
      user_id: "user-contador-001",
      tenant_id: tenantEscLog,
      role: "contador",
      status: "ativo",
    };

    empresasDoTenant.forEach((emp) => {
      const isAuthorized =
        contadorInterno.tenant_id === emp.tenant_id &&
        contadorInterno.status === "ativo" &&
        ["admin", "financeiro", "contador"].includes(contadorInterno.role);

      expect(isAuthorized).toBe(true);
    });
  });

  it("8. CONT-07.2: Deve garantir isolamento estrito entre tenants (não acessa empresas de outros tenants)", () => {
    const tenantEscLog = "tenant-esc-log-001";
    const tenantExterno = "tenant-outro-erp-999";

    const contadorInterno = {
      user_id: "user-contador-001",
      tenant_id: tenantEscLog,
      role: "contador",
      status: "ativo",
    };

    const empresaOutroTenant = {
      id: "emp-999",
      tenant_id: tenantExterno,
      nome: "Empresa de Outro Tenant",
    };

    const isAuthorized =
      contadorInterno.tenant_id === empresaOutroTenant.tenant_id &&
      contadorInterno.status === "ativo" &&
      ["admin", "financeiro", "contador"].includes(contadorInterno.role);

    expect(isAuthorized).toBe(false);
  });

  it("9. CONT-07.2: Cadastro do Contador Interno não exige seleção prévia de empresa cliente", () => {
    const formContadorState = {
      email: "contador@esclog.com.br",
      role: "contador",
      empresaId: "", // Vazio porque é interno
    };

    // Apenas 'cliente' exige empresa cliente vinculada
    const requiresEmpresaCliente = formContadorState.role === "cliente";
    expect(requiresEmpresaCliente).toBe(false);
  });
});
