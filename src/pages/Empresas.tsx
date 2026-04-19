import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { EmpresaService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Cpu, Loader2, RefreshCw } from "lucide-react";
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
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    unidade: "",
    cidade: "",
    estado: "",
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getWithCounts(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => EmpresaService.create(payload),
    onSuccess: () => {
      toast.success("Empresa cadastrada");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setOpen(false);
      setForm({ nome: "", cnpj: "", unidade: "", cidade: "", estado: "" });
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message })
  });

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
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["empresas"] })}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((e: any) => (
              <article key={e.id} className="esc-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "esc-chip",
                      e.status === "ativa" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {e.status === "ativa" ? "Ativa" : "Inativa"}
                  </span>
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
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma nova unidade operacional no sistema.</DialogDescription>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar"}
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
