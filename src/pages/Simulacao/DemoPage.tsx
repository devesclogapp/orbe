import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
    Building2, Users, Clock, Zap, Trash2, Play, AlertTriangle,
    ChevronRight, RefreshCw, Database, BarChart3, CheckCircle2
} from 'lucide-react';
import { DemoService, type DemoParams, type DemoLote } from '@/services/demo.service';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const DEFAULT_PARAMS: DemoParams = {
    quantidade_empresas: 2,
    colaboradores_por_empresa: 10,
    dias: 15,
    operacoes_por_dia: 5,
    percentual_inconsistencias: 15,
};

function SliderField({
    label, name, value, min, max, unit = '', onChange
}: {
    label: string; name: keyof DemoParams; value: number;
    min: number; max: number; unit?: string;
    onChange: (name: keyof DemoParams, value: number) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
                <span className="text-sm font-bold text-primary">{value}{unit}</span>
            </div>
            <div className="relative pt-1">
                <input
                    type="range" min={min} max={max} value={value}
                    onChange={(e) => onChange(name, Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-2">
                    <span className="text-[10px] font-medium text-muted-foreground/60">{min}{unit}</span>
                    <span className="text-[10px] font-medium text-muted-foreground/60">{max}{unit}</span>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: number; color: "blue" | "green" | "amber" | "purple";
}) {
    const colorClasses = {
        blue: "bg-info-soft text-info-strong",
        green: "bg-success-soft text-success-strong",
        amber: "bg-warning-soft text-warning-strong",
        purple: "bg-primary-soft text-primary-strong",
    };

    return (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", colorClasses[color])}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</p>
                <p className="text-xl font-bold text-foreground leading-none">{value.toLocaleString('pt-BR')}</p>
            </div>
        </div>
    );
}

export default function DemoPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [params, setParams] = useState<DemoParams>(DEFAULT_PARAMS);
    const [ultimoResultado, setUltimoResultado] = useState<DemoLote['totais'] | null>(null);

    const { data: lotes = [], isLoading: lotesLoading } = useQuery({
        queryKey: ['demo_lotes'],
        queryFn: DemoService.listarLotes,
    });

    const gerarMutation = useMutation({
        mutationFn: () => DemoService.gerarDemo({ ...params, user_id: user?.id }),
        onSuccess: (res) => {
            setUltimoResultado(res.totais);
            queryClient.invalidateQueries({ queryKey: ['demo_lotes'] });
            toast.success('Base demo gerada com sucesso!', {
                description: `${res.totais.colaboradores} colaboradores · ${res.totais.pontos} pontos · ${res.totais.operacoes} operações`,
            });
        },
        onError: (err: Error) => {
            toast.error('Erro ao gerar demo', { description: err.message });
        },
    });

    const excluirLoteMutation = useMutation({
        mutationFn: (lote_id?: string) => DemoService.excluirDemo(lote_id),
        onSuccess: (res, lote_id) => {
            queryClient.invalidateQueries({ queryKey: ['demo_lotes'] });
            const t = res.totais_excluidos;
            toast.success(lote_id ? 'Lote excluído!' : 'Todos os dados demo excluídos!', {
                description: `${t.colaboradores} colaboradores · ${t.pontos} pontos · ${t.operacoes} operações removidos`,
            });
        },
        onError: (err: Error) => {
            toast.error('Erro ao excluir demo', { description: err.message });
        },
    });

    const handleChange = useCallback((name: keyof DemoParams, value: number) => {
        setParams((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleExcluirTudo = () => {
        if (window.confirm('Excluir TODOS os dados de demo? Esta ação não pode ser desfeita.')) {
            excluirLoteMutation.mutate(undefined);
        }
    };

    const handleExcluirLote = (id: string, nome: string) => {
        if (window.confirm(`Excluir lote "${nome}"?`)) {
            excluirLoteMutation.mutate(id);
        }
    };

    const isLoading = gerarMutation.isPending || excluirLoteMutation.isPending;

    // Totais acumulados de todos os lotes
    const totaisGlobais = lotes.reduce(
        (acc, l) => ({
            empresas: acc.empresas + (l.totais?.empresas ?? 0),
            colaboradores: acc.colaboradores + (l.totais?.colaboradores ?? 0),
            pontos: acc.pontos + (l.totais?.pontos ?? 0),
            operacoes: acc.operacoes + (l.totais?.operacoes ?? 0),
        }),
        { empresas: 0, colaboradores: 0, pontos: 0, operacoes: 0 }
    );

    return (
        <AppShell title="Gerador de Dados" subtitle="Popule o sistema com dados reais para testes operacionais e financeiros">
            <div className="max-w-[1200px] mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary">
                            <Database size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-display font-bold text-foreground">Gerador de Base Demo</h1>
                            <Badge variant="outline" className="bg-warning-soft/20 text-warning-strong border-warning-strong/20 gap-1.5 h-6 mt-1">
                                <AlertTriangle size={12} /> Dados de Teste
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
                    {/* Painel Esquerdo — Parâmetros */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BarChart3 size={18} className="text-primary" /> Parâmetros de Geração
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <SliderField label="Número de empresas" name="quantidade_empresas" value={params.quantidade_empresas} min={1} max={5} onChange={handleChange} />
                                <SliderField label="Colaboradores por empresa" name="colaboradores_por_empresa" value={params.colaboradores_por_empresa} min={5} max={50} onChange={handleChange} />
                                <SliderField label="Dias de histórico" name="dias" value={params.dias} min={7} max={60} unit=" dias" onChange={handleChange} />
                                <SliderField label="Operações por dia" name="operacoes_por_dia" value={params.operacoes_por_dia} min={3} max={20} onChange={handleChange} />
                                <SliderField label="Percentual de inconsistências" name="percentual_inconsistencias" value={params.percentual_inconsistencias} min={0} max={50} unit="%" onChange={handleChange} />

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        className="flex-1 font-bold h-11"
                                        onClick={() => gerarMutation.mutate()}
                                        disabled={isLoading}
                                    >
                                        {gerarMutation.isPending
                                            ? <><RefreshCw size={16} className="mr-2 animate-spin" /> Gerando...</>
                                            : <><Play size={16} className="mr-2" /> Gerar base demo</>
                                        }
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-11 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={handleExcluirTudo}
                                        disabled={isLoading || lotes.length === 0}
                                        title="Excluir todos os dados de teste"
                                    >
                                        {excluirLoteMutation.isPending
                                            ? <RefreshCw size={16} className="animate-spin" />
                                            : <Trash2 size={16} />
                                        }
                                        <span className="ml-2 hidden sm:inline">Limpar</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Estimativa de dados que serão gerados */}
                        <Card className="bg-muted/30 border-dashed">
                            <CardHeader className="py-4">
                                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                                    <ChevronRight size={16} /> Estimativa do lote
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <div className="grid grid-cols-2 gap-y-3 gap-x-1 text-xs">
                                    <div className="text-muted-foreground font-medium">🏭 Empresas</div>
                                    <div className="text-right font-bold text-foreground">{params.quantidade_empresas}</div>
                                    <div className="text-muted-foreground font-medium">👥 Colaboradores</div>
                                    <div className="text-right font-bold text-foreground">{params.quantidade_empresas * params.colaboradores_por_empresa}</div>
                                    <div className="text-muted-foreground font-medium">🕐 Registros Ponto</div>
                                    <div className="text-right font-bold text-foreground">~{Math.round(params.quantidade_empresas * params.colaboradores_por_empresa * params.dias * 0.85)}</div>
                                    <div className="text-muted-foreground font-medium">⚡ Operações</div>
                                    <div className="text-right font-bold text-foreground">~{Math.round(params.quantidade_empresas * params.operacoes_por_dia * params.dias * 0.85)}</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Painel Direito — Resumo e Lotes */}
                    <div className="space-y-6">
                        {/* Cards de totais globais */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <SummaryCard icon={Building2} label="Empresas demo" value={totaisGlobais.empresas} color="blue" />
                            <SummaryCard icon={Users} label="Colaboradores" value={totaisGlobais.colaboradores} color="green" />
                            <SummaryCard icon={Clock} label="Registros ponto" value={totaisGlobais.pontos} color="amber" />
                            <SummaryCard icon={Zap} label="Operações" value={totaisGlobais.operacoes} color="purple" />
                        </div>

                        {/* Último resultado */}
                        {ultimoResultado && (
                            <Card className="bg-primary/5 border-primary/20">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-sm text-primary flex items-center gap-2">
                                        <CheckCircle2 size={16} /> Último lote gerado com sucesso
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    <div className="flex gap-x-6 gap-y-2 text-xs font-semibold text-primary/80 flex-wrap">
                                        <span>🏭 {ultimoResultado.empresas} empresas</span>
                                        <span>👥 {ultimoResultado.colaboradores} colaboradores</span>
                                        <span>🕐 {ultimoResultado.pontos} pontos</span>
                                        <span>⚡ {ultimoResultado.operacoes} operações</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Lista de Lotes */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between py-5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Database size={18} className="text-primary" /> Lotes Gerados
                                </CardTitle>
                                <Badge variant="secondary" className="h-6 px-3">{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</Badge>
                            </CardHeader>
                            <CardContent className="space-y-3 pb-6">
                                {lotesLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                                        <RefreshCw size={32} className="animate-spin mb-4 opacity-20" />
                                        <p className="text-sm">Carregando histórico de lotes...</p>
                                    </div>
                                ) : lotes.length === 0 ? (
                                    <div className="py-16 text-center bg-muted/20 border border-dashed border-border rounded-xl">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                                            <Database size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Nenhum lote gerado</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                                            Ajuste os parâmetros à esquerda e clique em para popular sua base.
                                        </p>
                                    </div>
                                ) : (
                                    lotes.map((lote) => (
                                        <div key={lote.id} className="group flex items-center justify-between p-4 border border-border rounded-xl bg-background hover:border-primary/40 transition-all">
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-foreground">{lote.nome}</p>
                                                <div className="flex gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-medium flex-wrap">
                                                    {lote.totais && (
                                                        <>
                                                            <span className="flex items-center gap-1">🏭 {lote.totais.empresas} emp.</span>
                                                            <span className="flex items-center gap-1">👥 {lote.totais.colaboradores} col.</span>
                                                            <span className="flex items-center gap-1">🕐 {lote.totais.pontos} pts.</span>
                                                            <span className="flex items-center gap-1">⚡ {lote.totais.operacoes} ops.</span>
                                                        </>
                                                    )}
                                                    <span className="text-muted-foreground/60 border-l border-border pl-4">
                                                        📅 {new Date(lote.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                onClick={() => handleExcluirLote(lote.id, lote.nome)}
                                                disabled={isLoading}
                                                title="Excluir este lote"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
