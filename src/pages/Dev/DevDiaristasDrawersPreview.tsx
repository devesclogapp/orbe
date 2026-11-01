import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    DrawerReaberturaDiarista,
    DrawerEdicaoDiarista,
    DrawerFechamentoDiarista,
    formatCurrency,
} from "@/components/diaristas/drawers";
import {
    ShieldCheck,
    RefreshCw,
    Pencil,
    Lock,
    Sparkles,
    CheckCircle2,
    Calendar,
    UserCheck,
    Building2,
    DatabaseZap,
    ExternalLink,
    AlertCircle,
    RotateCcw
} from "lucide-react";

// ============================================================================
// FIXTURES EM MEMÓRIA — 100% ISOLADAS (NÃO TOCAM NO BANCO DE DADOS)
// ============================================================================
const FIXTURE_LOTE_REABERTURA = {
    id: "lot-preview-hml-001",
    periodo_inicio: "2026-10-05",
    periodo_fim: "2026-10-11",
    empresa_id: "emp-hml-001",
    empresa: {
        id: "emp-hml-001",
        nome: "ESC Logística — Filial Homologação",
    },
    total_registros: 14,
    valor_total: 1960.00,
    status: "AGUARDANDO_VALIDACAO_RH",
};

const FIXTURE_LANCAMENTO_EDICAO = {
    id: "lanc-preview-hml-002",
    nome_colaborador: "Carlos Eduardo da Silva (Diarista HML)",
    funcao_colaborador: "Conferente Operacional",
    status: "EM_ABERTO",
    data_lancamento: "2026-10-07",
    codigo_marcacao: "P",
    quantidade_diaria: 1.0,
    valor_diaria_base: 140.00,
    valor_calculado: 140.00,
    observacao: "Turno da tarde finalizado conforme escala regular.",
    lote_fechamento_id: "lot-preview-hml-001",
};

const FIXTURE_LOTE_CONTEXTO_EDICAO = {
    id: "lot-preview-hml-001",
    periodo_inicio: "2026-10-05",
    periodo_fim: "2026-10-11",
};

