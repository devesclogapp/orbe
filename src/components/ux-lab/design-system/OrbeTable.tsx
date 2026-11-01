import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OrbeButton } from "./OrbeButton";

export interface OrbeTableColumn<T> {
  id: string;
  header: string | React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export interface OrbeTableProps<T> {
  columns: OrbeTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  selectedId?: string | number | null;
  onRowClick?: (row: T) => void;
  emptyMessage?: string | React.ReactNode;
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}

/**
 * OrbeTable
 * 
 * Componente unificado de Tabela Densa de Alta Performance do ORBE ERP.
 * Inclui cabeçalho fixo, suporte a alinhamentos técnicos, estado de seleção e paginação.
 */
export function OrbeTable<T>({
  columns,
  data,
  keyExtractor,
  selectedId,
  onRowClick,
  emptyMessage = "Nenhum registro encontrado.",
  loading = false,
  pagination,
  className,
}: OrbeTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div
      className={cn(
        "bg-card dark:bg-[#15191F] rounded-xl border border-border/80 dark:border-white/[0.06] overflow-hidden flex flex-col shadow-xs",
        className
      )}
    >
      <div className="overflow-x-auto min-h-0 flex-1">
        <table className="w-full text-xs text-foreground border-collapse">
          <thead>
            <tr className="bg-muted/50 dark:bg-[#111419] border-b border-border/80 dark:border-white/[0.06] text-muted-foreground font-semibold uppercase text-[11px] tracking-wider select-none">
              {columns.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.width }}
                  className={cn(
                    "py-2.5 px-3 whitespace-nowrap",
                    alignClasses[col.align || "left"],
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 dark:divide-white/[0.04]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Carregando dados...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = keyExtractor(row, idx);
                const isSelected = selectedId !== undefined && selectedId === key;

                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-muted/30 dark:hover:bg-[#1A1F27]",
                      isSelected && "bg-blue-50/40 dark:bg-blue-950/30 border-l-2 border-l-blue-600 dark:border-l-blue-500"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "py-2.5 px-3 whitespace-nowrap",
                          alignClasses[col.align || "left"],
                          col.className
                        )}
                      >
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 border-t border-border/80 dark:border-white/[0.06] bg-muted/20 dark:bg-[#111419] text-xs text-muted-foreground select-none">
          <div>
            Total: <span className="font-semibold text-foreground">{pagination.totalItems}</span> registros
          </div>
          <div className="flex items-center gap-2">
            <span>
              Página <span className="font-semibold text-foreground">{pagination.page}</span> de{" "}
              <span className="font-semibold text-foreground">{pagination.totalPages || 1}</span>
            </span>
            <div className="flex items-center gap-1">
              <OrbeButton
                variant="secondary"
                size="icon-sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                title="Página Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </OrbeButton>
              <OrbeButton
                variant="secondary"
                size="icon-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                title="Próxima Página"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </OrbeButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
