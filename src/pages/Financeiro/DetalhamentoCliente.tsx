import { useQuery } from "@tanstack/react-query";
import { CompetenciaService, ConsolidadoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, History, ArrowLeft, Loader2, Download, Printer, TrendingUp } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DetalhamentoCliente = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const { data: clientData, isLoading } = useQuery({
        queryKey: ["consolidado_cliente", id],
        queryFn: () => ConsolidadoService.getClientConsolidadoById(id!),
        enabled: !!id,
    });

    if (isLoading) return (
        <AppShell title="Audit Faturamento" subtitle="Carregando memória de cálculo...">
            <div className="flex items-center justify-center p-20"><Loader2 className="h-10 w-10 animate-spin" /></div>
        </AppShell>
    );

    if (!clientData) return (
        <AppShell title="Audit Faturamento" subtitle="Não encontrado">
            <div className="text-center p-20">
                <p className="text-muted-foreground">Faturamento não encontrado para esta competência.</p>
                <Button onClick={() => navigate(-1)} variant="link" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
            </div>
        </AppShell>
    );

    return (
        <AppShell
            title={`Memória: ${clientData.clientes?.nome}`}
            subtitle={`Detalhamento financeiro do cliente · Competência ${clientData.competencia}`}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Faturamento
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
                        <Button size="sm"><Download className="h-4 w-4 mr-2" /> Exportar EXCEL</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <section className="esc-card p-5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-14 w-14 rounded-xl bg-primary-soft flex items-center justify-center text-primary font-display font-bold text-xl border border-primary/20">
                                    <Building2 className="h-7 w-7" />
                                </div>
                                <div>
                                    <h3 className="font-display font-semibold text-foreground text-lg">{clientData.clientes?.nome}</h3>
                                    <p className="text-sm text-muted-foreground">ID Fat: #{clientData.id.substring(0, 8)}</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-border">
                                <Row label="Empresa Emitente" value={clientData.empresas?.nome || "ESC LOG LOGÍSTICA"} />
                                <Row label="Competência" value={clientData.competencia} />
                                <Row label="Qtd. Operações" value={clientData.quantidade_operacoes} />
                                <Row label="Status Faturamento" value={<Badge variant="outline" className={cn(
                                    "h-5",
                                    clientData.status === 'aprovado' ? "bg-success-soft text-success-strong border-success/20" : "bg-warning-soft text-warning-strong border-warning/20"
                                )}>{clientData.status}</Badge>} />
                            </div>
                        </section>

                        <section className="esc-card p-5 bg-primary-soft/30 border-primary-soft">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Faturável</h4>
                                <TrendingUp className="h-4 w-4 text-primary opacity-50" />
                            </div>
                            <div className="font-display font-bold text-3xl text-primary text-center">
                                R$ {Number(clientData.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Base (Operações)</span>
                                    <span className="font-medium">R$ {Number(clientData.valor_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Ajustes / Regras</span>
                                    <span className="font-medium">R$ {Number(clientData.valor_regras).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <section className="esc-card overflow-hidden">
                            <header className="px-5 py-4 border-b border-border flex items-center gap-2 bg-muted/20">
                                <History className="h-4 w-4 text-primary" />
                                <h3 className="font-display font-semibold text-foreground">Detalhamento por Item de Serviço</h3>
                            </header>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="esc-table-header">
                                        <tr className="text-left text-muted-foreground uppercase text-[10px]">
                                            <th className="px-5 h-10 font-medium tracking-wider">Item / Descrição</th>
                                            <th className="px-3 h-10 font-medium text-center">Volume</th>
                                            <th className="px-3 h-10 font-medium text-right">Unitário</th>
                                            <th className="px-5 h-10 font-medium text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {/* Mocking sub-items for display as it depends on operations join */}
                                        <tr className="hover:bg-muted/30 transition-colors">
                                            <td className="px-5 h-12 font-medium">Movimentação de Carga Geral</td>
                                            <td className="px-3 text-center">{clientData.quantidade_operacoes}</td>
                                            <td className="px-3 text-right">R$ {(clientData.valor_base / clientData.quantidade_operacoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-5 text-right font-display font-semibold">R$ {clientData.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                        {Number(clientData.valor_regras) !== 0 && (
                                            <tr className="bg-warning-soft/10">
                                                <td className="px-5 h-12 italic text-warning-strong">Ajustes Contratuais / Regras Extras</td>
                                                <td className="px-3 text-center">1</td>
                                                <td className="px-3 text-right">-</td>
                                                <td className="px-5 text-right font-display font-semibold text-warning-strong">R$ {clientData.valor_regras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-muted/30 font-bold">
                                        <tr className="h-12 border-t-2 border-primary/20">
                                            <td className="px-5" colSpan={3}>VALOR FINAL A FATURAR</td>
                                            <td className="px-5 text-right text-primary">R$ {clientData.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between text-xs py-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
    </div>
);

export default DetalhamentoCliente;
