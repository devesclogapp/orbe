import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  ACCESS_ACTIONS,
  ACCESS_MODULES,
  ACCESS_MODULE_LABELS,
  ACCESS_PRESET_OPTIONS,
  ACCESS_ROLE_LABELS,
  DEFAULT_INVITE_EXPIRATION_DAYS,
  PermissionMatrix,
  buildPresetPermissions,
  countGrantedModules,
  normalizePermissionMatrix,
  normalizeRole,
  permissionsToSummary,
} from "@/lib/access-control";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccessOverviewRow = {
  record_type: "user" | "invite";
  record_id: string;
  user_id: string | null;
  invite_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  permissions: PermissionMatrix | null;
  invited_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  last_access_at: string | null;
  token: string | null;
};

type InviteFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  preset: string;
  status: "ativo" | "bloqueado";
  expiresAt: string;
  permissions: PermissionMatrix;
};

const emptyInviteForm = (): InviteFormState => ({
  fullName: "",
  email: "",
  phone: "",
  role: "rh",
  preset: "rh",
  status: "ativo",
  expiresAt: defaultExpiryDate(),
  permissions: buildPresetPermissions("rh"),
});

function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_INVITE_EXPIRATION_DAYS);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildInviteLink(token: string) {
  return `${window.location.origin}/app/convite?token=${encodeURIComponent(token)}`;
}

function openWhatsAppShare(link: string) {
  const message = encodeURIComponent(
    `Olá! Você foi convidado para acessar o ERP Orbe.\n\nAcesse o link abaixo para criar sua conta:\n\n${link}`,
  );

  window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
}

const statusStyles: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pendente: "bg-amber-100 text-amber-800 border-amber-200",
  bloqueado: "bg-rose-100 text-rose-800 border-rose-200",
  convite_expirado: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const tableActionButtonClass =
  "h-8 rounded-full border-border/70 bg-background px-3 text-xs font-medium text-foreground shadow-none hover:border-border hover:bg-muted/50";

