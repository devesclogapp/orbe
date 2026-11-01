import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ACCESS_ROLE_LABELS, getDefaultRouteForRole, normalizeRole } from "@/lib/access-control";
import { supabase } from "@/lib/supabase";

interface InvitationData {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  expiresAt: string;
}

interface VerificationErrorState {
  message: string;
  remainingAttempts?: number;
  blocked?: boolean;
}

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || searchParams.get("invite") || "").trim();

  // Estados de navegação e carregamento
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Passo ativo: 1 = Identidade, 2 = Código OTP, 3 = Criação de Senha
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Passo 2: Código de Ativação
  const [code, setCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verificationProof, setVerificationProof] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<VerificationErrorState | null>(null);

  // Passo 3: Criação de Senha
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activating, setActivating] = useState(false);

  // 1. Carregar e validar metadados do convite
  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (isMounted) {
          setLoadingInvitation(false);
          setInvitationError(
            "Nenhum token de convite fornecido. O acesso ao sistema é realizado exclusivamente mediante convite administrativo."
          );
        }
        return;
      }

      try {
        const { data, error } = await supabase.rpc("validate_invitation_token", {
          p_token: token,
        });

        if (!isMounted) return;

        const row = (Array.isArray(data) ? data[0] : data) as any;

        if (error || !row || row.status === "convite_expirado" || row.status === "bloqueado") {
          setInvitationError(
            "Este link de convite é inválido, foi revogado ou expirou. Solicite um novo convite ao administrador."
          );
          setLoadingInvitation(false);
          return;
        }

        setInvitationData({
          id: row.id,
          tenantId: row.tenant_id,
          tenantName: row.tenant_name || "Empresa Vinculada",
          email: row.email,
          fullName: row.full_name || null,
          phone: row.phone || null,
          role: row.role || "user",
          expiresAt: row.expires_at,
        });
        setInvitationError(null);
      } catch (err: any) {
        if (isMounted) {
          setInvitationError(err.message || "Erro ao verificar o convite.");
        }
      } finally {
        if (isMounted) {
          setLoadingInvitation(false);
        }
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Validação da Senha Forte (mínimo 12 caracteres + requisitos)
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 12,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
      matches: password.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const passwordScore = useMemo(() => {
    const checks = [
      passwordCriteria.minLength,
      passwordCriteria.hasUpper,
      passwordCriteria.hasLower,
      passwordCriteria.hasNumber,
      passwordCriteria.hasSpecial,
    ];
    const passed = checks.filter(Boolean).length;
    return (passed / checks.length) * 100;
  }, [passwordCriteria]);

  const isPasswordValid =
    passwordCriteria.minLength &&
    passwordCriteria.hasUpper &&
    passwordCriteria.hasLower &&
    passwordCriteria.hasNumber &&
    passwordCriteria.hasSpecial &&
    passwordCriteria.matches;

  // 3. Handler do Passo 2: Verificação do Código de 6 dígitos
  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);

    if (cleanCode.length !== 6) {
      setVerificationError({
        message: "O código deve conter exatamente 6 dígitos numéricos.",
      });
      return;
    }

    setVerifyingCode(true);
    setVerificationError(null);

    try {
      const { data, error } = await supabase.rpc(
        "sec03_verify_invitation_activation_code",
        {
          p_token: token,
          p_code: cleanCode,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const res = (Array.isArray(data) ? data[0] : data) as any;

      if (res?.success) {
        setIsCodeVerified(true);
        setVerificationProof(res?.verification_proof || null);
        setVerificationError(null);
        toast.success("Código de ativação verificado com sucesso!");
        // Transição suave para o Passo 3
        setTimeout(() => setStep(3), 400);
      } else {
        setVerificationError({
          message: res?.message || "Código de ativação inválido.",
          remainingAttempts: res?.remaining_attempts,
          blocked: Boolean(res?.blocked),
        });
        toast.error(res?.message || "Falha na verificação do código.");
      }
    } catch (err: any) {
      setVerificationError({
        message: err.message || "Erro ao verificar código de ativação.",
      });
      toast.error("Não foi possível verificar o código.");
    } finally {
      setVerifyingCode(false);
    }
  };

  // 4. Handler do Passo 3: Ativação Definitiva da Conta
  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error("Preencha todos os requisitos da senha de segurança.");
      return;
    }

    if (!invitationData) {
      toast.error("Dados do convite não encontrados.");
      return;
    }

    setActivating(true);

    try {
      const cleanCode = code.replace(/\D/g, "").slice(0, 6);

      // Invocação oficial da Edge Function com SDK do Supabase
      // O client Supabase injeta automaticamente apikey e Authorization anon necessários pelo Gateway
      const { data: efResult, error: efError } = await supabase.functions.invoke(
        "sec03-activate-account",
        {
          body: {
            action: "activate",
            token,
            code: cleanCode,
            password,
            verification_proof: verificationProof,
          },
        }
      );

      if (efError) {
        let errorMsg = efError.message || "Falha na ativação da conta.";
        try {
          if (efError.context && typeof efError.context.json === "function") {
            const errBody = await efError.context.json();
            if (errBody?.message) errorMsg = errBody.message;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (!efResult?.success) {
        throw new Error(efResult?.message || "Não foi possível concluir a ativação.");
      }

      // Sessão emitida e assinada pelo backend de produção
      if (efResult.session) {
        await supabase.auth.setSession(efResult.session);
      }

      const redirectTarget =
        efResult.redirect_to && efResult.redirect_to !== "/"
          ? efResult.redirect_to
          : getDefaultRouteForRole(invitationData.role);

      toast.success(efResult.message || "Conta ativada com sucesso!");
      setTimeout(() => navigate(redirectTarget), 1200);
    } catch (err: any) {
      console.error("[Onboarding] Erro na ativação:", err);
      toast.error(err.message || "Erro ao ativar conta.");
    } finally {
      setActivating(false);
    }
  };

  // Tela de Carregamento Inicial
  if (loadingInvitation) {
    return (
      <AuthLayout title="Verificando convite..." subtitle="Aguarde enquanto validamos seu link de acesso">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Autenticando credencial temporária...</p>
        </div>
      </AuthLayout>
    );
  }

  // Tela de Erro de Convite Inválido / Expirado
  if (invitationError || !invitationData) {
    return (
      <AuthLayout title="Acesso não autorizado" subtitle="Não foi possível validar este link de ativação">
        <div className="space-y-6 pt-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 dark:border-rose-900/50 dark:bg-rose-950/20 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-rose-600 dark:text-rose-400" />
            <h3 className="mt-3 text-base font-semibold text-foreground">Convite Inválido ou Expirado</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {invitationError || "O link fornecido não foi encontrado ou já foi utilizado."}
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full" variant="default">
              <Link to="/login">Voltar para o Login</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Se você é colaborador da ESC Logística, solicite um novo convite ao administrador da sua unidade.
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const roleLabel = ACCESS_ROLE_LABELS[normalizeRole(invitationData.role)] || invitationData.role;

  return (
    <AuthLayout
      title="Ativação de Acesso"
      subtitle={`Bem-vindo ao ERP ORBE — ${invitationData.tenantName}`}
      centerHeader
    >
      {/* Indicador de Passos */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <StepBadge
            currentStep={step}
            stepNumber={1}
            label="Identidade"
            isDone={step > 1}
          />
          <div className={`h-[2px] flex-1 mx-2 ${step > 1 ? "bg-primary" : "bg-muted"}`} />
          <StepBadge
            currentStep={step}
            stepNumber={2}
            label="Código"
            isDone={step > 2 || isCodeVerified}
          />
          <div className={`h-[2px] flex-1 mx-2 ${step > 2 ? "bg-primary" : "bg-muted"}`} />
          <StepBadge
            currentStep={step}
            stepNumber={3}
            label="Senha"
            isDone={false}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* PASSO 1: CONFIRMAÇÃO DE IDENTIDADE                                  */}
      {/* ==================================================================== */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Organização Vinculada
                </p>
                <p className="text-base font-bold text-foreground">
                  {invitationData.tenantName}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Colaborador:</span>
                <span className="font-medium text-foreground">
                  {invitationData.fullName || "Não informado"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">E-mail:</span>
                <span className="font-mono text-xs text-foreground">
                  {invitationData.email}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Função / Perfil:</span>
                <Badge variant="outline" className="capitalize">
                  {roleLabel}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/80 leading-relaxed">
            <p>
              Você está ativando sua credencial de acesso corporativo. No próximo passo, informe o <strong>código de 6 dígitos</strong> recebido do administrador para desbloquear a definição da sua senha.
            </p>
          </div>

          <Button
            type="button"
            className="w-full gap-2 text-sm font-semibold"
            onClick={() => setStep(2)}
          >
            Avançar para Verificação
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Já possui acesso ativo?{" "}
            <Link
              to={invitationData.role === "encarregado" ? "/login/operacional" : "/login"}
              className="font-medium text-primary hover:underline"
            >
              Fazer login
            </Link>
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PASSO 2: CÓDIGO DE ATIVAÇÃO DE 6 DÍGITOS                             */}
      {/* ==================================================================== */}
      {step === 2 && (
        <form onSubmit={handleVerifyCode} className="space-y-5">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Código de Ativação</h3>
            <p className="text-xs text-muted-foreground">
              Digite o código de 6 dígitos numéricos enviado pelo administrador.
            </p>
          </div>

          {/* Campo de Código com máscara visual */}
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              placeholder="000000"
              disabled={verifyingCode || isCodeVerified}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(numericOnly);
                setVerificationError(null);
              }}
              className="h-14 text-center font-mono text-3xl font-bold tracking-[0.4em] bg-muted/20"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Válido por 10 minutos
              </span>
              <span>{code.length}/6 dígitos</span>
            </div>
          </div>

          {/* Feedback de Erro ou Bloqueio */}
          {verificationError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-3 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 space-y-1">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-semibold">{verificationError.message}</p>
                  {verificationError.remainingAttempts !== undefined && verificationError.remainingAttempts > 0 && (
                    <p className="mt-0.5 opacity-90">
                      Tentativas restantes para este código: <strong>{verificationError.remainingAttempts}</strong>
                    </p>
                  )}
                  {verificationError.blocked && (
                    <p className="mt-1 font-medium underline">
                      Solicite um novo código ao administrador para prosseguir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback de Sucesso */}
          {isCodeVerified && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Código validado com sucesso! Avançando...</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setStep(1)}
              disabled={verifyingCode}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 font-semibold"
              disabled={code.length !== 6 || verifyingCode || isCodeVerified}
            >
              {verifyingCode ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando código...
                </>
              ) : isCodeVerified ? (
                <>
                  <Check className="h-4 w-4" />
                  Código Validado
                </>
              ) : (
                <>
                  Verificar código
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* PASSO 3: DEFINIÇÃO DE SENHA FORTE & ATIVAÇÃO FINAL                  */}
      {/* ==================================================================== */}
      {step === 3 && (
        <form onSubmit={handleActivateAccount} className="space-y-5">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Definir Senha de Acesso</h3>
            <p className="text-xs text-muted-foreground">
              Crie uma senha forte com no mínimo 12 caracteres.
            </p>
          </div>

          {/* Campo Senha */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Nova Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                autoFocus
                placeholder="Mínimo de 12 caracteres"
                disabled={activating}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Campo Confirmar Senha */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                placeholder="Repita a senha criada"
                disabled={activating}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Barra de Força da Senha */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Força da senha:</span>
              <span className="font-semibold text-foreground">
                {passwordScore < 40
                  ? "Fraca"
                  : passwordScore < 80
                  ? "Média"
                  : passwordScore === 100 && passwordCriteria.matches
                  ? "Excelente"
                  : "Boa"}
              </span>
            </div>
            <Progress value={passwordScore} className="h-1.5" />

            {/* Checklist de Requisitos */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
              <CriteriaItem checked={passwordCriteria.minLength} label="Mínimo 12 caracteres" />
              <CriteriaItem checked={passwordCriteria.hasUpper} label="Letra maiúscula (A-Z)" />
              <CriteriaItem checked={passwordCriteria.hasLower} label="Letra minúscula (a-z)" />
              <CriteriaItem checked={passwordCriteria.hasNumber} label="Número (0-9)" />
              <CriteriaItem checked={passwordCriteria.hasSpecial} label="Caractere especial" />
              <CriteriaItem checked={passwordCriteria.matches} label="Senhas coincidem" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setStep(2)}
              disabled={activating}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 font-semibold bg-primary text-primary-foreground shadow"
              disabled={!isPasswordValid || activating}
            >
              {activating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ativando conta...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Ativar Conta e Entrar
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

// Componente visual de indicador de passo
const StepBadge = ({
  currentStep,
  stepNumber,
  label,
  isDone,
}: {
  currentStep: number;
  stepNumber: number;
  label: string;
  isDone: boolean;
}) => {
  const isCurrent = currentStep === stepNumber;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
          isDone
            ? "bg-primary text-primary-foreground"
            : isCurrent
            ? "border-2 border-primary text-primary bg-background"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isDone ? <Check className="h-3.5 w-3.5" /> : stepNumber}
      </div>
      <span
        className={`text-xs font-medium ${
          isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
};

// Item do checklist de senha
const CriteriaItem = ({ checked, label }: { checked: boolean; label: string }) => {
  return (
    <div
      className={`flex items-center gap-1.5 transition-colors ${
        checked ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
      }`}
    >
      {checked ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-50" />}
      <span>{label}</span>
    </div>
  );
};

export default Cadastro;
