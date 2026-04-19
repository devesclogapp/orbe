import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Upload,
    FileCheck,
    AlertCircle,
    ChevronRight,
    Banknote,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
import { CNABService } from "@/services/financial.service";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

const RetornoBancario = () => {
    const [banco, setBanco] = useState("001");
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await CNABService.processRetorno(file, banco);
            setResult(res);
            toast.success("Arquivo processado com sucesso!");
        } catch (error) {
            toast.error("Erro ao processar arquivo");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <AppShell title="Retorno Bancário">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 md:col-span-1 space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <Banknote className="w-4 h-4" /> Configuração
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Banco do Arquivo</label>
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
                                    <p>O sistema aceita arquivos no padrão CNAB 240 ou 400. Certifique-se de que o cabeçalho do arquivo corresponde ao banco selecionado.</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-10 md:col-span-2 border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
                        {isUploading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                                    <Upload className="w-8 h-8 animate-bounce" />
                                </div>
                                <h3 className="text-lg font-semibold">Processando arquivo...</h3>
                                <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
                            </div>
                        ) : !result ? (
                            <>
                                <div className="w-16 h-16 bg-muted/50 text-muted-foreground rounded-full flex items-center justify-center">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Importar Arquivo Retorno</h3>
                                    <p className="text-sm text-muted-foreground mb-6">Arraste o arquivo ou clique no botão abaixo para selecionar.</p>
                                </div>
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    accept=".ret,.txt"
                                />
                                <Button asChild className="bg-primary">
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        Selecionar Arquivo
                                    </label>
                                </Button>
                            </>
                        ) : (
                            <div className="w-full space-y-6">
                                <div className="flex items-center gap-4 text-left">
                                    <div className="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground">Processamento Concluído</h3>
                                        <p className="text-sm text-muted-foreground">ID do Lote: <span className="font-mono text-xs">{result.loteId.substring(0, 8)}...</span></p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Títulos Lidos</span>
                                        <span className="text-xl font-bold">{result.resumo.totalProcessado}</span>
                                    </div>
                                    <div className="p-4 bg-success/10 rounded-lg text-center border border-success/20">
                                        <span className="text-[10px] text-success-strong uppercase font-bold block mb-1">Pagos/OK</span>
                                        <span className="text-xl font-bold text-success-strong">{result.resumo.pagos}</span>
                                    </div>
                                    <div className="p-4 bg-destructive/10 rounded-lg text-center border border-destructive/20">
                                        <span className="text-[10px] text-destructive-strong uppercase font-bold block mb-1">Rejeitados</span>
                                        <span className="text-xl font-bold text-destructive-strong">{result.resumo.rejeitados}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border flex justify-between items-center">
                                    <Button variant="ghost" className="text-muted-foreground" onClick={() => setResult(null)}>
                                        Limpar e Novo Upload
                                    </Button>
                                    <Button variant="outline" className="gap-2">
                                        Ver Títulos <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {result && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-4 space-y-3">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-success" /> Principais Baixas
                            </h4>
                            <div className="space-y-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 hover:bg-muted/30 rounded">
                                        <span className="text-gray-600">Título #10{i}54 - Cliente Log 0{i}</span>
                                        <span className="font-bold text-success-strong">R$ 1.250,00</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="p-4 space-y-3">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <AlertCircle className="w-3 h-3 text-destructive" /> Rejeições Notáveis
                            </h4>
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                Nenhuma rejeição crítica encontrada neste arquivo.
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </AppShell>
    );
};

export default RetornoBancario;
