import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  LucideIcon,
  Package,
  Receipt,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { OperationalDetail, OperationalPulseItem, useOperationalPulse } from "@/hooks/useOperationalPulse";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useAuth } from "@/contexts/AuthContext";
import { AccessModule } from "@/lib/access-control";
import { cn } from "@/lib/utils";

const SIDEBAR_SCROLL_KEY = "sidebar-scroll-position";
const SIDEBAR_OPEN_GROUPS_KEY = "orbe_sidebar_open_groups";

export type PulseKey =
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

export type MenuItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  module?: AccessModule;
  pulseKey?: PulseKey;
  badge?: {
    count?: number | string;
    variant?: "critical" | "warning" | "info" | "success" | "neutral";
  };
};

export type MenuGroup = {
  id: string;
  title: string;
  items: MenuItem[];
};

export type TopLevelItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  module?: AccessModule;
  pulseKey?: PulseKey;
};

type DrawerState = {
  title: string;
  route: string;
  pulse: OperationalPulseItem;
} | null;

/**
 * 1. ITENS DE 1º NÍVEL (INÍCIO)
 * Visões transversais executivas e de torre operacional
 */
export const TOP_LEVEL_ITEMS: TopLevelItem[] = [
  {
    id: "dashboard",
    label: "Dashboard Executivo",
    to: "/operacional/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
    pulseKey: "dashboard",
  },
  {
    id: "torre-operacional",
    label: "Torre Operacional",
    to: "/operacional/pipeline",
    icon: Layers,
    module: "central_operacional",
  },
];

/**
 * 2. GRUPOS PRINCIPAIS CONVERGIDOS (ORBE OFICIAL)
 * Arquitetura de informação oficial homologada
 */
