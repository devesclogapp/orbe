import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PlayCircle,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  Calendar as CalendarIcon,
  CircleDollarSign,
  ExternalLink,
  FileBadge2,
  FileUp,
  HandCoins,
  Loader2,
  LucideIcon,
  Package2,
  Receipt,
  Scale,
  Settings2,
  ShoppingCart,
  TrendingUp,
  Upload,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { CustosExtrasTableBlock } from "@/components/operacoes/CustosExtrasTableBlock";
import { OperacoesTableBlock } from "@/components/operacoes/OperacoesTableBlock";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AIService,
  CustoExtraOperacionalService,
  EmpresaService,
  FornecedorService,
  LogSincronizacaoService,
  OperacaoProducaoService,
  OperacaoService,
  TipoServicoOperacionalService,
  TransportadoraClienteService,
} from "@/services/base.service";
import { processarOperacao } from "@/utils/financeiro";

type EmpresaOption = {
  id: string;
  nome: string;
};

type ProcessDayResponse = {
  resultado?: Array<{
    valor_total_calculado?: number | null;
  }> | null;
};

type RowValue = string | number | boolean | null | undefined;
type SpreadsheetRow = Record<string, RowValue>;
const SHEET_ORIGIN_FIELD = "origem_aba";

type NamedEntity = {
  id: string;
  nome: string;
};

type CreatableNamedService = {
  create: (payload: Record<string, unknown>) => Promise<NamedEntity>;
};

type ImportedOperationPayload = {
  data_operacao: string;
  empresa_id: string;
  tipo_servico_id: string | null;
  fornecedor_id: string | null;
  transportadora_id: string | null;
  entrada_ponto: string | null;
  saida_ponto: string | null;
  tipo_calculo_snapshot: "volume";
  valor_unitario_snapshot: number;
  quantidade: number;
  quantidade_colaboradores: number;
  valor_total: number;
  placa: RowValue;
  nf_numero: RowValue;
  ctrc: RowValue;
  percentual_iss: number;
  valor_descarga: number;
  custo_com_iss: number;
  valor_unitario_filme: number;
  quantidade_filme: number;
  valor_total_filme: number;
  valor_faturamento_nf: number;
  avaliacao_json: Record<string, unknown>;
  status: "pendente";
  origem_dado: "importacao";
};

type CategoriaCustoExtra =
  | "MERENDA"
  | "ADMINISTRATIVO"
  | "OPERACIONAL"
  | "FORNECEDOR";

type ImportedExtraCostPayload = {
  data: string | null;
  empresa_nome: string | null;
  categoria_custo: CategoriaCustoExtra;
  descricao: string;
  valor_unitario: number;
  quantidade: number;
  total: number;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  status_pagamento: "PENDENTE" | "ATRASADO" | "RECEBIDO" | null;
  operacao_id: string | null;
  tipo_lancamento: "DESPESA";
  avaliacao_json: Record<string, unknown>;
  origem_dado: "importacao";
};

const normalizeSpreadsheetRow = (row: SpreadsheetRow) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? format(value, "yyyy-MM-dd HH:mm:ss") : value,
    ]),
  );

const parseExcelTime = (val: RowValue): string | null => {
  if (!val) return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return format(val, "HH:mm:ss");
  }

  if (typeof val === "number") {
    const totalSeconds = Math.round((val % 1) * 24 * 60 * 60);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const str = String(val).trim();
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
  return null;
};

