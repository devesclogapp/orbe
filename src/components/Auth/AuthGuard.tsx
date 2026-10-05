import React, { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
    getRouteAccessRule,
    getAccessDeniedFallbackRoute,
    isRouteForbiddenForRole,
} from "@/lib/access-control";

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const { session, loading } = useAuth();
    const { role, canAccess, isBlocked, loading: accessLoading } = useAccessControl();
    const { isActive: isOnboardingActive, isOnboardingComplete, isSystemReady, isDataLoaded } = useOnboarding();
    const location = useLocation();
    const hasResolvedRoute = useRef(false);

    const [isTimedOut, setIsTimedOut] = React.useState(false);

    useEffect(() => {
        if (!loading && !accessLoading) {
            hasResolvedRoute.current = true;
        }
    }, [loading, accessLoading]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading || accessLoading) {
                console.warn("[AuthGuard] Timeout na inicialização de autenticação (6s).");
                setIsTimedOut(true);
            }
        }, 6000);
        return () => clearTimeout(timer);
    }, [loading, accessLoading]);

    // Redirecionamento imediato caso a autenticação termine e não haja sessão
    if (!loading && !session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const isAuthResolving = !hasResolvedRoute.current && (loading || accessLoading);
    const isWaitingOnboarding = isOnboardingActive && !isOnboardingComplete && !isDataLoaded && (role === "admin" || role === "super_admin");
    const shouldBlockScreen = isAuthResolving || isWaitingOnboarding;

    if (shouldBlockScreen) {
        if (isTimedOut) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
                    <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-card p-8 shadow-lg">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xl font-bold">
                            !
                        </div>
                        <h1 className="text-xl font-bold text-foreground">Conexão com o Supabase Indisponível</h1>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Não foi possível conectar ao servidor do Supabase. Verifique se o seu projeto está ativo no painel do Supabase (projetos inativos costumam ser pausados automaticamente).
                        </p>
                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        localStorage.clear();
                                    } catch (_) {}
                                    window.location.href = "/login";
                                }}
                                className="w-full rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 transition-opacity"
                            >
                                Limpar Sessão e Ir para Login
                            </button>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="w-full rounded-lg border border-border bg-background py-2 px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

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

    // Bloqueio explícito por perfil (ex: Encarregado tentando acessar /central)
    if (isRouteForbiddenForRole(role, location.pathname)) {
        const fallback = getAccessDeniedFallbackRoute(role);
        return <Navigate to={fallback} replace />;
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

        const fallback = getAccessDeniedFallbackRoute(role);
        return <Navigate to={fallback} replace />;
    }

    return <>{children}</>;
};
