import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

const forgotSchema = z.object({
    email: z.string().email("E-mail inválido"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

const EsqueciSenha = () => {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotFormValues>({
        resolver: zodResolver(forgotSchema),
    });

    const onSubmit = async (data: ForgotFormValues) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
                redirectTo: `${window.location.origin}/redefinir-senha`,
            });

            if (error) throw error;

            setSent(true);
            toast.success("Link de recuperação enviado para o seu e-mail!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao solicitar recuperação de senha");
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <AuthLayout
                title="Verifique seu e-mail"
                subtitle="Enviamos um link de recuperação para o endereço informado."
                centerHeader={true}
            >
                <div className="space-y-6 text-center">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-sm text-foreground">
                            Se o e-mail estiver cadastrado, você receberá instruções em instantes.
                        </p>
                    </div>
                    <Link to="/login" className="flex items-center justify-center gap-2 text-primary font-bold hover:underline">
                        <ArrowLeft size={16} />
                        Voltar para o login
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Recuperar senha"
            subtitle="Informe seu e-mail para receber o link de redefinição"
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

                <Button type="submit" className="w-full font-bold h-11" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                        </>
                    ) : (
                        "Enviar link"
                    )}
                </Button>

                <div className="text-center pt-2">
                    <Link to="/login" className="flex items-center justify-center gap-2 text-primary font-bold hover:underline">
                        <ArrowLeft size={16} />
                        Voltar para o login
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default EsqueciSenha;
