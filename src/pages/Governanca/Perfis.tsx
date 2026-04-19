import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus, Settings2, Check, X } from "lucide-react";
import { ProfileService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PerfisPermissoes = () => {
    const queryClient = useQueryClient();
    const [selectedPerfil, setSelectedPerfil] = useState<any>(null);

    const { data: perfis = [], isLoading } = useQuery({
        queryKey: ["perfis"],
        queryFn: () => ProfileService.getAll(),
    });

    const modules = [
        { id: "ponto", label: "Processamento de Ponto" },
        { id: "financeiro", label: "Financeiro & Faturamento" },
        { id: "rh", label: "Gestão de Colaboradores" },
        { id: "bh", label: "Banco de Horas" },
        { id: "config", label: "Configurações do Sistema" },
    ];

    const actions = [
        { id: "ver", label: "Visualizar" },
        { id: "editar", label: "Editar/Criar" },
        { id: "excluir", label: "Excluir" },
        { id: "aprovar", label: "Aprovar/Fechar" },
    ];

    return (
        <AppShell title="Perfis e Permissões" subtitle="Controle granular de ações por módulo">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sidebar de Perfis */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="esc-card p-0 overflow-hidden">
                        <div className="p-4 border-b border-muted flex items-center justify-between">
                            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Perfis Cadastrados</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="divide-y divide-muted">
                            {perfis.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPerfil(p)}
                                    className={cn(
                                        "w-full text-left p-4 hover:bg-background transition-colors flex items-center justify-between group",
                                        selectedPerfil?.id === p.id && "bg-primary-soft border-l-4 border-primary"
                                    )}
                                >
                                    <div>
                                        <div className={cn("font-medium", selectedPerfil?.id === p.id ? "text-primary" : "text-foreground")}>
                                            {p.nome}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{p.descricao || "Sem descrição"}</div>
                                    </div>
                                    <ShieldCheck className={cn("h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity", selectedPerfil?.id === p.id && "opacity-100 text-primary")} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Matriz de Permissões */}
                <div className="lg:col-span-8">
                    {selectedPerfil ? (
                        <div className="esc-card p-0 overflow-hidden">
                            <div className="p-5 border-b border-muted flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-foreground">{selectedPerfil.nome}</h3>
                                    <p className="text-xs text-muted-foreground">Defina o que este perfil pode fazer em cada módulo.</p>
                                </div>
                                <Button>Salvar Alterações</Button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-5 h-12 text-left font-semibold text-muted-foreground">Módulo</th>
                                            {actions.map(a => (
                                                <th key={a.id} className="px-3 h-12 text-center font-semibold text-muted-foreground">{a.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-muted">
                                        {modules.map(m => (
                                            <tr key={m.id} className="hover:bg-background">
                                                <td className="px-5 h-14 font-medium text-foreground">{m.label}</td>
                                                {actions.map(a => {
                                                    const hasAccess = Math.random() > 0.5; // Mock logic for UI
                                                    return (
                                                        <td key={a.id} className="px-3 h-14 text-center">
                                                            <button className={cn(
                                                                "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all",
                                                                hasAccess ? "bg-success-soft text-success border border-success-strong/10" : "bg-muted text-muted-foreground/40"
                                                            )}>
                                                                {hasAccess ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="esc-card flex flex-col items-center justify-center p-20 text-center border-dashed">
                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <Settings2 className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">Aperte em um perfil</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                Selecione um perfil à esquerda para visualizar e editar as permissões de acesso.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default PerfisPermissoes;
