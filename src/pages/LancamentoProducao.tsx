import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Car,
    CheckCircle2,
    Clock,
    History,
    ListChecks,
    Package,
    Plus,
    Save,
    ShieldAlert,
    Trash2,
    TrendingUp,
    Truck,
    Wallet,
    Users,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    Minus,
} from "lucide-react";

import { OperationalShell } from "@/components/layout/OperationalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import {
    ColaboradorService,
    ConfiguracaoOperacionalService,
    CustoExtraOperacionalService,
    type EncarregadoColaboradorFiltroConfig,
    ServicosExtrasOperacionaisService,
    EmpresaService,
    RegrasFinanceirasService,
    RegrasDadosService,
    RegrasModulosService,
    FormaPagamentoOperacionalService,
    FornecedorService,
    FornecedorValorServicoService,
    OperacaoProducaoService,
    PerfilUsuarioService,
    ProdutoCargaService,
    RegraOperacionalService,
    TipoServicoOperacionalService,
    TransportadoraClienteService,
    UnidadeOperacionalService,
} from "@/services/base.service";
import { calcularValoresOperacao } from "@/utils/financeiro";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type RegraAvaliacao = { id: string; label: string; funcoes: string[] };
type TipoCalculo = "volume" | "daily" | "operation" | "colaborador";
type StatusLancamento = "Processado" | "Pendente" | "Com alerta" | "Aguardando validação" | "Bloqueado";
type LookupOption = { id: string; nome: string };
type RuleLookupState = "idle" | "loading" | "found" | "missing" | "error" | "duplicate" | "needs_product";
type EtapaFormulario = 1 | 2 | 3 | 4;
type TipoLancamento = "operacao_padrao" | "transbordo_servico_extra" | "custos_extras";
type ModalidadeFinanceiraForm = "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL" | "CUSTO_DESPESA";
type CondutaColaborador = {
    selected: boolean;
    hadInfraction: boolean;
    infractionTypes: string[];
    notes: string;
};

type FormState = {
    tipo_lancamento: TipoLancamento | "";
    modalidade_financeira: ModalidadeFinanceiraForm | "";
    data: string;
    empresa_id: string;
    unidade_id: string;
    tipo_servico: string;
    descricao_servico: string;
    quantidade_colaboradores: string;
    transportadora: string;
    fornecedor: string;
    produto: string;
    quantidade: string;
    valor_unitario: string;
    valor_unitario_manual: string;
    valor_unitario_filme: string;
    quantidade_filme: string;
    forma_pagamento: string;
    horario_inicio: string;
    horario_fim: string;
    placa_veiculo: string;
    justificativa_data: string;
    nf_emite: boolean;
    nf_numero: string;
    ctrc: string;
    observacao: string;
    responsavel_nome: string;
    data_vencimento: string;
    status_financeiro: string;
    categoria_custo: string;
    categoria_servico: string;
    regra_financeira: any;
};

