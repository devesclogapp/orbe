import {
  LayoutDashboard, ClipboardCheck, Users, BarChart3, Settings,
  FilePlus, ExternalLink, Clock, Shield, Wallet, LogOut, Database,
  Scale, Banknote, UserCheck, Rocket, LayoutGrid,
  TrendingUp, Building2, Truck, Wrench, CalendarCheck, ChevronDown,
  ArrowRightLeft, Box
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// ─── Grupos de menu ─────────────────────────────────────────────────────────

const dashboardItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/operacional/dashboard" },
  { icon: TrendingUp, label: "Central Operacional", to: "/central" },
];

const entradasItems = [
  { icon: ClipboardCheck, label: "Operações Recebidas", to: "/operacional/operacoes" },
  { icon: Clock, label: "Pontos Recebidos", to: "/operacional/pontos" },
  { icon: UserCheck, label: "Diaristas Recebidos", to: "/rh/diaristas" },
];

const rhItems = [
  { icon: Scale, label: "Banco de Horas", to: "/banco-horas", end: true },
  { icon: FilePlus, label: "Regras de Banco", to: "/banco-horas/regras" },
  { icon: Users, label: "Cadastro de Diaristas", to: "/rh/diaristas/cadastros" },
  { icon: Wrench, label: "Regras Operacionais", to: "/cadastros/regras-operacionais" },
  { icon: CalendarCheck, label: "Fechamento Mensal", to: "/fechamento" },
];

const cadastrosItems = [
  { icon: LayoutGrid, label: "Central de Cadastros", to: "/cadastros" },
];

const financeiroItems = [
  { icon: Wallet, label: "Central Financeira", to: "/financeiro", end: true },
  { icon: TrendingUp, label: "Faturamento", to: "/financeiro/faturamento" },
  { icon: Banknote, label: "Pagamentos e Remessas", to: "/bancario" },
  { icon: ArrowRightLeft, label: "Regras de Cálculo", to: "/financeiro/regras" },
];

const governancaItems = [
  { icon: BarChart3, label: "Central de Relatórios", to: "/relatorios" },
  { icon: Shield, label: "Governança", to: "/governanca" },
  { icon: Database, label: "Importações", to: "/importacoes" },
];

const externoItems = [
  { icon: ExternalLink, label: "Portal do Cliente", to: "/cliente/dashboard" },
];

const devItems = [
  { icon: Rocket, label: "Onboarding", to: "/onboarding" },
];

// ─── Grupos colapsáveis ──────────────────────────────────────────────────────

type MenuGroup = {
  id: string;
  label: string;
  sublabel?: string;
  items: { icon: any; label: string; to: string; end?: boolean }[];
};

const groups: MenuGroup[] = [
  {
    id: "entradas",
    label: "Entradas Operacionais",
    sublabel: "dados recebidos",
    items: entradasItems,
  },
  {
    id: "rh",
    label: "Processamento RH",
    sublabel: "validação e tratamento",
    items: rhItems,
  },
  {
    id: "cadastros",
    label: "Cadastros e Estrutura",
    sublabel: "base operacional",
    items: cadastrosItems,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sublabel: "pagamentos e faturamento",
    items: financeiroItems,
  },
  {
    id: "governanca",
    label: "Relatórios e Governança",
    items: governancaItems,
  },
  {
    id: "externo",
    label: "Ambiente Externo",
    items: externoItems,
  },
  {
    id: "dev",
    label: "Desenvolvimento",
    items: devItems,
  },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 flex flex-col items-start">
        <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
      </div>

      <nav className="flex-1 px-2 overflow-y-auto pt-1 space-y-0.5 pb-2">

        {/* Dashboard — sempre visível no topo */}
        <div className="mb-3">
          {dashboardItems.map(renderItem)}
        </div>

        {/* Grupos colapsáveis */}
        {groups.map((group) => {
          const isOpen = !collapsed[group.id];
          return (
            <div key={group.id} className="mb-1">
              {/* Header do grupo */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-secondary transition-colors group"
              >
                <div className="text-left">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
                    {group.label}
                  </span>
                  {group.sublabel && (
                    <span className="block text-[10px] text-muted-foreground/60 leading-none mt-0.5 normal-case tracking-normal">
                      {group.sublabel}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/50 transition-transform duration-200",
                    !isOpen && "-rotate-90"
                  )}
                />
              </button>

              {/* Itens do grupo */}
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 pl-0">
                  {group.items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="px-2 pt-2 border-t border-sidebar-border space-y-1">
        {renderItem({ icon: Settings, label: "Preferências", to: "/configuracoes?tab=preferencias" })}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 px-3 py-2 h-9 rounded-md text-sm font-medium transition-colors text-destructive hover:bg-destructive-soft hover:text-destructive-strong"
        >
          <div className="h-4 w-4 shrink-0 flex items-center justify-center">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span>Sair do sistema</span>
        </Button>
      </div>

      {/* Perfil do usuário */}
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

      <div className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        v4.2 — Centro de Processamento Operacional
      </div>
    </aside>
  );
};

// ─── renderItem ──────────────────────────────────────────────────────────────

const renderItem = (it: { icon: any; label: string; to: string; end?: boolean }) => {
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
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand" />}
          <div className={cn("h-4 w-4 shrink-0 flex items-center justify-center", isActive ? "text-brand" : "text-muted-foreground")}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span className="truncate">{it.label}</span>
        </>
      )}
    </NavLink>
  );
};
