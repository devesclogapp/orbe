import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Users,
    AlertTriangle,
    CheckCircle2,
    Search,
    Copy,
    Pencil,
    Trash2,
    Ban,
    Check
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { ColaboradorService } from "@/services/base.service";
import { cn } from "@/lib/utils";

// --- HELPERS (Traga as funções de negócio de CentralCadastros.tsx) ---
// Nota: Em uma refatoração completa, estas funções estariam em utils separados.

export function CadastrosColaboradores() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [contractFilter, setContractFilter] = useState("todos");

    const { data: colaboradores = [], isLoading } = useQuery({
        queryKey: ["colaboradores_list"],
        queryFn: () => ColaboradorService.getWithEmpresa()
    });

    const filteredColaboradores = useMemo(() => {
        return colaboradores.filter((c: any) => {
            const matchesSearch = !search ||
                c.nome?.toLowerCase().includes(search.toLowerCase()) ||
                c.cpf?.includes(search);

            const matchesContract = contractFilter === "todos" ||
                c.modelo_calculo === contractFilter ||
                c.tipo_contrato === contractFilter;

            return matchesSearch && matchesContract;
        });
    }, [colaboradores, search, contractFilter]);

    return (
        <section className="esc-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Equipe operacional</h2>
                    <p className="text-sm text-muted-foreground">
                        Vínculo com empresa, contrato e impacto financeiro lado a lado.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" /> Novo colaborador
                    </Button>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou CPF..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={contractFilter} onValueChange={setContractFilter}>
                        <SelectTrigger className="w-full md:w-48">
                            <SelectValue placeholder="Tipo de contrato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os contratos</SelectItem>
                            <SelectItem value="Mensal">Mensal</SelectItem>
                            <SelectItem value="Horista">Por Hora</SelectItem>
                            <SelectItem value="Diária">Diária</SelectItem>
                            <SelectItem value="Produção">Produção</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="border rounded-xl overflow-hidden bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead>Tipo / Regime</TableHead>
                                <TableHead>Contrato</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredColaboradores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        Nenhum colaborador encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredColaboradores.map((colab: any) => (
                                    <TableRow key={colab.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{colab.nome}</span>
                                                <span className="text-xs text-muted-foreground">{colab.cpf || "Sem CPF"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{colab.empresas?.nome || "-"}</TableCell>
                                        <TableCell>{colab.tipo_colaborador || colab.regime_trabalho}</TableCell>
                                        <TableCell>{colab.modelo_calculo || colab.tipo_contrato}</TableCell>
                                        <TableCell>
                                            <Badge variant={colab.status === 'ativo' ? "success" : "secondary"}>
                                                {colab.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
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
