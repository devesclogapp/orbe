// Mapeamento Tab Component
import { useQuery } from "@tanstack/react-query";
import { AccountingService } from "@/services/accounting.service";
import { EmpresaService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Search,
    ArrowRightLeft,
    Check,
    AlertCircle,
    Hash,
    Database
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const MapeamentoContabil = () => {
    const [search, setSearch] = useState("");

    // No MVP simplificamos pegando mapeamentos da primeira empresa do sistema
    const { data: mapeamentos = [], isLoading } = useQuery({
        queryKey: ["accounting_mappings"],
        queryFn: () => AccountingService.getMapeamentos("*"), // Simulado
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Mapa de Lançamentos</h2>
                <p className="text-muted-foreground">Associação técnica entre tipos de operação e planos de contas</p>
            </div>
            <div className="space-y-6">
                {/* Barra de Filtros */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por operação ou conta..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button className="font-semibold h-10 px-6">
                        <Plus className="h-4 w-4 mr-2" /> Novo Mapeamento
                    </Button>
                </div>

                {/* Alerta de Auditoria */}
                <div className="flex items-center gap-3 p-4 bg-warning/5 border border-warning/20 rounded-xl text-warning-strong text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>Alterações no mapeamento podem invalidar exportações de competências já encerradas. Proceda com cautela.</span>
                </div>

                {/* Tabela de De-Para */}
                <section className="esc-card overflow-hidden">
                    <Table>
                        <TableHeader className="esc-table-header">
                            <TableRow>
                                <TableHead className="px-5">Tipo de Operação</TableHead>
                                <TableHead className="w-[100px] text-center"></TableHead>
                                <TableHead>Conta Contábil / Classificação</TableHead>
                                <TableHead>Empresa</TableHead>
                                <TableHead className="text-right px-5">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5} className="h-12 animate-pulse bg-muted/20"></TableCell>
                                    </TableRow>
                                ))
                            ) : mapeamentos.length > 0 ? (
                                mapeamentos.map((map) => (
                                    <TableRow key={map.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                                                    <Database className="h-4 w-4" />
                                                </div>
                                                <span className="font-semibold text-foreground">{map.operacao_tipo}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <ArrowRightLeft className="h-4 w-4 mx-auto text-muted-foreground opacity-50" />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Hash className="h-3 w-3 text-primary" />
                                                    <span className="font-mono font-bold text-primary">{map.conta_contabil}</span>
                                                </div>
                                                {map.classificacao && (
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{map.classificacao}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">Multi-empresa</Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-5">
                                            <Button variant="ghost" size="sm" className="font-bold text-xs uppercase tracking-wider">Editar</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-40 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <ArrowRightLeft className="h-10 w-10 opacity-10 mb-2" />
                                            <p className="font-medium">Nenhum mapeamento registrado.</p>
                                            <Button variant="link" className="text-primary font-bold">Importar Plano Padrão</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </section>
            </div>
        </div>
    );
};

export default MapeamentoContabil;
