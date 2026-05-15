import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Banknote,
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
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { ComponentType, MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { OperationalDetail, OperationalPulseItem, useOperationalPulse } from "@/hooks/useOperationalPulse";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useAuth } from "@/contexts/AuthContext";
import { AccessModule } from "@/lib/access-control";
import { cn } from "@/lib/utils";

const SIDEBAR_SCROLL_KEY = "sidebar-scroll-position";

type PulseKey =
  | "dashboard"
  | "operacoes_recebidas"
  | "pontos_recebidos"
  | "diaristas_recebidos"
  | "custos_extras"
  | "servicos_extras"
  | "central_de_cadastros"
  | "processamento_rh"
  | "banco_de_horas"
  | "regras_de_banco"
  | "fechamento_mensal"
  | "central_financeira"
  | "faturamento"
  | "pagamentos_remessas"
  | "regras_de_calculo"
  | "central_de_relatorios"
  | "governanca"
  | "automacao_operacional"
  | "regras_operacionais";

type MenuItem = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  to: string;
  end?: boolean;
  module?: AccessModule;
  pulseKey?: PulseKey;
};

type MenuGroup = {
  id: string;
  label: string;
  stageKey?: "entradas" | "rh" | "financeiro";
  items: MenuItem[];
};

type DrawerState = {
  title: string;
  route: string;
  pulse: OperationalPulseItem;
} | null;

const dashboardItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/operacional/dashboard", module: "dashboard", pulseKey: "dashboard" },
];

