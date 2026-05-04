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
import { Eye, EyeOff, HardHat, Loader2 } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
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
            const { error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (error) throw error;

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
