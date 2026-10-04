import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Wrench,
  Wallet,
  Clock,
  CalendarCheck,
  Lock,
  Users,
  Calendar,
  Shield,
  AlertTriangle,
  Receipt,
  Banknote,
  AlertCircle,
  TrendingUp,
  LayoutGrid,
  Settings,
  FileSpreadsheet,
  Database,
  ChevronDown,
  Sparkles,
  ArrowLeft,
  Activity,
  Layers,
  LucideIcon,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface LabNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: {
    count?: number | string;
    variant?: "critical" | "warning" | "info" | "success" | "neutral";
  };
  isActiveLabTarget?: boolean;
}

interface LabNavSection {
  id: string;
  title: string;
  items: LabNavItem[];
}

/**
 * REGRA ARQUITETURAL DA SIDEBAR (ORBE ERP):
 * - Dashboard Executivo = visão executiva transversal de 1º nível;
 * - Torre Operacional = visão operacional transversal de 1º nível (não pertence a Operações de Campo);
 * - Seções abaixo (Operações, RH, Faturamento, etc.) = módulos especialistas e funcionais.
 */
interface LabTopLevelItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const TOP_LEVEL_ITEMS: LabTopLevelItem[] = [
  {
    id: "dashboard",
    label: "Dashboard Executivo",
    icon: LayoutDashboard,
  },
  {
    id: "torre-operacional",
    label: "Torre Operacional",
    icon: Layers,
  },
];

const SECTIONS: LabNavSection[] = [
  {
    id: "operacoes",
    title: "Operações de Campo",
    items: [
      {
        id: "operacoes-volume",
        label: "Operações por Volume",
        icon: Package,
        badge: { count: 14, variant: "neutral" },
        isActiveLabTarget: true,
      },
      {
        id: "servicos-extras",
        label: "Serviços Extras",
        icon: Wrench,
        badge: { count: 8, variant: "neutral" },
        isActiveLabTarget: true,
      },
      {
        id: "custos-extras",
        label: "Custos Extras",
        icon: Wallet,
        badge: { count: 12, variant: "neutral" },
        isActiveLabTarget: true,
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
        icon: Clock,
      },
      {
        id: "banco-horas",
        label: "Banco de Horas",
        icon: LayoutGrid,
        badge: { count: 3, variant: "critical" },
      },
      {
        id: "fechamento-clt",
        label: "Fechamento Mensal CLT",
        icon: Lock,
      },
      {
        id: "diaristas",
        label: "Diaristas (Grade & Lotes)",
        icon: Users,
        badge: { count: "Sem 43", variant: "neutral" },
      },
      {
        id: "intermitentes",
        label: "Intermitentes",
        icon: Calendar,
      },
    ],
  },
  {
    id: "governanca-aprovacoes",
    title: "Aprovações & Fechamento",
    items: [
      {
        id: "aprovacoes",
        label: "Central de Aprovações",
        icon: Shield,
        badge: { count: 11, variant: "warning" },
        isActiveLabTarget: true,
      },
      {
        id: "inconsistencias",
        label: "Central de Inconsistências",
        icon: AlertTriangle,
        badge: { count: 14, variant: "critical" },
        isActiveLabTarget: true,
      },
      {
        id: "fechamento-ciclos",
        label: "Fechamento de Ciclos",
        icon: CalendarCheck,
        badge: { count: 1, variant: "info" },
        isActiveLabTarget: true,
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
        icon: Receipt,
        isActiveLabTarget: true,
      },
      {
        id: "despesas",
        label: "Despesas & Contas a Pagar",
        icon: Wallet,
      },
      {
        id: "central-bancaria",
        label: "Central Bancária (CNAB & Retorno)",
        icon: Banknote,
        badge: { count: "2 rem.", variant: "neutral" },
      },
      {
        id: "inadimplencia",
        label: "Inadimplência & Cobrança",
        icon: AlertCircle,
        badge: { count: 2, variant: "critical" },
      },
      {
        id: "dre",
        label: "Resultado Operacional (DRE)",
        icon: TrendingUp,
        isActiveLabTarget: true,
      },
    ],
  },
  {
    id: "cadastros-config",
    title: "Cadastros & Sistema",
    items: [
      {
        id: "cadastros",
        label: "Central de Cadastros",
        icon: LayoutGrid,
      },
      {
        id: "regras-operacionais",
        label: "Regras & Tarifas Operacionais",
        icon: Wrench,
      },
      {
        id: "relatorios",
        label: "Relatórios Gerenciais",
        icon: FileSpreadsheet,
        isActiveLabTarget: true,
      },
      {
        id: "design-system",
        label: "Design System & Tokens",
        icon: Sparkles,
        badge: { count: "DS-01", variant: "info" },
        isActiveLabTarget: true,
      },
      {
        id: "auditoria",
        label: "Auditoria & Segurança",
        icon: Database,
      },
      {
        id: "configuracoes",
        label: "Configurações",
        icon: Settings,
      },
    ],
  },
];

