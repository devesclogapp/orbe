import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { ColaboradorService, EmpresaService } from "@/services/base.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Colaboradores = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Queries
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const [form, setForm] = useState({
    nome: "",
    cargo: "",
    matricula: "",
    empresa_id: "",
    tipo_contrato: "Hora" as "Hora" | "Operação",
    valor_base: "22",
    flag_faturamento: true,
  });

  const reset = () => {
    setForm({
      nome: "",
      cargo: "",
      matricula: "",
      empresa_id: empresaOptions[0]?.id ?? "",
      tipo_contrato: "Hora",
      valor_base: "22",
      flag_faturamento: true,
    });
    setEditingId(null);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? ColaboradorService.update(editingId, payload)
      : ColaboradorService.create(payload),
    onSuccess: () => {
      toast.success(editingId ? "Colaborador atualizado" : "Colaborador cadastrado");
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => toast.error(editingId ? "Erro ao atualizar" : "Erro ao cadastrar", { description: err.message })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ColaboradorService.delete(id),
    onSuccess: () => {
      toast.success("Colaborador removido");
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
    },
    onError: (err: any) => toast.error("Erro ao remover", { description: err.message })
  });

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      cargo: c.cargo,
      matricula: c.matricula,
      empresa_id: c.empresa_id,
      tipo_contrato: c.tipo_contrato,
      valor_base: String(c.valor_base),
      flag_faturamento: c.flag_faturamento,
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      deleteMutation.mutate(id);
    }
  };

  const submit = () => {
    if (!form.nome.trim() || !form.cargo.trim() || !form.matricula.trim()) {
      toast.error("Preencha nome, cargo e matrícula");
      return;
    }
    createMutation.mutate({
      nome: form.nome.trim(),
      cargo: form.cargo.trim(),
      matricula: form.matricula.trim(),
      empresa_id: form.empresa_id || empresaOptions[0]?.id,
      tipo_contrato: form.tipo_contrato,
      valor_base: Number(form.valor_base) || 0,
      flag_faturamento: form.flag_faturamento,
      status: "pendente",
    });
  };

  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo colaborador
          </Button>
        </div>

        <section className="esc-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Nome</th>
                  <th className="px-3 h-11 font-medium">Cargo</th>
                  <th className="px-3 h-11 font-medium">Empresa</th>
                  <th className="px-3 h-11 font-medium text-center">Contrato</th>
                  <th className="px-3 h-11 font-medium text-right">Valor base</th>
                  <th className="px-3 h-11 font-medium text-center">Faturamento</th>
                  <th className="px-5 h-11 font-medium text-center">Status</th>
                  <th className="px-5 h-11 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c: any) => (
                  <tr key={c.id} className="border-t border-muted hover:bg-background group">
                    <td className="px-5 h-[52px]">
                      <div className="font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">Mat. {c.matricula}</div>
                    </td>
                    <td className="px-3 text-muted-foreground">{c.cargo}</td>
                    <td className="px-3 text-muted-foreground">{c.empresas?.nome || "—"}</td>
                    <td className="px-3 text-center">{c.tipo_contrato}</td>
                    <td className="px-3 text-right font-display font-medium">
                      R$ {(c.valor_base || 0).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-3 text-center text-muted-foreground">{c.flag_faturamento ? "Sim" : "Não"}</td>
                    <td className="px-5 text-center"><StatusChip status={c.status} /></td>
                    <td className="px-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground italic">
                      Nenhum colaborador cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize as informações do colaborador." : "Cadastre manualmente um colaborador. Vínculo com empresa define qual coletor REP recebe o ponto."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Empresa</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                <SelectContent>
                  {empresaOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de contrato</Label>
              <Select value={form.tipo_contrato} onValueChange={(v: "Hora" | "Operação") => setForm({ ...form, tipo_contrato: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hora">Por hora</SelectItem>
                  <SelectItem value="Operação">Por operação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor base (R$)</Label>
              <Input
                id="valor"
                type="number"
                value={form.valor_base}
                onChange={(e) => setForm({ ...form, valor_base: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="fat" className="cursor-pointer">Gera faturamento</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se desligado, o colaborador não entra no cálculo financeiro do dia.
                </p>
              </div>
              <Switch id="fat" checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Colaboradores;
