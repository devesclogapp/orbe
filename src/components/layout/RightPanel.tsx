import { Sparkles, AlertTriangle, CheckCircle2, Clock, Wand2, X, Building2, Cpu, Wallet, User, Boxes, TrendingUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/contexts/SelectionContext";
import { useQuery } from "@tanstack/react-query";
import { ColaboradorService, PontoService, ColetorService, OperacaoService, EmpresaService, ConsolidadoService } from "@/services/base.service";
import { StatusChip } from "@/components/painel/StatusChip";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const RightPanel = () => {
  const { kind, id, clear } = useSelection();

  if (!id) return null;

  if (kind === "colaborador") return <ColaboradorPanel id={id} onClose={clear} />;
  if (kind === "operacao") return <OperacaoPanel id={id} onClose={clear} />;

  return <DefaultPanel onClose={clear} />;
};

const PanelShell = ({ children }: { children: React.ReactNode }) => (
  <aside className="w-[320px] shrink-0 bg-card border-l border-border h-[calc(100vh-var(--app-topbar-height))] sticky top-[var(--app-topbar-height)] overflow-y-auto">
    <div className="p-4 space-y-5">{children}</div>
  </aside>
);

const ColaboradorPanel = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const today = new Date().toISOString().split('T')[0];

  const { data: colab, isLoading: loadingColab } = useQuery({
    queryKey: ['colaborador', id],
    queryFn: () => ColaboradorService.getById(id)
  });

  const { data: pontoRecord, isLoading: loadingPonto } = useQuery({
    queryKey: ['ponto', id, today],
    queryFn: () => PontoService.getByCollaborator(id).then(rows => rows.find(r => r.data === today)),
    enabled: !!id
  });

  const { data: empresa, isLoading: loadingEmpresa } = useQuery({
    queryKey: ['empresa', colab?.empresa_id],
    queryFn: () => EmpresaService.getById(colab?.empresa_id as string),
    enabled: !!colab?.empresa_id
  });

  const { data: colets = [], isLoading: loadingColets } = useQuery({
    queryKey: ['coletores', colab?.empresa_id],
    queryFn: () => ColetorService.getWithEmpresa().then(rows => rows.filter(r => r.empresa_id === colab?.empresa_id)),
    enabled: !!colab?.empresa_id
  });

  const competencia = today.substring(0, 7);

  const { data: consolidado, isLoading: loadingConsolidado } = useQuery({
    queryKey: ["consolidado", competencia, colab?.empresa_id],
    queryFn: () => ConsolidadoService.getByCompetencia(competencia, colab?.empresa_id),
    enabled: !!colab?.empresa_id
  });

  const { data: inconsistencias = [], isLoading: loadingInconsistencias } = useQuery({
    queryKey: ["inconsistencias-colaborador", id],
    queryFn: () =>
      OperacaoService.getInconsistencies().then((rows) =>
        rows.filter(
          (row: any) =>
            row.responsavel_id === id ||
            row.colaborador_id === id ||
            row.colaboradores?.id === id
        )
      ),
    enabled: !!id
  });

  if (loadingColab || loadingPonto || loadingEmpresa || loadingColets || loadingConsolidado || loadingInconsistencias) {
    return <PanelShell><div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div></PanelShell>;
  }

  if (!colab) return <DefaultPanel onClose={onClose} />;

  const consolidadoColaborador = consolidado?.colaboradores?.find((item: any) => item.colaborador_id === id);
  const topClientes = (consolidado?.clientes || []).slice(0, 3);
  const valorColaborador = Number(consolidadoColaborador?.valor_total || 0);
  const totalClientes = (consolidado?.clientes || []).reduce((acc: number, item: any) => acc + Number(item.valor_total || 0), 0);
  const resultadoProjetado = valorColaborador + totalClientes;

  return (
    <PanelShell>
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
            {colab.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-semibold text-foreground text-sm truncate">{colab.nome}</div>
            <div className="text-[11px] text-muted-foreground truncate">{colab.cargo} · {colab.matricula || 'Mat. N/A'}</div>
          </div>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Vínculo</h3>
        <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
          <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={empresa?.nome ?? 'N/A'} />
          <Row icon={<User className="h-3.5 w-3.5" />} label="Contrato" value={colab.tipo_contrato || 'N/A'} />
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Valor base" value={`R$ ${(colab.valor_base || 0).toFixed(2).replace(".", ",")}`} />
          <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Faturamento" value={colab.status === 'ativo' ? "Sim" : "Não"} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Ponto do dia</h3>
        {pontoRecord ? (
          <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <KV label="Entrada" value={pontoRecord.entrada || '—'} />
              <KV label="Saída" value={pontoRecord.saida || '—'} />
              <KV label="Saída almoço" value={pontoRecord.saida_almoco || '—'} />
              <KV label="Retorno almoço" value={pontoRecord.retorno_almoco || '—'} />
              <KV label="Horas" value={pontoRecord.horas_trabalhadas || '0h00'} />
              <KV label="Extras" value={pontoRecord.horas_extras || '—'} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Valor do dia</span>
              <span className="font-display font-semibold text-foreground">R$ {Number(pontoRecord.valor_dia || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusChip status={pontoRecord.status} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic bg-secondary/20 rounded-md p-3 text-center">Sem registro de ponto hoje.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Coletores REP da empresa ({colets.length})
        </h3>
        <ul className="space-y-2">
          {colets.map((c: any) => (
            <li key={c.id} className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-background/50 text-xs text-secondary-glow">
              <Cpu className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{c.serie} · {c.modelo}</div>
                <div className="text-[10px] text-muted-foreground">Última Sync: {c.ultima_conexao ? format(new Date(c.ultima_conexao), "HH:mm") : '—'}</div>
              </div>
              <span
                className={`esc-chip text-[10px] ${c.status === "online"
                  ? "bg-success-soft text-success-strong"
                  : c.status === "erro"
                    ? "bg-destructive-soft text-destructive-strong"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {c.status}
              </span>
            </li>
          ))}
          {colets.length === 0 && <p className="text-xs text-muted-foreground italic p-2.5 text-center bg-secondary/10 rounded-md">Nenhum coletor vinculado.</p>}
        </ul>
      </section>

      <Button size="sm" className="w-full font-display font-semibold">
        <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Ações do Assistente
      </Button>
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-sm text-foreground">Resultado consolidado</h3>
        </div>
        <div className="rounded-lg border border-border overflow-hidden bg-background/50">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-card/60">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">MÃªs {competencia}</span>
            <span className="text-[11px] text-muted-foreground">CompetÃªncia ativa</span>
          </div>

          <div className="p-3 space-y-3">
            <MiniTotal
              label="Fechamento do colaborador"
              value={`R$ ${valorColaborador.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            />

            <div className="rounded-md bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                Top clientes do mÃªs
              </div>
              {topClientes.length > 0 ? (
                <ul className="space-y-2">
                  {topClientes.map((cliente: any) => (
                    <li key={cliente.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-foreground font-medium">{cliente.clientes?.nome}</span>
                      <span className="shrink-0 text-muted-foreground">
                        R$ {Number(cliente.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">Sem faturamento neste mÃªs.</p>
              )}
            </div>
          </div>

          <div className="border-t border-border px-3 py-3 grid grid-cols-1 gap-2 bg-secondary/20">
            <MiniTotal
              label="Receita bruta"
              value={`R$ ${totalClientes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            />
            <MiniTotal
              label="Resultado projetado"
              value={`R$ ${resultadoProjetado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              highlight
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <h3 className="font-display font-semibold text-sm text-foreground">Status inteligente</h3>
          <span className="esc-chip bg-info-soft text-info text-[10px]">IA</span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-background/50">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
            <span className="inline-flex items-center gap-1 text-xs text-destructive-strong">
              <AlertTriangle className="h-3.5 w-3.5" />
              {inconsistencias.length} alerta(s)
            </span>
            <span className="text-[11px] text-muted-foreground">Foco no colaborador</span>
          </div>

          <div className="divide-y divide-border">
            {inconsistencias.length > 0 ? (
              inconsistencias.slice(0, 3).map((item: any) => {
                const valorEstimado = Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
                return (
                  <div key={item.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center bg-destructive-soft text-destructive-strong">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="esc-chip bg-secondary text-foreground">{item.tipo_servico || "OperaÃ§Ã£o"}</span>
                          <span className="font-display font-semibold text-sm text-foreground">
                            {item.produto || item.transportadora || "InconsistÃªncia operacional"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {item.quantidade || 0} registro(s) com status <span className="font-medium text-foreground">{item.status}</span>.
                          Valor estimado: R$ {valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 flex items-center gap-2 text-xs text-success-strong bg-success-soft/60">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Nenhuma inconsistÃªncia aberta para este colaborador.
              </div>
            )}
          </div>

          <div className="border-t border-border px-3 py-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="h-3.5 w-3.5 text-info" />
              AnÃ¡lise contextual ao abrir o colaborador
            </span>
            <span>Agora</span>
          </div>
        </div>
      </section>
    </PanelShell>
  );
};

const OperacaoPanel = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data: op, isLoading: loadingOp } = useQuery({
    queryKey: ['operacao', id],
    queryFn: () => OperacaoService.getById(id)
  });

  const { data: resp, isLoading: loadingResp } = useQuery({
    queryKey: ['colaborador', op?.responsavel_id],
    queryFn: () => ColaboradorService.getById(op?.responsavel_id as string),
    enabled: !!op?.responsavel_id
  });

  if (loadingOp || loadingResp) {
    return <PanelShell><div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div></PanelShell>;
  }

  if (!op) return <DefaultPanel onClose={onClose} />;

  const valorTotal = Number(op.quantidade || 0) * Number(op.valor_unitario || 0);

  return (
    <PanelShell>
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary-soft flex items-center justify-center text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-foreground text-sm">{op.id.substring(0, 8)}</div>
            <div className="text-[11px] text-muted-foreground">{op.produto} · {op.transportadora}</div>
          </div>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Detalhe da operação</h3>
        <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <KV label="Serviço" value={op.tipo_servico || '—'} />
            <KV label="Quantidade" value={String(op.quantidade || 0)} />
            <KV label="Início" value={op.horario_inicio || '—'} />
            <KV label="Fim" value={op.horario_fim || '—'} />
            <KV label="Valor unit." value={`R$ ${(op.valor_unitario || 0).toFixed(2).replace(".", ",")}`} />
            <KV label="Valor total" value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">Status</span>
            <StatusChip status={op.status} />
          </div>
        </div>
      </section>

      {resp && (
        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Responsável</h3>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-xs">
              {resp.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium text-foreground">{resp.nome}</div>
              <div className="text-muted-foreground">{resp.cargo}</div>
            </div>
          </div>
        </section>
      )}
    </PanelShell>
  );
};

const DefaultPanel = ({ onClose }: { onClose: () => void }) => (
  <PanelShell>
    <header className="flex items-center justify-between mb-2">
      <h3 className="font-display font-semibold text-sm text-foreground">Assistente Orbe</h3>
      <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </header>

    <section>
      <h3 className="font-display font-semibold text-sm text-foreground mb-2">Sincronização</h3>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-success-soft">
        <CheckCircle2 className="h-4 w-4 text-success-strong mt-0.5 shrink-0" />
        <div className="text-xs">
          <div className="font-medium text-success-strong">Coletores conectados</div>
          <div className="text-success-strong/80 mt-0.5">Última sincronização há 2 min</div>
        </div>
      </div>
    </section>

    <section>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-info" />
        <h3 className="font-display font-semibold text-sm text-foreground">Assistente IA</h3>
      </div>
      <div className="p-3 rounded-lg border border-info-soft bg-info-soft/40 space-y-2">
        <div className="text-xs text-foreground leading-relaxed">
          <span className="font-medium">Hikmat Sofyan</span> tem ponto registrado, mas não foi vinculado a nenhuma operação no período.
        </div>
        <div className="text-[11px] text-muted-foreground">
          Sugestão: vincular à operação <span className="font-medium text-foreground">OP-1043 (Transvolume)</span>
        </div>
        <Button size="sm" className="w-full mt-1 h-8">
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Aplicar sugestão
        </Button>
      </div>
    </section>

    <section>
      <h3 className="font-display font-semibold text-sm text-foreground mb-2">Alertas do dia</h3>
      <ul className="space-y-2">
        <AlertItem
          icon={<AlertTriangle className="h-4 w-4 text-destructive-strong" />}
          title="Equipe insuficiente"
          desc="OP-1042 registrada para 3 colaboradores, apenas 1 com ponto ativo"
          tone="error"
        />
        <AlertItem
          icon={<AlertTriangle className="h-4 w-4 text-warning-strong" />}
          title="Volume incompatível"
          desc="500 volumes em 20 minutos — possível erro de digitação"
          tone="warn"
        />
        <AlertItem
          icon={<Clock className="h-4 w-4 text-warning-strong" />}
          title="Ponto incompleto"
          desc="Jainudin sem registro de saída"
          tone="warn"
        />
      </ul>
    </section>

    <section>
      <h3 className="font-display font-semibold text-sm text-foreground mb-2">Dica</h3>
      <p className="text-xs text-muted-foreground">
        Clique em uma linha de Ponto ou Operação para ver os detalhes do colaborador, sua empresa e os coletores vinculados.
      </p>
    </section>
  </PanelShell>
);

const AlertItem = ({ icon, title, desc, tone }: { icon: React.ReactNode; title: string; desc: string; tone: "error" | "warn" }) => (
  <li className={`p-2.5 rounded-md border-l-2 ${tone === "error" ? "border-destructive bg-destructive-soft/40" : "border-warning bg-warning-soft/30"}`}>
    <div className="flex items-start gap-2">
      {icon}
      <div className="text-xs leading-snug">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  </li>
);

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {icon} {label}
    </span>
    <span className="font-medium text-foreground text-right">{value}</span>
  </div>
);

const KV = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="font-medium text-foreground">{value}</div>
  </div>
);

const MiniTotal = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={cn("rounded-md px-3 py-2", highlight && "bg-primary-soft/20")}>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
      {highlight && <TrendingUp className="h-3 w-3 text-primary" />}
      {label}
    </div>
    <div className={cn("font-display font-bold text-base mt-1", highlight ? "text-primary" : "text-foreground")}>
      {value}
    </div>
  </div>
);
