import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ContabilOficialService,
  CategoriaContabil,
  MapeamentoContabilItem,
} from "@/services/contabilOficial.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { Button } from "@/components/ui/button";
import {
  Search,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Hash,
  Database,
  Building2,
  Edit2,
  Save,
  X,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Lock,
  HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { GuiaUsoDrawer } from "@/pages/Relatorios/components/GuiaUsoDrawer";
import { GUIA_MAPEAMENTO_CONTABIL } from "@/pages/Relatorios/components/guiasContabeisData";
import { useContadorScope } from "@/hooks/useContadorScope";

interface MapeamentoContabilProps {
  empresaId?: string;
  empresaNome?: string;
  competencia?: string;
  onMapeamentoAtualizado?: () => void;
  isEmbedded?: boolean;
}

const MapeamentoContabil: React.FC<MapeamentoContabilProps> = ({
  empresaId: propEmpresaId,
  empresaNome: propEmpresaNome,
  competencia: propCompetencia,
  onMapeamentoAtualizado,
  isEmbedded = false,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { role, isAdmin } = useAccessControl();

  const isAuthorized = useMemo(() => {
    if (isAdmin) return true;
    const normalized = (role || "").toLowerCase();
    return normalized === "admin" || normalized === "financeiro" || normalized === "contador";
  }, [role, isAdmin]);

  const paramEmpresaId = searchParams.get("empresa_id") || "";
  const paramCompetencia = searchParams.get("competencia") || "";

  const [search, setSearch] = useState("");
  const [isGuiaOpen, setIsGuiaOpen] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    propEmpresaId || paramEmpresaId || ""
  );
  const [editingItem, setEditingItem] = useState<MapeamentoContabilItem | null>(null);
  const [editDebito, setEditDebito] = useState("");
  const [editCredito, setEditCredito] = useState("");

  const { isContador, filterEmpresas, validateOrFallbackEmpresaId } = useContadorScope();

  // Carregar lista de empresas caso não tenha vindo por prop
  const { data: rawEmpresas = [] } = useQuery({
    queryKey: ["empresas_mapeamento_contabil"],
    queryFn: async () => {
      const data = await EmpresaService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  // Empresas autorizadas no escopo
  const empresas = useMemo(() => filterEmpresas(rawEmpresas), [rawEmpresas, filterEmpresas]);

  // Sincronizar empresa ativa com validação de escopo
  const currentCandidate = propEmpresaId || selectedEmpresaId || paramEmpresaId || "";
  const activeEmpresaId = useMemo(() => {
    return validateOrFallbackEmpresaId(currentCandidate, empresas);
  }, [currentCandidate, empresas, validateOrFallbackEmpresaId]);

  const activeEmpresa =
    propEmpresaNome ||
    empresas.find((e) => e.id === activeEmpresaId)?.nome ||
    "Empresa Homologada";

  const activeCompetencia = propCompetencia || paramCompetencia || "";

  const handleEmpresaChange = (val: string) => {
    setSelectedEmpresaId(val);
    if (!propEmpresaId) {
      const next = new URLSearchParams(searchParams);
      next.set("empresa_id", val);
      setSearchParams(next, { replace: true });
    }
  };

  const handleBackToHub = () => {
    const params = new URLSearchParams();
    if (activeEmpresaId) params.set("empresa_id", activeEmpresaId);
    if (activeCompetencia) params.set("competencia", activeCompetencia);
    const qs = params.toString();
    navigate(`/relatorios${qs ? `?${qs}` : ""}`);
  };

  // Carregar mapeamentos da empresa ativa estritamente no Supabase
  const { data: mapeamentos = [], isLoading } = useQuery({
    queryKey: ["contabil_mapeamentos", activeEmpresaId],
    queryFn: () => ContabilOficialService.getMapeamentos(activeEmpresaId),
    enabled: !!activeEmpresaId && isAuthorized,
  });

  // Mutação para salvar
  const saveMutation = useMutation({
    mutationFn: async ({
      categoria,
      debito,
      credito,
    }: {
      categoria: CategoriaContabil;
      debito: string;
      credito: string;
    }) => {
      return ContabilOficialService.salvarMapeamento(
        activeEmpresaId,
        categoria,
        debito,
        credito
      );
    },
    onSuccess: (res) => {
      toast.success(res.message || "Mapeamento salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contabil_mapeamentos", activeEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["contabil_previa"] });
      setEditingItem(null);
      if (onMapeamentoAtualizado) onMapeamentoAtualizado();
    },
    onError: (err: any) => {
      toast.error(`Falha ao salvar: ${err.message || "Erro desconhecido"}`);
    },
  });

  const handleOpenEdit = (item: MapeamentoContabilItem) => {
    setEditingItem(item);
    setEditDebito(item.conta_debito);
    setEditCredito(item.conta_credito);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    saveMutation.mutate({
      categoria: editingItem.operacao_tipo,
      debito: editDebito,
      credito: editCredito,
    });
  };

  const filteredMapeamentos = mapeamentos.filter((m) => {
    const term = search.toLowerCase();
    return (
      m.titulo.toLowerCase().includes(term) ||
      m.operacao_tipo.toLowerCase().includes(term) ||
      m.conta_debito.toLowerCase().includes(term) ||
      m.conta_credito.toLowerCase().includes(term)
    );
  });

  const totalCompletos = mapeamentos.filter((m) => m.status === "COMPLETO").length;
  const totalIncompletos = mapeamentos.length - totalCompletos;

  const isStandalone = !isEmbedded && propEmpresaId === undefined;

  if (!isAuthorized) {
    if (isStandalone) {
      return (
        <AppShell
          title="Mapeamento Contábil"
          subtitle="Associação de categorias operacionais às contas de Débito e Crédito para partidas dobradas"
          backPath="/relatorios"
        >
          <div className="p-8 max-w-2xl mx-auto border border-border rounded-xl bg-card text-center space-y-4 my-12">
            <Lock className="h-12 w-12 text-destructive mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Acesso Restrito ao Mapeamento Contábil</h3>
            <p className="text-sm text-muted-foreground">
              O mapeamento de contas de partidas dobradas é restrito aos perfis Administrativo e Financeiro.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/relatorios")}>
              Voltar para Central de Relatórios
            </Button>
          </div>
        </AppShell>
      );
    }
    return (
      <div className="p-8 max-w-2xl mx-auto border border-border rounded-xl bg-card text-center space-y-4 my-12">
        <Lock className="h-12 w-12 text-destructive mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Acesso Restrito ao Mapeamento Contábil</h3>
        <p className="text-sm text-muted-foreground">
          O mapeamento de contas de partidas dobradas é restrito aos perfis Administrativo e Financeiro.
        </p>
      </div>
    );
  }

  const renderContent = () => (
    <>
      {/* Resumo e Indicadores de Conformidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Empresa Vinculada
          </div>
          <div className="text-base font-bold text-foreground truncate" title={activeEmpresa}>
            {activeEmpresa}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Mapeamentos Homologados
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {totalCompletos}
            </span>
            <span className="text-xs text-muted-foreground">de {mapeamentos.length} categorias</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Pendências de Configuração
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-black ${
                totalIncompletos > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              {totalIncompletos}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalIncompletos > 0 ? "bloqueia exportação" : "nenhuma pendência"}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Avisos */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoria ou conta contábil..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Contas devem ser preenchidas conforme o plano de contas oficial da contabilidade.</span>
          </div>
          {!isStandalone && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setIsGuiaOpen(true)}
            >
              <HelpCircle className="h-3 w-3 text-primary" />
              Guia De-Para
            </Button>
          )}
        </div>
      </div>

      {/* Tabela de Mapeamento De-Para */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[30%]">Categoria Operacional</TableHead>
              <TableHead className="w-[12%]">Natureza</TableHead>
              <TableHead className="w-[22%]">Conta Débito</TableHead>
              <TableHead className="w-[22%]">Conta Crédito</TableHead>
              <TableHead className="w-[8%] text-center">Status</TableHead>
              <TableHead className="w-[6%] text-right pr-4">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-14 animate-pulse bg-muted/20" />
                </TableRow>
              ))
            ) : filteredMapeamentos.length > 0 ? (
              filteredMapeamentos.map((item) => (
                <TableRow key={item.operacao_tipo} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0 mt-0.5">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">{item.titulo}</div>
                        <div className="text-xs text-muted-foreground">{item.descricao}</div>
                        <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                          {item.operacao_tipo}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        item.natureza === "RECEITA"
                          ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200"
                          : "text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200"
                      }`}
                    >
                      {item.natureza}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {item.conta_debito ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate" title={item.conta_debito}>
                          {item.conta_debito}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 italic font-medium">
                        Aguardando Plano de Contas
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    {item.conta_credito ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate" title={item.conta_credito}>
                          {item.conta_credito}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 italic font-medium">
                        Aguardando Plano de Contas
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {item.status === "COMPLETO" ? (
                      <Badge
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-normal"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 text-[10px] font-normal"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhuma categoria encontrada para o filtro informado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Edição de Mapeamento */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Editar Contas Contábeis
            </DialogTitle>
            <DialogDescription>
              Configure as contas contábeis de Débito e Crédito para{" "}
              <strong className="text-foreground">{editingItem?.titulo}</strong> na empresa{" "}
              <strong className="text-foreground">{activeEmpresa}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Conta a Débito (Código Contábil)
              </label>
              <Input
                placeholder="Ex: 1.1.02.001 (Ativo / Despesa)"
                value={editDebito}
                onChange={(e) => setEditDebito(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Representa a destinação contábil do recurso ou reconhecimento de direito.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Conta a Crédito (Código Contábil)
              </label>
              <Input
                placeholder="Ex: 3.1.01.001 (Receita / Passivo)"
                value={editCredito}
                onChange={(e) => setEditCredito(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Representa a origem do recurso ou reconhecimento da obrigação/receita.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-sm font-medium"
              onClick={() => setEditingItem(null)}
              disabled={saveMutation.isPending}
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              onClick={handleSaveEdit}
              disabled={saveMutation.isPending || (!editDebito.trim() && !editCredito.trim())}
            >
              <Save className="h-4 w-4" />
              <span>{saveMutation.isPending ? "Salvando..." : "Salvar Mapeamento"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Guia de Uso Contextual (CONT-06) */}
      <GuiaUsoDrawer
        isOpen={isGuiaOpen}
        onClose={() => setIsGuiaOpen(false)}
        data={GUIA_MAPEAMENTO_CONTABIL}
      />
    </>
  );

  if (isStandalone) {
    return (
      <AppShell
        title="Mapeamento Contábil"
        subtitle="Associação de categorias operacionais às contas de Débito e Crédito para partidas dobradas"
        backPath={isContador ? `/relatorios/integracao?empresa_id=${activeEmpresaId}&competencia=${activeCompetencia}` : `/relatorios?empresa_id=${activeEmpresaId}&competencia=${activeCompetencia}`}
      >
        <div className="space-y-4 pb-16">
          {/* BARRA SUPERIOR DE COMANDOS */}
          <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {empresas.length > 0 && (
                <div className="w-64">
                  <Select value={activeEmpresaId} onValueChange={handleEmpresaChange}>
                    <SelectTrigger className="h-9 text-sm bg-background/60 font-medium">
                      <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Selecione a Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-sm">
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeCompetencia && (
                <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-mono bg-muted/40 border-border/60">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Competência: {activeCompetencia}
                </Badge>
              )}

              <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-normal bg-muted/40 border-border/60">
                <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                De-Para Oficial
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/50"
                onClick={() => setIsGuiaOpen(true)}
              >
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>Guia de Uso</span>
              </Button>

              <FerramentasContabeisMenu
                empresaId={activeEmpresaId}
                competencia={activeCompetencia}
              />
            </div>
          </header>

          {renderContent()}
        </div>
      </AppShell>
    );
  }

  return (
    <div className="space-y-4">
      {renderContent()}
    </div>
  );
};

export default MapeamentoContabil;
