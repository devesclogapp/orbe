// Logs Tab Component
import { useQuery } from "@tanstack/react-query";
import { AccountingService } from "@/services/accounting.service";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    ExternalLink,
    ChevronDown,
    Terminal,
    Filter
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const LogsIntegracao = () => {
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["accounting_logs"],
        queryFn: () => AccountingService.getLogs(),
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Logs de Integração</h2>
                <p className="text-muted-foreground">Histórico detalhado de comunicações com sistemas externos</p>
            </div>
            <div className="space-y-6">
                {/* Sumário Rápido */}
                <div className="flex gap-4 overflow-x-auto pb-2">
                    <StatusCard label="Sucessos" value="128" color="success" />
                    <StatusCard label="Falhas" value="2" color="destructive" />
                    <StatusCard label="Total Processado" value="130" color="default" />
                </div>

                {/* Tabela de Logs */}
                <section className="esc-card overflow-hidden">
                    <header className="px-5 py-4 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/10">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-display font-bold">Registro de Eventos</h3>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Todas as Origens</Button>
                            <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4 mr-2" /> Últimos 30 dias</Button>
                        </div>
                    </header>
                    <Table>
                        <TableHeader className="esc-table-header">
                            <TableRow>
                                <TableHead className="px-5">Data/Hora</TableHead>
                                <TableHead>Sistema Destino</TableHead>
                                <TableHead>Tipo de Envio</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right px-5">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5} className="h-12 animate-pulse bg-muted/20"></TableCell>
                                    </TableRow>
                                ))
                            ) : logs.length > 0 ? (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="px-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">{new Date(log.execucao_data!).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-muted-foreground">{new Date(log.execucao_data!).toLocaleTimeString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{log.sistema_destino}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-[10px] uppercase">{log.tipo_envio}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {log.status === 'sucesso' ? (
                                                <div className="flex items-center gap-1.5 text-success font-bold text-xs">
                                                    <CheckCircle2 className="h-4 w-4" /> Sucesso
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-destructive font-bold text-xs" title={log.erro_detalhe || ""}>
                                                    <XCircle className="h-4 w-4" /> Erro
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right px-5">
                                            <Button variant="ghost" size="sm" className="font-bold text-primary group">
                                                Detalhe <ExternalLink className="h-3 w-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">Nenhuma execução registrada.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </section>
            </div>
        </div>
    );
};

const StatusCard = ({ label, value, color }: { label: string, value: string, color: 'success' | 'destructive' | 'default' }) => (
    <div className="esc-card min-w-[180px] p-4 bg-muted/10 border-border/60">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-display font-bold ${color === 'success' ? 'text-success' : color === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>
            {value}
        </div>
    </div>
);

const CalendarIcon = (props: any) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
)

export default LogsIntegracao;