const groups: MenuGroup[] = [
  {
    id: "entradas",
    label: "Entradas",
    stageKey: "entradas",
    items: [
      { icon: ClipboardCheck, label: "Operações Recebidas", to: "/operacional/operacoes", module: "operacoes_recebidas", pulseKey: "operacoes_recebidas" },
      { icon: Clock, label: "Pontos Recebidos", to: "/operacional/pontos", module: "pontos_recebidos", pulseKey: "pontos_recebidos" },
      { icon: UserCheck, label: "Diaristas Recebidos", to: "/operacional/diaristas", module: "diaristas_recebidos", pulseKey: "diaristas_recebidos" },
    ],
  },
  {
    id: "rh",
    label: "RH",
    stageKey: "rh",
    items: [
      { icon: LayoutGrid, label: "Cadastros", to: "/cadastros", module: "central_de_cadastros", pulseKey: "central_de_cadastros" },
      { icon: Activity, label: "Processamento", to: "/banco-horas/processamento", module: "processamento_rh", pulseKey: "processamento_rh" },
      { icon: Scale, label: "Banco de Horas", to: "/banco-horas", end: true, module: "banco_de_horas", pulseKey: "banco_de_horas" },
      { icon: CalendarCheck, label: "Fechamento Mensal", to: "/fechamento", module: "fechamento_mensal", pulseKey: "fechamento_mensal" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { icon: Wallet, label: "Custos Extras", to: "/producao/custos-extras", module: "central_operacional", pulseKey: "custos_extras" },
      { icon: Wrench, label: "Serviços Extras", to: "/producao/servicos-extras", module: "central_operacional", pulseKey: "servicos_extras" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    stageKey: "financeiro",
    items: [
      { icon: Wallet, label: "Central", to: "/financeiro", end: true, module: "central_financeira", pulseKey: "central_financeira" },
      { icon: TrendingUp, label: "Faturamento", to: "/financeiro/faturamento", module: "faturamento", pulseKey: "faturamento" },
      { icon: Banknote, label: "Bancário", to: "/bancario", module: "pagamentos_remessas", pulseKey: "pagamentos_remessas" },
    ],
  },
  {
    id: "governanca",
    label: "Governança",
    items: [
      { icon: BarChart3, label: "Relatórios", to: "/relatorios", module: "central_de_relatorios", pulseKey: "central_de_relatorios" },
      { icon: Shield, label: "Usuários", to: "/admin/usuarios-acessos", module: "governanca" },
      { icon: Zap, label: "Automação", to: "/governanca/automacao", module: "automacao_operacional", pulseKey: "automacao_operacional" },
      { icon: Database, label: "Governança", to: "/governanca", module: "governanca", pulseKey: "governanca" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    items: [
      { icon: Wrench, label: "Regras", to: "/cadastros/regras-operacionais", module: "regras_operacionais", pulseKey: "regras_operacionais" },
      { icon: Settings, label: "Preferências", to: "/configuracoes?tab=preferencias" },
    ],
  },
];

const toneClasses = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  gray: "border-border bg-muted text-muted-foreground",
} as const;

const toneAccentClasses = {
  green: {
    title: "text-emerald-700",
    soft: "bg-emerald-50/80",
    border: "border-emerald-200/80",
    edge: "bg-emerald-500",
    priority: "bg-emerald-100 text-emerald-800 border-emerald-200",
    action: "text-emerald-700",
  },
  yellow: {
    title: "text-amber-700",
    soft: "bg-amber-50/80",
    border: "border-amber-200/80",
    edge: "bg-amber-500",
    priority: "bg-amber-100 text-amber-800 border-amber-200",
    action: "text-amber-700",
  },
  red: {
    title: "text-rose-700",
    soft: "bg-rose-50/80",
    border: "border-rose-200/80",
    edge: "bg-rose-500",
    priority: "bg-rose-100 text-rose-800 border-rose-200",
    action: "text-rose-700",
  },
  blue: {
    title: "text-sky-700",
    soft: "bg-sky-50/80",
    border: "border-sky-200/80",
    edge: "bg-sky-500",
    priority: "bg-sky-100 text-sky-800 border-sky-200",
    action: "text-sky-700",
  },
  gray: {
    title: "text-foreground",
    soft: "bg-muted/40",
    border: "border-border",
    edge: "bg-slate-300",
    priority: "bg-muted text-muted-foreground border-border",
    action: "text-foreground",
  },
} as const;

const stageLineTone = {
  green: "bg-emerald-400/30",
  yellow: "bg-amber-400/30",
  red: "bg-rose-400/30",
  blue: "bg-sky-400/30",
  gray: "bg-slate-300/30",
} as const;

const toneLabels = {
  red: "Critico",
  yellow: "Atencao",
  blue: "Aguardando acao",
  green: "Saudavel",
  gray: "Informativo",
} as const;

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { canAccess, isAdmin } = useAccessControl();
  const { items: pulseItems, stages } = useOperationalPulse();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (savedScrollPosition && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScrollPosition, 10);
    }
  }, []);

  const handleScroll = () => {
    if (navRef.current) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, navRef.current.scrollTop.toString());
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const filterItems = (items: MenuItem[]) =>
    items.filter((item) => !item.module || isAdmin || canAccess(item.module));

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({ ...group, items: filterItems(group.items) }))
        .filter((group) => group.items.length > 0),
    [canAccess, isAdmin],
  );

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((name: string) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <>
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5">
          <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
        </div>

        <nav
          ref={navRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 pb-3"
        >
          <div className="mb-3 space-y-1">
            {filterItems(dashboardItems).map((item) => (
              <SidebarItem
                key={item.to}
                item={item}
                pulse={item.pulseKey ? pulseItems[item.pulseKey] : undefined}
                onBadgeClick={(pulse) => setDrawer({ title: item.label, route: item.to, pulse })}
              />
            ))}
          </div>

          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const isOpen = !collapsed[group.id];
              const stageTone = group.stageKey ? stages[group.stageKey].tone : "gray";

              return (
                <section key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 my-1 text-left bg-muted/40 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {group.stageKey ? (
                        <span className={cn("h-4 w-1 rounded-sm", stageLineTone[stageTone])} />
                      ) : (
                        <span className="h-4 w-1 rounded-sm bg-slate-300/40" />
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                        {group.label}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/45 transition-transform",
                        !isOpen && "-rotate-90",
                      )}
                    />
                  </button>

                  {isOpen ? (
                    <div className="relative mt-1 mb-3 space-y-1 pl-3">
                      {group.stageKey ? (
                        <span className={cn("absolute bottom-2 left-[13px] top-1 w-px", stageLineTone[stageTone])} />
                      ) : null}

                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.to}
                          item={item}
                          pulse={item.pulseKey ? pulseItems[item.pulseKey] : undefined}
                          onBadgeClick={(pulse) => setDrawer({ title: item.label, route: item.to, pulse })}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-sidebar-border px-2 py-2">
          <SidebarItem
            item={{ icon: ExternalLink, label: "Portal do Cliente", to: "/cliente/dashboard", module: "portal_do_cliente" }}
            onBadgeClick={() => undefined}
          />
          <SidebarItem
            item={{ icon: Rocket, label: "Onboarding", to: "/onboarding", module: "onboarding" }}
            onBadgeClick={() => undefined}
          />

          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="mt-1 h-9 w-full justify-start gap-3 rounded-lg px-3 text-sm text-destructive hover:bg-destructive-soft hover:text-destructive-strong"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span>Sair</span>
          </Button>
        </div>

        <button
          onClick={() => navigate("/configuracoes?tab=conta")}
          className="m-3 flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left hover:bg-muted/40"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary font-display text-xs font-semibold text-foreground">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-foreground">
              {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
          </div>
        </button>
      </aside>

      <OperationalDrawer
        drawer={drawer}
        onOpenChange={(open) => !open && setDrawer(null)}
      />
    </>
  );
};

const SidebarItem = ({
  item,
  pulse,
  onBadgeClick,
}: {
  item: MenuItem;
  pulse?: OperationalPulseItem;
  onBadgeClick: (pulse: OperationalPulseItem) => void;
}) => {
  const Icon = item.icon;

  const handleBadgeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (pulse) onBadgeClick(pulse);
  };

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "relative ml-3 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
          isActive
            ? "bg-primary/6 text-foreground ring-1 ring-inset ring-primary/10 font-medium"
            : "text-sidebar-foreground hover:bg-secondary/60 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={cn("flex h-4 w-4 shrink-0 items-center justify-center", isActive ? "text-primary/80" : "text-muted-foreground/70")}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {pulse && pulse.count > 0 ? (
            <button
              type="button"
              onClick={handleBadgeClick}
              className={cn(
                "inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-transform hover:scale-[1.03]",
                toneClasses[pulse.tone],
              )}
              title={pulse.hint}
            >
              {pulse.count}
            </button>
          ) : null}
        </>
      )}
    </NavLink>
  );
};

