import { UseFormReturn } from "react-hook-form";
import { ProductionFormValues } from "./schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormStepTeamProps {
    form: UseFormReturn<ProductionFormValues>;
    colaboradores: any[];
    selectedIds: string[];
    colaboradorTimings?: Record<string, { entrada_ponto?: string, saida_almoco?: string, retorno_almoco?: string, saida_ponto?: string }>;
    setColaboradorTimings?: React.Dispatch<React.SetStateAction<Record<string, { entrada_ponto?: string, saida_almoco?: string, retorno_almoco?: string, saida_ponto?: string }>>>;
    onToggleColaborador: (id: string) => void;
}

export function FormStepTeam({ form, colaboradores, selectedIds, colaboradorTimings = {}, setColaboradorTimings, onToggleColaborador }: FormStepTeamProps) {
    const { watch } = form;
    const qtdInformada = Number(watch("quantidade_colaboradores") || 1);
    const qtdSelecionada = selectedIds.length;
    const divergencia = qtdInformada !== qtdSelecionada;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-200 rounded-lg">
                        <Users className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Equipe Requerida</p>
                        <p className="text-xs text-muted-foreground">{qtdInformada} colaborador(es)</p>
                    </div>
                </div>
                <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    divergencia ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                )}>
                    {qtdSelecionada} selecionado(s)
                </div>
            </div>

            {divergencia && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>A quantidade de colaboradores selecionados deve ser igual à informada no passo anterior ({qtdInformada}).</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colaboradores.map((colab) => (
                    <div
                        key={colab.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggleColaborador(colab.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onToggleColaborador(colab.id);
                            }
                        }}
                        className={cn(
                            "flex flex-col gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer",
                            selectedIds.includes(colab.id)
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "bg-white hover:bg-slate-50 border-border"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={selectedIds.includes(colab.id)}
                                onCheckedChange={() => onToggleColaborador(colab.id)}
                                onClick={(e) => e.stopPropagation()} // Evita duplo clique ao clicar direto no check
                            />
                            <div className="flex flex-col min-w-0">
                                <span className="font-medium text-sm truncate">{colab.nome}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{colab.regime_trabalho || colab.tipo_colaborador}</span>
                            </div>
                        </div>

                        {selectedIds.includes(colab.id) && setColaboradorTimings && (
                            <div className="w-full mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Entrada</Label>
                                    <input
                                        type="time"
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        value={colaboradorTimings[colab.id]?.entrada_ponto || ""}
                                        onChange={(e) => setColaboradorTimings(prev => ({
                                            ...prev,
                                            [colab.id]: { ...prev[colab.id], entrada_ponto: e.target.value }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Saída Almoço</Label>
                                    <input
                                        type="time"
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        value={colaboradorTimings[colab.id]?.saida_almoco || ""}
                                        onChange={(e) => setColaboradorTimings(prev => ({
                                            ...prev,
                                            [colab.id]: { ...prev[colab.id], saida_almoco: e.target.value }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Retorno Almoço</Label>
                                    <input
                                        type="time"
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        value={colaboradorTimings[colab.id]?.retorno_almoco || ""}
                                        onChange={(e) => setColaboradorTimings(prev => ({
                                            ...prev,
                                            [colab.id]: { ...prev[colab.id], retorno_almoco: e.target.value }
                                        }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Saída Final</Label>
                                    <input
                                        type="time"
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                                        value={colaboradorTimings[colab.id]?.saida_ponto || ""}
                                        onChange={(e) => setColaboradorTimings(prev => ({
                                            ...prev,
                                            [colab.id]: { ...prev[colab.id], saida_ponto: e.target.value }
                                        }))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
