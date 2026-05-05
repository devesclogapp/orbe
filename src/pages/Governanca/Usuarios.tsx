import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import {
    UserPlus, RefreshCw, Loader2, Shield, Trash2, LayoutGrid, List,
    Mail, Copy, Check, Send, Clock, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Invitation {
    id: string;
    email: string;
    role: string;
    token: string;
    accepted_at: string | null;
    expires_at: string;
    created_at: string;
    invited_by: string;
}

interface InviteForm {
    email: string;
    role: string;
}

interface ConviteLink {
    token: string;
    email: string;
    link: string;
}

// ─── Serviço de Convites ──────────────────────────────────────────────────────

const InvitationService = {
    async getAll(tenantId: string): Promise<Invitation[]> {
        const { data, error } = await supabase
            .from("tenant_invitations")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async create(payload: { email: string; role: string; tenant_id: string; invited_by: string }) {
        const { data, error } = await supabase
            .from("tenant_invitations")
            .insert(payload)
            .select("token, email")
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from("tenant_invitations")
            .delete()
            .eq("id", id);
        if (error) throw error;
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRoleLabel = (role: string) => {
    const map: Record<string, string> = {
        admin: "Administrador",
        rh: "RH",
        financeiro: "Financeiro",
        encarregado: "Encarregado",
        user: "Usuário",
    };
    return map[role] ?? role;
};

const getInviteStatus = (inv: Invitation): { label: string; variant: 'ok' | 'alerta' | 'inconsistente' | 'pendente'; icon: React.ElementType } => {
    if (inv.accepted_at) return { label: "Aceito", variant: "ok", icon: CheckCircle2 };
    if (new Date(inv.expires_at) < new Date()) return { label: "Expirado", variant: "inconsistente", icon: XCircle };
    return { label: "Pendente", variant: "pendente", icon: Clock };
};

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Componente Principal ─────────────────────────────────────────────────────

const UsuariosGestao = () => {
    const queryClient = useQueryClient();
    const { tenantId } = useTenant();

    // Modal de convite
    const [open, setOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Modal de link gerado
    const [conviteLink, setConviteLink] = useState<ConviteLink | null>(null);
    const [copied, setCopied] = useState(false);

    const [form, setForm] = useState<InviteForm>({ email: "", role: "" });

    // ── Queries ────────────────────────────────────────────────────────────────

    const { data: convites = [], isLoading, isFetching } = useQuery({
        queryKey: ["tenant_invitations", tenantId],
        queryFn: () => tenantId ? InvitationService.getAll(tenantId) : Promise.resolve([]),
        enabled: !!tenantId,
    });

    // ── Mutations ──────────────────────────────────────────────────────────────

    const inviteMutation = useMutation({
        mutationFn: async (payload: InviteForm) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado.");
            if (!tenantId) throw new Error("Tenant não identificado.");

            return InvitationService.create({
                email: payload.email.trim().toLowerCase(),
                role: payload.role,
                tenant_id: tenantId,
                invited_by: user.id,
            });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["tenant_invitations"] });
            const link = `${window.location.origin}/invite?token=${data.token}`;
            setConviteLink({ token: data.token, email: data.email, link });
            setOpen(false);
            resetForm();
            toast.success("Convite gerado com sucesso!");
        },
        onError: (err: any) => toast.error("Erro ao gerar convite", { description: err.message }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => InvitationService.delete(id),
        onSuccess: () => {
            toast.success("Convite removido");
            queryClient.invalidateQueries({ queryKey: ["tenant_invitations"] });
        },
        onError: (err: any) => toast.error("Erro ao remover", { description: err.message }),
    });

    // ── Handlers ───────────────────────────────────────────────────────────────

    const resetForm = () => setForm({ email: "", role: "" });

    const handleGerar = () => {
        if (!form.email || !form.email.includes("@")) {
            toast.error("Informe um e-mail válido.");
            return;
        }
        if (!form.role) {
            toast.error("Selecione um perfil de acesso.");
            return;
        }
        inviteMutation.mutate(form);
    };

    const handleCopiarLink = async () => {
        if (!conviteLink) return;
        await navigator.clipboard.writeText(conviteLink.link);
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        if (!conviteLink) return;
        const mensagem = encodeURIComponent(
            `Olá! Você foi convidado para acessar o ERP Orbe. Clique no link para criar sua conta e entrar no sistema: ${conviteLink.link}`
        );
        window.open(`https://wa.me/?text=${mensagem}`, "_blank");
    };

    const handleDelete = (id: string) => {
        if (confirm("Revogar este convite?")) {
            deleteMutation.mutate(id);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <AppShell title="Gestão de Usuários" subtitle="Convide membros para o seu tenant via link seguro">
            <div className="space-y-4">

                {/* Toolbar */}
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
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["tenant_invitations"] })}
                        >
                            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                        </Button>
                        <Button
                            className="h-9 px-4 font-display font-semibold text-sm"
                            onClick={() => setOpen(true)}
                        >
                            <UserPlus className="h-4 w-4 mr-1.5" /> Gerar Convite
                        </Button>
                    </div>
                </div>

                {/* Lista de convites */}
                <section className={cn(viewMode === 'table' ? "esc-card overflow-hidden" : "")}>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 text-center flex-col gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground animate-pulse font-medium uppercase tracking-widest">Carregando convites...</p>
                        </div>
                    ) : convites.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                                <Mail className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">Nenhum convite gerado</p>
                            <p className="text-xs text-muted-foreground max-w-xs">Clique em "Gerar Convite" para convidar um novo membro para o seu tenant.</p>
                        </div>
                    ) : viewMode === 'table' ? (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">E-mail Convidado</th>
                                    <th className="px-3 h-11 font-medium">Perfil</th>
                                    <th className="px-3 h-11 font-medium">Gerado em</th>
                                    <th className="px-3 h-11 font-medium">Expira em</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {convites.map((inv) => {
                                    const status = getInviteStatus(inv);
                                    const StatusIcon = status.icon;
                                    return (
                                        <tr key={inv.id} className="border-t border-muted hover:bg-background group">
                                            <td className="px-5 h-[52px]">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span className="font-medium text-foreground truncate max-w-[200px]">{inv.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Shield className="h-3 w-3 text-primary" />
                                                    <span className="text-muted-foreground">{getRoleLabel(inv.role)}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 text-muted-foreground text-xs">{formatDate(inv.created_at)}</td>
                                            <td className="px-3 text-muted-foreground text-xs">{formatDate(inv.expires_at)}</td>
                                            <td className="px-5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <StatusIcon className={cn("h-3.5 w-3.5",
                                                        status.variant === 'ok' ? "text-emerald-500" :
                                                            status.variant === 'inconsistente' ? "text-destructive" :
                                                                "text-amber-500"
                                                    )} />
                                                    <span className={cn("text-xs font-medium",
                                                        status.variant === 'ok' ? "text-emerald-600" :
                                                            status.variant === 'inconsistente' ? "text-destructive" :
                                                                "text-amber-600"
                                                    )}>{status.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* Recopiar link se pendente */}
                                                    {!inv.accepted_at && new Date(inv.expires_at) > new Date() && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title="Copiar link do convite"
                                                            onClick={() => {
                                                                const link = `${window.location.origin}/invite?token=${inv.token}`;
                                                                navigator.clipboard.writeText(link);
                                                                toast.success("Link copiado!");
                                                            }}
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(inv.id)}
                                                        title="Revogar convite"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {convites.map((inv) => {
                                const status = getInviteStatus(inv);
                                const StatusIcon = status.icon;
                                const isPending = !inv.accepted_at && new Date(inv.expires_at) > new Date();
                                return (
                                    <article key={inv.id} className="esc-card p-5 group flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                                                    <Mail className="h-5 w-5" />
                                                </div>
                                                <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold",
                                                    status.variant === 'ok' ? "bg-emerald-100 text-emerald-700" :
                                                        status.variant === 'inconsistente' ? "bg-red-100 text-destructive" :
                                                            "bg-amber-100 text-amber-700"
                                                )}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {status.label}
                                                </div>
                                            </div>
                                            <h3 className="font-display font-bold text-foreground mb-1 line-clamp-1 text-sm" title={inv.email}>{inv.email}</h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Shield className="h-3 w-3 text-primary" />
                                                <span className="font-semibold uppercase text-primary">{getRoleLabel(inv.role)}</span>
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-2">Expira: {formatDate(inv.expires_at)}</p>
                                        </div>
                                        <div className="mt-4 flex justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all border-t pt-3">
                                            {isPending && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1"
                                                    onClick={() => {
                                                        const link = `${window.location.origin}/invite?token=${inv.token}`;
                                                        navigator.clipboard.writeText(link);
                                                        toast.success("Link copiado!");
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" /> Copiar link
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-destructive text-xs"
                                                onClick={() => handleDelete(inv.id)}
                                            >
                                                Revogar
                                            </Button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* ── Modal: Gerar Convite ───────────────────────────────────────────── */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <UserPlus className="h-4 w-4 text-primary" />
                            </div>
                            Convidar Membro
                        </DialogTitle>
                        <DialogDescription>
                            Um link seguro será gerado para que o convidado crie sua conta e acesse o tenant.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* E-mail */}
                        <div className="space-y-1.5">
                            <Label htmlFor="invite-email">E-mail do convidado</Label>
                            <Input
                                id="invite-email"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                autoFocus
                            />
                        </div>

                        {/* Perfil/Role */}
                        <div className="space-y-1.5">
                            <Label htmlFor="invite-role">Perfil de acesso</Label>
                            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                <SelectTrigger id="invite-role">
                                    <SelectValue placeholder="Selecione um perfil" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="rh">RH</SelectItem>
                                    <SelectItem value="financeiro">Financeiro</SelectItem>
                                    <SelectItem value="encarregado">Encarregado</SelectItem>
                                    <SelectItem value="user">Usuário</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Info */}
                        <div className="flex gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                O link expira em <strong>7 dias</strong>. O convidado será vinculado automaticamente ao seu tenant ao aceitar.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                        <Button
                            onClick={handleGerar}
                            disabled={inviteMutation.isPending}
                            className="gap-2"
                        >
                            {inviteMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                            ) : (
                                <><Send className="h-4 w-4" /> Gerar Convite</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal: Link do Convite ─────────────────────────────────────────── */}
            <Dialog open={!!conviteLink} onOpenChange={(v) => { if (!v) setConviteLink(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            Convite Gerado!
                        </DialogTitle>
                        <DialogDescription>
                            Compartilhe o link abaixo com <strong>{conviteLink?.email}</strong>. Expira em 7 dias.
                        </DialogDescription>
                    </DialogHeader>

                    {conviteLink && (
                        <div className="space-y-4 py-2">
                            {/* Link */}
                            <div className="space-y-1.5">
                                <Label>Link do convite</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={conviteLink.link}
                                        className="font-mono text-xs bg-muted/50 text-muted-foreground"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className={cn("h-10 w-10 shrink-0 transition-all", copied && "bg-emerald-50 border-emerald-300 text-emerald-600")}
                                        onClick={handleCopiarLink}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="gap-2 h-11"
                                    onClick={handleCopiarLink}
                                >
                                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                    {copied ? "Copiado!" : "Copiar link"}
                                </Button>
                                <Button
                                    className="gap-2 h-11 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                                    onClick={handleWhatsApp}
                                >
                                    <Send className="h-4 w-4" />
                                    WhatsApp
                                </Button>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Mensagem WhatsApp</p>
                                <p className="text-xs text-foreground/80 leading-relaxed">
                                    Olá! Você foi convidado para acessar o ERP Orbe. Clique no link para criar sua conta e entrar no sistema: <span className="text-primary font-mono break-all">{conviteLink.link}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConviteLink(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default UsuariosGestao;
