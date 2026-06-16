import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IntermitenteItem = {
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

type IntermitentesTableBlockProps = {
    data: IntermitenteItem[];
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

export function IntermitentesTableBlock({ data }: IntermitentesTableBlockProps) {
    return (
        <div className="space-y-4 p-5 pt-2 min-w-0 overflow-hidden">
            <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
                <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-background pb-[1px]">
                    <table className="w-full text-sm min-w-max">
                        <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-20">
                            <tr className="text-center font-display text-muted-foreground uppercase text-xs tracking-wide">
                                <th className="px-3 py-2.5 font-semibold text-center">DATA</th>
                                <th className="px-3 py-2.5 font-semibold text-center">EMPRESA / DEP.</th>
                                <th className="px-3 py-2.5 font-semibold text-center text-left">COLABORADOR</th>
                                <th className="px-3 py-2.5 font-semibold text-center">CARGO</th>
                                <th className="px-3 py-2.5 font-semibold text-center">CONVOCAÇÃO</th>
                                <th className="px-3 py-2.5 font-semibold text-center">H. TRABALHADAS</th>
                                <th className="px-3 py-2.5 font-semibold text-center">H. NORMAIS</th>
                                <th className="px-3 py-2.5 font-semibold text-center">HE 50%</th>
                                <th className="px-3 py-2.5 font-semibold text-center">HE 100%</th>
                                <th className="px-3 py-2.5 font-semibold text-center">H. NOTURNA</th>
                                <th className="px-3 py-2.5 font-semibold text-center">TOTAL</th>
                                <th className="px-3 py-2.5 font-semibold text-center">STATUS RH</th>
                                <th className="px-3 py-2.5 font-semibold text-center">ORIGEM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item) => (
                                <tr
                                    key={item.id}
                                    className="esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50"
                                >
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">
                                        {formatDate(item.data_referencia)}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">
                                        {item.empresas?.nome || item.departamento || "—"}
                                    </td>
                                    <td className="px-3 py-3 text-left font-medium whitespace-nowrap">
                                        {item.colaboradores?.nome || item.nome_colaborador || "—"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">
                                        {item.cargo || "—"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                                        {item.convocacao || "—"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">
                                        {item.horas_trabalhadas || "0"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">
                                        {item.horas_normais || "0"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">
                                        {item.he_50 || "0"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">
                                        {item.he_100 || "0"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">
                                        {item.hora_noturna || "0"}
                                    </td>
                                    <td className="px-3 py-3 text-center text-foreground whitespace-nowrap font-display font-semibold">
                                        {item.total !== null && item.total !== undefined
                                            ? currencyFormatter.format(Number(item.total))
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-3 text-center whitespace-nowrap">
                                        <Badge variant="outline" className={cn(
                                            item.status_pipeline === 'APROVADO_RH' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                                item.status_pipeline === 'DEVOLVIDO' ? "bg-rose-50 text-rose-600 border-rose-200" :
                                                    "bg-amber-50 text-amber-600 border-amber-200"
                                        )}>
                                            {item.status_pipeline?.toUpperCase().replace(/_/g, ' ') || 'RECEBIDO'}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-3 text-center whitespace-nowrap">
                                        <Badge variant="secondary" className="text-xs uppercase">
                                            {item.origem || "—"}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">
                                        Nenhum registro de intermitentes encontrado para o período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
