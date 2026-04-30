import { useCallback, useEffect, useRef, useState } from "react";
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
import { OperacaoProducaoService, OperacaoService, RegraOperacionalService } from "@/services/base.service";

type OperacoesTableBlockProps = {
  date: string;
  empresaId: string;
  filterByDate?: boolean;
  respectCompanyFilter?: boolean;
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
  | "valor_faturamento_nf";

type InlineEditableField = BulkEditableField;

type RuleApplicableColumn = "percentualIss";

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

const RULE_COLUMN_CONFIG: Record<
  RuleApplicableColumn,
  {
    field: keyof EditableOperationForm;
    label: string;
    matches: string[];
  }
> = {
  percentualIss: {
    field: "percentual_iss",
    label: "% ISS",
    matches: ["% ISS", "ISS", "LÍQUOTA DE ISS", "LIQUOTA DE ISS"],
  },
};

const normalizeRuleText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

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

const getDisplayFormaPagamento = (item: Record<string, unknown>) =>
  getContextoImportacaoValue(item, "forma_pagamento") ??
  getLinhaOriginalValue(item, "FORMA DE PAGAMENTO") ??
  "—";

const getDisplayObservacao = (item: Record<string, unknown>) =>
  getContextoImportacaoValue(item, "observacao") ??
  getLinhaOriginalValue(item, "OBSERVACAO", "OBSERVAÇÃO") ??
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
    quantidade_colaboradores: toInputValue(item.quantidade_colaboradores ?? 1),
    entrada_ponto: toInputValue(item.entrada_ponto ?? item.horario_inicio_label).slice(0, 5),
    saida_ponto: toInputValue(item.saida_ponto ?? item.horario_fim_label).slice(0, 5),
    placa: toInputValue(item.placa),
    nf_numero: toInputValue(item.nf_numero),
    ctrc: toInputValue(item.ctrc),
    percentual_iss: toIssPercentageInput(item.percentual_iss),
    valor_descarga: toInputValue(item.valor_descarga),
    custo_com_iss: toInputValue(item.custo_com_iss),
    valor_unitario_filme: toInputValue(item.valor_unitario_filme),
    quantidade_filme: toInputValue(item.quantidade_filme),
    valor_total_filme: formatDecimalInput(valorUnitarioFilme * quantidadeFilme),
    valor_faturamento_nf: toInputValue(item.valor_faturamento_nf),
    forma_pagamento: getContextoImportacaoValue(item, "forma_pagamento") ?? "",
    observacao: getContextoImportacaoValue(item, "observacao") ?? "",
  };
};

