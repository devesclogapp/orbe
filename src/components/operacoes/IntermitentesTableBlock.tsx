import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { cn, decimalParaHora } from "@/lib/utils";

export type IntermitenteItem = {
    id: string;
    data_referencia?: string | null;
    empresa_id?: string | null;
    empresas?: { nome?: string | null } | null;
    nome_colaborador?: string | null;
    colaborador_id?: string | null;
    colaboradores?: { nome?: string | null } | null;
    cargo?: string | null;
    departamento?: string | null;
    convocacao?: string | null;
    horas_trabalhadas?: number | null;
    horas_normais?: number | null;
    he_50?: number | null;
    he_100?: number | null;
    hora_noturna?: number | null;
    total?: number | null;
    status_pipeline?: string | null;
    origem?: string | null;
};

export type IntermitentesTableBlockProps = {
    data: IntermitenteItem[];
    onEdit?: (item: IntermitenteItem) => void;
    pageSizeDefault?: number;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR");
};

const getStatusBadgeVariant = (status?: string | null) => {
    const st = (status || "").toUpperCase();
    if (st === "APROVADO_RH" || st === "VALIDADO_RH" || st === "APROVADO") {
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    }
    if (st === "DEVOLVIDO" || st === "REJEITADO") {
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
    }
    if (st === "EM_LOTE" || st === "AGUARDANDO_VALIDACAO_RH" || st === "FECHADO") {
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    }
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
};

export function IntermitentesTableBlock({ data, onEdit, pageSizeDefault = 25 }: IntermitentesTableBlockProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeDefault);

    // Reseta para a primeira página caso os filtros ou a pesquisa alterem a quantidade de registros
    useEffect(() => {
        setCurrentPage(1);
    }, [data.length]);

    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const validCurrentPage = Math.min(currentPage, totalPages);

    const paginatedData = useMemo(() => {
        const start = (validCurrentPage - 1) * pageSize;
        return data.slice(start, start + pageSize);
    }, [data, validCurrentPage, pageSize]);

    return (
        <TooltipProvider>
            <div className="space-y-3 p-4 pt-1 min-w-0 overflow-hidden">
                <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
                    <div className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-card">
                        <table className="w-full text-[11px] min-w-max border-collapse">
                            <thead className="bg-muted/90 backdrop-blur-sm sticky top-0 z-20 border-b border-border shadow-xs">
                                <tr className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                                    <th className="px-3 py-2.5 text-center w-[85px]">DATA</th>
                                    <th className="px-3 py-2.5 text-left min-w-[130px] max-w-[160px]">EMPRESA / DEP.</th>
                                    <th className="px-3 py-2.5 text-left min-w-[160px] max-w-[200px]">COLABORADOR</th>
                                    <th className="px-3 py-2.5 text-left min-w-[110px] max-w-[140px]">CARGO</th>
                                    <th className="px-3 py-2.5 text-left min-w-[120px] max-w-[150px]">CONVOCAÇÃO</th>
                                    <th className="px-2.5 py-2.5 text-center border-l border-border/40 w-[75px]">H. TRAB.</th>
                                    <th className="px-2.5 py-2.5 text-center w-[70px]">NORMAIS</th>
                                    <th className="px-2.5 py-2.5 text-center w-[70px]">HE 50%</th>
                                    <th className="px-2.5 py-2.5 text-center w-[70px]">HE 100%</th>
                                    <th className="px-2.5 py-2.5 text-center border-r border-border/40 w-[75px]">NOTURNA</th>
                                    <th className="px-3 py-2.5 text-right w-[95px]">TOTAL</th>
                                    <th className="px-3 py-2.5 text-center w-[125px]">STATUS RH</th>
                                    <th className="px-2.5 py-2.5 text-center w-[80px]">ORIGEM</th>
                                    {onEdit && <th className="px-2 py-2.5 text-center w-[60px]">AÇÕES</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {paginatedData.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="transition-colors hover:bg-muted/40 cursor-default"
                                    >
                                        <td className="px-3 py-2 text-center text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                                            {formatDate(item.data_referencia)}
                                        </td>
                                        <td className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={item.empresas?.nome || item.departamento || ""}>
                                            <span className="font-medium text-foreground">
                                                {item.empresas?.nome || item.departamento || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-left font-medium whitespace-nowrap max-w-[200px] truncate" title={item.colaboradores?.nome || item.nome_colaborador || ""}>
                                            <span className="text-foreground">
                                                {item.colaboradores?.nome || item.nome_colaborador || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap max-w-[140px]">
                                            {item.cargo ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="block truncate cursor-default">
                                                            {item.cargo}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs">
                                                        {item.cargo}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap max-w-[150px] truncate" title={item.convocacao || ""}>
                                            {item.convocacao || "—"}
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-foreground whitespace-nowrap font-mono font-medium border-l border-border/40 bg-muted/10">
                                            {decimalParaHora(item.horas_trabalhadas)}
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground whitespace-nowrap font-mono">
                                            {decimalParaHora(item.horas_normais)}
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground whitespace-nowrap font-mono">
                                            {decimalParaHora(item.he_50)}
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground whitespace-nowrap font-mono">
                                            {decimalParaHora(item.he_100)}
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground whitespace-nowrap font-mono border-r border-border/40">
                                            {decimalParaHora(item.hora_noturna)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-foreground whitespace-nowrap font-mono font-semibold">
                                            {item.total !== null && item.total !== undefined
                                                ? currencyFormatter.format(Number(item.total))
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                                                    getStatusBadgeVariant(item.status_pipeline)
                                                )}
                                            >
                                                {item.status_pipeline?.toUpperCase().replace(/_/g, ' ') || 'RECEBIDO'}
                                            </Badge>
                                        </td>
                                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                                {item.origem || "TIO DIGITAL"}
                                            </span>
                                        </td>
                                        {onEdit && (
                                            <td className="px-2 py-2 text-center whitespace-nowrap">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                            aria-label="Corrigir horas ou atribuir empresa a este colaborador"
                                                            title="Corrigir horas ou atribuir empresa a este colaborador"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEdit(item);
                                                            }}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="text-xs">
                                                        Corrigir horas ou atribuir empresa a este colaborador
                                                    </TooltipContent>
                                                </Tooltip>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={onEdit ? 14 : 13} className="px-4 py-16 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                                <FileSpreadsheet className="h-5 w-5" />
                                            </div>
                                            <p className="text-sm font-medium text-foreground">Nenhum registro de intermitente encontrado</p>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                Não há apontamentos capturados para os filtros aplicados neste período.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Paginação Compacta */}
            {data.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span>
                            Mostrando <strong className="font-medium text-foreground">{Math.min((validCurrentPage - 1) * pageSize + 1, data.length)}</strong> a{" "}
                            <strong className="font-medium text-foreground">{Math.min(validCurrentPage * pageSize, data.length)}</strong> de{" "}
                            <strong className="font-medium text-foreground">{data.length}</strong> registros
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-2">
                            <span>Exibir:</span>
                            <select
                                className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={validCurrentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-2 font-mono text-[11px]">
                                {validCurrentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={validCurrentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </TooltipProvider>
    );
}
