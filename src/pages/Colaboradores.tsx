import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";
import { StatusChip } from "@/components/painel/StatusChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2, Pencil, Trash2, LayoutGrid, List, User, Briefcase, Building2, FileText, DollarSign, Receipt, CheckCircle2, MoreHorizontal, AlertTriangle } from "lucide-react";
import { ColaboradorService, EmpresaService } from "@/services/base.service";
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

const getInitialColaboradorFormData = (defaultEmpresaId = "") => ({
  nome: "",
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
});

const getColaboradorStatusMeta = (colaborador: any) => {
  if (colaborador.status_cadastro === "pendente_complemento" || colaborador.cadastro_provisorio) {
    return { status: "pendente" as const, label: "Pendente" };
  }

  return {
    status: (colaborador.status || "ok") as "ok" | "inconsistente" | "ajustado" | "pendente" | "incompleto" | "positivo" | "critico",
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
  const { isOnboardingReturn, handleOnboardingReturn } = useOnboardingCallback();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Filter states
  const [searchText, setSearchText] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [selectedRegime, setSelectedRegime] = useState("all");
  const [selectedModelo, setSelectedModelo] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  // Queries
  const { data: list = [], isLoading, isFetching, isError, error: queryError } = useQuery({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
    retry: 1,
  });

  const { data: empresaOptions = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

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
    if (!digits) return "Telefone é obrigatório.";
    if (digits.length < 10) return "Telefone inválido.";
    if (!/^\d{10,11}$/.test(digits)) return "Telefone inválido.";
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
      if (isOnboardingReturn) {
        await handleOnboardingReturn();
        navigate("/onboarding");
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
      valor_base: String(c.valor_base || 0),
      salario_base: c.salario_base != null ? String(c.salario_base) : "",
      valor_hora: c.valor_hora != null ? String(c.valor_hora) : "",
      valor_diaria: c.valor_diaria != null ? String(c.valor_diaria) : "",
      carga_referencia: c.carga_referencia != null ? String(c.carga_referencia) : "220",
      estimativa_mensal: c.estimativa_mensal != null ? String(c.estimativa_mensal) : "",
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
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      deleteMutation.mutate(id);
    }
  };

  const validateStep1 = () => {
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
    const phoneError = validatePhone(form.telefone);
    if (phoneError) {
      toast.error(phoneError, { icon: null });
      return false;
    }
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

    if (!form.cargo.trim()) {
      toast.error("Cargo/Função é obrigatório.", { icon: null });
      return false;
    }

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
    if (!form.cargo.trim()) {
      toast.error("Preencha o cargo/função");
      return;
    }

    const cpfNormalized = form.cpf.replace(/\D/g, "");
    const telefoneNormalized = normalizePhone(form.telefone);
    const valorBaseNumerico = Number(form.valor_base) || 0;
    const salarioBaseNumerico = Number(form.salario_base) || 0;
    const valorHoraNumerico = Number(form.valor_hora) || 0;
    const valorDiariaNumerico = Number(form.valor_diaria) || 0;

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
    });
  };

  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 w-full">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-10 border-border"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </div>
            </div>

            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[200px] h-10">
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
              <SelectTrigger className="w-[190px] h-10">
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
              <SelectTrigger className="w-[180px] h-10">
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
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex border rounded-lg overflow-hidden mr-2 bg-background">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-10 w-10 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-10 w-10 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] })}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button className="h-10 px-4 w-full md:w-auto font-display font-semibold" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Novo colaborador
            </Button>
          </div>
        </div>

        <section className={cn(viewMode === 'table' ? "esc-card overflow-hidden" : "")}>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">Carregando colaboradores...</p>
              </div>
            </div>
          ) : isError ? (
            /* ... (keeping existing error state logic but it might be duplicated in target content if I'm not careful) ... */
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
          ) : viewMode === 'table' ? (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Nome</span></th>
                  <th className="px-3 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />Cargo</span></th>
                  <th className="px-3 h-11 font-medium"><span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />Empresa</span></th>
                  <th className="px-3 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />Tipo</span></th>
                  <th className="px-3 h-11 font-medium text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor base</span></th>
                  <th className="px-3 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-muted-foreground" />Faturamento</span></th>
                  <th className="px-3 h-11 font-medium text-center">Origem</th>
                  <th className="px-5 h-11 font-medium text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
                  <th className="px-5 h-11 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(list || []).filter((c: any) => {
                  const matchesSearch = c.nome.toLowerCase().includes(searchText.toLowerCase()) ||
                    (c.matricula || "").toLowerCase().includes(searchText.toLowerCase());
                  const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
                  const matchesRegime = selectedRegime === "all" || c.regime_trabalho === selectedRegime;
                  const matchesModelo = selectedModelo === "all" || c.modelo_calculo === selectedModelo;
                  return matchesSearch && matchesEmpresa && matchesRegime && matchesModelo;
                }).map((c: any) => (
                  <tr key={c.id} className="border-t border-muted hover:bg-background group">
                    <td className="px-5 h-[52px]">
                      <div className="font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">Mat. {c.matricula}</div>
                      {getColaboradorStatusMeta(c).label ? (
                        <div className="mt-1 text-[11px] text-warning-strong">
                          Completar cadastro para liberar processamento RH
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 text-muted-foreground">{c.cargo}</td>
                    <td className="px-3 text-muted-foreground">{c.empresas?.nome || "-"}</td>
                    <td className="px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        c.modelo_calculo === "Diária" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"
                      )}>
                        {c.regime_trabalho ? `${c.regime_trabalho} - ${c.modelo_calculo}` : (c.tipo_colaborador || c.tipo_contrato || "-")}
                      </span>
                    </td>
                    <td className="px-3 text-right font-display font-medium">
                      R$ {(c.valor_base || 0).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-3 text-center text-muted-foreground">{c.flag_faturamento ? "Sim" : "Não"}</td>
                    <td className="px-3 text-center">
                      <Badge className={cn("font-semibold", getColaboradorOrigemMeta(c).className)}>
                        {getColaboradorOrigemMeta(c).label}
                      </Badge>
                    </td>
                    <td className="px-5 text-center">
                      <StatusChip
                        status={getColaboradorStatusMeta(c).status}
                        label={getColaboradorStatusMeta(c).label}
                      />
                    </td>
                    <td className="px-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(list || []).filter((c: any) => {
                const matchesSearch = (c.nome || "").toLowerCase().includes(searchText.toLowerCase()) ||
                  (c.matricula || "").toLowerCase().includes(searchText.toLowerCase());
                const matchesEmpresa = selectedEmpresa === "all" || c.empresa_id === selectedEmpresa;
                const matchesRegime = selectedRegime === "all" || c.regime_trabalho === selectedRegime;
                const matchesModelo = selectedModelo === "all" || c.modelo_calculo === selectedModelo;
                return matchesSearch && matchesEmpresa && matchesRegime && matchesModelo;
              }).map((c: any) => (
                <article key={c.id} className="esc-card p-5 group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-full bg-primary-soft flex items-center justify-center text-primary font-bold">
                        {c.nome.substring(0, 1).toUpperCase()}
                      </div>
                      <StatusChip
                        status={getColaboradorStatusMeta(c).status}
                        label={getColaboradorStatusMeta(c).label}
                      />
                    </div>
                    <h3 className="font-display font-bold text-lg text-foreground mb-1">{c.nome}</h3>
                    <div className="mb-3">
                      <Badge className={cn("font-semibold", getColaboradorOrigemMeta(c).className)}>
                        {getColaboradorOrigemMeta(c).label}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2"><User className="h-3 w-3" /> {c.cargo}</span>
                      <span className="font-mono text-[10px]">MATRÍCULA {c.matricula}</span>
                      {getColaboradorStatusMeta(c).label ? (
                        <span className="text-warning-strong">
                          Completar cadastro para liberar processamento RH
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    <div className="text-xs">
                      <div className="text-muted-foreground uppercase text-[9px] font-bold tracking-tight">Valor Base</div>
                      <div className="font-bold text-foreground">R$ {(c.valor_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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

          <div className="overflow-y-auto max-h-[60vh]">
            {!editingId ? (
              <>
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="nome">Nome completo <span className="text-destructive">*</span></Label>
                      <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                      <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
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
                          <Input id="valor" type="number" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: e.target.value, valor_base: e.target.value })} />
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
                          <Input id="salario_base" type="number" value={form.salario_base} onChange={(e) => setForm({ ...form, salario_base: e.target.value, valor_base: e.target.value })} />
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
                          <Input id="valor_hora" type="number" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value, valor_base: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="carga_referencia">Carga referência (h/mês) <span className="text-destructive">*</span></Label>
                          <Input id="carga_referencia" type="number" value={form.carga_referencia} onChange={(e) => setForm({ ...form, carga_referencia: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="estimativa_mensal">Estimativa mensal (R$)</Label>
                          <Input id="estimativa_mensal" type="number" value={form.estimativa_mensal} onChange={(e) => setForm({ ...form, estimativa_mensal: e.target.value })} />
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
                          <Input id="valor" type="number" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} />
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
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="nome_completo">Nome completo (como conta) <span className="text-destructive">*</span></Label>
                      <Input id="nome_completo" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
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
                  <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                  <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div className="space-y-1.5">
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
                      <Input id="valor" type="number" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: e.target.value, valor_base: e.target.value })} />
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
                      <Input id="salario_base" type="number" value={form.salario_base} onChange={(e) => setForm({ ...form, salario_base: e.target.value, valor_base: e.target.value })} />
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
                      <Input id="valor_hora" type="number" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value, valor_base: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="carga_referencia">Carga referência (h/mês) <span className="text-destructive">*</span></Label>
                      <Input id="carga_referencia" type="number" value={form.carga_referencia} onChange={(e) => setForm({ ...form, carga_referencia: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="estimativa_mensal">Estimativa mensal (R$)</Label>
                      <Input id="estimativa_mensal" type="number" value={form.estimativa_mensal} onChange={(e) => setForm({ ...form, estimativa_mensal: e.target.value })} />
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
                      <Input id="valor" type="number" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} />
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
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="nome_completo">Nome completo (como conta)</Label>
                      <Input id="nome_completo" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
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
                {step === 1 && <Button onClick={() => { if (validateStep1()) setStep(2); }} disabled={isProcessing}>Próximo</Button>}
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
    </AppShell>
  );
};

export default Colaboradores;





