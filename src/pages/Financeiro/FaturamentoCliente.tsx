import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompetenciaService, ConsolidadoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { FileCheck, Search, Filter, Loader2, ExternalLink, Printer, Building2 } from "lucide-react";
import { EmpresaService } from "@/services/base.service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FaturamentoCliente = () => {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: empresas = [], isLoading: loadingEmps } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);

    // Seleciona a primeira empresa se nenhuma estiver selecionada
    useEffect(() => {
        if (empresas.length > 0 && !selectedEmpresaId) {
            setSelectedEmpresaId(empresas[0].id);
        }
    }, [empresas, selectedEmpresaId]);

    const { data: comp } = useQuery({
        queryKey: ["competencia_atual", selectedEmpresaId],
        queryFn: () => CompetenciaService.getAtual(selectedEmpresaId!),
        enabled: !!selectedEmpresaId,
    });

    const { data: consolidado, isLoading: loadingCons } = useQuery({
        queryKey: ["consolidado", comp?.competencia, selectedEmpresaId],
        queryFn: () => ConsolidadoService.getByCompetencia(comp!.competencia, selectedEmpresaId!),
        enabled: !!comp?.competencia && !!selectedEmpresaId,
    });

    const isLoading = loadingCons || loadingEmps;

    const list = consolidado?.clientes || [];
    const filtered = list.filter((c: any) =>
        c.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppShell title="Faturamento por Cliente" subtitle="Detalhamento e memória de cálculo por competência">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            className="w-full h-10 pl-10 pr-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {empresas.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedEmpresaId || ""}
                                    onChange={(e) => setSelectedEmpresaId(e.target.value)}
                                    className="h-10 pl-3 pr-8 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none min-w-[200px]"
                                >
                                    {empresas.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                    ))}
                                </select>
                                <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            </div>
                        )}
                        <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" /> Imprimir Tudo</Button>
                        <Button size="sm"><FileCheck className="h-4 w-4 mr-2" /> Aprovar Lote</Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <section className="esc-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Cliente</th>
                                    <th className="px-3 h-11 font-medium text-center">Operações</th>
                                    <th className="px-3 h-11 font-medium text-right">Base</th>
                                    <th className="px-3 h-11 font-medium text-right">Regras (+) (-)</th>
                                    <th className="px-3 h-11 font-medium text-right">Total Faturável</th>
                                    <th className="px-3 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c: any) => (
                                    <tr key={c.id} className="border-t border-muted hover:bg-background transition-colors cursor-pointer group">
                                        <td className="px-5 h-14 font-medium text-foreground">{c.clientes?.nome}</td>
                                        <td className="px-3 text-center text-muted-foreground font-display">{c.quantidade_operacoes}</td>
                                        <td className="px-3 text-right text-muted-foreground">R$ {Number(c.valor_base).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-right text-muted-foreground">R$ {Number(c.valor_regras).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-right font-display font-bold text-foreground">R$ {Number(c.valor_total).toLocaleString('pt-BR')}</td>
                                        <td className="px-3 text-center">
                                            <Badge className={cn(
                                                "h-6 font-semibold",
                                                c.status === 'aprovado' ? "bg-success-soft text-success-strong" : "bg-warning-soft text-warning-strong"
                                            )}>
                                                {c.status}
                                            </Badge>
                                        </td>
                                        <td className="px-5 text-right">
                                            <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary-strong">
                                                <ExternalLink className="h-4 w-4 mr-1" /> Memória
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-muted-foreground italic">Nenhum cliente processado nesta competência.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                )}
            </div>
        </AppShell>
    );
};

export default FaturamentoCliente;