const applyBusinessRulesToForm = (baseForm: EditableOperationForm, editingItem: any) => {
  const next = { ...baseForm };

  const totalFilme = parseLocaleNumber(next.valor_unitario_filme) * parseLocaleNumber(next.quantidade_filme);
  next.valor_total_filme = totalFilme ? formatDecimalInput(totalFilme) : "0,00";

  const unitario = Number(editingItem?.valor_unitario_snapshot || editingItem?.valor_unitario_label || 0);

  let nfRaw = String(next.nf_numero).toUpperCase().trim();
  if (nfRaw === "S" || nfRaw === "SIM") nfRaw = "SIM";
  if (nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO") nfRaw = "NÃO";

  const percentualCalculado = nfRaw === "SIM" ? 5 : (nfRaw === "NÃO" ? 0 : parseLocaleNumber(next.percentual_iss));

  next.nf_numero = nfRaw;
  next.percentual_iss = percentualCalculado.toString();

  const valDescargaCalculado = Math.max(parseLocaleNumber(next.quantidade), 0) * unitario;
  const custoIssCalculado = valDescargaCalculado * (percentualCalculado / 100);

  next.valor_descarga = valDescargaCalculado ? formatDecimalInput(valDescargaCalculado) : "0,00";
  next.custo_com_iss = custoIssCalculado ? formatDecimalInput(custoIssCalculado) : "0,00";

  return next;
};

const buildOperationUpdatePayload = (editingItem: any, editForm: EditableOperationForm) => {
  const nextAvaliacao = {
    ...(editingItem.avaliacao_json ?? {}),
    contexto_importacao: {
      ...((editingItem.avaliacao_json?.contexto_importacao as Record<string, unknown> | undefined) ?? {}),
      forma_pagamento: editForm.forma_pagamento || null,
      observacao: editForm.observacao || null,
    },
  };

  const valorUnitarioFilmeCalculado = parseLocaleNumber(editForm.valor_unitario_filme);
  const quantidadeFilmeCalculada = parseLocaleNumber(editForm.quantidade_filme);
  const valorTotalFilmeCalculado = valorUnitarioFilmeCalculado * quantidadeFilmeCalculada;

  return {
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
    avaliacao_json: nextAvaliacao,
    origem_dado: editingItem.origem_dado === "importacao" ? "ajuste" : editingItem.origem_dado,
  };
};

export const OperacoesTableBlock = ({
  date,
  empresaId,
  filterByDate = true,
  respectCompanyFilter = true,
}: OperacoesTableBlockProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: selectedId, kind } = useSelection();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const STORAGE_KEY = "orbe_visibleCols_operacoes_v4";

  const defaultCols = {
    data: true,
    operacao: true, transportadora: true, servico: true, qtd: true,
    inicio: false, fim: false, valUnit: true, valDia: true, status: true, acoes: true,
    nf: false, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
    valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
    valorFaturamentoNf: false, placa: false, fornecedor: false, qtdCol: true,
    idPlanilha: false, empresaPlanilha: false, formaPagamento: false, observacao: false,
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
  });

  const { data: regrasOperacionais = [] } = useQuery({
    queryKey: ["regras_operacionais_grid", effectiveEmpresaId],
    queryFn: () => RegraOperacionalService.getAll(effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId),
  });

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

  const filteredData = Array.isArray(rows) ? [...rows].filter((item: any) => {
    const fornecedor = item.fornecedores?.nome || item.produto_label || "";
    const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "";
    const servico = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "";

    const searchMatch =
      fornecedor.toLowerCase().includes(filterText.toLowerCase()) ||
      transportadora.toLowerCase().includes(filterText.toLowerCase()) ||
      servico.toLowerCase().includes(filterText.toLowerCase());

    const statusMatch = statusFilter === "all" || item.status === statusFilter;

    return searchMatch && statusMatch;
  }).sort((a: any, b: any) => {
    if (sortConfig) {
      let valA = a[sortConfig.key] ?? "";
      let valB = b[sortConfig.key] ?? "";

      if (sortConfig.key === "fornecedor") { valA = a.fornecedores?.nome || a.produto_label || ""; valB = b.fornecedores?.nome || b.produto_label || ""; }
      else if (sortConfig.key === "servico") { valA = a.tipos_servico_operacional?.nome || a.tipo_servico_label || ""; valB = b.tipos_servico_operacional?.nome || b.tipo_servico_label || ""; }
      else if (sortConfig.key === "transportadora") { valA = a.transportadoras_clientes?.nome || a.transportadora_label || ""; valB = b.transportadoras_clientes?.nome || b.transportadora_label || ""; }
      else if (sortConfig.key === "status") { valA = a.status || ""; valB = b.status || ""; }
      else if (sortConfig.key === "idPlanilha") { valA = a.created_at || a.id; valB = b.created_at || b.id; }
      else if (sortConfig.key === "data") { valA = a.data_operacao || ""; valB = b.data_operacao || ""; }
      else if (sortConfig.key === "operacao") { valA = `${a.fornecedores?.nome} ${a.tipos_servico_operacional?.nome}`; valB = `${b.fornecedores?.nome} ${b.tipos_servico_operacional?.nome}`; }

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
  }) : [];

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
      inicio: false, fim: false, valUnit: false, valDia: true, status: true, acoes: true,
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
    setBulkOnlyEmpty(true);
    setIsBulkEditOpen(true);
  };

  const openRuleApplyForColumn = (column: RuleApplicableColumn) => {
    setSelectedRuleColumn(column);
    setSelectedOperationalRuleId("");
    setIsRuleApplyOpen(true);
  };

  const matchesOperationalRuleForItem = (item: any, rule: any, column: RuleApplicableColumn) => {
    const itemDate = item?.data_operacao ?? date;
    const isGlobalIssRule = column === "percentualIss" && isIssOperationalRule(rule);

    if (isGlobalIssRule) {
      return true;
    }

    return (
      rule.empresa_id === item?.empresa_id &&
      (!rule.unidade_id || rule.unidade_id === item?.unidade_id) &&
      (!rule.fornecedor_id || rule.fornecedor_id === item?.fornecedor_id) &&
      (!rule.tipo_servico_id || rule.tipo_servico_id === item?.tipo_servico_id) &&
      (!rule.transportadora_id || rule.transportadora_id === item?.transportadora_id) &&
      (!rule.produto_carga_id || rule.produto_carga_id === item?.produto_carga_id) &&
      (!rule.vigencia_inicio || rule.vigencia_inicio <= itemDate) &&
      (!rule.vigencia_fim || rule.vigencia_fim >= itemDate)
    );
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

  const renderHeaderCell = (columnKey: string, content: React.ReactNode, className = "px-3 font-semibold text-center") => {
    const bulkFieldForColumn = BULK_FIELD_BY_COLUMN[columnKey];

    if (!bulkFieldForColumn) {
      return <th className={className}>{content}</th>;
    }

    return (
      <th className={className}>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-1 py-1 transition-colors hover:bg-muted"
          onClick={() => openBulkEditForField(bulkFieldForColumn)}
          title="Editar esta coluna em massa"
          disabled={editableFilteredCount === 0}
        >
          {content}
        </button>
      </th>
    );
  };

  const renderRuleHeaderCell = (
    column: RuleApplicableColumn,
    content: React.ReactNode,
    className = "px-3 font-semibold text-center",
  ) => {
    return (
      <th className={className}>
        <div className="flex flex-col items-center gap-1">
          <span>{content}</span>
          <button
            type="button"
            className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
            onClick={() => openRuleApplyForColumn(column)}
            disabled={editableFilteredCount === 0}
            title="Aplicar regra salva nesta coluna"
          >
            Regra
          </button>
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

  const renderInlineCell = (
    item: any,
    field: InlineEditableField,
    displayValue: React.ReactNode,
    inputType: "text" | "time" = "text",
    className = "px-3 text-center text-muted-foreground whitespace-nowrap",
  ) => {
    const isActive = activeInlineCell?.rowId === item.id && activeInlineCell.field === field;

    return (
      <td
        className={cn(className, isEditableOperation(item) && "cursor-text hover:bg-muted/40")}
        onClick={(event) => {
          event.stopPropagation();
          openInlineEdit(item, field);
        }}
      >
        {isActive ? (
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
      const unitario = Number(editingItem?.valor_unitario_snapshot || editingItem?.valor_unitario_label || 0);

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

  useEffect(() => {
    if (!editingItem || !editForm) return;

    const currentIss = parseLocaleNumber(editForm.percentual_iss);
    const matchingRule = availableEditIssRules.find((rule: any) => Number(rule.valor_unitario ?? 0) === currentIss);

    setSelectedEditIssRuleId(matchingRule?.id ?? "");
  }, [availableEditIssRules, editForm, editingItem]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando operacoes...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 pt-2">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por fornecedor ou servico..."
            className="w-full sm:w-80 h-9"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="registrado">Registrado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="validado">Validado</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="importado">Importado</SelectItem>
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
                checked={visibleCols.operacao && visibleCols.transportadora && visibleCols.servico && visibleCols.qtd && visibleCols.valDia && visibleCols.status && visibleCols.acoes && visibleCols.nf}
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
                  isLast && "shadow-[6px_0_12px_-10px_hsl(var(--foreground)/0.25)]"
                )
              };
            };

            const renderInteractiveHeader = (colKey: string, label: React.ReactNode, Icon?: any) => {
              const isLockable = ["data", "idPlanilha", "operacao"].includes(colKey);
              const isLocked = lockedCols[colKey];

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between gap-1.5 group w-full focus:outline-none transition-colors hover:text-foreground">
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
                  <tr className="text-left font-display text-muted-foreground uppercase text-xs tracking-wide">
                    {visibleCols.data && <th style={getStickyProps("data", true).style} className={getStickyProps("data", true).className}>{renderInteractiveHeader("data", "DATA", CalendarDays)}</th>}
                    {visibleCols.idPlanilha && <th style={getStickyProps("idPlanilha", true).style} className={getStickyProps("idPlanilha", true).className}>{renderInteractiveHeader("idPlanilha", "ID")}</th>}
                    {visibleCols.operacao && <th style={getStickyProps("operacao", true).style} className={getStickyProps("operacao", true).className}>{renderInteractiveHeader("operacao", "OPERACAO", Package)}</th>}
                    {visibleCols.fornecedor && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("fornecedor", "FORNECEDOR")}</th>}
                    {visibleCols.transportadora && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("transportadora", "TRANSPORTADORA", Truck)}</th>}
                    {visibleCols.placa && renderHeaderCell("placa", "PLACA", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.servico && <th className="px-3 py-2.5 font-semibold ">{renderInteractiveHeader("servico", "SERVICO", Settings2)}</th>}
                    {visibleCols.qtdCol && renderHeaderCell("qtdCol", <span className="inline-flex items-center justify-center gap-1.5 w-full"><User className="h-3.5 w-3.5 text-muted-foreground" />QTD. COL.</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.empresaPlanilha && <th className="px-3 py-2.5 font-semibold text-center">EMPRESA PLANILHA</th>}
                    {visibleCols.formaPagamento && renderHeaderCell("formaPagamento", "FORMA PAGAMENTO", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.nf && renderHeaderCell("nf", "NF", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.ctrc && renderHeaderCell("ctrc", "CTRC", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.observacao && renderHeaderCell("observacao", "OBSERVACAO", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.percentualIss && renderRuleHeaderCell("percentualIss", "% ISS", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.inicio && renderHeaderCell("inicio", <span className="inline-flex items-center justify-center gap-1.5 w-full"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />INICIO</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.fim && renderHeaderCell("fim", <span className="inline-flex items-center justify-center gap-1.5 w-full"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />FIM</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valUnit && <th className="px-3 py-2.5 font-semibold text-center"><span className="inline-flex items-center justify-center gap-1.5 w-full"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />VAL. UNIT.</span></th>}
                    {visibleCols.qtd && renderHeaderCell("qtd", <span className="inline-flex items-center justify-center gap-1.5 w-full"><Hash className="h-3.5 w-3.5 text-muted-foreground" />QTD</span>, "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorDescarga && <th className="px-3 py-2.5 font-semibold text-center">VALOR DESCARGA</th>}
                    {visibleCols.custoIss && <th className="px-3 py-2.5 font-semibold text-center">CUSTO ISS</th>}
                    {visibleCols.valorUnitarioFilme && renderHeaderCell("valorUnitarioFilme", "UNIT. FILME", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.quantidadeFilme && renderHeaderCell("quantidadeFilme", "QTD. FILME", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valorTotalFilme && <th className="px-3 py-2.5 font-semibold text-center">TOTAL FILME</th>}
                    {visibleCols.valorFaturamentoNf && renderHeaderCell("valorFaturamentoNf", "FATURAMENTO NF", "px-3 py-2.5 font-semibold text-center")}
                    {visibleCols.valDia && <th className="px-3 py-2.5 font-semibold text-center"><span className="inline-flex items-center justify-center gap-1.5 w-full"><BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />TOTAL DIA</span></th>}
                    {visibleCols.status && <th className="px-3 py-2.5 font-semibold text-center"><span className="inline-flex items-center justify-center gap-1.5 w-full"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />STATUS</span></th>}
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
                    const operacaoNome = `${fornecedor} • ${servico}`;
                    const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "—";
                    const placa = item.placa || "—";
                    const nf = item.nf_numero || "—";
                    const ctrc = item.ctrc || "—";
                    const iss = item.percentual_iss ? `${(Number(item.percentual_iss) * 100).toFixed(0)}%` : "—";
                    const idPlanilha = index + 1;
                    const empresaPlanilha = getLinhaOriginalValue(item, "EMPRESA") || "—";
                    const formaPagamento = getDisplayFormaPagamento(item);
                    const observacao = getDisplayObservacao(item);
                    const dataOp = item.data_operacao ? new Date(item.data_operacao + "T00:00:00").toLocaleDateString("pt-BR") : "—";
                    const qtdColaboradores = item.quantidade_colaboradores ?? 1;
                    let qtdText = String(item.quantidade_label || item.quantidade || 0);
                    if (item.tipo_calculo_snapshot === "volume") qtdText += " vol(s)";
                    else if (item.tipo_calculo_snapshot === "diaria") qtdText += " diaria(s)";
                    else if (item.tipo_calculo_snapshot === "operacao") qtdText = "1 op";
                    const inicio = item.horario_inicio_label ? String(item.horario_inicio_label).substring(0, 5) : "—";
                    const fim = item.horario_fim_label ? String(item.horario_fim_label).substring(0, 5) : "—";
                    const valUnitFormatter = (value: any) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                    const valUnit = valUnitFormatter(item.valor_unitario_label ?? item.valor_unitario ?? 0);
                    const valDia = valUnitFormatter(valorTotal);
                    const valorDescarga = valUnitFormatter(item.valor_descarga);
                    const custoIss = valUnitFormatter(item.custo_com_iss);
                    const unitFilme = valUnitFormatter(item.valor_unitario_filme);
                    const qtdFilme = item.quantidade_filme || "—";
                    const totFilme = valUnitFormatter(item.valor_total_filme);
                    const fatNf = valUnitFormatter(item.valor_faturamento_nf);
                    const statusCfg = getStatusConfig(item.status);

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
                        {visibleCols.fornecedor && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{fornecedor}</td>}
                        {visibleCols.transportadora && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{transportadora}</td>}
                        {visibleCols.placa && renderInlineCell(item, "placa", placa)}
                        {visibleCols.servico && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{servico}</td>}
                        {visibleCols.qtdCol && renderInlineCell(item, "quantidade_colaboradores", qtdColaboradores, "text", "px-3 text-center font-display font-medium whitespace-nowrap")}
                        {visibleCols.empresaPlanilha && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{String(empresaPlanilha)}</td>}
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
                        {visibleCols.status && (
                          <td className="px-3 text-center whitespace-nowrap">
                            <Badge variant="outline" className={cn(statusCfg.className, "hover:bg-transparent font-medium border-0")}>
                              {statusCfg.label}
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
                <Select value={bulkField} onValueChange={(value) => setBulkField(value as BulkEditableField)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {BULK_EDITABLE_FIELDS.map((field) => (
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
                ) : (
                  <Input
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                    placeholder="Digite o valor que deve ser aplicado"
                  />
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
                  <Label htmlFor="nf_numero">NF (SIM/NÃO)</Label>
                  <Input id="nf_numero" value={editForm.nf_numero} onChange={(e) => updateField("nf_numero", e.target.value)} placeholder="SIM ou NÃO" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctrc">CTRC</Label>
                  <Input id="ctrc" value={editForm.ctrc} onChange={(e) => updateField("ctrc", e.target.value)} />
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
                  <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
                  <Input id="forma_pagamento" value={editForm.forma_pagamento} onChange={(e) => updateField("forma_pagamento", e.target.value)} />
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
