import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calculator,
  Calendar as CalendarIcon,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileBadge2,
  FileText,
  FileUp,
  HandCoins,
  History,
  Loader2,
  LucideIcon,
  Package,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Settings2,
  ShoppingCart,
  Truck,
  Upload,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOperationalPipeline, buildCustosExtrasPipeline } from "@/contexts/OperationalPipelineContext";

import { AppShell } from "@/components/layout/AppShell";
import { CustosExtrasTableBlock } from "@/components/operacoes/CustosExtrasTableBlock";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  AIService,
  CustoExtraOperacionalService,
  EmpresaService,
} from "@/services/base.service";

type EmpresaOption = {
  id: string;
  nome: string;
};

type CustoExtraRecord = {
  id?: string;
  data?: string | null;
  empresa_id?: string | null;
  total?: number | null;
  status_pagamento?: string | null;
  categoria_custo?: string | null;
  [key: string]: unknown;
};

type RowValue = string | number | boolean | null | undefined;
type SpreadsheetRow = Record<string, RowValue>;
const SHEET_ORIGIN_FIELD = "origem_aba";

type CategoriaCustoExtra =
  | "MERENDA"
  | "ADMINISTRATIVO"
  | "OPERACIONAL"
  | "FORNECEDOR";

type ImportedExtraCostPayload = {
  data: string | null;
  empresa_nome: string | null;
  categoria_custo: CategoriaCustoExtra;
  descricao: string;
  valor_unitario: number;
  quantidade: number;
  total: number;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  status_pagamento: "PENDENTE" | "ATRASADO" | "RECEBIDO" | null;
  operacao_id: string | null;
  tipo_lancamento: "DESPESA";
  avaliacao_json: Record<string, unknown>;
  origem_dado: "importacao";
};

const normalizeSpreadsheetRow = (row: SpreadsheetRow) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? format(value, "yyyy-MM-dd HH:mm:ss") : value,
    ]),
  );

const parseExcelDate = (val: RowValue): string | null => {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return format(val, "yyyy-MM-dd");
  }
  if (typeof val === "number") {
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + val * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch { return null; }
  }
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
};