const parseExcelDate = (val: RowValue): string | null => {
  if (!val) return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return format(val, "yyyy-MM-dd");
  }

  if (typeof val === "number") {
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + val * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return null;
    }
  }

  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  const dmyDateTimeMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)$/);
  if (dmyDateTimeMatch) return `${dmyDateTimeMatch[3]}-${dmyDateTimeMatch[2]}-${dmyDateTimeMatch[1]}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const isoDateTimeMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}(?::\d{2})?)$/);
  if (isoDateTimeMatch) return isoDateTimeMatch[1];

  return null;
};

const parseNumericCell = (val: RowValue): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  const normalized = String(val)
    .replace(/[R$\sA-Za-z]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isTimeRangeValid = (start: string | null, end: string | null) => {
  if (!start || !end) return true;
  return end >= start;
};

const normalizeLookupText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(":", "")
    .trim();

const getImportErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.code ? `codigo ${candidate.code}` : null,
    ]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");

    try {
      return JSON.stringify(candidate);
    } catch {
      return "Falha ao processar a planilha.";
    }
  }

  return "Falha ao processar a planilha.";
};

const detectOperationalHeader = (rows: SpreadsheetRow[]) => {
  let headerRowIndex = -1;
  const headerMap: Record<string, string> = {};

  if (rows.length > 0) {
    const keys = Object.keys(rows[0])
      .filter((key) => key !== SHEET_ORIGIN_FIELD)
      .map((key) => key.toUpperCase());

    if (
      keys.some((key) =>
        key.includes("OPERA") ||
        key.includes("SERVIC") ||
        key.includes("DESCRI") ||
        key.includes("TIPO") ||
        key.includes("VISTORIA") ||
        key.includes("DESCARGA"),
      )
    ) {
      return { headerRowIndex: -2, headerMap };
    }
  }

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i];
    const values = Object.entries(row)
      .filter(([key]) => key !== SHEET_ORIGIN_FIELD)
      .map(([, value]) => String(value).toUpperCase().trim());

    if (values.some((value) => value.includes("OPERA") || value.includes("SERVIC") || value.includes("DESCRI"))) {
      headerRowIndex = i;
      for (const key of Object.keys(row)) {
        if (key === SHEET_ORIGIN_FIELD) continue;
        if (row[key]) headerMap[key] = String(row[key]).toUpperCase().replace(":", "").trim();
      }
      break;
    }
  }

  return { headerRowIndex, headerMap };
};

const normalizeImportedSheetRows = (rows: SpreadsheetRow[]) => {
  const { headerRowIndex, headerMap } = detectOperationalHeader(rows);

  if (headerRowIndex < 0) {
    return headerRowIndex === -2 ? rows : rows;
  }

  const normalizedRows: SpreadsheetRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const currentRow = rows[i];
    const nextRow: SpreadsheetRow = {};

    for (const key of Object.keys(currentRow)) {
      if (key === SHEET_ORIGIN_FIELD) {
        nextRow[key] = currentRow[key];
        continue;
      }

      const mappedKey = headerMap[key] || key;
      nextRow[mappedKey] = currentRow[key];
    }

    normalizedRows.push(nextRow);
  }

  return normalizedRows;
};

const EXTRA_COST_BLOCK_CATEGORY_MAP: Record<string, CategoriaCustoExtra> = {
  "CUSTOS COM MERENDA": "MERENDA",
  "CUSTOS ADMINISTRATIVO": "ADMINISTRATIVO",
  "CUSTOS COM OPERACIONAL": "OPERACIONAL",
  "CUSTOS COM FORNECEDOR": "FORNECEDOR",
};

const normalizeCategoryBlockTitle = (value: unknown) =>
  normalizeLookupText(value).replace(/:$/g, "");

const normalizePaymentStatus = (value: RowValue): ImportedExtraCostPayload["status_pagamento"] => {
  const normalized = normalizeLookupText(value);
  if (normalized.includes("RECEB")) return "RECEBIDO";
  if (normalized.includes("ATRAS")) return "ATRASADO";
  if (normalized.includes("PEND")) return "PENDENTE";
  return null;
};

const getRowNumericKeys = (row: SpreadsheetRow) =>
  Object.keys(row)
    .filter((key) => key !== SHEET_ORIGIN_FIELD && /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));

const rowToCellArray = (row: SpreadsheetRow) =>
  getRowNumericKeys(row).map((key) => row[key]);

const parseCustosExtrasImport = (rows: SpreadsheetRow[]) => {
  const sheetRows = rows.filter((row) => normalizeLookupText(row[SHEET_ORIGIN_FIELD]).includes("CUSTOS EXTRAS"));
  if (sheetRows.length === 0) return [];

  const matrix = sheetRows.map(rowToCellArray);
  const titleRow = matrix[0] ?? [];
  const headerRow = matrix[1] ?? [];

  const blockStarts = titleRow
    .map((cell, index) => {
      const normalized = normalizeCategoryBlockTitle(cell);
      const categoria = EXTRA_COST_BLOCK_CATEGORY_MAP[normalized];
      return categoria ? { start: index, categoria } : null;
    })
    .filter((item): item is { start: number; categoria: CategoriaCustoExtra } => Boolean(item))
    .sort((a, b) => a.start - b.start);

  if (blockStarts.length === 0) return [];

  return blockStarts.flatMap((block, blockIndex) => {
    const end = (blockStarts[blockIndex + 1]?.start ?? headerRow.length) - 1;
    const headerEntries = headerRow
      .slice(block.start, end + 1)
      .map((cell, offset) => ({
        absoluteIndex: block.start + offset,
        normalized: normalizeLookupText(cell),
      }));

    const findHeaderIndex = (...aliases: string[]) =>
      headerEntries.find((entry) =>
        aliases.some((alias) => entry.normalized.includes(normalizeLookupText(alias))),
      )?.absoluteIndex;

    const idIndex = findHeaderIndex("ID");
    const dataIndex = findHeaderIndex("DATA");
    const empresaIndex = findHeaderIndex("EMPRESA");
    const descricaoIndex = findHeaderIndex("DESCRICAO");
    const unitarioIndex = findHeaderIndex("VALOR UNITARIO", "UNITARIO");
    const quantidadeIndex = findHeaderIndex("QUANTIDADE", "QTD");
    const totalIndex = findHeaderIndex("TOTAL");
    const formaPagamentoIndex = findHeaderIndex("FORMA DE PAGAMENTO", "FORMA PGTO", "PAGAMENTO");
    const vencimentoIndex = findHeaderIndex("VENCIMENTO", "DATA VENCIMENTO");
    const statusIndex = findHeaderIndex("STATUS PGTO", "STATUS PAGTO", "STATUS");

    return matrix.slice(2).flatMap((row, rowOffset) => {
      const cells = row.slice(block.start, end + 1);
      const hasMeaningfulData = cells.some((cell) => cell !== null && cell !== "" && cell !== 0);
      if (!hasMeaningfulData) return [];

      const descricaoRaw = descricaoIndex !== undefined ? row[descricaoIndex] : null;
      const totalLabel = normalizeLookupText(descricaoRaw);
      if (totalLabel === "TOTAL") return [];

      const valorUnitario = unitarioIndex !== undefined ? parseNumericCell(row[unitarioIndex]) : 0;
      const quantidade = quantidadeIndex !== undefined ? parseNumericCell(row[quantidadeIndex]) : 0;
      const totalBruto = totalIndex !== undefined ? parseNumericCell(row[totalIndex]) : 0;
      const total = totalBruto || valorUnitario * quantidade;
      const descricao = String(descricaoRaw ?? "").trim();

      if (!descricao && total === 0 && valorUnitario === 0 && quantidade === 0) return [];

      return [{
        data: dataIndex !== undefined ? parseExcelDate(row[dataIndex]) : null,
        empresa_nome: empresaIndex !== undefined ? String(row[empresaIndex] ?? "").trim() || null : null,
        categoria_custo: block.categoria,
        descricao: descricao || `${block.categoria} sem descricao`,
        valor_unitario: valorUnitario,
        quantidade,
        total,
        forma_pagamento: formaPagamentoIndex !== undefined ? String(row[formaPagamentoIndex] ?? "").trim() || null : null,
        data_vencimento: vencimentoIndex !== undefined ? parseExcelDate(row[vencimentoIndex]) : null,
        status_pagamento: statusIndex !== undefined ? normalizePaymentStatus(row[statusIndex]) : null,
        operacao_id: null,
        tipo_lancamento: "DESPESA" as const,
        avaliacao_json: {
          origem_importacao: "planilha",
          contexto_importacao: {
            origem_aba: row[SHEET_ORIGIN_FIELD] ?? "CUSTOS EXTRAS",
            bloco_categoria: block.categoria,
            linha_planilha: rowOffset + 3,
          },
          linha_original: normalizeSpreadsheetRow(sheetRows[rowOffset + 2] ?? {}),
          referencia_original: {
            id: idIndex !== undefined ? row[idIndex] : null,
          },
        },
        origem_dado: "importacao" as const,
      }];
    });
  });
};

type TopKpiCardProps = {
  label: string;
  value: string;
  helper?: string;
  size?: "large" | "small" | "xs";
  variant?: "default" | "primary" | "warning" | "success" | "muted" | "info";
  icon?: LucideIcon;
  iconColor?: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);
const formatInteger = (value: number) => integerFormatter.format(Number.isFinite(value) ? value : 0);
const formatDecimal = (value: number) => decimalFormatter.format(Number.isFinite(value) ? value : 0);
const formatPercent = (value: number) => `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;

