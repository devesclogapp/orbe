import { AppShell } from "@/components/layout/AppShell";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Moon, Sun, Clock, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const Configuracoes = () => {
  const { theme, setTheme, defaultTab, setDefaultTab } = usePreferences();

  return (
    <AppShell title="Configurações" subtitle="Preferências do sistema">
      <div className="space-y-5 max-w-3xl">
        <section className="esc-card p-5">
          <h2 className="font-display font-semibold text-foreground mb-1">Aparência</h2>
          <p className="text-xs text-muted-foreground mb-4">Escolha o tema da interface.</p>
          <div className="grid grid-cols-2 gap-3">
            <OptionCard
              active={theme === "light"}
              onClick={() => { setTheme("light"); toast.success("Tema claro ativado"); }}
              icon={<Sun className="h-5 w-5" />}
              title="Claro"
              desc="Interface luminosa"
            />
            <OptionCard
              active={theme === "dark"}
              onClick={() => { setTheme("dark"); toast.success("Tema escuro ativado"); }}
              icon={<Moon className="h-5 w-5" />}
              title="Escuro"
              desc="Reduz fadiga visual"
            />
          </div>
        </section>

        <section className="esc-card p-5">
          <h2 className="font-display font-semibold text-foreground mb-1">Painel de Processamento</h2>
          <p className="text-xs text-muted-foreground mb-4">Aba exibida ao abrir o painel operacional.</p>
          <div className="grid grid-cols-2 gap-3">
            <OptionCard
              active={defaultTab === "ponto"}
              onClick={() => { setDefaultTab("ponto"); toast.success("Aba inicial: Ponto"); }}
              icon={<Clock className="h-5 w-5" />}
              title="Ponto"
              desc="Mostrar registros de ponto primeiro"
            />
            <OptionCard
              active={defaultTab === "operacoes"}
              onClick={() => { setDefaultTab("operacoes"); toast.success("Aba inicial: Operações"); }}
              icon={<Boxes className="h-5 w-5" />}
              title="Operações"
              desc="Mostrar operações primeiro"
            />
          </div>
        </section>

        <section className="esc-card p-5">
          <h2 className="font-display font-semibold text-foreground mb-1">Conta</h2>
          <div className="text-sm text-muted-foreground">
            Logado como <span className="text-foreground font-medium">João Dias</span> · Encarregado
          </div>
        </section>
      </div>
    </AppShell>
  );
};

const OptionCard = ({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "text-left p-4 rounded-lg border transition-all",
      active
        ? "border-primary bg-primary-soft ring-1 ring-primary"
        : "border-border bg-card hover:border-input"
    )}
  >
    <div className={cn("mb-2", active ? "text-primary" : "text-muted-foreground")}>{icon}</div>
    <div className="font-display font-semibold text-foreground text-sm">{title}</div>
    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
  </button>
);

export default Configuracoes;
