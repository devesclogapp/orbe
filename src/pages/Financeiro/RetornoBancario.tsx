import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  RotateCcw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/contexts/TenantContext";
import {
  CNABService,
  ConciliacaoFinanceira,
  ConciliacaoService,
  ItemRetornoConciliacao,
  StatusConciliacaoFinanceira,
} from "@/services/financial.service";
import {
  CnabRetornoArquivo,
  CnabRetornoService,
  ProcessarRetornoResult,
} from "@/services/cnab/cnabRetorno.service";
import { toast } from "sonner";

type FiltroConciliacao = "todos" | "pendente" | StatusConciliacaoFinanceira;
type AcaoConciliacao = "conciliado" | "divergente" | "rejeitado_banco";

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const getBancoStatusBadge = (status?: string | null) => {
  switch (status) {
    case "pago":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Pago</Badge>;
    case "rejeitado":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Rejeitado</Badge>;
    case "divergente":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Divergente</Badge>;
    case "pendente":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Pendente</Badge>;
    default:
      return <Badge variant="secondary">Desconhecido</Badge>;
  }
};

const getConciliacaoBadge = (status?: StatusConciliacaoFinanceira | null) => {
  switch (status) {
    case "conciliado":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Conciliado</Badge>;
    case "divergente":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Divergente</Badge>;
    case "rejeitado_banco":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Rejeitado</Badge>;
    case "revertido":
      return <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-none">Revertido</Badge>;
    case "aguardando_conciliacao":
    default:
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Pendente</Badge>;
  }
};

const getLatestConciliacao = (item: ItemRetornoConciliacao): ConciliacaoFinanceira | null => {
  const rows = Array.isArray(item.financeiro_conciliacoes) ? [...item.financeiro_conciliacoes] : [];
  if (!rows.length) return null;
  return rows.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;
};

