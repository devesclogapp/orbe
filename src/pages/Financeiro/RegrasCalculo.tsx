import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RegraCalculoService, ClienteService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Scale, Tag, Clock, Trash2, Pencil, Loader2, CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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

const RegrasCalculo = () => {
    const queryClient = useQueryClient();
    const [filterCliente, setFilterCliente] = useState<string>("todos");
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        nome: "",
        tipo: "adicional" as "adicional" | "desconto",
        valor: "0",
        cliente_id: "geral",
        status: "ativo" as "ativo" | "inativo",
    });

    const resetForm = () => {
        setForm({
            nome: "",
            tipo: "adicional",
            valor: "0",
            cliente_id: "geral",
            status: "ativo",
        });
        setEditingId(null);
    };

    // Queries
    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["regras_calculo"],
        queryFn: () => RegraCalculoService.getAllActive(),
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ["clientes"],
        queryFn: () => ClienteService.getAll(),
    });

    // Mutations
    const saveMutation = useMutation({
        mutationFn: (payload: any) => editingId
            ? RegraCalculoService.updateVersioned(editingId, payload)
            : RegraCalculoService.create(payload),
        onSuccess: () => {
            toast.success(editingId ? "Regra atualizada" : "Regra criada com sucesso");
            queryClient.invalidateQueries({ queryKey: ["regras_calculo"] });
            setOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast.error("Erro ao salvar regra", { description: error.message });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => RegraCalculoService.delete(id),
        onSuccess: () => {
            toast.success("Regra removida");
            queryClient.invalidateQueries({ queryKey: ["regras_calculo"] });
        },
        onError: (error: any) => {
            toast.error("Erro ao remover", { description: error.message });
        }
    });

    // Handlers
    const handleEdit = (r: any) => {
        setEditingId(r.id);
        setForm({
            nome: r.nome,
            tipo: r.tipo as "adicional" | "desconto",
            valor: String(r.valor),
            cliente_id: r.cliente_id || "geral",
            status: (r.status as "ativo" | "inativo") || "ativo",
        });
        setOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("Deseja realmente excluir esta regra? Esta ação não pode ser desfeita.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = () => {
        if (!form.nome.trim()) {
            toast.error("O nome da regra é obrigatório");
            return;
        }

        const payload = {
            nome: form.nome.trim(),
            tipo: form.tipo,
            valor: Number(form.valor) || 0,
            cliente_id: form.cliente_id === "geral" ? null : form.cliente_id,
            status: form.status,
        };

        saveMutation.mutate(payload);
    };

    const filtered = filterCliente === "todos"
        ? regras
        : regras.filter((r: any) => r.cliente_id === filterCliente);

    return (
        <AppShell title="Regras de Cálculo" subtitle="Gestão de adicionais, descontos e composições financeiras">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Select value={filterCliente} onValueChange={setFilterCliente}>
                            <SelectTrigger className="h-9 w-[220px]">
                                <SelectValue placeholder="Filtrar por Cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Clientes</SelectItem>
                                {clientes.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Nova Regra
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((r: any) => (
                            <article key={r.id} className="esc-card p-5 relative overflow-hidden group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "h-9 w-9 rounded-md flex items-center justify-center",
                                            r.tipo === 'adicional' ? "bg-success-soft text-success-strong" : "bg-destructive-soft text-destructive-strong"
                                        )}>
                                            <Scale className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-semibold text-foreground text-sm">{r.nome}</h3>
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-tight">{r.tipo}</p>
                                        </div>
                                    </div>
                                    <Badge variant={r.status === 'ativo' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                                        {r.status}
                                    </Badge>
                                </div>

                                <div className="my-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground inline-flex items-center gap-1.5"><Tag className="h-3 w-3" /> Valor esperado</span>
                                        <span className="font-display font-bold text-lg text-foreground">
                                            R$ {Number(r.valor).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> Vigência</span>
                                        <span className="text-foreground">
                                            {(r as any).vigencia_inicio ? new Date((r as any).vigencia_inicio).toLocaleDateString('pt-BR') : 'Sem data'}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[150px]">
                                        {r.cliente_id ? clientes.find((c: any) => c.id === r.cliente_id)?.nome : 'Geral (Todos os clientes)'}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(r)}
                                            className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(r.id)}
                                            className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {filtered.length === 0 && (
                            <div className="col-span-full p-20 text-center text-muted-foreground italic border border-dashed rounded-xl">
                                Nenhuma regra cadastrada encontrada {filterCliente !== 'todos' ? 'para este cliente' : ''}.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); setOpen(val); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar Regra" : "Nova Regra"}</DialogTitle>
                        <DialogDescription>
                            Configure os parâmetros para cálculo automático de faturamento.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nome">Nome da Regra</Label>
                            <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Adicional Noturno 20%" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Tipo</Label>
                                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="adicional">Adicional (+)</SelectItem>
                                        <SelectItem value="desconto">Desconto (-)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="valor">Valor (R$)</Label>
                                <Input id="valor" type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Cliente Vinculado</Label>
                            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="geral">Geral (Todos os Clientes)</SelectItem>
                                    {clientes.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ativo">Ativo</SelectItem>
                                    <SelectItem value="inativo">Inativo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Regra"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RegrasCalculo;
