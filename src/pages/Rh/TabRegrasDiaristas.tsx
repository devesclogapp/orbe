import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">
            Multiplicadores do Módulo Diaristas
          </h2>
          <p className="text-sm text-muted-foreground">
            Adicione códigos, legendas e o multiplicador que atuará no valor da
            diária.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Código</TableHead>
              <TableHead className="text-center">Descrição</TableHead>
              <TableHead className="text-center">Multiplicador</TableHead>
              <TableHead className="text-center">Escopo</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(regras as any[]).map((regra) => (
              <TableRow key={regra.id}>
                <TableCell className="text-center font-semibold">
                  {regra.codigo}
                </TableCell>
                <TableCell className="text-center">
                  {regra.descricao}
                </TableCell>
                <TableCell className="text-center">
                  <span className="rounded border bg-muted/50 px-2 py-0.5 font-mono text-muted-foreground">
                    x {Number(regra.multiplicador).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex justify-center">
                    {regra.empresa_id ? (
                      <Badge variant="outline">
                        {regra.empresas?.nome || "Unidade"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-800"
                      >
                        Global
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex justify-center">
                    {regra.ativo ? (
                      <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground"
                      >
                        <Ban className="mr-1 h-3 w-3" />
                        Inativo
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate(regra)}
                      className="h-8 w-8 p-0"
                      title={regra.ativo ? "Inativar" : "Ativar"}
                    >
                      {regra.ativo ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
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
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {(regras as any[]).length === 0 && !isLoading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma regra específica encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