const UsuariosGestao = () => {
  const queryClient = useQueryClient();
  const { isAdmin, refetch: refetchAccess } = useAccessControl();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [form, setForm] = useState<InviteFormState>(emptyInviteForm);
  const [editingRow, setEditingRow] = useState<AccessOverviewRow | null>(null);
  const [generatedLink, setGeneratedLink] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin_user_access_overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc(
        "admin_list_user_access_overview",
      );

      if (error) throw error;
      return (rows || []).map((row) => ({
        ...(row as AccessOverviewRow),
        permissions: normalizePermissionMatrix(
          (row as AccessOverviewRow).permissions,
          (row as AccessOverviewRow).role,
        ),
      }));
    },
  });

  const rows = data as AccessOverviewRow[];
  const cards = useMemo(() => {
    const activeUsers = rows.filter(
      (row) => row.record_type === "user" && row.status === "ativo",
    ).length;
    const pendingInvites = rows.filter((row) => row.status === "pendente").length;
    const expiredInvites = rows.filter(
      (row) => row.status === "convite_expirado",
    ).length;
    const blockedUsers = rows.filter((row) => row.status === "bloqueado").length;

    return { activeUsers, pendingInvites, expiredInvites, blockedUsers };
  }, [rows]);

  const createInviteMutation = useMutation({
    mutationFn: async (payload: InviteFormState) => {
      const { data: invite, error } = await supabase.rpc(
        "admin_create_tenant_invitation",
        {
          p_full_name: payload.fullName,
          p_email: payload.email,
          p_phone: payload.phone || null,
          p_role: payload.role,
          p_permissions: payload.permissions,
          p_expires_at: new Date(`${payload.expiresAt}T23:59:59`).toISOString(),
        },
      );

      if (error) throw error;
      return invite as { token: string };
    },
    onSuccess: async (invite) => {
      const link = buildInviteLink(invite.token);
      setGeneratedLink(link);
      setResultOpen(true);
      setDialogOpen(false);
      setEditingRow(null);
      setForm(emptyInviteForm());
      await queryClient.invalidateQueries({ queryKey: ["admin_user_access_overview"] });
      toast.success("Convite criado com sucesso.");
    },
    onError: (error: Error) => {
      toast.error("Não foi possível gerar o convite.", {
        description: error.message,
      });
    },
  });

  const updateInviteMutation = useMutation({
    mutationFn: async (payload: InviteFormState) => {
      if (!editingRow?.invite_id) {
        throw new Error("Convite não encontrado para edição.");
      }

      const { data: invite, error } = await supabase.rpc(
        "update_tenant_invitation",
        {
          p_invitation_id: editingRow.invite_id,
          p_full_name: payload.fullName,
          p_email: payload.email,
          p_phone: payload.phone || null,
          p_role: payload.role,
          p_permissions: payload.permissions,
          p_expires_at: new Date(`${payload.expiresAt}T23:59:59`).toISOString(),
        },
      );

      if (error) throw error;
      return invite;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin_user_access_overview"] });
      setDialogOpen(false);
      setEditingRow(null);
      setForm(emptyInviteForm());
      toast.success("Convite atualizado com sucesso.");
    },
    onError: (error: Error) => {
      toast.error("Não foi possível atualizar o convite.", {
        description: error.message,
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: InviteFormState) => {
      if (!editingRow?.user_id) {
        throw new Error("Usuário não encontrado para edição.");
      }

      const { error } = await supabase.rpc("admin_update_user_access", {
        p_user_id: editingRow.user_id,
        p_role: payload.role,
        p_status: payload.status,
        p_permissions: payload.permissions,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin_user_access_overview"] }),
        refetchAccess(),
      ]);
      setDialogOpen(false);
      setEditingRow(null);
      setForm(emptyInviteForm());
      toast.success("Permissões atualizadas com sucesso.");
    },
    onError: (error: Error) => {
      toast.error("Não foi possível atualizar o acesso.", {
        description: error.message,
      });
    },
  });

  const renewInviteMutation = useMutation({
    mutationFn: async (row: AccessOverviewRow) => {
      if (!row.invite_id) {
        throw new Error("Convite inválido para reenvio.");
      }

      const { data: invite, error } = await supabase.rpc(
        "admin_renew_tenant_invitation",
        {
          p_invitation_id: row.invite_id,
          p_expires_at: new Date(
            `${defaultExpiryDate()}T23:59:59`,
          ).toISOString(),
        },
      );

      if (error) throw error;
      return invite as { token: string };
    },
    onSuccess: async (invite) => {
      const link = buildInviteLink(invite.token);
      setGeneratedLink(link);
      setResultOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["admin_user_access_overview"] });
      toast.success("Convite renovado com sucesso.");
    },
    onError: (error: Error) => {
      toast.error("Não foi possível reenviar o convite.", {
        description: error.message,
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("tenant_invitations")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin_user_access_overview"] });
      toast.success("Convite excluído.");
    },
    onError: (error: Error) => {
      toast.error("Não foi possível excluir o convite.", {
        description: error.message,
      });
    },
  });

  const handleOpenNewInvite = () => {
    setEditingRow(null);
    setForm(emptyInviteForm());
    setDialogOpen(true);
  };

  const handleEdit = (row: AccessOverviewRow) => {
    const normalizedRole = normalizeRole(row.role);
    setEditingRow(row);
    setForm({
      fullName: row.full_name || "",
      email: row.email,
      phone: row.phone || "",
      role: normalizedRole,
      preset: normalizedRole,
      status: row.status === "bloqueado" ? "bloqueado" : "ativo",
      expiresAt: row.expires_at ? row.expires_at.slice(0, 10) : defaultExpiryDate(),
      permissions: normalizePermissionMatrix(row.permissions, normalizedRole),
    });
    setDialogOpen(true);
  };

  const handleCopyInviteLink = async (row: AccessOverviewRow) => {
    const token = row.token;
    if (!token) {
      toast.error("Este registro não possui link de convite.");
      return;
    }

    await navigator.clipboard.writeText(buildInviteLink(token));
    toast.success("Link copiado.");
  };

  const handleToggleUserStatus = async (row: AccessOverviewRow) => {
    const nextStatus = row.status === "bloqueado" ? "ativo" : "bloqueado";
    const confirmed = window.confirm(
      nextStatus === "bloqueado"
        ? `Bloquear o acesso de ${row.full_name || row.email}?`
        : `Reativar o acesso de ${row.full_name || row.email}?`,
    );

    if (!confirmed) {
      return;
    }

    await updateUserMutation.mutateAsync({
      fullName: row.full_name || "",
      email: row.email,
      phone: row.phone || "",
      role: normalizeRole(row.role),
      preset: normalizeRole(row.role),
      status: nextStatus,
      expiresAt: defaultExpiryDate(),
      permissions: normalizePermissionMatrix(row.permissions, row.role),
    });
  };

  const handleSubmit = async () => {
    if (!form.email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    if (!form.role) {
      toast.error("Selecione uma função.");
      return;
    }

    if (!form.expiresAt && editingRow?.record_type === "invite") {
      toast.error("Defina a validade do convite.");
      return;
    }

    if (editingRow?.record_type === "user") {
      await updateUserMutation.mutateAsync(form);
      return;
    }

    if (editingRow?.record_type === "invite") {
      await updateInviteMutation.mutateAsync(form);
      return;
    }

    await createInviteMutation.mutateAsync(form);
  };

  const applyPreset = (role: string) => {
    const normalizedRole = normalizeRole(role);
    setForm((current) => ({
      ...current,
      preset: normalizedRole,
      permissions: buildPresetPermissions(normalizedRole),
    }));
  };

  const updatePermission = (
    moduleId: (typeof ACCESS_MODULES)[number],
    action: (typeof ACCESS_ACTIONS)[number],
    checked: boolean,
  ) => {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleId]: {
          ...(current.permissions[moduleId] || {}),
          [action]: checked,
        },
      },
    }));
  };

  if (!isAdmin) {
    return (
      <AppShell
        title="Gestão de Usuários e Acessos"
        subtitle="Convide usuários, defina funções e controle permissões do ERP."
      >
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <Shield className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              Acesso restrito
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesso restrito ao administrador da conta.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Gestão de Usuários e Acessos"
      subtitle="Convide usuários, defina funções e controle permissões do ERP."
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Administração da Conta
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Fluxo multi-tenant controlado pelo admin
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Apenas o administrador gera convites, define função, controla permissões por módulo e mantém todos os usuários vinculados ao mesmo tenant.
              </p>
            </div>
            <Button onClick={handleOpenNewInvite} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo convite
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Usuários ativos"
            value={cards.activeUsers}
            icon={UserCheck}
            tone="emerald"
          />
          <StatCard
            title="Convites pendentes"
            value={cards.pendingInvites}
            icon={Mail}
            tone="amber"
          />
          <StatCard
            title="Convites expirados"
            value={cards.expiredInvites}
            icon={AlertCircle}
            tone="zinc"
          />
          <StatCard
            title="Usuários bloqueados"
            value={cards.blockedUsers}
            icon={UserX}
            tone="rose"
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Usuários vinculados e convites
              </h3>
              <p className="text-sm text-muted-foreground">
                Todos os registros abaixo pertencem ao mesmo tenant do admin logado.
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["admin_user_access_overview"],
                })
              }
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium text-muted-foreground">
                    Usuário
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    E-mail
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Função
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Permissões
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Convite
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Último acesso
                  </th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Carregando gestão de acessos...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum usuário vinculado ou convite encontrado para este tenant.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const summary = permissionsToSummary(row.permissions);
                    const permissionCount = countGrantedModules(row.permissions);
                    const isInvite = row.record_type === "invite";

                    return (
                      <tr key={row.record_id} className="border-t border-border align-top">
                        <td className="px-5 py-4">
                          <div className="font-medium text-foreground">
                            {row.full_name || "Usuário sem nome"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {isInvite ? "Convite aguardando aceite" : "Vínculo ativo no tenant"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {row.email}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline">
                            {ACCESS_ROLE_LABELS[normalizeRole(row.role)]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                              statusStyles[row.status] || statusStyles.pendente,
                            )}
                          >
                            {row.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-foreground">
                            {permissionCount} módulo(s)
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {summary.length > 0 ? summary.join(", ") : "Sem acesso liberado"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <div>Enviado: {formatDateTime(row.invited_at)}</div>
                          <div>Aceite: {formatDateTime(row.accepted_at)}</div>
                          {row.expires_at ? (
                            <div>Expira: {formatDateTime(row.expires_at)}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {formatDateTime(row.last_access_at)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {isInvite ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn("gap-1.5", tableActionButtonClass)}
                                  onClick={() => handleCopyInviteLink(row)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copiar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn("gap-1.5", tableActionButtonClass)}
                                  onClick={() => renewInviteMutation.mutate(row)}
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Reenviar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn("gap-1.5", tableActionButtonClass)}
                                  onClick={() => handleEdit(row)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    tableActionButtonClass,
                                    "gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
                                  )}
                                  onClick={() => {
                                    if (!row.invite_id) return;
                                    const confirmed = window.confirm(
                                      `Excluir o convite pendente de ${row.email}?`,
                                    );
                                    if (confirmed) {
                                      deleteInviteMutation.mutate(row.invite_id);
                                    }
                                  }}
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  Excluir
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn("gap-1.5", tableActionButtonClass)}
                                  onClick={() => handleEdit(row)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    tableActionButtonClass,
                                    row.status === "bloqueado"
                                      ? "gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                      : "gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
                                  )}
                                  onClick={() => handleToggleUserStatus(row)}
                                >
                                  {row.status === "bloqueado" ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      Reativar
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-3.5 w-3.5" />
                                      Bloquear
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editingRow
                ? editingRow.record_type === "invite"
                  ? "Editar convite"
                  : "Editar permissões do usuário"
                : "Novo convite"}
            </DialogTitle>
            <DialogDescription>
              Configure função, validade e permissões granulares por módulo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.fullName}
                  disabled={editingRow?.record_type === "user"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={Boolean(editingRow)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  disabled={editingRow?.record_type === "user"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      role: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preset de permissões</Label>
                <Select value={form.preset} onValueChange={applyPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingRow?.record_type === "user" ? (
                <div className="space-y-2">
                  <Label>Status do usuário</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value: "ativo" | "bloqueado") =>
                      setForm((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Validade do convite</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expiresAt: event.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">
                      Permissões customizadas
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Ajuste o que o usuário pode ver, criar, editar, excluir e processar em cada módulo.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {countGrantedModules(form.permissions)} módulo(s)
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Módulo
                      </th>
                      {ACCESS_ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="px-2 py-3 text-center font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ACCESS_MODULES.map((moduleId) => (
                      <tr key={moduleId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {ACCESS_MODULE_LABELS[moduleId]}
                        </td>
                        {ACCESS_ACTIONS.map((action) => (
                          <td key={action} className="px-2 py-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={Boolean(form.permissions[moduleId]?.[action])}
                                onCheckedChange={(checked) =>
                                  updatePermission(moduleId, action, Boolean(checked))
                                }
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDialogOpen(false);
                setEditingRow(null);
                setForm(emptyInviteForm());
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {editingRow ? "Salvar alterações" : "Gerar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Convite pronto para envio</DialogTitle>
            <DialogDescription>
              O usuário será vinculado ao mesmo tenant do admin ao concluir o cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground">
              {generatedLink}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedLink);
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => openWhatsAppShare(generatedLink)}
              >
                <MessageCircle className="h-4 w-4" />
                Compartilhar via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: typeof UserCheck;
  tone: "emerald" | "amber" | "rose" | "zinc";
}) => {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : tone === "rose"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-zinc-50 text-zinc-700 border-zinc-200";

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={cn("rounded-2xl border p-3", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

export default UsuariosGestao;
