import { LayoutDashboard, ClipboardCheck, Users, BarChart3, Settings, FilePlus, ExternalLink, Clock, Shield, Wallet, LogOut, Database, Scale } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";

const mainItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/operacional/dashboard" },
  { icon: Clock, label: "Pontos", to: "/operacional/pontos" },
  { icon: ClipboardCheck, label: "Operações", to: "/operacional/operacoes" },
];

const rhItems = [
  { icon: Users, label: "Central de Cadastros", to: "/cadastros" },
  { icon: FilePlus, label: "Regras Operacionais", to: "/cadastros/regras-operacionais" },
];

const finItems = [
  { icon: Wallet, label: "Central Financeira", to: "/financeiro", end: true },
  { icon: FilePlus, label: "Central Bancária", to: "/bancario" },
  { icon: BarChart3, label: "Central de Relatórios", to: "/relatorios" },
];

const portalItems = [
  { icon: ExternalLink, label: "Portal do Cliente", to: "/cliente/dashboard" },
];

const bhItems = [
  { icon: Clock, label: "Banco de Horas", to: "/banco-horas", end: true },
  { icon: Scale, label: "Regras de Banco", to: "/banco-horas/regras" },
];

const govItems = [
  { icon: Shield, label: "Central de Governança", to: "/governanca" },
];

const simItems = [
  { icon: Database, label: "Gerador de Demo", to: "/simulacao/demo" },
];

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 flex flex-col items-start">
        <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
      </div>

      <nav className="flex-1 px-2 space-y-4 overflow-y-auto pt-2">
        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Operacional</h3>
          {mainItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Pessoas e Cadastros</h3>
          {rhItems.map(renderItem)}
          {bhItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Controladoria</h3>
          {finItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Governança</h3>
          {govItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ambiente Externo</h3>
          {portalItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Desenvolvimento</h3>
          {simItems.map(renderItem)}
        </div>
      </nav>

      <div className="px-2 pt-2 border-t border-sidebar-border space-y-1">
        {renderItem({ icon: Settings, label: "Preferências", to: "/configuracoes?tab=preferencias" })}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 px-3 py-2 h-9 rounded-md text-sm font-medium transition-colors text-destructive hover:bg-destructive-soft hover:text-destructive-strong"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Sair do sistema</span>
        </Button>
      </div>

      <button
        onClick={() => navigate("/configuracoes?tab=conta")}
        className="m-3 p-3 rounded-lg bg-background flex items-center gap-3 border border-border hover:border-primary/30 hover:bg-muted/50 transition-all text-left outline-none group"
      >
        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm group-hover:ring-2 group-hover:ring-primary/20 transition-all overflow-hidden border border-border">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            userInitials
          )}
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="font-display font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{userName}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
        </div>
      </button>

      <div className="px-4 pb-3 text-[11px] text-muted-foreground">
        v4.1 — Navegação por Objetivos
      </div>
    </aside>
  );
};

const renderItem = (it: any) => {
  const Icon = it.icon;
  return (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.end}
      className={({ isActive }) =>
        cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left relative",
          isActive
            ? "bg-primary-soft text-primary font-medium"
            : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{it.label}</span>
        </>
      )}
    </NavLink>
  );
};
