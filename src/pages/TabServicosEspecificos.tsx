import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Pencil,
    Trash2,
    Save,
    Ban,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { ServicoEspecificoService, ServicoEspecificoRegra } from "@/services/domain/servicoEspecifico.service";
import { EmpresaService } from "@/services/base.service";

const PERIODOS = ["DIA", "N1", "N2", "INTEGRAL"];

export function TabServicosEspecificos() {
    const queryClient = useQueryClient();
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRegra, setEditingRegra] = useState<Partial<ServicoEspecificoRegra> | null>(null);

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_regras"],
        queryFn: () => EmpresaService.getAll()
    });

    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["servicos_especificos_regras", selectedEmpresa],
        queryFn: () => ServicoEspecificoService.getRegrasByEmpresa(selectedEmpresa),
        enabled: !!selectedEmpresa
    });

    const upsertMutation = useMutation({
        mutationFn: (data: Partial<ServicoEspecificoRegra>) => ServicoEspecificoService.upsertRegra(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servicos_especificos_regras"] });
            toast.success("Regra salva com sucesso");
            setIsModalOpen(false);
            setEditingRegra(null);
        },
        onError: (error: any) => {
            toast.error(`Erro ao salvar regra: ${error.message}`);
        }
    });

    const handleEdit = (regra: ServicoEspecificoRegra) => {
        setEditingRegra(regra);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingRegra({
            empresa_id: selectedEmpresa,
            quantidade_colaboradores: 1,
            valor_padrao: 0,
            ativo: true
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-64 space-y-2">
                    <Label>Selecione a Empresa</Label>
                    <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione uma empresa" />
                        </SelectTrigger>
                        <SelectContent>
                            {empresas.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                    {emp.nome}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    onClick={handleAddNew}
                    disabled={!selectedEmpresa}
                    className="flex gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nova Regra
                </Button>
            </div>

            {!selectedEmpresa ? (
                <Card className="p-8 text-center text-muted-foreground bg-slate-50 border-dashed">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Selecione uma empresa para gerenciar as regras de serviços específicos.
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>Colaboradores</TableHead>
                                <TableHead>Valor Padrão</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : regras.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Nenhuma regra cadastrada para esta empresa.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                regras.map((regra) => (
                                    <TableRow key={regra.id}>
                                        <TableCell className="font-bold">{regra.codigo}</TableCell>
                                        <TableCell>{regra.descricao}</TableCell>
                                        <TableCell>{regra.periodo || "-"}</TableCell>
                                        <TableCell>{regra.quantidade_colaboradores}</TableCell>
                                        <TableCell>
                                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(regra.valor_padrao)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(regra)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingRegra?.id ? "Editar Regra" : "Nova Regra de Serviço"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Código</Label>
                            <Input
                                className="col-span-3"
                                value={editingRegra?.codigo || ""}
                                onChange={(e) => setEditingRegra(prev => ({ ...prev, codigo: e.target.value }))}
                                placeholder="Ex: CN5C"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Descrição</Label>
                            <Input
                                className="col-span-3"
                                value={editingRegra?.descricao || ""}
                                onChange={(e) => setEditingRegra(prev => ({ ...prev, descricao: e.target.value }))}
                                placeholder="Descrição do serviço"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Período</Label>
                            <Select
                                value={editingRegra?.periodo || ""}
                                onValueChange={(v) => setEditingRegra(prev => ({ ...prev, periodo: v }))}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Selecione o período" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIODOS.map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Colaboradores</Label>
                            <Input
                                type="number"
                                className="col-span-3"
                                value={editingRegra?.quantidade_colaboradores || 1}
                                onChange={(e) => setEditingRegra(prev => ({ ...prev, quantidade_colaboradores: parseInt(e.target.value) }))}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Valor Padrão</Label>
                            <Input
                                type="number"
                                step="0.01"
                                className="col-span-3"
                                value={editingRegra?.valor_padrao || 0}
                                onChange={(e) => setEditingRegra(prev => ({ ...prev, valor_padrao: parseFloat(e.target.value) }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => upsertMutation.mutate(editingRegra as any)}
                            disabled={upsertMutation.isPending}
                        >
                            {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
