import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowRight,
  ArrowUpZA,
  BadgeDollarSign,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Lock,
  Loader2,
  Pencil,
  PlayCircle,
  RotateCcw,
  Tag,
  Trash2,
  Unlock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useOperationalPipeline, buildCustosExtrasPipeline, type CustoExtraStepId } from "@/contexts/OperationalPipelineContext";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { useAccessControl } from "@/contexts/AccessControlContext";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  SheetFooter,
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
  unidades?: { nome?: string | null } | null;
  categoria_custo: string;
  descricao: string;
  valor_unitario?: number | null;
  quantidade?: number | null;
  total?: number | null;
  forma_pagamento?: string | null;
  forma_pagamento_id?: string | null;
  forma_pagamento_ref?: { nome?: string | null } | null;
  data_vencimento?: string | null;
  status_pagamento?: string | null;
  operacao_id?: string | null;
  tipo_lancamento?: string | null;
  origem_dado?: string | null;
  pipeline_status?: "RECEBIDO" | "EM_VALIDACAO" | "APROVADO_OPERACAO" | "REPROVADO" | "ENVIADO_FINANCEIRO" | "FINALIZADO" | null;
  justificativa_devolucao?: string | null;
  responsavel?: { full_name?: string | null } | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
};

type CustosExtrasTableBlockProps = {
  data: CustoExtraItem[];
  defaultPipelineFilter?: "todos" | "pendentes" | "validacao" | "aprovacoes" | "financeiro" | "concluidos";
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
  unidade: false,
  categoria: true,
  descricao: true,
  valorUnitario: true,
  quantidade: true,
  total: true,
  formaPagamento: true,
  vencimento: true,
  status: true,
  pipelineStatus: true,
  responsavel: true,
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

const categoryOptions = ["OPERACIONAL", "ADMINISTRATIVO", "MERENDA/LANCHE", "MANUTENCAO", "TRANSPORTE", "COMUNICACAO", "OUTROS"] as const;
const statusOptions = ["A PAGAR", "PAGO", "ATRASADO", "CANCELADO"] as const;
const paymentOptions = ["DEPOSITO", "DEPOSITO MENSAL", "PIX", "TRANSFERENCIA", "BOLETO", "DINHEIRO"] as const;

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
  const s = String(status ?? "").toUpperCase().replace(/_/g, " ");
  switch (s) {
    case "PAGO":
      return "bg-success-soft text-success-strong";
    case "ATRASADO":
      return "bg-warning-soft text-warning-strong";
    case "A PAGAR":
      return "bg-amber-100 text-amber-700";
    case "CANCELADO":
      return "bg-destructive-soft text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getPipelineStatusConfig = (status?: string | null) => {
  const s = String(status ?? "RECEBIDO").toUpperCase();
  switch (s) {
    case "RECEBIDO":
    case "PENDENTE":
    case "EM_ANALISE":
      return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200", opacity: "opacity-100" };
    case "EM_VALIDACAO":
      return { label: "Em validação operacional", className: "bg-cyan-50 text-cyan-700 border-cyan-200", opacity: "opacity-[0.95]" };
    case "APROVADO_OPERACAO":
      return { label: "Aprovado Operação", className: "bg-blue-50 text-blue-700 border-blue-200", opacity: "opacity-[0.90]" };
    case "ENVIADO_FINANCEIRO":
      return { label: "Enviado ao Financeiro", className: "bg-indigo-50 text-indigo-700 border-indigo-200", opacity: "opacity-[0.80]" };
    case "PAGO":
      return { label: "Pago", className: "bg-emerald-50 text-emerald-700 border-emerald-200", opacity: "opacity-[0.70]" };
    case "FINALIZADO":
    case "CONCLUIDO":
    case "FECHADO":
      return { label: "Finalizado", className: "bg-zinc-100 text-zinc-600 border-zinc-200", opacity: "opacity-[0.60]" };
    case "REPROVADO":
    case "CANCELADO":
    case "DEVOLVIDO":
      return { label: "Devolvido / Reprovado", className: "bg-rose-50 text-rose-700 border-rose-200", opacity: "opacity-100" };
    default:
      return { label: status || "Pendente", className: "bg-muted text-muted-foreground", opacity: "opacity-100" };
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
  status_pagamento: toInputValue(item.status_pagamento || "A PAGAR"),
  operacao_id: toInputValue(item.operacao_id),
});

export function CustosExtrasTableBlock({ data, defaultPipelineFilter = "todos" }: CustosExtrasTableBlockProps) {
  const queryClient = useQueryClient();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState<"todos" | "pendentes" | "validacao" | "aprovacoes" | "financeiro" | "concluidos">(defaultPipelineFilter);
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

  const { role, isAdmin } = useAccessControl();
  const { openPipeline } = useOperationalPipeline();

  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    itemId: string | null;
    targetStatus: CustoExtraItem['pipeline_status'] | null;
    title?: string;
    description?: string;
  }>({
    open: false,
    itemId: null,
    targetStatus: null,
  });

  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [itemToPay, setItemToPay] = useState<CustoExtraItem | null>(null);

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, acao, updatedAt, justification }: { id: string; acao: string; updatedAt: string; justification?: string }) => {
      return CustoExtraOperacionalService.transicionar(id, acao, updatedAt, justification);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["aprovacoes-rh"] });
      toast.success("Status do pipeline atualizado");
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar pipeline:", error);
      toast.error(error?.message || "Erro ao atualizar status do pipeline");
    },
  });

  const handleAdvancePipeline = (item: CustoExtraItem) => {
    const current = item.pipeline_status || 'PENDENTE';
    let acao = '';
    let stepId: CustoExtraStepId = 'lancamento';

    if (current === 'RECEBIDO' || current === 'PENDENTE') {
      acao = 'avancar_validacao';
      stepId = 'validacao_operacional';
    } else if (current === 'EM_VALIDACAO') {
      acao = 'aprovar';
      stepId = 'financeiro';
    } else if (current === 'APROVADO_OPERACAO') {
      acao = 'enviar_financeiro';
      stepId = 'centro_custo';
    } else if (current === 'ENVIADO_FINANCEIRO') {
      // Abre confirmação explícita antes de executar finalizar_pagamento
      setItemToPay(item);
      setConfirmPaymentOpen(true);
      return;
    }

    if (acao !== '') {
      updatePipelineMutation.mutate({
        id: item.id,
        acao,
        // @ts-ignore (atualizado_em comes from the backend payload even if not fully typed in CustoExtraItem frontend schema)
        updatedAt: item.atualizado_em || new Date().toISOString()
      }, {
        onSuccess: () => {
          setSelectedItem(null);
        }
      });

      const competencia = item.data ? format(new Date(item.data), "yyyy-MM") : format(new Date(), "yyyy-MM");

      openPipeline(buildCustosExtrasPipeline({
        competencia,
        empresa: item.empresas?.nome || item.empresa_nome || "Empresa",
        currentStep: stepId,
      }));
    }
  };

  const handleConfirmPayment = () => {
    if (!itemToPay) return;
    updatePipelineMutation.mutate({
      id: itemToPay.id,
      acao: 'finalizar_pagamento',
      // @ts-ignore
      updatedAt: itemToPay.atualizado_em || new Date().toISOString()
    }, {
      onSuccess: () => {
        setConfirmPaymentOpen(false);
        setItemToPay(null);
        setSelectedItem(null);
      }
    });

    const competencia = itemToPay.data ? format(new Date(itemToPay.data), "yyyy-MM") : format(new Date(), "yyyy-MM");
    openPipeline(buildCustosExtrasPipeline({
      competencia,
      empresa: itemToPay.empresas?.nome || itemToPay.empresa_nome || "Empresa",
      currentStep: 'concluido',
    }));
  };

  const handleDevolvePipeline = (item: CustoExtraItem) => {
    const isEmValidacao = item.pipeline_status === 'EM_VALIDACAO';
    setJustificationModal({
      open: true,
      itemId: item.id,
      title: isEmValidacao ? "Devolver para correção" : "Devolver para Operação",
      description: isEmValidacao
        ? "Explique o motivo do retorno deste custo extra para correção pelo encarregado."
        : "Explique o motivo da devolução desta despesa para a equipe operacional.",
      // @ts-ignore
      targetStatus: item.atualizado_em || new Date().toISOString(),
    });
  };

  const confirmDevolve = (justification: string) => {
    if (justificationModal.itemId && justificationModal.targetStatus) {
      updatePipelineMutation.mutate({
        id: justificationModal.itemId,
        acao: 'devolver',
        updatedAt: justificationModal.targetStatus, // Estamos usando o targetStatus para carregar o updated_at no state do modal temporalmente
        justification
      }, {
        onSuccess: () => {
          setSelectedItem(null);
        }
      });
      setJustificationModal({ open: false, itemId: null, targetStatus: null, title: undefined, description: undefined });
    }
  };

  const canAdvance = (item: CustoExtraItem) => {
    if (isAdmin) return true;
    const status = item.pipeline_status || 'PENDENTE';

    if ((status === 'RECEBIDO' || status === 'PENDENTE') && (role === 'encarregado' || role === 'gestor')) return true;
    if (status === 'EM_VALIDACAO' && (role === 'gestor' || role === 'rh')) return true;
    if (status === 'APROVADO_OPERACAO' && (role === 'gestor' || role === 'rh' || role === 'financeiro')) return true;
    if (status === 'ENVIADO_FINANCEIRO' && role === 'financeiro') return true;

    return false;
  };

  const canDevolve = (item: CustoExtraItem) => {
    if (isAdmin) return true;
    const status = item.pipeline_status;
    if (!status || status === 'RECEBIDO' || status === 'FINALIZADO') return false;

    if (status === 'EM_VALIDACAO' && (role === 'gestor' || role === 'rh')) return true;
    if (status === 'APROVADO_OPERACAO' && (role === 'financeiro' || role === 'gestor' || role === 'rh')) return true;
    if (status === 'ENVIADO_FINANCEIRO' && role === 'financeiro') return true;

    return false;
  };


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
        const statusMatch = statusFilter === "all" || String(item.status_pagamento ?? "").toUpperCase().replace(/_/g, " ") === statusFilter.toUpperCase().replace(/_/g, " ");
        const pipelineStatusMatch = pipelineStatusFilter === "all" || (item.pipeline_status ?? "RECEBIDO") === pipelineStatusFilter;

        const pipelineMatch = pipelineFilter === "todos" || (() => {
          // Normalizamos para upper case na leitura
          const s = String(item.pipeline_status || "RECEBIDO").toUpperCase();
          if (pipelineFilter === "aprovacoes") return ["RECEBIDO", "PENDENTE", "EM_VALIDACAO"].includes(s);
          if (pipelineFilter === "pendentes") return ["RECEBIDO", "PENDENTE", "REPROVADO", "EM_ANALISE", "DEVOLVIDO"].includes(s);
          if (pipelineFilter === "validacao") return ["EM_VALIDACAO"].includes(s);
          if (pipelineFilter === "financeiro") return ["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(s);
          if (pipelineFilter === "concluidos") return ["FINALIZADO", "PAGO", "CONCLUIDO"].includes(s);
          return true;
        })();

        return searchMatch && categoryMatch && statusMatch && pipelineStatusMatch && pipelineMatch;
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
  }, [categoryFilter, data, filterText, sortConfig, statusFilter, pipelineFilter, pipelineStatusFilter]);

  const editableFilteredCount = filteredData.length;

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      CustoExtraOperacionalService.update(id, payload),
    onSuccess: () => {
      toast.success("Custo extra atualizado.");
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
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
      queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
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
      queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
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
      <DropdownMenuTrigger className="flex items-center justify-center gap-1.5 group w-full focus:outline-none">
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
    <div className="space-y-4 p-5 pt-2 min-w-0 overflow-hidden">
      <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center gap-2 min-w-max">
          <Input
            placeholder="Buscar por descrição, empresa ou categoria..."
            className="h-9 w-[280px] md:w-[320px] shrink-0"
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

          <Select value={pipelineStatusFilter} onValueChange={setPipelineStatusFilter}>
            <SelectTrigger className="h-9 w-[180px] shrink-0">
              <SelectValue placeholder="Status pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pipelines</SelectItem>
              <SelectItem value="RECEBIDO">Recebido</SelectItem>
              <SelectItem value="EM_VALIDACAO">Em Validação</SelectItem>
              <SelectItem value="APROVADO_OPERACAO">Aprovado Operação</SelectItem>
              <SelectItem value="ENVIADO_FINANCEIRO">Enviado Financeiro</SelectItem>
              <SelectItem value="FINALIZADO">Finalizado</SelectItem>
              <SelectItem value="REPROVADO">Reprovado</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-border">
            {[
              { id: "todos", label: "Todos" },
              { id: "aprovacoes", label: "Aprovações Pendentes" },
              { id: "pendentes", label: "Recebidos" },
              { id: "validacao", label: "Em Validação" },
              { id: "financeiro", label: "Financeiro" },
              { id: "concluidos", label: "Concluídos" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPipelineFilter(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight rounded-md transition-all",
                  pipelineFilter === tab.id
                    ? "shadow-sm border scale-[1.02] bg-white text-primary border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
              <tr className="text-center font-display text-muted-foreground uppercase text-xs tracking-wide">
                {visibleCols.data && <th style={getStickyProps("data", true).style} className={cn(getStickyProps("data", true).className, "text-center")}>{renderHeaderMenu("data", <span className="inline-flex items-center justify-center gap-1.5 w-full"><CalendarDays className="h-3.5 w-3.5" />DATA</span>)}</th>}
                {visibleCols.empresa && <th style={getStickyProps("empresa", true).style} className={cn(getStickyProps("empresa", true).className, "text-center")}>{renderHeaderMenu("empresa", "EMPRESA")}</th>}
                {visibleCols.unidade && <th className="px-3 py-2.5 font-semibold text-center">UNIDADE</th>}
                {visibleCols.categoria && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("categoria_custo", <span className="inline-flex items-center justify-center gap-1.5 w-full"><Tag className="h-3.5 w-3.5" />CATEGORIA</span>)}</th>}
                {visibleCols.descricao && <th style={getStickyProps("descricao", true).style} className={cn(getStickyProps("descricao", true).className, "text-center")}>{renderHeaderMenu("descricao", <span className="inline-flex items-center justify-center gap-1.5 w-full"><FileText className="h-3.5 w-3.5" />DESCRICAO</span>)}</th>}
                {visibleCols.valorUnitario && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("valor_unitario", "VAL. UNIT.")}</th>}
                {visibleCols.quantidade && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("quantidade", "QTD")}</th>}
                {visibleCols.total && <th className="px-3 py-2.5 font-semibold text-center">{renderHeaderMenu("total", <span className="inline-flex items-center justify-center gap-1.5 w-full"><BadgeDollarSign className="h-3.5 w-3.5" />TOTAL</span>)}</th>}
                {visibleCols.formaPagamento && <th className="px-3 py-2.5 font-semibold text-center">FORMA PAGAMENTO</th>}
                {visibleCols.vencimento && <th className="px-3 py-2.5 font-semibold text-center">VENCIMENTO</th>}
                {visibleCols.status && <th className="px-3 py-2.5 font-semibold text-center">STATUS PGTO</th>}
                {visibleCols.pipelineStatus && <th className="px-3 py-2.5 font-semibold text-center whitespace-nowrap"><PlayCircle className="h-3.5 w-3.5 inline mr-1" />PIPELINE</th>}
                {visibleCols.responsavel && <th className="px-3 py-2.5 font-semibold text-center whitespace-nowrap"><User className="h-3.5 w-3.5 inline mr-1" />ENCARREGADO</th>}
                {visibleCols.operacaoId && <th className="px-3 py-2.5 font-semibold text-center">OPERACAO ID</th>}
                {visibleCols.acoes && <th className="px-5 py-2.5 font-semibold text-center">ACOES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50",
                    getPipelineStatusConfig(item.pipeline_status).opacity
                  )}
                  onClick={() => setSelectedItem(item)}
                >
                  {visibleCols.data && <td style={getStickyProps("data", false).style} className={cn(getStickyProps("data", false).className, "text-center text-muted-foreground whitespace-nowrap")}>{formatDate(item.data)}</td>}
                  {visibleCols.empresa && <td style={getStickyProps("empresa", false).style} className={cn(getStickyProps("empresa", false).className, "text-center text-muted-foreground whitespace-nowrap")}>{item.empresas?.nome || item.empresa_nome || "—"}</td>}
                  {visibleCols.unidade && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.unidades?.nome || "—"}</td>}
                  {visibleCols.categoria && <td className="px-3 py-3 text-center"><Badge variant="outline">{item.categoria_custo}</Badge></td>}
                  {visibleCols.descricao && <td style={getStickyProps("descricao", false).style} className={cn(getStickyProps("descricao", false).className, "text-center text-foreground whitespace-nowrap")}>{item.descricao}</td>}
                  {visibleCols.valorUnitario && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.valor_unitario !== null && item.valor_unitario !== undefined ? currencyFormatter.format(Number(item.valor_unitario)) : "—"}</td>}
                  {visibleCols.quantidade && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap font-display font-medium">{item.quantidade !== null && item.quantidade !== undefined ? Number(item.quantidade).toLocaleString("pt-BR") : "—"}</td>}
                  {visibleCols.total && <td className="px-3 py-3 text-center text-foreground whitespace-nowrap font-display font-semibold">{item.total !== null && item.total !== undefined ? currencyFormatter.format(Number(item.total)) : "—"}</td>}
                  {visibleCols.formaPagamento && (
                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap text-xs">
                      {item.forma_pagamento_ref?.nome || item.forma_pagamento || '—'}
                    </td>
                  )}
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
                  {visibleCols.pipelineStatus && (
                    <td className="px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const cfg = getPipelineStatusConfig(item.pipeline_status);
                        return (
                          <Badge className={cn("border shadow-none font-medium uppercase h-6 px-2 text-[11px]", cfg.className)}>
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.responsavel && (
                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap text-xs">
                      {item.responsavel?.full_name || item.responsavel_nome || "—"}
                    </td>
                  )}
                  {visibleCols.operacaoId && <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.operacao_id || "—"}</td>}
                  {visibleCols.acoes && (
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedItem(item)}
                          title="Ver detalhes da despesa"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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
                  <td colSpan={14} className="p-12 text-center text-muted-foreground italic">
                    Nenhum custo extra atende aos filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div >

      <Sheet open={!!selectedItem} onOpenChange={(value) => !value && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto flex flex-col justify-between">
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="text-xl font-bold text-foreground">
                Detalhes do Custo Extra
              </SheetTitle>
              <SheetDescription>
                Informações operacionais e financeiras consolidadas deste lançamento.
              </SheetDescription>
            </SheetHeader>

            {selectedItem && (() => {
              const item = selectedItem;
              const pipelineCfg = getPipelineStatusConfig(item.pipeline_status);

              return (
                <div className="space-y-5">
                  {/* Status Badges */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/70">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Pipeline Operacional
                      </span>
                      <div>
                        <Badge className={cn("border shadow-none font-medium uppercase px-2.5 py-0.5 text-xs", pipelineCfg.className)}>
                          {pipelineCfg.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Status Financeiro
                      </span>
                      <div>
                        <Badge className={cn("border-0 font-medium px-2.5 py-0.5 text-xs", getStatusBadgeClass(item.status_pagamento))}>
                          {item.status_pagamento || "A PAGAR"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Value Card */}
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Valor Total da Despesa
                      </span>
                      <span className="text-2xl font-bold font-display text-foreground tracking-tight">
                        {currencyFormatter.format(Number(item.total ?? 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                      <span>
                        Qtd: <strong className="text-foreground font-medium">{Number(item.quantidade ?? 0).toLocaleString("pt-BR")}</strong> × Un: <strong className="text-foreground font-medium">{currencyFormatter.format(Number(item.valor_unitario ?? 0))}</strong>
                      </span>
                      <Badge variant="outline" className="text-[11px] font-medium uppercase">
                        {item.categoria_custo || "OPERACIONAL"}
                      </Badge>
                    </div>
                  </div>

                  {/* Grid de Dados Operacionais */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Data da Despesa</p>
                      <p className="font-medium text-foreground mt-0.5">{formatDate(item.data)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Empresa</p>
                      <p className="font-medium text-foreground mt-0.5">{item.empresas?.nome || item.empresa_nome || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Forma de Pagamento</p>
                      <p className="font-medium text-foreground mt-0.5">{item.forma_pagamento_ref?.nome || item.forma_pagamento || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Vencimento</p>
                      <p className="font-medium text-foreground mt-0.5">{formatDate(item.data_vencimento)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Responsável</p>
                      <p className="font-medium text-foreground mt-0.5">{item.responsavel?.full_name || item.responsavel_nome || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Operação Vinculada</p>
                      <p className="font-medium text-foreground mt-0.5">{item.operacao_id || "Não vinculada"}</p>
                    </div>
                  </div>

                  {/* Descrição / Observação */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Descrição / Observações</p>
                    <div className="p-3 rounded-lg bg-card border border-border/80 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {item.descricao || "Nenhuma descrição ou observação informada."}
                    </div>
                  </div>

                  {/* Alerta de Devolução Anterior se houver */}
                  {(item.justificativa_devolucao || (item as any).motivo_devolucao) && (
                    <div className="p-3.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 text-xs text-orange-900 dark:text-orange-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-orange-800 dark:text-orange-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                        <span>Motivo do Retorno / Devolução</span>
                      </div>
                      <p className="pl-5.5 text-xs text-orange-800/90 dark:text-orange-300/90">
                        {item.justificativa_devolucao || (item as any).motivo_devolucao}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Rodapé com Ações de Negócio Contextualizadas */}
          {selectedItem && (() => {
            const item = selectedItem;
            const currentStatus = item.pipeline_status || 'RECEBIDO';
            const isFinalizado = currentStatus === 'FINALIZADO' || currentStatus === 'CONCLUIDO';

            return (
              <SheetFooter className="mt-8 pt-4 border-t border-border flex-col gap-2.5 sm:flex-col sm:space-x-0">
                {isFinalizado ? (
                  <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Despesa liquidada e finalizada no pipeline financeiro.</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
                    {/* Botão de Devolução */}
                    {canDevolve(item) && currentStatus !== 'RECEBIDO' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                        onClick={() => handleDevolvePipeline(item)}
                        disabled={updatePipelineMutation.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        {currentStatus === 'EM_VALIDACAO' ? 'Devolver para correção' : 'Devolver para Operação'}
                      </Button>
                    ) : (
                      <div />
                    )}

                    {/* Botões da Direita: Editar e Avanço */}
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          openEditor(item);
                          setSelectedItem(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Button>

                      {currentStatus === 'RECEBIDO' && (
                        <Button
                          size="sm"
                          className="font-medium"
                          onClick={() => handleAdvancePipeline(item)}
                          disabled={!canAdvance(item) || updatePipelineMutation.isPending}
                        >
                          {updatePipelineMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Encaminhar para Validação
                        </Button>
                      )}

                      {currentStatus === 'EM_VALIDACAO' && (
                        <Button
                          size="sm"
                          className="font-medium"
                          onClick={() => handleAdvancePipeline(item)}
                          disabled={!canAdvance(item) || updatePipelineMutation.isPending}
                        >
                          {updatePipelineMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Aprovar Despesa
                        </Button>
                      )}

                      {currentStatus === 'APROVADO_OPERACAO' && (
                        <Button
                          size="sm"
                          className="font-medium"
                          onClick={() => handleAdvancePipeline(item)}
                          disabled={!canAdvance(item) || updatePipelineMutation.isPending}
                        >
                          {updatePipelineMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Liberar para o Financeiro
                        </Button>
                      )}

                      {currentStatus === 'ENVIADO_FINANCEIRO' && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                          onClick={() => handleAdvancePipeline(item)}
                          disabled={!canAdvance(item) || updatePipelineMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Registrar Pagamento
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </SheetFooter>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmPaymentOpen} onOpenChange={setConfirmPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar Liquidação de Pagamento
            </DialogTitle>
            <DialogDescription>
              Confirme a liquidação financeira desta despesa operacional. O status do pipeline será concluído como FINALIZADO e o status de pagamento será alterado para PAGO.
            </DialogDescription>
          </DialogHeader>

          {itemToPay && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 space-y-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Valor a Liquidar</span>
                  <span className="text-xl font-bold font-display text-emerald-600">
                    {currencyFormatter.format(Number(itemToPay.total ?? 0))}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex justify-between">
                    <span>Empresa:</span>
                    <span className="font-medium text-foreground">{itemToPay.empresas?.nome || itemToPay.empresa_nome || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Categoria:</span>
                    <span className="font-medium text-foreground">{itemToPay.categoria_custo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Forma de Pagamento:</span>
                    <span className="font-medium text-foreground">{itemToPay.forma_pagamento_ref?.nome || itemToPay.forma_pagamento || "—"}</span>
                  </div>
                  {itemToPay.data_vencimento && (
                    <div className="flex justify-between">
                      <span>Vencimento:</span>
                      <span className="font-medium text-foreground">{formatDate(itemToPay.data_vencimento)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmPaymentOpen(false);
                setItemToPay(null);
              }}
              disabled={updatePipelineMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={handleConfirmPayment}
              disabled={updatePipelineMutation.isPending}
            >
              {updatePipelineMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Liquidando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <JustificationModal
        isOpen={justificationModal.open}
        title={justificationModal.title || "Justificativa de Devolução"}
        description={justificationModal.description || "Explique o motivo do retorno deste custo extra para a etapa anterior."}
        onConfirm={confirmDevolve}
        onClose={() => setJustificationModal({ open: false, itemId: null, targetStatus: null, title: undefined, description: undefined })}
        isLoading={updatePipelineMutation.isPending}
      />
    </div >
  );
}
