import React, { useState, useMemo, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    PerfilUsuarioService,
    EmpresaService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Loader2,
    Eye,
    Download,
    CheckCircle2,
    Lock,
    UnlockKeyhole,
    PlusCircle,
    AlertTriangle,
    History,
    ChevronDown,
    ChevronRight,
    FileCode2,
    Landmark,
} from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

// ─────────────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────────────
type Lote = {
    id: string;
    empresa_id: string;
    periodo_inicio: string;
    periodo_fim: string;
    total_registros: number;
    valor_total: number;
    status: "AGUARDANDO_VALIDACAO_RH" | "VALIDADO_RH" | "FECHADO_FINANCEIRO" | "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO" | "EM_ABERTO" | "cnab_gerado" | "pago" | "cancelado" | "em_aberto";
    fechado_por: string;
    fechado_por_nome?: string;
    fechado_em: string;
    reopened_by?: string;
    reopened_by_nome?: string;
    reopened_at?: string;
    paid_by?: string;
    paid_by_nome?: string;
    paid_at?: string;
};

type Lancamento = {
    id: string;
    diarista_id: string;
    nome_colaborador: string;
    funcao_colaborador?: string;
    data_lancamento: string;
    codigo_marcacao: string;
    quantidade_diaria: number;
    valor_calculado: number;
    status: string;
    tipo_registro?: string;
    referencia_lancamento_id?: string;
    motivo_ajuste?: string;
    adjusted_by_nome?: string;
    adjusted_at?: string;
};

