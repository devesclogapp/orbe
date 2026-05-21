import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { EmpresaService, ColetorService, UnidadeOperacionalService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import {
  Plus, Cpu, Wifi, WifiOff, AlertTriangle, Loader2,
  RefreshCw, LayoutGrid, List, Pencil, CloudCog, Upload, PlugZap,
  CheckCircle2, XCircle,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ─── Mapas de exibição ───────────────────────────────────────────────────────

const statusMap = {
  online: { label: "Online", icon: Wifi, cls: "bg-success-soft text-success-strong" },
  offline: { label: "Offline", icon: WifiOff, cls: "bg-muted text-muted-foreground" },
  erro: { label: "Erro", icon: AlertTriangle, cls: "bg-destructive-soft text-destructive-strong" },
};

const integracaoMap: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  google_drive: { label: "Google Drive", icon: CloudCog, cls: "bg-blue-500/10 text-blue-600" },
  api_direta: { label: "API Direta", icon: PlugZap, cls: "bg-purple-500/10 text-purple-600" },
  upload_manual: { label: "Upload Manual", icon: Upload, cls: "bg-amber-500/10 text-amber-600" },
};

// ─── Formulário padrão ────────────────────────────────────────────────────────

const emptyForm = () => ({
  // Dados do coletor
  modelo: "",
  serie: "",
  empresa_id: "",
  unidade_id: "",
  unidade_local: "",
  fabricante: "",
  // Integração
  tipo_integracao: "upload_manual" as string,
  formato_arquivo: "AFD" as string,
  integracao_ativa: true,
  intervalo_sincronizacao_minutos: 5,
  // Google Drive
  folder_entrada_url: "",
  folder_entrada_id: "",
  folder_processados_url: "",
  folder_processados_id: "",
  folder_erros_url: "",
  folder_erros_id: "",
});

type ColetorForm = ReturnType<typeof emptyForm>;

// ─── Componente principal ─────────────────────────────────────────────────────

const Coletores = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [form, setForm] = useState<ColetorForm>(emptyForm());

  const f = (key: keyof ColetorForm, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["coletores"],
    queryFn: () => ColetorService.getWithEmpresa(),
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: unidadeOptions = [] } = useQuery({
    queryKey: ["unidades", form.empresa_id],
    queryFn: () => UnidadeOperacionalService.getByEmpresa(form.empresa_id),
    enabled: !!form.empresa_id,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: ColetorForm) => ColetorService.create(payload),
    onSuccess: () => {
      toast.success("Coletor cadastrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["coletores"] });
      closeDialog();
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ColetorForm }) =>
      ColetorService.update(id, payload),
    onSuccess: () => {
      toast.success("Coletor atualizado");
      queryClient.invalidateQueries({ queryKey: ["coletores"] });
      closeDialog();
    },
    onError: (err: any) => toast.error("Erro ao atualizar", { description: err.message }),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openEdit = (c: any) => {
    setForm({
      modelo: c.modelo ?? "",
      serie: c.serie ?? "",
      empresa_id: c.empresa_id ?? "",
      unidade_id: c.unidade_id ?? "",
      unidade_local: c.unidade_local ?? "",
      fabricante: c.fabricante ?? "",
      tipo_integracao: c.tipo_integracao ?? "upload_manual",
      formato_arquivo: c.formato_arquivo ?? "AFD",
      integracao_ativa: c.integracao_ativa ?? true,
      intervalo_sincronizacao_minutos: c.intervalo_sincronizacao_minutos ?? 5,
      folder_entrada_url: c.folder_entrada_url ?? "",
      folder_entrada_id: c.folder_entrada_id ?? "",
      folder_processados_url: c.folder_processados_url ?? "",
      folder_processados_id: c.folder_processados_id ?? "",
      folder_erros_url: c.folder_erros_url ?? "",
      folder_erros_id: c.folder_erros_id ?? "",
    });
    setEditingId(c.id);
    setOpen(true);
  };

  const submit = () => {
    if (!form.modelo.trim() || !form.serie.trim() || !form.empresa_id) {
      toast.error("Preencha os campos obrigatórios: Modelo, Série e Empresa");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isDrive = form.tipo_integracao === "google_drive";

  const handleUrlChange = (key: keyof ColetorForm, idKey: keyof ColetorForm, url: string) => {
    const id = ColetorService.extractFolderIdFromUrl(url);
    setForm(prev => ({ ...prev, [key]: url, [idKey]: id || "" }));
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Coletores REP" subtitle="Dispositivos de ponto eletrônico e integração">
      <div className="space-y-4">

        {/* Toolbar */}
        <div className="flex justify-between items-center bg-background p-2 rounded-lg border border-border/50">
          <div className="flex border rounded-lg overflow-hidden bg-background">
            <Button
              variant="ghost" size="icon"
              className={cn("h-9 w-9 rounded-none border-r transition-all",
                viewMode === "grid" ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={cn("h-9 w-9 rounded-none transition-all",
                viewMode === "table" ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="icon" className="h-9 w-9"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["coletores"] })}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              className="h-9 px-4 font-display font-semibold text-sm"
              onClick={() => { setEditingId(null); setForm(emptyForm()); setOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Cadastrar coletor
            </Button>
          </div>
        </div>

        {/* Tabela / Grid */}
        <section className={cn(viewMode === "table" ? "esc-card overflow-hidden" : "")}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground animate-pulse font-bold tracking-widest uppercase">
                Detectando hardware REP...
              </p>
            </div>
          ) : viewMode === "table" ? (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Modelo / Série</th>
                  <th className="px-3 h-11 font-medium">Empresa / Unidade</th>
                  <th className="px-3 h-11 font-medium">Integração</th>
                  <th className="px-3 h-11 font-medium">Formato</th>
                  <th className="px-3 h-11 font-medium text-center">Última Sync</th>
                  <th className="px-3 h-11 font-medium text-center">Status</th>
                  <th className="px-5 h-11 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      Nenhum coletor cadastrado.
                    </td>
                  </tr>
                ) : list.map((c: any) => {
                  const s = statusMap[c.status as keyof typeof statusMap] ?? statusMap.offline;
                  const intg = c.tipo_integracao ? integracaoMap[c.tipo_integracao] : null;
                  const IIcon = intg?.icon;
                  return (
                    <tr key={c.id} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[60px]">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{c.modelo}</div>
                            <div className="text-xs text-muted-foreground font-mono">{c.serie}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3">
                        <div className="text-foreground">{(c.empresas as any)?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.unidade?.nome || c.unidade_local || "—"}
                        </div>
                      </td>
                      <td className="px-3">
                        {intg && IIcon ? (
                          <span className={cn("esc-chip inline-flex items-center gap-1.5", intg.cls)}>
                            <IIcon className="h-3 w-3" /> {intg.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3">
                        {c.formato_arquivo ? (
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            {c.formato_arquivo}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 text-center text-muted-foreground text-xs">
                        {c.ultima_importacao_at
                          ? new Date(c.ultima_importacao_at).toLocaleString("pt-BR")
                          : "Nunca"}
                      </td>
                      <td className="px-3 text-center">
                        <span className={cn("esc-chip inline-flex items-center gap-1",
                          c.ultimo_erro ? "bg-destructive-soft text-destructive-strong" :
                            c.integracao_ativa ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground")}>
                          {c.ultimo_erro ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {c.ultimo_erro ? "Erro" : c.integracao_ativa ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 text-center">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEdit(c)}
                          title="Editar coletor"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((c: any) => {
                const s = statusMap[c.status as keyof typeof statusMap] ?? statusMap.offline;
                const intg = c.tipo_integracao ? integracaoMap[c.tipo_integracao] : null;
                const SIcon = s.icon;
                const IIcon = intg?.icon;
                return (
                  <article key={c.id} className="esc-card p-5 group flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Cpu className="h-5 w-5" />
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-tight inline-flex items-center gap-1", s.cls)}>
                          <SIcon className="h-3 w-3" /> {s.label}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-foreground mb-1">{c.modelo}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">{c.serie}</p>
                      <p className="text-xs text-muted-foreground mt-1">{(c.empresas as any)?.nome ?? "Sem empresa"}</p>
                      {intg && IIcon && (
                        <span className={cn("mt-3 esc-chip inline-flex items-center gap-1.5 text-[10px]", intg.cls)}>
                          <IIcon className="h-3 w-3" /> {intg.label}
                          {c.formato_arquivo && ` · ${c.formato_arquivo}`}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        {c.integracao_ativa
                          ? <CheckCircle2 className="h-3 w-3 text-success-strong" />
                          : <XCircle className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-[10px] text-muted-foreground">
                          {c.integracao_ativa ? "Integração ativa" : "Integração inativa"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Sync: {c.ultima_sync ? new Date(c.ultima_sync).toLocaleDateString("pt-BR") : "Nunca"}
                      </span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── Dialog: Novo / Editar Coletor ─────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Coletor REP" : "Cadastrar Coletor REP"}</DialogTitle>
            <DialogDescription>
              Transformar o cadastro em uma central de integração operacional completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">

            {/* ── SEÇÃO 1: DADOS DO COLETOR ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-1">
                <div className="h-5 w-1 bg-primary rounded-full" />
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">
                  1. Dados do Coletor
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="modelo">Modelo <span className="text-destructive">*</span></Label>
                  <Input
                    id="modelo"
                    value={form.modelo}
                    onChange={e => f("modelo", e.target.value)}
                    placeholder="Ex: Henry Prisma"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="serie">Número de Série <span className="text-destructive">*</span></Label>
                  <Input
                    id="serie"
                    value={form.serie}
                    onChange={e => f("serie", e.target.value)}
                    placeholder="REP-000-000"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Empresa <span className="text-destructive">*</span></Label>
                  <Select value={form.empresa_id} onValueChange={v => {
                    f("empresa_id", v);
                    f("unidade_id", "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>
                      {(empresaOptions as any[]).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade / Local <span className="text-destructive">*</span></Label>
                  <Select value={form.unidade_id} onValueChange={v => f("unidade_id", v)}>
                    <SelectTrigger disabled={!form.empresa_id}>
                      <SelectValue placeholder={!form.empresa_id ? "Selecione a empresa primeiro" : "Selecione a unidade"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(unidadeOptions as any[]).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fabricante">Fabricante</Label>
                <Input
                  id="fabricante"
                  value={form.fabricante}
                  onChange={e => f("fabricante", e.target.value)}
                  placeholder="Henry, Dimep, Control, ZKTeco..."
                />
              </div>
            </div>

            {/* ── SEÇÃO 2: INTEGRAÇÃO DE PONTO ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-1">
                <div className="h-5 w-1 bg-primary rounded-full" />
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">
                  2. Integração de Ponto
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo de Integração</Label>
                  <Select value={form.tipo_integracao} onValueChange={v => f("tipo_integracao", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_drive">☁️ Google Drive</SelectItem>
                      <SelectItem value="api_direta">⚡ API Direta</SelectItem>
                      <SelectItem value="upload_manual">📁 Upload Manual</SelectItem>
                      <SelectItem value="rede_local">🌐 Rede Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Formato do Arquivo</Label>
                  <Select value={form.formato_arquivo} onValueChange={v => f("formato_arquivo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AFD">AFD</SelectItem>
                      <SelectItem value="CSV">CSV</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                      <SelectItem value="XLSX">XLSX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 flex flex-col gap-2">
                  <Label>Integração Ativa</Label>
                  <div className="flex items-center gap-2 h-10 border rounded-md px-3 bg-muted/20">
                    <Switch
                      checked={form.integracao_ativa}
                      onCheckedChange={v => f("integracao_ativa", v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.integracao_ativa ? "Habilitado" : "Desabilitado"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Sincronização (min)</Label>
                  <Input
                    type="number"
                    value={form.intervalo_sincronizacao_minutos}
                    onChange={e => f("intervalo_sincronizacao_minutos", parseInt(e.target.value) || 5)}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* ── SEÇÃO 3: GOOGLE DRIVE ── */}
            {isDrive && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 border-b pb-1">
                  <div className="h-5 w-1 bg-blue-500 rounded-full" />
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                    3. Configuração Google Drive
                  </p>
                </div>

                <div className="grid gap-4 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-blue-700">Pasta Entrada (URL ou ID)</Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={form.folder_entrada_url}
                        onChange={e => handleUrlChange("folder_entrada_url", "folder_entrada_id", e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="font-mono text-xs border-blue-500/20"
                      />
                      {form.folder_entrada_id && (
                        <p className="text-[10px] text-blue-600 font-mono flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> ID Extraído: {form.folder_entrada_id}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-blue-700">Pasta Processados (URL ou ID)</Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={form.folder_processados_url}
                        onChange={e => handleUrlChange("folder_processados_url", "folder_processados_id", e.target.value)}
                        placeholder="URL da pasta de sucesso"
                        className="font-mono text-xs border-blue-500/20"
                      />
                      {form.folder_processados_id && (
                        <p className="text-[10px] text-blue-600 font-mono flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> ID Extraído: {form.folder_processados_id}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-blue-700">Pasta Erros (URL ou ID)</Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={form.folder_erros_url}
                        onChange={e => handleUrlChange("folder_erros_url", "folder_erros_id", e.target.value)}
                        placeholder="URL da pasta de erros"
                        className="font-mono text-xs border-blue-500/20"
                      />
                      {form.folder_erros_id && (
                        <p className="text-[10px] text-blue-600 font-mono flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> ID Extraído: {form.folder_erros_id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={submit} disabled={isPending} className="font-bold">
              {isPending
                ? editingId ? "Salvando..." : "Cadastrando..."
                : editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
};

export default Coletores;
