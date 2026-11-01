/**
 * RegularizarMarcacaoModal.tsx
 *
 * Modal para regularização controlada de marcações de ponto pelo RH/Admin (FIX CP04.8).
 *
 * Exibe as batidas factuais originais importadas, permite selecionar o tipo de marcação,
 * informar o novo horário com validação estrita e exige justificativa obrigatória com auditoria.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Clock, Info, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PontoRegularizacaoService } from "@/services/operationalEngine/pontoRegularizacao.service";
import { CampoMarcacaoRegularizavel } from "@/types/pontoRegularizacao.types";

const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

interface RegularizarMarcacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ponto: any | null;
  colaboradorNome: string;
  onSuccess: () => void;
}

export function RegularizarMarcacaoModal({
  open,
  onOpenChange,
  ponto,
  colaboradorNome,
  onSuccess,
}: RegularizarMarcacaoModalProps) {
  const [campo, setCampo] = useState<CampoMarcacaoRegularizavel>("saida");
  const [novoHorario, setNovoHorario] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sugere o primeiro campo ausente quando o modal é aberto
  useEffect(() => {
    if (open && ponto) {
      if (!ponto.entrada) {
        setCampo("entrada");
      } else if (!ponto.saida_almoco) {
        setCampo("saida_almoco");
      } else if (!ponto.retorno_almoco) {
        setCampo("retorno_almoco");
      } else {
        setCampo("saida");
      }
      setNovoHorario("");
      setJustificativa("");
    }
  }, [open, ponto]);

  const formatPunchDisplay = (val?: string | null) => {
    if (!val || typeof val !== "string" || val.trim() === "" || val.trim().toLowerCase() === "null") {
      return "—";
    }
    const t = val.trim();
    return t.length >= 5 ? t.slice(0, 5) : t;
  };

  const isHorarioValido = TIME_REGEX.test(novoHorario.trim());
  const isJustificativaValida = justificativa.trim().length >= 5;
  const canSubmit = Boolean(ponto?.id && isHorarioValido && isJustificativaValida && !isSubmitting);

  const handleSubmit = async () => {
    if (!ponto?.id || !canSubmit) return;

    setIsSubmitting(true);
    try {
      await PontoRegularizacaoService.regularizarMarcacao({
        registroPontoId: ponto.id,
        colaboradorId: ponto.colaborador_id,
        data: ponto.data,
        campo,
        novoHorario: novoHorario.trim(),
        justificativa: justificativa.trim(),
      });

      toast.success("Marcação regularizada com sucesso pelo RH.", {
        description: `Campo ${campo} atualizado para ${novoHorario.trim()} com preservação factual.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Não foi possível regularizar a marcação.", {
        description: error?.message || "Verifique as permissões e tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Regularizar Marcação de Ponto
          </DialogTitle>
          <DialogDescription>
            Ajuste administrativo de batida pelo RH. A evidência factual original importada
            será preservada integralmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identificação do Registro */}
          <div className="rounded-xl border border-muted bg-muted/20 p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Colaborador:</span>
              <span className="font-semibold text-foreground">{colaboradorNome || "—"}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-muted-foreground">Data do Ponto:</span>
              <span className="font-medium text-foreground">
                {ponto?.data
                  ? format(new Date(`${ponto.data}T00:00:00`), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })
                  : "—"}
              </span>
            </div>
          </div>

          {/* Marcações Originais Importadas */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Marcações Originais (RHiD)
            </Label>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border border-border bg-muted/10 p-2">
                <span className="block text-[10px] text-muted-foreground">Entrada</span>
                <span className="font-mono text-sm font-medium">
                  {formatPunchDisplay(ponto?.entrada)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/10 p-2">
                <span className="block text-[10px] text-muted-foreground">Saída Alm.</span>
                <span className="font-mono text-sm font-medium">
                  {formatPunchDisplay(ponto?.saida_almoco)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/10 p-2">
                <span className="block text-[10px] text-muted-foreground">Ret. Alm.</span>
                <span className="font-mono text-sm font-medium">
                  {formatPunchDisplay(ponto?.retorno_almoco)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/10 p-2">
                <span className="block text-[10px] text-muted-foreground">Saída Final</span>
                <span className="font-mono text-sm font-medium">
                  {formatPunchDisplay(ponto?.saida)}
                </span>
              </div>
            </div>
          </div>

          {/* Seleção do Campo e Novo Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo_marcacao_reg">Marcação a Regularizar</Label>
              <Select value={campo} onValueChange={(val) => setCampo(val as CampoMarcacaoRegularizavel)}>
                <SelectTrigger id="tipo_marcacao_reg">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida_almoco">Saída Almoço</SelectItem>
                  <SelectItem value="retorno_almoco">Retorno Almoço</SelectItem>
                  <SelectItem value="saida">Saída Final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo_horario_reg">Novo Horário (HH:MM)</Label>
              <Input
                id="novo_horario_reg"
                placeholder="Ex: 17:35"
                maxLength={5}
                value={novoHorario}
                onChange={(e) => setNovoHorario(e.target.value)}
                className="font-mono"
              />
              {novoHorario.trim() && !isHorarioValido && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Formato HH:MM (00:00 a 23:59)
                </p>
              )}
            </div>
          </div>

          {/* Justificativa Obrigatória */}
          <div className="space-y-1.5">
            <Label htmlFor="justificativa_reg">
              Justificativa Obrigatória <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa_reg"
              rows={3}
              placeholder="Explique o motivo da regularização (mínimo de 5 caracteres)..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Mínimo de 5 caracteres. Ficará associada ao registro com seu usuário e timestamp.
            </p>
          </div>

          {/* Aviso Legal / Governança */}
          <div className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-xs text-foreground flex items-start gap-2.5">
            <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Esta regularização não altera a evidência original importada. A intervenção ficará
              registrada no histórico de auditoria e será utilizada como marcação efetiva na apuração.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gravando...
              </>
            ) : (
              "Confirmar Regularização"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
