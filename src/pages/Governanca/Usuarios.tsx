import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { UserPlus, RefreshCw, Loader2, Shield } from "lucide-react";
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

    const { data: usuarios = [], isLoading } = useQuery({
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

    const [form, setForm] = useState({
        user_id: "", // No MVP, isso viria de uma lista de usuários do Auth ou input manual
        perfil_id: "",
        empresa_id: "",
        status: "ativo" as "ativo" | "inativo",
    });

    const createMutation = useMutation({
        mutationFn: (payload: any) => UserProfileService.create(payload),
        onSuccess: () => {
            toast.success("Vínculo de usuário criado");
            queryClient.invalidateQueries({ queryKey: ["users_profiles"] });
            setOpen(false);
        },
    });

    return (
        <AppShell title="Gestão de Usuários" subtitle="Controle quem pode acessar cada módulo e empresa">
            <div className="space-y-4">
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["users_profiles"] })}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={() => setOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-1.5" /> Vincular Usuário
                    </Button>
                </div>

                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Usuário (ID)</th>
                                    <th className="px-3 h-11 font-medium">Perfil</th>
                                    <th className="px-3 h-11 font-medium">Empresa/Unidade</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u: any) => (
                                    <tr key={u.id} className="border-t border-muted hover:bg-background">
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
                                        <td className="px-5 text-center">
                                            <StatusChip status={u.status === 'ativo' ? 'ok' : 'inconsistente'} label={u.status} />
                                        </td>
                                        <td className="px-5 text-right">
                                            <Button variant="ghost" size="sm">Editar</Button>
                                        </td>
                                    </tr>
                                ))}
                                {usuarios.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                                            Nenhum usuário vinculado ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Vincular Perfil a Usuário</DialogTitle>
                        <DialogDescription>Associe um ID de usuário a um perfil de acesso e empresa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label>UUID do Usuário (Auth)</Label>
                            <Input placeholder="00000000-0000-0000-0000-000000000000" onChange={(e) => setForm({ ...form, user_id: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Perfil</Label>
                                <Select onValueChange={(v) => setForm({ ...form, perfil_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {perfis.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Empresa (Opcional)</Label>
                                <Select onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={() => createMutation.mutate(form)}>Salvar Vínculo</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default UsuariosGestao;
