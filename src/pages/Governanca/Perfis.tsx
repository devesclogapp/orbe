import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus, Settings2, Check, X, Save, Trash2, Shield, Info, Lock, Layout, Users, Clock, Activity, Database, DollarSign, Briefcase, Settings } from "lucide-react";
import { ProfileService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PerfisPermissoes = () => {
    const queryClient = useQueryClient();
    const [selectedPerfil, setSelectedPerfil] = useState<any>(null);
    const [currentPerms, setCurrentPerms] = useState<string[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newProfile, setNewProfile] = useState({ nome: "", descricao: "" });

    const { data: perfis = [], isLoading } = useQuery({
        queryKey: ["perfis"],
        queryFn: () => ProfileService.getAll(),
    });

    useEffect(() => {
        if (selectedPerfil) {
            setCurrentPerms(selectedPerfil.permissoes || []);
        } else {
            setCurrentPerms([]);
        }
    }, [selectedPerfil]);

    const mutationSave = useMutation({
        mutationFn: ({ id, payload }: { id: string, payload: any }) => ProfileService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["perfis"] });
            toast.success("Permissões atualizadas com sucesso!");
        },
        onError: () => {
            toast.error("Erro ao salvar permissões.");
        }
    });

    const mutationCreate = useMutation({
        mutationFn: (payload: any) => ProfileService.create({ ...payload, permissoes: [] }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["perfis"] });
            setIsCreateModalOpen(false);
            setNewProfile({ nome: "", descricao: "" });
            setSelectedPerfil(data);
            toast.success("Perfil criado com sucesso!");
        },
        onError: () => {
            toast.error("Erro ao criar perfil.");
        }
    });

    const mutationDelete = useMutation({
        mutationFn: (id: string) => ProfileService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["perfis"] });
            setSelectedPerfil(null);
            toast.success("Perfil excluído com sucesso!");
        },
        onError: () => {
            toast.error("Erro ao excluir perfil.");
        }
    });

    const modules = [
        { id: "dashboard", label: "Dashboard", icon: Layout },
        { id: "colaboradores", label: "Colaboradores", icon: Users },
        { id: "registros_ponto", label: "Ponto Eletrônico", icon: Clock },
        { id: "operacoes", label: "Operações", icon: Activity },
        { id: "banco_horas", label: "Banco de Horas", icon: Database },
        { id: "financeiro", label: "Financeiro", icon: DollarSign },
        { id: "clientes", label: "Clientes", icon: Briefcase },
        { id: "configuracoes", label: "Configurações", icon: Settings },
        { id: "auditoria", label: "Auditoria", icon: Shield },
    ];

    const actions = [
        { id: "read", label: "Ver", tooltip: "Visualizar" },
        { id: "write", label: "Editar", tooltip: "Criar/Editar" },
        { id: "delete", label: "Excluir", tooltip: "Remover" },
        { id: "approve", label: "Aprovar", tooltip: "Aprovar/Fechar" },
    ];

    const checkPermission = (moduloId: string, acaoId: string) => {
        if (currentPerms.includes("*")) return true;
        if (currentPerms.includes(`${moduloId}.*`)) return true;
        return currentPerms.includes(`${moduloId}.${acaoId}`);
    };

    const togglePermission = (moduloId: string, acaoId: string) => {
        if (selectedPerfil.nome?.toLowerCase() === "admin") return;
        const permKey = `${moduloId}.${acaoId}`;
        const wildcardKey = `${moduloId}.*`;
        let nextPerms = [...currentPerms];
        if (checkPermission(moduloId, acaoId)) {
            if (nextPerms.includes(wildcardKey)) {
                nextPerms = nextPerms.filter(p => p !== wildcardKey);
                actions.forEach(a => { if (a.id !== acaoId) nextPerms.push(`${moduloId}.${a.id}`); });
            } else {
                nextPerms = nextPerms.filter(p => p !== permKey);
            }
        } else {
            nextPerms.push(permKey);
            const moduleActions = actions.map(a => `${moduloId}.${a.id}`);
            if (moduleActions.every(ma => nextPerms.includes(ma))) {
                nextPerms = nextPerms.filter(p => !moduleActions.includes(p));
                nextPerms.push(wildcardKey);
            }
        }
        setCurrentPerms(nextPerms);
    };

    const handleSave = () => {
        if (!selectedPerfil) return;
        mutationSave.mutate({ id: selectedPerfil.id, payload: { permissoes: currentPerms, updated_at: new Date().toISOString() } });
    };

    const isAdmin = selectedPerfil?.nome?.toLowerCase() === "admin";

    if (isLoading) return <AppShell title="Perfis"><div className="flex h-64 items-center justify-center animate-pulse text-muted-foreground font-medium">Carregando governança...</div></AppShell>;

    return (
        <AppShell title="Perfis" subtitle="Acesso modular">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-160px)] overflow-hidden">
                {/* Sidebar */}
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
                    <div className="esc-card p-0 flex flex-col flex-1 overflow-hidden">
                        <div className="px-4 py-3 border-b border-muted flex items-center justify-between bg-muted/10 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Perfis</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setIsCreateModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-muted">
                            {perfis.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPerfil(p)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 hover:bg-muted/30 transition-all flex items-center justify-between group",
                                        selectedPerfil?.id === p.id && "bg-primary/[0.03]"
                                    )}
                                >
                                    <div className="min-w-0 pr-2">
                                        <div className={cn("text-sm font-bold truncate", selectedPerfil?.id === p.id ? "text-primary" : "text-foreground")}>{p.nome} {p.nome?.toLowerCase() === "admin" && "🔒"}</div>
                                        <div className="text-[10px] text-muted-foreground truncate font-medium opacity-60">{p.descricao || "Perfil padrão"}</div>
                                    </div>
                                    <ShieldCheck className={cn("h-4 w-4 shrink-0 transition-opacity", selectedPerfil?.id === p.id ? "opacity-100 text-primary" : "opacity-0")} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedPerfil && !isAdmin && (
                        <div className="p-4 border border-destructive/10 bg-destructive/[0.02] rounded-xl shrink-0">
                            <Button variant="ghost" size="sm" className="w-full text-destructive text-[10px] font-bold h-8 hover:bg-destructive/10" onClick={() => confirm(`Excluir "${selectedPerfil.nome}"?`) && mutationDelete.mutate(selectedPerfil.id)}>
                                <Trash2 className="h-3 w-3 mr-2" /> Excluir Perfil
                            </Button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="lg:col-span-9 flex flex-col overflow-hidden">
                    {selectedPerfil ? (
                        <div className="esc-card p-0 flex flex-col flex-1 overflow-hidden border-primary/10 shadow-lg">
                            <div className="px-5 py-4 border-b border-muted flex items-center justify-between bg-muted/5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                                        <Shield className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-lg tracking-tight truncate">{selectedPerfil.nome}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{isAdmin ? "Root Access" : "Granular access"}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={handleSave} disabled={mutationSave.isPending || isAdmin} size="sm" className="h-9 px-4 rounded-lg bg-primary font-bold text-xs shadow-md shadow-primary/20">
                                    {mutationSave.isPending ? "..." : <Save className="h-3.5 w-3.5 mr-2" />}
                                    {mutationSave.isPending ? "Salvando..." : "Salvar"}
                                </Button>
                            </div>

                            <div className="flex-1 overflow-auto scrollbar-thin">
                                <table className="w-full border-collapse border-b border-muted">
                                    <thead className="bg-muted/30 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 h-10 text-left font-black text-[9px] uppercase tracking-widest text-muted-foreground border-b border-muted">Módulo</th>
                                            {actions.map(a => (
                                                <th key={a.id} className="px-2 h-10 text-center border-b border-muted">
                                                    <span className="font-black text-[9px] uppercase tracking-widest text-muted-foreground">{a.label}</span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-muted">
                                        {modules.map((m) => {
                                            const Icon = m.icon;
                                            return (
                                                <tr key={m.id} className="group hover:bg-muted/10 transition-colors">
                                                    <td className="px-6 h-12">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-7 w-7 rounded-md bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                                                                <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                            </div>
                                                            <span className="font-bold text-xs truncate group-hover:text-primary transition-colors">{m.label}</span>
                                                        </div>
                                                    </td>
                                                    {actions.map(a => {
                                                        const has = checkPermission(m.id, a.id);
                                                        return (
                                                            <td key={a.id} className="px-2 h-12 text-center">
                                                                <button
                                                                    onClick={() => togglePermission(m.id, a.id)}
                                                                    disabled={isAdmin}
                                                                    className={cn(
                                                                        "h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all border",
                                                                        has ? "bg-success text-white border-success shadow-sm" : "bg-muted/20 text-muted-foreground/30 border-transparent hover:border-primary/30",
                                                                        isAdmin && "opacity-60 grayscale-[0.3] cursor-not-allowed"
                                                                    )}
                                                                >
                                                                    {has ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <X className="h-3 w-3 opacity-30" />}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {isAdmin && <div className="p-3 text-[9px] text-center font-bold uppercase tracking-widest text-primary/60 bg-primary/5 sticky bottom-0 border-t border-primary/10">Inheritance locked for Admin Profile</div>}
                            </div>
                        </div>
                    ) : (
                        <div className="esc-card flex-1 flex flex-col items-center justify-center p-12 text-center border-dashed bg-muted/5">
                            <div className="h-16 w-16 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-muted/30">
                                <Settings2 className="h-8 w-8 text-muted-foreground/20" />
                            </div>
                            <h3 className="text-lg font-black tracking-tight mb-2">Governança Orbe</h3>
                            <p className="text-[11px] text-muted-foreground max-w-[240px] font-medium opacity-60">Selecione um perfil para configurar privilégios de acesso aos módulos do sistema.</p>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="p-6 space-y-6">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-xl font-black tracking-tight">Novo Perfil</DialogTitle>
                            <DialogDescription className="text-xs font-medium">Defina o nome e escopo do novo grupo.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); mutationCreate.mutate(newProfile); }} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Nome</Label>
                                <Input value={newProfile.nome} className="h-10 rounded-xl" onChange={e => setNewProfile({ ...newProfile, nome: e.target.value })} required placeholder="ex: Supervisor Regional" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Descrição</Label>
                                <Input value={newProfile.descricao} className="h-10 rounded-xl" onChange={e => setNewProfile({ ...newProfile, descricao: e.target.value })} placeholder="ex: Gestão de colaboradores campo" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={mutationCreate.isPending} size="sm" className="px-6 rounded-lg font-bold">Criar</Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default PerfisPermissoes;