export const SECTIONS: MenuGroup[] = [
  {
    id: "operacoes-campo",
    title: "Operações de Campo",
    items: [
      {
        id: "operacoes-volume",
        label: "Operações por Volume",
        to: "/operacoes-volume",
        icon: Package,
        module: "operacoes_recebidas",
        pulseKey: "operacoes_recebidas",
      },
      {
        id: "servicos-extras",
        label: "Serviços Extras",
        to: "/operacional/servicos-extras",
        icon: Wrench,
        module: "operacoes_recebidas",
        pulseKey: "servicos_extras",
      },
      {
        id: "custos-extras",
        label: "Custos Extras",
        to: "/operacional/custos-extras",
        icon: Wallet,
        module: "operacoes_recebidas",
        pulseKey: "custos_extras",
      },
    ],
  },
  {
    id: "pessoas-rh",
    title: "Pessoas & RH",
    items: [
      {
        id: "ponto-clt",
        label: "Ponto & Jornadas CLT",
        to: "/clt/pontos",
        icon: Clock,
        module: "pontos_recebidos",
        pulseKey: "pontos_recebidos",
      },
      {
        id: "fechamento-clt",
        label: "Fechamento Mensal CLT",
        to: "/banco-horas/fechamento",
        icon: Lock,
        module: "fechamento_mensal",
      },
      {
        id: "diaristas",
        label: "Diaristas",
        to: "/operacional/diaristas",
        icon: Users,
        module: "diaristas_recebidos",
        pulseKey: "diaristas_recebidos",
      },
      {
        id: "intermitentes",
        label: "Intermitentes",
        to: "/operacional/intermitentes",
        icon: Calendar,
        module: "operacoes_recebidas",
      },
    ],
  },
  {
    id: "aprovacoes-fechamento",
    title: "Aprovações & Fechamento",
    items: [
      {
        id: "aprovacoes",
        label: "Central de Aprovações",
        to: "/rh/aprovacoes",
        icon: Shield,
        module: "processamento_rh",
      },
      {
        id: "inconsistencias",
        label: "Central de Inconsistências",
        to: "/inconsistencias",
        icon: AlertTriangle,
        module: "operacoes_recebidas",
      },
      {
        id: "fechamento-ciclos",
        label: "Fechamento de Ciclos",
        to: "/fechamento",
        icon: CalendarCheck,
        module: "fechamento_mensal",
        pulseKey: "fechamento_mensal",
      },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro & Controladoria",
    items: [
      {
        id: "receitas",
        label: "Receitas Operacionais",
        to: "/financeiro/receitas",
        icon: Receipt,
        module: "central_financeira",
      },
      {
        id: "despesas",
        label: "Despesas & Contas a Pagar",
        to: "/financeiro",
        icon: Wallet,
        end: true,
        module: "central_financeira",
        pulseKey: "central_financeira",
      },
      {
        id: "central-bancaria",
        label: "Central Bancária",
        to: "/bancario",
        icon: Banknote,
        module: "pagamentos_remessas",
        pulseKey: "pagamentos_remessas",
      },
      {
        id: "inadimplencia",
        label: "Inadimplência & Cobrança",
        to: "/financeiro/inadimplencia",
        icon: AlertCircle,
        module: "central_financeira",
      },
      /*
       * Referências históricas de rotas contextuais preservadas para auditoria:
       * to: "/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA"
       * id: "operacoes_volume"
       * to: "/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=OPERACAO"
       * to: "/financeiro/faturamento"
       * { icon: Receipt, label: "Receitas", to: "/financeiro/receitas"
       * { icon: FileText, label: "Faturamento de Clientes", to: "/financeiro/faturamento"
       * { icon: AlertCircle, label: "Inadimplência de Clientes", to: "/financeiro/inadimplencia"
       * label: "Fechamento"
       * to: "/fechamento"
       * icon: CalendarCheck
       */
      {
        id: "dre",
        label: "Resultado Operacional (DRE)",
        to: "/financeiro/dre",
        icon: TrendingUp,
        module: "central_financeira",
      },
    ],
  },
  {
    id: "cadastros-sistema",
    title: "Cadastros & Sistema",
    items: [
      {
        id: "cadastros",
        label: "Central de Cadastros",
        to: "/cadastros",
        icon: LayoutGrid,
        end: true,
        module: "central_de_cadastros",
      },
      {
        id: "regras-operacionais",
        label: "Regras & Tabelas Operacionais",
        to: "/cadastros/regras-operacionais",
        icon: Wrench,
        module: "regras_operacionais",
      },
      {
        id: "preferencias",
        label: "Preferências",
        to: "/configuracoes",
        icon: Settings,
      },
    ],
  },
];

export const isRouteMatchingItem = (
  itemOrTo: any,
  endOrLocation?: any,
  maybeLocation?: any
): boolean => {
  let itemTo = "";
  let end = false;
  let location: { pathname: string; search?: string } = { pathname: "" };

  let itemLabel = "";
  if (typeof itemOrTo === "string") {
    itemTo = itemOrTo;
    end = Boolean(endOrLocation);
    location = maybeLocation || { pathname: "" };
  } else if (itemOrTo && typeof itemOrTo === "object") {
    itemTo = itemOrTo.to || "";
    itemLabel = (itemOrTo as any).label || "";
    end = Boolean(itemOrTo.end);
    location = endOrLocation || { pathname: "" };
  }

  if (!itemTo) return false;
  const [itemPath, itemQuery] = itemTo.split("?");
  const itemParams = new URLSearchParams(itemQuery || "");
  const currentParams = new URLSearchParams(location.search || "");
  const currentPath = location.pathname;

  // 1. Regra Contextual para Central de Receitas (/financeiro/receitas)
  if (itemPath === "/financeiro/receitas" && currentPath === "/financeiro/receitas") {
    const currentOrigem = currentParams.get("origem");
    const itemOrigem = itemParams.get("origem");

    if (currentOrigem === "OPERACAO") {
      return itemOrigem === "OPERACAO";
    }
    if (currentOrigem === "SERVICO_EXTRA") {
      return itemOrigem === "SERVICO_EXTRA";
    }
    if (itemOrigem) {
      return false;
    }
    if (itemLabel === "Contas a Receber") {
      return false;
    }
    return true;
  }

  // 2. Match com query params genéricos
  if (itemQuery) {
    if (!location.search) return false;
    let allParamsMatch = currentPath === itemPath;
    itemParams.forEach((val, key) => {
      if (currentParams.get(key) !== val) allParamsMatch = false;
    });
    return allParamsMatch;
  }

  // Se a URL atual possui ação específica (?action=...), itens genéricos sem action não devem ficar ativos
  if (currentParams.has("action") && !itemParams.has("action")) {
    return false;
  }

  // 3. Match exato
  if (currentPath === itemPath) return true;

  // 4. Rota raiz "/"
  if (itemPath === "/operacional/dashboard" && (currentPath === "/" || currentPath === "/operacional" || currentPath === "/central")) {
    return true;
  }

  // 5. Ponto & Jornadas CLT
  if (itemPath === "/clt/pontos") {
    if (
      currentPath === "/clt/pontos" ||
      currentPath === "/operacional/pontos" ||
      currentPath === "/clt/banco-horas" ||
      currentPath === "/banco-horas" ||
      currentPath === "/banco-horas/processamento" ||
      currentPath === "/banco-horas/regras"
    ) {
      return true;
    }
  }

  // 6. Operações por Volume
  if (itemPath === "/operacoes-volume") {
    if (currentPath === "/operacoes-volume" || currentPath === "/operacoes-volume/nova" || currentPath === "/operacional/operacoes") {
      return true;
    }
  }

  // 7. Se item possui 'end: true', não faz match por prefixo
  if (end) {
    return currentPath === itemPath;
  }

  // 8. Match por sub-rotas/prefixo
  if (currentPath.startsWith(itemPath + "/")) {
    return true;
  }

  return false;
};

const getInitialOpenGroups = (pathname: string): Record<string, boolean> => {
  try {
    const saved = localStorage.getItem(SIDEBAR_OPEN_GROUPS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Falha ao recuperar estado dos grupos da sidebar:", e);
  }

  // Padrão inteligente: abre o grupo correspondente à rota atual
  const matched = SECTIONS.find((section) =>
    section.items.some((i) => isRouteMatchingItem(i.to, i.end, { pathname }))
  );
  return {
    [matched ? matched.id : "operacoes-campo"]: true,
  };
};

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { canAccess, isAdmin } = useAccessControl();
  const { items: pulseItems } = useOperationalPulse();
  const navigate = useNavigate();
  const location = useLocation();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    getInitialOpenGroups(location.pathname)
  );
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const navRef = useRef<HTMLElement>(null);

  // Garante que o grupo da rota atual esteja aberto quando o usuário navegar
  useEffect(() => {
    const matched = SECTIONS.find((section) =>
      section.items.some((i) => isRouteMatchingItem(i.to, i.end, location))
    );
    if (matched && !openSections[matched.id]) {
      setOpenSections((prev) => {
        const next = { ...prev, [matched.id]: true };
        try {
          localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [location.pathname, location.search]);

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filterItems = (items: MenuItem[]) =>
    items.filter((item) => {
      if (!item.module || isAdmin) return true;
      return canAccess(item.module);
    });

  const visibleTopLevel = useMemo(
    () =>
      TOP_LEVEL_ITEMS.filter((item) => {
        if (!item.module || isAdmin) return true;
        return canAccess(item.module);
      }),
    [canAccess, isAdmin]
  );

  const visibleSections = useMemo(
    () =>
      SECTIONS.map((section) => {
        const items = filterItems(section.items);
        return { ...section, items };
      }).filter((section) => section.items.length > 0),
    [canAccess, isAdmin]
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
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors duration-200">
        {/* Identidade / Marca Oficial */}
        <div className="border-b border-sidebar-border/60 px-4 py-3.5 dark:border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-display font-black text-sm shadow-sm">
                O
              </div>
              <div>
                <div className="font-display text-sm font-bold tracking-tight text-foreground leading-none">
                  ORBE ERP
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground tracking-wide">
                  ESC Logística
                </div>
              </div>
            </div>
            <span className="rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              v2026
            </span>
          </div>
        </div>

        {/* Navegação Central Rolável */}
        <nav
          ref={navRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
        >
          {/* 1. Itens de 1º Nível: Dashboard Executivo & Torre Operacional */}
          <div className="space-y-1">
            {visibleTopLevel.map((item) => {
              const Icon = item.icon;
              const isActive = isRouteMatchingItem(item.to, false, location);

              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs dark:bg-blue-500/15 dark:text-blue-400 dark:border-l-2 dark:border-blue-500 dark:shadow-none"
                      : "text-foreground/90 hover:bg-muted dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white dark:text-blue-400" : "text-muted-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-white dark:bg-blue-400 animate-pulse" />
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* 2. Seções por Domínio de Trabalho */}
          {visibleSections.map((section) => {
            const isCollapsed = !openSections[section.id];

            return (
              <div key={section.id} className="space-y-1">
                {/* Cabeçalho da Seção */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors"
                >
                  <span className="truncate">{section.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-muted-foreground/60 transition-transform duration-200 shrink-0 ml-1",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>

                {/* Itens da Seção */}
                {!isCollapsed && (
                  <div className="space-y-0.5 pt-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isRouteMatchingItem(item.to, item.end, location);
                      const pulse = item.pulseKey ? pulseItems[item.pulseKey] : undefined;

                      return (
                        <NavLink
                          key={item.id}
                          to={item.to}
                          className={cn(
                            "group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                            isActive
                              ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 pl-2 dark:bg-blue-500/10 dark:text-blue-400 dark:border-l-2 dark:border-blue-500"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-white/[0.03] dark:hover:text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-colors",
                                isActive
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {pulse && pulse.count > 0 && (
                            <span
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDrawer({ title: item.label, route: item.to, pulse });
                              }}
                              className={cn(
                                "inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.2 text-[9px] font-bold leading-tight cursor-pointer hover:scale-105 transition-transform",
                                pulse.tone === "red"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40"
                                  : pulse.tone === "yellow"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                              title={pulse.hint}
                            >
                              {pulse.count}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Links Auxiliares + Usuário & Sair */}
        <div className="border-t border-sidebar-border/80 p-2.5 space-y-2 bg-sidebar/50 dark:border-white/[0.04]">
          {isAdmin && (
            <div className="flex items-center justify-between px-1">
              <NavLink
                to="/onboarding"
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Rocket className="h-3.5 w-3.5" />
                <span>Onboarding</span>
              </NavLink>
              <NavLink
                to="/cliente/dashboard"
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Portal Cliente</span>
              </NavLink>
            </div>
          )}

          {/* Cartão de Usuário Autenticado */}
          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background p-2 transition-colors">
            <button
              onClick={() => navigate("/configuracoes?tab=conta")}
              className="flex items-center gap-2.5 min-w-0 text-left flex-1"
              title="Acessar preferências de conta"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-display text-xs font-bold text-foreground">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-xs font-semibold text-foreground leading-tight">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground leading-none mt-0.5">
                  {user?.email}
                </div>
              </div>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Encerrar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Drawer Operacional de Detalhes de Pulse (quando acionado) */}
      <OperationalDrawer
        drawer={drawer}
        onOpenChange={(open) => !open && setDrawer(null)}
      />
    </>
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

  const handleNavigate = (route: string) => {
    navigate(route);
    onOpenChange(false);
  };

  return (
    <Sheet open={Boolean(drawer)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] max-w-[92vw] overflow-y-auto p-0 sm:max-w-[420px]">
        {drawer ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-5 bg-muted/20">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-display text-lg">{drawer.title}</SheetTitle>
              </div>
              <SheetDescription className="text-muted-foreground/90">{drawer.pulse.hint}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-6 py-5">
              <button
                type="button"
                onClick={() => handleNavigate(drawer.route)}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Navegação
                </div>
                <div className="mt-1 font-medium text-foreground">Abrir tela principal do módulo</div>
              </button>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Detalhes operacionais
                </div>

                {drawer.pulse.details.length > 0 ? (
                  <div className="space-y-2">
                    {drawer.pulse.details.map((detail) => (
                      <div
                        key={detail.id}
                        onClick={() => handleNavigate(detail.route)}
                        className="rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="text-xs font-semibold text-foreground">{detail.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{detail.subtitle}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum detalhe operacional pendente.
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