const RetornoBancario = () => {
  const { role } = useTenant();
  const canConciliar = role === "admin" || role === "financeiro";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [banco, setBanco] = useState("001");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<ProcessarRetornoResult | null>(null);
  const [arquivoSelecionadoId, setArquivoSelecionadoId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroConciliacao>("pendente");
  const [search, setSearch] = useState("");
  const [dialogAcao, setDialogAcao] = useState<{
    open: boolean;
    item: ItemRetornoConciliacao | null;
    acao: AcaoConciliacao;
    observacao: string;
    valorConciliado: string;
  }>({
    open: false,
    item: null,
    acao: "conciliado",
    observacao: "",
    valorConciliado: "",
  });
  const [dialogReversao, setDialogReversao] = useState<{
    open: boolean;
    conciliacao: ConciliacaoFinanceira | null;
    motivo: string;
  }>({
    open: false,
    conciliacao: null,
    motivo: "",
  });

  const { data: historico = [] } = useQuery<CnabRetornoArquivo[]>({
    queryKey: ["cnab-retorno-historico"],
    queryFn: () => CnabRetornoService.listarHistorico(),
  });

  const arquivoSelecionado = useMemo(() => {
    const arquivoHistorico = historico.find((item) => item.id === arquivoSelecionadoId);
    if (arquivoHistorico) return arquivoHistorico;
    if (resultado?.arquivo?.id === arquivoSelecionadoId) return resultado.arquivo;
    return arquivoHistorico ?? resultado?.arquivo ?? null;
  }, [arquivoSelecionadoId, historico, resultado]);

  const arquivoAtivoId = arquivoSelecionado?.id ?? null;

  const { data: itensRetorno = [] } = useQuery({
    queryKey: ["itens-retorno", arquivoAtivoId, filtroStatus],
    queryFn: () => ConciliacaoService.getItensRetorno(arquivoAtivoId as string, filtroStatus),
    enabled: !!arquivoAtivoId,
  });

  const { data: conciliacoes = [] } = useQuery({
    queryKey: ["conciliacoes-arquivo", arquivoAtivoId],
    queryFn: () => ConciliacaoService.getConciliacoesByArquivo(arquivoAtivoId as string),
    enabled: !!arquivoAtivoId,
  });

  const conciliarMutation = useMutation({
    mutationFn: (params: { retornoItemId: string; valorConciliado: number; statusConciliacao: AcaoConciliacao; observacao?: string }) =>
      ConciliacaoService.conciliarItem(params),
    onSuccess: () => {
      toast.success("Baixa revisada com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["itens-retorno", arquivoAtivoId] });
      void queryClient.invalidateQueries({ queryKey: ["conciliacoes-arquivo", arquivoAtivoId] });
      void queryClient.invalidateQueries({ queryKey: ["cnab-retorno-historico"] });
      setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "", valorConciliado: "" });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Erro ao registrar conciliação.")),
  });

  const reverterMutation = useMutation({
    mutationFn: (params: { conciliacaoId: string; motivo: string }) =>
      ConciliacaoService.reverterConciliacao(params.conciliacaoId, params.motivo),
    onSuccess: () => {
      toast.success("Conciliação revertida com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["itens-retorno", arquivoAtivoId] });
      void queryClient.invalidateQueries({ queryKey: ["conciliacoes-arquivo", arquivoAtivoId] });
      void queryClient.invalidateQueries({ queryKey: ["cnab-retorno-historico"] });
      setDialogReversao({ open: false, conciliacao: null, motivo: "" });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Erro ao reverter conciliação.")),
  });

  const handleProcessar = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo .txt ou .ret para processar.");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await CNABService.processRetorno(selectedFile, banco);
      setResultado(response);
      setArquivoSelecionadoId(response.arquivo.id);
      setFiltroStatus("pendente");
      toast.success("Retorno CNAB processado com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["cnab-retorno-historico"] });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Falha ao processar retorno bancário."));
    } finally {
      setIsProcessing(false);
    }
  };

  const openAcaoDialog = (item: ItemRetornoConciliacao, acao: AcaoConciliacao) => {
    const valorBase =
      acao === "rejeitado_banco"
        ? "0.00"
        : Number(item.valor_retornado ?? item.valor_esperado ?? 0).toFixed(2);

    setDialogAcao({
      open: true,
      item,
      acao,
      observacao: item.observacao_conciliacao || "",
      valorConciliado: valorBase,
    });
  };

  const submitAcaoDialog = () => {
    if (!dialogAcao.item) return;

    const observacao = dialogAcao.observacao.trim();
    if ((dialogAcao.acao === "divergente" || dialogAcao.acao === "rejeitado_banco") && !observacao) {
      toast.error("Informe a observação obrigatória para divergência ou rejeição.");
      return;
    }

    const valorConciliado = Number(dialogAcao.valorConciliado.replace(",", "."));
    if (Number.isNaN(valorConciliado)) {
      toast.error("Informe um valor conciliado válido.");
      return;
    }

    conciliarMutation.mutate({
      retornoItemId: dialogAcao.item.id,
      statusConciliacao: dialogAcao.acao,
      valorConciliado,
      observacao: observacao || undefined,
    });
  };

  const submitReversaoDialog = () => {
    if (!dialogReversao.conciliacao) return;

    const motivo = dialogReversao.motivo.trim();
    if (!motivo) {
      toast.error("Informe o motivo da reversão.");
      return;
    }

    reverterMutation.mutate({
      conciliacaoId: dialogReversao.conciliacao.id,
      motivo,
    });
  };

  const itensFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return itensRetorno;

    return itensRetorno.filter((item) => {
      const nome = String(item.nome_favorecido || "").toLowerCase();
      const documento = String(item.documento_favorecido || "").toLowerCase();
      const ocorrencia = String(item.descricao_ocorrencia || "").toLowerCase();
      return nome.includes(term) || documento.includes(term) || ocorrencia.includes(term);
    });
  }, [itensRetorno, search]);

  const resumoConciliacao = useMemo(() => {
    return itensRetorno.reduce(
      (acc, item) => {
        const latest = getLatestConciliacao(item);
        const valorBase = Number(latest?.valor_conciliado ?? item.valor_retornado ?? item.valor_esperado ?? 0);

        if (item.status_conciliacao === "conciliado") acc.conciliado += valorBase;
        if (item.status_conciliacao === "divergente") acc.divergente += valorBase;
        if (item.status_conciliacao === "rejeitado_banco") acc.rejeitado += valorBase;
        if (item.status_conciliacao === "revertido") acc.revertido += valorBase;
        if (item.status_conciliacao === "aguardando_conciliacao") acc.pendente += valorBase;

        return acc;
      },
      {
        conciliado: 0,
        pendente: 0,
        divergente: 0,
        rejeitado: 0,
        revertido: 0,
      }
    );
  }, [itensRetorno]);

  return (
    <AppShell title="Retorno Bancário">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="space-y-6 p-6 xl:col-span-1">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                <Banknote className="h-4 w-4" /> Processar retorno
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

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.ret"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />

              <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">
                  O parser valida o CNAB240, interpreta ocorrências do BB, cruza com remessas internas e mantém a baixa
                  definitiva bloqueada até aprovação humana.
                </p>

                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {selectedFile ? "Trocar arquivo" : "Selecionar arquivo"}
                </Button>

                <div className="break-all text-xs text-muted-foreground">
                  {selectedFile ? selectedFile.name : "Nenhum arquivo selecionado"}
                </div>

                <Button className="w-full" disabled={!selectedFile || isProcessing} onClick={handleProcessar}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando retorno...
                    </>
                  ) : (
                    "Processar retorno"
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background p-4">
              <h4 className="text-sm font-semibold">Trava operacional</h4>
              <p className="mt-2 text-xs text-muted-foreground">
                Mesmo com retorno pago pelo banco, o sistema não faz baixa automática. Itens conciliados não podem ser
                conciliados novamente sem reversão autorizada.
              </p>
            </div>

            {!canConciliar && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Seu perfil pode consultar o retorno, mas a aprovação, rejeição e reversão da baixa exigem perfil
                `admin` ou `financeiro`.
              </div>
            )}
          </Card>

          <Card className="space-y-5 p-6 xl:col-span-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Resumo do arquivo selecionado</h3>
                <p className="text-sm text-muted-foreground">
                  O retorno fica salvo com hash, vínculo com remessa e trilha de auditoria antes de qualquer baixa
                  financeira definitiva.
                </p>
              </div>
              {arquivoSelecionado?.nome_arquivo && (
                <Badge variant="outline" className="font-mono">
                  {arquivoSelecionado.nome_arquivo}
                </Badge>
              )}
            </div>

            {!arquivoSelecionado ? (
              <div className="rounded-2xl border-2 border-dashed border-border/60 p-10 text-center text-muted-foreground">
                Processe um retorno ou selecione um item do histórico para iniciar a revisão financeira.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Card className="p-4">
                    <div className="text-xs uppercase text-muted-foreground">Processados</div>
                    <div className="mt-2 text-2xl font-bold">{arquivoSelecionado.total_processados ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Pagos banco
                    </div>
                    <div className="mt-2 text-2xl font-bold text-green-700">{arquivoSelecionado.total_sucesso ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-red-600" /> Rejeitados
                    </div>
                    <div className="mt-2 text-2xl font-bold text-red-700">{arquivoSelecionado.total_rejeitado ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <FileCheck2 className="h-4 w-4 text-amber-600" /> Divergentes
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-700">{arquivoSelecionado.total_divergente ?? 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <Clock3 className="h-4 w-4 text-blue-600" /> Pendências
                    </div>
                    <div className="mt-2 text-2xl font-bold text-blue-700">{arquivoSelecionado.total_pendente ?? 0}</div>
                  </Card>
                </div>

                {resultado?.arquivo?.id === arquivoSelecionado?.id && resultado?.parseResult?.ocorrenciasArquivo?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {resultado.parseResult.ocorrenciasArquivo.map((item, index) => (
                      <div key={`${item.codigo}-${index}`}>
                        Linha {item.linha || "-"}: {item.mensagem}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {arquivoAtivoId && (
          <Card className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <FileCheck2 className="h-5 w-5 text-primary" /> Revisão Financeira
                </h3>
                <p className="text-sm text-muted-foreground">
                  A baixa só acontece após revisão manual. Toda decisão fica rastreável e reversível para perfis
                  autorizados.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[520px]">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs uppercase text-emerald-700">Total conciliado</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-800">{formatCurrency(resumoConciliacao.conciliado)}</div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs uppercase text-blue-700">Total pendente</div>
                  <div className="mt-1 text-lg font-semibold text-blue-800">{formatCurrency(resumoConciliacao.pendente)}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs uppercase text-amber-700">Total divergente</div>
                  <div className="mt-1 text-lg font-semibold text-amber-800">{formatCurrency(resumoConciliacao.divergente)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
              <Select value={filtroStatus} onValueChange={(value) => setFiltroStatus(value as FiltroConciliacao)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar conciliação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="conciliado">Conciliados</SelectItem>
                  <SelectItem value="divergente">Divergentes</SelectItem>
                  <SelectItem value="rejeitado_banco">Rejeitados</SelectItem>
                  <SelectItem value="revertido">Revertidos</SelectItem>
                </SelectContent>
              </Select>

              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="text-xs uppercase text-red-700">Total rejeitado</div>
                <div className="mt-1 text-lg font-semibold text-red-800">{formatCurrency(resumoConciliacao.rejeitado)}</div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por favorecido, documento ou ocorrência"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead>Favorecido</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Retornado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Status banco</TableHead>
                    <TableHead>Conciliação</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum item encontrado para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itensFiltrados.map((item) => {
                      const valorEsperado = Number(item.valor_esperado || 0);
                      const valorRetornado = Number(item.valor_retornado || 0);
                      const diferenca = valorRetornado - valorEsperado;
                      const latest = getLatestConciliacao(item);
                      const podeReverter = canConciliar && latest && latest.status !== "revertido" && latest.reversivel;
                      const mostrarAcoesPrimarias =
                        canConciliar && (item.status_conciliacao === "aguardando_conciliacao" || item.status_conciliacao === "revertido");

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-[220px]">
                            <div className="font-medium">{item.nome_favorecido || "Sem identificação"}</div>
                            <div className="text-xs text-muted-foreground">{item.documento_favorecido || "Documento não encontrado"}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(valorEsperado)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(valorRetornado)}</TableCell>
                          <TableCell className="text-right">
                            <span className={diferenca === 0 ? "text-emerald-700" : diferenca > 0 ? "text-amber-700" : "text-red-700"}>
                              {formatCurrency(diferenca)}
                            </span>
                          </TableCell>
                          <TableCell>{getBancoStatusBadge(item.status)}</TableCell>
                          <TableCell>{getConciliacaoBadge(item.status_conciliacao)}</TableCell>
                          <TableCell className="max-w-[240px]">
                            <div className="line-clamp-2 text-sm text-muted-foreground">
                              {latest?.observacao || item.observacao_conciliacao || "Sem observação"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              {mostrarAcoesPrimarias && (
                                <>
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openAcaoDialog(item, "conciliado")}>
                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-amber-700" onClick={() => openAcaoDialog(item, "divergente")}>
                                    <ArrowRightLeft className="mr-1 h-4 w-4" /> Divergência
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-red-700" onClick={() => openAcaoDialog(item, "rejeitado_banco")}>
                                    <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                                  </Button>
                                </>
                              )}

                              {podeReverter && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDialogReversao({ open: true, conciliacao: latest, motivo: "" })}
                                >
                                  <RotateCcw className="mr-1 h-4 w-4" /> Reverter
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Histórico de retornos</h3>
                <p className="text-sm text-muted-foreground">Selecione um arquivo anterior para revisar ou continuar conciliando.</p>
              </div>
            </div>

            <div className="space-y-3">
              {historico.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum retorno processado ainda.</div>
              ) : (
                historico.map((arquivo) => {
                  const ativo = arquivo.id === arquivoAtivoId;
                  return (
                    <button
                      key={arquivo.id}
                      type="button"
                      onClick={() => setArquivoSelecionadoId(arquivo.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        ativo ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium">{arquivo.nome_arquivo}</div>
                          <div className="text-xs text-muted-foreground">
                            Processado em {formatDateTime(arquivo.data_processamento || arquivo.created_at)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Itens: {arquivo.total_processados}</Badge>
                          <Badge variant="outline">Pagos: {arquivo.total_sucesso}</Badge>
                          <Badge variant="outline">Rejeitados: {arquivo.total_rejeitado}</Badge>
                          <Badge variant="outline">Divergentes: {arquivo.total_divergente}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Auditoria de conciliações</h3>
              <p className="text-sm text-muted-foreground">
                Aprovação, rejeição, divergência e reversão ficam registradas com data, usuário e observação.
              </p>
            </div>

            <div className="space-y-3">
              {!arquivoAtivoId ? (
                <div className="text-sm text-muted-foreground">Selecione um arquivo para ver as decisões de conciliação.</div>
              ) : conciliacoes.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma conciliação registrada para este arquivo.</div>
              ) : (
                conciliacoes.map((conciliacao) => (
                  <div key={conciliacao.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">
                          {conciliacao.cnab_retorno_itens?.nome_favorecido || "Favorecido não identificado"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {conciliacao.cnab_retorno_itens?.documento_favorecido || "Documento não informado"} ·{" "}
                          {formatDateTime(conciliacao.data_conciliacao || conciliacao.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getConciliacaoBadge(conciliacao.status)}
                        <Badge variant="outline">{formatCurrency(conciliacao.valor_conciliado)}</Badge>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      {conciliacao.observacao || conciliacao.motivo_reversao || "Sem observação registrada."}
                    </div>

                    {conciliacao.status === "revertido" && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Revertido em {formatDateTime(conciliacao.revertido_em)}.
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogAcao.open}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "", valorConciliado: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Registrar revisão financeira</DialogTitle>
            <DialogDescription>
              Compare o valor esperado com o retornado, informe a observação e confirme a ação de baixa.
            </DialogDescription>
          </DialogHeader>

          {dialogAcao.item && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs uppercase text-muted-foreground">Esperado</div>
                  <div className="mt-1 font-semibold">{formatCurrency(dialogAcao.item.valor_esperado)}</div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs uppercase text-muted-foreground">Retornado</div>
                  <div className="mt-1 font-semibold">{formatCurrency(dialogAcao.item.valor_retornado)}</div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs uppercase text-muted-foreground">Diferença</div>
                  <div className="mt-1 font-semibold">
                    {formatCurrency(Number(dialogAcao.item.valor_retornado || 0) - Number(dialogAcao.item.valor_esperado || 0))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ação</label>
                <Select
                  value={dialogAcao.acao}
                  onValueChange={(value) =>
                    setDialogAcao((prev) => ({
                      ...prev,
                      acao: value as AcaoConciliacao,
                      valorConciliado:
                        value === "rejeitado_banco"
                          ? "0.00"
                          : Number(prev.item?.valor_retornado ?? prev.item?.valor_esperado ?? 0).toFixed(2),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conciliado">Aprovar baixa</SelectItem>
                    <SelectItem value="divergente">Marcar divergência</SelectItem>
                    <SelectItem value="rejeitado_banco">Rejeitar baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Valor conciliado</label>
                <Input
                  type="number"
                  step="0.01"
                  value={dialogAcao.valorConciliado}
                  onChange={(event) => setDialogAcao((prev) => ({ ...prev, valorConciliado: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observação</label>
                <Textarea
                  value={dialogAcao.observacao}
                  onChange={(event) => setDialogAcao((prev) => ({ ...prev, observacao: event.target.value }))}
                  placeholder="Explique a decisão, divergência encontrada ou observação operacional."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "", valorConciliado: "" })}>
              Cancelar
            </Button>
            <Button onClick={submitAcaoDialog} disabled={conciliarMutation.isPending}>
              {conciliarMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar revisão"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogReversao.open}
        onOpenChange={(open) => {
          if (!open) {
            setDialogReversao({ open: false, conciliacao: null, motivo: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Reverter conciliação</DialogTitle>
            <DialogDescription>
              A reversão exige justificativa e reabre o item para nova revisão manual sem apagar o histórico anterior.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo da reversão</label>
            <Textarea
              value={dialogReversao.motivo}
              onChange={(event) => setDialogReversao((prev) => ({ ...prev, motivo: event.target.value }))}
              placeholder="Descreva por que a conciliação precisa ser revertida."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReversao({ open: false, conciliacao: null, motivo: "" })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitReversaoDialog} disabled={reverterMutation.isPending}>
              {reverterMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revertendo...
                </>
              ) : (
                "Confirmar reversão"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default RetornoBancario;
