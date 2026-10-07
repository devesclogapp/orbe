import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CnabRetornoService, ProcessarRetornoResult } from "@/services/cnab/cnabRetorno.service";

interface ImportarRetornoModalOficialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessedSuccess?: () => void;
}

export const ImportarRetornoModalOficial: React.FC<ImportarRetornoModalOficialProps> = ({
  open,
  onOpenChange,
  onProcessedSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("001");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<ProcessarRetornoResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProcessedResult(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo de retorno para processar.");
      return;
    }
    if (!selectedBank) {
      toast.error("Selecione o banco correspondente ao arquivo.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await CnabRetornoService.processarArquivo(selectedFile, selectedBank);
      setProcessedResult(result);
      toast.success("Retorno bancário processado com sucesso!", {
        description: `${result.resumo.pagos} liquidações confirmadas, ${result.resumo.rejeitados} rejeições e ${result.resumo.divergentes} divergências.`,
      });
      if (onProcessedSuccess) {
        onProcessedSuccess();
      }
    } catch (err: any) {
      console.error("[Retorno] Erro no processamento:", err);
      toast.error(`Falha ao processar arquivo: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setProcessedResult(null);
    setIsProcessing(false);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50">
              CNAB 240 / Retorno
            </Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Ambiente Oficial
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Importar Arquivo de Retorno Bancário
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Envie o arquivo .RET ou .TXT disponibilizado pelo Internet Banking para conciliação automática das liquidações, rejeições e ocorrências.
          </DialogDescription>
        </DialogHeader>

        {!processedResult ? (
          <div className="space-y-4 py-2">
            {/* Seletor de Banco */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Banco do Arquivo</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o banco emissor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="001" className="text-xs">001 — Banco do Brasil</SelectItem>
                  <SelectItem value="341" className="text-xs">341 — Itaú Unibanco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upload Area Visual */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".ret,.txt,.RET,.TXT"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors bg-muted/20 cursor-pointer"
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold text-foreground">
                Clique para selecionar o arquivo de retorno (.RET ou .TXT)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Formatos aceitos: .RET, .TXT (CNAB 240 padrão FEBRABAN)
              </p>
              {selectedFile ? (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-background border border-border text-xs font-mono">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold text-foreground">{selectedFile.name}</span>
                  <span className="text-muted-foreground text-[10px]">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-2 block">
                  Nenhum arquivo selecionado
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                Segurança e Idempotência
              </span>
              <p className="text-[11px]">
                O ORBE confere a integridade do arquivo através de hash SHA-256 e valida o sequencial (NSA). O processamento é transacional (fail-closed) e baixará exclusivamente os lançamentos confirmados pelo banco.
              </p>
            </div>
          </div>
        ) : (
          /* Visualização Pós-Processamento Real */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span>Arquivo Processado com Sucesso</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Arquivo: <span className="font-mono font-medium text-foreground">{selectedFile?.name}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Liquidados</span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {processedResult.resumo.pagos}
                </span>
              </div>
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Rejeitados</span>
                <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                  {processedResult.resumo.rejeitados}
                </span>
              </div>
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Divergentes</span>
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {processedResult.resumo.divergentes}
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {processedResult ? "Concluir" : "Cancelar"}
          </Button>

          {!processedResult && (
            <Button
              size="sm"
              onClick={handleProcess}
              disabled={isProcessing || !selectedFile}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Processar Retorno"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
