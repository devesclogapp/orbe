import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusChip } from "./StatusChip";
import {
  Clock,
  RefreshCw,
  Boxes,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  User,
  LogIn,
  LogOut,
  UtensilsCrossed,
  Coffee,
  Timer,
  Zap,
  CalendarDays,
  DollarSign,
  CheckCircle2,
  Truck,
  Package,
  Hash,
  Hourglass,
  BadgeDollarSign,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useSelection } from "@/contexts/SelectionContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PontoService, OperacaoService } from "@/services/base.service";

export const PontoOperacoesBlock = ({
  date,
  empresaId,
  filterOperationsByDate = true,
}: {
  date: string;
  empresaId: string;
  filterOperationsByDate?: boolean;
}) => {
  const { defaultTab } = usePreferences();
  const [tab, setTab] = useState<"ponto" | "operacoes">(defaultTab);
  const queryClient = useQueryClient();

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border gap-4 flex-wrap">
        <div className="inline-flex items-center bg-muted rounded-lg p-1">
          <TabButton active={tab === "ponto"} onClick={() => setTab("ponto")} icon={<Clock className="h-3.5 w-3.5" />}>
            Ponto
          </TabButton>
          <TabButton active={tab === "operacoes"} onClick={() => setTab("operacoes")} icon={<Boxes className="h-3.5 w-3.5" />}>
            Operações
          </TabButton>
        </div>

        {tab === "ponto" ? (
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ponto", date, empresaId] })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors group"
          >
            <RefreshCw className="h-3.5 w-3.5 group-active:animate-spin" /> Atualizar dados
          </button>
        ) : (
          <Button size="sm" className="h-8" onClick={() => window.location.href = "/producao"}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
          </Button>
        )}
      </header>

      {tab === "ponto"
        ? <PontoTable date={date} empresaId={empresaId} />
        : <OperacoesTable date={date} empresaId={empresaId} filterByDate={filterOperationsByDate} />}
    </section>
  );
};

