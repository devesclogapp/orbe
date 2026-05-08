import { type ElementType, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  PencilLine,
  Plus,
  PowerOff,
  Settings2,
  ShoppingCart,
  Store,
  ToggleRight,
  Trash2,
  Truck,
  Users,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  SpreadsheetUploadModal,
  type SpreadsheetValidationResult,
} from "@/components/shared/SpreadsheetUploadModal";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { StatusChip } from "@/components/painel/StatusChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfigTable } from "@/components/ui/ConfigTable";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ColaboradorService,
  ColetorService,
  ConfigProdutoService,
  ConfigTipoDiaService,
  ConfigTipoOperacaoService,
  ConfiguracaoOperacionalService,
  EmpresaService,
  FornecedorService,
  ImportacaoModelosService,
  TipoServicoOperacionalService,
  TransportadoraClienteService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";

type CadastroTabValue =
  | "colaboradores"
  | "empresas"
  | "coletores"
  | "transportadoras"
  | "fornecedores"
  | "servicos"
  | "parametros";

const TECHNICAL_COLUMNS = [
  "ID",
  "TENANT_ID",
  "CREATED_AT",
  "UPDATED_AT",
  "CREATED_BY",
  "USER_ID",
  "AUTH_ID",
];

const VALID_DB_COLUMNS_EMPRESAS = [
  'nome', 'cnpj', 'unidade', 'cidade', 'estado',
  'status', 'banco_codigo', 'agencia', 'agencia_digito',
  'conta', 'conta_digito', 'convenios_bancario',
  'codigo_empresa_banco', 'nome_empresa_banco',
  'tenant_id', 'id', 'created_at', 'updated_at'
];

