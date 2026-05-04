import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, Pencil, CheckCircle2, Ban } from "lucide-react";
import { toast } from "sonner";
import {
    RegraMarcacaoDiaristaService,
    RegraMarcacaoDiaristaPayload,
} from "@/services/base.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const TabRegrasDiaristas = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    const [form, setForm] = useState<RegraMarcacaoDiaristaPayload>({
        empresa_id: null,
        codigo: "",
        descricao: "",
        multiplicador: 1.0,
        ativo: true,
    });

    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["regras_marcacao_diaristas_crud"],
        queryFn: () => RegraMarcacaoDiaristaService.getAll(),
    });

    const resetForm = () => {
        setEditingRule(null);
        setForm({
            empresa_id: null,
            codigo: "",
            descricao: "",
            multiplicador: 1.0,
            ativo: true,
        });
        setIsModalOpen(false);
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!form.codigo) throw new Error("Código é obrigatório.");
            if (!form.descricao) throw new Error("Descrição é obrigatória.");

            const payload = {
                ...form,
                multiplicador: Number(form.multiplicador),
            };

            if (editingRule) {
                return RegraMarcacaoDiaristaService.update(editingRule.id, payload);
            }
            return RegraMarcacaoDiaristaService.create(payload);
        },
        onSuccess: () => {
            toast.success("Regra salva com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["regras_marcacao_diaristas_crud"] });
            queryClient.invalidateQueries({ queryKey: ["regras_marcacao_diaristas"] }); // pra atualizar o lançamento
            resetForm();
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async (rule: any) => {
            return RegraMarcacaoDiaristaService.update(rule.id, { ativo: !rule.ativo });
        },
        onSuccess: () => {
            toast.success("Status atualizado.");
            queryClient.invalidateQueries({ queryKey: ["regras_marcacao_diaristas_crud"] });
            queryClient.invalidateQueries({ queryKey: ["regras_marcacao_diaristas"] });
        },
        onError: (err: any) => toast.error("Erro", { description: err.message }),
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="font-semibold text-foreground">Multiplicadores do Módulo Diaristas</h2>
                    <p className="text-sm text-muted-foreground">Adicione códigos, legendas e o multiplicador que atuará no valor da diária.</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Regra
                </Button>
            </div>

            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">Código</TableHead>
                            <TableHead className="text-center">Descrição</TableHead>
                            <TableHead className="text-center">Multiplicador</TableHead>
                            <TableHead className="text-center">Escopo</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(regras as any[]).map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="font-semibold text-center">{r.codigo}</TableCell>
                                <TableCell className="text-center">{r.descricao}</TableCell>
                                <TableCell className="text-center">
                                    <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border text-muted-foreground">
                                        × {Number(r.multiplicador).toFixed(2)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="flex justify-center">
                                        {r.empresa_id ? <Badge variant="outline">{r.empresas?.nome || 'Unidade'}</Badge> : <Badge variant="secondary" className="bg-blue-100 text-blue-800">Global</Badge>}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="flex justify-center">
                                        {r.ativo ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground border-border">
                                                <Ban className="h-3 w-3 mr-1" /> Inativo
                                            </Badge>
                                        )}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleStatusMutation.mutate(r)}
                                            className="h-8 w-8 p-0"
                                            title={r.ativo ? "Inativar" : "Ativar"}
                                        >
                                            {r.ativo ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setEditingRule(r);
                                                setForm({
                                                    empresa_id: r.empresa_id,
                                                    codigo: r.codigo,
                                                    descricao: r.descricao,
                                                    multiplicador: r.multiplicador,
                                                    ativo: r.ativo,
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="h-8 px-2 text-xs"
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(regras as any[]).length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Nenhuma regra específica encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Código / Letra (Ex: P, MP, HE)</Label>
                            <Input
                                value={form.codigo}
                                onChange={(e) => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                                placeholder="Digite o código"
                                disabled={editingRule !== null} // não permite mudar código após criar pra não quebrar histórico
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                                value={form.descricao}
                                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                                placeholder="Ex: Hora Extra 100%"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Multiplicador da Diária Base</Label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={form.multiplicador}
                                onChange={(e) => setForm(f => ({ ...f, multiplicador: Number(e.target.value) }))}
                                placeholder="1.0"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label>Status da Regra</Label>
                                <p className="text-xs text-muted-foreground">Apenas as ativas aparecem na tela de lançamento.</p>
                            </div>
                            <Switch checked={form.ativo} onCheckedChange={(c) => setForm(f => ({ ...f, ativo: c }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.codigo || !form.descricao}>
                            <Save className="h-4 w-4 mr-2" /> Salvar Regra
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
