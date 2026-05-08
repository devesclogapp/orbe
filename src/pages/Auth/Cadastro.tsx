import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const cadastroSchema = z
  .object({
    fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z
      .string()
      .min(6, "A confirmação deve ter pelo menos 6 caracteres"),
  })
  .refine((formData) => formData.password === formData.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type CadastroFormValues = z.infer<typeof cadastroSchema>;

interface InvitationInfo {
  tenantId: string;
  tenantName: string;
  role: string;
  email: string;
}

interface InvitationValidationResult {
  id: string;
  tenant_id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  role: string;
  permissions?: Record<string, unknown> | null;
  expires_at: string;
  status?: string;
}

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkInvitation = async () => {
      const token = searchParams.get("token") || searchParams.get("invite");

      if (!token) {
        setLoadingInvitation(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc(
          "validate_invitation_token",
          { p_token: token },
        );

        const inviteData = (Array.isArray(data) ? data[0] : data) as
          | InvitationValidationResult
          | null;

        if (error || !inviteData) {
          toast.error("Convite inválido ou expirado");
          navigate("/login");
          return;
        }

        setInvitation({
          tenantId: inviteData.tenant_id,
          tenantName: "Empresa",
          role: inviteData.role,
          email: inviteData.email,
        });
      } catch (error) {
        console.error("Erro ao verificar convite:", error);
        navigate("/login");
      } finally {
        setLoadingInvitation(false);
      }
    };

    checkInvitation();
  }, [navigate, searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroFormValues>({
    resolver: zodResolver(cadastroSchema),
  });

  const onSubmit = async (formData: CadastroFormValues) => {
    if (submitting) return;

    setSubmitting(true);
    setLoading(true);

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();

      if (
        invitation &&
        normalizedEmail !== invitation.email.trim().toLowerCase()
      ) {
        throw new Error("O e-mail informado deve ser o mesmo do convite.");
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      });

      const alreadyRegistered =
        !!authError &&
        typeof authError.message === "string" &&
        authError.message.toLowerCase().includes("user already registered");

      if (authError) {
        if (invitation && alreadyRegistered) {
          // segue para login abaixo para concluir o vínculo
        } else if (authError.message.includes("429") || authError.status === 429) {
          throw new Error(
            "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
          );
        } else if (authError.status === 401) {
          throw new Error(
            "Erro de configuração. Entre em contato com o administrador.",
          );
        } else {
          throw authError;
        }
      }

      if (invitation) {
        let session = authData?.session ?? null;

        if (!session) {
          const { data: loginData, error: loginError } =
            await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password: formData.password,
            });

          if (loginError) {
            if (alreadyRegistered) {
              throw new Error(
                "Este e-mail já possui cadastro. Entre com a senha correta para aceitar o convite.",
              );
            }

            throw new Error(
              "Conta criada, mas não foi possível autenticar para concluir o convite. Tente entrar para finalizar.",
            );
          }

          session = loginData.session;
        }

        if (!session) {
          throw new Error(
            "Conta criada, mas a sessão não foi iniciada para concluir o convite.",
          );
        }

        const { error: acceptError } = await supabase.rpc(
          "accept_tenant_invitation",
          {
            p_token: searchParams.get("token") || searchParams.get("invite"),
          },
        );

        if (acceptError) {
          console.error("Erro ao aceitar convite:", acceptError);
          throw new Error(
            acceptError.message || "Falha ao vincular usuário ao convite",
          );
        }

        const redirectPath =
          invitation.role === "encarregado" ? "/login/operacional" : "/login";

        toast.success(
          invitation.role === "encarregado"
            ? "Conta vinculada! Use o portal operacional para entrar."
            : "Conta vinculada com sucesso!",
        );
        setTimeout(() => navigate(redirectPath), 1500);
        return;
      }

      if (!authData.user) {
        throw new Error("Falha ao criar usuário");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão não encontrada. Tente novamente.");
      }

      const tenantName = `${formData.fullName.split(" ")[0]}'s Empresa`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tenant_name: tenantName,
            full_name: formData.fullName,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Erro ao criar tenant:", result);
        throw new Error(result.error || "Falha ao criar ambiente da empresa");
      }

      toast.success("Conta criada com sucesso!");
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Erro ao criar conta");
      setSubmitting(false);
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvitation) {
    return (
      <AuthLayout title="Carregando..." subtitle="Verificando convite">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  const title = invitation ? "Accept Invite" : "Crie sua conta";
  const subtitle = invitation
    ? `Você foi convidado para ${invitation.tenantName} como ${invitation.role}`
    : "Preencha os dados abaixo para começar";

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      {invitation && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm">
          <Users className="h-4 w-4" />
          <span>
            Entrando como {invitation.role} em {invitation.tenantName}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome Completo</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Ex: João Silva"
            {...register("fullName")}
            className={
              errors.fullName
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }
            disabled={loading}
          />
          {errors.fullName && (
            <p className="text-xs font-medium text-red-500">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            {...register("email")}
            className={
              errors.email ? "border-red-500 focus-visible:ring-red-500" : ""
            }
            disabled={loading}
          />
          {errors.email && (
            <p className="text-xs font-medium text-red-500">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="********"
              {...register("password")}
              className={
                errors.password
                  ? "border-red-500 pr-10 focus-visible:ring-red-500"
                  : "pr-10"
              }
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs font-medium text-red-500">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            {...register("confirmPassword")}
            className={
              errors.confirmPassword
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }
            disabled={loading}
          />
          {errors.confirmPassword && (
            <p className="text-xs font-medium text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            to={invitation?.role === "encarregado" ? "/login/operacional" : "/login"}
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Cadastro;