const MONTH_NAME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2026, index, 1);
  const labelBase = format(date, "MMMM", { locale: ptBR });
  return {
    value: String(index + 1).padStart(2, "0"),
    label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1),
  };
});

const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  ...MONTH_NAME_OPTIONS,
];

const YEAR_OPTIONS = Array.from(
  new Set(
    Array.from({ length: 24 }, (_, index) =>
      String(startOfMonth(addMonths(new Date(), -index)).getFullYear()),
    ),
  ),
).sort((a, b) => Number(b) - Number(a));

const topKpiCardClasses: Record<NonNullable<TopKpiCardProps["size"]>, string> = {
  large: "p-5 min-h-[148px]",
  small: "p-4 min-h-[108px]",
  xs: "p-3 min-h-[80px]",
};

const TopKpiCard = ({
  label,
  value,
  helper,
  size = "large",
  variant = "default",
  icon: Icon,
  iconColor = "bg-primary-soft text-primary",
}: TopKpiCardProps) => (
  <div
    className={cn(
      "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
      variant === "primary" ? "esc-card bg-primary text-primary-foreground border-primary shadow-lg" :
        variant === "muted" ? "bg-muted/30 border border-border rounded-xl" :
          "esc-card shadow-sm hover:shadow-md",
      topKpiCardClasses[size],
    )}
  >
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("space-y-1.5", size === "xs" && "space-y-0.5")}>
          <div className={cn(
            "font-display font-medium",
            size === "xs" ? "text-xs" : "text-sm",
            variant === "primary" ? "text-primary-foreground/90" : "text-muted-foreground"
          )}>
            {label}
          </div>
          <div className={cn(
            "font-display font-bold leading-none",
            size === "large" ? "text-[28px]" : size === "small" ? "text-2xl" : "text-xl",
            variant === "primary" ? "text-primary-foreground" : "text-foreground"
          )}>
            {value}
          </div>
        </div>
{Icon && (
          <div
            className={cn(
              "shrink-0 rounded-md flex items-center justify-center",
              iconColor,
              size === "xs" ? "h-8 w-8" : "h-10 w-10"
            )}
          >
            <Icon className={size === "xs" ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        )}
      </div>
      {size !== "xs" && helper && (
        <div className={cn(
          "truncate text-[13px] leading-snug",
          variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground"
        )}>
          {helper}
        </div>
      )}
    </div>
  </div>
);

