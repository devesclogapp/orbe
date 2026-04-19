import { AppShell } from "@/components/layout/AppShell";
import { empresas } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

const Empresas = () => {
  return (
    <AppShell title="Empresas" subtitle="Cadastro de empresas e unidades operacionais">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button><Plus className="h-4 w-4 mr-1.5" /> Nova empresa</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((e) => (
            <article key={e.id} className="esc-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "esc-chip",
                    e.status === "ativa" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                  )}
                >
                  {e.status === "ativa" ? "Ativa" : "Inativa"}
                </span>
              </div>
              <h3 className="font-display font-semibold text-foreground">{e.nome}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{e.cnpj}</p>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-2">
                <MapPin className="h-3 w-3" /> {e.unidade} — {e.cidade}/{e.uf}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                <Stat icon={<Users className="h-3.5 w-3.5" />} label="Colaboradores" value={e.colaboradores} />
                <Stat icon={<Cpu className="h-3.5 w-3.5" />} label="Coletores" value={e.coletores} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div>
    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">{icon} {label}</div>
    <div className="font-display font-semibold text-foreground text-lg">{value}</div>
  </div>
);

export default Empresas;
