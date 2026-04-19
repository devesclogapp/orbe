import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { colaboradores as initialColabs, empresas, Colaborador } from "@/data/mock";
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

const Colaboradores = () => {
  const [list, setList] = useState<Colaborador[]>(initialColabs);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cargo: "",
    matricula: "",
    empresaId: empresas[0]?.id ?? "",
    contrato: "Hora" as "Hora" | "Operação",
    valorBase: "22",
    faturamento: true,
  });

  const reset = () =>
    setForm({
      nome: "",
      cargo: "",
      matricula: "",
      empresaId: empresas[0]?.id ?? "",
      contrato: "Hora",
      valorBase: "22",
      faturamento: true,
    });

  const submit = () => {
    if (!form.nome.trim() || !form.cargo.trim() || !form.matricula.trim()) {
      toast.error("Preencha nome, cargo e matrícula");
      return;
    }
    const empresa = empresas.find((e) => e.id === form.empresaId);
    const novo: Colaborador = {
      id: `C${String(Date.now()).slice(-4)}`,
      nome: form.nome.trim(),
      cargo: form.cargo.trim(),
      matricula: form.matricula.trim(),
      empresaId: form.empresaId,
      empresa: empresa?.nome ?? "—",
      contrato: form.contrato,
      valorBase: Number(form.valorBase) || 0,
      faturamento: form.faturamento,
      status: "pendente",
      admissao: new Date().toLocaleDateString("pt-BR"),
    };
    setList((prev) => [novo, ...prev]);
    toast.success("Colaborador cadastrado", { description: novo.nome });
    setOpen(false);
    reset();
  };

  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo colaborador
          </Button>
        </div>

        <section className="esc-card overflow-hidden">
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
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-muted hover:bg-background">
                  <td className="px-5 h-[52px]">
                    <div className="font-medium text-foreground">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">Mat. {c.matricula}</div>
                  </td>
                  <td className="px-3 text-muted-foreground">{c.cargo}</td>
                  <td className="px-3 text-muted-foreground">{c.empresa}</td>
                  <td className="px-3 text-center">{c.contrato}</td>
                  <td className="px-3 text-right font-display font-medium">
                    R$ {c.valorBase.toFixed(2).replace(".", ",")}
                  </td>
                  <td className="px-3 text-center text-muted-foreground">{c.faturamento ? "Sim" : "Não"}</td>
                  <td className="px-5 text-center"><StatusChip status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Novo colaborador</DialogTitle>
            <DialogDescription>
              Cadastre manualmente um colaborador. Vínculo com empresa define qual coletor REP recebe o ponto.
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
              <Select value={form.empresaId} onValueChange={(v) => setForm({ ...form, empresaId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de contrato</Label>
              <Select value={form.contrato} onValueChange={(v: "Hora" | "Operação") => setForm({ ...form, contrato: v })}>
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
                value={form.valorBase}
                onChange={(e) => setForm({ ...form, valorBase: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="fat" className="cursor-pointer">Gera faturamento</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se desligado, o colaborador não entra no cálculo financeiro do dia.
                </p>
              </div>
              <Switch id="fat" checked={form.faturamento} onCheckedChange={(v) => setForm({ ...form, faturamento: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Colaboradores;
