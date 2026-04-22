import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    FileText,
    CheckCircle2,
    AlertCircle,
    Download,
    Settings,
    Loader2,
    Building2,
    CreditCard,
    Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EmpresaService } from "@/services/base.service";
import { CNABService, ContaBancariaService } from "@/services/financial.service";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RemessaCNAB = () => {
    const [competencia, setCompetencia] = useState<string>("");
    const [empresaId, setEmpresaId] = useState<string>("");
    const [contaId, setContaId] = useState<string>("");
    const [isValidating, setIsValidating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [validation, setValidation] = useState<any>(null);

    // Fetch Competencias
    const { data: competencias, isLoading: isLoadingComp } = useQuery({
        queryKey: ["financeiro-competencias"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financeiro_competencias")
                .select("competencia, status")
                .order("competencia", { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // Fetch Empresas
    const { data: empresas, isLoading: isLoadingEmpresas } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll()
    });

    // Fetch Contas da Empresa selecionada
    const { data: contas, isLoading: isLoadingContas } = useQuery({
        queryKey: ["contas", empresaId],
        queryFn: () => empresaId ? ContaBancariaService.getByEmpresa(empresaId) : Promise.resolve([]),
        enabled: !!empresaId
    });

    const handleValidate = async () => {
        if (!competencia) return toast.error("Selecione a competência");
        if (!empresaId) return toast.error("Selecione uma empresa");

        setIsValidating(true);
        try {
            // Pequeno delay para feedback visual de 'trabalhando'
            await new Promise(resolve => setTimeout(resolve, 800));
            const res = await CNABService.validateRemessa(competencia, empresaId);
            setValidation(res);
            if (res.isValid) {
                toast.success("Remessa validada com sucesso!");
            } else {
                toast.warning("Inconsistências encontradas na remessa.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao validar remessa");
        } finally {
            setIsValidating(false);
        }
    };

    const handleGenerate = async () => {
        if (!contaId) return toast.error("Selecione a conta bancária");
        setIsGenerating(true);
        try {
            const res = await CNABService.generateRemessa({ competencia, empresaId, contaId });
            toast.success(`CNAB Gerado: ${res.fileName}`);

            // Trigger download
            const element = document.createElement("a");
            const file = new Blob([res.content], { type: 'text/plain' });
            element.href = URL.createObjectURL(file);
            element.download = res.fileName;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar arquivo");
        } finally {
            setIsGenerating(false);
        }
    };

    const formattedCompetencias = useMemo(() => {
        if (!competencias) return [];

        // Remove duplicatas de competência (mesma data)
        const unique = competencias.filter((v, i, a) =>
            a.findIndex(t => t.competencia === v.competencia) === i
        );

        return unique.map(c => ({
            value: c.competencia,
            label: format(new Date(c.competencia + "T12:00:00"), "MMMM yyyy", { locale: ptBR })
                .replace(/^\w/, (c) => c.toUpperCase())
        }));
    }, [competencias]);

    return (
        <AppShell title="Geração de Remessa CNAB">
            <div className="max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Painel de Configurações */}
                    <Card className="lg:col-span-5 p-8 space-y-6 shadow-sm border-border bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-brand/10 rounded-lg text-brand">
                                <Settings className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
                                    Configurações do Lote
                                </h3>
                                <p className="text-xs text-muted-foreground">Defina os parâmetros para a remessa bancária</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Competência
                                </label>
                                <Select value={competencia} onValueChange={(val) => { setCompetencia(val); setValidation(null); }}>
                                    <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                        <SelectValue placeholder={isLoadingComp ? "Carregando..." : "Selecione o mês"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formattedCompetencias.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Building2 className="w-3 h-3" /> Empresa (Cliente)
                                </label>
                                <Select value={empresaId} onValueChange={(val) => { setEmpresaId(val); setValidation(null); setContaId(""); }}>
                                    <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                        <SelectValue placeholder={isLoadingEmpresas ? "Carregando..." : "Selecione o cliente"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {empresas?.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <CreditCard className="w-3 h-3" /> Conta Bancária Origem
                                </label>
                                <Select value={contaId} onValueChange={setContaId} disabled={!empresaId}>
                                    <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                                        <SelectValue placeholder={isLoadingContas ? "Carregando..." : "Selecione a conta"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contas?.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma conta cadastrada</div>
                                        ) : (
                                            contas?.map(cta => (
                                                <SelectItem key={cta.id} value={cta.id}>
                                                    {cta.banco} - Ag: {cta.agencia} Cc: {cta.conta}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                className="w-full h-11 bg-brand hover:shadow-lg hover:shadow-brand/20 transition-all font-semibold"
                                onClick={handleValidate}
                                disabled={isValidating || !competencia || !empresaId}
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Validando...
                                    </>
                                ) : "Validar Remessa"}
                            </Button>
                        </div>
                    </Card>

                    {/* Painel de Resumo */}
                    <Card className={`lg:col-span-7 p-8 shadow-sm transition-all duration-300 ${!validation ? 'bg-muted/10 border-dashed border-border' :
                        validation.isValid ? 'bg-success/5 border-success/20' :
                            'bg-destructive/5 border-destructive/20'
                        }`}>
                        <div className="flex items-center gap-2 mb-8 border-b border-border/50 pb-4">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
                                Resumo e Validação
                            </h3>
                        </div>

                        {!validation ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <FileText className="w-10 h-10 text-muted-foreground/30" />
                                </div>
                                <p className="text-sm text-muted-foreground max-w-[280px]">
                                    Selecione os parâmetros e valide a remessa para processar os arquivos.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                                            Quantidade de Títulos
                                        </span>
                                        <span className="text-3xl font-extrabold text-foreground">{validation.summary.totalItems}</span>
                                    </div>
                                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                                            Valor Total da Remessa
                                        </span>
                                        <span className="text-3xl font-extrabold text-brand">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(validation.summary.totalValue)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                        Checklist de Integridade
                                    </h4>

                                    {validation.isValid ? (
                                        <div className="flex items-start gap-4 bg-card p-4 rounded-lg border border-success/20 shadow-sm shadow-success/5">
                                            <div className="p-2 bg-success/10 rounded-full">
                                                <CheckCircle2 className="w-5 h-5 text-success" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-success">Validação Concluída</span>
                                                <p className="text-xs text-muted-foreground mt-0.5">Todos os requisitos foram atendidos para a geração do CNAB.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {validation.errors.map((err: string, i: number) => (
                                                <div key={i} className="flex items-start gap-4 bg-card p-4 rounded-lg border border-destructive/20 shadow-sm shadow-destructive/5">
                                                    <div className="p-2 bg-destructive/10 rounded-full">
                                                        <AlertCircle className="w-5 h-5 text-destructive" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-destructive">Inconsistência Identificada</span>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{err}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {validation.isValid && (
                                    <div className="pt-6 border-t border-border border-dashed flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-xs text-muted-foreground flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
                                            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                                            Pronto para gerar arquivo
                                        </div>
                                        <Button
                                            className="bg-brand hover:shadow-lg hover:shadow-brand/20 transition-all font-bold h-12 px-8"
                                            onClick={handleGenerate}
                                            disabled={isGenerating || !contaId}
                                        >
                                            {isGenerating ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Download className="w-4 h-4 mr-2" />
                                            )}
                                            Gerar Arquivo CNAB (240)
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </AppShell>
    );
};

export default RemessaCNAB;
