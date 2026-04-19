import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const issues = [
  { tipo: "Equipe insuficiente", origem: "OP-1042", desc: "Registrada para 3 colaboradores, apenas 1 com ponto ativo", grav: "alta", status: "inconsistente" as const },
  { tipo: "Volume incompatível", origem: "OP-1045", desc: "500 volumes em 20 minutos — possível erro de digitação", grav: "alta", status: "inconsistente" as const },
  { tipo: "Ponto incompleto", origem: "Jainudin", desc: "Sem registro de saída", grav: "média", status: "pendente" as const },
  { tipo: "Operação sem vínculo", origem: "Hikmat Sofyan", desc: "Ponto registrado, sem operação no período", grav: "média", status: "pendente" as const },
];

const Inconsistencias = () => {
  return (
    <AppShell title="Inconsistências" subtitle="Detectadas pela IA · Cruzamento ponto × operação">
      <div className="space-y-4">
        <section className="esc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="esc-table-header">
              <tr className="text-left">
                <th className="px-5 h-11 font-medium">Tipo</th>
                <th className="px-3 h-11 font-medium">Origem</th>
                <th className="px-3 h-11 font-medium">Descrição</th>
                <th className="px-3 h-11 font-medium text-center">Gravidade</th>
                <th className="px-3 h-11 font-medium text-center">Status</th>
                <th className="px-5 h-11 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((it, i) => (
                <tr key={i} className="border-t border-muted hover:bg-background">
                  <td className="px-5 h-[60px]">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${it.grav === "alta" ? "text-destructive" : "text-warning"}`} />
                      <span className="font-medium text-foreground">{it.tipo}</span>
                    </div>
                  </td>
                  <td className="px-3 text-foreground">{it.origem}</td>
                  <td className="px-3 text-muted-foreground">{it.desc}</td>
                  <td className="px-3 text-center capitalize">
                    <span className={`esc-chip ${it.grav === "alta" ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"}`}>
                      {it.grav}
                    </span>
                  </td>
                  <td className="px-3 text-center"><StatusChip status={it.status} /></td>
                  <td className="px-5 text-center">
                    <Button size="sm" variant="outline" className="h-7">
                      <Sparkles className="h-3 w-3 mr-1" /> Corrigir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
};

export default Inconsistencias;
