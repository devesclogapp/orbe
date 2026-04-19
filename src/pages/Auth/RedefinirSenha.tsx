import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const resetSchema = z.object({
    password: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "A confirmação deve ter pelo menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
});

type ResetFormValues = z.infer<typeof resetSchema>;

const RedefinirSenha = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetFormValues>({
        resolver: zodResolver(resetSchema),
    });

    const onSubmit = async (data: ResetFormValues) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: data.password,
            });

            if (error) throw error;

            toast.success("Senha atualizada com sucesso!");
            navigate("/login");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao redefinir senha");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Defina sua nova senha"
            subtitle="Escolha uma senha forte que você consiga lembrar"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Nova Senha</Label>
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
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
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
                            Salvando...
                        </>
                    ) : (
                        "Salvar nova senha"
                    )}
                </Button>
            </form>
        </AuthLayout>
    );
};

export default RedefinirSenha;
