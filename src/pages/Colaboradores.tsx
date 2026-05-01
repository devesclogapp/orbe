import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Pencil, Trash2, LayoutGrid, List, User, Briefcase, Building2, FileText, DollarSign, Receipt, CheckCircle2, MoreHorizontal, AlertTriangle } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Filter states
  const [searchText, setSearchText] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [selectedContrato, setSelectedContrato] = useState("all");

  // Queries
  const { data: list = [], isLoading, isFetching, isError, error: queryError } = useQuery({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    cargo: "",
    matricula: "",
    empresa_id: "",
    tipo_contrato: "Hora" as "Hora" | "Operação",
    tipo_colaborador: "CLT",
    valor_base: "22",
    flag_faturamento: true,
    permitir_lancamento_operacional: false,
    status: "ativo",
  });

  const reset = () => {
    setForm({
      nome: "",
      cpf: "",
      telefone: "",
      cargo: "",
      matricula: "",
      empresa_id: empresaOptions[0]?.id ?? "",
      tipo_contrato: "Hora",
      tipo_colaborador: "CLT",
      valor_base: "22",
      flag_faturamento: true,
      permitir_lancamento_operacional: false,
      status: "ativo",
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
      nome: c.nome || "",
      cpf: c.cpf || "",
      telefone: c.telefone || "",
      cargo: c.cargo || "",
      matricula: c.matricula || "",
      empresa_id: c.empresa_id || "",
      tipo_contrato: c.tipo_contrato || "Hora",
      tipo_colaborador: c.tipo_colaborador || "CLT",
      valor_base: String(c.valor_base || 0),
      flag_faturamento: c.flag_faturamento ?? true,
      permitir_lancamento_operacional: c.permitir_lancamento_operacional ?? false,
      status: c.status || "ativo",
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      deleteMutation.mutate(id);
    }
  };

  const submit = () => {
    if (!form.nome.trim()) {
      toast.error("Preencha o nome do colaborador");
      return;
    }
    if (!form.empresa_id && !empresaOptions[0]?.id) {
      toast.error("Selecione uma empresa");
      return;
    }
    // Para tipos diferentes de DIARISTA, cargo e matrícula são obrigatórios
    if (form.tipo_colaborador !== "DIARISTA") {
      if (!form.cargo.trim()) {
        toast.error("Preencha o cargo");
        return;
      }
    }
    createMutation.mutate({
      nome: form.nome.trim(),
      cpf: form.cpf?.trim() || null,
      telefone: form.telefone?.trim() || null,
      cargo: form.cargo?.trim() || null,
      matricula: form.matricula?.trim() || null,
      empresa_id: form.empresa_id || empresaOptions[0]?.id,
      tipo_contrato: form.tipo_colaborador === "DIARISTA" ? null : form.tipo_contrato,
      tipo_colaborador: form.tipo_colaborador,
      valor_base: Number(form.valor_base) || 0,
      flag_faturamento: form.tipo_colaborador !== "DIARISTA" ? form.flag_faturamento : false,
      permitir_lancamento_operacional: form.permitir_lancamento_operacional,
      status: form.status,
    });
  };

  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 w-full">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-10 border-border"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </div>
            </div>

            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[200px] h-10">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresaOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedContrato} onValueChange={setSelectedContrato}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="DIARISTA">Diarista</SelectItem>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="INTERMITENTE">Intermitente</SelectItem>
                <SelectItem value="PRODUÇÃO">Produção</SelectItem>
                <SelectItem value="TERCEIRIZADO">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex border rounded-lg overflow-hidden mr-2 bg-background">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-10 w-10 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-10 w-10 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button className="h-10 px-4 w-full md:w-auto font-display font-semibold" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo colaborador
            </Button>
          </div>
        </div>

        <section className={cn(viewMode === 'table' ? "esc-card overflow-hidden" : "")}>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">Carregando colaboradores...</p>
              </div>
            </div>
          ) : isError ? (
            /* ... (keeping existing error state logic but it might be duplicated in target content if I'm not careful) ... */
            <div className="flex flex-col items-center justify-center p-12 text-center esc-card">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-display font-semibold text-foreground text-sm">Erro ao carregar dados</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mt-1 mb-4">
                {(queryError as any)?.message || "Não foi possível conectar ao servidor."}
              </p>
              <Button variant="outline" size="sm" className="h-8" onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}>
                Tentar novamente
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Nome</span></th>
                  <th className="px-3 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />Cargo</span></th>
                  <th className="px-3 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />Empresa</span></th>
                  <th className="px-3 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />Tipo</span></th>
                  <th className="px-3 h-11 font-medium text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor base</span></th>
                  <th className="px-3 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-muted-foreground" />Faturamento</span></th>
                  <th className="px-5 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
                  <th className="px-5 h-11 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(list || []).filter((c: any) => {
                  const matchesSearch = c.nome.toLowerCase().includes(searchText.toLowerCase()) ||
                    (c.matricula || "").toLowerCase().includes(searchText.toLowerCase());
                  const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
                  const matchesContrato = selectedContrato === "all" || c.tipo_colaborador === selectedContrato;
                  return matchesSearch && matchesEmpresa && matchesContrato;
                }).map((c: any) => (
                  <tr key={c.id} className="border-t border-muted hover:bg-background group">
                    <td className="px-5 h-[52px]">
                      <div className="font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">Mat. {c.matricula}</div>
                    </td>
                    <td className="px-3 text-muted-foreground">{c.cargo}</td>
                    <td className="px-3 text-muted-foreground">{c.empresas?.nome || "—"}</td>
                    <td className="px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        c.tipo_colaborador === "DIARISTA"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {c.tipo_colaborador || c.tipo_contrato || "—"}
                      </span>
                    </td>
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
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(list || []).filter((c: any) => {
                const matchesSearch = (c.nome || "").toLowerCase().includes(searchText.toLowerCase()) ||
                  (c.matricula || "").toLowerCase().includes(searchText.toLowerCase());
                const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
                const matchesContrato = selectedContrato === "all" || c.tipo_colaborador === selectedContrato;
                return matchesSearch && matchesEmpresa && matchesContrato;
              }).map((c: any) => (
                <article key={c.id} className="esc-card p-5 group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-full bg-primary-soft flex items-center justify-center text-primary font-bold">
                        {c.nome.substring(0, 1).toUpperCase()}
                      </div>
                      <StatusChip status={c.status} />
                    </div>
                    <h3 className="font-display font-bold text-lg text-foreground mb-1">{c.nome}</h3>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2"><User className="h-3 w-3" /> {c.cargo}</span>
                      <span className="font-mono text-[10px]">MATRÍCULA {c.matricula}</span>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    <div className="text-xs">
                      <div className="text-muted-foreground uppercase text-[9px] font-bold tracking-tight">Valor Base</div>
                      <div className="font-bold text-foreground">R$ {(c.valor_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
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
              <Label>Tipo de colaborador</Label>
              <Select value={form.tipo_colaborador} onValueChange={(v) => setForm({ ...form, tipo_colaborador: v, permitir_lancamento_operacional: v === "DIARISTA" ? true : form.permitir_lancamento_operacional })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIARISTA">DIARISTA</SelectItem>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="INTERMITENTE">INTERMITENTE</SelectItem>
                  <SelectItem value="PRODUÇÃO">PRODUÇÃO</SelectItem>
                  <SelectItem value="TERCEIRIZADO">TERCEIRIZADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.tipo_colaborador === "DIARISTA" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="valor">Valor da diária (R$)</Label>
                  <Input
                    id="valor"
                    type="number"
                    value={form.valor_base}
                    onChange={(e) => setForm({ ...form, valor_base: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cargo">Função operacional</Label>
                  <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Label htmlFor="lancamento" className="cursor-pointer">Permitir lançamento operacional</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Diarista aparecerá na tela de lançamentos operacionais da produção.
                    </p>
                  </div>
                  <Switch id="lancamento" checked={form.permitir_lancamento_operacional} onCheckedChange={(v) => setForm({ ...form, permitir_lancamento_operacional: v })} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="matricula">Matrícula</Label>
                  <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
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
              </>
            )}
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
