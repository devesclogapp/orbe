import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Search, Filter, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LoteRemessaService } from "@/services/financial.service";

const HistoricoRemessas = () => {
    const { data: remessas, isLoading } = useQuery({
        queryKey: ["lotes-remessa"],
        queryFn: () => LoteRemessaService.getFullHistory()
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'gerado': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Gerado</Badge>;
            case 'enviado': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Enviado</Badge>;
            case 'processado': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Processado</Badge>;
            case 'erro': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Erro</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <AppShell title="Histórico de Remessas">
            <div className="space-y-4">
                <Card className="p-4">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md flex-1 max-w-md">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por lote ou competência..."
                                className="bg-transparent border-none outline-none text-sm w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Filter className="w-4 h-4" /> Filtros
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead>Lote ID</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead>Data Emissão</TableHead>
                                <TableHead>Conta Origem</TableHead>
                                <TableHead className="text-center">Títulos</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-gray-400">Carregando...</TableCell>
                                </TableRow>
                            ) : remessas?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-gray-400">Nenhuma remessa encontrada.</TableCell>
                                </TableRow>
                            ) : remessas?.map((rem) => (
                                <TableRow key={rem.id} className="hover:bg-gray-50/50">
                                    <TableCell className="font-mono text-xs text-gray-500">{rem.id.substring(0, 8)}...</TableCell>
                                    <TableCell className="font-medium">{rem.competencia}</TableCell>
                                    <TableCell>{new Date(rem.created_at!).toLocaleDateString('pt-BR')}</TableCell>
                                    <TableCell>
                                        <div className="text-xs">
                                            <p className="font-semibold">{(rem.contas_bancarias as any)?.banco}</p>
                                            <p className="text-gray-400">Ag: {(rem.contas_bancarias as any)?.agencia} C: {(rem.contas_bancarias as any)?.conta}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">{rem.quantidade_titulos}</TableCell>
                                    <TableCell className="text-right font-bold text-gray-900">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rem.valor_total || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">{getStatusBadge(rem.status || 'gerado')}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-brand">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </AppShell>
    );
};

export default HistoricoRemessas;
