import { useQuery } from "@tanstack/react-query";
import { OperacaoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { AlertTriangle, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminOverride } from "@/hooks/useAdminOverride";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Inconsistencias = () => {
  const queryClient = useQueryClient();
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["inconsistencias"],
    queryFn: () => OperacaoService.getInconsistencies(),
  });

  const {
    isOpen,
    isUpdating,
    pendingStatus,
    checkAndExecute,
    handleConfirm,
    handleClose
  } = useAdminOverride({
    onUpdate: async (id, payload, justification) => {
      await OperacaoService.updateWithOverride(id, payload, justification);
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
    }
  });

  const handleResolve = async (issue: any) => {
    const id = issue.id;
    const payload = { status: 'ok' };

    // Tenta executar. Se retornar true, o hook abriu o modal de override.
    const needsOverride = checkAndExecute(id, payload, issue.status);

    if (!needsOverride) {
      try {
        await OperacaoService.update(id, payload);
        toast.success("Inconsistência resolvida com sucesso");
        queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      } catch (error: any) {
        toast.error(error.message || "Erro ao resolver inconsistência");
      }
    }
  };

  return (
    <AppShell title="Inconsistências" subtitle="Detectadas pela IA · Cruzamento ponto × operação">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                {issues.map((it: any, i: number) => {
                  const grav = it.quantidade > 1000 ? "alta" : "média";
                  return (
                    <tr key={it.id || i} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[60px]">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${grav === "alta" ? "text-destructive" : "text-warning"}`} />
                          <span className="font-medium text-foreground">{it.tipo_servico}</span>
                        </div>
                      </td>
                      <td className="px-3 text-foreground">{it.id.substring(0, 8)}</td>
                      <td className="px-3 text-muted-foreground">
                        {it.quantidade} {it.tipo_servico === 'Volume' ? 'volumes' : 'carros'} lançados por {it.colaboradores?.nome}
                      </td>
                      <td className="px-3 text-center capitalize">
                        <span className={`esc-chip ${grav === "alta" ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"}`}>
                          {grav}
                        </span>
                      </td>
                      <td className="px-3 text-center"><StatusChip status={it.status} /></td>
                      <td className="px-5 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 hover:bg-success-soft hover:text-success-strong border-muted"
                          onClick={() => handleResolve(it)}
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> Corrigir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                      Nenhuma inconsistência detectada no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <JustificationModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        status={pendingStatus}
        isLoading={isUpdating}
      />
    </AppShell>
  );
};

export default Inconsistencias;