const TabButton = ({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </button>
);

const PontoTable = ({ date, empresaId }: { date: string; empresaId: string }) => {
  const { id: selectedId, kind, select } = useSelection();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ponto", date, empresaId],
    queryFn: () => PontoService.getByDate(date, empresaId === "all" ? undefined : empresaId),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando registros de ponto...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left font-display">
            <th className="px-5 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Colaborador</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />Entrada</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />Saída almoço</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5 text-muted-foreground" />Retorno almoço</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />Saída</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" />Horas</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-muted-foreground" />Extras</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />Tipo dia</span></th>
            <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor do dia</span></th>
            <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => {
            const isSelected = kind === "colaborador" && selectedId === r.colaborador_id;
            return (
              <tr
                key={r.id}
                onClick={() => select("colaborador", r.colaborador_id)}
                className={cn(
                  "esc-table-row cursor-pointer transition-all",
                  r.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">{r.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.colaboradores?.cargo} · {r.colaboradores?.empresas?.nome}</div>
                </td>
                <td className="px-3 text-center text-foreground">{r.entrada || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.saida_almoco || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.retorno_almoco || "-"}</td>
                <td className="px-3 text-center text-foreground">{r.saida || "-"}</td>
                <td className="px-3 text-center font-display font-medium">{r.horas_trabalhadas || "0h00"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.horas_extras || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{r.tipo_dia}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">
                  R$ {Number(r.valor_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 text-center"><StatusChip status={r.status} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-12 text-center text-muted-foreground italic">Nenhum registro encontrado para {date}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const getStatusConfig = (status: string) => {
  switch (status?.toLowerCase()) {
    case "registered":
    case "registrado":
    case "aberto":
      return { label: "Registrado", className: "bg-muted text-muted-foreground" };
    case "pending":
    case "pendente":
      return { label: "Pendente", className: "bg-muted text-muted-foreground" };
    case "validated":
    case "validado":
    case "ok":
    case "processado":
      return { label: "Validado", className: "bg-success-soft text-success-strong" };
    case "blocked":
    case "bloqueado":
    case "inconsistente":
      return { label: "Bloqueado", className: "bg-destructive-soft text-destructive-strong" };
    case "imported":
    case "importado":
      return { label: "Importado", className: "bg-info-soft text-info-strong" };
    default:
      return { label: status || "Desconhecido", className: "bg-muted text-muted-foreground" };
  }
};

const getLinhaOriginalValue = (item: Record<string, unknown>, ...keys: string[]) => {
  const linhaOriginal = (item.avaliacao_json as { linha_original?: Record<string, unknown> } | undefined)?.linha_original;
  if (!linhaOriginal) return null;

  const normalizedEntries = Object.entries(linhaOriginal).map(([key, value]) => [
    key.toUpperCase().replace(":", "").trim(),
    value,
  ] as const);

  for (const key of keys) {
    const normalizedKey = key.toUpperCase().replace(":", "").trim();
    const exactMatch = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
    if (exactMatch && exactMatch[1] !== null && exactMatch[1] !== undefined && String(exactMatch[1]).trim() !== "") {
      return exactMatch[1];
    }
  }

  for (const key of keys) {
    const normalizedKey = key.toUpperCase().replace(":", "").trim();
    const partialMatch = normalizedEntries.find(([entryKey]) => entryKey.includes(normalizedKey));
    if (partialMatch && partialMatch[1] !== null && partialMatch[1] !== undefined && String(partialMatch[1]).trim() !== "") {
      return partialMatch[1];
    }
  }

  return null;
};

const OperacoesTable = ({
  date,
  empresaId,
  filterByDate,
}: {
  date: string;
  empresaId: string;
  filterByDate: boolean;
}) => {
  const { id: selectedId, kind, select } = useSelection();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // v3 — inclui colunas derivadas da planilha original
  const STORAGE_KEY = 'orbe_visibleCols_operacoes_v3';

  const defaultCols = {
    data: true,
    operacao: true, transportadora: true, servico: true, qtd: true,
    inicio: false, fim: false, valUnit: true, valDia: true, status: true, acoes: true,
    nf: false, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
    valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
    valorFaturamentoNf: false, placa: false, fornecedor: false, colaborador: false, qtdCol: true,
    idPlanilha: false, empresaPlanilha: false, formaPagamento: false, observacao: false,
  };

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // defaultCols é base — chaves novas (ex: qtdCol, data) sempre herdam o default
      if (saved) return { ...defaultCols, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return defaultCols;
  });

  // Alternative 2: Details Sheet
  const [selectedOpDetails, setSelectedOpDetails] = useState<any>(null);

  // Scroll navigation
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollBy = useCallback((dir: 'left' | 'right') => {
    tableScrollRef.current?.scrollBy({ left: dir === 'right' ? 220 : -220, behavior: 'smooth' });
  }, []);

  const operationsQueryKey = filterByDate
    ? ["operacoes", date, empresaId]
    : ["operacoes-grid", empresaId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: operationsQueryKey,
    queryFn: () =>
      filterByDate
        ? OperacaoService.getPainelByDate(date, empresaId === "all" ? undefined : empresaId)
        : OperacaoService.getAllPainel(empresaId === "all" ? undefined : empresaId),
  });

  const filteredData = Array.isArray(rows) ? rows.filter((item) => {
    const fornecedor = item.fornecedores?.nome || item.produto_label || "";
    const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "";
    const servico = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "";

    const searchMatch =
      fornecedor.toLowerCase().includes(filterText.toLowerCase()) ||
      transportadora.toLowerCase().includes(filterText.toLowerCase()) ||
      servico.toLowerCase().includes(filterText.toLowerCase());

    const statusMatch = statusFilter === "all" || item.status === statusFilter;

    return searchMatch && statusMatch;
  }) : [];

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando operações...
      </div>
    );
  }

  const toggleCol = (col: keyof typeof visibleCols) => {
    setVisibleCols(prev => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allSelected = Object.values(visibleCols).every(Boolean);
  const toggleAll = () => {
    const newValue = !allSelected;
    const newCols = { ...visibleCols };
    Object.keys(newCols).forEach(k => newCols[k as keyof typeof visibleCols] = newValue);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols));
    setVisibleCols(newCols);
  };

  const toggleImportantes = () => {
    const importantesCols = {
      data: true,
      operacao: true, transportadora: true, servico: true, qtd: true,
      inicio: false, fim: false, valUnit: false, valDia: true, status: true, acoes: true,
      nf: true, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
      valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
      valorFaturamentoNf: false, placa: false, fornecedor: false, colaborador: false, qtdCol: true,
      idPlanilha: false, empresaPlanilha: false, formaPagamento: true, observacao: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importantesCols));
    setVisibleCols(importantesCols);
  };

  return (
    <div className="space-y-4 p-5 pt-2">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por fornecedor ou serviço..."
            className="w-full sm:w-80 h-9"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="registrado">Registrado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="validado">Validado</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="importado">Importado</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 font-medium">Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 h-[300px] overflow-y-auto">
              <DropdownMenuLabel>Visibilidade de Colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={allSelected}
                onCheckedChange={toggleAll}
                className="font-bold mb-1 bg-muted/50"
              >
                {allSelected ? "DESMARCAR TODAS" : "MARCAR TODAS"}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleCols.operacao && visibleCols.transportadora && visibleCols.servico && visibleCols.qtd && visibleCols.valDia && visibleCols.status && visibleCols.acoes && visibleCols.nf}
                onCheckedChange={toggleImportantes}
                className="font-bold mb-1 bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary"
              >
                8 MAIS IMPORTANTES
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {Object.keys(visibleCols).map((k) => (
                <DropdownMenuCheckboxItem
                  key={k}
                  checked={visibleCols[k as keyof typeof visibleCols]}
                  onCheckedChange={() => toggleCol(k as keyof typeof visibleCols)}
                >
                  {k.toUpperCase()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        {/* Scroll navigation arrows */}
        <button
          onClick={() => scrollBy('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-110 active:scale-95"
          title="Rolar para esquerda"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollBy('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-110 active:scale-95"
          title="Rolar para direita"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div ref={tableScrollRef} className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-max">
            <thead className="esc-table-header">
              <tr className="text-left font-display">
                {visibleCols.data && <th className="px-3 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />DATA</span></th>}
                {visibleCols.operacao && <th className="px-5 font-semibold py-3 sticky left-0 z-10 bg-muted/90 backdrop-blur-sm shadow-[1px_0_0_0_transparent] border-r border-border"><span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-muted-foreground" />OPERAÇÃO</span></th>}
                {visibleCols.fornecedor && <th className="px-3 font-semibold">FORNECEDOR</th>}
                {visibleCols.transportadora && <th className="px-3 font-semibold"><span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-muted-foreground" />TRANSPORTADORA</span></th>}
                {visibleCols.placa && <th className="px-3 font-semibold">PLACA</th>}
                {visibleCols.servico && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-muted-foreground" />SERVIÇO</span></th>}
                {visibleCols.colaborador && <th className="px-3 font-semibold text-center">COL.</th>}
                {visibleCols.qtdCol && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />QTD. COL.</span></th>}
                {visibleCols.idPlanilha && <th className="px-3 font-semibold text-center">ID PLANILHA</th>}
                {visibleCols.empresaPlanilha && <th className="px-3 font-semibold">EMPRESA PLANILHA</th>}
                {visibleCols.formaPagamento && <th className="px-3 font-semibold">FORMA PAGAMENTO</th>}
                {visibleCols.nf && <th className="px-3 font-semibold text-center">NF</th>}
                {visibleCols.ctrc && <th className="px-3 font-semibold text-center">CTRC</th>}
                {visibleCols.observacao && <th className="px-3 font-semibold">OBSERVAÇÃO</th>}
                {visibleCols.percentualIss && <th className="px-3 font-semibold text-center">% ISS</th>}
                {visibleCols.qtd && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />QTD</span></th>}
                {visibleCols.inicio && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />INÍCIO</span></th>}
                {visibleCols.fim && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />FIM</span></th>}
                {visibleCols.valUnit && <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />VAL. UNIT.</span></th>}
                {visibleCols.valorDescarga && <th className="px-3 font-semibold text-right">VALOR DESCARGA</th>}
                {visibleCols.custoIss && <th className="px-3 font-semibold text-right">CUSTO ISS</th>}
                {visibleCols.valorUnitarioFilme && <th className="px-3 font-semibold text-right">UNIT. FILME</th>}
                {visibleCols.quantidadeFilme && <th className="px-3 font-semibold text-center">QTD. FILME</th>}
                {visibleCols.valorTotalFilme && <th className="px-3 font-semibold text-right">TOTAL FILME</th>}
                {visibleCols.valorFaturamentoNf && <th className="px-3 font-semibold text-right">FATURAMENTO NF</th>}
                {visibleCols.valDia && <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" />TOTAL DIA</span></th>}
                {visibleCols.status && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />STATUS</span></th>}
                {visibleCols.acoes && <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hourglass className="h-3.5 w-3.5 text-muted-foreground" />AÇÕES</span></th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((o: any) => {
                const isSelected = kind === "operacao" && selectedId === o.id;
                const valorTotal = Number(o.valor_total_label ?? (Number(o.quantidade) * Number(o.valor_unitario || 0)));

                const fornecedor = o.fornecedores?.nome || o.produto_label || "Sem fornecedor";
                const servico = o.tipos_servico_operacional?.nome || o.tipo_servico_label || "Sem serviço";
                const operacaoNome = `${fornecedor} • ${servico}`;
                const transportadora = o.transportadoras_clientes?.nome || o.transportadora_label || "—";
                const placa = o.placa || "—";
                const nf = o.nf_numero || "—";
                const ctrc = o.ctrc || "—";
                const iss = o.percentual_iss ? `${(Number(o.percentual_iss) * 100).toFixed(0)}%` : "—";
                const colaborador = o.colaboradores?.nome || "Múltiplos /—";
                const idPlanilha = getLinhaOriginalValue(o, "ID") || "—";
                const empresaPlanilha = getLinhaOriginalValue(o, "EMPRESA") || "—";
                const formaPagamento = getLinhaOriginalValue(o, "FORMA DE PAGAMENTO") || "—";
                const observacao = getLinhaOriginalValue(o, "OBSERVAÇÃO", "OBSERVACAO") || "—";

                // DATA da operação (formatada DD/MM/YYYY)
                const dataOp = o.data_operacao
                  ? new Date(o.data_operacao + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—";

                // Qtd colaboradores envolvidos
                const qtdColaboradores = o.quantidade_colaboradores ?? 1;

                let qtdText = String(o.quantidade_label || o.quantidade || 0);
                if (o.tipo_calculo_snapshot === "volume") qtdText += " vol(s)";
                else if (o.tipo_calculo_snapshot === "diaria") qtdText += " diária(s)";
                else if (o.tipo_calculo_snapshot === "operacao") qtdText = "1 op";

                const inicio = o.horario_inicio_label ? (typeof o.horario_inicio_label === "string" ? o.horario_inicio_label.substring(0, 5) : o.horario_inicio_label) : "—";
                const fim = o.horario_fim_label ? (typeof o.horario_fim_label === "string" ? o.horario_fim_label.substring(0, 5) : o.horario_fim_label) : "—";

                const valUnitFormatter = (v: any) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const valUnit = valUnitFormatter(o.valor_unitario_label ?? o.valor_unitario ?? 0);
                const valDia = valUnitFormatter(valorTotal);

                const valorDescarga = valUnitFormatter(o.valor_descarga);
                const custoIss = valUnitFormatter(o.custo_com_iss);
                const unitFilme = valUnitFormatter(o.valor_unitario_filme);
                const qtdFilme = o.quantidade_filme || "—";
                const totFilme = valUnitFormatter(o.valor_total_filme);
                const fatNf = valUnitFormatter(o.valor_faturamento_nf);

                const statusCfg = getStatusConfig(o.status);

                return (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setSelectedOpDetails(o); // Opens Sheet only — right panel stays idle
                    }}
                    className={cn(
                      "esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50",
                      o.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                      selectedOpDetails?.id === o.id && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                    )}
                  >
                    {visibleCols.data && <td className="px-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{dataOp}</td>}
                    {visibleCols.operacao && <td className="px-5 py-3 font-medium whitespace-nowrap text-foreground sticky left-0 z-10 bg-background border-r border-border group-hover:bg-muted/50">{operacaoNome}</td>}
                    {visibleCols.fornecedor && <td className="px-3 text-muted-foreground whitespace-nowrap">{fornecedor}</td>}
                    {visibleCols.transportadora && <td className="px-3 text-muted-foreground whitespace-nowrap">{transportadora}</td>}
                    {visibleCols.placa && <td className="px-3 text-muted-foreground whitespace-nowrap">{placa}</td>}
                    {visibleCols.servico && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{servico}</td>}
                    {visibleCols.colaborador && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{colaborador}</td>}
                    {visibleCols.qtdCol && <td className="px-3 text-center font-display font-medium whitespace-nowrap">{qtdColaboradores}</td>}
                    {visibleCols.idPlanilha && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{String(idPlanilha)}</td>}
                    {visibleCols.empresaPlanilha && <td className="px-3 text-muted-foreground whitespace-nowrap">{String(empresaPlanilha)}</td>}
                    {visibleCols.formaPagamento && <td className="px-3 text-muted-foreground whitespace-nowrap">{String(formaPagamento)}</td>}
                    {visibleCols.nf && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{nf}</td>}
                    {visibleCols.ctrc && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{ctrc}</td>}
                    {visibleCols.observacao && <td className="px-3 text-muted-foreground whitespace-nowrap">{String(observacao)}</td>}
                    {visibleCols.percentualIss && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{iss}</td>}
                    {visibleCols.qtd && <td className="px-3 text-center font-display font-medium whitespace-nowrap">{qtdText}</td>}
                    {visibleCols.inicio && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{inicio}</td>}
                    {visibleCols.fim && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{fim}</td>}
                    {visibleCols.valUnit && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{valUnit}</td>}
                    {visibleCols.valorDescarga && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{valorDescarga}</td>}
                    {visibleCols.custoIss && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{custoIss}</td>}
                    {visibleCols.valorUnitarioFilme && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{unitFilme}</td>}
                    {visibleCols.quantidadeFilme && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{qtdFilme}</td>}
                    {visibleCols.valorTotalFilme && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{totFilme}</td>}
                    {visibleCols.valorFaturamentoNf && <td className="px-3 text-right text-muted-foreground whitespace-nowrap">{fatNf}</td>}
                    {visibleCols.valDia && <td className="px-3 text-right font-display font-semibold text-foreground whitespace-nowrap">{valDia}</td>}
                    {visibleCols.status && <td className="px-3 text-center whitespace-nowrap">
                      <Badge variant="outline" className={cn(statusCfg.className, "hover:bg-transparent font-medium border-0")}>
                        {statusCfg.label}
                      </Badge>
                    </td>}
                    {visibleCols.acoes && <td className="px-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); window.location.href = `/producao?id=${o.id}`; }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={22} className="p-12 text-center text-muted-foreground italic">
                    {filterByDate
                      ? "Nenhuma operação atende aos filtros atuais nesta data."
                      : "Nenhuma operação atende aos filtros atuais."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>  {/* end relative scroll wrapper */}

      <Sheet open={!!selectedOpDetails} onOpenChange={(val) => !val && setSelectedOpDetails(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Operação</SheetTitle>
            <SheetDescription>
              Informações completas relativas à operação do dia.
            </SheetDescription>
          </SheetHeader>

          {selectedOpDetails && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Fornecedor / Operação</p>
                <p className="text-sm text-muted-foreground">{selectedOpDetails.fornecedores?.nome || selectedOpDetails.produto_label || "Sem fornecedor"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Data da Operação</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedOpDetails.data_operacao
                      ? new Date(selectedOpDetails.data_operacao + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Qtd. Colaboradores</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.quantidade_colaboradores ?? 1} col.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Serviço</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.tipos_servico_operacional?.nome || selectedOpDetails.tipo_servico_label || "Sem serviço"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Transportadora</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.transportadoras_clientes?.nome || selectedOpDetails.transportadora_label || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">NF Número</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.nf_numero || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">CTRC</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.ctrc || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">ID da Planilha</p>
                  <p className="text-sm text-muted-foreground">{String(getLinhaOriginalValue(selectedOpDetails, "ID") || "—")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Empresa da Planilha</p>
                  <p className="text-sm text-muted-foreground">{String(getLinhaOriginalValue(selectedOpDetails, "EMPRESA") || "—")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Forma de Pagamento</p>
                  <p className="text-sm text-muted-foreground">{String(getLinhaOriginalValue(selectedOpDetails, "FORMA DE PAGAMENTO") || "—")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Observação</p>
                  <p className="text-sm text-muted-foreground">{String(getLinhaOriginalValue(selectedOpDetails, "OBSERVAÇÃO", "OBSERVACAO") || "—")}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Valores Principais</p>
                <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-3 bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Desk. / OP</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_descarga || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento Liq. NF</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_faturamento_nf || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Filme e Impostos (%)</p>
                <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-3 bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo. ISS Tot.</p>
                    <p className="text-sm text-foreground">
                      {Number(selectedOpDetails.custo_com_iss || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo. Filme Tot.</p>
                    <p className="text-sm text-foreground">
                      {Number(selectedOpDetails.valor_total_filme || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>

              {selectedOpDetails.avaliacao_json?.linha_original && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Conteúdo original da planilha</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {JSON.stringify(selectedOpDetails.avaliacao_json.linha_original, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end">
                <Button variant="outline" onClick={() => setSelectedOpDetails(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
