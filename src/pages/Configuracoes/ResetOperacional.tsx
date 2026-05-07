import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { useTenant } from "@/contexts/TenantContext";
import {
  ResetOperacionalService,
  type ResetCategory,
  type ResetMode,
  type ResetPayload,
  type ResetResponse,
  type ResetTabelaAfetada,
} from "@/services/resetOperacional.service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type ResetCardConfig = {
  mode: ResetMode;
  title: string;
  description: string;
  buttonLabel: string;
  impact: string;
  severity: "default" | "danger";
  badgeLabel: string;
  defaultCategory: ResetCategory;
  previewQueryKey: string;
  previewFn: (tenantId: string) => Promise<ResetResponse>;
  executeFn: (payload: ResetPayload) => Promise<ResetResponse>;
  acknowledgementLabel: string;
  acknowledgementHint: string;
  preservationHint: string;
  snapshotAvailable?: boolean;
};

type CategoryGroup = {
  key: ResetCategory;
  label: string;
  description: string;
  total: number;
  tables: ResetTabelaAfetada[];
};

const MODE_CONFIG: ResetCardConfig[] = [
  {
    mode: "operacional",
    title: "Reset Operacional",
    description: "Remove operações, pontos e fechamentos mantendo financeiro e cadastros.",
    buttonLabel: "Limpar Produção",
    impact: "Apaga produção, banco de horas, ciclos, inconsistências e memória transitória do RH.",
    severity: "default",
    badgeLabel: "Reset seletivo",
    defaultCategory: "operacional",
    previewQueryKey: "preview-reset-operacional",
    previewFn: (tenantId) => ResetOperacionalService.previewOperacional(tenantId),
    executeFn: (payload) => ResetOperacionalService.resetOperacional(payload),
    acknowledgementLabel:
      "Confirmo que revisei o impacto, entendo a irreversibilidade operacional e quero seguir com este reset.",
    acknowledgementHint:
      "Financeiro, cadastros mestres, tenant, usuários e governança estrutural serão preservados.",
    preservationHint:
      "Preserva tenant, perfis, autenticação, permissões, empresas, regras e auditoria sistêmica.",
  },
  {
    mode: "financeiro",
    title: "Reset Financeiro",
    description: "Remove faturamento, remessas, retornos e conciliações.",
    buttonLabel: "Limpar Financeiro",
    impact: "Apaga faturas, consolidados, remessas CNAB, retornos e trilhas financeiras transitórias.",
    severity: "default",
    badgeLabel: "Reset seletivo",
    defaultCategory: "financeiro",
    previewQueryKey: "preview-reset-financeiro",
    previewFn: (tenantId) => ResetOperacionalService.previewFinanceiro(tenantId),
    executeFn: (payload) => ResetOperacionalService.resetFinanceiro(payload),
    acknowledgementLabel:
      "Confirmo que revisei o impacto, entendo a irreversibilidade financeira e quero seguir com este reset.",
    acknowledgementHint:
      "Operações, cadastros, tenant, usuários e governança estrutural serão preservados.",
    preservationHint:
      "Preserva tenant, perfis, autenticação, permissões, cadastros e auditoria sistêmica.",
  },
  {
    mode: "completo",
    title: "Reset Completo do Tenant",
    description: "Reinicia dados operacionais e financeiros preservando estrutura e usuários.",
    buttonLabel: "Reiniciar Ambiente",
    impact: "Apaga os dados operacionais e financeiros, mas mantém cadastros, regras, tenant e usuários.",
    severity: "danger",
    badgeLabel: "Destrutivo controlado",
    defaultCategory: "operacional",
    previewQueryKey: "preview-reset-completo",
    previewFn: (tenantId) => ResetOperacionalService.previewCompletoTenant(tenantId),
    executeFn: (payload) => ResetOperacionalService.resetCompletoTenant(payload),
    acknowledgementLabel:
      "Confirmo que revisei o impacto, entendo a irreversibilidade operacional e financeira e quero seguir com este reset.",
    acknowledgementHint:
      "Cadastros mestres, contas bancárias, regras, tenant, usuários e governança estrutural serão preservados.",
    preservationHint:
      "Preserva tenant, perfis, autenticação, permissões, cadastros, regras e auditoria sistêmica.",
    snapshotAvailable: true,
  },
  {
    mode: "demo",
    title: "Reset Ambiente Demo",
    description:
      "Remove completamente os dados operacionais e cadastrais preservando apenas estrutura sistêmica e usuários administrativos.",
    buttonLabel: "Resetar Demo",
    impact:
      "Apaga cadastros mestres, operações, pontos, regras operacionais, banco de horas, financeiro transacional e memória operacional.",
    severity: "danger",
    badgeLabel: "RISCO EXTREMO",
    defaultCategory: "cadastros",
    previewQueryKey: "preview-reset-demo",
    previewFn: (tenantId) => ResetOperacionalService.previewDemoEnvironment(tenantId),
    executeFn: (payload) => ResetOperacionalService.resetDemoEnvironment(payload),
    acknowledgementLabel:
      "Entendo que todos os dados operacionais e cadastrais serão apagados permanentemente.",
    acknowledgementHint:
      "Somente tenant, perfis, auth.users, permissões sistêmicas, roles, onboarding estrutural e auditoria sistêmica serão preservados.",
    preservationHint:
      "Preserva apenas tenant, perfis, autenticação, permissões sistêmicas, roles e auditoria estrutural.",
    snapshotAvailable: true,
  },
];

