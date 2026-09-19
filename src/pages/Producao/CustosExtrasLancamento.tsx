import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useContextualReturn } from "@/hooks/useContextualReturn";
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
  Check,
  Building2,
  User,
  Clock,
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
  FornecedorService,
  CustoExtraOperacionalService,
} from "@/services/base.service";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  OPCOES_ORIGEM_RECURSO,
  buildCustoExtraInsertPayload,
  getOrigemRecursoBadge,
  type OrigemRecursoCustoExtra,
} from "@/types/custosExtrasForm";

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
  const { goBackUrl } = useContextualReturn("/producao");
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
    origem_recurso: "PAGO_EMPRESA" as OrigemRecursoCustoExtra,
    favorecido_colaborador_id: "",
    favorecido_fornecedor_id: "",
    data_vencimento: "",
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

  // Query para Colaboradores (quando REEMBOLSO_COLABORADOR)
  const { data: colaboradores = [], isLoading: isLoadingColabs } = useQuery({
    queryKey: ["colaboradores-ativos", form.empresa_id],
    queryFn: async () => {
      let q = supabase
        .from("colaboradores")
        .select("id, nome, cpf, status")
        .eq("status", "ativo");
      if (form.empresa_id) {
        q = q.or(`empresa_id.eq.${form.empresa_id},empresa_id.is.null`);
      }
      const { data, error } = await q.order("nome");
      if (error) {
        console.warn("Erro ao buscar colaboradores:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: form.origem_recurso === "REEMBOLSO_COLABORADOR",
  });

  // Query para Fornecedores (quando PAGAMENTO_PENDENTE)
  const { data: fornecedores = [], isLoading: isLoadingFornecedores } = useQuery({
    queryKey: ["fornecedores-ativos", form.empresa_id],
    queryFn: async () => {
      return FornecedorService.getByEmpresa(form.empresa_id);
    },
    enabled: form.origem_recurso === "PAGAMENTO_PENDENTE",
  });

  const setFormField = (field: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "empresa_id") next.unidade_id = "";
      return next;
    });
  };

  const handleOrigemChange = (origem: OrigemRecursoCustoExtra) => {
    setForm((prev) => ({
      ...prev,
      origem_recurso: origem,
      favorecido_colaborador_id: origem === "REEMBOLSO_COLABORADOR" ? prev.favorecido_colaborador_id : "",
      favorecido_fornecedor_id: origem === "PAGAMENTO_PENDENTE" ? prev.favorecido_fornecedor_id : "",
      data_vencimento: origem === "PAGAMENTO_PENDENTE" ? prev.data_vencimento : "",
    }));
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
      if (!form.descricao?.trim()) return toast.warning("Informe a descrição.");
      if (form.valor_unitario <= 0) return toast.warning("Informe o valor unitário maior que zero.");
    }
    setEtapa(prev => prev + 1);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.origem_recurso === "REEMBOLSO_COLABORADOR" && !form.favorecido_colaborador_id) {
        throw new Error("Selecione o colaborador que realizou o pagamento.");
      }
      if (!form.forma_pagamento_id) {
        throw new Error("Selecione a forma de pagamento.");
      }

      const payload = buildCustoExtraInsertPayload(
        {
          empresa_id: form.empresa_id,
          unidade_id: form.unidade_id || null,
          data: form.data,
          categoria: form.categoria,
          descricao: form.descricao,
          quantidade: form.quantidade,
          valor_unitario: form.valor_unitario,
          forma_pagamento_id: form.forma_pagamento_id,
          origem_recurso: form.origem_recurso,
          favorecido_colaborador_id: form.favorecido_colaborador_id || null,
          favorecido_fornecedor_id: form.favorecido_fornecedor_id || null,
          data_vencimento: form.data_vencimento || null,
          observacao: form.observacao || null,
        },
        {
          tenantId: user?.user_metadata?.tenant_id,
          userId: user?.id,
          origemLancamento: "encarregado",
        }
      );

      return CustoExtraOperacionalService.createMany([payload]);
    },
    onSuccess: () => {
      toast.success("Custo extra registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["custos-extras-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
      goBackUrl();
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message)
  });

  return (
    <OperationalShell title="Lançamento de Custos Extras" hideFab>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Header do Wizard */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => etapa === 2 ? goBackUrl() : setEtapa(prev => prev - 1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Passo {etapa} de 4</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
                {etapa === 2 ? "Contexto Operacional" : etapa === 3 ? "Detalhamento e Valores" : "Origem do Recurso e Financeiro"}
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

          {/* Passo 4: Origem do Recurso e Financeiro */}
          {etapa === 4 && (
            <div className="esc-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Quem pagou esta despesa? */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-slate-500">
                  Quem pagou esta despesa? <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {OPCOES_ORIGEM_RECURSO.map((opcao) => {
                    const isSelected = form.origem_recurso === opcao.value;
                    return (
                      <button
                        key={opcao.value}
                        type="button"
                        onClick={() => handleOrigemChange(opcao.value)}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                          isSelected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                        )}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-slate-900")}>
                              {opcao.label}
                            </span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                              opcao.value === "PAGO_EMPRESA" ? "bg-blue-100 text-blue-700" :
                              opcao.value === "REEMBOLSO_COLABORADOR" ? "bg-amber-100 text-amber-700" :
                              "bg-purple-100 text-purple-700"
                            )}>
                              {opcao.value === "PAGO_EMPRESA" ? "Empresa" : opcao.value === "REEMBOLSO_COLABORADOR" ? "Reembolso" : "Pendente"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {opcao.descricao}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Se REEMBOLSO_COLABORADOR: Selecionar Colaborador */}
              {form.origem_recurso === "REEMBOLSO_COLABORADOR" && (
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 animate-in fade-in duration-200">
                  <Label className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Colaborador a ser reembolsado <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.favorecido_colaborador_id}
                    onValueChange={(v) => setFormField("favorecido_colaborador_id", v)}
                  >
                    <SelectTrigger className="h-12 bg-white">
                      <SelectValue placeholder={isLoadingColabs ? "Carregando colaboradores..." : "Selecione o colaborador que pagou"} />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.length === 0 && !isLoadingColabs ? (
                        <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhum colaborador ativo encontrado</div>
                      ) : (
                        colaboradores.map((colab: any) => (
                          <SelectItem key={colab.id} value={colab.id}>
                            {colab.nome} {colab.cpf ? `(${colab.cpf})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-amber-700">
                    O colaborador selecionado receberá o reembolso correspondente ({formatCurrency(totalCalculado)}) após aprovação.
                  </p>
                </div>
              )}

              {/* Se PAGAMENTO_PENDENTE: Fornecedor e Vencimento */}
              {form.origem_recurso === "PAGAMENTO_PENDENTE" && (
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-purple-800 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        Fornecedor / Favorecido (Opcional)
                      </Label>
                      <Select
                        value={form.favorecido_fornecedor_id}
                        onValueChange={(v) => setFormField("favorecido_fornecedor_id", v)}
                      >
                        <SelectTrigger className="h-12 bg-white">
                          <SelectValue placeholder={isLoadingFornecedores ? "Carregando fornecedores..." : "Selecione o fornecedor"} />
                        </SelectTrigger>
                        <SelectContent>
                          {fornecedores.length === 0 && !isLoadingFornecedores ? (
                            <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhum fornecedor encontrado</div>
                          ) : (
                            fornecedores.map((forn: any) => (
                              <SelectItem key={forn.id} value={forn.id}>
                                {forn.nome} {forn.cnpj ? `(${forn.cnpj})` : ""}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-purple-800 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Data de Vencimento (Opcional)
                      </Label>
                      <Input
                        type="date"
                        className="h-12 bg-white"
                        value={form.data_vencimento}
                        onChange={(e) => setFormField("data_vencimento", e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-700">
                    A despesa será encaminhada ao financeiro para agendamento e liquidação futura.
                  </p>
                </div>
              )}

              {/* Forma de Pagamento */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">
                  Forma de Pagamento <span className="text-destructive">*</span>
                </Label>
                <Select value={form.forma_pagamento_id} onValueChange={(v) => setFormField("forma_pagamento_id", v)}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Selecione como o pagamento ocorreu / ocorrerá" /></SelectTrigger>
                  <SelectContent>{formasPagamento.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}</SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Indica o meio de liquidação (dinheiro, PIX, boleto, cartão).
                </p>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Observações (Opcional)</Label>
                <Input className="h-12" placeholder="Detalhes adicionais..." value={form.observacao} onChange={(e) => setFormField("observacao", e.target.value)} />
              </div>
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between gap-4 z-50 lg:left-64">
            <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => etapa === 2 ? goBackUrl() : setEtapa(prev => prev - 1)}>
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
                (historicoHoje as any[]).map((item) => {
                  const badge = getOrigemRecursoBadge(item.origem_recurso);
                  return (
                    <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.empresas?.nome || "Empresa"}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Package className="h-2.5 w-2.5" /> {item.descricao}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-black text-destructive">{formatCurrency(item.total)}</p>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={cn("text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border", badge.className)}>
                              {badge.label}
                            </span>
                            <span className="text-[8px] uppercase font-bold text-slate-400 bg-slate-100 px-1 rounded">
                              {item.categoria_custo}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </OperationalShell>
  );
};

export default CustosExtrasLancamento;