const Operacoes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState<string>(
    "all",
  );
  const [sheetYear, setSheetYear] = useState<string>(String(new Date().getFullYear()));
  const [sheetMonthNumber, setSheetMonthNumber] = useState<string>("all");
  const [custosYear, setCustosYear] = useState<string>(String(new Date().getFullYear()));
  const [custosMonthNumber, setCustosMonthNumber] = useState<string>("all");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [activeArea, setActiveArea] = useState<"operacoes" | "custos-extras">("operacoes");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;
  const isAllMonthsSelected = selectedMonthNumber === "all";
  const selectedDate = useMemo(
    () => new Date(`${selectedYear}-${isAllMonthsSelected ? "01" : selectedMonthNumber}-01T12:00:00`),
    [isAllMonthsSelected, selectedMonthNumber, selectedYear],
  );
  const dateValue = format(selectedDate, "yyyy-MM-dd");
  const monthValue = selectedMonth;
  const matchesSelectedPeriod = (value: unknown) => {
    const referencia = String(value ?? "");
    if (!referencia.startsWith(selectedYear)) return false;
    if (isAllMonthsSelected) return true;
    return referencia.startsWith(monthValue);
  };
  const monthLabelCapitalized = isAllMonthsSelected
    ? `Todos os meses de ${selectedYear}`
    : format(selectedDate, "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, (char) => char.toUpperCase());

  const sheetMonth = `${sheetYear}-${sheetMonthNumber}`;
  const isAllSheetMonthsSelected = sheetMonthNumber === "all";
  const sheetDateValue = useMemo(
    () => new Date(`${sheetYear}-${isAllSheetMonthsSelected ? "01" : sheetMonthNumber}-01T12:00:00`),
    [isAllSheetMonthsSelected, sheetMonthNumber, sheetYear],
  );
  const sheetMonthMatches = (value: unknown) => {
    const referencia = String(value ?? "");
    if (!referencia.startsWith(sheetYear)) return false;
    if (isAllSheetMonthsSelected) return true;
    return referencia.startsWith(sheetMonth);
  };

  const custosMonth = `${custosYear}-${custosMonthNumber}`;
  const isAllCustosMonthsSelected = custosMonthNumber === "all";
  const custosMonthMatches = (value: unknown) => {
    const referencia = String(value ?? "");
    if (!referencia.startsWith(custosYear)) return false;
    if (isAllCustosMonthsSelected) return true;
    return referencia.startsWith(custosMonth);
  };

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<EmpresaOption[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  useEffect(() => {
    setConfirmClear(false);
  }, [selectedEmpresaId, selectedMonth]);

  const { data: operacoesBase = [], isLoading: isLoadingOperacoesBase } = useQuery<any[]>({
    queryKey: ["operacoes-base", selectedEmpresaId],
    queryFn: () => OperacaoService.getAllPainel(selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: custosExtras = [], isLoading: isLoadingCustosExtras } = useQuery<any[]>({
    queryKey: ["custos-extras", selectedEmpresaId],
    queryFn: () => CustoExtraOperacionalService.getAll(selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: logsImportacao = [], isLoading: isLoadingLogs } = useQuery<any[]>({
    queryKey: ["importacoes"],
    queryFn: () => LogSincronizacaoService.getWithEmpresa(),
  });

  const { data: issues = [], isLoading: isLoadingIssues } = useQuery<any[]>({
    queryKey: ["inconsistencias"],
    queryFn: () => OperacaoService.getInconsistencies(),
  });

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const sameDate = matchesSelectedPeriod(issue.data);
        const sameEmpresa = selectedEmpresaId === "all" || issue.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [issues, selectedEmpresaId, selectedMonthNumber, selectedYear]
  );

  const filteredLogs = useMemo(
    () =>
      logsImportacao.filter((log) => {
        const sameDate = matchesSelectedPeriod(log.data);
        const sameEmpresa = selectedEmpresaId === "all" || log.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [logsImportacao, selectedEmpresaId, selectedMonthNumber, selectedYear]
  );

  const operacoesKpiDataset = useMemo(
    () =>
      operacoesBase.filter((item) => {
        const sameDate = matchesSelectedPeriod(item.data_operacao);
        const sameEmpresa = selectedEmpresaId === "all" || item.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [operacoesBase, selectedEmpresaId, selectedMonthNumber, selectedYear]
  );

  const operacoesSheetDataset = useMemo(
    () =>
      operacoesBase.filter((item) => {
        const sameDate = sheetMonthMatches(item.data_operacao);
        const sameEmpresa = selectedEmpresaId === "all" || item.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [operacoesBase, selectedEmpresaId, sheetMonthNumber, sheetYear]
  );

  const operacoesTabela = useMemo(
    () => operacoesSheetDataset.map((item) => processarOperacao(item, empresas as any[])),
    [operacoesSheetDataset, empresas]
  );

  const operacoesTabelaKpis = useMemo(
    () => operacoesKpiDataset.map((item) => processarOperacao(item, empresas as any[])),
    [operacoesKpiDataset, empresas]
  );

  const custosExtrasKpiDataset = useMemo(
    () =>
      custosExtras.filter((item) => {
        if (!item.data) return false;
        return matchesSelectedPeriod(item.data);
      }),
    [custosExtras, selectedMonthNumber, selectedYear]
  );

  const custosExtrasSheetDataset = useMemo(
    () =>
      custosExtras.filter((item) => {
        if (!item.data) return false;
        return custosMonthMatches(item.data);
      }),
    [custosExtras, custosMonthNumber, custosYear]
  );

  const totalCalculado = useMemo(
    () =>
      operacoesTabela.reduce((acc, op) => {
        const totalLinha = Number(op.totalFinalCalculado ?? op.valor_total_label ?? op.valor_total ?? 0);
        return acc + (Number.isFinite(totalLinha) ? totalLinha : 0);
      }, 0),
    [operacoesTabela]
  );

  const totalCustosExtras = useMemo(
    () => custosExtrasKpiDataset.reduce((acc, item) => acc + Number(item.total ?? 0), 0),
    [custosExtrasKpiDataset]
  );

  const operacoesKpis = useMemo(() => {
    let faturamento = 0;
    let caixaReal = 0;
    let exposicao = 0;
    let volumeTotal = 0;
    let colaboradores = 0;
    let nfComRegistro = 0;
    let recebidasCount = 0;

    operacoesTabelaKpis.forEach((item) => {
      const totalLinha = Number(item.totalFinalCalculado ?? item.valor_total_label ?? item.valor_total ?? 0);
      const quantidade = Number(item.quantidade ?? item.quantidade_label ?? 0);
      const quantidadeColaboradores = Number(item.quantidade_colaboradores ?? 1);
      const statusPagamento = String(item.statusPagamento ?? item.status_pagamento ?? "").toUpperCase();
      const nfNumero = String(item.nf_numero ?? "").trim().toUpperCase();

      faturamento += Number.isFinite(totalLinha) ? totalLinha : 0;
      volumeTotal += Number.isFinite(quantidade) ? quantidade : 0;
      colaboradores += Number.isFinite(quantidadeColaboradores) ? quantidadeColaboradores : 0;

      if (statusPagamento === "RECEBIDO") {
        caixaReal += totalLinha;
        recebidasCount += 1;
      }
      if (statusPagamento === "PENDENTE" || statusPagamento === "ATRASADO") exposicao += totalLinha;
      if (nfNumero && nfNumero !== "NAO" && nfNumero !== "NÃO") nfComRegistro += 1;
    });

    const operacoesCount = operacoesTabelaKpis.length;

    return {
      faturamento,
      caixaReal,
      exposicao,
      volumeTotal,
      colaboradores,
      operacoesCount,
      ticketMedio: operacoesCount > 0 ? faturamento / operacoesCount : 0,
      produtividade: colaboradores > 0 ? volumeTotal / colaboradores : 0,
      nfPercentual: operacoesCount > 0 ? (nfComRegistro / operacoesCount) * 100 : 0,
      caixaMedio: recebidasCount > 0 ? caixaReal / recebidasCount : 0,
    };
  }, [operacoesTabelaKpis]);

  const custosExtrasKpis = useMemo(() => {
    let maiorCusto = 0;
    let totalCritico = 0;
    let merenda = 0;
    let administrativo = 0;
    let operacional = 0;
    let fornecedor = 0;
    let recebido = 0;

    custosExtrasKpiDataset.forEach((item) => {
      const total = Number(item.total ?? 0);
      const status = String(item.status_pagamento ?? "").toUpperCase();
      const categoria = String(item.categoria_custo ?? "").toUpperCase();

      maiorCusto = Math.max(maiorCusto, total);
      if (status === "PENDENTE" || status === "ATRASADO") totalCritico += total;
      if (status === "RECEBIDO") recebido += total;

      if (categoria === "MERENDA") merenda += total;
      if (categoria === "ADMINISTRATIVO") administrativo += total;
      if (categoria === "OPERACIONAL") operacional += total;
      if (categoria === "FORNECEDOR") fornecedor += total;
    });

    return {
      total: totalCustosExtras,
      maiorCusto,
      custoCriticoPercentual: totalCustosExtras > 0 ? (totalCritico / totalCustosExtras) * 100 : 0,
      lancamentos: custosExtrasKpiDataset.length,
      recebido,
      merenda,
      administrativo,
      operacional,
      fornecedor,
      custoMedio: custosExtrasKpiDataset.length > 0 ? totalCustosExtras / custosExtrasKpiDataset.length : 0,
    };
  }, [custosExtrasKpiDataset, totalCustosExtras]);

  const isLoading = isLoadingEmpresas || isLoadingOperacoesBase || isLoadingCustosExtras || isLoadingLogs || isLoadingIssues;

  const clearMutation = useMutation({
    mutationFn: () =>
      activeArea === "operacoes"
        ? OperacaoProducaoService.deleteImported(selectedEmpresaId === "all" ? undefined : selectedEmpresaId)
        : CustoExtraOperacionalService.deleteImported(selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    onSuccess: (deletedCount: number) => {
      if (deletedCount === 0) {
        toast.warning("Nenhum registro foi removido.", {
          description:
            activeArea === "operacoes"
              ? "Se havia itens importados visiveis, verifique se a policy de DELETE da tabela operacoes_producao ja foi aplicada no banco."
              : "Nao havia custos extras importados para o recorte atual.",
        });
        setConfirmClear(false);
        return;
      }

      toast.success("Importacoes limpas com sucesso!", {
        description:
          selectedEmpresaId === "all"
            ? `Todos os ${deletedCount} registros importados pendentes foram removidos desta visão.`
            : `Todos os ${deletedCount} registros importados da empresa selecionada foram removidos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      setConfirmClear(false);
    },
    onError: (err: Error) => {
      toast.error("Erro ao limpar importacoes", { description: err.message });
      setConfirmClear(false);
    },
  });

  const processMutation = useMutation({
    mutationFn: (empresaId: string) => AIService.processDay(dateValue, empresaId),
    onSuccess: (res: ProcessDayResponse) => {
      toast.success("Processamento concluido", {
        description: `Resultado consolidado: R$ ${res.resultado?.[0]?.valor_total_calculado?.toLocaleString("pt-BR") || "0,00"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      queryClient.invalidateQueries({ queryKey: ["ponto"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_mensais"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_processamento"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao processar", { description: err.message });
    },
  });

  const handleClearImports = () => {
    if (!selectedEmpresaId) {
      toast.warning("Selecione ao menos uma data para limpar as importacoes.");
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    clearMutation.mutate();
  };

  const handleProcessar = () => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa especifica", {
        description: "O processamento precisa de uma unidade operacional definida.",
      });
      return;
    }
    if (isAllMonthsSelected) {
      toast.warning("Selecione um mes especifico", {
        description: "O processamento diario precisa de um mes fechado para definir a data de referencia.",
      });
      return;
    }
    processMutation.mutate(selectedEmpresaId);
  };

  const handleImportOperacoes = async (data: SpreadsheetRow[]) => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa especifica antes de importar", {
        description: "A importacao deve ser vinculada diretamente a uma unidade operacional.",
      });
      return;
    }

    let ignoredRows = 0;
    let adjustedTimeRows = 0;

    try {
      const groupedBySheet = data.reduce<Record<string, SpreadsheetRow[]>>((acc, row) => {
        const sheetName = String(row[SHEET_ORIGIN_FIELD] ?? "__DEFAULT__");
        if (!acc[sheetName]) acc[sheetName] = [];
        acc[sheetName].push(row);
        return acc;
      }, {});

      const parsedData = Object.values(groupedBySheet).flatMap((sheetRows) => normalizeImportedSheetRows(sheetRows));

      const getVal = (row: SpreadsheetRow, ...aliases: string[]): RowValue => {
        const normRow = Object.keys(row).reduce<Record<string, RowValue>>((acc, key) => {
          acc[normalizeLookupText(key)] = row[key];
          return acc;
        }, {});

        for (const key of aliases) {
          const normalizedKey = normalizeLookupText(key);
          if (normRow[normalizedKey] !== undefined && normRow[normalizedKey] !== null) {
            return normRow[normalizedKey];
          }
        }

        for (const key of aliases) {
          const normalizedKey = normalizeLookupText(key);
          const matchKey = Object.keys(normRow).find((rowKey) => rowKey.includes(normalizedKey));
          if (matchKey && normRow[matchKey] !== undefined && normRow[matchKey] !== null) {
            return normRow[matchKey];
          }
        }

        return null;
      };

      const getSheetOrigin = (row: SpreadsheetRow) => {
        const rawSheetName = row[SHEET_ORIGIN_FIELD];
        if (rawSheetName === null || rawSheetName === undefined) return null;

        const normalizedSheetName = String(rawSheetName).trim();
        return normalizedSheetName || null;
      };

      const tiposServicoAtivos = await TipoServicoOperacionalService.getAllActive();
      const fornecedoresAtivos = await FornecedorService.getByEmpresa(selectedEmpresaId);
      const transportadorasAtivas = await TransportadoraClienteService.getByEmpresa(selectedEmpresaId);
      const importedOperations: ImportedOperationPayload[] = [];

      const ensureRecord = async (
        cache: NamedEntity[],
        name: string,
        serviceRef: CreatableNamedService,
        additionalPayload?: Record<string, unknown>
      ) => {
        if (!name) return null;
        let match = cache.find((item) => item.nome.toUpperCase().trim() === name.toUpperCase().trim());
        if (!match) {
          match = await serviceRef.create({ nome: name, ativo: true, ...additionalPayload });
          cache.push(match);
        }
        return match.id;
      };

      for (const row of parsedData) {
        const operacaoName = String(getVal(row, "DESCRIÇÃO", "DESCRICAO", "OPERAÇÃO", "OPERACA", "SERVIÇO", "SERVIC", "TIPO") || "");
        if (!operacaoName) continue;
        const origemAba = getSheetOrigin(row);

        const fornecedorName = String(getVal(row, "FORNECEDOR", "PRODUTO", "CLIENTE") || "");
        const transportadoraName = String(getVal(row, "TRANSPORTADORA", "VIAÇÃO", "VIACAO") || "");

        const tipoServicoId = await ensureRecord(tiposServicoAtivos, operacaoName, TipoServicoOperacionalService);
        const fornecedorId = await ensureRecord(fornecedoresAtivos, fornecedorName || "NAO ESPECIFICADO", FornecedorService, { empresa_id: selectedEmpresaId });
        const transportadoraId = await ensureRecord(transportadorasAtivas, transportadoraName || "NAO ESPECIFICADA", TransportadoraClienteService, { empresa_id: selectedEmpresaId });

        const dataFinal = parseExcelDate(getVal(row, "DATA", "DT", "DATE", "DT. OPERACAO", "DT OPERACAO"));
        if (!dataFinal) {
          ignoredRows++;
          continue;
        }

        const inicioOperacao = parseExcelTime(getVal(row, "INICIO", "INÍCIO", "ENTRADA"));
        const terminoOperacao = parseExcelTime(getVal(row, "TERMINO", "TÉRMINO", "FIM", "SAIDA", "SAÍDA"));
        const hasInvalidTimeRange = !isTimeRangeValid(inicioOperacao, terminoOperacao);
        const terminoOperacaoFinal = hasInvalidTimeRange ? null : terminoOperacao;
        if (hasInvalidTimeRange) adjustedTimeRows++;
        const qtdColaboradores = parseNumericCell(getVal(row, "COL", "COLABORADORES", "QTD COL", "NUM COL")) || 1;
        const valorUnitarioFilme = parseNumericCell(getVal(row, "UNIT. FILME", "UNIT FILME", "VALOR FILME", "VLR FILME"));
        const quantidadeFilme = parseNumericCell(getVal(row, "QTD. FILME", "QTD FILME", "QUANTIDADE FILME", "QTDE FILME"));
        const valorTotalFilme = valorUnitarioFilme * quantidadeFilme;

        const unitarioParsed = parseNumericCell(getVal(row, "VALOR UNITARIO", "VAL UNIT.", "VALOR UNIT.", "UNITARIO"));
        const quantidadeParsed = Math.max(parseNumericCell(getVal(row, "QUANTITATIVO", "QUANTIATIVO", "QUANTI", "QTD", "QUANTIDADE", "VOLUMES")) || 1, 0);

        let nfRaw = String(getVal(row, "NF", "NOTA FISCAL") || "").toUpperCase().trim();
        if (nfRaw === "S" || nfRaw === "SIM") nfRaw = "SIM";
        if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";

        const issRawValue = parseNumericCell(getVal(row, "LÍQUOTA DE ISS", "LIQUOTA DE ISS", "% ISS", "ISS"));
        const pIssFinal = nfRaw === "SIM" ? 5 : (nfRaw === "NÃO" ? 0 : issRawValue);

        const valorDescargaP = quantidadeParsed * unitarioParsed;
        const custoIssP = valorDescargaP * (pIssFinal / 100);
        const valorTotalP = valorDescargaP + custoIssP;

        importedOperations.push({
          data_operacao: dataFinal,
          empresa_id: selectedEmpresaId,
          tipo_servico_id: tipoServicoId,
          fornecedor_id: fornecedorId,
          transportadora_id: transportadoraId,
          entrada_ponto: inicioOperacao,
          saida_ponto: terminoOperacaoFinal,
          tipo_calculo_snapshot: "volume",
          valor_unitario_snapshot: unitarioParsed,
          quantidade: quantidadeParsed,
          quantidade_colaboradores: qtdColaboradores,
          valor_total: valorTotalP,
          placa: getVal(row, "PLACA"),
          nf_numero: nfRaw || "",
          ctrc: getVal(row, "CTRC"),
          percentual_iss: pIssFinal,
          valor_descarga: valorDescargaP,
          custo_com_iss: custoIssP,
          valor_unitario_filme: valorUnitarioFilme,
          quantidade_filme: quantidadeFilme,
          valor_total_filme: valorTotalFilme,
          valor_faturamento_nf: parseNumericCell(getVal(row, "FATURAMENTO - NF", "FATURAMENTO", "LIQUIDO", "FATURAMENTO NF")),
          avaliacao_json: {
            origem_importacao: "planilha",
            contexto_importacao: {
              id_planilha: getVal(row, "ID"),
              empresa_planilha: getVal(row, "EMPRESA"),
              forma_pagamento: getVal(row, "FORMA DE PAGAMENTO"),
              status_original_planilha: getVal(row, "STATUS"),
              origem_aba: origemAba,
              horario_inconsistente: hasInvalidTimeRange ? true : null,
              observacao: getVal(row, "OBSERVAÇÃO", "OBSERVACAO"),
            },
            linha_original: normalizeSpreadsheetRow(row),
          },
          status: "pendente",
          origem_dado: "importacao",
        });
      }

      const replacedCount = await OperacaoProducaoService.replaceImportedBatch(selectedEmpresaId, importedOperations);
      const datasImportadas = Array.from(new Set(importedOperations.map((item) => item.data_operacao))).sort();

      if (datasImportadas.length > 0) {
        const [importYear] = datasImportadas[0].split("-");
        setSelectedYear(importYear);
        setSelectedMonthNumber("all");
      }

      toast.success(`${replacedCount} registros operacionais importados com sucesso!`, {
        description:
          datasImportadas.length === 1
            ? `${ignoredRows > 0 ? `${ignoredRows} linha(s) sem data valida foram ignoradas. ` : ""}${adjustedTimeRows > 0 ? `${adjustedTimeRows} linha(s) com fim menor que inicio foram ajustadas. ` : ""}Dados atualizados para ${format(new Date(`${datasImportadas[0]}T12:00:00`), "dd/MM/yyyy")}.`
            : `${ignoredRows > 0 ? `${ignoredRows} linha(s) sem data valida foram ignoradas. ` : ""}${adjustedTimeRows > 0 ? `${adjustedTimeRows} linha(s) com fim menor que inicio foram ajustadas. ` : ""}Todas as linhas importadas ja estao disponiveis na base de Operacoes.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      await queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      setImportModalOpen(false);
    } catch (error) {
      console.error("Erro ao processar importacao de planilha:", error);
      const message = getImportErrorMessage(error);
      toast.error("Erro na importacao de planilha.", { description: message });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    }
  };

  const handleImportCustosExtras = async (data: SpreadsheetRow[]) => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa especifica antes de importar", {
        description: "Os custos extras serao vinculados a empresa selecionada.",
      });
      return;
    }

    try {
      const importedCosts = parseCustosExtrasImport(data);

      if (importedCosts.length === 0) {
        toast.warning("Nenhuma linha valida foi encontrada em CUSTOS EXTRAS.", {
          description: "Verifique se a planilha contem a aba CUSTOS EXTRAS e os blocos internos esperados.",
        });
        return;
      }

      const replacedCount = await CustoExtraOperacionalService.replaceImportedBatch(selectedEmpresaId, importedCosts);

      toast.success(`${replacedCount} custo(s) extra(s) importado(s) com sucesso!`, {
        description: "Os blocos da planilha foram convertidos em despesas independentes da base de faturamento.",
      });

      await queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      setImportModalOpen(false);
    } catch (error) {
      console.error("Erro ao processar importacao de custos extras:", error);
      toast.error("Erro na importacao de custos extras.", {
        description: getImportErrorMessage(error),
      });
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
    }
  };

  return (
    <AppShell
      title="Operacoes"
      subtitle={`Analise mensal de operacoes · ${monthLabelCapitalized}`}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="w-full overflow-x-auto">
                <div className="flex min-w-max items-center gap-2">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[120px] h-10 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <SelectValue placeholder="Ano" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
                    <SelectTrigger className="w-[180px] h-10 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <SelectValue placeholder="Mes" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_FILTER_OPTIONS.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                    <SelectTrigger className="w-[280px] h-10 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <SelectValue placeholder="Selecione a empresa" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {empresas.map((empresa) => (
                        <SelectItem key={empresa.id} value={empresa.id}>
                          {empresa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Badge
                className={cn(
                  "h-10 w-fit px-3 rounded-md font-semibold",
                  activeArea === "operacoes" && filteredIssues.length > 0
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong"
                )}
              >
                {activeArea === "operacoes"
                  ? (filteredIssues.length > 0 ? `${filteredIssues.length} inconsistencia(s) em aberto` : "Base operacional consistente")
                  : `${custosExtras.length} despesa(s) extra(s) na empresa`}
              </Badge>
            </div>

            <div className="w-full overflow-x-auto">
              <Tabs value={activeArea} onValueChange={(value) => setActiveArea(value as "operacoes" | "custos-extras")}>
                <div className="flex min-w-max items-center justify-end gap-2">
                  <TabsList className="h-11 rounded-2xl border border-[#E5E7EB] bg-[#F3F4F6] p-1 shadow-sm">
                    <TabsTrigger
                      value="operacoes"
                      className="rounded-xl px-4 font-display font-semibold text-[#6B7280] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      Operacoes
                    </TabsTrigger>
                    <TabsTrigger
                      value="custos-extras"
                      className="rounded-xl px-4 font-display font-semibold text-[#6B7280] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      Custos Extras
                    </TabsTrigger>
                  </TabsList>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate("/operacional/dashboard")}>
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver dashboard</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate("/cadastros/regras-operacionais")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regras operacionais</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive-strong"
                        onClick={handleClearImports}
                        disabled={!selectedEmpresaId || clearMutation.isPending}
                      >
                        {confirmClear ? <RefreshCw className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{confirmClear ? "Confirmar limpeza" : "Limpar importacoes"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setImportModalOpen(true)}>
                        <FileUp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{activeArea === "operacoes" ? "Importar operacoes" : "Importar custos extras"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 shadow-lg shadow-primary/20"
                        onClick={handleProcessar}
                        disabled={processMutation.isPending || isLoading}
                      >
                        {processMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{processMutation.isPending ? "Processando..." : "Processar dia"}</TooltipContent>
                  </Tooltip>
                </div>
              </Tabs>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando a base operacional...
            </p>
          </div>
        ) : activeArea === "operacoes" ? (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-1">
                  <TopKpiCard
                    label="Faturamento"
                    value={formatCurrency(operacoesKpis.faturamento)}
                    helper="Valor bruto consolidado das operacoes"
                    variant="primary"
                    icon={Wallet}
                    iconColor="bg-white/20 text-white"
                  />
                </div>
                <div className="xl:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TopKpiCard
                    label="Caixa Real (Recebido)"
                    value={formatCurrency(operacoesKpis.caixaReal)}
                    helper="Ja convertido"
                    size="small"
                    variant="success"
                    icon={HandCoins}
                    iconColor="bg-success-soft text-success-strong"
                  />
                  <TopKpiCard
                    label="Exposicao (Pen+Atr)"
                    value={formatCurrency(operacoesKpis.exposicao)}
                    helper="Parcela exposta"
                    size="small"
                    variant="warning"
                    icon={Scale}
                    iconColor="bg-warning-soft text-warning-strong"
                  />
                  <TopKpiCard
                    label="Operacoes"
                    value={formatInteger(operacoesKpis.operacoesCount)}
                    helper="Qtd. registrada"
                    size="small"
                    icon={Receipt}
                    iconColor="bg-info-soft text-info-strong"
                  />
                  <TopKpiCard
                    label="Volume Total"
                    value={formatInteger(operacoesKpis.volumeTotal)}
                    helper="Qtd. movimentada"
                    size="small"
                    icon={Package2}
                    iconColor="bg-purple-100 text-purple-700"
                  />
                </div>
              </div>

              <div className="esc-card p-4 space-y-3">
                <h3 className="font-display font-medium text-sm text-muted-foreground">Medias e Desempenho</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <TopKpiCard
                    label="Colaboradores"
                    value={formatInteger(operacoesKpis.colaboradores)}
                    size="xs"
                    variant="muted"
                    icon={Users}
                    iconColor="bg-muted text-muted-foreground"
                  />
                  <TopKpiCard
                    label="Ticket medio"
                    value={formatCurrency(operacoesKpis.ticketMedio)}
                    size="xs"
                    variant="muted"
                    icon={Calculator}
                    iconColor="bg-blue-100 text-blue-700"
                  />
                  <TopKpiCard
                    label="Produtividade"
                    value={formatDecimal(operacoesKpis.produtividade)}
                    size="xs"
                    variant="muted"
                    icon={TrendingUp}
                    iconColor="bg-green-100 text-green-700"
                  />
                  <TopKpiCard
                    label="NF (%)"
                    value={formatPercent(operacoesKpis.nfPercentual)}
                    size="xs"
                    variant="muted"
                    icon={FileBadge2}
                    iconColor="bg-orange-100 text-orange-700"
                  />
                  <TopKpiCard
                    label="Caixa medio"
                    value={formatCurrency(operacoesKpis.caixaMedio)}
                    size="xs"
                    variant="muted"
                    icon={CircleDollarSign}
                    iconColor="bg-teal-100 text-teal-700"
                  />
                </div>
              </div>
            </div>

            <Tabs defaultValue="base" className="space-y-4">
              <TabsContent value="base" className="space-y-5">
                <section className="esc-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display font-semibold text-foreground">Base diaria de operacoes</h2>
                          <p className="text-sm text-muted-foreground">
                            Planilha operacional que alimenta os demonstrativos e indicadores do dashboard.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={sheetYear} onValueChange={setSheetYear}>
                            <SelectTrigger className="w-[100px] h-8 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium text-xs">
                              <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent>
                              {YEAR_OPTIONS.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={sheetMonthNumber} onValueChange={setSheetMonthNumber}>
                            <SelectTrigger className="w-[140px] h-8 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium text-xs">
                              <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTH_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-info-soft text-info-strong">
                      Fluxo operacional ativo nesta tela
                    </Badge>
                  </div>
                  <OperacoesTableBlock
                    date={dateValue}
                    empresaId={selectedEmpresaId}
                    rowsData={operacoesSheetDataset}
                  />
                </section>
              </TabsContent>

              <TabsContent value="importacoes" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Importacoes e sincronizacoes</h2>
                      <p className="text-sm text-muted-foreground">
                        Visao de acompanhamento do que entrou na base operacional.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
                      <FileUp className="h-4 w-4 mr-2" />
                      Importar planilha
                    </Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Data / hora</th>
                        <th className="px-3 h-11 font-medium">Origem</th>
                        <th className="px-3 h-11 font-medium">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Registros</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((item) => (
                        <tr key={item.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[52px] text-muted-foreground">{new Date(item.data).toLocaleString("pt-BR")}</td>
                          <td className="px-3 text-foreground">{item.origem}</td>
                          <td className="px-3 text-muted-foreground">{item.empresas?.nome || "—"}</td>
                          <td className="px-3 text-center font-display font-medium">{item.contagem_registros}</td>
                          <td className="px-5 text-center">
                            <Badge variant="outline">{item.status || "—"}</Badge>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma importacao registrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="inconsistencias" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Inconsistencias operacionais</h2>
                      <p className="text-sm text-muted-foreground">
                        Pendencias da base de operacoes que exigem validacao ou correcao.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/inconsistencias")}>
                      Abrir visao completa
                    </Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Tipo</th>
                        <th className="px-3 h-11 font-medium">Colaborador</th>
                        <th className="px-3 h-11 font-medium">Descricao</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((issue, index) => (
                        <tr key={issue.id || index} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[60px]">
                            <div className="font-medium text-foreground">{issue.tipo_servico || "Inconsistencia"}</div>
                          </td>
                          <td className="px-3 text-foreground">{issue.colaboradores?.nome || "—"}</td>
                          <td className="px-3 text-muted-foreground">{issue.quantidade || "—"} item(ns) em analise</td>
                          <td className="px-5 text-center">
                            <Badge variant="outline">{issue.status || "—"}</Badge>
                          </td>
                        </tr>
                      ))}
                      {filteredIssues.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma inconsistência encontrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-1">
                  <TopKpiCard
                    label="Total de Custos"
                    value={formatCurrency(custosExtrasKpis.total)}
                    helper="Soma financeira do recorte"
                    variant="primary"
                    icon={Wallet}
                    iconColor="bg-white/20 text-white"
                  />
                </div>
                <div className="xl:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <TopKpiCard
                    label="Maior Custo"
                    value={formatCurrency(custosExtrasKpis.maiorCusto)}
                    helper="Lancamento maximo"
                    size="small"
                    icon={BarChart3}
                    iconColor="bg-purple-100 text-purple-700"
                  />
                  <TopKpiCard
                    label="Custo Critico (%)"
                    value={formatPercent(custosExtrasKpis.custoCriticoPercentual)}
                    helper="Valores pendentes"
                    size="small"
                    variant="warning"
                    iconColor="bg-warning-soft text-warning-strong"
                  />
                  <TopKpiCard
                    label="Recebido"
                    value={formatCurrency(custosExtrasKpis.recebido)}
                    helper="Custos pagos"
                    size="small"
                    variant="success"
                    icon={HandCoins}
                    iconColor="bg-success-soft text-success-strong"
                  />
                  <TopKpiCard
                    label="Lancamentos"
                    value={formatInteger(custosExtrasKpis.lancamentos)}
                    helper="Qtd. registrada"
                    size="small"
                    icon={Receipt}
                    iconColor="bg-blue-100 text-blue-700"
                  />
                </div>
              </div>

              <div className="esc-card p-4 space-y-3">
                <h3 className="font-display font-medium text-sm text-muted-foreground">Rateio por Categorias</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <TopKpiCard
                    label="Merenda"
                    value={formatCurrency(custosExtrasKpis.merenda)}
                    size="xs"
                    variant="muted"
                    icon={UtensilsCrossed}
                  />
                  <TopKpiCard
                    label="Administrativo"
                    value={formatCurrency(custosExtrasKpis.administrativo)}
                    size="xs"
                    variant="muted"
                    icon={FileBadge2}
                  />
                  <TopKpiCard
                    label="Operacional"
                    value={formatCurrency(custosExtrasKpis.operacional)}
                    size="xs"
                    variant="muted"
                    icon={Settings2}
                  />
                  <TopKpiCard
                    label="Fornecedor"
                    value={formatCurrency(custosExtrasKpis.fornecedor)}
                    size="xs"
                    variant="muted"
                    icon={ShoppingCart}
                  />
                  <TopKpiCard
                    label="Custo medio"
                    value={formatCurrency(custosExtrasKpis.custoMedio)}
                    size="xs"
                    variant="muted"
                    icon={Calculator}
                  />
                </div>
              </div>
            </div>

            <section className="esc-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Custos Extras</h2>
                      <p className="text-sm text-muted-foreground">
                        Tabela de despesas separada da base de faturamento, com importacao baseada nos blocos internos da planilha.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={custosYear} onValueChange={setCustosYear}>
                        <SelectTrigger className="w-[100px] h-8 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium text-xs">
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_OPTIONS.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={custosMonthNumber} onValueChange={setCustosMonthNumber}>
                        <SelectTrigger className="w-[140px] h-8 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium text-xs">
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Badge className="bg-info-soft text-info-strong">
                  Tipo de lancamento: DESPESA
                </Badge>
              </div>
              <CustosExtrasTableBlock data={custosExtrasSheetDataset} />
            </section>
          </>
        )}
      </div>

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title={activeArea === "operacoes" ? "Importar Operacoes via Planilha" : "Importar Custos Extras via Planilha"}
        description={
          activeArea === "operacoes"
            ? "O sistema lera a coluna DATA de cada linha automaticamente. Cada linha sera importada na sua propria data. Linhas sem DATA valida serao ignoradas. A coluna COL sera gravada como quantidade de colaboradores."
            : "A importacao procurara a aba CUSTOS EXTRAS e os blocos CUSTOS COM MERENDA, CUSTOS ADMINISTRATIVO, CUSTOS COM OPERACIONAL e CUSTOS COM FORNECEDOR. Cada linha herdara a categoria do bloco."
        }
        onUpload={activeArea === "operacoes" ? handleImportOperacoes : handleImportCustosExtras}
      />
    </AppShell>
  );
};

export default Operacoes;
