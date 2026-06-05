import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormaPagamentoOperacionalService } from '@/services/base.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Ban, CheckCircle2, Save } from 'lucide-react';
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

    const [form, setForm] = useState({
        nome: "",
        modalidade: "AMBOS",
        ativo: true
    });

    const { data: formas = [], isLoading } = useQuery({
        queryKey: ["formas_pagamento_crud"],
        queryFn: () => FormaPagamentoOperacionalService.getAll(),
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

            <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Nome</TableHead>
                            <TableHead className="text-center">Modalidade</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Carregando...</TableCell>
                            </TableRow>
                        ) : formas.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Nenhum meio de pagamento cadastrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            formas.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.nome}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className={cn(
                                            item.modalidade === 'CAIXA_IMEDIATO' ? "bg-emerald-50 text-emerald-700" :
                                                item.modalidade === 'DUPLICATA' ? "bg-blue-50 text-blue-700" :
                                                    "bg-slate-100 text-slate-700"
                                        )}>
                                            {item.modalidade === 'CAIXA_IMEDIATO' ? 'À Vista (Caixa)' :
                                                item.modalidade === 'DUPLICATA' ? 'Prazo (Boleto/Fatura)' : 'Ambos'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="flex justify-center">
                                            {item.ativo ? (
                                                <Badge className="bg-emerald-100 text-emerald-800 border-0 hover:bg-emerald-100">
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    Ativo
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                    <Ban className="mr-1 h-3 w-3" />
                                                    Inativo
                                                </Badge>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEdit(item)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive"
                                                onClick={() => {
                                                    if (confirm("Deseja realmente excluir este meio de pagamento?")) {
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
            </div>

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
        </div>
    );
};
