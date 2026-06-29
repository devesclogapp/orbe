import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Reprocessamentos() {
    const mockLogs: any[] = [];

    return (
        <AppShell
            title="Reprocessamentos"
            subtitle="Histórico e status de tarefas de reprocessamento em massa"
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Reprocessado</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-green-100 text-green-600">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Sucesso</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-red-100 text-red-600">
                                <XCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Falhas</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card className="p-0 overflow-hidden">
                    <div className="p-6 border-b">
                        <h3 className="font-bold">Logs Recentes</h3>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Módulo / Tipo</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead>Data / Hora</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Usuário</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-medium">{log.tipo}</TableCell>
                                    <TableCell>{log.competencia}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} />
                                            {log.data}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.status === "concluido" ? "success" : "destructive"}>
                                            {log.status === "concluido" ? "Concluído" : "Falha"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{log.usuario}</TableCell>
                                </TableRow>
                            ))}
                            {mockLogs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                                        Nenhum histórico de tarefas de reprocessamento em massa.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </AppShell>
    );
}
