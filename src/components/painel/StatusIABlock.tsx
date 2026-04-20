import { Sparkles, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const alerts = [
  {
    severity: "high" as const,
    type: "Cruzada",
    title: "Equipe insuficiente em OP-1042",
    desc: "Equipe registrada para 3 colaboradores, mas apenas 1 com ponto ativo no período (09:15–12:00).",
    suggest: "Vincular Imelda Hakim e Ita Septiasari à OP-1042",
  },
  {
    severity: "high" as const,
    type: "Operacional",
    title: "Volume incompatível com tempo trabalhado",
    desc: "OP-1045: 500 volumes registrados em 20 minutos — produção fora do padrão histórico.",
    suggest: "Revisar quantidade ou horário final",
  },
  {
    severity: "medium" as const,
    type: "Ponto",
    title: "Jainudin sem registro de saída",
    desc: "Entrada não capturada pelo coletor REP-02 — possível falha no equipamento.",
    suggest: "Solicitar ajuste manual ou reprocessar coletor",
  },
];

interface StatusIABlockProps {
  stage?: "idle" | "sync" | "ai" | "save" | "done";
}

export const StatusIABlock = ({ stage = "idle" }: StatusIABlockProps) => {
  const getStageConfig = () => {
    switch (stage) {
      case "sync": return { label: "Sincronizando dados...", progress: 20, color: "bg-info" };
      case "ai": return { label: "Analisando inconsistências com IA...", progress: 60, color: "bg-primary" };
      case "save": return { label: "Finalizando processamento...", progress: 90, color: "bg-success" };
      case "done": return { label: "Processamento concluído!", progress: 100, color: "bg-success" };
      default: return null;
    }
  };

  const config = getStageConfig();

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <h2 className="font-display font-semibold text-foreground">Status inteligente</h2>
          <span className="esc-chip bg-info-soft text-info ml-1">IA</span>
        </div>
        {!config ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-destructive-strong">
              <XCircle className="h-3.5 w-3.5" /> 2 críticas
            </span>
            <span className="inline-flex items-center gap-1 text-warning-strong">
              <AlertTriangle className="h-3.5 w-3.5" /> 1 atenção
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground animate-pulse">{config.label}</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          </div>
        )}
      </header>

      {config && (
        <div className="h-1.5 w-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500 ease-in-out", config.color)}
            style={{ width: `${config.progress}%` }}
          />
        </div>
      )}

      <div className="divide-y divide-border">
        {alerts.map((a, i) => (
          <div key={i} className={`p-4 flex gap-3 ${a.severity === "high" ? "bg-rowAlert" : ""}`}>
            <div className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center ${a.severity === "high" ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="esc-chip bg-secondary text-foreground">{a.type}</span>
                <span className="font-display font-semibold text-sm text-foreground">{a.title}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{a.desc}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-info font-medium">Sugestão IA: {a.suggest}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="sm" className="h-7 text-xs">Corrigir</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs">Ignorar</Button>
            </div>
          </div>
        ))}
      </div>

      <footer className="border-t border-border px-5 py-3 bg-background/50 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> 5 verificações automáticas concluídas
        </span>
        <span className="text-muted-foreground">Última análise: agora</span>
      </footer>
    </section>
  );
};
