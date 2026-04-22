import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { EmpresaService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Cpu, Loader2, RefreshCw, Pencil, Trash2, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { toast } from "sonner";

const Empresas = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    unidade: "",
    cidade: "",
    estado: "",
  });

  const reset = () => {
    setForm({ nome: "", cnpj: "", unidade: "", cidade: "", estado: "" });
    setEditingId(null);
  };

  const { data: list = [], isLoading, isFetching, isError, error: queryError } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getWithCounts(),
    retry: 1
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? EmpresaService.update(editingId, payload)
      : EmpresaService.create(payload),
    onSuccess: () => {
      toast.success(editingId ? "Empresa atualizada" : "Empresa cadastrada");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => toast.error(editingId ? "Erro ao atualizar" : "Erro ao cadastrar", { description: err.message })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => EmpresaService.delete(id),
    onSuccess: () => {
      toast.success("Empresa removida");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (err: any) => toast.error("Erro ao remover", { description: err.message })
  });

  const handleEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      cnpj: e.cnpj,
      unidade: e.unidade,
      cidade: e.cidade,
      estado: e.estado,
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente remover esta empresa? Todos os colaboradores e registros vinculados serão afetados.")) {
      deleteMutation.mutate(id);
    }
  };

  const submit = () => {
    if (!form.nome.trim() || !form.cnpj.trim()) {
      toast.error("Preencha o nome e CNPJ");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <AppShell title="Empresas" subtitle="Cadastro de empresas e unidades operacionais">
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-background p-2 rounded-lg border border-border/50">
          <div className="flex border rounded-lg overflow-hidden bg-background">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => queryClient.invalidateQueries({ queryKey: ["empresas"] })}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button className="h-9 px-4 font-display font-semibold text-sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground animate-pulse">Carregando unidades...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card text-center">
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="font-display font-semibold text-foreground">Falha ao obter empresas</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-md">
              {(queryError as any)?.message || "Erro desconhecido ao carregar dados operacionais."}
            </p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["empresas"] })}>
              Tentar reconectar
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card border-dashed">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground italic">Nenhuma empresa cadastrada ainda.</p>
            <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
              Cadastrar primeira empresa
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((e: any) => (
              <article key={e.id} className="esc-card p-5 group relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "esc-chip",
                        e.status === "ativa" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {e.status === "ativa" ? "Ativa" : "Inativa"}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-foreground">{e.nome}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{e.cnpj}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-2">
                  <MapPin className="h-3 w-3" /> {e.unidade} — {e.cidade}/{e.estado}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <Stat icon={<Users className="h-3.5 w-3.5" />} label="Colaboradores" value={e.total_colaboradores} />
                  <Stat icon={<Cpu className="h-3.5 w-3.5" />} label="Coletores" value={e.total_coletores} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="esc-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Empresa</th>
                  <th className="px-3 h-11 font-medium">CNPJ</th>
                  <th className="px-3 h-11 font-medium text-center">Colaboradores</th>
                  <th className="px-3 h-11 font-medium text-center">Coletores</th>
                  <th className="px-3 h-11 font-medium text-center">Status</th>
                  <th className="px-5 h-11 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {list.map((e: any) => (
                  <tr key={e.id} className="hover:bg-background group">
                    <td className="px-5 h-14">
                      <div className="font-medium text-foreground">{e.nome}</div>
                      <div className="text-xs text-muted-foreground">{e.unidade} — {e.cidade}/{e.estado}</div>
                    </td>
                    <td className="px-3 text-muted-foreground font-mono text-xs">{e.cnpj}</td>
                    <td className="px-3 text-center font-bold text-primary">{e.total_colaboradores}</td>
                    <td className="px-3 text-center">{e.total_coletores}</td>
                    <td className="px-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-tight",
                        e.status === 'ativa' ? 'bg-success-soft text-success-strong' : 'bg-muted text-muted-foreground'
                      )}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize as informações da unidade operacional." : "Cadastre uma nova unidade operacional no sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome da Empresa</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unidade">Unidade (Filial)</Label>
                <Input id="unidade" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input id="estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div>
    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">{icon} {label}</div>
    <div className="font-display font-semibold text-foreground text-lg">{value}</div>
  </div>
);

export default Empresas;