const badgeColors = {
  critical: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/40",
  warning: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/40",
  info: "bg-muted/70 dark:bg-muted/40 text-muted-foreground border-border/70 dark:border-border/30",
  success: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/40",
  neutral: "bg-muted/60 dark:bg-muted/30 text-muted-foreground border-border/60 dark:border-border/30",
};

export const UX_LAB_ROUTES: Record<string, string> = {
  dashboard: "/ux-lab",
  "torre-operacional": "/ux-lab/torre",
  "operacoes-volume": "/ux-lab/operacoes-volume",
  "servicos-extras": "/ux-lab/servicos-extras",
  "custos-extras": "/ux-lab/custos-extras",
  aprovacoes: "/ux-lab/aprovacoes",
  inconsistencias: "/ux-lab/inconsistencias",
  "fechamento-ciclos": "/ux-lab/fechamento-ciclos",
  "fechamento-operacional": "/ux-lab/fechamento-ciclos",
  receitas: "/ux-lab/receitas",
  dre: "/ux-lab/dre",
  relatorios: "/ux-lab/relatorios",
  "design-system": "/ux-lab/design-system",
};

interface UxLabSidebarProps {
  activeItem?: string;
  onSelectItem?: (id: string, label: string) => void;
}

export const UxLabSidebar: React.FC<UxLabSidebarProps> = ({
  activeItem = "dashboard",
  onSelectItem,
}) => {
  const navigate = useNavigate();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    "cadastros-config": false,
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleTopLevelClick = (item: LabTopLevelItem) => {
    if (onSelectItem) {
      onSelectItem(item.id, item.label);
    }
    const targetRoute = UX_LAB_ROUTES[item.id];
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  const handleItemClick = (item: LabNavItem) => {
    if (onSelectItem) {
      onSelectItem(item.id, item.label);
    }
    const targetRoute = UX_LAB_ROUTES[item.id];
    if (targetRoute) {
      navigate(targetRoute);
    } else {
      toast.info(`Módulo em planejamento: ${item.label}`, {
        description: "Este módulo do ERP oficial terá seu protótipo disponibilizado em breve no UX Lab.",
      });
    }
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors duration-200">
      {/* Header com Identificação do UX LAB */}
      <div className="border-b border-sidebar-border/60 px-4 py-3.5 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-display font-black text-sm shadow-sm">
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
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0"
          >
            <Sparkles className="mr-1 h-2.5 w-2.5" />
            LAB
          </Badge>
        </div>

        {/* Retornar ao ERP de Produção */}
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/operacional/dashboard")}
            className="w-full justify-start h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/80 dark:border-white/[0.05] dark:bg-transparent dark:hover:bg-white/[0.04]"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Voltar ao ORBE Oficial
          </Button>
        </div>
      </div>

      {/* Navegação Central Rolável */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Top-Level Transversal: Dashboard Executivo & Torre Operacional */}
        <div className="space-y-1">
          {TOP_LEVEL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTopLevelClick(item)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm dark:bg-white/[0.05] dark:text-[#F1F3F5] dark:border-l-2 dark:border-blue-500 dark:shadow-none"
                    : "text-foreground hover:bg-muted dark:text-muted-foreground dark:hover:text-[#F1F3F5] dark:hover:bg-white/[0.03] text-left"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && "dark:text-blue-400")} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="flex h-1.5 w-1.5 rounded-full bg-white dark:bg-blue-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Seções por Domínio */}
        {SECTIONS.map((section) => {
          const isCollapsed = Boolean(collapsedSections[section.id]);

          return (
            <div key={section.id} className="space-y-1">
              {/* Cabeçalho da Seção */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground dark:hover:text-[#F1F3F5]"
              >
                <span>{section.title}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/60 transition-transform duration-200",
                    isCollapsed && "-rotate-90"
                  )}
                />
              </button>

              {/* Itens da Seção */}
              {!isCollapsed && (
                <div className="space-y-0.5 pt-0.5">
                  {section.items.map((item) => {
                    const isSelected = activeItem === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-all text-left",
                          isSelected
                            ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 pl-2 dark:bg-white/[0.05] dark:text-[#F1F3F5] dark:border-l-2 dark:border-blue-500"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-white/[0.03] dark:hover:text-[#F1F3F5]"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-colors",
                              isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-[#F1F3F5]"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.2 text-[9px] font-bold leading-tight",
                              badgeColors[item.badge.variant || "neutral"]
                            )}
                          >
                            {item.badge.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer com Metadados e Instruções do Lab */}
      <div className="border-t border-sidebar-border/80 p-3 text-xs bg-sidebar/50 dark:border-white/[0.04]">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Ambiente Isolado</span>
          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">v0.1-proto</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/70 leading-tight">
          Nenhuma alteração no LAB impacta dados reais da produção.
        </p>
      </div>
    </aside>
  );
};
