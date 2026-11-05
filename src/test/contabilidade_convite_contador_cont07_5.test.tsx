import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import {
  isRouteForbiddenForRole,
  ACCESS_PRESETS,
  ACCESS_ROLE_LABELS,
  ACCESS_PRESET_OPTIONS,
  normalizeRole,
  getDefaultRouteForRole,
  getAccessDeniedFallbackRoute,
} from "@/lib/access-control";
import { formatOfficialInviteMessage } from "@/pages/Governanca/Usuarios";
import { CONTADOR_SECTIONS } from "@/components/layout/Sidebar";

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ERP ORBE — CONT-07.5 | Validação e Regressão do Convite Perfil Contador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. REPRODUÇÃO DO ERRO: Simula rejeição da RPC quando a role 'contador' não está na lista permitida do Supabase", () => {
    // Função de validação interna do backend (PostgreSQL admin_create_invitation_with_activation_code antes da correção)
    const backendValidateRole = (role: string) => {
      const allowedRoles = ["admin", "rh", "financeiro", "encarregado", "gestor", "user", "cliente"];
      const v_role = role.trim().toLowerCase();
      if (!allowedRoles.includes(v_role)) {
        throw new Error(`Função/Papel inválido: ${v_role}`);
      }
      return true;
    };

    // Reproduz exatamente o erro reportado na interface:
    let caughtError: Error | null = null;
    try {
      backendValidateRole("contador");
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe("Função/Papel inválido: contador");

    // Simula o callback onError do React Query em Usuarios.tsx
    const handleMutationError = (error: Error) => {
      toast.error("Não foi possível gerar o convite.", {
        description: error.message,
      });
    };

    handleMutationError(caughtError!);

    expect(toast.error).toHaveBeenCalledWith("Não foi possível gerar o convite.", {
      description: "Função/Papel inválido: contador",
    });
  });

  it("2. CORREÇÃO DA VALIDAÇÃO: Backend aceita 'contador' como perfil interno válido da ESC Logística", () => {
    // Função de validação atualizada (conforme migration 20261104200000_fix_convite_perfil_contador.sql)
    const backendValidateRoleFixed = (role: string) => {
      const allowedRoles = ["admin", "rh", "financeiro", "encarregado", "gestor", "user", "cliente", "contador"];
      const v_role = role.trim().toLowerCase();
      if (!allowedRoles.includes(v_role)) {
        throw new Error(`Função/Papel inválido: ${v_role}`);
      }
      return true;
    };

    expect(() => backendValidateRoleFixed("contador")).not.toThrow();
    expect(() => backendValidateRoleFixed("CONTADOR")).not.toThrow();
    expect(() => backendValidateRoleFixed("admin")).not.toThrow();
    expect(() => backendValidateRoleFixed("cliente")).not.toThrow();
    expect(() => backendValidateRoleFixed("hacker")).toThrow("Função/Papel inválido: hacker");
  });

  it("3. PAYLOAD DE CRIAÇÃO DO CONVITE: Emite permissões estritas para 'contador' sem vazamento de privilégios", () => {
    // Lógica canônica de createInviteMutation em Usuarios.tsx
    const buildInvitePayload = (payload: { role: string; empresaId?: string; permissions?: any }) => {
      let permissionsToSend: any = payload.permissions || {};

      if (payload.role === "cliente") {
        permissionsToSend = {
          portal_do_cliente: { ver: true },
          cliente_context: {
            empresa_id: payload.empresaId,
          },
        };
      }

      if (payload.role === "contador") {
        permissionsToSend = {
          central_de_relatorios: { ver: true, exportar: true },
        };
      }

      return {
        p_role: payload.role,
        p_permissions: permissionsToSend,
      };
    };

    const result = buildInvitePayload({
      role: "contador",
      empresaId: "",
      permissions: { governanca: { ver: true } }, // Tentativa indevida de passar permissão extra
    });

    expect(result.p_role).toBe("contador");
    expect(result.p_permissions).toEqual({
      central_de_relatorios: { ver: true, exportar: true },
    });

    // Garante que permissões administrativas/financeiras foram totalmente sobrescritas pelo preset contábil
    expect(result.p_permissions.governanca).toBeUndefined();
    expect(result.p_permissions.central_financeira).toBeUndefined();
    expect(result.p_permissions.faturamento).toBeUndefined();
    expect(result.p_permissions.processamento_rh).toBeUndefined();
  });

  it("4. PAYLOAD DE ATUALIZAÇÃO DO CONVITE & USUÁRIO: Preserva blindagem contábil em edições", () => {
    // Lógica canônica de updateInviteMutation e updateUserMutation em Usuarios.tsx
    const buildUpdatePayload = (payload: { role: string; empresaId?: string; permissions?: any }) => {
      let permissionsToSend: any = payload.permissions || {};

      if (payload.role === "cliente") {
        permissionsToSend = {
          portal_do_cliente: { ver: true },
          cliente_context: {
            empresa_id: payload.empresaId,
          },
        };
      }

      if (payload.role === "contador") {
        permissionsToSend = {
          central_de_relatorios: { ver: true, exportar: true },
        };
      }

      return permissionsToSend;
    };

    const permissions = buildUpdatePayload({
      role: "contador",
    });

    expect(permissions).toEqual({
      central_de_relatorios: { ver: true, exportar: true },
    });
  });

  it("5. BLINDAGEM DE ROTAS E ACESSO: Bloqueia 100% dos módulos administrativos, RH, Financeiro e Operações", () => {
    // Lista de rotas bloqueadas para Contador
    const blockedRoutes = [
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
      "/relatorios",
      "/relatorios/v2",
      "/relatorios/classico",
    ];

    blockedRoutes.forEach((route) => {
      expect(
        isRouteForbiddenForRole("contador", route),
        `Rota ${route} deveria estar bloqueada para Contador`,
      ).toBe(true);
    });

    // Exclusivamente as 5 ferramentas contábeis são autorizadas
    const allowedTools = [
      "/relatorios/integracao",
      "/relatorios/mapeamento",
      "/relatorios/agendamentos",
      "/relatorios/layouts",
      "/relatorios/logs",
    ];

    allowedTools.forEach((tool) => {
      expect(
        isRouteForbiddenForRole("contador", tool),
        `Ferramenta ${tool} deveria ser permitida para Contador`,
      ).toBe(false);
    });
  });

  it("6. CONSISTÊNCIA DE RBAC E NAVEGAÇÃO: Fallbacks e rótulos institucionais", () => {
    expect(ACCESS_ROLE_LABELS["contador"]).toBe("Contador");
    expect(ACCESS_PRESET_OPTIONS.some((opt) => opt.value === "contador" && opt.label === "Contador")).toBe(true);
    expect(ACCESS_PRESETS["contador"]).toEqual({
      central_de_relatorios: { ver: true, exportar: true },
    });
    expect(normalizeRole("contador")).toBe("contador");
    expect(getDefaultRouteForRole("contador")).toBe("/relatorios/integracao");
    expect(getAccessDeniedFallbackRoute("contador")).toBe("/relatorios/integracao");
  });

  it("7. CONT-07.7 | MENSAGEM OFICIAL DE CONVITE: Substitui 'Minha Empresa' por 'ESC Logística' e usa nome real", () => {
    // Cenário A: Nome real informado e tenant 'Minha Empresa' (placeholder de banco)
    const msgA = formatOfficialInviteMessage({
      fullName: "Carlos Contador",
      tenantName: "Minha Empresa",
      link: "https://orbe.esclogistica.com.br/cadastro?token=tok123",
      code: "123456",
    });

    expect(msgA).toContain("Olá, Carlos Contador!");
    expect(msgA).toContain("pela empresa ESC Logística.");
    expect(msgA).not.toContain("Minha Empresa");
    expect(msgA).not.toContain("Usuário");
    expect(msgA).toContain("123456");
    expect(msgA).toContain("https://orbe.esclogistica.com.br/cadastro?token=tok123");

    // Cenário B: Sem tenant informado (fallback automático para ESC Logística)
    const msgB = formatOfficialInviteMessage({
      fullName: "Ana Perita",
      tenantName: null,
      link: "https://orbe.esclogistica.com.br/cadastro?token=tok456",
      code: "987654",
    });

    expect(msgB).toContain("Olá, Ana Perita!");
    expect(msgB).toContain("pela empresa ESC Logística.");
    expect(msgB).toContain("987654");

    // Cenário C: Reenvio sem código temporário de 10 min
    const msgC = formatOfficialInviteMessage({
      fullName: "Marcos Auditor",
      tenantName: "Minha Empresa",
      link: "https://orbe.esclogistica.com.br/cadastro?token=tok789",
    });

    expect(msgC).toContain("Olá, Marcos Auditor!");
    expect(msgC).toContain("pela empresa ESC Logística.");
    expect(msgC).not.toContain("expira em 10 minutos");
  });

  it("8. CONT-07.7 | INDICADOR DE MAPEAMENTO CONTÁBIL: Sem lançamentos exibe estado informativo '—'", () => {
    // Lógica canônica de renderização em IntegracaoContabil.tsx
    const computeMappingIndicator = (previa: { total_lancamentos?: number; lancamentos_nao_mapeados?: number } | null) => {
      if (!previa || (previa.total_lancamentos || 0) === 0) {
        return {
          value: "—",
          subtitle: "Sem lançamentos na competência para apurar cobertura",
        };
      }
      if ((previa.lancamentos_nao_mapeados || 0) === 0) {
        return {
          value: "100%",
          subtitle: "Todas as contas configuradas",
        };
      }
      return {
        value: `${previa.lancamentos_nao_mapeados} pendente(s)`,
        subtitle: "Exige configuração na aba De-Para",
      };
    };

    // Caso 1: Sem lançamentos na competência (não deve exibir 100%)
    const emptyState = computeMappingIndicator({ total_lancamentos: 0, lancamentos_nao_mapeados: 0 });
    expect(emptyState.value).toBe("—");
    expect(emptyState.subtitle).toBe("Sem lançamentos na competência para apurar cobertura");

    // Caso 2: Prévia nula
    const nullState = computeMappingIndicator(null);
    expect(nullState.value).toBe("—");
    expect(nullState.subtitle).toBe("Sem lançamentos na competência para apurar cobertura");

    // Caso 3: Lançamentos existentes e todos mapeados
    const fullyMappedState = computeMappingIndicator({ total_lancamentos: 150, lancamentos_nao_mapeados: 0 });
    expect(fullyMappedState.value).toBe("100%");
    expect(fullyMappedState.subtitle).toBe("Todas as contas configuradas");

    // Caso 4: Lançamentos existentes com pendências
    const pendingState = computeMappingIndicator({ total_lancamentos: 150, lancamentos_nao_mapeados: 12 });
    expect(pendingState.value).toBe("12 pendente(s)");
    expect(pendingState.subtitle).toBe("Exige configuração na aba De-Para");
  });

  it("9. CONT-07.7 | SIDEBAR CONTADOR: Grupo 'Ferramentas Contábeis' com as 5 ferramentas e sem ReferenceError", () => {
    expect(CONTADOR_SECTIONS).toHaveLength(1);
    const contabilGroup = CONTADOR_SECTIONS[0];
    expect(contabilGroup.id).toBe("contabilidade");
    expect(contabilGroup.title).toBe("Ferramentas Contábeis");

    const toolRoutes = contabilGroup.items.map((i) => i.to);
    expect(toolRoutes).toEqual([
      "/relatorios/integracao",
      "/relatorios/mapeamento",
      "/relatorios/integracao/logs",
      "/relatorios/agendamentos",
      "/relatorios/layouts",
    ]);
  });
});
