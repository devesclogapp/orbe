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
import { formatCurrency } from '@/lib/utils';
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
        <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Períodos Operacionais / Turnos</h3>
                    <p className="text-sm text-muted-foreground">
                        Utilizado como multiplicador operacional sobre o valor base.
                    </p>
                    <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-800 flex items-start gap-3">
                        <HelpCircle className="w-4 h-4 mt-0.5 flex-none" />
                        <div>
                            <p className="font-semibold mb-1">Exemplos de códigos gerados nos lançamentos:</p>
                            <div className="flex gap-4">
                                <span><strong>D1C2</strong> = Período D1 com 2 colaboradores</span>
                                <span><strong>N1C5</strong> = Período N1 com 5 colaboradores</span>
                            </div>
                            <p className="mt-1 text-[10px] opacity-80">O código operacional segue o padrão: [período] + C + [quantidade colaboradores].</p>
                        </div>
                    </div>
                </div>
                <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "secondary" : "default"}>
                    {isCreating ? 'Cancelar' : <><Plus className="w-4 h-4 mr-2" /> Adicionar Turno</>}
                </Button>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Período</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>
                                <div className="flex items-center gap-1.5">
                                    Multiplicador de Turno
                                    <TooltipProvider>
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
                                    </TooltipProvider>
                                </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
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
                                <TableCell><Badge>Ativo</Badge></TableCell>
                                <TableCell>
                                    <Button size="sm" onClick={handleSaveNovo} disabled={createMutation.isPending}>
                                        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )}

                        {(regras || []).map((r: any) => (
                            <TableRow key={r.id}>
                                {editingId === r.id ? (
                                    <>
                                        <TableCell>
                                            <Input
                                                className="w-24"
                                                value={editForm.codigo}
                                                onChange={e => setEditForm({ ...editForm, codigo: e.target.value.toUpperCase() })}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={editForm.descricao}
                                                onChange={e => setEditForm({ ...editForm, descricao: e.target.value })}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={editForm.tipo_periodo}
                                                onValueChange={(val: any) => setEditForm({ ...editForm, tipo_periodo: val })}
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
                                                type="number" step="0.01"
                                                className="w-24"
                                                value={editForm.peso_multiplicador}
                                                onChange={e => setEditForm({ ...editForm, peso_multiplicador: Number(e.target.value) })}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={editForm.ativo ? "true" : "false"}
                                                onValueChange={(val) => setEditForm({ ...editForm, ativo: val === "true" })}
                                            >
                                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Ativo</SelectItem>
                                                    <SelectItem value="false">Inativo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button size="icon" variant="ghost" onClick={handleEditSave} disabled={updateMutation.isPending}>
                                                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-emerald-600" />}
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                                                    <Plus className="w-4 h-4 rotate-45 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell className="font-bold text-primary">{r.codigo}</TableCell>
                                        <TableCell>{r.descricao}</TableCell>
                                        <TableCell>
                                            <Badge variant={r.tipo_periodo === 'NOTURNO' ? 'info' : 'outline' as any}>
                                                {r.tipo_periodo || 'DIURNO'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{Number(r.peso_multiplicador || 1).toFixed(2)}x</TableCell>
                                        <TableCell>
                                            {r.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-muted-foreground hover:text-primary"
                                                    onClick={() => handleEditStart(r)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-muted-foreground hover:text-primary"
                                                    onClick={() => {
                                                        if (confirm('Duplicar período?')) duplicateMutation.mutate(r.id);
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        if (confirm('Remover período?')) deleteMutation.mutate(r.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}

                        {!isLoading && (!regras || regras.length === 0) && !isCreating && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Nenhum período cadastrado. Comece adicionando D1 ou N1.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
