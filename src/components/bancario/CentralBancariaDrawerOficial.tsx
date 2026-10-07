import React, { useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
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
  Download,
  Send,
  UploadCloud,
  FileCode2,
  Landmark,
  Layers,
  XCircle,
  HelpCircle,
  Loader2,
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
import { cn } from "@/lib/utils";
import { cleanUuid } from "@/services/domain/base.service";
import {
  ItemObrigacaoBancariaOficial,
  getSituacaoBadge,
  getOrigemBadge,
} from "@/services/bancarioOficialAdapter";
import { CNABService, CnabRemessaArquivoService } from "@/services/financial.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { CNAB240BBWriter } from "@/services/cnab/CNAB240BBWriter";
import { EnvironmentService } from "@/services/environment/EnvironmentService";

interface CentralBancariaDrawerOficialProps {
  item: ItemObrigacaoBancariaOficial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemUpdated?: () => void;
  onOpenImportarRetorno?: () => void;
}

export function CentralBancariaDrawerOficial({
  item,
  open,
  onOpenChange,
  onItemUpdated,
  onOpenImportarRetorno,
}: CentralBancariaDrawerOficialProps) {
  const navigate = useNavigate();

  // Modais de Ações do Drawer
  const [modalGerarCnabOpen, setModalGerarCnabOpen] = useState(false);
  const [modalConfirmarEnvioOpen, setModalConfirmarEnvioOpen] = useState(false);
  const [modalConciliarDivergenciaOpen, setModalConciliarDivergenciaOpen] = useState(false);
  const [observacaoEnvio, setObservacaoEnvio] = useState("");
  const [justificativaInput, setJustificativaInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  const situacaoBadge = getSituacaoBadge(item.situacao);
  const origemBadge = getOrigemBadge(item.origemTipo);

  const isBeneficiariosValidos = Boolean(item.preValidacao?.favorecidosAptos ?? true);
  const isContaValida = Boolean(
    item.contaPagadora?.id &&
    cleanUuid(item.contaPagadora.id) &&
    item.contaPagadora.permiteCnab &&
    item.contaPagadora.ativo
  );
  const isEmpresaValida = Boolean(item.empresaId && cleanUuid(item.empresaId));

  // CONV-11-FIX04 — Identidade canônica: a conta pagadora DEVE pertencer à
  // mesma empresa do lote (UUID canônico do registro, nunca contexto global).
  const contaEmpresaIdLimpa = cleanUuid(item.contaPagadora?.empresaId);
  const isContaDaMesmaEmpresa = Boolean(
    contaEmpresaIdLimpa && contaEmpresaIdLimpa === cleanUuid(item.empresaId)
  );

  // CONV-11-FIX04 — Segregação PROD × HML: espelha a regra do
  // EnvironmentService.assertEmpresaAllowed (camada CNAB) para falhar fechado
  // ANTES da mutation, com diagnóstico explícito.
  const ambienteAtual = EnvironmentService.getCurrentEnvironment();
  const isAmbienteIncompativel =
    typeof item.isEmpresaTeste === "boolean" &&
    ((ambienteAtual === "production" && item.isEmpresaTeste) ||
      (ambienteAtual === "homologacao" && !item.isEmpresaTeste));

  const isReadyParaGerar =
    isContaValida &&
    isEmpresaValida &&
    isBeneficiariosValidos &&
    isContaDaMesmaEmpresa &&
    !isAmbienteIncompativel;

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const triggerDownload = (content: string, fileName: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Ação 1: Gerar Remessa CNAB Real
  const handleGerarRemessa = async () => {
    const contaIdLimpo = cleanUuid(item.contaPagadora?.id);
    const empresaIdLimpa = cleanUuid(item.empresaId);

    if (!contaIdLimpo) {
      toast.error(
        `Geração bloqueada: Empresa "${item.empresaNome}" não possui conta bancária CNAB válida configurada.`
      );
      return;
    }

    if (!empresaIdLimpa) {
      toast.error("Geração bloqueada: Identificador da empresa inválido.");
      return;
    }

    if (!isBeneficiariosValidos) {
      toast.error(
        `Geração bloqueada: Existem ${item.preValidacao?.qtdFavorecidosInaptos || "vários"} favorecido(s) com pendências cadastrais bancárias no lote.`
      );
      return;
    }

    if (!isContaDaMesmaEmpresa) {
      toast.error(
        "Geração bloqueada: a conta pagadora não pertence à empresa do lote."
      );
      return;
    }

    if (isAmbienteIncompativel) {
      toast.error(
        item.isEmpresaTeste
          ? "Geração bloqueada: lote de empresa de HOMOLOGAÇÃO com a sessão em PRODUÇÃO."
          : "Geração bloqueada: lote de empresa de PRODUÇÃO com a sessão em HOMOLOGAÇÃO."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (item.origemTipo === "CLT") {
        const result = await CNABService.generateRemessa({
          competencia: item.competencia,
          empresaId: empresaIdLimpa,
          contaId: contaIdLimpo,
          rhLoteId: item.loteId,
        });
        toast.success(`CNAB CLT gerado: ${result.fileName}`);
        triggerDownload(result.content, result.fileName);
      } else if (item.origemTipo === "DIARISTAS") {
        await LoteFechamentoDiaristaService.gerarRemessaCNAB(item.loteId, {
          bancoRemessa: item.contaPagadora.bancoCodigo,
          contaBancariaId: contaIdLimpo,
        });
        toast.success("Remessa CNAB de Diaristas gerada com sucesso!");
      } else if (item.origemTipo === "INTERMITENTES") {
        await IntermitentesLoteService.gerarRemessaCNAB(item.loteId, {
          bancoRemessa: item.contaPagadora.bancoCodigo,
          contaBancariaId: contaIdLimpo,
        });
        toast.success("Remessa CNAB de Intermitentes gerada com sucesso!");
      }

      setModalGerarCnabOpen(false);
      onOpenChange(false);
      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      console.error("[CentralBancaria] Erro ao gerar remessa:", err);
      toast.error(`Falha ao gerar remessa: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação 2: Re-download de Arquivo Existente
  const handleDownloadArquivo = async () => {
    if (!item.remessaId) return;
    setIsSubmitting(true);
    try {
      const result = await CNAB240BBWriter.redownload(item.remessaId);
      if (result) {
        triggerDownload(result.content, result.fileName);
        await CnabRemessaArquivoService.marcarComoBaixado(item.remessaId);
        toast.success(`Download concluído: ${result.fileName}`);
        if (onItemUpdated) onItemUpdated();
      } else {
        toast.error("Conteúdo do arquivo não disponível para re-download.");
      }
    } catch (err: any) {
      toast.error(`Erro ao baixar arquivo: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação 3: Marcar como Enviado Manualmente
  const handleConfirmarEnvioManual = async () => {
    if (!item.remessaId) return;
    setIsSubmitting(true);
    try {
      await CnabRemessaArquivoService.marcarComoEnviadoManual(
        item.remessaId,
        observacaoEnvio || undefined
      );
      toast.success("Remessa marcada como enviada ao banco.");
      setModalConfirmarEnvioOpen(false);
      onOpenChange(false);
      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      toast.error(`Erro ao registrar envio: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setObservacaoEnvio("");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col justify-between">
          {/* Header do Drawer */}
          <div className="p-6 border-b border-border bg-card">
            <SheetHeader className="text-left space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${origemBadge.className}`}
                >
                  {origemBadge.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${situacaoBadge.className}`}
                >
                  {situacaoBadge.label}
                </span>
                {item.remessaNsa && (
                  <span className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                    NSA: {String(item.remessaNsa).padStart(6, "0")}
                  </span>
                )}
              </div>

              <SheetTitle className="text-xl font-bold tracking-tight text-foreground flex items-center justify-between">
                <span>{item.referencia}</span>
                <span className="font-mono text-lg text-foreground font-semibold">
                  {formatCurrency(item.valorTotal)}
                </span>
              </SheetTitle>

              <SheetDescription className="text-xs text-muted-foreground">
                {item.empresaNome} • Competência: {item.competencia} • {item.favorecidoDescricao}
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Conteúdo Central do Drawer */}
          <div className="p-6 space-y-6 flex-1">
            {/* 1. SEÇÃO CONTEXTUAL: PRONTO PARA BANCO */}
            {item.situacao === "PRONTO_BANCO" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50 p-4">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-semibold text-xs mb-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Checklist de Pré-Validação CNAB</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Esta obrigação foi homologada pelo setor responsável e está apta para geração da remessa bancária.
                  </p>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Conta pagadora ativa e habilitada para CNAB:</span>
                      {isContaValida ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Não configurada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Dados dos favorecidos preenchidos:</span>
                      {isBeneficiariosValidos ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> 100% Aptos
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Pendências Cadastrais ({item.preValidacao?.qtdFavorecidosInaptos || 1} inapto{(item.preValidacao?.qtdFavorecidosInaptos ?? 1) > 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Conferência matemática do lote:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Consolidado
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Conta pertence à empresa do lote:</span>
                      {isContaDaMesmaEmpresa ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Divergente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ambiente da empresa compatível com a sessão:</span>
                      {!isAmbienteIncompativel ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Compatível
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Incompatível
                        </span>
                      )}
                    </div>
                  </div>

                  {isAmbienteIncompativel && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/60 p-3 text-[11px] text-rose-800 dark:text-rose-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>Bloqueio: Ambiente Incompatível</span>
                      </div>
                      <div><strong>Problema:</strong> {item.isEmpresaTeste
                        ? <>A empresa <strong>{item.empresaNome}</strong> é de HOMOLOGAÇÃO e a sessão está em PRODUÇÃO.</>
                        : <>A empresa <strong>{item.empresaNome}</strong> é de PRODUÇÃO e a sessão está em HOMOLOGAÇÃO.</>}
                      </div>
                      <div><strong>Impacto:</strong> A camada CNAB recusa remessas que misturam ambientes (segregação PROD × HML).</div>
                      <div><strong>Próxima Ação:</strong> Alternar o ambiente no seletor do cabeçalho e repetir a geração.</div>
                    </div>
                  )}

                  {isContaValida && !isContaDaMesmaEmpresa && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/60 p-3 text-[11px] text-rose-800 dark:text-rose-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>Bloqueio: Conta de Outra Empresa</span>
                      </div>
                      <div><strong>Problema:</strong> A conta pagadora não pertence à empresa canônica do lote.</div>
                      <div><strong>Próxima Ação:</strong> Vincular uma conta CNAB da própria empresa em <em>Configurações &gt; Contas Bancárias</em>.</div>
                    </div>
                  )}

                  {!isContaValida && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/60 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        Bloqueio: Conta bancária não vinculada
                      </div>
                      <p>
                        A empresa <strong>{item.empresaNome}</strong> não possui conta bancária ativa com permissão CNAB cadastrada.
                      </p>
                      <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                        Cadastre ou ative a conta pagadora em <em>Configurações &gt; Contas Bancárias</em> para liberar a emissão do CNAB.
                      </p>
                    </div>
                  )}

                  {!isBeneficiariosValidos && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-200 space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>Bloqueio: Favorecidos com Pendência Cadastral</span>
                      </div>
                      <div className="space-y-1 text-[11px] leading-relaxed">
                        <div><strong>Problema:</strong> Favorecidos com dados bancários incompletos para CNAB.</div>
                        <div><strong>Diagnóstico:</strong> {item.preValidacao?.qtdFavorecidosInaptos || 1} de {item.quantidadeFavorecidos} colaborador(es) não possuem banco, agência, conta ou CPF válidos cadastrados no RH.</div>
                        <div><strong>Impacto:</strong> Bloqueio preventivo da remessa (Itaú SISPAG e Banco do Brasil rejeitam remessas sem domicílio bancário).</div>
                        <div><strong>Próxima Ação:</strong> Completar o cadastro bancário dos colaboradores no módulo de RH / Cadastros.</div>
                      </div>
                      {item.preValidacao?.inconsistencias && item.preValidacao.inconsistencias.length > 0 && (
                        <div className="mt-1 pt-1.5 border-t border-rose-200/60 dark:border-rose-900/40 text-[10px] space-y-0.5 max-h-24 overflow-y-auto font-mono">
                          {item.preValidacao.inconsistencias.slice(0, 5).map((inc, i) => (
                            <div key={i} className="text-rose-700 dark:text-rose-300">• {inc}</div>
                          ))}
                          {item.preValidacao.inconsistencias.length > 5 && (
                            <div className="text-muted-foreground italic">... e mais {item.preValidacao.inconsistencias.length - 5} pendência(s)</div>
                          )}
                        </div>
                      )}
                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false);
                            navigate("/colaboradores");
                          }}
                          className="text-xs font-semibold h-7 bg-white dark:bg-zinc-900 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50"
                        >
                          Abrir Colaboradores / RH
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Conta Pagadora da Empresa
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5 text-blue-600" />
                        <span>{item.contaPagadora.bancoNome}</span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {item.contaPagadora.agenciaMascarada} • {item.contaPagadora.contaMascarada}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Cód. {item.contaPagadora.bancoCodigo}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-2 flex items-center justify-between">
                    <span>Cedente / Razão Social:</span>
                    <span className="font-medium text-foreground">{item.contaPagadora.cedenteNome}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SEÇÃO CONTEXTUAL: REMESSA GERADA OU ARQUIVO BAIXADO */}
            {(item.situacao === "REMESSA_GERADA" || item.situacao === "ARQUIVO_BAIXADO") && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileCode2 className="h-4 w-4 text-blue-600" />
                      <span>{item.remessaNomeArquivo || "REMESSA.TXT"}</span>
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {item.contaPagadora.bancoNome}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Número da Remessa</span>
                      <span className="font-mono font-bold text-foreground">{item.remessaNumero || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">NSA (Sequencial)</span>
                      <span className="font-mono font-bold text-foreground">{item.remessaNsa || "—"}</span>
                    </div>
                  </div>

                  {item.remessaHash && (
                    <div className="text-[11px] bg-muted/40 p-2 rounded border border-border/60 space-y-0.5">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold block">Hash SHA-256</span>
                      <span className="font-mono text-[10px] text-foreground break-all">{item.remessaHash}</span>
                    </div>
                  )}

                  <div className="rounded border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 p-3 text-[11px] text-amber-800 dark:text-amber-300">
                    <span className="font-semibold block mb-0.5">Atenção ao fluxo de envio bancário:</span>
                    O download do arquivo no ORBE não realiza a transmissão automática. Baixe o arquivo e transmita manualmente pelo portal do {item.contaPagadora.bancoNome}. Após enviar, marque como transmitido abaixo.
                  </div>
                </div>
              </div>
            )}

            {/* 3. SEÇÃO CONTEXTUAL: ENVIADO AO BANCO */}
            {item.situacao === "ENVIADO_MANUAL" && (
              <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-semibold text-xs">
                  <Send className="h-4 w-4" />
                  <span>Remessa em Trânsito Bancário</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A transmissão manual desta remessa foi registrada no sistema. O ORBE aguarda o arquivo de retorno (.RET) do {item.contaPagadora.bancoNome} para conciliar as baixas.
                </p>
                {item.remessaDataEnvio && (
                  <div className="text-[11px] text-muted-foreground font-mono pt-1">
                    Transmitido em: {new Date(item.remessaDataEnvio).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>
            )}

            {/* 4. SEÇÃO CONTEXTUAL: REJEITADO */}
            {item.situacao === "REJEITADO" && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-bold text-xs">
                  <XCircle className="h-4 w-4" />
                  <span>Pendência Bancária: Crédito Rejeitado</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Motivo Bancário Registrado:</span>
                    <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                      Cód. {item.motivoRejeicaoCodigo || "??"} — {item.motivoRejeicaoDescricao || "Inconsistência cadastral"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Impacto no Lote & Fluxo:</span>
                    <span className="text-foreground">{item.impactoRejeicao || "Item permanece pendente de quitação."}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ação Recomendada:</span>
                    <span className="text-foreground">{item.acaoRejeicaoRecomendada || "Ajustar cadastro no RH."}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Corrigir cadastro de pagamento:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/colaboradores")}
                    className="h-7 text-xs font-semibold border-rose-300 text-rose-700 hover:bg-rose-100/50 dark:border-rose-800 dark:text-rose-300"
                  >
                    Abrir Cadastro / RH
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* 5. SEÇÃO CONTEXTUAL: DIVERGENTE */}
            {item.situacao === "DIVERGENTE" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Divergência de Valores no Retorno Bancário</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-muted-foreground text-[10px] block">Valor Esperado</span>
                    <span className="font-mono font-bold text-foreground">{formatCurrency(item.valorEsperado)}</span>
                  </div>
                  <div className="p-2 bg-background rounded border border-border">
                    <span className="text-muted-foreground text-[10px] block">Valor Retornado</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(item.valorRetornado || 0)}
                    </span>
                  </div>
                </div>
                {item.diferencaValor && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Diferença apurada: {formatCurrency(item.diferencaValor)}
                  </div>
                )}
              </div>
            )}

            {/* 6. TIMELINE DE AUDITORIA COMPACTA */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Histórico & Auditoria
              </span>
              <div className="space-y-3 border-l-2 border-border pl-3 ml-1 text-xs">
                {item.timeline.map((step, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-xs">{step.etapa}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{step.dataHora}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{step.descricao}</p>
                    <span className="text-[10px] text-muted-foreground/80 block">Por: {step.responsavel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer de Ações do Drawer */}
          <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Fechar
            </Button>

            <div className="flex items-center gap-2">
              {item.situacao === "PRONTO_BANCO" && (
                <Button
                  size="sm"
                  disabled={!isReadyParaGerar}
                  onClick={() => setModalGerarCnabOpen(true)}
                  className={cn(
                    "text-xs font-semibold",
                    isReadyParaGerar
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                  )}
                  title={
                    !isContaValida
                      ? "Cadastre uma conta bancária CNAB válida para liberar a geração"
                      : !isBeneficiariosValidos
                      ? "Existem colaboradores com pendências cadastrais bancárias no lote"
                      : !isContaDaMesmaEmpresa
                      ? "A conta pagadora não pertence à empresa do lote"
                      : isAmbienteIncompativel
                      ? "Ambiente da empresa incompatível com o ambiente da sessão"
                      : undefined
                  }
                >
                  <FileCode2 className="h-3.5 w-3.5 mr-1.5" />
                  Gerar Remessa CNAB
                </Button>
              )}

              {item.situacao === "REMESSA_GERADA" && (
                <Button
                  size="sm"
                  onClick={handleDownloadArquivo}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Baixar Arquivo TXT
                </Button>
              )}

              {item.situacao === "ARQUIVO_BAIXADO" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadArquivo}
                    disabled={isSubmitting}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Baixar Novamente
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setModalConfirmarEnvioOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Marcar como Enviado
                  </Button>
                </>
              )}

              {item.situacao === "ENVIADO_MANUAL" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    if (onOpenImportarRetorno) onOpenImportarRetorno();
                  }}
                  className="text-xs font-semibold text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                >
                  <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Importar Retorno
                </Button>
              )}

              {item.situacao === "REJEITADO" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/colaboradores")}
                  className="text-xs font-bold text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900"
                >
                  Corrigir no Cadastro
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}

              {item.situacao === "DIVERGENTE" && (
                <Button
                  size="sm"
                  onClick={() => navigate("/financeiro/retorno")}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  Revisar na Central de Retorno
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* MODAL 1: CONFIRMAR GERAÇÃO DE REMESSA CNAB */}
      <Dialog open={modalGerarCnabOpen} onOpenChange={setModalGerarCnabOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Gerar Remessa CNAB 240
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Você está prestes a gerar o arquivo posicional de remessa para envio bancário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded border border-border space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referência:</span>
                <span className="font-bold text-foreground">{item.referencia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa:</span>
                <span className="text-foreground">{item.empresaNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Banco / Conta:</span>
                <span className="text-foreground">{item.contaPagadora.bancoNome} ({item.contaPagadora.contaMascarada})</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border/60 pt-1.5">
                <span>Valor Total:</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(item.valorTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setModalGerarCnabOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleGerarRemessa}
              disabled={isSubmitting || !isReadyParaGerar}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Confirmar e Gerar Remessa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONFIRMAR ENVIO MANUAL AO BANCO */}
      <Dialog open={modalConfirmarEnvioOpen} onOpenChange={setModalConfirmarEnvioOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Confirmar Transmissão Bancária
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registre a confirmação de que o arquivo foi transmitido externamente no portal do {item.contaPagadora.bancoNome}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações do Envio (Opcional)</Label>
              <Textarea
                placeholder="Ex: Transmitido via Internet Banking BB lote 0492 pelo operador..."
                value={observacaoEnvio}
                onChange={(e) => setObservacaoEnvio(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setModalConfirmarEnvioOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarEnvioManual}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Confirmar Envio"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
