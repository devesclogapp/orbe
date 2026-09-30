import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    Plus,
    RefreshCw,
    Loader2,
    Trash2,
    Pencil,
    ShieldAlert,
    History,
    Scale,
    Info,
    Users,
    Search,
} from "lucide-react";
import { BHRegraService } from "@/services/v4.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/painel/StatusChip";
import { Badge } from "@/components/ui/badge";

function parseNumericWithDefault(value: any, defaultValue: number): number {
    if (value === "" || value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

function subtrairUmDia(dataIso: string): string {
    const d = new Date(dataIso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

export const RegrasBancoHorasSection: React.FC = () => {
    const queryClient = useQueryClient();
    const { role, isAdmin } = useAccessControl();
    const isEncarregado = role === "encarregado";
    const canManageRules = isAdmin || role === "rh" || role === "admin";

    const [open, setOpen] = useState(false);
    const [editingRegra, setEditingRegra] = useState<any | null>(null);

    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["bh_regras"],
        queryFn: () => BHRegraService.getWithEmpresa(),
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // Estado do escopo na UX: 'todas' | 'especificas'
    const [aplicacaoRegra, setAplicacaoRegra] = useState<"todas" | "especificas">("todas");
    const [selectedEmpresasIds, setSelectedEmpresasIds] = useState<string[]>([]);
    const [empresaSearch, setEmpresaSearch] = useState<string>("");

    const [form, setForm] = useState({
        nome: "",
        prazo_compensacao_dias: "60",
        tipo: "acumula" as "acumula" | "zera" | "expira",
        status: "ativo" as "ativo" | "inativo",
        tolerancia_atraso: "5",
        tolerancia_hora_extra: "0",
        limite_diario_banco: "480",
        regra_compensacao: "automatico",
        bh_ativo: true,
        vigencia_inicio: new Date().toISOString().slice(0, 10),
        vigencia_fim: "",
        adicional_hora_extra_percentual: "50",
        // Campos legados mantidos silenciosamente para integridade do schema
        carga_horaria_diaria: "8.00",
        jornada_contratada: "8.00",
        validade_horas: "60",
        regra_vencimento: "acumula",
        origem_ponto: "manual",
    });

    const reset = () => {
        setForm({
            nome: "",
            prazo_compensacao_dias: "60",
            tipo: "acumula",
            status: "ativo",
            tolerancia_atraso: "5",
            tolerancia_hora_extra: "0",
            limite_diario_banco: "480",
            regra_compensacao: "automatico",
            bh_ativo: true,
            vigencia_inicio: new Date().toISOString().slice(0, 10),
            vigencia_fim: "",
            adicional_hora_extra_percentual: "50",
            carga_horaria_diaria: "8.00",
            jornada_contratada: "8.00",
            validade_horas: "60",
            regra_vencimento: "acumula",
            origem_ponto: "manual",
        });
        setAplicacaoRegra("todas");
        setSelectedEmpresasIds([]);
        setEmpresaSearch("");
    };

    const filteredEmpresas = useMemo(() => {
        if (!empresaSearch.trim()) return empresas;
        const q = empresaSearch.toLowerCase();
        return empresas.filter((e) => e.nome.toLowerCase().includes(q));
    }, [empresas, empresaSearch]);

    const handleSelectAllCurrent = () => {
        setSelectedEmpresasIds(empresas.map((e) => e.id));
    };

    const handleClearSelection = () => {
        setSelectedEmpresasIds([]);
    };

    const toggleEmpresa = (id: string, checked: boolean) => {
        setSelectedEmpresasIds((prev) =>
            checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id)
        );
    };

    const createMutation = useMutation({
        mutationFn: (payload: any) => BHRegraService.create(payload),
        onSuccess: () => {
            toast.success("Regra criada com sucesso");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao criar regra", { description: err.message })
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: any }) => BHRegraService.update(id, payload),
        onSuccess: () => {
            toast.success("Regra atualizada com sucesso");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            setEditingRegra(null);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao atualizar regra", { description: err.message })
    });

    const novaVigenciaMutation = useMutation({
        mutationFn: async ({ anteriorId, novaDataInicio, novoPayload }: { anteriorId: string; novaDataInicio: string; novoPayload: any }) => {
            const diaAnterior = subtrairUmDia(novaDataInicio);
            await BHRegraService.update(anteriorId, { vigencia_fim: diaAnterior });
            return await BHRegraService.create({
                ...novoPayload,
                vigencia_inicio: novaDataInicio,
            });
        },
        onSuccess: (_, variables) => {
            const diaAnterior = subtrairUmDia(variables.novaDataInicio);
            toast.success(`Nova vigência criada! Regra anterior finalizada em ${diaAnterior}.`);
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
            setOpen(false);
            setEditingRegra(null);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao criar nova vigência", { description: err.message })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => BHRegraService.delete(id),
        onSuccess: () => {
            toast.success("Regra removida");
            queryClient.invalidateQueries({ queryKey: ["bh_regras"] });
        },
        onError: (err: any) => toast.error("Não foi possível excluir a regra", { description: err.message })
    });

    const getPayload = () => {
        let escopo: "TODAS_EMPRESAS" | "COMPARTILHADA" | "ESPECIFICA";
        let empresa_id: string | null = null;
        let empresas_ids: string[] = [];

        if (aplicacaoRegra === "todas") {
            escopo = "TODAS_EMPRESAS";
            empresa_id = null;
            empresas_ids = [];
        } else if (selectedEmpresasIds.length === 1) {
            escopo = "ESPECIFICA";
            empresa_id = selectedEmpresasIds[0];
            empresas_ids = [selectedEmpresasIds[0]];
        } else {
            escopo = "COMPARTILHADA";
            empresa_id = null;
            empresas_ids = selectedEmpresasIds;
        }

        return {
            nome: form.nome,
            escopo,
            empresa_id,
            empresas_ids,
            prazo_compensacao_dias: parseNumericWithDefault(form.prazo_compensacao_dias, 60),
            tipo: form.tipo,
            status: form.status,
            tolerancia_atraso: parseNumericWithDefault(form.tolerancia_atraso, 0),
            tolerancia_hora_extra: parseNumericWithDefault(form.tolerancia_hora_extra, 0),
            limite_diario_banco: parseNumericWithDefault(form.limite_diario_banco, 480),
            regra_compensacao: form.regra_compensacao,
            bh_ativo: form.bh_ativo,
            vigencia_inicio: form.vigencia_inicio || null,
            vigencia_fim: form.vigencia_fim || null,
            adicional_hora_extra_percentual: parseNumericWithDefault(form.adicional_hora_extra_percentual, 50),
            // Legado preservado
            carga_horaria_diaria: parseNumericWithDefault(form.carga_horaria_diaria, 8.00),
            jornada_contratada: parseNumericWithDefault(form.jornada_contratada, 8.00),
            validade_horas: parseNumericWithDefault(form.prazo_compensacao_dias, 60),
            regra_vencimento: form.tipo,
            origem_ponto: "manual",
        };
    };

    const submit = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Acesso negado: Perfil 'encarregado' não pode criar ou editar regras.");
            return;
        }
        if (!form.nome) {
            toast.error("Preencha o nome da regra");
            return;
        }
        if (aplicacaoRegra === "especificas" && selectedEmpresasIds.length === 0) {
            toast.error("Selecione pelo menos uma empresa no multiselect.");
            return;
        }
        if (!form.vigencia_inicio) {
            toast.error("Defina a data de início da vigência");
            return;
        }
        if (form.vigencia_fim && form.vigencia_fim < form.vigencia_inicio) {
            toast.error("A data de término da vigência não pode ser anterior ao início");
            return;
        }

        const payload = getPayload();

        if (editingRegra) {
            updateMutation.mutate({ id: editingRegra.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleNovaVigenciaPreservarHistorico = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Acesso negado: Perfil 'encarregado' não pode criar regras.");
            return;
        }
        if (!editingRegra) return;
        if (!form.vigencia_inicio) {
            toast.error("Defina a data de início da nova vigência");
            return;
        }
        if (editingRegra.vigencia_inicio && form.vigencia_inicio <= editingRegra.vigencia_inicio) {
            toast.error("O início da nova vigência deve ser posterior ao início da regra anterior (" + editingRegra.vigencia_inicio + ")");
            return;
        }
        if (aplicacaoRegra === "especificas" && selectedEmpresasIds.length === 0) {
            toast.error("Selecione pelo menos uma empresa para a nova vigência.");
            return;
        }

        const payload = getPayload();
        novaVigenciaMutation.mutate({
            anteriorId: editingRegra.id,
            novaDataInicio: form.vigencia_inicio,
            novoPayload: payload,
        });
    };

    const handleEdit = (r: any) => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para editar regras.");
            return;
        }
        setEditingRegra(r);

        const isTodas = r.escopo === "TODAS_EMPRESAS" || (!r.escopo && !r.empresa_id && (!r.empresas_ids || r.empresas_ids.length === 0));
        setAplicacaoRegra(isTodas ? "todas" : "especificas");
        
        const ids = Array.isArray(r.empresas_ids) && r.empresas_ids.length > 0
            ? r.empresas_ids
            : (r.empresa_id ? [r.empresa_id] : []);
        setSelectedEmpresasIds(ids);
        setEmpresaSearch("");

        setForm({
            nome: r.nome || "",
            prazo_compensacao_dias: String(r.prazo_compensacao_dias || 60),
            tipo: (r.tipo || "acumula") as "acumula" | "zera" | "expira",
            status: (r.status || "ativo") as "ativo" | "inativo",
            tolerancia_atraso: String(r.tolerancia_atraso ?? 5),
            tolerancia_hora_extra: String(r.tolerancia_hora_extra ?? 0),
            limite_diario_banco: String(r.limite_diario_banco ?? 480),
            regra_compensacao: r.regra_compensacao || "automatico",
            bh_ativo: r.bh_ativo ?? true,
            vigencia_inicio: r.vigencia_inicio || "",
            vigencia_fim: r.vigencia_fim || "",
            adicional_hora_extra_percentual: String(parseNumericWithDefault(r.adicional_hora_extra_percentual, 50)),
            carga_horaria_diaria: String(r.carga_horaria_diaria || 8),
            jornada_contratada: String(r.jornada_contratada || 8),
            validade_horas: String(r.validade_horas || 60),
            regra_vencimento: r.regra_vencimento || "acumula",
            origem_ponto: r.origem_ponto || "manual",
        });
        setOpen(true);
    };

    const handleDelete = (id: string) => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para excluir regras.");
            return;
        }
        if (confirm("Deseja realmente excluir esta regra? Se ela já possuir histórico de pontos ou eventos, a exclusão física será impedida e você deverá inativá-la.")) {
            deleteMutation.mutate(id);
        }
    };

    const handleOpenNew = () => {
        if (isEncarregado || !canManageRules) {
            toast.error("Perfil 'encarregado' não possui permissão para criar regras.");
            return;
        }
        setEditingRegra(null);
        reset();
        setOpen(true);
    };

    return (
        <section id="regras-banco-horas" className="esc-card p-6 mt-6 space-y-6">
            {/* 1. CABEÇALHO DA SEÇÃO */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
                        <Scale className="h-5 w-5 text-primary" />
                        Regras de Banco de Horas
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Defina como créditos e débitos de jornada são tratados pelo motor de banco de horas por escopo (Geral, Compartilhado ou Específico).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_regras"] })}
                        title="Atualizar lista"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={handleOpenNew} disabled={isEncarregado || !canManageRules} size="sm" className="shadow-sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Nova regra
                    </Button>
                </div>
            </div>

            {/* 2. BLOCO INFORMATIVO: GATE 3 & ESCOPO CANÔNICO */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Info className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 flex-1 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">
                                Resolução Hierárquica do Motor (Gate 3 — Banco de Horas):
                            </span>
                            <Badge variant="outline" className="text-xs">
                                1. Específica (100) &gt; 2. Compartilhada (80) &gt; 3. Geral (40)
                            </Badge>
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                                Sem fallback silencioso
                            </Badge>
                        </div>
                        <p>
                            A resolução temporal do Gate 3 considera a <strong>data do ponto apurado</strong>. Regras Específicas sobrepõem Regras Compartilhadas, que por sua vez sobrepõem a Regra Geral do Tenant. Conflitos de mesma precedência para a mesma empresa e período são estritamente bloqueados.
                        </p>
                    </div>
                </div>
            </div>

            {isEncarregado && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-md text-sm font-medium flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Modo Somente Leitura: Perfil 'encarregado' não possui permissão para administrar regras de Banco de Horas.
                </div>
            )}

            {/* 3. TABELA DE REGRAS */}
            <div className="border border-border/60 rounded-xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="esc-table-header">
                            <tr className="text-left">
                                <th className="px-5 h-11 font-medium">Nome da Regra</th>
                                <th className="px-3 h-11 font-medium">Escopo de Aplicação</th>
                                <th className="px-3 h-11 font-medium text-center">Vigência</th>
                                <th className="px-3 h-11 font-medium text-center">Tolerância Líquida</th>
                                <th className="px-3 h-11 font-medium text-center">Adicional HE</th>
                                <th className="px-3 h-11 font-medium text-center">Limite Diário</th>
                                <th className="px-3 h-11 font-medium text-center">Validade</th>
                                <th className="px-3 h-11 font-medium text-center">Tipo</th>
                                <th className="px-3 h-11 font-medium text-center">BH Ativo</th>
                                <th className="px-5 h-11 font-medium text-center">Status</th>
                                <th className="px-5 h-11 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {regras.map((r: any) => {
                                const escopo = r.escopo || (r.empresa_id ? "ESPECIFICA" : "TODAS_EMPRESAS");
                                const vinculadas: any[] = r.empresas_vinculadas || [];
                                const totalEmpresas = vinculadas.length;

                                return (
                                    <tr key={r.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-[52px] font-medium text-foreground">{r.nome}</td>
                                        
                                        {/* Escopo de Aplicação */}
                                        <td className="px-3">
                                            {escopo === "TODAS_EMPRESAS" && (
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                                            Geral
                                                        </Badge>
                                                        Todas as empresas
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">Válida para todo o ambiente</span>
                                                </div>
                                            )}

                                            {escopo === "ESPECIFICA" && (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[10px] bg-muted/60 text-foreground border-border/60">
                                                            Específica
                                                        </Badge>
                                                        {(r.empresas as any)?.nome || vinculadas[0]?.nome || "Empresa Específica"}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">1 empresa selecionada</span>
                                                </div>
                                            )}

                                            {escopo === "COMPARTILHADA" && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="flex flex-col text-left group cursor-pointer hover:opacity-80 transition-opacity">
                                                            <span className="font-medium text-xs text-primary flex items-center gap-1.5">
                                                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                                                    Compartilhada
                                                                </Badge>
                                                                {totalEmpresas} empresas
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground underline decoration-dotted truncate max-w-[200px]" title="Clique para ver todas as empresas vinculadas">
                                                                {(() => {
                                                                    const nomes = vinculadas.map((e) => e.nome);
                                                                    if (nomes.length <= 2) return nomes.join(", ");
                                                                    return `${nomes.slice(0, 2).join(", ")} +${nomes.length - 2}`;
                                                                })()}
                                                            </span>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3 text-xs space-y-2">
                                                        <div className="font-semibold text-foreground border-b pb-1.5 flex items-center justify-between">
                                                            <span>Empresas Vinculadas</span>
                                                            <Badge variant="secondary" className="text-[10px]">Compartilhada</Badge>
                                                        </div>
                                                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                                            {vinculadas.map((e) => (
                                                                <li key={e.id} className="text-muted-foreground py-0.5 flex items-center gap-2">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                                                    <span className="truncate">{e.nome}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </td>

                                        <td className="px-3 text-center text-xs">
                                            {r.vigencia_inicio ? (
                                                <span>{r.vigencia_inicio} a {r.vigencia_fim || 'Indet.'}</span>
                                            ) : (
                                                <span className="text-muted-foreground italic">Sem vigência</span>
                                            )}
                                        </td>
                                        <td className="px-3 text-center">
                                            <span title="Tolerância aplicada sobre o saldo líquido diário (worked - jornada)">
                                                -{r.tolerancia_atraso ?? 5}m / +{r.tolerancia_hora_extra ?? 0}m
                                            </span>
                                        </td>
                                        <td className="px-3 text-center font-medium text-primary">
                                            +{parseNumericWithDefault(r.adicional_hora_extra_percentual, 50)}%
                                        </td>
                                        <td className="px-3 text-center">{Math.floor((r.limite_diario_banco || 480) / 60)}h</td>
                                        <td className="px-3 text-center">{r.prazo_compensacao_dias || 60} dias</td>
                                        <td className="px-3 text-center capitalize">{r.tipo}</td>
                                        <td className="px-3 text-center">
                                            <span className={r.bh_ativo ? "text-success font-medium" : "text-muted-foreground"}>
                                                {r.bh_ativo ? "Sim" : "Não"}
                                            </span>
                                        </td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={r.status === 'ativo' ? 'ok' : 'inconsistente'} label={r.status} />
                                        </td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:text-primary"
                                                    onClick={() => handleEdit(r)}
                                                    disabled={isEncarregado || !canManageRules}
                                                    title="Editar parâmetros da regra"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-error hover:text-error hover:bg-error/10"
                                                    onClick={() => handleDelete(r.id)}
                                                    disabled={isEncarregado || !canManageRules || deleteMutation.isPending}
                                                    title="Excluir regra"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {regras.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="p-12 text-center text-muted-foreground italic">
                                        Nenhuma regra de banco de horas configurada ainda. O Gate 3 permanece bloqueado para colaboradores sem regra aplicável.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 4. MODAL DIALOG DE CRIAÇÃO E EDIÇÃO */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRegra ? "Editar Regra de Banco de Horas" : "Nova Regra de Banco de Horas"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingRegra
                                ? "Atualize os parâmetros de compensação, tolerância, vigência e escopo desta política."
                                : "Defina a política de banco de horas e compensação de horas extras para o escopo selecionado."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Nome da Política */}
                        <div className="space-y-1.5">
                            <Label htmlFor="nome">Nome da política *</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: Acordo Coletivo 2026/2027 — ESC Log"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            />
                        </div>

                        {/* APLICAÇÃO DA REGRA (ESCOPO) */}
                        <div className="space-y-3 border border-border/60 rounded-xl p-4 bg-muted/10">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Aplicação da Regra *</Label>
                                {aplicacaoRegra === "especificas" && (
                                    <Badge variant="outline" className="text-xs">
                                        {selectedEmpresasIds.length === 0
                                            ? "Nenhuma empresa selecionada"
                                            : selectedEmpresasIds.length === 1
                                            ? "Regra Específica (1 empresa)"
                                            : `Regra Compartilhada (${selectedEmpresasIds.length} empresas)`}
                                    </Badge>
                                )}
                            </div>

                            <RadioGroup
                                value={aplicacaoRegra}
                                onValueChange={(val: "todas" | "especificas") => setAplicacaoRegra(val)}
                                className="grid grid-cols-2 gap-3"
                            >
                                <div
                                    onClick={() => setAplicacaoRegra("todas")}
                                    className={cn(
                                        "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-all",
                                        aplicacaoRegra === "todas" ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/30"
                                    )}
                                >
                                    <RadioGroupItem value="todas" id="radio-todas" />
                                    <Label htmlFor="radio-todas" className="cursor-pointer text-xs font-medium">
                                        Todas as empresas
                                    </Label>
                                </div>

                                <div
                                    onClick={() => setAplicacaoRegra("especificas")}
                                    className={cn(
                                        "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-all",
                                        aplicacaoRegra === "especificas" ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/30"
                                    )}
                                >
                                    <RadioGroupItem value="especificas" id="radio-especificas" />
                                    <Label htmlFor="radio-especificas" className="cursor-pointer text-xs font-medium">
                                        Empresas específicas
                                    </Label>
                                </div>
                            </RadioGroup>

                            {aplicacaoRegra === "todas" ? (
                                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
                                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <p>
                                        Esta regra será aplicada a <strong>todas as empresas</strong> deste ambiente (inclusive novas empresas criadas futuramente), salvo quando existir uma regra de maior precedência (específica ou compartilhada).
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-xs font-medium text-foreground">
                                            {selectedEmpresasIds.length} de {empresas.length} empresas selecionadas
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs px-2"
                                                onClick={handleSelectAllCurrent}
                                                title="Selecionar todas as empresas atuais (conjunto fechado)"
                                            >
                                                Selecionar todas
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 text-muted-foreground"
                                                onClick={handleClearSelection}
                                            >
                                                Limpar seleção
                                            </Button>
                                        </div>
                                    </div>

                                    {empresas.length > 5 && (
                                        <div className="relative">
                                            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                                            <Input
                                                placeholder="Buscar empresa por nome..."
                                                value={empresaSearch}
                                                onChange={(e) => setEmpresaSearch(e.target.value)}
                                                className="h-8 text-xs pl-8"
                                            />
                                        </div>
                                    )}

                                    <div className="max-h-44 overflow-y-auto border border-border/50 rounded-lg p-2 space-y-1 bg-background">
                                        {filteredEmpresas.map((e) => {
                                            const checked = selectedEmpresasIds.includes(e.id);
                                            return (
                                                <label
                                                    key={e.id}
                                                    className={cn(
                                                        "flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors",
                                                        checked && "bg-primary/5 font-medium"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(c) => toggleEmpresa(e.id, !!c)}
                                                    />
                                                    <span className="flex-1 truncate">{e.nome}</span>
                                                </label>
                                            );
                                        })}
                                        {filteredEmpresas.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-4 italic">
                                                Nenhuma empresa encontrada com o filtro "{empresaSearch}".
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Vigência Temporal */}
                        <div className="grid grid-cols-2 gap-4 border border-border/50 rounded-lg p-3 bg-muted/20">
                            <div className="space-y-1.5">
                                <Label htmlFor="vigencia_inicio" className="text-xs font-semibold">Vigência Início *</Label>
                                <Input
                                    id="vigencia_inicio"
                                    type="date"
                                    value={form.vigencia_inicio}
                                    onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="vigencia_fim" className="text-xs font-semibold">Vigência Fim (Opcional)</Label>
                                <Input
                                    id="vigencia_fim"
                                    type="date"
                                    placeholder="Indeterminado"
                                    value={form.vigencia_fim}
                                    onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })}
                                />
                                <span className="text-[11px] text-muted-foreground">Vazio = vigência indeterminada</span>
                            </div>
                        </div>

                        {/* Adicional e Compensação */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="adicional_he">Adicional Hora Extra (%)</Label>
                                <Input
                                    id="adicional_he"
                                    type="number"
                                    step="5"
                                    placeholder="50"
                                    value={form.adicional_hora_extra_percentual}
                                    onChange={(e) => setForm({ ...form, adicional_hora_extra_percentual: e.target.value })}
                                />
                                <span className="text-[11px] text-muted-foreground">Ex: 50% = 1.5x | 100% = 2.0x</span>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="prazo">Prazo Compensação (Dias)</Label>
                                <Input
                                    id="prazo"
                                    type="number"
                                    value={form.prazo_compensacao_dias}
                                    onChange={(e) => setForm({ ...form, prazo_compensacao_dias: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Tipo de Política</Label>
                                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="acumula">Acumula</SelectItem>
                                        <SelectItem value="zera">Zera Periódico</SelectItem>
                                        <SelectItem value="expira">Expira Automático</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Regra Compensação</Label>
                                <Select value={form.regra_compensacao} onValueChange={(v: any) => setForm({ ...form, regra_compensacao: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="automatico">Automático</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="transferencia">Transferência</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Tolerâncias de Saldo Líquido Diário & Limites
                            </p>
                            <p className="text-[11px] text-muted-foreground mb-3">
                                A tolerância é aplicada exclusivamente sobre o saldo líquido (minutos trabalhados - jornada). A jornada esperada é definida pelo JornadaResolver.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_atraso" className="text-xs">Tolerância Atraso (m)</Label>
                                <Input
                                    id="tolerancia_atraso"
                                    type="number"
                                    value={form.tolerancia_atraso}
                                    onChange={(e) => setForm({ ...form, tolerancia_atraso: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tolerancia_he" className="text-xs">Tolerância HE (m)</Label>
                                <Input
                                    id="tolerancia_he"
                                    type="number"
                                    value={form.tolerancia_hora_extra}
                                    onChange={(e) => setForm({ ...form, tolerancia_hora_extra: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="limite_diario" className="text-xs">Limite Banco/dia (m)</Label>
                                <Input
                                    id="limite_diario"
                                    type="number"
                                    value={form.limite_diario_banco}
                                    onChange={(e) => setForm({ ...form, limite_diario_banco: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="bh_ativo"
                                    checked={form.bh_ativo}
                                    onChange={(e) => setForm({ ...form, bh_ativo: e.target.checked })}
                                    className="mr-2 h-4 w-4"
                                />
                                <Label htmlFor="bh_ativo" className="font-normal text-sm">Banco de Horas Ativo</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Status da Regra:</Label>
                                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ativo">Ativo</SelectItem>
                                        <SelectItem value="inativo">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        {editingRegra && (
                            <Button
                                variant="secondary"
                                onClick={handleNovaVigenciaPreservarHistorico}
                                disabled={novaVigenciaMutation.isPending || isEncarregado || !canManageRules}
                                title="Encerra a regra anterior no dia anterior e cria uma nova com vigência a partir da nova data"
                                className="gap-1.5"
                            >
                                <History className="h-4 w-4" />
                                {novaVigenciaMutation.isPending ? "Criando Nova Vigência..." : "Nova Vigência (Preservar Histórico)"}
                            </Button>
                        )}
                        <Button
                            onClick={submit}
                            disabled={createMutation.isPending || updateMutation.isPending || isEncarregado || !canManageRules}
                        >
                            {createMutation.isPending || updateMutation.isPending
                                ? "Salvando..."
                                : editingRegra
                                ? "Salvar Correção"
                                : "Criar Regra"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
};

export default RegrasBancoHorasSection;
