import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Users, Boxes, Wallet, AlertTriangle, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Dashboard = () => {
  return (
    <AppShell title="Dashboard" subtitle="Visão geral · Segunda, 07 Mar 2025">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Operações hoje" value="8" icon={Boxes} delta={{ value: "+30%", positive: true }} />
          <MetricCard label="Colaboradores" value="12" icon={Users} delta={{ value: "+1", positive: true }} />
          <MetricCard label="Total calculado" value="R$ 3.189" icon={Wallet} delta={{ value: "+12%", positive: true }} accent />
          <MetricCard label="Inconsistências" value="3" icon={AlertTriangle} delta={{ value: "-2", positive: true }} />
        </div>

        <section className="esc-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-foreground">Status do dia</h2>
            </div>
            <span className="esc-chip bg-warning-soft text-warning-strong">Pendente de processamento</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Última sincronização há 2 minutos. 3 inconsistências aguardando revisão antes do fechamento do dia.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/processamento">Ir para processamento <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/inconsistencias">Ver inconsistências</Link>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
};

export default Dashboard;
