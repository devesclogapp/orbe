import { useState } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    FileBox,
    Search,
    Filter,
    Eye,
    FileText,
    Calendar,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { PortalService } from "@/services/financial.service";

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "warning" | "success" | "destructive" }> = {
    pendente: { label: "Pendente", variant: "warning" },
    aprovado: { label: "Aprovado", variant: "success" },
    rejeitado: { label: "Em Revisão", variant: "destructive" },
    pago: { label: "Pago", variant: "secondary" },
};

const ClientReports = () => {
    const [search, setSearch] = useState("");

    const { data: consolidados = [], isLoading } = useQuery({
        queryKey: ["portal_consolidados"],
        queryFn: () => PortalService.getConsolidados(),
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const filtered = consolidados.filter((c: any) =>
        !search || c.competencia?.toLowerCase().includes(search.toLowerCase())
    );

    // Últimos 4 para os cards de destaque
    const destaques = filtered.slice(0, 4);

    return (
        <PortalShell title="Relatórios e Documentos">
            <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-xl flex-1 max-w-md shadow-sm">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Pesquisar por competência..."
                            className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="rounded-xl border-border font-bold gap-2">
                            <Calendar className="w-4 h-4" /> Período
                        </Button>
                        <Button variant="outline" className="rounded-xl border-border font-bold gap-2">
                            <Filter className="w-4 h-4" /> Status
                        </Button>
                    </div>
                </div>

                {/* Cards de destaque */}
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Carregando consolidados...</div>
                ) : destaques.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <FileBox className="w-12 h-12 mx-auto mb-3 opacity-10" />
                        <p className="font-bold">Nenhum relatório disponível.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {destaques.map((c: any) => {
                            const st = statusLabel[c.status] || { label: c.status, variant: "secondary" as const };
                            return (
                                <Card key={c.id} className="p-5 border-none shadow-sm shadow-gray-100 group hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-muted/30 text-muted-foreground rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/5 group-hover:text-brand transition-colors">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-sm mb-1">
                                        Fechamento — {c.competencia}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        {formatCurrency(Number(c.valor_total || 0))}
                                    </p>
                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                                        <button className="text-brand hover:bg-brand/10 p-1.5 rounded-lg transition-colors">
                                            <TrendingUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Tabela completa */}
                {!isLoading && filtered.length > 0 && (
                    <Card className="border-none shadow-sm shadow-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-border/50">
                            <h3 className="font-bold text-gray-900">Todos os Fechamentos</h3>
                        </div>
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Competência</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Valor Total</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Status</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Publicado em</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((c: any) => {
                                    const st = statusLabel[c.status] || { label: c.status, variant: "secondary" as const };
                                    return (
                                        <TableRow key={c.id} className="hover:bg-muted/20">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-muted text-muted-foreground rounded flex items-center justify-center">
                                                        <FileBox className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-gray-700 text-sm">
                                                        Fechamento {c.competencia}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-display font-semibold text-sm">
                                                {formatCurrency(Number(c.valor_total || 0))}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={st.variant} className="text-[10px]">
                                                    {st.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(c.created_at).toLocaleDateString("pt-BR")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground border border-transparent hover:border-border">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </div>
        </PortalShell>
    );
};

export default ClientReports;
