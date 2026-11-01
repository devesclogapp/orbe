import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, HardHat, Loader2, LogOut, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { ACCESS_ROLE_LABELS, getDefaultRouteForRole, normalizeRole } from "@/lib/access-control";

const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { user, signOut } = useAuth();
    const { role: currentUserRole } = useAccessControl();
    const activeRole = currentUserRole || (user?.user_metadata?.role as string) || "user";
    const activeRoleLabel = ACCESS_ROLE_LABELS[normalizeRole(activeRole)] || activeRole;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) throw error;

            // Verificar se o usuário é encarregado — encarregados NÃO podem acessar pelo login convencional
            const { data: perfil } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', authData.user.id)
                .maybeSingle();

            if (perfil?.role === 'encarregado') {
                await supabase.auth.signOut();
                toast.error("Acesso negado. Encarregados devem utilizar o portal \"Acesso Encarregado\".");
                return;
            }

            toast.success("Login realizado com sucesso!");
            navigate("/");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao realizar login");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Bem-vindo de volta"
            subtitle="Insira suas credenciais para acessar sua conta"
        >
            {user && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-left dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <UserCheck className="h-5 w-5" />
                        </div>
                        <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-foreground">Sessão Ativa Detectada</p>
                            <p className="text-muted-foreground">
                                Conectado como <strong className="text-foreground">{user.email}</strong> ({activeRoleLabel}).
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            className="text-xs font-semibold gap-1.5"
                            onClick={() => navigate(getDefaultRouteForRole(activeRole))}
                        >
                            <UserCheck className="h-3.5 w-3.5" />
                            Continuar no ERP
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-800"
                            onClick={async () => {
                                await signOut();
                                toast.info("Sessão anterior desconectada. Você pode fazer um novo login.");
                            }}
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Trocar de Conta
                        </Button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        {...register("email")}
                        className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.email && (
                        <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <Link
                            to="/esqueci-senha"
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            Esqueci minha senha
                        </Link>
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...register("password")}
                            className={errors.password ? "border-red-500 focus-visible:ring-red-500 pr-10" : "pr-10"}
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

                <Button type="submit" className="w-full font-bold h-11" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando...
                        </>
                    ) : (
                        "Entrar"
                    )}
                </Button>

                <Button
                    variant="outline"
                    className="w-full font-bold h-11 mt-4 border-dashed"
                    onClick={() => navigate("/login/operacional")}
                >
                    <HardHat className="mr-2 h-4 w-4" />
                    Acesso Encarregado
                </Button>

                <div className="text-center pt-2">
                    <p className="text-sm text-muted-foreground">
                        Ainda não tem uma conta?{" "}
                        <Link to="/cadastro" className="text-primary font-bold hover:underline">
                            Criar conta
                        </Link>
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
};

export default Login;
