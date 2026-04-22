import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { BHRegraService } from "@/services/v4.service";
import { EmpresaService } from "@/services/base.service";
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
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/painel/StatusChip";

const RegrasBH = () => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["bh_regras"],
        queryFn: () => BHRegraService.getWithEmpresa(),
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const [form, setForm] = useState({
        nome: "",
        empresa_id: "",
        prazo_compensacao_dias: "60",
        tipo: "acumula" as "acumula" | "zera" | "expira",
        status: "ativo" as "ativo" | "inativo",
    });

    const reset = () => setForm({
        nome: "",
        empresa_id: "",
        prazo_compensacao_dias: "60",
        tipo: "acumula",
        status: "ativo",
    });

    const createMutation = useMutation({
        mutationFn: (payload: any) => BHRegraService.create(payload),
        onSuccess: () => {
            toast.success("Regra criada com sucesso");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao criar regra", { description: err.message })
    });

    const submit = () => {
        if (!form.nome || !form.empresa_id) {
            toast.error("Preencha o nome e selecione a empresa");
            return;
        }
        createMutation.mutate({
            ...form,
            empresa_id: form.empresa_id === 'global' ? null : form.empresa_id,
            prazo_compensacao_dias: parseInt(form.prazo_compensacao_dias),
        });
    };

    const deleteMutation = useMutation({
        mutationFn: (id: string) => BHRegraService.delete(id),
        onSuccess: () => {
            toast.success("Regra removida");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
        },
        onError: (err: any) => toast.error("Erro ao remover regra", { description: err.message })
    });

    const handleDelete = (id: string) => {
        if (confirm("Deseja realmente excluir esta regra?")) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <AppShell title="Regras de Banco de Horas" subtitle="Defina políticas de validade e compensação">
            <div className="space-y-4">
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_regras"] })}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={() => setOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Nova regra
                    </Button>
                </div>

                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Nome da Regra</th>
                                    <th className="px-3 h-11 font-medium">Empresa Vinculada</th>
                                    <th className="px-3 h-11 font-medium text-center">Prazo (Dias)</th>
                                    <th className="px-3 h-11 font-medium text-center">Tipo</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {regras.map((r: any) => (
                                    <tr key={r.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-[52px] font-medium text-foreground">{r.nome}</td>
                                        <td className="px-3 text-muted-foreground">{(r.empresas as any)?.nome || "Todas"}</td>
                                        <td className="px-3 text-center">{r.prazo_compensacao_dias} dias</td>
                                        <td className="px-3 text-center capitalize">{r.tipo}</td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={r.status === 'ativo' ? 'ok' : 'inconsistente'} label={r.status} />
                                        </td>
                                        <td className="px-5 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-error hover:text-error hover:bg-error/10"
                                                onClick={() => handleDelete(r.id)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {regras.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                            Nenhuma regra configurada ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Nova Regra de Compensação</DialogTitle>
                        <DialogDescription>
                            Defina como as horas extras serão tratadas no banco desta empresa.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nome">Nome da política</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: Compensação Padrão 60 dias"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Empresa</Label>
                            <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global">Todas as Empresas (Global)</SelectItem>
                                    {empresas.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="prazo">Prazo (Dias)</Label>
                                <Input
                                    id="prazo"
                                    type="number"
                                    value={form.prazo_compensacao_dias}
                                    onChange={(e) => setForm({ ...form, prazo_compensacao_dias: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tipo de Política</Label>
                                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="acumula">Acumula</SelectItem>
                                        <SelectItem value="zera">Zera Periódico</SelectItem>
                                        <SelectItem value="expira">Expira Automático</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={submit} disabled={createMutation.isPending}>
                            {createMutation.isPending ? "Criando..." : "Criar Regra"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RegrasBH;