export const DevDiaristasDrawersPreview: React.FC = () => {
    // Estados de controle de abertura dos drawers
    const [openReabertura, setOpenReabertura] = useState(false);
    const [openEdicao, setOpenEdicao] = useState(false);
    const [openFechamento, setOpenFechamento] = useState(false);

    // Registro visual de eventos simulados (somente em memória do browser)
    const [logEventos, setLogEventos] = useState<Array<{ id: string; hora: string; acao: string; detalhes: string }>>([
        {
            id: "init",
            hora: new Date().toLocaleTimeString("pt-BR"),
            acao: "SISTEMA_INICIALIZADO",
            detalhes: "Ambiente de laboratório carregado com fixtures em memória. Zero conexões de escrita.",
        }
    ]);

    const addLog = (acao: string, detalhes: string) => {
        setLogEventos((prev) => [
            {
                id: Math.random().toString(36).substring(7),
                hora: new Date().toLocaleTimeString("pt-BR"),
                acao,
                detalhes,
            },
            ...prev.slice(0, 9),
        ]);
    };

    // Handlers de simulação (garantia de ZERO mutações no Supabase)
    const handleSimulatedReabrir = (data: { loteId: string; motivo: string; tipo: 'operacional' | 'administrativa' }) => {
        addLog(
            `REABERTURA_DEMO (${data.tipo.toUpperCase()})`,
            `Lote #${data.loteId.slice(0, 8)} • Motivo: "${data.motivo}"`
        );
        toast.info(`[Demonstração] Simulação de reabertura ${data.tipo} executada em memória. Nenhuma auditoria ou alteração foi gravada.`);
        setOpenReabertura(false);
    };

    const handleSimulatedEditar = (formData: any) => {
        addLog(
            "EDICAO_DEMO",
            `Colaborador: ${FIXTURE_LANCAMENTO_EDICAO.nome_colaborador} • Novo Valor: ${formatCurrency(formData.valor_calculado)} • Motivo: "${formData.motivo_edicao}"`
        );
        toast.info(`[Demonstração] Simulação de ajuste cadastral executada em memória. Nenhum registro foi persistido.`);
        setOpenEdicao(false);
    };

    const handleSimulatedFechar = (obs: string) => {
        addLog(
            "FECHAMENTO_DEMO",
            `Empresa: ${FIXTURE_LOTE_REABERTURA.empresa.nome} • 8 apontamentos • Obs: "${obs || 'Nenhuma'}"`
        );
        toast.info(`[Demonstração] Simulação de fechamento executada em memória. Nenhum lote real foi gerado.`);
        setOpenFechamento(false);
    };

    return (
        <AppShell>
            <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
                {/* 1. Cabeçalho de Homologação */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-b border-border pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" /> CONV-16 / FIX 06
                            </span>
                            <Badge variant="outline" className="border-amber-400/50 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px] font-bold">
                                AMBIENTE DE HOMOLOGAÇÃO UI/UX
                            </Badge>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            Pré-visualização Segura dos Drawers — Diaristas
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Superfície de teste isolada para inspeção dos 3 Drawers contextuais com fixtures em memória e trava total de mutações.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setLogEventos([]);
                                toast.info("Histórico de eventos da simulação limpo.");
                            }}
                            className="h-8 text-xs gap-1.5 text-muted-foreground"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> Limpar Histórico
                        </Button>
                    </div>
                </div>

                {/* 2. Banner de Garantia de Isolamento e Segurança */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5 text-xs">
                            <h4 className="font-bold text-foreground text-sm">Garantia de Não-Interferência com Produção</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Esta rota é restrita a desenvolvimento (<code>import.meta.env.DEV</code>). Nenhuma chamada de escrita, RPC, RLS ou mutação do Supabase é executada.
                                Os dados abaixo são fixtures elegíveis simuladas em memória para permitir a validação integral da interface, campos e botões.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shrink-0">
                        <DatabaseZap className="h-3.5 w-3.5" /> Mutações Bloqueadas
                    </div>
                </div>

                {/* 3. Grade dos 3 Cenários de Teste */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* CARD CENÁRIO A: Reabertura */}
                    <div className="esc-card p-5 rounded-xl border border-border/80 flex flex-col justify-between space-y-4 hover:border-border transition-all">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                    Cenário A
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                    Lote Elegível
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-amber-600" /> Reabertura de Período
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Testa a devolução de um lote consolidado em <em>AGUARDANDO_VALIDACAO_RH</em> para modalidade Operacional ou Administrativa.
                                </p>
                            </div>

                            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1.5 font-mono">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">ID do Lote:</span>
                                    <span className="font-bold text-foreground">#{FIXTURE_LOTE_REABERTURA.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status Atual:</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">🟡 Aguardando RH</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Apontamentos:</span>
                                    <span className="font-bold">{FIXTURE_LOTE_REABERTURA.total_registros}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Valor:</span>
                                    <span className="font-bold text-foreground">{formatCurrency(FIXTURE_LOTE_REABERTURA.valor_total)}</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => setOpenReabertura(true)}
                            className="w-full h-10 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-xs"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Abrir Drawer Reabertura
                        </Button>
                    </div>

                    {/* CARD CENÁRIO B: Edição Administrativa */}
                    <div className="esc-card p-5 rounded-xl border border-border/80 flex flex-col justify-between space-y-4 hover:border-border transition-all">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                                    Cenário B
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                    Apontamento Elegível
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-blue-600" /> Edição Administrativa
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Testa o ajuste de marcação (P/MP/AUS), quantidade, valor diário e captura de justificativa com snapshot imutável.
                                </p>
                            </div>

                            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1.5 font-mono">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Colaborador:</span>
                                    <span className="font-bold text-foreground truncate max-w-[140px]">Carlos Eduardo</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Data:</span>
                                    <span>07/10/2026</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Marcação:</span>
                                    <span className="font-bold">P (Completa - 1.0)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Valor Calculado:</span>
                                    <span className="font-bold text-foreground">{formatCurrency(FIXTURE_LANCAMENTO_EDICAO.valor_calculado)}</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => setOpenEdicao(true)}
                            className="w-full h-10 text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white gap-2 shadow-xs"
                        >
                            <Pencil className="h-3.5 w-3.5" /> Abrir Drawer Edição
                        </Button>
                    </div>

                    {/* CARD CENÁRIO C: Fechamento de Período */}
                    <div className="esc-card p-5 rounded-xl border border-border/80 flex flex-col justify-between space-y-4 hover:border-border transition-all">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                    Cenário C
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                    Semana em Aberto
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-emerald-600" /> Fechamento de Período
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Testa a consolidação semanal, observações do lote e a trava de confirmação por digitação da palavra <code>FECHAR</code>.
                                </p>
                            </div>

                            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1.5 font-mono">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Empresa:</span>
                                    <span className="font-bold text-foreground truncate max-w-[140px]">ESC Logística</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Intervalo:</span>
                                    <span>05/10 → 11/10/2026</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Em Aberto:</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">8 apontamentos</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Destino:</span>
                                    <span className="font-bold text-blue-600">Fila do RH</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => setOpenFechamento(true)}
                            className="w-full h-10 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white gap-2 shadow-xs"
                        >
                            <Lock className="h-3.5 w-3.5" /> Abrir Drawer Fechamento
                        </Button>
                    </div>
                </div>

                {/* 4. Console de Trilha de Ações Simuladas */}
                <div className="esc-card p-5 rounded-xl border border-border/80 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <DatabaseZap className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-bold text-foreground">Console de Interações Locais (In-Memory Log)</h3>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            Eventos gerados sem comunicação de rede
                        </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {logEventos.map((ev) => (
                            <div
                                key={ev.id}
                                className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs flex items-start gap-3"
                            >
                                <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                    [{ev.hora}]
                                </span>
                                <div className="space-y-0.5 flex-1">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                        <span>{ev.acao}</span>
                                    </div>
                                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                                        {ev.detalhes}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Renderização dos 3 Drawers Reais */}
                {/* Drawer 1: Reabertura */}
                <DrawerReaberturaDiarista
                    isOpen={openReabertura}
                    onClose={() => setOpenReabertura(false)}
                    lote={FIXTURE_LOTE_REABERTURA}
                    usuarioNome="Auditor de Homologação UI/UX"
                    onConfirm={handleSimulatedReabrir}
                    isSimulation={true}
                />

                {/* Drawer 2: Edição */}
                <DrawerEdicaoDiarista
                    isOpen={openEdicao}
                    onClose={() => setOpenEdicao(false)}
                    lancamento={FIXTURE_LANCAMENTO_EDICAO}
                    loteContext={FIXTURE_LOTE_CONTEXTO_EDICAO}
                    valorAnterior={FIXTURE_LANCAMENTO_EDICAO.valor_calculado}
                    onConfirm={handleSimulatedEditar}
                    isSimulation={true}
                />

                {/* Drawer 3: Fechamento */}
                <DrawerFechamentoDiarista
                    isOpen={openFechamento}
                    onClose={() => setOpenFechamento(false)}
                    empresaNome={FIXTURE_LOTE_REABERTURA.empresa.nome}
                    periodoInicio={FIXTURE_LOTE_REABERTURA.periodo_inicio}
                    periodoFim={FIXTURE_LOTE_REABERTURA.periodo_fim}
                    totalEmAberto={8}
                    onConfirm={handleSimulatedFechar}
                    isSimulation={true}
                />
            </div>
        </AppShell>
    );
};

export default DevDiaristasDrawersPreview;
