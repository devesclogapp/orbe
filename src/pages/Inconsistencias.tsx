import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OperacaoProducaoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { AlertTriangle, Sparkles, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminOverride } from "@/hooks/useAdminOverride";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { NovaOperacaoDialog } from "@/components/operacoes/NovaOperacaoDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const getInconsistencyReason = (item: any): string => {
  if (item.status_rh === "DEVOLVIDO_RH") {
    const motivoRh = item.avaliacao_json?.motivo_devolucao_rh;
    return motivoRh ? `Devolvido pelo RH: ${motivoRh}` : "Operação devolvida pelo RH para revisão";
  }

  const infractionColab = item.production_entry_collaborators?.find((c: any) => c.had_infraction);
  if (infractionColab) {
    const colabNome = infractionColab.colaboradores?.nome || item.colaboradores?.nome || "Colaborador";
    const nota = infractionColab.infraction_notes || infractionColab.infraction_type_id || "Infração registrada";
    return `Infração (${colabNome}): ${nota}`;
  }

  if (!item.entrada_ponto || !item.saida_ponto || item.avaliacao_json?.motivo_restricao === "Horário de início e/ou término não informado") {
    return "Horário de início e/ou término não informado";
  }

  if (item.status === "EM_RESTRICAO") {
    const motivoRestricao = item.avaliacao_json?.motivo_restricao || item.motivo_exclusao;
    return motivoRestricao ? `Restrição: ${motivoRestricao}` : "Operação retida em restrição operacional";
  }

  return "Pendência operacional em análise";
};

const getInconsistencyGravity = (item: any): "alta" | "média" => {
  if (item.status_rh === "DEVOLVIDO_RH") return "alta";
  if (item.production_entry_collaborators?.some((c: any) => c.had_infraction)) return "alta";
  return "média";
};

const Inconsistencias = ({ flowType, lockedFlow }: { flowType?: string; lockedFlow?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["inconsistencias"],
    queryFn: () => OperacaoProducaoService.getInconsistencies(),
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
      await OperacaoProducaoService.updateWithOverride(id, payload, justification);
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
    }
  });

  const handleResolve = async (issue: any) => {
    // Defesa: Não liberar sem horários de início e término preenchidos
    if (!issue.entrada_ponto || !issue.saida_ponto) {
      toast.error("Horário de início e término não informado", {
        description: "Edite a operação para preencher os horários de início e término antes de liberá-la."
      });
      return;
    }

    const id = issue.id;
    // Retorna a operação para reavaliação no fluxo operacional regular
    const payload = {
      status: 'RECEBIDO',
      status_rh: 'PENDENTE_RH',
    };

    // Tenta executar. Se retornar true, o hook abriu o modal de override.
    const needsOverride = checkAndExecute(id, payload, issue.status);

    if (!needsOverride) {
      try {
        await OperacaoProducaoService.update(id, payload);
        toast.success("Operação liberada para reavaliação com sucesso");
        queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      } catch (error: any) {
        toast.error(error.message || "Erro ao liberar operação");
      }
    }
  };

  return (
    <AppShell title="Inconsistências" subtitle="Pendências operacionais e devoluções · Operações por Volume">
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
                  const grav = getInconsistencyGravity(it);
                  return (
                    <tr key={it.id || i} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[60px]">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${grav === "alta" ? "text-destructive" : "text-warning"}`} />
                          <span className="font-medium text-foreground">{it.tipos_servico_operacional?.nome || 'Operação por Volume'}</span>
                        </div>
                      </td>
                      <td className="px-3 text-foreground">{it.id.substring(0, 8)}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">
                          {getInconsistencyReason(it)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Volume: {Number(it.quantidade || 0).toLocaleString("pt-BR")} un.
                          {it.colaboradores?.nome ? ` · Colaborador: ${it.colaboradores.nome}` : ""}
                        </div>
                      </td>
                      <td className="px-3 text-center capitalize">
                        <span className={`esc-chip ${grav === "alta" ? "bg-destructive-soft text-destructive-strong" : "bg-warning-soft text-warning-strong"}`}>
                          {grav}
                        </span>
                      </td>
                      <td className="px-3 text-center"><StatusChip status={it.status} /></td>
                      <td className="px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 hover:bg-muted text-xs px-2"
                            onClick={() => setEditingItem(it)}
                            title="Editar horários e dados da operação"
                          >
                            <Pencil className="h-3 w-3 mr-1 text-slate-500" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 hover:bg-success-soft hover:text-success-strong border-muted text-xs px-2"
                            onClick={() => handleResolve(it)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Liberar
                          </Button>
                        </div>
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

      {editingItem && (
        <NovaOperacaoDialog
          open={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingItem(null);
              queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
              queryClient.invalidateQueries({ queryKey: ["operacoes"] });
              queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            }
          }}
          initialData={editingItem}
        />
      )}
    </AppShell>
  );
};

export default Inconsistencias;
