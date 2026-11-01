import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Save, Trash2, Edit, AlertTriangle, Copy, HelpCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { ServicosEspecificosRegrasService, ServicoEspecificoRegra } from '@/services/domain/servicos_especificos.service';
import { useTenant } from '@/contexts/TenantContext';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ServicosEspecificosRegrasTab() {
    const { tenantId } = useTenant();
    const queryClient = useQueryClient();

    // Auto-provisionamento inicial de períodos sugeridos
    React.useEffect(() => {
        if (tenantId) {
            ServicosEspecificosRegrasService.ensureDefaultPeriods(tenantId)
                .then(() => queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] }));
        }
    }, [tenantId, queryClient]);



    // Novo Estado de Criação
    const [isCreating, setIsCreating] = useState(false);
    const [newRegra, setNewRegra] = useState<Partial<ServicoEspecificoRegra>>({
        codigo: '',
        descricao: '',
        tipo_periodo: 'DIURNO',
        peso_multiplicador: 1.00,
        valor_padrao: 0,
        ativo: true
    });

    const { data: regras, isLoading, error } = useQuery({
        queryKey: ['servicos_especificos_regras'],
        queryFn: () => ServicosEspecificosRegrasService.getAll(),
        retry: false
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ServicoEspecificoRegra>>({});

    // Efeito para normalizar nomenclaturas antigas para o padrão formal solicitado na validação final
    React.useEffect(() => {
        if (!regras || (regras as any[]).length === 0) return;

        const formalNames: Record<string, string> = {
            'D1': 'Primeiro Período Diurno',
            'D2': 'Segundo Período Diurno',
            'N1': 'Primeiro Período Noturno',
            'N2': 'Segundo Período Noturno',
        };

        const list = regras as any[];
        list.forEach(r => {
            const formal = formalNames[r.codigo];
            // Só atualiza se o código for um dos 4 padrões e a descrição estiver diferente do formal solicitado
            if (formal && r.descricao !== formal) {
                ServicosEspecificosRegrasService.update(r.id, { descricao: formal })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] }))
                    .catch(e => console.error(`Falha ao normalizar período ${r.codigo}:`, e));
            }
        });
    }, [regras, queryClient]);

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            return ServicosEspecificosRegrasService.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] });
            setIsCreating(false);
            setNewRegra({
                codigo: '',
                descricao: '',
                tipo_periodo: 'DIURNO',
                peso_multiplicador: 1.00,
                valor_padrao: 0,
                ativo: true
            });
            toast.success("Período operacional salvo com sucesso!");
        },
        onError: (err: any) => {
            console.error('Erro ao salvar regra:', err);
            toast.error("Falha ao salvar período.", {
                description: err.message || "Verifique se a migration SQL foi aplicada corretamente."
            });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
            return ServicosEspecificosRegrasService.update(id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] });
            setEditingId(null);
            toast.success("Período operacional atualizado!");
        },
        onError: (err: any) => {
            toast.error("Falha ao atualizar.", { description: err.message });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return ServicosEspecificosRegrasService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] });
        }
    });

    const duplicateMutation = useMutation({
        mutationFn: async (id: string) => {
            return ServicosEspecificosRegrasService.duplicar(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] });
            toast.success("Período operacional duplicado com sucesso!");
        },
        onError: (err: any) => {
            toast.error("Falha ao duplicar período.", { description: err.message });
        }
    });

    const handleSaveNovo = () => {
        if (!newRegra.codigo || !newRegra.descricao) {
            toast.warning("Informe o código e a descrição.");
            return;
        }

        if (!tenantId) {
            toast.error("Tenant não identificado. Recarregue a página.");
            return;
        }

        createMutation.mutate({
            ...newRegra,
            tenant_id: tenantId
        });
    };

    const handleEditStart = (item: ServicoEspecificoRegra) => {
        setEditingId(item.id);
        setEditForm({ ...item });
    };

    const handleEditSave = () => {
        if (!editingId || !editForm.codigo) return;
        updateMutation.mutate({
            id: editingId,
            payload: editForm
        });
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-lg bg-amber-50/50 border-amber-200">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <div className="max-w-md">
                    <h3 className="font-semibold text-amber-800">Estrutura de dados não encontrada</h3>
                    <p className="text-sm text-amber-700">
                        O módulo de Períodos Operacionais requer atualizações no banco de dados.
                        Por favor, aplique as últimas migrations SQL no Supabase para continuar.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={150}>
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground tracking-tight">Períodos Operacionais / Turnos</h3>
                        <p className="text-xs text-muted-foreground">
                            Utilizado como multiplicador operacional sobre o valor base.
                        </p>
                        <div className="mt-3 p-3 bg-muted/40 border border-border/80 rounded-xl text-xs text-foreground flex items-start gap-3">
                            <HelpCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-none" />
                            <div>
                                <p className="font-semibold text-foreground mb-1">Exemplos de códigos gerados nos lançamentos:</p>
                                <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
                                    <span><strong className="text-foreground font-mono">D1C2</strong> = Período D1 com 2 colaboradores</span>
                                    <span><strong className="text-foreground font-mono">N1C5</strong> = Período N1 com 5 colaboradores</span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">O código operacional segue o padrão: [período] + C + [quantidade colaboradores].</p>
                            </div>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className={cn(
                            "h-8 text-xs font-medium gap-1.5 font-display font-semibold shadow-xs shrink-0",
                            isCreating ? "border-border/80 hover:bg-muted/50" : "bg-blue-600 hover:bg-blue-700 text-white"
                        )}
                        onClick={() => setIsCreating(!isCreating)}
                        variant={isCreating ? "outline" : "default"}
                    >
                        {isCreating ? 'Cancelar' : <><Plus className="h-3.5 w-3.5" /> Adicionar Turno</>}
                    </Button>
                </div>

                <div className="relative rounded-lg border border-border/80 overflow-x-auto scrollbar-thin bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border/80 bg-muted/30 hover:bg-muted/30">
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        Multiplicador de Turno
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[250px] p-3">
                                                <p className="font-semibold mb-1">Fator de Multiplicação</p>
                                                <p className="text-xs">Fator aplicado sobre o valor unitário da operação.</p>
                                                <div className="mt-2 pt-2 border-t text-[10px]">
                                                    <p>Exemplo:</p>
                                                    <p>Valor unitário: R$ 10,00</p>
                                                    <p>Turno N1: 1,20x</p>
                                                    <p className="font-medium mt-1">Resultado: R$ 12,00</p>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right pr-4">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                    <TableBody>
                        {isCreating && (
                            <TableRow className="bg-blue-50/20">
                                <TableCell>
                                    <Input
                                        placeholder="Ex: N1"
                                        className="w-24"
                                        value={newRegra.codigo}
                                        onChange={e => setNewRegra({ ...newRegra, codigo: e.target.value.toUpperCase() })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        placeholder="Primeiro Noturno..."
                                        value={newRegra.descricao}
                                        onChange={e => setNewRegra({ ...newRegra, descricao: e.target.value })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={newRegra.tipo_periodo}
                                        onValueChange={(val: any) => setNewRegra({ ...newRegra, tipo_periodo: val })}
                                    >
                                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DIURNO">Diurno</SelectItem>
                                            <SelectItem value="NOTURNO">Noturno</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number" step="0.01" min="0"
                                        className="w-24"
                                        value={newRegra.peso_multiplicador}
                                        onChange={e => setNewRegra({ ...newRegra, peso_multiplicador: Number(e.target.value) })}
                                    />
                                </TableCell>
                                <TableCell className="px-3.5 py-2.5">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                                        Ativo
                                    </span>
                                </TableCell>
                                <TableCell className="px-3.5 py-2.5 text-right pr-4">
                                    <div className="flex justify-end gap-1 items-center">
                                        <Button size="sm" className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={handleSaveNovo} disabled={createMutation.isPending}>
                                            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Salvar
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {(regras || []).map((r: any) => (
                            <TableRow key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                {editingId === r.id ? (
                                    <>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Input
                                                className="w-24 h-8 text-xs font-mono font-bold"
                                                value={editForm.codigo}
                                                onChange={e => setEditForm({ ...editForm, codigo: e.target.value.toUpperCase() })}
                                            />
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Input
                                                className="h-8 text-xs"
                                                value={editForm.descricao}
                                                onChange={e => setEditForm({ ...editForm, descricao: e.target.value })}
                                            />
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Select
                                                value={editForm.tipo_periodo}
                                                onValueChange={(val: any) => setEditForm({ ...editForm, tipo_periodo: val })}
                                            >
                                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DIURNO">Diurno</SelectItem>
                                                    <SelectItem value="NOTURNO">Noturno</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Input
                                                type="number" step="0.01" min="0"
                                                className="w-24 h-8 text-xs font-mono"
                                                value={editForm.peso_multiplicador}
                                                onChange={e => setEditForm({ ...editForm, peso_multiplicador: Number(e.target.value) })}
                                            />
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Select
                                                value={editForm.ativo ? "true" : "false"}
                                                onValueChange={(val) => setEditForm({ ...editForm, ativo: val === "true" })}
                                            >
                                                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Ativo</SelectItem>
                                                    <SelectItem value="false">Inativo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5 text-right pr-4">
                                            <div className="flex justify-end gap-1 items-center">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={handleEditSave} disabled={updateMutation.isPending}>
                                                    {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60" onClick={() => setEditingId(null)}>
                                                    <Plus className="w-3.5 h-3.5 rotate-45" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell className="px-3.5 py-2.5 font-bold font-mono text-sm text-foreground">{r.codigo}</TableCell>
                                        <TableCell className="px-3.5 py-2.5 text-sm text-foreground">{r.descricao}</TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <Badge variant="outline" className={cn("text-xs font-mono border", r.tipo_periodo === 'NOTURNO' ? "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50" : "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50")}>
                                                {r.tipo_periodo || 'DIURNO'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5 font-mono font-semibold text-sm text-foreground">{Number(r.peso_multiplicador || 1).toFixed(2)}x</TableCell>
                                        <TableCell className="px-3.5 py-2.5">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[11px] font-medium border",
                                                r.ativo
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50"
                                                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]"
                                            )}>
                                                <span className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    r.ativo ? "bg-emerald-600 dark:bg-emerald-400" : "bg-slate-400 dark:bg-[#A0A7B2]"
                                                )} />
                                                {r.ativo ? "Ativo" : "Inativo"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-3.5 py-2.5 text-right pr-4">
                                            <div className="flex justify-end gap-1 items-center">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                            onClick={() => handleEditStart(r)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Editar Turno</TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                            onClick={() => {
                                                                if (confirm('Duplicar período?')) duplicateMutation.mutate(r.id);
                                                            }}
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Duplicar Turno</TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                            onClick={() => {
                                                                if (confirm('Remover período?')) deleteMutation.mutate(r.id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Excluir Turno</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}

                        {!isLoading && (!regras || regras.length === 0) && !isCreating && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                                    Nenhum período cadastrado. Comece adicionando D1 ou N1.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    </TooltipProvider>
    );
}
