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
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

const Cadastro = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CadastroFormValues>({
        resolver: zodResolver(cadastroSchema),
    });

    const onSubmit = async (data: CadastroFormValues) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.fullName,
                    },
                },
            });

            if (error) throw error;

            toast.success("Conta criada com sucesso!");
            setTimeout(() => navigate("/verificar-email", { state: { email: data.email } }), 1000);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao criar conta");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Crie sua conta"
            subtitle="Preencha os dados abaixo para começar"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                        id="fullName"
                        type="text"
                        placeholder="Ex: João Silva"
                        {...register("fullName")}
                        className={errors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
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
                    />
                    {errors.confirmPassword && (
                        <p className="text-xs text-red-500 font-medium">{errors.confirmPassword.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full font-bold h-11" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Criando conta...
                        </>
                    ) : (
                        "Criar conta"
                    )}
                </Button>

                <div className="text-center pt-2">
                    <p className="text-sm text-muted-foreground">
                        Já tem uma conta?{" "}
                        <Link to="/login" className="text-primary font-bold hover:underline">
                            Fazer login
                        </Link>
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
};

export default Cadastro;
