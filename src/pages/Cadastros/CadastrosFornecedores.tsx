import { useQuery } from "@tanstack/react-query";
import { Store, Plus, Pencil, Trash2 } from "lucide-react";
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
import { FornecedorService } from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";

export function CadastrosFornecedores() {
    const { user } = useAuth();
    const empresaId = user?.user_metadata?.empresa_id;

    const { data: fornecedores = [], isLoading } = useQuery({
        queryKey: ["fornecedores"],
        queryFn: () => FornecedorService.getByEmpresa(empresaId),
        select: (data) => data.filter((f: any) => f.ativo !== false),
    });

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Fornecedores</h2>
                    <p className="text-sm text-muted-foreground">
                        Gestão de fornecedores de mercadorias e insumos operacionais.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Novo fornecedor
                    </Button>
                </div>
            </div>

            <div className="p-5">
                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead>Fornecedor</TableHead>
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
                            ) : fornecedores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhum fornecedor encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                fornecedores.map((forn: any) => (
                                    <TableRow key={forn.id}>
                                        <TableCell className="font-medium">{forn.nome}</TableCell>
                                        <TableCell className="font-mono text-xs">{forn.documento || "—"}</TableCell>
                                        <TableCell className="text-xs">{forn.email || forn.telefone || "—"}</TableCell>
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
