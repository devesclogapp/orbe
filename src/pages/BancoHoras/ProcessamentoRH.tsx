import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, RefreshCw, Loader2, Clock, Calendar, Building2, Users, AlertTriangle, Play, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmpresaService, ColaboradorService, PontoService } from "@/services/base.service";
import { BHRegraService, BHEventoService } from "@/services/v4.service";

interface PontoRecord {
    id: string;
    colaborador_id: string;
    empresa_id: string;
    data: string;
    entrada: string | null;
    saida_almoco: string | null;
    retorno_almoco: string | null;
    saida: string | null;
    periodo: string | null;
    tipo_dia: string | null;
    status: string;
    origem: string | null;
    created_at: string;
}

interface ColaboradorRecord {
    id: string;
    nome: string;
    matricula: string;
    empresa_id: string;
    empresa_nome?: string;
    cargo: string;
    status: string;
    tipo_vinculo: string;
    jornada_contratada: number;
    bh_ativo: boolean;
}

interface RegraBH {
    id: string;
    nome: string;
    empresa_id: string;
    carga_horaria_diaria: number;
    tolerancia_atraso: number;
    tolerancia_hora_extra: number;
    limite_diario_banco: number;
    validade_horas: number;
    regra_compensacao: string;
    regra_vencimento: string;
    bh_ativo: boolean;
    jornada_contratada: number;
    origem_ponto: string;
    status: string;
}

const timeToMinutes = (timeStr: string | null): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
};

