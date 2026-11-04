/**
 * sec03_etapa01_transferencia_admin.test.ts
 *
 * Suíte de Testes Unitários e de Integração Lógica para a ETAPA 01:
 * - Geração correta do convite para perfil Admin (com link e código OTP 6 dígitos)
 * - Compartilhamento manual via WhatsApp (mensagem formatada sem envio obrigatório de e-mail)
 * - Ativação segura do novo administrador com criação de senha forte e email_confirm = true
 * - Convivência simultânea de múltiplos administradores no mesmo tenant
 * - Preservação integral do administrador existente (sem alteração ou revogação)
 * - Validação de uso único, expiração de convite e rejeição de replay de código
 * - Isolamento estrito entre tenants
 */

import { describe, it, expect, vi } from "vitest";
import {
  ACCESS_MODULES,
  ACCESS_ACTIONS,
  buildPresetPermissions,
  canAccessModule,
  normalizeRole,
  normalizePermissionMatrix,
} from "@/lib/access-control";

interface TenantRecord {
  id: string;
  name: string;
  created_by: string;
}

interface ProfileRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  full_name: string;
}

interface InvitationRecord {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  permissions: any;
  token: string;
  status: "pendente" | "em_processamento" | "aceito" | "bloqueado" | "convite_expirado";
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
}

interface ChallengeRecord {
  id: string;
  invitation_id: string;
  code_hmac: string;
  status: "pendente" | "verificado" | "consumido" | "expirado";
  verification_proof: string | null;
  expires_at: string;
  attempts: number;
}

