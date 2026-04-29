import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Hash,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  Package,
  Pencil,
  Settings2,
  Trash2,
  Truck,
  User,
} from "lucide-react";

import { useSelection } from "@/contexts/SelectionContext";
import { cn } from "@/lib/utils";
import { OperacaoService } from "@/services/base.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type OperacoesTableBlockProps = {
  date: string;
  empresaId: string;
  filterByDate?: boolean;
  respectCompanyFilter?: boolean;
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

export const OperacoesTableBlock = ({
  date,
  empresaId,
  filterByDate = true,
  respectCompanyFilter = true,
}: OperacoesTableBlockProps) => {
  const { id: selectedId, kind } = useSelection();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOpDetails, setSelectedOpDetails] = useState<any>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const STORAGE_KEY = "orbe_visibleCols_operacoes_v3";

  const defaultCols = {
    data: true,
    operacao: true, transportadora: true, servico: true, qtd: true,
    inicio: false, fim: false, valUnit: true, valDia: true, status: true, acoes: true,
    nf: false, ctrc: false, percentualIss: false, valorDescarga: false, custoIss: false,
    valorUnitarioFilme: false, quantidadeFilme: false, valorTotalFilme: false,
    valorFaturamentoNf: false, placa: false, fornecedor: false, qtdCol: true,
    idPlanilha: false, empresaPlanilha: false, formaPagamento: false, observacao: false,
  };

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultCols, ...JSON.parse(saved) };
    } catch {
      return defaultCols;
    }
    return defaultCols;
  });

  const scrollBy = useCallback((dir: "left" | "right") => {
    tableScrollRef.current?.scrollBy({ left: dir === "right" ? 220 : -220, behavior: "smooth" });
  }, []);

  const effectiveEmpresaId = respectCompanyFilter ? empresaId : "all";

  const operationsQueryKey = filterByDate
    ? ["operacoes", date, effectiveEmpresaId]
    : ["operacoes-grid", effectiveEmpresaId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: operationsQueryKey,
    queryFn: () =>
      filterByDate
        ? OperacaoService.getPainelByDate(date, effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId)
        : OperacaoService.getAllPainel(effectiveEmpresaId === "all" ? undefined : effectiveEmpresaId),
  });

  const filteredData = Array.isArray(rows) ? rows.filter((item: any) => {
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

  const toggleCol = (col: keyof typeof visibleCols) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allSelected = Object.values(visibleCols).every(Boolean);

  const toggleAll = () => {
    const newValue = !allSelected;
    const newCols = { ...visibleCols };
    Object.keys(newCols).forEach((key) => {
      newCols[key as keyof typeof visibleCols] = newValue;
    });
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
      valorFaturamentoNf: false, placa: false, fornecedor: false, qtdCol: true,
      idPlanilha: false, empresaPlanilha: false, formaPagamento: true, observacao: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importantesCols));
    setVisibleCols(importantesCols);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando operacoes...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 pt-2">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por fornecedor ou servico..."
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
              <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll} className="font-bold mb-1 bg-muted/50">
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
              {Object.keys(visibleCols).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleCols[key as keyof typeof visibleCols]}
                  onCheckedChange={() => toggleCol(key as keyof typeof visibleCols)}
                >
                  {key.toUpperCase()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => scrollBy("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 z-20 h-9 w-9 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/15 transition-all hover:scale-110 active:scale-95"
          title="Rolar para esquerda"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollBy("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 z-20 h-9 w-9 rounded-full bg-primary/10 border border-primary/20 shadow-md flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/15 transition-all hover:scale-110 active:scale-95"
          title="Rolar para direita"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div ref={tableScrollRef} className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-max">
            <thead className="esc-table-header">
              <tr className="text-left font-display">
                {visibleCols.data && <th className="px-3 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />DATA</span></th>}
                {visibleCols.idPlanilha && <th className="px-3 font-semibold text-center">ID</th>}
                {visibleCols.operacao && <th className="px-5 font-semibold py-3 sticky left-0 z-10 bg-muted/90 backdrop-blur-sm border-r border-border"><span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-muted-foreground" />OPERACAO</span></th>}
                {visibleCols.fornecedor && <th className="px-3 font-semibold">FORNECEDOR</th>}
                {visibleCols.transportadora && <th className="px-3 font-semibold"><span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-muted-foreground" />TRANSPORTADORA</span></th>}
                {visibleCols.placa && <th className="px-3 font-semibold">PLACA</th>}
                {visibleCols.servico && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-muted-foreground" />SERVICO</span></th>}
                {visibleCols.qtdCol && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />QTD. COL.</span></th>}
                {visibleCols.empresaPlanilha && <th className="px-3 font-semibold">EMPRESA PLANILHA</th>}
                {visibleCols.formaPagamento && <th className="px-3 font-semibold">FORMA PAGAMENTO</th>}
                {visibleCols.nf && <th className="px-3 font-semibold text-center">NF</th>}
                {visibleCols.ctrc && <th className="px-3 font-semibold text-center">CTRC</th>}
                {visibleCols.observacao && <th className="px-3 font-semibold">OBSERVACAO</th>}
                {visibleCols.percentualIss && <th className="px-3 font-semibold text-center">% ISS</th>}
                {visibleCols.qtd && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />QTD</span></th>}
                {visibleCols.inicio && <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />INICIO</span></th>}
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
                {visibleCols.acoes && <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Hourglass className="h-3.5 w-3.5 text-muted-foreground" />ACOES</span></th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item: any, index: number) => {
                const isSelected = kind === "operacao" && selectedId === item.id;
                const valorTotal = Number(item.valor_total_label ?? (Number(item.quantidade) * Number(item.valor_unitario || 0)));
                const fornecedor = item.fornecedores?.nome || item.produto_label || "Sem fornecedor";
                const servico = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "Sem servico";
                const operacaoNome = `${fornecedor} • ${servico}`;
                const transportadora = item.transportadoras_clientes?.nome || item.transportadora_label || "—";
                const placa = item.placa || "—";
                const nf = item.nf_numero || "—";
                const ctrc = item.ctrc || "—";
                const iss = item.percentual_iss ? `${(Number(item.percentual_iss) * 100).toFixed(0)}%` : "—";
                const idPlanilha = index + 1;
                const empresaPlanilha = getLinhaOriginalValue(item, "EMPRESA") || "—";
                const formaPagamento = getLinhaOriginalValue(item, "FORMA DE PAGAMENTO") || "—";
                const observacao = getLinhaOriginalValue(item, "OBSERVACAO", "OBSERVAÇÃO") || "—";
                const dataOp = item.data_operacao ? new Date(item.data_operacao + "T00:00:00").toLocaleDateString("pt-BR") : "—";
                const qtdColaboradores = item.quantidade_colaboradores ?? 1;
                let qtdText = String(item.quantidade_label || item.quantidade || 0);
                if (item.tipo_calculo_snapshot === "volume") qtdText += " vol(s)";
                else if (item.tipo_calculo_snapshot === "diaria") qtdText += " diaria(s)";
                else if (item.tipo_calculo_snapshot === "operacao") qtdText = "1 op";
                const inicio = item.horario_inicio_label ? String(item.horario_inicio_label).substring(0, 5) : "—";
                const fim = item.horario_fim_label ? String(item.horario_fim_label).substring(0, 5) : "—";
                const valUnitFormatter = (value: any) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const valUnit = valUnitFormatter(item.valor_unitario_label ?? item.valor_unitario ?? 0);
                const valDia = valUnitFormatter(valorTotal);
                const valorDescarga = valUnitFormatter(item.valor_descarga);
                const custoIss = valUnitFormatter(item.custo_com_iss);
                const unitFilme = valUnitFormatter(item.valor_unitario_filme);
                const qtdFilme = item.quantidade_filme || "—";
                const totFilme = valUnitFormatter(item.valor_total_filme);
                const fatNf = valUnitFormatter(item.valor_faturamento_nf);
                const statusCfg = getStatusConfig(item.status);

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedOpDetails(item)}
                    className={cn(
                      "esc-table-row cursor-pointer transition-all border-b border-border last:border-0 hover:bg-muted/50",
                      item.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                      isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                    )}
                  >
                    {visibleCols.data && <td className="px-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{dataOp}</td>}
                    {visibleCols.idPlanilha && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{String(idPlanilha)}</td>}
                    {visibleCols.operacao && <td className="px-5 py-3 font-medium whitespace-nowrap text-foreground sticky left-0 z-10 bg-background border-r border-border">{operacaoNome}</td>}
                    {visibleCols.fornecedor && <td className="px-3 text-muted-foreground whitespace-nowrap">{fornecedor}</td>}
                    {visibleCols.transportadora && <td className="px-3 text-muted-foreground whitespace-nowrap">{transportadora}</td>}
                    {visibleCols.placa && <td className="px-3 text-muted-foreground whitespace-nowrap">{placa}</td>}
                    {visibleCols.servico && <td className="px-3 text-center text-muted-foreground whitespace-nowrap">{servico}</td>}
                    {visibleCols.qtdCol && <td className="px-3 text-center font-display font-medium whitespace-nowrap">{qtdColaboradores}</td>}
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
                    {visibleCols.status && (
                      <td className="px-3 text-center whitespace-nowrap">
                        <Badge variant="outline" className={cn(statusCfg.className, "hover:bg-transparent font-medium border-0")}>
                          {statusCfg.label}
                        </Badge>
                      </td>
                    )}
                    {visibleCols.acoes && (
                      <td className="px-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/producao?id=${item.id}`; }}
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
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={22} className="p-12 text-center text-muted-foreground italic">
                    {filterByDate ? "Nenhuma operacao atende aos filtros atuais nesta data." : "Nenhuma operacao atende aos filtros atuais."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedOpDetails} onOpenChange={(value) => !value && setSelectedOpDetails(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da operacao</SheetTitle>
            <SheetDescription>Informacoes completas relativas a operacao do dia.</SheetDescription>
          </SheetHeader>

          {selectedOpDetails && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Fornecedor / Operacao</p>
                <p className="text-sm text-muted-foreground">{selectedOpDetails.fornecedores?.nome || selectedOpDetails.produto_label || "Sem fornecedor"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Data da operacao</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedOpDetails.data_operacao ? new Date(selectedOpDetails.data_operacao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Qtd. colaboradores</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.quantidade_colaboradores ?? 1} col.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Servico</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.tipos_servico_operacional?.nome || selectedOpDetails.tipo_servico_label || "Sem servico"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Transportadora</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.transportadoras_clientes?.nome || selectedOpDetails.transportadora_label || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">NF numero</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.nf_numero || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">CTRC</p>
                  <p className="text-sm text-muted-foreground">{selectedOpDetails.ctrc || "—"}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Valores principais</p>
                <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-3 bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor desc. / op</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_descarga || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento liq. NF</p>
                    <p className="text-sm font-medium text-foreground">
                      {Number(selectedOpDetails.valor_faturamento_nf || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>

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
