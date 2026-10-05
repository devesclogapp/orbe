import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Bell,
  Database,
  GitBranch,
  Moon,
  Search,
  Sun,
  ShieldCheck,
} from "lucide-react";

import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { PipelineTrigger, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { theme, toggleTheme, environment, setEnvironment } = usePreferences();
  const { user } = useAuth();
  const { openPipeline } = useOperationalPipeline();
  const navigate = useNavigate();
  const location = useLocation();
  const [openCommand, setOpenCommand] = useState(false);

  const currentPath = location.pathname;
  const sectionLabel = getSectionLabel(currentPath);
  const breadcrumbs = getBreadcrumbs(currentPath, title);
  const resolvedBackPath = getBackTarget(currentPath, backPath);
  const backLabel = resolvedBackPath ? getRouteLabel(resolvedBackPath) : undefined;

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/80 bg-card/95 px-4 md:px-6 backdrop-blur-xs transition-colors duration-200">
      {/* Esquerda: Voltar + Breadcrumbs / Contexto Hierárquico */}
      <div className="flex items-center gap-3 min-w-0">
        {resolvedBackPath && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(resolvedBackPath)}
            className="h-8 w-8 shrink-0 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
            title={backLabel ? `Voltar para ${backLabel}` : "Voltar"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          {sectionLabel && (
            <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
              {sectionLabel}
            </span>
          )}

          {sectionLabel && (
            <span className="hidden sm:inline-block text-muted-foreground/40 text-xs">/</span>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-semibold text-sm text-foreground truncate">
              {title}
            </span>

            {badge && (
              <Badge
                variant="outline"
                className="h-5 rounded-md px-1.5 text-[9px] font-bold tracking-wide border-border bg-muted/40 text-muted-foreground shrink-0 ml-1"
              >
                <Activity className="h-2.5 w-2.5 mr-1 text-primary" />
                {badge}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Direita: Busca Global + Ambiente + Tema + Notificações + Usuário */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Busca Global com atalho ⌘K */}
        <div className="relative group hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar atalho (⌘K)"
            readOnly
            onClick={() => setOpenCommand(true)}
            className="h-8 w-44 focus-within:w-56 transition-all pl-8 text-xs bg-muted/30 border-border/60 cursor-pointer hover:bg-muted/50 focus:ring-1 focus:ring-primary/20 rounded-lg"
          />
        </div>

        {pipelineTrigger && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPipeline(pipelineTrigger)}
            className="h-8 rounded-lg border-border/80 bg-muted/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            Pipeline
          </Button>
        )}

        <CommandMenu open={openCommand} setOpen={setOpenCommand} />

        {/* Bloco de Controles Globais */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-0.5">
          {/* Seletor de Base / Ambiente */}
          <div className="flex items-center">
            <Select
              value={environment || "PRODUCAO"}
              onValueChange={(val: any) => {
                setEnvironment(val);
                window.location.reload();
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-7 px-2 border-0 shadow-none text-[10px] font-bold focus:ring-0 rounded-md transition-colors",
                  environment === "HOMOLOGACAO"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {environment === "HOMOLOGACAO" ? (
                    <Activity className="h-3 w-3 text-amber-600 dark:text-amber-400 animate-pulse" />
                  ) : (
                    <Database className="h-3 w-3 text-muted-foreground" />
                  )}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="PRODUCAO">Base de Produção</SelectItem>
                <SelectItem value="HOMOLOGACAO">Homologação (Testes)</SelectItem>
                <SelectItem value="TODOS">Todos os Registros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alternador de Tema Light/Dark */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            title={theme === "dark" ? "Alternar para modo Claro" : "Alternar para modo Escuro"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>

          {/* Sino de Notificações */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-7 w-7 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            title="Notificações"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />
          </Button>
        </div>

        {/* Botão de Perfil / Acesso a Preferências */}
        <button
          onClick={() => navigate("/configuracoes?tab=conta")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-foreground font-display font-bold text-xs hover:border-border hover:bg-muted transition-all overflow-hidden"
          title="Minha Conta"
        >
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            userInitials
          )}
        </button>
      </div>
    </header>
  );
};