const minutesToTime = (totalMinutes: number): string => {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const minutes = Math.abs(totalMinutes) % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes}m`;
};

const ProcessamentoRH = () => {
    const queryClient = useQueryClient();
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
    const [selectedColaborador, setSelectedColaborador] = useState<string>("all");
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
    const [searchTerm, setSearchTerm] = useState("");
    const [processModalOpen, setProcessModalOpen] = useState(false);
    const [processingResult, setProcessingResult] = useState<any>(null);

    const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: colaboradores = [], isLoading: isLoadingColaboradores } = useQuery({
        queryKey: ["colaboradores_processamento", selectedEmpresa],
        queryFn: () => ColaboradorService.getWithEmpresa(),
    });

    const { data: regras = [], isLoading: isLoadingRegras } = useQuery({
        queryKey: ["bh_regras_all"],
        queryFn: () => BHRegraService.getWithEmpresa(),
    });

    const { data: pontos = [], isLoading: isLoadingPontos } = useQuery({
        queryKey: ["ponto_processamento", selectedMonth, selectedEmpresa],
        queryFn: () => PontoService.getByMonth(selectedMonth, selectedEmpresa === "all" ? undefined : selectedEmpresa),
    });

    const filteredColaboradores = useMemo(() => {
        return colaboradores.filter((c: any) => {
            const matchesSearch = !searchTerm || 
                c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.matricula?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
            const matchesBhAtivo = c.bh_ativo !== false;
            return matchesSearch && matchesEmpresa && matchesBhAtivo;
        });
    }, [colaboradores, searchTerm, selectedEmpresa]);

    const filteredPontos = useMemo(() => {
        return pontos.filter((p: any) => {
            const matchesColaborador = selectedColaborador === "all" || p.colaborador_id === selectedColaborador;
            const matchesSearch = !searchTerm || 
                filteredColaboradores.some((c: any) => c.id === p.colaborador_id && 
                    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesColaborador && matchesSearch;
        });
    }, [pontos, selectedColaborador, searchTerm, filteredColaboradores]);

    const getRegraByEmpresa = (empresaId: string): RegraBH | undefined => {
        return regras.find((r: any) => 
            (r.empresa_id === empresaId || !r.empresa_id) && r.bh_ativo !== false
        );
    };

    const calculateDayBalance = (ponto: any, regra?: RegraBH) => {
        const entrada = timeToMinutes(ponto.entrada);
        const saidaAlmoco = timeToMinutes(ponto.saida_almoco);
        const retornoAlmoco = timeToMinutes(ponto.retorno_almoco);
        const saida = timeToMinutes(ponto.saida);

        const jornadaDefault = regra?.carga_horaria_diaria || 8;
        const toleranciaAtra = regra?.tolerancia_atraso || 5;
        const toleranciaHE = regra?.tolerancia_hora_extra || 0;

        const almocoDuration = saidaAlmoco > 0 && retornoAlmoco > 0 ? retornoAlmoco - saidaAlmoco : 0;
        const workedMinutes = entrada > 0 && saida > 0 ? (saida - entrada - almocoDuration) : 0;
        const expectedMinutes = jornadaDefault * 60;

        const diff = workedMinutes - expectedMinutes;

        let status = "normal";
        let balance = 0;
        let message = "";

        if (diff > 0) {
            const heExcess = diff - toleranciaHE;
            if (heExcess > 0) {
                const limite = regra?.limite_diario_banco || 480;
                balance = Math.min(heExcess, limite);
                status = "credito";
                message = `+${minutesToTime(balance)} extras`;
            } else {
                status = "normal";
                message = "Horas extras dentro da tolerância";
            }
        } else if (diff < 0) {
            const faltaExcess = Math.abs(diff) - toleranciaAtra;
            if (faltaExcess > 0) {
                balance = -faltaExcess;
                status = "debito";
                message = `${minutesToTime(balance)} pendente`;
            } else {
                status = "normal";
                message = "Atraso dentro da tolerância";
            }
        } else {
            message = "Jornada completa";
        }

        return {
            workedMinutes,
            expectedMinutes,
            balance,
            status,
            message,
            entrada,
            saida,
            almocoDuration,
        };
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "credito":
                return <Badge className="bg-success-soft text-success">Crédito</Badge>;
            case "debito":
                return <Badge className="bg-destructive-soft text-destructive">Débito</Badge>;
            case "inconsistente":
                return <Badge className="bg-warning-soft text-warning">Inconsistente</Badge>;
            default:
                return <Badge className="bg-muted text-muted-foreground">Normal</Badge>;
        }
    };

    const handleProcessar = async () => {
        const result = {
            totalProcessados: filteredPontos.length,
            creditosGerados: 0,
            debitosGerados: 0,
            inconsistencia: 0,
            timestamp: new Date().toISOString(),
        };

        filteredPontos.forEach((ponto: any) => {
            const regra = getRegraByEmpresa(ponto.empresa_id);
            const calc = calculateDayBalance(ponto, regra);
            
            if (calc.status === "credito") result.creditosGerados++;
            else if (calc.status === "debito") result.debitosGerados++;
            else if (calc.status === "inconsistente") result.inconsistencia++;
        });

        setProcessingResult(result);
        toast.success("Processamento concluído", {
            description: `${result.totalProcessados} registros processados`
        });
    };

    const isLoading = isLoadingEmpresas || isLoadingColaboradores || isLoadingRegras || isLoadingPontos;

    return (
        <AppShell 
            title="Processamento RH" 
            subtitle="Cálculo de banco de horas com base nos pontos recebidos"
        >
            <div className="space-y-6">
                {/* Filtros */}
                <section className="esc-card p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar colaborador..."
                                className="pl-9 h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                            <SelectTrigger className="w-[220px] h-10">
                                <Building2 className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                {empresas.map((e: any) => (
                                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px] h-10">
                                <Calendar className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => {
                                    const date = new Date(2026, i, 1);
                                    return (
                                        <SelectItem key={i} value={format(date, "yyyy-MM")}>
                                            {format(date, "MMMM/yyyy", { locale: ptBR })}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>

                        <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                            <SelectTrigger className="w-[220px] h-10">
                                <Users className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Colaborador" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Colaboradores</SelectItem>
                                {filteredColaboradores.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.nome} - {c.matricula}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button onClick={handleProcessar} disabled={isLoading || filteredPontos.length === 0}>
                            <Play className="h-4 w-4 mr-2" />
                            Processar
                        </Button>

                        <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["ponto_processamento"] })}
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </section>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="esc-card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-soft">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Colaboradores CLT</p>
                            <p className="text-xl font-bold font-display">{filteredColaboradores.length}</p>
                        </div>
                    </div>
                    <div className="esc-card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-info-soft">
                            <Clock className="h-5 w-5 text-info" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Pontos Recebidos</p>
                            <p className="text-xl font-bold font-display">{filteredPontos.length}</p>
                        </div>
                    </div>
                    <div className="esc-card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-warning-soft">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Regras Ativas</p>
                            <p className="text-xl font-bold font-display">{regras.filter((r: any) => r.bh_ativo).length}</p>
                        </div>
                    </div>
                    <div className="esc-card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success-soft">
                            <CheckCircle className="h-5 w-5 text-success" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Pontos Processados</p>
                            <p className="text-xl font-bold font-display">{pontos.length}</p>
                        </div>
                    </div>
                </div>

                {/* Tabela de Pontos Processados */}
                <section className="esc-card overflow-hidden">
                    <div className="esc-table-header px-5 py-3 border-b border-muted flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Registros de Ponto</h3>
                        <Badge variant="outline">
                            {filteredPontos.filter((p: any) => p.status === "inconsistente").length} inconsistências
                        </Badge>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/30">
                                    <tr className="text-left">
                                        <th className="px-4 py-3 font-medium">Data</th>
                                        <th className="px-4 py-3 font-medium">Colaborador</th>
                                        <th className="px-4 py-3 font-medium">Empresa</th>
                                        <th className="px-4 py-3 font-medium text-center">Entrada</th>
                                        <th className="px-4 py-3 font-medium text-center">Saída</th>
                                        <th className="px-4 py-3 font-medium text-center">Intervalo</th>
                                        <th className="px-4 py-3 font-medium text-center">Horas Trab.</th>
                                        <th className="px-4 py-3 font-medium text-center">Saldo</th>
                                        <th className="px-4 py-3 font-medium">Origem</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPontos.slice(0, 50).map((ponto: any) => {
                                        const colaborador = filteredColaboradores.find((c: any) => c.id === ponto.colaborador_id);
                                        const regra = getRegraByEmpresa(ponto.empresa_id);
                                        const calc = calculateDayBalance(ponto, regra);
                                        const empresa = empresas.find((e: any) => e.id === ponto.empresa_id);

                                        return (
                                            <tr key={ponto.id} className="border-t border-muted hover:bg-muted/20">
                                                <td className="px-4 py-3">{format(new Date(ponto.data), "dd/MM/yyyy")}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{colaborador?.nome || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">Mat. {colaborador?.matricula || "-"}</div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{empresa?.nome || "-"}</td>
                                                <td className="px-4 py-3 text-center font-mono">{ponto.entrada?.slice(0, 5) || "-"}</td>
                                                <td className="px-4 py-3 text-center font-mono">{ponto.saida?.slice(0, 5) || "-"}</td>
                                                <td className="px-4 py-3 text-center text-muted-foreground">
                                                    {ponto.saida_almoco && ponto.retorno_almoco 
                                                        ? `${ponto.saida_almoco?.slice(0, 5)} - ${ponto.retorno_almoco?.slice(0, 5)}`
                                                        : "-"
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center font-display font-medium">
                                                    {minutesToTime(calc.workedMinutes)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "font-display font-semibold",
                                                        calc.balance > 0 ? "text-success" :
                                                        calc.balance < 0 ? "text-error" :
                                                        "text-muted-foreground"
                                                    )}>
                                                        {calc.balance !== 0 ? minutesToTime(calc.balance) : "0h 0m"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="outline" className="text-xs">
                                                        {ponto.origem || "manual"}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {getStatusBadge(calc.status)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredPontos.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-12 text-center text-muted-foreground">
                                                Nenhum ponto registrado no período selecionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* Dialog de Resultado do Processamento */}
            <Dialog open={processModalOpen} onOpenChange={setProcessModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resultado do Processamento</DialogTitle>
                        <DialogDescription>
                            Resumo do processamento de banco de horas
                        </DialogDescription>
                    </DialogHeader>
                    
                    {processingResult && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-muted rounded-lg text-center">
                                    <p className="text-sm text-muted-foreground">Total Processado</p>
                                    <p className="text-2xl font-bold">{processingResult.totalProcessados}</p>
                                </div>
                                <div className="p-4 bg-success-soft rounded-lg text-center">
                                    <p className="text-sm text-success">Créditos Gerados</p>
                                    <p className="text-2xl font-bold text-success">{processingResult.creditosGerados}</p>
                                </div>
                                <div className="p-4 bg-destructive-soft rounded-lg text-center">
                                    <p className="text-sm text-destructive">Débitos Gerados</p>
                                    <p className="text-2xl font-bold text-destructive">{processingResult.debitosGerados}</p>
                                </div>
                                <div className="p-4 bg-warning-soft rounded-lg text-center">
                                    <p className="text-sm text-warning">Inconsistências</p>
                                    <p className="text-2xl font-bold text-warning">{processingResult.inconsistencia}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setProcessModalOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default ProcessamentoRH;