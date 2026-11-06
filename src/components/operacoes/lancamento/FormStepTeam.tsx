import { UseFormReturn } from "react-hook-form";
import { ProductionFormValues, getRegrasOcorrenciaPorCargo, type ColaboradorConduta } from "./schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AlertCircle, AlertTriangle, Users, Receipt, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { InfracoesCatalogoService, InfracaoCatalogo } from "@/services/domain/infracoesCatalogo.service";

interface FormStepTeamProps {
    form: UseFormReturn<ProductionFormValues>;
    colaboradores: any[];
    selectedIds: string[];
    onToggleColaborador: (id: string) => void;
    condutas?: Record<string, ColaboradorConduta>;
    onChangeConduta?: (colabId: string, conduta: ColaboradorConduta) => void;
}

export function FormStepTeam({
    form,
    colaboradores,
    selectedIds,
    onToggleColaborador,
    condutas = {},
    onChangeConduta,
}: FormStepTeamProps) {
    const { watch } = form;
    const qtdInformada = Number(watch("quantidade_colaboradores") || 1);
    const qtdSelecionada = selectedIds.length;
    const divergencia = qtdInformada !== qtdSelecionada;

    // Carregamento dinâmico exclusivo do catálogo de infrações configurado pelo Admin/RH
    const {
        data: catalogoInfracoes = [],
        isLoading: isLoadingCatalogo,
        isError: isErrorCatalogo,
    } = useQuery<InfracaoCatalogo[]>({
        queryKey: ["infracoes_operacionais_ativos"],
        queryFn: () => InfracoesCatalogoService.listarAtivos(),
        staleTime: 1000 * 60 * 2,
        retry: 1,
    });

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
                {colaboradores.map((colab) => {
                    const isSelected = selectedIds.includes(colab.id);
                    const conduta = condutas[colab.id] || {
                        collaborator_id: colab.id,
                        had_infraction: false,
                        infraction_type_id: "",
                        infraction_notes: "",
                        valor_provisorio: 0,
                        infracao_codigo: "",
                    };

                    // Busca o item correspondente no catálogo dinâmico
                    const infracaoSelecionada = catalogoInfracoes.find(
                        (i) => i.nome === conduta.infraction_type_id || i.codigo === conduta.infraction_type_id || i.codigo === conduta.infracao_codigo
                    );

                    return (
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
                                isSelected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "bg-white hover:bg-slate-50 border-border"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => onToggleColaborador(colab.id)}
                                    onClick={(e) => e.stopPropagation()} // Evita duplo clique ao clicar direto no check
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-sm truncate">{colab.nome}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{colab.regime_trabalho || colab.tipo_colaborador} {colab.cargo ? `· ${colab.cargo}` : ""}</span>
                                </div>
                            </div>

                            {/* Seção Expansível de Ocorrência em Serviço (Mobile Friendly) */}
                            {isSelected && (
                                <div
                                    className="mt-2 pt-3 border-t border-border/60 space-y-3"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between">
                                        <label
                                            htmlFor={`infracao-${colab.id}`}
                                            className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none"
                                        >
                                            <input
                                                id={`infracao-${colab.id}`}
                                                type="checkbox"
                                                checked={Boolean(conduta.had_infraction)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    onChangeConduta?.(colab.id, {
                                                        collaborator_id: colab.id,
                                                        had_infraction: checked,
                                                        infraction_type_id: checked ? (conduta.infraction_type_id || "") : "",
                                                        infraction_notes: checked ? (conduta.infraction_notes || "") : "",
                                                        valor_provisorio: checked ? (conduta.valor_provisorio || 0) : 0,
                                                        infracao_codigo: checked ? (conduta.infracao_codigo || "") : "",
                                                    });
                                                }}
                                                className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1.5 text-rose-700">
                                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                                Registrar Ocorrência / Falta em Serviço
                                            </span>
                                        </label>

                                        {conduta.had_infraction && (
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                                                Ocorrência
                                            </span>
                                        )}
                                    </div>

                                    {conduta.had_infraction && (
                                        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg space-y-3 animate-in fade-in duration-200">
                                            {isErrorCatalogo ? (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
                                                    <div className="font-semibold flex items-center gap-1.5">
                                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                                        <span>Catálogo de Infrações Indisponível</span>
                                                    </div>
                                                    <p className="text-[11px] text-amber-700">
                                                        Não foi possível carregar as infrações oficiais cadastradas pelo Admin. O registro de ocorrências com valores não validados está bloqueado por governança.
                                                    </p>
                                                </div>
                                            ) : catalogoInfracoes.length === 0 ? (
                                                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-muted-foreground">
                                                    Nenhuma infração ativa cadastrada pelo RH/Administração nas Configurações do sistema.
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-medium text-slate-700">
                                                            Tipo de Ocorrência <span className="text-rose-600">*</span>
                                                        </Label>
                                                        <Select
                                                            value={conduta.infraction_type_id || ""}
                                                            onValueChange={(val) => {
                                                                const itemCatalogo = catalogoInfracoes.find(
                                                                    (i) => i.nome === val || i.codigo === val
                                                                );
                                                                onChangeConduta?.(colab.id, {
                                                                    ...conduta,
                                                                    collaborator_id: colab.id,
                                                                    had_infraction: true,
                                                                    infraction_type_id: val,
                                                                    infracao_codigo: itemCatalogo?.codigo || val,
                                                                    valor_provisorio: Number(itemCatalogo?.valor_referencia || 0),
                                                                });
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs bg-white border-rose-200 focus:ring-rose-500">
                                                                <SelectValue placeholder="Selecione a infração ocorrida" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {catalogoInfracoes.map((regra) => (
                                                                    <SelectItem key={regra.id} value={regra.nome} className="text-xs">
                                                                        <span className="font-medium">{regra.nome}</span>
                                                                        {Number(regra.valor_referencia || 0) > 0 && (
                                                                            <span className="text-muted-foreground ml-1.5 text-[10px]">
                                                                                (Ref: R$ {Number(regra.valor_referencia).toFixed(2)})
                                                                            </span>
                                                                        )}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Exibição do Desconto Provisório de Referência */}
                                                    {infracaoSelecionada && (
                                                        <div className="p-2.5 rounded-md bg-white border border-rose-200/80 space-y-1.5">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-slate-600 font-medium flex items-center gap-1">
                                                                    <Receipt className="h-3.5 w-3.5 text-amber-600" />
                                                                    Desconto Provisório de Referência:
                                                                </span>
                                                                <span className="font-mono font-bold text-amber-700">
                                                                    {Number(infracaoSelecionada.valor_referencia || 0) > 0
                                                                        ? `R$ ${Number(infracaoSelecionada.valor_referencia).toFixed(2)}`
                                                                        : "Sem dedução pecuniária"}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Info className="h-3 w-3 shrink-0 text-blue-500" />
                                                                Valor de referência para apuração do RH. O desconto efetivo dependerá de comprovação de dano e deliberação administrativa.
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs font-medium text-slate-700">
                                                                Descrição do Fato / Evidência <span className="text-rose-600">*</span>
                                                            </Label>
                                                            <span className="text-[10px] text-muted-foreground font-normal">Obrigatório</span>
                                                        </div>
                                                        <Textarea
                                                            rows={2}
                                                            value={conduta.infraction_notes || ""}
                                                            onChange={(e) => {
                                                                onChangeConduta?.(colab.id, {
                                                                    ...conduta,
                                                                    collaborator_id: colab.id,
                                                                    had_infraction: true,
                                                                    infraction_notes: e.target.value,
                                                                });
                                                            }}
                                                            placeholder="Descreva detalhadamente o ocorrido (ex: avaria de caixas durante paletização, não uso de EPI, conduta irregular)..."
                                                            className="text-xs bg-white border-rose-200 focus-visible:ring-rose-500 resize-none min-h-[64px]"
                                                        />
                                                    </div>

                                                    <p className="text-[10px] text-rose-800/90 leading-snug">
                                                        ⚠️ Ocorrências retêm preventivamente a operação para auditoria do RH/Gestão e <strong>não geram desconto automático</strong>.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
