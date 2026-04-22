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
    Clock,
    Check,
    Loader2
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const Agendamentos = () => {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        nome: "",
        relatorio_id: "",
        frequencia: "diaria",
        destinatarios: ""
    });

    const { data: reports = [] } = useQuery({
        queryKey: ["reports_catalog"],
        queryFn: () => ReportService.getAll(),
    });

    const { data: agendamentos = [], isLoading } = useQuery({
        queryKey: ["report_schedules"],
        queryFn: () => ReportService.getAgendamentos(),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ReportService.createAgendamento(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["report_schedules"] });
            setIsAddOpen(false);
            setNewSchedule({ nome: "", relatorio_id: "", frequencia: "diaria", destinatarios: "" });
            toast.success("Agendamento criado!");
        },
        onError: (err: any) => toast.error("Erro ao criar agendamento", { description: err.message })
    });

    const handleCreate = () => {
        if (!newSchedule.nome || !newSchedule.relatorio_id || !newSchedule.destinatarios) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        const data = {
            ...newSchedule,
            destinatarios: newSchedule.destinatarios.split(",").map(e => e.trim()),
            status: 'ativo'
        };

        createMutation.mutate(data);
    };

    const executeNowMutation = useMutation({
        mutationFn: (id: string) => new Promise((resolve) => setTimeout(resolve, 1500)), // Simulação de trigger
        onSuccess: () => {
            toast.success("Relatório disparado com sucesso!", {
                description: "Os destinatários receberão o arquivo em instantes."
            });
        }
    });

    const handleExecuteNow = (id: string) => {
        toast.promise(executeNowMutation.mutateAsync(id), {
            loading: 'Disparando relatório...',
            success: 'Relatório disparado!',
            error: 'Erro ao disparar relatório',
        });
    };

    return (
        <AppShell
            title="Agendamento de Relatórios"
            subtitle="Gerencie a automação de envios recorrentes"
            backPath="/relatorios"
        >
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="font-semibold shadow-lg shadow-primary/20">
                                <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Configurar Recorrência</DialogTitle>
                                <DialogDescription>
                                    O Orbe enviará o relatório automaticamente conforme a frequência definida.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome do Agendamento</Label>
                                    <Input
                                        placeholder="Ex: Faturamento Semanal - Diretoria"
                                        value={newSchedule.nome}
                                        onChange={e => setNewSchedule({ ...newSchedule, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Relatório</Label>
                                    <select
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                        value={newSchedule.relatorio_id}
                                        onChange={e => setNewSchedule({ ...newSchedule, relatorio_id: e.target.value })}
                                    >
                                        <option value="">Selecione um relatório...</option>
                                        {reports.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Frequência</Label>
                                        <select
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background capitalize"
                                            value={newSchedule.frequencia}
                                            onChange={e => setNewSchedule({ ...newSchedule, frequencia: e.target.value })}
                                        >
                                            <option value="diaria">Diária</option>
                                            <option value="semanal">Semanal</option>
                                            <option value="mensal">Mensal</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Formato</Label>
                                        <select className="w-full h-10 px-3 rounded-md border border-input bg-background">
                                            <option>Excel (.xlsx)</option>
                                            <option>PDF</option>
                                            <option>CSV</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Destinatários (separados por vírgula)</Label>
                                    <Input
                                        placeholder="email@empresa.com, outro@empresa.com"
                                        value={newSchedule.destinatarios}
                                        onChange={e => setNewSchedule({ ...newSchedule, destinatarios: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    Salvar Agendamento
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
                                                <DropdownMenuContent align="end" className="w-40 font-medium font-sans">
                                                    <DropdownMenuItem
                                                        className="gap-2 cursor-pointer"
                                                        onClick={() => handleExecuteNow(ag.id)}
                                                    >
                                                        <Play className="h-4 w-4 text-primary fill-primary/10" /> Executar Agora
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 cursor-pointer">
                                                        <Mail className="h-4 w-4" /> Ver Logs
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer">
                                                        <Trash2 className="h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
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
