import React, { useState } from "react";
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
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface UxLabImportarRetornoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessedSuccess?: () => void;
}

export const UxLabImportarRetornoModal: React.FC<UxLabImportarRetornoModalProps> = ({
  open,
  onOpenChange,
  onProcessedSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>("CB041001.RET");
  const [selectedBank, setSelectedBank] = useState<"001" | "341">("001");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<boolean>(false);

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setProcessedResult(true);
      toast.success("Retorno bancário processado no ambiente de teste (Mock)", {
        description: "12 liquidações confirmadas, 1 rejeição identificada e 1 divergência apontada.",
      });
      if (onProcessedSuccess) {
        onProcessedSuccess();
      }
    }, 800);
  };

  const handleClose = () => {
    setProcessedResult(false);
    setIsProcessing(false);
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
              Mock Simulação
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Importar Arquivo de Retorno Bancário
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Envie o arquivo .RET ou .TXT disponibilizado pelo Internet Banking para conciliação automática das liquidações, rejeições e tarifas.
          </DialogDescription>
        </DialogHeader>

        {!processedResult ? (
          <div className="space-y-4 py-2">
            {/* Upload Area Visual */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors bg-muted/20">
              <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold text-foreground">
                Arraste o arquivo de retorno ou clique para selecionar
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Formatos aceitos: .RET, .TXT (CNAB 240 padrão FEBRABAN)
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-background border border-border text-xs font-mono">
                <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                <span>{selectedFile}</span>
                <span className="text-muted-foreground text-[10px]">(48 KB)</span>
              </div>
            </div>

            {/* Metadados Identificados Automaticamente */}
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Identificação Automática do Header (Mock)
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px] block">Banco Identificado:</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground mt-0.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>{selectedBank === "001" ? "001 — Banco do Brasil S.A." : "341 — Itaú Unibanco S.A."}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Remessa Localizada:</span>
                  <span className="font-mono font-bold text-foreground block mt-0.5">
                    REM-2026-10-003 (NSA: 000104)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Data do Processamento:</span>
                  <span className="font-medium text-foreground block mt-0.5">04/10/2026 06:14</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Total de Registros no Lote:</span>
                  <span className="font-medium text-foreground block mt-0.5">14 favorecidos</span>
                </div>
              </div>

              {/* Selector de Banco para Teste Mock */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Alternar simulação de banco:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedBank("001"); setSelectedFile("CB041001.RET"); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${selectedBank === "001" ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted border-border text-muted-foreground"}`}
                  >
                    BB 001
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedBank("341"); setSelectedFile("ITAU0410.TXT"); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${selectedBank === "341" ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted border-border text-muted-foreground"}`}
                  >
                    Itaú 341
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-muted/40 border border-border/80 text-[11px] text-muted-foreground">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                O processamento não altera o banco de dados oficial. Todos os cálculos e conferências são exibidos de forma segura no protótipo UX Lab.
              </span>
            </div>
          </div>
        ) : (
          /* Sumário pós-processamento */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Arquivo de Retorno Processado com Sucesso
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  14 registros lidos da remessa REM-2026-10-003. Total processado: R$ 83.270,00.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Sumário do Retorno por Ocorrência Bancária:
              </div>

              {/* 1. Liquidados */}
              <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">12 Pagamentos Liquidados</div>
                    <div className="text-[11px] text-muted-foreground">Ocorrência 00 (Crédito Efetivado)</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    R$ 78.400,00
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Conciliado
                  </Badge>
                </div>
              </div>

              {/* 2. Rejeitados */}
              <div className="p-3 rounded-lg border border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">1 Pagamento Rejeitado</div>
                    <div className="text-[11px] text-rose-700 dark:text-rose-400">
                      Ocorrência 03: Conta de crédito encerrada / agência inválida
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                    R$ 2.420,00
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                    Encaminhado RH
                  </Badge>
                </div>
              </div>

              {/* 3. Divergentes */}
              <div className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">1 Divergência de Valor</div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">
                      Esperado: R$ 2.450,00 • Liquidado: R$ 2.425,00 (Dif: -R$ 25,00)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                    R$ 2.450,00
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                    Requer Análise
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          {!processedResult ? (
            <>
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={handleProcess}
                disabled={isProcessing}
              >
                {isProcessing ? "Lendo Registros CNAB..." : "Processar Retorno"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full sm:w-auto"
              onClick={handleClose}
            >
              Concluir e Visualizar Tabela
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