const OperationalDrawer = ({
  drawer,
  onOpenChange,
}: {
  drawer: DrawerState;
  onOpenChange: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const tone = drawer?.pulse.tone ?? "gray";
  const accent = toneAccentClasses[tone];

  const handleNavigate = (route: string) => {
    navigate(route);
    onOpenChange(false);
  };

  return (
    <Sheet open={Boolean(drawer)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] max-w-[92vw] overflow-y-auto p-0 sm:max-w-[420px]">
        {drawer ? (
          <div className="flex h-full flex-col">
            <SheetHeader className={cn("border-b px-6 py-5", accent.border, accent.soft)}>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", toneClasses[drawer.pulse.tone])}>
                  {drawer.pulse.count || 0}
                </span>
                <SheetTitle className={cn("font-display text-lg", accent.title)}>{drawer.title}</SheetTitle>
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", accent.priority)}>
                  {toneLabels[drawer.pulse.tone]}
                </span>
              </div>
              <SheetDescription className="text-muted-foreground/90">{drawer.pulse.hint}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-6 py-5">
              <button
                type="button"
                onClick={() => handleNavigate(drawer.route)}
                className={cn("w-full rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50", accent.border, accent.soft)}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Navegacao
                </div>
                <div className={cn("mt-1 font-medium", accent.title)}>Abrir tela principal do modulo</div>
              </button>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Detalhes operacionais
                </div>

                {drawer.pulse.details.length > 0 ? (
                  <div className="space-y-2">
                    {drawer.pulse.details.map((detail) => (
                      <DrawerDetailCard key={detail.id} detail={detail} pulseTone={drawer.pulse.tone} onNavigate={handleNavigate} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum detalhe operacional disponivel neste momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

const DrawerDetailCard = ({
  detail,
  pulseTone,
  onNavigate,
}: {
  detail: OperationalDetail;
  pulseTone: OperationalPulseItem["tone"];
  onNavigate: (route: string) => void;
}) => {
  const tone = detail.tone ?? pulseTone;
  const accent = toneAccentClasses[tone];

  return (
    <button
      type="button"
      onClick={() => onNavigate(detail.route)}
      className={cn("relative w-full overflow-hidden rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/35", accent.border)}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", accent.edge)} />
      <div className="ml-2">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-foreground">{detail.title}</div>
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", accent.priority)}>
            {toneLabels[tone]}
          </span>
        </div>
        <div className={cn("mt-1 text-xs font-semibold", accent.title)}>{detail.subtitle}</div>
        {detail.detail ? <div className="mt-1 text-sm text-muted-foreground">{detail.detail}</div> : null}
        <div className={cn("mt-2 text-xs font-medium", accent.action)}>
          {detail.actionLabel ?? "Abrir contexto"}
        </div>
      </div>
    </button>
  );
};