// ─────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────
export const CentralBancariaDiaristas = ({ onMetricsUpdate }: { onMetricsUpdate?: (metrics: any) => void }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
    const [openDetalhe, setOpenDetalhe] = useState(false);

    // dialogs de governança
    const [openReabrir, setOpenReabrir] = useState(false);
    const [openAjuste, setOpenAjuste] = useState(false);
    const [lancamentoParaAjuste, setLancamentoParaAjuste] = useState<Lancamento | null>(null);
    const [motivoReabrir, setMotivoReabrir] = useState("");
    const [tipoReabertura, setTipoReabertura] = useState<"operacional" | "administrativa">("operacional");
    const [valorAjuste, setValorAjuste] = useState("");
    const [motivoAjuste, setMotivoAjuste] = useState("");

    // expandir histórico de ajustes por lancamento
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // ── estado do modal CNAB ──
    const [openCnab, setOpenCnab] = useState(false);
    const [loteParaCnab, setLoteParaCnab] = useState<Lote | null>(null);
    const [cnabEmpresaBanco, setCnabEmpresaBanco] = useState("");
    const [cnabEmpresaAgencia, setCnabEmpresaAgencia] = useState("");
    const [cnabEmpresaConta, setCnabEmpresaConta] = useState("");
    const [cnabEmpresaDigito, setCnabEmpresaDigito] = useState("");

    // ── C2: estado do modal de confirmação de pagamento ──
    const [openConfirmPago, setOpenConfirmPago] = useState(false);
    const [loteParaPagar, setLoteParaPagar] = useState<Lote | null>(null);

    // ── paginação ──
    const PAGE_SIZE = 10;
    const [paginaAtual, setPaginaAtual] = useState(1);

    // ── perfil e empresas ──
    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase.from("profiles").select("role, tenant_id").eq("user_id", user.id).maybeSingle();
            return data;
        },
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const role = perfil?.role?.toLowerCase();
    const isAdmin = role === "admin";
    const isFinanceiro = role === "financeiro";
    const canAdjust = isAdmin || isFinanceiro;
    const userName = user?.email || "";

    // Acesso baseado em papel (role), não em empresa vinculada.
    // Usuários sem empresa_id fixo usam a primeira empresa disponível como contexto padrão.
    const empresaId = (empresas as any[])[0]?.id ?? "";

    // ── lotes ──
    const { data: lotes = [], isLoading } = useQuery({
        queryKey: ["lotes_fechamento", empresaId],
        queryFn: () => LoteFechamentoDiaristaService.getByEmpresaParaFinanceiro(empresaId),
        enabled: !!empresaId,
    });

    React.useEffect(() => {
        if (onMetricsUpdate && lotes) {
            const arr = lotes as Lote[];
            onMetricsUpdate({
                totalRemessas: arr.length,
                totalTitulos: arr.reduce((acc, l) => acc + Number(l.total_registros || 0), 0),
                totalValor: arr.reduce((acc, l) => acc + Number(l.valor_total || 0), 0),
                remessasComErro: arr.filter(l => l.status === "AGUARDANDO_PAGAMENTO" || l.status === "EM_ABERTO" || l.status === "em_aberto").length,
            });
        }
    }, [lotes, onMetricsUpdate]);

    // Lotes paginados
    const totalPaginas = Math.ceil((lotes as Lote[]).length / PAGE_SIZE);
    const lotesPaginados = useMemo(() => {
        const inicio = (paginaAtual - 1) * PAGE_SIZE;
        return (lotes as Lote[]).slice(inicio, inicio + PAGE_SIZE);
    }, [lotes, paginaAtual]);

    // ── lançamentos do lote selecionado ──
    // Estratégia dupla: tenta por lote_fechamento_id primeiro;
    // se retornar vazio (lote antigo sem lote_fechamento_id preenchido),
    // faz fallback por empresa + período sem filtro de status.
    const { data: lancamentosLote = [], isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ["lancamentos_lote", selectedLote?.id],
        queryFn: async () => {
            if (!selectedLote) return [];

            // Tentativa 1: busca vinculada ao lote pelo campo lote_fechamento_id
            const porLote = await LancamentoDiaristaService.getByLoteId(selectedLote.id);
            if (porLote && porLote.length > 0) return porLote;

            // Fallback: sem filtro de status — cobre lotes antigos onde o campo
            // lote_fechamento_id pode estar nulo e o status pode não ter sido atualizado
            const { data: porPeriodo, error } = await (supabase as any)
                .from('lancamentos_diaristas')
                .select('*')
                .eq('empresa_id', selectedLote.empresa_id)
                .gte('data_lancamento', selectedLote.periodo_inicio)
                .lte('data_lancamento', selectedLote.periodo_fim)
                .order('nome_colaborador', { ascending: true })
                .order('data_lancamento', { ascending: true });

            if (error) {
                console.error('[CentralBancaria] Fallback query error:', error);
                return [];
            }
            return porPeriodo ?? [];
        },
        enabled: !!selectedLote?.id,
    });

    // ─── Agrupar por diarista (apenas lançamentos normais no sumário) ───
    const dadosAgrupados = useMemo(() => {
        const map: Record<string, {
            diarista_id: string;
            nome: string;
            funcao: string;
            totalDiarias: number;
            valorBase: number;
            valorAjustes: number;
            lancamentosNormais: Lancamento[];
            ajustes: Lancamento[];
        }> = {};

        (lancamentosLote as Lancamento[]).forEach((l) => {
            const key = l.diarista_id;
            if (!map[key]) {
                map[key] = {
                    diarista_id: l.diarista_id,
                    nome: l.nome_colaborador,
                    funcao: l.funcao_colaborador ?? "—",
                    totalDiarias: 0,
                    valorBase: 0,
                    valorAjustes: 0,
                    lancamentosNormais: [],
                    ajustes: [],
                };
            }
            if (l.tipo_registro === "ajuste") {
                map[key].ajustes.push(l);
                map[key].valorAjustes += Number(l.valor_calculado || 0);
            } else {
                map[key].lancamentosNormais.push(l);
                map[key].totalDiarias += Number(l.quantidade_diaria || 0);
                map[key].valorBase += Number(l.valor_calculado || 0);
            }
        });

        return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [lancamentosLote]);

    const valorTotalComAjustes = useMemo(
        () => dadosAgrupados.reduce((a, g) => a + g.valorBase + g.valorAjustes, 0),
        [dadosAgrupados],
    );

    // ─────────────────────────────────────────────────────────────────
    // Mutations
    // ─────────────────────────────────────────────────────────────────
    const marcarPagoMutation = useMutation({
        mutationFn: (id: string) =>
            LoteFechamentoDiaristaService.marcarComoPago(id, user?.id, userName),
        onSuccess: () => {
            toast.success("Lote marcado como pago.");
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_lote"] });
            setOpenConfirmPago(false);
            setOpenDetalhe(false);
            setSelectedLote(null);
            setLoteParaPagar(null);
        },

        onError: (err: any) => toast.error("Erro ao marcar como pago", { description: err.message }),
    });

    const reabrirMutation = useMutation({
        mutationFn: () =>
            LoteFechamentoDiaristaService.reabrirPeriodo(
                selectedLote!.id,
                user!.id,
                userName,
                role ?? "admin",
                motivoReabrir,
                tipoReabertura,
            ),

        onSuccess: () => {
            toast.success("Período reaberto com sucesso. Registros voltaram para em_aberto.");
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_lote"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_producao"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_semana"] });
            queryClient.invalidateQueries({ queryKey: ["historico_recente_diaristas"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
            setOpenReabrir(false);
            setOpenDetalhe(false);
            setSelectedLote(null);
            setMotivoReabrir("");
            setTipoReabertura("operacional");
        },
        onError: (err: any) => toast.error("Erro ao reabrir período", { description: err.message }),
    });

    const ajusteMutation = useMutation({
        mutationFn: async () => {
            if (!lancamentoParaAjuste || !selectedLote) throw new Error("Dados inválidos.");
            const valor = parseFloat(valorAjuste.replace(",", "."));
            if (isNaN(valor) || valor === 0) throw new Error("Informe um valor de ajuste válido (pode ser negativo).");
            if (!motivoAjuste.trim()) throw new Error("Informe o motivo do ajuste.");

            return LancamentoDiaristaService.criarAjuste({
                empresaId: selectedLote.empresa_id,
                referenciaLancamentoId: lancamentoParaAjuste.id,
                valorAjuste: valor,
                motivo: motivoAjuste.trim(),
                adjustedBy: user!.id,
                adjustedByNome: userName,
                original: {
                    diarista_id: lancamentoParaAjuste.diarista_id,
                    nome_colaborador: lancamentoParaAjuste.nome_colaborador,
                    funcao_colaborador: lancamentoParaAjuste.funcao_colaborador ?? "",
                    data_lancamento: lancamentoParaAjuste.data_lancamento,
                    codigo_marcacao: lancamentoParaAjuste.codigo_marcacao,
                    lote_fechamento_id: selectedLote.id,
                },
            });
        },
        onSuccess: () => {
            toast.success("Ajuste criado com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["lancamentos_lote"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            setOpenAjuste(false);
            setLancamentoParaAjuste(null);
            setValorAjuste("");
            setMotivoAjuste("");
        },
        onError: (err: any) => toast.error("Erro ao criar ajuste", { description: err.message }),
    });

    const cnabMutation = useMutation({
        mutationFn: async () => {
            if (!loteParaCnab) throw new Error("Nenhum lote selecionado.");
            if (!cnabEmpresaBanco.trim()) throw new Error("Informe o código do banco da empresa.");
            if (!cnabEmpresaAgencia.trim()) throw new Error("Informe a agência da empresa.");
            if (!cnabEmpresaConta.trim()) throw new Error("Informe a conta da empresa.");

            // Buscar CNPJ e nome da empresa
            const empresa = (empresas as any[]).find((e: any) => e.id === loteParaCnab.empresa_id);
            if (!empresa) throw new Error("Empresa não encontrada.");

            return LoteFechamentoDiaristaService.gerarCNABParaLote({
                loteId: loteParaCnab.id,
                empresaId: loteParaCnab.empresa_id,
                geradoPor: user!.id,
                geradoPorNome: userName,
                empresaRemetente: {
                    cnpj: empresa.cnpj ?? "",
                    razao_social: empresa.nome ?? "",
                    banco_codigo: cnabEmpresaBanco.trim(),
                    agencia: cnabEmpresaAgencia.trim(),
                    agencia_digito: empresa.agencia_digito?.trim() || "",
                    conta: cnabEmpresaConta.trim(),
                    digito_conta: cnabEmpresaDigito.trim() || "0",
                    convenio_bancario: empresa.convenio_bancario?.trim() || "",
                    codigo_empresa_banco: empresa.codigo_empresa_banco?.trim() || "",
                    nome_empresa_banco: empresa.nome_empresa_banco?.trim() || "",
                },
            });
        },
        onSuccess: (result) => {
            toast.success(`CNAB gerado com sucesso! ${result.totalRegistros} registros — ${formatCurrency(result.valorTotal)}`, {
                description: `Arquivo baixado: ${result.nomeArquivo}`,
            });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            setOpenCnab(false);
        },

        onError: (err: any) => {
            // Mostrar erros de validação de forma amigável
            toast.error("Falha na geração do CNAB", {
                description: err.message?.slice(0, 300),
                duration: 8000,
            });
        },
    });

    const handleAbrirCnab = (lote: Lote) => {
        setLoteParaCnab(lote);
        const empresa = (empresas as any[] || []).find((e: any) => e.id === lote.empresa_id);
        if (empresa) {
            setCnabEmpresaBanco(empresa.banco_codigo || "341");
            setCnabEmpresaAgencia(empresa.agencia || "");
            const digAgencia = empresa.agencia_digito ? `-${empresa.agencia_digito}` : "";
            // We'll keep agencia and digito in text but our state has digito separate.
            // Oh wait, our state has cnabEmpresaDigito for conta or agencia? 
            // In the form: cnabEmpresaConta, cnabEmpresaDigito (conta).
            // Let's set it properly according to existing state
            setCnabEmpresaConta(empresa.conta || "");
            setCnabEmpresaDigito(empresa.conta_digito || "0");
        }
        setOpenCnab(true);
    };

    // ─────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────
    const handleOpenDetalhe = (lote: Lote) => {
        setSelectedLote(lote);
        setOpenDetalhe(true);
    };

    const handleOpenAjuste = (lanc: Lancamento) => {
        setLancamentoParaAjuste(lanc);
        setOpenAjuste(true);
    };

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const exportarXlsx = async () => {
        if (!selectedLote || dadosAgrupados.length === 0) return;
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows: any[] = [];
            dadosAgrupados.forEach((g) => {
                rows.push({
                    Colaborador: g.nome,
                    Função: g.funcao,
                    "Diárias": g.totalDiarias.toFixed(1),
                    "Valor Base": g.valorBase.toFixed(2),
                    "Ajustes": g.valorAjustes.toFixed(2),
                    "Total Final": (g.valorBase + g.valorAjustes).toFixed(2),
                });
                g.ajustes.forEach((a) => {
                    rows.push({
                        Colaborador: `  → Ajuste: ${a.motivo_ajuste ?? ""}`,
                        Função: "",
                        Diárias: "",
                        "Valor Base": "",
                        Ajustes: a.valor_calculado,
                        "Total Final": "",
                    });
                });
            });

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Pagamentos");
            writeFile(
                wb,
                `lote_${selectedLote.id.substring(0, 6)}_${selectedLote.periodo_inicio}_a_${selectedLote.periodo_fim}.xlsx`,
            );
            toast.success("Planilha exportada.");
        } catch {
            toast.error("Instale a dependência: npm install xlsx");
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // Badge de status
    // ─────────────────────────────────────────────────────────────────
    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            AGUARDANDO_VALIDACAO_RH: "bg-blue-500/15 text-blue-700",
            VALIDADO_RH: "bg-indigo-500/15 text-indigo-700",
            FECHADO_FINANCEIRO: "bg-amber-500/15 text-amber-700",
            AGUARDANDO_PAGAMENTO: "bg-amber-500/15 text-amber-700",
            cnab_gerado: "bg-indigo-500/15 text-indigo-700",
            PAGO: "bg-emerald-500/15 text-emerald-700",
            pago: "bg-emerald-500/15 text-emerald-700",
            CANCELADO: "bg-muted text-muted-foreground",
            cancelado: "bg-muted text-muted-foreground",
            EM_ABERTO: "bg-amber-500/15 text-amber-700",
            em_aberto: "bg-amber-500/15 text-amber-700",
        };
        const labels: Record<string, string> = {
            AGUARDANDO_VALIDACAO_RH: "Aguardando Validação RH",
            VALIDADO_RH: "Validado RH",
            FECHADO_FINANCEIRO: "Aguardando Pagamento",
            AGUARDANDO_PAGAMENTO: "Aguardando Pagamento",
            cnab_gerado: "CNAB Gerado",
            PAGO: "Pago",
            pago: "Pago",
            CANCELADO: "Cancelado",
            cancelado: "Cancelado",
            EM_ABERTO: "Em Aberto",
            em_aberto: "Em Aberto",
        };
        return (
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold", map[status] ?? "bg-muted text-muted-foreground")}>
                {labels[status] ?? status}
            </span>
        );
    };

    // ─────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="space-y-4">
                <section className="esc-card overflow-hidden">
                    {/* Legenda contextual para usuários leigos sobre CNAB */}
                    <div className="px-5 py-3 bg-muted/30 border-b border-border/50 flex items-start gap-2">
                        <Landmark className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground">CNAB240</strong> é o arquivo de remessa bancária padrão FEBRABAN.
                            Gere-o para lotes aprovados, envie ao banco e marque como <strong>Pago</strong> após confirmação bancária.
                        </p>
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Carregando...</p>
                        </div>
                    ) : (lotes as Lote[]).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                            <Lock className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhum lote de fechamento encontrado</p>
                            <p className="text-sm text-muted-foreground">Feche um período no painel RH para gerar um lote de pagamento.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Lote / Período</th>
                                    <th className="px-3 h-11 font-medium text-center">Registros</th>
                                    <th className="px-3 h-11 font-medium text-right">Valor Total</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lotesPaginados.map((l) => (
                                    <tr key={l.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-14">
                                            <p className="font-mono text-xs text-muted-foreground mb-0.5">#{l.id.substring(0, 8)}</p>
                                            <p className="font-medium text-foreground">
                                                {formatDate(l.periodo_inicio)} até {formatDate(l.periodo_fim)}
                                            </p>
                                            {l.reopened_at && (
                                                <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                                    <History className="w-3 h-3" />
                                                    Reaberto por {l.reopened_by_nome ?? "—"}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-3 text-center font-mono">
                                            {l.total_registros}{" "}
                                            <span className="text-xs text-muted-foreground ml-1">registros</span>
                                        </td>
                                        <td className="px-3 text-right font-mono font-bold text-base">
                                            {formatCurrency(Number(l.valor_total))}
                                        </td>
                                        <td className="px-5 text-center">{statusBadge(l.status)}</td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleOpenDetalhe(l)}>
                                                    <Eye className="h-4 w-4 mr-1.5" /> Detalhes
                                                </Button>
                                                {/* O2 / C1: CNAB bloqueado para lotes já pagos ou se o arquivo já foi gerado uma vez */}
                                                {(() => {
                                                    const isPago = l.status === "pago" || l.status === "PAGO";
                                                    const isCnabGerado = l.status === "cnab_gerado";
                                                    return (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="border-indigo-400 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                            onClick={() => handleAbrirCnab(l)}
                                                            disabled={isPago || isCnabGerado}
                                                            title={isPago ? "CNAB indisponível: lote já pago" : isCnabGerado ? "Arquivo já gerado" : "Gerar arquivo CNAB240"}
                                                        >
                                                            <FileCode2 className="h-4 w-4 mr-1.5" /> CNAB
                                                        </Button>
                                                    );
                                                })()}

                                                {/* Botão Pago ou Badge Concluído */}
                                                {(l.status === "pago" || l.status === "PAGO") ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Pagamento Concluído
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => { setLoteParaPagar(l); setOpenConfirmPago(true); }}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Pago
                                                    </Button>
                                                )}

                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {/* Controles de paginação */}
                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-muted/20">
                            <span className="text-xs text-muted-foreground">
                                Página {paginaAtual} de {totalPaginas} · {(lotes as Lote[]).length} lotes
                            </span>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                                    disabled={paginaAtual === 1}
                                    className="h-7 w-7 rounded-md text-sm flex items-center justify-center border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPaginaAtual(p)}
                                        className={`h-7 w-7 rounded-md text-xs flex items-center justify-center border transition-colors ${p === paginaAtual
                                            ? "bg-primary text-primary-foreground border-primary font-bold"
                                            : "border-border hover:bg-muted"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="h-7 w-7 rounded-md text-sm flex items-center justify-center border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* ── MODAL DETALHES ── */}
            <Dialog
                open={openDetalhe}
                onOpenChange={(v) => {
                    setOpenDetalhe(v);
                    if (!v) { setSelectedLote(null); setExpandedIds(new Set()); }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b bg-background z-10 shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            Detalhes do Lote
                            {selectedLote && statusBadge(selectedLote.status)}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLote && (
                                <span>
                                    Período: {formatDate(selectedLote.periodo_inicio)} até {formatDate(selectedLote.periodo_fim)}
                                    {selectedLote.fechado_por_nome && (
                                        <> · Fechado por: <strong>{selectedLote.fechado_por_nome}</strong></>
                                    )}
                                    {selectedLote.paid_by_nome && (
                                        <> · Pago por: <strong>{selectedLote.paid_by_nome}</strong></>
                                    )}
                                    {selectedLote.reopened_by_nome && (
                                        <> · Reaberto por: <strong className="text-amber-600">{selectedLote.reopened_by_nome}</strong></>
                                    )}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 bg-muted/10 relative group">
                        {/* Indicador de scroll */}
                        <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-muted/20 to-transparent pointer-events-none opacity-0 transition-opacity group-hover:opacity-100" />

                        {/* Barra de ações de governança (Admin + Financeiro podem criar ajustes; só Admin pode reabrir) */}
                        {canAdjust && selectedLote && (["FECHADO_FINANCEIRO", "AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH", "cnab_gerado", "PAGO", "pago"].includes(selectedLote.status)) && (
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-700 flex-1">
                                    {isAdmin
                                        ? "Ações de governança (Admin). Qualquer operação gera trilha de auditoria."
                                        : "Crie ajustes pontuais se necessário — cada ajuste é auditado."}
                                </p>
                                {/* Reabrir é exclusivo do Admin — S3/S4 segregação */}
                                {isAdmin && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-amber-500 text-amber-700 hover:bg-amber-500/10"
                                        onClick={() => setOpenReabrir(true)}
                                    >
                                        <UnlockKeyhole className="h-4 w-4 mr-1.5" /> Reabrir Período
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="py-2">
                            {isLoadingLancamentos ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="border border-border/50 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="esc-table-header bg-muted/50">
                                            <tr className="text-left">
                                                <th className="px-4 py-2 font-medium">Diarista</th>
                                                <th className="px-3 py-2 font-medium">Função</th>
                                                <th className="px-3 py-2 font-medium text-center">Diárias</th>
                                                <th className="px-4 py-2 font-medium text-right">Base</th>
                                                <th className="px-4 py-2 font-medium text-right">Ajustes</th>
                                                <th className="px-4 py-2 font-medium text-right">Total</th>
                                                {canAdjust && <th className="px-2 py-2 font-medium text-right">Ação</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {dadosAgrupados.map((g) => {
                                                const totalFinal = g.valorBase + g.valorAjustes;
                                                const hasAjustes = g.ajustes.length > 0;
                                                const expanded = expandedIds.has(g.diarista_id);
                                                // Pega o primeiro lançamento normal para usar como referência no ajuste
                                                const lancRef = g.lancamentosNormais[0] ?? null;

                                                return (
                                                    <React.Fragment key={g.diarista_id}>
                                                        <tr className="hover:bg-muted/30">
                                                            <td className="px-4 py-2.5 font-medium">
                                                                <div className="flex items-center gap-1">
                                                                    {hasAjustes && (
                                                                        <button
                                                                            onClick={() => toggleExpanded(g.diarista_id)}
                                                                            className="text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    )}
                                                                    {g.nome}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-muted-foreground text-xs">{g.funcao}</td>
                                                            <td className="px-3 py-2.5 text-center font-mono text-xs">{g.totalDiarias.toFixed(1)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(g.valorBase)}</td>
                                                            <td className={cn(
                                                                "px-4 py-2.5 text-right font-mono text-sm",
                                                                g.valorAjustes > 0 && "text-emerald-600",
                                                                g.valorAjustes < 0 && "text-red-600",
                                                            )}>
                                                                {g.valorAjustes !== 0 ? formatCurrency(g.valorAjustes) : "—"}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrency(totalFinal)}</td>
                                                            {canAdjust && (
                                                                <td className="px-2 py-2.5 text-right">
                                                                    {lancRef && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 text-xs px-2"
                                                                            onClick={() => handleOpenAjuste(lancRef)}
                                                                        >
                                                                            <PlusCircle className="h-3.5 w-3.5 mr-1" /> Ajuste
                                                                        </Button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>

                                                        {/* Sub-linhas de ajuste */}
                                                        {expanded && g.ajustes.map((aj) => (
                                                            <tr key={aj.id} className="bg-amber-500/5 border-t border-amber-500/20">
                                                                <td className="px-4 py-1.5 pl-8 text-xs text-amber-700" colSpan={2}>
                                                                    <span className="flex items-center gap-1">
                                                                        <History className="w-3 h-3" />
                                                                        {formatDate(aj.data_lancamento)} · {aj.motivo_ajuste ?? "Ajuste"}
                                                                        {aj.adjusted_by_nome && (
                                                                            <span className="text-muted-foreground ml-1">por {aj.adjusted_by_nome}</span>
                                                                        )}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">—</td>
                                                                <td className="px-4 py-1.5 text-right text-xs text-muted-foreground">—</td>
                                                                <td className={cn(
                                                                    "px-4 py-1.5 text-right font-mono text-xs font-medium",
                                                                    Number(aj.valor_calculado) >= 0 ? "text-emerald-600" : "text-red-600",
                                                                )}>
                                                                    {formatCurrency(Number(aj.valor_calculado))}
                                                                </td>
                                                                <td className="px-4 py-1.5" />
                                                                {canAdjust && <td className="px-2 py-1.5" />}
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-muted border-t border-border/50 relative">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-3 font-bold text-right text-sm">TOTAL GERAL:</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                                                    {formatCurrency(dadosAgrupados.reduce((a, g) => a + g.valorBase, 0))}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 text-right font-mono font-bold text-sm",
                                                    dadosAgrupados.reduce((a, g) => a + g.valorAjustes, 0) >= 0 ? "text-emerald-600" : "text-red-600",
                                                )}>
                                                    {formatCurrency(dadosAgrupados.reduce((a, g) => a + g.valorAjustes, 0))}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-lg text-emerald-600">
                                                    {formatCurrency(valorTotalComAjustes)}
                                                </td>
                                                {canAdjust && <td />}
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none flex items-end justify-center pb-1">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 px-2 rounded-full shadow-sm border">
                                ↓ Role para ver mais
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between w-full px-6 py-4 border-t bg-background shrink-0">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={exportarXlsx}>
                                <Download className="h-4 w-4 mr-2" /> Exportar Planilha
                            </Button>
                            {/* CNAB: bloqueado para lote já pago */}
                            {selectedLote && !(selectedLote.status === "pago" || selectedLote.status === "PAGO") && selectedLote.status !== "cnab_gerado" && (
                                <Button
                                    variant="outline"
                                    className="border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                                    onClick={() => {
                                        if (selectedLote) handleAbrirCnab(selectedLote);
                                        setOpenDetalhe(false);
                                    }}
                                >
                                    <FileCode2 className="h-4 w-4 mr-2" /> Gerar CNAB
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button variant="ghost" onClick={() => setOpenDetalhe(false)}>Fechar</Button>
                            {/* Botão Pago ou Badge Concluído */}
                            {(selectedLote?.status === "pago" || selectedLote?.status === "PAGO") ? (
                                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Pagamento Concluído
                                </span>
                            ) : (
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => { setLoteParaPagar(selectedLote); setOpenConfirmPago(true); }}
                                    disabled={marcarPagoMutation.isPending}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    {marcarPagoMutation.isPending ? "Salvando..." : "Marcar como Pago"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── MODAL REABRIR PERÍODO (Admin only) ── */}
            <Dialog
                open={openReabrir}
                onOpenChange={(open) => {
                    setOpenReabrir(open);
                    if (!open) {
                        setMotivoReabrir("");
                        setTipoReabertura("operacional");
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <UnlockKeyhole className="h-5 w-5" />
                            Reabrir Período
                        </DialogTitle>
                        <DialogDescription>
                            Esta ação reverte o lote para <strong>em_aberto</strong> e todos os registros vinculados voltam para <strong>em_aberto</strong>. A operação é auditada.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-4">
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                            ⚠️ Ação irreversível. Um novo fechamento será necessário. Registros serão desvinculados do lote.
                        </div>
                        <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                            <Label className="text-xs font-bold">
                                Tipo de reabertura <span className="text-red-500">*</span>
                            </Label>
                            <div className="space-y-2">
                                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:border-slate-200">
                                    <input
                                        type="radio"
                                        name="tipo-reabertura-financeiro"
                                        checked={tipoReabertura === "operacional"}
                                        onChange={() => setTipoReabertura("operacional")}
                                        className="mt-0.5"
                                    />
                                    <span className="text-sm">
                                        <strong>Operacional</strong> - devolve para encarregado corrigir e fechar novamente
                                    </span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:border-slate-200">
                                    <input
                                        type="radio"
                                        name="tipo-reabertura-financeiro"
                                        checked={tipoReabertura === "administrativa"}
                                        onChange={() => setTipoReabertura("administrativa")}
                                        className="mt-0.5"
                                    />
                                    <span className="text-sm">
                                        <strong>Administrativa</strong> - RH/Admin corrige internamente, sem devolver ao encarregado
                                    </span>
                                </label>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {tipoReabertura === "operacional"
                                    ? "O lote volta para o fluxo do encarregado para correção e novo fechamento."
                                    : "O lote fica em correção administrativa e o encarregado permanece bloqueado para novo fechamento."}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="motivo-reabrir">Justificativa (obrigatória)</Label>
                            <Textarea
                                id="motivo-reabrir"
                                placeholder="Descreva o motivo da reabertura..."
                                value={motivoReabrir}
                                onChange={(e) => setMotivoReabrir(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenReabrir(false)}>Cancelar</Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700"
                            disabled={!motivoReabrir.trim() || reabrirMutation.isPending}
                            onClick={() => reabrirMutation.mutate()}
                        >
                            {reabrirMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UnlockKeyhole className="h-4 w-4 mr-2" />}
                            Confirmar Reabertura
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── MODAL CRIAR AJUSTE (Admin only) ── */}
            <Dialog open={openAjuste} onOpenChange={(v) => { setOpenAjuste(v); if (!v) { setLancamentoParaAjuste(null); setValorAjuste(""); setMotivoAjuste(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PlusCircle className="h-5 w-5 text-primary" />
                            Criar Ajuste
                        </DialogTitle>
                        <DialogDescription>
                            {lancamentoParaAjuste && (
                                <>Ajuste para <strong>{lancamentoParaAjuste.nome_colaborador}</strong> &middot; {formatDate(lancamentoParaAjuste.data_lancamento)} &middot; {lancamentoParaAjuste.codigo_marcacao}</>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-4">
                        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                            Use valor <strong>positivo</strong> para acrescentar e <strong>negativo</strong> para descontar. Ex: <code>60</code> ou <code>-30</code>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="valor-ajuste">Valor do Ajuste (R$)</Label>
                            <Input
                                id="valor-ajuste"
                                type="number"
                                step="0.01"
                                placeholder="Ex: 60.00 ou -30.00"
                                value={valorAjuste}
                                onChange={(e) => setValorAjuste(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="motivo-ajuste">Motivo do Ajuste</Label>
                            <Textarea
                                id="motivo-ajuste"
                                placeholder="Ex: Correção de MP para diária completa (P)"
                                value={motivoAjuste}
                                onChange={(e) => setMotivoAjuste(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenAjuste(false)}>Cancelar</Button>
                        <Button
                            disabled={!valorAjuste.trim() || !motivoAjuste.trim() || ajusteMutation.isPending}
                            onClick={() => ajusteMutation.mutate()}
                        >
                            {ajusteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                            Confirmar Ajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── MODAL GERAR CNAB240 ── */}
            <Dialog open={openCnab} onOpenChange={(v) => { setOpenCnab(v); if (!v) setLoteParaCnab(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileCode2 className="h-5 w-5 text-indigo-600" />
                            Gerar Arquivo CNAB240
                        </DialogTitle>
                        <DialogDescription>
                            {loteParaCnab && (
                                <>
                                    Lote <strong>#{loteParaCnab.id.substring(0, 8)}</strong> &middot;
                                    Período: {formatDate(loteParaCnab.periodo_inicio)} até {formatDate(loteParaCnab.periodo_fim)} &middot;
                                    Total: <strong>{formatCurrency(Number(loteParaCnab.valor_total))}</strong>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-4">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-700">
                            <Landmark className="inline h-3.5 w-3.5 mr-1" />
                            Informe os dados bancários da <strong>empresa pagadora</strong> (quem envia o arquivo ao banco).
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cnab-banco">Banco (código)</Label>
                                    <Input
                                        id="cnab-banco"
                                        placeholder="Ex: 341"
                                        maxLength={3}
                                        value={cnabEmpresaBanco}
                                        onChange={(e) => setCnabEmpresaBanco(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cnab-agencia">Agência</Label>
                                    <Input
                                        id="cnab-agencia"
                                        placeholder="0001"
                                        value={cnabEmpresaAgencia}
                                        onChange={(e) => setCnabEmpresaAgencia(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cnab-digito">Dígito</Label>
                                    <Input
                                        id="cnab-digito"
                                        placeholder="0"
                                        maxLength={2}
                                        value={cnabEmpresaDigito}
                                        onChange={(e) => setCnabEmpresaDigito(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cnab-conta">Conta da empresa</Label>
                                <Input
                                    id="cnab-conta"
                                    placeholder="Número da conta sem dígito"
                                    value={cnabEmpresaConta}
                                    onChange={(e) => setCnabEmpresaConta(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                            ℹ️ O arquivo seguirá o padrão <strong>CNAB240 FEBRABAN</strong> com crédito em conta.
                            A geração será registrada para auditoria.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenCnab(false)} disabled={cnabMutation.isPending}>Cancelar</Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={!cnabEmpresaBanco || !cnabEmpresaAgencia || !cnabEmpresaConta || cnabMutation.isPending}
                            onClick={() => cnabMutation.mutate()}
                        >
                            {cnabMutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                : <FileCode2 className="h-4 w-4 mr-2" />
                            }
                            {cnabMutation.isPending ? "Gerando..." : "Gerar e Baixar CNAB"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── C2: MODAL DE CONFIRMAÇÃO DE PAGAMENTO ── */}
            <Dialog open={openConfirmPago} onOpenChange={(v) => { setOpenConfirmPago(v); if (!v) setLoteParaPagar(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="h-5 w-5" />
                            Confirmar Pagamento
                        </DialogTitle>
                        <DialogDescription>
                            Revise os dados abaixo antes de confirmar. Esta ação é auditada e não pode ser desfeita sem intervenção do Admin.
                        </DialogDescription>
                    </DialogHeader>

                    {loteParaPagar && (
                        <div className="space-y-3 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="esc-card p-3">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Período</p>
                                    <p className="font-mono font-semibold text-sm">
                                        {formatDate(loteParaPagar.periodo_inicio)} → {formatDate(loteParaPagar.periodo_fim)}
                                    </p>
                                </div>
                                <div className="esc-card p-3">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Registros</p>
                                    <p className="font-mono font-semibold text-sm">{loteParaPagar.total_registros} diaristas</p>
                                </div>
                            </div>
                            <div className="esc-card p-4 flex justify-between items-center border-2 border-emerald-500/30">
                                <span className="text-sm font-medium text-muted-foreground">Valor total a pagar</span>
                                <span className="font-mono font-bold text-xl text-emerald-700">
                                    {formatCurrency(Number(loteParaPagar.valor_total))}
                                </span>
                            </div>
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700">
                                ⚠️ Após confirmar, o lote será marcado como <strong>pago</strong> e não poderá ser editado sem reabertura pelo Admin.
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenConfirmPago(false)} disabled={marcarPagoMutation.isPending}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={marcarPagoMutation.isPending}
                            onClick={() => { if (loteParaPagar) marcarPagoMutation.mutate(loteParaPagar.id); }}
                        >
                            {marcarPagoMutation.isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                                : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar Pagamento</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};


