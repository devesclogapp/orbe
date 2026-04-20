import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";

interface PortalGuardProps {
    children: React.ReactNode;
}

/**
 * PortalGuard — protege as rotas /cliente/*
 * - Redireciona para /login se não houver sessão
 * - Mostra loading enquanto resolve o cliente
 * - Redireciona para / (dashboard interno) se o usuário for interno (sem registro em clientes)
 */
export const PortalGuard: React.FC<PortalGuardProps> = ({ children }) => {
    const { session, loading: authLoading } = useAuth();
    const { cliente, isLoading: clientLoading } = useClient();
    const location = useLocation();

    // Enquanto resolve auth ou dados do cliente
    if (authLoading || (session && clientLoading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Carregando portal...</p>
                </div>
            </div>
        );
    }

    // Sem sessão → login
    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Sessão existe mas sem cliente vinculado → usuário interno, não tem acesso ao portal
    if (!cliente) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
