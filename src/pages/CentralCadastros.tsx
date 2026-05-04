import { useEffect, useMemo, useState } from "react";
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
  Plus,
  Settings2,
  Users,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";

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
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";

const CentralCadastros = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const empresaId = user?.user_metadata?.empresa_id;

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [configType, setConfigType] = useState<"operacao" | "produto" | "dia">("operacao");
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState<any>({});
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [paramsForm, setParamsForm] = useState<any>({});

  const [colaboradorModalOpen, setColaboradorModalOpen] = useState(false);
  const [colaboradorStep, setColaboradorStep] = useState(1);
  const [colaboradorForm, setColaboradorForm] = useState({
    nome: "", cpf: "", telefone: "", cargo: "", matricula: "",
    empresa_id: empresaId || "",
    tipo_colaborador: "CLT",
    tipo_contrato: "Hora" as "Hora" | "Operação",
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

  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);
  const [empresaForm, setEmpresaForm] = useState({
    nome: "", cnpj: "", unidade: "", cidade: "", estado: "",
    banco_codigo: "", agencia: "", agencia_digito: "", conta: "", conta_digito: "",
    convenios_bancario: "", codigo_empresa_banco: "", nome_empresa_banco: "",
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
    mutationFn: (payload: any) => ColaboradorService.create({
      ...payload,
      valor_base: Number(payload.valor_base) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] });
      toast.success("Colaborador cadastrado com sucesso");
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
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const createEmpresaMutation = useMutation({
    mutationFn: (payload: any) => EmpresaService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa cadastrada com sucesso");
      setEmpresaModalOpen(false);
      setEmpresaForm({
        nome: "", cnpj: "", unidade: "", cidade: "", estado: "",
        banco_codigo: "", agencia: "", agencia_digito: "", conta: "", conta_digito: "",
        convenios_bancario: "", codigo_empresa_banco: "", nome_empresa_banco: "",
      });
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
  });

  const createColetorMutation = useMutation({
    mutationFn: (payload: any) => ColetorService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coletores"] });
      toast.success("Coletor cadastrado com sucesso");
      setColetorModalOpen(false);
      setColetorForm({ modelo: "", serie: "", empresa_id: empresaId || "" });
    },
    onError: (err: any) => toast.error("Erro ao cadastrar", { description: err.message }),
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

  const loading =
    loadingEmpresas ||
    loadingColaboradores ||
    loadingColetores ||
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard label="Empresas" value={empresas.length.toString()} icon={Building2} />
              <MetricCard label="Colaboradores" value={colaboradores.length.toString()} icon={Users} />
              <MetricCard label="Faturáveis" value={colaboradoresFaturaveis.toString()} icon={Boxes} />
              <MetricCard label="Coletores" value={coletores.length.toString()} icon={Cpu} />
              <MetricCard label="Online" value={coletoresOnline.toString()} icon={Database} />
            </div>

            <Tabs defaultValue="colaboradores" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
                <TabsTrigger value="empresas">Empresas</TabsTrigger>
                <TabsTrigger value="coletores">Coletores</TabsTrigger>
                <TabsTrigger value="parametros">Parâmetros operacionais</TabsTrigger>
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
                        Gestão completa
                      </Button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Nome</th>
                        <th className="px-3 h-11 font-medium">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Contrato</th>
                        <th className="px-3 h-11 font-medium text-right">Valor base</th>
                        <th className="px-3 h-11 font-medium text-center">Faturamento</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradores.slice(0, 8).map((colaborador) => (
                        <tr key={colaborador.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[56px]">
                            <div className="font-medium text-foreground">{colaborador.nome}</div>
                            <div className="text-xs text-muted-foreground">Mat. {colaborador.matricula}</div>
                          </td>
                          <td className="px-3 text-muted-foreground">{colaborador.empresas?.nome || "—"}</td>
                          <td className="px-3 text-center">{colaborador.tipo_contrato}</td>
                          <td className="px-3 text-right font-display font-medium">
                            R$ {Number(colaborador.valor_base || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 text-center">{colaborador.flag_faturamento ? "Sim" : "Não"}</td>
                          <td className="px-5 text-center">
                            <StatusChip status={colaborador.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="empresas" className="space-y-4 min-h-[400px]">
                <section className="esc-card">
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
                        Gestão completa
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5">
                    {empresas.map((empresa) => (
                      <article key={empresa.id} className="esc-card p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="font-display font-semibold text-foreground">{empresa.nome}</h3>
                            <p className="text-xs text-muted-foreground">{empresa.cnpj}</p>
                          </div>
                          <Badge className={cn(
                            "font-semibold",
                            empresa.status === "ativa" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"
                          )}>
                            {empresa.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {empresa.unidade} · {empresa.cidade}/{empresa.estado}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Colaboradores</div>
                            <div className="font-display font-semibold text-foreground">{empresa.total_colaboradores}</div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Coletores</div>
                            <div className="font-display font-semibold text-foreground">{empresa.total_coletores}</div>
                          </div>
                        </div>
                      </article>
                    ))}
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
                        Gestão completa
                      </Button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Modelo</th>
                        <th className="px-3 h-11 font-medium">Série</th>
                        <th className="px-3 h-11 font-medium">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Última sync</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coletores.slice(0, 8).map((coletor) => (
                        <tr key={coletor.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[56px] font-medium text-foreground">{coletor.modelo}</td>
                          <td className="px-3 text-muted-foreground">{coletor.serie}</td>
                          <td className="px-3 text-muted-foreground">{coletor.empresas?.nome || "—"}</td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="parametros" className="space-y-6 min-h-[400px]">
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
                <Label htmlFor="colab_nome">Nome completo</Label>
                <Input id="colab_nome" value={colaboradorForm.nome} onChange={(e) => setColaboradorForm({ ...colaboradorForm, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colab_cpf">CPF</Label>
                <Input id="colab_cpf" value={colaboradorForm.cpf} onChange={(e) => setColaboradorForm({ ...colaboradorForm, cpf: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colab_telefone">Telefone</Label>
                <Input id="colab_telefone" value={colaboradorForm.telefone} onChange={(e) => setColaboradorForm({ ...colaboradorForm, telefone: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Empresa</Label>
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
                <Label>Tipo de colaborador</Label>
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
                <Label>Status</Label>
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
                    <Label htmlFor="colab_valor">Valor da diária (R$)</Label>
                    <Input id="colab_valor" type="number" value={colaboradorForm.valor_base} onChange={(e) => setColaboradorForm({ ...colaboradorForm, valor_base: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_cargo">Função operacional</Label>
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
                    <Label htmlFor="colab_cargo">Cargo</Label>
                    <Input id="colab_cargo" value={colaboradorForm.cargo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, cargo: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_matricula">Matrícula</Label>
                    <Input id="colab_matricula" value={colaboradorForm.matricula} onChange={(e) => setColaboradorForm({ ...colaboradorForm, matricula: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de contrato</Label>
                    <Select value={colaboradorForm.tipo_contrato} onValueChange={(v: "Hora" | "Operação") => setColaboradorForm({ ...colaboradorForm, tipo_contrato: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hora">Por hora</SelectItem>
                        <SelectItem value="Operação">Por operação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="colab_valor">Valor base (R$)</Label>
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
                <Label htmlFor="nome_completo">Nome completo (como conta)</Label>
                <Input id="nome_completo" value={colaboradorForm.nome_completo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, nome_completo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco_codigo">Cód. Banco</Label>
                <Input id="banco_codigo" value={colaboradorForm.banco_codigo} onChange={(e) => setColaboradorForm({ ...colaboradorForm, banco_codigo: e.target.value })} placeholder="Ex: 341" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Conta</Label>
                <Select value={colaboradorForm.tipo_conta} onValueChange={(v) => setColaboradorForm({ ...colaboradorForm, tipo_conta: v })}>
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
                  <Input id="agencia" value={colaboradorForm.agencia} onChange={(e) => setColaboradorForm({ ...colaboradorForm, agencia: e.target.value })} className="flex-1" />
                  <Input id="agencia_digito" value={colaboradorForm.agencia_digito} onChange={(e) => setColaboradorForm({ ...colaboradorForm, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta">Conta</Label>
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
            {colaboradorStep === 1 && <Button onClick={() => setColaboradorStep(2)}>Próximo</Button>}
            {colaboradorStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setColaboradorStep(1)}>Voltar</Button>
                <Button onClick={() => setColaboradorStep(3)}>Próximo</Button>
              </>
            )}
            {colaboradorStep === 3 && (
              <>
                <Button variant="outline" onClick={() => setColaboradorStep(2)}>Voltar</Button>
                <Button onClick={() => createColaboradorMutation.mutate(colaboradorForm)} disabled={createColaboradorMutation.isPending}>
                  {createColaboradorMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={empresaModalOpen} onOpenChange={setEmpresaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Cadastre uma nova unidade operacional no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp_nome">Nome da Empresa</Label>
              <Input id="emp_nome" value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp_cnpj">CNPJ</Label>
              <Input id="emp_cnpj" value={empresaForm.cnpj} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp_unidade">Unidade (Filial)</Label>
                <Input id="emp_unidade" value={empresaForm.unidade} onChange={(e) => setEmpresaForm({ ...empresaForm, unidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp_cidade">Cidade</Label>
                <Input id="emp_cidade" value={empresaForm.cidade} onChange={(e) => setEmpresaForm({ ...empresaForm, cidade: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp_estado">Estado (UF)</Label>
              <Input id="emp_estado" value={empresaForm.estado} onChange={(e) => setEmpresaForm({ ...empresaForm, estado: e.target.value })} maxLength={2} />
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
            <Button variant="outline" onClick={() => setEmpresaModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createEmpresaMutation.mutate(empresaForm)} disabled={createEmpresaMutation.isPending}>
              {createEmpresaMutation.isPending ? "Salvando..." : "Salvar"}
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

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Importar Configurações Operacionais"
        description="A importação classificará os registros automaticamente: Planilhas com colunas 'Categoria'/'ICMS' vão para Produtos. 'Fator' vão para Tipos de Dia. As demais vão para Tipos de Operação."
        onUpload={handleImport}
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
