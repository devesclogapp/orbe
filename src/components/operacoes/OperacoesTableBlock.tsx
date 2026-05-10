import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpZA,
  ChevronDown,
  Lock,
  Unlock,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Hash,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  Package,
  Pencil,
  Settings2,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { useSelection } from "@/contexts/SelectionContext";
import { cn } from "@/lib/utils";
import { OperacaoProducaoService, OperacaoService, RegraOperacionalService, EmpresaService, RegrasFinanceirasService } from "@/services/base.service";
import { classificarFinanceiroSync, processarOperacao, calcularValoresOperacao, getModalidadeLabel, ModalidadeFinanceira, StatusPagamento } from "@/utils/financeiro";

type OperacoesTableBlockProps = {
  date: string;
  empresaId: string;
  filterByDate?: boolean;
  respectCompanyFilter?: boolean;
  rowsData?: any[];
};

type EditableOperationForm = {
  quantidade: string;
  quantidade_colaboradores: string;
  entrada_ponto: string;
  saida_ponto: string;
  placa: string;
  nf_numero: string;
  ctrc: string;
  percentual_iss: string;
  valor_descarga: string;
  custo_com_iss: string;
  valor_unitario_filme: string;
  quantidade_filme: string;
  valor_total_filme: string;
  valor_faturamento_nf: string;
  forma_pagamento: string;
  observacao: string;
  modalidade_financeira: string;
  data_vencimento: string;
  status_pagamento: string;
  valor_unitario?: string;
};

type BulkEditableField =
  | "forma_pagamento"
  | "observacao"
  | "nf_numero"
  | "ctrc"
  | "placa"
  | "entrada_ponto"
  | "saida_ponto"
  | "quantidade"
  | "quantidade_colaboradores"
  | "valor_unitario_filme"
  | "quantidade_filme"
  | "valor_faturamento_nf"
  | "modalidade_financeira"
  | "data_vencimento"
  | "status_pagamento";

type InlineEditableField = BulkEditableField;

type RuleApplicableColumn = "percentualIss" | "valUnit" | "qtd" | "qtdCol" | "valorUnitarioFilme" | "quantidadeFilme" | "valorFaturamentoNf" | "valorDescarga" | "custoIss" | "inicio" | "fim" | "nf" | "ctrc" | "placa" | "observacao" | "formaPagamento" | "valorTotalFilme";

const BULK_EDITABLE_FIELDS: Array<{ value: BulkEditableField; label: string }> = [
  { value: "forma_pagamento", label: "Forma de pagamento" },
  { value: "observacao", label: "Observação" },
  { value: "nf_numero", label: "NF (SIM/NÃO ou número)" },
  { value: "ctrc", label: "CTRC" },
  { value: "placa", label: "Placa" },
  { value: "entrada_ponto", label: "Início" },
  { value: "saida_ponto", label: "Fim" },
  { value: "quantidade", label: "Quantidade" },
  { value: "quantidade_colaboradores", label: "Qtd. colaboradores" },
  { value: "valor_unitario_filme", label: "Valor unitário filme" },
  { value: "quantidade_filme", label: "Qtd. filme" },
  { value: "valor_faturamento_nf", label: "Faturamento NF" },
];

const BULK_FIELD_BY_COLUMN: Partial<Record<string, BulkEditableField>> = {
  formaPagamento: "forma_pagamento",
  nf: "nf_numero",
  ctrc: "ctrc",
  observacao: "observacao",
  qtd: "quantidade",
  inicio: "entrada_ponto",
  fim: "saida_ponto",
  valorUnitarioFilme: "valor_unitario_filme",
  quantidadeFilme: "quantidade_filme",
  valorFaturamentoNf: "valor_faturamento_nf",
  placa: "placa",
  qtdCol: "quantidade_colaboradores",
};

const MASS_EDITABLE_FIELDS: Array<{ value: BulkEditableField; label: string }> = [
  { value: "forma_pagamento", label: "Forma de pagamento" },
  { value: "observacao", label: "Observacao" },
  { value: "nf_numero", label: "NF (SIM/NAO ou numero)" },
  { value: "ctrc", label: "CTRC" },
  { value: "placa", label: "Placa" },
  { value: "entrada_ponto", label: "Inicio" },
  { value: "saida_ponto", label: "Fim" },
  { value: "quantidade", label: "Quantidade" },
  { value: "quantidade_colaboradores", label: "Qtd. colaboradores" },
  { value: "valor_unitario_filme", label: "Valor unitario filme" },
  { value: "quantidade_filme", label: "Qtd. filme" },
  { value: "modalidade_financeira", label: "Modalidade financeira" },
  { value: "data_vencimento", label: "Data de vencimento" },
  { value: "status_pagamento", label: "Status pgto" },
];

const MASS_FIELD_BY_COLUMN: Partial<Record<string, BulkEditableField>> = {
  formaPagamento: "forma_pagamento",
  nf: "nf_numero",
  ctrc: "ctrc",
  observacao: "observacao",
  qtd: "quantidade",
  inicio: "entrada_ponto",
  fim: "saida_ponto",
  valorUnitarioFilme: "valor_unitario_filme",
  quantidadeFilme: "quantidade_filme",
  placa: "placa",
  qtdCol: "quantidade_colaboradores",
  modalidadeFinanceira: "modalidade_financeira",
  dataVencimento: "data_vencimento",
  statusPagamento: "status_pagamento",
};

const RULE_COLUMN_CONFIG: Record<
  RuleApplicableColumn,
  {
    field: keyof EditableOperationForm;
    label: string;
    matches: string[];
  }
> = {
  percentualIss: { field: "percentual_iss", label: "% ISS", matches: ["% ISS", "ISS", "LÍQUOTA DE ISS"] },
  valUnit: { field: "valor_unitario" as any, label: "VAL. UNIT.", matches: ["VAL. UNIT.", "UNITARIO", "VALOR UNITARIO", "UNIT.", "VALOR"] },
  qtd: { field: "quantidade", label: "QTD", matches: ["QTD", "QUANTIDADE", "VOLUME"] },
  qtdCol: { field: "quantidade_colaboradores", label: "QTD. COL.", matches: ["QTD COL", "COLABORADORES", "AJUDANTES"] },
  valorUnitarioFilme: { field: "valor_unitario_filme", label: "UNIT. FILME", matches: ["UNIT. FILME", "VALOR FILME"] },
  quantidadeFilme: { field: "quantidade_filme", label: "QTD. FILME", matches: ["QTD. FILME", "QTD FILME"] },
  valorFaturamentoNf: { field: "valor_faturamento_nf", label: "FATURAMENTO NF", matches: ["FATURAMENTO NF", "VALOR NF", "FATURAMENTO"] },
  valorDescarga: { field: "valor_descarga", label: "VALOR DESCARGA", matches: ["VALOR DESCARGA", "DESCARGA"] },
  custoIss: { field: "custo_com_iss", label: "CUSTO ISS", matches: ["CUSTO ISS", "CUSTO"] },
  inicio: { field: "entrada_ponto", label: "INICIO", matches: ["INICIO", "ENTRADA"] },
  fim: { field: "saida_ponto", label: "FIM", matches: ["FIM", "SAIDA"] },
  nf: { field: "nf_numero", label: "NF", matches: ["NF", "NOTA FISCAL", "NUMERO NF"] },
  ctrc: { field: "ctrc", label: "CTRC", matches: ["CTRC"] },
  placa: { field: "placa", label: "PLACA", matches: ["PLACA"] },
  observacao: { field: "observacao", label: "OBSERVACAO", matches: ["OBS", "OBSERVACAO"] },
  formaPagamento: { field: "forma_pagamento", label: "FORMA PAGAMENTO", matches: ["FORMA PAGAMENTO", "PAGAMENTO"] },
  valorTotalFilme: { field: "valor_total_filme", label: "TOTAL FILME", matches: ["TOTAL FILME"] },
};

const normalizeRuleText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const normalizeEntityMatchText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const formatDiagnosticLabel = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || "vazio";
};

const isIssOperationalRule = (rule: any) => {
  const joined = normalizeRuleText(`${rule?.tipos_regra_operacional?.nome ?? ""} ${rule?.tipos_regra_operacional?.coluna_planilha ?? ""}`);
  return RULE_COLUMN_CONFIG.percentualIss.matches.some((match) => joined.includes(normalizeRuleText(match)));
};

const getStatusConfig = (status: string) => {
  switch (status?.toLowerCase()) {
    case "registered":
    case "registrado":
    case "aberto":
      return { label: "Registrado", className: "bg-muted text-muted-foreground" };
    case "pending":
    case "pendente":
      return { label: "Pendente", className: "bg-muted text-muted-foreground" };
    case "validated":
    case "validado":
    case "ok":
    case "processado":
      return { label: "Validado", className: "bg-success-soft text-success-strong" };
    case "blocked":
    case "bloqueado":
    case "inconsistente":
      return { label: "Bloqueado", className: "bg-destructive-soft text-destructive-strong" };
    case "imported":
    case "importado":
      return { label: "Importado", className: "bg-info-soft text-info-strong" };
    default:
      return { label: status || "Desconhecido", className: "bg-muted text-muted-foreground" };
  }
};

const getLinhaOriginalValue = (item: Record<string, unknown>, ...keys: string[]) => {
  const linhaOriginal = (item.avaliacao_json as { linha_original?: Record<string, unknown> } | undefined)?.linha_original;
  if (!linhaOriginal) return null;

  const normalizedEntries = Object.entries(linhaOriginal).map(([key, value]) => [
    key.toUpperCase().replace(":", "").trim(),
    value,
  ] as const);

  for (const key of keys) {
    const normalizedKey = key.toUpperCase().replace(":", "").trim();
    const exactMatch = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
    if (exactMatch && exactMatch[1] !== null && exactMatch[1] !== undefined && String(exactMatch[1]).trim() !== "") {
      return exactMatch[1];
    }
  }

  for (const key of keys) {
    const normalizedKey = key.toUpperCase().replace(":", "").trim();
    const partialMatch = normalizedEntries.find(([entryKey]) => entryKey.includes(normalizedKey));
    if (partialMatch && partialMatch[1] !== null && partialMatch[1] !== undefined && String(partialMatch[1]).trim() !== "") {
      return partialMatch[1];
    }
  }

  return null;
};

const getContextoImportacaoValue = (item: Record<string, unknown>, key: string) => {
  const contextoImportacao = (item.avaliacao_json as { contexto_importacao?: Record<string, unknown> } | undefined)?.contexto_importacao;
  const value = contextoImportacao?.[key];
  if (value === null || value === undefined) return null;

  const trimmedValue = String(value).trim();
  return trimmedValue ? trimmedValue : null;
};

const getDisplayFormaPagamento = (item: Record<string, unknown>) => {
  const base = (item as { formas_pagamento_operacional?: { nome?: string | null } }).formas_pagamento_operacional?.nome ??
    ((item as { formaPagamento?: string | null }).formaPagamento ?? null) ??
    ((item as { forma_pagamento?: string | null }).forma_pagamento ?? null) ??
    getContextoImportacaoValue(item, "forma_pagamento") ??
    getLinhaOriginalValue(item, "FORMA DE PAGAMENTO");

  if (base && typeof base === "string" && base.trim() !== "") {
    return base;
  }

  const modalidade = (item as any).modalidadeFinanceira || (item as any).modalidade_financeira;
  if (modalidade) {
    return getModalidadeLabel(modalidade);
  }

  return "—";
};

