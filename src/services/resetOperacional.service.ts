import { supabase } from "@/lib/supabase";

export type ResetMode = "operacional" | "financeiro" | "completo" | "demo";
export type ResetCategory = "operacional" | "financeiro" | "cadastros";

export interface ResetTabelaAfetada {
  tabela: string;
  descricao: string;
  categoria?: ResetCategory | null;
  registros: number;
}

export interface ResetResponse {
  preview_only: boolean;
  mode: ResetMode;
  tipo_reset: string;
  confirmation_phrase: string;
  total_registros: number;
  tabelas: ResetTabelaAfetada[];
  audit_id?: string | null;
}

export interface ResetPayload {
  tenantId: string;
  justification?: string;
  confirmationText?: string;
  previewOnly?: boolean;
  snapshotBeforeReset?: boolean;
}

type RpcName =
  | "reset_operacional_tenant"
  | "reset_financeiro_tenant"
  | "reset_completo_tenant"
  | "reset_demo_environment_tenant";

class ResetOperacionalServiceClass {
  private async buildRequestContext(snapshotBeforeReset = false) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = user?.id
      ? await supabase
          .from("profiles")
          .select("role, full_name, tenant_id")
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };

    return {
      source: "configuracoes/manutencao",
      pathname: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null,
      origin: typeof window !== "undefined" ? window.location.origin : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      timezone:
        typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
      executed_at_client: new Date().toISOString(),
      user_email: user?.email ?? null,
      user_id: user?.id ?? null,
      role: profile?.role ?? null,
      user_name: profile?.full_name ?? user?.user_metadata?.full_name ?? null,
      tenant_id: profile?.tenant_id ?? null,
      snapshot_requested: snapshotBeforeReset,
    };
  }

  private normalizeResponse(data: any): ResetResponse {
    return {
      preview_only: Boolean(data?.preview_only),
      mode: (data?.mode ?? "operacional") as ResetMode,
      tipo_reset: String(data?.tipo_reset ?? ""),
      confirmation_phrase: String(data?.confirmation_phrase ?? ""),
      total_registros: Number(data?.total_registros ?? 0),
      tabelas: Array.isArray(data?.tabelas)
        ? data.tabelas.map((item: any) => ({
            tabela: String(item?.tabela ?? ""),
            descricao: String(item?.descricao ?? ""),
            categoria: item?.categoria ? (String(item.categoria) as ResetCategory) : null,
            registros: Number(item?.registros ?? 0),
          }))
        : [],
      audit_id: data?.audit_id ?? null,
    };
  }

  private async callResetRpc(
    rpcName: RpcName,
    payload: ResetPayload,
  ): Promise<ResetResponse> {
    const {
      tenantId,
      justification,
      confirmationText,
      previewOnly = false,
      snapshotBeforeReset = false,
    } = payload;

    if (!tenantId) {
      throw new Error("Tenant inválido para execução do reset.");
    }

    // TODO: Quando o pipeline de snapshot estiver pronto, gerar/exportar o backup aqui
    // antes de invocar a RPC destrutiva.
    const requestContext = await this.buildRequestContext(snapshotBeforeReset);

    const { data, error } = await supabase.rpc(rpcName, {
      p_tenant_id: tenantId,
      p_justificativa: justification?.trim() || null,
      p_confirmacao: confirmationText?.trim() || null,
      p_preview_only: previewOnly,
      p_request_context: requestContext,
    });

    if (error) {
      throw new Error(error.message || "Falha ao executar reset controlado.");
    }

    return this.normalizeResponse(data);
  }

  async previewOperacional(tenantId: string) {
    return this.callResetRpc("reset_operacional_tenant", {
      tenantId,
      previewOnly: true,
    });
  }

  async previewFinanceiro(tenantId: string) {
    return this.callResetRpc("reset_financeiro_tenant", {
      tenantId,
      previewOnly: true,
    });
  }

  async previewCompletoTenant(tenantId: string) {
    return this.callResetRpc("reset_completo_tenant", {
      tenantId,
      previewOnly: true,
    });
  }

  async previewDemoEnvironment(tenantId: string) {
    return this.callResetRpc("reset_demo_environment_tenant", {
      tenantId,
      previewOnly: true,
    });
  }

  async resetOperacional(payload: ResetPayload) {
    return this.callResetRpc("reset_operacional_tenant", payload);
  }

  async resetFinanceiro(payload: ResetPayload) {
    return this.callResetRpc("reset_financeiro_tenant", payload);
  }

  async resetCompletoTenant(payload: ResetPayload) {
    return this.callResetRpc("reset_completo_tenant", payload);
  }

  async resetDemoEnvironment(payload: ResetPayload) {
    return this.callResetRpc("reset_demo_environment_tenant", payload);
  }
}

export const ResetOperacionalService = new ResetOperacionalServiceClass();
