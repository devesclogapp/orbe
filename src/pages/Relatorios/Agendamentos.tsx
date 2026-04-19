import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/services/report.service";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Calendar,
    Mail,
    Trash2,
    Play,
    ToggleLeft,
    ToggleRight,
    MoreVertical,
    Clock
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const Agendamentos = () => {
    const { data: agendamentos = [], isLoading } = useQuery({
        queryKey: ["report_schedules"],
        queryFn: () => ReportService.getAgendamentos(),
    });

    return (
        <AppShell
            title="Agendamento de Relatórios"
            subtitle="Gerencie a automação de envios recorrentes"
            backPath="/relatorios"
        >
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button className="font-semibold">
                        <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
                    </Button>
                </div>

                <section className="esc-card overflow-hidden">
                    <Table>
                        <TableHeader className="esc-table-header">
                            <TableRow>
                                <TableHead className="px-5">Nome do Agendamento</TableHead>
                                <TableHead>Relatório</TableHead>
                                <TableHead>Frequência</TableHead>
                                <TableHead>Destinatários</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Última Execução</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={7} className="h-12 animate-pulse bg-muted/20"></TableCell>
                                    </TableRow>
                                ))
                            ) : agendamentos.length > 0 ? (
                                agendamentos.map((ag) => (
                                    <TableRow key={ag.id} className="group">
                                        <TableCell className="px-5 font-medium">{ag.nome}</TableCell>
                                        <TableCell className="text-muted-foreground">{ag.relatorios_catalogo?.nome}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                <Calendar className="h-3 w-3 mr-1.5 opacity-50" /> {ag.frequencia}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex -space-x-2">
                                                {ag.destinatarios.slice(0, 2).map((email, idx) => (
                                                    <div key={idx} className="h-7 w-7 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary" title={email}>
                                                        {email.substring(0, 1).toUpperCase()}
                                                    </div>
                                                ))}
                                                {ag.destinatarios.length > 2 && (
                                                    <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                        +{ag.destinatarios.length - 2}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {ag.status === 'ativo' ? (
                                                <div className="flex items-center text-success font-medium text-xs">
                                                    <ToggleRight className="h-4 w-4 mr-1" /> Ativo
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-muted-foreground font-medium text-xs">
                                                    <ToggleLeft className="h-4 w-4 mr-1" /> Inativo
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground flex items-center gap-1.5 h-[52px]">
                                            <Clock className="h-3 w-3" />
                                            {ag.ultima_execucao ? new Date(ag.ultima_execucao).toLocaleDateString() : 'Nunca'}
                                        </TableCell>
                                        <TableCell className="px-5">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 font-medium">
                                                    <DropdownMenuItem className="gap-2"><Play className="h-4 w-4" /> Executar Agora</DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2"><Mail className="h-4 w-4" /> Ver Logs</DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-[200px] text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Calendar className="h-8 w-8 opacity-20" />
                                            <p>Nenhum agendamento ativo.</p>
                                            <Button variant="outline" size="sm" className="mt-2">Configurar Primeiro Envio</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </section>
            </div>
        </AppShell>
    );
};

export default Agendamentos;
