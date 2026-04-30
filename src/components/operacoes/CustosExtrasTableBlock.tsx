import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpZA,
  BadgeDollarSign,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Loader2,
  Pencil,
  Tag,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CustoExtraOperacionalService } from "@/services/base.service";

type CustoExtraItem = {
  id: string;
  data?: string | null;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  empresas?: { nome?: string | null } | null;
  categoria_custo: string;
  descricao: string;
  valor_unitario?: number | null;
  quantidade?: number | null;
  total?: number | null;
  forma_pagamento?: string | null;
  data_vencimento?: string | null;
  status_pagamento?: string | null;
  operacao_id?: string | null;
  tipo_lancamento?: string | null;
  origem_dado?: string | null;
  avaliacao_json?: Record<string, unknown> | null;
};

type CustosExtrasTableBlockProps = {
  data: CustoExtraItem[];
};

type EditableCostForm = {
  data: string;
  empresa_nome: string;
  categoria_custo: string;
  descricao: string;
  valor_unitario: string;
  quantidade: string;
  forma_pagamento: string;
  data_vencimento: string;
  status_pagamento: string;
  operacao_id: string;
};

type BulkEditableField =
  | "categoria_custo"
  | "forma_pagamento"
  | "data_vencimento"
  | "status_pagamento"
  | "empresa_nome";

const STORAGE_KEY = "orbe_visibleCols_custos_extras_v1";
const LOCKED_COLS_STORAGE_KEY = "orbe_lockedCols_custos_extras_v1";

const defaultVisibleCols = {
  data: true,
  empresa: true,
  categoria: true,
  descricao: true,
  valorUnitario: true,
  quantidade: true,
  total: true,
  formaPagamento: true,
  vencimento: true,
  status: true,
  operacaoId: false,
  acoes: true,
};

const BULK_FIELDS: Array<{ value: BulkEditableField; label: string }> = [
  { value: "categoria_custo", label: "Categoria" },
  { value: "empresa_nome", label: "Empresa" },
  { value: "forma_pagamento", label: "Forma de pagamento" },
  { value: "data_vencimento", label: "Data de vencimento" },
  { value: "status_pagamento", label: "Status pgto" },
];

const categoryOptions = ["MERENDA", "ADMINISTRATIVO", "OPERACIONAL", "FORNECEDOR"] as const;
const statusOptions = ["PENDENTE", "ATRASADO", "RECEBIDO"] as const;
const paymentOptions = ["DEPOSITO", "DEPOSITO MENSAL", "PIX", "TRANSFERENCIA", "BOLETO"] as const;

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

