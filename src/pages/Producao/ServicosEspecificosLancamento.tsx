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
import { Loader2, Save, Info, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

import { EmpresaService, UnidadeOperacionalService, FornecedorService, TransportadoraClienteService, TipoServicoOperacionalService, ProdutoCargaService } from '@/services/base.service';
import { ServicosEspecificosRegrasService, ServicosEspecificosLancamentoService } from '@/services/domain/servicos_especificos.service';
import { FornecedorValorServicoService } from '@/services/domain/core.service';
import { formatCurrency } from '@/lib/utils';

export default function ServicosEspecificosLancamento() {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [empresaId, setEmpresaId] = useState('');
    const [unidadeId, setUnidadeId] = useState('');
    const [fornecedorId, setFornecedorId] = useState('');
    const [transportadoraId, setTransportadoraId] = useState('');
    const [produtoCargaId, setProdutoCargaId] = useState('');
    const [tipoServicoId, setTipoServicoId] = useState('');

    const [regraId, setRegraId] = useState(''); // ID da Regra de Período (D1, N1...)
    const [quantidade, setQuantidade] = useState(1);
    const [numColaboradores, setNumColaboradores] = useState(1);
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

    const { data: fornecedores } = useQuery({
        queryKey: ['fornecedores', empresaId],
        queryFn: () => FornecedorService.getByEmpresa(empresaId),
        enabled: !!empresaId
    });

    const { data: transportadoras } = useQuery({
        queryKey: ['transportadoras', empresaId],
        queryFn: () => TransportadoraClienteService.getByEmpresa(empresaId),
        enabled: !!empresaId
    });

    const { data: produtos } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => ProdutoCargaService.getAll()
    });

    const { data: tiposServico } = useQuery({
        queryKey: ['tipos_servico'],
        queryFn: () => TipoServicoOperacionalService.getAllActive()
    });

    // Resolver Preço Base
    const { data: resolvedPrice, isLoading: isResolvingPrice } = useQuery({
        queryKey: ['resolver_preco_base', empresaId, unidadeId, tipoServicoId, fornecedorId, transportadoraId, produtoCargaId, dataOperacao],
        queryFn: () => FornecedorValorServicoService.resolverValor({
            empresaId,
            unidadeId: unidadeId || null,
            tipoServicoId,
            fornecedorId: fornecedorId || null,
            transportadoraId: transportadoraId || null,
            produtoCargaId: produtoCargaId || null,
            dataOperacao
        }),
        enabled: !!empresaId && !!tipoServicoId
    });

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            return ServicosEspecificosLancamentoService.createLancamento(payload);
        },
        onSuccess: () => {
            toast.success("Lançamento operacional salvo!");
            queryClient.invalidateQueries({ queryKey: ['servicos_especificos_lancamentos'] });
            navigate('/producao');
        },
        onError: (err) => {
            toast.error("Falha ao salvar lançamento.");
            console.error(err);
        }
    });

    const selectedPeriodo = regras?.find(r => r.id === regraId);
    const generatedCode = selectedPeriodo ? `${selectedPeriodo.codigo}C${numColaboradores}` : '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empresaId || !regraId || !dataOperacao || !tipoServicoId) {
            toast.warning("Preencha Empresa, Tipo de Serviço, Período e Data.");
            return;
        }

        if (!selectedPeriodo) return;

        const valorUnitarioBase = resolvedPrice?.valor_unitario || 0;
        const fator = Number(selectedPeriodo.peso_multiplicador || 1);
        const tipoCalculo = resolvedPrice?.tipo_calculo || 'volume';

        // Cálculo: valor_unitario_base * quantidade * fator
        const valorTotal = (valorUnitarioBase * quantidade) * fator;

        mutation.mutate({
            empresa_id: empresaId,
            unidade_id: (unidadeId && unidadeId !== 'none') ? unidadeId : null,
            fornecedor_id: (fornecedorId && fornecedorId !== 'none') ? fornecedorId : null,
            transportadora_id: (transportadoraId && transportadoraId !== 'none') ? transportadoraId : null,
            produto_carga_id: (produtoCargaId && produtoCargaId !== 'none') ? produtoCargaId : null,
            tipo_servico_id: tipoServicoId,
            regra_id: regraId,
            data_operacao: dataOperacao,
            quantidade,
            quantidade_colaboradores: numColaboradores,
            codigo_operacional: generatedCode,

            // Snapshots
            valor_unitario: valorUnitarioBase, // Legacy field
            valor_unitario_snapshot: valorUnitarioBase,
            fator_periodo_snapshot: fator,
            tipo_calculo_snapshot: tipoCalculo,
            valor_total: valorTotal,

            observacao,
            tenant_id: tenantId || '',
            encarregado_nome: user?.email || 'Sistema',
            status: 'CONCLUIDO'
        });
    };

    return (
        <OperationalShell title="Períodos Operacionais">
            <div className="container mx-auto p-4 max-w-4xl pt-8 space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Períodos Operacionais</h2>
                    <p className="text-muted-foreground">
                        Seleção de período operacional e geração automática de código (ex: N1C5).
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamento de Turno</CardTitle>
                        <CardDescription>O sistema calculará o valor conforme o multiplicador do turno selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Fornecedor (Opcional)</Label>
                                    <Select value={fornecedorId} onValueChange={setFornecedorId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum</SelectItem>
                                            {(fornecedores || []).map((f: any) => (
                                                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Transportadora (Opcional)</Label>
                                    <Select value={transportadoraId} onValueChange={setTransportadoraId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione a transportadora" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhuma</SelectItem>
                                            {(transportadoras || []).map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Produto (Opcional)</Label>
                                    <Select value={produtoCargaId} onValueChange={setProdutoCargaId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum</SelectItem>
                                            {(produtos || []).map((p: any) => (
                                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo de Serviço (Obrigatório p/ Preço)</Label>
                                    <Select value={tipoServicoId} onValueChange={setTipoServicoId}>
                                        <SelectTrigger><SelectValue placeholder="Descarga, Carregamento..." /></SelectTrigger>
                                        <SelectContent>
                                            {(tiposServico || []).map((ts: any) => (
                                                <SelectItem key={ts.id} value={ts.id}>{ts.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Unidade (Opcional)</Label>
                                    <Select value={unidadeId} onValueChange={setUnidadeId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Matriz/Filial" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhuma</SelectItem>
                                            {(unidades || []).map((u: any) => (
                                                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Turno / Período de Operação</Label>
                                    <Select value={regraId} onValueChange={setRegraId} disabled={!empresaId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o turno (D1, N1...)" /></SelectTrigger>
                                        <SelectContent>
                                            {(regras || []).map((r: any) => (
                                                <SelectItem key={r.id} value={r.id}>
                                                    {r.codigo} - {r.descricao} ({Number(r.peso_multiplicador).toFixed(2)}x)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Qtd. de Colaboradores</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={numColaboradores}
                                        onChange={e => setNumColaboradores(Number(e.target.value))}
                                    />
                                    {generatedCode && (
                                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                                            <Info className="w-3 h-3" /> Gera código: {generatedCode}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Quantidade Repetições/Volumes</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantidade}
                                        onChange={e => setQuantidade(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Observações</Label>
                                <Input
                                    value={observacao}
                                    onChange={e => setObservacao(e.target.value)}
                                    placeholder="Informações adicionais da operação..."
                                />
                            </div>

                            {selectedPeriodo && (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            Valor Unitário Base:
                                            {isResolvingPrice && <Loader2 className="w-3 h-3 animate-spin" />}
                                        </span>
                                        <span className="font-medium">
                                            {resolvedPrice ? formatCurrency(resolvedPrice.valor_unitario) : (isResolvingPrice ? 'Consultando...' : 'Não definido')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Multiplicador de Turno ({selectedPeriodo.codigo}):</span>
                                        <span className="font-medium text-primary">{Number(selectedPeriodo.peso_multiplicador).toFixed(2)}x</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Quantidade (Volumes/Repetições):</span>
                                        <span className="font-medium">{quantidade}</span>
                                    </div>
                                    <div className="pt-2 mt-2 border-t flex justify-between items-center font-bold text-lg">
                                        <span>Total Previsto:</span>
                                        <span className="text-green-600">
                                            {resolvedPrice
                                                ? formatCurrency((resolvedPrice.valor_unitario * quantidade) * (selectedPeriodo.peso_multiplicador || 1))
                                                : 'Aguardando precificação...'}
                                        </span>
                                    </div>
                                    {!resolvedPrice && !isResolvingPrice && tipoServicoId && (
                                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Nenhuma regra operacional encontrada para este cenário. Valor ficará R$ 0,00.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <Button type="submit" size="lg" disabled={mutation.isPending || isResolvingPrice} className="w-full md:w-auto px-12">
                                    {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Salvar Lançamento {generatedCode && `(${generatedCode})`}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </OperationalShell>
    );
}