const parseNumericCell = (val: RowValue): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const normalized = String(val).replace(/[R$\sA-Za-z]/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLookupText = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(":", "").trim();

const EXTRA_COST_BLOCK_CATEGORY_MAP: Record<string, CategoriaCustoExtra> = {
  "CUSTOS COM MERENDA": "MERENDA",
  "CUSTOS ADMINISTRATIVO": "ADMINISTRATIVO",
  "CUSTOS COM OPERACIONAL": "OPERACIONAL",
  "CUSTOS COM FORNECEDOR": "FORNECEDOR",
};

const normalizeCategoryBlockTitle = (value: unknown) => normalizeLookupText(value).replace(/:$/g, "");

const normalizePaymentStatus = (value: RowValue): ImportedExtraCostPayload["status_pagamento"] => {
  const normalized = normalizeLookupText(value);
  if (normalized.includes("RECEB")) return "RECEBIDO";
  if (normalized.includes("ATRAS")) return "ATRASADO";
  if (normalized.includes("PEND")) return "PENDENTE";
  return null;
};

const parseCustosExtrasImport = (rows: SpreadsheetRow[]) => {
  const sheetRows = rows.filter((row) => normalizeLookupText(row[SHEET_ORIGIN_FIELD]).includes("CUSTOS EXTRAS"));
  if (sheetRows.length === 0) return [];
  const getRowNumericKeys = (row: SpreadsheetRow) => Object.keys(row).filter((key) => key !== SHEET_ORIGIN_FIELD && /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
  const rowToCellArray = (row: SpreadsheetRow) => getRowNumericKeys(row).map((key) => row[key]);
  const matrix = sheetRows.map(rowToCellArray);
  const titleRow = matrix[0] ?? [];
  const headerRow = matrix[1] ?? [];
  const blockStarts = titleRow.map((cell, index) => {
    const normalized = normalizeCategoryBlockTitle(cell);
    const categoria = EXTRA_COST_BLOCK_CATEGORY_MAP[normalized];
    return categoria ? { start: index, categoria } : null;
  }).filter((item): item is { start: number; categoria: CategoriaCustoExtra } => Boolean(item)).sort((a, b) => a.start - b.start);
  if (blockStarts.length === 0) return [];
  return blockStarts.flatMap((block, blockIndex) => {
    const end = (blockStarts[blockIndex + 1]?.start ?? headerRow.length) - 1;
    const headerEntries = headerRow.slice(block.start, end + 1).map((cell, offset) => ({ absoluteIndex: block.start + offset, normalized: normalizeLookupText(cell) }));
    const findHeaderIndex = (...aliases: string[]) => headerEntries.find((entry) => aliases.some((alias) => entry.normalized.includes(normalizeLookupText(alias))))?.absoluteIndex;
    const idIndex = findHeaderIndex("ID");
    const dataIndex = findHeaderIndex("DATA");
    const empresaIndex = findHeaderIndex("EMPRESA");
    const descricaoIndex = findHeaderIndex("DESCRICAO");
    const unitarioIndex = findHeaderIndex("VALOR UNITARIO", "UNITARIO");
    const quantidadeIndex = findHeaderIndex("QUANTIDADE", "QTD");
    const totalIndex = findHeaderIndex("TOTAL");
    const formaPagamentoIndex = findHeaderIndex("FORMA DE PAGAMENTO", "FORMA PGTO", "PAGAMENTO");
    const vencimentoIndex = findHeaderIndex("VENCIMENTO", "DATA VENCIMENTO");
    const statusIndex = findHeaderIndex("STATUS PGTO", "STATUS PAGTO", "STATUS");
    return matrix.slice(2).flatMap((row, rowOffset) => {
      const cells = row.slice(block.start, end + 1);
      if (!cells.some((cell) => cell !== null && cell !== "" && cell !== 0)) return [];
      const descricaoRaw = descricaoIndex !== undefined ? row[descricaoIndex] : null;
      if (normalizeLookupText(descricaoRaw) === "TOTAL") return [];
      const valorUnitario = unitarioIndex !== undefined ? parseNumericCell(row[unitarioIndex]) : 0;
      const quantidade = quantidadeIndex !== undefined ? parseNumericCell(row[quantidadeIndex]) : 0;
      const total = (totalIndex !== undefined ? parseNumericCell(row[totalIndex]) : 0) || valorUnitario * quantidade;
      const descricao = String(descricaoRaw ?? "").trim();
      if (!descricao && total === 0) return [];
      return [{
        data: dataIndex !== undefined ? parseExcelDate(row[dataIndex]) : null,
        empresa_nome: empresaIndex !== undefined ? String(row[empresaIndex] ?? "").trim() || null : null,
        categoria_custo: block.categoria,
        descricao: descricao || `${block.categoria} sem descricao`,
        valor_unitario: valorUnitario,
        quantidade,
        total,
        forma_pagamento: formaPagamentoIndex !== undefined ? String(row[formaPagamentoIndex] ?? "").trim() || null : null,
        data_vencimento: vencimentoIndex !== undefined ? parseExcelDate(row[vencimentoIndex]) : null,
        status_pagamento: statusIndex !== undefined ? normalizePaymentStatus(row[statusIndex]) : null,
        tipo_lancamento: "DESPESA" as const,
        avaliacao_json: { origem_importacao: "planilha", contexto_importacao: { linha_planilha: rowOffset + 3, bloco_categoria: block.categoria } },
        origem_dado: "importacao" as const,
      }];
    });
  });
};

type TopKpiCardProps = {
  label: string;
  value: string;
  helper?: string;
  size?: "large" | "small" | "xs";
  variant?: "default" | "primary" | "warning" | "success" | "muted" | "info";
  icon?: LucideIcon;
  iconColor?: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: format(new Date(2026, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
  })),
];

const YEAR_OPTIONS = Array.from(new Set(Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)))).sort((a, b) => Number(b) - Number(a));

