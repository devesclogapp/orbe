import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Save, Users, XCircle } from "lucide-react";

import { OperationalShell } from "@/components/layout/OperationalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
    DiaristaService,
    EmpresaService,
    LancamentoDiaristaPayload,
    LancamentoDiaristaService,
    PerfilUsuarioService,
    RegraMarcacaoDiaristaService,
    TipoServicoOperacionalService,
} from "@/services/base.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MarcacaoDiarista = string;

interface ItemMarcacao {
    diarista_id: string;
    nome: string;
    cpf: string | null;
    funcao: string;
    valor_diaria: number;
    marcacao: MarcacaoDiarista;
    observacao: string;
}

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const calcularValor = (marcacao: MarcacaoDiarista, valorDiaria: number, regras: any[]): number => {
    const regra = regras.find((r: any) => r.codigo === marcacao);
    if (!regra) return 0;
    return valorDiaria * Number(regra.multiplicador);
};

const DiaristasLancamento = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [data, setData] = useState(today);
    const [clienteUnidade, setClienteUnidade] = useState("");
    const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState("");
    const [operacaoServico, setOperacaoServico] = useState("");
    const [observacoesGerais, setObservacoesGerais] = useState("");
    const [marcacoes, setMarcacoes] = useState<Record<string, ItemMarcacao>>({});

    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => (user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null)),
        enabled: !!user?.id,
    });

    const empresaId = perfil?.empresa_id ?? "";

    // Usa a empresa selecionada no dropdown; se não houver, usa a empresa do perfil do usuário
    const empresaIdParaBusca = empresaIdSelecionada || empresaId;

    const { data: diaristas = [], isLoading: isLoadingDiaristas } = useQuery({
        queryKey: ["diaristas_lancamento", empresaIdParaBusca],
        queryFn: () => DiaristaService.getByEmpresa(empresaIdParaBusca, true),
        enabled: !!empresaIdParaBusca,
    });

    // Empresas disponíveis para alocação do diarista (filtro por empresa é feito via seleção)
    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_all"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: operacoes = [] } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
    });

    const { data: lancamentosHoje = [] } = useQuery({
        queryKey: ["lancamentos_diaristas_hoje", empresaIdParaBusca, data],
        queryFn: () => LancamentoDiaristaService.getByData(empresaIdParaBusca, data),
        enabled: !!empresaIdParaBusca,
    });

    const { data: regrasMarcacao = [], isLoading: isLoadingRegras } = useQuery({
        queryKey: ["regras_marcacao_diaristas", empresaIdParaBusca],
        queryFn: () => RegraMarcacaoDiaristaService.getByEmpresa(empresaIdParaBusca),
        enabled: !!empresaIdParaBusca,
    });

    // Inicializar marcações quando diaristas carregam
    useMemo(() => {
        const inicial: Record<string, ItemMarcacao> = {};
        (diaristas as any[]).forEach((d: any) => {
            if (!marcacoes[d.id]) {
                inicial[d.id] = {
                    diarista_id: d.id,
                    nome: d.nome,
                    cpf: d.cpf ?? null,
                    // DiaristaService usa campo 'funcao', não 'cargo'
                    funcao: d.funcao ?? "—",
                    valor_diaria: Number(d.valor_diaria || 0),
                    marcacao: "AUSENTE",
                    observacao: "",
                };
            }
        });
        if (Object.keys(inicial).length > 0) {
            setMarcacoes((prev) => ({ ...inicial, ...prev }));
        }
    }, [diaristas]);

    const setMarcacao = (id: string, marcacao: MarcacaoDiarista) => {
        setMarcacoes((prev) => ({ ...prev, [id]: { ...prev[id], marcacao } }));
    };

    const setObservacao = (id: string, observacao: string) => {
        setMarcacoes((prev) => ({ ...prev, [id]: { ...prev[id], observacao } }));
    };

    const resumo = useMemo(() => {
        const items = Object.values(marcacoes);
        const valorTotal = items.reduce((acc, i) => acc + calcularValor(i.marcacao, i.valor_diaria, regrasMarcacao as any[]), 0);

        const contagem: Record<string, number> = {};
        items.forEach(i => {
            contagem[i.marcacao] = (contagem[i.marcacao] || 0) + 1;
        });

        return { ...contagem, total: items.length, valorTotal };
    }, [marcacoes, regrasMarcacao]);

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!empresaIdParaBusca) throw new Error("Empresa não identificada.");
            if (!data) throw new Error("Informe a data do lançamento.");
            if (!clienteUnidade) throw new Error("Informe o Cliente / Unidade.");

            const registros: LancamentoDiaristaPayload[] = Object.values(marcacoes)
                .filter((m) => m.marcacao !== "AUSENTE")
                .map((m) => ({
                    empresa_id: empresaIdParaBusca,
                    diarista_id: m.diarista_id,
                    nome_colaborador: m.nome,
                    cpf_colaborador: m.cpf,
                    funcao_colaborador: m.funcao,
                    data_lancamento: data,
                    tipo_lancamento: "diarista",
                    codigo_marcacao: m.marcacao as any,
                    quantidade_diaria: Number((regrasMarcacao as any[]).find((r: any) => r.codigo === m.marcacao)?.multiplicador || 0),
                    valor_diaria_base: m.valor_diaria,
                    valor_calculado: calcularValor(m.marcacao, m.valor_diaria, regrasMarcacao as any[]),
                    cliente_unidade: clienteUnidade || null,
                    operacao_servico: operacaoServico || null,
                    encarregado_id: user?.id ?? null,
                    encarregado_nome: user?.email ?? null,
                    observacao: m.observacao || observacoesGerais || null,
                }));

            if (registros.length === 0) throw new Error("Nenhum diarista marcado como P ou MP.");

            return LancamentoDiaristaService.createBatch(registros);
        },
        onSuccess: (data) => {
            toast.success(`${data.length} lançamento(s) salvo(s) com sucesso.`);
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_hoje", empresaIdParaBusca] });
            // Reset marcações
            setMarcacoes((prev) => {
                const reset = { ...prev };
                Object.keys(reset).forEach((k) => {
                    reset[k] = { ...reset[k], marcacao: "AUSENTE", observacao: "" };
                });
                return reset;
            });
            setClienteUnidade("");
            setOperacaoServico("");
            setObservacoesGerais("");
        },
        onError: (err: any) => toast.error("Erro ao salvar.", { description: err.message }),
    });

    const isDataRetroativa = data < today;
    const diaristasArray = diaristas as any[];

    return (
        <OperationalShell title="Lançamento de Diaristas">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Resumo de lançamentos do dia */}
                {(lancamentosHoje as any[]).length > 0 && (
                    <div className="esc-card p-4 border-l-4 border-l-emerald-500">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Já lançado hoje</p>
                        <p className="text-sm text-foreground">
                            <span className="font-semibold text-emerald-600">{(lancamentosHoje as any[]).length} registro(s)</span> já foram salvos para o dia <span className="font-mono">{format(new Date(data + "T12:00:00"), "dd/MM/yyyy")}</span>.
                        </p>
                    </div>
                )}

                {/* Etapa 1 — Dados do lançamento */}
                <section className="esc-card p-6 space-y-4">
                    <h2 className="font-display font-bold text-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Dados do lançamento
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Data do lançamento</Label>
                            <Input
                                type="date"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                max={today}
                            />
                            {isDataRetroativa && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Data retroativa
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Encarregado responsável</Label>
                            <Input value={user?.email ?? "—"} disabled className="bg-muted/50" />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Cliente / Empresa</Label>
                            <Select
                                value={clienteUnidade}
                                onValueChange={(nome) => {
                                    // Encontra a empresa pelo nome para obter o ID
                                    const empresa = (empresas as any[]).find((e: any) => e.nome === nome);
                                    setClienteUnidade(nome);
                                    setEmpresaIdSelecionada(empresa?.id ?? "");
                                    // Limpa marcações ao trocar de empresa
                                    setMarcacoes({});
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a Empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(empresas as any[]).map((e: any) => (
                                        <SelectItem key={e.id} value={e.nome}>
                                            {e.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Operação / Serviço</Label>
                            <Select value={operacaoServico} onValueChange={setOperacaoServico}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a Operação" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(operacoes as any[]).map((o: any) => (
                                        <SelectItem key={o.id} value={o.nome}>
                                            {o.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <Label>Observações gerais</Label>
                            <Textarea
                                placeholder="Observações do dia..."
                                value={observacoesGerais}
                                onChange={(e) => setObservacoesGerais(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                </section>

                {/* Etapa 2 — Lista de diaristas */}
                <section className="esc-card overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h2 className="font-display font-bold text-foreground">Lista de diaristas</h2>
                        <span className="ml-auto text-xs text-muted-foreground">{diaristasArray.length} cadastrado(s)</span>
                    </div>

                    {isLoadingDiaristas ? (
                        <div className="p-12 text-center text-muted-foreground text-sm animate-pulse">
                            Carregando diaristas...
                        </div>
                    ) : diaristasArray.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <Users className="h-8 w-8 text-muted-foreground mx-auto" />
                            <p className="text-sm font-medium text-foreground">Nenhum diarista cadastrado</p>
                            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                O RH ou Admin precisa cadastrar colaboradores do tipo <span className="font-semibold text-primary">DIARISTA</span> em{" "}
                                <span className="font-mono bg-muted px-1 rounded">/colaboradores</span>{" "}
                                e ativar a opção <em>Permitir lançamento operacional</em>.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {diaristasArray.map((d: any) => {
                                const item = marcacoes[d.id];
                                if (!item) return null;
                                const valor = calcularValor(item.marcacao, item.valor_diaria, regrasMarcacao as any[]);
                                const regraUtilizada = (regrasMarcacao as any[]).find(r => r.codigo === item.marcacao);
                                const isPositive = regraUtilizada && Number(regraUtilizada.multiplicador) > 0;

                                return (
                                    <div key={d.id} className={cn(
                                        "p-5 flex flex-col gap-4 border-b border-border bg-card transition-colors hover:bg-muted/10",
                                        isPositive && "bg-primary-soft/20"
                                    )}>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            {/* Info do diarista */}
                                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                                <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[15px]">
                                                    {d.nome?.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="font-display font-bold text-foreground text-sm truncate">{d.nome}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="font-medium bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-foreground">{d.funcao}</span>
                                                        {d.cpf && <span className="font-mono">CPF {d.cpf}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Informações Numéricas e Ações */}
                                            <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 w-full md:w-auto mt-2 md:mt-0">
                                                {/* Valor da diária */}
                                                <div className="text-left md:text-right hidden sm:block">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Diária base</p>
                                                    <p className="font-mono font-semibold text-foreground text-[13px]">{formatCurrency(item.valor_diaria)}</p>
                                                </div>

                                                {/* Divisor */}
                                                <div className="hidden md:block w-px h-8 bg-border"></div>

                                                {/* Botões de marcação (Estilo Toggle Group Integrado) */}
                                                <div className="flex rounded-lg border bg-muted/40 p-1 shrink-0 w-full md:w-auto overflow-x-auto scroolbar-hide">
                                                    {(regrasMarcacao as any[]).map((regra: any) => {
                                                        const isActive = item.marcacao === regra.codigo;
                                                        const isAusente = regra.codigo === 'AUSENTE';
                                                        return (
                                                            <Button
                                                                key={regra.id}
                                                                size="sm"
                                                                variant="ghost"
                                                                className={cn(
                                                                    "h-8 px-4 text-xs font-bold transition-all rounded-md flex-1 md:flex-none",
                                                                    isActive && !isAusente && "bg-primary text-white hover:bg-primary/90 hover:text-white shadow-sm",
                                                                    isActive && isAusente && "bg-destructive text-white hover:bg-destructive/90 hover:text-white shadow-sm",
                                                                    !isActive && "text-muted-foreground hover:text-foreground hover:bg-background"
                                                                )}
                                                                onClick={() => setMarcacao(d.id, regra.codigo)}
                                                            >
                                                                {isAusente && isActive && <XCircle className="h-3.5 w-3.5 mr-1" />}
                                                                {!isAusente && isActive && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                                                                {regra.codigo}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Divisor */}
                                                <div className="hidden md:block w-px h-8 bg-border"></div>

                                                {/* Valor gerado */}
                                                <div className="text-right min-w-[90px] bg-background border px-3 py-1.5 rounded-lg shrink-0">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor pago</p>
                                                    <p className={cn(
                                                        "font-mono font-bold text-sm",
                                                        item.marcacao === "AUSENTE" && "text-muted-foreground",
                                                        isPositive && "text-emerald-600"
                                                    )}>
                                                        {formatCurrency(valor)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Observação individual (apenas se não ausente) */}
                                        {item.marcacao !== "AUSENTE" && (
                                            <div className="md:pl-[52px] pt-1">
                                                <Input
                                                    placeholder="Observação da diária (opcional)..."
                                                    className="h-8 text-xs bg-muted/30 border-dashed"
                                                    value={item.observacao}
                                                    onChange={(e) => setObservacao(d.id, e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Resumo em tempo real */}
                {diaristasArray.length > 0 && (
                    <section className="esc-card p-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Resumo do dia</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: "Total", value: resumo.total, color: "" },
                                { label: "Ausentes", value: resumo["AUSENTE"] || 0, color: "text-muted-foreground" },
                                ...Object.keys(resumo).filter(k => k !== "total" && k !== "valorTotal" && k !== "AUSENTE").map(k => ({
                                    label: k, value: resumo[k], color: "text-primary"
                                })),
                                { label: "Valor total", value: formatCurrency(resumo.valorTotal), color: "text-primary", isMonetary: true },
                            ].map((item) => (
                                <div key={item.label} className="bg-muted/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                                    <p className={cn("font-bold text-foreground", item.color, item.isMonetary ? "text-base font-mono" : "text-xl")}>
                                        {item.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Botão de salvar */}
                <div className="flex justify-end">
                    <Button
                        size="lg"
                        className="min-w-[180px] font-display font-bold"
                        onClick={() => salvarMutation.mutate()}
                        disabled={salvarMutation.isPending || diaristasArray.length === 0}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {salvarMutation.isPending ? "Salvando..." : "Salvar lançamento"}
                    </Button>
                </div>
            </div>
        </OperationalShell>
    );
};

export default DiaristasLancamento;
