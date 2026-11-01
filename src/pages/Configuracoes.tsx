import { AppShell } from "@/components/layout/AppShell";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import {
  Moon,
  Sun,
  Clock,
  Boxes,
  Settings2,
  Database,
  Globe,
  User,
  Shield,
  Loader2,
  Camera,
  Check,
  X,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigTable } from "@/components/ui/ConfigTable";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigTipoOperacaoService,
  ColaboradorService,
  ConfigProdutoService,
  ConfigTipoDiaService,
  ConfiguracaoOperacionalService,
  EmpresaService,
  type EncarregadoColaboradorFiltroConfig,
  getConfigTipoOperacaoErrorMessage,
  ImportacaoModelosService,
  StorageService
} from "@/services/base.service";
import ResetOperacional from "@/pages/Configuracoes/ResetOperacional";
import JornadasTrabalhoSection from "@/pages/Configuracoes/JornadasTrabalhoSection";
import RegrasBancoHorasSection from "@/pages/Configuracoes/RegrasBancoHorasSection";

const IMPORTACAO_MODULOS = [
  { value: "colaboradores", label: "Colaboradores" },
  { value: "empresas", label: "Empresas" },
  { value: "coletores", label: "Coletores" },
  { value: "transportadoras", label: "Transportadoras" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "servicos", label: "Serviços" },
  { value: "parametros", label: "Parâmetros Operacionais" },
  { value: "regras_operacionais", label: "Regras Operacionais" },
  { value: "pontos_recebidos", label: "Pontos Recebidos" },
];

const COLABORADOR_FILTER_CATALOG = {
  tipo_contrato: ["Hora", "Operação", "Mensal"],
  tipo_colaborador: ["CLT", "DIARISTA", "INTERMITENTE", "PRODUÇÃO", "TERCEIRIZADO"],
} as const;

const ENCARREGADO_FILTER_TARGETS = [
  {
    id: "grupo_volume",
    title: "Operações por volume",
    description: "Aplica às 3 primeiras telas: Recebimento Imediato, Pagamento a Prazo e Faturamento Mensal.",
    presets: ["preset_caixa", "preset_boleto", "preset_dismelo"],
  },
  {
    id: "preset_custos_mensais",
    title: "Custos/Despesas",
    description: "Define o filtro de colaboradores deste fluxo.",
    presets: ["preset_custos_mensais"],
  },
  {
    id: "preset_transbordo",
    title: "Serviços Extras",
    description: "Define o filtro de colaboradores deste fluxo quando houver equipe.",
    presets: ["preset_transbordo"],
  },
  {
    id: "preset_diaristas",
    title: "Diaristas",
    description: "Fluxo fixo de diaristas.",
    presets: ["preset_diaristas"],
    fixed: true,
  },
] as const;

const DEFAULT_ENCARREGADO_PRESET_FILTERS: Record<string, EncarregadoColaboradorFiltroConfig> = {
  grupo_volume: {
    ativo: true,
    sem_equipe: false,
    campo_filtro: "tipo_contrato",
    valores_filtro: ["Operação"],
    filtrar_por_empresa: true,
    somente_ativos: true,
    somente_cadastro_completo: true,
    excluir_cadastro_provisorio: true,
  },
  preset_diaristas: {
    ativo: true,
    sem_equipe: false,
    campo_filtro: "tipo_colaborador",
    valores_filtro: ["DIARISTA"],
    filtrar_por_empresa: true,
    somente_ativos: true,
    exigir_permitir_lancamento_operacional: true,
  },
  preset_custos_mensais: {
    ativo: true,
    sem_equipe: false,
    filtrar_por_empresa: true,
    somente_ativos: true,
  },
  preset_transbordo: {
    ativo: true,
    sem_equipe: true,
    filtrar_por_empresa: true,
    somente_ativos: true,
  },
};

const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["\u00C3\u00A7", "ç"],
  ["\u00C3\u00A3", "ã"],
  ["\u00C3\u00B5", "õ"],
  ["\u00C3\u00A1", "á"],
  ["\u00C3\u00E0", "à"],
  ["\u00C3\u00A2", "â"],
  ["\u00C3\u00AA", "ê"],
  ["\u00C3\u00A9", "é"],
  ["\u00C3\u00AD", "í"],
  ["\u00C3\u00B3", "ó"],
  ["\u00C3\u00B4", "ô"],
  ["\u00C3\u00BA", "ú"],
  ["\u00C3\u00BC", "ü"],
  ["\u00C3\u2021", "Ç"],
  ["\u00C3", "à"],
  ["\u00C2", ""],
  ["\u00E2\u201A\u00AC", "€"],
];

