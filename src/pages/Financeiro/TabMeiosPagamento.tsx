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
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="font-semibold text-foreground">Meios de Pagamento Operacionais</h2>
                        <p className="text-sm text-muted-foreground">
                            Gerencie as formas de pagamento disponíveis para os lançamentos de produção.
                        </p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Meio de Pagamento
                    </Button>
                </div>

                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Modalidade Atrelada</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</TableCell>
                                </TableRow>
                            ) : formas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum meio de pagamento cadastrado.</TableCell>
                                </TableRow>
                            ) : (
                                formas.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-semibold text-foreground">{item.nome}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {item.modalidade === 'CAIXA_IMEDIATO' ? 'À Vista (Caixa)' :
                                                item.modalidade === 'DUPLICATA' ? 'Prazo (Boleto/Fatura)' : 'Ambos'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                variant={item.ativo ? "default" : "secondary"}
                                                className={cn(
                                                    "cursor-pointer",
                                                    item.ativo ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-200 text-slate-700"
                                                )}
                                                onClick={() => toggleStatusMutation.mutate({ id: item.id, ativo: !item.ativo })}
                                            >
                                                {item.ativo ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleEdit(item)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        if (confirm(`Deseja realmente excluir o meio de pagamento "${item.nome}"?`)) {
                                                            deleteMutation.mutate(item.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* Seção FIX 09: Prazos Financeiros de Duplicatas por Empresa */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="font-semibold text-foreground flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Prazos de Vencimento de Duplicatas / Boletos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Configure o prazo comercial de vencimento das duplicatas (D+N). A regra global é aplicada a todas as empresas, exceto quando houver prazo específico definido.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetPrazoForm();
                            setIsPrazoModalOpen(true);
                        }}
                    >
                        <Building2 className="mr-2 h-4 w-4" />
                        Personalizar Prazo por Empresa
                    </Button>
                </div>

                {/* Banner da Regra Global */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Regra Padrão Global</span>
                                <Badge variant="secondary" className="font-bold bg-primary/20 text-primary">
                                    D+{regraGlobalDuplicata?.prazo_dias ?? 7}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Aplicada automaticamente para empresas sem regra individual cadastrada.
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-primary/30 hover:bg-primary/10 text-primary"
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
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Alterar Prazo Global
                    </Button>
                </div>

                {/* Tabela de Regras Personalizadas por Empresa */}
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Modalidade</TableHead>
                                <TableHead className="text-center">Prazo Comercial</TableHead>
                                <TableHead className="text-center">Tipo de Regra</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingRegras ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando regras...</TableCell>
                                </TableRow>
                            ) : regrasEmpresasDuplicata.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                                        Nenhuma empresa possui prazo personalizado cadastrado. Todas seguem a regra global (D+{regraGlobalDuplicata?.prazo_dias ?? 7}).
                                    </TableCell>
                                </TableRow>
                            ) : (
                                regrasEmpresasDuplicata.map((r: any) => {
                                    const empresa = (empresas as any[]).find((e: any) => e.id === r.empresa_id);
                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-semibold text-foreground">
                                                {empresa?.nome || r.nome || "Empresa"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-mono">
                                                    DUPLICATA (Boleto)
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-foreground">
                                                D+{r.prazo_dias}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                                    Personalizada
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            if (confirm(`Remover prazo personalizado desta empresa e retornar ao padrão global D+${regraGlobalDuplicata?.prazo_dias ?? 7}?`)) {
                                                                deletePrazoMutation.mutate(r.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
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
    );
};
