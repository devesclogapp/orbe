import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmpresaService, RegrasFinanceirasService } from "@/services/base.service";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useOperationalPipeline, buildOperacaoVolumePipeline } from "@/contexts/OperationalPipelineContext";
import { supabase } from "@/lib/supabase";

interface NovaOperacaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const NovaOperacaoDialog = ({ open, onOpenChange }: NovaOperacaoDialogProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { openPipeline } = useOperationalPipeline();

    const [empresaId, setEmpresaId] = useState("");
    const [cliente, setCliente] = useState("");
    const [operacao, setOperacao] = useState("");
    const [volume, setVolume] = useState("");
    const [valorUnitario, setValorUnitario] = useState("");
    const [modalidade, setModalidade] = useState("");

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!empresaId || !operacao || !volume || !valorUnitario || !modalidade) {
                throw new Error("Preencha todos os campos obrigatórios (Empresa, Operação, Volume, Valor, Modalidade).");
            }
            if (Number(volume) <= 0) {
                throw new Error("O volume deve ser maior que 0.");
            }

            const valorDescarga = Number(volume) * Number(valorUnitario);
            const hoje = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase.from("operacoes_producao").insert({
                empresa_id: empresaId,
                produto_label: operacao,
                fornecedor_id: null, // manual override, you can use transportadora_label/cliente matching later
                quantidade: Number(volume),
                valor_unitario: Number(valorUnitario),
                valor_descarga: valorDescarga,
                total_final: valorDescarga,
                forma_pagamento: modalidade, // We bind the manual input as forma pagto which maps to modalidade downstream
                status: "pendente",
                data_operacao: hoje,
                origem_dado: "manual",
            }).select("*").single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast.success("Operação lançada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });

            setEmpresaId("");
            setCliente("");
            setOperacao("");
            setVolume("");
            setValorUnitario("");
            setModalidade("");
            onOpenChange(false);

            const comp = data.data_operacao.substring(0, 7);
            openPipeline(buildOperacaoVolumePipeline({
                competencia: comp,
                empresa: data.empresa_id,
                currentStep: "validacao"
            }));
        },
        onError: (err: any) => toast.error("Erro ao salvar operação.", { description: err.message }),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Nova Operação por Volume</DialogTitle>
                    <DialogDescription>
                        Insira os dados referentes ao volume executado. Ao confirmar, a operação entrará no pipeline para Validação.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Empresa</Label>
                        <Select value={empresaId} onValueChange={setEmpresaId}>
                            <SelectTrigger className="h-10 border-[#C4C4C4] focus:ring-info-strong">
                                <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                {empresas.map((e: any) => (
                                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cliente / Fornecedor</Label>
                            <Input
                                className="h-10 border-[#C4C4C4] focus:ring-info-strong"
                                placeholder="Opcional"
                                value={cliente}
                                onChange={(e) => setCliente(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Operação / Label</Label>
                            <Input
                                className="h-10 border-[#C4C4C4] focus:ring-info-strong"
                                placeholder="Descarga de Caixas"
                                value={operacao}
                                onChange={(e) => setOperacao(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Volume Operado</Label>
                            <Input
                                type="number"
                                className="h-10 border-[#C4C4C4] focus:ring-info-strong"
                                placeholder="0"
                                value={volume}
                                onChange={(e) => setVolume(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor Unitário (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                className="h-10 border-[#C4C4C4] focus:ring-info-strong"
                                placeholder="0.00"
                                value={valorUnitario}
                                onChange={(e) => setValorUnitario(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Modalidade de Cobrança (Pagamento)</Label>
                        <Select value={modalidade} onValueChange={setModalidade}>
                            <SelectTrigger className="h-10 border-[#C4C4C4] focus:ring-info-strong">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PIX">Pix (À vista)</SelectItem>
                                <SelectItem value="TRANSFERÊNCIA">Transferência (À vista)</SelectItem>
                                <SelectItem value="BOLETO">Boleto (Faturado)</SelectItem>
                                <SelectItem value="DEPOSITO MENSAL">Mensal</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {volume && valorUnitario ? (
                        <div className="p-3 bg-muted/40 rounded border flex items-center justify-between text-sm">
                            <span className="font-medium text-muted-foreground">Total Calculado:</span>
                            <span className="font-bold text-lg text-foreground">
                                {(Number(volume) * Number(valorUnitario)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || !empresaId || !volume || !modalidade}
                        className="bg-brand hover:bg-brand/90 text-white border-0"
                    >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Lançar Operação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
