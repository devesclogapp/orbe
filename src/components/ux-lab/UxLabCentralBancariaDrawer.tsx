import React, { useState } from "react";
import {
  X,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Check,
  AlertCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Info,
  Banknote,
  RotateCcw,
  Users,
  Wallet,
  Receipt,
  Download,
  Send,
  Upload,
  FileCode2,
  Landmark,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  ItemObrigacaoBancariaMock,
  getSituacaoBadge,
  getOrigemBadge,
} from "@/pages/UxLab/centralBancariaMockData";

interface UxLabCentralBancariaDrawerProps {
  item: ItemObrigacaoBancariaMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemUpdated?: (itemAtualizado: ItemObrigacaoBancariaMock) => void;
  onOpenImportarRetorno?: () => void;
}

export function UxLabCentralBancariaDrawer({
  item,
  open,
  onOpenChange,
  onItemUpdated,
  onOpenImportarRetorno,
}: UxLabCentralBancariaDrawerProps) {
  const navigate = useNavigate();

  // Modais de Ações do Drawer
  const [modalGerarCnabOpen, setModalGerarCnabOpen] = useState(false);
  const [modalConfirmarEnvioOpen, setModalConfirmarEnvioOpen] = useState(false);
  const [modalConciliarDivergenciaOpen, setModalConciliarDivergenciaOpen] = useState(false);
  const [observacaoEnvio, setObservacaoEnvio] = useState("");
  const [valorConciliadoInput, setValorConciliadoInput] = useState<string>("");
  const [justificativaInput, setJustificativaInput] = useState<string>("");

  if (!item) return null;

  const situacaoBadge = getSituacaoBadge(item.situacao);
  const origemBadge = getOrigemBadge(item.origemTipo);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Helper para garantir estrita consistência cronológica em eventos simulados
  const getProximaDataHora = (minutosAdicionais = 15): string => {
    if (!item.timeline || item.timeline.length === 0) {
      return "29/10/2026 09:30";
    }
    const ultimo = item.timeline[item.timeline.length - 1];
    const match = ultimo.dataHora.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (match) {
      const [, dia, mes, ano, hora, min] = match;
      const d = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        hora ? Number(hora) : 9,
        min ? Number(min) : 0
      );
      d.setMinutes(d.getMinutes() + minutosAdicionais);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return "29/10/2026 10:00";
  };

  // Ação 1: Gerar Remessa CNAB
  const handleGerarRemessa = () => {
    const dataHoraGeracao = getProximaDataHora(15);
    const atualizado: ItemObrigacaoBancariaMock = {
      ...item,
      situacao: "REMESSA_GERADA",
      remessaId: `rem-${item.contaPagadora.bancoCodigo}-${Date.now().toString().slice(-4)}`,
      remessaNumero: `REM-202610-${Date.now().toString().slice(-3)}`,
      remessaNsa: (item.remessaNsa || 1040) + 1,
      remessaHash: "e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3",
      remessaDataGeracao: dataHoraGeracao,
      remessaNomeArquivo: `CNAB240_${item.contaPagadora.bancoCodigo === "001" ? "BB" : "ITAU"}_20261029_SEQ001045.txt`,
      remessaQtdRegistros: item.quantidadeFavorecidos * 2 + 4,
      timeline: [
        ...item.timeline,
        {
          etapa: "Geração da Remessa",
          dataHora: dataHoraGeracao,
          responsavel: "Operador Financeiro",
          descricao: `Arquivo CNAB 240 emitido com NSA ${(item.remessaNsa || 1040) + 1} para ${item.contaPagadora.bancoNome}.`,
          status: "concluido",
        },
      ],
    };

    if (onItemUpdated) onItemUpdated(atualizado);
    setModalGerarCnabOpen(false);
    toast.success("Remessa CNAB240 gerada com sucesso!", {
      description: `Arquivo ${atualizado.remessaNomeArquivo} pronto para download.`,
    });
  };

  // Ação 2: Download do Arquivo TXT
  const handleBaixarArquivo = () => {
    const dataHoraDownload = getProximaDataHora(5);
    const atualizado: ItemObrigacaoBancariaMock = {
      ...item,
      situacao: "ARQUIVO_BAIXADO",
      remessaDataDownload: dataHoraDownload,
      timeline: [
        ...item.timeline,
        {
          etapa: "Download do Arquivo",
          dataHora: dataHoraDownload,
          responsavel: "Operador Financeiro",
          descricao: `Download efetuado (${item.remessaNomeArquivo}). O envio deve ser realizado no portal do banco.`,
          status: "concluido",
        },
      ],
    };

    if (onItemUpdated) onItemUpdated(atualizado);
    toast.info("Download simulado com sucesso!", {
      description: "Lembre-se: baixar o arquivo não o envia ao banco. O envio é manual.",
    });
  };

  // Ação 3: Marcar como Enviado ao Banco
  const handleConfirmarEnvioManual = () => {
    const dataHoraEnvio = getProximaDataHora(15);
    const atualizado: ItemObrigacaoBancariaMock = {
      ...item,
      situacao: "ENVIADO_MANUAL",
      remessaDataEnvio: dataHoraEnvio,
      observacaoEnvio: observacaoEnvio || "Envio manual confirmado via Internet Banking.",
      timeline: [
        ...item.timeline,
        {
          etapa: "Envio Confirmado",
          dataHora: dataHoraEnvio,
          responsavel: "Operador Financeiro",
          descricao: `Upload confirmado no Internet Banking. ${observacaoEnvio ? `Obs: ${observacaoEnvio}` : ""}`,
          status: "concluido",
        },
        {
          etapa: "Aguardando Retorno Bancário",
          dataHora: getProximaDataHora(30),
          responsavel: "Banco / Retorno",
          descricao: "Aguardando importação do arquivo de retorno (.RET).",
          status: "atual",
        },
      ],
    };

    if (onItemUpdated) onItemUpdated(atualizado);
    setModalConfirmarEnvioOpen(false);
    setObservacaoEnvio("");
    toast.success("Arquivo marcado como enviado ao banco!", {
      description: "Aguardando processamento e importação do arquivo de retorno.",
    });
  };

  // Ação 4: Conciliação Manual de Divergência
  const handleConciliarDivergencia = () => {
    const valConciliado = parseFloat(valorConciliadoInput) || item.valorRetornado || item.valorEsperado;
    if (!justificativaInput.trim()) {
      toast.error("Justificativa obrigatória para conciliar divergência.");
      return;
    }

    const dataHoraConciliacao = getProximaDataHora(20);
    const atualizado: ItemObrigacaoBancariaMock = {
      ...item,
      situacao: "CONCILIADO",
      valorConciliadoManual: valConciliado,
      justificativaConciliacao: justificativaInput,
      conciliadoEm: dataHoraConciliacao,
      conciliadoPor: "Auditor Financeiro",
      timeline: [
        ...item.timeline,
        {
          etapa: "Conciliação Manual com Justificativa",
          dataHora: dataHoraConciliacao,
          responsavel: "Auditor Financeiro",
          descricao: `Conciliado com valor final ${formatCurrency(valConciliado)}. Justificativa: ${justificativaInput}`,
          status: "concluido",
        },
      ],
    };

    if (onItemUpdated) onItemUpdated(atualizado);
    setModalConciliarDivergenciaOpen(false);
    setJustificativaInput("");
    setValorConciliadoInput("");
    toast.success("Conciliação manual registrada com sucesso!", {
      description: "Divergência tratada e obrigação baixada no ERP.",
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[780px] p-0 flex flex-col bg-background text-foreground border-l border-border/80 shadow-2xl z-50"
        >
          {/* Header Fixo */}
          <div className="p-6 border-b border-border/60 bg-muted/20 dark:bg-muted/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge variant="outline" className={origemBadge.className}>
                    {origemBadge.label}
                  </Badge>
                  <Badge variant="outline" className={situacaoBadge.className}>
                    {situacaoBadge.label}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    {item.referencia}
                  </span>
                </div>
                <SheetTitle className="text-xl font-bold font-display text-foreground tracking-tight">
                  {item.favorecidoDescricao}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {item.empresaNome} • Competência: {item.competencia}
                </SheetDescription>
              </div>
            </div>

            {/* Sumário Financeiro em Destaque */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-card border border-border/70 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Valor Total
                </span>
                <span className="text-lg font-black font-display text-foreground block mt-0.5">
                  {formatCurrency(item.valorTotal)}
                </span>
              </div>
              <div className="p-3 bg-card border border-border/70 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Beneficiários
                </span>
                <span className="text-lg font-black font-display text-foreground block mt-0.5">
                  {item.quantidadeFavorecidos}{" "}
                  <span className="text-xs font-medium text-muted-foreground">favorecido(s)</span>
                </span>
              </div>
              <div className="p-3 bg-card border border-border/70 rounded-lg col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Banco Pagador
                </span>
                <span className="text-sm font-bold text-foreground block mt-0.5 truncate">
                  {item.contaPagadora.bancoNome}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground block">
                  {item.contaPagadora.contaMascarada}
                </span>
              </div>
            </div>
          </div>

          {/* Corpo Rolável */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ESTADO 1: PRONTO PARA BANCO */}
            {item.situacao === "PRONTO_BANCO" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                        Obrigação Homologada para Geração Bancária
                      </h4>
                      <p className="text-xs text-blue-800 dark:text-blue-400 mt-1 leading-relaxed">
                        Esta obrigação passou por todas as etapas de conferência de RH e aprovação financeira na Central de Despesas. Está apta para emissão do arquivo de remessa CNAB240.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pré-Validação Cadastral e Bancária */}
                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Checklist de Pré-Validação CNAB
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                      <span>Conta pagadora ativa e habilitada para CNAB</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                      <span>Agência, Conta e Convênio {item.contaPagadora.bancoCodigo === "001" ? "BB" : "Itaú"} validados</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                      <span>Dados bancários de todos os {item.quantidadeFavorecidos} favorecidos aptos</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                      <span>Valor consolidado sem divergência aritmética</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADO 2: REMESSA GERADA / BAIXADA */}
            {["REMESSA_GERADA", "ARQUIVO_BAIXADO"].includes(item.situacao) && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border/80 bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Identificador da Remessa
                      </span>
                      <p className="text-base font-bold font-mono text-foreground">
                        {item.remessaNumero || item.referencia}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Número Sequencial (NSA)
                      </span>
                      <p className="text-base font-bold font-mono text-foreground">
                        {item.remessaNsa ? String(item.remessaNsa).padStart(6, "0") : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Arquivo Gerado:</span>
                      <p className="font-mono font-medium text-foreground truncate mt-0.5">
                        {item.remessaNomeArquivo}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data/Hora Emissão:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {item.remessaDataGeracao || "—"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Hash SHA-256 (Integridade):</span>
                      <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5 bg-muted/40 p-1.5 rounded">
                        {item.remessaHash || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aviso Crítico de Transmissão */}
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-300 space-y-1">
                      <p className="font-bold">Atenção ao fluxo de envio bancário:</p>
                      <p className="text-amber-800 dark:text-amber-400 leading-relaxed">
                        O download do arquivo CNAB apenas salva o arquivo no seu computador. A transmissão efetiva deve ser realizada no portal do banco (Internet Banking / Gerenciador Financeiro).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADO 3: ENVIADO AO BANCO (AGUARDANDO RETORNO) */}
            {item.situacao === "ENVIADO_MANUAL" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                        Remessa Enviada — Aguardando Arquivo de Retorno
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                        O arquivo foi transmitido ao banco em <strong>{item.remessaDataEnvio}</strong> (NSA {item.remessaNsa}). Assim que o banco disponibilizar o arquivo <code>.RET</code>, processe a importação para confirmação da liquidação.
                      </p>
                      {item.observacaoEnvio && (
                        <p className="text-xs font-mono bg-amber-100/50 dark:bg-amber-900/30 p-2 rounded mt-2 text-amber-900 dark:text-amber-200">
                          Obs: {item.observacaoEnvio}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Dados da Remessa em Trânsito
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Banco de Destino:</span>
                      <p className="font-bold text-foreground mt-0.5">{item.contaPagadora.bancoNome}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NSA / Lote:</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">NSA {item.remessaNsa}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Arquivo:</span>
                      <p className="font-mono text-foreground mt-0.5 truncate">{item.remessaNomeArquivo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor em Trânsito:</span>
                      <p className="font-bold text-foreground mt-0.5">{formatCurrency(item.valorTotal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADO 4: LIQUIDADO / CONCILIADO */}
            {["LIQUIDADO", "CONCILIADO"].includes(item.situacao) && (
              <div className="space-y-5">
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                        Pagamento Liquidado e Conciliado no Banco
                      </h4>
                      <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-1 leading-relaxed">
                        Retorno bancário recebido em <strong>{item.retornoData || "—"}</strong> com código de ocorrência <code>{item.codigoOcorrencia || "00"}</code> (Crédito Confirmado). Todos os lançamentos foram baixados no ERP.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Detalhamento da Baixa
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Valor Esperado:</span>
                      <p className="font-bold text-foreground mt-0.5">{formatCurrency(item.valorEsperado)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor Liquidado:</span>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCurrency(item.valorRetornado ?? item.valorTotal)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Diferença:</span>
                      <p className="font-bold text-muted-foreground mt-0.5">R$ 0,00</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADO 5: REJEITADO */}
            {item.situacao === "REJEITADO" && (
              <div className="space-y-5">
                {/* O que aconteceu */}
                <div className="rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-300">
                        O que aconteceu?
                      </h4>
                      <p className="text-xs text-rose-800 dark:text-rose-400 mt-1 leading-relaxed">
                        O banco rejeitou a liquidação deste pagamento no processamento do arquivo de retorno.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Motivo Bancário */}
                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Motivo Bancário Registrado
                  </h4>
                  <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Código da Ocorrência:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {item.motivoRejeicaoCodigo || item.codigoOcorrencia || "04"}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-border/50 text-foreground font-sans">
                      {item.motivoRejeicaoDescricao}
                    </div>
                  </div>
                </div>

                {/* Impacto Operacional */}
                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-foreground">Impacto no Lote & Fluxo:</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.impactoRejeicao}
                  </p>
                </div>

                {/* O que fazer */}
                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-foreground">Ação Recomendada:</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.acaoRejeicaoRecomendada}
                  </p>
                </div>
              </div>
            )}

            {/* ESTADO 6: DIVERGENTE */}
            {item.situacao === "DIVERGENTE" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                        Divergência de Valores no Retorno Bancário
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-1 leading-relaxed">
                        O valor creditado pelo banco difere do valor programado na remessa. É necessária a revisão manual com justificativa para baixa.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Confronto de Valores
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground block">Valor Esperado</span>
                      <span className="text-base font-bold text-foreground block mt-1">
                        {formatCurrency(item.valorEsperado)}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground block">Valor Retornado</span>
                      <span className="text-base font-bold text-amber-600 dark:text-amber-400 block mt-1">
                        {formatCurrency(item.valorRetornado ?? 0)}
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg">
                      <span className="text-rose-700 dark:text-rose-400 block font-semibold">Diferença</span>
                      <span className="text-base font-bold text-rose-700 dark:text-rose-400 block mt-1">
                        {formatCurrency(item.diferencaValor ?? 0)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-2">
                    Observação para análise: {item.motivoRejeicaoDescricao || "Divergência de valor identificada no retorno bancário."}
                  </p>
                </div>
              </div>
            )}

            {/* Esteira / Timeline de Auditoria */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Trilha de Eventos & Auditoria Bancária
              </h4>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {item.timeline.map((event, idx) => (
                  <div key={idx} className="relative text-xs">
                    <div
                      className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 bg-background ${
                        event.status === "concluido"
                          ? "border-emerald-600 text-emerald-600"
                          : event.status === "erro"
                          ? "border-rose-600 text-rose-600"
                          : "border-blue-600 text-blue-600"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{event.etapa}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{event.dataHora}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">{event.descricao}</p>
                    <span className="text-[10px] text-muted-foreground/80 block mt-0.5 italic">
                      Por: {event.responsavel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer com CTAs Contextuais */}
          <div className="p-4 border-t border-border/80 bg-muted/20 dark:bg-muted/10 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            <div className="flex items-center gap-2">
              {/* CTAs Pronto para Banco */}
              {item.situacao === "PRONTO_BANCO" && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                  onClick={() => setModalGerarCnabOpen(true)}
                >
                  <FileCode2 className="h-4 w-4" />
                  Gerar Remessa CNAB
                </Button>
              )}

              {/* CTAs Remessa Gerada */}
              {item.situacao === "REMESSA_GERADA" && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                  onClick={handleBaixarArquivo}
                >
                  <Download className="h-4 w-4" />
                  Baixar Arquivo CNAB
                </Button>
              )}

              {/* CTAs Arquivo Baixado */}
              {item.situacao === "ARQUIVO_BAIXADO" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleBaixarArquivo}
                  >
                    <Download className="h-4 w-4" />
                    Baixar Novamente
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                    onClick={() => setModalConfirmarEnvioOpen(true)}
                  >
                    <Send className="h-4 w-4" />
                    Marcar como Enviado ao Banco
                  </Button>
                </>
              )}

              {/* CTAs Enviado Manual */}
              {item.situacao === "ENVIADO_MANUAL" && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    if (onOpenImportarRetorno) onOpenImportarRetorno();
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Importar Retorno
                </Button>
              )}

              {/* CTAs Rejeitado */}
              {item.situacao === "REJEITADO" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={() => {
                    toast.info("Redirecionando para gestão de colaboradores / RH...", {
                      description: "Corrija os dados bancários para posterior inclusão em novo ciclo.",
                    });
                    navigate("/colaboradores");
                  }}
                >
                  <Users className="h-4 w-4" />
                  Abrir Cadastro / RH
                </Button>
              )}

              {/* CTAs Divergente */}
              {item.situacao === "DIVERGENTE" && (
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                  onClick={() => {
                    setValorConciliadoInput(String(item.valorRetornado || item.valorEsperado));
                    setModalConciliarDivergenciaOpen(true);
                  }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Revisar Conciliação
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* MODAL 1: Confirmar Geração de Remessa CNAB */}
      <Dialog open={modalGerarCnabOpen} onOpenChange={setModalGerarCnabOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display">
              <FileCode2 className="h-5 w-5 text-blue-600" />
              Gerar Remessa CNAB 240
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Esta ação consolidará {item.quantidadeFavorecidos} pagamento(s) no arquivo posicional FEBRABAN.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa Pagadora:</span>
                <span className="font-bold text-foreground">{item.empresaNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Banco de Origem:</span>
                <span className="font-bold text-foreground">{item.contaPagadora.bancoNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conta de Débito:</span>
                <span className="font-mono font-medium text-foreground">{item.contaPagadora.contaMascarada}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1.5">
                <span className="text-muted-foreground font-bold">Valor Total a Remeter:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(item.valorTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setModalGerarCnabOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={handleGerarRemessa}>
              Confirmar e Emitir CNAB
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Confirmar Envio Manual ao Banco */}
      <Dialog open={modalConfirmarEnvioOpen} onOpenChange={setModalConfirmarEnvioOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display">
              <Send className="h-5 w-5 text-amber-600" />
              Confirmar Envio ao Banco
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirme somente após realizar o upload do arquivo no Internet Banking do {item.contaPagadora.bancoNome}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-900 dark:text-amber-300">
              <p className="leading-relaxed">
                Ao confirmar, a remessa <strong>NSA {item.remessaNsa}</strong> entrará no estado <em>Aguardando Retorno Bancário</em>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Observação do Envio (Opcional):
              </Label>
              <Textarea
                placeholder="Ex: Enviado via Gerenciador Financeiro às 15h30 pelo operador..."
                value={observacaoEnvio}
                onChange={(e) => setObservacaoEnvio(e.target.value)}
                className="text-xs resize-none h-20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setModalConfirmarEnvioOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleConfirmarEnvioManual}>
              Confirmar Transmissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Revisar Conciliação Manual (Divergência) */}
      <Dialog open={modalConciliarDivergenciaOpen} onOpenChange={setModalConciliarDivergenciaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              Conciliação Manual de Divergência
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ajuste o valor conciliado final e informe a justificativa financeira obrigatória.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg">
              <div>
                <span className="text-muted-foreground block">Esperado:</span>
                <span className="font-bold text-foreground">{formatCurrency(item.valorEsperado)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Retornado:</span>
                <span className="font-bold text-amber-600">{formatCurrency(item.valorRetornado ?? 0)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Valor Final a Conciliar (R$):
              </Label>
              <Input
                type="number"
                step="0.01"
                value={valorConciliadoInput}
                onChange={(e) => setValorConciliadoInput(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Justificativa Contábil / Auditoria (Obrigatória):
              </Label>
              <Textarea
                placeholder="Ex: Apropriação de despesa com tarifa bancária DOC/TED debitada pelo banco conveniado..."
                value={justificativaInput}
                onChange={(e) => setJustificativaInput(e.target.value)}
                className="text-xs resize-none h-20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setModalConciliarDivergenciaOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleConciliarDivergencia}>
              Salvar Conciliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