const fixMojibakeText = (value: unknown) => {
  let text = String(value ?? "").trim();
  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(bad).join(good);
  }
  return text;
};

const normalizeFilterList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => fixMojibakeText(item)).filter(Boolean)));
  }

  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((item) => fixMojibakeText(item)).filter(Boolean)));
  }

  return [];
};

const normalizePresetFilterConfig = (
  raw?: EncarregadoColaboradorFiltroConfig | null,
  presetId?: string,
): EncarregadoColaboradorFiltroConfig => {
  const fallback = presetId ? DEFAULT_ENCARREGADO_PRESET_FILTERS[presetId] : undefined;

  return {
    ativo: raw?.ativo ?? fallback?.ativo ?? true,
    sem_equipe: raw?.sem_equipe ?? fallback?.sem_equipe ?? false,
    campo_filtro: raw?.campo_filtro ?? fallback?.campo_filtro ?? "tipo_contrato",
    valores_filtro: normalizeFilterList(raw?.valores_filtro ?? fallback?.valores_filtro),
    filtrar_por_empresa: raw?.filtrar_por_empresa ?? fallback?.filtrar_por_empresa ?? true,
    somente_ativos: raw?.somente_ativos ?? fallback?.somente_ativos ?? true,
    somente_cadastro_completo: raw?.somente_cadastro_completo ?? fallback?.somente_cadastro_completo ?? false,
    excluir_cadastro_provisorio: raw?.excluir_cadastro_provisorio ?? fallback?.excluir_cadastro_provisorio ?? false,
    tipos_colaborador_permitidos: normalizeFilterList(raw?.tipos_colaborador_permitidos ?? fallback?.tipos_colaborador_permitidos),
    regimes_trabalho_permitidos: normalizeFilterList(raw?.regimes_trabalho_permitidos ?? fallback?.regimes_trabalho_permitidos),
    modelos_calculo_permitidos: normalizeFilterList(raw?.modelos_calculo_permitidos ?? fallback?.modelos_calculo_permitidos),
    tipos_contrato_permitidos: normalizeFilterList(raw?.tipos_contrato_permitidos ?? fallback?.tipos_contrato_permitidos),
    exigir_permitir_lancamento_operacional: raw?.exigir_permitir_lancamento_operacional ?? fallback?.exigir_permitir_lancamento_operacional ?? false,
  };
};

const buildPresetFilterMap = (raw: unknown): Record<string, EncarregadoColaboradorFiltroConfig> => {
  const source = raw && typeof raw === "object" ? raw as Record<string, EncarregadoColaboradorFiltroConfig> : {};

  return ENCARREGADO_FILTER_TARGETS.reduce((acc, preset) => {
    acc[preset.id] = normalizePresetFilterConfig(source[preset.id], preset.id);
    return acc;
  }, {} as Record<string, EncarregadoColaboradorFiltroConfig>);
};

const formatFilterList = (value?: string[]) => (
  value && value.length > 0 ? value.map((item) => fixMojibakeText(item)).join(", ") : "Livre"
);

const resolveFilterConfigKey = (presetId: string) =>
  ENCARREGADO_FILTER_TARGETS.find((target) => target.presets.includes(presetId as never))?.id ?? presetId;

function normalizeOperationTypeValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryTab = searchParams.get("tab");
  const queryClient = useQueryClient();
  const { theme, setTheme, defaultTab, setDefaultTab } = usePreferences();
  const { user, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState(queryTab || "preferencias");
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.user_metadata?.full_name || "");
  const [isUploading, setIsUploading] = useState(false);

  // Sync activeTab with queryTab when URL changes
  useEffect(() => {
    if (queryTab === "minimas") {
      setActiveTab("config_operacional");
      return;
    }
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const [importTemplateModalOpen, setImportTemplateModalOpen] = useState(false);
  const [editingImportTemplate, setEditingImportTemplate] = useState<any>(null);
  const [importTemplateForm, setImportTemplateForm] = useState({
    modulo: "colaboradores",
    nome_arquivo: "",
    drive_url: "",
    ativo: true,
  });

  const [isEditingParams, setIsEditingParams] = useState(false);
  const [paramsForm, setParamsForm] = useState<any>({});

  const { data: perfil } = useQuery({
    queryKey: ["profile_configuracoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_configuracoes"],
    queryFn: () => EmpresaService.getAll(),
    enabled: !!user?.id,
  });

  const empresaId = useMemo(() => {
    const empresasArr = empresas as any[];
    return perfil?.empresa_id || user?.user_metadata?.empresa_id || empresasArr[0]?.id || "";
  }, [empresas, perfil?.empresa_id, user?.user_metadata?.empresa_id]);

  const { data: opSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['config_operacional', empresaId],
    queryFn: () => ConfiguracaoOperacionalService.getByEmpresa(empresaId!),
    enabled: !!empresaId
  });

  useEffect(() => {
    setParamsForm({
      ...(opSettings ?? {}),
      filtros_colaboradores_encarregado: buildPresetFilterMap(opSettings?.filtros_colaboradores_encarregado),
    });
  }, [opSettings]);

  const saveParamsMutation = useMutation({
    mutationFn: (payload: any) => ConfiguracaoOperacionalService.upsert({
      ...payload,
      empresa_id: empresaId,
      filtros_colaboradores_encarregado: buildPresetFilterMap(payload?.filtros_colaboradores_encarregado),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_operacional'] });
      setIsEditingParams(false);
      toast.success("Parâmetros salvos com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar parâmetros", { description: err.message })
  });

  const presetFilters = buildPresetFilterMap(paramsForm?.filtros_colaboradores_encarregado);

  const getAvailableOptionsForField = (field?: "tipo_colaborador" | "tipo_contrato") => {
    if (field === "tipo_colaborador") return [...COLABORADOR_FILTER_CATALOG.tipo_colaborador].map(fixMojibakeText);
    return [...COLABORADOR_FILTER_CATALOG.tipo_contrato].map(fixMojibakeText);
  };

  const updatePresetFilter = (presetId: string, patch: Partial<EncarregadoColaboradorFiltroConfig>) => {
    setParamsForm((prev: any) => ({
      ...prev,
      filtros_colaboradores_encarregado: {
        ...buildPresetFilterMap(prev?.filtros_colaboradores_encarregado),
        [presetId]: {
          ...normalizePresetFilterConfig(buildPresetFilterMap(prev?.filtros_colaboradores_encarregado)[presetId], presetId),
          ...patch,
        },
      },
    }));
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    try {
      await updateProfile({ full_name: newName });
      setIsEditingName(false);
      toast.success("Nome atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao atualizar nome", { description: error.message });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      await StorageService.uploadFile('avatars', filePath, file);
      const publicUrl = await StorageService.getPublicUrl('avatars', filePath);

      await updateProfile({ avatar_url: publicUrl });
      toast.success("Foto de perfil atualizada");
    } catch (error: any) {
      toast.error("Erro no upload", { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  // Real data fetching
  const { data: importacaoModelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['importacao_modelos'],
    queryFn: () => ImportacaoModelosService.listAll()
  });

  const importTemplateMutation = useMutation({
    mutationFn: (payload: typeof importTemplateForm) => ImportacaoModelosService.upsert(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importacao_modelos'] });
      setImportTemplateModalOpen(false);
      setEditingImportTemplate(null);
      setImportTemplateForm({
        modulo: "colaboradores",
        nome_arquivo: "",
        drive_url: "",
        ativo: true,
      });
      toast.success("Modelo de importação salvo com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar modelo", { description: err.message })
  });

  const deleteImportTemplateMutation = useMutation({
    mutationFn: (id: string) => ImportacaoModelosService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importacao_modelos'] });
      toast.success("Modelo de importação removido");
    },
    onError: (err: any) => toast.error("Erro ao remover modelo", { description: err.message })
  });

  const handleAddImportTemplate = () => {
    setEditingImportTemplate(null);
    setImportTemplateForm({
      modulo: "colaboradores",
      nome_arquivo: "",
      drive_url: "",
      ativo: true,
    });
    setImportTemplateModalOpen(true);
  };

  const handleEditImportTemplate = (item: any) => {
    setEditingImportTemplate(item);
    setImportTemplateForm({
      modulo: item.modulo,
      nome_arquivo: item.nome_arquivo || "",
      drive_url: item.drive_url || "",
      ativo: item.ativo ?? true,
    });
    setImportTemplateModalOpen(true);
  };

  if (loadingSettings) {
    return (
      <AppShell title="Preferências" subtitle="Carregando configurações...">
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Preferências"
      subtitle="Personalize sua experiência de uso, tema visual e dados do perfil corporativo"
    >
      <div className="space-y-4 pb-12 w-full max-w-[1560px] mx-auto pt-1 animate-in fade-in-50 duration-200">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="border-b border-border/80 pb-2">
            <TabsList className="bg-muted/40 border border-border/80 p-1 text-muted-foreground w-full flex flex-nowrap overflow-x-auto h-auto justify-start gap-1 md:w-auto md:inline-flex md:h-10 no-scrollbar scroll-smooth rounded-lg">
              <TabsTrigger
                value="preferencias"
                className="px-4 py-1.5 text-xs font-medium flex-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all gap-2"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Preferências Gerais
              </TabsTrigger>
              <TabsTrigger
                value="config_operacional"
                className="px-4 py-1.5 text-xs font-medium flex-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all gap-2"
              >
                <Boxes className="h-3.5 w-3.5" />
                Configurações Operacionais
              </TabsTrigger>
              <TabsTrigger
                value="manutencao"
                className="px-4 py-1.5 text-xs font-medium flex-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all gap-2"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Manutenção do Ambiente
              </TabsTrigger>
              <TabsTrigger
                value="modelos"
                className="px-4 py-1.5 text-xs font-medium flex-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all gap-2"
              >
                <Database className="h-3.5 w-3.5" />
                Modelos de Importação
              </TabsTrigger>
              <TabsTrigger
                value="conta"
                className="px-4 py-1.5 text-xs font-medium flex-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all gap-2"
              >
                <User className="h-3.5 w-3.5" />
                Meu Perfil
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preferencias" className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Aparência */}
              <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-colors space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                      Aparência
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Personalize o visual e a luminosidade da interface do ERP.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OptionCard
                    active={theme === "light"}
                    onClick={() => {
                      setTheme("light");
                      toast.success("Tema claro ativado");
                    }}
                    icon={<Sun className="h-4 w-4" />}
                    title="Modo Claro"
                    desc="Otimizado para alta luminosidade e ambientes corporativos"
                  />
                  <OptionCard
                    active={theme === "dark"}
                    onClick={() => {
                      setTheme("dark");
                      toast.success("Tema escuro ativado");
                    }}
                    icon={<Moon className="h-4 w-4" />}
                    title="Modo Escuro"
                    desc="Conforto visual reduzindo o cansaço ocular"
                  />
                </div>
              </div>

              {/* Card 2: Navegação Padrão */}
              <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-colors space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                      Navegação Padrão
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Defina qual visão operacional carregar ao acessar o painel principal.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OptionCard
                    active={defaultTab === "ponto"}
                    onClick={() => {
                      setDefaultTab("ponto");
                      toast.success("Padrão: Ponto");
                    }}
                    icon={<Clock className="h-4 w-4" />}
                    title="Ponto & Jornadas"
                    desc="Foco inicial em gestão de equipes, batidas e frequência"
                  />
                  <OptionCard
                    active={defaultTab === "operacoes"}
                    onClick={() => {
                      setDefaultTab("operacoes");
                      toast.success("Padrão: Operações");
                    }}
                    icon={<Boxes className="h-4 w-4" />}
                    title="Operações de Campo"
                    desc="Foco em logística, movimentação e volume de produção"
                  />
                </div>
              </div>
            </div>

            {/* Banner Manutenção do Ambiente */}
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    Manutenção do Ambiente
                  </div>
                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    Resets transacionais e manutenções controladas ficam isolados em uma área restrita, com auditoria persistente e confirmação dupla obrigatória.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("manutencao")}
                className="shrink-0 rounded-lg border-border/80 text-xs font-medium hover:bg-muted/50"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                Abrir Manutenção do Ambiente
              </Button>
            </div>
          </TabsContent>

        <TabsContent value="manutencao" className="space-y-6 mt-6">
          <ResetOperacional />
        </TabsContent>

                <TabsContent value="config_operacional" className="space-y-5 mt-2">
          {/* Card 1: Motor Operacional */}
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
              <div>
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Motor Operacional
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regras que governam cálculo, conferência e comportamento dos fluxos operacionais do ERP.
                </p>
              </div>
              <Button
                variant={isEditingParams ? "default" : "outline"}
                size="sm"
                onClick={() => isEditingParams ? saveParamsMutation.mutate(paramsForm) : setIsEditingParams(true)}
                disabled={saveParamsMutation.isPending}
                className={cn(
                  "rounded-lg text-xs font-medium shrink-0 h-9 px-4 transition-all",
                  isEditingParams
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    : "border-border/80 hover:bg-muted/40 text-foreground"
                )}
              >
                {saveParamsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : isEditingParams ? (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isEditingParams ? "Salvar Alterações" : "Editar Parâmetros"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Geral */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-display font-semibold text-xs text-foreground tracking-tight">Parâmetros Gerais</span>
                </div>
                <div className="space-y-1 divide-y divide-border/50">
                  <EditableParam
                    label="Moeda Padrão"
                    value={paramsForm.moeda_padrao || 'BRL (R$)'}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, moeda_padrao: v })}
                    options={["BRL (R$)", "USD ($)", "EUR (€)"]}
                  />
                  <EditableParam
                    label="Fuso Horário"
                    value={fixMojibakeText(paramsForm.fuso_horario || "GMT-3 (Brasília)")}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, fuso_horario: v })}
                    options={["GMT-3 (Brasília)", "GMT-4 (Manaus)", "GMT-0 (Londres)"]}
                  />
                  <EditableParam
                    label="Limite de Escopo (Dias)"
                    value={String(paramsForm.limite_escopo || 31)}
                    editing={isEditingParams}
                    type="number"
                    onChange={v => setParamsForm({ ...paramsForm, limite_escopo: Number(v) })}
                  />
                </div>
              </div>

              {/* Card Operacional */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-display font-semibold text-xs text-foreground tracking-tight">Regras de Apuração</span>
                </div>
                <div className="space-y-1 divide-y divide-border/50">
                  <EditableParam
                    label="Tolerância de Ponto (Minutos)"
                    value={String(paramsForm.tolerancia_ponto || 10)}
                    editing={isEditingParams}
                    type="number"
                    onChange={v => setParamsForm({ ...paramsForm, tolerancia_ponto: Number(v) })}
                  />
                  <EditableParam
                    label="Arredondamento Financeiro"
                    value={paramsForm.arredondamento_financeiro || 'Duas casas'}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, arredondamento_financeiro: v })}
                    options={["Duas casas", "Inteiro (Cêntimos)", "Teto"]}
                  />
                  <div className="flex items-center justify-between py-2 min-h-[48px]">
                    <span className="text-xs text-muted-foreground">Notificação de Inconsistência</span>
                    {isEditingParams ? (
                      <Switch
                        checked={paramsForm.notificacao_inconsistencia}
                        onCheckedChange={v => setParamsForm({ ...paramsForm, notificacao_inconsistencia: v })}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-foreground">
                        {paramsForm.notificacao_inconsistencia ? 'Ativado' : 'Desativado'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Jornadas de Trabalho */}
          <JornadasTrabalhoSection />

          {/* Seção 3: Regras de Banco de Horas */}
          <RegrasBancoHorasSection />

          {/* Seção 4: Filtros de Colaboradores */}
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border/60">
              <div className="space-y-0.5">
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                  Filtros de colaboradores por tela do encarregado
                </h3>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  Cada fluxo decide de forma independente quais colaboradores podem ser carregados. Campos vazios significam sem restrição para aquele critério.
                </p>
                {!empresaId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Nenhuma empresa válida foi encontrada para salvar esta configuração.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => saveParamsMutation.mutate(paramsForm)}
                disabled={saveParamsMutation.isPending || !empresaId}
                className="rounded-lg text-xs font-medium shrink-0 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-1.5"
              >
                {saveParamsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Salvar filtros
              </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {ENCARREGADO_FILTER_TARGETS.map((preset) => {
                const filter = presetFilters[preset.id];
                const availableOptions = getAvailableOptionsForField(filter.campo_filtro);

                return (
                  <div key={preset.id} className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3.5">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">{fixMojibakeText(preset.title)}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{fixMojibakeText(preset.description)}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Filtrar colaboradores por</Label>
                        {preset.fixed ? (
                          <div className="min-h-9 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground flex items-center">
                            Tipo
                          </div>
                        ) : (
                          <Select
                            value={filter.campo_filtro || "tipo_contrato"}
                            onValueChange={(value) => updatePresetFilter(preset.id, { campo_filtro: value as "tipo_colaborador" | "tipo_contrato" })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tipo_contrato" className="text-xs">Contrato</SelectItem>
                              <SelectItem value="tipo_colaborador" className="text-xs">Tipo</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Valores permitidos</Label>
                        {!preset.fixed ? (
                          <Select
                            value={filter.valores_filtro?.[0] || ""}
                            onValueChange={(value) => updatePresetFilter(preset.id, { valores_filtro: value ? [value] : [] })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                              <SelectValue placeholder="Selecione uma opção disponível" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOptions.map((option) => (
                                <SelectItem key={option} value={option} className="text-xs">
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="min-h-9 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground flex items-center">
                            {preset.fixed ? "DIARISTA" : formatFilterList(filter.valores_filtro)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

                <TabsContent value="modelos" className="space-y-4 mt-2">
          {/* Header Card */}
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                  Modelos de Importação
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastre links de planilhas de referência do Google Drive para download nos assistentes de importação.
              </p>
            </div>
            <Button
              onClick={handleAddImportTemplate}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shrink-0 h-9 px-3.5 shadow-xs transition-all gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Modelo
            </Button>
          </div>

          {/* Tabela de Modelos */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-left">
                    <th className="px-5 py-3">Módulo</th>
                    <th className="px-4 py-3">Nome do arquivo</th>
                    <th className="px-4 py-3">Link do Drive</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingModelos ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-blue-600" />
                        Carregando modelos...
                      </td>
                    </tr>
                  ) : importacaoModelos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                            <Database className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-foreground">Nenhum modelo configurado</p>
                          <p className="text-[11px] text-muted-foreground max-w-sm">
                            Adicione links de planilhas para disponibilizar aos usuários nas rotinas de importação.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    importacaoModelos.map((item: any) => {
                      const moduloLabel = IMPORTACAO_MODULOS.find((modulo) => modulo.value === item.modulo)?.label || item.modulo;
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-foreground">{moduloLabel}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{item.nome_arquivo || "Não informado"}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            <a
                              href={item.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              <Globe className="h-3.5 w-3.5 text-blue-500" />
                              Abrir Planilha
                            </a>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {item.ativo ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(item.drive_url, "_blank", "noopener,noreferrer")}
                                title="Abrir no Google Drive"
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditImportTemplate(item)}
                                title="Editar modelo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                onClick={() => {
                                  if (confirm("Deseja remover este modelo de importação?")) {
                                    deleteImportTemplateMutation.mutate(item.id);
                                  }
                                }}
                                title="Remover modelo"
                              >
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
          </div>
        </TabsContent>

        <TabsContent value="conta" className="space-y-4 mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Coluna 1 & 2: Cartão de Identidade e Dados Cadastrais */}
            <div className="lg:col-span-2 rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                  Identidade & Dados Cadastrais
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Informações corporativas e credenciais de acesso vinculadas ao seu usuário.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-border/60">
                <div className="relative group">
                  <div className="h-20 w-20 rounded-full border-2 border-border/80 bg-muted/50 flex items-center justify-center overflow-hidden relative shadow-xs">
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-muted-foreground" />
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer shadow-sm hover:bg-blue-700 transition-transform hover:scale-105 border-2 border-card">
                    <Camera className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5 w-full max-w-sm">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-8 text-xs focus-visible:ring-blue-600 rounded-lg"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                          onClick={handleUpdateName}
                          title="Salvar nome"
                          aria-label="Salvar nome"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 rounded-lg"
                          onClick={() => {
                            setIsEditingName(false);
                            setNewName(user?.user_metadata?.full_name || "");
                          }}
                          title="Cancelar"
                          aria-label="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/name">
                        <h4 className="text-base font-bold font-display text-foreground truncate">
                          {user?.user_metadata?.full_name || "Usuário Orbe"}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsEditingName(true)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-70 group-hover/name:opacity-100 transition-opacity rounded-md"
                          title="Editar nome"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                      <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      {user?.user_metadata?.role || "Colaborador Administrativo"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Matrícula Corporativa
                  </div>
                  <div className="font-mono text-xs font-semibold text-foreground">
                    {user?.user_metadata?.matricula || "N/A"}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Organização / Tenant
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate">
                    {perfil?.empresa_id || "ESC Logística Oficial"}
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Cartão de Segurança */}
            <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Segurança & Credenciais
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerencie o acesso à sua conta corporativa.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-foreground">Senha de Acesso</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Enviaremos um link de redefinição seguro para o seu e-mail cadastrado.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs font-medium border-border/80 rounded-lg hover:bg-muted/40 mt-1"
                      onClick={async () => {
                        try {
                          await supabase.auth.resetPasswordForEmail(user?.email || "");
                          toast.success("E-mail de redefinição enviado", {
                            description: "Verifique sua caixa de entrada.",
                          });
                        } catch (e: any) {
                          toast.error("Erro ao enviar e-mail", { description: e.message });
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      Solicitar Redefinição de Senha
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-foreground">Autenticação em Duas Etapas (2FA)</div>
                      <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        Em breve
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Camada extra de proteção via aplicativo autenticador.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs font-medium border-border/80 rounded-lg opacity-60 cursor-not-allowed mt-1"
                      disabled
                    >
                      <Shield className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      Configurar 2FA
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Sessão segura ativa</span>
                <span className="font-mono">v2026</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>

            <Dialog open={importTemplateModalOpen} onOpenChange={setImportTemplateModalOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-xl border border-border/80 bg-card p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold text-base tracking-tight text-foreground">
              {editingImportTemplate ? "Editar modelo de importação" : "Novo modelo de importação"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cadastre ou edite o modelo de planilha associado ao módulo para download.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Módulo</Label>
              <Select
                value={importTemplateForm.modulo}
                onValueChange={(value) => setImportTemplateForm({ ...importTemplateForm, modulo: value })}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTACAO_MODULOS.map((modulo) => (
                    <SelectItem key={modulo.value} value={modulo.value} className="text-xs">{modulo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Nome do arquivo</Label>
              <Input
                value={importTemplateForm.nome_arquivo}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, nome_arquivo: e.target.value })}
                placeholder="Ex: modelo_transportadoras.xlsx"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Link do Google Drive</Label>
              <Input
                value={importTemplateForm.drive_url}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, drive_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-3 pt-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium text-foreground">Modelo ativo</Label>
                <p className="text-[11px] text-muted-foreground">Disponível para download nos assistentes</p>
              </div>
              <Switch
                checked={importTemplateForm.ativo}
                onCheckedChange={(checked) => setImportTemplateForm({ ...importTemplateForm, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportTemplateModalOpen(false)}
              className="rounded-lg text-xs font-medium border-border/80 hover:bg-muted/40 h-9"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => importTemplateMutation.mutate(importTemplateForm)}
              disabled={importTemplateMutation.isPending || !importTemplateForm.drive_url}
              className="rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs h-9 px-4"
            >
              {importTemplateMutation.isPending ? "Salvando..." : "Salvar Modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </AppShell>
  );
};

const EditableParam = ({
  label,
  value,
  editing,
  onChange,
  options,
  type = "text"
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
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
            {options.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-40 text-xs text-right"
        />
      )
    ) : (
      <span className="text-sm font-semibold text-foreground">{value}</span>
    )}
  </div>
);

const ParamItem = ({ label, value }: { label: string; value: string }) => (

  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

const OptionCard = ({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group relative text-left p-4 rounded-xl border transition-all duration-200 outline-none w-full",
      active
        ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
        : "border-border/80 bg-card hover:border-border hover:bg-muted/30"
    )}
  >
    <div className="flex items-start justify-between gap-3 mb-3">
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
          active ? "bg-blue-600 text-white shadow-xs" : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        {icon}
      </div>
      {active && (
        <span className="flex h-5 items-center gap-1 rounded-full bg-blue-600/10 px-2 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
          <Check className="h-3 w-3" />
          Ativo
        </span>
      )}
    </div>
    <div className="font-display font-semibold text-foreground text-xs tracking-tight">{title}</div>
    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
  </button>
);

export default Configuracoes;