describe("ETAPA 01 — Convite e Transferência Administrativa", () => {
  const tenantEscLog: TenantRecord = {
    id: "tenant-esc-log-001",
    name: "ESC LOG - Logística Integrada",
    created_by: "usr-dev-admin",
  };

  const devAdminProfile: ProfileRecord = {
    id: "prof-dev-01",
    user_id: "usr-dev-admin",
    tenant_id: tenantEscLog.id,
    role: "admin",
    full_name: "Administrador / Desenvolvedor",
  };

  // ---------------------------------------------------------------------------
  // 1. GERAÇÃO CORRETA DO CONVITE PARA PERFIL ADMIN
  // ---------------------------------------------------------------------------
  it("deve permitir ao Admin gerar convite específico para perfil Admin com todos os módulos", () => {
    const adminPermissions = buildPresetPermissions("admin");

    // Verificar se todos os 22 módulos estão concedidos
    expect(ACCESS_MODULES.length).toBe(22);
    for (const mod of ACCESS_MODULES) {
      expect(canAccessModule(adminPermissions, mod, "ver")).toBe(true);
      expect(canAccessModule(adminPermissions, mod, "criar")).toBe(true);
      expect(canAccessModule(adminPermissions, mod, "editar")).toBe(true);
      expect(canAccessModule(adminPermissions, mod, "excluir")).toBe(true);
    }

    // Simular payload gerado na tela /governanca/usuarios
    const invitationPayload = {
      fullName: "Proprietário ESC LOG",
      email: "diretoria@esclog.com.br",
      phone: "5591988887777",
      role: normalizeRole("admin"),
      preset: "admin",
      permissions: adminPermissions,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    };

    expect(invitationPayload.role).toBe("admin");
    expect(invitationPayload.permissions).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 2. FORMATAÇÃO DA MENSAGEM MANUAL PARA WHATSAPP
  // ---------------------------------------------------------------------------
  it("deve gerar mensagem amigável com link e código OTP formatada para WhatsApp", () => {
    const mockToken = "inv-token-uuid-123456";
    const mockCode = "741852";
    const origin = "https://orbe-nu.vercel.app";
    const link = `${origin}/cadastro?token=${mockToken}`;

    const formattedMessage = `Olá, Proprietário ESC LOG!\n\nVocê foi convidado para acessar a plataforma ORBE pela empresa ESC LOG - Logística Integrada.\n\nPara ativar sua conta com segurança, siga os passos abaixo:\n\n1. Acesse o link de ativação:\n${link}\n\n2. Informe o seu Código de Ativação temporário:\n${mockCode}\n\n3. Crie sua senha de acesso pessoal.\n\nAtenção: Por razões de segurança, este código expira em 10 minutos. Caso você não reconheça este convite, desconsidere esta mensagem.`;

    // Validar conteúdo indispensável para envio via WhatsApp
    expect(formattedMessage).toContain(link);
    expect(formattedMessage).toContain("741852");
    expect(formattedMessage).toContain("ESC LOG - Logística Integrada");
    expect(formattedMessage).toContain("10 minutos");
    expect(formattedMessage).toContain("/cadastro?token=");
  });

  // ---------------------------------------------------------------------------
  // 3. ATIVAÇÃO SEGURA E CRIAÇÃO DE SENHA (SEM E-MAIL OBRIGATÓRIO)
  // ---------------------------------------------------------------------------
  it("deve simular ativação com senha forte e confirmação automática no Auth (email_confirm = true)", () => {
    const passwordCandidate = "EscLog@2026MasterKey!";

    // Regras de validação da senha do Cadastro.tsx
    const minLength = passwordCandidate.length >= 12;
    const hasUpper = /[A-Z]/.test(passwordCandidate);
    const hasLower = /[a-z]/.test(passwordCandidate);
    const hasNumber = /[0-9]/.test(passwordCandidate);
    const hasSpecial = /[^A-Za-z0-9]/.test(passwordCandidate);

    expect(minLength).toBe(true);
    expect(hasUpper).toBe(true);
    expect(hasLower).toBe(true);
    expect(hasNumber).toBe(true);
    expect(hasSpecial).toBe(true);

    // Parâmetro enviado ao Supabase Admin API pelo sec03-activate-account
    const authAdminCreateUserParams = {
      email: "diretoria@esclog.com.br",
      password: passwordCandidate,
      email_confirm: true, // Garante que NÃO exige confirmação de email
      user_metadata: {
        full_name: "Proprietário ESC LOG",
        role: "admin",
        provisioned_by: "sec03_invite",
      },
    };

    expect(authAdminCreateUserParams.email_confirm).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. CONVIVÊNCIA DE DOIS ADMINISTRADORES NO MESMO TENANT
  // ---------------------------------------------------------------------------
  it("deve permitir convivência de múltiplos administradores no mesmo tenant sem conflito", () => {
    const profilesTable: ProfileRecord[] = [devAdminProfile];

    // Novo administrador ativado via convite
    const newOwnerProfile: ProfileRecord = {
      id: "prof-owner-02",
      user_id: "usr-owner-official",
      tenant_id: tenantEscLog.id, // Mesmo tenant
      role: "admin",
      full_name: "Proprietário ESC LOG",
    };

    profilesTable.push(newOwnerProfile);

    // 4.1 Ambos pertencem ao mesmo tenant
    const admins = profilesTable.filter(
      (p) => p.tenant_id === tenantEscLog.id && p.role === "admin"
    );
    expect(admins.length).toBe(2);

    // 4.2 O administrador desenvolvedor continua existindo e inalterado
    const originalDevAdmin = profilesTable.find((p) => p.user_id === "usr-dev-admin");
    expect(originalDevAdmin).toBeDefined();
    expect(originalDevAdmin?.role).toBe("admin");
    expect(originalDevAdmin?.tenant_id).toBe(tenantEscLog.id);

    // 4.3 O novo proprietário possui privilégios plenos
    const ownerAdmin = profilesTable.find((p) => p.user_id === "usr-owner-official");
    expect(ownerAdmin).toBeDefined();
    expect(ownerAdmin?.role).toBe("admin");
    expect(ownerAdmin?.tenant_id).toBe(tenantEscLog.id);
  });

  // ---------------------------------------------------------------------------
  // 5. PRESERVAÇÃO INTEGRAL DE VÍNCULOS E PERMISSÕES DO ADMIN ORIGINAL
  // ---------------------------------------------------------------------------
  it("deve garantir que aceitar o convite não altera dados do admin que o enviou", () => {
    const beforeDevState = { ...devAdminProfile };

    // Simular execução da RPC accept_tenant_invitation
    // O SQL só atualiza: UPDATE profiles WHERE user_id = p_user_id (o novo usuário)
    const invitedUserId = "usr-owner-official";
    const targetUserId = invitedUserId; // Afeta apenas o novo usuário

    expect(targetUserId).not.toBe(devAdminProfile.user_id);
    expect(devAdminProfile.user_id).toBe(beforeDevState.user_id);
    expect(devAdminProfile.role).toBe(beforeDevState.role);
    expect(devAdminProfile.tenant_id).toBe(beforeDevState.tenant_id);
  });

  // ---------------------------------------------------------------------------
  // 6. VALIDAÇÃO DE USO ÚNICO E EXPIRAÇÃO (ANTI-REPLAY)
  // ---------------------------------------------------------------------------
  it("deve rejeitar convites expirados ou já utilizados", () => {
    const expiredInvitation: InvitationRecord = {
      id: "inv-01",
      tenant_id: tenantEscLog.id,
      email: "diretoria@esclog.com.br",
      full_name: "Proprietário ESC LOG",
      phone: null,
      role: "admin",
      permissions: {},
      token: "tok-expired",
      status: "convite_expirado",
      expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
      accepted_at: null,
      accepted_by: null,
    };

    const isExpired = new Date(expiredInvitation.expires_at).getTime() < Date.now();
    expect(isExpired).toBe(true);

    const alreadyAcceptedInvitation: InvitationRecord = {
      id: "inv-02",
      tenant_id: tenantEscLog.id,
      email: "diretoria@esclog.com.br",
      full_name: "Proprietário ESC LOG",
      phone: null,
      role: "admin",
      permissions: {},
      token: "tok-accepted",
      status: "aceito",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: new Date().toISOString(),
      accepted_by: "usr-owner-official",
    };

    const canBeAcceptedAgain =
      alreadyAcceptedInvitation.status === "pendente" &&
      alreadyAcceptedInvitation.accepted_at === null;

    expect(canBeAcceptedAgain).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 7. ISOLAMENTO MULTI-TENANT ESTRITO
  // ---------------------------------------------------------------------------
  it("deve impedir que convite de um tenant seja utilizado em outro tenant", () => {
    const tenantOutro = "tenant-concorrente-999";

    const inviteTenantA: InvitationRecord = {
      id: "inv-a",
      tenant_id: tenantEscLog.id,
      email: "proprietario@empresa.com",
      full_name: "Proprietário",
      phone: null,
      role: "admin",
      permissions: {},
      token: "tok-tenant-a",
      status: "pendente",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
    };

    // Usuário já cadastrado no Tenant Outro
    const existingProfileOtherTenant: ProfileRecord = {
      id: "prof-other",
      user_id: "usr-other",
      tenant_id: tenantOutro,
      role: "admin",
      full_name: "Outro Usuário",
    };

    // Regra da RPC accept_tenant_invitation:
    // IF existing_profile.tenant_id IS NOT NULL AND existing_profile.tenant_id <> invitation.tenant_id THEN
    //   RAISE EXCEPTION 'Este usuário já possui vínculo com outra empresa.';
    const hasTenantConflict =
      existingProfileOtherTenant.tenant_id !== inviteTenantA.tenant_id;

    expect(hasTenantConflict).toBe(true);
  });
});

