import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  Wrench,
  Search,
  Building2,
  Sparkles,
  Layers,
  Info,
  Shield,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EtapaOperacional,
  ProcessoResumoItem,
  SituacaoEtapa,
} from "@/pages/UxLab/torreMockData";

interface UxLabTorreDrawerProps {
  stage: EtapaOperacional | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Componente Raiz do Drawer: gerencia exclusivamente a montagem do Radix Sheet
 * preservando a imutabilidade e estabilidade absoluta da ordem de hooks no React.
 */
export const UxLabTorreDrawer: React.FC<UxLabTorreDrawerProps> = ({
  stage,
  open,
  onClose,
}) => {
  return (
    <Sheet open={open && !!stage} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {stage && (
        <UxLabTorreDrawerContent
          key={stage.id}
          stage={stage}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
};

// ─── CONTEÚDO INTERNO DO DRAWER (HOOKS ESTÁVEIS E INCONDICIONAIS) ────────────────

interface UxLabTorreDrawerContentProps {
  stage: EtapaOperacional;
  onClose: () => void;
}

const UxLabTorreDrawerContent: React.FC<UxLabTorreDrawerContentProps> = ({
  stage,
  onClose,
}) => {
  const [filterMode, setFilterMode] = useState<"todos" | "atencao" | "bloqueados">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Filtragem dos processos da etapa (Executada incondicionalmente)
  const filteredItems = useMemo(() => {
    let items = stage.itensExemplo;

    // Filtro por categoria
    if (filterMode === "atencao") {
      items = items.filter(
        (i) => i.situacaoCategoria === "aguardando_decisao" || i.isAtrasado
      );
    } else if (filterMode === "bloqueados") {
      items = items.filter(
        (i) => i.situacaoCategoria === "bloqueado" || i.isBloqueado
      );
    }

    // Busca textual por código, cliente, unidade, tipo ou motivo
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (i) =>
          i.codigo.toLowerCase().includes(q) ||
          i.cliente.toLowerCase().includes(q) ||
          i.unidade.toLowerCase().includes(q) ||
          i.tipo.toLowerCase().includes(q) ||
          (i.motivo && i.motivo.toLowerCase().includes(q))
      );
    }

    return items;
  }, [stage, filterMode, searchTerm]);

  // Contadores para os filtros compactos (Calculados incondicionalmente)
  const countAtencao = useMemo(() => {
    return stage.itensExemplo.filter(
      (i) => i.situacaoCategoria === "aguardando_decisao" || i.isAtrasado
    ).length;
  }, [stage]);

  const countBloqueados = useMemo(() => {
    return stage.itensExemplo.filter(
      (i) => i.situacaoCategoria === "bloqueado" || i.isBloqueado
    ).length;
  }, [stage]);

  // Ação de Despacho (Simulação com Contexto Completo)
  const handleDispatch = (item: ProcessoResumoItem) => {
    const { ctaContexto, ctaLabel, codigo } = item;
    const queryString = `origem=${ctaContexto.origem}&trilha=${ctaContexto.trilha}&etapa=${ctaContexto.etapa}&processo=${ctaContexto.processoId}`;

    toast.info(`Despacho Operacional: ${ctaLabel}`, {
      description: (
        <div className="space-y-1 mt-1 font-mono text-[11px]">
          <div>
            <strong>Processo:</strong> {codigo}
          </div>
          <div>
            <strong>Destino:</strong> {ctaContexto.rotaSugerida}
          </div>
          <div className="text-[10px] text-muted-foreground break-all">
            <strong>Payload:</strong> ?{queryString}
          </div>
        </div>
      ),
      duration: 5000,
    });
  };

  return (
    <SheetContent
      side="right"
      className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-[650px] p-0 flex flex-col gap-0 border-l border-border bg-card text-foreground overflow-hidden shadow-2xl transition-colors duration-200"
    >
      {/* ─── 1. CABEÇALHO DO DRAWER (DIAGNÓSTICO E RESPONSABILIDADE) ─── */}
      <div className="border-b border-border/80 bg-muted/20 px-5 py-4 shrink-0 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {/* Trilha e Identificação do Nível */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {stage.trilhaTitulo}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                ETAPA 0{stage.ordem}
              </span>
            </div>

            {/* Nome da Etapa */}
            <SheetTitle className="font-display text-xl font-bold tracking-tight text-foreground leading-tight">
              {stage.nome}
            </SheetTitle>

            <SheetDescription className="text-xs text-muted-foreground">
              {stage.subtitulo}
            </SheetDescription>
          </div>

          {/* Status Geral da Etapa e Botão Fechar */}
          <div className="flex items-center gap-2 shrink-0">
            <StageStatusBadge situacao={stage.situacao} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </div>
        </div>

        {/* Sub-cabeçalho de Métricas Rápidas & Responsabilidade Setorial */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {stage.totalProcessos} processos nesta etapa
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className={cn(
              "font-medium",
              stage.processosEmAtencao > 0 ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-muted-foreground"
            )}>
              {stage.processosEmAtencao} exigem atenção
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="text-muted-foreground hidden sm:inline">
              Tempo médio: {stage.tempoMedio}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Responsável atual</span>
            <span className="text-muted-foreground/40">·</span>
            <strong className={cn(
              stage.responsavelSetorial === "Operação" && "text-blue-700 dark:text-blue-400 font-semibold",
              stage.responsavelSetorial === "RH" && "text-purple-700 dark:text-purple-400 font-semibold",
              stage.responsavelSetorial === "Financeiro" && "text-emerald-700 dark:text-emerald-400 font-semibold"
            )}>
              {stage.responsavelSetorial}
            </strong>
          </div>
        </div>
      </div>

      {/* ─── 2. BARRA DE FILTROS COMPACTOS & BUSCA DENTRO DO DRAWER ─── */}
      <div className="border-b border-border/70 px-5 py-2.5 bg-card shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Pílulas de Filtro */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={stage.itensExemplo.length === 0}
            onClick={() => setFilterMode("todos")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "todos"
                ? "bg-muted font-bold text-foreground"
                : "text-muted-foreground hover:text-foreground",
              stage.itensExemplo.length === 0 && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            Todos ({stage.itensExemplo.length})
          </button>
          <button
            type="button"
            disabled={countAtencao === 0}
            onClick={() => setFilterMode("atencao")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1",
              filterMode === "atencao"
                ? "bg-amber-100 dark:bg-amber-950/60 font-bold text-amber-800 dark:text-amber-300"
                : "text-muted-foreground hover:text-foreground",
              countAtencao === 0 && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full bg-amber-500", countAtencao === 0 && "opacity-40")} />
            Atenção ({countAtencao})
          </button>
          <button
            type="button"
            disabled={countBloqueados === 0}
            onClick={() => setFilterMode("bloqueados")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1",
              filterMode === "bloqueados"
                ? "bg-rose-100 dark:bg-rose-950/60 font-bold text-rose-800 dark:text-rose-300"
                : "text-muted-foreground hover:text-foreground",
              countBloqueados === 0 && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full bg-rose-600", countBloqueados === 0 && "opacity-40")} />
            Bloqueados ({countBloqueados})
          </button>
        </div>

        {/* Campo de Busca Rápida no Drawer */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Buscar processo, lote, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 pl-8 text-xs font-medium bg-muted/40 border-border"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 3. LISTA DE PROCESSOS (DIAGNÓSTICO E DESPACHO) ─── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <Filter className="h-8 w-8 mx-auto opacity-30" />
            <p className="text-xs font-medium">Nenhum processo localizado neste filtro.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterMode("todos");
                setSearchTerm("");
              }}
              className="h-7 text-xs"
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          filteredItems.map((item) => (
            <ProcessoDrawerCard
              key={item.id}
              item={item}
              onDispatch={handleDispatch}
            />
          ))
        )}
      </div>

      {/* ─── 4. NOTA DIDÁTICA DE GOVERNANÇA (RODAPÉ) ─── */}
      <div className="border-t border-border/80 bg-muted/30 px-5 py-3 shrink-0 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-[11px] leading-tight">
            A Torre diagnostica e despacha. A resolução definitiva ocorre na tela especialista.
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 text-xs font-medium"
        >
          Fechar Drawer
        </Button>
      </div>
    </SheetContent>
  );
};

// ─── CARD DE PROCESSO OPERACIONAL DENTRO DO DRAWER ───────────────────────────────

function ProcessoDrawerCard({
  item,
  onDispatch,
}: {
  item: ProcessoResumoItem;
  onDispatch: (item: ProcessoResumoItem) => void;
}) {
  const isBloqueado = item.situacaoCategoria === "bloqueado";
  const isAguardando = item.situacaoCategoria === "aguardando_decisao";
  const isReceitas = item.ctaDestinoTipo === "receitas" || item.ctaDestinoTipo === "faturamento";

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-2.5 transition-all text-left bg-card",
        isBloqueado
          ? "border-rose-300/80 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 shadow-xs"
          : isAguardando
          ? "border-amber-300/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
          : "border-border/80 bg-card hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
      )}
    >
      {/* Linha 1: Identificador, Tipo, Unidade e Tempo Parado */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-foreground tracking-tight">
              {item.codigo}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] font-medium px-1.5 py-0 border-border bg-muted/40 text-muted-foreground"
            >
              {item.tipo}
            </Badge>
          </div>

          <div className="text-xs font-medium text-foreground truncate">
            {item.cliente} <span className="text-muted-foreground">· {item.unidade}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Clock className="h-3 w-3 text-muted-foreground/70" />
            <span>{item.tempoParado}</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Situação e Motivo Detalhado */}
      <div className="space-y-1.5 text-xs pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          {isBloqueado ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
              <AlertTriangle className="h-3 w-3" />
              {item.situacaoTexto}
            </span>
          ) : isAguardando ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
              <Clock className="h-3 w-3" />
              {item.situacaoTexto}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-muted/60 px-2 py-0.5 rounded border border-border/60">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {item.situacaoTexto}
            </span>
          )}
        </div>

        {item.motivo && (
          <p className="text-[11px] leading-relaxed pt-0.5">
            <span className="font-medium text-foreground">Motivo: </span>
            <span className="text-muted-foreground">{item.motivo}</span>
          </p>
        )}
      </div>

      {/* Linha 3: Responsável Setorial e Botão CTA de Despacho */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs">
        <div className="text-[11px] text-muted-foreground">
          Responsável:{" "}
          <strong className={cn(
            item.responsavelSetor === "Operação" && "text-blue-700 dark:text-blue-300",
            item.responsavelSetor === "RH" && "text-purple-700 dark:text-purple-300",
            item.responsavelSetor === "Financeiro" && "text-emerald-700 dark:text-emerald-300"
          )}>
            {item.responsavelSetor}
          </strong>
        </div>

        <div>
          {isBloqueado ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDispatch(item)}
              className="h-7 px-3 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Wrench className="h-3.5 w-3.5" />
              {item.ctaLabel}
            </Button>
          ) : isReceitas ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onDispatch(item)}
              className="h-7 px-3 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              {item.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : isAguardando ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onDispatch(item)}
              className="h-7 px-3 text-xs font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
            >
              {item.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDispatch(item)}
              className="h-7 px-2.5 text-xs font-medium text-foreground hover:bg-muted gap-1 border-border"
            >
              {item.ctaLabel}
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BADGE DE STATUS DA ETAPA NO DRAWER ───────────────────────────────────────────

function StageStatusBadge({ situacao }: { situacao: SituacaoEtapa }) {
  switch (situacao) {
    case "atrasado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
          Fora do SLA
        </span>
      );
    case "bloqueado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-800 bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300">
          <AlertTriangle className="h-2.5 w-2.5" />
          Bloqueado
        </span>
      );
    case "atencao":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Atenção
        </span>
      );
    case "concluido":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Concluído
        </span>
      );
    case "normal":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
          Regular
        </span>
      );
  }
}