const REGRAS_LOGISTICA: RegraAvaliacao[] = [
    { id: "epi_capacete", label: "EPI: Uso de capacete", funcoes: ["*"] },
    { id: "epi_luvas", label: "EPI: Uso de luvas", funcoes: ["*"] },
    { id: "epi_calcado", label: "EPI: Calçado de segurança", funcoes: ["*"] },
    { id: "pontualidade", label: "Pontualidade na escala", funcoes: ["*"] },
    { id: "comportamento", label: "Comportamento e postura", funcoes: ["*"] },
    { id: "uniforme", label: "Uso do uniforme correto", funcoes: ["*"] },
    { id: "carga_integridade", label: "Integridade da carga", funcoes: ["Conferente", "Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "carga_empilhamento", label: "Empilhamento conforme norma", funcoes: ["Conferente", "Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "carga_segregacao", label: "Segregação correta de produto", funcoes: ["Conferente"] },
    { id: "nf_verificacao", label: "Verificação de NF/documento", funcoes: ["Conferente"] },
    { id: "veiculo_inspecao", label: "Inspeção pré-operação do veículo", funcoes: ["Motorista", "Operador de Empilhadeira"] },
    { id: "veiculo_velocidade", label: "Limite de velocidade no pátio", funcoes: ["Motorista"] },
    { id: "veiculo_lacre", label: "Conferência de lacre/carga", funcoes: ["Motorista"] },
    { id: "seg_plataforma", label: "Segurança em plataformas/rampas", funcoes: ["Auxiliar de Logística", "Operador de Empilhadeira"] },
    { id: "seg_sinalizacao", label: "Respeito à sinalização do pátio", funcoes: ["*"] },
    { id: "seg_cnh", label: "CNH válida e habilitação adequada", funcoes: ["Motorista"] },
];

const CARGOS_COM_VEICULO = ["Motorista", "Operador de Empilhadeira"];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const REGRA_MENSAGEM_SEM_CADASTRO = "Nenhuma regra operacional compatível foi encontrada. Solicite ao Admin ou Financeiro a revisão do cadastro.";
const REGRA_MENSAGEM_DUPLICADA = "Existem regras duplicadas para esta combinação. Solicite revisão ao Financeiro.";
const REGRA_MENSAGEM_PRODUTO = "Selecione o produto/carga para localizar a regra operacional.";
const REGRA_MENSAGEM_ERRO = "Houve um erro na busca da regra operacional. Tente novamente.";

const getRegrasPorFuncao = (cargo: string): RegraAvaliacao[] =>
    REGRAS_LOGISTICA.filter((regra) => regra.funcoes.includes("*") || regra.funcoes.includes(cargo));

const getTipoCalculoLabel = (tipo: TipoCalculo | null) => {
    if (tipo === "daily") return "Por diária";
    if (tipo === "operation") return "Por operação";
    if (tipo === "colaborador") return "Por colaborador";
    if (tipo === "volume") return "Por volume";
    return "Não definido";
};

const getQuantidadeLabel = (tipo: TipoCalculo | null) => {
    if (tipo === "daily") return "Quantidade de diárias";
    if (tipo === "operation") return "Quantidade de operações";
    if (tipo === "colaborador") return "Quantidade de colaboradores";
    return "Quantidade de volumes";
};

const getQuantidadePlaceholder = (tipo: TipoCalculo | null) => (tipo === "operation" ? "1" : "0");

const matchesOptionalContext = (ruleValue?: string | null, formValue?: string | null) =>
    !ruleValue || ruleValue === formValue;

type TimePickerFieldProps = {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
};

const TimePickerField = ({ label, value, onChange }: TimePickerFieldProps) => {
    const [open, setOpen] = useState(false);

    const isEntrada = label.toLowerCase().includes("entrada");
    const hasValue = !!value;

    const handleNow = () => {
        const now = new Date();
        const nextValue = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        onChange(nextValue);
        setOpen(false);
    };

    const [hourValue, minuteValue] = value?.includes(":") ? value.split(":") : ["", ""];

    const applyTime = (nextHour: string, nextMinute: string) => {
        if (!nextHour || !nextMinute) return;
        onChange(`${nextHour}:${nextMinute}`);
    };

    const handleHourSelect = (nextHour: string) => {
        if (minuteValue) {
            applyTime(nextHour, minuteValue);
            return;
        }
        onChange(`${nextHour}:00`);
    };

    const handleMinuteSelect = (nextMinute: string) => {
        if (hourValue) {
            applyTime(hourValue, nextMinute);
            setOpen(false);
            return;
        }
        onChange(`00:${nextMinute}`);
        setOpen(false);
    };

    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {label}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        className={cn(
                            "h-14 w-full rounded-xl justify-between px-4 font-mono text-lg transition-all active:scale-[0.98]",
                            hasValue
                                ? "bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100"
                                : "bg-orange-50 border-2 border-orange-400 text-orange-700 hover:bg-orange-100"
                        )}
                    >
                        {hasValue ? (
                            <>
                                <span className="font-bold">{value}</span>
                                <Clock className="w-5 h-5 text-green-600" />
                            </>
                        ) : (
                            <>
                                <span className="font-black text-sm uppercase tracking-wide">
                                    {isEntrada ? "INICIAR" : "FINALIZAR"}
                                </span>
                                <Clock className="w-5 h-5 text-orange-600" />
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[280px] rounded-2xl p-0 overflow-hidden">
                    <div className="border-b px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">Escolha a hora e os minutos do ponto.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-0">
                        <div className="border-r">
                            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Hora
                            </div>
                            <ScrollArea className="h-56">
                                <div className="p-2 space-y-1">
                                    {HOUR_OPTIONS.map((hour) => (
                                        <Button
                                            key={hour}
                                            type="button"
                                            variant={hourValue === hour ? "default" : "ghost"}
                                            className="w-full justify-center rounded-lg font-mono"
                                            onClick={() => handleHourSelect(hour)}
                                        >
                                            {hour}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <div>
                            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Minuto
                            </div>
                            <ScrollArea className="h-56">
                                <div className="p-2 space-y-1">
                                    {MINUTE_OPTIONS.map((minute) => (
                                        <Button
                                            key={minute}
                                            type="button"
                                            variant={minuteValue === minute ? "default" : "ghost"}
                                            className="w-full justify-center rounded-lg font-mono"
                                            onClick={() => handleMinuteSelect(minute)}
                                        >
                                            {minute}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t p-3">
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                            Limpar
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleNow}>
                            Agora
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

const getUnidadeRegraLabel = (tipo: TipoCalculo | null) => {
    if (tipo === "daily") return "diária";
    if (tipo === "operation") return "operação";
    if (tipo === "colaborador") return "colaborador";
    return "volume";
};

const LANCAMENTO_PRESETS: Array<{
    id: string;
    tipo_lancamento: TipoLancamento;
    modalidade_financeira: ModalidadeFinanceiraForm;
    title: string;
    description: string;
    icon: typeof Wallet;
    iconColor?: string;
}> = [
        {
            id: "preset_caixa",
            tipo_lancamento: "operacao_padrao",
            modalidade_financeira: "CAIXA_IMEDIATO",
            title: "Recebimento Imediato",
            description: "Operações com recebimento imediato.",
            icon: Truck,
            iconColor: "bg-success-soft text-success-strong",
        },
        {
            id: "preset_boleto",
            tipo_lancamento: "operacao_padrao",
            modalidade_financeira: "DUPLICATA",
            title: "Pagamento a Prazo",
            description: "Operações com recebimento futuro.",
            icon: ListChecks,
            iconColor: "bg-info-soft text-info-strong",
        },
        {
            id: "preset_dismelo",
            tipo_lancamento: "operacao_padrao",
            modalidade_financeira: "FATURAMENTO_MENSAL",
            title: "Faturamento Mensal",
            description: "Operações para faturamento mensal.",
            icon: Wallet,
            iconColor: "bg-warning-soft text-warning-strong",
        },
        {
            id: "preset_transbordo",
            tipo_lancamento: "transbordo_servico_extra",
            modalidade_financeira: "CAIXA_IMEDIATO",
            title: "Serviços Extras",
            description: "Registro de serviços adicionais.",
            icon: Package,
            iconColor: "bg-purple-100 text-purple-700",
        },
        {
            id: "preset_custos_mensais",
            tipo_lancamento: "custos_extras",
            modalidade_financeira: "CUSTO_DESPESA",
            title: "Custos/Despesas",
            description: "Registro de custos operacionais.",
            icon: Building2,
            iconColor: "bg-orange-100 text-orange-700",
        },
        {
            id: "preset_diaristas",
            tipo_lancamento: "custos_extras",
            modalidade_financeira: "CUSTO_DESPESA",
            title: "Diaristas",
            description: "Lançamento de diárias avulsas.",
            icon: Users,
            iconColor: "bg-teal-100 text-teal-700",
        },
    ];

const FINALIDADES_LANCAMENTO: Array<{
    id: TipoLancamento;
    title: string;
    description: string;
    helper: string;
}> = [
        {
            id: "operacao_padrao",
            title: "Operação padrão",
            description: "Carga, descarga e movimentações da operação principal.",
            helper: "Substitui Caixa, Duplicata Fornecedores e Duplicata a Volume Dismelo.",
        },
        {
            id: "transbordo_servico_extra",
            title: "Transbordo e serviço extra",
            description: "Serviços extras ligados a transbordo e apoio operacional.",
            helper: "Liquidação em depósito imediato.",
        },
        {
            id: "custos_extras",
            title: "Custos extras e equipe",
            description: "Diaristas, carteira assinada e despesas complementares.",
            helper: "Fluxo dedicado para custos fora da operação padrão.",
        },
    ];

const getFinalidadeMeta = (tipo: TipoLancamento | "") =>
    FINALIDADES_LANCAMENTO.find((item) => item.id === tipo) ?? null;

const getModalidadeFinanceiraLabel = (modalidade: ModalidadeFinanceiraForm | "", regras?: any[]) => {
    if (regras && regras.length > 0) {
        const regra = regras.find(r => r.modalidade_financeira === modalidade);
        if (regra) return regra.nome;
    }
    if (modalidade === "CAIXA_IMEDIATO") return "Pagamento à Vista (Caixa)";
    if (modalidade === "DUPLICATA") return "Pagamento a Prazo (Boleto)";
    if (modalidade === "FATURAMENTO_MENSAL") return "Faturamento Mensal";
    if (modalidade === "CUSTO_DESPESA") return "Lançamento de Custos";
    return "Não definido";
};

const calcularTotalPrevisto = ({
    quantidade,
    quantidadeColaboradores,
    valorUnitario,
    tipoCalculo,
}: {
    quantidade: number;
    quantidadeColaboradores: number;
    valorUnitario: number;
    tipoCalculo: TipoCalculo | null;
}) => {
    if (!valorUnitario || !tipoCalculo) return 0;
    if (tipoCalculo === "operation") return valorUnitario;
    return quantidade * valorUnitario;
};

const getStatusVariant = (status: string) => {
    if (status === "Processado" || status === "Recebido" || status === "recebido") return "success" as const;
    if (status === "Com alerta") return "warning" as const;
    if (status === "Aguardando validação") return "info" as const;
    if (status === "Bloqueado") return "error" as const;
    return "secondary" as const;
};

const normalizeTipoContrato = (tipo: string | null | undefined) =>
    (tipo ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const mapToLookupOptions = (items: any[] | undefined) =>
    (items ?? []).map((item: any) => ({ id: item.id, nome: item.nome }));

const normalizeText = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(ltda|me|eireli|sa|s\/a|geral|carga|produto)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

const parseIsoDateLike = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return "";
    return normalized.slice(0, 10);
};

const getRuleDataValue = (dados: Record<string, unknown> | undefined, ...keys: string[]) => {
    if (!dados) return undefined;

    for (const key of keys) {
        const directValue = dados[key];
        if (directValue !== undefined) return directValue;
    }

    const normalizedEntries = Object.entries(dados).map(([key, value]) => [normalizeText(key), value] as const);
    for (const key of keys) {
        const normalizedKey = normalizeText(key);
        const found = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
        if (found) return found[1];
    }

    return undefined;
};

const normalizePercentualDecimal = (value: unknown) => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
    return numericValue > 1 ? numericValue / 100 : numericValue;
};

const PRESETS_PERMITIDOS_POR_PERFIL: Record<string, string[]> = {
    encarregado_diaristas: ["preset_diaristas"],
};

const PRESET_ROTAS: Record<string, string> = {
    preset_diaristas: "/producao/diaristas",
};

const resolveFilterConfigKey = (presetId: string) =>
    ["preset_caixa", "preset_boleto", "preset_dismelo"].includes(presetId)
        ? "grupo_volume"
        : presetId;

const DEFAULT_FILTROS_COLABORADORES_ENCARREGADO: Record<string, EncarregadoColaboradorFiltroConfig> = {
    grupo_volume: {
        ativo: true,
        sem_equipe: false,
        campo_filtro: "tipo_contrato",
        valores_filtro: ["Operação"],
        filtrar_por_empresa: true,
        somente_ativos: true,
        somente_cadastro_completo: true,
        excluir_cadastro_provisorio: true,
    },
    preset_diaristas: {
        ativo: true,
        sem_equipe: false,
        campo_filtro: "tipo_colaborador",
        valores_filtro: ["DIARISTA"],
        filtrar_por_empresa: true,
        somente_ativos: true,
        exigir_permitir_lancamento_operacional: true,
    },
    preset_custos_mensais: {
        ativo: true,
        sem_equipe: false,
        filtrar_por_empresa: true,
        somente_ativos: true,
    },
    preset_transbordo: {
        ativo: true,
        sem_equipe: true,
        filtrar_por_empresa: true,
        somente_ativos: true,
    },
};

const resolveFiltroColaboradoresPreset = (
    presetId: string,
    configurado?: EncarregadoColaboradorFiltroConfig | null,
): EncarregadoColaboradorFiltroConfig => {
    const fallback = DEFAULT_FILTROS_COLABORADORES_ENCARREGADO[presetId] ?? {
        ativo: true,
        sem_equipe: false,
        filtrar_por_empresa: true,
        somente_ativos: true,
    };

    const merged = {
        ...fallback,
        ...(configurado ?? {}),
        valores_filtro: configurado?.valores_filtro ?? fallback.valores_filtro ?? [],
        tipos_colaborador_permitidos: configurado?.tipos_colaborador_permitidos ?? fallback.tipos_colaborador_permitidos ?? [],
        regimes_trabalho_permitidos: configurado?.regimes_trabalho_permitidos ?? fallback.regimes_trabalho_permitidos ?? [],
        modelos_calculo_permitidos: configurado?.modelos_calculo_permitidos ?? fallback.modelos_calculo_permitidos ?? [],
        tipos_contrato_permitidos: configurado?.tipos_contrato_permitidos ?? fallback.tipos_contrato_permitidos ?? [],
    };

    if (merged.campo_filtro === "tipo_colaborador") {
        merged.tipos_colaborador_permitidos = merged.valores_filtro ?? [];
        merged.tipos_contrato_permitidos = [];
    }

    if (merged.campo_filtro === "tipo_contrato") {
        merged.tipos_contrato_permitidos = merged.valores_filtro ?? [];
        merged.tipos_colaborador_permitidos = [];
    }

    if (merged.ativo === false) {
        return {
            ativo: false,
            sem_equipe: false,
            filtrar_por_empresa: true,
            somente_ativos: true,
            somente_cadastro_completo: false,
            excluir_cadastro_provisorio: false,
            tipos_colaborador_permitidos: [],
            regimes_trabalho_permitidos: [],
            modelos_calculo_permitidos: [],
            tipos_contrato_permitidos: [],
            exigir_permitir_lancamento_operacional: false,
        };
    }

    return merged;
};

const LancamentoProducao = () => {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState<FormState & { preset_id: string }>({
        preset_id: "",
        tipo_lancamento: "",
        modalidade_financeira: "",
        categoria_servico: "",
        data: today,
        regra_financeira: null as any,
        empresa_id: "",
        unidade_id: "",
        tipo_servico: "",
        descricao_servico: "",
        quantidade_colaboradores: "1",
        transportadora: "",
        fornecedor: "",
        produto: "",
        quantidade: "",
        valor_unitario: "",
        valor_unitario_manual: "",
        valor_unitario_filme: "",
        quantidade_filme: "",
        forma_pagamento: "",
        horario_inicio: "",
        horario_fim: "",
        placa_veiculo: "",
        justificativa_data: "",
        nf_emite: false,
        nf_numero: "",
        ctrc: "",
        observacao: "",
        responsavel_nome: "",
        data_vencimento: "",
        status_financeiro: "PENDENTE",
        categoria_custo: "OPERACIONAL",
    });
    const [etapaAtual, setEtapaAtual] = useState<EtapaFormulario>(1);
    const [condutaColaboradores, setCondutaColaboradores] = useState<Record<string, CondutaColaborador>>({});
    const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
    const [produtoDraft, setProdutoDraft] = useState({ nome: "", categoria: "" });
    const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [bannerExpandido, setBannerExpandido] = useState(false);
    const [cancelItemId, setCancelItemId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const touchRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await OperacaoProducaoService.getProfile(user.id);
            return data;
        },
        enabled: !!user?.id,
    });

    const perfisPermitidosGrid = useMemo(() => {
        const perfilRoles = perfil?.role?.toLowerCase() ?? "";
        // Extract names of profiles if it's an array of objects
        const roleNomes = Array.isArray(perfil?.perfis) ? perfil.perfis.map((p: any) => p.nome?.toLowerCase()) : [perfilRoles];
        const hasEncarregadoDiarista = roleNomes.includes("encarregado_diaristas");

        return LANCAMENTO_PRESETS.map((preset) => {
            let isAllowed = true;
            if (hasEncarregadoDiarista) {
                const liberados = PRESETS_PERMITIDOS_POR_PERFIL["encarregado_diaristas"] ?? [];
                isAllowed = liberados.includes(preset.id);
            }
            return { preset, isAllowed };
        });
    }, [perfil]);

    const { data: empresas = [], isLoading: isLoadingEmpresas, error: empresasError } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
        staleTime: 0,
        retry: 1,
    });

    const { data: schemaDisponivel = false, isLoading: isCheckingSchema } = useQuery({
        queryKey: ["producao_schema_disponivel"],
        queryFn: () => OperacaoProducaoService.isAvailable().catch(() => false),
    });

    useEffect(() => {
        if (form.empresa_id) return;
        if ((perfil as any)?.empresa_id) {
            setForm((prev) => ({ ...prev, empresa_id: (perfil as any).empresa_id }));
            return;
        }
        if ((empresas as any[]).length > 0) {
            setForm((prev) => ({ ...prev, empresa_id: (empresas as any[])[0].id }));
        }
    }, [perfil, empresas, form.empresa_id]);

    const { data: unidadesDb = [] } = useQuery({
        queryKey: ["unidades_operacionais", form.empresa_id],
        queryFn: () => UnidadeOperacionalService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    useEffect(() => {
        if (form.unidade_id) return;
        if ((unidadesDb as any[]).length > 0) {
            setForm((prev) => ({ ...prev, unidade_id: (unidadesDb as any[])[0].id }));
        }
    }, [unidadesDb, form.unidade_id]);

    const { data: configuracaoOperacional = null } = useQuery({
        queryKey: ["config_operacional", form.empresa_id],
        queryFn: () => ConfiguracaoOperacionalService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id,
    });

    const filtroColaboradoresPreset = useMemo(() => {
        const configKey = resolveFilterConfigKey(form.preset_id);
        const mapa = configuracaoOperacional?.filtros_colaboradores_encarregado as Record<string, EncarregadoColaboradorFiltroConfig> | undefined;
        return resolveFiltroColaboradoresPreset(configKey, mapa?.[configKey]);
    }, [configuracaoOperacional, form.preset_id]);

    const { data: colaboradoresRaw = [] } = useQuery({
        queryKey: ["colaboradores_producao", form.empresa_id, form.preset_id, JSON.stringify(filtroColaboradoresPreset)],
        queryFn: () => {
            if (!form.empresa_id) return Promise.resolve([]);
            if (filtroColaboradoresPreset.sem_equipe) {
                return Promise.resolve([]);
            }
            return ColaboradorService.getByEmpresaWithOperationalFilters(form.empresa_id, filtroColaboradoresPreset);
        },
        enabled: !!form.empresa_id && Boolean(form.preset_id),
    });

    const { data: tiposServicoDb = [], isLoading: isLoadingTipos } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
        enabled: schemaDisponivel,
        staleTime: 5 * 60 * 1000,
    });

    const { data: transportadorasDb = [] } = useQuery({
        queryKey: ["transportadoras_clientes", form.empresa_id],
        queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id && schemaDisponivel,
        staleTime: 5 * 60 * 1000,
    });

    const { data: fornecedoresDb = [] } = useQuery({
        queryKey: ["fornecedores_operacionais", form.empresa_id],
        queryFn: () => FornecedorService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id && schemaDisponivel,
        staleTime: 5 * 60 * 1000,
    });

    // Produtos: carrega todos se não há fornecedor, ou por fornecedor se selecionado
    const { data: produtosDb = [] } = useQuery({
        queryKey: ["produtos_carga", form.fornecedor],
        queryFn: () => form.fornecedor
            ? ProdutoCargaService.getByFornecedor(form.fornecedor)
            : ProdutoCargaService.getAll(),
        enabled: schemaDisponivel,
        staleTime: 0,
    });

    // Buscamos o ID do módulo financeiro (Meios de Pagamento)
    const { data: regrasModulos = [] } = useQuery({
        queryKey: ["regras_modulos_all"],
        queryFn: () => RegrasModulosService.listar(),
        enabled: schemaDisponivel,
        staleTime: 5 * 60 * 1000,
    });

    const taxModule = useMemo(
        () =>
            (regrasModulos as any[]).find(
                (module: any) => module.module_type === "tax" || module.slug === "taxas_impostos" || module.slug === "taxas-impostos",
            ) ?? null,
        [regrasModulos],
    );

    const { data: taxRulesData = [] } = useQuery({
        queryKey: ["regras_dados", taxModule?.id],
        queryFn: () => RegrasDadosService.listarPorModulo(taxModule!.id),
        enabled: schemaDisponivel && !!taxModule?.id,
    });

    const moduloFinanceiroId = useMemo(() => {
        return regrasModulos.find((m: any) => m.module_type === 'financial')?.id;
    }, [regrasModulos]);

    // Buscamos as regras financeiras novas baseadas no módulo
    const { data: regrasDadosFinanceiros = [] } = useQuery({
        queryKey: ["regras_dados_financeiros", moduloFinanceiroId],
        queryFn: () => RegrasDadosService.listarPorModulo(moduloFinanceiroId as number),
        enabled: !!moduloFinanceiroId && schemaDisponivel,
    });

    const { data: formasPagamentoDb = [], isLoading: isLoadingFormas } = useQuery({
        queryKey: ["formas_pagamento_operacional"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
        enabled: schemaDisponivel,
    });

    const colaboradoresFiltrados = useMemo(
        () =>
            (colaboradoresRaw as any[]).filter((colaborador: any) => {
                if (colaborador.status === "inativo" || colaborador.deleted_at) return false;
                return true;
            }),
        [colaboradoresRaw],
    );

    const tipoServicoOptions = useMemo(
        () => mapToLookupOptions(tiposServicoDb as any[]),
        [tiposServicoDb],
    );

    const selectedTipoServico = useMemo(
        () => tipoServicoOptions.find((item) => item.id === form.tipo_servico) ?? null,
        [tipoServicoOptions, form.tipo_servico],
    );

    const tipoServicoNome = selectedTipoServico?.nome ?? "";

    const transportadorasDisponiveis = useMemo(
        () => mapToLookupOptions(transportadorasDb as any[]),
        [transportadorasDb],
    );

    const fornecedoresDisponiveis = useMemo(
        () => mapToLookupOptions(fornecedoresDb as any[]),
        [fornecedoresDb],
    );

    const fornecedorSelecionado = useMemo(
        () => fornecedoresDisponiveis.find((item) => item.id === form.fornecedor) ?? null,
        [fornecedoresDisponiveis, form.fornecedor],
    );

    const transportadoraSelecionada = useMemo(
        () => transportadorasDisponiveis.find((item) => item.id === form.transportadora) ?? null,
        [transportadorasDisponiveis, form.transportadora],
    );

    const produtoOptions = useMemo(
        () => mapToLookupOptions(produtosDb as any[]),
        [produtosDb],
    );

    const produtoSelecionado = useMemo(
        () => produtoOptions.find((item) => item.id === form.produto) ?? null,
        [produtoOptions, form.produto],
    );

    useEffect(() => {
        const produtoOriginal = (produtosDb as any[]).find((item: any) => item.id === form.produto);
        const fornecedorProduto = produtoOriginal?.fornecedor_id ? String(produtoOriginal.fornecedor_id) : "";

        if (!fornecedorProduto) return;
        if (form.fornecedor === fornecedorProduto) return;

        setForm((prev) => ({ ...prev, fornecedor: fornecedorProduto }));
    }, [form.produto, form.fornecedor, produtosDb]);

    const produtoSimilarOptions = useMemo(() => {
        const normalizedDraft = normalizeText(produtoDraft.nome);
        if (!normalizedDraft) return [];
        return produtoOptions.filter((item) => {
            const normalizedItem = normalizeText(item.nome);
            return normalizedItem === normalizedDraft || normalizedItem.includes(normalizedDraft) || normalizedDraft.includes(normalizedItem);
        });
    }, [produtoDraft.nome, produtoOptions]);

    const formaPagamentoOptions = useMemo(() => {
        if (!form.modalidade_financeira) {
            return mapToLookupOptions(formasPagamentoDb as any[]);
        }

        if (form.modalidade_financeira === "DUPLICATA") {
            const boletoFdb = (formasPagamentoDb as any[]).find((f: any) =>
                f.nome?.toLowerCase().includes("boleto")
            );
            if (boletoFdb) {
                return [{ id: String(boletoFdb.id), nome: String(boletoFdb.nome) }];
            }
            return [{ id: "boleto", nome: "Boleto" }];
        }

        let filtered = regrasDadosFinanceiros as any[];
        if (form.modalidade_financeira) {
            filtered = filtered.filter(
                (d) => d.dados?.["Modalidade Financeira"] === form.modalidade_financeira
            );
        }

        const formasPermitidasNomes = Array.from(new Set(filtered.map(d => d.dados?.["Forma de Pagamento"]).filter(Boolean)));

        if (formasPermitidasNomes.length > 0) {
            return formasPermitidasNomes.map((nomePermitido) => {
                const formaDb = (formasPagamentoDb as any[]).find(
                    (f: any) => f.nome?.toLowerCase() === (nomePermitido as string).toLowerCase()
                );
                return {
                    id: String(formaDb?.id || nomePermitido),
                    nome: String(nomePermitido)
                };
            });
        }

        return (formasPagamentoDb as any[]).map(forma => ({
            id: String(forma.id),
            nome: String(forma.nome)
        }));
    }, [formasPagamentoDb, form.modalidade_financeira, regrasDadosFinanceiros]);

    const formaPagamentoSelecionada = useMemo(
        () => formaPagamentoOptions.find((item) => item.id === form.forma_pagamento) ?? null,
        [formaPagamentoOptions, form.forma_pagamento],
    );
    const finalidadeSelecionada = useMemo(
        () => getFinalidadeMeta(form.tipo_lancamento),
        [form.tipo_lancamento],
    );
    const modalidadeFinanceiraLabel = useMemo(
        () => getModalidadeFinanceiraLabel(form.modalidade_financeira, []),
        [form.modalidade_financeira],
    );
    const isOperacaoPadrao = form.tipo_lancamento === "operacao_padrao";
    const isTransbordoServicoExtra = form.tipo_lancamento === "transbordo_servico_extra";
    const isCustosMensaisCLT = form.preset_id === "preset_custos_mensais";
    const isDiaristas = form.preset_id === "preset_diaristas";
    const isQualquerCusto = isCustosMensaisCLT || isDiaristas;
    const isFluxoSemEquipe = isTransbordoServicoExtra;
    const deveExigirModalidadeManual = isOperacaoPadrao;

    const categoriaServico = useMemo(() => {
        if (isDiaristas) return "DIARISTA";
        if (isQualquerCusto) return "CUSTO";
        if (isTransbordoServicoExtra) return "SERVICO_EXTRA";
        if (isOperacaoPadrao) return "SERVICO_VOLUME";
        return "SERVICO_VOLUME";
    }, [isDiaristas, isQualquerCusto, isTransbordoServicoExtra, isOperacaoPadrao]);

    useEffect(() => {
        if (categoriaServico && form.categoria_servico !== categoriaServico) {
            setForm((prev) => ({ ...prev, categoria_servico: categoriaServico }));
        }
    }, [categoriaServico]);

    useEffect(() => {
        if (form.tipo_lancamento === "transbordo_servico_extra" && form.modalidade_financeira !== "CAIXA_IMEDIATO") {
            setForm((prev) => ({ ...prev, modalidade_financeira: "CAIXA_IMEDIATO" }));
            return;
        }
        if (form.tipo_lancamento === "custos_extras" && form.modalidade_financeira !== "CUSTO_DESPESA") {
            setForm((prev) => ({ ...prev, modalidade_financeira: "CUSTO_DESPESA" }));
            return;
        }
        if (form.tipo_lancamento === "" && form.modalidade_financeira !== "") {
            setForm((prev) => ({ ...prev, modalidade_financeira: "" }));
        }
    }, [form.modalidade_financeira, form.tipo_lancamento]);

    useEffect(() => {
        const buscarRegraFinanceira = async () => {
            const modalidade = form.modalidade_financeira;
            const formaPagamentoItem = formaPagamentoOptions.find(item => item.id === form.forma_pagamento);
            const formaPagamento = formaPagamentoItem?.nome || form.forma_pagamento;

            if (!modalidade || !formaPagamento) {
                setForm((prev) => ({ ...prev, regra_financeira: null }));
                return;
            }

            try {
                const regra = await RegrasDadosService.buscarPorModalidadeEForma(modalidade, formaPagamento);
                if (regra?.dados) {
                    const dados = regra.dados;
                    const prazoDias = dados.prazo_dias !== undefined && dados.prazo_dias !== null ? Number(dados.prazo_dias) : 0;
                    setForm((prev) => ({
                        ...prev,
                        regra_financeira: {
                            modalidade_financeira: dados.modalidade_financeira,
                            forma_pagamento: dados.forma_pagamento,
                            prazo_dias: prazoDias,
                            tipo_liquidacao: dados.tipo_liquidacao,
                            entra_caixa_imediato: dados.entra_caixa_imediato,
                            gera_conta_receber: dados.gera_conta_receber,
                            agrupa_faturamento: dados.agrupa_faturamento,
                        },
                    }));
                } else {
                    setForm((prev) => ({ ...prev, regra_financeira: null }));
                }
            } catch (error) {
                console.error("Erro ao buscar regra financeira:", error);
                setForm((prev) => ({ ...prev, regra_financeira: null }));
            }
        };

        buscarRegraFinanceira();
    }, [form.modalidade_financeira, form.forma_pagamento]);

    const regraLookupHabilitada = !!form.empresa_id && !!form.data && !!form.tipo_servico;

    const {
        data: regraValorRpc = null,
        isFetching: isBuscandoRegra,
        error: erroRegraLookup,
    } = useQuery({
        queryKey: ["resolver_valor_operacao", form.empresa_id, form.unidade_id, form.tipo_servico, form.fornecedor, form.transportadora, form.produto, form.data],
        queryFn: async () => {
            if (!regraLookupHabilitada) return null;
            return FornecedorValorServicoService.resolverValor({
                empresaId: form.empresa_id,
                unidadeId: form.unidade_id || null,
                tipoServicoId: form.tipo_servico,
                fornecedorId: form.fornecedor || null,
                transportadoraId: form.transportadora || null,
                produtoCargaId: form.produto || null,
                dataOperacao: form.data,
            });
        },
        enabled: schemaDisponivel && regraLookupHabilitada,
        retry: false,
    });

    const { data: regrasOperacionaisDiagnostico = [] } = useQuery({
        queryKey: ["regras_operacionais_diagnostico_encarregado", form.empresa_id],
        queryFn: () => RegraOperacionalService.getAll(form.empresa_id),
        enabled: schemaDisponivel && !!form.empresa_id,
    });

    const { data: regraIssRpc = null } = useQuery({
        queryKey: ["resolver_iss_operacao", form.empresa_id, form.tipo_servico, form.data],
        queryFn: async () => {
            if (!form.empresa_id) return null;
            return FornecedorValorServicoService.resolverIss({
                empresaId: form.empresa_id,
                tipoServicoId: form.tipo_servico || null,
                dataOperacao: form.data,
            });
        },
        enabled: schemaDisponivel && !!form.empresa_id,
        retry: false,
    });

    const regraValor = useMemo(() => {
        if (!regraValorRpc || !regraValorRpc.regra_encontrada) return null;
        return {
            tipoCalculo: regraValorRpc.tipo_calculo as TipoCalculo,
            valorUnitario: Number(regraValorRpc.valor_unitario || 0),
            formaPagamentoId: regraValorRpc.forma_pagamento_id ?? null,
        };
    }, [regraValorRpc]);

    const regraProdutoServicoFallback = useMemo(() => {
        if (!form.empresa_id || !form.tipo_servico || !form.produto) return null;

        const operationDate = form.data ? new Date(`${form.data}T12:00:00`) : null;
        if (!operationDate) return null;

        const candidates = (regrasOperacionaisDiagnostico as any[])
            .filter((rule: any) => {
                if (!rule?.ativo) return false;
                if (!rule?.produto_carga_id || String(rule.produto_carga_id) !== String(form.produto)) return false;
                if (!matchesOptionalContext(rule?.empresa_id, form.empresa_id)) return false;
                if (!matchesOptionalContext(rule?.unidade_id, form.unidade_id || null)) return false;
                if (!matchesOptionalContext(rule?.tipo_servico_id, form.tipo_servico)) return false;
                if (!matchesOptionalContext(rule?.fornecedor_id, form.fornecedor || null)) return false;
                if (!matchesOptionalContext(rule?.transportadora_id, form.transportadora || null)) return false;

                const startsAt = rule?.vigencia_inicio ? new Date(`${rule.vigencia_inicio}T00:00:00`) : null;
                const endsAt = rule?.vigencia_fim ? new Date(`${rule.vigencia_fim}T23:59:59`) : null;

                return (!startsAt || startsAt <= operationDate) && (!endsAt || endsAt >= operationDate);
            })
            .map((rule: any) => ({
                ...rule,
                prioridade:
                    (rule.empresa_id ? 32 : 0) +
                    (rule.tipo_servico_id ? 16 : 0) +
                    (rule.fornecedor_id ? 8 : 0) +
                    (rule.unidade_id ? 4 : 0) +
                    (rule.transportadora_id ? 2 : 0) +
                    (rule.produto_carga_id ? 1 : 0),
            }))
            .sort((a: any, b: any) => {
                if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
                return String(b.vigencia_inicio || "").localeCompare(String(a.vigencia_inicio || ""));
            });

        const selected = candidates[0];
        if (!selected) return null;

        return {
            tipoCalculo: (selected.tipo_calculo || "volume") as TipoCalculo,
            valorUnitario: Number(selected.valor_unitario || 0),
            formaPagamentoId: selected.forma_pagamento_id ?? null,
        };
    }, [
        form.data,
        form.empresa_id,
        form.fornecedor,
        form.produto,
        form.tipo_servico,
        form.transportadora,
        form.unidade_id,
        regrasOperacionaisDiagnostico,
    ]);

    const regraFinanceiraAtiva = regraProdutoServicoFallback ?? regraValor;

    const taxRulesReference = useMemo(() => {
        return (taxRulesData as any[])
            .map((item) => {
                const dados = item.dados as Record<string, unknown> | undefined;
                const nomeTaxa = String(getRuleDataValue(dados, "Nome da Taxa", "nome_taxa") ?? "").trim();
                const percentual = Number(getRuleDataValue(dados, "Percentual", "percentual"));
                const status = String(getRuleDataValue(dados, "Status", "status") ?? "");
                const vigenciaInicial = parseIsoDateLike(String(getRuleDataValue(dados, "Vigência Inicial", "vigencia_inicial") ?? ""));
                const vigenciaFinal = parseIsoDateLike(String(getRuleDataValue(dados, "Vigência Final", "vigencia_final") ?? ""));

                return {
                    nomeTaxa,
                    percentual,
                    status,
                    vigenciaInicial,
                    vigenciaFinal,
                };
            })
            .filter((item) => item.nomeTaxa && Number.isFinite(item.percentual));
    }, [taxRulesData]);

    const issReference = useMemo(() => {
        const targetDate = form.data || today;

        return taxRulesReference.find((item) => {
            if (!normalizeText(item.nomeTaxa).includes("iss")) return false;
            if (normalizeText(item.status || "Ativo") !== "ativo") return false;
            if (item.vigenciaInicial && item.vigenciaInicial > targetDate) return false;
            if (item.vigenciaFinal && item.vigenciaFinal < targetDate) return false;
            return true;
        }) ?? null;
    }, [form.data, taxRulesReference, today]);

    const percentualIssDecimal = issReference
        ? normalizePercentualDecimal(issReference.percentual)
        : regraIssRpc?.regra_encontrada
            ? normalizePercentualDecimal(regraIssRpc.percentual_iss)
            : 0;
    const percentualIss = percentualIssDecimal * 100;

    const ruleLookupState = useMemo<RuleLookupState>(() => {
        if (!regraLookupHabilitada) return "idle";
        if (isBuscandoRegra) return "loading";
        if (erroRegraLookup) return "error";
        const statusRegra = regraValorRpc?.status_regra as RuleLookupState | undefined;
        if (statusRegra) return statusRegra;
        return regraValorRpc?.regra_encontrada ? "found" : "missing";
    }, [erroRegraLookup, isBuscandoRegra, regraLookupHabilitada, regraValorRpc]);

    const requiresProductSelection = Boolean(regraValorRpc?.produto_obrigatorio);
    const hasInactiveCompatibleRule = useMemo(() => {
        if (!regraLookupHabilitada || ruleLookupState !== "missing") return false;

        const operationDate = form.data ? new Date(`${form.data}T12:00:00`) : null;
        if (!operationDate) return false;

        return (regrasOperacionaisDiagnostico as any[]).some((rule: any) => {
            if (rule?.ativo === true) return false;

            const startsAt = rule?.vigencia_inicio ? new Date(`${rule.vigencia_inicio}T00:00:00`) : null;
            const endsAt = rule?.vigencia_fim ? new Date(`${rule.vigencia_fim}T23:59:59`) : null;
            const withinDateRange =
                (!startsAt || startsAt <= operationDate) &&
                (!endsAt || endsAt >= operationDate);

            return (
                withinDateRange &&
                matchesOptionalContext(rule?.empresa_id, form.empresa_id) &&
                matchesOptionalContext(rule?.unidade_id, form.unidade_id || null) &&
                matchesOptionalContext(rule?.tipo_servico_id, form.tipo_servico) &&
                matchesOptionalContext(rule?.fornecedor_id, form.fornecedor || null) &&
                matchesOptionalContext(rule?.transportadora_id, form.transportadora || null) &&
                matchesOptionalContext(rule?.produto_carga_id, form.produto || null)
            );
        });
    }, [
        form.data,
        form.empresa_id,
        form.fornecedor,
        form.produto,
        form.tipo_servico,
        form.transportadora,
        form.unidade_id,
        regraLookupHabilitada,
        regrasOperacionaisDiagnostico,
        ruleLookupState,
    ]);

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            valor_unitario: regraFinanceiraAtiva ? String(regraFinanceiraAtiva.valorUnitario) : prev.valor_unitario,
            forma_pagamento: regraFinanceiraAtiva?.formaPagamentoId ?? prev.forma_pagamento,
        }));
    }, [regraFinanceiraAtiva]);

    useEffect(() => {
        if (!regraFinanceiraAtiva) return;

        setForm((prev) => {
            if (regraFinanceiraAtiva.tipoCalculo === "operation" && prev.quantidade !== "1") {
                return { ...prev, quantidade: "1" };
            }

            if (regraFinanceiraAtiva.tipoCalculo === "colaborador" && prev.quantidade !== "1") {
                return { ...prev, quantidade: "1" };
            }

            return prev;
        });
    }, [regraFinanceiraAtiva]);

    const colaboradoresSelecionados = useMemo(
        () =>
            colaboradoresFiltrados.filter((colaborador: any) => condutaColaboradores[colaborador.id]?.selected),
        [colaboradoresFiltrados, condutaColaboradores],
    );

    const quantidadeSelecionada = colaboradoresSelecionados.length;
    const infracoesCount = Object.values(condutaColaboradores).reduce((total, item) => {
        if (!item.selected || !item.hadInfraction) return total;
        return total + item.infractionTypes.length;
    }, 0);
    const exibirPlaca = true;
    const quantidade = Number(form.quantidade || 0);
    const quantidadeColaboradores = Number(form.quantidade_colaboradores || 0);
    const valorUnitario = Number(form.valor_unitario || 0);
    const valorUnitarioFilme = Number(form.valor_unitario_filme || 0);
    const quantidadeFilme = Number(form.quantidade_filme || 0);
    const hasRegraFinanceira = !!regraFinanceiraAtiva;
    const tipoCalculoAtual = regraFinanceiraAtiva?.tipoCalculo ?? null;
    const quantidadeConsiderada = tipoCalculoAtual === "operation" ? (quantidade || 1) : quantidade;

    // Valor efetivo: regra automática tem prioridade, mas usuário pode sobrescrever manualmente
    const valorUnitarioEfetivo = (form.valor_unitario_manual !== undefined && form.valor_unitario_manual !== null && form.valor_unitario_manual !== "")
        ? Number(form.valor_unitario_manual)
        : Number(form.valor_unitario || 0);

    // Cálculo unificado usando ISS global quando NF for emitida
    const valoresCalculados = calcularValoresOperacao({
        quantidade: quantidadeConsiderada,
        valorUnitario: valorUnitarioEfetivo,
        percentualIss: percentualIssDecimal,
        quantidadeFilme: quantidadeFilme,
        valorUnitarioFilme: valorUnitarioFilme,
        nfRaw: form.nf_emite ? (form.nf_numero.trim() || "SIM") : "NAO",
    });

    const valorDescarga = valoresCalculados.valorDescargaCalculado;
    const custoIss = valoresCalculados.custoIssCalculado;
    const totalFilme = valoresCalculados.totalFilmeCalculado;
    const totalFinal = valoresCalculados.totalFinalCalculado;
    const baseCalculoResumo = tipoCalculoAtual === "operation"
        ? `1 operação x ${formatCurrency(valorUnitario || 0)} + ${formatCurrency(custoIss)}`
        : `${quantidadeConsiderada || 0} x ${formatCurrency(valorUnitario || 0)} + ${formatCurrency(custoIss)}`;

    const isDataRetroativa = form.data < today;
    const horarioInvalido = !!form.horario_inicio && !!form.horario_fim && form.horario_inicio > form.horario_fim;

    const mensagemRegra = useMemo(() => {
        if (ruleLookupState === "duplicate") return REGRA_MENSAGEM_DUPLICADA;
        if (ruleLookupState === "needs_product") return REGRA_MENSAGEM_PRODUTO;
        if (ruleLookupState === "error") return REGRA_MENSAGEM_ERRO;
        if (ruleLookupState === "missing") {
            if (hasInactiveCompatibleRule) {
                return "Existe uma regra operacional compatível, mas está inativa. Peça para o Admin reativar.";
            }
            return regraValorRpc?.mensagem_bloqueio
                ? String(regraValorRpc.mensagem_bloqueio)
                : REGRA_MENSAGEM_SEM_CADASTRO;
        }
        return "";
    }, [hasInactiveCompatibleRule, regraValorRpc, ruleLookupState]);

    const etapaUmBlockReasonResolvido = useMemo(() => {
        if (!form.tipo_lancamento) return "Selecione o tipo de lançamento.";
        if (deveExigirModalidadeManual && !form.modalidade_financeira) return "Selecione como essa operação será liquidada no ERP.";
        return "";
    }, [deveExigirModalidadeManual, form.modalidade_financeira, form.tipo_lancamento]);

    const etapaDoisBlockReason = useMemo(() => {
        if (!form.empresa_id) return "Selecione a empresa.";
        if (!form.data) return "Selecione a data da operação.";
        if (!form.tipo_servico) return "Selecione o tipo de serviço.";

        if (isTransbordoServicoExtra && !form.descricao_servico.trim()) return "Informe a descrição do serviço.";
        if (isQualquerCusto && !form.descricao_servico.trim()) return "Informe a descrição do custo ou motivo.";

        if (horarioInvalido) return "O horário de saída não pode ser menor que o de entrada.";
        if (isDataRetroativa && !form.justificativa_data.trim()) return "Justifique a data retroativa.";
        return "";
    }, [
        form.data,
        form.descricao_servico,
        form.empresa_id,
        form.justificativa_data,
        form.tipo_servico,
        horarioInvalido,
        isDataRetroativa,
        isQualquerCusto,
        isTransbordoServicoExtra,
    ]);

    // Indica se vencimento é obrigatório pela modalidade
    const vencimentoObrigatorio = useMemo(() => {
        return form.modalidade_financeira === "DUPLICATA" || form.modalidade_financeira === "FATURAMENTO_MENSAL";
    }, [form.modalidade_financeira]);

    const etapaTresBlockReason = useMemo(() => {
        if (!isQualquerCusto && requiresProductSelection && !form.produto) return REGRA_MENSAGEM_PRODUTO;

        if (ruleLookupState === "loading") return "Buscando valor...";

        const valorEfetivo = (form.valor_unitario_manual !== undefined && form.valor_unitario_manual !== null && form.valor_unitario_manual !== "")
            ? Number(form.valor_unitario_manual)
            : Number(form.valor_unitario || 0);

        if (!hasRegraFinanceira && !valorEfetivo) {
            if (isTransbordoServicoExtra || isQualquerCusto) {
                return `Informe o valor unitário manualmente.`;
            } else {
                if (ruleLookupState === "duplicate" || ruleLookupState === "needs_product" || ruleLookupState === "error" || ruleLookupState === "missing") {
                    return mensagemRegra;
                }
                return REGRA_MENSAGEM_SEM_CADASTRO;
            }
        }

        if (!form.forma_pagamento) return "Selecione a forma de pagamento.";
        if (vencimentoObrigatorio && !form.data_vencimento) return "Informe a data de vencimento.";
        if (!isFluxoSemEquipe && (!Number.isInteger(Number(form.quantidade_colaboradores)) || Number(form.quantidade_colaboradores) <= 0)) {
            return "Informe a quantidade de colaboradores.";
        }
        if (quantidadeConsiderada <= 0) return "Informe uma quantidade maior que zero.";
        return "";
    }, [
        form.forma_pagamento,
        form.quantidade_colaboradores,
        form.produto,
        form.valor_unitario,
        form.valor_unitario_manual,
        form.data_vencimento,
        hasRegraFinanceira,
        isFluxoSemEquipe,
        isQualquerCusto,
        isTransbordoServicoExtra,
        isCustosMensaisCLT,
        mensagemRegra,
        quantidadeConsiderada,
        requiresProductSelection,
        ruleLookupState,
        vencimentoObrigatorio,
    ]);

    const etapaQuatroBlockReason = useMemo(() => {
        if (isFluxoSemEquipe) return "";
        const quantidadeInformada = Number(form.quantidade_colaboradores || 0);
        if (quantidadeSelecionada !== quantidadeInformada) {
            return `Você informou ${quantidadeInformada} e selecionou ${quantidadeSelecionada}.`;
        }

        const colaboradorComInfracaoSemTipo = colaboradoresSelecionados.find((colaborador: any) => {
            const conduta = condutaColaboradores[colaborador.id];
            return conduta?.selected && conduta.hadInfraction && conduta.infractionTypes.length === 0;
        });

        if (colaboradorComInfracaoSemTipo) {
            return `Informe o tipo de infração para ${colaboradorComInfracaoSemTipo.nome}.`;
        }

        return "";
    }, [colaboradoresSelecionados, condutaColaboradores, form.quantidade_colaboradores, isFluxoSemEquipe, quantidadeSelecionada]);

    const { data: historico = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ["producao_recente", form.empresa_id, form.unidade_id, form.data],
        queryFn: () => OperacaoProducaoService.getByDate(form.data, form.empresa_id, form.unidade_id || null),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    const createProdutoMutation = useMutation({
        mutationFn: async () => {
            if (!produtoDraft.nome.trim()) throw new Error("Informe o nome do produto/carga.");

            const duplicate = produtoOptions.find((item) => normalizeText(item.nome) === normalizeText(produtoDraft.nome));
            if (duplicate) {
                throw new Error("Já existe um produto/carga com nome equivalente para este fornecedor.");
            }

            return ProdutoCargaService.create({
                fornecedor_id: form.fornecedor || null,
                nome: produtoDraft.nome.trim(),
                categoria: produtoDraft.categoria.trim() || null,
                descricao: produtoDraft.categoria.trim() ? `Categoria: ${produtoDraft.categoria.trim()}` : null,
                ativo: true,
                tenant_id: tenantId,
            });
        },
        onSuccess: async (data: any) => {
            await queryClient.refetchQueries({ queryKey: ["produtos_carga"] });
            setForm((prev) => ({ ...prev, produto: data.id }));
            setProdutoDialogOpen(false);
            setProdutoDraft({ nome: "", categoria: "" });
            toast.success("Produto/carga cadastrado e selecionado.");
        },
        onError: (error: any) => {
            toast.error("Não foi possível cadastrar o produto/carga.", {
                description: error.message,
            });
        },
    });

    const { data: resumoV2, isLoading: isLoadingResumo } = useQuery({
        queryKey: ["resumo_producao_dia", form.empresa_id, form.unidade_id, form.data],
        queryFn: () => OperacaoProducaoService.getResumoDoDia(form.data, form.empresa_id, form.unidade_id || null).catch(() => null),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    const resumoFallback = useMemo(() => {
        const registros = historico as any[];
        return {
            total_lancamentos: registros.length,
            total_colaboradores: new Set(registros.map((item) => item.responsavel_id).filter(Boolean)).size,
            total_quantidade: registros.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
            valor_total_produzido: registros.reduce(
                (acc, item) => {
                    // Prioridade: valor_total do banco (gravado corretamente),
                    // fallback para total_previsto no avaliacao_json.
                    const vt = Number(item.valor_total || 0);
                    const vp = Number(item.avaliacao_json?.contexto_operacional?.total_previsto || 0);
                    return acc + (vt > 0 ? vt : vp);
                },
                0,
            ),
            pendencias: registros.filter(
                (item) => item.status === "pendente" || item.status === "Pendente" || item.status === "Aguardando validação",
            ).length,
            alertas: registros.filter(
                (item) =>
                    item.status === "com_alerta" ||
                    item.status === "Com alerta" ||
                    Number(item.avaliacao_json?.total_infracoes || 0) > 0,
            ).length,
        };
    }, [historico]);

    const resumo = useMemo(() => {
        // O resumoFallback calcula a soma de valor_total direto dos registros (correto),
        // enquanto resumoV2 (view do BD) pode ter divergência pelo trigger de cálculo.
        // Sempre usar resumoFallback quando os registros locais já estão carregados.
        const totalLocal = Number(resumoFallback.valor_total_produzido || 0);
        const baseResumo = resumoV2 ?? resumoFallback;
        return {
            ...baseResumo,
            total_lancamentos: resumoFallback.total_lancamentos,
            total_colaboradores: resumoFallback.total_colaboradores,
            pendencias: resumoFallback.pendencias,
            // Prioriza soma local (mais precisa); usa da view somente se não há registros locais
            valor_total_produzido: totalLocal > 0 ? totalLocal : Number((baseResumo as any).valor_total_produzido || 0),
        };
    }, [resumoFallback, resumoV2]);

    const mutation = useMutation({
        mutationFn: async ({ operacao, colaboradores }: any) => {
            if (operacao.categoria_servico === 'CUSTO') {
                const payload = {
                    data: operacao.data_operacao,
                    empresa_id: operacao.empresa_id,
                    categoria_custo: operacao.categoria_custo || 'OPERACIONAL',
                    descricao: operacao.descricao_servico || "Lançamento manual de custo",
                    valor_unitario: operacao.valor_unitario_snapshot,
                    quantidade: operacao.quantidade,
                    total: operacao.valor_total,
                    forma_pagamento: operacao.forma_pagamento_id,
                    status_pagamento: 'PENDENTE',
                    tipo_lancamento: 'DESPESA',
                    origem_dado: 'manual',
                    pipeline_status: 'PENDENTE',
                    avaliacao_json: operacao.avaliacao_json,
                };
                return CustoExtraOperacionalService.createMany([payload]);
            }
            if (operacao.categoria_servico === 'SERVICO_EXTRA') {
                const payload = {
                    data: operacao.data_operacao,
                    empresa_id: operacao.empresa_id,
                    tipo_servico_id: operacao.tipo_servico_id,
                    descricao_servico: operacao.descricao_servico || "Serviço Adicional",
                    quantidade: operacao.quantidade,
                    valor_unitario: operacao.valor_unitario_snapshot,
                    total: operacao.valor_total,
                    forma_pagamento: operacao.forma_pagamento_id,
                    modalidade_financeira: operacao.modalidade_financeira,
                    status_pagamento: 'PENDENTE',
                    pipeline_status: 'PENDENTE',
                    observacao: operacao.observacao,
                    origem_dado: 'manual',
                    responsavel_nome: operacao.responsavel_nome,
                    avaliacao_json: operacao.avaliacao_json,
                };
                return ServicosExtrasOperacionaisService.create(payload);
            }
            return OperacaoProducaoService.createWithColaboradores(operacao, colaboradores);
        },
        onSuccess: () => {
            toast.success("Produção registrada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
            queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            queryClient.invalidateQueries({ queryKey: ["importacoes"] });

            const lastForm = { ...form };
            setForm((prev) => ({
                ...prev,
                tipo_lancamento: lastForm.tipo_lancamento,
                modalidade_financeira: lastForm.modalidade_financeira,
                preset_id: lastForm.preset_id,
                descricao_servico: "",
                transportadora: "",
                fornecedor: "",
                produto: "",
                quantidade: "",
                valor_unitario: "",
                valor_unitario_manual: "",
                valor_unitario_filme: "",
                quantidade_filme: "",
                forma_pagamento: "",
                horario_inicio: "",
                horario_fim: "",
                placa_veiculo: "",
                justificativa_data: "",
                nf_numero: "",
                ctrc: "",
                observacao: "",
                responsavel_nome: "",
                data_vencimento: "",
                status_financeiro: "PENDENTE",
            }));
            setCondutaColaboradores({});
            setEtapaAtual(2);
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            OperacaoProducaoService.cancel(id, user?.id || "", reason),
        onSuccess: () => {
            toast.success("Operação cancelada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
            queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
            queryClient.invalidateQueries({ queryKey: ["importacoes"] });
            setCancelItemId(null);
            setCancelReason("");
        },
        onError: (err: any) => toast.error("Erro ao cancelar operação", { description: err.message }),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (etapaAtual === 1) {
            if (etapaUmBlockReasonResolvido) {
                toast.error(etapaUmBlockReasonResolvido);
                return;
            }
            setEtapaAtual(2);
            return;
        }

        if (etapaAtual === 2) {
            if (etapaDoisBlockReason) {
                toast.error(etapaDoisBlockReason);
                return;
            }
            setEtapaAtual(3);
            return;
        }

        if (etapaAtual === 3) {
            if (etapaTresBlockReason) {
                toast.error(etapaTresBlockReason);
                return;
            }
            if (isFluxoSemEquipe || isCustosMensaisCLT) {
                handleSave();
            } else {
                setEtapaAtual(4);
            }
            return;
        }

        if (etapaAtual === 4) {
            if (etapaQuatroBlockReason) {
                toast.error(etapaQuatroBlockReason);
                return;
            }
            handleSave();
        }
    };

    const handleSave = () => {
        const status = infracoesCount > 0 ? "Com alerta" : (isDataRetroativa ? "Aguardando validação" : "Pendente");
        const regraFinanceira = form.regra_financeira as any;
        const valorUnitarioFinal = valorUnitarioEfetivo;

        let finalModalidade = form.modalidade_financeira || regraFinanceira?.modalidade_financeira;

        // Coerção Mágica: se o usuário escolheu uma forma de pagamento explícita ignorando o preset e não há regra cadastrada
        const formaPagamentoUpper = String(formaPagamentoOptions.find(f => f.id === form.forma_pagamento)?.nome || form.forma_pagamento || "").toUpperCase();
        if (formaPagamentoUpper.includes("BOLETO") || formaPagamentoUpper.includes("DUPLICATA")) {
            finalModalidade = "DUPLICATA";
        } else if (formaPagamentoUpper.includes("MENSAL")) {
            finalModalidade = "FATURAMENTO_MENSAL";
        }

        // Traduz a modalidade da UI para a taxonomia correta do Banco (KPIs)
        if (finalModalidade === "FATURAMENTO_MENSAL") finalModalidade = "FECHAMENTO_MENSAL_EMPRESA";
        if (finalModalidade === "DUPLICATA") finalModalidade = "DUPLICATA_FORNECEDOR";

        const avaliacaoJson = {
            infracoes: Object.entries(condutaColaboradores)
                .filter(([, c]) => c.selected && c.hadInfraction)
                .flatMap(([colaboradorId, c]) =>
                    c.infractionTypes.map((type) => ({
                        collaborator_id: colaboradorId,
                        type,
                        notes: c.notes,
                    })),
                ),
            total_infracoes: infracoesCount,
            contexto_operacional: {
                total_previsto: totalFinal,
                quantidade: quantidade,
                valor_unitario: valorUnitarioFinal,
                base_calculo: baseCalculoResumo,
                quantidade_colaboradores: quantidadeColaboradores,
            },
            contexto_importacao: {
                modalidade_financeira_override: finalModalidade,
                forma_pagamento: form.forma_pagamento && form.forma_pagamento.includes('-') ? form.forma_pagamento : null
            }
        };

        // Desestruturar regraFinanceira excluindo tipo_calculo para evitar violar o CHECK constraint.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tipoCalculo: _tc, tipo_calculo: _tcl, ...regraFinanceiraSpread } = (regraFinanceira ?? {}) as any;
        const tipoCalculoSnapshotFinal: 'volume' | 'colaborador' =
            (regraFinanceiraAtiva?.tipoCalculo === 'colaborador') ? 'colaborador' : 'volume';

        const operacao = {
            ...regraFinanceiraSpread,
            modalidade_financeira: finalModalidade,
            categoria_servico: categoriaServico,
            empresa_id: form.empresa_id,
            unidade_id: form.unidade_id || null,
            data_operacao: form.data,
            tipo_servico_id: form.tipo_servico,
            colaborador_id: null,
            entrada_ponto: form.horario_inicio || null,
            saida_ponto: form.horario_fim || null,
            transportadora_id: form.transportadora,
            fornecedor_id: form.fornecedor,
            produto_carga_id: form.produto || null,
            quantidade: tipoCalculoAtual === "operation"
                ? form.quantidade ? Number(form.quantidade) : 1
                : tipoCalculoAtual === "colaborador"
                    ? quantidadeColaboradores
                    : quantidade,
            valor_unitario_snapshot: valorUnitarioFinal,
            tipo_calculo_snapshot: tipoCalculoSnapshotFinal,
            forma_pagamento_id: form.forma_pagamento && form.forma_pagamento.includes('-') ? form.forma_pagamento : null,
            placa: form.placa_veiculo || null,
            status: status === "Com alerta" ? "com_alerta" : status === "Aguardando validação" ? "aguardando_validacao" : "pendente",
            percentual_iss: percentualIssDecimal,
            valor_descarga: valorDescarga,
            custo_com_iss: custoIss,
            valor_unitario_filme: valorUnitarioFilme,
            quantidade_filme: quantidadeFilme,
            valor_total_filme: totalFilme,
            valor_total: totalFinal,
            avaliacao_json: avaliacaoJson,
            justificativa_retroativa: form.justificativa_data.trim() || null,
            origem_dado: "manual",
            nf_numero: form.nf_numero.trim() || null,
            ctrc: form.ctrc.trim() || null,
            observacao: form.observacao.trim() || null,
            responsavel_id: user?.id,
            descricao_servico: form.descricao_servico.trim() || null,
            categoria_custo: form.categoria_custo,
            data_vencimento: form.data_vencimento || null,
            tenant_id: tenantId,
        };

        const colaboradores = Object.entries(condutaColaboradores)
            .filter(([, conduta]) => conduta.selected)
            .map(([colaborador_id, conduta]) => {
                const infractionNotes = conduta.hadInfraction
                    ? [
                        conduta.notes.trim() || null,
                        conduta.infractionTypes.length > 1 ? `Infrações: ${conduta.infractionTypes.join(", ")}` : null,
                    ].filter(Boolean).join(" | ") || null
                    : null;

                return {
                    collaborator_id: colaborador_id,
                    had_infraction: conduta.hadInfraction,
                    infraction_type_id: conduta.infractionTypes[0] || null,
                    infraction_notes: infractionNotes,
                };
            });

        mutation.mutate({ operacao, colaboradores });
    };

    const handlePresetSelect = (preset: (typeof LANCAMENTO_PRESETS)[0]) => {

        if (PRESET_ROTAS[preset.id]) {
            navigate(PRESET_ROTAS[preset.id]);
            return;
        }

        setForm((prev) => ({
            ...prev,
            preset_id: preset.id,
            tipo_lancamento: preset.tipo_lancamento,
            modalidade_financeira: preset.modalidade_financeira,
        }));

        setEtapaAtual(2);
    };

    const cadastrosAusentes: string[] = [];
    if (!isLoadingEmpresas && empresas.length === 0) cadastrosAusentes.push("Empresas");
    if (!isLoadingTipos && tiposServicoDb.length === 0) cadastrosAusentes.push("Tipos de Serviço");

    if (etapaAtual === 1) {
        return (
            <OperationalShell title="Novo Lançamento" hideFab={true}>
                <div className="p-4 sm:p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Tipo de Operação</h2>
                            <p className="text-sm text-muted-foreground">Selecione o tipo de lançamento para começar.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {perfisPermitidosGrid.map(({ preset, isAllowed }) => (
                            <Card
                                key={preset.id}
                                className={cn(
                                    "flex flex-col items-center justify-center text-center p-4 aspect-square transition-all duration-200",
                                    isAllowed ? "cursor-pointer hover:border-primary/80 hover:bg-primary/5" : "opacity-40 cursor-not-allowed hover:bg-transparent",
                                    form.preset_id === preset.id && "border-primary/80 bg-primary/5 ring-2 ring-primary/40"
                                )}
                                onClick={() => {
                                    if (!isAllowed) {
                                        toast.error("Você não tem permissão para acessar este lançamento.");
                                        return;
                                    }
                                    handlePresetSelect(preset);
                                }}
                            >
                                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-3", preset.iconColor)}>
                                    <preset.icon className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-sm mb-1">{preset.title}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                            </Card>
                        ))}
                    </div>

                    {etapaUmBlockReasonResolvido && (
                        <div className="mt-6 p-4 border-l-4 border-l-info-strong bg-info-soft text-sm font-medium text-info-strong">
                            {etapaUmBlockReasonResolvido}
                        </div>
                    )}
                </div>
            </OperationalShell>
        );
    }
    return (
        <OperationalShell
            title="Novo Lançamento"
            hideFab={true}
            breadcrumbs={[
                { label: "Operacional", action: () => setEtapaAtual(1) },
                { label: finalidadeSelecionada?.title ?? "Detalhes" },
            ]}
        >
            <div className="p-1 sm:p-2">
                <Progress value={(etapaAtual / 4) * 100} className="h-1" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 px-3 sm:px-6 sm:gap-6">
                <div className="xl:col-span-5 2xl:col-span-4 space-y-4 sm:space-y-6">
                    <Card className="p-4 sm:p-5 mx-auto w-full max-w-[95%] sm:max-w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <button onClick={() => setEtapaAtual(e => Math.max(1, e - 1) as EtapaFormulario)} className="text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h2 className="font-bold text-lg">{finalidadeSelecionada?.title}</h2>
                                <p className="text-xs text-muted-foreground">{modalidadeFinanceiraLabel}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {etapaAtual === 2 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label>Data</Label>
                                            <Input
                                                type="date"
                                                value={form.data || ""}
                                                onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))}
                                                className="h-11 rounded-xl bg-background"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Empresa</Label>
                                            <Select value={form.empresa_id} onValueChange={(v) => setForm(f => ({ ...f, empresa_id: v }))}>
                                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {isDataRetroativa && <Textarea value={form.justificativa_data} onChange={e => setForm(f => ({ ...f, justificativa_data: e.target.value }))} placeholder="Justificativa da data retroativa..." className="rounded-xl" />}

                                    <div className="space-y-1.5">
                                        <Label>Tipo de Serviço</Label>
                                        <Select value={form.tipo_servico} onValueChange={(v) => setForm(f => ({ ...f, tipo_servico: v }))}>
                                            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {tipoServicoOptions.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(isTransbordoServicoExtra || isQualquerCusto) && (
                                        <div className="space-y-1.5">
                                            <Label>Descrição</Label>
                                            <Textarea value={form.descricao_servico} onChange={e => setForm(f => ({ ...f, descricao_servico: e.target.value }))} placeholder="Descrição do serviço, custo ou motivo" className="rounded-xl" />
                                        </div>
                                    )}

                                    {isCustosMensaisCLT && (
                                        <div className="space-y-1.5">
                                            <Label>Categoria de Custo</Label>
                                            <Select value={form.categoria_custo} onValueChange={(v) => setForm(f => ({ ...f, categoria_custo: v }))}>
                                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="OPERACIONAL">Operacional</SelectItem>
                                                    <SelectItem value="MERENDA">Merenda / Alimentação</SelectItem>
                                                    <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                                                    <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {!isCustosMensaisCLT && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <TimePickerField label="Entrada" value={form.horario_inicio} onChange={(v) => setForm(f => ({ ...f, horario_inicio: v }))} />
                                            <TimePickerField label="Saída" value={form.horario_fim} onChange={(v) => setForm(f => ({ ...f, horario_fim: v }))} />
                                        </div>
                                    )}
                                    {horarioInvalido && !isCustosMensaisCLT && <p className="text-xs text-destructive">Horário de saída menor que o de entrada.</p>}
                                </div>
                            )}

                            {etapaAtual === 3 && (
                                <div className="space-y-5">
                                    {/* 📦 SEÇÃO: OPERAÇÃO 📦 */}
                                    {!isCustosMensaisCLT ? (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                                <Truck className="w-3.5 h-3.5" /> Operação
                                            </p>
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label>Transportadora</Label>
                                                        <Select value={form.transportadora} onValueChange={(v) => setForm(f => ({ ...f, transportadora: v }))}>
                                                            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Opcional" /></SelectTrigger>
                                                            <SelectContent>
                                                                {transportadorasDisponiveis.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label>Fornecedor</Label>
                                                        <Select value={form.fornecedor} onValueChange={(v) => setForm(f => ({ ...f, fornecedor: v }))}>
                                                            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Opcional" /></SelectTrigger>
                                                            <SelectContent>
                                                                {fornecedoresDisponiveis.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Produto/Carga</Label>
                                                        <button type="button" onClick={() => setProdutoDialogOpen(true)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                                                            <Plus className="w-3 h-3" /> Novo
                                                        </button>
                                                    </div>
                                                    <Select value={form.produto} onValueChange={(v) => {
                                                        const produto = (produtosDb as any[]).find((item: any) => item.id === v);
                                                        setForm(f => ({
                                                            ...f,
                                                            produto: v,
                                                            fornecedor: produto?.fornecedor_id ? String(produto.fornecedor_id) : f.fornecedor,
                                                        }));
                                                    }}>
                                                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Opcional" /></SelectTrigger>
                                                        <SelectContent>
                                                            {produtoOptions.length === 0 ? (
                                                                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum produto cadastrado.</div>
                                                            ) : (
                                                                produtoOptions.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>)
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="flex items-center gap-1"><Car className="w-3 h-3" />Placa</Label>
                                                        <Input value={form.placa_veiculo} onChange={e => setForm(f => ({ ...f, placa_veiculo: e.target.value.toUpperCase() }))} placeholder="AAA-0000" className="h-10 rounded-xl uppercase" maxLength={8} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label>CTRC</Label>
                                                        <Input value={form.ctrc} onChange={e => setForm(f => ({ ...f, ctrc: e.target.value }))} placeholder="Nº" className="h-10 rounded-xl" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                                <Wallet className="w-3.5 h-3.5" /> Valores do Custo
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label>{isCustosMensaisCLT ? "Quantidade" : getQuantidadeLabel(tipoCalculoAtual)}</Label>
                                            <Input type="number" inputMode="numeric" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className="h-12 rounded-xl text-lg font-bold" placeholder="0" />
                                        </div>

                                        {!isCustosMensaisCLT && !isFluxoSemEquipe && (
                                            <div className="space-y-1.5">
                                                <Label className="font-semibold">Nº de Colaboradores</Label>
                                                <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-2 border">
                                                    <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0 bg-background" onClick={() => setForm(f => ({ ...f, quantidade_colaboradores: String(Math.max(1, Number(f.quantidade_colaboradores) - 1)) }))}><Minus className="w-5 h-5" /></Button>
                                                    <div className="flex-1 text-center">
                                                        <span className="text-3xl font-black text-foreground leading-none">{form.quantidade_colaboradores || "0"}</span>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">colaboradores</p>
                                                    </div>
                                                    <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0 bg-background" onClick={() => setForm(f => ({ ...f, quantidade_colaboradores: String(Number(f.quantidade_colaboradores) + 1) }))}><Plus className="w-5 h-5" /></Button>
                                                </div>
                                            </div>
                                        )}

                                        {!isCustosMensaisCLT && (
                                            <div className="rounded-xl border border-border/60 overflow-hidden">
                                                <button type="button" onClick={() => setForm(f => ({ ...f, nf_emite: !f.nf_emite, nf_numero: f.nf_emite ? "" : f.nf_numero }))} className={cn("w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors", form.nf_emite ? "bg-success-soft text-success-strong" : "bg-muted/40 text-muted-foreground hover:bg-muted/70")}>
                                                    <span>Emite Nota Fiscal (NF)?</span>
                                                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", form.nf_emite ? "bg-success-strong text-white" : "bg-muted text-muted-foreground")}>{form.nf_emite ? "SIM" : "NAO"}</span>
                                                </button>
                                                {form.nf_emite && (
                                                    <div className="px-4 py-3 bg-background border-t border-border/40">
                                                        <Label className="text-xs text-muted-foreground mb-1 block">Número / Código da NF</Label>
                                                        <Input value={form.nf_numero} onChange={e => setForm(f => ({ ...f, nf_numero: e.target.value }))} placeholder="Digite o número ou código da NF" className="h-10 rounded-xl" autoFocus />
                                                        {percentualIss > 0 && <p className="text-[11px] text-success-strong mt-1.5 font-medium">ISS de {percentualIss.toFixed(1)}% sera aplicado ao valor total.</p>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-dashed border-border/60" />

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Financeiro</p>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Forma de Pagamento <span className="text-destructive">*</span></Label>
                                                <Select value={form.forma_pagamento} onValueChange={(v) => setForm(f => ({ ...f, forma_pagamento: v }))}>
                                                    <SelectTrigger className={cn("h-11 rounded-xl", !form.forma_pagamento && "border-destructive/50")}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                    <SelectContent>{formaPagamentoOptions.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-sm font-semibold">Valor Unit. <span className="text-destructive">*</span>{hasRegraFinanceira && !isCustosMensaisCLT && <span className="ml-1 text-[10px] text-success-strong bg-success-soft px-1.5 py-0.5 rounded-full">Auto</span>}</Label>
                                                    <div className="relative">
                                                        <Input type="text" value={isCustosMensaisCLT ? (form.valor_unitario || "") : (form.valor_unitario || "")} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} readOnly={hasRegraFinanceira && !isCustosMensaisCLT} placeholder="0,00" className={cn("h-11 rounded-xl pr-14", (hasRegraFinanceira && !isCustosMensaisCLT) ? "bg-muted/40 text-muted-foreground cursor-not-allowed border-dashed" : "bg-background")} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R$</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-sm font-semibold">Custo com ISS</Label>
                                                    <div className={cn("h-11 rounded-xl flex items-center px-3 font-bold text-base border", custoIss > 0 ? "bg-success-soft border-success-strong/30 text-success-strong" : "bg-muted/50 border-border text-muted-foreground")}>{formatCurrency(custoIss)}</div>
                                                </div>
                                            </div>
                                            {vencimentoObrigatorio && (
                                                <div className="space-y-1.5">
                                                    <Label className="text-sm font-semibold">Data de Vencimento <span className="text-destructive">*</span></Label>
                                                    <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} className="h-11 rounded-xl" min={form.data} />
                                                </div>
                                            )}
                                            {(valorUnitarioEfetivo > 0 || totalFinal > 0) && (
                                                <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 text-xs text-muted-foreground space-y-2">
                                                    <div className="flex justify-between gap-3"><span>Formula</span><span className="font-mono font-bold text-foreground text-right">{baseCalculoResumo}</span></div>
                                                    <div className="flex justify-between gap-3"><span>ISS aplicado</span><span className="font-mono font-bold text-foreground">{percentualIss > 0 ? `${percentualIss.toFixed(1)}% = ${formatCurrency(custoIss)}` : "Nao aplicavel"}</span></div>
                                                    {totalFilme > 0 && (
                                                        <div className="flex justify-between gap-3"><span>Filme / adicional</span><span className="font-mono font-bold text-foreground">{formatCurrency(totalFilme)}</span></div>
                                                    )}
                                                    <div className="flex justify-between gap-3"><span>Base monetaria</span><span className="font-mono font-bold text-foreground">{formatCurrency(valorDescarga)}</span></div>
                                                    <div className="flex justify-between"><span>Base de calculo</span><span className="font-mono font-bold text-foreground">{baseCalculoResumo}</span></div>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Valor Total</Label>
                                                <div className={cn("h-11 rounded-xl flex items-center px-3 font-bold text-base border", totalFinal > 0 ? "bg-success-soft border-success-strong/30 text-success-strong" : "bg-muted/50 border-border text-muted-foreground")}>{formatCurrency(totalFinal)}</div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-semibold">Status Financeiro</Label>
                                                <Select value={form.status_financeiro} onValueChange={(v) => setForm(f => ({ ...f, status_financeiro: v }))}>
                                                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                                                        <SelectItem value="RECEBIDO">Recebido</SelectItem>
                                                        <SelectItem value="ATRASADO">Atrasado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    {etapaTresBlockReason && <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3"><p className="text-xs text-destructive font-medium">{etapaTresBlockReason}</p></div>}
                                </div>
                            )}

                            {etapaAtual === 4 && (
                                <div className="space-y-5">
                                    {/* 👥 SEÇÃO: EQUIPE 👥 */}
                                    {!isFluxoSemEquipe && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5" /> Selecione os colaboradores
                                                <Badge className="ml-auto">{quantidadeSelecionada}/{form.quantidade_colaboradores}</Badge>
                                            </p>
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                {colaboradoresFiltrados.map((colaborador: any) => {
                                                    const conduta = condutaColaboradores[colaborador.id] ?? { selected: false, hadInfraction: false, infractionTypes: [], notes: "" };
                                                    const regrasColaborador = [
                                                        ...getRegrasPorFuncao(colaborador.cargo || ""),
                                                        { id: "outros", label: "Outros", funcoes: ["*"] },
                                                    ];
                                                    return (
                                                        <div key={colaborador.id} className="rounded-xl border p-3 space-y-3">
                                                            <label className="flex items-start gap-3 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={conduta.selected}
                                                                    onChange={(e) =>
                                                                        setCondutaColaboradores((prev) => ({
                                                                            ...prev,
                                                                            [colaborador.id]: {
                                                                                ...conduta,
                                                                                selected: e.target.checked,
                                                                                hadInfraction: e.target.checked ? conduta.hadInfraction : false,
                                                                                infractionTypes: e.target.checked ? conduta.infractionTypes : [],
                                                                                notes: e.target.checked ? conduta.notes : "",
                                                                            },
                                                                        }))
                                                                    }
                                                                    className="mt-1 h-4 w-4 rounded accent-brand"
                                                                />
                                                                <div>
                                                                    <div className="text-sm font-semibold">{colaborador.nome}</div>
                                                                    <div className="text-xs text-muted-foreground">{colaborador.cargo || "Não informado"}</div>
                                                                </div>
                                                            </label>
                                                            {conduta.selected && (
                                                                <div className="ml-7 space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={conduta.hadInfraction}
                                                                            onChange={(e) =>
                                                                                setCondutaColaboradores((prev) => ({
                                                                                    ...prev,
                                                                                    [colaborador.id]: {
                                                                                        ...conduta,
                                                                                        hadInfraction: e.target.checked,
                                                                                        infractionTypes: e.target.checked ? conduta.infractionTypes : [],
                                                                                        notes: e.target.checked ? conduta.notes : "",
                                                                                    },
                                                                                }))
                                                                            }
                                                                            className="h-4 w-4 rounded accent-destructive"
                                                                        />
                                                                        <span className="text-sm">Teve infração?</span>
                                                                    </div>
                                                                    {conduta.hadInfraction && (
                                                                        <div className="space-y-3 rounded-xl border border-destructive/15 bg-destructive/5 p-3">
                                                                            <div className="space-y-1.5">
                                                                                <Label className="text-xs font-semibold">
                                                                                    Infracoes identificadas <span className="text-destructive">*</span>
                                                                                </Label>
                                                                                <div className="grid gap-2 sm:grid-cols-2">
                                                                                    {regrasColaborador.map((regra) => {
                                                                                        const checked = conduta.infractionTypes.includes(regra.id);
                                                                                        return (
                                                                                            <label
                                                                                                key={regra.id}
                                                                                                className={cn(
                                                                                                    "flex items-start gap-2 rounded-xl border bg-background px-3 py-2 text-xs transition-colors cursor-pointer",
                                                                                                    checked ? "border-destructive/40 bg-destructive/5" : "border-border/60",
                                                                                                )}
                                                                                            >
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={checked}
                                                                                                    onChange={(e) =>
                                                                                                        setCondutaColaboradores((prev) => ({
                                                                                                            ...prev,
                                                                                                            [colaborador.id]: {
                                                                                                                ...conduta,
                                                                                                                infractionTypes: e.target.checked
                                                                                                                    ? [...conduta.infractionTypes, regra.id]
                                                                                                                    : conduta.infractionTypes.filter((item) => item !== regra.id),
                                                                                                            },
                                                                                                        }))
                                                                                                    }
                                                                                                    className="mt-0.5 h-4 w-4 rounded accent-destructive"
                                                                                                />
                                                                                                <span>{regra.label}</span>
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                            {conduta.infractionTypes.includes("outros") && (
                                                                                <div className="space-y-1.5">
                                                                                    <Label className="text-xs font-semibold">Descreva a infração</Label>
                                                                                    <Textarea
                                                                                        value={conduta.notes}
                                                                                        onChange={(e) =>
                                                                                            setCondutaColaboradores((prev) => ({
                                                                                                ...prev,
                                                                                                [colaborador.id]: {
                                                                                                    ...conduta,
                                                                                                    notes: e.target.value,
                                                                                                },
                                                                                            }))
                                                                                        }
                                                                                        placeholder="Descreva a infração."
                                                                                        className="min-h-[72px] rounded-xl bg-background text-sm"
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 📋 DIVISOR 📋 */}
                                    {!isFluxoSemEquipe && <div className="border-t border-dashed border-border/60" />}

                                    {/* 📋 SEÇÃO: RESPONSÁVEL E OBSERVAÇÃO 📋 */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                            <ShieldAlert className="w-3.5 h-3.5" /> Responsável e Observações
                                        </p>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label>Responsável pelo lançamento</Label>
                                                <Input
                                                    value={perfil?.nome || perfil?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || ""}
                                                    readOnly
                                                    placeholder="Nome do responsável"
                                                    className="h-11 rounded-xl bg-muted/50 cursor-not-allowed text-muted-foreground"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Observação</Label>
                                                <Textarea
                                                    value={form.observacao}
                                                    onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                                                    placeholder="Observações adicionais sobre esta operação..."
                                                    className="rounded-xl min-h-[80px] text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {etapaQuatroBlockReason && (
                                        <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3">
                                            <p className="text-xs text-destructive font-medium">{etapaQuatroBlockReason}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className={cn(
                                    "w-full h-14 rounded-xl font-black text-lg shadow-lg transition-all duration-200 active:scale-[0.98]",
                                    (mutation.isPending || (etapaAtual === 2 && !!etapaDoisBlockReason) || (etapaAtual === 3 && !!etapaTresBlockReason) || (etapaAtual === 4 && !!etapaQuatroBlockReason))
                                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25 hover:shadow-orange-500/40"
                                )}
                                disabled={mutation.isPending || (etapaAtual === 2 && !!etapaDoisBlockReason) || (etapaAtual === 3 && !!etapaTresBlockReason) || (etapaAtual === 4 && !!etapaQuatroBlockReason)}
                            >
                                {mutation.isPending ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processando...
                                    </span>
                                ) : etapaAtual < 4 && !isFluxoSemEquipe ? "Continuar" : "Salvar Lançamento"}
                            </Button>
                        </form>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-muted/30 to-muted/10 border-dashed border-border/50 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-xs text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-orange-500" />
                                Resumo do Dia
                            </h4>
                            <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{form.data ? format(new Date(form.data + "T00:00:00"), "dd/MM/yyyy") : ""}</span>
                        </div>
                        {isLoadingResumo ? (
                            <div className="flex items-center justify-between text-center gap-2">
                                <Skeleton className="h-14 w-1/3" />
                                <Skeleton className="h-14 w-1/3" />
                                <Skeleton className="h-14 w-1/3" />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-center gap-2">
                                    <div className="bg-card/80 rounded-xl p-3 flex-1 border border-border/30">
                                        <p className="text-3xl font-black text-foreground leading-none">{resumo.total_lancamentos}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Lançamentos</p>
                                    </div>
                                    <div className="bg-card/80 rounded-xl p-3 flex-1 border border-border/30">
                                        <p className="text-3xl font-black text-foreground leading-none">{resumo.total_colaboradores}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Equipe</p>
                                    </div>
                                    <div className="bg-card/80 rounded-xl p-3 flex-1 border border-border/30">
                                        <p className="text-3xl font-black text-orange-600 leading-none">{resumo.pendencias}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Pendências</p>
                                    </div>
                                </div>
                                <div className="mt-4 text-center bg-gradient-to-r from-orange-500/10 to-brand/10 rounded-xl py-3 border border-orange-500/20">
                                    <p className="text-3xl font-black text-brand leading-none">{formatCurrency(Number(resumo.valor_total_produzido || 0))}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Valor Total</p>
                                </div>
                            </>
                        )}
                    </Card>
                </div>

                <div className="xl:col-span-7 2xl:col-span-8 space-y-6 min-w-0">
                    <Card className="border-border shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="p-4 sm:p-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/30">
                            <h3 className="font-black font-display text-foreground flex items-center gap-2 text-base sm:text-lg">
                                <History className="w-5 h-5 text-muted-foreground" />
                                Lançamentos do Dia
                            </h3>
                            <span className="w-fit text-[10px] font-bold bg-background px-3 py-1 rounded-full border border-border">
                                {form.data}
                            </span>
                        </div>

                        <div className="flex-1 min-w-0">
                            {isLoadingHistory ? (
                                <div className="p-4 space-y-4">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
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
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-4">
                                        {(historico as any[]).map((item: any) => {
                                            const valorItem = Number(item.valor_total || 0);
                                            const produto = item.produtos_carga?.nome ?? null;
                                            const fornecedor = item.fornecedores?.nome ?? null;
                                            const transportadora = item.transportadoras_clientes?.nome ?? null;
                                            const qtd = Number(item.quantidade || 0);
                                            const valUnit = Number(item.valor_unitario_snapshot || 0);
                                            return (
                                                <div key={item.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                                                    {/* Header: tipo de servico + hora + status + deletar */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-sm text-foreground">{item.tipos_servico_operacional?.nome ?? "Operacao"}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.criado_em ? format(new Date(item.criado_em), "HH:mm") : ""}
                                                                {transportadora ? ` · ${transportadora}` : ""}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Badge variant={getStatusVariant(
                                                                item.status_pagamento === "RECEBIDO" || item.status_pagamento === "Recebido" ? "Recebido" : item.status
                                                            )}>
                                                                {item.status_pagamento === "RECEBIDO" || item.status_pagamento === "Recebido" ? "Recebido" : item.status}
                                                            </Badge>
                                                            {(item.status === "pendente" || item.status === "com_alerta") &&
                                                                (item.status_pagamento !== "RECEBIDO" && item.status_pagamento !== "Recebido") && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        title="Cancelar Operacao"
                                                                        onClick={() => setCancelItemId(item.id)}
                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                        </div>
                                                    </div>
                                                    {/* Detalhes: produto/fornecedor + valores */}
                                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                                                        <div className="space-y-0.5 min-w-0">
                                                            {(produto || fornecedor) && (
                                                                <p className="text-xs font-semibold text-foreground truncate">
                                                                    {produto ?? fornecedor}
                                                                </p>
                                                            )}
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {qtd > 0 ? `${qtd} un` : ""}
                                                                {valUnit > 0 ? ` x ${valUnit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-sm font-black leading-none ${valorItem > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                                                {valorItem > 0
                                                                    ? valorItem.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                                                    : "—"}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">total</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
            <Dialog open={produtoDialogOpen} onOpenChange={setProdutoDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cadastrar produto</DialogTitle>
                        <DialogDescription>
                            Cadastre um novo produto/carga para o fornecedor selecionado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input value={produtoDraft.nome} onChange={(e) => setProdutoDraft(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do produto" />
                        <Input value={produtoDraft.categoria} onChange={(e) => setProdutoDraft(p => ({ ...p, categoria: e.target.value }))} placeholder="Categoria (opcional)" />
                    </div>
                    {produtoSimilarOptions.length > 0 && <p className="text-sm text-amber-600">Já existe um produto parecido.</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProdutoDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => createProdutoMutation.mutate()} disabled={createProdutoMutation.isPending}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!cancelItemId} onOpenChange={(open) => !open && setCancelItemId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancelar Operação</DialogTitle>
                        <DialogDescription>
                            Deseja realmente cancelar esta operação? Por favor, informe o motivo do cancelamento para fins de auditoria.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="motivo">Motivo do Cancelamento <span className="text-destructive">*</span></Label>
                        <Input
                            id="motivo"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Ex: Lançamento duplicado"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelItemId(null)} disabled={cancelMutation.isPending}>
                            Voltar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => cancelItemId && cancelMutation.mutate({ id: cancelItemId, reason: cancelReason })}
                            disabled={cancelMutation.isPending || cancelReason.trim().length < 3}
                        >
                            {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OperationalShell >
    );
};

export default LancamentoProducao;
