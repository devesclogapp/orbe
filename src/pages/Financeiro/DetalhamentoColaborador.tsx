import { useQuery } from "@tanstack/react-query";
import { CompetenciaService, ConsolidadoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { User, Calendar, History, ArrowLeft, Loader2, Download, Printer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DetalhamentoColaborador = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const { data: comp } = useQuery({
        queryKey: ["competencia_atual"],
        queryFn: () => CompetenciaService.getAtual(),
    });

    const { data: consolidado, isLoading } = useQuery({
        queryKey: ["consolidado", comp?.competencia],
        queryFn: () => ConsolidadoService.getByCompetencia(comp!.competencia),
        enabled: !!comp?.competencia,
    });

    const colabData = consolidado?.colaboradores?.find((c: any) => c.colaborador_id === id);

    if (isLoading) return (
        <AppShell title="Audit Financeiro" subtitle="Carregando detalhamento...">
            <div className="flex items-center justify-center p-20"><Loader2 className="h-10 w-10 animate-spin" /></div>
        </AppShell>
    );

    if (!colabData) return (
        <AppShell title="Audit Financeiro" subtitle="Não encontrado">
            <div className="text-center p-20">
                <p className="text-muted-foreground">Colaborador não encontrado para esta competência.</p>
                <Button onClick={() => navigate(-1)} variant="link" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
            </div>
        </AppShell>
    );

    return (
        <AppShell
            title={`Audit: ${colabData.colaboradores?.nome}`}
            subtitle={`Memória financeira detalhada · ${new Date(comp!.competencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Dashboard
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
                        <Button size="sm"><Download className="h-4 w-4 mr-2" /> Exportar EXCEL</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <section className="esc-card p-5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center text-foreground font-display font-bold text-xl">
                                    {colabData.colaboradores?.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                                </div>
                                <div>
                                    <h3 className="font-display font-semibold text-foreground text-lg">{colabData.colaboradores?.nome}</h3>
                                    <p className="text-sm text-muted-foreground">{colabData.colaboradores?.cargo}</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-border">
                                <Row label="ID Colaborador" value={colabData.colaborador_id.substring(0, 8)} />
                                <Row label="Tipo Contrato" value={colabData.colaboradores?.tipo_contrato} />
                                <Row label="Valor Base" value={`R$ ${Number(colabData.colaboradores?.valor_base || 0).toLocaleString('pt-BR')}`} />
                                <Row label="Status" value={<Badge variant="outline" className="bg-success-soft text-success-strong h-5">{colabData.status}</Badge>} />
                            </div>
                        </section>

                        <section className="esc-card p-5 bg-primary-soft/30 border-primary-soft">
                            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-4">Total Acumulado</h4>
                            <div className="font-display font-bold text-3xl text-primary text-center">
                                R$ {Number(colabData.valor_total).toLocaleString('pt-BR')}
                            </div>
                            <p className="text-[11px] text-center text-primary/70 mt-2 italic">Valor calculado pós-regras financeiras</p>
                        </section>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <section className="esc-card overflow-hidden">
                            <header className="px-5 py-4 border-b border-border flex items-center gap-2">
                                <History className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-display font-semibold text-foreground">Eventos Financeiros por Dia</h3>
                            </header>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="esc-table-header">
                                        <tr className="text-left text-muted-foreground">
                                            <th className="px-5 h-10 font-medium">Data</th>
                                            <th className="px-3 h-10 font-medium">Descrição / Regras</th>
                                            <th className="px-5 h-10 font-medium text-right">Valor Gerado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(colabData.eventos_financeiros as any[])?.map((ev: any, idx: number) => (
                                            <tr key={idx} className="border-t border-muted hover:bg-background transition-colors">
                                                <td className="px-5 h-12 font-medium text-foreground">{new Date(ev.data).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-3">
                                                    <div className="text-xs">{ev.descricao}</div>
                                                    <div className="flex gap-1 mt-1">
                                                        {ev.regras?.map((r: string, i: number) => (
                                                            <Badge key={i} variant="secondary" className="text-[10px] h-4 py-0 px-1">{r}</Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-5 text-right font-display font-semibold text-foreground">
                                                    R$ {Number(ev.valor).toLocaleString('pt-BR')}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!(colabData.eventos_financeiros as any[])?.length) && (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-muted-foreground italic">Nenhum evento registrado para este colaborador.</td>
                                            </tr>
                                        )}
                                    </tbody>
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
    <div className="flex items-center justify-between text-xs py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
    </div>
);

export default DetalhamentoColaborador;
