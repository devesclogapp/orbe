import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Topbar = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="font-display font-semibold text-[18px] text-foreground leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador, operação..."
            className="h-9 w-72 pl-9 bg-background border-input"
          />
        </div>
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
