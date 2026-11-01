import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";
import { OnboardingSuccessModal } from "@/components/onboarding/OnboardingSuccessModal";
import { StatusChip } from "@/components/painel/StatusChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Pencil, Trash2, LayoutGrid, List, User, Briefcase, Building2, FileText, DollarSign, Receipt, CheckCircle2, MoreHorizontal, AlertTriangle, Search, X, RotateCcw, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ColaboradorService, EmpresaService } from "@/services/base.service";
import { getColaboradorCompletudeDetailed } from "@/services/domain/core.service";
import { EntityCompletenessPanel } from "@/components/ui/EntityCompletenessPanel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const getInitialColaboradorFormData = (defaultEmpresaId = "", initialName = "") => ({
  nome: initialName,
  cpf: "",
  telefone: "",
  cargo: "",
  matricula: "",
  empresa_id: defaultEmpresaId,
  regime_trabalho: "CLT",
  modelo_calculo: "Mensal",
  tipo_contrato: "Hora" as "Hora" | "Operação" | "Mensal",
  tipo_colaborador: "CLT",
  valor_base: "22",
  salario_base: "",
  valor_hora: "",
  valor_diaria: "",
  carga_referencia: "220",
  estimativa_mensal: "",
  regra_operacional: "",
  flag_faturamento: true,
  permitir_lancamento_operacional: false,
  status: "ativo",
  nome_completo: "",
  banco_codigo: "",
  agencia: "",
  agencia_digito: "",
  conta: "",
  conta_digito: "",
  tipo_conta: "corrente",
  pis: "",
  syncNomeBancario: true,
});

const getColaboradorStatusMeta = (colaborador: any) => {
  if (colaborador.status_cadastro === "pendente_complemento" || colaborador.cadastro_provisorio) {
    return { status: "pendente" as const, label: "Pendente" };
  }

  const details = getColaboradorCompletudeDetailed(colaborador);
  if (details.geral.percentual === 100) {
    return { status: "dados_completos" as const, label: "Dados completos" };
  }

  return {
    status: (colaborador.status || "ok") as "ok" | "inconsistente" | "ajustado" | "pendente" | "incompleto" | "positivo" | "critico" | "dados_completos",
    label: undefined,
  };
};

const getColaboradorOrigemMeta = (colaborador: any) => {
  if (colaborador.origem_cadastro === "ponto_importado" || colaborador.origem === "importacao_ponto") {
    return {
      label: "Ponto",
      className: "bg-info-soft text-info",
    };
  }

  return {
    label: "Manual",
    className: "bg-muted text-muted-foreground",
  };
};

const inferRegimeTrabalho = (tipoColaborador?: string) => {
  const tipo = String(tipoColaborador || "").toUpperCase();
  if (tipo === "CLT") return "CLT";
  if (tipo === "INTERMITENTE") return "Intermitente";
  if (tipo === "DIARISTA") return "Diarista";
  if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Freelancer";
  if (tipo === "TERCEIRIZADO") return "Terceirizado";
  return "CLT";
};

const inferModeloCalculo = (tipoColaborador?: string) => {
  const tipo = String(tipoColaborador || "").toUpperCase();
  if (tipo === "CLT") return "Mensal";
  if (tipo === "DIARISTA") return "Diária";
  if (tipo === "INTERMITENTE") return "Horista";
  if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Produção";
  if (tipo === "TERCEIRIZADO") return "Produção";
  return "Mensal";
};

