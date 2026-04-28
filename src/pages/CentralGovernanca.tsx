import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  History,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { StatusChip } from "@/components/painel/StatusChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuditoriaService, ProfileService, UserProfileService } from "@/services/v4.service";

const CentralGovernanca = () => {
  const navigate = useNavigate();

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery<any[]>({
    queryKey: ["users_profiles"],
    queryFn: () => UserProfileService.getWithDetails(),
  });

  const { data: perfis = [], isLoading: loadingPerfis } = useQuery<any[]>({
    queryKey: ["perfis"],
    queryFn: () => ProfileService.getAll(),
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery<any[]>({
    queryKey: ["auditoria_logs"],
    queryFn: () => AuditoriaService.getAll(),
  });

  const loading = loadingUsuarios || loadingPerfis || loadingLogs;

  const activeUsers = usuarios.filter((usuario) => usuario.status === "ativo").length;
  const globalAccessUsers = usuarios.filter((usuario) => !usuario.empresa_id).length;
  const criticalLogs = logs.filter((log) => log.impacto === "critico").length;

  const recentLogs = useMemo(() => logs.slice(0, 6), [logs]);

  return (
    <AppShell
      title="Central de Governança"
      subtitle="Acessos, permissões e auditoria no mesmo contexto administrativo"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Rastreabilidade completa</h2>
              <p className="text-sm text-muted-foreground">
                Veja quem acessa, quais perfis existem e quais ações sensíveis aconteceram recentemente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/governanca/usuarios")}>
                <Users className="h-4 w-4 mr-2" />
                Usuários
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/governanca/perfis")}>
                <Shield className="h-4 w-4 mr-2" />
                Perfis
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/governanca/auditoria")}>
                <History className="h-4 w-4 mr-2" />
                Auditoria
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center p-20 esc-card">
            <History className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard label="Usuários vinculados" value={usuarios.length.toString()} icon={Users} />
              <MetricCard label="Usuários ativos" value={activeUsers.toString()} icon={UserCheck} />
              <MetricCard label="Perfis" value={perfis.length.toString()} icon={ShieldCheck} />
              <MetricCard label="Acesso global" value={globalAccessUsers.toString()} icon={Lock} />
              <MetricCard label="Eventos críticos" value={criticalLogs.toString()} icon={AlertTriangle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Usuários e perfis</h2>
                    <p className="text-sm text-muted-foreground">Visão rápida de vínculo, perfil e escopo de acesso.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/governanca/usuarios")}>
                    Gestão completa <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="esc-table-header">
                    <tr className="text-left">
                      <th className="px-5 h-11 font-medium">Usuário</th>
                      <th className="px-3 h-11 font-medium">Perfil</th>
                      <th className="px-3 h-11 font-medium">Empresa</th>
                      <th className="px-5 h-11 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.slice(0, 6).map((usuario) => (
                      <tr key={usuario.id} className="border-t border-muted hover:bg-background">
                        <td className="px-5 h-[56px]">
                          <div className="font-medium text-foreground truncate max-w-[220px]">{usuario.user_id}</div>
                          <div className="text-xs text-muted-foreground">{usuario.codigo_acesso || "Sem código"}</div>
                        </td>
                        <td className="px-3 text-muted-foreground">{usuario.perfis?.nome}</td>
                        <td className="px-3 text-muted-foreground">{usuario.empresas?.nome || "Acesso Global"}</td>
                        <td className="px-5 text-center">
                          <StatusChip status={usuario.status === "ativo" ? "ok" : "inconsistente"} label={usuario.status} />
                        </td>
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                          Nenhum usuário vinculado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Perfis e abrangência</h2>
                    <p className="text-sm text-muted-foreground">Entenda o desenho de acesso e o potencial de impacto.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/governanca/perfis")}>
                    Abrir matriz <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <div className="p-5 space-y-3">
                  {perfis.slice(0, 6).map((perfil) => {
                    const impactedUsers = usuarios.filter((usuario) => usuario.perfil_id === perfil.id).length;
                    const perms = Array.isArray(perfil.permissoes) ? perfil.permissoes.length : 0;
                    return (
                      <article key={perfil.id} className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-foreground">{perfil.nome}</div>
                          <div className="text-xs text-muted-foreground">{perfil.descricao || "Perfil padrão do sistema"}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge variant="outline">{impactedUsers} usuário(s)</Badge>
                          <span className={cn("font-semibold", perms > 10 ? "text-primary" : "text-muted-foreground")}>
                            {perms} permissões
                          </span>
                        </div>
                      </article>
                    );
                  })}
                  {perfis.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic border border-dashed rounded-xl">
                      Nenhum perfil encontrado.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="esc-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-foreground">Auditoria recente</h2>
                  <p className="text-sm text-muted-foreground">Últimas ações sensíveis para revisão imediata.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/governanca/auditoria")}>
                  Ver trilha completa <Eye className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="esc-table-header">
                  <tr className="text-left">
                    <th className="px-5 h-11 font-medium">Data / hora</th>
                    <th className="px-3 h-11 font-medium">Usuário</th>
                    <th className="px-3 h-11 font-medium">Ação</th>
                    <th className="px-3 h-11 font-medium text-center">Módulo</th>
                    <th className="px-5 h-11 font-medium text-center">Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[56px]">
                        <div className="font-medium text-foreground">
                          {new Date(log.created_at).toLocaleDateString("pt-BR")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString("pt-BR")}
                        </div>
                      </td>
                      <td className="px-3 text-muted-foreground">{log.user_id || "Sistema"}</td>
                      <td className="px-3 text-foreground">{log.acao}</td>
                      <td className="px-3 text-center">
                        <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
                          {log.modulo}
                        </span>
                      </td>
                      <td className="px-5 text-center">
                        <Badge
                          className={
                            log.impacto === "critico"
                              ? "bg-destructive-soft text-destructive-strong"
                              : log.impacto === "medio"
                                ? "bg-warning-soft text-warning-strong"
                                : "bg-info-soft text-info-strong"
                          }
                        >
                          {log.impacto}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {recentLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                        Nenhum log recente encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CentralGovernanca;
