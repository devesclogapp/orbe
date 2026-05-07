import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Search, Filter, Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CnabRemessaArquivoService } from "@/services/financial.service";
import { CNAB240BBWriter } from "@/services/cnab/CNAB240BBWriter";

const HistoricoRemessas = () => {
  const { data: remessas, isLoading } = useQuery({
    queryKey: ["cnab-remessas-arquivos"],
    queryFn: () => CnabRemessaArquivoService.listarHistorico()
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "gerado": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Gerado</Badge>;
      case "baixado": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Baixado</Badge>;
      case "enviado_manual": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Enviado ao Banco</Badge>;
      case "homologado": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Homologado</Badge>;
      case "erro_homologacao": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Erro Homologação</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleRedownload = async (arquivoId: string) => {
    const result = await CNAB240BBWriter.redownload(arquivoId);
    if (!result) return;

    const element = document.createElement("a");
    const file = new Blob([result.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = result.fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <AppShell title="Histórico de Remessas">
      <div className="space-y-4">
        <Card className="p-4 border-border bg-card">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md flex-1 max-w-md border border-border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por arquivo ou competência..."
                className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-border font-bold">
                <Filter className="w-4 h-4" /> Filtros
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Arquivo</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Competência</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Data Emissão</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px]">Conta Origem</TableHead>
                <TableHead className="font-bold text-center text-muted-foreground uppercase text-[10px]">Títulos</TableHead>
                <TableHead className="text-right font-bold text-muted-foreground uppercase text-[10px]">Valor Total</TableHead>
                <TableHead className="text-center font-bold text-muted-foreground uppercase text-[10px]">Status</TableHead>
                <TableHead className="text-right font-bold text-muted-foreground uppercase text-[10px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                    Carregando histórico...
                  </TableCell>
                </TableRow>
              ) : remessas?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">Nenhuma remessa encontrada.</TableCell>
                </TableRow>
              ) : remessas?.map((rem) => (
                <TableRow key={rem.id} className="hover:bg-muted/30 border-border transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground/80">{rem.nome_arquivo || `${rem.id.substring(0, 8)}...`}</TableCell>
                  <TableCell className="font-bold text-foreground">{rem.competencia || rem.lotes_remessa?.competencia || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(rem.data_geracao || rem.created_at!).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <p className="font-bold text-foreground">{rem.contas_bancarias_empresa?.banco_nome || rem.banco_nome}</p>
                      <p className="text-muted-foreground/70">Ag: {rem.contas_bancarias_empresa?.agencia} C: {rem.contas_bancarias_empresa?.conta}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{rem.lotes_remessa?.quantidade_titulos ?? "-"}</TableCell>
                  <TableCell className="text-right font-black text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rem.total_valor || rem.lotes_remessa?.valor_total || 0)}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(rem.status || "gerado")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={() => handleRedownload(rem.id)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title={rem.hash_arquivo}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
};

export default HistoricoRemessas;
