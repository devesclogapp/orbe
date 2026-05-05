import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Users } from "lucide-react";

const cadastroSchema = z.object({
    fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "A confirmação deve ter pelo menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
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
            const token = searchParams.get("invite");
            if (!token) {
                setLoadingInvitation(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("tenant_invitations")
                    .select("*, tenants(name)")
                    .eq("token", token)
                    .gt("expires_at", new Date().toISOString())
                    .is("accepted_at", null)
                    .single();

                if (error || !data) {
                    toast.error("Convite inválido ou expirado");
                    navigate("/login");
                    return;
                }

                setInvitation({
                    tenantId: data.tenant_id,
                    tenantName: data.tenants?.name || "Empresa",
                    role: data.role,
                    email: data.email,
                });
            } catch (err) {
                console.error("Erro ao verificar convite:", err);
                navigate("/login");
            } finally {
                setLoadingInvitation(false);
            }
        };

        checkInvitation();
    }, [searchParams, navigate]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CadastroFormValues>({
        resolver: zodResolver(cadastroSchema),
    });

    const onSubmit = async (data: CadastroFormValues) => {
        if (submitting) return;
        
        setSubmitting(true);
        setLoading(true);
        
        try {
            // Etapa 1: Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.fullName,
                    },
                },
            });

            if (authError) {
                // Tratar erro 429
                if (authError.message.includes("429") || authError.status === 429) {
                    throw new Error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
                }
                // Tratar erro 401
                if (authError.status === 401) {
                    throw new Error("Erro de configuração. Entre em contato com o administrador.");
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error("Falha ao criar usuário");
            }

            // Etapa 2: Se for convite, vincular ao tenant existente
            if (invitation) {
                const { error: profileError } = await supabase
                    .from("profiles")
                    .insert({
                        user_id: authData.user.id,
                        tenant_id: invitation.tenantId,
                        full_name: data.fullName,
                        role: invitation.role,
                    });

                if (profileError) {
                    console.error("Erro ao criar profile:", profileError);
                    throw new Error("Falha ao criar perfil do usuário");
                }

                toast.success("Bem-vindo à empresa!");
                setTimeout(() => navigate("/"), 1500);
                return;
            }

            // Etapa 3: Se for novo cadastro, criar tenant via Edge Function
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                throw new Error("Sessão não encontrada. Tente novamente.");
            }

            const tenantName = data.fullName.split(" ")[0] + "'s Empresa";

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tenant`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        tenant_name: tenantName,
                        full_name: data.fullName,
                    }),
                }
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
                <div className="flex items-center gap-2 p-3 mb-4 bg-primary/10 rounded-lg text-sm">
                    <Users className="h-4 w-4" />
                    <span>Entrando como {invitation.role} em {invitation.tenantName}</span>
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
                        className={errors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={loading}
                    />
                    {errors.fullName && (
                        <p className="text-xs text-red-500 font-medium">{errors.fullName.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        {...register("email")}
                        className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={loading}
                    />
                    {errors.email && (
                        <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...register("password")}
                            className={errors.password ? "border-red-500 focus-visible:ring-red-500 pr-10" : "pr-10"}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        {...register("confirmPassword")}
                        className={errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={loading}
                    />
                    {errors.confirmPassword && (
                        <p className="text-xs text-red-500 font-medium">{errors.confirmPassword.message}</p>
                    )}
                </div>

                <Button 
                    type="submit" 
                    className="w-full font-bold h-11" 
                    disabled={loading || submitting}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Criando conta...
                        </>
                    ) : (
                        "Criar conta"
                    )}
                </Button>

                <p className="text-center text-sm text-gray-500">
                    Já tem uma conta?{" "}
                    <Link to="/login" className="text-primary hover:underline">
                        Entrar
                    </Link>
                </p>
            </form>
        </AuthLayout>
    );
};

export default Cadastro;