const Colaboradores = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnboardingReturn, handleOnboardingReturn, showSuccessModal, setShowSuccessModal } = useOnboardingCallback();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { data: list = [], isLoading, isFetching, isError, error: queryError } = useQuery({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  // Filter states
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [selectedRegime, setSelectedRegime] = useState("all");
  const [selectedModelo, setSelectedModelo] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [returnContext, setReturnContext] = useState<{
    returnTo?: string;
    loteId?: string;
    loteRef?: string;
    colaboradorNome?: string;
  } | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  // Paginação Oficial — Gestão Detalhada
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedEmpresa, selectedRegime, selectedModelo]);


  const [form, setForm] = useState(getInitialColaboradorFormData());
  const resetWizardState = () => {
    setForm(getInitialColaboradorFormData(empresaOptions[0]?.id ?? ""));
    setEditingId(null);
    setStep(1);
    setIsProcessing(false);
  };
  const handleCreate = () => {
    resetWizardState();
    setOpen(true);
  };
  const handleModalOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetWizardState();
    }
    setOpen(isOpen);
  };
  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const toCurrencyString = (num: number | string | null | undefined): string => {
    if (num == null || num === "") return "";
    const numeric = typeof num === "string" ? Number(num) : num;
    if (isNaN(numeric)) return "";
    return numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const number = Number(digits) / 100;
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseCurrency = (value: string): number => {
    if (!value) return 0;
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatPhoneForDisplay = (value: string) => {
    const digits = normalizePhone(value).slice(0, 11);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const validatePhone = (value: string) => {
    const digits = normalizePhone(value);
    if (!digits) return null;
    if (digits.length > 0 && digits.length < 10) return "Telefone inválido.";
    if (digits.length > 0 && !/^\d{10,11}$/.test(digits)) return "Telefone inválido.";
    return null;
  };

  const handlePhoneChange = (raw: string) => {
    const digits = normalizePhone(raw);
    if (digits.length > 11) return;
    setForm(prev => ({ ...prev, telefone: formatPhoneForDisplay(digits) }));
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? ColaboradorService.update(editingId, payload)
      : ColaboradorService.create(payload),
    onSuccess: async () => {
      toast.success(editingId ? "Colaborador atualizado com sucesso." : "Colaborador cadastrado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
      resetWizardState();
      setOpen(false);

      if (returnContext?.returnTo) {
        const dest = returnContext.returnTo;
        const loteId = returnContext.loteId;
        setReturnContext(null);
        toast.info("Retornando à Central de Aprovações RH...", {
          action: {
            label: "Voltar Agora",
            onClick: () => navigate(dest, { state: { loteId } }),
          },
        });
        setTimeout(() => {
          navigate(dest, { state: { loteId } });
        }, 900);
      }

      if (isOnboardingReturn) {
        await handleOnboardingReturn();
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("já existe") || msg.includes("cpf")) {
        toast.error("Já existe um colaborador cadastrado com este CPF.");
      } else {
        toast.error(msg || (editingId ? "Erro ao atualizar colaborador." : "Erro ao cadastrar colaborador. Verifique os campos obrigatórios."));
      }
    },
    onSettled: () => setIsProcessing(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ColaboradorService.delete(id),
    onSuccess: () => {
      toast.success("Colaborador removido");
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
    },
    onError: (err: any) => toast.error("Erro ao remover", { description: err.message })
  });

  const handleEdit = (c: any) => {
    setStep(1);
    setIsProcessing(false);
    setEditingId(c.id);
    const rawPhone = c.telefone || "";
    setForm({
      nome: c.nome || "",
      cpf: c.cpf || "",
      telefone: formatPhoneForDisplay(rawPhone),
      cargo: c.cargo || "",
      matricula: c.matricula || "",
      empresa_id: c.empresa_id || "",
      regime_trabalho: c.regime_trabalho || "CLT",
      modelo_calculo: c.modelo_calculo || "Mensal",
      tipo_contrato: c.tipo_contrato || "Hora",
      tipo_colaborador: c.tipo_colaborador || "CLT",
      valor_base: toCurrencyString(c.valor_base || 0),
      salario_base: c.salario_base != null ? toCurrencyString(c.salario_base) : "",
      valor_hora: c.valor_hora != null ? toCurrencyString(c.valor_hora) : "",
      valor_diaria: c.valor_diaria != null ? toCurrencyString(c.valor_diaria) : "",
      carga_referencia: c.carga_referencia != null ? String(c.carga_referencia) : "220",
      estimativa_mensal: c.estimativa_mensal != null ? toCurrencyString(c.estimativa_mensal) : "",
      regra_operacional: c.regra_operacional || "",
      flag_faturamento: c.flag_faturamento ?? true,
      permitir_lancamento_operacional: c.permitir_lancamento_operacional ?? false,
      status: c.status || "ativo",
      nome_completo: c.nome_completo || "",
      banco_codigo: c.banco_codigo || "",
      agencia: c.agencia || "",
      agencia_digito: c.agencia_digito || "",
      conta: c.conta || "",
      conta_digito: c.conta_digito || "",
      tipo_conta: c.tipo_conta || "corrente",
      pis: c.pis || "",
      syncNomeBancario: (c.nome_completo === c.nome || !c.nome_completo),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (location.state?.returnTo && !returnContext) {
      setReturnContext({
        returnTo: location.state.returnTo,
        loteId: location.state.loteId,
        loteRef: location.state.loteRef,
        colaboradorNome: location.state.colaboradorNome,
      });
    }

    if (location.state?.openEditId && !open) {
      setPendingEditId(location.state.openEditId);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.openNew && !open) {
      handleModalOpenChange(true);
      setStep(1);
      setEditingId(null);
      if (location.state?.initialName) {
        setForm(prev => ({
          ...prev,
          nome: location.state.initialName,
          nome_completo: location.state.initialName,
          regime_trabalho: location.state.initialTipo || 'Intermitente',
          modelo_calculo: 'Horista'
        }));
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, open, navigate, returnContext]);

  // Disparo seguro da edição assim que a lista de colaboradores estiver disponível
  useEffect(() => {
    if (pendingEditId && list.length > 0 && !open) {
      const colab = list.find((c: any) => c.id === pendingEditId);
      if (colab) {
        handleEdit(colab);
        setPendingEditId(null);
      }
    }
  }, [pendingEditId, list, open]);

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      deleteMutation.mutate(id);
    }
  };

  const validateStep1 = async (): Promise<boolean> => {
    if (!form.nome.trim()) {
      toast.error("Nome completo é obrigatório.", { icon: null });
      return false;
    }
    if (!form.cpf.trim()) {
      toast.error("CPF é obrigatório.", { icon: null });
      return false;
    }
    const cpfClean = form.cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido.", { icon: null });
      return false;
    }
    // Verificação antecipada de CPF duplicado (somente para criação)
    if (!editingId) {
      try {
        const cpfCheck = await ColaboradorService.checkCpfExists(cpfClean);
        if (cpfCheck.exists) {
          toast.error(
            `Já existe um colaborador cadastrado com este CPF${cpfCheck.nome ? ` (${cpfCheck.nome})` : ''}.`,
            { duration: 6000 }
          );
          return false;
        }
      } catch {
        // Se falhar a verificação, prossegue — a validação final do create trata
      }
    }
    const phoneError = validatePhone(form.telefone);
    if (phoneError) {
      toast.error(phoneError, { icon: null });
      return false;
    }
    // Verificamos PIS sem bloquear o save (deixa pendente depois)
    if (!form.empresa_id && !empresaOptions[0]?.id) {
      toast.error("Empresa é obrigatória.", { icon: null });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.regime_trabalho) {
      toast.error("Regime de trabalho é obrigatório.", { icon: null });
      return false;
    }
    if (!form.modelo_calculo) {
      toast.error("Modelo de cálculo é obrigatório.", { icon: null });
      return false;
    }
    if (!form.status) {
      toast.error("Status é obrigatório.", { icon: null });
      return false;
    }

    // Cargo removido do block estrito para permitir salvar parcialmente,
    // mas o PIS/Cargo faltante fará o serviço de backend manter como 'pendente'

    if (!form.matricula.trim() && form.regime_trabalho === "CLT") {
      toast.error("Matrícula é obrigatória para CLT.", { icon: null });
      return false;
    }

    if (form.modelo_calculo === "Mensal") {
      if (!form.salario_base || Number(form.salario_base) <= 0) {
        toast.error("Salário base é obrigatório.", { icon: null });
        return false;
      }
    } else if (form.modelo_calculo === "Horista") {
      if (!form.valor_hora || Number(form.valor_hora) <= 0) {
        toast.error("Valor hora é obrigatório.", { icon: null });
        return false;
      }
      if (!form.carga_referencia || Number(form.carga_referencia) <= 0) {
        toast.error("Carga referência é obrigatória.", { icon: null });
        return false;
      }
    } else if (form.modelo_calculo === "Diária") {
      if (!form.valor_diaria || Number(form.valor_diaria) <= 0) {
        toast.error("Valor da diária é obrigatório.", { icon: null });
        return false;
      }
    } else if (form.modelo_calculo === "Produção") {
      if (!form.valor_base || Number(form.valor_base) <= 0) {
        toast.error("Valor de operação é obrigatório.", { icon: null });
        return false;
      }
    }

    return true;
  };

  const validateStep3 = () => {
    const hasBankField = form.nome_completo || form.banco_codigo || form.agencia || form.conta;
    if (form.flag_faturamento && hasBankField) {
      if (!form.nome_completo?.trim()) {
        toast.error("Nome completo da conta é obrigatório.", { icon: null });
        return false;
      }
      if (!form.banco_codigo?.trim()) {
        toast.error("Código do banco é obrigatório.", { icon: null });
        return false;
      }
      if (!form.tipo_conta) {
        toast.error("Tipo de conta é obrigatório.", { icon: null });
        return false;
      }
      if (!form.agencia?.trim()) {
        toast.error("Agência é obrigatória.", { icon: null });
        return false;
      }
      if (!form.conta?.trim()) {
        toast.error("Conta é obrigatória.", { icon: null });
        return false;
      }
    }
    if (!hasBankField && form.flag_faturamento) {
      toast.warning("Para faturamento, preencha os dados bancários.", { icon: null, duration: 3000 });
    }
    return true;
  };

  const submit = () => {
    if (!form.nome.trim()) {
      toast.error("Preencha o nome do colaborador");
      return;
    }
    if (!form.empresa_id && !empresaOptions[0]?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    const cpfNormalized = form.cpf.replace(/\D/g, "");
    const pisNormalized = form.pis ? form.pis.replace(/\D/g, "") : null;
    const telefoneNormalized = normalizePhone(form.telefone);
    const valorBaseNumerico = parseCurrency(form.valor_base);
    const salarioBaseNumerico = parseCurrency(form.salario_base);
    const valorHoraNumerico = parseCurrency(form.valor_hora);
    const valorDiariaNumerico = parseCurrency(form.valor_diaria);

    const tipoColaborador =
      form.regime_trabalho === "CLT" ? "CLT" :
        form.regime_trabalho === "Diarista" ? "DIARISTA" :
          form.regime_trabalho === "Intermitente" ? "INTERMITENTE" :
            form.regime_trabalho === "Terceirizado" ? "TERCEIRIZADO" : "PRODUÇÃO";

    const valorBaseFinal =
      form.modelo_calculo === "Mensal" ? salarioBaseNumerico :
        form.modelo_calculo === "Diária" ? valorDiariaNumerico :
          form.modelo_calculo === "Horista" ? valorHoraNumerico :
            valorBaseNumerico;

    setIsProcessing(true);
    createMutation.mutate({
      nome: form.nome.trim(),
      cpf: cpfNormalized || null,
      telefone: telefoneNormalized || null,
      cargo: form.cargo?.trim() || null,
      matricula: form.matricula?.trim() || null,
      empresa_id: form.empresa_id || empresaOptions[0]?.id,
      regime_trabalho: form.regime_trabalho,
      modelo_calculo: form.modelo_calculo,
      tipo_contrato: form.modelo_calculo === "Produção" ? "Operação" : form.tipo_contrato,
      tipo_colaborador: tipoColaborador,
      valor_base: valorBaseFinal,
      salario_base: form.modelo_calculo === "Mensal" ? salarioBaseNumerico : null,
      valor_hora: form.modelo_calculo === "Horista" ? valorHoraNumerico : null,
      valor_diaria: form.modelo_calculo === "Diária" ? valorDiariaNumerico : null,
      flag_faturamento: form.modelo_calculo !== "Diária" ? form.flag_faturamento : false,
      permitir_lancamento_operacional: ["Diária", "Produção", "Horista"].includes(form.modelo_calculo)
        ? true
        : form.permitir_lancamento_operacional,
      status: form.status,
      nome_completo: form.nome_completo?.trim() || null,
      banco_codigo: form.banco_codigo?.trim() || null,
      agencia: form.agencia?.trim() || null,
      agencia_digito: form.agencia_digito?.trim() || null,
      conta: form.conta?.trim() || null,
      conta_digito: form.conta_digito?.trim() || null,
      tipo_conta: form.tipo_conta,
      pis: pisNormalized || null,
    });
  };

  const formCompletudeDetailed = getColaboradorCompletudeDetailed(form);

  const filteredList = useMemo(() => {
    return (list || []).filter((c: any) => {
      const matchesSearch =
        (c.nome || "").toLowerCase().includes(searchText.toLowerCase()) ||
        (c.matricula || "").toLowerCase().includes(searchText.toLowerCase());
      const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
      const matchesRegime = selectedRegime === "all" || c.regime_trabalho === selectedRegime;
      const matchesModelo = selectedModelo === "all" || c.modelo_calculo === selectedModelo;
      return matchesSearch && matchesEmpresa && matchesRegime && matchesModelo;
    });
  }, [list, searchText, selectedEmpresa, selectedRegime, selectedModelo]);

  const totalCount = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4 pb-12 w-full max-w-[1560px] mx-auto pt-1 animate-in fade-in-50 duration-200">
        {/* Cabeçalho Institucional da Gestão Detalhada */}
        <section className="bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-4 md:p-5 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  Cadastros & Sistema
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground font-medium">Gestão Detalhada</span>
              </div>
              <h2 className="font-display font-bold text-lg text-foreground tracking-tight">
                Gestão Detalhada de Colaboradores
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Ambiente administrativo aprofundado com auditoria completa de vínculos, contratos e prontidão de governança (OPER, RH e Financeiro).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => navigate("/cadastros?tab=colaboradores")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Central de Cadastros
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                Atualizar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs font-medium gap-1.5 font-display font-semibold"
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5" /> Novo colaborador
              </Button>
            </div>
          </div>
        </section>

        {/* Barra Oficial de Filtros e Busca */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 rounded-xl p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8 h-8 text-xs bg-background border-border/80"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  title="Limpar busca"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[180px] sm:w-[220px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresaOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRegime} onValueChange={setSelectedRegime}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os regimes</SelectItem>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="Intermitente">Intermitente</SelectItem>
                <SelectItem value="Diarista">Diarista</SelectItem>
                <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedModelo} onValueChange={setSelectedModelo}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os modelos</SelectItem>
                <SelectItem value="Mensal">Mensal</SelectItem>
                <SelectItem value="Horista">Horista</SelectItem>
                <SelectItem value="Diária">Diária</SelectItem>
                <SelectItem value="Produção">Produção</SelectItem>
              </SelectContent>
            </Select>

            {(searchText || selectedEmpresa !== "all" || selectedRegime !== "all" || selectedModelo !== "all") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchText("");
                  setSelectedEmpresa("all");
                  setSelectedRegime("all");
                  setSelectedModelo("all");
                  setCurrentPage(1);
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Tabela Administrativa Oficial */}
        <section className="esc-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">Carregando colaboradores...</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center p-12 text-center esc-card">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-display font-semibold text-foreground text-sm">Erro ao carregar dados</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mt-1 mb-4">
                {(queryError as any)?.message || "Não foi possível conectar ao servidor."}
              </p>
              <Button variant="outline" size="sm" className="h-8" onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-320px)] min-h-[320px] overflow-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="esc-table-header sticky top-0 bg-background z-10 shadow-2xs border-b border-border/80">
                    <tr className="text-left">
                      <th className="px-5 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Nome</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Cargo</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Empresa</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center">Tipo</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Valor base</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center">Faturamento</th>
                      <th className="px-3 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center">Governança</th>
                      <th className="px-5 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center">Status</th>
                      <th className="px-5 h-10 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-8 text-center text-muted-foreground">
                          Nenhum colaborador encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((c: any) => {
                        const statusMeta = getColaboradorStatusMeta(c);
                        const isAtivo = statusMeta.status === "ativo";
                        const isPendente = statusMeta.status === "pendente";
                        const comp = getColaboradorCompletudeDetailed(c);

                        // Modalidade simplificada sem poluição decorativa
                        const regimeRaw = String(c.regime_trabalho || c.tipo_colaborador || "").toUpperCase();
                        const modeloRaw = String(c.modelo_calculo || c.tipo_contrato || "").toUpperCase();
                        let tipoExibicao = "CLT";
                        if (regimeRaw === "DIARISTA" || modeloRaw.includes("DIÁRIA") || modeloRaw.includes("DIARIA")) {
                          tipoExibicao = "Diarista";
                        } else if (regimeRaw === "INTERMITENTE") {
                          tipoExibicao = "Intermitente";
                        } else if (regimeRaw === "TERCEIRIZADO") {
                          tipoExibicao = "Terceirizado";
                        } else if (regimeRaw.includes("PRODU") || modeloRaw.includes("OPERA")) {
                          tipoExibicao = "Produção";
                        } else if (regimeRaw === "CLT") {
                          tipoExibicao = "CLT";
                        }

                        return (
                          <tr key={c.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors group">
                            <td className="px-5 py-2.5">
                              <div className="font-semibold text-foreground text-xs sm:text-sm leading-snug">{c.nome}</div>
                              <div className="text-[11px] font-mono text-muted-foreground/80">Mat. {c.matricula || "S/N"}</div>
                            </td>
                            <td className="px-3 text-xs text-muted-foreground truncate max-w-[150px]">{c.cargo || "—"}</td>
                            <td className="px-3 text-xs text-muted-foreground truncate max-w-[150px]">{c.empresas?.nome || "—"}</td>
                            <td className="px-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-foreground/80 bg-muted/40 border border-border/40 whitespace-nowrap">
                                {tipoExibicao}
                              </span>
                            </td>
                            <td className="px-3 text-right font-mono tabular-nums text-xs font-semibold text-foreground">
                              R$ {(c.valor_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 text-center text-xs text-muted-foreground font-medium">{c.flag_faturamento ? "Sim" : "Não"}</td>
                            <td className="px-3 text-center">
                              <TooltipProvider delayDuration={150}>
                                <div className="flex items-center justify-center gap-1">
                                  {/* Operacional */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn(
                                        "flex h-5 w-7 items-center justify-center rounded text-[9.5px] font-bold font-mono tracking-tight cursor-help border transition-colors",
                                        comp.operacional.completo
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                          : "bg-muted/50 border-border/60 text-muted-foreground"
                                      )}>
                                        OPER
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs font-semibold mb-1">
                                        Operacional: {comp.operacional.completo ? "Apto" : "Pendente"}
                                      </p>
                                      {!comp.operacional.completo && comp.operacional.pendencias.length > 0 && (
                                        <div className="text-[10px] text-muted-foreground">
                                          <p className="font-semibold mb-0.5">Pendências:</p>
                                          <ul className="space-y-0.5 ml-1">
                                            {comp.operacional.pendencias.map((p: string) => <li key={p}>• {p}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>

                                  {/* RH */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn(
                                        "flex h-5 w-7 items-center justify-center rounded text-[9.5px] font-bold font-mono tracking-tight cursor-help border transition-colors",
                                        comp.rh.completo
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                          : "bg-muted/50 border-border/60 text-muted-foreground"
                                      )}>
                                        RH
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs font-semibold mb-1">
                                        RH: {comp.rh.completo ? "Apto" : "Pendente"}
                                      </p>
                                      {!comp.rh.completo && comp.rh.pendencias.length > 0 && (
                                        <div className="text-[10px] text-muted-foreground">
                                          <p className="font-semibold mb-0.5">Pendências:</p>
                                          <ul className="space-y-0.5 ml-1">
                                            {comp.rh.pendencias.map((p: string) => <li key={p}>• {p}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>

                                  {/* Financeiro */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn(
                                        "flex h-5 w-7 items-center justify-center rounded text-[9.5px] font-bold font-mono tracking-tight cursor-help border transition-colors",
                                        comp.financeiro.completo
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                          : "bg-muted/50 border-border/60 text-muted-foreground"
                                      )}>
                                        FIN
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs font-semibold mb-1">
                                        Financeiro: {comp.financeiro.completo ? "Apto" : "Pendente"}
                                      </p>
                                      {!comp.financeiro.completo && comp.financeiro.pendencias.length > 0 && (
                                        <div className="text-[10px] text-muted-foreground">
                                          <p className="font-semibold mb-0.5">Pendências:</p>
                                          <ul className="space-y-0.5 ml-1">
                                            {comp.financeiro.pendencias.map((p: string) => <li key={p}>• {p}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </td>
                            <td className="px-5 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                                  isAtivo && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                                  isPendente && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                                  !isAtivo && !isPendente && "bg-muted/60 text-muted-foreground border-border/50"
                                )}
                              >
                                {statusMeta.label || (isAtivo ? "Ativo" : "Pendente")}
                              </span>
                            </td>
                            <td className="px-5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra Oficial de Paginação */}
              <div className="px-5 py-3 border-t border-border/80 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    {totalCount === 0
                      ? "Nenhum colaborador encontrado"
                      : `Exibindo ${(currentPage - 1) * pageSize + 1}–${Math.min(
                          currentPage * pageSize,
                          totalCount
                        )} de ${totalCount}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="colaboradores-detalhada-page-size" className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      Linhas por página:
                    </label>
                    <div className="relative inline-flex items-center">
                      <select
                        id="colaboradores-detalhada-page-size"
                        value={pageSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value);
                          setPageSize(nextSize);
                          setCurrentPage(1);
                        }}
                        aria-label="Linhas por página"
                        className="h-7 w-[72px] appearance-none rounded-md border border-border/80 bg-background px-2.5 pr-6 text-xs font-medium text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground opacity-60" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium whitespace-nowrap">
                      Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="h-7 w-7 p-0"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="h-7 w-7 p-0"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize as informações do colaborador."
                : step === 1
                  ? "Dados pessoais e vínculo institucional."
                  : step === 2
                    ? "Dados contratuais e informações de pagamento."
                    : "Dados bancários para depósito."}
            </DialogDescription>
            {!editingId && (
              <div className="flex items-center gap-2 mt-2">
                <div className={cn("h-1.5 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
                <div className={cn("h-1.5 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
                <div className={cn("h-1.5 flex-1 rounded-full transition-colors", step >= 3 ? "bg-primary" : "bg-muted")} />
              </div>
            )}
          </DialogHeader>

          {returnContext && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-3 text-xs space-y-1.5 mb-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Regularização Cadastral para Aprovação RH
                </div>
                <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300 text-[10px]">
                  Lote {returnContext.loteRef || returnContext.loteId?.substring(0, 6) || "RH"}
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                Preencha o CPF, defina a remuneração (valor base/hora) e informe os dados bancários para viabilizar a aprovação na Central.
              </p>
            </div>
          )}

          {/* Resumo de Completude do Cadastro */}
          <EntityCompletenessPanel data={formCompletudeDetailed} />

          <div className="overflow-y-auto max-h-[60vh]">
            {!editingId ? (
              <>
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="nome">Nome completo <span className="text-destructive">*</span></Label>
                      <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value, ...(form.syncNomeBancario ? { nome_completo: e.target.value } : {}) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                      <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pis">PIS</Label>
                      <Input id="pis" placeholder="000.00000.00-0" value={form.pis} onChange={(e) => setForm({ ...form, pis: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" value={form.telefone} onChange={(e) => handlePhoneChange(e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Empresa <span className="text-destructive">*</span></Label>
                      <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                        <SelectContent>
                          {empresaOptions.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nome} - {e.cidade}/{e.estado}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="space-y-1.5">
                      <Label>Regime de trabalho <span className="text-destructive">*</span></Label>
                      <Select value={form.regime_trabalho} onValueChange={(v) => setForm({ ...form, regime_trabalho: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLT">CLT</SelectItem>
                          <SelectItem value="Intermitente">Intermitente</SelectItem>
                          <SelectItem value="Diarista">Diarista</SelectItem>
                          <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                          <SelectItem value="Freelancer">Freelancer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Modelo de cálculo <span className="text-destructive">*</span></Label>
                      <Select value={form.modelo_calculo} onValueChange={(v) => setForm({ ...form, modelo_calculo: v, permitir_lancamento_operacional: ["Diária", "Produção", "Horista"].includes(v) ? true : form.permitir_lancamento_operacional })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mensal">Mensal</SelectItem>
                          <SelectItem value="Horista">Horista</SelectItem>
                          <SelectItem value="Diária">Diária</SelectItem>
                          <SelectItem value="Produção">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status <span className="text-destructive">*</span></Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.modelo_calculo === "Diária" ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="valor">Valor da diária (R$) <span className="text-destructive">*</span></Label>
                          <Input id="valor" type="text" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cargo">Função operacional <span className="text-destructive">*</span></Label>
                          <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <Label className="cursor-pointer">Permitir lançamento operacional</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Diarista aparecerá na tela de lançamentos.</p>
                          </div>
                          <Switch checked={form.permitir_lancamento_operacional} onCheckedChange={(v) => setForm({ ...form, permitir_lancamento_operacional: v })} />
                        </div>
                      </>
                    ) : form.modelo_calculo === "Mensal" ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="salario_base">Salário base (R$) <span className="text-destructive">*</span></Label>
                          <Input id="salario_base" type="text" value={form.salario_base} onChange={(e) => setForm({ ...form, salario_base: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="matricula">Matrícula <span className="text-destructive">*</span></Label>
                          <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                          <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Tipo de contrato</Label>
                          <Select value={form.tipo_contrato} onValueChange={(v: "Hora" | "Operação" | "Mensal") => setForm({ ...form, tipo_contrato: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mensal">Mensal</SelectItem>
                              <SelectItem value="Hora">Por hora</SelectItem>
                              <SelectItem value="Operação">Por operação</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <Label className="cursor-pointer">Gera faturamento</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                          </div>
                          <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                        </div>
                      </>
                    ) : form.modelo_calculo === "Horista" ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="valor_hora">Valor hora (R$) <span className="text-destructive">*</span></Label>
                          <Input id="valor_hora" type="text" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="carga_referencia">Carga referência (h/mês) <span className="text-destructive">*</span></Label>
                          <Input id="carga_referencia" type="number" value={form.carga_referencia} onChange={(e) => setForm({ ...form, carga_referencia: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="estimativa_mensal">Estimativa mensal (R$)</Label>
                          <Input id="estimativa_mensal" type="text" value={form.estimativa_mensal} onChange={(e) => setForm({ ...form, estimativa_mensal: formatCurrencyInput(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                          <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <Label className="cursor-pointer">Gera faturamento</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                          </div>
                          <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                          <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="matricula">Matrícula <span className="text-destructive">*</span></Label>
                          <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Tipo de contrato <span className="text-destructive">*</span></Label>
                          <Select value={form.tipo_contrato} onValueChange={(v: "Hora" | "Operação") => setForm({ ...form, tipo_contrato: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Hora">Por hora</SelectItem>
                              <SelectItem value="Operação">Por operação</SelectItem>
                              <SelectItem value="Mensal">Mensal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="valor">Valor da operação (R$) <span className="text-destructive">*</span></Label>
                          <Input id="valor" type="text" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: formatCurrencyInput(e.target.value) })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="regra_operacional">Regra operacional (opcional)</Label>
                          <Input id="regra_operacional" value={form.regra_operacional} onChange={(e) => setForm({ ...form, regra_operacional: e.target.value })} placeholder="Ex: volume x tabela X" />
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <Label className="cursor-pointer">Gera faturamento</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                          </div>
                          <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="nome_completo">Nome completo (como conta) <span className="text-destructive">*</span></Label>
                        {form.syncNomeBancario ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setForm({ ...form, syncNomeBancario: false })}
                            type="button"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar nome da conta
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setForm({ ...form, syncNomeBancario: true, nome_completo: form.nome })}
                            type="button"
                          >
                            Usar mesmo nome
                          </Button>
                        )}
                      </div>
                      <Input
                        id="nome_completo"
                        value={form.nome_completo}
                        disabled={form.syncNomeBancario}
                        onChange={(e) => setForm({ ...form, nome_completo: e.target.value, syncNomeBancario: false })}
                      />
                      {form.syncNomeBancario && (
                        <p className="text-[10px] text-muted-foreground italic">Sincronizado com o cadastro principal</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="banco_codigo">Cód. Banco <span className="text-destructive">*</span></Label>
                      <Input id="banco_codigo" value={form.banco_codigo} onChange={(e) => setForm({ ...form, banco_codigo: e.target.value })} placeholder="Ex: 341" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de Conta</Label>
                      <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrente">Corrente</SelectItem>
                          <SelectItem value="poupanca">Poupança</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="agencia">Agência</Label>
                      <div className="flex gap-2">
                        <Input id="agencia" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} className="flex-1" />
                        <Input id="agencia_digito" value={form.agencia_digito} onChange={(e) => setForm({ ...form, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="conta">Conta</Label>
                      <div className="flex gap-2">
                        <Input id="conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="flex-1" />
                        <Input id="conta_digito" value={form.conta_digito} onChange={(e) => setForm({ ...form, conta_digito: e.target.value })} className="w-16" placeholder="Díg." />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="nome">Nome completo <span className="text-destructive">*</span></Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => {
                      const newNome = e.target.value;
                      const updates: any = { nome: newNome };
                      if (form.syncNomeBancario) {
                        updates.nome_completo = newNome;
                      }
                      setForm({ ...form, ...updates });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                  <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pis">PIS</Label>
                  <Input id="pis" placeholder="000.00000.00-0" value={form.pis} onChange={(e) => setForm({ ...form, pis: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="telefone">Telefone <span className="text-destructive">*</span></Label>
                  <Input id="telefone" value={form.telefone} onChange={(e) => handlePhoneChange(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Empresa <span className="text-destructive">*</span></Label>
                  <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                    <SelectContent>
                      {empresaOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome} - {e.cidade}/{e.estado}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Regime de trabalho <span className="text-destructive">*</span></Label>
                  <Select value={form.regime_trabalho} onValueChange={(v) => setForm({ ...form, regime_trabalho: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="Intermitente">Intermitente</SelectItem>
                      <SelectItem value="Diarista">Diarista</SelectItem>
                      <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                      <SelectItem value="Freelancer">Freelancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo de cálculo <span className="text-destructive">*</span></Label>
                  <Select value={form.modelo_calculo} onValueChange={(v) => setForm({ ...form, modelo_calculo: v, permitir_lancamento_operacional: ["Diária", "Produção", "Horista"].includes(v) ? true : form.permitir_lancamento_operacional })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Horista">Horista</SelectItem>
                      <SelectItem value="Diária">Diária</SelectItem>
                      <SelectItem value="Produção">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status <span className="text-destructive">*</span></Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.modelo_calculo === "Diária" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="valor">Valor da diária (R$) <span className="text-destructive">*</span></Label>
                      <Input id="valor" type="text" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cargo">Função operacional <span className="text-destructive">*</span></Label>
                      <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="cursor-pointer">Permitir lançamento operacional</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Diarista aparecerá na tela de lançamentos.</p>
                      </div>
                      <Switch checked={form.permitir_lancamento_operacional} onCheckedChange={(v) => setForm({ ...form, permitir_lancamento_operacional: v })} />
                    </div>
                  </>
                ) : form.modelo_calculo === "Mensal" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="salario_base">Salário base (R$) <span className="text-destructive">*</span></Label>
                      <Input id="salario_base" type="text" value={form.salario_base} onChange={(e) => setForm({ ...form, salario_base: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="matricula">Matrícula <span className="text-destructive">*</span></Label>
                      <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                      <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de contrato</Label>
                      <Select value={form.tipo_contrato} onValueChange={(v: "Hora" | "Operação" | "Mensal") => setForm({ ...form, tipo_contrato: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mensal">Mensal</SelectItem>
                          <SelectItem value="Hora">Por hora</SelectItem>
                          <SelectItem value="Operação">Por operação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="cursor-pointer">Gera faturamento</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                      </div>
                      <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                    </div>
                  </>
                ) : form.modelo_calculo === "Horista" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="valor_hora">Valor hora (R$) <span className="text-destructive">*</span></Label>
                      <Input id="valor_hora" type="text" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: formatCurrencyInput(e.target.value), valor_base: formatCurrencyInput(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="carga_referencia">Carga referência (h/mês) <span className="text-destructive">*</span></Label>
                      <Input id="carga_referencia" type="number" value={form.carga_referencia} onChange={(e) => setForm({ ...form, carga_referencia: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="estimativa_mensal">Estimativa mensal (R$)</Label>
                      <Input id="estimativa_mensal" type="text" value={form.estimativa_mensal} onChange={(e) => setForm({ ...form, estimativa_mensal: formatCurrencyInput(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                      <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="cursor-pointer">Gera faturamento</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                      </div>
                      <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="cargo">Cargo <span className="text-destructive">*</span></Label>
                      <Input id="cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="matricula">Matrícula <span className="text-destructive">*</span></Label>
                      <Input id="matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de contrato <span className="text-destructive">*</span></Label>
                      <Select value={form.tipo_contrato} onValueChange={(v: "Hora" | "Operação") => setForm({ ...form, tipo_contrato: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hora">Por hora</SelectItem>
                          <SelectItem value="Operação">Por operação</SelectItem>
                          <SelectItem value="Mensal">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="valor">Valor da operação (R$) <span className="text-destructive">*</span></Label>
                      <Input id="valor" type="text" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: formatCurrencyInput(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="regra_operacional">Regra operacional (opcional)</Label>
                      <Input id="regra_operacional" value={form.regra_operacional} onChange={(e) => setForm({ ...form, regra_operacional: e.target.value })} placeholder="Ex: volume x tabela X" />
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <Label className="cursor-pointer">Gera faturamento</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                      </div>
                      <Switch checked={form.flag_faturamento} onCheckedChange={(v) => setForm({ ...form, flag_faturamento: v })} />
                    </div>
                  </>
                )}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold mb-3">Dados Bancários</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="nome_completo_edit">Nome completo (como conta) <span className="text-destructive">*</span></Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="sync-name-edit"
                            checked={form.syncNomeBancario}
                            onCheckedChange={(v) => {
                              const updates: any = { syncNomeBancario: v };
                              if (v) updates.nome_completo = form.nome;
                              setForm({ ...form, ...updates });
                            }}
                          />
                          <Label htmlFor="sync-name-edit" className="text-xs font-normal cursor-pointer text-muted-foreground">Mesmo nome do colaborador</Label>
                        </div>
                      </div>
                      <Input
                        id="nome_completo_edit"
                        value={form.nome_completo}
                        disabled={form.syncNomeBancario}
                        onChange={(e) => setForm({ ...form, nome_completo: e.target.value, syncNomeBancario: false })}
                      />
                      {form.syncNomeBancario && (
                        <p className="text-[10px] text-muted-foreground italic">Sincronizado com o cadastro principal</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="banco_codigo">Cód. Banco</Label>
                      <Input id="banco_codigo" value={form.banco_codigo} onChange={(e) => setForm({ ...form, banco_codigo: e.target.value })} placeholder="Ex: 341" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de Conta</Label>
                      <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrente">Corrente</SelectItem>
                          <SelectItem value="poupanca">Poupança</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="agencia">Agência</Label>
                      <div className="flex gap-2">
                        <Input id="agencia" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} className="flex-1" />
                        <Input id="agencia_digito" value={form.agencia_digito} onChange={(e) => setForm({ ...form, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="conta">Conta</Label>
                      <div className="flex gap-2">
                        <Input id="conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="flex-1" />
                        <Input id="conta_digito" value={form.conta_digito} onChange={(e) => setForm({ ...form, conta_digito: e.target.value })} className="w-16" placeholder="Díg." />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {editingId ? (
              <>
                <Button variant="outline" onClick={() => handleModalOpenChange(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={isProcessing}>
                  {isProcessing ? "Salvando..." : "Salvar alterações"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleModalOpenChange(false)}>Cancelar</Button>
                {step === 1 && <Button onClick={async () => { setIsProcessing(true); try { if (await validateStep1()) setStep(2); } finally { setIsProcessing(false); } }} disabled={isProcessing}>{isProcessing ? "Verificando..." : "Próximo"}</Button>}
                {step === 2 && (
                  <>
                    <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                    <Button onClick={() => { if (validateStep2()) setStep(3); }} disabled={isProcessing}>Próximo</Button>
                  </>
                )}
                {step === 3 && (
                  <>
                    <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                    <Button onClick={submit} disabled={isProcessing}>
                      {isProcessing ? "Salvando..." : "Cadastrar"}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OnboardingSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        onContinue={() => {
          setShowSuccessModal(false);
          resetWizardState();
        }}
      />
    </AppShell>
  );
};

export default Colaboradores;




