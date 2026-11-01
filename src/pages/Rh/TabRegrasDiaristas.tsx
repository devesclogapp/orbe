import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, CheckCircle2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmpresaService,
  RegraMarcacaoDiaristaPayload,
  RegraMarcacaoDiaristaService,
} from "@/services/base.service";

const GLOBAL_SCOPE = "__GLOBAL__";

const normalizeCodigo = (codigo: string) =>
  codigo.trim().toUpperCase().replace(/\s+/g, "");

export const TabRegrasDiaristas = () => {
  const queryClient = useQueryClient();
  const { isOnboardingReturn, handleOnboardingReturn } = useOnboardingCallback();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const [form, setForm] = useState<RegraMarcacaoDiaristaPayload>({
    empresa_id: null,
    codigo: "",
    descricao: "",
    multiplicador: 1.0,
    ativo: true,
  });

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["regras_marcacao_diaristas_crud"],
    queryFn: () => RegraMarcacaoDiaristaService.getAll(),
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_all"],
    queryFn: () => EmpresaService.getAll(),
  });

  const resetForm = () => {
    setEditingRule(null);
    setForm({
      empresa_id: null,
      codigo: "",
      descricao: "",
      multiplicador: 1.0,
      ativo: true,
    });
    setIsModalOpen(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const codigoNormalizado = normalizeCodigo(form.codigo);
      const descricaoNormalizada = form.descricao?.trim() ?? "";

      if (!codigoNormalizado) {
        throw new Error("Código é obrigatório.");
      }

      if (!descricaoNormalizada) {
        throw new Error("Descrição é obrigatória.");
      }

      const regraDuplicada = (regras as any[]).find((regra) => {
        const codigoExistente = normalizeCodigo(regra.codigo ?? "");
        const mesmoEscopo =
          String(regra.empresa_id ?? "") === String(form.empresa_id ?? "");

        return (
          codigoExistente === codigoNormalizado &&
          mesmoEscopo &&
          String(regra.id) !== String(editingRule?.id ?? "")
        );
      });

      if (regraDuplicada) {
        const escopo =
          form.empresa_id
            ? `na empresa "${regraDuplicada.empresas?.nome || "selecionada"}"`
            : "no escopo global";

        throw new Error(
          `Já existe uma regra com o código "${codigoNormalizado}" ${escopo}. Edite a existente ou informe outro código.`,
        );
      }

      const payload = {
        ...form,
        codigo: codigoNormalizado,
        descricao: descricaoNormalizada,
        multiplicador: Number(form.multiplicador),
      };

      if (editingRule) {
        return RegraMarcacaoDiaristaService.update(editingRule.id, payload);
      }

      return RegraMarcacaoDiaristaService.create(payload);
    },
    onSuccess: () => {
      toast.success("Regra salva com sucesso.");
      queryClient.invalidateQueries({
        queryKey: ["regras_marcacao_diaristas_crud"],
      });
      queryClient.invalidateQueries({
        queryKey: ["regras_marcacao_diaristas"],
      });
      resetForm();

      if (isOnboardingReturn) {
        handleOnboardingReturn();
      }
    },
    onError: (err: any) => {
      const message = String(err?.message ?? "");

      if (
        message.includes("idx_regras_diar_uni_codigo") ||
        message.includes("idx_regras_diar_tenant_empresa_codigo_uni") ||
        message.includes("duplicate key value violates unique constraint")
      ) {
        const empresa = (empresas as any[]).find(
          (item) => String(item.id) === String(form.empresa_id ?? ""),
        );
        const escopo = form.empresa_id
          ? `na empresa "${empresa?.nome || "selecionada"}"`
          : "no escopo global";

        toast.error("Erro ao salvar", {
          description: `Já existe uma regra com o código "${normalizeCodigo(form.codigo)}" ${escopo}. Edite a existente ou informe outro código.`,
        });
        return;
      }

      toast.error("Erro ao salvar", { description: message });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (rule: any) =>
      RegraMarcacaoDiaristaService.update(rule.id, { ativo: !rule.ativo }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      queryClient.invalidateQueries({
        queryKey: ["regras_marcacao_diaristas_crud"],
      });
      queryClient.invalidateQueries({
        queryKey: ["regras_marcacao_diaristas"],
      });
    },
    onError: (err: any) => {
      toast.error("Erro", { description: err.message });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-foreground tracking-tight">
            Multiplicadores do Módulo Diaristas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Códigos operacionais, legendas e multiplicadores aplicados sobre a diária base.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs font-medium gap-1.5 font-display font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Regra
        </Button>
      </div>

      <div className="relative rounded-lg border border-border/80 overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs text-left border-collapse min-w-[720px]">
          <thead className="bg-muted/40 border-b border-border/80">
            <tr className="hover:bg-transparent">
              <th className="px-3.5 py-2.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[100px]">Código</th>
              <th className="px-3.5 py-2.5 text-left font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Descrição</th>
              <th className="px-3.5 py-2.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[130px]">Multiplicador</th>
              <th className="px-3.5 py-2.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[130px]">Escopo</th>
              <th className="px-3.5 py-2.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[110px]">Status</th>
              <th className="px-3.5 py-2.5 text-right font-semibold text-muted-foreground text-[11px] uppercase tracking-wider pr-4 w-[100px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {(regras as any[]).map((regra) => (
              <tr key={regra.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3.5 py-2.5 text-center">
                  <span className="font-mono font-bold text-xs text-foreground px-2 py-0.5 rounded-[4px] bg-muted/60 border border-border/70">
                    {regra.codigo}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-left font-medium text-foreground">
                  {regra.descricao}
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <span className="rounded-[4px] border border-border/60 bg-muted/50 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground font-semibold">
                    x {Number(regra.multiplicador).toFixed(2)}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <span className="inline-flex justify-center">
                    {regra.empresa_id ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium border border-border/80 bg-background text-foreground">
                        {regra.empresas?.nome || "Unidade"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-mono bg-muted/60 text-muted-foreground border border-border/60">
                        Global
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <span className="inline-flex justify-center">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium border",
                      regra.ativo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", regra.ativo ? "bg-emerald-600 dark:bg-emerald-400" : "bg-slate-400")} />
                      {regra.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-right pr-4">
                  <TooltipProvider delayDuration={150}>
                    <div className="flex justify-end items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label="Editar regra"
                            onClick={() => {
                              setEditingRule(regra);
                              setForm({
                                empresa_id: regra.empresa_id,
                                codigo: regra.codigo,
                                descricao: regra.descricao,
                                multiplicador: regra.multiplicador,
                                ativo: regra.ativo,
                              });
                              setIsModalOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar regra</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "h-7 w-7",
                              regra.ativo
                                ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            )}
                            aria-label={regra.ativo ? "Inativar regra" : "Ativar regra"}
                            onClick={() => toggleStatusMutation.mutate(regra)}
                          >
                            {regra.ativo ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{regra.ativo ? "Inativar" : "Ativar"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </td>
              </tr>
            ))}

            {(regras as any[]).length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma regra específica encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Escopo da Regra</Label>
              <Select
                value={form.empresa_id ?? GLOBAL_SCOPE}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    empresa_id: value === GLOBAL_SCOPE ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o escopo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_SCOPE}>Global</SelectItem>
                  {(empresas as any[]).map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use `Global` para reutilizar a regra em todo o tenant ou escolha
                uma empresa para criar uma variação personalizada.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código / Letra (Ex: P, MP, HE)</Label>
              <Input
                value={form.codigo}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    codigo: normalizeCodigo(e.target.value),
                  }))
                }
                placeholder="Digite o código"
                disabled={editingRule !== null}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    descricao: e.target.value,
                  }))
                }
                placeholder="Ex: Hora Extra 100%"
              />
            </div>

            <div className="space-y-2">
              <Label>Multiplicador da Diária Base</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.multiplicador}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    multiplicador: Number(e.target.value),
                  }))
                }
                placeholder="1.0"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Status da Regra</Label>
                <p className="text-xs text-muted-foreground">
                  Apenas as ativas aparecem na tela de lançamento.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, ativo: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending || !form.codigo || !form.descricao?.trim()
              }
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