const CATEGORY_META: Record<ResetCategory, { label: string; description: string }> = {
  operacional: {
    label: "Operacional",
    description: "Produção, ponto, ciclos, RH, logs transitórios e memória operacional.",
  },
  financeiro: {
    label: "Financeiro",
    description: "CNAB, conciliações, faturas, lotes, consolidados e memória financeira.",
  },
  cadastros: {
    label: "Cadastros",
    description: "Cadastros mestres, contas bancárias, regras operacionais e parâmetros do tenant.",
  },
};

const formatInteger = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(Number.isFinite(value) ? value : 0);

const groupPreviewByCategory = (
  preview: ResetResponse | null,
  fallbackCategory: ResetCategory,
): CategoryGroup[] => {
  if (!preview) return [];

  const groups = new Map<ResetCategory, CategoryGroup>();

  for (const item of preview.tabelas) {
    const key = item.categoria ?? fallbackCategory;
    const meta = CATEGORY_META[key];
    const existing = groups.get(key);

    if (existing) {
      existing.total += item.registros;
      existing.tables.push(item);
      continue;
    }

    groups.set(key, {
      key,
      label: meta.label,
      description: meta.description,
      total: item.registros,
      tables: [item],
    });
  }

  return Array.from(groups.values()).sort((left, right) => right.total - left.total);
};

const buildEstimatedImpact = (groups: CategoryGroup[], totalRegistros: number, totalTabelas: number) => {
  if (totalRegistros === 0) {
    return "Nenhum registro encontrado para este escopo no tenant atual.";
  }

  const categorySummary = groups
    .map((group) => `${group.label}: ${formatInteger(group.total)}`)
    .join(" • ");

  return `${formatInteger(totalRegistros)} registro(s) distribuído(s) em ${formatInteger(totalTabelas)} tabela(s). ${categorySummary}.`;
};

const getModeIcon = (mode: ResetMode, isDanger: boolean) => {
  const iconClassName = "h-5 w-5";

  if (mode === "operacional") {
    return <RefreshCcw className={iconClassName} />;
  }

  if (mode === "financeiro") {
    return <Wallet className={iconClassName} />;
  }

  if (mode === "demo") {
    return <AlertTriangle className={iconClassName} />;
  }

  return isDanger ? <ShieldAlert className={iconClassName} /> : <RefreshCcw className={iconClassName} />;
};

