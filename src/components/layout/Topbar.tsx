import { Bell, Search, Moon, Sun, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useNavigate } from "react-router-dom";

export const Topbar = ({ title, subtitle, backPath }: { title: string; subtitle?: string; backPath?: string }) => {
  const { theme, toggleTheme } = usePreferences();
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {backPath && (
          <button
            onClick={() => navigate(backPath)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h1 className="font-display font-semibold text-[18px] text-foreground leading-none">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador, operação..."
            className="h-9 w-72 pl-9 bg-background border-input"
          />
        </div>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="h-9 w-9 rounded-md hover:bg-secondary flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button className="relative h-9 w-9 rounded-md hover:bg-secondary flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
          JD
        </div>
      </div>
    </header>
  );
};
