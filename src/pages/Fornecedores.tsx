import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, PowerOff } from "lucide-react";
import { FornecedorService, EmpresaService } from "@/services/base.service";
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

const Fornecedores = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteErrorDetails, setDeleteErrorDetails] = useState<{ tabela: string; count: number; ids?: string[] }[]>([]);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => FornecedorService.getByEmpresa(),
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
    mutationFn: (payload: any) => FornecedorService.create(payload),
    onSuccess: () => {
      toast.success("Fornecedor cadastrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao cadastrar");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => FornecedorService.update(id, payload),
    onSuccess: () => {
      toast.success("Fornecedor atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await FornecedorService.deleteWithCheck(id);
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Fornecedor excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao excluir fornecedor");
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      FornecedorService.toggleAtivo(id, ativo),
    onSuccess: async (_data, { ativo }) => {
      toast.success(ativo ? "Fornecedor ativado com sucesso" : "Fornecedor desativado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar status");
    },
  });

  const handleDeleteClick = async (item: any) => {
    setItemToDelete(item);
    console.log(`[Fornecedores] Tentando excluir: ${item.nome} (${item.id})`);
    const result = await FornecedorService.deleteWithCheck(item.id);
    console.log(`[Fornecedores] Resultado deleteWithCheck:`, result);
    if (result.success) {
      if (confirm("Confirmar exclusão definitiva? Esta ação não pode ser desfeita.")) {
        deleteMutation.mutate(item.id);
      }
    } else {
      setDeleteErrorDetails(result.detalhes || []);
      setDeleteModalOpen(true);
    }
  };

  const handleConfirmDeactivate = () => {
    if (itemToDelete) {
      toggleAtivoMutation.mutate({ id: itemToDelete.id, ativo: false });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

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
    <AppShell title="Fornecedores" subtitle="Gestão de fornecedores" backPath="/cadastros">
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
          <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
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
                  Nenhum fornecedor encontrado
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
                      {item.ativo === true ? "Ativo" : "Inativo"}
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
                        className="h-8 w-8 text-amber-600 hover:text-amber-700"
                        onClick={() => {
                          toggleAtivoMutation.mutate({ id: item.id, ativo: !item.ativo });
                        }}
                        title={item.ativo ? "Desativar" : "Ativar"}
                      >
                        {item.ativo ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <ToggleRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(item)}
                        title="Excluir"
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
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do fornecedor"
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
                placeholder="contato@fornecedor.com"
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

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Exclusão não permitida</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>{itemToDelete?.nome}</strong> possui vínculos operacionais e não pode ser excluído.
            </p>
            {deleteErrorDetails.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md max-h-[200px] overflow-y-auto">
                <p className="text-xs font-medium text-amber-800 mb-2">Vínculos encontrados:</p>
                <div className="space-y-2">
                  {deleteErrorDetails.map((detalhe, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium text-amber-900">{detalhe.tabela}:</span>{' '}
                      <span className="text-amber-700">{detalhe.count} registro(s)</span>
                      {detalhe.ids && detalhe.ids.length > 0 && (
                        <div className="text-amber-600 mt-0.5 pl-2 text-[10px]">
                          IDs: {detalhe.ids.join(', ')}
                          {detalhe.count > 3 && ` (+${detalhe.count - 3} mais)`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Deseja desativá-lo? O registro permanecerá no histórico com status Inativo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setItemToDelete(null); setDeleteErrorDetails([]); }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDeactivate} disabled={toggleAtivoMutation.isPending}>
              {toggleAtivoMutation.isPending ? "Processando..." : "Desativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Fornecedores;