const topKpiCardClasses: Record<NonNullable<TopKpiCardProps["size"]>, string> = { large: "p-5 min-h-[148px]", small: "p-4 min-h-[108px]", xs: "p-3 min-h-[80px]" };

const TopKpiCard = ({ label, value, helper, size = "large", variant = "default", icon: Icon, iconColor = "bg-primary-soft text-primary" }: TopKpiCardProps) => (
  <div className={cn("group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5", variant === "primary" ? "esc-card bg-primary text-primary-foreground border-primary shadow-lg" : variant === "muted" ? "bg-muted/30 border border-border rounded-xl" : "esc-card shadow-sm hover:shadow-md", topKpiCardClasses[size])}>
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("space-y-1.5", size === "xs" && "space-y-0.5")}>
          <div className={cn("font-display font-medium", size === "xs" ? "text-xs" : "text-sm", variant === "primary" ? "text-primary-foreground/90" : "text-muted-foreground")}>{label}</div>
          <div className={cn("font-display font-bold leading-none", size === "large" ? "text-[28px]" : size === "small" ? "text-2xl" : "text-xl", variant === "primary" ? "text-primary-foreground" : "text-foreground")}>{value}</div>
        </div>
        {Icon && <div className={cn("shrink-0 rounded-md flex items-center justify-center", iconColor, size === "xs" ? "h-8 w-8" : "h-10 w-10")}><Icon className={size === "xs" ? "h-4 w-4" : "h-5 w-5"} /></div>}
      </div>
      {size !== "xs" && helper && <div className={cn("truncate text-[13px] leading-snug", variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>{helper}</div>}
    </div>
  </div>
);

const CATEGORIAS_CUSTO: Array<{ value: CategoriaCustoExtra; label: string; icon: LucideIcon }> = [
  { value: "OPERACIONAL", label: "Operacional", icon: Truck },
  { value: "ADMINISTRATIVO", label: "Administrativo", icon: Building2 },
  { value: "MERENDA", label: "Merenda", icon: UtensilsCrossed },
  { value: "FORNECEDOR", label: "Fornecedor", icon: ShoppingCart },
];

const STATUS_PAGAMENTO: Array<{ value: NonNullable<ImportedExtraCostPayload["status_pagamento"]>; label: string }> = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "RECEBIDO", label: "Pago / Recebido" },
  { value: "ATRASADO", label: "Atrasado" },
];

