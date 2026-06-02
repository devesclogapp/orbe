import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

import { EmpresaService, UnidadeOperacionalService } from '@/services/base.service';
import { ServicosEspecificosRegrasService, ServicosEspecificosLancamentoService } from '@/services/domain/servicos_especificos.service';

export default function ServicosEspecificosLancamento() {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [empresaId, setEmpresaId] = useState('');
    const [unidadeId, setUnidadeId] = useState('');
    const [regraId, setRegraId] = useState('');
    const [quantidade, setQuantidade] = useState(1);
    const [dataOperacao, setDataOperacao] = useState(new Date().toISOString().slice(0, 10));
    const [observacao, setObservacao] = useState('');

    // Queries
    const { data: regras } = useQuery({
        queryKey: ['servicos_especificos_regras_ativas', empresaId],
        queryFn: () => ServicosEspecificosRegrasService.getAtivosByEmpresa(empresaId)
    });

    const { data: empresas } = useQuery({
        queryKey: ['empresas_ativas'],
        queryFn: () => EmpresaService.getAll()
    });

    const { data: unidades } = useQuery({
        queryKey: ['unidades_empresa', empresaId],
        queryFn: () => UnidadeOperacionalService.getByEmpresa(empresaId),
        enabled: !!empresaId
    });

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            return ServicosEspecificosLancamentoService.createLancamento(payload);
        },
        onSuccess: () => {
            toast.success("Lançamento salvo com sucesso!");
            setRegraId('');
            setQuantidade(1);
            setObservacao('');
        },
        onError: (err) => {
            toast.error("Falha ao salvar lançamento.");
            console.error(err);
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empresaId || !regraId || !dataOperacao) {
            toast.warning("Preencha todos os campos obrigatórios (Empresa, Regra e Data).");
            return;
        }

        const regra = regras?.find(r => r.id === regraId);
        if (!regra) return;

        const valorUnitario = regra.valor_padrao || 0;
        const valorTotal = valorUnitario * quantidade;

        mutation.mutate({
            empresa_id: empresaId,
            unidade_id: unidadeId || null,
            regra_id: regraId,
            data_operacao: dataOperacao,
            quantidade,
            valor_unitario: valorUnitario,
            valor_total: valorTotal,
            observacao,
            tenant_id: tenantId || '',
            encarregado_nome: user?.email || 'Sistema'
        });
    };

    return (
        <OperationalShell title="Serviços Específicos">
            <div className="container mx-auto p-4 max-w-4xl pt-8 space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Serviços Específicos</h2>
                    <p className="text-muted-foreground">
                        Lançamento rápido de serviços tabulados por regras operacionais (ex: CN5C, N1).
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Novo Lançamento</CardTitle>
                        <CardDescription>Preencha os dados da operação realizada no turno.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data da Operação</Label>
                                    <Input
                                        type="date"
                                        value={dataOperacao}
                                        onChange={e => setDataOperacao(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Empresa</Label>
                                    <Select value={empresaId} onValueChange={setEmpresaId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                        <SelectContent>
                                            {(empresas || []).map((e: any) => (
                                                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Unidade (Opcional)</Label>
                                    <Select value={unidadeId} onValueChange={setUnidadeId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Matriz/Filial" /></SelectTrigger>
                                        <SelectContent>
                                            {(unidades || []).map((u: any) => (
                                                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Serviço / Regra</Label>
                                    <Select value={regraId} onValueChange={setRegraId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Ex: CN5C - Carregamento" /></SelectTrigger>
                                        <SelectContent>
                                            {(regras || []).map((r: any) => (
                                                <SelectItem key={r.id} value={r.id}>
                                                    {r.codigo} - {r.descricao} (R$ {r.valor_padrao})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantidade Repetições</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantidade}
                                        onChange={e => setQuantidade(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Observações (Opcional)</Label>
                                    <Input
                                        value={observacao}
                                        onChange={e => setObservacao(e.target.value)}
                                        placeholder="Detalhes ou justificativas..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={mutation.isPending} className="w-full md:w-auto">
                                    {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Lançar Serviço Específico
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </OperationalShell>
    );
}
