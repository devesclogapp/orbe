import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
import { TransportadoraClienteService, EmpresaService } from "@/services/base.service";
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

const Transportadoras = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["transportadoras_list"],
    queryFn: () => TransportadoraClienteService.getByEmpresa(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    refetchOnMount: true,
  });

  const [form, setForm] = useState({
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    endereco: "",
    empresa_id: "",
    ativo: true,
  });

  const reset = () => {
    setForm({
      nome: "",
      documento: "",
      telefone: "",
      email: "",
      endereco: "",
      empresa_id: empresaOptions[0]?.id ?? "",
      ativo: true,
    });
    setEditingId(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => TransportadoraClienteService.create(payload),
    onSuccess: () => {
      toast.success("Transportadora cadastrada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["transportadoras_list"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao cadastrar");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => TransportadoraClienteService.update(id, payload),
    onSuccess: () => {
      toast.success("Transportadora atualizada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["transportadoras_list"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => TransportadoraClienteService.update(id, { ativo: false }),
    onSuccess: () => {
      toast.success("Transportadora desativada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["transportadoras_list"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao desativar");
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
    item.ativo !== false &&
    (selectedEmpresa === "all" || item.empresa_id === selectedEmpresa) &&
    (item.nome?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.documento?.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <AppShell title="Transportadoras" subtitle="Gestão de transportadoras e clientes" backPath="/cadastros">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou documento..."
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
          <Plus className="h-4 w-4 mr-2" /> Nova transportadora
        </Button>
      </div>

      <div className="esc-card overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="esc-table-header">
            <tr className="text-left">
              <th className="px-4 h-11 font-medium">Nome</th>
              <th className="px-4 h-11 font-medium">CNPJ/CPF</th>
              <th className="px-4 h-11 font-medium">Telefone</th>
              <th className="px-4 h-11 font-medium">Email</th>
              <th className="px-4 h-11 font-medium">Endereço</th>
              <th className="px-4 h-11 font-medium text-center">Status</th>
              <th className="px-4 h-11 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma transportadora encontrada
                </td>
              </tr>
            ) : (
              filteredList.map((item: any) => (
                <tr key={item.id} className="border-t border-muted hover:bg-background">
                  <td className="px-4 h-14 font-medium">{item.nome}</td>
                  <td className="px-4 text-muted-foreground">{item.documento || "—"}</td>
                  <td className="px-4 text-muted-foreground">{item.telefone || "—"}</td>
                  <td className="px-4 text-muted-foreground">{item.email || "—"}</td>
                  <td className="px-4 text-muted-foreground text-xs">{item.endereco || "—"}</td>
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
                            documento: item.documento,
                            telefone: item.telefone,
                            email: item.email,
                            endereco: item.endereco,
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
                          if (confirm("Confirmar desativação?")) {
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
              {editingId ? "Editar Transportadora" : "Nova Transportadora"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome da transportadora"
              />
            </div>
            <div className="grid gap-2">
              <Label>CNPJ/CPF</Label>
              <Input
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contato@transportadora.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade"
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

export default Transportadoras;