import { LayoutDashboard, ClipboardCheck, Users, Building2, Cpu, Download, AlertTriangle, CalendarCheck, BarChart3, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: ClipboardCheck, label: "Processamento de Ponto", to: "/processamento" },
  { icon: Users, label: "Colaboradores", to: "/colaboradores" },
  { icon: Building2, label: "Empresas", to: "/empresas" },
  { icon: Cpu, label: "Coletores REP", to: "/coletores" },
  { icon: Download, label: "Importações", to: "/importacoes" },
  { icon: AlertTriangle, label: "Inconsistências", to: "/inconsistencias" },
  { icon: CalendarCheck, label: "Fechamento Mensal", to: "/fechamento" },
  { icon: BarChart3, label: "Relatórios", to: "/relatorios" },
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

      {/* Menu */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto pt-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
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
        })}
      </nav>

      {/* Configurações */}
      <div className="px-2 pt-2 border-t border-sidebar-border">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative",
              isActive
                ? "bg-primary-soft text-primary font-medium"
                : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
              <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Configurações</span>
            </>
          )}
        </NavLink>
      </div>

      {/* Usuário */}
      <div className="m-3 p-3 rounded-lg bg-background flex items-center gap-3 border border-border">
        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
          JD
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-display font-semibold text-foreground text-sm truncate">João Dias</div>
          <div className="text-[11px] text-muted-foreground truncate">Encarregado</div>
        </div>
      </div>

      <div className="px-4 pb-3 text-[11px] text-muted-foreground">
        v0.1 — MVP
      </div>
    </aside>
  );
};
