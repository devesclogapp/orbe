import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  History,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CentralBancariaDiaristas } from "./Financeiro/CentralBancariaDiaristas";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { CNABService, ContaBancariaService, LoteRemessaService } from "@/services/financial.service";
import { supabase } from "@/lib/supabase";

const statusBadge = (status: string) => {
  switch (status) {
    case "gerado":
      return <Badge className="bg-info-soft text-info-strong">Gerado</Badge>;
    case "enviado":
      return <Badge className="bg-warning-soft text-warning-strong">Enviado</Badge>;
    case "processado":
      return <Badge className="bg-success-soft text-success-strong">Processado</Badge>;
    case "erro":
      return <Badge className="bg-destructive-soft text-destructive-strong">Erro</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const CentralBancaria = () => {
  const navigate = useNavigate();
  const [competencia, setCompetencia] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [banco, setBanco] = useState("001");
  const [isUploading, setIsUploading] = useState(false);
  const [retornoResult, setRetornoResult] = useState<any>(null);
  const [historySearch, setHistorySearch] = useState("");

  const { data: competencias = [], isLoading: loadingCompetencias } = useQuery<any[]>({
    queryKey: ["financeiro-competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_competencias")
        .select("competencia, status")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: contas = [], isLoading: loadingContas } = useQuery<any[]>({
    queryKey: ["contas", empresaId],
    queryFn: () => (empresaId ? ContaBancariaService.getByEmpresa(empresaId) : Promise.resolve([])),
    enabled: !!empresaId,
  });

  const { data: remessas = [], isLoading: loadingRemessas } = useQuery<any[]>({
    queryKey: ["lotes-remessa"],
    queryFn: () => LoteRemessaService.getFullHistory(),
  });

  const formattedCompetencias = useMemo(() => {
    const unique = competencias.filter(
      (value, index, array) => array.findIndex((item) => item.competencia === value.competencia) === index
    );
    return unique.map((item) => ({
      value: item.competencia,
      label: format(new Date(`${item.competencia}T12:00:00`), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
    }));
  }, [competencias]);

  const filteredRemessas = useMemo(
    () =>
      remessas.filter((remessa) => {
        const matchesSearch =
          !historySearch ||
          remessa.id.toLowerCase().includes(historySearch.toLowerCase()) ||
          String(remessa.competencia).toLowerCase().includes(historySearch.toLowerCase());
        const matchesCompetencia = !competencia || remessa.competencia === competencia;
        return matchesSearch && matchesCompetencia;
      }),
    [remessas, historySearch, competencia]
  );

  const totalRemessas = remessas.length;
  const totalTitulos = remessas.reduce((acc, remessa) => acc + Number(remessa.quantidade_titulos || 0), 0);
  const totalValor = remessas.reduce((acc, remessa) => acc + Number(remessa.valor_total || 0), 0);
  const remessasComErro = remessas.filter((remessa) => remessa.status === "erro").length;

  const handleValidate = async () => {
    if (!competencia) return toast.error("Selecione a competência");
    if (!empresaId) return toast.error("Selecione uma empresa");

    setIsValidating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result = await CNABService.validateRemessa(competencia, empresaId);
      setValidation(result);
      if (result.isValid) {
        toast.success("Remessa validada com sucesso");
      } else {
        toast.warning("Inconsistências encontradas na remessa");
      }
    } catch (error) {
      toast.error("Erro ao validar remessa");
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerate = async () => {
    if (!contaId) return toast.error("Selecione a conta bancária");
    setIsGenerating(true);
    try {
      const result = await CNABService.generateRemessa({ competencia, empresaId, contaId });
      toast.success(`CNAB gerado: ${result.fileName}`);

      const element = document.createElement("a");
      const file = new Blob([result.content], { type: "text/plain" });
      element.href = URL.createObjectURL(file);
      element.download = result.fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      toast.error("Erro ao gerar arquivo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await CNABService.processRetorno(file, banco);
      setRetornoResult(result);
      toast.success("Arquivo processado com sucesso");
    } catch (error) {
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppShell
      title="Pagamentos e Remessas"
      subtitle="Remessa, histórico e retorno no mesmo fluxo operacional"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Ciclo bancário consolidado</h2>
              <p className="text-sm text-muted-foreground">
                Prepare, valide, gere, acompanhe e processe retorno sem trocar de módulo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/financeiro")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Voltar para financeiro
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/financeiro/remessa/historico")}>
                <History className="h-4 w-4 mr-2" />
                Histórico detalhado
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Remessas" value={totalRemessas.toString()} icon={FileText} />
          <MetricCard label="Títulos" value={totalTitulos.toString()} icon={FileCheck} />
          <MetricCard
            label="Valor total"
            value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)}
            icon={Banknote}
            accent
          />
          <MetricCard label="Lotes com erro" value={remessasComErro.toString()} icon={AlertCircle} />
        </div>

        <Tabs defaultValue="remessa" className="space-y-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
            <TabsTrigger value="remessa">Remessa</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="retorno">Retorno</TabsTrigger>
            <TabsTrigger value="diaristas">Pgto Diaristas</TabsTrigger>
          </TabsList>

          <TabsContent value="remessa">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-5 p-8 space-y-6 shadow-sm border-border bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Preparar lote</h3>
                    <p className="text-xs text-muted-foreground">Defina competência, empresa e conta de origem</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Competência
                    </label>
                    <Select value={competencia} onValueChange={(value) => { setCompetencia(value); setValidation(null); }}>
                      <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                        <SelectValue placeholder={loadingCompetencias ? "Carregando..." : "Selecione o mês"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formattedCompetencias.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> Empresa
                    </label>
                    <Select value={empresaId} onValueChange={(value) => { setEmpresaId(value); setValidation(null); setContaId(""); }}>
                      <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                        <SelectValue placeholder={loadingEmpresas ? "Carregando..." : "Selecione a empresa"} />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Conta bancária
                    </label>
                    <Select value={contaId} onValueChange={setContaId} disabled={!empresaId}>
                      <SelectTrigger className="h-11 bg-muted/20 border-border/50">
                        <SelectValue placeholder={loadingContas ? "Carregando..." : "Selecione a conta"} />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma conta cadastrada</div>
                        ) : (
                          contas.map((conta) => (
                            <SelectItem key={conta.id} value={conta.id}>
                              {conta.banco} - Ag: {conta.agencia} Cc: {conta.conta}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full h-11 font-semibold" onClick={handleValidate} disabled={isValidating || !competencia || !empresaId}>
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Validando...
                      </>
                    ) : (
                      "Validar remessa"
                    )}
                  </Button>
                </div>
              </Card>

              <Card
                className={cn(
                  "lg:col-span-7 p-8 shadow-sm transition-all duration-300",
                  !validation
                    ? "bg-muted/10 border-dashed border-border"
                    : validation.isValid
                      ? "bg-success/5 border-success/20"
                      : "bg-destructive/5 border-destructive/20"
                )}
              >
                <div className="flex items-center gap-2 mb-8 border-b border-border/50 pb-4">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Resumo e validação</h3>
                </div>

                {!validation ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                      <FileText className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-[280px]">
                      Valide a remessa para liberar a geração do arquivo CNAB.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                          Quantidade de títulos
                        </span>
                        <span className="text-3xl font-extrabold text-foreground">{validation.summary.totalItems}</span>
                      </div>
                      <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                          Valor total
                        </span>
                        <span className="text-3xl font-extrabold text-primary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(validation.summary.totalValue)}
                        </span>
                      </div>
                    </div>

                    {validation.isValid ? (
                      <div className="flex items-start gap-4 bg-card p-4 rounded-lg border border-success/20">
                        <div className="p-2 bg-success/10 rounded-full">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-success">Validação concluída</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Todos os requisitos foram atendidos para a geração do CNAB.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {validation.errors.map((error: string, index: number) => (
                          <div key={index} className="flex items-start gap-4 bg-card p-4 rounded-lg border border-destructive/20">
                            <div className="p-2 bg-destructive/10 rounded-full">
                              <AlertCircle className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-destructive">Inconsistência identificada</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {validation.isValid && (
                      <div className="pt-6 border-t border-border border-dashed flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-muted-foreground flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
                          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                          Pronto para gerar arquivo
                        </div>
                        <Button className="font-bold h-12 px-8" onClick={handleGenerate} disabled={isGenerating || !contaId}>
                          {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Gerar arquivo CNAB
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico">
            <div className="space-y-4">
              <Card className="p-4 border-border bg-card">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md flex-1 max-w-md border border-border">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por lote ou competência..."
                      className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium"
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 border-border font-bold" onClick={() => setHistorySearch("")}>
                    <Filter className="w-4 h-4" /> Limpar filtros
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="esc-table-header">
                    <tr className="text-left">
                      <th className="px-5 h-11 font-medium">Lote ID</th>
                      <th className="px-3 h-11 font-medium">Competência</th>
                      <th className="px-3 h-11 font-medium">Data emissão</th>
                      <th className="px-3 h-11 font-medium">Conta origem</th>
                      <th className="px-3 h-11 font-medium text-center">Títulos</th>
                      <th className="px-3 h-11 font-medium text-right">Valor total</th>
                      <th className="px-3 h-11 font-medium text-center">Status</th>
                      <th className="px-5 h-11 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRemessas ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                          Carregando histórico...
                        </td>
                      </tr>
                    ) : filteredRemessas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-muted-foreground italic">
                          Nenhuma remessa encontrada para os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      filteredRemessas.map((remessa) => (
                        <tr key={remessa.id} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[56px] font-mono text-xs text-muted-foreground/80">{remessa.id.substring(0, 8)}...</td>
                          <td className="px-3 font-bold text-foreground">{remessa.competencia}</td>
                          <td className="px-3 text-sm text-muted-foreground">{new Date(remessa.created_at).toLocaleDateString("pt-BR")}</td>
                          <td className="px-3">
                            <div className="text-xs">
                              <p className="font-bold text-foreground">{remessa.contas_bancarias?.banco}</p>
                              <p className="text-muted-foreground/70">
                                Ag: {remessa.contas_bancarias?.agencia} C: {remessa.contas_bancarias?.conta}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 text-center font-medium">{remessa.quantidade_titulos}</td>
                          <td className="px-3 text-right font-black text-foreground">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(remessa.valor_total || 0)}
                          </td>
                          <td className="px-3 text-center">{statusBadge(remessa.status || "gerado")}</td>
                          <td className="px-5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="retorno">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 md:col-span-1 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> Configuração
                    </h3>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Banco do arquivo</label>
                      <Select value={banco} onValueChange={setBanco}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o banco" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="001">001 - Banco do Brasil</SelectItem>
                          <SelectItem value="237">237 - Bradesco</SelectItem>
                          <SelectItem value="033">033 - Santander</SelectItem>
                          <SelectItem value="341">341 - Itaú</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4">
                      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border border-dashed border-border/50">
                        O sistema aceita arquivos CNAB 240 ou 400. Verifique o banco selecionado antes do upload.
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-10 md:col-span-2 border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-center space-y-4">
                  {isUploading ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-8 h-8 animate-bounce" />
                      </div>
                      <h3 className="text-lg font-semibold">Processando arquivo...</h3>
                      <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
                    </div>
                  ) : !retornoResult ? (
                    <>
                      <div className="w-16 h-16 bg-muted/50 text-muted-foreground rounded-full flex items-center justify-center">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Importar arquivo retorno</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          Arraste o arquivo ou clique no botão abaixo para selecionar.
                        </p>
                      </div>
                      <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} accept=".ret,.txt" />
                      <Button asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">Selecionar arquivo</label>
                      </Button>
                    </>
                  ) : (
                    <div className="w-full space-y-6">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground">Processamento concluído</h3>
                          <p className="text-sm text-muted-foreground">
                            ID do lote: <span className="font-mono text-xs">{retornoResult.loteId.substring(0, 8)}...</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Títulos lidos</span>
                          <span className="text-xl font-bold">{retornoResult.resumo.totalProcessado}</span>
                        </div>
                        <div className="p-4 bg-success/10 rounded-lg text-center border border-success/20">
                          <span className="text-[10px] text-success-strong uppercase font-bold block mb-1">Pagos/OK</span>
                          <span className="text-xl font-bold text-success-strong">{retornoResult.resumo.pagos}</span>
                        </div>
                        <div className="p-4 bg-destructive/10 rounded-lg text-center border border-destructive/20">
                          <span className="text-[10px] text-destructive-strong uppercase font-bold block mb-1">Rejeitados</span>
                          <span className="text-xl font-bold text-destructive-strong">{retornoResult.resumo.rejeitados}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border flex justify-between items-center">
                        <Button variant="ghost" className="text-muted-foreground" onClick={() => setRetornoResult(null)}>
                          Limpar e novo upload
                        </Button>
                        <Button variant="outline">Ver títulos</Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="diaristas">
            <div className="bg-card text-card-foreground border border-border shadow-sm rounded-xl overflow-hidden">
              <CentralBancariaDiaristas />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default CentralBancaria;
