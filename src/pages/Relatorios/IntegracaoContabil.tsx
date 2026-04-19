import { AppShell } from "@/components/layout/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AccountingService } from "@/services/accounting.service";
import { Button } from "@/components/ui/button";
import {
    Server,
    Activity,
    Settings,
    History,
    Send,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    ExternalLink,
    ShieldCheck,
    ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const IntegracaoContabil = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: configs = [], isLoading } = useQuery({
        queryKey: ["accounting_configs"],
        queryFn: () => AccountingService.getAll(),
    });

    const mutation = useMutation({
        mutationFn: (tipo: string) => AccountingService.triggerIntegration(tipo, configs[0]?.sistema_destino || "Domínio"),
        onSuccess: () => {
            toast.success("Integração iniciada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["accounting_logs"] });
        }
    });

    return (
        <AppShell
            title="Integração Contábil/Fiscal"
            subtitle="Conectividade com sistemas externos e exportação de movimentações"
            backPath="/relatorios"
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Status da Conexão */}
                        <section className="esc-card p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <Server className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-display font-bold text-xl">Sistemas Conectados</h3>
                                        <p className="text-sm text-muted-foreground">Status da sincronização em tempo real</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">
                                    <Settings className="h-4 w-4 mr-2" /> Configurar Nova
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="h-20 animate-pulse bg-muted/20 rounded-lg" />
                                ) : configs.length > 0 ? (
                                    configs.map(config => (
                                        <div key={config.id} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-2 w-2 rounded-full ${config.status === 'ativo' ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                                                <div>
                                                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">{config.sistema_destino}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Último envio: Há 2 dias</div>
                                                </div>
                                            </div>
                                            <Badge variant={config.status === 'ativo' ? 'default' : 'secondary'} className="capitalize">
                                                {config.status}
                                            </Badge>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                                        <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm">Nenhum sistema integrado configurado.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Gatilhos Manuais */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="esc-card p-5 bg-primary/[0.02] border-primary/20">
                                <h4 className="font-display font-bold mb-1 flex items-center gap-2">
                                    <History className="h-4 w-4 text-primary" /> Exportação Mensal
                                </h4>
                                <p className="text-xs text-muted-foreground mb-4">Envia o fechamento consolidado da competência anterior para a contabilidade.</p>
                                <Button
                                    className="w-full font-bold bg-primary hover:bg-primary-hover text-white h-9"
                                    onClick={() => mutation.mutate("Mensal")}
                                    disabled={mutation.isPending}
                                >
                                    {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                    Iniciar Envio Mensal
                                </Button>
                            </div>
                            <div className="esc-card p-5">
                                <h4 className="font-display font-bold mb-1 flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-muted-foreground" /> Sincronização Parcial
                                </h4>
                                <p className="text-xs text-muted-foreground mb-4">Atualiza apenas as movimentações dos últimos 7 dias para conferência preliminar.</p>
                                <Button variant="outline" className="w-full font-bold h-9" onClick={() => mutation.mutate("Parcial")}>
                                    Gatilho Sincronia Rápida
                                </Button>
                            </div>
                        </section>
                    </div>

                    {/* Painel Lateral de Metas/Status */}
                    <div className="space-y-6">
                        <section className="esc-card p-5 border-l-4 border-l-info">
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Relatórios de Apoio</h4>
                            <div className="space-y-2">
                                <button onClick={() => navigate('/relatorios/mapeamento')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted text-sm font-medium transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-info/10 rounded-md text-info group-hover:bg-info group-hover:text-white transition-all"><Settings className="h-4 w-4" /></div>
                                        Mapeamento Contábil
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </button>
                                <button onClick={() => navigate('/relatorios/integracao/logs')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted text-sm font-medium transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-info/10 rounded-md text-info group-hover:bg-info group-hover:text-white transition-all"><History className="h-4 w-4" /></div>
                                        Logs de Execução
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </button>
                            </div>
                        </section>

                        <section className="esc-card p-5">
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Segurança</h4>
                            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                                <ShieldCheck className="h-5 w-5 text-success shrink-0" />
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    Todos os payloads de integração são assinados digitalmente e utilizam TLS 1.3 para comunicação segura com o ERP contábil.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default IntegracaoContabil;
