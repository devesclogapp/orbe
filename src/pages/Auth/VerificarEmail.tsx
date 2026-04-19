import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, RefreshCw } from "lucide-react";

const VerificarEmail = () => {
    const location = useLocation();
    const email = location.state?.email || "";
    const [loading, setLoading] = useState(false);

    const handleResendEmail = async () => {
        if (!email) {
            toast.error("E-mail não encontrado. Por favor, tente fazer login.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                    emailRedirectTo: `${window.location.origin}/login`,
                },
            });

            if (error) throw error;
            toast.success("E-mail de verificação reenviado com sucesso!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao reenviar e-mail");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Verifique seu e-mail"
            subtitle="Enviamos um link de confirmação para o seu endereço de e-mail."
            centerHeader={true}
        >
            <div className="flex flex-col items-center justify-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Mail size={32} />
                </div>

                <div className="text-center space-y-2">
                    <p className="text-sm text-foreground">
                        Clique no link enviado para <span className="font-bold text-primary">{email || "seu e-mail"}</span> para ativar sua conta.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Não recebeu o e-mail? Verifique sua pasta de spam ou clique no botão abaixo para reenviar.
                    </p>
                </div>

                <div className="w-full space-y-3 pt-2">
                    <Button
                        variant="outline"
                        className="w-full h-11 font-bold border-primary text-primary hover:bg-primary/5"
                        onClick={handleResendEmail}
                        disabled={loading || !email}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Reenviando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reenviar e-mail de confirmação
                            </>
                        )}
                    </Button>

                    <Button asChild variant="ghost" className="w-full h-11 text-muted-foreground">
                        <Link to="/login" className="flex items-center justify-center gap-2">
                            <ArrowLeft size={16} />
                            Voltar para o login
                        </Link>
                    </Button>
                </div>
            </div>
        </AuthLayout>
    );
};

export default VerificarEmail;
