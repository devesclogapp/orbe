import React, { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { getRouteAccessRule } from "@/lib/access-control";

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const { session, loading } = useAuth();
    const { role, canAccess, isBlocked, loading: accessLoading } = useAccessControl();
    const { isActive: isOnboardingActive, isOnboardingComplete, isSystemReady, isDataLoaded } = useOnboarding();
    const location = useLocation();
    const hasResolvedRoute = useRef(false);

    useEffect(() => {
        if (!loading && !accessLoading) {
            hasResolvedRoute.current = true;
        }
    }, [loading, accessLoading]);

    const shouldBlockScreen = (!hasResolvedRoute.current && (loading || accessLoading)) || (!isDataLoaded && session != null);

    if (shouldBlockScreen) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (isBlocked) {
        return <Navigate to="/login" replace />;
    }

    const searchParams = new URLSearchParams(location.search);
    const isOnboardingReturn = searchParams.get("onboarding_return") === "true";

    if (isOnboardingActive && !isOnboardingComplete && location.pathname !== "/onboarding" && !isOnboardingReturn) {
        if (role === "admin" || canAccess("onboarding", "ver")) {
            return <Navigate to="/onboarding" replace />;
        } else if (!isSystemReady) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
                    <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-foreground">Sistema em Configuração</h1>
                        <p className="mt-3 text-sm text-muted-foreground">
                            O administrador está realizando a configuração inicial do sistema. Aguarde a liberação.
                        </p>
                    </div>
                </div>
            );
        }
    }

    const rule = getRouteAccessRule(location.pathname);
    if (rule && role !== "admin" && !canAccess(rule.module, rule.action)) {
        if (location.pathname === "/onboarding") {
            return (
                <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
                    <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Você não tem permissão para acessar o fluxo de configuração inicial.
                        </p>
                    </div>
                </div>
            );
        }
        if (location.pathname === "/admin/usuarios-acessos" || location.pathname === "/governanca/usuarios") {
            return (
                <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
                    <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Acesso restrito ao administrador da conta.
                        </p>
                    </div>
                </div>
            );
        }

        return <Navigate to="/central" replace />;
    }

    return <>{children}</>;
};