const parseLocaleNumber = (value: string) => {
  const normalized = String(value).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInputValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const getStatusBadgeClass = (status?: string | null) => {
  switch (String(status ?? "").toUpperCase()) {
    case "RECEBIDO":
      return "bg-success-soft text-success-strong";
    case "ATRASADO":
      return "bg-warning-soft text-warning-strong";
    case "PENDENTE":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted/60 text-muted-foreground";
  }
};

const buildEditForm = (item: CustoExtraItem): EditableCostForm => ({
  data: toInputValue(item.data),
  empresa_nome: item.empresas?.nome || item.empresa_nome || "",
  categoria_custo: item.categoria_custo || "OPERACIONAL",
  descricao: item.descricao || "",
  valor_unitario: toInputValue(item.valor_unitario ?? 0),
  quantidade: toInputValue(item.quantidade ?? 0),
  forma_pagamento: toInputValue(item.forma_pagamento),
  data_vencimento: toInputValue(item.data_vencimento),
  status_pagamento: toInputValue(item.status_pagamento || "PENDENTE"),
  operacao_id: toInputValue(item.operacao_id),
});

export function CustosExtrasTableBlock({ data }: CustosExtrasTableBlockProps) {
  const queryClient = useQueryClient();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [lockedCols, setLockedCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LOCKED_COLS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      return { data: true, empresa: true, descricao: true };
    }
    return { data: true, empresa: true, descricao: true };
  });
  const [selectedItem, setSelectedItem] = useState<CustoExtraItem | null>(null);
  const [editingItem, setEditingItem] = useState<CustoExtraItem | null>(null);
  const [editForm, setEditForm] = useState<EditableCostForm | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkEditableField>("status_pagamento");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkOnlyEmpty, setBulkOnlyEmpty] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultVisibleCols, ...JSON.parse(saved) };
    } catch {
      return defaultVisibleCols;
    }
    return defaultVisibleCols;
  });

  const toggleLock = (colKey: string) => {
    setLockedCols((prev) => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem(LOCKED_COLS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleCol = (col: keyof typeof visibleCols) => {
    const next = { ...visibleCols, [col]: !visibleCols[col] };
    setVisibleCols(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const allSelected = Object.values(visibleCols).every(Boolean);

  const toggleAll = () => {
    const nextValue = !allSelected;
    const next = Object.fromEntries(
      Object.keys(visibleCols).map((key) => [key, nextValue]),
    ) as typeof visibleCols;
    setVisibleCols(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const scrollBy = useCallback((dir: "left" | "right") => {
    tableScrollRef.current?.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
  }, []);

  const filteredData = useMemo(() => {
    return [...data]
      .filter((item) => {
        const empresa = item.empresas?.nome || item.empresa_nome || "";
        const searchMatch =
          item.descricao.toLowerCase().includes(filterText.toLowerCase()) ||
          empresa.toLowerCase().includes(filterText.toLowerCase()) ||
          item.categoria_custo.toLowerCase().includes(filterText.toLowerCase());

        const categoryMatch = categoryFilter === "all" || item.categoria_custo === categoryFilter;
        const statusMatch = statusFilter === "all" || String(item.status_pagamento ?? "").toUpperCase() === statusFilter;
        return searchMatch && categoryMatch && statusMatch;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const mapValue = (row: CustoExtraItem) => {
          switch (sortConfig.key) {
            case "empresa":
              return row.empresas?.nome || row.empresa_nome || "";
            case "valor_unitario":
              return Number(row.valor_unitario ?? 0);
            case "quantidade":
              return Number(row.quantidade ?? 0);
            case "total":
              return Number(row.total ?? 0);
            default:
              return (row as Record<string, unknown>)[sortConfig.key] ?? "";
          }
        };
        const valA = mapValue(a);
        const valB = mapValue(b);
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
  }, [categoryFilter, data, filterText, sortConfig, statusFilter]);

  const editableFilteredCount = filteredData.length;

  const kpis = useMemo(() => {
    let total = 0;
    let pendente = 0;
    let atrasado = 0;
    let recebido = 0;

    filteredData.forEach((item) => {
      const amount = Number(item.total ?? 0);
      total += amount;

      const status = String(item.status_pagamento ?? "").toUpperCase();
      if (status === "PENDENTE") pendente += amount;
      if (status === "ATRASADO") atrasado += amount;
      if (status === "RECEBIDO") recebido += amount;
    });

    return {
      total,
      pendente,
      atrasado,
      recebido,
      ticketMedio: filteredData.length ? total / filteredData.length : 0,
    };
  }, [filteredData]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      CustoExtraOperacionalService.update(id, payload),
    onSuccess: () => {
      toast.success("Custo extra atualizado.");
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      setEditingItem(null);
      setEditForm(null);
    },
    onError: (error: Error) => {
      toast.error("Falha ao atualizar custo extra.", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CustoExtraOperacionalService.delete(id),
    onSuccess: () => {
      toast.success("Custo extra removido.");
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast.error("Falha ao remover custo extra.", { description: error.message });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const rowsToUpdate = filteredData.filter((item) => {
        if (!bulkOnlyEmpty) return true;
        const currentValue = item[bulkField as keyof CustoExtraItem];
        return currentValue === null || currentValue === undefined || String(currentValue).trim() === "";
      });

      if (rowsToUpdate.length === 0) {
        throw new Error("Nenhuma linha filtrada disponivel para atualizacao em massa.");
      }

      await Promise.all(
        rowsToUpdate.map((item) =>
          CustoExtraOperacionalService.update(item.id, {
            [bulkField]: bulkValue || null,
            origem_dado: item.origem_dado === "importacao" ? "ajuste" : item.origem_dado,
          }),
        ),
      );

      return rowsToUpdate.length;
    },
    onSuccess: (count) => {
      toast.success("Coluna atualizada em massa.", {
        description: `${count} linha(s) atualizada(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      setIsBulkEditOpen(false);
      setBulkValue("");
    },
    onError: (error: Error) => {
      toast.error("Falha ao editar coluna.", { description: error.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ item, status }: { item: CustoExtraItem; status: string }) =>
      CustoExtraOperacionalService.update(item.id, {
        status_pagamento: status,
        origem_dado: item.origem_dado === "importacao" ? "ajuste" : item.origem_dado,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      toast.success("Status de pagamento atualizado.");
    },
    onError: (error: Error) => {
      toast.error("Falha ao atualizar status.", { description: error.message });
    },
  });

  const openEditor = (item: CustoExtraItem) => {
    setEditingItem(item);
    setEditForm(buildEditForm(item));
  };

  const saveEdit = () => {
    if (!editingItem || !editForm) return;
    updateMutation.mutate({
      id: editingItem.id,
      payload: {
        data: editForm.data || null,
        empresa_nome: editForm.empresa_nome || null,
        categoria_custo: editForm.categoria_custo,
        descricao: editForm.descricao || "Sem descricao",
        valor_unitario: parseLocaleNumber(editForm.valor_unitario),
        quantidade: parseLocaleNumber(editForm.quantidade),
        forma_pagamento: editForm.forma_pagamento || null,
        data_vencimento: editForm.data_vencimento || null,
        status_pagamento: editForm.status_pagamento || null,
        operacao_id: editForm.operacao_id || null,
        origem_dado: editingItem.origem_dado === "importacao" ? "ajuste" : editingItem.origem_dado,
      },
    });
  };

  const lockableCols = ["data", "empresa", "descricao"] as const;

  const getStickyProps = (colKey: "data" | "empresa" | "descricao", isHeader = false) => {
    const baseThClass = "px-3 py-2.5 font-semibold bg-muted/95 backdrop-blur-sm";
    const lockedThClass = "px-3 py-2.5 font-semibold bg-zinc-200/95 dark:bg-zinc-800/95 backdrop-blur-sm";
    const baseTdClass = "px-3 py-3 bg-background";

    if (!lockedCols[colKey]) {
      return { className: cn(isHeader ? baseThClass : baseTdClass) };
    }

    const widths = { data: 120, empresa: 220, descricao: 320 };
    let left = 0;

    if (colKey === "empresa" && visibleCols.data && lockedCols.data) {
      left += widths.data;
    }

    if (colKey === "descricao") {
      if (visibleCols.data && lockedCols.data) left += widths.data;
      if (visibleCols.empresa && lockedCols.empresa) left += widths.empresa;
    }

    const activeSticky: Array<"data" | "empresa" | "descricao"> = [];
    if (visibleCols.data && lockedCols.data) activeSticky.push("data");
    if (visibleCols.empresa && lockedCols.empresa) activeSticky.push("empresa");
    if (visibleCols.descricao && lockedCols.descricao) activeSticky.push("descricao");
    const isLast = activeSticky[activeSticky.length - 1] === colKey;

    return {
      style: {
        position: "sticky" as const,
        left: `${left}px`,
        top: isHeader ? 0 : undefined,
        zIndex: isHeader ? 40 : 10,
        minWidth: `${widths[colKey]}px`,
        maxWidth: `${widths[colKey]}px`,
      },
      className: cn(
        isHeader ? lockedThClass : baseTdClass,
        "border-r border-border transition-all",
        isLast && "after:absolute after:top-0 after:bottom-0 after:-right-[10px] after:w-[10px] after:bg-gradient-to-r after:from-black/5 dark:after:from-black/20 after:to-transparent after:pointer-events-none",
      ),
    };
  };

  const renderHeaderMenu = (key: string, label: ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-between gap-1.5 group w-full focus:outline-none">
        <span className="inline-flex items-center gap-1.5 truncate">
          {label}
          {lockableCols.includes(key as (typeof lockableCols)[number]) && lockedCols[key] && (
            <Lock className="h-3 w-3 text-primary" />
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => setSortConfig({ key, direction: "asc" })}>
          <ArrowUpZA className="mr-2 h-4 w-4 text-muted-foreground" />
          Classificar crescente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSortConfig({ key, direction: "desc" })}>
          <ArrowDownAZ className="mr-2 h-4 w-4 text-muted-foreground" />
          Classificar decrescente
        </DropdownMenuItem>
        {sortConfig?.key === key && (
          <DropdownMenuItem onClick={() => setSortConfig(null)}>
            Remover ordenacao
          </DropdownMenuItem>
        )}
        {lockableCols.includes(key as (typeof lockableCols)[number]) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toggleLock(key)}>
              {lockedCols[key] ? (
                <>
                  <Unlock className="mr-2 h-4 w-4 text-muted-foreground" />
                  Destravar coluna
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4 text-primary" />
                  Travar coluna (Fixar)
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4 p-5 pt-2">
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Total", value: kpis.total, color: "text-foreground" },
          { label: "Pendente", value: kpis.pendente, color: "text-amber-600 dark:text-amber-400" },
          { label: "Atrasado", value: kpis.atrasado, color: "text-destructive" },
          { label: "Recebido", value: kpis.recebido, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Ticket Medio", value: kpis.ticketMedio, color: "text-muted-foreground" },
        ].map((kpi) => (
          <div key={kpi.label} className="min-w-[160px] flex-1 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm md:w-[180px] md:flex-none">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{kpi.label}</p>
            <p className={`text-sm font-black font-display mt-0.5 tabular-nums ${kpi.color}`}>
              {currencyFormatter.format(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="w-full overflow-x-auto">
        <div className="flex min-w-max flex-nowrap items-center gap-2">
          <Input
            placeholder="Buscar por descricao, empresa ou categoria..."
            className="h-9 w-[320px] shrink-0"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[220px] shrink-0">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[180px] shrink-0">
              <SelectValue placeholder="Status pgto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="h-9 shrink-0 font-medium"
            onClick={() => setIsBulkEditOpen(true)}
            disabled={editableFilteredCount === 0}
          >
            Editar coluna
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 shrink-0 font-medium">Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 h-[300px] overflow-y-auto">
              <DropdownMenuLabel>Visibilidade de Colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll} className="font-bold mb-1 bg-muted/50">
                {allSelected ? "DESMARCAR TODAS" : "MARCAR TODAS"}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {Object.keys(visibleCols).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleCols[key as keyof typeof visibleCols]}
                  onCheckedChange={() => toggleCol(key as keyof typeof visibleCols)}
                >
                  {key.toUpperCase()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => scrollBy("left")}
          className="absolute left-0 top-1/2 z-20 hidden h-9 w-9 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary/70 shadow-md transition-all hover:scale-110 hover:bg-primary/15 hover:text-primary active:scale-95 xl:flex"
          title="Rolar para esquerda"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollBy("right")}
          className="absolute right-0 top-1/2 z-20 hidden h-9 w-9 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary/70 shadow-md transition-all hover:scale-110 hover:bg-primary/15 hover:text-primary active:scale-95 xl:flex"
          title="Rolar para direita"
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div ref={tableScrollRef} className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-background pb-[1px]">
        <table className="w-full text-sm min-w-max">
          <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-20">
            <tr className="text-left font-display text-muted-foreground uppercase text-xs tracking-wide">
              {visibleCols.data && <th style={getStickyProps("data", true).style} className={cn(getStickyProps("data", true).className, "text-center")}>{renderHeaderMenu("data", <span className="inline-flex items-center justify-center gap-1.5 w-full"><CalendarDays className="h-3.5 w-3.5" />DATA</span>)}</th>}
              {visibleCols.empresa && <th style={getStickyProps("empresa", true).style} className={cn(getStickyProps("empresa", true).className, "text-center")}>{renderHeaderMenu("empresa", "EMPRESA")}</th>}
              {visibleCols.categoria && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("categoria_custo", <span className="inline-flex items-center justify-center gap-1.5 w-full"><Tag className="h-3.5 w-3.5" />CATEGORIA</span>)}</th>}
              {visibleCols.descricao && <th style={getStickyProps("descricao", true).style} className={cn(getStickyProps("descricao", true).className, "text-center")}>{renderHeaderMenu("descricao", <span className="inline-flex items-center justify-center gap-1.5 w-full"><FileText className="h-3.5 w-3.5" />DESCRICAO</span>)}</th>}
              {visibleCols.valorUnitario && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("valor_unitario", "VAL. UNIT.")}</th>}
              {visibleCols.quantidade && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("quantidade", "QTD")}</th>}
              {visibleCols.total && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("total", <span className="inline-flex items-center justify-center gap-1.5 w-full"><BadgeDollarSign className="h-3.5 w-3.5" />TOTAL</span>)}</th>}
              {visibleCols.formaPagamento && <th className="px-3 py-2.5 font-semibold text-center">FORMA PAGAMENTO</th>}
              {visibleCols.vencimento && <th className="px-3 py-2.5 font-semibold text-center">VENCIMENTO</th>}
              {visibleCols.status && <th className="px-3 py-2.5 font-semibold text-center">STATUS PGTO</th>}
              {visibleCols.operacaoId && <th className="px-3 py-2.5 font-semibold text-center">OPERACAO ID</th>}
              {visibleCols.acoes && <th className="px-5 py-2.5 font-semibold text-center">ACOES</th>}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr
                key={item.id}
                className="esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50"
                onClick={() => setSelectedItem(item)}
              >
                {visibleCols.data && <td style={getStickyProps("data", false).style} className={cn(getStickyProps("data", false).className, "text-center text-muted-foreground whitespace-nowrap")}>{formatDate(item.data)}</td>}
                {visibleCols.empresa && <td style={getStickyProps("empresa", false).style} className={cn(getStickyProps("empresa", false).className, "text-center text-muted-foreground whitespace-nowrap")}>{item.empresas?.nome || item.empresa_nome || "—"}</td>}
                {visibleCols.categoria && <td className="px-3 py-3 text-center"><Badge variant="outline">{item.categoria_custo}</Badge></td>}
                {visibleCols.descricao && <td style={getStickyProps("descricao", false).style} className={cn(getStickyProps("descricao", false).className, "text-left text-foreground whitespace-nowrap")}>{item.descricao}</td>}
                {visibleCols.valorUnitario && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{currencyFormatter.format(Number(item.valor_unitario ?? 0))}</td>}
                {visibleCols.quantidade && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">{Number(item.quantidade ?? 0).toLocaleString("pt-BR")}</td>}
                {visibleCols.total && <td className="px-3 py-3 text-center text-foreground whitespace-nowrap font-display font-semibold">{currencyFormatter.format(Number(item.total ?? 0))}</td>}
                {visibleCols.formaPagamento && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.forma_pagamento || "—"}</td>}
                {visibleCols.vencimento && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{formatDate(item.data_vencimento)}</td>}
                {visibleCols.status && (
                  <td className="px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={updateStatusMutation.isPending}>
                        <button type="button" className="inline-flex">
                          <Badge className={cn("border-0 font-medium", getStatusBadgeClass(item.status_pagamento))}>
                            {item.status_pagamento || "—"}
                          </Badge>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuLabel>Status pgto</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.map((status) => (
                          <DropdownMenuItem key={status} onClick={() => updateStatusMutation.mutate({ item, status })}>
                            {status}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
                {visibleCols.operacaoId && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.operacao_id || "—"}</td>}
                {visibleCols.acoes && (
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => openEditor(item)}
                        title="Editar custo extra"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                        title="Excluir custo extra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={12} className="p-12 text-center text-muted-foreground italic">
                  Nenhum custo extra atende aos filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Sheet open={!!selectedItem} onOpenChange={(value) => !value && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do custo extra</SheetTitle>
            <SheetDescription>Informacoes completas do lancamento de despesa.</SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">{formatDate(selectedItem.data)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="font-medium">{selectedItem.empresas?.nome || selectedItem.empresa_nome || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-medium">{selectedItem.categoria_custo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedItem.status_pagamento || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor unitario</p>
                  <p className="font-medium">{currencyFormatter.format(Number(selectedItem.valor_unitario ?? 0))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantidade</p>
                  <p className="font-medium">{Number(selectedItem.quantidade ?? 0).toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{currencyFormatter.format(Number(selectedItem.total ?? 0))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{formatDate(selectedItem.data_vencimento)}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm">Descricao</p>
                <p className="font-medium text-sm">{selectedItem.descricao}</p>
              </div>

              <div>
                <p className="text-muted-foreground text-sm">Forma de pagamento</p>
                <p className="font-medium text-sm">{selectedItem.forma_pagamento || "—"}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!editingItem} onOpenChange={(value) => !value && setEditingItem(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar custo extra</SheetTitle>
            <SheetDescription>Ajuste os campos do lancamento diretamente na tela operacional.</SheetDescription>
          </SheetHeader>

          {editForm && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="ce-data">Data</Label>
                <Input id="ce-data" type="date" value={editForm.data} onChange={(e) => setEditForm((prev) => prev ? { ...prev, data: e.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-empresa">Empresa</Label>
                <Input id="ce-empresa" value={editForm.empresa_nome} onChange={(e) => setEditForm((prev) => prev ? { ...prev, empresa_nome: e.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editForm.categoria_custo} onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, categoria_custo: value } : prev)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status pgto</Label>
                <Select value={editForm.status_pagamento} onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, status_pagamento: value } : prev)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ce-descricao">Descricao</Label>
                <Textarea id="ce-descricao" className="min-h-[96px]" value={editForm.descricao} onChange={(e) => setEditForm((prev) => prev ? { ...prev, descricao: e.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-unitario">Valor unitario</Label>
                <Input id="ce-unitario" value={editForm.valor_unitario} onChange={(e) => setEditForm((prev) => prev ? { ...prev, valor_unitario: e.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-quantidade">Quantidade</Label>
                <Input id="ce-quantidade" value={editForm.quantidade} onChange={(e) => setEditForm((prev) => prev ? { ...prev, quantidade: e.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={editForm.forma_pagamento} onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, forma_pagamento: value } : prev)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-vencimento">Data de vencimento</Label>
                <Input id="ce-vencimento" type="date" value={editForm.data_vencimento} onChange={(e) => setEditForm((prev) => prev ? { ...prev, data_vencimento: e.target.value } : prev)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ce-opid">Operacao ID</Label>
                <Input id="ce-opid" value={editForm.operacao_id} onChange={(e) => setEditForm((prev) => prev ? { ...prev, operacao_id: e.target.value } : prev)} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)} disabled={updateMutation.isPending}>Cancelar</Button>
                <Button onClick={saveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar alteracoes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isBulkEditOpen} onOpenChange={(value) => !bulkUpdateMutation.isPending && setIsBulkEditOpen(value)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar coluna em massa</SheetTitle>
            <SheetDescription>
              Aplique o mesmo valor para todas as linhas filtradas da planilha de custos extras.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            <p className="text-sm text-muted-foreground">
              {editableFilteredCount} linha(s) filtrada(s) podem receber edicao em massa.
            </p>

            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={bulkField} onValueChange={(value) => setBulkField(value as BulkEditableField)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BULK_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor</Label>
              {bulkField === "categoria_custo" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : bulkField === "status_pagamento" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : bulkField === "forma_pagamento" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : bulkField === "data_vencimento" ? (
                <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
              ) : (
                <Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
              )}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                id="bulk-only-empty-costs"
                checked={bulkOnlyEmpty}
                onCheckedChange={(checked) => setBulkOnlyEmpty(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="bulk-only-empty-costs" className="cursor-pointer">Preencher so linhas vazias</Label>
                <p className="text-xs text-muted-foreground">
                  Mantem os valores existentes e completa apenas onde a coluna ainda nao possui dado.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsBulkEditOpen(false)} disabled={bulkUpdateMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => bulkUpdateMutation.mutate()} disabled={bulkUpdateMutation.isPending || editableFilteredCount === 0}>
                {bulkUpdateMutation.isPending ? "Aplicando..." : "Aplicar na coluna"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
