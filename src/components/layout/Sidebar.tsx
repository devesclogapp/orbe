import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Database,
  ExternalLink,
  FilePlus,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Rocket,
  Scale,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Banknote,
  Wrench,
  Zap,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { ComponentType, useState } from "react";

import { useAccessControl } from "@/contexts/AccessControlContext";
import { useAuth } from "@/contexts/AuthContext";
import { AccessModule } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";

type MenuItem = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  to: string;
  end?: boolean;
  module?: AccessModule;
};

type MenuGroup = {
  id: string;
  label: string;
  sublabel?: string;
  items: MenuItem[];
};

const dashboardItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/operacional/dashboard", module: "dashboard" },
  { icon: TrendingUp, label: "Central Operacional", to: "/central", module: "central_operacional" },
];

const groups: MenuGroup[] = [
  {
    id: "entradas",
    label: "Entradas Operacionais",
    sublabel: "dados recebidos",
    items: [
      { icon: ClipboardCheck, label: "Operações Recebidas", to: "/operacional/operacoes", module: "operacoes_recebidas" },
      { icon: Clock, label: "Pontos Recebidos", to: "/operacional/pontos", module: "pontos_recebidos" },
      { icon: UserCheck, label: "Diaristas Recebidos", to: "/rh/diaristas", module: "diaristas_recebidos" },
    ],
  },
  {
    id: "rh",
    label: "Processamento RH",
    sublabel: "validação e tratamento",
    items: [
      { icon: Scale, label: "Banco de Horas", to: "/banco-horas", end: true, module: "banco_de_horas" },
      { icon: FilePlus, label: "Regras de Banco", to: "/banco-horas/regras", module: "regras_de_banco" },
      { icon: Activity, label: "Processamento RH", to: "/banco-horas/processamento", module: "processamento_rh" },
      { icon: Users, label: "Cadastro de Diaristas", to: "/rh/diaristas/cadastros", module: "cadastro_de_diaristas" },
      { icon: Wrench, label: "Regras Operacionais", to: "/cadastros/regras-operacionais", module: "regras_operacionais" },
      { icon: CalendarCheck, label: "Fechamento Mensal", to: "/fechamento", module: "fechamento_mensal" },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros e Estrutura",
    sublabel: "base operacional",
    items: [
      { icon: LayoutGrid, label: "Central de Cadastros", to: "/cadastros", module: "central_de_cadastros" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sublabel: "pagamentos e faturamento",
    items: [
      { icon: Wallet, label: "Central Financeira", to: "/financeiro", end: true, module: "central_financeira" },
      { icon: TrendingUp, label: "Faturamento", to: "/financeiro/faturamento", module: "faturamento" },
      { icon: Banknote, label: "Pagamentos e Remessas", to: "/bancario", module: "pagamentos_remessas" },
      { icon: ArrowRightLeft, label: "Regras de Cálculo", to: "/financeiro/regras", module: "regras_de_calculo" },
    ],
  },
  {
    id: "governanca",
    label: "Relatórios e Governança",
    items: [
      { icon: BarChart3, label: "Central de Relatórios", to: "/relatorios", module: "central_de_relatorios" },
      { icon: Shield, label: "Gestão de Usuários e Acessos", to: "/admin/usuarios-acessos", module: "governanca" },
      { icon: Zap, label: "Automação Operacional", to: "/governanca/automacao", module: "automacao_operacional" },
      { icon: Shield, label: "Governança", to: "/governanca", module: "governanca" },
      { icon: Database, label: "Importações", to: "/importacoes", module: "importacoes" },
    ],
  },
  {
    id: "externo",
    label: "Ambiente Externo",
    items: [
      { icon: ExternalLink, label: "Portal do Cliente", to: "/cliente/dashboard", module: "portal_do_cliente" },
    ],
  },
  {
    id: "dev",
    label: "Desenvolvimento",
    items: [
      { icon: Rocket, label: "Onboarding", to: "/onboarding", module: "onboarding" },
    ],
  },
];

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { canAccess, isAdmin } = useAccessControl();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const filterItems = (items: MenuItem[]) =>
    items.filter((item) => !item.module || isAdmin || canAccess(item.module));

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((name: string) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col items-start px-5 py-5">
        <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 pt-1">
        <div className="mb-3">{filterItems(dashboardItems).map(renderItem)}</div>

        {groups.map((group) => {
          const visibleItems = filterItems(group.items);
          const isOpen = !collapsed[group.id];

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="group flex w-full items-center justify-between rounded-md px-3 py-1.5 transition-colors hover:bg-secondary"
              >
                <div className="text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                  {group.sublabel ? (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/60">
                      {group.sublabel}
                    </span>
                  ) : null}
                </div>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/50 transition-transform duration-200",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>

              {isOpen ? (
                <div className="mt-0.5 space-y-0.5">{visibleItems.map(renderItem)}</div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-2 pt-2">
        {renderItem({
          icon: Settings,
          label: "Preferências",
          to: "/configuracoes?tab=preferencias",
        })}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="h-9 w-full justify-start gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive-soft hover:text-destructive-strong"
        >
          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span>Sair do sistema</span>
        </Button>
      </div>

      <button
        onClick={() => navigate("/configuracoes?tab=conta")}
        className="group m-3 flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left outline-none transition-all hover:border-primary/30 hover:bg-muted/50"
      >
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary font-display text-sm font-semibold text-foreground transition-all group-hover:ring-2 group-hover:ring-primary/20">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          ) : (
            userInitials
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {userName}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {user?.email}
          </div>
        </div>
      </button>

      <div className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        v4.2 - Centro de Processamento Operacional
      </div>
    </aside>
  );
};

const renderItem = (item: MenuItem) => {
  const Icon = item.icon;

  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-primary-soft font-medium text-primary"
            : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r bg-brand" />
          ) : null}
          <div
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center",
              isActive ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
};
