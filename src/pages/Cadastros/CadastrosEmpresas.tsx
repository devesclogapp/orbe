import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Globe, Landmark } from "lucide-react";
import { toast } from "sonner";
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
import { EmpresaService } from "@/services/base.service";

export function CadastrosEmpresas() {
    const queryClient = useQueryClient();
    const { data: empresas = [], isLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getWithCounts(),
    });

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Empresas e Unidades</h2>
                    <p className="text-sm text-muted-foreground">
                        Gestão de tomadores de serviço e suas respectivas bases operacionais.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
                    </Button>
                </div>
            </div>

            <div className="p-5">
                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[300px]">Empresa / Unidade</TableHead>
                                <TableHead>CNPJ</TableHead>
                                <TableHead>Localização</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : empresas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhuma empresa encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                empresas.map((empresa: any) => (
                                    <TableRow key={empresa.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <Building2 className="h-5 w-5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{empresa.nome}</span>
                                                    <span className="text-xs text-muted-foreground">{empresa.unidade || "Matriz"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{empresa.cnpj}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Globe className="h-3 w-3" />
                                                {empresa.cidade}/{empresa.estado}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={empresa.status === 'ativa' ? "success" : "secondary"}>
                                                {empresa.status === 'ativa' ? 'Ativo' : 'Inativo'}
                                            </Badge>
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
