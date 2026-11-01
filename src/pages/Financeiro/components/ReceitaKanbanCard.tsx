import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReceitaKanbanCardProps {
    receita: any;
    density: 'compact' | 'detailed';
    isExpanded: boolean;
    onToggleExpand: (e: React.MouseEvent) => void;
    onClick: () => void;
    isHighlighted?: boolean;
}

export function ReceitaKanbanCard({
    receita: r,
    density,
    isExpanded,
    onToggleExpand,
    onClick,
    isHighlighted
}: ReceitaKanbanCardProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let isVencido = false;
    let isVenceHoje = false;
    let isVenceBreve = false;

    if (r.vencimento && r.status !== 'recebido') {
        const [ano, mes, dia] = r.vencimento.split('-');
        const vDate = new Date(Number(ano), Number(mes) - 1, Number(dia));
        const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) isVencido = true;
        else if (diffDays === 0) isVenceHoje = true;
        else if (diffDays <= 3) isVenceBreve = true;
    }

    let indicatorColor = 'bg-gray-300';
    if (r.status === 'recebido' || r.status === 'pago' || r.status === 'conciliado') indicatorColor = 'bg-emerald-500';
    else if (isVencido) indicatorColor = 'bg-red-500';
    else if (isVenceHoje) indicatorColor = 'bg-amber-400';
    else if (isVenceBreve) indicatorColor = 'bg-orange-500';

    const indicatorTitle = (r.status === 'recebido' || r.status === 'pago' || r.status === 'conciliado')
        ? "Recebido"
        : isVencido
            ? "Vencido"
            : isVenceHoje
                ? "Vence hoje"
                : isVenceBreve
                    ? "Vence em breve"
                    : "No prazo";

    const itens = r.receitas_operacionais_itens || [];
    const itemCount = itens.length;
    const itemOps = itens[0]?.operacoes_producao;
    const itemExtra = itens[0]?.servicos_extras_operacionais;

    let servicoNome = itemCount > 1
        ? `Operação Consolidada (${itemCount} lançamentos)`
        : (itemOps?.servicos?.nome || itemOps?.servicos?.descricao || itemExtra?.tipo_servico || 'Operação Avulsa / Consolidada');

    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let compStr = "N/A";
    if (r.competencia) {
        const ano = r.competencia.slice(0, 4);
        const mes = r.competencia.slice(5, 7);
        compStr = `${meses[parseInt(mes) - 1] || mes}/${ano}`;
    } else if (itemOps?.data_operacao) {
        const dt = new Date(itemOps.data_operacao);
        const dtUTC = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
        compStr = `${meses[dtUTC.getMonth()]} / ${dtUTC.getFullYear()}`;
    } else if (itemExtra?.data || itemExtra?.data_servico) {
        const dt = new Date(itemExtra.data || itemExtra.data_servico);
        const dtUTC = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
        compStr = `${meses[dtUTC.getMonth()]} / ${dtUTC.getFullYear()}`;
    }

    let vencStr = "Não definido";
    if (r.modalidade === 'CAIXA_IMEDIATO') {
        vencStr = "Recebimento imediato";
    } else if (r.vencimento) {
        vencStr = new Date(r.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR');
    }

    // Subtítulo contextual e inteligente para o modo compacto
    let subtituloCompacto = "";
    const servicoCurto = itemExtra
        ? (itemExtra.tipo_servico || "Serviço Extra")
        : (itemOps?.servicos?.nome || (itemCount > 1 ? "Faturamento Mensal" : "Descarga"));

    if (r.modalidade === 'CAIXA_IMEDIATO') {
        subtituloCompacto = `${servicoCurto} • Caixa Imediato`;
    } else if (r.modalidade === 'DUPLICATA') {
        const infoVenc = r.vencimento
            ? `Venc. ${new Date(r.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}`
            : 'Duplicata';
        subtituloCompacto = `${servicoCurto} • ${infoVenc}`;
    } else { // FATURAMENTO_MENSAL
        const infoComp = compStr !== 'N/A'
            ? compStr
            : (r.vencimento ? `Venc. ${new Date(r.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}` : 'Mensal');
        const prefixoMensal = r.observacao === 'FATURA_COMPLEMENTAR' ? 'Complementar' : (itemCount > 1 ? 'Faturamento Mensal' : servicoCurto);
        subtituloCompacto = `${prefixoMensal} • ${infoComp}`;
    }

    const isCompactMode = density === 'compact';
    const showDetails = !isCompactMode || isExpanded;

    return (
        <div
            onClick={onClick}
            data-testid={`receita-card-${r.id}`}
            className={cn(
                "bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all group relative cursor-pointer",
                isHighlighted && "ring-2 ring-primary border-primary bg-primary/[0.02]",
                isCompactMode && !isExpanded ? "p-3" : "p-4"
            )}
        >
            {/* Indicador lateral de status/vencimento */}
            <div
                className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl", indicatorColor)}
                title={indicatorTitle}
            />

            <div className="pl-2 flex flex-col gap-1.5">
                {/* Linha Principal: Cliente & Valor Total */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <p className="font-bold text-gray-800 leading-tight truncate text-sm" title={r.empresas?.nome}>
                            {r.empresas?.nome || "Empresa não vinculada"}
                        </p>
                        {r.observacao === 'FATURA_COMPLEMENTAR' && (
                            <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded text-[9px] uppercase shrink-0">
                                Complementar
                            </span>
                        )}
                    </div>
                    <span className="font-black text-gray-800 text-sm shrink-0 whitespace-nowrap">
                        R$ {Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>

                {/* Linha Secundária do Modo Compacto */}
                {isCompactMode && (
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="truncate font-medium text-gray-600 text-[11px]" title={subtituloCompacto}>
                            {subtituloCompacto}
                        </span>
                        <button
                            type="button"
                            onClick={onToggleExpand}
                            aria-label={isExpanded ? "Recolher detalhes da receita" : "Expandir detalhes da receita"}
                            aria-expanded={isExpanded}
                            className="h-6 w-6 p-0 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded shrink-0 transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>
                )}

                {/* Detalhes Expandidos (ou Modo Detalhado Global) */}
                {showDetails && (
                    <div className={cn("flex flex-col gap-2", isCompactMode && "pt-2 border-t border-gray-100 mt-1 animate-in fade-in-50 duration-150")}>
                        {/* Box de Serviço / Operacional */}
                        <div className="flex flex-col text-sm text-gray-600 bg-gray-50 border border-gray-100 p-2.5 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-1">
                                <p className="font-semibold text-gray-800 tracking-wide text-xs truncate" title={servicoNome.toUpperCase()}>
                                    {servicoNome.toUpperCase()}
                                </p>
                                {itemExtra && (
                                    <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.5 rounded text-[9px] uppercase shrink-0">
                                        Serviço Extra
                                    </span>
                                )}
                            </div>

                            {/* Detalhes operacionais: se consolidado com múltiplos itens */}
                            {itemCount > 1 ? (
                                <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-200/50 pt-2 font-medium">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Volume Consolidado</span>
                                    <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded text-[10px]">
                                        {itemCount} operações
                                    </span>
                                </div>
                            ) : itemOps ? (
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-gray-500 border-t border-gray-200/50 pt-2">
                                    <div>
                                        <span className="font-bold text-gray-400 block uppercase">Quantidade</span>
                                        <span className="font-medium text-gray-900">{itemOps.quantidade || 1}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-400 block uppercase">Placa</span>
                                        <span className="font-medium text-gray-900 truncate block">{itemOps.placa || '-'}</span>
                                    </div>
                                    {itemOps.produtos?.nome && (
                                        <div className="col-span-2">
                                            <span className="font-bold text-gray-400 block uppercase">Produto</span>
                                            <span className="font-medium text-gray-900 truncate block">{itemOps.produtos.nome}</span>
                                        </div>
                                    )}
                                </div>
                            ) : itemExtra?.descricao_servico ? (
                                <div className="text-[11px] text-gray-500 border-t border-gray-200/50 pt-1.5">
                                    <span className="text-gray-600 block line-clamp-2">{itemExtra.descricao_servico}</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Metadados: Competência & Vencimento */}
                        <div className="grid grid-cols-2 text-xs text-gray-500 gap-y-1">
                            <div>
                                <span className="font-semibold block text-gray-400">Competência</span>
                                <span>{compStr}</span>
                            </div>
                            <div>
                                <span className="font-semibold block text-gray-400">Vencimento</span>
                                <span className={cn("font-medium", isVencido ? "text-red-600" : isVenceHoje ? "text-amber-600" : "")}>
                                    {vencStr}
                                </span>
                            </div>
                        </div>

                        {/* Rodapé: Modalidade & Valor Total (no modo detalhado) */}
                        {!isCompactMode && (
                            <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
                                <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                                    r.modalidade === 'CAIXA_IMEDIATO' ? 'bg-purple-100 text-purple-700' :
                                        r.modalidade === 'DUPLICATA' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                )}>
                                    {r.modalidade === 'FATURAMENTO_MENSAL' ? 'MENSAL' : r.modalidade?.replace('_', ' ')}
                                </span>
                                <span className="font-black text-gray-800 text-[15px]">
                                    R$ {Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}

                        {/* No modo compacto expandido: Badge da modalidade para complementar */}
                        {isCompactMode && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px]">
                                <span className={cn("px-2 py-0.5 rounded uppercase font-bold text-[10px]",
                                    r.modalidade === 'CAIXA_IMEDIATO' ? 'bg-purple-100 text-purple-700' :
                                        r.modalidade === 'DUPLICATA' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                )}>
                                    {r.modalidade === 'FATURAMENTO_MENSAL' ? 'MENSAL' : r.modalidade?.replace('_', ' ')}
                                </span>
                                <span className="text-gray-400 font-medium">Card expandido</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