function sanitizeEmpresaPayload(form: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const key of VALID_DB_COLUMNS_EMPRESAS) {
    if (form[key] !== undefined) {
      sanitized[key] = form[key] === '' ? null : form[key];
    }
  }
  return sanitized;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validateCNPJ(cnpj: string): { valid: boolean; reason?: string } {
  if (!cnpj || cnpj.trim() === '') return { valid: false, reason: 'CNPJ é obrigatório.' };
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return { valid: false, reason: 'CNPJ deve ter 14 dígitos.' };
  if (/^(.)\1+$/.test(digits)) return { valid: false, reason: 'CNPJ inválido.' };
  return { valid: true };
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toUpperCase();

const getRowValue = (row: Record<string, unknown>, ...columns: string[]) => {
  const entry = Object.entries(row).find(([key]) => columns.some((column) => normalizeText(key) === normalizeText(column)));
  return String(entry?.[1] ?? "").trim();
};

const parseBooleanLike = (value: string, defaultValue = true) => {
  const normalized = normalizeText(value);
  if (!normalized) return defaultValue;
  if (["SIM", "TRUE", "1", "ATIVO", "ATIVA", "YES"].includes(normalized)) return true;
  if (["NAO", "NÃO", "FALSE", "0", "INATIVO", "INATIVA", "NO"].includes(normalized)) return false;
  return defaultValue;
};

const parseCurrencyLike = (value: string) => {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const splitCidadeUf = (value: string) => {
  const raw = value.trim();
  if (!raw) return { cidade: "", estado: "" };
  const parts = raw.split("/");
  if (parts.length < 2) return { cidade: raw, estado: "" };
  return {
    cidade: parts.slice(0, -1).join("/").trim(),
    estado: parts[parts.length - 1].trim().toUpperCase(),
  };
};

const CadastroTabTrigger = ({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: ElementType;
  children: ReactNode;
}) => (
  <TabsTrigger value={value} className="gap-2">
    <Icon className="h-4 w-4" />
    <span>{children}</span>
  </TabsTrigger>
);

const CentralCadastros = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const empresaId = user?.user_metadata?.empresa_id;

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CadastroTabValue>("colaboradores");
  const [configType, setConfigType] = useState<"operacao" | "produto" | "dia">("operacao");
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState<any>({});
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [paramsForm, setParamsForm] = useState<any>({});

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<"transportadora" | "fornecedor" | "servico" | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteErrorDetails, setDeleteErrorDetails] = useState<{ tabela: string; count: number; ids?: string[] }[]>([]);

  const [colaboradorModalOpen, setColaboradorModalOpen] = useState(false);
  const [colaboradorStep, setColaboradorStep] = useState(1);
  const [colaboradorForm, setColaboradorForm] = useState({
    nome: "", cpf: "", telefone: "", cargo: "", matricula: "",
    empresa_id: empresaId || "",
    tipo_colaborador: "CLT",
    tipo_contrato: "Hora" as "Hora" | "Operação" | "Mensal",
    valor_base: "22", flag_faturamento: true, permitir_lancamento_operacional: false,
    status: "ativo",
    nome_completo: "",
    banco_codigo: "",
    agencia: "",
    agencia_digito: "",
    conta: "",
    conta_digito: "",
    tipo_conta: "corrente",
  });
  const [colaboradorIsProcessing, setColaboradorIsProcessing] = useState(false);
  const [colaboradorBankNameLocked, setColaboradorBankNameLocked] = useState(true);

  const normalizePhoneCC = (value: string) => value.replace(/\D/g, "");

  const formatPhoneForDisplayCC = (value: string) => {
    const digits = normalizePhoneCC(value).slice(0, 11);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const validatePhoneCC = (value: string) => {
    const digits = normalizePhoneCC(value);
    if (!digits) return "Telefone é obrigatório.";
    if (!/^\d{10,11}$/.test(digits)) return "Telefone inválido.";
    return null;
  };

  const handlePhoneChangeCC = (raw: string) => {
    const digits = normalizePhoneCC(raw);
    if (digits.length > 11) return;
    setColaboradorForm(prev => ({ ...prev, telefone: formatPhoneForDisplayCC(digits) }));
  };

  const [editingColaborador, setEditingColaborador] = useState<any>(null);
  const [editingColaboradorIsProcessing, setEditingColaboradorIsProcessing] = useState(false);

  const handleEditPhoneChangeCC = (raw: string) => {
    if (!editingColaborador) return;
    const digits = normalizePhoneCC(raw);
    if (digits.length > 11) return;
    setEditingColaborador(prev => ({ ...prev, telefone: formatPhoneForDisplayCC(digits) }));
  };

  const updateColaboradorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => {
      setEditingColaboradorIsProcessing(true);
      return ColaboradorService.update(id, {
        ...payload,
        cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, '') : null,
        telefone: payload.telefone ? String(payload.telefone).replace(/\D/g, '') : null,
      });
    },
    onSuccess: async () => {
      toast.success("Colaborador atualizado com sucesso.");
      setEditingColaborador(null);
      await queryClient.cancelQueries({ queryKey: ["colaboradores_list"] });
      queryClient.removeQueries({ queryKey: ["colaboradores_list"] });
      await queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('já existe') || msg.includes('cpf')) {
        toast.error("Já existe um colaborador cadastrado com este CPF.");
      } else {
        toast.error(msg || "Erro ao atualizar colaborador.");
      }
    },
    onSettled: () => setEditingColaboradorIsProcessing(false),
  });

  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);
  const [empresaForm, setEmpresaForm] = useState({
    nome: "", cnpj: "", unidade: "", cidade: "", estado: "",
    banco_codigo: "", agencia: "", agencia_digito: "", conta: "", conta_digito: "",
    convenios_bancario: "", codigo_empresa_banco: "", nome_empresa_banco: "",
  });
  const [empresaFormErrors, setEmpresaFormErrors] = useState<Record<string, string>>({});

  const [editingEmpresa, setEditingEmpresa] = useState<any>(null);
  const updateEmpresaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => EmpresaService.update(id, payload),
    onSuccess: async () => {
      toast.success("Empresa atualizada com sucesso.");
      setEditingEmpresa(null);
      setEmpresaFormErrors({});
      await queryClient.cancelQueries({ queryKey: ["empresas"] });
      queryClient.removeQueries({ queryKey: ["empresas"] });
      await queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('já existe')) {
        toast.error("Já existe uma empresa cadastrada com este CNPJ.", { duration: 5000 });
      } else {
        toast.error("Erro ao atualizar empresa.", { description: msg });
      }
    },
  });

  const [coletorModalOpen, setColetorModalOpen] = useState(false);
  const [coletorForm, setColetorForm] = useState({
    modelo: "", serie: "", empresa_id: empresaId || "",
  });

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getWithCounts(),
  });

  const { data: colaboradores = [], isLoading: loadingColaboradores } = useQuery<any[]>({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });

  const { data: coletores = [], isLoading: loadingColetores } = useQuery<any[]>({
    queryKey: ["coletores"],
    queryFn: () => ColetorService.getWithEmpresa(),
  });

  const { data: transportadoras = [], isLoading: loadingTransportadoras } = useQuery<any[]>({
    queryKey: ["transportadoras"],
    queryFn: () => TransportadoraClienteService.getByEmpresa(empresaId),
    staleTime: 0,
    select: (data) => data.filter((t: any) => t.ativo !== false),
  });

  const { data: fornecedores = [], isLoading: loadingFornecedores } = useQuery<any[]>({
    queryKey: ["fornecedores"],
    queryFn: () => FornecedorService.getByEmpresa(empresaId),
    staleTime: 0,
    select: (data) => data.filter((f: any) => f.ativo !== false),
  });

  const { data: tiposServico = [], isLoading: loadingTiposServico } = useQuery<any[]>({
    queryKey: ["tipos_servico_operacional"],
    queryFn: () => TipoServicoOperacionalService.getAllActive(),
    staleTime: 0,
    select: (data) => data.filter((s: any) => s.ativo !== false),
  });

  const { data: tiposOperacao = [], isLoading: loadingOps } = useQuery<any[]>({
    queryKey: ["config_tipos_operacao"],
    queryFn: () => ConfigTipoOperacaoService.getAll(),
  });

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery<any[]>({
    queryKey: ["config_produtos"],
    queryFn: () => ConfigProdutoService.getAll(),
  });

  const { data: tiposDia = [], isLoading: loadingTiposDia } = useQuery<any[]>({
    queryKey: ["config_tipos_dia"],
    queryFn: () => ConfigTipoDiaService.getAll(),
  });

  const { data: opSettings } = useQuery<any>({
    queryKey: ["config_operacional", empresaId],
    queryFn: () => ConfiguracaoOperacionalService.getByEmpresa(empresaId),
    enabled: !!empresaId,
  });

  const { data: importacaoModelos = [] } = useQuery<any[]>({
    queryKey: ["importacao_modelos"],
    queryFn: () => ImportacaoModelosService.listAll(),
  });

  useEffect(() => {
    if (opSettings) {
      setParamsForm(opSettings);
    }
  }, [opSettings]);

  const saveParamsMutation = useMutation({
    mutationFn: (payload: any) => ConfiguracaoOperacionalService.upsert({ ...payload, empresa_id: empresaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config_operacional"] });
      setIsEditingParams(false);
      toast.success("Parâmetros salvos com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar parâmetros", { description: err.message }),
  });

  const toggleOpStatus = useMutation({
    mutationFn: (item: any) =>
      ConfigTipoOperacaoService.update(item.id, { status: item.status === "ativo" ? "inativo" : "ativo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config_tipos_operacao"] });
      toast.success("Status atualizado");
    },
  });

  const configMutation = useMutation({
    mutationFn: (payload: any) => {
      const service =
        configType === "operacao"
          ? ConfigTipoOperacaoService
          : configType === "produto"
            ? ConfigProdutoService
            : ConfigTipoDiaService;
      return editingConfig ? service.update(editingConfig.id, payload) : service.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `config_tipos_${configType === "operacao" ? "operacao" : configType === "produto" ? "produtos" : "dia"}`,
        ],
      });
      toast.success(editingConfig ? "Registro atualizado" : "Registro criado");
      setConfigModalOpen(false);
    },
    onError: (err: any) => toast.error("Erro ao salvar", { description: err.message }),
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: string) => {
      const service =
        configType === "operacao"
          ? ConfigTipoOperacaoService
          : configType === "produto"
            ? ConfigProdutoService
            : ConfigTipoDiaService;
      return service.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `config_tipos_${configType === "operacao" ? "operacao" : configType === "produto" ? "produtos" : "dia"}`,
        ],
      });
      toast.success("Registro removido");
    },
  });

  const createColaboradorMutation = useMutation({
    mutationFn: (payload: any) => {
      setColaboradorIsProcessing(true);
      return ColaboradorService.create({
        ...payload,
        cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, '') : null,
        telefone: payload.telefone ? String(payload.telefone).replace(/\D/g, '') : null,
        valor_base: Number(payload.valor_base) || 0,
      });
    },
    onSuccess: async () => {
      toast.success("Colaborador cadastrado com sucesso.");
      setColaboradorModalOpen(false);
      setColaboradorForm({
        nome: "", cpf: "", telefone: "", cargo: "", matricula: "",
        empresa_id: empresaId || "",
        tipo_colaborador: "CLT",
        tipo_contrato: "Hora",
        valor_base: "22", flag_faturamento: true, permitir_lancamento_operacional: false,
        status: "ativo",
        nome_completo: "",
        banco_codigo: "",
        agencia: "",
        agencia_digito: "",
        conta: "",
        conta_digito: "",
        tipo_conta: "corrente",
      });
      await queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
      const data = await queryClient.fetchQuery({ queryKey: ["colaboradores_list"], queryFn: () => ColaboradorService.getWithEmpresa() });
      queryClient.setQueryData(["colaboradores_list"], data);
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('já existe') || msg.includes('cpf')) {
        toast.error("Já existe um colaborador cadastrado com este CPF.");
      } else {
        toast.error(msg || "Erro ao cadastrar colaborador. Verifique os campos obrigatórios.");
      }
    },
    onSettled: () => setColaboradorIsProcessing(false),
  });

  const validateColaboradorStep1 = () => {
    if (!colaboradorForm.nome.trim()) {
      toast.error("Nome completo é obrigatório.", { icon: null });
      return false;
    }
    if (!colaboradorForm.cpf.trim()) {
      toast.error("CPF é obrigatório.", { icon: null });
      return false;
    }
    const cpfClean = colaboradorForm.cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido.", { icon: null });
      return false;
    }
    const phoneError = validatePhoneCC(colaboradorForm.telefone);
    if (phoneError) {
      toast.error(phoneError, { icon: null });
      return false;
    }
    if (!colaboradorForm.empresa_id && !empresaId) {
      toast.error("Empresa é obrigatória.", { icon: null });
      return false;
    }
    return true;
  };

  const validateColaboradorStep2 = () => {
    if (!colaboradorForm.tipo_colaborador) {
      toast.error("Tipo de colaborador é obrigatório.", { icon: null });
      return false;
    }
    if (!colaboradorForm.status) {
      toast.error("Status é obrigatório.", { icon: null });
      return false;
    }
    if (colaboradorForm.tipo_colaborador === "DIARISTA") {
      if (!colaboradorForm.cargo.trim()) {
        toast.error("Função operacional é obrigatória.", { icon: null });
        return false;
      }
      if (!colaboradorForm.valor_base || Number(colaboradorForm.valor_base) <= 0) {
        toast.error("Valor da diária é obrigatório.", { icon: null });
        return false;
      }
    } else {
      if (!colaboradorForm.cargo.trim()) {
        toast.error("Cargo é obrigatório.", { icon: null });
        return false;
      }
      if (!colaboradorForm.matricula.trim()) {
        toast.error("Matrícula é obrigatória.", { icon: null });
        return false;
      }
      if (!colaboradorForm.tipo_contrato) {
        toast.error("Tipo de contrato é obrigatório.", { icon: null });
        return false;
      }
      if (!colaboradorForm.valor_base || Number(colaboradorForm.valor_base) <= 0) {
        toast.error("Valor base é obrigatório.", { icon: null });
        return false;
      }
    }
    return true;
  };

  const validateColaboradorStep3 = () => {
    const hasBankField = colaboradorForm.nome_completo || colaboradorForm.banco_codigo || colaboradorForm.agencia || colaboradorForm.conta;
    if (colaboradorForm.flag_faturamento && hasBankField) {
      if (!colaboradorForm.nome_completo?.trim()) {
        toast.error("Nome completo da conta é obrigatório.", { icon: null });
        return false;
      }
      if (!colaboradorForm.banco_codigo?.trim()) {
        toast.error("Código do banco é obrigatório.", { icon: null });
        return false;
      }
      if (!colaboradorForm.tipo_conta) {
        toast.error("Tipo de conta é obrigatório.", { icon: null });
        return false;
      }
      if (!colaboradorForm.agencia?.trim()) {
        toast.error("Agência é obrigatória.", { icon: null });
        return false;
      }
      if (!colaboradorForm.conta?.trim()) {
        toast.error("Conta é obrigatória.", { icon: null });
        return false;
      }
    }
    if (!hasBankField && colaboradorForm.flag_faturamento) {
      toast.warning("Para faturamento, preencha os dados bancários.", { icon: null, duration: 3000 });
    }
    return true;
  };

  const deleteColaboradorMutation = useMutation({
    mutationFn: (id: string) => ColaboradorService.delete(id),
    onSuccess: async () => {
      toast.success("Colaborador excluído com sucesso");
      await queryClient.cancelQueries({ queryKey: ["colaboradores_list"] });
      queryClient.removeQueries({ queryKey: ["colaboradores_list"] });
      await queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
    },
    onError: (err: any) => toast.error("Erro ao excluir", { description: err.message }),
  });

  const createEmpresaMutation = useMutation({
    mutationFn: (payload: any) => EmpresaService.create(payload),
    onSuccess: async () => {
      toast.success("Empresa cadastrada com sucesso.");
      setEmpresaModalOpen(false);
      setEmpresaFormErrors({});
      setEditingEmpresa(null);
      setEmpresaForm({
        nome: "", cnpj: "", unidade: "", cidade: "", estado: "",
        banco_codigo: "", agencia: "", agencia_digito: "", conta: "", conta_digito: "",
        convenios_bancario: "", codigo_empresa_banco: "", nome_empresa_banco: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["empresas"] });
      const data = await queryClient.fetchQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getWithCounts() });
      queryClient.setQueryData(["empresas"], data);
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('já existe')) {
        toast.error("Já existe uma empresa cadastrada com este CNPJ.", { duration: 5000 });
      } else {
        toast.error("Erro ao salvar empresa.", { description: msg });
      }
    },
  });

  const deleteEmpresaMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await EmpresaService.deleteWithCheck(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Empresa excluída com sucesso");
      await queryClient.cancelQueries({ queryKey: ["empresas"] });
      queryClient.removeQueries({ queryKey: ["empresas"] });
      await queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      toast.error(msg || "Erro ao excluir empresa.");
    },
  });

  const createColetorMutation = useMutation({
    mutationFn: (payload: any) => ColetorService.create(payload),
    onSuccess: async () => {
      toast.success("Coletor cadastrado com sucesso");
      setColetorModalOpen(false);
      setColetorForm({ modelo: "", serie: "", empresa_id: empresaId || "" });
      await queryClient.invalidateQueries({ queryKey: ["coletores"] });
      const data = await queryClient.fetchQuery({ queryKey: ["coletores"], queryFn: () => ColetorService.getWithEmpresa() });
      queryClient.setQueryData(["coletores"], data);
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const deleteColetorMutation = useMutation({
    mutationFn: (id: string) => ColetorService.delete(id),
    onSuccess: async () => {
      toast.success("Coletor excluído com sucesso");
      await queryClient.cancelQueries({ queryKey: ["coletores"] });
      queryClient.removeQueries({ queryKey: ["coletores"] });
      await queryClient.invalidateQueries({ queryKey: ["coletores"] });
    },
    onError: (err: any) => toast.error("Erro ao excluir", { description: err.message }),
  });

  const [transportadoraModalOpen, setTransportadoraModalOpen] = useState(false);
  const [transportadoraForm, setTransportadoraForm] = useState({
    nome: "", documento: "", telefone: "", email: "", endereco: "", empresa_id: empresaId || "",
  });

  const createTransportadoraMutation = useMutation({
    mutationFn: (payload: any) => TransportadoraClienteService.create(payload),
    onSuccess: async () => {
      toast.success("Transportadora cadastrada com sucesso");
      setTransportadoraModalOpen(false);
      setTransportadoraForm({ nome: "", documento: "", telefone: "", email: "", endereco: "", empresa_id: empresaId || "" });
      await new Promise(r => setTimeout(r, 500));
      await queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
      const data = await queryClient.fetchQuery({ queryKey: ["transportadoras"], queryFn: () => TransportadoraClienteService.getByEmpresa() });
      queryClient.setQueryData(["transportadoras"], data);
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const [fornecedorModalOpen, setFornecedorModalOpen] = useState(false);
  const [fornecedorForm, setFornecedorForm] = useState({
    nome: "", documento: "", telefone: "", email: "", endereco: "", empresa_id: empresaId || "",
  });

  const createFornecedorMutation = useMutation({
    mutationFn: (payload: any) => FornecedorService.create(payload),
    onSuccess: async () => {
      toast.success("Fornecedor cadastrado com sucesso");
      setFornecedorModalOpen(false);
      setFornecedorForm({ nome: "", documento: "", telefone: "", email: "", endereco: "", empresa_id: empresaId || "" });
      await new Promise(r => setTimeout(r, 500));
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      const data = await queryClient.fetchQuery({ queryKey: ["fornecedores"], queryFn: () => FornecedorService.getByEmpresa() });
      queryClient.setQueryData(["fornecedores"], data);
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const [servicoModalOpen, setServicoModalOpen] = useState(false);
  const [servicoForm, setServicoForm] = useState({
    nome: "", descricao: "", ativo: true, empresa_id: empresaId || "",
  });

  const createServicoMutation = useMutation({
    mutationFn: (payload: any) => TipoServicoOperacionalService.create(payload),
    onSuccess: async () => {
      toast.success("Tipo de serviço cadastrado com sucesso");
      setServicoModalOpen(false);
      setServicoForm({ nome: "", descricao: "", ativo: true, empresa_id: empresaId || "" });
      await new Promise(r => setTimeout(r, 500));
      await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      const data = await queryClient.fetchQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
      queryClient.setQueryData(["tipos_servico_operacional"], data);
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const [editingFornecedor, setEditingFornecedor] = useState<any>(null);
  const updateFornecedorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => FornecedorService.update(id, payload),
    onSuccess: async () => {
      toast.success("Fornecedor atualizado com sucesso");
      setEditingFornecedor(null);
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      const data = await queryClient.fetchQuery({ queryKey: ["fornecedores"], queryFn: () => FornecedorService.getByEmpresa() });
      queryClient.setQueryData(["fornecedores"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar", { description: err.message }),
  });
const deleteFornecedorMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await FornecedorService.deleteWithCheck(id);
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Fornecedor excluído com sucesso");
      await queryClient.cancelQueries({ queryKey: ["fornecedores"] });
      queryClient.removeQueries({ queryKey: ["fornecedores"] });
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      const data = await queryClient.fetchQuery({ queryKey: ["fornecedores"], queryFn: () => FornecedorService.getByEmpresa() });
      queryClient.setQueryData(["fornecedores"], data);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir fornecedor", { description: err.message }),
  });

  const toggleFornecedorAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => FornecedorService.toggleAtivo(id, ativo),
    onSuccess: async (_data, { ativo }) => {
      toast.success(ativo ? "Fornecedor ativado com sucesso" : "Fornecedor desativado com sucesso");
      await queryClient.cancelQueries({ queryKey: ["fornecedores"] });
      queryClient.removeQueries({ queryKey: ["fornecedores"] });
      await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      const data = await queryClient.fetchQuery({ queryKey: ["fornecedores"], queryFn: () => FornecedorService.getByEmpresa() });
      queryClient.setQueryData(["fornecedores"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar status", { description: err.message }),
  });

  const [editingTransportadora, setEditingTransportadora] = useState<any>(null);
  const updateTransportadoraMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => TransportadoraClienteService.update(id, payload),
    onSuccess: async () => {
      toast.success("Transportadora atualizada com sucesso");
      setEditingTransportadora(null);
      await queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
      const data = await queryClient.fetchQuery({ queryKey: ["transportadoras"], queryFn: () => TransportadoraClienteService.getByEmpresa() });
      queryClient.setQueryData(["transportadoras"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar", { description: err.message }),
  });
  const deleteTransportadoraMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await TransportadoraClienteService.deleteWithCheck(id);
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Transportadora excluída com sucesso");
      await queryClient.cancelQueries({ queryKey: ["transportadoras"] });
      queryClient.removeQueries({ queryKey: ["transportadoras"] });
      await queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
      const data = await queryClient.fetchQuery({ queryKey: ["transportadoras"], queryFn: () => TransportadoraClienteService.getByEmpresa() });
      queryClient.setQueryData(["transportadoras"], data);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir transportadora", { description: err.message }),
  });

  const toggleTransportadoraAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => TransportadoraClienteService.toggleAtivo(id, ativo),
    onSuccess: async (_data, { ativo }) => {
      toast.success(ativo ? "Transportadora ativada com sucesso" : "Transportadora desativada com sucesso");
      await queryClient.cancelQueries({ queryKey: ["transportadoras"] });
      queryClient.removeQueries({ queryKey: ["transportadoras"] });
      await queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
      const data = await queryClient.fetchQuery({ queryKey: ["transportadoras"], queryFn: () => TransportadoraClienteService.getByEmpresa() });
      queryClient.setQueryData(["transportadoras"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar status", { description: err.message }),
  });

  const [editingServico, setEditingServico] = useState<any>(null);
  const updateServicoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => TipoServicoOperacionalService.update(id, payload),
    onSuccess: async () => {
      toast.success("Tipo de serviço atualizado com sucesso");
      setEditingServico(null);
      await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      const data = await queryClient.fetchQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
      queryClient.setQueryData(["tipos_servico_operacional"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar", { description: err.message }),
  });
  const deleteServicoMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await TipoServicoOperacionalService.deleteWithCheck(id);
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Tipo de serviço excluído com sucesso");
      await queryClient.cancelQueries({ queryKey: ["tipos_servico_operacional"] });
      queryClient.removeQueries({ queryKey: ["tipos_servico_operacional"] });
      await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      const data = await queryClient.fetchQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
      queryClient.setQueryData(["tipos_servico_operacional"], data);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir tipo de serviço", { description: err.message }),
  });

  const toggleServicoAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => TipoServicoOperacionalService.toggleAtivo(id, ativo),
    onSuccess: async (_data, { ativo }) => {
      toast.success(ativo ? "Tipo de serviço ativado com sucesso" : "Tipo de serviço desativado com sucesso");
      await queryClient.cancelQueries({ queryKey: ["tipos_servico_operacional"] });
      queryClient.removeQueries({ queryKey: ["tipos_servico_operacional"] });
      await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
      const data = await queryClient.fetchQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
      queryClient.setQueryData(["tipos_servico_operacional"], data);
    },
    onError: (err: any) => toast.error("Erro ao atualizar status", { description: err.message }),
  });

  const handleAddConfig = (type: "operacao" | "produto" | "dia") => {
    setConfigType(type);
    setEditingConfig(null);
    setConfigForm(
      type === "operacao"
        ? { nome: "", codigo: "", status: "ativo", empresa_id: empresaId }
        : type === "produto"
          ? { categoria: "", icms: 0, status: "ativo", empresa_id: empresaId }
          : { nome: "", fator: 1, status: "ativo", empresa_id: empresaId }
    );
    setConfigModalOpen(true);
  };

  const handleEditConfig = (type: "operacao" | "produto" | "dia", item: any) => {
    setConfigType(type);
    setEditingConfig(item);
    setConfigForm({ ...item });
    setConfigModalOpen(true);
  };

  const handleImport = async (data: any[]) => {
    let count = 0;
    try {
      for (const row of data) {
        // Tenta descobrir o tipo de importação pelas colunas
        const hasIcms = 'ICMS' in row || 'icms' in row;
        const hasCategoria = 'Categoria' in row || 'categoria' in row;
        const hasFator = 'Fator' in row || 'fator' in row;

        if (hasIcms || hasCategoria) {
          // Importa Produto
          await ConfigProdutoService.create({
            categoria: row['Categoria'] || row['categoria'] || 'Sem Categoria',
            icms: Number(row['ICMS'] || row['icms'] || 0),
            status: 'ativo',
            empresa_id: empresaId
          });
        } else if (hasFator) {
          // Importa Dia
          await ConfigTipoDiaService.create({
            nome: row['Nome'] || row['nome'] || row['Descrição'] || '',
            fator: Number(row['Fator'] || row['fator'] || 1),
            status: 'ativo',
            empresa_id: empresaId
          });
        } else {
          // Importa Operacao default
          const nome = row['Nome'] || row['nome'] || row['Operação'] || '';
          if (!nome) continue;
          await ConfigTipoOperacaoService.create({
            nome,
            codigo: row['Código'] || row['codigo'] || '',
            status: 'ativo',
            empresa_id: empresaId
          });
        }
        count++;
      }
      toast.success(`${count} registros importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["config_tipos_operacao"] });
      queryClient.invalidateQueries({ queryKey: ["config_produtos"] });
      queryClient.invalidateQueries({ queryKey: ["config_tipos_dia"] });
    } catch (e: any) {
      toast.error("Erro parcial na importação. Alguns registros podem ter falhado.", { description: e.message });
      queryClient.invalidateQueries({ queryKey: ["config_tipos_operacao"] });
      queryClient.invalidateQueries({ queryKey: ["config_produtos"] });
      queryClient.invalidateQueries({ queryKey: ["config_tipos_dia"] });
    }
  };

  const getIgnoredTechnicalColumns = (rows: Record<string, unknown>[]) => {
    const headers = rows.flatMap((row) => Object.keys(row));
    return Array.from(new Set(headers.filter((header) => TECHNICAL_COLUMNS.includes(normalizeText(header)))));
  };

  const activeImportConfig = useMemo(() => {
    const buildResult = (
      rows: Record<string, unknown>[],
      mapper: (
        row: Record<string, unknown>,
        index: number,
      ) => { payload?: Record<string, any>; preview?: Record<string, any>; error?: string },
    ): SpreadsheetValidationResult => {
      const errors: string[] = [];
      const validRows: Record<string, any>[] = [];
      const previewRows: Record<string, any>[] = [];
      const warnings: string[] = [];
      const ignoredColumns = getIgnoredTechnicalColumns(rows);

      if (ignoredColumns.length > 0) {
        warnings.push(`Colunas tÃ©cnicas ignoradas automaticamente: ${ignoredColumns.join(", ")}.`);
      }

      rows.forEach((row, index) => {
        const result = mapper(row, index);
        if (result.error) {
          errors.push(result.error);
          return;
        }
        if (result.payload) validRows.push(result.payload);
        if (result.preview) previewRows.push(result.preview);
      });

      return {
        validRows,
        errors,
        warnings,
        previewRows: previewRows.slice(0, 5),
      };
    };

    const colaboradoresEmpresaLookup = new Map(
      empresas.map((empresa) => [normalizeText(String(empresa.nome ?? "")), empresa]),
    );
    
    const existingCpfsLookup = new Set(
      (colaboradores || [])
        .filter(c => c.cpf)
        .map(c => String(c.cpf).replace(/\D/g, ''))
    );
    
    const modeloImportacaoAtivo = importacaoModelos.find(
      (item) => item.modulo === activeTab && item.ativo && item.drive_url,
    );

    const configs: Record<
      CadastroTabValue,
      {
        label: string;
        description: string;
        downloadUrl?: string;
        expectedColumns?: string[];
        templateFileName?: string;
        unsupportedMessage?: string;
        validateData?: (rows: Record<string, unknown>[]) => SpreadsheetValidationResult;
        onUpload?: (rows: Record<string, any>[]) => Promise<void>;
      }
    > = {
      colaboradores: {
        label: "Colaboradores",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba Colaboradores.",
        downloadUrl: modeloImportacaoAtivo?.drive_url,
        expectedColumns: ["NOME", "CPF", "TELEFONE", "EMPRESA", "TIPO", "CARGO", "CONTRATO", "VALOR BASE", "FATURAMENTO", "STATUS"],
        templateFileName: "modelo_operadores_colaboradores.xlsx",
validateData: (rows) => {
          const seenInSheet = new Set<string>();
          
          return buildResult(rows, (row, index) => {
            const nome = getRowValue(row, "NOME");
            const cpf = getRowValue(row, "CPF");
            const telefone = getRowValue(row, "TELEFONE");
            const empresaNome = getRowValue(row, "EMPRESA");
            const cargo = getRowValue(row, "CARGO");
            const tipoNormalizado = normalizeText(getRowValue(row, "TIPO"));
            const contratoNormalizado = normalizeText(getRowValue(row, "CONTRATO"));
            const valorBase = parseCurrencyLike(getRowValue(row, "VALOR BASE"));
            const faturamento = parseBooleanLike(getRowValue(row, "FATURAMENTO"), true);
            const statusNormalizado = normalizeText(getRowValue(row, "STATUS"));
            const empresa = colaboradoresEmpresaLookup.get(normalizeText(empresaNome));
            const tipoColaborador = tipoNormalizado === "DIARISTA"
              ? "DIARISTA"
              : tipoNormalizado === "INTERMITENTE"
                ? "INTERMITENTE"
                : tipoNormalizado === "TERCEIRIZADO"
                  ? "TERCEIRIZADO"
                  : tipoNormalizado === "PRODUCAO"
                    ? "PRODUÇÃO"
                    : "CLT";
            const tipoContrato = tipoColaborador === "DIARISTA"
              ? null
              : contratoNormalizado === "OPERACAO" || contratoNormalizado === "OPERAÇÃO"
                ? "Operação"
                : "Hora";
            const status = statusNormalizado === "INATIVO" ? "inativo" : statusNormalizado === "PENDENTE" ? "pendente" : "ativo";

            if (!nome) return { error: `Linha ${index + 2}: informe o campo NOME.` };
            if (!empresaNome) return { error: `Linha ${index + 2}: informe o campo EMPRESA.` };
            if (!empresa?.id) return { error: `Linha ${index + 2}: empresa "${empresaNome}" não encontrada neste tenant.` };
            if (tipoColaborador !== "DIARISTA" && !cargo) return { error: `Linha ${index + 2}: CARGO é obrigatório para colaboradores não diaristas.` };
            
            const cpfClean = cpf ? String(cpf).replace(/\D/g, '') : '';
            const telefoneClean = telefone ? String(telefone).replace(/\D/g, '') : '';
            if (cpfClean && cpfClean.length === 11) {
              if (existingCpfsLookup.has(cpfClean)) {
                return { error: `Linha ${index + 2}: CPF duplicado no sistema.` };
              }
              if (seenInSheet.has(cpfClean)) {
                return { error: `Linha ${index + 2}: CPF repetido na planilha.` };
              }
              seenInSheet.add(cpfClean);
            }

            const payload = {
              nome,
              cpf: cpfClean || null,
              telefone: telefoneClean || null,
              cargo: cargo || null,
              matricula: null,
              empresa_id: empresa.id,
              tipo_colaborador: tipoColaborador,
              tipo_contrato: tipoContrato,
              valor_base: valorBase,
              flag_faturamento: tipoColaborador === "DIARISTA" ? false : faturamento,
              permitir_lancamento_operacional: tipoColaborador === "DIARISTA",
              status,
              nome_completo: null,
              banco_codigo: null,
              agencia: null,
              agencia_digito: null,
              conta: null,
              conta_digito: null,
              tipo_conta: "corrente",
            };

            return {
              payload,
              preview: { NOME: nome, EMPRESA: empresa.nome, TIPO: tipoColaborador, CARGO: cargo || "—", STATUS: status },
            };
          });
        },
        onUpload: async (rows) => {
          let imported = 0;
          let ignored = 0;
          let duplicates = 0;
          let errors = 0;
          const errorMessages: string[] = [];
          
          for (const row of rows) {
            try {
              await ColaboradorService.create(row);
              imported++;
            } catch (err: any) {
              const msg = err?.message || "";
              if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("já existe") || msg.includes("cpf")) {
                duplicates++;
              } else {
                errors++;
                if (errorMessages.length < 5) {
                  errorMessages.push(msg || "Erro ao importar");
                }
              }
            }
          }
          
          await queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
          
          if (errors > 0 && imported === 0) {
            throw new Error("Importação bloqueada. Corrija os erros indicados.");
          }
          
          toast.success(
            `Importação concluída: ${imported} colaborador(es) importado(s), ${ignored} ignorado(s), ${duplicates} duplicado(s), ${errors} erro(s).`
          );
        },
      },
      empresas: {
        label: "Empresas",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba Empresas.",
        downloadUrl: modeloImportacaoAtivo?.drive_url,
        expectedColumns: ["NOME", "CNPJ", "UNIDADE", "CIDADE/UF", "STATUS"],
        templateFileName: "modelo_empresas.xlsx",
        validateData: (rows) =>
          buildResult(rows, (row, index) => {
            const nome = getRowValue(row, "NOME");
            const cnpj = getRowValue(row, "CNPJ");
            const unidade = getRowValue(row, "UNIDADE");
            const cidadeUf = getRowValue(row, "CIDADE/UF");
            const statusNormalizado = normalizeText(getRowValue(row, "STATUS"));
            const { cidade, estado } = splitCidadeUf(cidadeUf);

            if (!nome) return { error: `Linha ${index + 2}: informe o campo NOME.` };
            if (!cnpj) return { error: `Linha ${index + 2}: informe o campo CNPJ.` };
            if (!cidadeUf) return { error: `Linha ${index + 2}: informe o campo CIDADE/UF.` };
            if (!estado) return { error: `Linha ${index + 2}: use o formato CIDADE/UF no campo CIDADE/UF.` };

            const payload = {
              nome,
              cnpj,
              unidade: unidade || null,
              cidade,
              estado,
              status: statusNormalizado === "INATIVA" || statusNormalizado === "INATIVO" ? "inativa" : "ativa",
            };

            return {
              payload,
              preview: { NOME: nome, CNPJ: cnpj, "CIDADE/UF": `${cidade}/${estado}`, STATUS: payload.status },
            };
          }),
        onUpload: async (rows) => {
          for (const row of rows) await EmpresaService.create(row);
          await queryClient.invalidateQueries({ queryKey: ["empresas"] });
        },
      },
      coletores: {
        label: "Coletores",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba Coletores.",
        unsupportedMessage: "Modelo de importaÃ§Ã£o de coletores ainda nÃ£o configurado.",
      },
      transportadoras: {
        label: "Transportadoras",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba Transportadoras.",
        downloadUrl: modeloImportacaoAtivo?.drive_url,
        expectedColumns: ["NOME", "CNPJ/CPF", "TELEFONE", "EMAIL", "ENDERECO", "STATUS"],
        templateFileName: "modelo_transportadoras.xlsx",
        validateData: (rows) =>
          buildResult(rows, (row, index) => {
            const nome = getRowValue(row, "NOME");
            if (!nome) return { error: `Linha ${index + 2}: informe o campo NOME.` };
            const ativo = parseBooleanLike(getRowValue(row, "STATUS"), true);
            const payload = {
              nome,
              documento: getRowValue(row, "CNPJ/CPF") || null,
              telefone: getRowValue(row, "TELEFONE") || null,
              email: getRowValue(row, "EMAIL") || null,
              endereco: getRowValue(row, "ENDERECO", "ENDEREÇO") || null,
              empresa_id: empresaId || null,
              ativo,
            };
            return {
              payload,
              preview: { NOME: nome, DOCUMENTO: payload.documento || "â€”", STATUS: ativo ? "Ativo" : "Inativo" },
            };
          }),
        onUpload: async (rows) => {
          for (const row of rows) await TransportadoraClienteService.create(row);
          await queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
        },
      },
      fornecedores: {
        label: "Fornecedores",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba Fornecedores.",
        expectedColumns: ["NOME", "CNPJ/CPF", "TELEFONE", "EMAIL", "ENDERECO", "STATUS"],
        downloadUrl: modeloImportacaoAtivo?.drive_url,
        templateFileName: "modelo_fornecedores.xlsx",
        validateData: (rows) =>
          buildResult(rows, (row, index) => {
            const nome = getRowValue(row, "NOME");
            if (!nome) return { error: `Linha ${index + 2}: informe o campo NOME.` };
            const ativo = parseBooleanLike(getRowValue(row, "STATUS"), true);
            const payload = {
              nome,
              documento: getRowValue(row, "CNPJ/CPF") || null,
              telefone: getRowValue(row, "TELEFONE") || null,
              email: getRowValue(row, "EMAIL") || null,
              endereco: getRowValue(row, "ENDERECO", "ENDEREÇO") || null,
              empresa_id: empresaId || null,
              ativo,
            };
            return {
              payload,
              preview: { NOME: nome, DOCUMENTO: payload.documento || "â€”", STATUS: ativo ? "Ativo" : "Inativo" },
            };
          }),
        onUpload: async (rows) => {
          for (const row of rows) await FornecedorService.create(row);
          await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        },
      },
      servicos: {
        label: "ServiÃ§os",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba ServiÃ§os.",
        downloadUrl: modeloImportacaoAtivo?.drive_url,
        expectedColumns: ["NOME", "DESCRICAO", "STATUS"],
        templateFileName: "modelo_servicos.xlsx",
        validateData: (rows) =>
          buildResult(rows, (row, index) => {
            const nome = getRowValue(row, "NOME");
            if (!nome) return { error: `Linha ${index + 2}: informe o campo NOME.` };
            const ativo = parseBooleanLike(getRowValue(row, "STATUS"), true);
            const payload = {
              nome,
              descricao: getRowValue(row, "DESCRICAO", "DESCRIÇÃO") || null,
              ativo,
              empresa_id: empresaId || null,
            };
            return {
              payload,
              preview: { NOME: nome, DESCRICAO: payload.descricao || "-", STATUS: ativo ? "Ativo" : "Inativo" },
            };
          }),
        onUpload: async (rows) => {
          for (const row of rows) await TipoServicoOperacionalService.create(row);
          await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional"] });
        },
      },
      parametros: {
        label: "ParÃ¢metros Operacionais",
        description: "Envie uma planilha compatÃ­vel com o modelo da aba ParÃ¢metros Operacionais.",
        unsupportedMessage: "Modelo de importaÃ§Ã£o de parÃ¢metros operacionais ainda nÃ£o configurado.",
      },
    };

    return configs[activeTab];
  }, [activeTab, empresas, empresaId, importacaoModelos, queryClient]);

  const handleContextualImport = async (rows: Record<string, any>[]) => {
    if (!activeImportConfig.onUpload) return;
    await activeImportConfig.onUpload(rows);
    toast.success(`${rows.length} registros importados com sucesso em ${activeImportConfig.label}.`);
  };

  const loading =
    loadingEmpresas ||
    loadingColaboradores ||
    loadingColetores ||
    loadingTransportadoras ||
    loadingFornecedores ||
    loadingTiposServico ||
    loadingOps ||
    loadingProdutos ||
    loadingTiposDia;

  const colaboradoresFaturaveis = useMemo(
    () => colaboradores.filter((colaborador) => colaborador.flag_faturamento).length,
    [colaboradores]
  );

  const coletoresOnline = useMemo(
    () => coletores.filter((coletor) => coletor.status === "online").length,
    [coletores]
  );

  return (
    <AppShell
      title="Central de Cadastros"
      subtitle="Entidades operacionais e parâmetros do motor no mesmo contexto"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Administração Operacional</h2>
              <p className="text-sm text-muted-foreground">
                Organize empresas, equipe, dispositivos e parâmetros sem alternar entre módulos soltos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/cadastros/regras-operacionais")}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Regras operacionais
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar Planilha
              </Button>

              <Button variant="outline" size="sm" onClick={() => navigate("/colaboradores")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Gestão detalhada
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center p-20 esc-card">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              <MetricCard label="Empresas" value={empresas.length.toString()} icon={Building2} />
              <MetricCard label="Colaboradores" value={colaboradores.length.toString()} icon={Users} />
              <MetricCard label="Faturáveis" value={colaboradoresFaturaveis.toString()} icon={Boxes} />
              <MetricCard label="Coletores" value={coletores.length.toString()} icon={Cpu} />
              <MetricCard label="Online" value={coletoresOnline.toString()} icon={Database} />
              <MetricCard label="Transportadoras" value={transportadoras.length.toString()} icon={Truck} />
              <MetricCard label="Fornecedores" value={fornecedores.length.toString()} icon={Store} />
              <MetricCard label="Serviços" value={tiposServico.length.toString()} icon={Wrench} />
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CadastroTabValue)} className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <CadastroTabTrigger value="colaboradores" icon={Users}>Colaboradores</CadastroTabTrigger>
                <CadastroTabTrigger value="empresas" icon={Building2}>Empresas</CadastroTabTrigger>
                <CadastroTabTrigger value="coletores" icon={Cpu}>Coletores</CadastroTabTrigger>
                <CadastroTabTrigger value="transportadoras" icon={Truck}>Transportadoras</CadastroTabTrigger>
                <CadastroTabTrigger value="fornecedores" icon={Store}>Fornecedores</CadastroTabTrigger>
                <CadastroTabTrigger value="servicos" icon={Wrench}>Serviços</CadastroTabTrigger>
                <CadastroTabTrigger value="parametros" icon={Settings2}>Parâmetros operacionais</CadastroTabTrigger>
              </TabsList>

              <TabsContent value="colaboradores" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Equipe operacional</h2>
                      <p className="text-sm text-muted-foreground">
                        Vínculo com empresa, contrato e impacto financeiro lado a lado.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setColaboradorModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Novo colaborador
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/colaboradores")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Nome</th>
                        <th className="px-3 h-11 font-medium text-center">CPF</th>
                        <th className="px-3 h-11 font-medium text-center">Telefone</th>
                        <th className="px-3 h-11 font-medium text-center">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Tipo</th>
                        <th className="px-3 h-11 font-medium text-center">Cargo</th>
                        <th className="px-3 h-11 font-medium text-center">Contrato</th>
                        <th className="px-3 h-11 font-medium text-center">Valor base</th>
                        <th className="px-3 h-11 font-medium text-center">Faturamento</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradores.map((colaborador) => (
                        <tr key={colaborador.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[56px] text-center">
                            <div className="font-medium text-foreground">{colaborador.nome}</div>
                            <div className="text-xs text-muted-foreground">Mat. {colaborador.matricula}</div>
                          </td>
                          <td className="px-3 text-muted-foreground font-mono text-xs text-center">{colaborador.cpf || "—"}</td>
                          <td className="px-3 text-muted-foreground text-center">{colaborador.telefone || "—"}</td>
                          <td className="px-3 text-muted-foreground text-center">{colaborador.empresas?.nome || "—"}</td>
                          <td className="px-3 text-muted-foreground text-center">{colaborador.tipo_colaborador || "—"}</td>
                          <td className="px-3 text-muted-foreground text-center">{colaborador.cargo || "—"}</td>
                          <td className="px-3 text-center">{colaborador.tipo_contrato}</td>
                          <td className="px-3 font-display font-medium text-center">
                            R$ {Number(colaborador.valor_base || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 text-center">{colaborador.flag_faturamento ? "Sim" : "Não"}</td>
                          <td className="px-5 text-center">
                            <StatusChip status={colaborador.status} />
                          </td>
                          <td className="px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingColaborador({ ...colaborador, telefone: formatPhoneForDisplayCC(colaborador.telefone || "") })}>
                                <PencilLine className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Confirmar exclusão?")) deleteColaboradorMutation.mutate(colaborador.id) }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="empresas" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Empresas cadastradas</h2>
                      <p className="text-sm text-muted-foreground">
                        Unidades operacionais e seus vínculos.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEmpresaModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/empresas")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Nome</th>
                        <th className="px-3 h-11 font-medium text-center">CNPJ</th>
                        <th className="px-3 h-11 font-medium text-center">Unidade</th>
                        <th className="px-3 h-11 font-medium text-center">Cidade/UF</th>
                        <th className="px-3 h-11 font-medium text-center">Colaboradores</th>
                        <th className="px-3 h-11 font-medium text-center">Coletores</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresas.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhuma empresa cadastrada
                          </td>
                        </tr>
                      ) : (
                        empresas.map((empresa) => (
                          <tr key={empresa.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[56px] font-medium text-foreground text-center">{empresa.nome}</td>
                            <td className="px-3 text-muted-foreground text-center">{empresa.cnpj || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{empresa.unidade || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{empresa.cidade}/{empresa.estado}</td>
                            <td className="px-3 text-center font-display font-medium">{empresa.total_colaboradores}</td>
                            <td className="px-3 text-center font-display font-medium">{empresa.total_coletores}</td>
                            <td className="px-5 text-center">
                              <Badge className={cn(
                                "font-semibold",
                                empresa.status === "ativa" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                              )}>
                                {empresa.status}
                              </Badge>
                            </td>
                            <td className="px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                  setEditingEmpresa(empresa);
                                  setEmpresaForm({
                                    nome: empresa.nome || '',
                                    cnpj: empresa.cnpj || '',
                                    unidade: empresa.unidade || '',
                                    cidade: empresa.cidade || '',
                                    estado: empresa.estado || '',
                                    banco_codigo: empresa.banco_codigo || '',
                                    agencia: empresa.agencia || '',
                                    agencia_digito: empresa.agencia_digito || '',
                                    conta: empresa.conta || '',
                                    conta_digito: empresa.conta_digito || '',
                                    convenios_bancario: empresa.convenios_bancario || '',
                                    codigo_empresa_banco: empresa.codigo_empresa_banco || '',
                                    nome_empresa_banco: empresa.nome_empresa_banco || '',
                                  });
                                  setEmpresaFormErrors({});
                                  setEmpresaModalOpen(true);
                                }}>
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Confirmar exclusão?")) deleteEmpresaMutation.mutate(empresa.id) }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </section>

              </TabsContent>

              <TabsContent value="coletores" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Coletores REP</h2>
                      <p className="text-sm text-muted-foreground">
                        Estado do dispositivo e vínculo com a unidade operacional.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setColetorModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Novo coletor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/coletores")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Modelo</th>
                        <th className="px-3 h-11 font-medium text-center">Série</th>
                        <th className="px-3 h-11 font-medium text-center">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Última sync</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coletores.map((coletor) => (
                        <tr key={coletor.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[56px] font-medium text-foreground text-center">{coletor.modelo}</td>
                          <td className="px-3 text-muted-foreground text-center">{coletor.serie}</td>
                          <td className="px-3 text-muted-foreground text-center">{coletor.empresas?.nome || "—"}</td>
                          <td className="px-3 text-center text-muted-foreground">
                            {coletor.ultima_sync ? new Date(coletor.ultima_sync).toLocaleString("pt-BR") : "Nunca"}
                          </td>
                          <td className="px-5 text-center">
                            <Badge className={cn(
                              "font-semibold",
                              coletor.status === "online"
                                ? "bg-success-soft text-success-strong"
                                : coletor.status === "erro"
                                  ? "bg-destructive-soft text-destructive-strong"
                                  : "bg-muted text-muted-foreground"
                            )}>
                              {coletor.status}
                            </Badge>
                          </td>
                          <td className="px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/coletores?id=${coletor.id}`)}>
                                <PencilLine className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Confirmar exclusão?")) deleteColetorMutation.mutate(coletor.id) }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="transportadoras" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Transportadoras</h2>
                      <p className="text-sm text-muted-foreground">
                        Empresas de transporte cadastradas para operações logísticas.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setTransportadoraModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Nova transportadora
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/transportadoras")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Nome</th>
                        <th className="px-3 h-11 font-medium text-center">CNPJ/CPF</th>
                        <th className="px-3 h-11 font-medium text-center">Telefone</th>
                        <th className="px-3 h-11 font-medium text-center">Email</th>
                        <th className="px-3 h-11 font-medium text-center">Endereço</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transportadoras.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhuma transportadora cadastrada
                          </td>
                        </tr>
                      ) : (
                        transportadoras.map((transportadora) => (
                          <tr key={transportadora.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[56px] font-medium text-foreground text-center">{transportadora.nome}</td>
                            <td className="px-3 text-muted-foreground text-center">{transportadora.documento || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{transportadora.telefone || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{transportadora.email || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center text-xs">{transportadora.endereco || "—"}</td>
                            <td className="px-5 text-center">
                              <Badge className={cn(
                                "font-semibold",
                                transportadora.ativo ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                              )}>
                                {transportadora.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTransportadora(transportadora)}>
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" onClick={() => toggleTransportadoraAtivoMutation.mutate({ id: transportadora.id, ativo: !transportadora.ativo })} title={transportadora.ativo ? "Desativar" : "Ativar"}>
                                  {transportadora.ativo ? <PowerOff className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => { const result = await TransportadoraClienteService.deleteWithCheck(transportadora.id); if (!result.success) { setItemToDelete(transportadora); setDeleteModalType("transportadora"); setDeleteErrorDetails(result.detalhes || []); setDeleteModalOpen(true); } else if (confirm("Confirmar exclusão definitiva? Esta ação não pode ser desfeita.")) { deleteTransportadoraMutation.mutate(transportadora.id); } }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="fornecedores" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Fornecedores</h2>
                      <p className="text-sm text-muted-foreground">
                        Fornecedores de produtos e serviços para operações.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setFornecedorModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Novo fornecedor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/fornecedores")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Nome</th>
                        <th className="px-3 h-11 font-medium text-center">CNPJ/CPF</th>
                        <th className="px-3 h-11 font-medium text-center">Telefone</th>
                        <th className="px-3 h-11 font-medium text-center">Email</th>
                        <th className="px-3 h-11 font-medium text-center">Endereço</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fornecedores.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhum fornecedor cadastrado
                          </td>
                        </tr>
                      ) : (
                        fornecedores.map((fornecedor) => (
                          <tr key={fornecedor.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[56px] font-medium text-foreground text-center">{fornecedor.nome}</td>
                            <td className="px-3 text-muted-foreground text-center">{fornecedor.documento || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{fornecedor.telefone || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center">{fornecedor.email || "—"}</td>
                            <td className="px-3 text-muted-foreground text-center text-xs">{fornecedor.endereco || "—"}</td>
                            <td className="px-5 text-center">
                              <Badge className={cn(
                                "font-semibold",
                                fornecedor.ativo ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                              )}>
                                {fornecedor.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingFornecedor(fornecedor)}>
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" onClick={() => toggleFornecedorAtivoMutation.mutate({ id: fornecedor.id, ativo: !fornecedor.ativo })} title={fornecedor.ativo ? "Desativar" : "Ativar"}>
                                  {fornecedor.ativo ? <PowerOff className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => { const result = await FornecedorService.deleteWithCheck(fornecedor.id); if (!result.success) { setItemToDelete(fornecedor); setDeleteModalType("fornecedor"); setDeleteErrorDetails(result.detalhes || []); setDeleteModalOpen(true); } else if (confirm("Confirmar exclusão definitiva? Esta ação não pode ser desfeita.")) { deleteFornecedorMutation.mutate(fornecedor.id); } }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="servicos" className="space-y-4 min-h-[400px]">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Tipos de Serviço</h2>
                      <p className="text-sm text-muted-foreground">
                        Categorias de serviços operacionais disponíveis.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setServicoModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Novo tipo de serviço
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/servicos")}>
                        <Settings2 className="h-4 w-4 mr-1.5" /> Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-scroll pr-1">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium text-center">Nome</th>
                        <th className="px-3 h-11 font-medium text-center">Descrição</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                        <th className="px-3 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiposServico.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhum tipo de serviço cadastrado
                          </td>
                        </tr>
                      ) : (
                        tiposServico.map((servico) => (
                          <tr key={servico.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[56px] font-medium text-foreground text-center">{servico.nome}</td>
                            <td className="px-3 text-muted-foreground text-center">{servico.descricao || "—"}</td>
                            <td className="px-5 text-center">
                              <Badge className={cn(
                                "font-semibold",
                                servico.ativo ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                              )}>
                                {servico.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingServico(servico)}>
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" onClick={() => toggleServicoAtivoMutation.mutate({ id: servico.id, ativo: !servico.ativo })} title={servico.ativo ? "Desativar" : "Ativar"}>
                                  {servico.ativo ? <PowerOff className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => { const result = await TipoServicoOperacionalService.deleteWithCheck(servico.id); if (!result.success) { setItemToDelete(servico); setDeleteModalType("servico"); setDeleteErrorDetails(result.detalhes || []); setDeleteModalOpen(true); } else if (confirm("Confirmar exclusão definitiva? Esta ação não pode ser desfeita.")) { deleteServicoMutation.mutate(servico.id); } }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="parametros" className="space-y-6 min-h-[400px] max-h-[75vh] overflow-y-scroll pr-1">
                <section className="esc-card p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Motor operacional</h2>
                      <p className="text-sm text-muted-foreground">
                        Regras mínimas que governam cálculo, conferência e comportamento dos fluxos.
                      </p>
                    </div>
                    <Button
                      variant={isEditingParams ? "default" : "outline"}
                      size="sm"
                      onClick={() => isEditingParams ? saveParamsMutation.mutate(paramsForm) : setIsEditingParams(true)}
                      disabled={saveParamsMutation.isPending}
                    >
                      {saveParamsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : isEditingParams ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Pencil className="h-4 w-4 mr-2" />
                      )}
                      {isEditingParams ? "Salvar alterações" : "Editar parâmetros"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                    <section className="esc-card p-5">
                      <h3 className="font-display font-semibold mb-4 text-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" /> Geral
                      </h3>
                      <div className="space-y-4">
                        <EditableParam
                          label="Moeda padrão"
                          value={paramsForm.moeda_padrao || "BRL (R$)"}
                          editing={isEditingParams}
                          onChange={(value) => setParamsForm({ ...paramsForm, moeda_padrao: value })}
                          options={["BRL (R$)", "USD ($)", "EUR (€)"]}
                        />
                        <EditableParam
                          label="Fuso horário"
                          value={paramsForm.fuso_horario || "GMT-3 (Brasília)"}
                          editing={isEditingParams}
                          onChange={(value) => setParamsForm({ ...paramsForm, fuso_horario: value })}
                          options={["GMT-3 (Brasília)", "GMT-4 (Manaus)", "GMT-0 (Londres)"]}
                        />
                        <EditableParam
                          label="Limite de escopo (dias)"
                          value={String(paramsForm.limite_escopo || 31)}
                          editing={isEditingParams}
                          type="number"
                          onChange={(value) => setParamsForm({ ...paramsForm, limite_escopo: Number(value) })}
                        />
                      </div>
                    </section>
                    <section className="esc-card p-5">
                      <h3 className="font-display font-semibold mb-4 text-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" /> Operacional
                      </h3>
                      <div className="space-y-4">
                        <EditableParam
                          label="Tolerância de ponto (minutos)"
                          value={String(paramsForm.tolerancia_ponto || 10)}
                          editing={isEditingParams}
                          type="number"
                          onChange={(value) => setParamsForm({ ...paramsForm, tolerancia_ponto: Number(value) })}
                        />
                        <EditableParam
                          label="Arredondamento financeiro"
                          value={paramsForm.arredondamento_financeiro || "Duas casas"}
                          editing={isEditingParams}
                          onChange={(value) => setParamsForm({ ...paramsForm, arredondamento_financeiro: value })}
                          options={["Duas casas", "Inteiro (Cêntimos)", "Teto"]}
                        />
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">Notificação de inconsistência</span>
                          {isEditingParams ? (
                            <Switch
                              checked={!!paramsForm.notificacao_inconsistencia}
                              onCheckedChange={(value) =>
                                setParamsForm({ ...paramsForm, notificacao_inconsistencia: value })
                              }
                            />
                          ) : (
                            <span className="text-sm font-semibold text-foreground">
                              {paramsForm.notificacao_inconsistencia ? "Ativado" : "Desativado"}
                            </span>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </section>

                <Tabs defaultValue="operacao" className="space-y-4">
                  <TabsList className="bg-muted p-1 h-9 rounded-lg">
                    <TabsTrigger value="operacao" className="text-xs py-1 px-4">Tipos de operação</TabsTrigger>
                    <TabsTrigger value="produtos" className="text-xs py-1 px-4">Produtos</TabsTrigger>
                    <TabsTrigger value="dia" className="text-xs py-1 px-4">Tipos de dia</TabsTrigger>
                  </TabsList>

                  <TabsContent value="operacao">
                    <ConfigTable<any>
                      title="Tipos de Operação"
                      data={tiposOperacao}
                      columns={[
                        { header: "Nome", accessorKey: "nome" },
                        {
                          header: "Código",
                          accessorKey: "codigo",
                          cell: (item) => <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{item.codigo}</code>,
                        },
                        {
                          header: "Status",
                          accessorKey: "status",
                          cell: (item) => (
                            <Badge variant={item.status === "ativo" ? "success" : "secondary"} className="h-5">
                              {item.status}
                            </Badge>
                          ),
                        },
                      ]}
                      onAdd={() => handleAddConfig("operacao")}
                      onEdit={(item) => handleEditConfig("operacao", item)}
                      onDelete={(item) => {
                        if (confirm("Deseja remover este registro?")) {
                          setConfigType("operacao");
                          deleteConfigMutation.mutate(item.id);
                        }
                      }}
                      onToggleStatus={(item) => toggleOpStatus.mutate(item)}
                    />
                  </TabsContent>

                  <TabsContent value="produtos">
                    <ConfigTable<any>
                      title="Produtos"
                      data={produtos}
                      columns={[
                        { header: "Categoria", accessorKey: "categoria" },
                        {
                          header: "Alíquota ICMS",
                          accessorKey: "icms",
                          cell: (item) => <span className="font-bold text-primary">{item.icms}%</span>,
                        },
                        {
                          header: "Status",
                          accessorKey: "status",
                          cell: (item) => (
                            <Badge variant={item.status === "ativo" ? "success" : "secondary"} className="h-5">
                              {item.status}
                            </Badge>
                          ),
                        },
                      ]}
                      onAdd={() => handleAddConfig("produto")}
                      onEdit={(item) => handleEditConfig("produto", item)}
                      onDelete={(item) => {
                        if (confirm("Deseja remover esta categoria?")) {
                          setConfigType("produto");
                          deleteConfigMutation.mutate(item.id);
                        }
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="dia">
                    <ConfigTable<any>
                      title="Tipos de Dia"
                      data={tiposDia}
                      columns={[
                        { header: "Descrição", accessorKey: "nome" },
                        {
                          header: "Fator",
                          accessorKey: "fator",
                          cell: (item) => <span className="font-mono font-bold">x{item.fator}</span>,
                        },
                        {
                          header: "Status",
                          accessorKey: "status",
                          cell: (item) => (
                            <Badge variant={item.status === "ativo" ? "success" : "secondary"} className="h-5">
                              {item.status}
                            </Badge>
                          ),
                        },
                      ]}
                      onAdd={() => handleAddConfig("dia")}
                      onEdit={(item) => handleEditConfig("dia", item)}
                      onDelete={(item) => {
                        if (confirm("Deseja remover este tipo de dia?")) {
                          setConfigType("dia");
                          deleteConfigMutation.mutate(item.id);
                        }
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar" : "Novo"}{" "}
              {configType === "operacao" ? "Tipo de Operação" : configType === "produto" ? "Produto" : "Tipo de Dia"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {configType === "operacao" && (
              <>
                <div className="space-y-2">
                  <Label>Nome da operação</Label>
                  <Input value={configForm.nome || ""} onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={configForm.codigo || ""} onChange={(e) => setConfigForm({ ...configForm, codigo: e.target.value })} />
                </div>
              </>
            )}

            {configType === "produto" && (
              <>
                <div className="space-y-2">
                  <Label>Categoria do produto</Label>
                  <Input value={configForm.categoria || ""} onChange={(e) => setConfigForm({ ...configForm, categoria: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Alíquota ICMS (%)</Label>
                  <Input type="number" value={configForm.icms || 0} onChange={(e) => setConfigForm({ ...configForm, icms: Number(e.target.value) })} />
                </div>
              </>
            )}

            {configType === "dia" && (
              <>
                <div className="space-y-2">
                  <Label>Descrição do dia</Label>
                  <Input value={configForm.nome || ""} onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fator de cálculo</Label>
                  <Input type="number" step="0.1" value={configForm.fator || 1} onChange={(e) => setConfigForm({ ...configForm, fator: Number(e.target.value) })} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
              {configMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={colaboradorModalOpen} onOpenChange={(open) => { setColaboradorModalOpen(open); if (!open) setColaboradorStep(1); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Novo colaborador</DialogTitle>
            <DialogDescription>
              {colaboradorStep === 1 ? "Dados pessoais e vínculo institucional." : colaboradorStep === 2 ? "Dados contratuais e informações de pagamento." : "Dados bancários para depósito."}
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", colaboradorStep >= 1 ? "bg-primary" : "bg-muted")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", colaboradorStep >= 2 ? "bg-primary" : "bg-muted")} />
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", colaboradorStep >= 3 ? "bg-primary" : "bg-muted")} />
            </div>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
          {colaboradorStep === 1 && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="colab_nome">Nome completo <span className="text-destructive">*</span></Label>
                <Input id="colab_nome" value={colaboradorForm.nome} onChange={(e) => setColaboradorForm({ ...colaboradorForm, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colab_cpf">CPF <span className="text-destructive">*</span></Label>
                <Input id="colab_cpf" value={colaboradorForm.cpf} onChange={(e) => setColaboradorForm({ ...colaboradorForm, cpf: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colab_telefone">Telefone <span className="text-destructive">*</span></Label>
                <Input id="colab_telefone" value={colaboradorForm.telefone} onChange={(e) => handlePhoneChangeCC(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Empresa <span className="text-destructive">*</span></Label>
                <Select value={colaboradorForm.empresa_id} onValueChange={(v) => setColaboradorForm({ ...colaboradorForm, empresa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {colaboradorStep === 2 && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Tipo de colaborador <span className="text-destructive">*</span></Label>
                <Select value={colaboradorForm.tipo_colaborador} onValueChange={(v) => setColaboradorForm({ ...colaboradorForm, tipo_colaborador: v, permitir_lancamento_operacional: v === "DIARISTA" ? true : colaboradorForm.permitir_lancamento_operacional })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIARISTA">DIARISTA</SelectItem>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="INTERMITENTE">INTERMITENTE</SelectItem>
                    <SelectItem value="PRODUÇÃO">PRODUÇÃO</SelectItem>
                    <SelectItem value="TERCEIRIZADO">TERCEIRIZADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status <span className="text-destructive">*</span></Label>
                <Select value={colaboradorForm.status} onValueChange={(v) => setColaboradorForm({ ...colaboradorForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {colaboradorForm.tipo_colaborador === "DIARISTA" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_valor">Valor da diária (R$) <span className="text-destructive">*</span></Label>
                    <Input id="colab_valor" type="number" value={colaboradorForm.valor_base} onChange={(e) => setColaboradorForm({ ...colaboradorForm, valor_base: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_cargo">Função operacional <span className="text-destructive">*</span></Label>
                    <Input id="colab_cargo" value={colaboradorForm.cargo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, cargo: e.target.value })} />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <Label className="cursor-pointer">Permitir lançamento operacional</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Diarista aparecerá na tela de lançamentos.</p>
                    </div>
                    <Switch checked={colaboradorForm.permitir_lancamento_operacional} onCheckedChange={(v) => setColaboradorForm({ ...colaboradorForm, permitir_lancamento_operacional: v })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_cargo">Cargo <span className="text-destructive">*</span></Label>
                    <Input id="colab_cargo" value={colaboradorForm.cargo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, cargo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_matricula">Matrícula <span className="text-destructive">*</span></Label>
                    <Input id="colab_matricula" value={colaboradorForm.matricula} onChange={(e) => setColaboradorForm({ ...colaboradorForm, matricula: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
<Label>Tipo de contrato <span className="text-destructive">*</span></Label>
                    <Select value={colaboradorForm.tipo_contrato} onValueChange={(v: "Hora" | "Operação" | "Mensal") => setColaboradorForm({ ...colaboradorForm, tipo_contrato: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hora">Por hora</SelectItem>
                        <SelectItem value="Operação">Por operação</SelectItem>
                        <SelectItem value="Mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_valor">Valor base (R$) <span className="text-destructive">*</span></Label>
                    <Input id="colab_valor" type="number" value={colaboradorForm.valor_base} onChange={(e) => setColaboradorForm({ ...colaboradorForm, valor_base: e.target.value })} />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <Label className="cursor-pointer">Gera faturamento</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                    </div>
                    <Switch checked={colaboradorForm.flag_faturamento} onCheckedChange={(v) => setColaboradorForm({ ...colaboradorForm, flag_faturamento: v })} />
                  </div>
                </>
              )}
            </div>
          )}

          {colaboradorStep === 3 && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nome_completo">Nome completo (como conta) <span className="text-destructive">*</span></Label>
                  {!colaboradorBankNameLocked && (
                    <button type="button" onClick={() => setColaboradorBankNameLocked(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Bloquear nome
                    </button>
                  )}
                  {colaboradorBankNameLocked && (
                    <button type="button" onClick={() => setColaboradorBankNameLocked(false)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Editar nome da conta
                    </button>
                  )}
                </div>
                <Input
                  id="nome_completo"
                  value={colaboradorBankNameLocked ? colaboradorForm.nome : colaboradorForm.nome_completo}
                  onChange={(e) => setColaboradorForm({ ...colaboradorForm, nome_completo: e.target.value })}
                  disabled={colaboradorBankNameLocked}
                  placeholder="Nome conforme documento bancário"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco_codigo">Cód. Banco <span className="text-destructive">*</span></Label>
                <Input id="banco_codigo" value={colaboradorForm.banco_codigo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, banco_codigo: e.target.value })} placeholder="Ex: 341" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Conta <span className="text-destructive">*</span></Label>
                <Select value={colaboradorForm.tipo_conta} onValueChange={(v) => setColaboradorForm({ ...colaboradorForm, tipo_conta: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agência">Agência <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input id="agencia" value={colaboradorForm.agencia} onChange={(e) => setColaboradorForm({ ...colaboradorForm, agencia: e.target.value })} className="flex-1" />
                  <Input id="agencia_digito" value={colaboradorForm.agencia_digito} onChange={(e) => setColaboradorForm({ ...colaboradorForm, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta">Conta <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input id="conta" value={colaboradorForm.conta} onChange={(e) => setColaboradorForm({ ...colaboradorForm, conta: e.target.value })} className="flex-1" />
                  <Input id="conta_digito" value={colaboradorForm.conta_digito} onChange={(e) => setColaboradorForm({ ...colaboradorForm, conta_digito: e.target.value })} className="w-16" placeholder="Díg." />
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setColaboradorModalOpen(false); setColaboradorStep(1); }}>Cancelar</Button>
            {colaboradorStep === 1 && <Button onClick={() => { if (validateColaboradorStep1()) setColaboradorStep(2); }} disabled={colaboradorIsProcessing}>Próximo</Button>}
            {colaboradorStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setColaboradorStep(1)}>Voltar</Button>
                <Button onClick={() => {
                  if (validateColaboradorStep2()) {
                    setColaboradorStep(3);
                    setColaboradorForm(prev => ({ ...prev, nome_completo: prev.nome_completo || prev.nome }));
                  }
                }} disabled={colaboradorIsProcessing}>Próximo</Button>
              </>
            )}
            {colaboradorStep === 3 && (
              <>
                <Button variant="outline" onClick={() => setColaboradorStep(2)}>Voltar</Button>
                <Button onClick={() => {
                  if (!validateColaboradorStep3()) return;
                  const payload = { ...colaboradorForm, nome_completo: colaboradorForm.nome_completo || colaboradorForm.nome };
                  createColaboradorMutation.mutate(payload);
                }} disabled={colaboradorIsProcessing}>
                  {colaboradorIsProcessing ? "Salvando..." : "Cadastrar"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={empresaModalOpen} onOpenChange={(open) => {
        setEmpresaModalOpen(open);
        if (!open) {
          setEmpresaFormErrors({});
          setEditingEmpresa(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmpresa ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              {editingEmpresa ? "Atualize as informações da unidade operacional." : "Cadastre uma nova unidade operacional no sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp_nome">Nome da Empresa <span className="text-destructive">*</span></Label>
              <Input
                id="emp_nome"
                value={empresaForm.nome}
                onChange={(e) => {
                  setEmpresaForm({ ...empresaForm, nome: e.target.value });
                  if (empresaFormErrors.nome) setEmpresaFormErrors({ ...empresaFormErrors, nome: '' });
                }}
                className={empresaFormErrors.nome ? "border-destructive" : ""}
              />
              {empresaFormErrors.nome && <p className="text-xs text-destructive mt-1">{empresaFormErrors.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp_cnpj">CNPJ <span className="text-destructive">*</span></Label>
              <Input
                id="emp_cnpj"
                value={empresaForm.cnpj}
                onChange={(e) => {
                  const formatted = formatCNPJ(e.target.value);
                  setEmpresaForm({ ...empresaForm, cnpj: formatted });
                  if (empresaFormErrors.cnpj) setEmpresaFormErrors({ ...empresaFormErrors, cnpj: '' });
                }}
                placeholder="00.000.000/0001-00"
                className={empresaFormErrors.cnpj ? "border-destructive" : ""}
              />
              {empresaFormErrors.cnpj && <p className="text-xs text-destructive mt-1">{empresaFormErrors.cnpj}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp_unidade">Unidade (Filial) <span className="text-destructive">*</span></Label>
                <Input
                  id="emp_unidade"
                  value={empresaForm.unidade}
                  onChange={(e) => {
                    setEmpresaForm({ ...empresaForm, unidade: e.target.value });
                    if (empresaFormErrors.unidade) setEmpresaFormErrors({ ...empresaFormErrors, unidade: '' });
                  }}
                  className={empresaFormErrors.unidade ? "border-destructive" : ""}
                />
                {empresaFormErrors.unidade && <p className="text-xs text-destructive mt-1">{empresaFormErrors.unidade}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp_cidade">Cidade <span className="text-destructive">*</span></Label>
                <Input
                  id="emp_cidade"
                  value={empresaForm.cidade}
                  onChange={(e) => {
                    setEmpresaForm({ ...empresaForm, cidade: e.target.value });
                    if (empresaFormErrors.cidade) setEmpresaFormErrors({ ...empresaFormErrors, cidade: '' });
                  }}
                  className={empresaFormErrors.cidade ? "border-destructive" : ""}
                />
                {empresaFormErrors.cidade && <p className="text-xs text-destructive mt-1">{empresaFormErrors.cidade}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp_estado">Estado (UF) <span className="text-destructive">*</span></Label>
              <Input
                id="emp_estado"
                value={empresaForm.estado}
                onChange={(e) => {
                  setEmpresaForm({ ...empresaForm, estado: e.target.value.toUpperCase().slice(0, 2) });
                  if (empresaFormErrors.estado) setEmpresaFormErrors({ ...empresaFormErrors, estado: '' });
                }}
                maxLength={2}
                className={empresaFormErrors.estado ? "border-destructive" : ""}
              />
              {empresaFormErrors.estado && <p className="text-xs text-destructive mt-1">{empresaFormErrors.estado}</p>}
            </div>
            <div className="col-span-full border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-3">Dados Bancários</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emp_banco">Cód. Banco</Label>
                  <Input id="emp_banco" value={empresaForm.banco_codigo} onChange={(e) => setEmpresaForm({ ...empresaForm, banco_codigo: e.target.value })} placeholder="Ex: 341" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp_agencia">Agência</Label>
                  <div className="flex gap-2">
                    <Input id="emp_agencia" value={empresaForm.agencia} onChange={(e) => setEmpresaForm({ ...empresaForm, agencia: e.target.value })} className="flex-1" />
                    <Input id="emp_agencia_digito" value={empresaForm.agencia_digito} onChange={(e) => setEmpresaForm({ ...empresaForm, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp_conta">Conta</Label>
                  <div className="flex gap-2">
                    <Input id="emp_conta" value={empresaForm.conta} onChange={(e) => setEmpresaForm({ ...empresaForm, conta: e.target.value })} className="flex-1" />
                    <Input id="emp_conta_digito" value={empresaForm.conta_digito} onChange={(e) => setEmpresaForm({ ...empresaForm, conta_digito: e.target.value })} className="w-16" placeholder="Díg." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp_convenio">Convênio</Label>
                  <Input id="emp_convenio" value={empresaForm.convenios_bancario} onChange={(e) => setEmpresaForm({ ...empresaForm, convenios_bancario: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmpresaModalOpen(false); setEmpresaFormErrors({}); setEditingEmpresa(null); }}>Cancelar</Button>
            <Button onClick={() => {
              const errors: Record<string, string> = {};

              if (!empresaForm.nome?.trim()) errors.nome = "Nome da empresa é obrigatório.";
              if (!empresaForm.cnpj?.trim()) errors.cnpj = "CNPJ é obrigatório.";
              if (!empresaForm.unidade?.trim()) errors.unidade = "Unidade é obrigatória.";
              if (!empresaForm.cidade?.trim()) errors.cidade = "Cidade é obrigatória.";
              if (!empresaForm.estado?.trim()) errors.estado = "Estado é obrigatório.";

              const cnpjValidation = validateCNPJ(empresaForm.cnpj);
              if (!cnpjValidation.valid && empresaForm.cnpj.trim()) {
                errors.cnpj = cnpjValidation.reason!;
              }

              if (Object.keys(errors).length > 0) {
                setEmpresaFormErrors(errors);
                toast.error("Preencha todos os campos obrigatórios.");
                return;
              }

              setEmpresaFormErrors({});
              const sanitized = sanitizeEmpresaPayload(empresaForm);
              if (editingEmpresa) {
                updateEmpresaMutation.mutate({ id: editingEmpresa.id, payload: sanitized });
              } else {
                createEmpresaMutation.mutate(sanitized);
              }
            }} disabled={createEmpresaMutation.isPending || updateEmpresaMutation.isPending}>
              {(createEmpresaMutation.isPending || updateEmpresaMutation.isPending) ? "Salvando..." : editingEmpresa ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coletorModalOpen} onOpenChange={setColetorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Coletor</DialogTitle>
            <DialogDescription>
              Cadastre um novo dispositivo de ponto eletrônico REP.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="col_modelo">Modelo</Label>
              <Input id="col_modelo" value={coletorForm.modelo} onChange={(e) => setColetorForm({ ...coletorForm, modelo: e.target.value })} placeholder="Ex: Rep-1000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="col_serie">Número de Série</Label>
              <Input id="col_serie" value={coletorForm.serie} onChange={(e) => setColetorForm({ ...coletorForm, serie: e.target.value })} placeholder="Ex: REP001234" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={coletorForm.empresa_id} onValueChange={(v) => setColetorForm({ ...coletorForm, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColetorModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createColetorMutation.mutate(coletorForm)} disabled={createColetorMutation.isPending}>
              {createColetorMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transportadoraModalOpen} onOpenChange={setTransportadoraModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Transportadora</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa de transporte para operações logísticas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="trans_nome">Nome</Label>
              <Input id="trans_nome" value={transportadoraForm.nome} onChange={(e) => setTransportadoraForm({ ...transportadoraForm, nome: e.target.value })} placeholder="Ex: Transportadora XYZ" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trans_documento">CNPJ/CPF</Label>
              <Input id="trans_documento" value={transportadoraForm.documento} onChange={(e) => setTransportadoraForm({ ...transportadoraForm, documento: e.target.value })} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trans_telefone">Telefone</Label>
              <Input id="trans_telefone" value={transportadoraForm.telefone} onChange={(e) => setTransportadoraForm({ ...transportadoraForm, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trans_email">Email</Label>
              <Input id="trans_email" type="email" value={transportadoraForm.email} onChange={(e) => setTransportadoraForm({ ...transportadoraForm, email: e.target.value })} placeholder="contato@transportadora.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trans_endereco">Endereço</Label>
              <Input id="trans_endereco" value={transportadoraForm.endereco} onChange={(e) => setTransportadoraForm({ ...transportadoraForm, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransportadoraModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createTransportadoraMutation.mutate({ ...transportadoraForm, ativo: true, empresa_id: transportadoraForm.empresa_id || null })} disabled={createTransportadoraMutation.isPending}>
              {createTransportadoraMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fornecedorModalOpen} onOpenChange={setFornecedorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>
              Cadastre um novo fornecedor de produtos ou serviços.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="forn_nome">Nome</Label>
              <Input id="forn_nome" value={fornecedorForm.nome} onChange={(e) => setFornecedorForm({ ...fornecedorForm, nome: e.target.value })} placeholder="Ex: Fornecedor ABC" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn_documento">CNPJ/CPF</Label>
              <Input id="forn_documento" value={fornecedorForm.documento} onChange={(e) => setFornecedorForm({ ...fornecedorForm, documento: e.target.value })} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn_telefone">Telefone</Label>
              <Input id="forn_telefone" value={fornecedorForm.telefone} onChange={(e) => setFornecedorForm({ ...fornecedorForm, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn_email">Email</Label>
              <Input id="forn_email" type="email" value={fornecedorForm.email} onChange={(e) => setFornecedorForm({ ...fornecedorForm, email: e.target.value })} placeholder="contato@fornecedor.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn_endereco">Endereço</Label>
              <Input id="forn_endereco" value={fornecedorForm.endereco} onChange={(e) => setFornecedorForm({ ...fornecedorForm, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFornecedorModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFornecedorMutation.mutate({ ...fornecedorForm, ativo: true, empresa_id: fornecedorForm.empresa_id || null })} disabled={createFornecedorMutation.isPending}>
              {createFornecedorMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={servicoModalOpen} onOpenChange={setServicoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Tipo de Serviço</DialogTitle>
            <DialogDescription>
              Cadastre uma nova categoria de serviço operacional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="serv_nome">Nome</Label>
              <Input id="serv_nome" value={servicoForm.nome} onChange={(e) => setServicoForm({ ...servicoForm, nome: e.target.value })} placeholder="Ex: Coleta, Entrega, Armazenagem" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serv_descricao">Descrição</Label>
              <Input id="serv_descricao" value={servicoForm.descricao} onChange={(e) => setServicoForm({ ...servicoForm, descricao: e.target.value })} placeholder="Descrição do tipo de serviço" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicoModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createServicoMutation.mutate({ ...servicoForm, empresa_id: servicoForm.empresa_id || null })} disabled={createServicoMutation.isPending}>
              {createServicoMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFornecedor} onOpenChange={(open) => !open && setEditingFornecedor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
            <DialogDescription>
              Atualize os dados do fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit_forn_nome">Nome</Label>
              <Input id="edit_forn_nome" value={editingFornecedor?.nome || ""} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_forn_documento">CNPJ/CPF</Label>
              <Input id="edit_forn_documento" value={editingFornecedor?.documento || ""} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, documento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_forn_telefone">Telefone</Label>
              <Input id="edit_forn_telefone" value={editingFornecedor?.telefone || ""} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_forn_email">Email</Label>
              <Input id="edit_forn_email" type="email" value={editingFornecedor?.email || ""} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_forn_endereco">Endereço</Label>
              <Input id="edit_forn_endereco" value={editingFornecedor?.endereco || ""} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, endereco: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit_forn_ativo" checked={editingFornecedor?.ativo ?? true} onChange={(e) => setEditingFornecedor({ ...editingFornecedor, ativo: e.target.checked })} />
              <Label htmlFor="edit_forn_ativo" className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFornecedor(null)}>Cancelar</Button>
            <Button onClick={() => updateFornecedorMutation.mutate({ id: editingFornecedor.id, payload: editingFornecedor })} disabled={updateFornecedorMutation.isPending}>
              {updateFornecedorMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTransportadora} onOpenChange={(open) => !open && setEditingTransportadora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transportadora</DialogTitle>
            <DialogDescription>
              Atualize os dados da transportadora.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit_trans_nome">Nome</Label>
              <Input id="edit_trans_nome" value={editingTransportadora?.nome || ""} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_trans_documento">CNPJ/CPF</Label>
              <Input id="edit_trans_documento" value={editingTransportadora?.documento || ""} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, documento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_trans_telefone">Telefone</Label>
              <Input id="edit_trans_telefone" value={editingTransportadora?.telefone || ""} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_trans_email">Email</Label>
              <Input id="edit_trans_email" type="email" value={editingTransportadora?.email || ""} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_trans_endereco">Endereço</Label>
              <Input id="edit_trans_endereco" value={editingTransportadora?.endereco || ""} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, endereco: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit_trans_ativo" checked={editingTransportadora?.ativo ?? true} onChange={(e) => setEditingTransportadora({ ...editingTransportadora, ativo: e.target.checked })} />
              <Label htmlFor="edit_trans_ativo" className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTransportadora(null)}>Cancelar</Button>
            <Button onClick={() => updateTransportadoraMutation.mutate({ id: editingTransportadora.id, payload: editingTransportadora })} disabled={updateTransportadoraMutation.isPending}>
              {updateTransportadoraMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingColaborador} onOpenChange={(open) => !open && setEditingColaborador(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>
              Atualize os dados do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit_colab_nome">Nome completo</Label>
                <Input id="edit_colab_nome" value={editingColaborador?.nome || ""} onChange={(e) => setEditingColaborador({ ...editingColaborador, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_colab_cpf">CPF</Label>
                <Input id="edit_colab_cpf" value={editingColaborador?.cpf || ""} onChange={(e) => setEditingColaborador({ ...editingColaborador, cpf: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_colab_telefone">Telefone</Label>
                <Input id="edit_colab_telefone" value={editingColaborador?.telefone || ""} onChange={(e) => handleEditPhoneChangeCC(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Empresa</Label>
                <Select value={editingColaborador?.empresa_id || ""} onValueChange={(v) => setEditingColaborador({ ...editingColaborador, empresa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cidade}/{e.estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de colaborador</Label>
                <Select value={editingColaborador?.tipo_colaborador || "CLT"} onValueChange={(v) => setEditingColaborador({ ...editingColaborador, tipo_colaborador: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIARISTA">DIARISTA</SelectItem>
                    <SelectItem value="CLT">CLT</SelectItem>
                    <SelectItem value="INTERMITENTE">INTERMITENTE</SelectItem>
                    <SelectItem value="PRODUÇÃO">PRODUÇÃO</SelectItem>
                    <SelectItem value="TERCEIRIZADO">TERCEIRIZADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editingColaborador?.status || "ativo"} onValueChange={(v) => setEditingColaborador({ ...editingColaborador, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_colab_cargo">Cargo</Label>
                <Input id="edit_colab_cargo" value={editingColaborador?.cargo || ""} onChange={(e) => setEditingColaborador({ ...editingColaborador, cargo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_colab_matricula">Matrícula</Label>
                <Input id="edit_colab_matricula" value={editingColaborador?.matricula || ""} onChange={(e) => setEditingColaborador({ ...editingColaborador, matricula: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_colab_valor">Valor base (R$)</Label>
                <Input id="edit_colab_valor" type="number" value={editingColaborador?.valor_base || ""} onChange={(e) => setEditingColaborador({ ...editingColaborador, valor_base: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de contrato</Label>
                <Select value={editingColaborador?.tipo_contrato || "Hora"} onValueChange={(v) => setEditingColaborador({ ...editingColaborador, tipo_contrato: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hora">Por hora</SelectItem>
                    <SelectItem value="Operação">Por operação</SelectItem>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label className="cursor-pointer">Gera faturamento</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Colaborador entra no cálculo financeiro.</p>
                </div>
                <Switch checked={editingColaborador?.flag_faturamento ?? true} onCheckedChange={(v) => setEditingColaborador({ ...editingColaborador, flag_faturamento: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingColaborador(null)}>Cancelar</Button>
            <Button onClick={() => {
              const { empresas, ...colaboradorPayload } = editingColaborador || {};
              updateColaboradorMutation.mutate({
                id: editingColaborador.id,
                payload: {
                  ...colaboradorPayload,
                  valor_base: Number(editingColaborador.valor_base) || 0,
                },
              });
            }} disabled={updateColaboradorMutation.isPending || editingColaboradorIsProcessing}>
              {(updateColaboradorMutation.isPending || editingColaboradorIsProcessing) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmpresa} onOpenChange={(open) => !open && setEditingEmpresa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Atualize os dados da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit_emp_nome">Nome da Empresa</Label>
              <Input id="edit_emp_nome" value={editingEmpresa?.nome || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_emp_cnpj">CNPJ</Label>
              <Input id="edit_emp_cnpj" value={editingEmpresa?.cnpj || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, cnpj: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_unidade">Unidade (Filial)</Label>
                <Input id="edit_emp_unidade" value={editingEmpresa?.unidade || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, unidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_cidade">Cidade</Label>
                <Input id="edit_emp_cidade" value={editingEmpresa?.cidade || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, cidade: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_emp_estado">Estado (UF)</Label>
              <Input id="edit_emp_estado" value={editingEmpresa?.estado || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, estado: e.target.value })} maxLength={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_banco">Código Banco</Label>
                <Input id="edit_emp_banco" value={editingEmpresa?.banco_codigo || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, banco_codigo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_agencia">Agência</Label>
                <Input id="edit_emp_agencia" value={editingEmpresa?.agencia || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, agencia: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_agencia_digito">Dígito Agência</Label>
                <Input id="edit_emp_agencia_digito" value={editingEmpresa?.agencia_digito || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, agencia_digito: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_conta">Conta</Label>
                <Input id="edit_emp_conta" value={editingEmpresa?.conta || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, conta: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_conta_digito">Dígito Conta</Label>
                <Input id="edit_emp_conta_digito" value={editingEmpresa?.conta_digito || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, conta_digito: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_emp_convenio">Convênio</Label>
                <Input id="edit_emp_convenio" value={editingEmpresa?.convenios_bancario || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, convenios_bancario: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit_emp_ativa" checked={editingEmpresa?.status === "ativa"} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, status: e.target.checked ? "ativa" : "inativa" })} />
              <Label htmlFor="edit_emp_ativa" className="cursor-pointer">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmpresa(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!editingEmpresa?.nome?.trim()) {
                toast.error("Informe o nome da empresa");
                return;
              }
              if (!editingEmpresa?.cnpj?.trim()) {
                toast.error("Informe o CNPJ");
                return;
              }
              if (!editingEmpresa?.unidade?.trim()) {
                toast.error("Informe a unidade");
                return;
              }
              if (!editingEmpresa?.cidade?.trim()) {
                toast.error("Informe a cidade");
                return;
              }
              if (!editingEmpresa?.estado?.trim()) {
                toast.error("Informe o estado");
                return;
              }
              const payload = {
                nome: editingEmpresa.nome,
                cnpj: editingEmpresa.cnpj,
                unidade: editingEmpresa.unidade,
                cidade: editingEmpresa.cidade,
                estado: editingEmpresa.estado,
                status: editingEmpresa.status,
                banco_codigo: editingEmpresa.banco_codigo,
                agencia: editingEmpresa.agencia,
                agencia_digito: editingEmpresa.agencia_digito,
                conta: editingEmpresa.conta,
                conta_digito: editingEmpresa.conta_digito,
                convenios_bancario: editingEmpresa.convenios_bancario,
              };
              updateEmpresaMutation.mutate({ id: editingEmpresa.id, payload });
            }} disabled={updateEmpresaMutation.isPending}>
              {updateEmpresaMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingServico} onOpenChange={(open) => !open && setEditingServico(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tipo de Serviço</DialogTitle>
            <DialogDescription>
              Atualize os dados do tipo de serviço.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit_serv_nome">Nome</Label>
              <Input id="edit_serv_nome" value={editingServico?.nome || ""} onChange={(e) => setEditingServico({ ...editingServico, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_serv_descricao">Descrição</Label>
              <Input id="edit_serv_descricao" value={editingServico?.descricao || ""} onChange={(e) => setEditingServico({ ...editingServico, descricao: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit_serv_ativo" checked={editingServico?.ativo ?? true} onChange={(e) => setEditingServico({ ...editingServico, ativo: e.target.checked })} />
              <Label htmlFor="edit_serv_ativo" className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingServico(null)}>Cancelar</Button>
            <Button onClick={() => updateServicoMutation.mutate({ id: editingServico.id, payload: editingServico })} disabled={updateServicoMutation.isPending}>
              {updateServicoMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Exclusão não permitida</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>{itemToDelete?.nome}</strong> possui vínculos operacionais e não pode ser excluído(a).
            </p>
            {deleteErrorDetails.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md max-h-[200px] overflow-y-auto">
                <p className="text-xs font-medium text-amber-800 mb-2">Vínculos encontrados:</p>
                <div className="space-y-2">
                  {deleteErrorDetails.map((detalhe, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium text-amber-900">{detalhe.tabela}:</span>{' '}
                      <span className="text-amber-700">{detalhe.count} registro(s)</span>
                      {detalhe.ids && detalhe.ids.length > 0 && (
                        <div className="text-amber-600 mt-0.5 pl-2 text-[10px]">
                          IDs: {detalhe.ids.join(', ')}
                          {detalhe.count > 3 && ` (+${detalhe.count - 3} mais)`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Deseja desativá-lo(a)? O registro permanecerá no histórico com status Inativo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setItemToDelete(null); setDeleteErrorDetails([]); }}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (deleteModalType === "transportadora" && itemToDelete) {
                toggleTransportadoraAtivoMutation.mutate({ id: itemToDelete.id, ativo: false });
              } else if (deleteModalType === "fornecedor" && itemToDelete) {
                toggleFornecedorAtivoMutation.mutate({ id: itemToDelete.id, ativo: false });
              } else if (deleteModalType === "servico" && itemToDelete) {
                toggleServicoAtivoMutation.mutate({ id: itemToDelete.id, ativo: false });
              }
              setDeleteModalOpen(false);
              setItemToDelete(null);
              setDeleteErrorDetails([]);
            }}>
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title={`Importar planilha - ${activeImportConfig.label}`}
        description={activeImportConfig.description}
        onDownloadTemplate={
          activeImportConfig.downloadUrl
            ? () => window.open(activeImportConfig.downloadUrl, "_blank", "noopener,noreferrer")
            : undefined
        }
        expectedColumns={activeImportConfig.expectedColumns}
        templateColumns={activeImportConfig.expectedColumns}
        templateFileName={activeImportConfig.templateFileName}
        unsupportedMessage={activeImportConfig.unsupportedMessage}
        requireValidation
        validateData={activeImportConfig.validateData}
        onUpload={handleContextualImport}
      />
    </AppShell>
  );
};

const EditableParam = ({
  label,
  value,
  editing,
  onChange,
  options,
  type = "text",
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  options?: string[];
  type?: string;
}) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 min-h-[48px]">
    <span className="text-xs text-muted-foreground">{label}</span>
    {editing ? (
      options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-40 text-xs text-right" />
      )
    ) : (
      <span className="text-sm font-semibold text-foreground">{value}</span>
    )}
  </div>
);

export default CentralCadastros;
