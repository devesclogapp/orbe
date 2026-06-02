import { useQuery } from "@tanstack/react-query";
import { Cpu, Plus, PowerOff, ToggleRight, Check, Wrench } from "lucide-react";
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
import { ColetorService } from "@/services/base.service";

export function CadastrosColetores() {
    const { data: coletores = [], isLoading } = useQuery({
        queryKey: ["coletores"],
        queryFn: () => ColetorService.getWithEmpresa(),
    });

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Coletores Biométricos</h2>
                    <p className="text-sm text-muted-foreground">
                        Dispositivos físicos e virtuais para captura de jornada e presença.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Novo coletor
                    </Button>
                </div>
            </div>

            <div className="p-5">
                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead>Coletor / Modelo</TableHead>
                                <TableHead>Empresa / Unidade</TableHead>
                                <TableHead>Integração</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : coletores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhum coletor cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                coletores.map((coletor: any) => (
                                    <TableRow key={coletor.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{coletor.modelo || "Genérico"}</span>
                                                <span className="text-xs text-muted-foreground">SN: {coletor.serie}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <span className="font-medium text-foreground">{coletor.empresas?.nome}</span>
                                                <span className="text-muted-foreground">{coletor.unidade_operacional?.nome || "Todas as unidades"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize text-[10px] font-normal">
                                                {coletor.tipo_integracao?.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={coletor.integracao_ativa ? "success" : "secondary"}>
                                                {coletor.integracao_ativa ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Wrench className="h-4 w-4" />
                                            </Button>
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
