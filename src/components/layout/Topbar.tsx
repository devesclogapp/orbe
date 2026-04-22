import { Bell, Search, Moon, Sun, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CommandMenu } from "./CommandMenu";

export const Topbar = ({ title, subtitle, backPath }: { title: string; subtitle?: string; backPath?: string }) => {
  const { theme, toggleTheme } = usePreferences();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {backPath && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            className="h-8 w-8 mr-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="font-display font-semibold text-[18px] text-foreground leading-none">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative cursor-pointer" onClick={() => setOpen(true)}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar colaborador, operação... (⌘K)"
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
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm hover:ring-2 hover:ring-primary/20 transition-all overflow-hidden border border-border"
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
