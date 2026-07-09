import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HistoricoImportacaoService } from "@/services/base.service";
import { getOperationalStatus } from "@/constants/operationalStatus";
import { cn } from "@/lib/utils";
import {
    Calendar,
    Filter,
    Search,
    MoreVertical,
    Eye,
    AlertCircle,
    RotateCcw,
    Download,
    FileText,
    Clock,
    ChevronDown,
    Building2,
    Database,
    History,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ImportacaoDetailsDrawer } from "./ImportacaoDetailsDrawer";
import { ReprocessModal } from "./ReprocessModal";
import { Checkbox } from "@/components/ui/checkbox";

interface ImportacoesTimelineProps {
    empresaId?: string;
}

export const ImportacoesTimeline: React.FC<ImportacoesTimelineProps> = ({ empresaId }) => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [origemFilter, setOrigemFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedImport, setSelectedImport] = useState<any>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [reprocessModalOpen, setReprocessModalOpen] = useState(false);
    const [importToReprocess, setImportToReprocess] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { data: importacoes = [], isLoading } = useQuery({
        queryKey: ["historico_importacoes", empresaId, statusFilter, origemFilter, startDate, endDate],
        queryFn: () => HistoricoImportacaoService.getRecent({
            empresaId,
            status: statusFilter,
            origem: origemFilter,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            limit: 50
        }),
    });

    const reprocessMutation = useMutation({
        mutationFn: (vars: { id: string, motivo: string }) =>
            HistoricoImportacaoService.reprocess(vars.id, vars.motivo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["historico_importacoes"] });
            queryClient.invalidateQueries({ queryKey: ["registros_ponto"] });
            toast.success("Reprocessamento iniciado com sucesso.");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // Unlink points from this history before deleting to bypass foreign key constraint
            await HistoricoImportacaoService.supabase
                .from('registros_ponto')
                .update({ importacao_id: null })
                .eq('importacao_id', id);

            await HistoricoImportacaoService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["historico_importacoes"] });
            toast.success("Histórico excluído com sucesso.");
        },
        onError: (err: any) => {
            toast.error("Erro ao excluir histórico: " + (err.message || 'Sem permissão'));
        }
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            // Unlink points before deleting
            await HistoricoImportacaoService.supabase
                .from('registros_ponto')
                .update({ importacao_id: null })
                .in('importacao_id', ids);

            await Promise.all(ids.map(id => HistoricoImportacaoService.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["historico_importacoes"] });
            setSelectedIds([]);
            toast.success(`${selectedIds.length > 1 ? `${selectedIds.length} históricos excluídos` : '1 histórico excluído'} com sucesso.`);
        },
        onError: (err: any) => {
            toast.error("Erro ao excluir alguns itens: " + (err.message || 'Sem permissão'));
        }
    });

    const filtered = importacoes.filter((i: any) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (i.nome_arquivo || "").toLowerCase().includes(term) ||
            (i.empresas?.nome || "").toLowerCase().includes(term);
    });

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length && filtered.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map((i: any) => i.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(prev => prev !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Importações Recentes
                    </h2>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                </div>

                {isExpanded && (
                    <div className="flex flex-wrap items-center gap-2">
                        {selectedIds.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-9 font-display font-medium"
                                onClick={() => {
                                    if (confirm(`Tem certeza que deseja excluir ${selectedIds.length} históricos selecionados?`)) {
                                        bulkDeleteMutation.mutate(selectedIds);
                                    }
                                }}
                                disabled={bulkDeleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Selecionados ({selectedIds.length})
                            </Button>
                        )}
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar arquivo ou empresa..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                className="h-9 w-36 px-2 text-xs"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-muted-foreground text-xs">até</span>
                            <Input
                                type="date"
                                className="h-9 w-36 px-2 text-xs"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[130px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Status</SelectItem>
                                <SelectItem value="RECEBIDO">Recebido</SelectItem>
                                <SelectItem value="VALIDANDO">Validando</SelectItem>
                                <SelectItem value="INCONSISTENTE">Inconsistente</SelectItem>
                                <SelectItem value="PENDENTE_PROCESSAMENTO">Pendente RH</SelectItem>
                                <SelectItem value="PROCESSADO">Processado</SelectItem>
                                <SelectItem value="ERRO">Erro</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={origemFilter} onValueChange={setOrigemFilter}>
                            <SelectTrigger className="h-9 w-[130px]">
                                <SelectValue placeholder="Origem" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas Origens</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="google_drive">Google Drive</SelectItem>
                                <SelectItem value="rhid_api">RHiD API</SelectItem>
                                <SelectItem value="api">API</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="esc-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium w-12 text-center">
                                        <Checkbox
                                            checked={selectedIds.length === filtered.length && filtered.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Selecionar todos"
                                        />
                                    </th>
                                    <th className="px-2 h-11 font-medium">Data/Hora</th>
                                    <th className="px-3 h-11 font-medium">Empresa/Unidade</th>
                                    <th className="px-3 h-11 font-medium">Arquivo</th>
                                    <th className="px-3 h-11 font-medium text-center">Registros</th>
                                    <th className="px-3 h-11 font-medium text-center">Falhas</th>
                                    <th className="px-3 h-11 font-medium">Origem</th>
                                    <th className="px-3 h-11 font-medium text-center">Duração</th>
                                    <th className="px-3 h-11 font-medium">Status</th>
                                    <th className="px-5 h-11 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, idx) => (
                                        <tr key={idx} className="animate-pulse">
                                            <td colSpan={10} className="h-12 px-5 bg-muted/20" />
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-12 text-center text-muted-foreground italic">
                                            Nenhuma importação encontrada.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((item: any) => {
                                        const status = getOperationalStatus(item.status);
                                        const duracao = item.duracao_ms
                                            ? `${(item.duracao_ms / 1000).toFixed(1)}s`
                                            : "—";

                                        return (
                                            <tr key={item.id} className={cn("group transition-colors", selectedIds.includes(item.id) ? "bg-muted/50" : "hover:bg-muted/30")}>
                                                <td className="px-5 py-4 text-center">
                                                    <Checkbox
                                                        checked={selectedIds.includes(item.id)}
                                                        onCheckedChange={() => toggleSelect(item.id)}
                                                        aria-label="Selecionar linha"
                                                    />
                                                </td>
                                                <td className="px-2 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{format(new Date(item.created_at), "dd/MM/yyyy")}</span>
                                                        <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), "HH:mm")}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium truncate max-w-[150px]">{item.empresas?.nome || "Todas as empresas"}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{item.unidades_operacionais?.nome || "Geral"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 max-w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex flex-col truncate">
                                                            <span className="font-medium truncate">{item.nome_arquivo}</span>
                                                            <span className="text-xs text-muted-foreground uppercase">{item.tipo_arquivo || "EXCEL"}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-center font-display font-medium">
                                                    {item.quantidade_registros}
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    {item.quantidade_inconsistencias > 0 ? (
                                                        <Badge variant="destructive" className="font-display font-bold">
                                                            {item.quantidade_inconsistencias}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 capitalize text-muted-foreground">
                                                    {item.origem === 'rhid_api'
                                                        ? 'RHiD API'
                                                        : item.origem.replace(/_/g, " ")}
                                                </td>
                                                <td className="px-3 py-4 text-center text-muted-foreground">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Clock className="h-3 w-3" />
                                                        {duracao}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <Badge className={cn("font-semibold", status.bg, status.color)} variant="outline">
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setSelectedImport(item); setDetailsOpen(true); }}>
                                                                <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                                                            </DropdownMenuItem>
                                                            {item.quantidade_inconsistencias > 0 && (
                                                                <DropdownMenuItem className="text-destructive">
                                                                    <AlertCircle className="mr-2 h-4 w-4" /> Ver inconsistências
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => {
                                                                setImportToReprocess(item);
                                                                setReprocessModalOpen(true);
                                                            }}>
                                                                <RotateCcw className="mr-2 h-4 w-4" /> Reprocessar
                                                            </DropdownMenuItem>
                                                            {item.drive_file_id && (
                                                                <DropdownMenuItem>
                                                                    <Download className="mr-2 h-4 w-4" /> Baixar original
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                className="text-destructive font-medium focus:bg-destructive/10 cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm("Tem certeza que deseja excluir esse log do histórico? Os pontos vinculados não serão apagados. Apenas a linha do histórico irá sumir.")) {
                                                                        deleteMutation.mutate(item.id);
                                                                    }
                                                                }}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> Excluir histórico
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ImportacaoDetailsDrawer
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                importacao={selectedImport}
            />

            <ReprocessModal
                open={reprocessModalOpen}
                onOpenChange={setReprocessModalOpen}
                importacao={importToReprocess}
                onConfirm={async (motivo) => {
                    await reprocessMutation.mutateAsync({ id: importToReprocess.id, motivo });
                }}
            />
        </div>
    );
};
