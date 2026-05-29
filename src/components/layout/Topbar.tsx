import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Bell, ChevronRight, Compass, CornerUpLeft, GitBranch, Moon, Search, Sun } from "lucide-react";

import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { PipelineTrigger, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CommandMenu } from "./CommandMenu";
import { getBackTarget, getBreadcrumbs, getRouteLabel, getSectionLabel } from "./navigationMeta";

type TopbarProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  backPath?: string;
  pipelineTrigger?: PipelineTrigger | null;
};

export const Topbar = ({ title, subtitle, badge, backPath, pipelineTrigger }: TopbarProps) => {
  const { theme, toggleTheme } = usePreferences();
  const { user } = useAuth();
  const { openPipeline } = useOperationalPipeline();
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
    <header className="bg-card border-b border-border sticky top-0 z-40 min-h-[var(--app-topbar-height)] px-6 py-3 flex flex-col justify-center">
      <div className="flex items-center justify-between gap-6 w-full">
        <div className="flex items-center gap-4 min-w-0">
          {resolvedBackPath && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(resolvedBackPath)}
              className="h-9 w-9 shrink-0 bg-muted/20 hover:bg-muted/40 transition-colors"
              title={backLabel ? `Voltar para ${backLabel}` : "Voltar"}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-0.5 whitespace-nowrap overflow-hidden">
              {badge && (
                <Badge
                  variant="outline"
                  className="h-5 rounded-full px-2 text-[8px] font-black uppercase tracking-widest border-orange-200 bg-orange-100 text-orange-600"
                >
                  <Activity className="h-2.5 w-2.5 mr-1" />
                  {badge}
                </Badge>
              )}

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest overflow-hidden">
                {breadcrumbs.slice(0, -1).map((crumb, index) => (
                  <div key={`${crumb.label}-${index}`} className="flex items-center gap-1.5 shrink-0">
                    {index > 0 && <span className="opacity-40">/</span>}
                    {crumb.path ? (
                      <Link to={crumb.path} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate max-w-[120px]">{crumb.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="font-display font-black text-xl text-foreground leading-tight tracking-tight whitespace-nowrap">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground/70 font-medium truncate hidden md:block border-l border-border/60 pl-3 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative group hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar (⌘K)"
              readOnly
              onClick={() => setOpen(true)}
              className="h-9 w-48 focus-within:w-64 transition-all pl-9 bg-muted/20 border-transparent cursor-pointer hover:bg-muted/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {pipelineTrigger && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPipeline(pipelineTrigger)}
              className="h-9 rounded-lg border-muted/30 bg-muted/10 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-background"
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
              Pipeline
            </Button>
          )}

          <CommandMenu open={open} setOpen={setOpen} />

          <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-7 w-7 text-muted-foreground hover:bg-background"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>

            <Button variant="ghost" size="icon" className="relative h-7 w-7 text-muted-foreground hover:bg-background">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>
          </div>

          <button
            onClick={() => navigate("/configuracoes?tab=conta")}
            className={cn(
              "h-8 w-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-display font-black",
              "text-xs hover:ring-4 hover:ring-orange-500/10 transition-all overflow-hidden"
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
