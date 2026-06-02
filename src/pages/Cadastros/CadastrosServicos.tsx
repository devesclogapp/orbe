import { useQuery } from "@tanstack/react-query";
import { Wrench, Plus, Pencil, Trash2 } from "lucide-react";
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
import { TipoServicoOperacionalService } from "@/services/base.service";

export function CadastrosServicos() {
    const { data: tiposServico = [], isLoading } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
        select: (data) => data.filter((s: any) => s.ativo !== false),
    });

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Tipos de Serviço</h2>
                    <p className="text-sm text-muted-foreground">
                        Definição semântica das atividades realizadas na operação.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Novo tipo de serviço
                    </Button>
                </div>
            </div>

            <div className="p-5">
                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead>Serviço</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : tiposServico.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                        Nenhum tipo de serviço cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tiposServico.map((serv: any) => (
                                    <TableRow key={serv.id}>
                                        <TableCell className="font-medium">{serv.nome}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{serv.descricao || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="success">Ativo</Badge>
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
