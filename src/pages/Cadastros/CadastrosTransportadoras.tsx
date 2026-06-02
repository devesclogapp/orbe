import { useQuery } from "@tanstack/react-query";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { TransportadoraClienteService } from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";

export function CadastrosTransportadoras() {
    const { user } = useAuth();
    const empresaId = user?.user_metadata?.empresa_id;

    const { data: transportadoras = [], isLoading } = useQuery({
        queryKey: ["transportadoras"],
        queryFn: () => TransportadoraClienteService.getByEmpresa(empresaId),
        select: (data) => data.filter((t: any) => t.ativo !== false),
    });

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Transportadoras</h2>
                    <p className="text-sm text-muted-foreground">
                        Gestão de parceiros logísticos para fluxo de descarga e faturamento.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Nova transportadora
                    </Button>
                </div>
            </div>

            <div className="p-5">
                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead>Transportadora</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead>Contato</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : transportadoras.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhuma transportadora encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transportadoras.map((transp: any) => (
                                    <TableRow key={transp.id}>
                                        <TableCell className="font-medium">{transp.nome}</TableCell>
                                        <TableCell className="font-mono text-xs">{transp.documento || "—"}</TableCell>
                                        <TableCell className="text-xs">{transp.email || transp.telefone || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="success">Ativa</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </section>
    );
}
