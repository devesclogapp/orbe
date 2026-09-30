import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Trash2, Pencil, ShieldAlert, History } from "lucide-react";
import { BHRegraService } from "@/services/v4.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
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

function subtrairUmDia(dataIso: string): string {
    const d = new Date(dataIso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

const RegrasBH = () => {
    const queryClient = useQueryClient();
    const { role, isAdmin } = useAccessControl();
    const isEncarregado = role === "encarregado";
    const canManageRules = isAdmin || role === "rh" || role === "admin";

    const [open, setOpen] = useState(false);
    const [editingRegra, setEditingRegra] = useState<any | null>(null);

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
        tolerancia_atraso: "5",
        tolerancia_hora_extra: "0",
        limite_diario_banco: "480",
        regra_compensacao: "automatico",
        bh_ativo: true,
        vigencia_inicio: new Date().toISOString().slice(0, 10),
        vigencia_fim: "",
        adicional_hora_extra_percentual: "50",
        // Campos legados mantidos silenciosamente para integridade do schema
        carga_horaria_diaria: "8.00",
        jornada_contratada: "8.00",
        validade_horas: "60",
        regra_vencimento: "acumula",
        origem_ponto: "manual",
    });

    const reset = () => setForm({
        nome: "",
        empresa_id: "",
        prazo_compensacao_dias: "60",
        tipo: "acumula",
        status: "ativo",
        tolerancia_atraso: "5",
        tolerancia_hora_extra: "0",
        limite_diario_banco: "480",
        regra_compensacao: "automatico",
        bh_ativo: true,
        vigencia_inicio: new Date().toISOString().slice(0, 10),
        vigencia_fim: "",
        adicional_hora_extra_percentual: "50",
        carga_horaria_diaria: "8.00",
        jornada_contratada: "8.00",
        validade_horas: "60",
        regra_vencimento: "acumula",
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

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: any }) => BHRegraService.update(id, payload),
        onSuccess: () => {
            toast.success("Regra atualizada com sucesso");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            setEditingRegra(null);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao atualizar regra", { description: err.message })
    });

    const novaVigenciaMutation = useMutation({
        mutationFn: async ({ anteriorId, novaDataInicio, novoPayload }: { anteriorId: string; novaDataInicio: string; novoPayload: any }) => {
            const diaAnterior = subtrairUmDia(novaDataInicio);
            await BHRegraService.update(anteriorId, { vigencia_fim: diaAnterior });
            return await BHRegraService.create({
                ...novoPayload,
                vigencia_inicio: novaDataInicio,
            });
        },
        onSuccess: (_, variables) => {
            const diaAnterior = subtrairUmDia(variables.novaDataInicio);
            toast.success(`Nova vigência criada! Regra anterior finalizada em ${diaAnterior}.`);
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            setEditingRegra(null);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao criar nova vigência", { description: err.message })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => BHRegraService.delete(id),
        onSuccess: () => {
            toast.success("Regra removida");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
        },
        onError: (err: any) => toast.error("Erro ao remover regra", { description: err.message })
    });

    const getPayload = () => ({
        nome: form.nome,
        empresa_id: form.empresa_id === 'global' ? null : form.empresa_id,
        prazo_compensacao_dias: parseInt(form.prazo_compensacao_dias) || 60,
        tipo: form.tipo,
        status: form.status,
        tolerancia_atraso: parseInt(form.tolerancia_atraso) || 0,
        tolerancia_hora_extra: parseInt(form.tolerancia_hora_extra) || 0,
        limite_diario_banco: parseInt(form.limite_diario_banco) || 480,
        regra_compensacao: form.regra_compensacao,
        bh_ativo: form.bh_ativo,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
        adicional_hora_extra_percentual: parseFloat(form.adicional_hora_extra_percentual) || 50,
        // Legado desacoplado do cálculo e preservado no banco
        carga_horaria_diaria: parseFloat(form.carga_horaria_diaria) || 8.00,
        jornada_contratada: parseFloat(form.jornada_contratada) || 8.00,
        validade_horas: parseInt(form.prazo_compensacao_dias) || 60,
        regra_vencimento: form.tipo,
        origem_ponto: "manual",
    });

    const submit = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Acesso negado: Perfil 'encarregado' não pode criar ou editar regras.");
            return;
        }
        if (!form.nome || !form.empresa_id) {
            toast.error("Preencha o nome e selecione o escopo da empresa");
            return;
        }
        if (!form.vigencia_inicio) {
            toast.error("Defina a data de início da vigência");
            return;
        }
        if (form.vigencia_fim && form.vigencia_fim < form.vigencia_inicio) {
            toast.error("A data de término da vigência não pode ser anterior ao início");
            return;
        }

        const payload = getPayload();

        if (editingRegra) {
            updateMutation.mutate({ id: editingRegra.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleNovaVigenciaPreservarHistorico = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Acesso negado: Perfil 'encarregado' não pode criar regras.");
            return;
        }
        if (!editingRegra) return;
        if (!form.vigencia_inicio) {
            toast.error("Defina a data de início da nova vigência");
            return;
        }
        if (editingRegra.vigencia_inicio && form.vigencia_inicio <= editingRegra.vigencia_inicio) {
            toast.error("O início da nova vigência deve ser posterior ao início da regra anterior (" + editingRegra.vigencia_inicio + ")");
            return;
        }

        const payload = getPayload();
        novaVigenciaMutation.mutate({
            anteriorId: editingRegra.id,
            novaDataInicio: form.vigencia_inicio,
            novoPayload: payload,
        });
    };

    const handleEdit = (r: any) => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para editar regras.");
            return;
        }
        setEditingRegra(r);
        setForm({
            nome: r.nome || "",
            empresa_id: r.empresa_id || "global",
            prazo_compensacao_dias: String(r.prazo_compensacao_dias || 60),
            tipo: (r.tipo || "acumula") as "acumula" | "zera" | "expira",
            status: (r.status || "ativo") as "ativo" | "inativo",
            tolerancia_atraso: String(r.tolerancia_atraso ?? 5),
            tolerancia_hora_extra: String(r.tolerancia_hora_extra ?? 0),
            limite_diario_banco: String(r.limite_diario_banco ?? 480),
            regra_compensacao: r.regra_compensacao || "automatico",
            bh_ativo: r.bh_ativo ?? true,
            vigencia_inicio: r.vigencia_inicio || "",
            vigencia_fim: r.vigencia_fim || "",
            adicional_hora_extra_percentual: String(r.adicional_hora_extra_percentual ?? 50),
            carga_horaria_diaria: String(r.carga_horaria_diaria || 8),
            jornada_contratada: String(r.jornada_contratada || 8),
            validade_horas: String(r.validade_horas || 60),
            regra_vencimento: r.regra_vencimento || "acumula",
            origem_ponto: r.origem_ponto || "manual",
        });
        setOpen(true);
    };

    const handleDelete = (id: string) => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para excluir regras.");
            return;
        }
        if (confirm("Deseja realmente excluir esta regra? Atenção: a exclusão pode afetar reprocessamentos de pontos.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleOpenNew = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para criar regras.");
            return;
        }
        setEditingRegra(null);
        reset();
        setOpen(true);
    };

    return (
        <AppShell title="Regras de Banco de Horas" subtitle="Defina políticas de validade, vigência temporal e compensação">
            <div className="space-y-4">
                {isEncarregado && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-md text-sm font-medium flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        Modo Somente Leitura: Perfil 'encarregado' não possui permissão para administrar regras de Banco de Horas.
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_regras"] })}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={handleOpenNew} disabled={isEncarregado || !canManageRules}>
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
                                    <th className="px-3 h-11 font-medium text-center">Vigência</th>
                                    <th className="px-3 h-11 font-medium text-center">Tolerância Líquida</th>
                                    <th className="px-3 h-11 font-medium text-center">Adicional HE</th>
                                    <th className="px-3 h-11 font-medium text-center">Limite Diário</th>
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
                                        <td className="px-3 text-muted-foreground">{(r.empresas as any)?.nome || "Todas (Global)"}</td>
                                        <td className="px-3 text-center text-xs">
                                            {r.vigencia_inicio ? (
                                                <span>{r.vigencia_inicio} a {r.vigencia_fim || 'Indet.'}</span>
                                            ) : (
                                                <span className="text-muted-foreground italic">Sem vigência</span>
                                            )}
                                        </td>
                                        <td className="px-3 text-center">
                                            <span title="Tolerância aplicada sobre o saldo líquido diário (worked - jornada)">
                                                -{r.tolerancia_atraso ?? 5}m / +{r.tolerancia_hora_extra ?? 0}m
                                            </span>
                                        </td>
                                        <td className="px-3 text-center font-medium text-primary">
                                            +{r.adicional_hora_extra_percentual ?? 50}%
                                        </td>
                                        <td className="px-3 text-center">{Math.floor((r.limite_diario_banco || 480) / 60)}h</td>
                                        <td className="px-3 text-center">{r.prazo_compensacao_dias || 60} dias</td>
                                        <td className="px-3 text-center capitalize">{r.tipo}</td>
                                        <td className="px-3 text-center">
                                            <span className={r.bh_ativo ? "text-success font-medium" : "text-muted-foreground"}>
                                                {r.bh_ativo ? "Sim" : "Não"}
                                            </span>
                                        </td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={r.status === 'ativo' ? 'ok' : 'inconsistente'} label={r.status} />
                                        </td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:text-primary"
                                                    onClick={() => handleEdit(r)}
                                                    disabled={isEncarregado || !canManageRules}
                                                    title="Editar parâmetros da regra"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-error hover:text-error hover:bg-error/10"
                                                    onClick={() => handleDelete(r.id)}
                                                    disabled={isEncarregado || !canManageRules || deleteMutation.isPending}
                                                    title="Excluir regra"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {regras.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="p-12 text-center text-muted-foreground italic">
                                            Nenhuma regra configurada ainda. O Gate 3 permanece bloqueado para colaboradores sem regra aplicável.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRegra ? "Editar Regra de Banco de Horas" : "Nova Regra de Banco de Horas"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingRegra
                                ? "Atualize os parâmetros de compensação, tolerância e vigência desta regra."
                                : "Defina a política de banco de horas e compensação de horas extras para o escopo selecionado."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="nome">Nome da política</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: Acordo Coletivo 2026/2027 — ESC Log"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Empresa (Escopo de Aplicação)</Label>
                            <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global">Todas as Empresas (Regra Global / Fallback)</SelectItem>
                                    {empresas.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Vigência Temporal */}
                        <div className="grid grid-cols-2 gap-4 border border-border/50 rounded-lg p-3 bg-muted/20">
                            <div className="space-y-1.5">
                                <Label htmlFor="vigencia_inicio" className="text-xs font-semibold">Vigência Início *</Label>
                                <Input
                                    id="vigencia_inicio"
                                    type="date"
                                    value={form.vigencia_inicio}
                                    onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="vigencia_fim" className="text-xs font-semibold">Vigência Fim (Opcional)</Label>
                                <Input
                                    id="vigencia_fim"
                                    type="date"
                                    placeholder="Indeterminado"
                                    value={form.vigencia_fim}
                                    onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })}
                                />
                                <span className="text-[11px] text-muted-foreground">Vazio = vigência indeterminada</span>
                            </div>
                        </div>

                        {/* Adicional e Compensação */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="adicional_he">Adicional Hora Extra (%)</Label>
                                <Input
                                    id="adicional_he"
                                    type="number"
                                    step="5"
                                    placeholder="50"
                                    value={form.adicional_hora_extra_percentual}
                                    onChange={(e) => setForm({ ...form, adicional_hora_extra_percentual: e.target.value })}
                                />
                                <span className="text-[11px] text-muted-foreground">Ex: 50% = 1.5x | 100% = 2.0x</span>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="prazo">Prazo Compensação (Dias)</Label>
                                <Input
                                    id="prazo"
                                    type="number"
                                    value={form.prazo_compensacao_dias}
                                    onChange={(e) => setForm({ ...form, prazo_compensacao_dias: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                                Tolerâncias de Saldo Líquido Diário & Limites
                            </p>
                            <p className="text-[11px] text-muted-foreground mb-3">
                                A tolerância é aplicada exclusivamente sobre o saldo líquido (minutos trabalhados - jornada). A jornada esperada é definida pelo JornadaResolver.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_atraso" className="text-xs">Tolerância Atraso (m)</Label>
                                <Input
                                    id="tolerancia_atraso"
                                    type="number"
                                    value={form.tolerancia_atraso}
                                    onChange={(e) => setForm({ ...form, tolerancia_atraso: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_he" className="text-xs">Tolerância HE (m)</Label>
                                <Input
                                    id="tolerancia_he"
                                    type="number"
                                    value={form.tolerancia_hora_extra}
                                    onChange={(e) => setForm({ ...form, tolerancia_hora_extra: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="limite_diario" className="text-xs">Limite Banco/dia (m)</Label>
                                <Input
                                    id="limite_diario"
                                    type="number"
                                    value={form.limite_diario_banco}
                                    onChange={(e) => setForm({ ...form, limite_diario_banco: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="bh_ativo"
                                    checked={form.bh_ativo}
                                    onChange={(e) => setForm({ ...form, bh_ativo: e.target.checked })}
                                    className="mr-2 h-4 w-4"
                                />
                                <Label htmlFor="bh_ativo" className="font-normal text-sm">Banco de Horas Ativo</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Status da Regra:</Label>
                                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ativo">Ativo</SelectItem>
                                        <SelectItem value="inativo">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        {editingRegra && (
                            <Button
                                variant="secondary"
                                onClick={handleNovaVigenciaPreservarHistorico}
                                disabled={novaVigenciaMutation.isPending || isEncarregado || !canManageRules}
                                title="Encerra a regra anterior no dia anterior e cria uma nova com vigência a partir da nova data"
                                className="gap-1.5"
                            >
                                <History className="h-4 w-4" />
                                {novaVigenciaMutation.isPending ? "Criando Nova Vigência..." : "Nova Vigência (Preservar Histórico)"}
                            </Button>
                        )}
                        <Button
                            onClick={submit}
                            disabled={createMutation.isPending || updateMutation.isPending || isEncarregado || !canManageRules}
                        >
                            {createMutation.isPending || updateMutation.isPending
                                ? "Salvando..."
                                : editingRegra
                                ? "Salvar Correção"
                                : "Criar Regra"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RegrasBH;
