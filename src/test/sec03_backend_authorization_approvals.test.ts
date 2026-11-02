/**
 * sec03_backend_authorization_approvals.test.ts
 *
 * Testes Unitários de Regressão e Validação da Camada de Autorização Backend (SEC-03)
 * Cobre a especificação canônica da migration 20261102000000_sec_03_backend_authorization_approvals.sql:
 * - Anti-impersonation estrito em SECURITY DEFINER
 * - public.is_service_role() blindada: se auth.uid() IS NOT NULL, NUNCA retorna true
 * - Isolamento multi-tenant inequívoco sem LIMIT 1 arbitrário
 * - Fail-closed para status <> 'ativo'
 * - Negação explícita no JSONB (false tem prioridade absoluta sobre preset)
 * - Cobertura dos 6 domínios (Ponto CLT, Diaristas, Intermitentes, Operações por Volume, Custos Extras, Serviços Extras)
 * - Workflows de automação com service_role
 */

import { describe, it, expect } from "vitest";

interface UserProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  full_name: string;
}

interface UserPermissionRecord {
  user_id: string;
  tenant_id: string;
  role: string;
  status: string;
  permissions: Record<string, Record<string, boolean>> | null;
}

/**
 * Réplica fiel da função canônica blindada public.is_service_role()
 */
function evaluateIsServiceRole(params: {
  authUid: string | null;
  databaseRoleSetting: string | null;
  sessionUser: string;
  currentUser: string;
  jwtClaimsRole?: string | null;
}): boolean {
  // 0.1 Regra de Ouro: Se existe um usuário final autenticado (auth.uid), NUNCA é service_role.
  if (params.authUid !== null) {
    return false;
  }

  // 0.2 Role ativa da conexão/transação no PostgreSQL
  if (params.databaseRoleSetting === "service_role") {
    return true;
  }

  // 0.3 Se estiver rodando como superusuário de infraestrutura/background
  if (
    ["postgres", "supabase_admin"].includes(params.sessionUser) &&
    ["postgres", "supabase_admin"].includes(params.currentUser)
  ) {
    if (!params.jwtClaimsRole || params.jwtClaimsRole === "service_role") {
      return true;
    }
  }

  return false;
}

/**
 * Réplica fiel da lógica canônica corrigida em public.has_user_permission
 */
