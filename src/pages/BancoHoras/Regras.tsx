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
        carga_horaria_diaria: "8.00",
        tolerancia_atraso: "5",
        tolerancia_hora_extra: "0",
        limite_diario_banco: "480",
        validade_horas: "60",
        regra_compensacao: "automatico",
        regra_vencimento: "acumula",
        bh_ativo: true,
        jornada_contratada: "8.00",
        origem_ponto: "manual",
    });

    const reset = () => setForm({
        nome: "",
        empresa_id: "",
        prazo_compensacao_dias: "60",
        tipo: "acumula",
        status: "ativo",
        carga_horaria_diaria: "8.00",
        tolerancia_atraso: "5",
        tolerancia_hora_extra: "0",
        limite_diario_banco: "480",
        validade_horas: "60",
        regra_compensacao: "automatico",
        regra_vencimento: "acumula",
        bh_ativo: true,
        jornada_contratada: "8.00",
        origem_ponto: "manual",
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
            nome: form.nome,
            empresa_id: form.empresa_id === 'global' ? null : form.empresa_id,
            prazo_compensacao_dias: parseInt(form.prazo_compensacao_dias),
            tipo: form.tipo,
            status: form.status,
            carga_horaria_diaria: parseFloat(form.carga_horaria_diaria),
            tolerancia_atraso: parseInt(form.tolerancia_atraso),
            tolerancia_hora_extra: parseInt(form.tolerancia_hora_extra),
            limite_diario_banco: parseInt(form.limite_diario_banco),
            validade_horas: parseInt(form.validade_horas),
            regra_compensacao: form.regra_compensacao,
            regra_vencimento: form.regra_vencimento,
            bh_ativo: form.bh_ativo,
            jornada_contratada: parseFloat(form.jornada_contratada),
            origem_ponto: form.origem_ponto,
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
                                    <th className="px-3 h-11 font-medium">Empresa</th>
                                    <th className="px-3 h-11 font-medium text-center">Carga Hor.</th>
                                    <th className="px-3 h-11 font-medium text-center">Toler. Atraso</th>
                                    <th className="px-3 h-11 font-medium text-center">Limite</th>
                                    <th className="px-3 h-11 font-medium text-center">Validade</th>
                                    <th className="px-3 h-11 font-medium text-center">Tipo</th>
                                    <th className="px-3 h-11 font-medium text-center">BH Ativo</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {regras.map((r: any) => (
                                    <tr key={r.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-[52px] font-medium text-foreground">{r.nome}</td>
                                        <td className="px-3 text-muted-foreground">{(r.empresas as any)?.nome || "Todas"}</td>
                                        <td className="px-3 text-center">{r.carga_horaria_diaria || 8}h</td>
                                        <td className="px-3 text-center">{r.tolerancia_atraso || 5}m</td>
                                        <td className="px-3 text-center">{Math.floor((r.limite_diario_banco || 480) / 60)}h</td>
                                        <td className="px-3 text-center">{r.validade_horas || r.prazo_compensacao_dias} dias</td>
                                        <td className="px-3 text-center capitalize">{r.tipo}</td>
                                        <td className="px-3 text-center">
                                            <span className={r.bh_ativo ? "text-success" : "text-muted-foreground"}>
                                                {r.bh_ativo ? "Sim" : "Não"}
                                            </span>
                                        </td>
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
                                        <td colSpan={10} className="p-12 text-center text-muted-foreground italic">
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
                        <DialogTitle>Nova Regra de Banco de Horas</DialogTitle>
                        <DialogDescription>
                            Defina os parâmetros de processamento RH para esta empresa.
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

                        <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium mb-3 text-muted-foreground">Parâmetros de Processamento RH</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="carga_horaria">Carga Horária Diária (h)</Label>
                                <Input
                                    id="carga_horaria"
                                    type="number"
                                    step="0.5"
                                    value={form.carga_horaria_diaria}
                                    onChange={(e) => setForm({ ...form, carga_horaria_diaria: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="jornada_contratada">Jornada Contratada (h)</Label>
                                <Input
                                    id="jornada_contratada"
                                    type="number"
                                    step="0.5"
                                    value={form.jornada_contratada}
                                    onChange={(e) => setForm({ ...form, jornada_contratada: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_atraso">Tolerância Atraso (min)</Label>
                                <Input
                                    id="tolerancia_atraso"
                                    type="number"
                                    value={form.tolerancia_atraso}
                                    onChange={(e) => setForm({ ...form, tolerancia_atraso: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_he">Tolerância HE (min)</Label>
                                <Input
                                    id="tolerancia_he"
                                    type="number"
                                    value={form.tolerancia_hora_extra}
                                    onChange={(e) => setForm({ ...form, tolerancia_hora_extra: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="limite_diario">Limite Diário Banco (min)</Label>
                                <Input
                                    id="limite_diario"
                                    type="number"
                                    value={form.limite_diario_banco}
                                    onChange={(e) => setForm({ ...form, limite_diario_banco: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="validade">Validade Horas (dias)</Label>
                                <Input
                                    id="validade"
                                    type="number"
                                    value={form.validade_horas}
                                    onChange={(e) => setForm({ ...form, validade_horas: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Regra Compensação</Label>
                                <Select value={form.regra_compensacao} onValueChange={(v: any) => setForm({ ...form, regra_compensacao: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="automatico">Automático</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="transferencia">Transferência</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Regra Vencimento</Label>
                                <Select value={form.regra_vencimento} onValueChange={(v: any) => setForm({ ...form, regra_vencimento: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="acumula">Acumula</SelectItem>
                                        <SelectItem value="zera">Zera Periódico</SelectItem>
                                        <SelectItem value="expira">Expira</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Origem Ponto</Label>
                                <Select value={form.origem_ponto} onValueChange={(v: any) => setForm({ ...form, origem_ponto: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="biometrico">Biométrico</SelectItem>
                                        <SelectItem value="app">App</SelectItem>
                                        <SelectItem value="importacao">Importação</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center h-10">
                                <input
                                    type="checkbox"
                                    id="bh_ativo"
                                    checked={form.bh_ativo}
                                    onChange={(e) => setForm({ ...form, bh_ativo: e.target.checked })}
                                    className="mr-2 h-4 w-4"
                                />
                                <Label htmlFor="bh_ativo" className="font-normal">Banco de Horas Ativo</Label>
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
