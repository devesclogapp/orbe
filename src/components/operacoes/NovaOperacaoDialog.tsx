import { useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { OperacaoForm } from "@/components/operacoes/lancamento/OperacaoForm";

interface NovaOperacaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: any;
}

const normalizeInitialData = (data: any) => {
    if (!data) return data;

    // Safety get for nested context json values if they exist
    const getContext = (key: string) => {
        const contextoImportacao = data?.avaliacao_json?.contexto_importacao;
        return contextoImportacao ? contextoImportacao[key] : null;
    };

    return {
        ...data,
        tipo_servico: data.tipo_servico_id || data.tipo_servico,
        transportadora: data.transportadora_id || data.transportadora,
        fornecedor: data.fornecedor_id || data.fornecedor,
        produto: data.produto_carga_id || data.produto,
        forma_pagamento: data.forma_pagamento_id || data.forma_pagamento,
        data: data.data_operacao || data.data,
        modalidade_financeira: data.modalidade_financeira || data.modalidadeFinanceira || getContext("modalidade_financeira_override"),
        observacao: data.observacao || getContext("observacao"),
        placa_veiculo: data.placa || data.placa_veiculo,
        horario_inicio: data.horario_inicio_label || data.entrada_ponto || data.horario_inicio,
        horario_fim: data.horario_fim_label || data.saida_ponto || data.horario_fim,
        quantidade: data.quantidade_label !== undefined ? data.quantidade_label : data.quantidade,
        valor_unitario: data.valor_unitario_snapshot !== undefined ? data.valor_unitario_snapshot : data.valor_unitario,
        nf_emite: data.nf_numero ? (String(data.nf_numero).toUpperCase() === 'SIM' || String(data.nf_numero).toUpperCase() === 'S' || (String(data.nf_numero).toUpperCase() !== 'NÃO' && String(data.nf_numero).toUpperCase() !== 'NAO' && String(data.nf_numero).trim() !== '')) : false,
    };
};

export const NovaOperacaoDialog = ({ open, onOpenChange, initialData }: NovaOperacaoDialogProps) => {
    const normalizedData = useMemo(() => normalizeInitialData(initialData), [initialData]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background p-2 sm:p-6">
                <DialogHeader className="mb-2 px-2">
                    <DialogTitle>{initialData ? "Editar Lançamento Operacional" : "Nova Operação por Volume"}</DialogTitle>
                    <DialogDescription>
                        Lançamento administrativo completo. Após salvar, o lançamento entra no pipeline com todas as validações já registradas.
                        {!initialData && (
                            <span className="block mt-1">
                                Status padrão: <Badge variant="outline" className="text-amber-600 border-amber-300">Recebido</Badge>.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="w-full">
                    {/* Renderiza apenas se modal open preventively to avoid unneeded API calls */}
                    {open && (
                        <OperacaoForm
                            mode="admin"
                            initialData={normalizedData}
                            onSuccess={() => onOpenChange(false)}
                            onCancel={() => onOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