const CustosExtrasLancamento = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openPipeline } = useOperationalPipeline();
  const today = format(new Date(), "yyyy-MM-dd");

  const [activeTab, setActiveTab] = useState("historico");
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "MM"));
  const [filterYear, setFilterYear] = useState<string>(format(new Date(), "yyyy"));

  const [form, setForm] = useState({
    data: today,
    empresa_id: "",
    categoria_custo: "OPERACIONAL" as CategoriaCustoExtra,
    descricao: "",
    valor_unitario: "",
    quantidade: "1",
    forma_pagamento: "",
    data_vencimento: "",
    status_pagamento: "PENDENTE" as const,
    observacao: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-all"], queryFn: () => EmpresaService.getAll() });

  const { data: custosExtras = [], isLoading: isLoadingCustos } = useQuery({
    queryKey: ["custos-extras", filterEmpresaId, filterMonth, filterYear],
    queryFn: () => CustoExtraOperacionalService.getByCompetencia(`${filterYear}-${filterMonth}`, filterEmpresaId === "all" ? undefined : filterEmpresaId),
  });

  const kpis = useMemo(() => {
    const totalCompetencia = custosExtras.reduce((acc, item) => acc + Number(item.total ?? 0), 0);
    const porCategoria = { OPERACIONAL: 0, ADMINISTRATIVO: 0, MERENDA: 0, FORNECEDOR: 0 };
    custosExtras.forEach(item => {
      if (item.categoria_custo && item.categoria_custo in porCategoria) porCategoria[item.categoria_custo as keyof typeof porCategoria] += Number(item.total ?? 0);
    });
    return { totalCompetencia, porCategoria };
  }, [custosExtras]);

  const setFormField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const parseNumeric = (value: string): number => {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.empresa_id) errors.empresa_id = "Selecione a empresa";
    if (!form.data) errors.data = "Selecione a data";
    if (!form.descricao.trim()) errors.descricao = "Informe a descrição";
    if (parseNumeric(form.valor_unitario) <= 0) errors.valor_unitario = "Informe o valor";
    if (parseNumeric(form.quantidade) <= 0) errors.quantidade = "Quantidade inválida";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const salvarManualMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error("Dados inválidos");
      const valorUnitario = parseNumeric(form.valor_unitario);
      const quantidade = parseNumeric(form.quantidade);
      const payload = {
        data: form.data,
        empresa_id: form.empresa_id,
        categoria_custo: form.categoria_custo,
        descricao: form.descricao.trim(),
        valor_unitario: valorUnitario,
        quantidade: quantidade,
        total: valorUnitario * quantidade,
        forma_pagamento: form.forma_pagamento.trim() || null,
        data_vencimento: form.data_vencimento || null,
        status_pagamento: form.status_pagamento,
        tipo_lancamento: "DESPESA",
        responsavel_id: user?.id,
        origem_dado: "manual",
        observacao: form.observacao.trim() || null,
        avaliacao_json: { contexto_lancamento: "manual_erp", criado_por: user?.email },
      };
      return CustoExtraOperacionalService.createMany([payload]);
    },
    onSuccess: () => {
      toast.success("Custo extra registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      queryClient.invalidateQueries({ queryKey: ["custos-pipeline"] });
      setForm((prev) => ({ ...prev, descricao: "", valor_unitario: "", quantidade: "1", observacao: "" }));
      setActiveTab("historico");
    },
    onError: (err: any) => toast.error("Erro ao salvar lançamento", { description: err.message }),
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleImportCustosExtras = async (data: SpreadsheetRow[]) => {
    if (!filterEmpresaId || filterEmpresaId === "all") {
      toast.warning("Selecione uma empresa especifica antes de importar");
      return;
    }
    try {
      const importedCosts = parseCustosExtrasImport(data);
      if (importedCosts.length === 0) {
        toast.warning("Nenhuma linha valida foi encontrada em CUSTOS EXTRAS.");
        return;
      }
      const replacedCount = await CustoExtraOperacionalService.replaceImportedBatch(filterEmpresaId, importedCosts);
      toast.success(`${replacedCount} custo(s) extra(s) importado(s) com sucesso!`);
      const empresaNome = empresas?.find(e => e.id === filterEmpresaId)?.nome || "Empresa";
      openPipeline(buildCustosExtrasPipeline({ competencia: `${filterYear}-${filterMonth}`, empresa: empresaNome, currentStep: "lancamento" }));
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      setIsImportModalOpen(false);
    } catch (error: any) {
      toast.error("Erro na importacao", { description: error.message });
    }
  };

  const valorUnitario = parseNumeric(form.valor_unitario);
  const quantidade = parseNumeric(form.quantidade);
  const valorTotal = valorUnitario * quantidade;

  return (
    <AppShell title="Custos Extras" subtitle="Otimize o controle de despesas administrativas e operacionais">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="w-fit p-1 bg-muted/60 border border-border">
            <TabsTrigger value="historico" className="text-xs font-bold uppercase tracking-wider">
              <History className="h-3.5 w-3.5 mr-2" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="lancamento" className="text-xs font-bold uppercase tracking-wider">
              <Plus className="h-3.5 w-3.5 mr-2" /> Novo Lançamento
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/producao")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>

        <TabsContent value="historico" className="m-0 space-y-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <section className="flex-1 space-y-6">
              <div className="esc-card p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Empresa</Label>
                    <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                      <SelectTrigger className="w-full bg-muted/30 border-muted">
                        <div className="flex items-center min-w-0 truncate">
                          <Building2 className="h-4 w-4 mr-2 text-primary shrink-0" />
                          <SelectValue placeholder="Selecione a empresa" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Empresas</SelectItem>
                        {(empresas as EmpresaOption[]).map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mês</Label>
                      <Select value={filterMonth} onValueChange={setFilterMonth}>
                        <SelectTrigger className="w-[140px] bg-muted/30 border-muted">
                          <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_FILTER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ano</Label>
                      <Select value={filterYear} onValueChange={setFilterYear}>
                        <SelectTrigger className="w-[110px] bg-muted/30 border-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {YEAR_OPTIONS.map((y) => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="self-end pb-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => { setFilterMonth(format(new Date(), "MM")); setFilterYear(format(new Date(), "yyyy")); }}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Resetar para hoje</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <TopKpiCard label="Total Competência" value={formatCurrency(kpis.totalCompetencia)} icon={Wallet} iconColor="bg-blue-50 text-blue-600" />
                <TopKpiCard label="Operacional" value={formatCurrency(kpis.porCategoria.OPERACIONAL)} icon={Truck} iconColor="bg-green-50 text-green-600" />
                <TopKpiCard label="Administrativo" value={formatCurrency(kpis.porCategoria.ADMINISTRATIVO)} icon={Building2} iconColor="bg-purple-50 text-purple-600" />
                <TopKpiCard label="Merenda" value={formatCurrency(kpis.porCategoria.MERENDA)} icon={UtensilsCrossed} iconColor="bg-orange-50 text-orange-600" />
              </div>

              <div className="esc-card min-h-[500px] overflow-hidden flex flex-col">
                <div className="p-4 border-b bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="font-display font-bold text-base flex items-center gap-2 shrink-0">
                    <History className="h-4 w-4 text-primary" />
                    Listagem de Custos Extras
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="font-bold border-primary/20 hover:border-primary/50 text-primary whitespace-nowrap" onClick={() => setIsImportModalOpen(true)}>
                      <FileUp className="h-4 w-4 mr-2" /> Importar Planilha
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {isLoadingCustos ? (
                    <div className="p-20 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm font-medium">Carregando lançamentos...</p>
                    </div>
                  ) : (
                    <CustosExtrasTableBlock data={custosExtras} />
                  )}
                </div>
              </div>
            </section>

            <aside className="w-full lg:w-[340px] space-y-6">
              <section className="esc-card p-5 border-l-4 border-l-primary bg-primary-soft/10">
                <div className="flex items-center gap-2 text-primary mb-4"><BarChart3 className="h-5 w-5" /><h4 className="font-display font-bold text-sm uppercase tracking-wider">Análise Mensal</h4></div>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-card border border-border/60">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Taxa de Engajamento</p>
                    <div className="flex items-baseline justify-between"><p className="text-lg font-display font-bold">100%</p><Badge variant="secondary" className="bg-green-100 text-green-700 border-0">Ótimo</Badge></div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border/60">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Lançamentos Realizados</p>
                    <p className="text-lg font-display font-bold">{custosExtras.length}</p>
                  </div>
                </div>
              </section>
              <section className="esc-card p-5">
                <div className="flex items-center gap-2 text-amber-600 mb-4"><AlertTriangle className="h-5 w-5" /><h4 className="font-display font-bold text-sm uppercase tracking-wider">Gargalos Detectados</h4></div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">"Nenhum desvio crítico detectado para a empresa e competência selecionadas."</p>
              </section>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="lancamento" className="m-0">
          <div className="max-w-3xl mx-auto space-y-6 pb-28 pt-4">
            <section className="esc-card p-6 space-y-6">
              <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Identificação do Custo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Empresa <span className="text-destructive">*</span></Label>
                  <Select value={form.empresa_id} onValueChange={(v) => setFormField("empresa_id", v)}>
                    <SelectTrigger className={cn(formErrors.empresa_id && "border-destructive")}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>{(empresas as EmpresaOption[]).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                  </Select>
                  {formErrors.empresa_id && <p className="text-xs text-destructive">{formErrors.empresa_id}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Data do Gasto <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.data} onChange={(e) => setFormField("data", e.target.value)} className={cn(formErrors.data && "border-destructive")} />
                  {formErrors.data && <p className="text-xs text-destructive">{formErrors.data}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Categoria <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {CATEGORIAS_CUSTO.map((cat) => (
                    <button key={cat.value} type="button" onClick={() => setFormField("categoria_custo", cat.value)} className={cn("flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2", form.categoria_custo === cat.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30 hover:bg-muted/30 text-muted-foreground")}><cat.icon className="h-5 w-5" /><span className="text-xs font-bold uppercase">{cat.label}</span></button>
                  ))}
                </div>
              </div>
            </section>

            <section className="esc-card p-6 space-y-6">
              <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Valores e Detalhes</h3>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Descrição <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Ex: Compra de materiais de escritório, Lanche para equipe, etc." value={form.descricao} onChange={(e) => setFormField("descricao", e.target.value)} className={cn(formErrors.descricao && "border-destructive")} rows={3} />
                {formErrors.descricao && <p className="text-xs text-destructive">{formErrors.descricao}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Valor Unitário <span className="text-destructive">*</span></Label>
                  <div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span><Input type="number" step="0.01" className={cn("pl-9", formErrors.valor_unitario && "border-destructive")} placeholder="0,00" value={form.valor_unitario} onChange={(e) => setFormField("valor_unitario", e.target.value)} /></div>
                  {formErrors.valor_unitario && <p className="text-xs text-destructive">{formErrors.valor_unitario}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Quantidade <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" className={cn(formErrors.quantidade && "border-destructive")} value={form.quantidade} onChange={(e) => setFormField("quantidade", e.target.value)} />
                  {formErrors.quantidade && <p className="text-xs text-destructive">{formErrors.quantidade}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Total</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border-2 border-primary/20 bg-primary/5 text-primary font-mono font-bold">{formatCurrency(valorTotal)}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Meio de Pagamento</Label>
                  <Input placeholder="Ex: Dinheiro, PIX, Cartão..." value={form.forma_pagamento} onChange={(e) => setFormField("forma_pagamento", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Status Inicial</Label>
                  <Select value={form.status_pagamento} onValueChange={(v: any) => setFormField("status_pagamento", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_PAGAMENTO.map((st) => (<SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Observações</Label>
                <Textarea placeholder="Alguma nota importante sobre este custo..." value={form.observacao} onChange={(e) => setFormField("observacao", e.target.value)} rows={2} />
              </div>
            </section>

            <div className="sticky bottom-6 z-20">
              <div className="flex justify-end items-center bg-card/95 backdrop-blur p-4 rounded-2xl border border-border shadow-2xl">
                <div className="flex items-center gap-4">
                  {Object.keys(formErrors).length > 0 && <span className="text-xs text-destructive flex items-center gap-1 font-bold uppercase tracking-wider"><AlertCircle className="w-4 h-4" /> Corrija os campos</span>}
                  <Button size="lg" className="min-w-[200px] font-display font-bold shadow-lg shadow-primary/20" onClick={() => salvarManualMutation.mutate()} disabled={salvarManualMutation.isPending}><Save className="h-4 w-4 mr-2" />{salvarManualMutation.isPending ? "Salvando..." : "Salvar Lançamento"}</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <SpreadsheetUploadModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} title="Importar Custos Extras via Planilha" description="A importacao procurara a aba CUSTOS EXTRAS e os blocos CUSTOS COM MERENDA, CUSTOS ADMINISTRATIVO, CUSTOS COM OPERACIONAL e CUSTOS COM FORNECEDOR. Cada linha herdara a categoria do bloco." onUpload={handleImportCustosExtras} />
    </AppShell>
  );
};
export default CustosExtrasLancamento;
