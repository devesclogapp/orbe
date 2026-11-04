import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { Building2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalGuardProps {
  children: React.ReactNode;
}

/**
 * PortalGuard — protege as rotas /cliente/*
 * - Redireciona para /login se não houver sessão ativa
 * - Exibe loading controlado enquanto resolve perfil e cliente
 * - Trata de forma explícita e amigável o caso de usuário com papel 'cliente' sem vínculo ativo
 * - Permite aos usuários internos (Admin/Gestor) a Visualização Administrativa
 * - Redireciona para / (dashboard interno) se usuário interno tentar acessar sem papel permitido
 */
export const PortalGuard: React.FC<PortalGuardProps> = ({ children }) => {
  const { session, loading: authLoading, signOut } = useAuth();
  const { cliente, isLoading: clientLoading, isInternalUser, userRole, hasNoActiveVinculo } = useClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Enquanto resolve auth ou dados do cliente
  if (authLoading || (session && clientLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Carregando portal...</p>
        </div>
      </div>
    );
  }

  // Sem sessão → redireciona ao login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Tratamento de usuário com papel 'cliente' sem vínculo ativo ou inativo
  if (hasNoActiveVinculo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Vínculo com Empresa Não Localizado</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua conta está registrada para acesso ao Portal do Cliente, porém ainda não há uma Empresa Contratante ativa vinculada ao seu usuário.
          </p>
          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Caso tenha recebido um convite recente, certifique-se de que a ativação foi concluída ou entre em contato com a equipe da ESC LOG.
          </div>
          <Button
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  // Redireciona /cliente/aprovacoes para dashboard (fora do escopo do MVP operacional)
  if (location.pathname === "/cliente/aprovacoes" || location.pathname.startsWith("/cliente/aprovacoes/")) {
    return <Navigate to="/cliente/dashboard" replace />;
  }

  // Se não for cliente e não for usuário interno autorizado → bloqueia e manda para raiz
  if (!cliente && !isInternalUser && userRole !== "cliente") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
