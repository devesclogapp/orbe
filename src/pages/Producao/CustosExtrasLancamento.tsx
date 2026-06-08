import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  Loader2,
  Package,
  Plus,
  Receipt,
  Save,
  Truck,
  UtensilsCrossed,
  ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { OperationalShell } from "@/components/layout/OperationalShell";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  CustoExtraOperacionalService,
  EmpresaService,
  MaterialOperacionalService,
} from "@/services/base.service";

type EmpresaOption = {
  id: string;
  nome: string;
};

type CategoriaCustoExtra =
  | "MERENDA"
  | "ADMINISTRATIVO"
  | "OPERACIONAL"
  | "FORNECEDOR";

const CATEGORIAS_CUSTO: Array<{ value: CategoriaCustoExtra; label: string; icon: any }> = [
  { value: "OPERACIONAL", label: "Operacional", icon: Truck },
  { value: "ADMINISTRATIVO", label: "Administrativo", icon: Building2 },
  { value: "MERENDA", label: "Merenda", icon: UtensilsCrossed },
  { value: "FORNECEDOR", label: "Fornecedor", icon: ShoppingCart },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const CustosExtrasLancamento = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState({
    data: today,
    empresa_id: "",
    categoria_custo: "OPERACIONAL" as CategoriaCustoExtra,
    material_id: "",
    custo_descricao_manual: "",
    valor_unitario: "",
    quantidade: "1",
    forma_pagamento: "",
    data_vencimento: "",
    status_pagamento: "PENDENTE" as const,
    observacao: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-all"], queryFn: () => EmpresaService.getAll() });

  const { data: historicoHoje = [], isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["custos-extras-hoje", today],
    queryFn: () => CustoExtraOperacionalService.getByDate(today),
  });

  const setFormField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-ativos"],
    queryFn: () => MaterialOperacionalService.getAllActive(),
  });

  const materialSelecionado = useMemo(() =>
    (materiais as any[]).find(m => m.id === form.material_id),
    [materiais, form.material_id]
  );

  useEffect(() => {
    if (materialSelecionado) {
      setFormField("valor_unitario", String(materialSelecionado.valor_unitario || "0"));
    }
  }, [materialSelecionado]);

  const parseNumeric = (value: string): number => {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.empresa_id) errors.empresa_id = "Selecione a empresa";
    if (!form.data) errors.data = "Selecione a data";
    if (!form.material_id && !form.custo_descricao_manual.trim()) errors.material_id = "Selecione um item ou informe a descrição";
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
        material_id: form.material_id || null,
        categoria_custo: form.categoria_custo,
        descricao: (materialSelecionado?.nome || form.custo_descricao_manual).trim(),
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
        avaliacao_json: { contexto_lancamento: "manual_operacional", criado_por: user?.email },
      };
      return CustoExtraOperacionalService.createMany([payload]);
    },
    onSuccess: () => {
      toast.success("Custo extra registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["custos-extras-hoje"] });
      setForm({
        ...form,
        material_id: "",
        custo_descricao_manual: "",
        valor_unitario: "",
        quantidade: "1",
        observacao: "",
      });
    },
    onError: (err: any) => toast.error("Erro ao salvar lançamento", { description: err.message }),
  });

  const valorTotal = parseNumeric(form.valor_unitario) * parseNumeric(form.quantidade);

  return (
    <OperationalShell title="Lançamento de Custo Extra">
      <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Novo Lançamento
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate("/producao")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FORMULÁRIO */}
          <div className="space-y-6">
            <section className="esc-card p-6 space-y-6">
              <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Identificação</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Empresa <span className="text-destructive">*</span></Label>
                  <Select value={form.empresa_id} onValueChange={(v) => setFormField("empresa_id", v)}>
                    <SelectTrigger className={cn(formErrors.empresa_id && "border-destructive")}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>{(empresas as EmpresaOption[]).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Data <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.data} onChange={(e) => setFormField("data", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Categoria <span className="text-destructive">*</span></Label>
                    <Select value={form.categoria_custo} onValueChange={(v: any) => setFormField("categoria_custo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIAS_CUSTO.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </section>

            <section className="esc-card p-6 space-y-6">
              <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Valores</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Item / Material <span className="text-destructive">*</span></Label>
                  <Select value={form.material_id} onValueChange={(v) => setFormField("material_id", v)}>
                    <SelectTrigger className={cn(formErrors.material_id && "border-destructive")}>
                      <SelectValue placeholder="Selecione o item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(materiais as any[]).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome} ({formatCurrency(m.valor_unitario || 0)})
                        </SelectItem>
                      ))}
                      <SelectItem value="">Outro (Descrição Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!form.material_id && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Descrição Manual</Label>
                    <Input placeholder="O que foi gasto?" value={form.custo_descricao_manual} onChange={(e) => setFormField("custo_descricao_manual", e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Quantidade</Label>
                    <Input type="number" value={form.quantidade} onChange={(e) => setFormField("quantidade", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Valor Unit.</Label>
                    <Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setFormField("valor_unitario", e.target.value)} readOnly={!!form.material_id} className={cn(form.material_id && "bg-muted/50")} />
                  </div>
                </div>
                <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-primary">Total</span>
                  <span className="text-xl font-bold text-primary font-mono">{formatCurrency(valorTotal)}</span>
                </div>
              </div>
            </section>

            <Button
              className="w-full size-lg font-bold py-6 text-lg shadow-xl shadow-primary/20"
              onClick={() => salvarManualMutation.mutate()}
              disabled={salvarManualMutation.isPending}
            >
              {salvarManualMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Finalizar Lançamento
            </Button>
          </div>

          {/* HISTÓRICO DE HOJE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
              {isLoadingHistorico ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando...</div>
              ) : historicoHoje.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">
                  Nenhum custo registrado hoje.
                </div>
              ) : (
                (historicoHoje as any[]).map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.empresas?.nome || "Empresa"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Package className="h-2.5 w-2.5" />
                          {item.descricao || "Custo"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-destructive">{formatCurrency(item.total)}</p>
                        <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase opacity-70">
                          {item.categoria_custo}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </OperationalShell>
  );
};

export default CustosExtrasLancamento;
