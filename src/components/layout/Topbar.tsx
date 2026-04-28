import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, ChevronRight, Compass, CornerUpLeft, Moon, Search, Sun } from "lucide-react";

import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CommandMenu } from "./CommandMenu";
import { getBackTarget, getBreadcrumbs, getRouteLabel, getSectionLabel } from "./navigationMeta";

type TopbarProps = {
  title: string;
  subtitle?: string;
  backPath?: string;
};

export const Topbar = ({ title, subtitle, backPath }: TopbarProps) => {
  const { theme, toggleTheme } = usePreferences();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const currentPath = location.pathname;
  const sectionLabel = getSectionLabel(currentPath);
  const breadcrumbs = getBreadcrumbs(currentPath, title);
  const resolvedBackPath = getBackTarget(currentPath, backPath);
  const backLabel = resolvedBackPath ? getRouteLabel(resolvedBackPath) : undefined;

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="bg-card border-b border-border sticky top-0 z-10 min-h-[var(--app-topbar-height)] px-6 py-3">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5 flex-wrap">
            {sectionLabel && (
              <Badge
                variant="outline"
                className="h-6 rounded-full px-2.5 text-[10px] uppercase tracking-wider border-primary/20 bg-primary-soft/40 text-primary"
              >
                <Compass className="h-3 w-3 mr-1" />
                {sectionLabel}
              </Badge>
            )}

            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2 min-w-0">
                {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
                {crumb.path ? (
                  <Link to={crumb.path} className="truncate hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate text-foreground font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3">
            {resolvedBackPath && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(resolvedBackPath)}
                className="h-8 w-8 mt-0.5 shrink-0"
                title={backLabel ? `Voltar para ${backLabel}` : "Voltar"}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-semibold text-[18px] text-foreground leading-none">{title}</h1>
                {resolvedBackPath && backLabel && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CornerUpLeft className="h-3 w-3" />
                    Voltar para {backLabel}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative cursor-pointer" onClick={() => setOpen(true)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar colaborador, operacao... (⌘K)"
              readOnly
              className="h-9 w-72 pl-9 bg-background border-input cursor-pointer focus-visible:ring-0"
            />
          </div>

          <CommandMenu open={open} setOpen={setOpen} />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="h-9 w-9 text-muted-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          </Button>

          <button
            onClick={() => navigate("/configuracoes?tab=conta")}
            title="Meu Perfil"
            className={cn(
              "h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold",
              "text-foreground text-sm hover:ring-2 hover:ring-primary/20 transition-all overflow-hidden border border-border"
            )}
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
