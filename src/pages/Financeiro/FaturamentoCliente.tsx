import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CompetenciaService } from "@/services/domain/core.service";
import { ConsolidadoService } from "@/services/domain/producao.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { FileCheck, Search, Filter, Loader2, ExternalLink, Printer, Building2, Info, ArrowRight } from "lucide-react";
import { EmpresaService } from "@/services/base.service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateFaturaLotePDF } from "@/utils/pdfFaturamento";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { supabase } from "@/lib/supabase";

const FaturamentoCliente = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: empresas = [], isLoading: loadingEmps } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("all");

    const { data: comp } = useQuery({
        queryKey: ["competencia_atual", selectedEmpresaId],
        queryFn: () => CompetenciaService.getAtual(selectedEmpresaId!),
        enabled: !!selectedEmpresaId && selectedEmpresaId !== "all",
    });

    const { data: consolidado, isLoading: loadingCons } = useQuery({
        queryKey: ["consolidado", comp?.competencia, selectedEmpresaId],
        queryFn: () => {
            const competenciaStr = selectedEmpresaId === "all"
                ? new Date().toISOString().substring(0, 7) + "-01"
                : (comp?.competencia || "");

            return ConsolidadoService.getByCompetencia(
                competenciaStr,
                selectedEmpresaId === "all" ? undefined : selectedEmpresaId
            );
        },
        enabled: selectedEmpresaId === "all" || !!comp?.competencia,
    });

    const isLoading = loadingCons || loadingEmps;

    const list = consolidado?.clientes || [];
    const filtered = list.filter((c: any) =>
        c.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const approveMutation = useMutation({
        mutationFn: (ids: string[]) => ConsolidadoService.approveBatch(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["consolidado"] });
            toast.success("Lote aprovado com sucesso", {
                description: "Todos os clientes selecionados foram marcados como aprovados."
            });
        },
        onError: (err: any) => {
            toast.error("Erro ao aprovar lote", { description: err.message });
        }
    });

    const handleApproveBatch = () => {
        const ids = filtered.map((c: any) => c.id);
        if (ids.length === 0) {
            toast.error("Nenhum item para aprovar");
            return;
        }
        if (confirm(`Deseja aprovar ${ids.length} faturamentos?`)) {
            approveMutation.mutate(ids);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleGerarPdfFatura = async (c: any) => {
        try {
            toast.loading(`Gerando Fatura para ${c.clientes?.nome}...`, { id: 'pdf-gen' });

            const { data: operacoes, error } = await supabase
                .from('operacoes_producao')
                .select(`
                    *,
                    tipos_servico_operacional(nome),
                    produtos_carga(nome),
                    unidades(nome)
                `)
                .eq('empresa_id', c.empresa_id)
                .eq('competencia', c.competencia)
                .is('deleted_at', null)
                .order('criado_em', { ascending: true });

            if (error) {
                console.error("Erro na query de operacoes_producao:", error);
                throw error;
            }

            const operacoesDetalhe = operacoes || [];

            await generateFaturaLotePDF(c, operacoesDetalhe);
            toast.success("Fatura PDF gerada com sucesso!", { id: 'pdf-gen' });
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar fatura", { id: 'pdf-gen' });
        }
    };


    return (
        <AppShell title="Faturamento por Cliente" subtitle="Detalhamento e memória de cálculo por competência">
            <div className="mx-auto max-w-[1700px] w-full space-y-4">
                {/* Banner de Orientação do Pipeline Financeiro */}
                <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-lg p-3.5 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span>
                            <strong>Consolidação por Competência:</strong> Esta visão consolida operações faturáveis a prazo ou mensais para geração de faturas dos clientes. Operações de <strong>Caixa Imediato</strong> são tratadas diretamente no pipeline de Receitas Operacionais.
                        </span>
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-semibold inline-flex items-center gap-1 shrink-0 self-start sm:self-center"
                            onClick={() => navigate("/financeiro/receitas", { state: { activeTab: 'CAIXA_IMEDIATO' } })}
                        >
                            Ver Receitas <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            className="w-full h-10 pl-10 pr-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {empresas.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedEmpresaId || ""}
                                    onChange={(e) => setSelectedEmpresaId(e.target.value)}
                                    className="h-10 pl-3 pr-8 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none min-w-[200px]"
                                >
                                    <option value="all">Todas as empresas</option>
                                    {empresas.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                    ))}
                                </select>
                                <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            </div>
                        )}
                        <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Imprimir Tudo</Button>
                        <Button
                            size="sm"
                            onClick={handleApproveBatch}
                            disabled={approveMutation.isPending}
                        >
                            {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                            Aprovar Lote
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <section className="esc-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Cliente</th>
                                    <th className="px-3 h-11 font-medium text-center">Operações</th>
                                    <th className="px-3 h-11 font-medium text-right">Base</th>
                                    <th className="px-3 h-11 font-medium text-right">Regras (+) (-)</th>
                                    <th className="px-3 h-11 font-medium text-right">Total Faturável</th>
                                    <th className="px-3 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c: any) => (
                                    <tr key={c.id} className="border-t border-muted hover:bg-background transition-colors cursor-pointer group">
                                        <td className="px-5 h-14 font-medium text-foreground">{c.clientes?.nome}</td>
                                        <td className="px-3 text-center text-muted-foreground font-display">{c.quantidade_operacoes}</td>
                                        <td className="px-3 text-right text-muted-foreground">R$ {Number(c.valor_base).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-right text-muted-foreground">R$ {Number(c.valor_regras).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-right font-display font-bold text-foreground">R$ {Number(c.valor_total).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-center">
                                            <Badge className={cn(
                                                "h-6 font-semibold",
                                                c.status === 'aprovado' ? "bg-success-soft text-success-strong" : "bg-warning-soft text-warning-strong"
                                            )}>
                                                {c.status}
                                            </Badge>
                                        </td>
                                        <td className="px-5 text-right w-[200px]">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-primary hover:text-primary-strong px-2"
                                                    onClick={() => navigate(`/financeiro/faturamento/${c.id}`)}
                                                >
                                                    <ExternalLink className="h-4 w-4 mr-1.5" /> Memória
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200 px-2"
                                                    onClick={(e) => { e.stopPropagation(); handleGerarPdfFatura(c); }}
                                                    title="Baixar Fatura Mensal (PDF)"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto text-muted-foreground">
                                                <Info className="h-8 w-8 text-muted-foreground/60 mb-1" />
                                                <p className="font-medium text-foreground text-sm">Nenhuma operação faturável nesta competência</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Operações com modalidade <strong>Caixa Imediato</strong> não geram fatura mensal consolidada e são recebidas diretamente no pipeline de Receitas Operacionais.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2 text-xs"
                                                    onClick={() => navigate("/financeiro/receitas", { state: { activeTab: 'CAIXA_IMEDIATO' } })}
                                                >
                                                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Consultar Receitas Operacionais
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                )}
            </div>
        </AppShell>
    );
};

export default FaturamentoCliente;
