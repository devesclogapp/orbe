import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
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
    Zap,
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
import { cn } from "@/lib/utils";
import {
    ColaboradorService,
    EmpresaService,
    FormaPagamentoOperacionalService,
    FornecedorService,
    FornecedorValorServicoService,
    OperacaoProducaoService,
    PerfilUsuarioService,
    ProdutoCargaService,
    TipoServicoOperacionalService,
    TransportadoraClienteService,
    UnidadeOperacionalService,
} from "@/services/base.service";
import { toast } from "sonner";

type RegraAvaliacao = { id: string; label: string; funcoes: string[] };
type TipoCalculo = "volume" | "daily" | "operation" | "colaborador";
type StatusLancamento = "Processado" | "Pendente" | "Com alerta" | "Aguardando validação" | "Bloqueado";
type LookupOption = { id: string; nome: string };
type RuleLookupState = "idle" | "loading" | "found" | "missing" | "error" | "duplicate" | "needs_product";
type EtapaFormulario = 1 | 2;
type CondutaColaborador = {
    selected: boolean;
    hadInfraction: boolean;
    infractionType: string;
    notes: string;
};

type FormState = {
    data: string;
    empresa_id: string;
    unidade_id: string;
    tipo_servico: string;
    quantidade_colaboradores: string;
    transportadora: string;
    fornecedor: string;
    produto: string;
    quantidade: string;
    valor_unitario: string;
    forma_pagamento: string;
    horario_inicio: string;
    horario_fim: string;
    placa_veiculo: string;
    justificativa_data: string;
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

const REGRA_MENSAGEM_SEM_CADASTRO = "Fornecedor sem valor cadastrado. Solicite ao Admin ou Financeiro o cadastro da regra operacional.";
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

const getUnidadeRegraLabel = (tipo: TipoCalculo | null) => {
    if (tipo === "daily") return "diária";
    if (tipo === "operation") return "operação";
    if (tipo === "colaborador") return "colaborador";
    return "volume";
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
    // REGRA IMPORTANTE: Qtd Colaboradores NÃO influencia no valor, serve apenas para análise
    if (tipoCalculo === "operation") return valorUnitario;
    return quantidade * valorUnitario;
};

const getStatusVariant = (status: string) => {
    if (status === "Processado") return "success" as const;
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

const LancamentoProducao = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState<FormState>({
        data: today,
        empresa_id: "",
        unidade_id: "",
        tipo_servico: "",
        quantidade_colaboradores: "1",
        transportadora: "",
        fornecedor: "",
        produto: "",
        quantidade: "",
        valor_unitario: "",
        forma_pagamento: "",
        horario_inicio: "",
        horario_fim: "",
        placa_veiculo: "",
        justificativa_data: "",
    });
    const [etapaAtual, setEtapaAtual] = useState<EtapaFormulario>(1);
    const [condutaColaboradores, setCondutaColaboradores] = useState<Record<string, CondutaColaborador>>({});
    const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
    const [produtoDraft, setProdutoDraft] = useState({ nome: "", categoria: "" });

    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => (user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null)),
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: schemaDisponivel = false, isLoading: isCheckingSchema } = useQuery({
        queryKey: ["producao_schema_disponivel"],
        queryFn: () => OperacaoProducaoService.isAvailable().catch(() => false),
    });

    useEffect(() => {
        if (form.empresa_id) return;
        if (perfil?.empresa_id) {
            setForm((prev) => ({ ...prev, empresa_id: perfil.empresa_id }));
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

    const { data: colaboradoresRaw = [] } = useQuery({
        queryKey: ["colaboradores_producao", form.empresa_id],
        queryFn: () => ColaboradorService.getWithEmpresa(form.empresa_id || undefined),
        enabled: !!form.empresa_id,
    });

    const { data: tiposServicoDb = [], isLoading: isLoadingTipos } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
        enabled: schemaDisponivel,
    });

    const { data: transportadorasDb = [], isLoading: isLoadingTransp } = useQuery({
        queryKey: ["transportadoras_clientes", form.empresa_id],
        queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    const { data: fornecedoresDb = [], isLoading: isLoadingForn } = useQuery({
        queryKey: ["fornecedores_operacionais", form.empresa_id],
        queryFn: () => FornecedorService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    const { data: produtosDb = [] } = useQuery({
        queryKey: ["produtos_carga", form.fornecedor],
        queryFn: () => ProdutoCargaService.getByFornecedor(form.fornecedor),
        enabled: !!form.fornecedor && schemaDisponivel,
    });

    const { data: formasPagamentoDb = [], isLoading: isLoadingFormas } = useQuery({
        queryKey: ["formas_pagamento_operacional"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
        enabled: schemaDisponivel,
    });

    const colaboradoresFiltrados = useMemo(
        () =>
            (colaboradoresRaw as any[]).filter((colaborador: any) => {
                const tipoContrato = normalizeTipoContrato(colaborador.tipo_contrato);
                return (tipoContrato === "hora" || tipoContrato === "operacao") && colaborador.status !== "inativo" && !colaborador.deleted_at;
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

    const produtoSimilarOptions = useMemo(() => {
        const normalizedDraft = normalizeText(produtoDraft.nome);
        if (!normalizedDraft) return [];
        return produtoOptions.filter((item) => {
            const normalizedItem = normalizeText(item.nome);
            return normalizedItem === normalizedDraft || normalizedItem.includes(normalizedDraft) || normalizedDraft.includes(normalizedItem);
        });
    }, [produtoDraft.nome, produtoOptions]);

    const formaPagamentoOptions = useMemo(
        () => mapToLookupOptions(formasPagamentoDb as any[]),
        [formasPagamentoDb],
    );

    const formaPagamentoSelecionada = useMemo(
        () => formaPagamentoOptions.find((item) => item.id === form.forma_pagamento) ?? null,
        [formaPagamentoOptions, form.forma_pagamento],
    );

    const regraLookupHabilitada = !!form.empresa_id && !!form.data && !!form.tipo_servico && !!form.transportadora && !!form.fornecedor;

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
                fornecedorId: form.fornecedor,
                transportadoraId: form.transportadora || null,
                produtoCargaId: form.produto || null,
                dataOperacao: form.data,
            });
        },
        enabled: schemaDisponivel && regraLookupHabilitada,
        retry: false,
    });

    const regraValor = useMemo(() => {
        if (!regraValorRpc || !regraValorRpc.regra_encontrada) return null;
        return {
            tipoCalculo: regraValorRpc.tipo_calculo as TipoCalculo,
            valorUnitario: Number(regraValorRpc.valor_unitario || 0),
        };
    }, [regraValorRpc]);

    const ruleLookupState = useMemo<RuleLookupState>(() => {
        if (!form.fornecedor) return "idle";
        if (isBuscandoRegra) return "loading";
        if (erroRegraLookup) return "error";
        const statusRegra = regraValorRpc?.status_regra as RuleLookupState | undefined;
        if (statusRegra) return statusRegra;
        return regraValorRpc?.regra_encontrada ? "found" : "missing";
    }, [erroRegraLookup, form.fornecedor, isBuscandoRegra, regraValor, regraValorRpc]);

    const requiresProductSelection = Boolean(regraValorRpc?.produto_obrigatorio);

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            valor_unitario: regraValor ? String(regraValor.valorUnitario) : "",
            forma_pagamento: regraValorRpc?.forma_pagamento_id ?? prev.forma_pagamento,
        }));
    }, [regraValor, regraValorRpc?.forma_pagamento_id]);

    useEffect(() => {
        if (!regraValor) return;

        setForm((prev) => {
            if (regraValor.tipoCalculo === "operation" && prev.quantidade !== "1") {
                return { ...prev, quantidade: "1" };
            }

            if (regraValor.tipoCalculo === "colaborador" && prev.quantidade !== "1") {
                return { ...prev, quantidade: "1" };
            }

            return prev;
        });
    }, [regraValor]);

    const colaboradoresSelecionados = useMemo(
        () =>
            colaboradoresFiltrados.filter((colaborador: any) => condutaColaboradores[colaborador.id]?.selected),
        [colaboradoresFiltrados, condutaColaboradores],
    );

    const quantidadeSelecionada = colaboradoresSelecionados.length;
    const infracoesCount = Object.values(condutaColaboradores).filter((item) => item.selected && item.hadInfraction).length;
    const exibirPlaca = true;
    const quantidade = Number(form.quantidade || 0);
    const quantidadeColaboradores = Number(form.quantidade_colaboradores || 0);
    const valorUnitario = Number(form.valor_unitario || 0);
    const hasRegraFinanceira = !!regraValor;
    const tipoCalculoAtual = regraValor?.tipoCalculo ?? null;
    const quantidadeConsiderada = tipoCalculoAtual === "operation" ? 1 : quantidade;

    // Regras de Negócio do Novo Módulo:
    const valorDescarga = quantidadeConsiderada * valorUnitario;
    const custoIss = 0; // Preparado para ativação futura
    const totalFilme = 0; // Placeholder
    const totalFinal = valorDescarga + custoIss + totalFilme;

    const isDataRetroativa = form.data < today;
    const horarioInvalido = !!form.horario_inicio && !!form.horario_fim && form.horario_inicio > form.horario_fim;

    const mensagemRegra = useMemo(() => {
        if (ruleLookupState === "duplicate") return REGRA_MENSAGEM_DUPLICADA;
        if (ruleLookupState === "needs_product") return REGRA_MENSAGEM_PRODUTO;
        if (ruleLookupState === "error") return REGRA_MENSAGEM_ERRO;
        if (ruleLookupState === "missing") {
            return regraValorRpc?.mensagem_bloqueio
                ? String(regraValorRpc.mensagem_bloqueio)
                : REGRA_MENSAGEM_SEM_CADASTRO;
        }
        return "";
    }, [regraValorRpc, ruleLookupState]);

    const submissionBlockReason = useMemo(() => {
        if (!form.empresa_id) return "Selecione a empresa.";
        if (!form.data) return "Selecione a data da operação.";
        if (!form.tipo_servico) return "Selecione o tipo de serviço.";
        if (!form.transportadora) return "Selecione a transportadora ou cliente.";
        if (!form.fornecedor) return "Selecione o fornecedor.";
        if (requiresProductSelection && !form.produto) return REGRA_MENSAGEM_PRODUTO;
        if (!form.forma_pagamento) return "Selecione a forma de pagamento.";
        if (ruleLookupState === "loading") return "Buscando valor...";
        if (ruleLookupState === "duplicate" || ruleLookupState === "needs_product" || ruleLookupState === "error" || ruleLookupState === "missing") {
            return mensagemRegra;
        }
        if (!hasRegraFinanceira) return REGRA_MENSAGEM_SEM_CADASTRO;
        if (!Number.isInteger(Number(form.quantidade_colaboradores)) || Number(form.quantidade_colaboradores) <= 0) {
            return "Informe uma quantidade inteira de colaboradores maior que zero.";
        }
        if (quantidadeConsiderada <= 0) return "Informe uma quantidade maior que zero.";
        if (horarioInvalido) return "O horário de saída não pode ser menor que o horário de entrada.";
        if (isDataRetroativa && !form.justificativa_data.trim()) return "Informe a justificativa para lançar uma data retroativa.";
        return "";
    }, [
        form.data,
        form.empresa_id,
        form.fornecedor,
        form.forma_pagamento,
        form.justificativa_data,
        form.quantidade_colaboradores,
        form.produto,
        form.tipo_servico,
        form.transportadora,
        hasRegraFinanceira,
        horarioInvalido,
        isDataRetroativa,
        mensagemRegra,
        quantidadeConsiderada,
        requiresProductSelection,
        ruleLookupState,
    ]);

    const etapaDoisBlockReason = useMemo(() => {
        const quantidadeInformada = Number(form.quantidade_colaboradores || 0);
        if (quantidadeSelecionada !== quantidadeInformada) {
            return `Você informou ${quantidadeInformada} colaboradores envolvidos, mas selecionou ${quantidadeSelecionada}. Selecione exatamente ${quantidadeInformada} colaboradores para continuar.`;
        }

        const colaboradorComInfracaoSemTipo = colaboradoresSelecionados.find((colaborador: any) => {
            const conduta = condutaColaboradores[colaborador.id];
            return conduta?.selected && conduta.hadInfraction && !conduta.infractionType;
        });

        if (colaboradorComInfracaoSemTipo) {
            return `Informe o tipo de infração para ${colaboradorComInfracaoSemTipo.nome}.`;
        }

        return "";
    }, [colaboradoresSelecionados, condutaColaboradores, form.quantidade_colaboradores, quantidadeSelecionada]);

    const { data: historico = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ["producao_recente", form.empresa_id, form.unidade_id, form.data],
        queryFn: () => OperacaoProducaoService.getByDate(form.data, form.empresa_id, form.unidade_id || null),
        enabled: !!form.empresa_id && schemaDisponivel,
    });

    const createProdutoMutation = useMutation({
        mutationFn: async () => {
            if (!form.fornecedor) throw new Error("Selecione o fornecedor antes de cadastrar o produto/carga.");
            if (!produtoDraft.nome.trim()) throw new Error("Informe o nome do produto/carga.");

            const duplicate = produtoOptions.find((item) => normalizeText(item.nome) === normalizeText(produtoDraft.nome));
            if (duplicate) {
                throw new Error("Já existe um produto/carga com nome equivalente para este fornecedor.");
            }

            return ProdutoCargaService.create({
                fornecedor_id: form.fornecedor,
                nome: produtoDraft.nome.trim(),
                categoria: produtoDraft.categoria.trim() || null,
                descricao: produtoDraft.categoria.trim() ? `Categoria: ${produtoDraft.categoria.trim()}` : null,
                ativo: true,
            });
        },
        onSuccess: async (data: any) => {
            await queryClient.invalidateQueries({ queryKey: ["produtos_carga"] });
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

    const { data: resumoV2 } = useQuery({
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
                (acc, item) =>
                    acc +
                    Number(
                        item.avaliacao_json?.contexto_operacional?.total_previsto ??
                        Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
                    ),
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

    const resumo = resumoV2 ?? resumoFallback;

    const mutation = useMutation({
        mutationFn: ({ operacao, colaboradores }: any) => OperacaoProducaoService.createWithColaboradores(operacao, colaboradores),
        onSuccess: () => {
            toast.success("Produção registrada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            setForm((prev) => ({
                ...prev,
                quantidade_colaboradores: "1",
                transportadora: "",
                fornecedor: "",
                produto: "",
                quantidade: "",
                valor_unitario: "",
                forma_pagamento: "",
                horario_inicio: "",
                horario_fim: "",
                placa_veiculo: "",
                justificativa_data: "",
            }));
            setCondutaColaboradores({});
            setEtapaAtual(1);
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (etapaAtual === 1) {
            if (submissionBlockReason) {
                toast.error(submissionBlockReason);
                return;
            }

            setEtapaAtual(2);
            return;
        }

        if (submissionBlockReason || etapaDoisBlockReason) {
            toast.error(submissionBlockReason || etapaDoisBlockReason);
            return;
        }

        const status: StatusLancamento = infracoesCount > 0
            ? "Com alerta"
            : !form.horario_inicio || !form.horario_fim
                ? "Aguardando validação"
                : "Pendente";

        const avaliacaoJson = {
            colaboradores: colaboradoresSelecionados.map((colaborador: any) => {
                const conduta = condutaColaboradores[colaborador.id];
                return {
                    collaborator_id: colaborador.id,
                    nome: colaborador.nome,
                    cargo: colaborador.cargo,
                    had_infraction: conduta?.hadInfraction ?? false,
                    infraction_type: conduta?.infractionType || null,
                    infraction_notes: conduta?.notes?.trim() || null,
                };
            }),
            total_infracoes: infracoesCount,
            total_colaboradores_vinculados: quantidadeSelecionada,
            contexto_operacional: {
                fornecedor: fornecedorSelecionado?.nome ?? form.fornecedor,
                produto: produtoSelecionado?.nome ?? form.produto,
                forma_pagamento: formaPagamentoSelecionada?.nome ?? form.forma_pagamento,
                quantidade_colaboradores: quantidadeColaboradores,
                tipo_calculo: tipoCalculoAtual,
                total_previsto: totalFinal,
                valor_descarga: valorDescarga,
                custo_com_iss: custoIss,
                total_e_filme: totalFilme,
                justificativa_data: form.justificativa_data.trim() || null,
            },
        };

        mutation.mutate({
            operacao: {
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
                    ? 1
                    : tipoCalculoAtual === "colaborador"
                        ? quantidadeColaboradores
                        : quantidade,
                valor_unitario_snapshot: valorUnitario,
                tipo_calculo_snapshot: regraValor?.tipoCalculo ?? "volume",
                forma_pagamento_id: form.forma_pagamento || null,
                placa: form.placa_veiculo || null,
                status: status.toLowerCase().replace(/\s+/g, "_"),
                avaliacao_json: avaliacaoJson,
                justificativa_retroativa: form.justificativa_data.trim() || null,
                origem_dado: "manual",
            },
            colaboradores: colaboradoresSelecionados.map((colaborador: any) => {
                const conduta = condutaColaboradores[colaborador.id];
                return {
                    collaborator_id: colaborador.id,
                    had_infraction: conduta?.hadInfraction ?? false,
                    infraction_type_id: conduta?.infractionType || null,
                    infraction_notes: conduta?.notes?.trim() || null,
                };
            }),
        });
    };

    const currentEmpresa = (empresas as any[]).find((empresa: any) => empresa.id === form.empresa_id);
    const currentUnidade = (unidadesDb as any[]).find((unidade: any) => unidade.id === form.unidade_id);
    const currentUnitName = currentUnidade?.nome || currentEmpresa?.nome;
    const unitLocked = !!perfil?.empresa_id;

    // --- READINESS GATE ---
    const cadastrosAusentes: string[] = [];
    if ((empresas as any[]).length === 0) cadastrosAusentes.push("Empresas");
    if (schemaDisponivel && tipoServicoOptions.length === 0 && !isLoadingTipos) cadastrosAusentes.push("Tipos de Serviço");
    if (schemaDisponivel && form.empresa_id && transportadorasDisponiveis.length === 0 && !isLoadingTransp) cadastrosAusentes.push("Transportadoras / Clientes");
    if (schemaDisponivel && form.empresa_id && fornecedoresDisponiveis.length === 0 && !isLoadingForn) cadastrosAusentes.push("Fornecedores");
    if (schemaDisponivel && formaPagamentoOptions.length === 0 && !isLoadingFormas) cadastrosAusentes.push("Formas de Pagamento");
    if (form.empresa_id && colaboradoresFiltrados.length === 0) cadastrosAusentes.push("Colaboradores (Intermitente/Produção)");

    const producaoBloqueada = !schemaDisponivel || cadastrosAusentes.length > 0;

    if (isCheckingSchema) {
        return (
            <OperationalShell title="PRODUÇÃO IN-LOCO" unitName={currentUnitName || "Sincronizando..."}>
                <div className="flex flex-col items-center justify-center p-24">
                    <Clock className="w-10 h-10 animate-pulse text-muted-foreground mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">Verificando disponibilidade do schema operacional...</p>
                </div>
            </OperationalShell>
        );
    }

    if (!schemaDisponivel) {
        return (
            <OperationalShell title="PRODUÇÃO IN-LOCO" unitName={currentUnitName || "—"}>
                <Card className="p-8 max-w-2xl mx-auto mt-12 text-center space-y-4 border-destructive/30">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="text-xl font-black font-display text-foreground">Schema operacional não encontrado</h2>
                    <p className="text-sm text-muted-foreground">
                        As tabelas de produção (<code>operacoes_producao</code>, <code>tipos_servico_operacional</code>, etc.) não foram detectadas no banco de dados.
                        Execute a migration do módulo operacional antes de usar esta tela.
                    </p>
                    <Badge variant="error" className="font-bold">Produção bloqueada</Badge>
                </Card>
            </OperationalShell>
        );
    }

    return (
        <OperationalShell title="PRODUÇÃO IN-LOCO" unitName={currentUnitName || "Sincronizando..."}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6 2xl:gap-8">
                <div className="xl:col-span-12">
                    <Card className="p-4 bg-info-soft/40 border-info/20 shadow-none">
                        <div className="flex items-start gap-3 text-info-strong">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold font-display uppercase tracking-tight">
                                    Registro operacional em tempo real
                                </p>
                                <p className="text-sm">
                                    Registros imediatos de carga, descarga e movimentações. Preencha os dados da operação e depois vincule a equipe com a conduta de cada colaborador.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="xl:col-span-5 2xl:col-span-4 space-y-4">
                    <Card className="p-6 border-border shadow-sm">
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <h3 className="text-lg font-black font-display text-foreground flex items-center gap-2">
                                <Zap className="w-5 h-5 text-brand" />
                                Novo Registro
                            </h3>
                            {producaoBloqueada && (
                                <Badge variant="error" className="font-bold">Cadastros ausentes</Badge>
                            )}
                        </div>

                        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    {etapaAtual === 1 ? "Etapa 1 de 2" : "Etapa 2 de 2"}
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {etapaAtual === 1 ? "Dados da operação" : "Colaboradores e conduta"}
                                </p>
                            </div>
                            {etapaAtual === 2 && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setEtapaAtual(1)}>
                                    Voltar
                                </Button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    Empresa
                                </Label>
                                <Select
                                    value={form.empresa_id}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            empresa_id: value,
                                            unidade_id: "",
                                            tipo_servico: "",
                                            transportadora: "",
                                            fornecedor: "",
                                            produto: "",
                                            forma_pagamento: "",
                                        }))
                                    }
                                    disabled={unitLocked}
                                >
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Selecione a empresa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(empresas as any[]).map((empresa: any) => (
                                            <SelectItem key={empresa.id} value={empresa.id}>
                                                {empresa.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {(unidadesDb as any[]).length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" />
                                        Unidade
                                    </Label>
                                    <Select
                                        value={form.unidade_id}
                                        onValueChange={(value) => setForm((prev) => ({ ...prev, unidade_id: value }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Selecione a unidade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(unidadesDb as any[]).map((unidade: any) => (
                                                <SelectItem key={unidade.id} value={unidade.id}>
                                                    {unidade.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Data</Label>
                                    <Input
                                        type="date"
                                        value={form.data}
                                        onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                                        className="h-11 rounded-xl"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label>
                                        Tipo de Serviço <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={form.tipo_servico}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                tipo_servico: value,
                                                transportadora: "",
                                                fornecedor: "",
                                                produto: "",
                                                quantidade: "",
                                                quantidade_colaboradores: "1",
                                                valor_unitario: "",
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {tipoServicoOptions.map((tipo) => (
                                                <SelectItem key={tipo.id} value={tipo.id}>
                                                    {tipo.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {isDataRetroativa && (
                                <div className="rounded-xl border border-warning/20 bg-warning-soft/40 p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-warning-strong">
                                        <ShieldAlert className="w-4 h-4" />
                                        <span className="text-sm font-bold">Data retroativa detectada</span>
                                    </div>
                                    <Textarea
                                        placeholder="Informe a justificativa para o lançamento retroativo"
                                        value={form.justificativa_data}
                                        onChange={(e) => setForm((prev) => ({ ...prev, justificativa_data: e.target.value }))}
                                        className="rounded-xl min-h-[84px]"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        Entrada (ponto)
                                    </Label>
                                    <Input
                                        type="time"
                                        value={form.horario_inicio}
                                        onChange={(e) => setForm((prev) => ({ ...prev, horario_inicio: e.target.value }))}
                                        className="h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        Saída (ponto)
                                    </Label>
                                    <Input
                                        type="time"
                                        value={form.horario_fim}
                                        onChange={(e) => setForm((prev) => ({ ...prev, horario_fim: e.target.value }))}
                                        className="h-11 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5" />
                                    Transportadora / Cliente <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.transportadora}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            transportadora: value,
                                            fornecedor: "",
                                            produto: "",
                                            quantidade: "",
                                            quantidade_colaboradores: "1",
                                            valor_unitario: "",
                                        }))
                                    }
                                    disabled={!form.tipo_servico}
                                >
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder={!form.tipo_servico ? "Selecione o tipo de serviço antes" : "Selecione a transportadora"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {transportadorasDisponiveis.map((transportadora) => (
                                            <SelectItem key={transportadora.id} value={transportadora.id}>
                                                {transportadora.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" />
                                        Fornecedor <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={form.fornecedor}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                fornecedor: value,
                                                produto: "",
                                                quantidade: "",
                                                quantidade_colaboradores: "1",
                                            }))
                                        }
                                        disabled={!form.tipo_servico || !form.transportadora}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue
                                                placeholder={
                                                    !form.tipo_servico
                                                        ? "Selecione o tipo antes"
                                                        : !form.transportadora
                                                            ? "Selecione a transportadora antes"
                                                            : "Selecione o fornecedor"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fornecedoresDisponiveis.map((fornecedor) => (
                                                <SelectItem key={fornecedor.id} value={fornecedor.id}>
                                                    {fornecedor.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5" />
                                            Produto / Carga {requiresProductSelection && <span className="text-destructive">*</span>}
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            disabled={!form.fornecedor}
                                            onClick={() => {
                                                setProdutoDraft({ nome: "", categoria: "" });
                                                setProdutoDialogOpen(true);
                                            }}
                                        >
                                            <Plus className="mr-1 h-3.5 w-3.5" />
                                            Novo
                                        </Button>
                                    </div>
                                    <Select
                                        value={form.produto}
                                        onValueChange={(value) => setForm((prev) => ({ ...prev, produto: value }))}
                                        disabled={!form.fornecedor}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder={!form.fornecedor ? "Selecione o fornecedor antes" : "Selecione o produto, se aplicável"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {produtoOptions.map((produto) => (
                                                <SelectItem key={produto.id} value={produto.id}>
                                                    {produto.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {requiresProductSelection && !form.produto && (
                                <div className="rounded-xl border border-warning/20 bg-warning-soft/40 p-3 text-sm text-warning-strong">
                                    {REGRA_MENSAGEM_PRODUTO}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label>Quantidade da operação <span className="text-destructive">*</span></Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder={getQuantidadePlaceholder(tipoCalculoAtual)}
                                    value={form.quantidade}
                                    onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))}
                                    disabled={!hasRegraFinanceira || ruleLookupState === "loading" || tipoCalculoAtual === "operation"}
                                    className={cn(
                                        "h-11 rounded-xl text-center font-black text-lg",
                                        (!hasRegraFinanceira || ruleLookupState === "loading" || tipoCalculoAtual === "operation") && "opacity-70",
                                    )}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    {tipoCalculoAtual === "operation"
                                        ? "Registros por operação usam quantidade automática de 1."
                                        : !hasRegraFinanceira
                                            ? "A quantidade será liberada assim que uma regra válida for encontrada."
                                            : "Informe a quantidade considerada no cálculo previsto."}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Quantidade de colaboradores envolvidos <span className="text-destructive">*</span></Label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    value={form.quantidade_colaboradores}
                                    onChange={(e) => setForm((prev) => ({ ...prev, quantidade_colaboradores: e.target.value.replace(/[^\d]/g, "") }))}
                                    className="h-11 rounded-xl text-center font-black text-lg"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Informe a quantidade total de colaboradores envolvidos para liberar a etapa 2.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label>Valor Unitário</Label>
                                    <Badge variant="info" className="font-bold">Automático</Badge>
                                </div>
                                <Input
                                    value={
                                        ruleLookupState === "loading"
                                            ? "Buscando valor..."
                                            : hasRegraFinanceira
                                                ? `${formatCurrency(valorUnitario)} por ${getUnidadeRegraLabel(tipoCalculoAtual)}`
                                                : ruleLookupState === "missing" || ruleLookupState === "duplicate" || ruleLookupState === "needs_product" || ruleLookupState === "error"
                                                    ? "Fornecedor sem valor cadastrado"
                                                    : "Aguardando regra"
                                    }
                                    readOnly
                                    placeholder="Aguardando regra"
                                    className={cn(
                                        "h-11 rounded-xl text-right font-display font-bold",
                                        ruleLookupState === "found" && "border-success text-success",
                                        (ruleLookupState === "missing" || ruleLookupState === "duplicate" || ruleLookupState === "needs_product" || ruleLookupState === "error") && "border-destructive text-destructive",
                                    )}
                                />
                            </div>

                            {!!mensagemRegra && form.fornecedor && ruleLookupState !== "loading" && (
                                <div className="rounded-xl border border-destructive/20 bg-destructive-soft/40 p-4 text-sm text-destructive-strong">
                                    {mensagemRegra}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Wallet className="w-3.5 h-3.5" />
                                        Forma de pagamento <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={form.forma_pagamento}
                                        onValueChange={(value) => setForm((prev) => ({ ...prev, forma_pagamento: value }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {formaPagamentoOptions.map((forma) => (
                                                <SelectItem key={forma.id} value={forma.id}>
                                                    {forma.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5" />
                                        Placa do veículo
                                    </Label>
                                    <Input
                                        placeholder={exibirPlaca ? "Ex: ABC-1D23" : "Opcional"}
                                        value={form.placa_veiculo}
                                        onChange={(e) => setForm((prev) => ({ ...prev, placa_veiculo: e.target.value.toUpperCase() }))}
                                        className="h-11 rounded-xl font-mono uppercase"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Preview de cálculo
                                    </span>
                                    <Badge variant={hasRegraFinanceira ? "success" : "warning"}>
                                        {getTipoCalculoLabel(tipoCalculoAtual)}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Valor de Descarga</p>
                                        <p className="text-lg font-black font-display">
                                            {formatCurrency(valorDescarga)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Custo com ISS</p>
                                        <p className="text-sm font-black text-muted-foreground">
                                            {formatCurrency(custoIss)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Total do Filme</p>
                                        <p className="text-sm font-black text-muted-foreground">
                                            {formatCurrency(totalFilme)}
                                        </p>
                                    </div>
                                    <div className="bg-brand/10 p-2 rounded-lg -mx-2 px-2">
                                        <p className="text-[11px] text-brand/80 font-bold uppercase">TOTAL FINAL</p>
                                        <p className="text-xl font-black font-display text-brand">
                                            {formatCurrency(totalFinal)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Quantidade (QTD)</p>
                                        <p className="text-lg font-black font-display">{quantidadeConsiderada || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Base do cálculo</p>
                                        <p className="text-sm font-bold">
                                            {tipoCalculoAtual === "operation"
                                                ? "1 operação x " + formatCurrency(valorUnitario || 0)
                                                : `${quantidadeConsiderada || 0} x ${formatCurrency(valorUnitario || 0)}`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {etapaAtual === 2 && (
                                <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">Seleção da equipe</p>
                                            <p className="text-xs text-muted-foreground">
                                                Selecione exatamente {quantidadeColaboradores} colaborador(es) e registre a conduta individual.
                                            </p>
                                        </div>
                                        <Badge variant={quantidadeSelecionada === quantidadeColaboradores ? "success" : "warning"}>
                                            {quantidadeSelecionada}/{quantidadeColaboradores}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                        {colaboradoresFiltrados.map((colaborador: any) => {
                                            const conduta = condutaColaboradores[colaborador.id] ?? {
                                                selected: false,
                                                hadInfraction: false,
                                                infractionType: "",
                                                notes: "",
                                            };
                                            const regrasPorCargo = getRegrasPorFuncao(colaborador.cargo ?? "");

                                            return (
                                                <div key={colaborador.id} className="rounded-xl border border-border p-3 space-y-3">
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
                                                                    },
                                                                }))
                                                            }
                                                            className="mt-1 h-4 w-4 rounded accent-brand"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-foreground">{colaborador.nome}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {colaborador.cargo || "Cargo não informado"} · Ativo
                                                            </div>
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
                                                                                infractionType: e.target.checked ? conduta.infractionType : "",
                                                                                notes: e.target.checked ? conduta.notes : "",
                                                                            },
                                                                        }))
                                                                    }
                                                                    className="h-4 w-4 rounded accent-destructive"
                                                                />
                                                                <span className="text-sm">Teve infração?</span>
                                                            </div>

                                                            {conduta.hadInfraction && (
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">Tipo de infração</Label>
                                                                        <Select
                                                                            value={conduta.infractionType}
                                                                            onValueChange={(value) =>
                                                                                setCondutaColaboradores((prev) => ({
                                                                                    ...prev,
                                                                                    [colaborador.id]: {
                                                                                        ...conduta,
                                                                                        infractionType: value,
                                                                                    },
                                                                                }))
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-10 rounded-xl">
                                                                                <SelectValue placeholder="Selecione" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {regrasPorCargo.map((regra) => (
                                                                                    <SelectItem key={regra.id} value={regra.label}>
                                                                                        {regra.label}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">Observação</Label>
                                                                        <Textarea
                                                                            placeholder="Opcional"
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
                                                                            className="rounded-xl text-sm resize-none min-h-[72px]"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {etapaDoisBlockReason && (
                                        <div className="rounded-xl border border-warning/20 bg-warning-soft/40 p-3 text-sm text-warning-strong">
                                            {etapaDoisBlockReason}
                                        </div>
                                    )}
                                </div>
                            )}

                            {cadastrosAusentes.length > 0 && (
                                <div className="rounded-xl border border-destructive/20 bg-destructive-soft/40 p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-destructive-strong">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-sm font-bold">Cadastros base ausentes</span>
                                    </div>
                                    <p className="text-sm text-destructive-strong">
                                        A produção está bloqueada. Os seguintes cadastros precisam ser criados antes de registrar operações:
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-destructive-strong space-y-0.5">
                                        {cadastrosAusentes.map((c) => <li key={c}>{c}</li>)}
                                    </ul>
                                </div>
                            )}

                            {submissionBlockReason && (
                                <div className="rounded-xl border border-warning/20 bg-warning-soft/40 p-3 text-sm text-warning-strong">
                                    {submissionBlockReason}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-brand hover:bg-brand/90 font-black text-lg shadow-lg shadow-brand/20 mt-2 gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={mutation.isPending || !!submissionBlockReason || (etapaAtual === 2 && !!etapaDoisBlockReason)}
                            >
                                {mutation.isPending ? "Salvando..." : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {etapaAtual === 1 ? "Continuar para colaboradores" : "Registrar Produção"}
                                    </>
                                )}
                            </Button>
                        </form>
                    </Card>

                    <Card className="p-5 bg-muted/20 border-dashed border-border shadow-none">
                        <h4 className="font-bold text-sm text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Resumo de Hoje
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Lançamentos</span>
                                <span className="text-2xl font-black text-foreground">{resumo.total_lancamentos}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Colaboradores</span>
                                <span className="text-2xl font-black text-foreground">{resumo.total_colaboradores}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Quantidade</span>
                                <span className="text-2xl font-black text-foreground">{Number(resumo.total_quantidade || 0)}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Valor total</span>
                                <span className="text-xl font-black text-brand">{formatCurrency(Number(resumo.valor_total_produzido || 0))}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Pendências</span>
                                <span className="text-2xl font-black text-info-strong">{resumo.pendencias}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Alertas</span>
                                <span className="text-2xl font-black text-warning-strong">{resumo.alertas}</span>
                            </div>
                        </div>
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
                                <>
                                    <div className="space-y-3 p-4 md:hidden">
                                        {(historico as any[]).map((item: any) => {
                                            const tipoServicoLabel = item.tipos_servico_operacional?.nome;
                                            const colaboradorLabel = item.colaboradores?.nome;
                                            const transportadoraLabel = item.transportadoras_clientes?.nome;
                                            const fornecedorLabel = item.fornecedores?.nome;
                                            const produtoLabel = item.produtos_carga?.nome;
                                            const formaPagamentoLabel = item.formas_pagamento_operacional?.nome;
                                            const quantidadeItem = Number(item.quantidade || 0);
                                            const quantidadeColaboradoresItem = Number(
                                                item.quantidade_colaboradores ??
                                                item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores ??
                                                (item.tipo_calculo_snapshot === "colaborador" ? item.quantidade : 0) ??
                                                0,
                                            );
                                            const unitarioItem = Number(item.valor_unitario_snapshot || 0);
                                            const totalItem = Number(item.valor_total || 0);
                                            const tipoCalculoItem = item.tipo_calculo_snapshot ?? null;
                                            const quantidadeExibida = tipoCalculoItem === "colaborador" ? quantidadeColaboradoresItem : quantidadeItem;
                                            const statusLabel = String(item.status ?? "Pendente")
                                                .replace(/_/g, " ")
                                                .replace(/\b\w/g, (char) => char.toUpperCase());
                                            const placaLabel = item.placa;
                                            const createdAt = item.criado_em;

                                            return (
                                                <div key={item.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-sm text-foreground">{tipoServicoLabel}</p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {createdAt ? format(new Date(createdAt), "HH:mm") : "â€”"}
                                                                {colaboradorLabel ? ` · ${colaboradorLabel}` : ""}
                                                            </p>
                                                        </div>
                                                        <Badge variant={getStatusVariant(statusLabel)} className="shrink-0">
                                                            {statusLabel}
                                                        </Badge>
                                                    </div>

                                                    <div className="space-y-1 text-[11px] text-muted-foreground">
                                                        <p>{transportadoraLabel || "Sem transportadora"}</p>
                                                        <p>{fornecedorLabel || "Fornecedor nÃ£o informado"} · {produtoLabel || "Produto nÃ£o informado"}</p>
                                                        <p>
                                                            {formaPagamentoLabel || "Forma nÃ£o informada"}
                                                            {placaLabel ? ` · ${placaLabel}` : ""}
                                                        </p>
                                                        <p>{quantidadeColaboradoresItem > 0 ? `${quantidadeColaboradoresItem} colaborador(es)` : "Sem equipe informada"}</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="rounded-xl bg-muted/30 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quantidade</p>
                                                            <p className="text-sm font-black text-foreground">{quantidadeExibida}</p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {unitarioItem > 0 ? formatCurrency(unitarioItem) : "Sem valor"}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-xl bg-muted/30 p-3 text-right">
                                                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total</p>
                                                            <p className="text-sm font-black font-display text-foreground">{formatCurrency(totalItem)}</p>
                                                            <p className="text-[11px] text-muted-foreground">{getTipoCalculoLabel(tipoCalculoItem)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-9 rounded-xl px-3 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                if (confirm("Deseja remover este registro?")) {
                                                                    OperacaoProducaoService.delete(item.id).then(() => {
                                                                        toast.success("Registro removido");
                                                                        queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
                                                                        queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Remover
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="hidden overflow-x-auto md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                                                    <TableHead className="font-bold text-[10px] uppercase">Serviço</TableHead>
                                                    <TableHead className="font-bold text-[10px] uppercase">Vínculos</TableHead>
                                                    <TableHead className="font-bold text-[10px] uppercase">Quantidade</TableHead>
                                                    <TableHead className="font-bold text-[10px] uppercase text-right">Valor</TableHead>
                                                    <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
                                                    <TableHead />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(historico as any[]).map((item: any) => {
                                                    const tipoServicoLabel = item.tipos_servico_operacional?.nome;
                                                    const colaboradorLabel = item.colaboradores?.nome;
                                                    const transportadoraLabel = item.transportadoras_clientes?.nome;
                                                    const fornecedorLabel = item.fornecedores?.nome;
                                                    const produtoLabel = item.produtos_carga?.nome;
                                                    const formaPagamentoLabel = item.formas_pagamento_operacional?.nome;
                                                    const quantidadeItem = Number(item.quantidade || 0);
                                                    const quantidadeColaboradoresItem = Number(
                                                        item.quantidade_colaboradores ??
                                                        item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores ??
                                                        (item.tipo_calculo_snapshot === "colaborador" ? item.quantidade : 0) ??
                                                        0,
                                                    );
                                                    const unitarioItem = Number(item.valor_unitario_snapshot || 0);
                                                    const totalItem = Number(item.valor_total || 0);
                                                    const tipoCalculoItem = item.tipo_calculo_snapshot ?? null;
                                                    const quantidadeExibida = tipoCalculoItem === "colaborador" ? quantidadeColaboradoresItem : quantidadeItem;
                                                    const statusLabel = String(item.status ?? "Pendente")
                                                        .replace(/_/g, " ")
                                                        .replace(/\b\w/g, (char) => char.toUpperCase());
                                                    const placaLabel = item.placa;
                                                    const createdAt = item.criado_em;

                                                    return (
                                                        <TableRow key={item.id} className="border-border hover:bg-muted/30 group transition-colors">
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    <span className="font-bold text-sm block">{tipoServicoLabel}</span>
                                                                    <span className="text-[10px] text-muted-foreground block">
                                                                        {createdAt ? format(new Date(createdAt), "HH:mm") : "—"}
                                                                    </span>
                                                                    {colaboradorLabel && (
                                                                        <span className="text-[11px] text-muted-foreground block">{colaboradorLabel}</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    <span className="text-xs font-semibold block">{transportadoraLabel || "Sem transportadora"}</span>
                                                                    <span className="text-[11px] text-muted-foreground block">
                                                                        {fornecedorLabel || "Fornecedor não informado"} · {produtoLabel || "Produto não informado"}
                                                                    </span>
                                                                    <span className="text-[11px] text-muted-foreground block">
                                                                        {formaPagamentoLabel || "Forma não informada"}
                                                                        {placaLabel ? ` · ${placaLabel}` : ""}
                                                                    </span>
                                                                    <span className="text-[11px] text-muted-foreground block">
                                                                        {quantidadeColaboradoresItem > 0 ? `${quantidadeColaboradoresItem} colaborador(es)` : "Sem equipe informada"}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm font-black">{quantidadeExibida}</div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {unitarioItem > 0 ? formatCurrency(unitarioItem) : "Sem valor"}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="font-display font-black text-sm">{formatCurrency(totalItem)}</div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {getTipoCalculoLabel(tipoCalculoItem)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={getStatusVariant(statusLabel)}>
                                                                    {statusLabel}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-all"
                                                                    onClick={() => {
                                                                        if (confirm("Deseja remover este registro?")) {
                                                                            OperacaoProducaoService.delete(item.id).then(() => {
                                                                                toast.success("Registro removido");
                                                                                queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
                                                                                queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });
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
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-muted/10 border-t border-border mt-auto">
                            <div className="flex flex-col gap-2 text-xs text-muted-foreground font-medium sm:flex-row sm:items-center sm:gap-4">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                    Dados sincronizados
                                </div>
                                <div className="flex items-center gap-1.5 sm:ml-auto">
                                    <ListChecks className="w-3.5 h-3.5 text-brand" />
                                    Disponível em tempo real no painel global
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            <Dialog open={produtoDialogOpen} onOpenChange={setProdutoDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Cadastrar produto / carga</DialogTitle>
                        <DialogDescription>
                            O encarregado pode cadastrar o tipo de produto/carga diretamente aqui e seguir com o lançamento.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input
                                value={produtoDraft.nome}
                                onChange={(event) => setProdutoDraft((prev) => ({ ...prev, nome: event.target.value }))}
                                placeholder="Ex.: Geral"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Input
                                value={produtoDraft.categoria}
                                onChange={(event) => setProdutoDraft((prev) => ({ ...prev, categoria: event.target.value }))}
                                placeholder="Opcional"
                            />
                        </div>

                        {produtoSimilarOptions.length > 0 && (
                            <div className="rounded-xl border border-warning/20 bg-warning-soft/40 p-3 space-y-3">
                                <div className="text-sm text-warning-strong">
                                    Já existe um cadastro parecido. Deseja usar o item existente?
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {produtoSimilarOptions.map((item) => (
                                        <Button
                                            key={item.id}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setForm((prev) => ({ ...prev, produto: item.id }));
                                                setProdutoDialogOpen(false);
                                                setProdutoDraft({ nome: "", categoria: "" });
                                                toast.success("Produto/carga existente selecionado.");
                                            }}
                                        >
                                            Usar {item.nome}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setProdutoDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={() => createProdutoMutation.mutate()} disabled={createProdutoMutation.isPending}>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar produto/carga
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OperationalShell>
    );
};

export default LancamentoProducao;
