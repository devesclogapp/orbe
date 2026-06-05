import { UseFormReturn } from "react-hook-form";
import { ProductionFormValues } from "./schema";
import {
    Truck,
    ListChecks,
    Wallet,
    Package,
    Building2,
    Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormStepSelectorProps {
    form: UseFormReturn<ProductionFormValues>;
    onNext: (preset: typeof PRESETS[0]) => void;
}

const PRESETS = [
    {
        id: "operacao_padrao_vista",
        tipo: "operacao_padrao",
        modalidade: "CAIXA_IMEDIATO",
        title: "Operação por Volume — À Vista",
        description: "Carga/descarga com recebimento imediato (PIX, dinheiro, transferência, débito...).",
        icon: Truck,
        color: "bg-green-100 text-green-700",
    },
    {
        id: "operacao_padrao_prazo",
        tipo: "operacao_padrao",
        modalidade: "DUPLICATA",
        title: "Operação por Volume — Boleto/Faturamento",
        description: "Carga/descarga com boleto ou faturamento mensal (gera receitas futuras).",
        icon: ListChecks,
        color: "bg-blue-100 text-blue-700",
    },
    {
        id: "servicos_extras",
        tipo: "transbordo_servico_extra",
        modalidade: "CAIXA_IMEDIATO",
        title: "Serviços Extras",
        description: "Transbordo, apoio operacional e serviços adicionais.",
        icon: Package,
        color: "bg-purple-100 text-purple-700",
    },
    {
        id: "custos_operacionais",
        tipo: "custos_extras",
        modalidade: "CUSTO_DESPESA",
        title: "Custos / Despesas",
        description: "Registro de custos administrativos ou operacionais.",
        icon: Building2,
        color: "bg-orange-100 text-orange-700",
    },
    {
        id: "diaristas",
        tipo: "diaristas",
        modalidade: "CAIXA_IMEDIATO",
        title: "Diaristas",
        description: "Lançamento de presença e grade semanal.",
        icon: Users,
        color: "bg-amber-100 text-amber-700",
    },
    {
        id: "servicos_especificos",
        tipo: "servicos_especificos",
        modalidade: "DUPLICATA",
        title: "Serviços Específicos",
        description: "Lançamento de serviços tabulados (ex: CN5C, N1, N2).",
        icon: ListChecks,
        color: "bg-indigo-100 text-indigo-700",
    },
];

export function FormStepSelector({ form, onNext }: FormStepSelectorProps) {
    const handleSelect = (preset: typeof PRESETS[0]) => {
        form.setValue("tipo_lancamento", preset.tipo as any);
        form.setValue("modalidade_financeira", preset.modalidade as any);
        onNext(preset);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESETS.map((preset) => (
                <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelect(preset)}
                    className="flex items-start gap-4 p-5 rounded-2xl border-2 border-transparent bg-white shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left"
                >
                    <div className={cn("p-3 rounded-xl", preset.color)}>
                        <preset.icon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{preset.title}</h3>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                    </div>
                </button>
            ))}
        </div>
    );
}
