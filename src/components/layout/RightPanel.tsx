import { Sparkles, AlertTriangle, CheckCircle2, Clock, Wand2, X, Building2, Cpu, Wallet, User, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/contexts/SelectionContext";
import { colaboradores, coletores, empresas, opsRows, pontoRows } from "@/data/mock";
import { StatusChip } from "@/components/painel/StatusChip";

export const RightPanel = () => {
  const { kind, id, clear } = useSelection();

  if (kind === "colaborador" && id) return <ColaboradorPanel id={id} onClose={clear} />;
  if (kind === "operacao" && id) return <OperacaoPanel id={id} onClose={clear} />;
  return <DefaultPanel />;
};

const PanelShell = ({ children }: { children: React.ReactNode }) => (
  <aside className="w-[320px] shrink-0 bg-card border-l border-border h-[calc(100vh-64px)] sticky top-16 overflow-y-auto">
    <div className="p-4 space-y-5">{children}</div>
  </aside>
);

const ColaboradorPanel = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const colab = colaboradores.find((c) => c.id === id);
  const ponto = pontoRows.find((p) => p.colaboradorId === id);
  if (!colab) return <DefaultPanel />;
  const empresa = empresas.find((e) => e.id === colab.empresaId);
  const colets = coletores.filter((c) => c.empresaId === colab.empresaId);

  return (
    <PanelShell>
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
            {colab.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-semibold text-foreground text-sm truncate">{colab.nome}</div>
            <div className="text-[11px] text-muted-foreground truncate">{colab.cargo} · Mat. {colab.matricula}</div>
          </div>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Vínculo</h3>
        <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
          <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={empresa?.nome ?? colab.empresa} />
          <Row icon={<User className="h-3.5 w-3.5" />} label="Contrato" value={`Por ${colab.contrato}`} />
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Valor base" value={`R$ ${colab.valorBase.toFixed(2).replace(".", ",")}`} />
          <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Faturamento" value={colab.faturamento ? "Sim" : "Não"} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Ponto do dia</h3>
        {ponto ? (
          <div className="rounded-lg border border-border p-3 space-y-2 bg-background/50 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <KV label="Entrada" value={ponto.entrada} />
              <KV label="Saída" value={ponto.saida} />
              <KV label="Saída almoço" value={ponto.saidaAlmoco} />
              <KV label="Retorno almoço" value={ponto.retornoAlmoco} />
              <KV label="Horas" value={ponto.horas} />
              <KV label="Extras" value={ponto.extras} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Valor do dia</span>
              <span className="font-display font-semibold text-foreground">{ponto.valorDia}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusChip status={ponto.status} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem registro de ponto hoje.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Coletores REP da empresa ({colets.length})
        </h3>
        <ul className="space-y-2">
          {colets.map((c) => (
            <li key={c.id} className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-background/50 text-xs">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{c.id} · {c.modelo}</div>
                <div className="text-muted-foreground">{c.ultimaSync}</div>
              </div>
              <span
                className={`esc-chip ${
                  c.status === "online"
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
          {colets.length === 0 && <p className="text-xs text-muted-foreground">Nenhum coletor vinculado.</p>}
        </ul>
      </section>

      <Button size="sm" className="w-full">
        <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Ações sobre colaborador
      </Button>
    </PanelShell>
  );
};

const OperacaoPanel = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const op = opsRows.find((o) => o.id === id);
  if (!op) return <DefaultPanel />;
  const resp = colaboradores.find((c) => c.id === op.responsavelId);

  return (
    <PanelShell>
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary-soft flex items-center justify-center text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-foreground text-sm">{op.id}</div>
            <div className="text-[11px] text-muted-foreground">{op.produto} · {op.transp}</div>
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
            <KV label="Serviço" value={op.servico} />
            <KV label="Quantidade" value={String(op.qtd)} />
            <KV label="Início" value={op.ini} />
            <KV label="Fim" value={op.fim} />
            <KV label="Valor unit." value={`R$ ${op.valorUnit.toFixed(2).replace(".", ",")}`} />
            <KV label="Valor total" value={op.valor} />
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
              {resp.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium text-foreground">{resp.nome}</div>
              <div className="text-muted-foreground">{resp.cargo} · {resp.empresa}</div>
            </div>
          </div>
        </section>
      )}
    </PanelShell>
  );
};

const DefaultPanel = () => (
  <PanelShell>
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
