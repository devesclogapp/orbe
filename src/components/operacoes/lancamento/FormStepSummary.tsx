import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { ProductionFormValues } from "./schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickRegisterDialog } from "./QuickRegisterDialog";

interface FormStepSummaryProps {
    form: UseFormReturn<ProductionFormValues>;
    produtos: any[];
    formasPagamento: any[];
    loadingPreco?: boolean;
    regrasPeriodo?: any[];
    selectedPeriodo?: any;
}

export function FormStepSummary({ form, produtos, formasPagamento, loadingPreco, regrasPeriodo = [], selectedPeriodo: periodObj }: FormStepSummaryProps) {
    const { register, watch, formState: { errors } } = form;
    const values = watch();
    const isEspecífico = values.tipo_lancamento === 'servicos_especificos';
    const selectedPeriodo = periodObj as any;

    // Código Operacional Automático (ex: N1C5)
    const generatedCode = selectedPeriodo ? `${selectedPeriodo.codigo}C${values.quantidade_colaboradores}` : '';
    const empresaId = watch("empresa_id");

    const [quickRegOpen, setQuickRegOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Produto / Carga
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-primary"
                            onClick={() => setQuickRegOpen(true)}
                            disabled={!empresaId || !watch("fornecedor")}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("produto", val)}
                        key={`produto-${form.getValues("produto")}`}
                        defaultValue={form.getValues("produto") || undefined}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                            {produtos.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum encontrado</div>
                            ) : (
                                produtos.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Quantidade (Volumes/Diárias)</Label>
                    <Input type="number" {...register("quantidade")} />
                    {errors.quantidade && <p className="text-xs text-red-500">{errors.quantidade.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Qtd. Colab. (Manual)</Label>
                    <Input type="number" {...register("quantidade_colaboradores")} placeholder="Ex: 5" />
                    {errors.quantidade_colaboradores && <p className="text-xs text-red-500">{errors.quantidade_colaboradores.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="flex justify-between items-center text-xs">
                        Forma de Pagamento
                        {values.modalidade_financeira && (
                            <span className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                                Mod: {values.modalidade_financeira?.split('_')[0]}
                            </span>
                        )}
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("forma_pagamento", val)}
                        defaultValue={form.getValues("forma_pagamento")}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                        <SelectContent>
                            {formasPagamento.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                    Nenhuma forma encontrada para esta modalidade.
                                    <br />
                                    <span className="text-[10px] italic">Verifique as Regras Operacionais.</span>
                                </div>
                            ) : (
                                formasPagamento.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                    {errors.forma_pagamento && <p className="text-xs text-red-500">{errors.forma_pagamento.message}</p>}
                </div>

                {isEspecífico && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-1 duration-300">
                        <Label>Turno / Período (D1, N1...)</Label>
                        <Select
                            onValueChange={(val) => form.setValue("regra_periodo_id", val)}
                            defaultValue={form.getValues("regra_periodo_id") || undefined}
                        >
                            <SelectTrigger className="border-primary/50">
                                <SelectValue placeholder="Selecione o turno" />
                            </SelectTrigger>
                            <SelectContent>
                                {regrasPeriodo.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.codigo} - {r.descricao} ({Number(r.peso_multiplicador).toFixed(2)}x)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {generatedCode && (
                            <div className="text-[10px] text-primary font-bold uppercase tracking-tighter">
                                Código Gerado: {generatedCode}
                            </div>
                        )}
                        {errors.regra_periodo_id && <p className="text-xs text-red-500">{errors.regra_periodo_id.message}</p>}
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Valor Unitário (Automático)</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            {...register("valor_unitario")}
                            readOnly
                            className="bg-slate-50 border-dashed"
                        />
                        {loadingPreco && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-primary animate-pulse">Buscando...</div>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Emissão de Nota Fiscal?</Label>
                            <p className="text-[10px] text-muted-foreground">Obrigatório para faturamento e impostos.</p>
                        </div>
                        <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                            {...register("nf_emite")}
                        />
                    </div>

                    {values.nf_emite && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Alíquota ISS (%)</Label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 5"
                                    {...register("iss_percentual")}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Valor ISS</Label>
                                <div className="h-8 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-sm text-red-600 font-medium">
                                    - {formatCurrency(values.valor_iss || 0)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fórmula de Cálculo</Label>
                    <div className="p-4 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] space-y-1 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Plus className="h-12 w-12" />
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                            <span>Base: {values.quantidade || 0} x {formatCurrency(values.valor_unitario || 0)}</span>
                            <span className="text-white font-bold">{formatCurrency(Number(values.quantidade || 0) * Number(values.valor_unitario || 0))}</span>
                        </div>
                        {values.nf_emite && (
                            <div className="flex justify-between text-red-400">
                                <span>ISS ({values.iss_percentual || 0}%):</span>
                                <span>- {formatCurrency(values.valor_iss || 0)}</span>
                            </div>
                        )}
                        {isEspecífico && selectedPeriodo && (
                            <div className="flex justify-between text-indigo-400 border-t border-white/5 mt-1 pt-1 italic text-[10px]">
                                <span>Mult. Turno ({selectedPeriodo.codigo}):</span>
                                <span>x {Number(selectedPeriodo.peso_multiplicador).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-green-400 pt-1 text-sm border-t border-white/10 mt-1">
                            <span className="font-bold">TOTAL LÍQUIDO:</span>
                            <span className="font-bold">{formatCurrency(values.valor_total_liquido || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="p-4 bg-primary text-primary-foreground shadow-lg shadow-primary/20 border-none overflow-hidden relative group">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                <div className="flex justify-between items-center relative z-10">
                    <div className="space-y-0.5">
                        <span className="text-[10px] uppercase tracking-widest opacity-80">Valor Final Lançado</span>
                        <div className="text-2xl font-black">{formatCurrency(values.valor_total_liquido || 0)}</div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] uppercase tracking-widest opacity-80 block mb-1">Status Base</span>
                        <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold">AGUARDANDO VALIDAÇÃO</span>
                    </div>
                </div>
            </Card>

            <QuickRegisterDialog
                open={quickRegOpen}
                onOpenChange={setQuickRegOpen}
                type="produto"
                empresaId={empresaId}
                fornecedorId={watch("fornecedor")}
                onSuccess={(id) => form.setValue("produto", id)}
            />
        </div>
    );
}
