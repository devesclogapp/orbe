import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowDownAZ,
    ArrowUpZA,
    BadgeDollarSign,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    Loader2,
    Pencil,
    PlayCircle,
    RotateCcw,
    Tag,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
    useOperationalPipeline,
    buildServicosExtrasPipeline,
    buildServicosExtrasDevolvidoPipeline,
    type ServicoExtraStepId,
} from "@/contexts/OperationalPipelineContext";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { useAccessControl } from "@/contexts/AccessControlContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
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
import { ServicosExtrasOperacionaisService } from "@/services/base.service";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PipelineStatus =
    | "PENDENTE"
    | "EM_VALIDACAO"
    | "APROVADO_OPERACAO"
    | "APROVADO_FINANCEIRO"
    | "FATURADO"
    | "CONCLUIDO"
    | "DEVOLVIDO";

type ServicoExtraItem = {
    id: string;
    data?: string | null;
    empresa_id?: string | null;
    empresa_nome?: string | null;
    empresas?: { nome?: string | null } | null;
    cliente?: string | null;
    tipo_servico: string;
    descricao_servico: string;
    quantidade?: number | null;
    valor_unitario?: number | null;
    total?: number | null;
    forma_pagamento?: string | null;
    modalidade_financeira?: string | null;
    data_vencimento?: string | null;
    status_pagamento?: string | null;
    pipeline_status?: PipelineStatus | null;
    justificativa_devolucao?: string | null;
    nf_numero?: string | null;
    responsavel_nome?: string | null;
    observacao?: string | null;
    operacao_id?: string | null;
    origem_dado?: string | null;
};

