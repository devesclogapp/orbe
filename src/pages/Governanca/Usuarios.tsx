import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { UserPlus, RefreshCw, Loader2, Shield, Pencil, Trash2, LayoutGrid, List } from "lucide-react";
import { UserProfileService, ProfileService } from "@/services/v4.service";
import { EmpresaService } from "@/services/base.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UsuariosGestao = () => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    const { data: usuarios = [], isLoading, isFetching } = useQuery({
        queryKey: ["users_profiles"],
        queryFn: () => UserProfileService.getWithDetails(),
    });

    const { data: perfis = [] } = useQuery({
        queryKey: ["perfis"],
        queryFn: () => ProfileService.getAll(),
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        user_id: "",
        perfil_id: "",
        empresa_id: "",
        status: "ativo" as "ativo" | "inativo",
        codigo_acesso: "",
        is_new_user: false,
        email: "",
        password: "",
    });

    const reset = () => {
        setForm({ user_id: "", perfil_id: "", empresa_id: "", status: "ativo", codigo_acesso: "", is_new_user: false, email: "", password: "" });
        setEditingId(null);
    };

    const createMutation = useMutation({
        mutationFn: (payload: any) => {
            if (payload.is_new_user) {
                return UserProfileService.manageUser({
                    action: 'create',
                    ...payload
                });
            }
            return editingId
                ? UserProfileService.update(editingId, payload)
                : UserProfileService.create(payload);
        },
        onSuccess: () => {
            toast.success(editingId ? "Vínculo atualizado" : (form.is_new_user ? "Usuário criado e vinculado" : "Vínculo de usuário criado"));
            queryClient.invalidateQueries({ queryKey: ["users_profiles"] });
            setOpen(false);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err.message })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => UserProfileService.delete(id),
        onSuccess: () => {
            toast.success("Vínculo removido");
            queryClient.invalidateQueries({ queryKey: ["users_profiles"] });
        },
        onError: (err: any) => toast.error("Erro ao remover", { description: err.message })
    });

    const handleEdit = (u: any) => {
        setEditingId(u.id);
        setForm({
            user_id: u.user_id,
            perfil_id: u.perfil_id,
            empresa_id: u.empresa_id || "",
            status: u.status,
            codigo_acesso: u.codigo_acesso || "",
            is_new_user: false,
            email: "",
            password: "",
        });
        setOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("Remover este vínculo de usuário?")) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <AppShell title="Gestão de Usuários" subtitle="Controle quem pode acessar cada módulo e empresa">
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-background p-2 rounded-lg border border-border/50">
                    <div className="flex border rounded-lg overflow-hidden bg-background">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-9 w-9 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-9 w-9 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                            onClick={() => setViewMode('table')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => queryClient.invalidateQueries({ queryKey: ["users_profiles"] })}>
                            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                        </Button>
                        <Button className="h-9 px-4 font-display font-semibold text-sm" onClick={() => setOpen(true)}>
                            <UserPlus className="h-4 w-4 mr-1.5" /> Vincular Usuário
                        </Button>
                    </div>
                </div>

                <section className={cn(viewMode === 'table' ? "esc-card overflow-hidden" : "")}>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 text-center flex-col gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground animate-pulse font-medium uppercase tracking-widest">Sincronizando privilégios...</p>
                        </div>
                    ) : viewMode === 'table' ? (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Usuário (ID)</th>
                                    <th className="px-3 h-11 font-medium">Perfil</th>
                                    <th className="px-3 h-11 font-medium">Empresa/Unidade</th>
                                    <th className="px-3 h-11 font-medium">Código</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u: any) => (
                                    <tr key={u.id} className="border-t border-muted hover:bg-background group">
                                        <td className="px-5 h-[52px]">
                                            <div className="font-medium text-foreground truncate w-40">{u.user_id}</div>
                                        </td>
                                        <td className="px-3">
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-3 w-3 text-primary" />
                                                <span className="text-muted-foreground">{(u.perfis as any)?.nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 text-muted-foreground">{(u.empresas as any)?.nome || "Acesso Global"}</td>
                                        <td className="px-3 font-mono text-xs text-primary">{u.codigo_acesso || "---"}</td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={u.status === 'ativo' ? 'ok' : 'inconsistente'} label={u.status} />
                                        </td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(u)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {usuarios.map((u: any) => (
                                <article key={u.id} className="esc-card p-5 group flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                                                <Shield className="h-5 w-5" />
                                            </div>
                                            <StatusChip status={u.status === 'ativo' ? 'ok' : 'inconsistente'} label={u.status} />
                                        </div>
                                        <h3 className="font-display font-bold text-foreground mb-1 line-clamp-1" title={u.user_id}>{u.user_id}</h3>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            <span className="font-semibold uppercase text-primary">{(u.perfis as any)?.nome}</span>
                                            <span className="opacity-30">|</span>
                                            <span>{(u.empresas as any)?.nome || "Acesso Global"}</span>
                                            {u.codigo_acesso && (
                                                <>
                                                    <span className="opacity-30">|</span>
                                                    <span className="font-mono text-primary">{u.codigo_acesso}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="mt-6 flex justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all border-t pt-3">
                                        <Button variant="ghost" size="sm" className="h-8" onClick={() => handleEdit(u)}>Editar</Button>
                                        <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => handleDelete(u.id)}>Remover</Button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar Vínculo" : "Vincular Perfil a Usuário"}</DialogTitle>
                        <DialogDescription>
                            {editingId ? "Atualize o perfil e empresa associados a este usuário." : "Associe um ID de usuário a um perfil de acesso e empresa."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border/50">
                            <div className="space-y-0.5">
                                <Label className="text-sm">Novo Usuário?</Label>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Criar conta no Supabase Auth</p>
                            </div>
                            <Button
                                variant={form.is_new_user ? "default" : "outline"}
                                size="sm"
                                onClick={() => setForm({ ...form, is_new_user: !form.is_new_user })}
                                disabled={!!editingId}
                                className="h-7 text-[10px] font-bold"
                            >
                                {form.is_new_user ? "CRIAR NOVO" : "VINCULAR EXISTENTE"}
                            </Button>
                        </div>

                        {!form.is_new_user ? (
                            <div className="space-y-1.5">
                                <Label>UUID do Usuário (Auth)</Label>
                                <Input
                                    placeholder="00000000-0000-0000-0000-000000000000"
                                    value={form.user_id}
                                    onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                                    disabled={!!editingId}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>E-mail</Label>
                                    <Input
                                        placeholder="email@exemplo.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Senha Temporária</Label>
                                    <Input
                                        type="password"
                                        placeholder="******"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Perfil</Label>
                                <Select value={form.perfil_id} onValueChange={(v) => setForm({ ...form, perfil_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {perfis.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Empresa (Opcional)</Label>
                                <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Acesso Global</SelectItem>
                                        {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={(v: "ativo" | "inativo") => setForm({ ...form, status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ativo">Ativo</SelectItem>
                                        <SelectItem value="inativo">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Código de Acesso (Login)</Label>
                                <Input
                                    placeholder="Ex: OP-01"
                                    value={form.codigo_acesso}
                                    onChange={(e) => setForm({ ...form, codigo_acesso: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
                        <Button onClick={() => createMutation.mutate({
                            ...form,
                            empresa_id: form.empresa_id === "all" ? null : form.empresa_id
                        })} disabled={createMutation.isPending}>
                            {createMutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar Vínculo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default UsuariosGestao;
