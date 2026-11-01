import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { getCurrentTenantId } from "@/services/domain/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn, decimalParaHora } from "@/lib/utils";
import {
  Loader2,
  Download,
  CheckCircle2,
  Lock,
  FileCode2,
  Landmark,
  Clock,
  AlertTriangle,
  Users,
  Calendar,
} from "lucide-react";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { DrawerSecundarioShell } from "@/components/continuity/DrawerSecundarioShell";
import { PipelineHorizontalBar, type PipelineStageItem } from "@/components/continuity/PipelineHorizontalBar";
import { TimelineVerticalStepper, type TimelineStageItem } from "@/components/continuity/TimelineVerticalStepper";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) => {
  if (!d) return "—";
  try {
    return format(new Date(d.length === 10 ? d + "T12:00:00" : d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

const canGenerateCnabForStatus = (status?: string | null) =>
  ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(String(status || ""));

export const buildIntermitentesStages = (lote: LoteIntermitente | null) => {
  if (!lote) {
    return {
      horizontalStages: [] as PipelineStageItem[],
      verticalStages: [] as TimelineStageItem[],
      isFlowDone: false,
    };
  }

  const isPago = lote.status === "PAGO" || lote.status === "pago";
  const isCnabGerado = String(lote.status).toUpperCase() === "CNAB_GERADO";
  const isAguardandoPagamento = lote.status === "AGUARDANDO_PAGAMENTO" || lote.status === "FECHADO_FINANCEIRO";
  const isValidadoRh = lote.status === "VALIDADO_RH";
  const isDevolvido = lote.status === "DEVOLVIDO" || lote.status === "devolvido";

  if (isPago) {
    const horizontalStages: PipelineStageItem[] = [
      { id: "fechamento", label: "Fechamento", compactLabel: "Fechamento", status: "done" },
      { id: "validacao_rh", label: "Validação RH", compactLabel: "RH", status: "done" },
      { id: "financeiro", label: "Financeiro", compactLabel: "Financeiro", status: "done" },
      { id: "cnab", label: "CNAB", compactLabel: "CNAB", status: "done" },
      { id: "conciliacao", label: "Conciliação", compactLabel: "Conciliação", status: "done" },
    ];
    const verticalStages: TimelineStageItem[] = [
      { id: "fechamento", label: "Fechamento do Período", responsible: lote.fechado_por || "Encarregado", description: "Lote de intermitentes fechado e jornadas consolidadas.", status: "done" },
      { id: "validacao_rh", label: "Validação RH", responsible: lote.validated_by || "RH", description: "Jornadas e horas conferidas e validadas pelo setor de RH.", status: "done" },
      { id: "financeiro", label: "Aprovação Financeira", responsible: "Financeiro", description: "Lote aprovado para geração de remessa bancária.", status: "done" },
      { id: "cnab", label: "Remessa CNAB 240", responsible: "Financeiro", description: "Arquivo de remessa gerado e enviado ao banco.", status: "done" },
      { id: "conciliacao", label: "Retorno e Conciliação Bancária", responsible: lote.paid_by || "Retorno Bancário", description: "Lançamentos conciliados e pagamento liquidado no banco.", status: "done" },
    ];
    return { horizontalStages, verticalStages, isFlowDone: true };
  }

  if (isCnabGerado) {
    const horizontalStages: PipelineStageItem[] = [
      { id: "fechamento", label: "Fechamento", compactLabel: "Fechamento", status: "done" },
      { id: "validacao_rh", label: "Validação RH", compactLabel: "RH", status: "done" },
      { id: "financeiro", label: "Financeiro", compactLabel: "Financeiro", status: "done" },
      { id: "cnab", label: "CNAB", compactLabel: "CNAB", status: "done" },
      { id: "conciliacao", label: "Conciliação", compactLabel: "Conciliação", status: "current" },
    ];
    const verticalStages: TimelineStageItem[] = [
      { id: "fechamento", label: "Fechamento do Período", responsible: lote.fechado_por || "Encarregado", description: "Lote de intermitentes fechado e jornadas consolidadas.", status: "done" },
      { id: "validacao_rh", label: "Validação RH", responsible: lote.validated_by || "RH", description: "Jornadas conferidas e validadas pelo setor de RH.", status: "done" },
      { id: "financeiro", label: "Aprovação Financeira", responsible: "Financeiro", description: "Lote aprovado para geração de remessa bancária.", status: "done" },
      { id: "cnab", label: "Remessa CNAB 240", responsible: "Financeiro", description: "Arquivo de remessa CNAB240 gerado com sucesso.", status: "done" },
      { id: "conciliacao", label: "Retorno e Conciliação Bancária", responsible: "Financeiro", description: "Aguardando importação do arquivo de retorno (.RET) para conciliação e liquidação.", status: "current" },
    ];
    return { horizontalStages, verticalStages, isFlowDone: false };
  }

  if (isAguardandoPagamento) {
    const horizontalStages: PipelineStageItem[] = [
      { id: "fechamento", label: "Fechamento", compactLabel: "Fechamento", status: "done" },
      { id: "validacao_rh", label: "Validação RH", compactLabel: "RH", status: "done" },
      { id: "financeiro", label: "Financeiro", compactLabel: "Financeiro", status: "done" },
      { id: "cnab", label: "CNAB", compactLabel: "CNAB", status: "current" },
      { id: "conciliacao", label: "Conciliação", compactLabel: "Conciliação", status: "pending" },
    ];
    const verticalStages: TimelineStageItem[] = [
      { id: "fechamento", label: "Fechamento do Período", responsible: lote.fechado_por || "Encarregado", description: "Lote fechado e jornadas consolidadas.", status: "done" },
      { id: "validacao_rh", label: "Validação RH", responsible: lote.validated_by || "RH", description: "Jornadas validadas com sucesso pelo RH.", status: "done" },
      { id: "financeiro", label: "Aprovação Financeira", responsible: "Financeiro", description: "Lote aprovado na Central Financeira. Liberado para CNAB.", status: "done" },
      { id: "cnab", label: "Remessa CNAB 240", responsible: "Financeiro", description: "Pronto para geração do arquivo CNAB240 para envio ao banco.", status: "current" },
      { id: "conciliacao", label: "Retorno e Conciliação Bancária", responsible: "Financeiro", description: "Aguardando geração da remessa.", status: "pending" },
    ];
    return { horizontalStages, verticalStages, isFlowDone: false };
  }

  if (isValidadoRh) {
    const horizontalStages: PipelineStageItem[] = [
      { id: "fechamento", label: "Fechamento", compactLabel: "Fechamento", status: "done" },
      { id: "validacao_rh", label: "Validação RH", compactLabel: "RH", status: "done" },
      { id: "financeiro", label: "Financeiro", compactLabel: "Financeiro", status: "current" },
      { id: "cnab", label: "CNAB", compactLabel: "CNAB", status: "pending" },
      { id: "conciliacao", label: "Conciliação", compactLabel: "Conciliação", status: "pending" },
    ];
    const verticalStages: TimelineStageItem[] = [
      { id: "fechamento", label: "Fechamento do Período", responsible: lote.fechado_por || "Encarregado", description: "Lote fechado e jornadas consolidadas.", status: "done" },
      { id: "validacao_rh", label: "Validação RH", responsible: lote.validated_by || "RH", description: "Jornadas validadas com sucesso pelo RH.", status: "done" },
      { id: "financeiro", label: "Aprovação Financeira", responsible: "Financeiro", description: "Aguardando análise e aprovação na Central Financeira.", status: "current" },
      { id: "cnab", label: "Remessa CNAB 240", responsible: "Financeiro", description: "Pendente de aprovação financeira.", status: "pending" },
      { id: "conciliacao", label: "Retorno e Conciliação Bancária", responsible: "Financeiro", description: "Aguardando remessa.", status: "pending" },
    ];
    return { horizontalStages, verticalStages, isFlowDone: false };
  }

  // Default: Aguardando Validação RH ou Devolvido
  const horizontalStages: PipelineStageItem[] = [
    { id: "fechamento", label: "Fechamento", compactLabel: "Fechamento", status: "done" },
    { id: "validacao_rh", label: "Validação RH", compactLabel: "RH", status: isDevolvido ? "devolved" : "current" },
    { id: "financeiro", label: "Financeiro", compactLabel: "Financeiro", status: "pending" },
    { id: "cnab", label: "CNAB", compactLabel: "CNAB", status: "pending" },
    { id: "conciliacao", label: "Conciliação", compactLabel: "Conciliação", status: "pending" },
  ];
  const verticalStages: TimelineStageItem[] = [
    { id: "fechamento", label: "Fechamento do Período", responsible: lote.fechado_por || "Encarregado", description: "Lote fechado pelo encarregado.", status: "done" },
    { id: "validacao_rh", label: "Validação RH", responsible: "RH", description: isDevolvido ? "Lote devolvido pelo RH para revisão." : "Aguardando conferência e validação das jornadas pelo RH.", status: isDevolvido ? "devolved" : "current" },
    { id: "financeiro", label: "Aprovação Financeira", responsible: "Financeiro", description: "Pendente de validação RH.", status: "pending" },
    { id: "cnab", label: "Remessa CNAB 240", responsible: "Financeiro", description: "Aguardando aprovação.", status: "pending" },
    { id: "conciliacao", label: "Retorno e Conciliação Bancária", responsible: "Financeiro", description: "Aguardando remessa.", status: "pending" },
  ];
  return { horizontalStages, verticalStages, isFlowDone: false };
};

type LoteIntermitente = {
  id: string;
  empresa_id: string;
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_registros?: number;
  quantidade_registros?: number;
  valor_total: number;
  status: string;
  fechado_por?: string;
  validated_by?: string | null;
  validated_at?: string | null;
  paid_by?: string | null;
  paid_at?: string | null;
  observacoes?: string | null;
  created_at: string;
  empresa?: { id?: string; nome?: string; cnpj?: string } | null;
};

const statusBadge = (status: string) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PAGO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Pago</span>;
    case "CNAB_GERADO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">CNAB Gerado</span>;
    case "FECHADO_FINANCEIRO":
    case "AGUARDANDO_PAGAMENTO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pronto para CNAB</span>;
    case "ENVIADO_FINANCEIRO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Enviado Financeiro</span>;
    case "APROVADO_RH":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Aprovado RH</span>;
    case "VALIDADO_RH":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Validado RH</span>;
    case "DEVOLVIDO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Devolvido</span>;
    case "RECEBIDO":
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Recebido</span>;
    default:
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">{status}</span>;
  }
};

interface CentralBancariaIntermitentesProps {
  onMetricsUpdate?: (metrics: { totalRemessas: number; totalTitulos: number; totalValor: number; remessasComErro: number }) => void;
  empresaId?: string;
  competencia?: string;
}

export const CentralBancariaIntermitentes: React.FC<CentralBancariaIntermitentesProps> = ({
  onMetricsUpdate,
  empresaId: filtroEmpresaId,
  competencia: filtroCompetencia,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estados dos Drawers
  const [selectedLote, setSelectedLote] = useState<LoteIntermitente | null>(null);
  const [isPrimaryDrawerOpen, setIsPrimaryDrawerOpen] = useState(false);
  const [isSecondaryDrawerOpen, setIsSecondaryDrawerOpen] = useState(false);

  // Estados do Modal CNAB
  const [openCnab, setOpenCnab] = useState(false);
  const [loteParaCnab, setLoteParaCnab] = useState<LoteIntermitente | null>(null);
  const [cnabContaBancariaId, setCnabContaBancariaId] = useState("");
  const [cnabEmpresaCnpj, setCnabEmpresaCnpj] = useState("");
  const [cnabEmpresaRazao, setCnabEmpresaRazao] = useState("");
  const [cnabEmpresaBanco, setCnabEmpresaBanco] = useState("001");
  const [cnabEmpresaAgencia, setCnabEmpresaAgencia] = useState("");
  const [cnabEmpresaDigito, setCnabEmpresaDigito] = useState("");
  const [cnabEmpresaConta, setCnabEmpresaConta] = useState("");
  const [cnabEmpresaDigitoConta, setCnabEmpresaDigitoConta] = useState("");
  const [cnabConvenio, setCnabConvenio] = useState("");

  // Query: Lotes de Intermitentes
  const { data: lotes = [], isLoading } = useQuery<LoteIntermitente[]>({
    queryKey: ["intermitentes_lotes_bancario", filtroEmpresaId, filtroCompetencia],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      let q = supabase
        .from("intermitentes_lotes_fechamento")
        .select("*, empresa:empresas(id, nome, cnpj)")
        .order("created_at", { ascending: false });

      const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
      q = EnvironmentQueryFilter.applyEmpresaScope(q, {
        tenantId,
        column: "empresa_id",
        includeNullInProduction: true,
        testIds,
      }) as any;

      if (filtroEmpresaId && filtroEmpresaId !== "all") {
        q = q.eq("empresa_id", filtroEmpresaId);
      }
      if (filtroCompetencia && filtroCompetencia !== "all") {
        q = q.eq("competencia", filtroCompetencia);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LoteIntermitente[];
    },
  });

  // Query: Empresas para lookup
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-bancario-intermitentes"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome, cnpj");
      return data || [];
    },
  });

  // Atualizar métricas externas do pai
  React.useEffect(() => {
    if (onMetricsUpdate && lotes.length > 0) {
      const totalRemessas = lotes.length;
      const totalTitulos = lotes.reduce((acc, l) => acc + (Number(l.total_registros) || Number(l.quantidade_registros) || 0), 0);
      const totalValor = lotes.reduce((acc, l) => acc + (Number(l.valor_total) || 0), 0);
      const pendentesPgto = lotes.filter((l) => ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO", "VALIDADO_RH"].includes(l.status)).length;
      onMetricsUpdate({ totalRemessas, totalTitulos, totalValor, remessasComErro: pendentesPgto });
    }
  }, [lotes, onMetricsUpdate]);

  // Query: Lançamentos do lote selecionado para o Drawer
  const {
    data: lancamentosLote = [],
    isLoading: isLoadingLancamentos,
    isError: isErrorLancamentos,
  } = useQuery({
    queryKey: ["lancamentos_intermitentes_lote", selectedLote?.id],
    queryFn: async () => {
      if (!selectedLote?.id) return [];
      const { data, error } = await supabase
        .from("lancamentos_intermitentes")
        .select(
          "id, data_referencia, nome_colaborador, cpf_colaborador, colaborador_id, cargo, horas_trabalhadas, horas_normais, he_50, he_100, hora_noturna, total, status_pipeline"
        )
        .eq("lote_fechamento_id", selectedLote.id)
        .order("data_referencia", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(selectedLote?.id),
  });

  // Query: Contas bancárias da empresa pagadora do lote selecionado para CNAB
  const { data: contasBancariasEmpresa = [] } = useQuery({
    queryKey: ["contas_bancarias_empresa_cnab", loteParaCnab?.empresa_id],
    queryFn: async () => {
      if (!loteParaCnab?.empresa_id) return [];
      const { data } = await supabase
        .from("contas_bancarias_empresa")
        .select("id, banco_codigo, banco_nome, agencia, agencia_digito, conta, conta_digito, convenio, ativo, is_padrao, cedente_cnpj, cedente_nome")
        .eq("empresa_id", loteParaCnab.empresa_id)
        .eq("ativo", true);
      return data || [];
    },
    enabled: Boolean(loteParaCnab?.empresa_id),
  });

  const aplicarContaBancaria = (conta: any, empObj: any) => {
    setCnabContaBancariaId(conta.id);
    setCnabEmpresaBanco(conta.banco_codigo || "001");
    setCnabEmpresaAgencia(conta.agencia || "");
    setCnabEmpresaDigito(conta.agencia_digito || "");
    setCnabEmpresaConta(conta.conta || "");
    setCnabEmpresaDigitoConta(conta.conta_digito || "");
    setCnabConvenio(conta.convenio || "");
    setCnabEmpresaCnpj(conta.cedente_cnpj || empObj?.cnpj || "");
    setCnabEmpresaRazao(conta.cedente_nome || empObj?.nome || "");
  };

  const handleOpenLoteDetails = (lote: LoteIntermitente) => {
    setSelectedLote(lote);
    setIsSecondaryDrawerOpen(false);
    setIsPrimaryDrawerOpen(true);
  };

  const handleCloseDrawers = () => {
    setIsPrimaryDrawerOpen(false);
    setIsSecondaryDrawerOpen(false);
  };

  const handleAbrirCnab = (lote: LoteIntermitente) => {
    setLoteParaCnab(lote);
    const emp = empresas.find((e: any) => e.id === lote.empresa_id);
    setCnabEmpresaCnpj(emp?.cnpj || "");
    setCnabEmpresaRazao(emp?.nome || "");
    setCnabContaBancariaId("");
    setCnabEmpresaBanco("001");
    setCnabEmpresaAgencia("");
    setCnabEmpresaDigito("");
    setCnabEmpresaConta("");
    setCnabEmpresaDigitoConta("");
    setCnabConvenio("");
    setOpenCnab(true);
  };

  // Mutation: Gerar CNAB
  const cnabMutation = useMutation({
    mutationFn: async () => {
      if (!loteParaCnab) throw new Error("Nenhum lote selecionado.");

      return IntermitentesLoteService.gerarCNABParaLote({
        loteId: loteParaCnab.id,
        empresaId: loteParaCnab.empresa_id,
        geradoPor: user?.id || "financeiro",
        geradoPorNome: user?.email || "Financeiro",
        empresaRemetente: {
          cnpj: cnabEmpresaCnpj,
          razao_social: cnabEmpresaRazao,
          banco_codigo: cnabEmpresaBanco,
          agencia: cnabEmpresaAgencia,
          agencia_digito: cnabEmpresaDigito || " ",
          conta: cnabEmpresaConta,
          digito_conta: cnabEmpresaDigitoConta || " ",
          convenio_bancario: cnabConvenio || undefined,
        },
      });
    },
    onSuccess: (data) => {
      toast.success(`CNAB240 gerado com sucesso! Arquivo: ${data.nomeArquivo}`);
      setOpenCnab(false);
      queryClient.invalidateQueries({ queryKey: ["intermitentes_lotes_bancario"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos_intermitentes_lote"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-remessas-historico"] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao gerar CNAB: ${err.message}`);
    },
  });

  const { horizontalStages, verticalStages } = useMemo(
    () => buildIntermitentesStages(selectedLote),
    [selectedLote]
  );

  const getEmpresaNome = (lote: LoteIntermitente) => {
    return lote.empresa?.nome || "Empresa";
  };

  return (
    <div className="space-y-4">
      {/* Tabela de Lotes de Intermitentes */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lotes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic">
            Nenhum lote de intermitentes encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="esc-table-header bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Lote / ID</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Competência / Período</th>
                  <th className="px-3 py-3 font-medium text-center">Registros</th>
                  <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                  <th className="px-3 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {lotes.map((lote) => (
                  <tr
                    key={lote.id}
                    onClick={() => handleOpenLoteDetails(lote)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      #{lote.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {getEmpresaNome(lote)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(lote.periodo_inicio)} até {formatDate(lote.periodo_fim)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs">
                      {lote.total_registros ?? lote.quantidade_registros ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {formatCurrency(Number(lote.valor_total || 0))}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {statusBadge(lote.status)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {canGenerateCnabForStatus(lote.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-medium"
                          onClick={() => handleAbrirCnab(lote)}
                        >
                          <FileCode2 className="h-3.5 w-3.5 mr-1" />
                          Gerar CNAB
                        </Button>
                      ) : lote.status === "PAGO" || lote.status === "pago" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DRAWER PRIMÁRIO: DETALHES DO LOTE ── */}
      <DrawerPrimarioShell
        isOpen={isPrimaryDrawerOpen}
        onClose={handleCloseDrawers}
        title="Detalhes do Lote de Intermitentes"
        widthClass="w-full sm:max-w-2xl"
        badge={selectedLote ? statusBadge(selectedLote.status) : null}
        subtitle={
          selectedLote ? (
            <span>
              <strong className="text-foreground">{getEmpresaNome(selectedLote)} · </strong>
              Período: {formatDate(selectedLote.periodo_inicio)} até {formatDate(selectedLote.periodo_fim)}
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {selectedLote && canGenerateCnabForStatus(selectedLote.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    if (selectedLote) handleAbrirCnab(selectedLote);
                    handleCloseDrawers();
                  }}
                >
                  <FileCode2 className="h-4 w-4 mr-2" /> Gerar CNAB
                </Button>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Button variant="ghost" size="sm" onClick={handleCloseDrawers}>
                Fechar
              </Button>
              {(selectedLote?.status === "PAGO" || selectedLote?.status === "pago") ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Pagamento Concluído
                </span>
              ) : String(selectedLote?.status).toUpperCase() === "CNAB_GERADO" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 border border-amber-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  Aguardando conciliação bancária
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Baixa via Retorno Bancário
                </span>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Pipeline Horizontal Compacto */}
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pipeline Operacional e Financeiro
              </span>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                onClick={() => setIsSecondaryDrawerOpen(true)}
              >
                Ver fluxo completo →
              </button>
            </div>
            <PipelineHorizontalBar stages={horizontalStages} />
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg bg-background border border-border/50">
              <p className="text-[10px] uppercase font-mono text-muted-foreground">Lançamentos</p>
              <p className="text-base font-bold font-mono text-foreground">
                {selectedLote?.total_registros ?? selectedLote?.quantidade_registros ?? lancamentosLote.length ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background border border-border/50">
              <p className="text-[10px] uppercase font-mono text-muted-foreground">Intermitentes</p>
              <p className="text-base font-bold font-mono text-foreground">
                {isErrorLancamentos
                  ? "—"
                  : isLoadingLancamentos
                  ? "..."
                  : new Set(lancamentosLote.map((l: any) => l.colaborador_id || l.cpf_colaborador || l.nome_colaborador)).size}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background border border-border/50">
              <p className="text-[10px] uppercase font-mono text-muted-foreground">Status</p>
              <div className="mt-0.5">{selectedLote && statusBadge(selectedLote.status)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-background border border-border/50">
              <p className="text-[10px] uppercase font-mono text-muted-foreground">Valor Total</p>
              <p className="text-base font-bold font-mono text-emerald-600">
                {formatCurrency(Number(selectedLote?.valor_total || 0))}
              </p>
            </div>
          </div>

          {/* Seção: Composição do Lote */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Composição do Lote ({lancamentosLote.length} {lancamentosLote.length === 1 ? "lançamento" : "lançamentos"})
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {formatCurrency(Number(selectedLote?.valor_total || 0))}
              </span>
            </div>

            {isLoadingLancamentos ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs">Carregando lançamentos do lote...</span>
              </div>
            ) : isErrorLancamentos ? (
              <div className="p-6 text-center rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-rose-600" />
                <p className="font-semibold text-sm">Erro ao carregar lançamentos do lote</p>
                <p className="text-xs text-rose-600 mt-1">
                  Não foi possível consultar os registros associados. Tente novamente ou contate o suporte.
                </p>
              </div>
            ) : lancamentosLote.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic bg-muted/10 rounded-lg border border-dashed border-border/60">
                Nenhum lançamento vinculado ao lote.
              </div>
            ) : (
              <div className="space-y-2.5">
                {lancamentosLote.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-background border border-border/80 rounded-lg shadow-sm flex flex-col gap-2.5 hover:border-slate-300 transition-colors"
                  >
                    {/* Linha Superior: Nome + Cargo / CPF (esquerda) | Valor Total + Status (direita) */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm truncate">
                          {item.nome_colaborador || "Intermitente"}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mt-0.5">
                          <span>{item.cargo || "Auxiliar"}</span>
                          {item.cpf_colaborador && (
                            <>
                              <span className="text-border">·</span>
                              <span className="font-mono text-[11px]">{item.cpf_colaborador}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-mono font-bold text-emerald-600">
                          {formatCurrency(Number(item.total || 0))}
                        </span>
                        <div>
                          {statusBadge(item.status_pipeline)}
                        </div>
                      </div>
                    </div>

                    {/* Linha Inferior: Data (esquerda) | Horas Trabalhadas + Detalhamento (direita) */}
                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDate(item.data_referencia)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                        <span className="font-semibold text-slate-800">
                          {decimalParaHora(item.horas_trabalhadas || 0)} trabalhadas
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {decimalParaHora(item.horas_normais || 0)} normais
                        </span>
                        {Number(item.he_50 || 0) > 0 && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {decimalParaHora(item.he_50)} HE50
                            </span>
                          </>
                        )}
                        {Number(item.he_100 || 0) > 0 && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                              {decimalParaHora(item.he_100)} HE100
                            </span>
                          </>
                        )}
                        {Number(item.hora_noturna || 0) > 0 && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-indigo-600 font-medium">
                              {decimalParaHora(item.hora_noturna)} noturna
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerPrimarioShell>

      {/* ── DRAWER SECUNDÁRIO: LINHA DO TEMPO / FLUXO COMPLETO ── */}
      <DrawerSecundarioShell
        isOpen={isSecondaryDrawerOpen}
        onBack={() => setIsSecondaryDrawerOpen(false)}
        onClose={handleCloseDrawers}
        title="Linha do Tempo — Intermitentes"
        widthClass="w-full sm:max-w-2xl"
        badge={selectedLote ? statusBadge(selectedLote.status) : null}
        hideOverlay={true}
        subtitle={
          selectedLote ? (
            <span>
              Lote #{selectedLote.id.substring(0, 8)} · Período: {formatDate(selectedLote.periodo_inicio)} até {formatDate(selectedLote.periodo_fim)}
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setIsSecondaryDrawerOpen(false)}>
              ← Voltar aos detalhes
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCloseDrawers}>
              Fechar
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Empresa / Lote</p>
                <p className="font-semibold text-sm text-foreground">{selectedLote ? getEmpresaNome(selectedLote) : "Empresa"}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">#{selectedLote?.id.substring(0, 8)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Valor Total a Pagar</p>
                <p className="font-mono font-bold text-lg text-emerald-600">
                  {formatCurrency(Number(selectedLote?.valor_total || 0))}
                </p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Etapas do Ciclo Operacional e Financeiro
            </h4>
            <TimelineVerticalStepper stages={verticalStages} />
          </div>
        </div>
      </DrawerSecundarioShell>

      {/* ── MODAL DE GERAÇÃO CNAB MULTIBANCO (001 / 341) ── */}
      <Dialog open={openCnab} onOpenChange={setOpenCnab}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-indigo-600" />
              Geração de Remessa CNAB 240 — Intermitentes
            </DialogTitle>
            <DialogDescription>
              Gere o arquivo de remessa bancária posicional oficial para pagamento das jornadas intermitentes aprovadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-700">
              <Landmark className="inline h-3.5 w-3.5 mr-1" />
              Informe ou selecione a <strong>conta pagadora da empresa</strong>. O layout correspondente será selecionado automaticamente.
            </div>

            {/* Seletor de Conta Bancária Cadastrada */}
            {contasBancariasEmpresa.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="cnab-conta-seletor" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conta Bancária Cadastrada
                </Label>
                <Select
                  value={cnabContaBancariaId}
                  onValueChange={(val) => {
                    const selecionada = contasBancariasEmpresa.find((c: any) => c.id === val);
                    if (selecionada) {
                      aplicarContaBancaria(selecionada, empresas.find((e: any) => e.id === loteParaCnab?.empresa_id));
                    }
                  }}
                >
                  <SelectTrigger id="cnab-conta-seletor">
                    <SelectValue placeholder="Selecione uma conta cadastrada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancariasEmpresa.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.banco_nome || (c.banco_codigo === "341" ? "Itaú Unibanco" : "Banco do Brasil")} ({c.banco_codigo}) — Ag: {c.agencia} / CC: {c.conta}{c.conta_digito ? `-${c.conta_digito}` : ""} {c.is_padrao ? "(Padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cnab-cnpj">CNPJ / CPF da Empresa Pagadora</Label>
                <Input
                  id="cnab-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnabEmpresaCnpj}
                  onChange={(e) => setCnabEmpresaCnpj(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cnab-banco">Banco (código)</Label>
                  <Input
                    id="cnab-banco"
                    placeholder="Ex: 341"
                    maxLength={3}
                    value={cnabEmpresaBanco}
                    onChange={(e) => setCnabEmpresaBanco(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cnab-agencia">Agência</Label>
                  <Input
                    id="cnab-agencia"
                    placeholder="0001"
                    value={cnabEmpresaAgencia}
                    onChange={(e) => setCnabEmpresaAgencia(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cnab-digito">Dígito</Label>
                  <Input
                    id="cnab-digito"
                    placeholder="0"
                    maxLength={2}
                    value={cnabEmpresaDigito}
                    onChange={(e) => setCnabEmpresaDigito(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnab-conta">Conta da empresa</Label>
                <Input
                  id="cnab-conta"
                  placeholder="Número da conta sem dígito"
                  value={cnabEmpresaConta}
                  onChange={(e) => setCnabEmpresaConta(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            {/* Feedback visual dinâmico do layout multibanco */}
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Motor Multibanco:</span>
                {cnabEmpresaBanco === "341" ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 font-bold border border-amber-500/30">
                    Itaú (341) — SISPAG
                  </span>
                ) : cnabEmpresaBanco === "001" ? (
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 font-bold border border-blue-500/30">
                    Banco do Brasil (001) — CNAB240
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive font-bold border border-destructive/30">
                    Banco {cnabEmpresaBanco || "?"} — Não homologado
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {cnabEmpresaBanco === "341" || cnabEmpresaBanco === "001"
                  ? "O arquivo seguirá o layout posicional oficial com 240 caracteres por linha. A geração é auditada e preserva rastreabilidade sem marcar pagamento antecipado."
                  : "Apenas os bancos 001 (BB) e 341 (Itaú) possuem layouts CNAB240 homologados no ORBE nesta versão. A geração será bloqueada para outros bancos."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCnab(false)} disabled={cnabMutation.isPending}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={
                !cnabEmpresaBanco ||
                !cnabEmpresaAgencia ||
                !cnabEmpresaConta ||
                !cnabEmpresaCnpj.trim() ||
                !["001", "341"].includes(cnabEmpresaBanco.padStart(3, "0")) ||
                cnabMutation.isPending
              }
              onClick={() => cnabMutation.mutate()}
            >
              {cnabMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileCode2 className="h-4 w-4 mr-2" />
              )}
              {cnabMutation.isPending ? "Gerando..." : "Gerar e Baixar CNAB"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
