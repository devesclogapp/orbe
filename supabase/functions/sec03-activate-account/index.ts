import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting em memória por IP (máximo 25 requisições por minuto por IP)
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit = 25, windowMs = 60000): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Proteção contra abuso e Rate Limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   req.headers.get("cf-connecting-ip") ||
                   "unknown";

  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message: "Muitas tentativas a partir deste endereço IP. Aguarde um minuto e tente novamente.",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serverSecret = Deno.env.get("SERVER_SECRET") || undefined;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json().catch(() => ({}));
    const { action = "activate", token, code, password, verification_proof } = body;
    let currentVerificationProof = verification_proof || null;

    if (!token || typeof token !== "string" || token.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_TOKEN", message: "Token de convite obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ETAPA 1: Apenas verificação de código OTP (Passo 2)
    // -------------------------------------------------------------------------
    if (action === "verify_code") {
      if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
        return new Response(
          JSON.stringify({ success: false, error: "INVALID_FORMAT", message: "Informe um código de 6 dígitos numéricos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const verifyParams: Record<string, any> = {
        p_token: token.trim(),
        p_code: code.trim(),
      };
      if (serverSecret) {
        verifyParams.p_server_secret = serverSecret;
      }

      const { data: verifyData, error: verifyError } = await supabaseAdmin.rpc(
        "sec03_verify_invitation_activation_code",
        verifyParams
      );

      if (verifyError) {
        return new Response(
          JSON.stringify({ success: false, error: "DATABASE_ERROR", message: verifyError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = verifyData?.success ? 200 : 400;
      return new Response(
        JSON.stringify(verifyData),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ETAPA 2: Fluxo Completo de Ativação e Criação de Senha (Passo 3)
    // -------------------------------------------------------------------------
    if (action === "activate") {
      if (!password || typeof password !== "string" || password.length < 12) {
        return new Response(
          JSON.stringify({ success: false, error: "WEAK_PASSWORD", message: "A senha deve conter no mínimo 12 caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validar dados do convite no banco de dados
      const { data: inviteRows, error: inviteError } = await supabaseAdmin.rpc(
        "validate_invitation_token",
        { p_token: token.trim() }
      );

      const invite = (Array.isArray(inviteRows) ? inviteRows[0] : inviteRows) as any;
      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ success: false, error: "INVITATION_NOT_FOUND", message: "Convite inválido, bloqueado ou expirado." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const email = invite.email.trim().toLowerCase();

      // Se código foi informado junto na ativação e não temos prova de verificação prévia, valida o código
      if (code && !currentVerificationProof) {
        const verifyParams: Record<string, any> = {
          p_token: token.trim(),
          p_code: code.trim(),
        };
        if (serverSecret) {
          verifyParams.p_server_secret = serverSecret;
        }

        const { data: verifyRaw, error: verifyError } = await supabaseAdmin.rpc(
          "sec03_verify_invitation_activation_code",
          verifyParams
        );

        const verifyData = (Array.isArray(verifyRaw) ? verifyRaw[0] : verifyRaw) as any;

        if (verifyError || !verifyData?.success) {
          return new Response(
            JSON.stringify(verifyData || { success: false, error: "VERIFICATION_FAILED", message: "Código inválido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (verifyData?.verification_proof) {
          currentVerificationProof = verifyData.verification_proof;
        }
      }

      // Requisito 8: Prova de verificação obrigatória para qualquer ativação
      if (!currentVerificationProof) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "VERIFICATION_FAILED",
            message: "A ativação requer a validação prévia do código temporário.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Requisito 1: Nunca registrar segredos, tokens, senhas ou proofs nos logs
      console.log(`[Onboarding] Processando ativação para role: ${invite.role}`);

      // -----------------------------------------------------------------------
      // Requisito 4: Busca de usuário existente imune a limites de paginação
      // -----------------------------------------------------------------------
      let userId: string | null = null;
      let isNewlyCreatedUser = false;
      let existingUser: { id: string; email?: string; user_metadata?: any } | null = null;

      try {
        const { data: userRows, error: lookupErr } = await supabaseAdmin.rpc(
          "sec03_get_auth_user_by_email",
          { p_email: email }
        );

        if (!lookupErr && Array.isArray(userRows) && userRows.length > 0) {
          existingUser = {
            id: userRows[0].id,
            email: userRows[0].email,
            user_metadata: userRows[0].raw_user_meta_data || {},
          };
        }
      } catch (_lookupEx) {
        // Fallback seguro caso a RPC de lookup direto ainda não esteja sincronizada
      }

      // Fallback secundário seguro via auth.admin.listUsers
      if (!existingUser) {
        const { data: userData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
        const found = userData?.users?.find((u) => u.email?.toLowerCase() === email);
        if (found) {
          existingUser = {
            id: found.id,
            email: found.email,
            user_metadata: found.user_metadata || {},
          };
        }
      }

      // -----------------------------------------------------------------------
      // Requisito 2: Tratamento Seguro para Contas Já Cadastradas
      // NUNCA substituir a senha de usuários existentes sem autenticação do titular!
      // -----------------------------------------------------------------------
      if (existingUser) {
        userId = existingUser.id;

        // Verificar se usuário pertence a outro tenant
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (profile?.tenant_id && profile.tenant_id !== invite.tenant_id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "USER_TENANT_CONFLICT",
              message: "Este e-mail já possui cadastro vinculado a outra empresa.",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verificar se o titular está autenticado ou se a senha informada confere com a atual
        const authHeader = req.headers.get("authorization");
        let isTitularAuthenticated = false;

        if (authHeader && authHeader.startsWith("Bearer ")) {
          const bearerToken = authHeader.replace("Bearer ", "").trim();
          const { data: sessionUser } = await supabaseAdmin.auth.getUser(bearerToken);
          if (sessionUser?.user?.id === userId) {
            isTitularAuthenticated = true;
          }
        }

        if (!isTitularAuthenticated) {
          // Autenticar com a senha fornecida para comprovar titularidade sem alterar o client admin
          const authVerifyClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: verifyPassData, error: verifyPassErr } = await authVerifyClient.auth.signInWithPassword({
            email: email,
            password: password,
          });

          if (verifyPassErr || !verifyPassData?.user) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "EXISTING_USER_PASSWORD_MISMATCH",
                message: "Este e-mail já possui cadastro no ORBE. Para aceitar o convite, confirme sua senha existente ou faça login.",
              }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          isTitularAuthenticated = true;
        }

        // Atualizar exclusivamente metadados seguros (NÃO sobrescreve a senha!)
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: invite.full_name || existingUser.user_metadata?.full_name,
          },
        });
      } else {
        // Criar novo usuário no Supabase Auth
        const { data: newUserData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: invite.full_name,
            role: invite.role,
            provisioned_by: "sec03_invite",
          },
        });

        if (createErr || !newUserData?.user) {
          // Tratar condição de corrida se o usuário foi registrado simultaneamente
          const errMsg = createErr?.message?.toLowerCase() || "";
          const isRaceCondition = errMsg.includes("already registered") ||
                                  errMsg.includes("already exists") ||
                                  errMsg.includes("creating new user") ||
                                  errMsg.includes("duplicate");

          if (isRaceCondition) {
            // Tentar recuperar o usuário criado pela requisição concorrente
            let raceUser: { id: string } | null = null;
            try {
              const { data: userRows } = await supabaseAdmin.rpc("sec03_get_auth_user_by_email", { p_email: email });
              if (Array.isArray(userRows) && userRows.length > 0) {
                raceUser = { id: userRows[0].id };
              }
            } catch (_) {}

            if (raceUser?.id) {
              userId = raceUser.id;
              isNewlyCreatedUser = false; // Não deletar na compensação pois pertence a outra requisição
            } else {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "USER_ALREADY_REGISTERED",
                  message: "Este e-mail já foi registrado. Faça login com sua senha atual para continuar.",
                }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            return new Response(
              JSON.stringify({
                success: false,
                error: "AUTH_CREATE_FAILED",
                message: createErr?.message || "Erro ao criar usuário.",
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          userId = newUserData.user.id;
          isNewlyCreatedUser = true;
        }
      }

      // -----------------------------------------------------------------------
      // Requisito 3: Aceite Transacional no Banco e Compensação Segura
      // -----------------------------------------------------------------------
      const { data: profileId, error: acceptErr } = await supabaseAdmin.rpc(
        "accept_tenant_invitation",
        {
          p_token: token.trim(),
          p_user_id: userId,
          p_verification_proof: currentVerificationProof,
        }
      );

      if (acceptErr) {
        // Compensação Atômica: Se o usuário foi criado nesta requisição, limpa no Auth.
        // NUNCA exclui contas preexistentes!
        if (isNewlyCreatedUser && userId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (delErr) {
            console.error("Erro na compensação ao deletar usuário recém-criado:", delErr);
          }
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "ACCEPT_INVITATION_FAILED",
            message: acceptErr.message || "Erro ao associar usuário à empresa.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // -----------------------------------------------------------------------
      // Requisito 6 & 7: Sessão Segura e Segregação do Encarregado
      // -----------------------------------------------------------------------
      let session = null;
      try {
        const authSessionClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: signInData } = await authSessionClient.auth.signInWithPassword({
          email: email,
          password: password,
        });
        session = signInData?.session || null;
      } catch (_signInEx) {
        // Falha no login imediato não aborta a ativação; o usuário fará login manual
      }

      let redirectPath = "/operacional/dashboard";
      if (invite.role === "encarregado") {
        redirectPath = "/login/operacional";
      } else if (invite.role === "rh") {
        redirectPath = "/rh/aprovacoes";
      } else if (invite.role === "financeiro") {
        redirectPath = "/financeiro";
      }

      return new Response(
        JSON.stringify({
          success: true,
          profile_id: profileId,
          user_id: userId,
          role: invite.role,
          redirect_to: redirectPath,
          session: session,
          message: invite.role === "encarregado"
            ? "Conta ativada com sucesso! Use o portal operacional para acessar."
            : "Conta ativada com sucesso!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "INVALID_ACTION", message: "Ação não suportada." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: "SERVER_ERROR", message: err.message || "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