const getDisplayObservacao = (item: Record<string, unknown>) =>
  getContextoImportacaoValue(item, "observacao") ??
  getLinhaOriginalValue(item, "OBSERVACAO", "OBSERVAÇÃO") ??
  "—";

const getDisplayStatusOriginal = (item: Record<string, unknown>) =>
  getContextoImportacaoValue(item, "status_original_planilha") ??
  getLinhaOriginalValue(item, "STATUS") ??
  "—";

const getDisplayEmpresa = (item: Record<string, unknown>, empresas: any[] = []) =>
  (empresas.find((empresaItem: any) => empresaItem.id === (item as { empresa_id?: string | null }).empresa_id)?.nome ?? null) ??
  ((item as { empresas?: { nome?: string | null } }).empresas?.nome ?? null) ??
  getContextoImportacaoValue(item, "empresa") ??
  getLinhaOriginalValue(item, "EMPRESA") ??
  "—";

const toInputValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const parseLocaleNumber = (value: string) => {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalInput = (value: number, fractionDigits = 2) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

const toNumericInputValue = (value: unknown, fractionDigits = 2) => {
  if (value === null || value === undefined || value === "") return "";

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);

  return formatDecimalInput(parsed, fractionDigits);
};

const toIssPercentageInput = (value: unknown) => {
  const numericValue = Number(value ?? 0);
  const normalizedValue = numericValue <= 1 ? numericValue * 100 : numericValue;
  return toInputValue(normalizedValue);
};

const toIssDatabaseValue = (value: string) => {
  const numericValue = parseLocaleNumber(value);
  return numericValue > 1 ? numericValue / 100 : numericValue;
};

const buildEditableForm = (item: any): EditableOperationForm => {
  const valorUnitarioFilme = Number(item.valor_unitario_filme || 0);
  const quantidadeFilme = Number(item.quantidade_filme || 0);

  return {
    quantidade: toInputValue(item.quantidade),
    valor_unitario: toNumericInputValue(item.valor_unitario ?? item.valor_unitario_label ?? item.valor_unitario_snapshot),
    quantidade_colaboradores: toInputValue(item.quantidade_colaboradores ?? 1),
    entrada_ponto: toInputValue(item.entrada_ponto ?? item.horario_inicio_label).slice(0, 5),
    saida_ponto: toInputValue(item.saida_ponto ?? item.horario_fim_label).slice(0, 5),
    placa: toInputValue(item.placa),
    nf_numero: toInputValue(item.nf_numero),
    ctrc: toInputValue(item.ctrc),
    percentual_iss: toIssPercentageInput(item.percentual_iss),
    valor_descarga: toNumericInputValue(item.valor_descarga),
    custo_com_iss: toNumericInputValue(item.custo_com_iss),
    valor_unitario_filme: toNumericInputValue(item.valor_unitario_filme),
    quantidade_filme: toInputValue(item.quantidade_filme),
    valor_total_filme: formatDecimalInput(valorUnitarioFilme * quantidadeFilme),
    valor_faturamento_nf: toNumericInputValue(item.valor_faturamento_nf),
    forma_pagamento: getContextoImportacaoValue(item, "forma_pagamento") ?? "",
    observacao: getContextoImportacaoValue(item, "observacao") ?? "",
    modalidade_financeira: getContextoImportacaoValue(item, "modalidade_financeira_override") ?? "",
    data_vencimento: getContextoImportacaoValue(item, "data_vencimento_override") ?? "",
    status_pagamento: toInputValue(item.status_pagamento ?? item.statusPagamento ?? "PENDENTE"),
  };
};

const applyBusinessRulesToForm = (baseForm: EditableOperationForm, editingItem: any) => {
  const next = { ...baseForm };

  const unitario = next.valor_unitario !== undefined
    ? parseLocaleNumber(next.valor_unitario)
    : Number(editingItem?.valor_unitario_snapshot || editingItem?.valor_unitario_label || 0);

  let nfRaw = String(next.nf_numero).toUpperCase().trim();
  if (nfRaw === "S" || nfRaw === "SIM") nfRaw = "SIM";
  if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";
  next.nf_numero = nfRaw;

  const valoresCalculados = calcularValoresOperacao({
    quantidade: parseLocaleNumber(next.quantidade),
    valorUnitario: unitario,
    percentualIss: parseLocaleNumber(next.percentual_iss),
    quantidadeFilme: parseLocaleNumber(next.quantidade_filme),
    valorUnitarioFilme: parseLocaleNumber(next.valor_unitario_filme),
    nfRaw,
  });

  next.percentual_iss = valoresCalculados.percentualCalculado.toString();
  next.valor_total_filme = valoresCalculados.totalFilmeCalculado ? formatDecimalInput(valoresCalculados.totalFilmeCalculado) : "0,00";
  next.valor_descarga = valoresCalculados.valorDescargaCalculado ? formatDecimalInput(valoresCalculados.valorDescargaCalculado) : "0,00";
  next.custo_com_iss = valoresCalculados.custoIssCalculado ? formatDecimalInput(valoresCalculados.custoIssCalculado) : "0,00";

  return next;
};

const buildOperationUpdatePayload = (editingItem: any, editForm: EditableOperationForm) => {
  const nextAvaliacao = {
    ...(editingItem.avaliacao_json ?? {}),
    contexto_importacao: {
      ...((editingItem.avaliacao_json?.contexto_importacao as Record<string, unknown> | undefined) ?? {}),
      forma_pagamento: editForm.forma_pagamento || null,
      observacao: editForm.observacao || null,
      modalidade_financeira_override: editForm.modalidade_financeira || null,
      data_vencimento_override: editForm.data_vencimento || null,
    },
  };

  const valorUnitarioFilmeCalculado = parseLocaleNumber(editForm.valor_unitario_filme);
  const quantidadeFilmeCalculada = parseLocaleNumber(editForm.quantidade_filme);
  const valorTotalFilmeCalculado = valorUnitarioFilmeCalculado * quantidadeFilmeCalculada;

  return {
    ...(editForm.valor_unitario ? { valor_unitario_snapshot: parseLocaleNumber(editForm.valor_unitario) } : {}),
    quantidade: parseLocaleNumber(editForm.quantidade),
    quantidade_colaboradores: parseLocaleNumber(editForm.quantidade_colaboradores),
    entrada_ponto: editForm.entrada_ponto || null,
    saida_ponto: editForm.saida_ponto || null,
    placa: editForm.placa || null,
    nf_numero: editForm.nf_numero || null,
    ctrc: editForm.ctrc || null,
    percentual_iss: toIssDatabaseValue(editForm.percentual_iss),
    valor_descarga: parseLocaleNumber(editForm.valor_descarga),
    custo_com_iss: parseLocaleNumber(editForm.custo_com_iss),
    valor_unitario_filme: valorUnitarioFilmeCalculado,
    quantidade_filme: quantidadeFilmeCalculada,
    valor_total_filme: valorTotalFilmeCalculado,
    valor_faturamento_nf: parseLocaleNumber(editForm.valor_faturamento_nf),
    status_pagamento: editForm.status_pagamento || null,
    data_pagamento: editForm.status_pagamento === "RECEBIDO"
      ? (editingItem.data_pagamento ?? new Date().toISOString().split("T")[0])
      : null,
    avaliacao_json: nextAvaliacao,
    origem_dado: editingItem.origem_dado === "importacao" ? "ajuste" : editingItem.origem_dado,
  };
};

