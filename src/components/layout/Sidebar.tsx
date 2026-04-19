import { LayoutDashboard, ClipboardCheck, Users, Building2, Cpu, Download, AlertTriangle, CalendarCheck, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: ClipboardCheck, label: "Processamento de Ponto", active: true },
  { icon: Users, label: "Colaboradores" },
  { icon: Building2, label: "Empresas" },
  { icon: Cpu, label: "Coletores REP" },
  { icon: Download, label: "Importações" },
  { icon: AlertTriangle, label: "Inconsistências" },
  { icon: CalendarCheck, label: "Fechamento Mensal" },
  { icon: BarChart3, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

export const Sidebar = () => {
  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="font-display font-bold text-primary-foreground text-sm">EL</span>
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-foreground text-sm">ESC LOG</div>
            <div className="text-[11px] text-muted-foreground">ERP Operacional</div>
          </div>
        </div>
      </div>

      {/* Usuário */}
      <div className="mx-3 mb-4 p-3 rounded-lg bg-background flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
          JD
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-display font-semibold text-foreground text-sm truncate">João Dias</div>
          <div className="text-[11px] text-muted-foreground truncate">Encarregado</div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.label}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left relative",
                it.active
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {it.active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 text-[11px] text-muted-foreground border-t border-sidebar-border">
        v0.1 — MVP
      </div>
    </aside>
  );
};
