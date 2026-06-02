import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Save, Trash2, Edit } from 'lucide-react';
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
import { useTenant } from '@/components/shared/TenantProvider';
import { formatCurrency } from '@/utils/formatters';

export function ServicosEspecificosRegrasTab() {
    const { currentTenant } = useTenant();
    const queryClient = useQueryClient();

    // Novo Estado de Criação
    const [isCreating, setIsCreating] = useState(false);
    const [newRegra, setNewRegra] = useState<Partial<ServicoEspecificoRegra>>({
        codigo: '',
        descricao: '',
        periodo: 'N1',
        quantidade_colaboradores: 1,
        valor_padrao: 0,
        ativo: true
    });

    const { data: regras, isLoading } = useQuery({
        queryKey: ['servicos_especificos_regras'],
        queryFn: () => ServicosEspecificosRegrasService.getAll()
    });

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            return ServicosEspecificosRegrasService.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_regras'] });
            setIsCreating(false);
            setNewRegra({
                codigo: '', descricao: '', periodo: 'N1', quantidade_colaboradores: 1, valor_padrao: 0, ativo: true
            });
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

    const handleSaveNovo = () => {
        if (!newRegra.codigo || !newRegra.descricao) return;
        createMutation.mutate({
            ...newRegra,
            tenant_id: currentTenant?.id || ''
        });
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Tabela de Serviços Específicos</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure regras, preços e períodos (ex: CN5C, N1, etc) para as operações em campo.
                    </p>
                </div>
                <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "secondary" : "default"}>
                    {isCreating ? 'Cancelar' : <><Plus className="w-4 h-4 mr-2" /> Adicionar Regra</>}
                </Button>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Colab.</TableHead>
                            <TableHead>Valor Padrão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isCreating && (
                            <TableRow className="bg-blue-50/20">
                                <TableCell>
                                    <Input
                                        placeholder="Ex: CN5C"
                                        value={newRegra.codigo}
                                        onChange={e => setNewRegra({ ...newRegra, codigo: e.target.value.toUpperCase() })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        placeholder="Carregamento..."
                                        value={newRegra.descricao}
                                        onChange={e => setNewRegra({ ...newRegra, descricao: e.target.value })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={newRegra.periodo}
                                        onValueChange={(val: any) => setNewRegra({ ...newRegra, periodo: val })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="N1">N1 - Primeiro Noturno</SelectItem>
                                            <SelectItem value="N2">N2 - Segundo Noturno</SelectItem>
                                            <SelectItem value="DIA">DIA - Diurno</SelectItem>
                                            <SelectItem value="INTEGRAL">Integral</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number" min="1"
                                        value={newRegra.quantidade_colaboradores}
                                        onChange={e => setNewRegra({ ...newRegra, quantidade_colaboradores: Number(e.target.value) })}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number" step="0.01"
                                        value={newRegra.valor_padrao}
                                        onChange={e => setNewRegra({ ...newRegra, valor_padrao: Number(e.target.value) })}
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
                                <TableCell className="font-medium">{r.codigo}</TableCell>
                                <TableCell>{r.descricao}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{r.periodo}</Badge>
                                </TableCell>
                                <TableCell>{r.quantidade_colaboradores}</TableCell>
                                <TableCell>{formatCurrency(r.valor_padrao || 0)}</TableCell>
                                <TableCell>
                                    {r.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                            if (confirm('Remover regra?')) deleteMutation.mutate(r.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
