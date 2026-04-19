import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RegraCalculoService, ClienteService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Scale, Tag, Clock, Trash2, Pencil, Loader2, CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RegrasCalculo = () => {
    const queryClient = useQueryClient();
    const [filterCliente, setFilterCliente] = useState<string>("todos");

    const { data: regras = [], isLoading } = useQuery({
        queryKey: ["regras_calculo"],
        queryFn: () => RegraCalculoService.getAll(),
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ["clientes"],
        queryFn: () => ClienteService.getAll(),
    });

    const filtered = filterCliente === "todos"
        ? regras
        : regras.filter((r: any) => r.cliente_id === filterCliente);

    return (
        <AppShell title="Regras de Cálculo" subtitle="Gestão de adicionais, descontos e composições financeiras">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <select
                            className="h-9 rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterCliente}
                            onChange={(e) => setFilterCliente(e.target.value)}
                        >
                            <option value="todos">Todos os Clientes</option>
                            {clientes.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                    </div>
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" /> Nova Regra
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((r: any) => (
                            <article key={r.id} className="esc-card p-5 relative overflow-hidden group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "h-9 w-9 rounded-md flex items-center justify-center",
                                            r.tipo === 'adicional' ? "bg-success-soft text-success-strong" : "bg-destructive-soft text-destructive-strong"
                                        )}>
                                            <Scale className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-semibold text-foreground text-sm">{r.nome}</h3>
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-tight">{r.tipo}</p>
                                        </div>
                                    </div>
                                    <Badge variant={r.status === 'ativo' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                                        {r.status}
                                    </Badge>
                                </div>

                                <div className="my-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground inline-flex items-center gap-1.5"><Tag className="h-3 w-3" /> Valor esperado</span>
                                        <span className="font-display font-bold text-lg text-foreground">
                                            {r.unidade === 'percentual' ? `${r.valor}%` : `R$ ${r.valor.toLocaleString('pt-BR')}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> Vigência</span>
                                        <span className="text-foreground">
                                            {r.vigencia_inicio ? new Date(r.vigencia_inicio).toLocaleDateString('pt-BR') : 'Sem data'}
                                            {r.vigencia_fim ? ` até ${new Date(r.vigencia_fim).toLocaleDateString('pt-BR')}` : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border flex items-center justify-between">
                                    <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[150px]">
                                        {r.cliente_id ? clientes.find((c: any) => c.id === r.cliente_id)?.nome : 'Geral (Todos os clientes)'}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {filtered.length === 0 && (
                            <div className="col-span-full p-20 text-center text-muted-foreground italic border border-dashed rounded-xl">
                                Nenhuma regra cadastrada encontrada {filterCliente !== 'todos' ? 'para este cliente' : ''}.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
};

export default RegrasCalculo;
