/**
 * DecidirPontoModal.tsx
 *
 * Modal para registro auditável de Decisão RH em pontos bloqueados (FIX CP06.6-A).
 * Suporta decisões formais para:
 * 1. FALTA_PENDENTE_JUSTIFICATIVA -> FALTA_INJUSTIFICADA_CONFIRMADA ou FALTA_JUSTIFICADA_ABONADA
 * 2. TRABALHO_EM_DIA_NAO_TRABALHAVEL -> DSR_DIRECIONADO_BANCO_HORAS ou DSR_DIRECIONADO_HORA_EXTRA
 *
 * Princípio: O dado factual bruto nunca é sobrescrito.
 * A decisão atua como um overlay de governança com autoria, justificativa e carimbo de data/hora.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck2,
  Info,
  Loader2,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { PontoDecisaoService } from "@/services/operationalEngine/pontoDecisao.service";
import { TipoDecisaoPonto } from "@/types/pontoDecisao.types";

interface DecidirPontoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ponto: any | null;
  colaboradorNome: string;
  defaultTipoDecisao?: TipoDecisaoPonto | null;
  onSuccess: () => void;
}

export function DecidirPontoModal({
  open,
  onOpenChange,
  ponto,
  colaboradorNome,
  defaultTipoDecisao,
  onSuccess,
}: DecidirPontoModalProps) {
  const [tipoDecisao, setTipoDecisao] = useState<TipoDecisaoPonto>("FALTA_JUSTIFICADA_ABONADA");
  const [justificativa, setJustificativa] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusVisual = ponto?.presentation?.statusVisual || ponto?.status_visual;
  const isDsrScenario =
    statusVisual === "TRABALHO_EM_DIA_NAO_TRABALHAVEL" ||
    (ponto?.jornada_prevista === 0 && Boolean(ponto?.entrada));

  useEffect(() => {
    if (open && ponto) {
      if (defaultTipoDecisao) {
        setTipoDecisao(defaultTipoDecisao);
      } else if (isDsrScenario) {
        setTipoDecisao("DSR_DIRECIONADO_BANCO_HORAS");
      } else {
        setTipoDecisao("FALTA_JUSTIFICADA_ABONADA");
      }
      setJustificativa("");
    }
  }, [open, ponto, defaultTipoDecisao, isDsrScenario]);

  const dataFormatada = ponto?.data
    ? (() => {
        try {
          const [ano, mes, dia] = String(ponto.data).split("-").map(Number);
          return format(new Date(ano, mes - 1, dia), "EEEE, dd 'de' MMMM 'de' yyyy", {
            locale: ptBR,
          });
        } catch {
          return ponto.data;
        }
      })()
    : "—";

  const isJustificativaValida = justificativa.trim().length >= 5;
  const canSubmit = Boolean(ponto?.id && tipoDecisao && isJustificativaValida && !isSubmitting);

  const handleSubmit = async () => {
    if (!ponto?.id || !canSubmit) return;

    setIsSubmitting(true);
    try {
      await PontoDecisaoService.registrarDecisao({
        registroPontoId: ponto.id,
        colaboradorId: ponto.colaborador_id,
        data: ponto.data,
        tipoDecisao,
        justificativa: justificativa.trim(),
      });

      const labelAcao =
        tipoDecisao === "FALTA_INJUSTIFICADA_CONFIRMADA"
          ? "Falta injustificada confirmada"
          : tipoDecisao === "FALTA_JUSTIFICADA_ABONADA"
            ? "Falta abonada com sucesso"
            : tipoDecisao === "DSR_DIRECIONADO_BANCO_HORAS"
              ? "Trabalho em repouso direcionado ao Banco de Horas"
              : "Trabalho em repouso direcionado para Pagamento";

      toast.success("Decisão RH registrada com sucesso.", {
        description: `${labelAcao}. O motor considerará esta governança no processamento.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Não foi possível registrar a decisão RH.", {
        description: error?.message || "Verifique suas permissões e tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Decisão RH — Governança do Ponto
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground capitalize">
                {dataFormatada} • {colaboradorNome}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Informativo do Estado Atual */}
          <div className="rounded-xl border border-muted bg-muted/20 p-3.5 text-xs text-foreground">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inconsistência identificada:</span>
              <span className="font-semibold text-warning">
                {isDsrScenario ? "Trabalho em Dia Não Trabalhável (DSR/Folga)" : "Falta Pendente de Justificativa"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-muted/50 pt-2 text-muted-foreground">
              <div>
                <span>Jornada Prevista: </span>
                <span className="font-medium text-foreground">
                  {ponto?.presentation?.jornadaPrevistaHours ?? 0}h
                </span>
              </div>
              <div>
                <span>Marcações Fatuais: </span>
                <span className="font-medium text-foreground">
                  {ponto?.entrada
                    ? `${ponto.entrada} / ${ponto.saida_almoco || "—"} / ${ponto.retorno_almoco || "—"} / ${ponto.saida || "—"}`
                    : "Sem batidas registradas"}
                </span>
              </div>
            </div>
          </div>

          {/* Opções de Decisão Conforme o Cenário */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Selecione a Decisão Formal de RH:
            </Label>

            <RadioGroup
              value={tipoDecisao}
              onValueChange={(val) => setTipoDecisao(val as TipoDecisaoPonto)}
              className="space-y-2"
            >
              {isDsrScenario ? (
                <>
                  <div
                    onClick={() => setTipoDecisao("DSR_DIRECIONADO_BANCO_HORAS")}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      tipoDecisao === "DSR_DIRECIONADO_BANCO_HORAS"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="DSR_DIRECIONADO_BANCO_HORAS" id="dsr_bh" className="mt-1" />
                    <div className="space-y-1">
                      <label htmlFor="dsr_bh" className="cursor-pointer text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Direcionar para Banco de Horas (DSR_DIRECIONADO_BANCO_HORAS)
                      </label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Utiliza os minutos factualmente reconhecidos pelo parser e credita integralmente como horas positivas no Banco de Horas.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setTipoDecisao("DSR_DIRECIONADO_HORA_EXTRA")}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      tipoDecisao === "DSR_DIRECIONADO_HORA_EXTRA"
                        ? "border-warning bg-warning/5 text-foreground"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="DSR_DIRECIONADO_HORA_EXTRA" id="dsr_he" className="mt-1" />
                    <div className="space-y-1">
                      <label htmlFor="dsr_he" className="cursor-pointer text-xs font-semibold flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-warning" />
                        Direcionar para Pagamento de Hora Extra (DSR_DIRECIONADO_HORA_EXTRA)
                      </label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Segrega os minutos trabalhados para pagamento em folha, sem criar crédito simultâneo no Banco de Horas.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    onClick={() => setTipoDecisao("FALTA_JUSTIFICADA_ABONADA")}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      tipoDecisao === "FALTA_JUSTIFICADA_ABONADA"
                        ? "border-success bg-success/5 text-foreground"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="FALTA_JUSTIFICADA_ABONADA" id="falta_abonada" className="mt-1" />
                    <div className="space-y-1">
                      <label htmlFor="falta_abonada" className="cursor-pointer text-xs font-semibold flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Abonar / Justificar Falta (FALTA_JUSTIFICADA_ABONADA)
                      </label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        O dia é considerado resolvido pelo RH (atestado ou dispensa): jornada prevista preservada, sem débito no Banco de Horas e sem desconto em folha.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setTipoDecisao("FALTA_INJUSTIFICADA_CONFIRMADA")}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      tipoDecisao === "FALTA_INJUSTIFICADA_CONFIRMADA"
                        ? "border-destructive bg-destructive/5 text-foreground"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <RadioGroupItem value="FALTA_INJUSTIFICADA_CONFIRMADA" id="falta_confirmada" className="mt-1" />
                    <div className="space-y-1">
                      <label htmlFor="falta_confirmada" className="cursor-pointer text-xs font-semibold flex items-center gap-1.5 text-destructive">
                        <UserX className="h-3.5 w-3.5" />
                        Confirmar Falta Injustificada (FALTA_INJUSTIFICADA_CONFIRMADA)
                      </label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Autoriza o motor a aplicar as regras vigentes de desconto de falta: gera débito da jornada no Banco de Horas e desconto correspondente.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </RadioGroup>
          </div>

          {/* Campo de Justificativa Obrigatória */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="justificativa-decisao" className="text-xs font-semibold">
                Justificativa Obrigatória do RH:
              </Label>
              <span className="text-[11px] text-muted-foreground">Mínimo 5 caracteres</span>
            </div>
            <Textarea
              id="justificativa-decisao"
              placeholder="Ex.: Atestado médico CID 10 apresentado e homologado pelo ambulatório..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[75px] text-xs resize-none"
            />
            {justificativa.length > 0 && !isJustificativaValida && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> A justificativa precisa ter pelo menos 5 caracteres.
              </p>
            )}
          </div>

          {/* Aviso de Governança e Imutabilidade */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Garantia de Imutabilidade:</span> O ponto bruto
              importado permanece intacto. Esta ação cria um registro auditável em{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
                registros_ponto_decisoes
              </code>{" "}
              com sua autoria e timestamp.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <FileCheck2 className="h-4 w-4" />
                Confirmar Decisão RH
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
