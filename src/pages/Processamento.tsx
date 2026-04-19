import { AppShell } from "@/components/layout/AppShell";
import { RightPanel } from "@/components/layout/RightPanel";
import { MetricCard } from "@/components/painel/MetricCard";
import { PontoOperacoesBlock } from "@/components/painel/PontoOperacoesBlock";
import { ResultadoBlock } from "@/components/painel/ResultadoBlock";
import { StatusIABlock } from "@/components/painel/StatusIABlock";
import { Button } from "@/components/ui/button";
import { Users, Boxes, Wallet, AlertTriangle, Calendar, Building2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

const Processamento = () => {
  return (
    <AppShell
      title="Painel de Processamento Operacional"
      subtitle="Validar e processar operações do dia · Segunda, 07 Mar 2025"
      rightPanel={<RightPanel />}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FilterPill icon={Calendar} label="07 Mar 2025" />
            <FilterPill icon={Building2} label="ESC LOG · Unidade SP" />
          </div>
          <Button
            size="lg"
            className="h-10 px-6 font-display font-semibold"
            onClick={() => toast.success("Dia processado", { description: "8 operações consolidadas — R$ 3.189,00" })}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Processar dia
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Colaboradores" value="12" icon={Users} delta={{ value: "+1", positive: true }} />
          <MetricCard label="Operações" value="8" icon={Boxes} delta={{ value: "+30%", positive: true }} />
          <MetricCard label="Total do dia" value="R$ 3.189" icon={Wallet} delta={{ value: "+12%", positive: true }} accent />
          <MetricCard label="Inconsistências" value="3" icon={AlertTriangle} delta={{ value: "-2", positive: true }} />
        </div>

        <PontoOperacoesBlock />
        <ResultadoBlock />
        <StatusIABlock />

        <div className="h-2" />
      </div>
    </AppShell>
  );
};

const FilterPill = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-card border border-border text-sm text-foreground hover:bg-secondary transition-colors">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    {label}
  </button>
);

export default Processamento;
