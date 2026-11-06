import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Clock,
  History,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import {
  OcorrenciasDecisaoService,
  OcorrenciaDecisaoRecord,
  TipoDecisaoOcorrencia,
  CalculoLiquidosColaborador,
} from "@/services/domain/ocorrenciasDecisao.service";
import { useAuth } from "@/contexts/AuthContext";

export interface OcorrenciaDecisaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacaoId: string;
  empresaId: string;
  colaborador: {
    id: string;
    nome: string;
    cargo?: string;
    cpf?: string | null;
    had_infraction?: boolean;
    infraction_type_id?: string | null;
    infraction_notes?: string | null;
    valor_provisorio?: number;
    infracao_codigo?: string | null;
  } | null;
  valorBaseEstimado?: number;
  onDecisaoSalva?: (decisao: OcorrenciaDecisaoRecord) => void;
}

export const OcorrenciaDecisaoModal: React.FC<OcorrenciaDecisaoModalProps> = ({
  open,
  onOpenChange,
  operacaoId,
  empresaId,
  colaborador,
  valorBaseEstimado = 120, // Diária ou valor operacional base padrão
  onDecisaoSalva,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [decisaoAtiva, setDecisaoAtiva] = useState<OcorrenciaDecisaoRecord | null>(null);
  const [historico, setHistorico] = useState<OcorrenciaDecisaoRecord[]>([]);
  const [isRevisando, setIsRevisando] = useState(false);

  // Form states
  const [tipoDecisao, setTipoDecisao] = useState<TipoDecisaoOcorrencia>("ARQUIVADA_SEM_PENALIDADE");
  const [valorAutorizado, setValorAutorizado] = useState<number>(0);
  const [competenciaSugerida, setCompetenciaSugerida] = useState<string>("");
  const [fundamentoLegal, setFundamentoLegal] = useState<string>("");
  const [motivoRevisao, setMotivoRevisao] = useState<string>("");

  useEffect(() => {
    if (open && operacaoId && colaborador?.id) {
      carregarDecisoes();
      const now = new Date();
      const ano = now.getFullYear();
      const mes = String(now.getMonth() + 1).padStart(2, "0");
      setCompetenciaSugerida(`${ano}-${mes}`);
    } else {
      resetForm();
    }
  }, [open, operacaoId, colaborador?.id]);

  const resetForm = () => {
    setTipoDecisao("ARQUIVADA_SEM_PENALIDADE");
    setValorAutorizado(0);
    setFundamentoLegal("");
    setMotivoRevisao("");
    setIsRevisando(false);
  };

  const carregarDecisoes = async () => {
    if (!operacaoId || !colaborador?.id) return;
    setLoading(true);
    try {
      const lista = await OcorrenciasDecisaoService.getByOperacaoId(operacaoId);
      const doColab = lista.filter((d) => d.collaborator_id === colaborador.id);
      const ativa = doColab.find((d) => d.status === "AUTORIZADO" || d.status === "PENDENTE") || null;
      setDecisaoAtiva(ativa);
      setHistorico(doColab.filter((d) => d.id !== ativa?.id));

      if (ativa) {
        setTipoDecisao(ativa.tipo_decisao);
        setValorAutorizado(Number(ativa.valor_autorizado || 0));
        setCompetenciaSugerida(ativa.competencia_sugerida || "");
        setFundamentoLegal(ativa.fundamento_legal || "");
      } else if (colaborador.valor_provisorio) {
        setValorAutorizado(Number(colaborador.valor_provisorio));
      }
    } catch (err) {
      console.error("[OcorrenciaDecisaoModal] Erro ao carregar deliberações:", err);
    } finally {
      setLoading(false);
    }
  };

  const liquidos: CalculoLiquidosColaborador = OcorrenciasDecisaoService.calcularLiquidos(
    valorBaseEstimado,
    decisaoAtiva,
    colaborador?.valor_provisorio
  );

  const handleSalvar = async () => {
    if (!colaborador?.id || !operacaoId || !empresaId) return;

    if (!fundamentoLegal.trim() || fundamentoLegal.trim().length < 10) {
      toast.error("Fundamentação obrigatória", {
        description: "Informe a fundamentação legal ou contratual com no mínimo 10 caracteres.",
      });
      return;
    }

    if (tipoDecisao === "PROPOSTA_RESSARCIMENTO") {
      if (valorAutorizado <= 0) {
        toast.error("Valor inválido", {
          description: "O valor do ressarcimento autorizado deve ser maior que zero.",
        });
        return;
      }
      if (!competenciaSugerida || !/^\d{4}-\d{2}$/.test(competenciaSugerida)) {
        toast.error("Competência inválida", {
          description: "Informe a competência sugerida no formato AAAA-MM (ex: 2026-11).",
        });
        return;
      }
    }

    setSalvando(true);
    try {
      const userName = user?.user_metadata?.full_name || user?.email || "Administrador / RH";
      const userId = user?.id || "00000000-0000-0000-0000-000000000000";

      if (isRevisando && decisaoAtiva) {
        if (!motivoRevisao.trim() || motivoRevisao.trim().length < 5) {
          toast.error("Motivo da revisão obrigatório", {
            description: "Descreva a justificativa para retificar a deliberação anterior.",
          });
          setSalvando(false);
          return;
        }

        const res = await OcorrenciasDecisaoService.cancelarOuRevisar({
          decisaoId: decisaoAtiva.id,
          motivo_cancelamento: motivoRevisao,
          novaDecisao: {
            infracao_codigo: colaborador.infracao_codigo || "OUTRA_OCORRENCIA",
            valor_provisorio_snapshot: Number(colaborador.valor_provisorio || 0),
            tipo_decisao: tipoDecisao,
            valor_autorizado: tipoDecisao === "PROPOSTA_RESSARCIMENTO" ? valorAutorizado : 0,
            competencia_sugerida: tipoDecisao === "PROPOSTA_RESSARCIMENTO" ? competenciaSugerida : null,
            fundamento_legal: fundamentoLegal,
            decidido_por: userId,
            decidido_por_nome: userName,
          },
        });

        toast.success("Deliberação retificada com sucesso!");
        if (res.nova && onDecisaoSalva) {
          onDecisaoSalva(res.nova);
        }
      } else {
        const nova = await OcorrenciasDecisaoService.registrarDecisao({
          empresa_id: empresaId,
          operacao_id: operacaoId,
          collaborator_id: colaborador.id,
          infracao_codigo: colaborador.infracao_codigo || "OUTRA_OCORRENCIA",
          valor_provisorio_snapshot: Number(colaborador.valor_provisorio || 0),
          tipo_decisao: tipoDecisao,
          valor_autorizado: tipoDecisao === "PROPOSTA_RESSARCIMENTO" ? valorAutorizado : 0,
          competencia_sugerida: tipoDecisao === "PROPOSTA_RESSARCIMENTO" ? competenciaSugerida : null,
          fundamento_legal: fundamentoLegal,
          decidido_por: userId,
          decidido_por_nome: userName,
        });

        toast.success("Deliberação administrativa registrada!");
        if (onDecisaoSalva) {
          onDecisaoSalva(nova);
        }
      }

      await carregarDecisoes();
      setIsRevisando(false);
    } catch (err: any) {
      console.error("[OcorrenciaDecisaoModal] Erro ao salvar deliberação:", err);
      toast.error("Erro ao salvar", {
        description: err.message || "Não foi possível registrar a deliberação.",
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelarDecisao = async () => {
    if (!decisaoAtiva) return;
    if (!motivoRevisao.trim() || motivoRevisao.trim().length < 5) {
      toast.error("Motivo do cancelamento obrigatório", {
        description: "Informe o motivo pelo qual a deliberação está sendo cancelada.",
      });
      return;
    }

    setSalvando(true);
    try {
      await OcorrenciasDecisaoService.cancelarOuRevisar({
        decisaoId: decisaoAtiva.id,
        motivo_cancelamento: motivoRevisao,
      });

      toast.success("Deliberação cancelada com sucesso!");
      await carregarDecisoes();
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao cancelar", {
        description: err.message || "Falha ao cancelar deliberação.",
      });
    } finally {
      setSalvando(false);
    }
  };

  const renderBadgeDecisao = (tipo: TipoDecisaoOcorrencia, status?: string) => {
    switch (tipo) {
      case "ARQUIVADA_SEM_PENALIDADE":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Arquivada sem Penalidade
          </Badge>
        );
      case "ADVERTENCIA_FORMAL":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            Advertência Formal
          </Badge>
        );
      case "PROPOSTA_RESSARCIMENTO":
        return (
          <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-300">
            <ShieldAlert className="w-3 h-3 mr-1 text-rose-600" />
            Ressarcimento Autorizado
          </Badge>
        );
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <DialogTitle className="text-lg font-bold">
              Deliberação Administrativa de Ocorrência
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Análise jurídica e de RH sobre o relato de ocorrência em serviço. Desacoplada do faturamento comercial e com estrita observância do Art. 462 da CLT.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando deliberações...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Bloco 1: Contexto e Relato do Encarregado */}
            <div className="bg-muted/40 p-3.5 rounded-lg border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold text-foreground text-sm block">
                    {colaborador?.nome || "Colaborador"}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {colaborador?.cargo || "Operacional"}
                  </span>
                </div>
                {Number(colaborador?.valor_provisorio || 0) > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Desconto Provisório:</span>
                    <span className="font-mono font-bold text-amber-700">
                      R$ {Number(colaborador?.valor_provisorio).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Relato em Campo: {colaborador?.infraction_type_id || "Ocorrência"}</span>
                </div>
                <p className="text-foreground/90 pl-5 italic bg-card/60 p-2 rounded border border-border/50">
                  "{colaborador?.infraction_notes || "Nenhuma observação textual detalhada pelo encarregado."}"
                </p>
              </div>
            </div>

            {/* Bloco 2: Painel Comparativo de Líquidos (Projetado vs Autorizado) */}
            <div className="grid grid-cols-2 gap-3 bg-card p-3 rounded-lg border border-border">
              <div className="space-y-1 border-r border-border/60 pr-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <Calculator className="w-3 h-3 text-amber-600" />
                  A. Líquido Projetado
                </span>
                <div className="font-mono font-bold text-sm text-amber-700">
                  R$ {liquidos.liquidoProjetado.toFixed(2)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Considera o desconto provisório de referência (R$ {liquidos.descontoProvisorio.toFixed(2)}). Não afeta folha nem CNAB.
                </p>
              </div>

              <div className="space-y-1 pl-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  B. Líquido Autorizado
                </span>
                <div className="font-mono font-bold text-sm text-emerald-700">
                  R$ {liquidos.liquidoAutorizado.toFixed(2)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Efetivamente devido após análise do RH (Desconto aprovado: R$ {liquidos.descontoAutorizado.toFixed(2)}).
                </p>
              </div>
            </div>

            {/* Bloco 3: Se já existe decisão ativa cadastrada */}
            {decisaoAtiva && !isRevisando && (
              <div className="bg-card p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Status da Deliberação
                    </span>
                    {renderBadgeDecisao(decisaoAtiva.tipo_decisao, decisaoAtiva.status)}
                    <Badge variant="secondary" className="text-[9px]">
                      {decisaoAtiva.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(decisaoAtiva.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                {decisaoAtiva.tipo_decisao === "PROPOSTA_RESSARCIMENTO" && (
                  <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Valor Autorizado:</span>
                      <span className="font-bold text-foreground text-sm">
                        R$ {Number(decisaoAtiva.valor_autorizado || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Competência do Desconto:</span>
                      <span className="font-semibold text-foreground">
                        {decisaoAtiva.competencia_sugerida || "A definir"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground font-medium block">Fundamentação Jurídica:</span>
                  <p className="text-foreground bg-muted/20 p-2 rounded border border-border/40 whitespace-pre-wrap">
                    {decisaoAtiva.fundamento_legal}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                  <span>Decidido por: <strong>{decisaoAtiva.decidido_por_nome}</strong></span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setIsRevisando(true);
                        setTipoDecisao(decisaoAtiva.tipo_decisao);
                        setValorAutorizado(Number(decisaoAtiva.valor_autorizado || 0));
                        setCompetenciaSugerida(decisaoAtiva.competencia_sugerida || "");
                        setFundamentoLegal(decisaoAtiva.fundamento_legal || "");
                      }}
                    >
                      Revisar Deliberação
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Bloco 4: Formulário de Nova Deliberação ou Revisão */}
            {(!decisaoAtiva || isRevisando) && (
              <div className="space-y-4 pt-1">
                {isRevisando && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded border border-amber-200 dark:border-amber-900/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                      <span>Retificando Deliberação Anterior</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] text-amber-700"
                        onClick={() => setIsRevisando(false)}
                      >
                        Cancelar edição
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-900 dark:text-amber-200">
                        Motivo da Retificação / Revisão *
                      </Label>
                      <Input
                        placeholder="Ex: Novos esclarecimentos prestados ou apuração complementar."
                        value={motivoRevisao}
                        onChange={(e) => setMotivoRevisao(e.target.value)}
                        className="text-xs h-8 bg-card"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Tipo de Deliberação Administrativa *</Label>
                  <RadioGroup
                    value={tipoDecisao}
                    onValueChange={(val) => setTipoDecisao(val as TipoDecisaoOcorrencia)}
                    className="grid grid-cols-1 gap-2"
                  >
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value="ARQUIVADA_SEM_PENALIDADE" className="mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <span className="font-semibold text-foreground block">
                          Arquivar sem Penalidade / Sem Desconto
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          Fato apurado não enseja responsabilidade do colaborador (justificado, ausência de culpa ou força maior).
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value="ADVERTENCIA_FORMAL" className="mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <span className="font-semibold text-foreground block">
                          Advertência Formal / Notificação Disciplinar
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          Aplicação de medida corretiva disciplinar sem repercussão pecuniária imediata.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value="PROPOSTA_RESSARCIMENTO" className="mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                          Autorizar Ressarcimento por Dano Material (Art. 462 CLT)
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          Aprovação de desconto para integração ao pagamento, condicionado aos requisitos legais e contratuais.
                        </span>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {tipoDecisao === "PROPOSTA_RESSARCIMENTO" && (
                  <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/40 space-y-3">
                    <div className="flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Fundamento Jurídico Obrigatório (Art. 462 CLT):</strong> Em caso de dano causado pelo empregado, o desconto só é lícito se houver previsão expressa no contrato de trabalho ou comprovação de dolo. É vedado criar líquido negativo.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Valor Autorizado para Desconto (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0,00"
                          value={valorAutorizado || ""}
                          onChange={(e) => setValorAutorizado(parseFloat(e.target.value) || 0)}
                          className="text-xs font-mono bg-card"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Competência do Desconto (AAAA-MM) *</Label>
                        <Input
                          placeholder="Ex: 2026-11"
                          value={competenciaSugerida}
                          onChange={(e) => setCompetenciaSugerida(e.target.value)}
                          className="text-xs font-mono bg-card"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Fundamentação Legal e Justificativa da Decisão *
                  </Label>
                  <Textarea
                    placeholder="Descreva a fundamentação fática e jurídica da deliberação (ex: cláusula contratual expressa, confissão/acordo firmado, laudo de avaria, etc.)."
                    value={fundamentoLegal}
                    onChange={(e) => setFundamentoLegal(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Mínimo de 10 caracteres. Esta fundamentação será mantida em auditoria permanente para fins fiscais e trabalhistas.
                  </span>
                </div>
              </div>
            )}

            {/* Bloco 5: Histórico de deliberações anteriores */}
            {historico.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
                  <History className="w-3.5 h-3.5" />
                  Histórico de Deliberações Anteriores ({historico.length})
                </span>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {historico.map((h) => (
                    <div key={h.id} className="bg-muted/20 p-2.5 rounded border border-border/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {renderBadgeDecisao(h.tipo_decisao)}
                          <Badge variant="outline" className="text-[9px] h-4">
                            {h.status}
                          </Badge>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {h.fundamento_legal}
                      </p>
                      {h.motivo_cancelamento && (
                        <p className="text-[10px] text-amber-700 italic">
                          Motivo retificação: {h.motivo_cancelamento}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Fechar
          </Button>

          {(!decisaoAtiva || isRevisando) && (
            <div className="flex items-center gap-2">
              {isRevisando && decisaoAtiva && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelarDecisao}
                  disabled={salvando}
                >
                  {salvando ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  Cancelar Decisão Ativa
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={handleSalvar}
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" /> Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {isRevisando ? "Salvar Retificação" : "Registrar Deliberação"}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
