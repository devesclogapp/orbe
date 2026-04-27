import { useState, useMemo } from "react";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Card } from "@/components/ui/card";
// ... (rest of imports remain same or are updated below)
import { Button } from "@/components/ui/button";
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
    AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    OperacaoService,
    EmpresaService,
    ConfigTipoOperacaoService,
    ConfigProdutoService,
    PerfilUsuarioService
} from "@/services/base.service";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
    });

    // 0. Buscar perfil para identificar a empresa vinculada
    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null),
        enabled: !!user?.id,
    });

    // 1. Buscar empresas (caso precise trocar ou admin acesse)
    const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // 2. Buscar configurações para os selects
    const { data: tiposServico = [] } = useQuery({
        queryKey: ["config_tipos_operacao"],
        queryFn: () => ConfigTipoOperacaoService.getAll(),
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ["config_produtos"],
        queryFn: () => ConfigProdutoService.getAll(),
    });

    // 3. Buscar histórico recente (últimas do dia)
    const { data: historico = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ["producao_recente", form.empresa_id],
        queryFn: () => OperacaoService.getByDate(today, form.empresa_id),
        enabled: !!form.empresa_id,
    });

    // Auto-selecionar empresa preferencialmente vinda do perfil
    useMemo(() => {
        if (!form.empresa_id) {
            if (perfil?.empresa_id) {
                setForm(prev => ({ ...prev, empresa_id: perfil.empresa_id }));
            } else if (empresas.length > 0) {
                setForm(prev => ({ ...prev, empresa_id: empresas[0]?.id }));
            }
        }
    }, [perfil, empresas]);

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
            }));
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.tipo_servico || !form.quantidade || !form.empresa_id) {
            toast.error("Preencha os campos obrigatórios");
            return;
        }

        mutation.mutate({
            ...form,
            quantidade: Number(form.quantidade),
            valor_unitario: Number(form.valor_unitario) || 0,
            status: "pendente",
            origem_dado: "manual",
        });
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    // Encontrar o nome da unidade atual para exibir no shell
    const currentUnitName = empresas.find(e => e.id === form.empresa_id)?.nome;

    return (
        <OperationalShell
            title="Produção In-Loco"
            unitName={currentUnitName || "Sincronizando..."}
        >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Formulário Principal */}
                <div className="xl:col-span-12">
                    <Card className="p-3 bg-brand/5 border-brand/20 shadow-none mb-6">
                        <div className="flex items-center gap-3 text-brand text-sm font-bold">
                            <AlertCircle className="w-4 h-4" />
                            Utilize esta tela para registros imediatos de carga, descarga e movimentações extras.
                        </div>
                    </Card>
                </div>

                <div className="xl:col-span-5 space-y-6">
                    <Card className="p-6 border-border shadow-sm">
                        <h3 className="text-lg font-black font-display text-foreground mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-brand" />
                            Novo Registro
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Empresa / Unidade</Label>
                                <Select value={form.empresa_id} onValueChange={v => setForm({ ...form, empresa_id: v })}>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Selecione a unidade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Data</Label>
                                    <Input
                                        type="date"
                                        value={form.data}
                                        onChange={e => setForm({ ...form, data: e.target.value })}
                                        className="h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tipo de Serviço</Label>
                                    <Select value={form.tipo_servico} onValueChange={v => setForm({ ...form, tipo_servico: v })}>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Carga">Carga</SelectItem>
                                            <SelectItem value="Descarga">Descarga</SelectItem>
                                            <SelectItem value="Conferência">Conferência</SelectItem>
                                            <SelectItem value="Movimentação">Movimentação Interna</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Transportadora / Cliente</Label>
                                <div className="relative">
                                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Ex: Translog, Geral, etc."
                                        value={form.transportadora}
                                        onChange={e => setForm({ ...form, transportadora: e.target.value })}
                                        className="h-11 rounded-xl pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Produto / Carga</Label>
                                <div className="relative">
                                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Ex: Alimentos, Eletrônicos..."
                                        value={form.produto}
                                        onChange={e => setForm({ ...form, produto: e.target.value })}
                                        className="h-11 rounded-xl pl-10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <Label>Quantidade</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={form.quantidade}
                                        onChange={e => setForm({ ...form, quantidade: e.target.value })}
                                        className="h-11 rounded-xl text-center font-bold text-lg"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Valor Unitário (Opcional)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0,00"
                                        value={form.valor_unitario}
                                        onChange={e => setForm({ ...form, valor_unitario: e.target.value })}
                                        className="h-11 rounded-xl text-right font-display"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-brand hover:bg-brand/90 font-black text-lg shadow-lg shadow-brand/20 mt-4 gap-2"
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

                    <Card className="p-6 bg-secondary/20 border-dashed border-border shadow-none">
                        <h4 className="font-bold text-sm text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Resumo de Hoje
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Registros</span>
                                <span className="text-2xl font-black text-foreground">{historico.length}</span>
                            </div>
                            <div className="bg-background p-4 rounded-xl border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Total Estimado</span>
                                <span className="text-xl font-black text-brand">
                                    {formatCurrency(historico.reduce((acc: number, cur: any) => acc + (Number(cur.quantidade) * Number(cur.valor_unitario || 0)), 0))}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Histórico Recente */}
                <div className="xl:col-span-7 space-y-6">
                    <Card className="border-border shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-black font-display text-foreground flex items-center gap-2 text-lg">
                                <History className="w-5 h-5 text-muted-foreground" />
                                Lançamentos do Dia
                            </h3>
                            <span className="text-[10px] font-bold bg-background px-3 py-1 rounded-full border border-border">DATA: {today}</span>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {isLoadingHistory ? (
                                <div className="p-20 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                    <Clock className="w-8 h-8 animate-pulse opacity-20" />
                                    Carregando histórico...
                                </div>
                            ) : historico.length === 0 ? (
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
                                            <TableHead className="font-bold text-[10px] uppercase">Serviço</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Transportadora</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-center">Qtd</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Valor</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historico.map((h: any) => (
                                            <TableRow key={h.id} className="border-border hover:bg-muted/30 group transition-colors">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-success" />
                                                        <span className="font-bold text-sm">{h.tipo_servico}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground ml-4">{format(new Date(h.created_at), "HH:mm")}</div>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium">{h.transportadora || "—"}</TableCell>
                                                <TableCell className="text-center font-black">{h.quantidade}</TableCell>
                                                <TableCell className="text-right font-display font-bold text-sm">
                                                    {formatCurrency(Number(h.quantidade) * Number(h.valor_unitario || 0))}
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
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <div className="p-6 bg-muted/10 border-t border-border mt-auto">
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