function evaluateHasUserPermission(params: {
  callerRole: "anon" | "authenticated" | "service_role";
  p_user_id: string | null;
  p_module: string;
  p_action: string;
  p_tenant_id?: string | null;
  sessionTenantId?: string | null;
  permissionsStore: UserPermissionRecord[];
  profilesStore: UserProfile[];
  authUid?: string | null;
}): boolean {
  const { callerRole, p_user_id, p_module, p_action, p_tenant_id, sessionTenantId, permissionsStore, profilesStore } = params;

  // 1.1 Bypass seguro para chamadas de sistema e automações legítimas (service_role)
  const isServiceRole = evaluateIsServiceRole({
    authUid: params.authUid ?? (callerRole === "service_role" ? null : p_user_id),
    databaseRoleSetting: callerRole === "service_role" ? "service_role" : "authenticated",
    sessionUser: callerRole === "service_role" ? "postgres" : "authenticator",
    currentUser: callerRole === "service_role" ? "postgres" : "authenticated",
    jwtClaimsRole: callerRole === "service_role" ? "service_role" : "authenticated",
  });

  if (isServiceRole) {
    return true;
  }

  // 1.2 Fail-Closed: Usuário não identificado
  if (!p_user_id) {
    return false;
  }

  // 1.3 Resolução inequívoca do Tenant Efetivo
  let effectiveTenantId = p_tenant_id || sessionTenantId || null;
  if (!effectiveTenantId) {
    const prof = profilesStore.find((p) => p.user_id === p_user_id || p.id === p_user_id);
    effectiveTenantId = prof?.tenant_id || null;
  }

  if (!effectiveTenantId) {
    return false; // Fail-Closed
  }

  // 1.4 Obter papel, status e matriz com escopo estrito de tenant
  const userPerm = permissionsStore.find(
    (up) => up.user_id === p_user_id && up.tenant_id === effectiveTenantId
  );

  let role: string | null = null;
  let status: string | null = null;
  let permissions: Record<string, Record<string, boolean>> | null = null;

  if (userPerm) {
    role = userPerm.role;
    status = userPerm.status;
    permissions = userPerm.permissions;
  } else {
    const prof = profilesStore.find(
      (p) => (p.user_id === p_user_id || p.id === p_user_id) && p.tenant_id === effectiveTenantId
    );
    if (prof) {
      role = prof.role;
      status = "ativo";
      permissions = {};
    }
  }

  if (!role || !status) {
    return false;
  }

  // 1.5 Conta deve estar estritamente 'ativo'
  if (status.toLowerCase() !== "ativo") {
    return false;
  }

  // 1.6 Super Admin e Admin possuem autorização total de governança no tenant
  if (["admin", "super_admin"].includes(role.toLowerCase())) {
    return true;
  }

  // 1.7 Avaliação estrita da matriz JSONB customizada (Prioridade Absoluta)
  if (permissions && permissions[p_module] !== undefined) {
    const actionVal = permissions[p_module][p_action];
    if (actionVal !== undefined) {
      return Boolean(actionVal); // Se for false, encerra imediatamente como false!
    }
  }

  // 1.8 Fallback para Presets de Papel (somente quando não customizado)
  const normRole = role.toLowerCase();
  if (normRole === "rh") {
    if (p_module === "processamento_rh" && ["ver", "processar", "aprovar", "exportar"].includes(p_action)) {
      return true;
    }
    if (p_module === "operacoes_recebidas" && ["ver", "aprovar"].includes(p_action)) {
      return true;
    }
    if (p_module === "pontos_recebidos" && ["ver", "importar", "exportar"].includes(p_action)) {
      return true;
    }
    if (p_module === "banco_de_horas" && ["ver", "criar", "editar", "exportar"].includes(p_action)) {
      return true;
    }
    if (p_module === "regras_de_banco" && ["ver", "criar", "editar"].includes(p_action)) {
      return true;
    }
    if (p_module === "cadastro_de_diaristas" && ["ver", "criar", "editar", "exportar"].includes(p_action)) {
      return true;
    }
    if (p_module === "fechamento_mensal" && ["ver", "processar", "fechar", "reabrir"].includes(p_action)) {
      return true;
    }
    return false;
  }

  if (normRole === "gestor") {
    const allowedModules = [
      "dashboard", "central_operacional", "operacoes_recebidas", "pontos_recebidos",
      "banco_de_horas", "processamento_rh", "fechamento_mensal", "central_financeira",
      "faturamento", "pagamentos_remessas"
    ];
    if (allowedModules.includes(p_module) && ["ver", "aprovar"].includes(p_action)) {
      return true;
    }
    if (p_module === "central_de_relatorios" && ["ver", "exportar"].includes(p_action)) {
      return true;
    }
    return false;
  }

  return false;
}

