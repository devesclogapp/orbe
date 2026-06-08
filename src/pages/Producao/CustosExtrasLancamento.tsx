import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Save,
  Loader2,
  History,
  Package,
  Building2,
  FileText,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  EmpresaService,
  UnidadeOperacionalService,
  FormaPagamentoOperacionalService,
  CustoExtraOperacionalService,
} from "@/services/base.service";
import { cn } from "@/lib/utils";

type CategoriaCustoExtra = "OPERACIONAL" | "ADMINISTRATIVO" | "MERENDA/LANCHE" | "MANUTENCAO" | "TRANSPORTE" | "COMUNICACAO" | "OUTROS";

const CATEGORIAS_CUSTO: { value: CategoriaCustoExtra; label: string }[] = [
  { value: "MERENDA/LANCHE", label: "Merenda/Lanche" },
  { value: "COMUNICACAO", label: "Comunicação" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "OPERACIONAL", label: "Operacional" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "OUTROS", label: "Outros" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const CustosExtrasLancamento = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState(2); // Inicia no passo 2 pois o 1 foi a seleção de rota
  const today = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState({
    empresa_id: user?.user_metadata?.empresa_id || "",
    unidade_id: "",
    data: today,
    categoria: "MERENDA/LANCHE" as CategoriaCustoExtra,
    descricao: "",
    valor_unitario: 0,
    quantidade: 1,
    forma_pagamento_id: "",
    observacao: "",
  });

  // Queries
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getAll() });
  const { data: unidades = [], isFetching: isFetchingUnidades } = useQuery({
    queryKey: ["unidades", form.empresa_id],
    queryFn: () => UnidadeOperacionalService.getByEmpresa(form.empresa_id),
    enabled: !!form.empresa_id
  });
  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento_ativas"],
    queryFn: () => FormaPagamentoOperacionalService.getAllActive()
  });
  const { data: historicoHoje = [], isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["custos-extras-hoje", today],
    queryFn: () => CustoExtraOperacionalService.getByDate(today),
  });

  const setFormField = (field: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "empresa_id") next.unidade_id = "";
      return next;
    });
  };

  const totalCalculado = useMemo(() => {
    return (form.valor_unitario || 0) * (form.quantidade || 0);
  }, [form.valor_unitario, form.quantidade]);

  const handleNext = () => {
    if (etapa === 2) {
      if (!form.empresa_id) return toast.warning("Selecione a empresa.");
      if (!form.categoria) return toast.warning("Selecione a categoria.");
    }
    if (etapa === 3) {
      if (!form.descricao) return toast.warning("Informe a descrição.");
      if (form.valor_unitario <= 0) return toast.warning("Informe o valor unitário.");
    }
    setEtapa(prev => prev + 1);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.forma_pagamento_id) throw new Error("Selecione a forma de pagamento.");
      const payload = {
        ...form,
        tenant_id: user?.user_metadata?.tenant_id,
        categoria_custo: form.categoria,
        status_pagamento: "PENDENTE",
        pipeline_status: "EM_VALIDACAO",
        origem_dado: "manual",
        origem_lancamento: "encarregado",
        total: totalCalculado,
        responsavel_id: user?.id,
      };
      delete (payload as any).categoria;
      return CustoExtraOperacionalService.createMany([payload]);
    },
    onSuccess: () => {
      toast.success("Custo extra registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["custos-extras-hoje"] });
      navigate("/producao");
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message)
  });

  return (
    <OperationalShell title="Lançamento de Custos Extras" hideFab>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Header do Wizard */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => etapa === 2 ? navigate("/producao") : setEtapa(prev => prev - 1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Passo {etapa} de 4</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
                {etapa === 2 ? "Contexto Operacional" : etapa === 3 ? "Detalhamento e Valores" : "Financeiro / Finalização"}
              </p>
            </div>
          </div>
          <div className="hidden md:block w-48">
            <Progress value={(etapa / 4) * 100} className="h-2" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Passo 2: Contexto */}
          {etapa === 2 && (
            <div className="esc-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Empresa <span className="text-destructive">*</span></Label>
                    <Select value={form.empresa_id} onValueChange={(v) => setFormField("empresa_id", v)}>
                      <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                      <SelectContent>{empresas.map((emp: any) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Unidade (Opcional)</Label>
                    <Select value={form.unidade_id} onValueChange={(v) => setFormField("unidade_id", v)} disabled={!form.empresa_id || isFetchingUnidades}>
                      <SelectTrigger className="h-12"><SelectValue placeholder={isFetchingUnidades ? "Carregando..." : "Selecione a unidade"} /></SelectTrigger>
                      <SelectContent>{unidades.map((u: any) => (<SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Categoria <span className="text-destructive">*</span></Label>
                    <Select value={form.categoria} onValueChange={(v: any) => setFormField("categoria", v)}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIAS_CUSTO.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Data da Operação <span className="text-destructive">*</span></Label>
                    <Input type="date" className="h-12" value={form.data} onChange={(e) => setFormField("data", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Passo 3: Valores */}
          {etapa === 3 && (
            <div className="esc-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Descrição <span className="text-destructive">*</span></Label>
                  <Input className="h-12" placeholder="O que foi gasto?" value={form.descricao} onChange={(e) => setFormField("descricao", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Quantidade</Label>
                    <Input type="number" className="h-12" value={form.quantidade} onChange={(e) => setFormField("quantidade", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Valor Unitário</Label>
                    <Input type="number" step="0.01" className="h-12" value={form.valor_unitario} onChange={(e) => setFormField("valor_unitario", Number(e.target.value))} />
                  </div>
                </div>
                <div className="p-6 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between">
                  <span className="text-sm font-bold uppercase text-primary">Total Estimado</span>
                  <span className="text-3xl font-black text-primary font-mono">{formatCurrency(totalCalculado)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Passo 4: Financeiro */}
          {etapa === 4 && (
            <div className="esc-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Forma de Pagamento <span className="text-destructive">*</span></Label>
                  <Select value={form.forma_pagamento_id} onValueChange={(v) => setFormField("forma_pagamento_id", v)}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                    <SelectContent>{formasPagamento.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500">Observações (Opcional)</Label>
                  <Input className="h-12" placeholder="Detalhes adicionais..." value={form.observacao} onChange={(e) => setFormField("observacao", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between gap-4 z-50 lg:left-64">
            <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => etapa === 2 ? navigate("/producao") : setEtapa(prev => prev - 1)}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            {etapa < 4 ? (
              <Button type="button" className="flex-1 h-12" onClick={handleNext}>
                Próximo <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 h-12 bg-primary"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Finalizar Lançamento
              </Button>
            )}
          </div>

          {/* Lançamentos de Hoje */}
          <div className="space-y-4 pt-10 border-t border-slate-200">
            <div className="flex items-center gap-2 px-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
              {isLoadingHistorico ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando...</div>
              ) : historicoHoje.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">Nenhum custo registrado hoje.</div>
              ) : (
                (historicoHoje as any[]).map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.empresas?.nome || "Empresa"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Package className="h-2.5 w-2.5" /> {item.descricao}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-destructive">{formatCurrency(item.total)}</p>
                        <span className="text-[8px] uppercase font-bold text-slate-400 bg-slate-100 px-1 rounded">{item.categoria_custo}</span>
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
