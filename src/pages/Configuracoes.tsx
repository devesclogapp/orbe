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
  Power,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfigTipoOperacaoService,
  ConfigProdutoService,
  ConfigTipoDiaService,
  ConfiguracaoOperacionalService,
  ImportacaoModelosService,
  StorageService
} from "@/services/base.service";

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
      setActiveTab("preferencias");
      return;
    }
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configType, setConfigType] = useState<'operacao' | 'produto' | 'dia'>('operacao');
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState<any>({});
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

  const empresaId = user?.user_metadata?.empresa_id;

  const { data: opSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['config_operacional', empresaId],
    queryFn: () => ConfiguracaoOperacionalService.getByEmpresa(empresaId!),
    enabled: !!empresaId
  });

  useEffect(() => {
    if (opSettings) {
      setParamsForm(opSettings);
    }
  }, [opSettings]);

  const saveParamsMutation = useMutation({
    mutationFn: (payload: any) => ConfiguracaoOperacionalService.upsert({ ...payload, empresa_id: empresaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_operacional'] });
      setIsEditingParams(false);
      toast.success("Parâmetros salvos com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar parâmetros", { description: err.message })
  });

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
  const { data: tiposOperacao = [], isLoading: loadingOps } = useQuery({
    queryKey: ['config_tipos_operacao'],
    queryFn: () => ConfigTipoOperacaoService.getAll()
  });

  const { data: produtos = [], isLoading: loadingProds } = useQuery({
    queryKey: ['config_produtos'],
    queryFn: () => ConfigProdutoService.getAll()
  });

  const { data: tiposDia = [], isLoading: loadingDias } = useQuery({
    queryKey: ['config_tipos_dia'],
    queryFn: () => ConfigTipoDiaService.getAll()
  });

  const { data: importacaoModelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['importacao_modelos'],
    queryFn: () => ImportacaoModelosService.listAll()
  });

  // Mutations for toggling status
  const toggleOpStatus = useMutation({
    mutationFn: (item: any) => ConfigTipoOperacaoService.update(item.id, { status: item.status === 'ativo' ? 'inativo' : 'ativo' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_tipos_operacao'] });
      toast.success("Status atualizado");
    }
  });

  const configMutation = useMutation({
    mutationFn: (payload: any) => {
      const service = configType === 'operacao' ? ConfigTipoOperacaoService :
        configType === 'produto' ? ConfigProdutoService : ConfigTipoDiaService;

      return editingConfig ? service.update(editingConfig.id, payload) : service.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`config_tipos_${configType === 'operacao' ? 'operacao' : configType === 'produto' ? 'produtos' : 'dia'}`] });
      toast.success(editingConfig ? "Registro atualizado" : "Registro criado");
      setConfigModalOpen(false);
    },
    onError: (err: any) => toast.error("Erro ao salvar", { description: err.message })
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: string) => {
      const service = configType === 'operacao' ? ConfigTipoOperacaoService :
        configType === 'produto' ? ConfigProdutoService : ConfigTipoDiaService;
      return service.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`config_tipos_${configType === 'operacao' ? 'operacao' : configType === 'produto' ? 'produtos' : 'dia'}`] });
      toast.success("Registro removido");
    }
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

  const handleAddConfig = (type: 'operacao' | 'produto' | 'dia') => {
    const empresaId = user?.user_metadata?.empresa_id;
    setConfigType(type);
    setEditingConfig(null);
    setConfigForm(type === 'operacao' ? { nome: '', codigo: '', status: 'ativo', empresa_id: empresaId } :
      type === 'produto' ? { categoria: '', icms: 0, status: 'ativo', empresa_id: empresaId } :
        { nome: '', fator: 1, status: 'ativo', empresa_id: empresaId });
    setConfigModalOpen(true);
  };

  const handleEditConfig = (type: 'operacao' | 'produto' | 'dia', item: any) => {
    setConfigType(type);
    setEditingConfig(item);
    setConfigForm({ ...item });
    setConfigModalOpen(true);
  };

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

  if (loadingOps || loadingProds || loadingDias) {
    return (
      <AppShell title="Configurações" subtitle="Carregando configurações...">
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Preferências e Conta" subtitle="Ajustes pessoais de uso e perfil do ERP">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="preferencias" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4 mr-2" /> Preferências
          </TabsTrigger>
          <TabsTrigger value="modelos" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Database className="h-4 w-4 mr-2" /> Modelos de Importação
          </TabsTrigger>
          <TabsTrigger value="conta" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <User className="h-4 w-4 mr-2" /> Meu Perfil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferencias" className="space-y-6 mt-6">
          <section className="esc-card p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Administração operacional movida</h2>
              <p className="text-sm text-muted-foreground">
                Parâmetros básicos, tipos de operação, produtos e tipos de dia agora ficam na Central de Cadastros.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/cadastros")}>
              <Database className="h-4 w-4 mr-2" />
              Abrir Central de Cadastros
            </Button>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="esc-card p-6">
              <h2 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" /> Aparência
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Personalize o visual da sua interface.</p>

              <div className="grid grid-cols-2 gap-3">
                <OptionCard
                  active={theme === "light"}
                  onClick={() => { setTheme("light"); toast.success("Tema claro ativado"); }}
                  icon={<Sun className="h-5 w-5" />}
                  title="Modo Claro"
                  desc="Ideal para alta luminosidade"
                />
                <OptionCard
                  active={theme === "dark"}
                  onClick={() => { setTheme("dark"); toast.success("Tema escuro ativado"); }}
                  icon={<Moon className="h-5 w-5" />}
                  title="Modo Escuro"
                  desc="Conforto visual e economia"
                />
              </div>
            </section>

            <section className="esc-card p-6">
              <h2 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Navegação Padrão
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Escolha qual aba abrir ao acessar o painel principal.</p>

              <div className="grid grid-cols-2 gap-3">
                <OptionCard
                  active={defaultTab === "ponto"}
                  onClick={() => { setDefaultTab("ponto"); toast.success("Padrão: Ponto"); }}
                  icon={<Clock className="h-5 w-5" />}
                  title="Ponto"
                  desc="Foco em registros de pessoal"
                />
                <OptionCard
                  active={defaultTab === "operacoes"}
                  onClick={() => { setDefaultTab("operacoes"); toast.success("Padrão: Operações"); }}
                  icon={<Boxes className="h-5 w-5" />}
                  title="Operações"
                  desc="Foco em logística e volume"
                />
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="minimas" className="mt-6">
          <Tabs defaultValue="operacao" className="w-full">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <TabsList className="bg-muted p-1 h-9 rounded-lg">
                <TabsTrigger value="operacao" className="text-xs py-1 px-4">Tipos de Operação</TabsTrigger>
                <TabsTrigger value="produtos" className="text-xs py-1 px-4">Produtos</TabsTrigger>
                <TabsTrigger value="dia" className="text-xs py-1 px-4">Tipos de Dia</TabsTrigger>
                <TabsTrigger value="parametros" className="text-xs py-1 px-4">Parâmetros Básicos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="operacao">
              <ConfigTable<any>
                title="Tipos de Operação"
                data={tiposOperacao as any}
                columns={[
                  { header: "Nome", accessorKey: "nome" },
                  { header: "Código", accessorKey: "codigo", cell: (item) => <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{item.codigo}</code> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
                onAdd={() => handleAddConfig('operacao')}
                onEdit={(item) => handleEditConfig('operacao', item)}
                onDelete={(item) => {
                  if (confirm("Deseja remover este registro?")) {
                    setConfigType('operacao');
                    deleteConfigMutation.mutate(item.id);
                  }
                }}
                onToggleStatus={(item) => toggleOpStatus.mutate(item)}
              />
            </TabsContent>

            <TabsContent value="produtos">
              <ConfigTable<any>
                title="Produtos / Categorias"
                data={produtos as any}
                columns={[
                  { header: "Categoria", accessorKey: "categoria" },
                  { header: "Alíquota ICMS", accessorKey: "icms", cell: (item) => <span className="font-bold text-primary">{item.icms}%</span> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
                onAdd={() => handleAddConfig('produto')}
                onEdit={(item) => handleEditConfig('produto', item)}
                onDelete={(item) => {
                  if (confirm("Deseja remover esta categoria?")) {
                    setConfigType('produto');
                    deleteConfigMutation.mutate(item.id);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="dia">
              <ConfigTable<any>
                title="Tipos de Dia"
                data={tiposDia as any}
                columns={[
                  { header: "Descrição", accessorKey: "nome" },
                  { header: "Fator Multiplicador", accessorKey: "fator", cell: (item) => <span className="font-mono font-bold">x{item.fator}</span> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
                onAdd={() => handleAddConfig('dia')}
                onEdit={(item) => handleEditConfig('dia', item)}
                onDelete={(item) => {
                  if (confirm("Deseja remover este tipo de dia?")) {
                    setConfigType('dia');
                    deleteConfigMutation.mutate(item.id);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="parametros">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Configurações de motor de cálculo e interface</h3>
                <Button
                  variant={isEditingParams ? "default" : "outline"}
                  size="sm"
                  onClick={() => isEditingParams ? saveParamsMutation.mutate(paramsForm) : setIsEditingParams(true)}
                  disabled={saveParamsMutation.isPending}
                >
                  {saveParamsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditingParams ? <Check className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                  {isEditingParams ? "Salvar Alterações" : "Editar Parâmetros"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="esc-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> Geral
                  </h3>
                  <div className="space-y-4">
                    <EditableParam
                      label="Moeda Padrão"
                      value={paramsForm.moeda_padrao || 'BRL (R$)'}
                      editing={isEditingParams}
                      onChange={v => setParamsForm({ ...paramsForm, moeda_padrao: v })}
                      options={['BRL (R$)', 'USD ($)', 'EUR (€)']}
                    />
                    <EditableParam
                      label="Fuso Horário"
                      value={paramsForm.fuso_horario || 'GMT-3 (Brasília)'}
                      editing={isEditingParams}
                      onChange={v => setParamsForm({ ...paramsForm, fuso_horario: v })}
                      options={['GMT-3 (Brasília)', 'GMT-4 (Manaus)', 'GMT-0 (Londres)']}
                    />
                    <EditableParam
                      label="Limite de Escopo (Dias)"
                      value={String(paramsForm.limite_escopo || 31)}
                      editing={isEditingParams}
                      type="number"
                      onChange={v => setParamsForm({ ...paramsForm, limite_escopo: Number(v) })}
                    />
                  </div>
                </section>
                <section className="esc-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Operacional
                  </h3>
                  <div className="space-y-4">
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
                      options={['Duas casas', 'Inteiro (Cêntimos)', 'Teto']}
                    />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs text-muted-foreground">Notificação de Inconsistência</span>
                      {isEditingParams ? (
                        <Switch
                          checked={paramsForm.notificacao_inconsistencia}
                          onCheckedChange={v => setParamsForm({ ...paramsForm, notificacao_inconsistencia: v })}
                        />
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{paramsForm.notificacao_inconsistencia ? 'Ativado' : 'Desativado'}</span>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="modelos" className="space-y-6 mt-6">
          <section className="esc-card p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Modelos de Importação</h2>
              <p className="text-sm text-muted-foreground">
                Cadastre links do Google Drive para os modelos usados no botão "Baixar modelo".
              </p>
            </div>
            <Button onClick={handleAddImportTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo modelo
            </Button>
          </section>

          <section className="esc-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Módulo</th>
                  <th className="px-4 h-11 font-medium">Nome do arquivo</th>
                  <th className="px-4 h-11 font-medium">Link do Drive</th>
                  <th className="px-4 h-11 font-medium text-center">Status</th>
                  <th className="px-5 h-11 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingModelos ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Carregando modelos...
                    </td>
                  </tr>
                ) : importacaoModelos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum modelo configurado ainda.
                    </td>
                  </tr>
                ) : (
                  importacaoModelos.map((item: any) => {
                    const moduloLabel = IMPORTACAO_MODULOS.find((modulo) => modulo.value === item.modulo)?.label || item.modulo;
                    return (
                      <tr key={item.id} className="border-t border-muted hover:bg-background">
                        <td className="px-5 h-14 font-medium text-foreground">{moduloLabel}</td>
                        <td className="px-4 text-muted-foreground">{item.nome_arquivo || "Não informado"}</td>
                        <td className="px-4 text-muted-foreground">
                          <a
                            href={item.drive_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 hover:text-primary"
                          >
                            Abrir link
                          </a>
                        </td>
                        <td className="px-4 text-center">
                          <Badge variant={item.ativo ? 'success' : 'secondary'} className="h-5">
                            {item.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(item.drive_url, "_blank", "noopener,noreferrer")}>
                              <Globe className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditImportTemplate(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Deseja remover este modelo de importação?")) {
                                  deleteImportTemplateMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        </TabsContent>

        <TabsContent value="conta" className="mt-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="esc-card p-8 flex items-center gap-6 relative">
              <div className="relative group">
                <div className="h-24 w-24 rounded-full bg-primary-soft flex items-center justify-center border-2 border-primary overflow-hidden relative">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-primary" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform border-2 border-card">
                  <Camera className="h-4 w-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 w-full max-w-sm">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-9 focus-visible:ring-primary"
                        autoFocus
                      />
                      <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleUpdateName}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setIsEditingName(false); setNewName(user?.user_metadata?.full_name || ""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/name">
                      <h2 className="text-xl font-bold text-foreground">{user?.user_metadata?.full_name || "Usuário Orbe"}</h2>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-success" /> {user?.user_metadata?.role || "Colaborador Administrativo"}
                  </div>
                  <div className="text-xs opacity-70">{user?.email}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Matrícula: <code className="bg-muted px-1.5 py-0.5 rounded">{user?.user_metadata?.matricula || "N/A"}</code></p>
              </div>
            </div>

            <div className="esc-card p-6">
              <h3 className="font-display font-semibold mb-4 text-foreground">Segurança</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-foreground border-border hover:bg-secondary"
                  onClick={async () => {
                    try {
                      await supabase.auth.resetPasswordForEmail(user?.email || "");
                      toast.success("E-mail de redefinição enviado", { description: "Verifique sua caixa de entrada." });
                    } catch (e: any) {
                      toast.error("Erro ao enviar e-mail", { description: e.message });
                    }
                  }}
                >
                  Alterar Senha de Acesso
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-foreground border-border hover:bg-secondary"
                  onClick={() => toast.info("Autenticação em duas etapas", { description: "Esta funcionalidade será disponibilizada na próxima atualização." })}
                >
                  Configurar Autenticação em Duas Etapas (2FA)
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={importTemplateModalOpen} onOpenChange={setImportTemplateModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingImportTemplate ? "Editar modelo de importação" : "Novo modelo de importação"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select
                value={importTemplateForm.modulo}
                onValueChange={(value) => setImportTemplateForm({ ...importTemplateForm, modulo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTACAO_MODULOS.map((modulo) => (
                    <SelectItem key={modulo.value} value={modulo.value}>{modulo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome do arquivo</Label>
              <Input
                value={importTemplateForm.nome_arquivo}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, nome_arquivo: e.target.value })}
                placeholder="Ex: modelo_transportadoras.xlsx"
              />
            </div>

            <div className="space-y-2">
              <Label>Link do Google Drive</Label>
              <Input
                value={importTemplateForm.drive_url}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, drive_url: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Modelo ativo</p>
                <p className="text-xs text-muted-foreground">Define se o link deve ser usado no botão de download.</p>
              </div>
              <Switch
                checked={importTemplateForm.ativo}
                onCheckedChange={(checked) => setImportTemplateForm({ ...importTemplateForm, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportTemplateModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => importTemplateMutation.mutate(importTemplateForm)}
              disabled={importTemplateMutation.isPending || !importTemplateForm.drive_url.trim()}
            >
              {importTemplateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar" : "Novo"} {configType === 'operacao' ? "Tipo de Operação" : configType === 'produto' ? "Produto" : "Tipo de Dia"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {configType === 'operacao' && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Operação</Label>
                  <Input value={configForm.nome || ''} onChange={e => setConfigForm({ ...configForm, nome: e.target.value })} placeholder="Ex: Carga Geral" />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={configForm.codigo || ''} onChange={e => setConfigForm({ ...configForm, codigo: e.target.value })} placeholder="Ex: CG-01" />
                </div>
              </>
            )}

            {configType === 'produto' && (
              <>
                <div className="space-y-2">
                  <Label>Categoria do Produto</Label>
                  <Input value={configForm.categoria || ''} onChange={e => setConfigForm({ ...configForm, categoria: e.target.value })} placeholder="Ex: Grãos" />
                </div>
                <div className="space-y-2">
                  <Label>Alíquota ICMS (%)</Label>
                  <Input type="number" value={configForm.icms || 0} onChange={e => setConfigForm({ ...configForm, icms: Number(e.target.value) })} />
                </div>
              </>
            )}

            {configType === 'dia' && (
              <>
                <div className="space-y-2">
                  <Label>Descrição do Dia</Label>
                  <Input value={configForm.nome || ''} onChange={e => setConfigForm({ ...configForm, nome: e.target.value })} placeholder="Ex: Feriado Nacional" />
                </div>
                <div className="space-y-2">
                  <Label>Fator de Cálculo</Label>
                  <Input type="number" step="0.1" value={configForm.fator || 1} onChange={e => setConfigForm({ ...configForm, fator: Number(e.target.value) })} />
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
    onClick={onClick}
    className={cn(
      "text-left p-4 rounded-xl border transition-all duration-200 outline-none",
      active
        ? "border-primary bg-primary-soft ring-1 ring-primary shadow-sm"
        : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
    )}
  >
    <div className={cn("mb-3 h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
      active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
      {icon}
    </div>
    <div className="font-display font-bold text-foreground text-sm tracking-tight">{title}</div>
    <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{desc}</div>
  </button>
);

export default Configuracoes;