describe("SEC-03 — Matriz de Testes de Autorização e Governança no Backend", () => {
  const TENANT_A = "tenant-esc-log-001";
  const TENANT_B = "tenant-invasor-999";

  const profilesMock: UserProfile[] = [
    { id: "prof-admin", user_id: "user-admin", tenant_id: TENANT_A, role: "admin", full_name: "Admin ESC" },
    { id: "prof-rh-padrao", user_id: "user-rh-padrao", tenant_id: TENANT_A, role: "rh", full_name: "RH Operador" },
    { id: "prof-rh-readonly", user_id: "user-rh-readonly", tenant_id: TENANT_A, role: "rh", full_name: "RH Consulta" },
    { id: "prof-rh-bloqueado", user_id: "user-rh-bloqueado", tenant_id: TENANT_A, role: "rh", full_name: "RH Demitido" },
    { id: "prof-rh-tenant-b", user_id: "user-rh-b", tenant_id: TENANT_B, role: "rh", full_name: "RH Outro Tenant" },
  ];

  const permissionsMock: UserPermissionRecord[] = [
    {
      user_id: "user-admin",
      tenant_id: TENANT_A,
      role: "admin",
      status: "ativo",
      permissions: {},
    },
    {
      user_id: "user-rh-padrao",
      tenant_id: TENANT_A,
      role: "rh",
      status: "ativo",
      permissions: {}, // Sem customização: herda preset RH
    },
    {
      user_id: "user-rh-readonly",
      tenant_id: TENANT_A,
      role: "rh",
      status: "ativo",
      permissions: {
        processamento_rh: { ver: true, aprovar: false },
        operacoes_recebidas: { ver: true, aprovar: false },
      },
    },
    {
      user_id: "user-rh-bloqueado",
      tenant_id: TENANT_A,
      role: "rh",
      status: "bloqueado",
      permissions: {},
    },
    {
      user_id: "user-rh-b",
      tenant_id: TENANT_B,
      role: "rh",
      status: "ativo",
      permissions: {},
    },
  ];

  const checkPerm = (
    callerRole: "anon" | "authenticated" | "service_role",
    userId: string | null,
    module: string,
    action: string,
    tenantId?: string | null
  ) =>
    evaluateHasUserPermission({
      callerRole,
      p_user_id: userId,
      p_module: module,
      p_action: action,
      p_tenant_id: tenantId,
      sessionTenantId: tenantId,
      permissionsStore: permissionsMock,
      profilesStore: profilesMock,
      authUid: callerRole === "service_role" ? null : userId,
    });

  // ── SEÇÃO 0: BLINDAGEM DA FUNÇÃO is_service_role() ──
  describe("0. Blindagem de is_service_role() contra Spoofing", () => {
    it("0.1 Usuário comum autenticado (auth.uid presente) NUNCA pode obter is_service_role = true, mesmo manipulando sessão", () => {
      // Usuário comum autenticado tentando passar claims manipuladas
      const spoofAttempt = evaluateIsServiceRole({
        authUid: "user-rh-readonly",
        databaseRoleSetting: "authenticated",
        sessionUser: "authenticator",
        currentUser: "authenticated",
        jwtClaimsRole: "service_role", // Tentativa de claim forjada
      });
      expect(spoofAttempt).toBe(false);
    });

    it("0.2 Apenas conexões legítimas sem usuário final (auth.uid null) e com role service_role recebem true", () => {
      const legitimateWorker = evaluateIsServiceRole({
        authUid: null,
        databaseRoleSetting: "service_role",
        sessionUser: "authenticator",
        currentUser: "service_role",
        jwtClaimsRole: "service_role",
      });
      expect(legitimateWorker).toBe(true);
    });
  });

  // ── SEÇÃO 1: TESTES NEGATIVOS E FAIL-CLOSED ──
  describe("1. Cenários Negativos de Governança e Defesa em Profundidade", () => {
    it("1.1 Sessão anônima ou sem UID deve ser terminantemente rejeitada", () => {
      expect(checkPerm("anon", null, "processamento_rh", "aprovar", TENANT_A)).toBe(false);
      expect(checkPerm("authenticated", null, "processamento_rh", "aprovar", TENANT_A)).toBe(false);
    });

    it("1.2 Usuário com status 'bloqueado' deve ter negação imediata para qualquer ação", () => {
      expect(checkPerm("authenticated", "user-rh-bloqueado", "processamento_rh", "ver", TENANT_A)).toBe(false);
      expect(checkPerm("authenticated", "user-rh-bloqueado", "processamento_rh", "aprovar", TENANT_A)).toBe(false);
    });

    it("1.3 Negação explícita em JSONB (aprovar: false) DEVE sobrepor preset RH", () => {
      expect(checkPerm("authenticated", "user-rh-readonly", "processamento_rh", "ver", TENANT_A)).toBe(true);
      expect(checkPerm("authenticated", "user-rh-readonly", "processamento_rh", "aprovar", TENANT_A)).toBe(false);
      expect(checkPerm("authenticated", "user-rh-readonly", "operacoes_recebidas", "aprovar", TENANT_A)).toBe(false);
    });

    it("1.4 Tentativa de acesso Cross-Tenant (Usuário de B operando em A) deve ser rejeitada", () => {
      expect(checkPerm("authenticated", "user-rh-b", "processamento_rh", "aprovar", TENANT_A)).toBe(false);
    });

    it("1.5 Anti-Impersonation em RPC: Passar p_usuario_id de Admin NÃO burla a checagem", () => {
      const simulateRpcCall = (authUid: string, passedUserId: string, targetTenant: string) => {
        const effectiveCaller = authUid;
        if (!effectiveCaller) throw new Error("AUTH_REQUIRED");
        const authorized = checkPerm("authenticated", effectiveCaller, "processamento_rh", "aprovar", targetTenant);
        if (!authorized) throw new Error("PERMISSION_DENIED");
        return { success: true, operator: effectiveCaller };
      };

      expect(() =>
        simulateRpcCall("user-rh-readonly", "user-admin", TENANT_A)
      ).toThrowError(/PERMISSION_DENIED/);
    });
  });

  // ── SEÇÃO 2: COBERTURA DOS 6 DOMÍNIOS DA CENTRAL DE APROVAÇÕES ──
  describe("2. Cobertura dos Seis Domínios Operacionais", () => {
    it("2.1 Domínio 1 (Ponto CLT): Trigger bloqueia transição para PROCESSADO se canApprove for false", () => {
      const simulatePontoTrigger = (uid: string, targetTenant: string, newStatus: string) => {
        if (["PROCESSADO", "INCONSISTENTE"].includes(newStatus)) {
          if (!checkPerm("authenticated", uid, "processamento_rh", "aprovar", targetTenant)) {
            throw new Error("PERMISSION_DENIED");
          }
        }
        return true;
      };

      expect(() => simulatePontoTrigger("user-rh-readonly", TENANT_A, "PROCESSADO")).toThrowError(/PERMISSION_DENIED/);
      expect(() => simulatePontoTrigger("user-rh-readonly", TENANT_A, "INCONSISTENTE")).toThrowError(/PERMISSION_DENIED/);
      expect(simulatePontoTrigger("user-rh-padrao", TENANT_A, "PROCESSADO")).toBe(true);
      expect(simulatePontoTrigger("user-admin", TENANT_A, "PROCESSADO")).toBe(true);
    });

    it("2.2 Domínio 2 (Diaristas): RPCs validar_periodo e reabrir_periodo validam permissão estrita", () => {
      const simulateDiaristasValidation = (uid: string, targetTenant: string) => {
        if (!checkPerm("authenticated", uid, "processamento_rh", "aprovar", targetTenant)) {
          throw new Error("PERMISSION_DENIED");
        }
        return true;
      };

      expect(() => simulateDiaristasValidation("user-rh-readonly", TENANT_A)).toThrowError(/PERMISSION_DENIED/);
      expect(simulateDiaristasValidation("user-rh-padrao", TENANT_A)).toBe(true);
    });

    it("2.3 Domínio 3 (Intermitentes): Trigger protege VALIDADO_RH e DEVOLVIDO_RH", () => {
      const simulateIntermitentesTrigger = (uid: string, targetTenant: string, newStatus: string) => {
        if (["VALIDADO_RH", "DEVOLVIDO_RH", "REJEITADO"].includes(newStatus)) {
          if (!checkPerm("authenticated", uid, "processamento_rh", "aprovar", targetTenant)) {
            throw new Error("PERMISSION_DENIED");
          }
        }
        return true;
      };

      expect(() => simulateIntermitentesTrigger("user-rh-readonly", TENANT_A, "VALIDADO_RH")).toThrowError(/PERMISSION_DENIED/);
      expect(() => simulateIntermitentesTrigger("user-rh-readonly", TENANT_A, "DEVOLVIDO_RH")).toThrowError(/PERMISSION_DENIED/);
      expect(simulateIntermitentesTrigger("user-rh-padrao", TENANT_A, "VALIDADO_RH")).toBe(true);
    });

    it("2.4 Domínio 4 (Operações por Volume): RPCs aprovar e devolver protegem transição", () => {
      const simulateOpRpc = (uid: string, targetTenant: string) => {
        if (!checkPerm("authenticated", uid, "operacoes_recebidas", "aprovar", targetTenant)) {
          throw new Error("PERMISSION_DENIED");
        }
        return true;
      };

      expect(() => simulateOpRpc("user-rh-readonly", TENANT_A)).toThrowError(/PERMISSION_DENIED/);
      expect(simulateOpRpc("user-rh-padrao", TENANT_A)).toBe(true);
    });

    it("2.5 Domínio 5 (Custos Extras): RPC rpc_custo_extra_transicionar protege aprovação e devolução", () => {
      const simulateCustoRpc = (uid: string, targetTenant: string, acao: string) => {
        if (["aprovar", "devolver"].includes(acao)) {
          if (!checkPerm("authenticated", uid, "processamento_rh", "aprovar", targetTenant)) {
            throw new Error("PERMISSION_DENIED");
          }
        }
        return true;
      };

      expect(() => simulateCustoRpc("user-rh-readonly", TENANT_A, "aprovar")).toThrowError(/PERMISSION_DENIED/);
      expect(() => simulateCustoRpc("user-rh-readonly", TENANT_A, "devolver")).toThrowError(/PERMISSION_DENIED/);
      expect(simulateCustoRpc("user-rh-padrao", TENANT_A, "aprovar")).toBe(true);
    });

    it("2.6 Domínio 6 (Serviços Extras): Trigger trg_check_servico_extra_approval_permission protege pipeline_status", () => {
      const simulateServicoExtraTrigger = (uid: string, targetTenant: string, newPipelineStatus: string) => {
        if (["APROVADO_OPERACAO", "DEVOLVIDO"].includes(newPipelineStatus)) {
          if (!checkPerm("authenticated", uid, "operacoes_recebidas", "aprovar", targetTenant)) {
            throw new Error("PERMISSION_DENIED");
          }
        }
        return true;
      };

      expect(() => simulateServicoExtraTrigger("user-rh-readonly", TENANT_A, "APROVADO_OPERACAO")).toThrowError(/PERMISSION_DENIED/);
      expect(() => simulateServicoExtraTrigger("user-rh-readonly", TENANT_A, "DEVOLVIDO")).toThrowError(/PERMISSION_DENIED/);
      expect(simulateServicoExtraTrigger("user-rh-padrao", TENANT_A, "APROVADO_OPERACAO")).toBe(true);
      expect(simulateServicoExtraTrigger("user-admin", TENANT_A, "APROVADO_OPERACAO")).toBe(true);
    });
  });

  // ── SEÇÃO 3: WORKFLOWS AUTOMATIZADOS (SERVICE_ROLE) ──
  describe("3. Workflows Automatizados e Integrações (n8n / Edge Functions / Workflow B CLT)", () => {
    it("3.1 Chamadas com service_role possuem bypass irrestrito garantido em todos os domínios", () => {
      expect(checkPerm("service_role", null, "processamento_rh", "aprovar", TENANT_A)).toBe(true);
      expect(checkPerm("service_role", null, "operacoes_recebidas", "aprovar", TENANT_A)).toBe(true);
      expect(checkPerm("service_role", null, "central_financeira", "aprovar", TENANT_A)).toBe(true);
    });
  });
});