const ResetOperacional = () => {
  const queryClient = useQueryClient();
  const { tenantId, tenant, role, loading } = useTenant();

  const [selectedMode, setSelectedMode] = useState<ResetMode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [snapshotBeforeReset, setSnapshotBeforeReset] = useState(false);

  const canReset = role === "admin" || role === "super_admin";

  const previewQueries = {
    operacional: useQuery({
      queryKey: [MODE_CONFIG[0].previewQueryKey, tenantId],
      queryFn: () => MODE_CONFIG[0].previewFn(tenantId!),
      enabled: !!tenantId && canReset,
    }),
    financeiro: useQuery({
      queryKey: [MODE_CONFIG[1].previewQueryKey, tenantId],
      queryFn: () => MODE_CONFIG[1].previewFn(tenantId!),
      enabled: !!tenantId && canReset,
    }),
    completo: useQuery({
      queryKey: [MODE_CONFIG[2].previewQueryKey, tenantId],
      queryFn: () => MODE_CONFIG[2].previewFn(tenantId!),
      enabled: !!tenantId && canReset,
    }),
    demo: useQuery({
      queryKey: [MODE_CONFIG[3].previewQueryKey, tenantId],
      queryFn: () => MODE_CONFIG[3].previewFn(tenantId!),
      enabled: !!tenantId && canReset,
    }),
  };

  const selectedConfig = useMemo(
    () => MODE_CONFIG.find((item) => item.mode === selectedMode) ?? null,
    [selectedMode],
  );

  const selectedPreview = selectedMode ? previewQueries[selectedMode].data ?? null : null;
  const selectedPreviewLoading = selectedMode ? previewQueries[selectedMode].isLoading : false;

  const previewGroups = useMemo(
    () => groupPreviewByCategory(selectedPreview, selectedConfig?.defaultCategory ?? "operacional"),
    [selectedConfig?.defaultCategory, selectedPreview],
  );

  const impactEstimate = useMemo(
    () =>
      buildEstimatedImpact(
        previewGroups,
        selectedPreview?.total_registros ?? 0,
        selectedPreview?.tabelas.length ?? 0,
      ),
    [previewGroups, selectedPreview?.tabelas.length, selectedPreview?.total_registros],
  );

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConfig || !tenantId) {
        throw new Error("Tenant ou modo de reset inválido.");
      }

      return selectedConfig.executeFn({
        tenantId,
        justification: justification.trim(),
        confirmationText: confirmationText.trim(),
        snapshotBeforeReset,
      });
    },
    onSuccess: async (result) => {
      toast.success(`${selectedConfig?.title ?? "Reset"} concluído`, {
        description: `${formatInteger(result.total_registros)} registro(s) removido(s) com auditoria crítica.`,
      });
      setModalOpen(false);
      setSelectedMode(null);
      setJustification("");
      setConfirmationText("");
      setAcknowledged(false);
      setSnapshotBeforeReset(false);
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error("Falha ao executar reset controlado", {
        description: error.message,
      });
    },
  });

  const openResetModal = (mode: ResetMode) => {
    setSelectedMode(mode);
    setModalOpen(true);
    setJustification("");
    setConfirmationText("");
    setAcknowledged(false);
    setSnapshotBeforeReset(false);
  };

  const isConfirmEnabled =
    !!selectedPreview &&
    acknowledged &&
    justification.trim().length >= 5 &&
    confirmationText.trim() === selectedPreview.confirmation_phrase &&
    !executeMutation.isPending;

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!tenantId) {
    return (
      <Alert className="border-warning/30 bg-warning-soft/40">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Tenant indisponível</AlertTitle>
        <AlertDescription>
          O reset controlado só pode ser executado quando o tenant atual estiver carregado.
        </AlertDescription>
      </Alert>
    );
  }

  if (!canReset) {
    return (
      <Alert className="border-destructive/30 bg-destructive/5">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso restrito</AlertTitle>
        <AlertDescription>
          Apenas usuários com perfil `admin` ou `super_admin` podem acessar a manutenção do ambiente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="esc-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Badge className="bg-warning-soft text-warning-strong">Impacto crítico</Badge>
            <div>
              <h2 className="font-display font-semibold text-foreground">Manutenção do Ambiente</h2>
              <p className="text-sm text-muted-foreground">
                Reinicialize escopos transacionais do tenant <strong>{tenant?.name ?? "atual"}</strong> preservando sempre
                tenant, perfis, autenticação, permissões e auditoria sistêmica. O nível <strong>Reset Ambiente Demo</strong>
                também remove cadastros mestres, regras operacionais e contas bancárias do tenant.
              </p>
            </div>
          </div>
          <Alert className="max-w-xl border-destructive/20 bg-destructive/5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Dupla proteção obrigatória</AlertTitle>
            <AlertDescription>
              Toda execução exige justificativa, confirmação textual exata, auditoria persistente em múltiplas trilhas e
              validação explícita do tenant.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        {MODE_CONFIG.map((config) => {
          const query = previewQueries[config.mode];
          const preview = query.data;
          const topTables = preview?.tabelas.slice(0, 4) ?? [];
          const isDanger = config.severity === "danger";
          const badgeClassName =
            config.mode === "demo"
              ? "bg-destructive text-destructive-foreground"
              : isDanger
                ? "bg-destructive/10 text-destructive"
                : "bg-info-soft text-info-strong";
          const accentClassName = isDanger ? "border-destructive/40 shadow-sm" : "border-border/60 shadow-sm";
          const iconWrapClassName = isDanger
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary";

          return (
            <Card key={config.mode} className={accentClassName}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconWrapClassName}`}>
                    {getModeIcon(config.mode, isDanger)}
                  </div>
                  <Badge className={badgeClassName}>{config.badgeLabel}</Badge>
                </div>
                <div>
                  <CardTitle>{config.title}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Registros afetados
                  </p>
                  {query.isLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculando impacto do reset...
                    </div>
                  ) : query.isError ? (
                    <p className="mt-3 text-sm text-destructive">
                      Não foi possível calcular o impacto agora.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-3xl font-display font-semibold text-foreground">
                        {formatInteger(preview?.total_registros ?? 0)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{config.impact}</p>
                    </>
                  )}
                </div>

                {topTables.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Principais tabelas
                    </p>
                    <div className="space-y-2">
                      {topTables.map((item) => (
                        <div
                          key={`${config.mode}-${item.tabela}`}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.descricao}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.tabela}
                              {item.categoria ? ` • ${CATEGORY_META[item.categoria].label}` : ""}
                            </p>
                          </div>
                          <Badge variant="secondary">{formatInteger(item.registros)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Escopo preservado
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{config.preservationHint}</p>
                </div>

                <Button
                  className="w-full"
                  variant={isDanger ? "destructive" : "default"}
                  onClick={() => openResetModal(config.mode)}
                  disabled={query.isLoading || executeMutation.isPending}
                >
                  {config.buttonLabel}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setConfirmationText("");
            setJustification("");
            setAcknowledged(false);
            setSnapshotBeforeReset(false);
          }
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 px-6 py-5">
            <DialogTitle>{selectedConfig?.title ?? "Reset controlado"}</DialogTitle>
            <DialogDescription>
              Revise o impacto, registre a justificativa executiva e confirme o comando textual exato antes de prosseguir.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedPreviewLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedPreview && selectedConfig ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <Card className="border-border/70">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tenant</p>
                      <p className="mt-2 font-medium text-foreground">{tenant?.name ?? tenantId}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total estimado</p>
                      <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                        {formatInteger(selectedPreview.total_registros)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tabelas afetadas</p>
                      <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                        {formatInteger(selectedPreview.tabelas.length)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-destructive/80">Irreversibilidade</p>
                      <p className="mt-2 font-medium text-destructive">
                        O reset é auditável, mas a remoção de dados não volta automaticamente.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/70">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">Impacto estimado</p>
                        <p className="text-sm text-muted-foreground">
                          Prévia calculada no backend antes da execução destrutiva.
                        </p>
                      </div>
                      <Badge variant="secondary">{selectedConfig.badgeLabel}</Badge>
                    </div>
                    <p className="text-sm text-foreground">{impactEstimate}</p>
                  </CardContent>
                </Card>

                {previewGroups.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {previewGroups.map((group) => (
                      <Card key={group.key} className="border-border/70">
                        <CardContent className="p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</p>
                          <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                            {formatInteger(group.total)}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  {previewGroups.map((group) => (
                    <div key={`${selectedPreview.mode}-${group.key}`} className="rounded-xl border border-border/70">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{group.label}</p>
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        </div>
                        <Badge variant="secondary">{formatInteger(group.total)}</Badge>
                      </div>
                      <Separator />
                      <div className="max-h-56 space-y-2 overflow-y-auto p-4">
                        {group.tables.map((item) => (
                          <div
                            key={`${selectedPreview.mode}-${group.key}-${item.tabela}`}
                            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{item.descricao}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.tabela}</p>
                            </div>
                            <Badge variant="secondary">{formatInteger(item.registros)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedConfig.snapshotAvailable && (
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="reset-snapshot"
                        checked={snapshotBeforeReset}
                        onCheckedChange={(checked) => setSnapshotBeforeReset(Boolean(checked))}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="reset-snapshot" className="text-sm font-medium text-foreground">
                          Gerar snapshot antes do reset
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Estrutura inicial preparada. A exportação ainda não roda, mas a intenção fica registrada para a
                          próxima etapa do fluxo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-justification">Justificativa obrigatória</Label>
                  <Textarea
                    id="reset-justification"
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    placeholder="Ex: reinicialização controlada para homologação e reapresentação do tenant demo."
                    rows={3}
                    className="h-24 resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    O motivo será salvo com usuário, tenant, data, IP, contexto e tabelas afetadas.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-confirmation">Confirmação textual obrigatória</Label>
                  <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-warning-strong">Digite exatamente</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                      {selectedPreview.confirmation_phrase}
                    </p>
                  </div>
                  <Input
                    id="reset-confirmation"
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    placeholder={selectedPreview.confirmation_phrase}
                  />
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
                  <Checkbox
                    id="reset-ack"
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(Boolean(checked))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="reset-ack" className="text-sm font-medium text-foreground">
                      {selectedConfig.acknowledgementLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">{selectedConfig.acknowledgementHint}</p>
                  </div>
                </div>
              </div>
            ) : (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Preview indisponível</AlertTitle>
                <AlertDescription>
                  Não foi possível carregar o impacto do reset. Reabra o modal ou atualize a tela.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/50 bg-background px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setSelectedMode(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant={selectedConfig?.severity === "danger" ? "destructive" : "default"}
              disabled={!isConfirmEnabled}
              onClick={() => executeMutation.mutate()}
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executando...
                </>
              ) : (
                selectedConfig?.buttonLabel ?? "Confirmar reset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResetOperacional;
