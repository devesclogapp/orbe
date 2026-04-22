import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { EmpresaService, ColetorService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import { Plus, Cpu, Wifi, WifiOff, AlertTriangle, Loader2, RefreshCw, LayoutGrid, List } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";



const statusMap = {
  online: { label: "Online", icon: Wifi, cls: "bg-success-soft text-success-strong" },
  offline: { label: "Offline", icon: WifiOff, cls: "bg-muted text-muted-foreground" },
  erro: { label: "Erro", icon: AlertTriangle, cls: "bg-destructive-soft text-destructive-strong" },
};

const Coletores = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [form, setForm] = useState({
    modelo: "",
    serie: "",
    empresa_id: "",
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["coletores"],
    queryFn: () => ColetorService.getWithEmpresa(),
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => ColetorService.create(payload),
    onSuccess: () => {
      toast.success("Coletor cadastrado");
      queryClient.invalidateQueries({ queryKey: ["coletores"] });
      setOpen(false);
      setForm({ modelo: "", serie: "", empresa_id: "" });
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message })
  });

  const submit = () => {
    if (!form.modelo.trim() || !form.serie.trim() || !form.empresa_id) {
      toast.error("Preencha todos os campos");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <AppShell title="Coletores REP" subtitle="Dispositivos de ponto eletrônico">
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
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => queryClient.invalidateQueries({ queryKey: ["coletores"] })}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button className="h-9 px-4 font-display font-semibold text-sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Cadastrar coletor
            </Button>
          </div>
        </div>

        <section className={cn(viewMode === 'table' ? "esc-card overflow-hidden" : "")}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground animate-pulse font-bold tracking-widest uppercase">Detectando hardware REP...</p>
            </div>
          ) : viewMode === 'table' ? (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Identificação</th>
                  <th className="px-3 h-11 font-medium">Modelo / Série</th>
                  <th className="px-3 h-11 font-medium">Empresa</th>
                  <th className="px-3 h-11 font-medium text-center">Última sync</th>
                  <th className="px-5 h-11 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c: any) => {
                  const s = statusMap[c.status as keyof typeof statusMap] || statusMap.offline;
                  const Icon = s.icon;
                  return (
                    <tr key={c.id} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[60px]">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium text-foreground">{c.id.substring(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-3">
                        <div className="text-foreground">{c.modelo}</div>
                        <div className="text-xs text-muted-foreground">{c.serie}</div>
                      </td>
                      <td className="px-3 text-muted-foreground">{c.empresas?.nome || "—"}</td>
                      <td className="px-3 text-center text-muted-foreground">
                        {c.ultima_sync ? new Date(c.ultima_sync).toLocaleString('pt-BR') : "Nunca"}
                      </td>
                      <td className="px-5 text-center">
                        <span className={cn("esc-chip inline-flex items-center gap-1", s.cls)}>
                          <Icon className="h-3 w-3" /> {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((c: any) => {
                const s = statusMap[c.status as keyof typeof statusMap] || statusMap.offline;
                const Icon = s.icon;
                return (
                  <article key={c.id} className="esc-card p-5 group flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Cpu className="h-5 w-5" />
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-tight inline-flex items-center gap-1", s.cls)}>
                          <Icon className="h-3 w-3" /> {s.label}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-foreground mb-1">{c.modelo}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">{c.serie}</p>
                      <p className="text-xs text-muted-foreground mt-3 font-medium">{(c.empresas as any)?.nome || "Unidade não vinculada"}</p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Sync: {c.ultima_sync ? format(new Date(c.ultima_sync), "dd/MM/yy HH:mm") : "Nunca"}</span>
                      <span className="font-mono opacity-50">#{c.id.substring(0, 5)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Coletor</DialogTitle>
            <DialogDescription>Adicione um novo dispositivo REP ao sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="modelo">Modelo do Equipamento</Label>
              <Input id="modelo" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: Henry Prisma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serie">Número de Série</Label>
              <Input id="serie" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="REP-000-000" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa / Unidade</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {empresaOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Coletores;
