import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Power,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Column<T> {
    header: string;
    accessorKey: keyof T;
    cell?: (item: T) => React.ReactNode;
}

interface ConfigTableProps<T> {
    data: T[];
    columns: Column<T>[];
    title: string;
    onAdd?: () => void;
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    onToggleStatus?: (item: T) => void;
    searchPlaceholder?: string;
}

export function ConfigTable<T extends { id: string | number; status?: string }>({
    data,
    columns,
    title,
    onAdd,
    onEdit,
    onDelete,
    onToggleStatus,
    searchPlaceholder = "Buscar...",
}: ConfigTableProps<T>) {
    const [search, setSearch] = React.useState("");

    const filteredData = React.useMemo(() => {
        if (!search) return data;
        return data.filter((item) =>
            Object.values(item).some(
                (val) =>
                    val &&
                    val.toString().toLowerCase().includes(search.toLowerCase())
            )
        );
    }, [data, search]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={searchPlaceholder}
                        className="pl-9 h-10 border-border bg-card focus-visible:ring-primary"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {onAdd && (
                    <Button onClick={onAdd} className="font-bold shadow-sm shadow-primary/20">
                        <Plus className="h-4 w-4 mr-2" /> Novo Registro
                    </Button>
                )}
            </div>

            <div className="esc-card overflow-hidden">
                <div className="max-h-[60vh] overflow-y-scroll overflow-x-auto pr-1">
                    <Table>
                        <TableHeader className="esc-table-header">
                            <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                                {columns.map((col, idx) => (
                                    <TableHead key={idx} className="h-11 px-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                        {col.header}
                                    </TableHead>
                                ))}
                                {(onEdit || onDelete || onToggleStatus) && (
                                    <TableHead className="h-11 px-4 text-right font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                                        Ações
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length > 0 ? (
                                filteredData.map((item) => (
                                    <TableRow key={item.id} className="group hover:bg-muted/30 border-b border-border transition-colors">
                                        {columns.map((col, idx) => (
                                            <TableCell key={idx} className="px-4 py-3 text-sm">
                                                {col.cell ? (
                                                    col.cell(item)
                                                ) : (
                                                    <span className="text-foreground font-medium">
                                                        {String(item[col.accessorKey])}
                                                    </span>
                                                )}
                                            </TableCell>
                                        ))}
                                        {(onEdit || onDelete || onToggleStatus) && (
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {onToggleStatus && (
                                                        <button
                                                            onClick={() => onToggleStatus(item)}
                                                            title={item.status === "ativo" ? "Desativar" : "Ativar"}
                                                            className={cn(
                                                                "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                                                                item.status === "ativo"
                                                                    ? "text-success hover:bg-success-soft"
                                                                    : "text-muted-foreground hover:bg-muted"
                                                            )}
                                                        >
                                                            <Power className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(item)}
                                                            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => onDelete(item)}
                                                            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive-soft transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length + 1}
                                        className="h-32 text-center text-muted-foreground italic"
                                    >
                                        Nenhum registro encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