export const OperacoesTableBlock = ({
  date,
  empresaId,
  filterByDate = true,
  respectCompanyFilter = true,
  rowsData,
}: OperacoesTableBlockProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: selectedId, kind } = useSelection();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalidadeFilter, setModalidadeFilter] = useState("all");
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState("all");
  const [selectedOpDetails, setSelectedOpDetails] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<EditableOperationForm | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkEditableField>("forma_pagamento");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkOnlyEmpty, setBulkOnlyEmpty] = useState(true);
  const [isRuleApplyOpen, setIsRuleApplyOpen] = useState(false);
  const [selectedRuleColumn, setSelectedRuleColumn] = useState<RuleApplicableColumn>("percentualIss");
  const [selectedOperationalRuleId, setSelectedOperationalRuleId] = useState("");
  const [selectedEditOperationalRuleId, setSelectedEditOperationalRuleId] = useState("");
  const [selectedEditIssRuleId, setSelectedEditIssRuleId] = useState("");
  const [activeInlineCell, setActiveInlineCell] = useState<{ rowId: string; field: InlineEditableField } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [lockedCols, setLockedCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("orbe_lockedCols_operacoes_v1");
      if (saved) return JSON.parse(saved);
    } catch { }
    return { data: true, idPlanilha: true, operacao: true };
  });

  const toggleLock = (colKey: string) => {
    setLockedCols((prev) => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem("orbe_lockedCols_operacoes_v1", JSON.stringify(next));
      return next;
    });
  };

  const STORAGE_KEY = "orbe_visibleCols_operacoes_v5";

  const defaultCols = {
    data: true,
    operacao: true, transportadora: true, servico: true, qtd: true,
    inicio: false, fim: false, valUnit: true, valDia: true, acoes: true,
    nf: false, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
    valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
    valorFaturamentoNf: false, placa: false, fornecedor: false, qtdCol: true,
    idPlanilha: false, empresaPlanilha: false, formaPagamento: false, observacao: false,
    modalidadeFinanceira: true, dataVencimento: true, statusPagamento: true,
  };

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultCols, ...JSON.parse(saved) };
    } catch {
      return defaultCols;
    }
    return defaultCols;
  });

  const [activeRuleCols, setActiveRuleCols] = useState<Record<RuleApplicableColumn, boolean>>(() => {
    try {
      const saved = localStorage.getItem("orbe_activeRuleCols_operacoes_v1");
      if (saved) return JSON.parse(saved);
    } catch { }
    return { percentualIss: true, valUnit: true } as Record<RuleApplicableColumn, boolean>;
  });

  const toggleRuleCol = (colKey: RuleApplicableColumn) => {
    setActiveRuleCols((prev) => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem("orbe_activeRuleCols_operacoes_v1", JSON.stringify(next));
      return next;
    });
  };

  const scrollBy = useCallback((dir: "left" | "right") => {
    tableScrollRef.current?.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
  }, []);

  const effectiveEmpresaId = respectCompanyFilter ? empresaId : "all";

  const operationsQueryKey = filterByDate
    ? ["operacoes", date, effectiveEmpresaId]
    : ["operacoes-grid", effectiveEmpresaId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: operationsQueryKey,
    queryFn: () =>
      filterByDate
        ? OperacaoService.getPainelByDate(date, effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId)
        : OperacaoService.getAllPainel(effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId),
    enabled: !rowsData,
  });

  const { data: regrasOperacionais = [], refetch: refetchRegrasOperacionais } = useQuery({
    queryKey: ["regras_operacionais_grid", effectiveEmpresaId],
    queryFn: () => RegraOperacionalService.getAll(effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId),
  });

  const { data: regrasFinanceiras = [] } = useQuery({
    queryKey: ["regras_financeiras_filter"],
    queryFn: () => RegrasFinanceirasService.getAllActive(),
  });

  const { data: formasPagamentoDb = [] } = useQuery({
    queryKey: ["formas_pagamento_operacional_filter"],
    queryFn: () => {
      const { FormaPagamentoOperacionalService } = require("@/services/base.service");
      return FormaPagamentoOperacionalService.getAllActive();
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const processedRows = useMemo(() => {
    const sourceRows = Array.isArray(rowsData) ? rowsData : rows;
    if (!Array.isArray(sourceRows)) return [];
    return sourceRows.map((item: any) => processarOperacao(item, empresas as any[]));
  }, [rows, rowsData, empresas]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem || !editForm) throw new Error("Nenhuma opera??o selecionada para edi??o.");
      return OperacaoProducaoService.update(editingItem.id, buildOperationUpdatePayload(editingItem, editForm));
    },
    onSuccess: (updated) => {
      toast.success("Opera??o atualizada na tela operacional.");
      setEditingItem(null);
      setEditForm(null);
      setSelectedOpDetails(null);
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "N?o foi poss?vel salvar a edi??o.";
      toast.error("Falha ao atualizar opera??o.", { description: message });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const editableRows = filteredData.filter(isEditableOperation);
      const rowsToUpdate = editableRows.filter((item: any) => {
        if (!bulkOnlyEmpty) return true;
        const currentValue = buildEditableForm(item)[bulkField];
        return !String(currentValue ?? "").trim();
      });

      if (!bulkValue.trim() && bulkField !== "observacao" && bulkField !== "forma_pagamento") {
        throw new Error("Informe o valor que deve ser aplicado na coluna.");
      }

      if (rowsToUpdate.length === 0) {
        throw new Error(
          bulkOnlyEmpty
            ? "Nenhuma linha filtrada possui esse campo vazio para preencher."
            : "Nenhuma linha filtrada dispon?vel para atualiza??o em massa.",
        );
      }

      await Promise.all(
        rowsToUpdate.map((item: any) => {
          const nextForm = applyBusinessRulesToForm(
            {
              ...buildEditableForm(item),
              [bulkField]: bulkValue,
            },
            item,
          );

          return OperacaoProducaoService.update(item.id, buildOperationUpdatePayload(item, nextForm));
        }),
      );

      return rowsToUpdate.length;
    },
    onSuccess: (updatedCount) => {
      toast.success("Coluna atualizada em massa.", {
        description: `${updatedCount} linha(s) filtrada(s) foram ajustadas nesta planilha.`,
      });
      setIsBulkEditOpen(false);
      setBulkValue("");
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "N?o foi poss?vel concluir a edi??o em massa.";
      toast.error("Falha ao editar coluna.", { description: message });
    },
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ item, field, value }: { item: any; field: InlineEditableField; value: string }) => {
      const nextForm = applyBusinessRulesToForm(
        {
          ...buildEditableForm(item),
          [field]: value,
        },
        item,
      );

      return OperacaoProducaoService.update(item.id, buildOperationUpdatePayload(item, nextForm));
    },
    onSuccess: () => {
      toast.success("Célula atualizada.");
      setActiveInlineCell(null);
      setInlineValue("");
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a célula.";
      toast.error("Falha ao atualizar célula.", { description: message });
    },
  });

  const applyStatusPagamentoToCache = (currentData: any, itemId: string, statusPagamento: StatusPagamento, dataPagamento: string | null) => {
    if (!Array.isArray(currentData)) return currentData;

    return currentData.map((row: any) =>
      row?.id === itemId
        ? {
          ...row,
          status_pagamento: statusPagamento,
          data_pagamento: dataPagamento,
        }
        : row,
    );
  };

  const updateStatusPagamentoMutation = useMutation({
    mutationFn: async ({ item, statusPagamento }: { item: any; statusPagamento: StatusPagamento }) => {
      if (!isEditableOperation(item)) {
        throw new Error("Somente operacoes editaveis podem ter o status de pagamento alterado.");
      }

      const today = new Date().toISOString().split("T")[0];

      return OperacaoProducaoService.update(item.id, {
        status_pagamento: statusPagamento,
        data_pagamento: statusPagamento === "RECEBIDO" ? today : null,
      });
    },
    onMutate: async ({ item, statusPagamento }) => {
      const dataPagamento = statusPagamento === "RECEBIDO" ? new Date().toISOString().split("T")[0] : null;

      await queryClient.cancelQueries({ queryKey: ["operacoes"] });
      await queryClient.cancelQueries({ queryKey: ["operacoes-grid"] });

      const operacoesSnapshots = queryClient.getQueriesData({ queryKey: ["operacoes"] });
      const operacoesGridSnapshots = queryClient.getQueriesData({ queryKey: ["operacoes-grid"] });

      operacoesSnapshots.forEach(([queryKey, currentData]) => {
        queryClient.setQueryData(queryKey, applyStatusPagamentoToCache(currentData, item.id, statusPagamento, dataPagamento));
      });

      operacoesGridSnapshots.forEach(([queryKey, currentData]) => {
        queryClient.setQueryData(queryKey, applyStatusPagamentoToCache(currentData, item.id, statusPagamento, dataPagamento));
      });

      return { operacoesSnapshots, operacoesGridSnapshots };
    },
    onSuccess: (_data, variables) => {
      const label =
        variables.statusPagamento === "RECEBIDO"
          ? "Recebido"
          : variables.statusPagamento === "ATRASADO"
            ? "Atrasado"
            : "Pendente";
      toast.success(`Status de pagamento atualizado para ${label}.`);
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown, _variables, context) => {
      context?.operacoesSnapshots?.forEach(([queryKey, snapshot]: [readonly unknown[], unknown]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });

      context?.operacoesGridSnapshots?.forEach(([queryKey, snapshot]: [readonly unknown[], unknown]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });

      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o status de pagamento.";
      toast.error("Falha ao atualizar status de pagamento.", { description: message });
    },
  });

  const applyRuleMutation = useMutation({
    mutationFn: async () => {
      const columnConfig = RULE_COLUMN_CONFIG[selectedRuleColumn];
      if (!selectedOperationalRuleId) throw new Error("Selecione qual regra cadastrada deve ser aplicada.");

      const selectedOperationalRule = (regrasOperacionais as any[]).find((rule) => rule.id === selectedOperationalRuleId);
      if (!selectedOperationalRule) throw new Error("A regra operacional escolhida não foi encontrada.");

      if (selectedOperationalRule.ativo !== true) throw new Error("A regra operacional escolhida estÃ¡ inativa.");

      const editableRows = filteredData.filter(isEditableOperation);
      if (editableRows.length === 0) {
        throw new Error("Nenhuma linha filtrada disponível para aplicar regra.");
      }

      let appliedCount = 0;
      let skippedCount = 0;

      for (const item of editableRows) {
        if (!matchesOperationalRuleForItem(item, selectedOperationalRule, selectedRuleColumn)) {
          skippedCount += 1;
          continue;
        }

        const nextForm = applyBusinessRulesToForm(
          {
            ...buildEditableForm(item),
            [columnConfig.field]: String(selectedOperationalRule.valor_unitario ?? ""),
          },
          item,
        );

        await OperacaoProducaoService.update(item.id, buildOperationUpdatePayload(item, nextForm));
        appliedCount += 1;
      }

      if (appliedCount === 0) {
        throw new Error("Nenhuma linha filtrada encontrou regra compatível para essa coluna.");
      }

      return { appliedCount, skippedCount };
    },
    onSuccess: (result: any) => {
      toast.success("Regra aplicada na coluna.", {
        description:
          result?.skippedCount > 0
            ? `${result.appliedCount} linha(s) atualizadas e ${result.skippedCount} sem regra compatível foram ignoradas.`
            : `${result?.appliedCount ?? 0} linha(s) atualizadas com a regra selecionada.`,
      });
      setIsRuleApplyOpen(false);
      setSelectedOperationalRuleId("");
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível aplicar a regra na coluna.";
      toast.error("Falha ao aplicar regra.", { description: message });
    },
  });

  const clearRuleColumnMutation = useMutation({
    mutationFn: async () => {
      const columnConfig = RULE_COLUMN_CONFIG[selectedRuleColumn];
      const editableRows = filteredData.filter(isEditableOperation);

      if (editableRows.length === 0) {
        throw new Error("Nenhuma linha filtrada disponivel para limpar a coluna.");
      }

      await Promise.all(
        editableRows.map((item: any) => {
          const nextForm = applyBusinessRulesToForm(
            {
              ...buildEditableForm(item),
              [columnConfig.field]: "",
            },
            item,
          );

          return OperacaoProducaoService.update(item.id, buildOperationUpdatePayload(item, nextForm));
        }),
      );

      return editableRows.length;
    },
    onSuccess: (updatedCount) => {
      toast.success("Coluna limpa.", {
        description: `${updatedCount} linha(s) filtrada(s) foram limpas nesta coluna.`,
      });
      setIsRuleApplyOpen(false);
      setSelectedOperationalRuleId("");
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Nao foi possivel limpar a coluna.";
      toast.error("Falha ao limpar coluna.", { description: message });
    },
  });

  const filteredData = [...processedRows].filter((item: any) => {
    const fornecedor = item.fornecedores?.nome || item.produto_label || "";
    const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "";
    const servico = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "";

    const searchMatch =
      fornecedor.toLowerCase().includes(filterText.toLowerCase()) ||
      transportadora.toLowerCase().includes(filterText.toLowerCase()) ||
      servico.toLowerCase().includes(filterText.toLowerCase());

    const statusMatch = statusFilter === "all" || item.statusPagamento === statusFilter;
    const modalidadeMatch = modalidadeFilter === "all" || item.modalidadeFinanceira === modalidadeFilter;
    const formaPagamentoMatch = formaPagamentoFilter === "all" ||
      (item.formaPagamento && item.formaPagamento.toLowerCase().includes(formaPagamentoFilter.toLowerCase())) ||
      (item.formas_pagamento_operacional?.nome && item.formas_pagamento_operacional.nome.toLowerCase().includes(formaPagamentoFilter.toLowerCase()));

    return searchMatch && statusMatch && modalidadeMatch && formaPagamentoMatch;
  }).sort((a: any, b: any) => {
    if (sortConfig) {
      let valA = a[sortConfig.key] ?? "";
      let valB = b[sortConfig.key] ?? "";

      if (sortConfig.key === "fornecedor") { valA = a.fornecedores?.nome || a.produto_label || ""; valB = b.fornecedores?.nome || b.produto_label || ""; }
      else if (sortConfig.key === "servico") { valA = a.tipos_servico_operacional?.nome || a.tipo_servico_label || ""; valB = b.tipos_servico_operacional?.nome || b.tipo_servico_label || ""; }
      else if (sortConfig.key === "transportadora") { valA = a.transportadoras_clientes?.nome || a.transportadora_label || ""; valB = b.transportadoras_clientes?.nome || b.transportadora_label || ""; }
      else if (sortConfig.key === "idPlanilha") { valA = a.created_at || a.id; valB = b.created_at || b.id; }
      else if (sortConfig.key === "data") { valA = a.data_operacao || ""; valB = b.data_operacao || ""; }
      else if (sortConfig.key === "operacao") { valA = a.tipos_servico_operacional?.nome || a.tipo_servico_label || ""; valB = b.tipos_servico_operacional?.nome || b.tipo_servico_label || ""; }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    }

    // 1. Data de operacao (Crescente)
    const dateA = a.data_operacao || "";
    const dateB = b.data_operacao || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // 2. Horario inicio (Crescente)
    const timeA = (a.horario_inicio_label || a.entrada_ponto || "99:99").substring(0, 5);
    const timeB = (b.horario_inicio_label || b.entrada_ponto || "99:99").substring(0, 5);
    if (timeA !== timeB) return timeA.localeCompare(timeB);

    // 3. Fallback estavel por ID para ancoragem quando todos empatam
    const creatA = a.created_at || a.id || "";
    const creatB = b.created_at || b.id || "";
    return String(creatA).localeCompare(String(creatB));
  });

  const toggleCol = (col: keyof typeof visibleCols) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allSelected = Object.values(visibleCols).every(Boolean);

  const toggleAll = () => {
    const newValue = !allSelected;
    const newCols = { ...visibleCols };
    Object.keys(newCols).forEach((key) => {
      newCols[key as keyof typeof visibleCols] = newValue;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols));
    setVisibleCols(newCols);
  };

  const toggleImportantes = () => {
    const importantesCols = {
      data: true,
      operacao: true, transportadora: true, servico: true, qtd: true,
      inicio: false, fim: false, valUnit: false, valDia: true, acoes: true,
      nf: true, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
      valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
      valorFaturamentoNf: false, placa: false, fornecedor: false, qtdCol: true,
      idPlanilha: false, empresaPlanilha: false, formaPagamento: true, observacao: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importantesCols));
    setVisibleCols(importantesCols);
  };

  const openEditor = (item: any) => {
    setEditingItem(item);
    setEditForm(buildEditableForm(item));
    setSelectedEditIssRuleId("");
  };

  const closeEditor = () => {
    if (updateMutation.isPending) return;
    setEditingItem(null);
    setEditForm(null);
    setSelectedEditIssRuleId("");
  };

  const isEditableOperation = (item: any) =>
    item?.origem === "operacoes_producao" && item?.status !== "fechado";

  const editableFilteredCount = filteredData.filter((item: any) => isEditableOperation(item)).length;

  const openBulkEditForField = (field: BulkEditableField) => {
    setBulkField(field);
    setBulkValue("");
    setBulkOnlyEmpty(field === "status_pagamento" ? false : true);
    setIsBulkEditOpen(true);
  };

  const openRuleApplyForColumn = (column: RuleApplicableColumn) => {
    setSelectedRuleColumn(column);
    setSelectedOperationalRuleId("");
    setIsRuleApplyOpen(true);
  };

  const matchesOptionalContext = ({
    ruleId,
    itemId,
    ruleName,
    itemName,
  }: {
    ruleId?: string | null;
    itemId?: string | null;
    ruleName?: string | null;
    itemName?: string | null;
  }) => {
    if (!ruleId && !ruleName) return true;

    if (ruleId && itemId) {
      return ruleId === itemId;
    }

    const normalizedRuleName = normalizeEntityMatchText(ruleName);
    const normalizedItemName = normalizeEntityMatchText(itemName);

    if (normalizedRuleName && normalizedItemName) {
      return (
        normalizedRuleName === normalizedItemName ||
        normalizedRuleName.includes(normalizedItemName) ||
        normalizedItemName.includes(normalizedRuleName)
      );
    }

    return false;
  };

  const matchesOperationalRuleForItem = (item: any, rule: any, column: RuleApplicableColumn) => {
    const itemDate = item?.data_operacao ?? date;
    const isGlobalIssRule = column === "percentualIss" && isIssOperationalRule(rule);

    if (isGlobalIssRule) {
      return true;
    }

    return (
      matchesOptionalContext({
        ruleId: rule.empresa_id,
        itemId: item?.empresa_id,
        ruleName: rule.empresas?.nome,
        itemName: item?.empresas?.nome,
      }) &&
      matchesOptionalContext({
        ruleId: rule.unidade_id,
        itemId: item?.unidade_id,
      }) &&
      matchesOptionalContext({
        ruleId: rule.fornecedor_id,
        itemId: item?.fornecedor_id,
        ruleName: rule.fornecedores?.nome,
        itemName: item?.fornecedores?.nome,
      }) &&
      matchesOptionalContext({
        ruleId: rule.tipo_servico_id,
        itemId: item?.tipo_servico_id,
        ruleName: rule.tipos_servico_operacional?.nome,
        itemName: item?.tipos_servico_operacional?.nome ?? item?.tipo_servico_label,
      }) &&
      matchesOptionalContext({
        ruleId: rule.transportadora_id,
        itemId: item?.transportadora_id,
        ruleName: rule.transportadoras_clientes?.nome,
        itemName: item?.transportadoras_clientes?.nome ?? item?.transportadora_label,
      }) &&
      matchesOptionalContext({
        ruleId: rule.produto_carga_id,
        itemId: item?.produto_carga_id,
        ruleName: rule.produtos_carga?.nome,
        itemName: item?.produtos_carga?.nome ?? item?.produto_label,
      }) &&
      (!rule.vigencia_inicio || rule.vigencia_inicio <= itemDate) &&
      (!rule.vigencia_fim || rule.vigencia_fim >= itemDate)
    );
  };

  const explainOperationalRuleMismatch = (item: any, rule: any) => {
    const itemDate = item?.data_operacao ?? date;
    const reasons: string[] = [];

    if (rule.ativo !== true) reasons.push("inativa");
    if (isIssOperationalRule(rule)) reasons.push("regra de ISS");

    if (!matchesOptionalContext({
      ruleId: rule.empresa_id,
      itemId: item?.empresa_id,
      ruleName: rule.empresas?.nome,
      itemName: item?.empresas?.nome,
    })) {
      reasons.push(`empresa: regra=${formatDiagnosticLabel(rule.empresas?.nome ?? rule.empresa_id)} linha=${formatDiagnosticLabel(item?.empresas?.nome ?? item?.empresa_id)}`);
    }

    if (!matchesOptionalContext({
      ruleId: rule.fornecedor_id,
      itemId: item?.fornecedor_id,
      ruleName: rule.fornecedores?.nome,
      itemName: item?.fornecedores?.nome,
    })) {
      reasons.push(`fornecedor: regra=${formatDiagnosticLabel(rule.fornecedores?.nome ?? rule.fornecedor_id)} linha=${formatDiagnosticLabel(item?.fornecedores?.nome ?? item?.fornecedor_id)}`);
    }

    if (!matchesOptionalContext({
      ruleId: rule.tipo_servico_id,
      itemId: item?.tipo_servico_id,
      ruleName: rule.tipos_servico_operacional?.nome,
      itemName: item?.tipos_servico_operacional?.nome ?? item?.tipo_servico_label,
    })) {
      reasons.push(`servico: regra=${formatDiagnosticLabel(rule.tipos_servico_operacional?.nome ?? rule.tipo_servico_id)} linha=${formatDiagnosticLabel(item?.tipos_servico_operacional?.nome ?? item?.tipo_servico_label ?? item?.tipo_servico_id)}`);
    }

    if (!matchesOptionalContext({
      ruleId: rule.transportadora_id,
      itemId: item?.transportadora_id,
      ruleName: rule.transportadoras_clientes?.nome,
      itemName: item?.transportadoras_clientes?.nome ?? item?.transportadora_label,
    })) {
      reasons.push(`transportadora: regra=${formatDiagnosticLabel(rule.transportadoras_clientes?.nome ?? rule.transportadora_id)} linha=${formatDiagnosticLabel(item?.transportadoras_clientes?.nome ?? item?.transportadora_label ?? item?.transportadora_id)}`);
    }

    if (!matchesOptionalContext({
      ruleId: rule.produto_carga_id,
      itemId: item?.produto_carga_id,
      ruleName: rule.produtos_carga?.nome,
      itemName: item?.produtos_carga?.nome ?? item?.produto_label,
    })) {
      reasons.push(`produto: regra=${formatDiagnosticLabel(rule.produtos_carga?.nome ?? rule.produto_carga_id)} linha=${formatDiagnosticLabel(item?.produtos_carga?.nome ?? item?.produto_label ?? item?.produto_carga_id)}`);
    }

    if (rule.vigencia_inicio && rule.vigencia_inicio > itemDate) {
      reasons.push(`vigencia inicial: regra=${rule.vigencia_inicio} linha=${itemDate}`);
    }

    if (rule.vigencia_fim && rule.vigencia_fim < itemDate) {
      reasons.push(`vigencia final: regra=${rule.vigencia_fim} linha=${itemDate}`);
    }

    return reasons;
  };

  const openInlineEdit = (item: any, field: InlineEditableField) => {
    if (!isEditableOperation(item)) return;
    setActiveInlineCell({ rowId: item.id, field });
    setInlineValue(buildEditableForm(item)[field] ?? "");
  };

  const cancelInlineEdit = () => {
    if (inlineUpdateMutation.isPending) return;
    setActiveInlineCell(null);
    setInlineValue("");
  };

  const submitInlineEdit = (item: any, field: InlineEditableField) => {
    if (inlineUpdateMutation.isPending) return;
    inlineUpdateMutation.mutate({ item, field, value: inlineValue });
  };

  const getFinancePreviewForValue = (item: any, value: string) => {
    if (!value) return null;
    const empresa = (empresas as any[]).find((empresaItem: any) => empresaItem.id === item?.empresa_id) || {};
    return classificarFinanceiroSync(
      {
        ...item,
        forma_pagamento: value,
      },
      empresa,
    );
  };

  const renderHeaderCell = (columnKey: string, content: React.ReactNode, className = "px-3 font-semibold text-center") => {
    const bulkFieldForColumn = MASS_FIELD_BY_COLUMN[columnKey];
    const isRuleCol = !!RULE_COLUMN_CONFIG[columnKey as RuleApplicableColumn];
    const isActiveRule = isRuleCol && activeRuleCols[columnKey as RuleApplicableColumn];

    let InnerContent = bulkFieldForColumn ? (
      <button
        type="button"
        className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted whitespace-nowrap"
        onClick={() => openBulkEditForField(bulkFieldForColumn)}
        title="Editar esta coluna em massa"
        disabled={editableFilteredCount === 0}
      >
        {content}
      </button>
    ) : <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-1">{content}</span>;

    return (
      <th className={className}>
        <div className="flex flex-row items-center justify-center gap-2 w-full min-h-[32px]">
          {InnerContent}
          {isActiveRule && (
            <button
              type="button"
              className="rounded-full flex-shrink-0 border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
              onClick={() => openRuleApplyForColumn(columnKey as RuleApplicableColumn)}
              disabled={editableFilteredCount === 0}
              title="Aplicar regra salva nesta coluna"
            >
              Regra
            </button>
          )}
        </div>
      </th>
    );
  };

  const availableOperationalRules = (regrasOperacionais as any[]).filter((rule) => {
    if (rule.ativo !== true) return false;

    const config = RULE_COLUMN_CONFIG[selectedRuleColumn];
    const joined = `${rule.tipos_regra_operacional?.nome ?? ""} ${rule.tipos_regra_operacional?.coluna_planilha ?? ""}`.toUpperCase();
    return config.matches.some((match) => joined.includes(match.toUpperCase()));
  }).filter((rule: any, index: number, allRules: any[]) => {
    if (selectedRuleColumn !== "percentualIss") return true;

    const key = [
      rule.tipos_regra_operacional?.id ?? rule.tipo_regra_id ?? "",
      rule.empresa_id ?? "",
      rule.valor_unitario ?? "",
      rule.vigencia_inicio ?? "",
      rule.vigencia_fim ?? "",
    ].join("|");

    return index === allRules.findIndex((candidate: any) => [
      candidate.tipos_regra_operacional?.id ?? candidate.tipo_regra_id ?? "",
      candidate.empresa_id ?? "",
      candidate.valor_unitario ?? "",
      candidate.vigencia_inicio ?? "",
      candidate.vigencia_fim ?? "",
    ].join("|") === key);
  });

  const availableEditIssRules = (regrasOperacionais as any[])
    .filter((rule) => rule.ativo === true && isIssOperationalRule(rule))
    .filter((rule) => !editingItem || matchesOperationalRuleForItem(editingItem, rule, "percentualIss"))
    .filter((rule: any, index: number, allRules: any[]) => {
      const key = [
        rule.tipos_regra_operacional?.id ?? rule.tipo_regra_id ?? "",
        rule.valor_unitario ?? "",
        rule.vigencia_inicio ?? "",
        rule.vigencia_fim ?? "",
      ].join("|");

      return index === allRules.findIndex((candidate: any) => [
        candidate.tipos_regra_operacional?.id ?? candidate.tipo_regra_id ?? "",
        candidate.valor_unitario ?? "",
        candidate.vigencia_inicio ?? "",
        candidate.vigencia_fim ?? "",
      ].join("|") === key);
    });

  const availableEditOperationalRules = (regrasOperacionais as any[])
    .filter((rule) => rule.ativo === true && !isIssOperationalRule(rule))
    .filter((rule) => !editingItem || matchesOperationalRuleForItem(editingItem, rule, "valUnit"))
    .filter((rule: any, index: number, allRules: any[]) => {
      const key = [
        rule.tipos_regra_operacional?.id ?? rule.tipo_regra_id ?? "",
        rule.valor_unitario ?? "",
        rule.empresa_id ?? "",
        rule.fornecedor_id ?? "",
        rule.transportadora_id ?? "",
        rule.tipo_servico_id ?? "",
        rule.produto_carga_id ?? "",
        rule.vigencia_inicio ?? "",
        rule.vigencia_fim ?? "",
      ].join("|");

      return index === allRules.findIndex((candidate: any) => [
        candidate.tipos_regra_operacional?.id ?? candidate.tipo_regra_id ?? "",
        candidate.valor_unitario ?? "",
        candidate.empresa_id ?? "",
        candidate.fornecedor_id ?? "",
        candidate.transportadora_id ?? "",
        candidate.tipo_servico_id ?? "",
        candidate.produto_carga_id ?? "",
        candidate.vigencia_inicio ?? "",
        candidate.vigencia_fim ?? "",
      ].join("|") === key);
    });

  const editOperationalRuleDiagnostics = useMemo(() => {
    if (!editingItem) return null;

    const allRules = regrasOperacionais as any[];
    const nonIssRules = allRules.filter((rule) => !isIssOperationalRule(rule));
    const activeNonIssRules = nonIssRules.filter((rule) => rule.ativo === true);
    const rejected = activeNonIssRules
      .map((rule) => ({
        id: rule.id,
        label: `${rule.tipos_regra_operacional?.nome ?? "Regra"} · ${rule.transportadoras_clientes?.nome ?? rule.fornecedores?.nome ?? "Sem contexto"}`,
        reasons: explainOperationalRuleMismatch(editingItem, rule),
      }))
      .filter((item) => item.reasons.length > 0);

    return {
      total: allRules.length,
      nonIss: nonIssRules.length,
      activeNonIss: activeNonIssRules.length,
      matched: availableEditOperationalRules.length,
      rejected: rejected.slice(0, 5),
    };
  }, [availableEditOperationalRules, editingItem, regrasOperacionais]);

  const renderInlineCell = (
    item: any,
    field: InlineEditableField,
    displayValue: React.ReactNode,
    inputType: "text" | "time" = "text",
    className = "px-3 text-center text-muted-foreground whitespace-nowrap",
  ) => {
    const isActive = activeInlineCell?.rowId === item.id && activeInlineCell.field === field;
    const inlineFinancePreview = field === "forma_pagamento" && isActive
      ? getFinancePreviewForValue(item, inlineValue)
      : null;

    return (
      <td
        className={cn(className, isEditableOperation(item) && "cursor-text hover:bg-muted/40")}
        onClick={(event) => {
          event.stopPropagation();
          openInlineEdit(item, field);
        }}
      >
        {isActive && field === "forma_pagamento" ? (
          <div className="min-w-[250px] space-y-2 rounded-lg border border-border bg-background p-2 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <Select value={inlineValue || ""} onValueChange={setInlineValue}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEPÃ“SITO">DepÃ³sito</SelectItem>
                <SelectItem value="DEPOSITO MENSAL">Depósito Mensal</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TRANSFERÃŠNCIA">TransferÃªncia</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
              </SelectContent>
            </Select>

            {inlineFinancePreview && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium",
                  inlineFinancePreview.modalidade === "CAIXA_IMEDIATO" && "border-emerald-200 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                  inlineFinancePreview.modalidade === "DUPLICATA_FORNECEDOR" && "border-orange-200 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
                  inlineFinancePreview.modalidade === "FECHAMENTO_MENSAL_EMPRESA" && "border-blue-200 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                  inlineFinancePreview.modalidade === "TRANSBORDO_30D" && "border-purple-200 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                  inlineFinancePreview.modalidade === "CUSTO_DESPESA" && "border-slate-200 bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
                )}
              >
                <span className="uppercase tracking-wide opacity-70">Modalidade</span>
                <span className="font-semibold">{getModalidadeLabel(inlineFinancePreview.modalidade)}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={cancelInlineEdit}
                disabled={inlineUpdateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2"
                onClick={() => submitInlineEdit(item, field)}
                disabled={inlineUpdateMutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : isActive ? (
          <Input
            autoFocus
            type={inputType}
            value={inlineValue}
            onChange={(event) => setInlineValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => submitInlineEdit(item, field)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitInlineEdit(item, field);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelInlineEdit();
              }
            }}
            className="h-8 min-w-[110px] text-center"
            disabled={inlineUpdateMutation.isPending}
          />
        ) : (
          <span>{displayValue}</span>
        )}
      </td>
    );
  };

  const updateField = (field: keyof EditableOperationForm, value: string) => {
    setEditForm((prev) => {
      if (!prev) return prev;

      const next = { ...prev, [field]: value };

      if (field === "valor_unitario_filme" || field === "quantidade_filme") {
        const totalFilme = parseLocaleNumber(next.valor_unitario_filme) * parseLocaleNumber(next.quantidade_filme);
        next.valor_total_filme = totalFilme ? formatDecimalInput(totalFilme) : "0,00";
      }

      // MOTOR INTELIGENTE - AUTO CÁLCULOS E REGRAS:
      const unitario = next.valor_unitario !== undefined
        ? parseLocaleNumber(next.valor_unitario)
        : Number(editingItem?.valor_unitario_snapshot || editingItem?.valor_unitario_label || 0);

      // Auto-Normalizar NF e Aplicar Regra de ISS (Regra 2)
      let nfRaw = String(next.nf_numero).toUpperCase().trim();
      if (nfRaw === "S" || nfRaw === "SIM") nfRaw = "SIM";
      if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";

      const percentualCalculado = nfRaw === "SIM" ? 5 : (nfRaw === "NÃO" ? 0 : parseLocaleNumber(next.percentual_iss));

      next.nf_numero = nfRaw;
      next.percentual_iss = percentualCalculado.toString();

      // Regra Matemáticas (Regra 1)
      const valDescargaCalculado = Math.max(parseLocaleNumber(next.quantidade), 0) * unitario;
      const custoIssCalculado = valDescargaCalculado * (percentualCalculado / 100);

      next.valor_descarga = valDescargaCalculado ? formatDecimalInput(valDescargaCalculado) : "0,00";
      next.custo_com_iss = custoIssCalculado ? formatDecimalInput(custoIssCalculado) : "0,00";

      return next;
    });
  };

  const applyEditIssRule = (ruleId: string) => {
    setSelectedEditIssRuleId(ruleId);

    if (!ruleId) return;

    const selectedRule = availableEditIssRules.find((rule: any) => rule.id === ruleId);
    if (!selectedRule) return;

    updateField("percentual_iss", String(selectedRule.valor_unitario ?? ""));
  };

  const applyEditOperationalRule = (ruleId: string) => {
    setSelectedEditOperationalRuleId(ruleId);

    if (!ruleId) return;

    const selectedRule = availableEditOperationalRules.find((rule: any) => rule.id === ruleId);
    if (!selectedRule) return;

    updateField("valor_unitario", toNumericInputValue(selectedRule.valor_unitario));
  };

  useEffect(() => {
    if (!editingItem || !editForm) return;

    const currentIss = parseLocaleNumber(editForm.percentual_iss);
    const matchingRule = availableEditIssRules.find((rule: any) => Number(rule.valor_unitario ?? 0) === currentIss);

    setSelectedEditIssRuleId(matchingRule?.id ?? "");
  }, [availableEditIssRules, editForm, editingItem]);

  useEffect(() => {
    if (!editingItem || !editForm) return;

    const currentUnitValue = parseLocaleNumber(editForm.valor_unitario ?? "");
    const matchingRule = availableEditOperationalRules.find(
      (rule: any) => Number(rule.valor_unitario ?? 0) === currentUnitValue,
    );

    setSelectedEditOperationalRuleId(matchingRule?.id ?? "");
  }, [availableEditOperationalRules, editForm, editingItem]);

  useEffect(() => {
    if (!editingItem) return;
    void refetchRegrasOperacionais();
  }, [editingItem, refetchRegrasOperacionais]);

  const editFinancePreview = useMemo(() => {
    if (!editingItem || !editForm?.forma_pagamento) return null;

    const empresa = (empresas as any[]).find((item: any) => item.id === editingItem.empresa_id) || {};
    return classificarFinanceiroSync(
      {
        ...editingItem,
        forma_pagamento: editForm.forma_pagamento,
      },
      empresa,
    );
  }, [editForm?.forma_pagamento, editingItem, empresas]);

  if (!rowsData && isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando operacoes...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 pt-2">
      {/* ─── FILTROS ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-2 w-full">
          <Input
            placeholder="Buscar por fornecedor ou serviço..."
            className="w-full sm:w-72 h-9"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />

          {/* Filtro Modalidade Financeira */}
          <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
            <SelectTrigger className="w-full sm:w-52 h-9">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Modalidades</SelectItem>
              {regrasFinanceiras.map((regra: any) => (
                <SelectItem key={regra.modalidade_financeira} value={regra.modalidade_financeira}>
                  {regra.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Forma de Pagamento */}
          <Select value={formaPagamentoFilter} onValueChange={setFormaPagamentoFilter}>
            <SelectTrigger className="w-full sm:w-52 h-9">
              <SelectValue placeholder="Forma Pgto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Formas</SelectItem>
              {(() => {
                const regraSelecionada = regrasFinanceiras.find((r: any) => r.modalidade_financeira === modalidadeFilter);
                const formasPermitidas = regraSelecionada?.formas_pagamento_permitidas as string[] | undefined;
                if (modalidadeFilter !== "all" && formasPermitidas?.length > 0) {
                  return formasPermitidas.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ));
                }
                return formasPagamentoDb.map((forma: any) => (
                  <SelectItem key={forma.nome} value={forma.nome}>
                    {forma.nome}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>

          {/* Filtro Status Pagamento */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9">
              <SelectValue placeholder="Status pgto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status Pgto</SelectItem>
              <SelectItem value="PENDENTE">Pgto Pendente</SelectItem>
              <SelectItem value="ATRASADO">Pgto Atrasado</SelectItem>
              <SelectItem value="RECEBIDO">Pgto Recebido</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="h-9 font-medium"
            onClick={() => setIsBulkEditOpen(true)}
            disabled={editableFilteredCount === 0}
          >
            Editar coluna
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 font-medium">Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 h-[300px] overflow-y-auto">
              <DropdownMenuLabel>Visibilidade de Colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll} className="font-bold mb-1 bg-muted/50">
                {allSelected ? "DESMARCAR TODAS" : "MARCAR TODAS"}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleCols.operacao && visibleCols.transportadora && visibleCols.servico && visibleCols.qtd && visibleCols.valDia && visibleCols.acoes && visibleCols.nf}
                onCheckedChange={toggleImportantes}
                className="font-bold mb-1 bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
              >
                8 MAIS IMPORTANTES
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Configurar Regras por Coluna">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Regras por Coluna</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(RULE_COLUMN_CONFIG) as RuleApplicableColumn[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={activeRuleCols[key]}
                  onCheckedChange={() => toggleRuleCol(key)}
                >
                  {RULE_COLUMN_CONFIG[key].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => scrollBy("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 z-20 h-9 w-9 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/15 transition-all hover:scale-110 active:scale-95"
          title="Rolar para esquerda"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollBy("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 z-20 h-9 w-9 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/15 transition-all hover:scale-110 active:scale-95"
          title="Rolar para direita"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div ref={tableScrollRef} className="max-h-[70vh] overflow-auto rounded-xl border border-border pb-[1px] bg-background">
          {(() => {
            const getStickyProps = (colKey: "data" | "idPlanilha" | "operacao", isHeader = false) => {
              const baseThClass = "px-3 font-semibold py-2.5 bg-muted/95 backdrop-blur-sm";
              const lockedThClass = "px-3 font-semibold py-2.5 bg-zinc-200/95 dark:bg-zinc-800/95 backdrop-blur-sm";
              const baseTdClass = "px-3 text-center text-muted-foreground whitespace-nowrap bg-background";
              const typeClasses = {
                data: isHeader ? "" : "font-mono text-xs",
                idPlanilha: "",
                operacao: isHeader ? "px-5" : "font-medium text-foreground px-5 py-3"
              };

              if (!lockedCols[colKey]) {
                return { className: cn(isHeader ? baseThClass : baseTdClass, typeClasses[colKey]) };
              }

              const widths = { data: 120, idPlanilha: 80, operacao: 280 };
              let left = 0;
              if (colKey === "idPlanilha") {
                if (visibleCols.data && lockedCols.data) left += widths.data;
              }
              if (colKey === "operacao") {
                if (visibleCols.data && lockedCols.data) left += widths.data;
                if (visibleCols.idPlanilha && lockedCols.idPlanilha) left += widths.idPlanilha;
              }

              const activeSticky = [];
              if (visibleCols.data && lockedCols.data) activeSticky.push("data");
              if (visibleCols.idPlanilha && lockedCols.idPlanilha) activeSticky.push("idPlanilha");
              if (visibleCols.operacao && lockedCols.operacao) activeSticky.push("operacao");
              const isLast = activeSticky[activeSticky.length - 1] === colKey;

              return {
                style: {
                  position: "sticky" as const,
                  left: `${left}px`,
                  top: isHeader ? 0 : undefined,
                  zIndex: isHeader ? 40 : 10,
                  minWidth: `${widths[colKey]}px`,
                  maxWidth: `${widths[colKey]}px`
                },
                className: cn(
                  isHeader ? lockedThClass : baseTdClass,
                  typeClasses[colKey],
                  "border-r border-border transition-all",
                  isLast && "after:absolute after:top-0 after:bottom-0 after:-right-[10px] after:w-[10px] after:bg-gradient-to-r after:from-black/5 dark:after:from-black/20 after:to-transparent after:pointer-events-none"
                )
              };
            };

            const renderInteractiveHeader = (colKey: string, label: React.ReactNode, Icon?: any) => {
              const isLockable = ["data", "idPlanilha", "operacao"].includes(colKey);
              const isLocked = lockedCols[colKey];

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-center gap-1.5 group w-full focus:outline-none transition-colors hover:text-foreground">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {label}
                      {isLockable && isLocked && <Lock className="h-3 w-3 text-primary ml-0.5" />}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground flex-shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem onClick={() => setSortConfig({ key: colKey, direction: 'asc' })}>
                      <ArrowUpZA className="mr-2 h-4 w-4 text-muted-foreground" />
                      Classificar crescente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortConfig({ key: colKey, direction: 'desc' })}>
                      <ArrowDownAZ className="mr-2 h-4 w-4 text-muted-foreground" />
                      Classificar decrescente
                    </DropdownMenuItem>
                    {sortConfig?.key === colKey && (
                      <DropdownMenuItem onClick={() => setSortConfig(null)}>
                        <span className="mr-2 h-4 w-4 flex items-center justify-center font-bold text-muted-foreground">✕</span>
                        Remover ordenação
                      </DropdownMenuItem>
                    )}

                    {isLockable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleLock(colKey)}>
                          {isLocked ? (
                            <><Unlock className="mr-2 h-4 w-4 text-muted-foreground" /> Destravar coluna</>
                          ) : (
                            <><Lock className="mr-2 h-4 w-4 text-primary" /> Travar coluna (Fixar)</>
                          )}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            };

            return (
              <table className="w-full text-sm min-w-max">
                <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-20">
                  <tr className="text-center font-display text-muted-foreground uppercase text-xs tracking-wide">
                    {visibleCols.data && <th style={getStickyProps("data", true).style} className={getStickyProps("data", true).className}>{renderInteractiveHeader("data", "DATA", CalendarDays)}</th>}
                    {visibleCols.idPlanilha && <th style={getStickyProps("idPlanilha", true).style} className={getStickyProps("idPlanilha", true).className}>{renderInteractiveHeader("idPlanilha", "ID")}</th>}
                    {visibleCols.operacao && <th style={getStickyProps("operacao", true).style} className={getStickyProps("operacao", true).className}>{renderInteractiveHeader("operacao", "OPERAÇÃO/VOLUME", Package)}</th>}
                    {visibleCols.empresaPlanilha && <th className="px-3 py-2.5 font-semibold text-center">EMPRESA</th>}
                    {visibleCols.fornecedor && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("fornecedor", "FORNECEDOR")}</th>}
                    {visibleCols.transportadora && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("transportadora", "TRANSPORTADORA", Truck)}</th>}
                    {visibleCols.placa && renderHeaderCell("placa", "PLACA", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.servico && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("servico", "SERVICO", Settings2)}</th>}
                    {visibleCols.qtdCol && renderHeaderCell("qtdCol", <span className="inline-flex items-center justify-center gap-1.5 w-full"><User className="h-3.5 w-3.5 text-muted-foreground" />QTD. COL.</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.formaPagamento && renderHeaderCell("formaPagamento", "FORMA PAGAMENTO", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.nf && renderHeaderCell("nf", "NF", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.ctrc && renderHeaderCell("ctrc", "CTRC", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.observacao && renderHeaderCell("observacao", "OBSERVACAO", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.percentualIss && renderHeaderCell("percentualIss", "% ISS", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.inicio && renderHeaderCell("inicio", <span className="inline-flex items-center justify-center gap-1.5 w-full"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />INICIO</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.fim && renderHeaderCell("fim", <span className="inline-flex items-center justify-center gap-1.5 w-full"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />FIM</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valUnit && renderHeaderCell("valUnit", <span className="inline-flex items-center justify-center gap-1.5 w-full"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />VAL. UNIT.</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.qtd && renderHeaderCell("qtd", <span className="inline-flex items-center justify-center gap-1.5 w-full"><Hash className="h-3.5 w-3.5 text-muted-foreground" />QTD</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorDescarga && renderHeaderCell("valorDescarga", "VALOR DESCARGA", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.custoIss && renderHeaderCell("custoIss", "CUSTO ISS", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorUnitarioFilme && renderHeaderCell("valorUnitarioFilme", "UNIT. FILME", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.quantidadeFilme && renderHeaderCell("quantidadeFilme", "QTD. FILME", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorTotalFilme && renderHeaderCell("valorTotalFilme", "TOTAL FILME", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorFaturamentoNf && renderHeaderCell("valorFaturamentoNf", "FATURAMENTO NF", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valDia && renderHeaderCell("conferido_final", <span className="inline-flex items-center justify-center gap-1.5 w-full"><BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />TOTAL DIA</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.modalidadeFinanceira && <th className="px-3 py-2.5 font-semibold text-center">MODALIDADE</th>}
                    {visibleCols.dataVencimento && <th className="px-3 py-2.5 font-semibold text-center">VENCIMENTO</th>}
                    {visibleCols.statusPagamento && <th className="px-3 py-2.5 font-semibold text-center">STATUS PGTO</th>}
                    {false && <th className="px-3 py-2.5 font-semibold text-center"><span className="inline-flex items-center justify-center gap-1.5 w-full"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />STATUS</span></th>}
                    {visibleCols.acoes && <th className="px-5 py-2.5 font-semibold text-center"><span className="inline-flex items-center justify-center gap-1.5 w-full"><Hourglass className="h-3.5 w-3.5 text-muted-foreground" />ACOES</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any, index: number) => {
                    const isSelected = kind === "operacao" && selectedId === item.id;
                    const valDescarga = Number(item.valor_descarga ?? (Number(item.quantidade) * Number(item.valor_unitario || 0)));
                    const custoComIss = Number(item.custo_com_iss || 0);
                    const totalEFilme = Number(item.valor_total_filme || 0);
                    const valorTotal = valDescarga + custoComIss + totalEFilme;
                    const fornecedor = item.fornecedores?.nome || item.produto_label || "Sem fornecedor";
                    const servico = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "Sem servico";
                    const operacaoNome = servico;
                    const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "—";
                    const placa = item.placa || "—";
                    const nf = item.nf_numero || "—";
                    const ctrc = item.ctrc || "—";
                    const iss = item.percentual_iss ? `${(Number(item.percentual_iss) * 100).toFixed(0)}%` : "—";
                    const idPlanilha = index + 1;
                    const empresaPlanilha = getDisplayEmpresa(item, empresas as any[]);
                    const formaPagamento = getDisplayFormaPagamento(item);
                    const observacao = getDisplayObservacao(item);
                    const dataOp = item.data_operacao ? new Date(item.data_operacao + "T00:00:00").toLocaleDateString("pt-BR") : "—";
                    const qtdColaboradores = item.quantidade_colaboradores ?? 1;
                    let qtdText = String(item.quantidade_label || item.quantidade || 0);
                    if (item.tipo_calculo_snapshot === "volume") qtdText += " vol(s)";
                    else if (item.tipo_calculo_snapshot === "diaria") qtdText += " diaria(s)";
                    else if (item.tipo_calculo_snapshot === "operacao") qtdText = "1 op";
                    const inicio = item.entrada_ponto ? String(item.entrada_ponto).substring(0, 5) : item.horario_inicio_label ? String(item.horario_inicio_label).substring(0, 5) : "—";
                    const fim = item.saida_ponto ? String(item.saida_ponto).substring(0, 5) : item.horario_fim_label ? String(item.horario_fim_label).substring(0, 5) : "—";
                    const valUnitFormatter = (value: any) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                    const valUnit = valUnitFormatter(item.valor_unitario_snapshot ?? item.valor_unitario_label ?? item.valor_unitario ?? 0);
                    const valDia = valUnitFormatter(valorTotal);
                    const valorDescarga = valUnitFormatter(item.valor_descarga);
                    const custoIss = valUnitFormatter(item.custo_com_iss);
                    const unitFilme = valUnitFormatter(item.valor_unitario_filme);
                    const qtdFilme = item.quantidade_filme || "—";
                    const totFilme = valUnitFormatter(item.valor_total_filme);
                    const fatNf = valUnitFormatter(item.valor_faturamento_nf);
                    const statusOriginal = String(getDisplayStatusOriginal(item));
                    const statusCfg = getStatusConfig(statusOriginal);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedOpDetails(item)}
                        className={cn(
                          "esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50",
                          item.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                          isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                        )}
                      >
                        {visibleCols.data && <td style={getStickyProps("data", false).style} className={cn(getStickyProps("data", false).className, "px-3 text-center text-muted-foreground whitespace-nowrap font-mono text-xs")}>{dataOp}</td>}
                        {visibleCols.idPlanilha && <td style={getStickyProps("idPlanilha", false).style} className={cn(getStickyProps("idPlanilha", false).className, "px-3 text-center text-muted-foreground whitespace-nowrap")}>{String(idPlanilha)}</td>}
                        {visibleCols.operacao && <td style={getStickyProps("operacao", false).style} className={cn(getStickyProps("operacao", false).className, "px-5 py-3 text-center font-medium whitespace-nowrap text-foreground")}>{operacaoNome}</td>}
                        {visibleCols.empresaPlanilha && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{String(empresaPlanilha)}</td>}
                        {visibleCols.fornecedor && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{fornecedor}</td>}
                        {visibleCols.transportadora && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{transportadora}</td>}
                        {visibleCols.placa && renderInlineCell(item, "placa", placa)}
                        {visibleCols.servico && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{servico}</td>}
                        {visibleCols.qtdCol && renderInlineCell(item, "quantidade_colaboradores", qtdColaboradores, "text", "px-3 text-center font-display font-medium whitespace-nowrap")}
                        {visibleCols.formaPagamento && renderInlineCell(item, "forma_pagamento", String(formaPagamento))}
                        {visibleCols.nf && renderInlineCell(item, "nf_numero", nf)}
                        {visibleCols.ctrc && renderInlineCell(item, "ctrc", ctrc)}
                        {visibleCols.observacao && renderInlineCell(item, "observacao", String(observacao))}
                        {visibleCols.percentualIss && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{iss}</td>}
                        {visibleCols.inicio && renderInlineCell(item, "entrada_ponto", inicio, "time")}
                        {visibleCols.fim && renderInlineCell(item, "saida_ponto", fim, "time")}
                        {visibleCols.valUnit && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{valUnit}</td>}
                        {visibleCols.qtd && renderInlineCell(item, "quantidade", qtdText, "text", "px-3 text-center font-display font-medium whitespace-nowrap")}
                        {visibleCols.valorDescarga && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{valorDescarga}</td>}
                        {visibleCols.custoIss && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{custoIss}</td>}
                        {visibleCols.valorUnitarioFilme && renderInlineCell(item, "valor_unitario_filme", unitFilme)}
                        {visibleCols.quantidadeFilme && renderInlineCell(item, "quantidade_filme", qtdFilme)}
                        {visibleCols.valorTotalFilme && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{totFilme}</td>}
                        {visibleCols.valorFaturamentoNf && renderInlineCell(item, "valor_faturamento_nf", fatNf)}
                        {visibleCols.valDia && <td className="px-3 text-center font-display font-semibold text-foreground whitespace-nowrap">{valDia}</td>}
                        {visibleCols.modalidadeFinanceira && (
                          <td className="px-3 text-center whitespace-nowrap">
                            {item.modalidadeFinanceira ? (
                              <Badge variant="outline" className={cn(
                                "font-medium border-0 text-xs",
                                item.modalidadeFinanceira === "CAIXA_IMEDIATO" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                                (item.modalidadeFinanceira === "DUPLICATA_FORNECEDOR" || item.modalidadeFinanceira === "DUPLICATA") && "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
                                (item.modalidadeFinanceira === "FECHAMENTO_MENSAL_EMPRESA" || item.modalidadeFinanceira === "FATURAMENTO_MENSAL") && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                                item.modalidadeFinanceira === "TRANSBORDO_30D" && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                                item.modalidadeFinanceira === "CUSTO_DESPESA" && "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
                              )}>
                                {getModalidadeLabel(item.modalidadeFinanceira)}
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                        {visibleCols.dataVencimento && (
                          <td className="px-3 text-center text-muted-foreground whitespace-nowrap font-mono text-xs">
                            {item.dataVencimento
                              ? new Date(item.dataVencimento + "T12:00:00Z").toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                        )}
                        {visibleCols.statusPagamento && (
                          <td className="px-3 text-center whitespace-nowrap">
                            {item.statusPagamento ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild disabled={!isEditableOperation(item) || updateStatusPagamentoMutation.isPending}>
                                  <button
                                    type="button"
                                    className="inline-flex"
                                    onClick={(e) => e.stopPropagation()}
                                    title={isEditableOperation(item) ? "Alterar status de pagamento" : "Status de pagamento"}
                                  >
                                    <Badge variant="outline" className={cn(
                                      "font-medium border-0 text-xs",
                                      isEditableOperation(item) && "cursor-pointer hover:opacity-85",
                                      item.statusPagamento === "RECEBIDO" && "bg-success-soft text-success-strong",
                                      item.statusPagamento === "PENDENTE" && "bg-muted text-muted-foreground",
                                      item.statusPagamento === "ATRASADO" && "bg-destructive-soft text-destructive-strong",
                                    )}>
                                      {item.statusPagamento === "RECEBIDO" ? "Recebido" : item.statusPagamento === "ATRASADO" ? "Atrasado" : "Pendente"}
                                    </Badge>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuLabel>Status pgto</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "RECEBIDO" })}>
                                    Recebido
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "ATRASADO" })}>
                                    Atrasado
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "PENDENTE" })}>
                                    Pendente
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                        {false && (
                          <td className="px-3 text-center whitespace-nowrap">
                            <Badge variant="outline" className={cn(statusCfg.className, "hover:bg-transparent font-medium border-0")}>
                              {statusOriginal === "—" ? "—" : statusCfg.label}
                            </Badge>
                          </td>
                        )}
                        {visibleCols.acoes && (
                          <td className="px-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isEditableOperation(item)) {
                                    openEditor(item);
                                    return;
                                  }
                                  navigate(`/producao?id=${item.id}`);
                                }}
                                title={isEditableOperation(item) ? "Editar nesta tela" : "Abrir lançamento"}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {item.origem === "operacoes_producao" && (
                                <button
                                  className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/cadastros/regras-operacionais");
                                  }}
                                  title="Abrir regras operacionais"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isEditableOperation(item) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild disabled={updateStatusPagamentoMutation.isPending}>
                                    <button
                                      className="h-7 w-7 rounded-md hover:bg-success-soft flex items-center justify-center text-muted-foreground hover:text-success-strong"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Alterar status de pagamento"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel>Status pgto</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "RECEBIDO" })}>
                                      Recebido
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "ATRASADO" })}>
                                      Atrasado
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatusPagamentoMutation.mutate({ item, statusPagamento: "PENDENTE" })}>
                                      Pendente
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <button
                                className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={22} className="p-12 text-center text-muted-foreground italic">
                        {filterByDate ? "Nenhuma operacao atende aos filtros atuais nesta data." : "Nenhuma operacao atende aos filtros atuais."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>

      <Sheet open={isBulkEditOpen} onOpenChange={(value) => !bulkUpdateMutation.isPending && setIsBulkEditOpen(value)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar coluna em massa</SheetTitle>
            <SheetDescription>
              Aplique um mesmo valor para todas as linhas filtradas da planilha. Ideal quando uma coluna inteira veio vazia ou precisa de ajuste global.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              {editableFilteredCount} linha(s) filtrada(s) podem receber edi??o em massa neste momento.
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Coluna</Label>
                <Select
                  value={bulkField}
                  onValueChange={(value) => {
                    const nextField = value as BulkEditableField;
                    setBulkField(nextField);
                    setBulkValue("");
                    setBulkOnlyEmpty(nextField === "status_pagamento" ? false : true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {MASS_EDITABLE_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Novo valor</Label>
                {bulkField === "observacao" ? (
                  <Textarea
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                    placeholder="Digite o valor que deve ser aplicado"
                    rows={4}
                  />
                ) : bulkField === "forma_pagamento" ? (
                  <Select value={bulkValue} onValueChange={setBulkValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPOSITO">Deposito</SelectItem>
                      <SelectItem value="DEPOSITO MENSAL">Deposito Mensal</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkField === "modalidade_financeira" ? (
                  <Select value={bulkValue} onValueChange={setBulkValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAIXA_IMEDIATO">Deposito</SelectItem>
                      <SelectItem value="DUPLICATA_FORNECEDOR">Boleto</SelectItem>
                      <SelectItem value="FECHAMENTO_MENSAL_EMPRESA">Deposito (mensal)</SelectItem>
                      <SelectItem value="TRANSBORDO_30D">Transbordo (30 dias)</SelectItem>
                      <SelectItem value="CUSTO_DESPESA">Custo</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkField === "status_pagamento" ? (
                  <Select value={bulkValue} onValueChange={setBulkValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="ATRASADO">Atrasado</SelectItem>
                      <SelectItem value="RECEBIDO">Recebido</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkField === "data_vencimento" ? (
                  <Input
                    type="date"
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                  />
                ) : (
                  <Input
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                    placeholder="Digite o valor que deve ser aplicado"
                  />
                )}
                {bulkField === "modalidade_financeira" && (
                  <p className="text-xs text-muted-foreground">
                    Use apenas em excecoes. Sem override manual, a modalidade continua automatica pela origem da operacao.
                  </p>
                )}
                {bulkField === "data_vencimento" && (
                  <p className="text-xs text-muted-foreground">
                    Campo pensado para ajustes pontuais. Quando vazio, o vencimento segue a regra financeira automatica.
                  </p>
                )}
                {bulkField === "status_pagamento" && (
                  <p className="text-xs text-muted-foreground">
                    Alteracao em massa permitida para marcar varios registros como recebidos, atrasados ou pendentes.
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4">
                <Checkbox
                  id="bulk-only-empty"
                  checked={bulkOnlyEmpty}
                  onCheckedChange={(checked) => setBulkOnlyEmpty(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="bulk-only-empty" className="cursor-pointer">Preencher s? linhas vazias</Label>
                  <p className="text-sm text-muted-foreground">
                    Mant?m os valores j? existentes e s? completa onde a coluna veio sem dado.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
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

      <Sheet open={isRuleApplyOpen} onOpenChange={(value) => !applyRuleMutation.isPending && !clearRuleColumnMutation.isPending && setIsRuleApplyOpen(value)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Aplicar regra salva na coluna</SheetTitle>
            <SheetDescription>
              Use uma regra já cadastrada para preencher a coluna com o valor correspondente em cada linha compatível.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Coluna alvo: <span className="font-medium text-foreground">{RULE_COLUMN_CONFIG[selectedRuleColumn].label}</span>
            </div>

            <div className="space-y-2">
              <Label>Regra disponível</Label>
              <Select value={selectedOperationalRuleId} onValueChange={setSelectedOperationalRuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a regra cadastrada que deve ser aplicada" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperationalRules.map((rule: any) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {`${rule.tipos_regra_operacional?.nome ?? "Regra"} · ${Number(rule.valor_unitario ?? 0).toLocaleString("pt-BR")} · ${rule.fornecedores?.nome ?? "Fornecedor"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {selectedRuleColumn === "percentualIss"
                  ? "Para ISS, a regra selecionada passa a valer para toda a coluna nas linhas filtradas, sem depender de fornecedor, fabricante, TC ou empresa."
                  : "A lista vem das regras ja cadastradas em Regras Operacionais. Ao aplicar, o sistema usa o mesmo tipo de regra e procura a combinacao compativel por empresa, fornecedor, servico e vigencia em cada linha filtrada."}
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setIsRuleApplyOpen(false)} disabled={applyRuleMutation.isPending || clearRuleColumnMutation.isPending}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => clearRuleColumnMutation.mutate()} disabled={applyRuleMutation.isPending || clearRuleColumnMutation.isPending}>
                {clearRuleColumnMutation.isPending ? "Limpando..." : "Limpar coluna"}
              </Button>
              <Button onClick={() => applyRuleMutation.mutate()} disabled={applyRuleMutation.isPending || clearRuleColumnMutation.isPending || !selectedOperationalRuleId}>
                {applyRuleMutation.isPending ? "Aplicando..." : "Aplicar regra"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedOpDetails} onOpenChange={(value) => !value && setSelectedOpDetails(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da operacao</SheetTitle>
            <SheetDescription>Informacoes completas relativas a operacao do dia.</SheetDescription>
          </SheetHeader>

          {selectedOpDetails && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Fornecedor / Operacao</p>
                <p className="text-sm text-muted-foreground">{selectedOpDetails.fornecedores?.nome || selectedOpDetails.produto_label || "Sem fornecedor"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Data da operacao</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedOpDetails.data_operacao ? new Date(selectedOpDetails.data_operacao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Qtd. colaboradores</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.quantidade_colaboradores ?? 1} col.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Servico</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.tipos_servico_operacional?.nome || selectedOpDetails.tipo_servico_label || "Sem servico"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Transportadora</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.transportadoras_clientes?.nome || selectedOpDetails.transportadora_label || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">NF numero</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.nf_numero || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">CTRC</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.ctrc || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Forma de pagamento</p>
                  <p className="text-sm text-muted-foreground">{String(getDisplayFormaPagamento(selectedOpDetails))}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Observacao</p>
                  <p className="text-sm text-muted-foreground">{String(getDisplayObservacao(selectedOpDetails))}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Valores principais</p>
                <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-3 bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor desc. / op</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_descarga || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento liq. NF</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_faturamento_nf || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button variant="outline" onClick={() => setSelectedOpDetails(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!editingItem} onOpenChange={(value) => !value && closeEditor()}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar operacao na tela operacional</SheetTitle>
            <SheetDescription>
              Ajuste os campos da planilha diretamente aqui. O valor unitário continua vindo das regras operacionais.
            </SheetDescription>
          </SheetHeader>

          {editingItem && editForm && (
            <div className="mt-6 space-y-6">
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Valor unitário bloqueado nesta tela</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(editingItem.valor_unitario_snapshot || editingItem.valor_unitario_label || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}{" "}
                      · altere em Regras Operacionais quando precisar revisar a regra de origem.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/cadastros/regras-operacionais")}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir regras
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input id="quantidade" value={editForm.quantidade} onChange={(e) => updateField("quantidade", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade_colaboradores">Qtd. colaboradores</Label>
                  <Input id="quantidade_colaboradores" value={editForm.quantidade_colaboradores} onChange={(e) => updateField("quantidade_colaboradores", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entrada_ponto">Entrada</Label>
                  <Input id="entrada_ponto" type="time" value={editForm.entrada_ponto} onChange={(e) => updateField("entrada_ponto", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida_ponto">Saida</Label>
                  <Input id="saida_ponto" type="time" value={editForm.saida_ponto} onChange={(e) => updateField("saida_ponto", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placa">Placa</Label>
                  <Input id="placa" value={editForm.placa} onChange={(e) => updateField("placa", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>NF (SIM/NÃO)</Label>
                  <Select value={editForm.nf_numero || ""} onValueChange={(v) => updateField("nf_numero", v)}>
                    <SelectTrigger id="nf_numero">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="NÃO">NÃO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctrc">CTRC</Label>
                  <Input id="ctrc" value={editForm.ctrc} onChange={(e) => updateField("ctrc", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Regra operacional cadastrada</Label>
                  <Select value={selectedEditOperationalRuleId} onValueChange={applyEditOperationalRule}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma regra registrada para atualizar o valor unitario" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEditOperationalRules.map((rule: any) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {`${rule.tipos_regra_operacional?.nome ?? "Regra"} · ${Number(rule.valor_unitario ?? 0).toLocaleString("pt-BR")} · ${rule.fornecedores?.nome ?? rule.transportadoras_clientes?.nome ?? "Global"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Aqui aparecem as demais regras operacionais compatíveis com a linha, como descarga por volume. Ao selecionar uma regra, o valor unitário de origem é atualizado e os cálculos automáticos são refeitos.
                  </p>
                  {editOperationalRuleDiagnostics && (
                    <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <p>
                        Diagnostico: carregadas {editOperationalRuleDiagnostics.total} regras no total, {editOperationalRuleDiagnostics.nonIss} nao-ISS, {editOperationalRuleDiagnostics.activeNonIss} ativas, {editOperationalRuleDiagnostics.matched} compativeis com esta linha.
                      </p>
                      {editOperationalRuleDiagnostics.rejected.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {editOperationalRuleDiagnostics.rejected.map((item) => (
                            <p key={item.id}>
                              {item.label}: {item.reasons.join(" | ")}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Regra de ISS cadastrada</Label>
                  <Select value={selectedEditIssRuleId} onValueChange={applyEditIssRule}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma regra registrada para preencher o ISS" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEditIssRules.map((rule: any) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {`${rule.tipos_regra_operacional?.nome ?? "Regra"} · ${Number(rule.valor_unitario ?? 0).toLocaleString("pt-BR")} · ${rule.fornecedores?.nome ?? "Global"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    As regras registradas de ISS aparecem aqui para preencher automaticamente o percentual e recalcular os campos dependentes.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="percentual_iss" className="text-primary font-medium">Percentual ISS</Label>
                    <Badge variant="outline" className="text-[10px] h-4 leading-none bg-primary/10">Automático</Badge>
                  </div>
                  <Input id="percentual_iss" value={editForm.percentual_iss} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="valor_descarga" className="text-primary font-medium">Valor descarga</Label>
                    <Badge variant="outline" className="text-[10px] h-4 leading-none bg-primary/10">Automático</Badge>
                  </div>
                  <Input id="valor_descarga" value={editForm.valor_descarga} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="custo_com_iss" className="text-primary font-medium">Custo com ISS</Label>
                    <Badge variant="outline" className="text-[10px] h-4 leading-none bg-primary/10">Automático</Badge>
                  </div>
                  <Input id="custo_com_iss" value={editForm.custo_com_iss} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_unitario_filme">Valor unitario filme</Label>
                  <Input id="valor_unitario_filme" value={editForm.valor_unitario_filme} onChange={(e) => updateField("valor_unitario_filme", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade_filme">Quantidade filme</Label>
                  <Input id="quantidade_filme" value={editForm.quantidade_filme} onChange={(e) => updateField("quantidade_filme", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_total_filme">Valor total filme</Label>
                  <Input id="valor_total_filme" value={editForm.valor_total_filme} readOnly disabled />
                  <p className="text-xs text-muted-foreground">Calculado automaticamente: unitário do filme x quantidade do filme.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_faturamento_nf">Valor faturamento NF</Label>
                  <Input id="valor_faturamento_nf" value={editForm.valor_faturamento_nf} onChange={(e) => updateField("valor_faturamento_nf", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Forma de pagamento</Label>
                  <Select value={editForm.forma_pagamento || ""} onValueChange={(v) => updateField("forma_pagamento", v)}>
                    <SelectTrigger id="forma_pagamento">
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPÓSITO">Depósito</SelectItem>
                      <SelectItem value="DEPOSITO MENSAL">Depósito Mensal</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="TRANSFERÊNCIA">Transferência</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                  {editFinancePreview && (
                    <div
                      className={cn(
                        "mt-1.5 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                        editFinancePreview.modalidade === "CAIXA_IMEDIATO" && "border-emerald-200 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                        editFinancePreview.modalidade === "DUPLICATA_FORNECEDOR" && "border-orange-200 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
                        editFinancePreview.modalidade === "FECHAMENTO_MENSAL_EMPRESA" && "border-blue-200 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                        editFinancePreview.modalidade === "TRANSBORDO_30D" && "border-purple-200 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                        editFinancePreview.modalidade === "CUSTO_DESPESA" && "border-slate-200 bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
                      )}
                    >
                      <span className="text-xs uppercase tracking-wide opacity-70">Modalidade resultante:</span>
                      <span className="font-semibold">{getModalidadeLabel(editFinancePreview.modalidade)}</span>
                      <span className="ml-auto text-xs opacity-60">
                        Venc. {editFinancePreview.vencimento.toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="observacao">Observacao</Label>
                  <Textarea id="observacao" className="min-h-[96px]" value={editForm.observacao} onChange={(e) => updateField("observacao", e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={closeEditor} disabled={updateMutation.isPending}>
                  Cancelar
                </Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar alteracoes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
