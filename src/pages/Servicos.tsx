import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { TipoServicoOperacionalService, EmpresaService } from "@/services/base.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Servicos = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["tipos_servico_list"],
    queryFn: () => TipoServicoOperacionalService.getByEmpresa(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    refetchOnMount: true,
  });

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    empresa_id: "",
    ativo: true,
  });

  const reset = () => {
    setForm({
      nome: "",
      descricao: "",
      empresa_id: empresaOptions[0]?.id ?? "",
      ativo: true,
    });
    setEditingId(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => TipoServicoOperacionalService.create(payload),
    onSuccess: () => {
      toast.success("Tipo de serviço cadastrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_list"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao cadastrar");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => TipoServicoOperacionalService.update(id, payload),
    onSuccess: () => {
      toast.success("Tipo de serviço atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_list"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => TipoServicoOperacionalService.delete(id),
    onSuccess: () => {
      toast.success("Tipo de serviço excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_list"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao excluir");
    },
  });

  const submit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filteredList = list.filter((item: any) =>
    (selectedEmpresa === "all" || item.empresa_id === selectedEmpresa) &&
    (item.nome?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.descricao?.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <AppShell title="Tipos de Serviço" subtitle="Gestão de tipos de serviço" backPath="/cadastros">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <select
            value={selectedEmpresa}
            onChange={(e) => setSelectedEmpresa(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm w-[200px]"
          >
            <option value="all">Todas as empresas</option>
            {empresaOptions.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo tipo de serviço
        </Button>
      </div>

      <div className="esc-card overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="esc-table-header">
            <tr className="text-left">
              <th className="px-4 h-11 font-medium">Nome</th>
              <th className="px-4 h-11 font-medium">Descrição</th>
              <th className="px-4 h-11 font-medium text-center">Status</th>
              <th className="px-4 h-11 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum tipo de serviço encontrado
                </td>
              </tr>
            ) : (
              filteredList.map((item: any) => (
                <tr key={item.id} className="border-t border-muted hover:bg-background">
                  <td className="px-4 h-14 font-medium">{item.nome}</td>
                  <td className="px-4 text-muted-foreground">{item.descricao || "—"}</td>
                  <td className="px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.ativo ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                    }`}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            nome: item.nome,
                            descricao: item.descricao,
                            empresa_id: item.empresa_id,
                            ativo: item.ativo,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Confirmar exclusão?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Volume, Carro, Palet"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição do tipo de serviço"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              <label htmlFor="ativo" className="text-sm">Ativo</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Servicos;