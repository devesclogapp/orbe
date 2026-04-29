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
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
  const [configType, setConfigType] = useState<"operacao" | "produto" | "dia">("operacao");
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState<any>({});
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [paramsForm, setParamsForm] = useState<any>({});

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
              <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes?tab=preferencias")}>
                <Settings2 className="h-4 w-4 mr-2" />
                Preferências pessoais
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

              <TabsContent value="colaboradores" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Equipe operacional</h2>
                      <p className="text-sm text-muted-foreground">
                        Vínculo com empresa, contrato e impacto financeiro lado a lado.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/colaboradores")}>
                      Abrir gestão completa <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
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

              <TabsContent value="empresas" className="space-y-4">
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                </section>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => navigate("/empresas")}>
                    Abrir gestão completa <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="coletores" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Coletores REP</h2>
                      <p className="text-sm text-muted-foreground">
                        Estado do dispositivo e vínculo com a unidade operacional.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/coletores")}>
                      Abrir gestão completa <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
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

              <TabsContent value="parametros" className="space-y-6">
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
