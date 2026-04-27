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
import { Eye, EyeOff, Loader2, Zap, Lock } from "lucide-react";
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

            // Verificar se o usuário tem o perfil adequado (Encarregado)
            const { data: perfil, error: perfilError } = await supabase
                .from('perfis_usuarios')
                .select('id, perfis!inner(nome)')
                .eq('user_id', authData.user.id)
                .eq('perfis.nome', 'Encarregado')
                .maybeSingle();

            if (perfilError) throw perfilError;

            if (!perfil) {
                // Se não for Encarregado, deslogar para garantir segurança e avisar
                await supabase.auth.signOut();
                toast.error("Acesso restrito: Este portal é exclusivo para Encarregados.");
                return;
            }

            toast.success("Acesso operacional autorizado!");
            navigate("/producao"); // Encaminha para o lançamento de produção
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao realizar login");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-brand flex items-center justify-center shadow-xl shadow-brand/20">
                        <Zap className="h-8 w-8 text-white fill-current" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-white font-display tracking-tight uppercase">Coletor Orbe</h1>
                        <p className="text-slate-400 text-sm font-medium">Acesso Exclusivo para Encarregados</p>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300 text-[11px] font-bold uppercase tracking-widest ml-1">E-mail de Operação</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@empresa.com"
                                {...register("email")}
                                className="bg-slate-950 border-slate-800 text-white h-12 rounded-xl focus:border-brand transition-all"
                            />
                            {errors.email && (
                                <p className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" title="Senha" className="text-slate-300 text-[11px] font-bold uppercase tracking-widest ml-1" />
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    {...register("password")}
                                    className="bg-slate-950 border-slate-800 text-white h-12 rounded-xl focus:border-brand transition-all pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.password.message}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-brand hover:bg-brand/90 text-white font-black text-lg shadow-lg shadow-brand/20 transition-all active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "CONECTAR AO CAMPO"
                            )}
                        </Button>
                    </form>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-2">
                        <Lock className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sessão Segura · Orbe ERP</span>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => navigate("/login")}
                        className="text-slate-500 text-[10px] font-bold hover:text-slate-300 transition-all uppercase tracking-tighter"
                    >
                        Voltar para Login Administrativo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginOperacional;
