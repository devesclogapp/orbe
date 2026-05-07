import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const { session, loading } = useAuth();
    const { userRole } = useClient();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (userRole?.toLowerCase() === "encarregado") {
        const path = location.pathname;
        const allowedPrefixes = [
            "/producao",
            "/operacional",
            "/central",
            "/banco-horas",
            "/rh",
            "/fechamento",
            "/cadastros",
            "/cadastros/regras-operacionais",
            "/colaboradores",
            "/empresas",
            "/transportadoras",
            "/fornecedores",
            "/servicos",
            "/coletores",
            "/importacoes",
            "/inconsistencias",
            "/configuracoes",
        ];

        const isAllowedPath = allowedPrefixes.some((prefix) => path.startsWith(prefix));

        if (!isAllowedPath) {
            return <Navigate to="/producao" replace />;
        }
    }

    return <>{children}</>;
};
