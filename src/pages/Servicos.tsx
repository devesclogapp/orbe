import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, PowerOff, Loader2 } from "lucide-react";
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteErrorDetails, setDeleteErrorDetails] = useState<{ tabela: string; count: number; ids?: string[] }[]>([]);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["tipos_servico_operacional"],
    queryFn: () => TipoServicoOperacionalService.getAllActive(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    refetchOnMount: true,
  });

  const [formErrors, setFormErrors] = useState<any>({});

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    empresa_id: "",
    ativo: true,
  });

  const getServicoErrorMessage = (err: any) => {
    const msg = (err?.message || err?.error || "").toLowerCase();
    if (msg.includes("duplicate key value") || msg.includes("unique") || err?.code === '23505') {
      return "Já existe um tipo de serviço com este nome.";
    }
    if (msg.includes("check constraint")) {
      return "Informe o nome do tipo de serviço.";
    }
    return err?.message || "Erro ao processar tipo de serviço.";
  };

  const reset = () => {
    setForm({
      nome: "",
      descricao: "",
      empresa_id: empresaOptions[0]?.id ?? "",
      ativo: true,
    });
    setFormErrors({});
    setEditingId(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => TipoServicoOperacionalService.create(payload),
    onSuccess: () => {
      toast.success("Tipo de serviço cadastrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(getServicoErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => TipoServicoOperacionalService.update(id, payload),
    onSuccess: () => {
      toast.success("Tipo de serviço atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      setOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(getServicoErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await TipoServicoOperacionalService.deleteWithCheck(id);
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Tipo de serviço excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao excluir tipo de serviço");
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      TipoServicoOperacionalService.toggleAtivo(id, ativo),
    onSuccess: async (_data, { ativo }) => {
      toast.success(ativo ? "Tipo de serviço ativado com sucesso" : "Tipo de serviço desativado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar status");
    },
  });

  const handleDeleteClick = async (item: any) => {
    setItemToDelete(item);
    console.log(`[Servicos] Tentando excluir: ${item.nome} (${item.id})`);
    const result = await TipoServicoOperacionalService.deleteWithCheck(item.id);
    console.log(`[Servicos] Resultado deleteWithCheck:`, result);
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
    if (!form.nome?.trim()) {
      setFormErrors({ nome: "Informe o nome do tipo de serviço." });
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setFormErrors({});

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
              {editingId ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="servico_nome">
                Nome <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="servico_nome"
                value={form.nome}
                onChange={(e) => {
                  setForm({ ...form, nome: e.target.value });
                  setFormErrors((prev: any) => ({ ...prev, nome: undefined }));
                }}
                placeholder="Nome do tipo de serviço"
                aria-invalid={Boolean(formErrors.nome)}
                aria-required="true"
                className={formErrors.nome ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
              {formErrors.nome ? <p className="mt-1 text-sm text-destructive" role="alert">{formErrors.nome}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="servico_descricao">Descrição</Label>
              <Input
                id="servico_descricao"
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
            <Button 
              onClick={submit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              className={createMutation.isPending || updateMutation.isPending ? "opacity-70 cursor-not-allowed" : ""}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
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

export default Servicos;
