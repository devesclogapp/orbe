import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Banknote, Loader2, FileCheck2, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { CnabRetornoService, CNABService } from "@/services/financial.service";

const statusBadge = (status: string) => {
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

const RetornoBancario = () => {
  const [banco, setBanco] = useState("001");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const { data: historico = [] } = useQuery({
    queryKey: ["cnab-retorno-historico"],
    queryFn: () => CnabRetornoService.listarHistorico(),
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
      toast.success("Retorno CNAB processado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["cnab-retorno-historico"] });
    } catch (error: any) {
      toast.error(error?.message || "Falha ao processar retorno bancario.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell title="Retorno Bancario">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-1 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Banknote className="w-4 h-4" /> Configuracao
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Banco do arquivo</label>
                <Select value={banco} onValueChange={setBanco}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="001">001 - Banco do Brasil</SelectItem>
                    <SelectItem value="237">237 - Bradesco</SelectItem>
                    <SelectItem value="033">033 - Santander</SelectItem>
                    <SelectItem value="341">341 - Itau</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.ret"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">
                    O parser valida a estrutura CNAB240, interpreta ocorrencias do BB e cruza o retorno com remessas internas sem aplicar baixa automatica.
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFile ? "Trocar arquivo" : "Selecionar arquivo"}
                  </Button>
                  <div className="text-xs text-muted-foreground break-all">
                    {selectedFile ? selectedFile.name : "Nenhum arquivo selecionado"}
                  </div>
                  <Button className="w-full" disabled={!selectedFile || isProcessing} onClick={handleProcessar}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processando retorno...
                      </>
                    ) : (
                      "Processar retorno"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 md:col-span-2 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Resumo do ultimo processamento</h3>
                <p className="text-sm text-muted-foreground">
                  O retorno fica salvo com hash, auditoria e match controlado com remessas, lotes e faturas.
                </p>
              </div>
              {resultado?.remessaRelacionada?.nome_arquivo && (
                <Badge variant="outline" className="font-mono">
                  Remessa: {resultado.remessaRelacionada.nome_arquivo}
                </Badge>
              )}
            </div>

            {!resultado ? (
              <div className="border-2 border-dashed border-border/50 rounded-2xl p-10 text-center text-muted-foreground">
                Selecione um arquivo de retorno para validar, interpretar ocorrencias e salvar o historico.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground uppercase">Processados</div>
                    <div className="mt-2 text-2xl font-bold">{resultado.resumo.totalProcessado}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" /> Pagos
                    </div>
                    <div className="mt-2 text-2xl font-bold text-green-700">{resultado.resumo.pagos}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Rejeitados
                    </div>
                    <div className="mt-2 text-2xl font-bold text-red-700">{resultado.resumo.rejeitados}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-amber-600" /> Divergentes
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-700">{resultado.resumo.divergentes}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-blue-600" /> Pendentes
                    </div>
                    <div className="mt-2 text-2xl font-bold text-blue-700">
                      {resultado.resumo.pendentes + resultado.resumo.desconhecidos}
                    </div>
                  </Card>
                </div>

                {resultado.parseResult.ocorrenciasArquivo?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {resultado.parseResult.ocorrenciasArquivo.map((item: any, index: number) => (
                      <div key={`${item.codigo}-${index}`}>
                        Linha {item.linha || "-"}: {item.mensagem}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {resultado?.itens?.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Favorecido</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Valor esperado</TableHead>
                  <TableHead className="text-right">Valor retornado</TableHead>
                  <TableHead>Ocorrencia</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.itens.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome_favorecido || "-"}</TableCell>
                    <TableCell>{item.documento_favorecido || "-"}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valor_esperado || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valor_retornado || 0))}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div className="font-semibold">{item.codigo_ocorrencia || "-"}</div>
                        <div className="text-muted-foreground">{item.descricao_ocorrencia || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Historico recente</h3>
          <div className="space-y-3">
            {historico.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum retorno processado ainda.</div>
            ) : (
              historico.map((arquivo: any) => (
                <div key={arquivo.id} className="rounded-xl border border-border p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{arquivo.nome_arquivo}</div>
                    <div className="text-xs text-muted-foreground">
                      Processado em {new Date(arquivo.data_processamento || arquivo.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Itens: {arquivo.total_processados}</Badge>
                    <Badge variant="outline">Pagos: {arquivo.total_sucesso}</Badge>
                    <Badge variant="outline">Rejeitados: {arquivo.total_rejeitado}</Badge>
                    <Badge variant="outline">Divergentes: {arquivo.total_divergente}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default RetornoBancario;
