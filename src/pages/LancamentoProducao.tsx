import { useState, useMemo } from "react";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Zap,
    History,
    Save,
    Plus,
    Trash2,
    CheckCircle2,
    Clock,
    TrendingUp,
    Package,
    Truck,
    ListChecks,
    AlertCircle,
    User,
    Car,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    OperacaoService,
    EmpresaService,
    ColaboradorService,
    PerfilUsuarioService,
} from "@/services/base.service";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Tipos de Contrato ────────────────────────────────────────────────────────
const TIPOS_SERVICO = ["Carga", "Descarga", "Conferência", "Movimentação Interna"];

// ─── Regras de Logística por Função ──────────────────────────────────────────
type RegraAvaliacao = { id: string; label: string; funcoes: string[] };

const REGRAS_LOGISTICA: RegraAvaliacao[] = [
    // Geral (todas as funções)
    { id: "epi_capacete", label: "EPI: Uso de capacete", funcoes: ["*"] },
    { id: "epi_luvas", label: "EPI: Uso de luvas", funcoes: ["*"] },
    { id: "epi_calcado", label: "EPI: Calçado de segurança", funcoes: ["*"] },
    { id: "pontualidade", label: "Pontualidade na escala", funcoes: ["*"] },
    { id: "comportamento", label: "Comportamento e postura", funcoes: ["*"] },
    { id: "uniforme", label: "Uso do uniforme correto", funcoes: ["*"] },
    // Operacional de carga/descarga
    { id: "carga_integridade", label: "Integridade da carga", funcoes: ["Conferente", "Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "carga_empilhamento", label: "Empilhamento conforme norma", funcoes: ["Conferente", "Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "carga_segregacao", label: "Segregação correta de produto", funcoes: ["Conferente"] },
    { id: "nf_verificacao", label: "Verificação de NF/documento", funcoes: ["Conferente"] },
    // Veículos / motorista
    { id: "veiculo_inspecao", label: "Inspeção pré-operação do veículo", funcoes: ["Motorista", "Operador de Empilhadeira"] },
    { id: "veiculo_velocidade", label: "Limite de velocidade no pátio", funcoes: ["Motorista"] },
    { id: "veiculo_lacre", label: "Conferência de lacre/carga", funcoes: ["Motorista"] },
    // Segurança
    { id: "seg_plataforma", label: "Segurança em plataformas/rampas", funcoes: ["Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "seg_sinalizacao", label: "Respeito à sinalização do pátio", funcoes: ["*"] },
    { id: "seg_cnh", label: "CNH válida e habilitação adequada", funcoes: ["Motorista"] },
];

// Cargos que envolvem veículo (para mostrar campo de placa)
const CARGOS_COM_VEICULO = ["Motorista", "Operador de Empilhadeira"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type InfracaoMap = Record<string, boolean>;

const getRegrasPorFuncao = (cargo: string): RegraAvaliacao[] =>
    REGRAS_LOGISTICA.filter(r => r.funcoes.includes("*") || r.funcoes.includes(cargo));

// ─── Componente Principal ─────────────────────────────────────────────────────
const LancamentoProducao = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState({
        data: today,
        tipo_servico: "",
        transportadora: "",
        produto: "",
        quantidade: "",
        valor_unitario: "",
        empresa_id: "",
        colaborador_id: "",
        horario_inicio: "",
        horario_fim: "",
        placa_veiculo: "",
    });

    const [infracoes, setInfracoes] = useState<InfracaoMap>({});
    const [observacao, setObservacao] = useState("");
    const [showAvaliacao, setShowAvaliacao] = useState(false);

    // ── Perfil do usuário logado ──────────────────────────────────────────────
    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null),
        enabled: !!user?.id,
    });

    // ── Empresas ──────────────────────────────────────────────────────────────
    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // ── Auto-selecionar empresa ───────────────────────────────────────────────
    useMemo(() => {
        if (!form.empresa_id) {
            if (perfil?.empresa_id) {
                setForm(prev => ({ ...prev, empresa_id: perfil.empresa_id }));
            } else if (empresas.length > 0) {
                setForm(prev => ({ ...prev, empresa_id: empresas[0]?.id }));
            }
        }
    }, [perfil, empresas]);

    // ── Colaboradores (Intermitente = "Hora", Produção = "Operação") ──────────
    const { data: colaboradoresRaw = [] } = useQuery({
        queryKey: ["colaboradores_producao", form.empresa_id],
        queryFn: () => ColaboradorService.getWithEmpresa(form.empresa_id || undefined),
        enabled: !!form.empresa_id,
    });

    const colaboradoresFiltrados = useMemo(() =>
        (colaboradoresRaw as any[]).filter((c: any) =>
            (c.tipo_contrato === "Hora" || c.tipo_contrato === "Operação") &&
            c.status !== "inativo" && !c.deleted_at
        ), [colaboradoresRaw]
    );

    const colaboradorSelecionado = useMemo(() =>
        (colaboradoresRaw as any[]).find((c: any) => c.id === form.colaborador_id),
        [colaboradoresRaw, form.colaborador_id]
    );

    const cargoAtual: string = colaboradorSelecionado?.cargo ?? "";
    const exibirPlaca = CARGOS_COM_VEICULO.some(c => cargoAtual.toLowerCase().includes(c.toLowerCase()));
    const regrasAtuais = cargoAtual ? getRegrasPorFuncao(cargoAtual) : [];

    // ── Histórico do dia ──────────────────────────────────────────────────────
    const { data: historico = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ["producao_recente", form.empresa_id],
        queryFn: () => OperacaoService.getByDate(today, form.empresa_id),
        enabled: !!form.empresa_id,
    });

    // ── Mutação de criação ────────────────────────────────────────────────────
    const mutation = useMutation({
        mutationFn: (payload: any) => OperacaoService.create(payload),
        onSuccess: () => {
            toast.success("Produção registrada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            setForm(prev => ({
                ...prev,
                quantidade: "",
                produto: "",
                transportadora: "",
                colaborador_id: "",
                horario_inicio: "",
                horario_fim: "",
                placa_veiculo: "",
            }));
            setInfracoes({});
            setObservacao("");
            setShowAvaliacao(false);
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
    });

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.tipo_servico || !form.quantidade || !form.empresa_id) {
            toast.error("Preencha os campos obrigatórios");
            return;
        }

        // Montar o JSON de avaliação
        const avaliacaoJson = regrasAtuais.length > 0 ? {
            cargo_avaliado: cargoAtual,
            infracoes: Object.entries(infracoes)
                .filter(([, v]) => v)
                .map(([id]) => REGRAS_LOGISTICA.find(r => r.id === id)?.label ?? id),
            observacao: observacao.trim() || null,
            total_infracoes: Object.values(infracoes).filter(Boolean).length,
            total_regras: regrasAtuais.length,
        } : null;

        // Desestruturamos colaborador_id fora do spread — a coluna na tabela é responsavel_id
        const { colaborador_id, ...formSemColabId } = form;

        mutation.mutate({
            ...formSemColabId,
            quantidade: Number(form.quantidade),
            valor_unitario: Number(form.valor_unitario) || 0,
            responsavel_id: colaborador_id || null,
            horario_inicio: form.horario_inicio || null,
            horario_fim: form.horario_fim || null,
            placa_veiculo: form.placa_veiculo || null,
            avaliacao_json: avaliacaoJson,
            status: "pendente",
            origem_dado: "manual",
        });
    };

    const currentUnitName = empresas.find((e: any) => e.id === form.empresa_id)?.nome;

    const infracoesCount = Object.values(infracoes).filter(Boolean).length;

    return (
        <OperationalShell
            title="Produção In-Loco"
            unitName={currentUnitName || "Sincronizando..."}
        >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Banner informativo */}
                <div className="xl:col-span-12">
                    <Card className="p-3 bg-brand/5 border-brand/20 shadow-none mb-0">
                        <div className="flex items-center gap-3 text-brand text-sm font-bold">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Registros imediatos de carga, descarga e movimentações. Vincule o colaborador e registre a avaliação de conduta.
                        </div>
                    </Card>
                </div>

                {/* ── Formulário Principal ── */}
                <div className="xl:col-span-5 space-y-4">
                    <Card className="p-6 border-border shadow-sm">
                        <h3 className="text-lg font-black font-display text-foreground mb-5 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-brand" />
                            Novo Registro
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Empresa */}
                            <div className="space-y-1.5">
                                <Label>Empresa / Unidade</Label>
                                <Select value={form.empresa_id} onValueChange={v => setForm({ ...form, empresa_id: v, colaborador_id: "" })}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Selecione a unidade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(empresas as any[]).map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Data + Tipo de Serviço */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Data</Label>
                                    <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="h-11 rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tipo de Serviço <span className="text-destructive">*</span></Label>
                                    <Select value={form.tipo_servico} onValueChange={v => setForm({ ...form, tipo_servico: v })}>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIPOS_SERVICO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Horário de Entrada / Saída */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Entrada (ponto)</Label>
                                    <Input type="time" value={form.horario_inicio} onChange={e => setForm({ ...form, horario_inicio: e.target.value })} className="h-11 rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Saída (ponto)</Label>
                                    <Input type="time" value={form.horario_fim} onChange={e => setForm({ ...form, horario_fim: e.target.value })} className="h-11 rounded-xl" />
                                </div>
                            </div>

                            {/* Colaborador */}
                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    Colaborador (Intermitente / Produção)
                                </Label>
                                <Select
                                    value={form.colaborador_id}
                                    onValueChange={v => {
                                        setForm({ ...form, colaborador_id: v });
                                        setInfracoes({});
                                        setShowAvaliacao(false);
                                    }}
                                    disabled={!form.empresa_id}
                                >
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder={!form.empresa_id ? "Selecione a empresa antes" : "Selecione o colaborador"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel className="text-[10px] font-bold uppercase text-muted-foreground">Intermitente (Hora)</SelectLabel>
                                            {colaboradoresFiltrados
                                                .filter((c: any) => c.tipo_contrato === "Hora")
                                                .map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        <span className="font-medium">{c.nome}</span>
                                                        <span className="text-muted-foreground text-xs ml-2">· {c.cargo}</span>
                                                    </SelectItem>
                                                ))}
                                        </SelectGroup>
                                        <SelectGroup>
                                            <SelectLabel className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Produção (Operação)</SelectLabel>
                                            {colaboradoresFiltrados
                                                .filter((c: any) => c.tipo_contrato === "Operação")
                                                .map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        <span className="font-medium">{c.nome}</span>
                                                        <span className="text-muted-foreground text-xs ml-2">· {c.cargo}</span>
                                                    </SelectItem>
                                                ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {colaboradorSelecionado && (
                                    <p className="text-[11px] text-muted-foreground pl-1">
                                        Função: <span className="font-semibold text-foreground">{cargoAtual}</span>
                                        {" · "}
                                        {colaboradorSelecionado.tipo_contrato === "Hora" ? "Intermitente" : "Produção"}
                                    </p>
                                )}
                            </div>

                            {/* Placa do Veículo (exibe se cargo tem veículo) */}
                            {exibirPlaca && (
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5" />
                                        Placa do Veículo / Equipamento
                                    </Label>
                                    <Input
                                        placeholder="Ex: ABC-1234 ou Emp.01"
                                        value={form.placa_veiculo}
                                        onChange={e => setForm({ ...form, placa_veiculo: e.target.value.toUpperCase() })}
                                        className="h-11 rounded-xl font-mono uppercase"
                                        maxLength={10}
                                    />
                                </div>
                            )}

                            {/* Transportadora */}
                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Transportadora / Cliente</Label>
                                <Input
                                    placeholder="Ex: Translog, Geral..."
                                    value={form.transportadora}
                                    onChange={e => setForm({ ...form, transportadora: e.target.value })}
                                    className="h-11 rounded-xl"
                                />
                            </div>

                            {/* Produto */}
                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />Produto / Carga</Label>
                                <Input
                                    placeholder="Ex: Alimentos, Eletrônicos..."
                                    value={form.produto}
                                    onChange={e => setForm({ ...form, produto: e.target.value })}
                                    className="h-11 rounded-xl"
                                />
                            </div>

                            {/* Quantidade + Valor */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Quantidade <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={form.quantidade}
                                        onChange={e => setForm({ ...form, quantidade: e.target.value })}
                                        className="h-11 rounded-xl text-center font-bold text-lg"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor Unitário (Opt.)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0,00"
                                        value={form.valor_unitario}
                                        onChange={e => setForm({ ...form, valor_unitario: e.target.value })}
                                        className="h-11 rounded-xl text-right font-display"
                                    />
                                </div>
                            </div>

                            {/* ── Seção de Avaliação ── */}
                            {form.colaborador_id && regrasAtuais.length > 0 && (
                                <div className="rounded-xl border border-border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowAvaliacao(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                                    >
                                        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                                            <ShieldAlert className={cn("w-4 h-4", infracoesCount > 0 ? "text-destructive" : "text-muted-foreground")} />
                                            Avaliação de Conduta
                                            {infracoesCount > 0 && (
                                                <span className="bg-destructive text-destructive-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                                    {infracoesCount} infração{infracoesCount > 1 ? "ões" : ""}
                                                </span>
                                            )}
                                        </span>
                                        {showAvaliacao ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>

                                    {showAvaliacao && (
                                        <div className="p-4 space-y-3 bg-background">
                                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                                                Regras aplicadas para: <span className="text-foreground font-bold">{cargoAtual}</span>
                                            </p>
                                            <div className="space-y-2">
                                                {regrasAtuais.map(regra => (
                                                    <label
                                                        key={regra.id}
                                                        className={cn(
                                                            "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all select-none",
                                                            infracoes[regra.id]
                                                                ? "border-destructive/40 bg-destructive/5 text-destructive"
                                                                : "border-border hover:border-border/70 hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={!!infracoes[regra.id]}
                                                            onChange={e => setInfracoes(prev => ({ ...prev, [regra.id]: e.target.checked }))}
                                                            className="w-4 h-4 rounded accent-destructive cursor-pointer"
                                                        />
                                                        <span className="text-sm font-medium leading-tight">{regra.label}</span>
                                                    </label>
                                                ))}
                                            </div>

                                            <div className="space-y-1.5 pt-1">
                                                <Label className="text-xs">Observação / Descrição da infração</Label>
                                                <Textarea
                                                    placeholder="Descreva os detalhes relevantes..."
                                                    value={observacao}
                                                    onChange={e => setObservacao(e.target.value)}
                                                    className="rounded-xl text-sm resize-none"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-brand hover:bg-brand/90 font-black text-lg shadow-lg shadow-brand/20 mt-2 gap-2"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? "Salvando..." : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Registrar Produção
                                    </>
                                )}
                            </Button>
                        </form>
                    </Card>

                    {/* Resumo */}
                    <Card className="p-5 bg-secondary/20 border-dashed border-border shadow-none">
                        <h4 className="font-bold text-sm text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Resumo de Hoje
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Registros</span>
                                <span className="text-2xl font-black text-foreground">{(historico as any[]).length}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Total Estimado</span>
                                <span className="text-xl font-black text-brand">
                                    {formatCurrency((historico as any[]).reduce((acc, cur) => acc + (Number(cur.quantidade) * Number(cur.valor_unitario || 0)), 0))}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── Histórico Recente ── */}
                <div className="xl:col-span-7 space-y-6">
                    <Card className="border-border shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-black font-display text-foreground flex items-center gap-2 text-lg">
                                <History className="w-5 h-5 text-muted-foreground" />
                                Lançamentos do Dia
                            </h3>
                            <span className="text-[10px] font-bold bg-background px-3 py-1 rounded-full border border-border">{today}</span>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {isLoadingHistory ? (
                                <div className="p-20 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                    <Clock className="w-8 h-8 animate-pulse opacity-20" />
                                    Carregando histórico...
                                </div>
                            ) : (historico as any[]).length === 0 ? (
                                <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                        <Plus className="w-8 h-8 opacity-20" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground">Nenhuma produção lançada hoje.</p>
                                        <p className="text-sm">Inicie um novo registro no formulário ao lado.</p>
                                    </div>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                                            <TableHead className="font-bold text-[10px] uppercase">Colaborador / Serviço</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Horário</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Placa</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-center">Qtd</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Valor</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-center">Avl.</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(historico as any[]).map((h: any) => {
                                            const avl = h.avaliacao_json;
                                            const temInfracoes = avl && avl.total_infracoes > 0;
                                            return (
                                                <TableRow key={h.id} className="border-border hover:bg-muted/30 group transition-colors">
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-success" />
                                                            <div>
                                                                <span className="font-bold text-sm block">{h.tipo_servico}</span>
                                                                {h.colaboradores && (
                                                                    <span className="text-[10px] text-muted-foreground">{h.colaboradores.nome}</span>
                                                                )}
                                                                {h.transportadora && (
                                                                    <span className="text-[10px] text-muted-foreground block">{h.transportadora}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5 ml-4">
                                                            {format(new Date(h.created_at), "HH:mm")}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                                        {h.horario_inicio && h.horario_fim
                                                            ? `${h.horario_inicio.slice(0, 5)} – ${h.horario_fim.slice(0, 5)}`
                                                            : h.horario_inicio
                                                                ? `E: ${h.horario_inicio.slice(0, 5)}`
                                                                : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono font-bold">{h.placa_veiculo || "—"}</TableCell>
                                                    <TableCell className="text-center font-black">{h.quantidade}</TableCell>
                                                    <TableCell className="text-right font-display font-bold text-sm">
                                                        {formatCurrency(Number(h.quantidade) * Number(h.valor_unitario || 0))}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {avl ? (
                                                            <span
                                                                title={temInfracoes ? avl.infracoes?.join(", ") : "Sem infrações"}
                                                                className={cn(
                                                                    "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                                                                    temInfracoes
                                                                        ? "bg-destructive/10 text-destructive"
                                                                        : "bg-success/10 text-success"
                                                                )}
                                                            >
                                                                {temInfracoes ? `${avl.total_infracoes}✗` : "✓"}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-[10px]">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-all"
                                                            onClick={() => {
                                                                if (confirm("Deseja remover este registro?")) {
                                                                    OperacaoService.delete(h.id).then(() => {
                                                                        toast.success("Registro removido");
                                                                        queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <div className="p-4 bg-muted/10 border-t border-border mt-auto">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                    Dados Sincronizados
                                </div>
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <ListChecks className="w-3.5 h-3.5 text-brand" />
                                    Disponível em tempo real no painel global
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </OperationalShell>
    );
};

export default LancamentoProducao;