type ServicosExtrasTableBlockProps = {
    data: ServicoExtraItem[];
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIPO_SERVICO_OPTIONS = [
    "LAVAGEM",
    "PALETIZACAO",
    "SEPARACAO",
    "ETIQUETAGEM",
    "ARMAZENAMENTO",
    "MOVIMENTACAO",
    "CARGA_EXTRA",
    "DESCARGA_EXTRA",
    "OUTRO",
] as const;

const STATUS_OPTIONS = ["PENDENTE", "ATRASADO", "RECEBIDO"] as const;

const PIPELINE_STATUS_OPTIONS: PipelineStatus[] = [
    "PENDENTE",
    "EM_VALIDACAO",
    "APROVADO_OPERACAO",
    "APROVADO_FINANCEIRO",
    "FATURADO",
    "CONCLUIDO",
    "DEVOLVIDO",
];

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

// Map pipeline_status → ServicoExtraStepId
const pipelineStatusToStepId = (status: PipelineStatus | null | undefined): ServicoExtraStepId => {
    switch (status) {
        case "EM_VALIDACAO":
            return "validacao_operacional";
        case "APROVADO_OPERACAO":
            return "aprovacao";
        case "APROVADO_FINANCEIRO":
            return "financeiro";
        case "FATURADO":
            return "faturamento";
        case "CONCLUIDO":
            return "concluido";
        default:
            return "lancamento";
    }
};

// Next status transition
const getNextStatus = (current: PipelineStatus | null | undefined): PipelineStatus | null => {
    switch (current ?? "PENDENTE") {
        case "PENDENTE":
            return "EM_VALIDACAO";
        case "EM_VALIDACAO":
            return "APROVADO_OPERACAO";
        case "APROVADO_OPERACAO":
            return "APROVADO_FINANCEIRO";
        case "APROVADO_FINANCEIRO":
            return "FATURADO";
        case "FATURADO":
            return "CONCLUIDO";
        default:
            return null;
    }
};

const getPipelineBadgeClass = (status?: PipelineStatus | null) => {
    switch (status) {
        case "EM_VALIDACAO":
            return "bg-amber-100 text-amber-700";
        case "APROVADO_OPERACAO":
            return "bg-sky-100 text-sky-700";
        case "APROVADO_FINANCEIRO":
            return "bg-blue-100 text-blue-700";
        case "FATURADO":
            return "bg-purple-100 text-purple-700";
        case "CONCLUIDO":
            return "bg-emerald-500 text-white";
        case "DEVOLVIDO":
            return "bg-orange-100 text-orange-700";
        default:
            return "bg-muted text-muted-foreground";
    }
};

const getStatusBadgeClass = (status?: string | null) => {
    switch (String(status ?? "").toUpperCase()) {
        case "RECEBIDO":
            return "bg-emerald-100 text-emerald-700";
        case "ATRASADO":
            return "bg-amber-100 text-amber-700";
        default:
            return "bg-muted text-muted-foreground";
    }
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function ServicosExtrasTableBlock({ data }: ServicosExtrasTableBlockProps) {
    const queryClient = useQueryClient();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [filterText, setFilterText] = useState("");
    const [tipoFilter, setTipoFilter] = useState("all");
    const [pipelineFilter, setPipelineFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    const [editingItem, setEditingItem] = useState<ServicoExtraItem | null>(null);
    const [editDescricao, setEditDescricao] = useState("");
    const [editObservacao, setEditObservacao] = useState("");

    const { role, isAdmin } = useAccessControl();
    const { openPipeline } = useOperationalPipeline();

    const [justificationModal, setJustificationModal] = useState<{
        open: boolean;
        itemId: string | null;
    }>({ open: false, itemId: null });

    const scrollBy = useCallback((dir: "left" | "right") => {
        tableScrollRef.current?.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
    }, []);

    // ─── Permissions ─────────────────────────────────────────────────────────────

    const canAdvance = (item: ServicoExtraItem) => {
        if (isAdmin) return true;
        const s = item.pipeline_status ?? "PENDENTE";
        if (s === "PENDENTE" && (role === "encarregado" || role === "gestor")) return true;
        if (s === "EM_VALIDACAO" && role === "gestor") return true;
        if (s === "APROVADO_OPERACAO" && (role === "gestor" || role === "admin")) return true;
        if ((s === "APROVADO_FINANCEIRO" || s === "FATURADO") && role === "financeiro") return true;
        return false;
    };

    const canDevolve = (item: ServicoExtraItem) => {
        if (isAdmin) return true;
        const s = item.pipeline_status;
        if (!s || s === "PENDENTE" || s === "CONCLUIDO") return false;
        if (s === "EM_VALIDACAO" && role === "gestor") return true;
        if (s === "APROVADO_OPERACAO" && (role === "gestor" || role === "financeiro")) return true;
        if ((s === "APROVADO_FINANCEIRO" || s === "FATURADO") && role === "financeiro") return true;
        return false;
    };

    // ─── Mutations ───────────────────────────────────────────────────────────────

    const updatePipelineMutation = useMutation({
        mutationFn: async ({ id, status, justification }: { id: string; status: string; justification?: string }) =>
            ServicosExtrasOperacionaisService.update(id, {
                pipeline_status: status as any,
                ...(justification ? { justificativa_devolucao: justification } : {}),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            toast.success("Pipeline atualizado com sucesso.");
        },
        onError: () => toast.error("Erro ao atualizar pipeline."),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            ServicosExtrasOperacionaisService.update(id, { status_pagamento: status as any }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            toast.success("Status de pagamento atualizado.");
        },
        onError: () => toast.error("Erro ao atualizar status."),
    });

    const updateDetailsMutation = useMutation({
        mutationFn: ({ id, descricao_servico, observacao }: { id: string; descricao_servico: string; observacao: string }) =>
            ServicosExtrasOperacionaisService.update(id, { descricao_servico, observacao } as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            setEditingItem(null);
            toast.success("Serviço extra atualizado.");
        },
        onError: () => toast.error("Erro ao salvar edição."),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => ServicosExtrasOperacionaisService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            toast.success("Serviço extra removido.");
        },
        onError: () => toast.error("Erro ao remover serviço extra."),
    });

    // ─── Pipeline Handlers ────────────────────────────────────────────────────────

    const handleAdvance = (item: ServicoExtraItem) => {
        const next = getNextStatus(item.pipeline_status);
        if (!next) return;

        updatePipelineMutation.mutate({ id: item.id, status: next });

        const nextStepId = pipelineStatusToStepId(next);
        const competencia = item.data ? format(new Date(item.data), "yyyy-MM") : format(new Date(), "yyyy-MM");

        openPipeline(
            buildServicosExtrasPipeline({
                competencia,
                empresa: item.empresas?.nome ?? item.empresa_nome ?? "Empresa",
                currentStep: nextStepId,
            })
        );
    };

    const handleDevolve = (item: ServicoExtraItem) => {
        setJustificationModal({ open: true, itemId: item.id });
    };

    const confirmDevolve = (justification: string) => {
        if (!justificationModal.itemId) return;
        const item = data.find((d) => d.id === justificationModal.itemId);

        updatePipelineMutation.mutate({
            id: justificationModal.itemId,
            status: "DEVOLVIDO",
            justification,
        });

        if (item) {
            const competencia = item.data ? format(new Date(item.data), "yyyy-MM") : format(new Date(), "yyyy-MM");
            openPipeline(
                buildServicosExtrasDevolvidoPipeline({
                    competencia,
                    empresa: item.empresas?.nome ?? item.empresa_nome ?? "Empresa",
                    motivo: justification,
                    stage: pipelineStatusToStepId(item.pipeline_status),
                })
            );
        }

        setJustificationModal({ open: false, itemId: null });
    };

    // ─── Filter + Sort ────────────────────────────────────────────────────────────

    const filteredData = useMemo(() => {
        return [...data]
            .filter((item) => {
                const empresa = item.empresas?.nome ?? item.empresa_nome ?? "";
                const search = filterText.toLowerCase();
                const searchMatch =
                    (item.descricao_servico ?? '').toLowerCase().includes(search) ||
                    empresa.toLowerCase().includes(search) ||
                    (item.cliente ?? "").toLowerCase().includes(search) ||
                    item.tipo_servico.toLowerCase().includes(search);
                const tipoMatch = tipoFilter === "all" || item.tipo_servico === tipoFilter;
                const pipelineMatch = pipelineFilter === "all" || (item.pipeline_status ?? "PENDENTE") === pipelineFilter;
                return searchMatch && tipoMatch && pipelineMatch;
            })
            .sort((a, b) => {
                if (!sortConfig) return 0;
                const key = sortConfig.key as keyof ServicoExtraItem;
                const valA = a[key] ?? "";
                const valB = b[key] ?? "";
                if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
                if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
    }, [data, filterText, tipoFilter, pipelineFilter, sortConfig]);

    const renderSortHeader = (key: string, label: string) => (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 group focus:outline-none">
                {label}
                <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => setSortConfig({ key, direction: "asc" })}>
                    <ArrowUpZA className="mr-2 h-3.5 w-3.5" /> Crescente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortConfig({ key, direction: "desc" })}>
                    <ArrowDownAZ className="mr-2 h-3.5 w-3.5" /> Decrescente
                </DropdownMenuItem>
                {sortConfig?.key === key && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSortConfig(null)}>Limpar ordenação</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    // ─── Render ───────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4 p-5 pt-2">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <Input
                    placeholder="Buscar por descrição, empresa, cliente ou tipo..."
                    className="h-9 w-[320px]"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />

                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger className="h-9 w-[200px]">
                        <SelectValue placeholder="Tipo de Serviço" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {TIPO_SERVICO_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
                    <SelectTrigger className="h-9 w-[200px]">
                        <SelectValue placeholder="Status Pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os pipelines</SelectItem>
                        {PIPELINE_STATUS_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="relative">
                <button
                    onClick={() => scrollBy("left")}
                    className="absolute left-0 top-1/2 z-20 hidden h-9 w-9 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary/70 shadow-md transition-all hover:scale-110 hover:bg-primary/15 xl:flex"
                    type="button"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={() => scrollBy("right")}
                    className="absolute right-0 top-1/2 z-20 hidden h-9 w-9 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary/70 shadow-md transition-all hover:scale-110 hover:bg-primary/15 xl:flex"
                    type="button"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>

                <div ref={tableScrollRef} className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-background pb-[1px]">
                    <table className="w-full text-sm min-w-max">
                        <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-20">
                            <tr className="text-center font-display text-muted-foreground uppercase text-xs tracking-wide">
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    {renderSortHeader("data", "DATA")}
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />EMPRESA</span>
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />TIPO</span>
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />DESCRIÇÃO</span>
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">QTD</th>
                                <th className="px-3 py-2.5 font-semibold text-center">VLR. UNIT.</th>
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    <span className="inline-flex items-center gap-1"><BadgeDollarSign className="h-3.5 w-3.5" />TOTAL</span>
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">MODALIDADE</th>
                                <th className="px-3 py-2.5 font-semibold text-center">STATUS PGTO</th>
                                <th className="px-3 py-2.5 font-semibold text-center whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />PIPELINE</span>
                                </th>
                                <th className="px-5 py-2.5 font-semibold text-center">AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item) => (
                                <tr
                                    key={item.id}
                                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                                >
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{formatDate(item.data)}</td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.empresas?.nome ?? item.empresa_nome ?? "—"}</td>
                                    <td className="px-3 py-3 text-center">
                                        <Badge variant="outline">{item.tipo_servico}</Badge>
                                    </td>
                                    <td className="px-3 py-3 text-center text-foreground max-w-[260px] truncate">{item.descricao_servico}</td>
                                    <td className="px-3 py-3 text-center text-muted-foreground">{item.quantidade !== null && item.quantidade !== undefined ? Number(item.quantidade).toLocaleString("pt-BR") : "—"}</td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">{item.valor_unitario !== null && item.valor_unitario !== undefined ? currencyFormatter.format(Number(item.valor_unitario)) : "—"}</td>
                                    <td className="px-3 py-3 text-center font-display font-semibold whitespace-nowrap">{item.total !== null && item.total !== undefined ? currencyFormatter.format(Number(item.total)) : "—"}</td>
                                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap text-xs">
                                        {item.modalidade_financeira?.replace(/_/g, " ") ?? "—"}
                                    </td>
                                    <td className="px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild disabled={updateStatusMutation.isPending}>
                                                <button type="button" className="inline-flex">
                                                    <Badge className={cn("border-0 font-medium", getStatusBadgeClass(item.status_pagamento))}>
                                                        {item.status_pagamento ?? "PENDENTE"}
                                                    </Badge>
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center">
                                                <DropdownMenuLabel>Status Pagamento</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {STATUS_OPTIONS.map((s) => (
                                                    <DropdownMenuItem key={s} onClick={() => updateStatusMutation.mutate({ id: item.id, status: s })}>
                                                        {s}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                    <td className="px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <Badge className={cn("border-0 font-medium capitalize h-6 px-2 text-[11px]", getPipelineBadgeClass(item.pipeline_status))}>
                                            {(item.pipeline_status ?? "PENDENTE").toLowerCase().replace(/_/g, " ")}
                                        </Badge>
                                    </td>
                                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            {item.pipeline_status !== "CONCLUIDO" && canAdvance(item) && (
                                                <button
                                                    className="h-7 w-7 rounded-md hover:bg-emerald-50 flex items-center justify-center text-emerald-600 hover:text-emerald-700"
                                                    onClick={() => handleAdvance(item)}
                                                    title="Avançar Pipeline"
                                                    disabled={updatePipelineMutation.isPending}
                                                >
                                                    {updatePipelineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                                                </button>
                                            )}
                                            {item.pipeline_status && item.pipeline_status !== "PENDENTE" && item.pipeline_status !== "CONCLUIDO" && canDevolve(item) && (
                                                <button
                                                    className="h-7 w-7 rounded-md hover:bg-orange-50 flex items-center justify-center text-orange-600 hover:text-orange-700"
                                                    onClick={() => handleDevolve(item)}
                                                    title="Devolver etapa"
                                                    disabled={updatePipelineMutation.isPending}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </button>
                                            )}
                                            <button
                                                className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setEditDescricao(item.descricao_servico ?? "");
                                                    setEditObservacao(item.observacao ?? "");
                                                }}
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {(isAdmin || item.pipeline_status === "PENDENTE") && (
                                                <button
                                                    className="h-7 w-7 rounded-md hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteMutation.mutate(item.id)}
                                                    title="Remover"
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="p-12 text-center text-muted-foreground italic">
                                        Nenhum serviço extra encontrado para os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Sheet */}
            <Sheet open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <SheetContent side="right" className="w-[420px]">
                    <SheetHeader>
                        <SheetTitle>Editar Serviço Extra</SheetTitle>
                        <SheetDescription>Edite a descrição e observação do registro.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label>Descrição</Label>
                            <Textarea
                                rows={4}
                                value={editDescricao}
                                onChange={(e) => setEditDescricao(e.target.value)}
                                placeholder="Descrição do serviço..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Observação</Label>
                            <Textarea
                                rows={3}
                                value={editObservacao}
                                onChange={(e) => setEditObservacao(e.target.value)}
                                placeholder="Observações adicionais..."
                            />
                        </div>
                        <Button
                            className="w-full"
                            disabled={updateDetailsMutation.isPending}
                            onClick={() => {
                                if (!editingItem) return;
                                updateDetailsMutation.mutate({
                                    id: editingItem.id,
                                    descricao_servico: editDescricao,
                                    observacao: editObservacao,
                                });
                            }}
                        >
                            {updateDetailsMutation.isPending ? "Salvando..." : "Salvar alterações"}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Justification Modal */}
            <JustificationModal
                isOpen={justificationModal.open}
                onClose={() => setJustificationModal({ open: false, itemId: null })}
                onConfirm={confirmDevolve}
                title="Justificar Devolução"
                description="Informe o motivo da devolução do serviço extra para revisão."
            />
        </div>
    );
}
