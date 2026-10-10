import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormaPagamentoOperacionalService, RegrasFinanceirasService, EmpresaService } from '@/services/base.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Ban, CheckCircle2, Save, Calendar, Clock, Building2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const TabMeiosPagamento = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [isPrazoModalOpen, setIsPrazoModalOpen] = useState(false);
    const [editingPrazoId, setEditingPrazoId] = useState<string | null>(null);
    const [prazoForm, setPrazoForm] = useState({
        empresa_id: "",
        prazo_dias: 7,
        is_global: false,
    });

    const [form, setForm] = useState({
        nome: "",
        modalidade: "AMBOS",
        ativo: true
    });

    const { data: formas = [], isLoading } = useQuery({
        queryKey: ["formas_pagamento_crud"],
        queryFn: () => FormaPagamentoOperacionalService.getAll(),
    });

    const { data: regrasFinanceiras = [], isLoading: isLoadingRegras } = useQuery({
        queryKey: ["regras_financeiras_gestao"],
        queryFn: () => RegrasFinanceirasService.getAllActive(),
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_regras_list"],
        queryFn: () => EmpresaService.getAll(),
    });

    const resetForm = () => {
        setEditingId(null);
        setForm({
            nome: "",
            modalidade: "AMBOS",
            ativo: true
        });
        setIsModalOpen(false);
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!form.nome.trim()) throw new Error("Informe o nome do meio de pagamento.");

            if (editingId) {
                return FormaPagamentoOperacionalService.update(editingId, form);
            }
            return FormaPagamentoOperacionalService.create(form);
        },
        onSuccess: () => {
            toast.success("Meio de pagamento salvo com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento_crud"] });
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
            resetForm();
        },
        onError: (error: any) => {
            toast.error("Erro ao salvar", { description: error.message });
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, ativo }: { id: string, ativo: boolean }) =>
            FormaPagamentoOperacionalService.toggleAtivo(id, ativo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento_crud"] });
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
            toast.success("Status atualizado");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => FormaPagamentoOperacionalService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento_crud"] });
            queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
            toast.success("Meio de pagamento excluído");
        },
        onError: (error: any) => {
            toast.error("Erro ao excluir", { description: "Pode haver lançamentos vinculados a este meio de pagamento." });
        }
    });

    const regraGlobalDuplicata = regrasFinanceiras.find(
        (r: any) => !r.empresa_id && (r.modalidade_financeira === 'DUPLICATA' || r.modalidade_financeira === 'DUPLICATA_FORNECEDOR')
    );

    const regrasEmpresasDuplicata = regrasFinanceiras.filter(
        (r: any) => !!r.empresa_id && (r.modalidade_financeira === 'DUPLICATA' || r.modalidade_financeira === 'DUPLICATA_FORNECEDOR')
    );

    const savePrazoMutation = useMutation({
        mutationFn: async () => {
            const prazoNum = Number(prazoForm.prazo_dias);
            if (Number.isNaN(prazoNum) || prazoNum < 0) {
                throw new Error("Informe um prazo em dias válido (número maior ou igual a zero).");
            }

            if (editingPrazoId) {
                return RegrasFinanceirasService.update(editingPrazoId, {
                    prazo_dias: prazoNum,
                });
            }

            if (prazoForm.is_global) {
                if (regraGlobalDuplicata) {
                    return RegrasFinanceirasService.update(regraGlobalDuplicata.id, {
                        prazo_dias: prazoNum,
                    });
                }
                return RegrasFinanceirasService.create({
                    nome: 'Pagamento a Prazo (Boleto)',
                    descricao: 'Regra padrão global de duplicatas',
                    empresa_id: null,
                    modalidade_financeira: 'DUPLICATA',
                    tipo_liquidacao: 'futura',
                    prazo_dias: prazoNum,
                    gera_conta_receber: true,
                    ativo: true,
                });
            }

            if (!prazoForm.empresa_id) {
                throw new Error("Selecione a empresa para a regra personalizada.");
            }

            const empresaObj = (empresas as any[]).find((e: any) => e.id === prazoForm.empresa_id);
            return RegrasFinanceirasService.create({
                nome: `Boleto / Duplicata - ${empresaObj?.nome || 'Personalizado'}`,
                descricao: `Prazo comercial de boleto para ${empresaObj?.nome || 'empresa'}`,
                empresa_id: prazoForm.empresa_id,
                modalidade_financeira: 'DUPLICATA',
                tipo_liquidacao: 'futura',
                prazo_dias: prazoNum,
                gera_conta_receber: true,
                ativo: true,
            });
        },
        onSuccess: () => {
            toast.success("Regra de prazo salva com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_gestao"] });
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_filter"] });
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_form"] });
            setIsPrazoModalOpen(false);
            setEditingPrazoId(null);
        },
        onError: (err: any) => {
            toast.error("Erro ao salvar prazo financeiro", { description: err.message });
        }
    });

    const deletePrazoMutation = useMutation({
        mutationFn: (id: string) => RegrasFinanceirasService.delete(id),
        onSuccess: () => {
            toast.success("Regra personalizada removida. A empresa voltará a utilizar o prazo padrão global.");
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_gestao"] });
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_filter"] });
            queryClient.invalidateQueries({ queryKey: ["regras_financeiras_form"] });
        },
        onError: (err: any) => {
            toast.error("Erro ao remover regra", { description: err.message });
        }
    });

    const resetPrazoForm = () => {
        setEditingPrazoId(null);
        setPrazoForm({
            empresa_id: "",
            prazo_dias: 7,
            is_global: false,
        });
        setIsPrazoModalOpen(false);
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setForm({
            nome: item.nome,
            modalidade: item.modalidade || "AMBOS",
            ativo: item.ativo
        });
        setIsModalOpen(true);
    };

    return (
        <TooltipProvider delayDuration={150}>
            <div className="space-y-8">
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-base font-semibold text-foreground tracking-tight">Meios de Pagamento Operacionais</h2>
                            <p className="text-xs text-muted-foreground">
                                Gerencie as formas de pagamento disponíveis para os lançamentos de produção.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="h-8 text-xs font-medium gap-1.5 font-display font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Novo Meio de Pagamento
                        </Button>
                    </div>

                    <div className="relative rounded-lg border border-border/80 overflow-x-auto scrollbar-thin bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/80 bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</TableHead>
                                    <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modalidade Atrelada</TableHead>
                                    <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right pr-4">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Carregando...</TableCell>
                                    </TableRow>
                                ) : formas.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nenhum meio de pagamento cadastrado.</TableCell>
                                    </TableRow>
                                ) : (
                                    formas.map((item: any) => (
                                        <TableRow key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                            <TableCell className="px-3.5 py-2.5 font-medium text-sm text-foreground">{item.nome}</TableCell>
                                            <TableCell className="px-3.5 py-2.5">
                                                <Badge variant="outline" className="text-xs font-mono border-border/70 bg-muted/30">
                                                    {item.modalidade === 'CAIXA_IMEDIATO' ? 'À Vista (Caixa)' :
                                                    item.modalidade === 'DUPLICATA' ? 'Prazo (Boleto/Fatura)' : 'Ambos'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "cursor-pointer text-[11px] font-medium transition-colors border",
                                                        item.ativo
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50"
                                                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]"
                                                    )}
                                                    onClick={() => toggleStatusMutation.mutate({ id: item.id, ativo: !item.ativo })}
                                                >
                                                    <span className={cn(
                                                        "h-1.5 w-1.5 rounded-full mr-1.5",
                                                        item.ativo ? "bg-emerald-600 dark:bg-emerald-400" : "bg-slate-400 dark:bg-[#A0A7B2]"
                                                    )} />
                                                    {item.ativo ? "Ativo" : "Inativo"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5 text-right pr-4">
                                                <div className="flex justify-end gap-1 items-center">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                                onClick={() => handleEdit(item)}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Editar Meio</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                                onClick={() => {
                                                                    if (confirm(`Deseja realmente excluir o meio de pagamento "${item.nome}"?`)) {
                                                                        deleteMutation.mutate(item.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Excluir Meio</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

            {/* Seção FIX 09: Prazos Financeiros de Duplicatas por Empresa */}
            <div className="pt-6 border-t border-border/80 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            Prazos de Vencimento de Duplicatas / Boletos
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Configure o prazo comercial de vencimento das duplicatas (D+N). A regra global é aplicada a todas as empresas, exceto quando houver prazo específico definido.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium gap-1.5 border-border/80 hover:bg-muted/50"
                        onClick={() => {
                            resetPrazoForm();
                            setIsPrazoModalOpen(true);
                        }}
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Personalizar Prazo por Empresa
                    </Button>
                </div>

                {/* Banner da Regra Global */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-muted/40 rounded-xl border border-border/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                            <Globe className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Regra Padrão Global</span>
                                <Badge variant="outline" className="font-mono font-semibold text-xs border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50">
                                    D+{regraGlobalDuplicata?.prazo_dias ?? 7}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Aplicada automaticamente para empresas sem regra individual cadastrada.
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-border/80 hover:bg-background text-foreground gap-1.5"
                        onClick={() => {
                            setEditingPrazoId(regraGlobalDuplicata?.id || null);
                            setPrazoForm({
                                empresa_id: "",
                                prazo_dias: regraGlobalDuplicata?.prazo_dias ?? 7,
                                is_global: true,
                            });
                            setIsPrazoModalOpen(true);
                        }}
                    >
                        <Pencil className="h-3 w-3" />
                        Alterar Prazo Global
                    </Button>
                </div>

                {/* Tabela de Regras Personalizadas por Empresa */}
                <div className="relative rounded-lg border border-border/80 overflow-x-auto scrollbar-thin bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border/80 bg-muted/30 hover:bg-muted/30">
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modalidade</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Prazo Comercial</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Tipo de Regra</TableHead>
                                <TableHead className="h-9 px-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right pr-4">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingRegras ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Carregando regras...</TableCell>
                                </TableRow>
                            ) : regrasEmpresasDuplicata.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                        Nenhuma empresa possui prazo personalizado cadastrado. Todas seguem a regra global (D+{regraGlobalDuplicata?.prazo_dias ?? 7}).
                                    </TableCell>
                                </TableRow>
                            ) : (
                                regrasEmpresasDuplicata.map((r: any) => {
                                    const empresa = (empresas as any[]).find((e: any) => e.id === r.empresa_id);
                                    return (
                                        <TableRow key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                            <TableCell className="px-3.5 py-2.5 font-medium text-sm text-foreground">
                                                {empresa?.nome || r.nome || "Empresa"}
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5">
                                                <Badge variant="outline" className="text-xs font-mono border-border/70 bg-muted/30">
                                                    DUPLICATA (Boleto)
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5 text-center font-mono font-semibold text-sm text-foreground">
                                                D+{r.prazo_dias}
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5 text-center">
                                                <Badge variant="outline" className="text-[11px] font-medium border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50">
                                                    Personalizada
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-3.5 py-2.5 text-right pr-4">
                                                <div className="flex justify-end gap-1 items-center">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                                                onClick={() => {
                                                                    setEditingPrazoId(r.id);
                                                                    setPrazoForm({
                                                                        empresa_id: r.empresa_id,
                                                                        prazo_dias: r.prazo_dias,
                                                                        is_global: false,
                                                                    });
                                                                    setIsPrazoModalOpen(true);
                                                                }}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Editar Prazo</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                                onClick={() => {
                                                                    if (confirm(`Remover prazo personalizado desta empresa e retornar ao padrão global D+${regraGlobalDuplicata?.prazo_dias ?? 7}?`)) {
                                                                        deletePrazoMutation.mutate(r.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Excluir Prazo</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modal de Meio de Pagamento */}
            <Dialog open={isModalOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar Meio de Pagamento" : "Novo Meio de Pagamento"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome do Meio de Pagamento</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: PIX, Boleto, Dinheiro, Cartão"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Modalidade Financeira</Label>
                            <Select
                                value={form.modalidade}
                                onValueChange={(val) => setForm({ ...form, modalidade: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a modalidade" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AMBOS">Todos (Ambos)</SelectItem>
                                    <SelectItem value="CAIXA_IMEDIATO">À Vista (Caixa Imediato)</SelectItem>
                                    <SelectItem value="DUPLICATA">A Prazo (Boleto / Fatura Mensal)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground italic">
                                Filtra a exibição no lançamento conforme o tipo de cobrança da regra operacional.
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label>Status Ativo</Label>
                                <p className="text-xs text-muted-foreground">Habilite para permitir uso em lançamentos.</p>
                            </div>
                            <Switch
                                checked={form.ativo}
                                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending || !form.nome.trim()}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {saveMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Configuração de Prazo */}
            <Dialog open={isPrazoModalOpen} onOpenChange={(open) => !open && resetPrazoForm()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {prazoForm.is_global
                                ? "Configurar Prazo Padrão Global"
                                : editingPrazoId
                                    ? "Editar Prazo por Empresa"
                                    : "Novo Prazo Personalizado por Empresa"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {!prazoForm.is_global && (
                            <div className="space-y-2">
                                <Label>Empresa</Label>
                                <Select
                                    value={prazoForm.empresa_id}
                                    onValueChange={(val) => setPrazoForm({ ...prazoForm, empresa_id: val })}
                                    disabled={!!editingPrazoId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a empresa..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(empresas as any[]).map((e: any) => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="prazo_dias">
                                Prazo Comercial em Dias (D+N)
                            </Label>
                            <Input
                                id="prazo_dias"
                                type="number"
                                min={0}
                                max={365}
                                value={prazoForm.prazo_dias}
                                onChange={(e) => setPrazoForm({ ...prazoForm, prazo_dias: Number(e.target.value) })}
                                placeholder="Ex: 7, 15, 30"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Exemplo: {prazoForm.prazo_dias} dias representará vencimento D+{prazoForm.prazo_dias} calculado a partir da data de operação.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={resetPrazoForm}>Cancelar</Button>
                        <Button
                            onClick={() => savePrazoMutation.mutate()}
                            disabled={savePrazoMutation.isPending || (!prazoForm.is_global && !prazoForm.empresa_id)}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {savePrazoMutation.isPending ? "Salvando..." : "Salvar Prazo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </TooltipProvider>
    );
};
