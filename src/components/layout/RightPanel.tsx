import { Sparkles, AlertTriangle, CheckCircle2, Clock, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const RightPanel = () => {
  return (
    <aside className="w-[320px] shrink-0 bg-card border-l border-border h-[calc(100vh-64px)] sticky top-16 overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Sincronização */}
        <section>
          <h3 className="font-display font-semibold text-sm text-foreground mb-2">Sincronização</h3>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-success-soft">
            <CheckCircle2 className="h-4 w-4 text-success-strong mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="font-medium text-success-strong">Coletores conectados</div>
              <div className="text-success-strong/80 mt-0.5">Última sincronização há 2 min</div>
            </div>
          </div>
        </section>

        {/* IA - Sugestão */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-info" />
            <h3 className="font-display font-semibold text-sm text-foreground">Assistente IA</h3>
          </div>
          <div className="p-3 rounded-lg border border-info-soft bg-info-soft/40 space-y-2">
            <div className="text-xs text-foreground leading-relaxed">
              <span className="font-medium">Hikmat Sofyan</span> tem ponto registrado, mas não foi vinculado a nenhuma operação no período.
            </div>
            <div className="text-[11px] text-muted-foreground">
              Sugestão: vincular à operação <span className="font-medium text-foreground">OP-1043 (Transvolume)</span>
            </div>
            <Button size="sm" className="w-full mt-1 h-8">
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Aplicar sugestão
            </Button>
          </div>
        </section>

        {/* Alertas recentes */}
        <section>
          <h3 className="font-display font-semibold text-sm text-foreground mb-2">Alertas do dia</h3>
          <ul className="space-y-2">
            <AlertItem
              icon={<AlertTriangle className="h-4 w-4 text-destructive-strong" />}
              title="Equipe insuficiente"
              desc="OP-1042 registrada para 3 colaboradores, apenas 1 com ponto ativo"
              tone="error"
            />
            <AlertItem
              icon={<AlertTriangle className="h-4 w-4 text-warning-strong" />}
              title="Volume incompatível"
              desc="500 volumes em 20 minutos — possível erro de digitação"
              tone="warn"
            />
            <AlertItem
              icon={<Clock className="h-4 w-4 text-warning-strong" />}
              title="Ponto incompleto"
              desc="Jainudin sem registro de saída"
              tone="warn"
            />
          </ul>
        </section>

        {/* Resumo rápido */}
        <section>
          <h3 className="font-display font-semibold text-sm text-foreground mb-2">Resumo rápido</h3>
          <div className="space-y-2 text-xs">
            <Row label="Colaboradores" value="12" />
            <Row label="Operações" value="8" />
            <Row label="Inconsistências" value="3" highlight />
            <Row label="Status" value="Pendente" />
          </div>
        </section>
      </div>
    </aside>
  );
};

const AlertItem = ({ icon, title, desc, tone }: { icon: React.ReactNode; title: string; desc: string; tone: "error" | "warn" }) => (
  <li className={`p-2.5 rounded-md border-l-2 ${tone === "error" ? "border-destructive bg-destructive-soft/40" : "border-warning bg-warning-soft/30"}`}>
    <div className="flex items-start gap-2">
      {icon}
      <div className="text-xs leading-snug">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  </li>
);

const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-display font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
  </div>
);
