import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Zap, Lock, HelpCircle, Shield } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginOperacional = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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

            const { data: perfil, error: perfilError } = await supabase
                .from('perfis_usuarios')
                .select('id, perfis!inner(nome)')
                .eq('user_id', authData.user.id)
                .eq('perfis.nome', 'Encarregado')
                .maybeSingle();

            if (perfilError) throw perfilError;

            if (!perfil) {
                await supabase.auth.signOut();
                toast.error("Acesso restrito: Este portal é exclusivo para Encarregados.");
                return;
            }

            toast.success("Acesso operacional autorizado!");
            navigate("/producao");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao realizar login");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-[380px] space-y-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-brand flex items-center justify-center shadow-lg">
                        <Zap className="h-7 w-7 text-white fill-current" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-foreground font-display">Coletor Orbe</h1>
                        <p className="text-sm text-muted-foreground mt-1">Acesso Exclusivo para Encarregados</p>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@empresa.com"
                                {...register("email")}
                                className="h-10 rounded-lg bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                            />
                            {errors.email && (
                                <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    {...register("password")}
                                    className="h-10 rounded-lg bg-background border-border pr-10 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-10 rounded-lg bg-brand hover:bg-brand/90 text-white font-semibold transition-all active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "Entrar"
                            )}
                        </Button>
                    </form>

                    <div className="flex items-center justify-center gap-2 pt-2">
                        <Shield className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Sessão Segura</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
                        <div className="h-8 w-8 rounded-md bg-info-soft flex items-center justify-center">
                            <HelpCircle className="h-4 w-4 text-info-strong" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-foreground">Precisa de ajuda?</p>
                            <p className="text-[10px] text-muted-foreground">Fale com o admin</p>
                        </div>
                    </button>
                    <button 
                        onClick={() => navigate("/login")}
                        className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    >
                        <div className="h-8 w-8 rounded-md bg-success-soft flex items-center justify-center">
                            <Lock className="h-4 w-4 text-success-strong" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-foreground">Admin</p>
                            <p className="text-[10px] text-muted-foreground">Acesso gestor</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginOperacional;