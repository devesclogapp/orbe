import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    EmpresaService,
    TipoServicoOperacionalService,
    ProdutoCargaService,
    TransportadoraClienteService,
    FornecedorService,
    FormaPagamentoOperacionalService,
    getCurrentTenantId,
} from "@/services/base.service";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import {
    useOperationalPipeline,
    buildOperacaoVolumePipeline,
} from "@/contexts/OperationalPipelineContext";
import { supabase } from "@/lib/supabase";
import { QuickRegisterDialog } from "./lancamento/QuickRegisterDialog";

interface NovaOperacaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const NovaOperacaoDialog = ({ open, onOpenChange }: NovaOperacaoDialogProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { openPipeline } = useOperationalPipeline();

    // Form state — todos os campos estruturais usam IDs do banco
    const [empresaId, setEmpresaId] = useState("");
    const [tipoServicoId, setTipoServicoId] = useState("");
    const [transportadoraId, setTransportadoraId] = useState("");
    const [fornecedorId, setFornecedorId] = useState("");
    const [produtoCargaId, setProdutoCargaId] = useState("");
    const [formaPagamentoId, setFormaPagamentoId] = useState("");
    const [quantidade, setQuantidade] = useState("");
    const [valorUnitario, setValorUnitario] = useState("");
    const [placa, setPlaca] = useState("");

    // Quick register state
    const [quickReg, setQuickReg] = useState<{ open: boolean; type: "transportadora" | "fornecedor" | "produto" }>({
        open: false,
        type: "transportadora"
    });

    const openQuickReg = (type: "transportadora" | "fornecedor" | "produto") => {
        setQuickReg({ open: true, type });
    };

    // ── Queries — fontes oficiais de dados ──────────────────────────
    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
        enabled: open,
    });

    const { data: tiposServico = [] } = useQuery({
        queryKey: ["tipos_servico"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
        enabled: open,
    });

    const { data: transportadoras = [] } = useQuery({
        queryKey: ["transportadoras", empresaId],
        queryFn: () => TransportadoraClienteService.getByEmpresa(empresaId),
        enabled: open && !!empresaId,
    });

    const { data: fornecedores = [] } = useQuery({
        queryKey: ["fornecedores", empresaId],
        queryFn: () => FornecedorService.getByEmpresa(empresaId),
        enabled: open && !!empresaId,
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ["produtos"],
        queryFn: () => ProdutoCargaService.getAll(),
        enabled: open,
    });

    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
        enabled: open,
    });

    // ── Computed ─────────────────────────────────────────────────────
    const totalCalculado = Number(quantidade) * Number(valorUnitario);
    const camposFaltando = !empresaId || !tipoServicoId || !quantidade || !valorUnitario || !formaPagamentoId;

    // ── Mutation ─────────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (camposFaltando) {
                throw new Error("Preencha: Empresa, Serviço, Quantidade, Valor Unitário e Forma de Pagamento.");
            }
            if (Number(quantidade) <= 0) {
                throw new Error("A quantidade deve ser maior que 0.");
            }
            if (Number(valorUnitario) <= 0) {
                throw new Error("O valor unitário deve ser maior que 0.");
            }

            const hoje = new Date().toISOString().split("T")[0];

            const tenantId = await getCurrentTenantId();

            // Payload limpo e alinhado com o schema real de operacoes_producao
            const payload: Record<string, unknown> = {
                tenant_id: tenantId,
                empresa_id: empresaId,
                tipo_servico_id: tipoServicoId,
                quantidade: Number(quantidade),
                valor_unitario_snapshot: Number(valorUnitario),
                tipo_calculo_snapshot: "volume",        // padrão para lançamento manual
                forma_pagamento_id: formaPagamentoId,
                data_operacao: hoje,
                origem_dado: "manual",
                status: "aguardando_validacao",          // Admin lança → aguarda validação
                responsavel_nome: user?.user_metadata?.full_name || "Admin",
            };

            // Campos opcionais — só envia se foi preenchido
            if (transportadoraId) payload.transportadora_id = transportadoraId;
            if (fornecedorId) payload.fornecedor_id = fornecedorId;
            if (produtoCargaId) payload.produto_carga_id = produtoCargaId;
            if (placa.trim()) payload.placa = placa.trim();

            // O serviço OperacaoProducaoService.create já lida com tenant_id e sanitização
            return OperacaoProducaoService.create(payload);
        },
        onSuccess: (data) => {
            toast.success("Operação lançada com sucesso!", {
                description: "Status: aguardando validação."
            });
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });

            // Reset form
            setEmpresaId(""); setTipoServicoId(""); setTransportadoraId("");
            setFornecedorId(""); setProdutoCargaId(""); setFormaPagamentoId("");
            setQuantidade(""); setValorUnitario(""); setPlaca("");
            onOpenChange(false);

            const comp = data.data_operacao.substring(0, 7);
            openPipeline(buildOperacaoVolumePipeline({
                competencia: comp,
                empresa: data.empresa_id,
                currentStep: "validacao",
            }));
        },
        onError: (err: any) =>
            toast.error("Erro ao salvar operação.", { description: err.message }),
    });

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nova Operação por Volume</DialogTitle>
                        <DialogDescription>
                            Lançamento administrativo. Todos os campos estruturais são preenchidos
                            por selects do banco. Após salvar, entra no pipeline com status{" "}
                            <Badge variant="outline" className="text-amber-600 border-amber-300">aguardando validação</Badge>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Empresa */}
                        <div className="space-y-1.5">
                            <Label>Empresa <span className="text-red-500">*</span></Label>
                            <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v); setTransportadoraId(""); setFornecedorId(""); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {empresas.length === 0
                                        ? <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma empresa cadastrada</div>
                                        : empresas.map((e: any) => (
                                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Serviço */}
                        <div className="space-y-1.5">
                            <Label>Tipo de Serviço / Operação <span className="text-red-500">*</span></Label>
                            <Select value={tipoServicoId} onValueChange={setTipoServicoId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o serviço" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tiposServico.length === 0
                                        ? <div className="px-3 py-2 text-sm text-muted-foreground">Cadastre tipos de serviço em Regras Operacionais</div>
                                        : tiposServico.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Transportadora + Fornecedor (dependem de empresa) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="flex justify-between items-center">
                                    Transportadora
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-primary"
                                        onClick={() => openQuickReg("transportadora")}
                                        disabled={!empresaId}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </Label>
                                <Select value={transportadoraId} onValueChange={setTransportadoraId} disabled={!empresaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={empresaId ? "Selecione..." : "Selecione empresa primeiro"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {transportadoras.length === 0
                                            ? <div className="px-3 py-2 text-sm text-muted-foreground">
                                                Nenhuma encontrada
                                            </div>
                                            : transportadoras.map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="flex justify-between items-center">
                                    Fornecedor
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-primary"
                                        onClick={() => openQuickReg("fornecedor")}
                                        disabled={!empresaId}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </Label>
                                <Select value={fornecedorId} onValueChange={setFornecedorId} disabled={!empresaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={empresaId ? "Selecione..." : "Selecione empresa primeiro"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fornecedores.length === 0
                                            ? <div className="px-3 py-2 text-sm text-muted-foreground">
                                                Nenhum encontrado
                                            </div>
                                            : fornecedores.map((f: any) => (
                                                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Produto */}
                        <div className="space-y-1.5">
                            <Label className="flex justify-between items-center">
                                Produto / Carga
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-primary"
                                    onClick={() => openQuickReg("produto")}
                                    disabled={!empresaId || !fornecedorId}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </Label>
                            <Select value={produtoCargaId} onValueChange={setProdutoCargaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o produto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {produtos.length === 0
                                        ? <div className="px-3 py-2 text-sm text-muted-foreground">
                                            Nenhum encontrado
                                        </div>
                                        : produtos.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Quantidade + Valor Unitário */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Quantidade <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={quantidade}
                                    onChange={(e) => setQuantidade(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Valor Unitário (R$) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={valorUnitario}
                                    onChange={(e) => setValorUnitario(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Forma de Pagamento */}
                        <div className="space-y-1.5">
                            <Label>Forma de Pagamento <span className="text-red-500">*</span></Label>
                            <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {formasPagamento.length === 0
                                        ? <div className="px-3 py-2 text-sm text-muted-foreground">
                                            Cadastre em Regras Operacionais
                                        </div>
                                        : formasPagamento.map((f: any) => (
                                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Placa */}
                        <div className="space-y-1.5">
                            <Label>Placa do Veículo <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                            <Input
                                placeholder="Ex: ABC-1234"
                                value={placa}
                                onChange={(e) => setPlaca(e.target.value)}
                            />
                        </div>

                        {/* Total calculado */}
                        {quantidade && valorUnitario && Number(quantidade) > 0 && Number(valorUnitario) > 0 && (
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Total Previsto:</span>
                                <span className="text-lg font-bold text-primary">
                                    {totalCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </span>
                            </div>
                        )}

                        {/* Aviso campos faltando */}
                        {!empresaId && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>Selecione uma empresa para habilitar os selects de Transportadora e Fornecedor.</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending || camposFaltando}
                        >
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Lançar Operação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <QuickRegisterDialog
                open={quickReg.open}
                onOpenChange={(open) => setQuickReg(prev => ({ ...prev, open }))}
                type={quickReg.type}
                empresaId={empresaId}
                fornecedorId={fornecedorId}
                onSuccess={(id) => {
                    if (quickReg.type === "transportadora") setTransportadoraId(id);
                    if (quickReg.type === "fornecedor") setFornecedorId(id);
                    if (quickReg.type === "produto") setProdutoCargaId(id);
                }}
            />
        </>
    );
};
