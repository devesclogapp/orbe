import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Trash2,
  Upload,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { RightPanel } from "@/components/layout/RightPanel";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { MetricCard } from "@/components/painel/MetricCard";
import { StatusChip } from "@/components/painel/StatusChip";
import { PontoOperacoesBlock } from "@/components/painel/PontoOperacoesBlock";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAdminOverride } from "@/hooks/useAdminOverride";
import {
  AIService,
  ColaboradorService,
  EmpresaService,
  LogSincronizacaoService,
  OperacaoService,
  OperacaoProducaoService,
  TipoServicoOperacionalService,
  FornecedorService,
  TransportadoraClienteService
} from "@/services/base.service";

type EmpresaOption = {
  id: string;
  nome: string;
};

type ColaboradorResumo = {
  nome?: string | null;
};

type InconsistenciaRow = {
  id: string;
  data?: string | null;
  empresa_id?: string | null;
  status?: string | null;
  tipo_servico?: string | null;
  quantidade?: number | string | null;
  colaboradores?: ColaboradorResumo | null;
};

type ImportacaoLogRow = {
  id: string;
  data?: string | null;
  empresa_id?: string | null;
  origem?: string | null;
  status?: keyof typeof statusMap | string | null;
  contagem_registros?: number | null;
  duracao?: string | null;
  empresas?: EmpresaOption | null;
};

type OperacaoPainelRow = {
  valor_total_label?: number | string | null;
  quantidade?: number | string | null;
  valor_unitario?: number | string | null;
};

type ProcessDayResponse = {
  resultado?: Array<{
    valor_total_calculado?: number | null;
  }> | null;
};

type RowValue = string | number | boolean | null | undefined;
type SpreadsheetRow = Record<string, RowValue>;

type NamedEntity = {
  id: string;
  nome: string;
};

type CreatableNamedService = {
  create: (payload: Record<string, unknown>) => Promise<NamedEntity>;
};

type ImportedOperationPayload = {
  data_operacao: string;
  empresa_id: string;
  tipo_servico_id: string | null;
  fornecedor_id: string | null;
  transportadora_id: string | null;
  entrada_ponto: string | null;
  saida_ponto: string | null;
  tipo_calculo_snapshot: "volume";
  valor_unitario_snapshot: number;
  quantidade: number;
  quantidade_colaboradores: number;
  valor_total: number;
  placa: RowValue;
  nf_numero: RowValue;
  ctrc: RowValue;
  percentual_iss: number;
  valor_descarga: number;
  custo_com_iss: number;
  valor_unitario_filme: number;
  quantidade_filme: number;
  valor_total_filme: number;
  valor_faturamento_nf: number;
  avaliacao_json: Record<string, unknown>;
  status: "pendente";
  origem_dado: "importacao";
};

const normalizeSpreadsheetRow = (row: SpreadsheetRow) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? format(value, "yyyy-MM-dd HH:mm:ss") : value,
    ]),
  );

const parseExcelTime = (val: RowValue): string | null => {
  if (!val) return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return format(val, "HH:mm:ss");
  }

  if (typeof val === "number") {
    const totalSeconds = Math.round((val % 1) * 24 * 60 * 60);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const str = String(val).trim();
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
  return null;
};

const statusMap = {
  sucesso: { label: "Sucesso", icon: CheckCircle2, cls: "bg-success-soft text-success-strong" },
  erro: { label: "Erro", icon: XCircle, cls: "bg-destructive-soft text-destructive-strong" },
  parcial: { label: "Parcial", icon: AlertCircle, cls: "bg-warning-soft text-warning-strong" },
};

const CentralOperacional = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const dateValue = format(selectedDate, "yyyy-MM-dd");

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<EmpresaOption[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  useEffect(() => {
    setConfirmClear(false);
  }, [selectedEmpresaId]);

  const { data: colaboradores = [], isLoading: isLoadingCols } = useQuery<ColaboradorResumo[]>({
    queryKey: ["colaboradores", selectedEmpresaId],
    queryFn: () => ColaboradorService.getWithEmpresa(selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: operacoes = [], isLoading: isLoadingOps } = useQuery<OperacaoPainelRow[]>({
    queryKey: ["operacoes", dateValue, selectedEmpresaId],
    queryFn: () => OperacaoService.getPainelByDate(dateValue, selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: logsImportacao = [], isLoading: isLoadingLogs } = useQuery<ImportacaoLogRow[]>({
    queryKey: ["importacoes"],
    queryFn: () => LogSincronizacaoService.getWithEmpresa(),
  });

  const { data: issues = [], isLoading: isLoadingIssues } = useQuery<InconsistenciaRow[]>({
    queryKey: ["inconsistencias"],
    queryFn: () => OperacaoService.getInconsistencies(),
  });

  const {
    isOpen,
    isUpdating,
    pendingStatus,
    checkAndExecute,
    handleConfirm,
    handleClose,
  } = useAdminOverride({
    onUpdate: async (id, payload, justification) => {
      await OperacaoService.updateWithOverride(id, payload, justification);
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    },
  });

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const sameDate = issue.data === dateValue;
        const sameEmpresa = selectedEmpresaId === "all" || issue.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [issues, dateValue, selectedEmpresaId]
  );

  const filteredLogs = useMemo(
    () =>
      logsImportacao.filter((log) => {
        const sameDate = String(log.data || "").startsWith(dateValue);
        const sameEmpresa = selectedEmpresaId === "all" || log.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [logsImportacao, dateValue, selectedEmpresaId]
  );

  const totalCalculado = operacoes.reduce(
    (acc, op) => acc + Number(op.valor_total_label ?? (Number(op.quantidade) * Number(op.valor_unitario || 0))),
    0
  );

  const ultimaImportacao = filteredLogs[0];
  const isLoading =
    isLoadingEmpresas ||
    isLoadingCols ||
    isLoadingOps ||
    isLoadingLogs ||
    isLoadingIssues;

  const clearMutation = useMutation({
    mutationFn: () => OperacaoProducaoService.deleteImported(
      selectedEmpresaId === "all" ? undefined : selectedEmpresaId,
      dateValue,
      dateValue
    ),
    onSuccess: (deletedCount: number) => {
      if (deletedCount === 0) {
        toast.warning("Nenhum registro foi removido.", {
          description: "Se havia itens importados visíveis, verifique se a policy de DELETE da tabela operacoes_producao já foi aplicada no banco.",
        });
        setConfirmClear(false);
        return;
      }

      toast.success("Importações limpas com sucesso!", {
        description:
          selectedEmpresaId === "all"
            ? `${deletedCount} registro(s) importado(s) de ${format(selectedDate, "dd/MM/yyyy")} foram removidos.`
            : `${deletedCount} registro(s) importado(s) da empresa selecionada em ${format(selectedDate, "dd/MM/yyyy")} foram removidos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      setConfirmClear(false);
    },
    onError: (err: Error) => {
      toast.error("Erro ao limpar importações", { description: err.message });
      setConfirmClear(false);
    },
  });

  const handleClearImports = () => {
    if (!selectedEmpresaId) {
      toast.warning("Selecione ao menos uma data para limpar as importações.");
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000); // auto-cancel após 5s
      return;
    }
    clearMutation.mutate();
  };

  const processMutation = useMutation({
    mutationFn: (empresaId: string) => AIService.processDay(dateValue, empresaId),
    onSuccess: (res: ProcessDayResponse) => {
      toast.success("Processamento concluído", {
        description: `Resultado consolidado: R$ ${res.resultado?.[0]?.valor_total_calculado?.toLocaleString("pt-BR") || "0,00"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      queryClient.invalidateQueries({ queryKey: ["ponto"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_mensais"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_processamento"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao processar", { description: err.message });
    },
  });

  const handleProcessar = () => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa específica", {
        description: "O processamento precisa de uma unidade operacional definida.",
      });
      return;
    }
    processMutation.mutate(selectedEmpresaId);
  };

  const handleResolve = async (issue: InconsistenciaRow) => {
    const payload = { status: "ok" };
    const needsOverride = checkAndExecute(issue.id, payload, issue.status);

    if (!needsOverride) {
      try {
        await OperacaoService.update(issue.id, payload);
        toast.success("Inconsistência resolvida com sucesso");
        queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao resolver inconsistência";
        toast.error(message);
      }
    }
  };

  const parseExcelDate = (val: RowValue): string | null => {
    if (!val) return null;

    if (val instanceof Date && !Number.isNaN(val.getTime())) {
      return format(val, "yyyy-MM-dd");
    }

    // Número serial do Excel (ex: 46038) — base: 1 Jan 1900 = serial 1
    if (typeof val === 'number') {
      try {
        // Excel tem bug histórico (dia 60 = 29/02/1900 inexistente), ajuste padrão
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + val * 86400000);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch { /* fallback */ }
    }

    const str = String(val).trim();

    // DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

    // DD/MM/YYYY HH:mm[:ss]
    const dmyDateTimeMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)$/);
    if (dmyDateTimeMatch) return `${dmyDateTimeMatch[3]}-${dmyDateTimeMatch[2]}-${dmyDateTimeMatch[1]}`;

    // YYYY-MM-DD já no formato correto
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // YYYY-MM-DD HH:mm[:ss]
    const isoDateTimeMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}(?::\d{2})?)$/);
    if (isoDateTimeMatch) return isoDateTimeMatch[1];

    return null;
  };

  const handleImport = async (data: SpreadsheetRow[]) => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa específica antes de importar", {
        description: "A importação deve ser vinculada diretamente a uma unidade operacional.",
      });
      return;
    }

    let count = 0;
    let ignoredRows = 0;
    try {
      let headerRowIndex = -1;
      const headerMap: Record<string, string> = {};

      // Procura nas chaves caso a biblioteca já tenha lido como header
      if (data.length > 0) {
        const keys = Object.keys(data[0]).map(k => k.toUpperCase());
        if (keys.some(k => k.includes("OPERA") || k.includes("SERVIC") || k.includes("DESCRI") || k.includes("TIPO") || k.includes("VISTORIA") || k.includes("DESCARGA"))) {
          headerRowIndex = -2;
        }
      }

      if (headerRowIndex !== -2) {
        for (let i = 0; i < Math.min(data.length, 50); i++) {
          const row = data[i];
          const values = Object.values(row).map(v => String(v).toUpperCase().trim());
          if (values.some(v => v.includes("OPERA") || v.includes("SERVIC") || v.includes("DESCRI"))) {
            headerRowIndex = i;
            for (const key of Object.keys(row)) {
              if (row[key]) headerMap[key] = String(row[key]).toUpperCase().replace(':', '').trim();
            }
            break;
          }
        }
      }

      let parsedData = data;
      if (headerRowIndex >= 0) {
        parsedData = [];
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const newRow: SpreadsheetRow = {};
          for (const key of Object.keys(data[i])) {
            const mappedKey = headerMap[key] || key;
            newRow[mappedKey] = data[i][key];
          }
          parsedData.push(newRow);
        }
      }

      const getVal = (row: SpreadsheetRow, ...aliases: string[]): RowValue => {
        const normRow = Object.keys(row).reduce<Record<string, RowValue>>((acc, k) => {
          acc[k.toUpperCase().replace(':', '').trim()] = row[k];
          return acc;
        }, {});

        for (const k of aliases) {
          if (normRow[k.toUpperCase()] !== undefined && normRow[k.toUpperCase()] !== null) {
            return normRow[k.toUpperCase()];
          }
        }

        for (const k of aliases) {
          const matchKey = Object.keys(normRow).find(rowKey => rowKey.includes(k.toUpperCase()));
          if (matchKey && normRow[matchKey] !== undefined && normRow[matchKey] !== null) {
            return normRow[matchKey];
          }
        }

        return null;
      };

      // Carregar os dicionários base
      const tiposServicoAtivos = await TipoServicoOperacionalService.getAllActive();
      const fornecedoresAtivos = await FornecedorService.getByEmpresa(selectedEmpresaId);
      const transportadorasAtivas = await TransportadoraClienteService.getByEmpresa(selectedEmpresaId);
      const importedOperations: ImportedOperationPayload[] = [];

      const ensureRecord = async (
        cache: NamedEntity[],
        name: string,
        serviceRef: CreatableNamedService,
        additionalPayload?: Record<string, unknown>
      ) => {
        if (!name) return null;
        let match = cache.find(t => t.nome.toUpperCase().trim() === name.toUpperCase().trim());
        if (!match) {
          match = await serviceRef.create({ nome: name, ativo: true, ...additionalPayload });
          cache.push(match);
        }
        return match.id;
      };

      for (const row of parsedData) {
        const operacaoName = String(getVal(row, 'DESCRIÇÃO', 'DESCRICAO', 'OPERAÇÃO', 'OPERACA', 'SERVIÇO', 'SERVIC', 'TIPO') || '');
        if (!operacaoName) {
          console.log("Ignorando linha por falta de operação", row);
          continue;
        }

        const fornecedorName = String(getVal(row, 'FORNECEDOR', 'PRODUTO', 'CLIENTE') || '');
        const transportadoraName = String(getVal(row, 'TRANSPORTADORA', 'VIAÇÃO', 'VIACAO') || '');

        const tipoServicoId = await ensureRecord(tiposServicoAtivos, operacaoName, TipoServicoOperacionalService);
        const fornecedorId = await ensureRecord(fornecedoresAtivos, fornecedorName || 'NÃO ESPECIFICADO', FornecedorService, { empresa_id: selectedEmpresaId });
        const transportadoraId = await ensureRecord(transportadorasAtivas, transportadoraName || 'NÃO ESPECIFICADA', TransportadoraClienteService, { empresa_id: selectedEmpresaId });

        // Lê a data diretamente de cada linha — pode ser serial do Excel, DD/MM/YYYY ou YYYY-MM-DD
        const dataLinha = getVal(row, 'DATA', 'DT', 'DATE', 'DT. OPERACAO', 'DT OPERACAO');
        const dataFinal = parseExcelDate(dataLinha);
        if (!dataFinal) {
          ignoredRows++;
          continue;
        }

        const inicioOperacao = parseExcelTime(getVal(row, 'INICIO', 'INÍCIO', 'ENTRADA'));
        const terminoOperacao = parseExcelTime(getVal(row, 'TERMINO', 'TÉRMINO', 'FIM', 'SAIDA', 'SAÍDA'));

        // Número de colaboradores envolvidos (coluna COL)
        const qtdColaboradores = Number(getVal(row, 'COL', 'COLABORADORES', 'QTD COL', 'NUM COL') || 1);

        importedOperations.push({
          data_operacao: dataFinal,
          empresa_id: selectedEmpresaId,
          tipo_servico_id: tipoServicoId,
          fornecedor_id: fornecedorId,
          transportadora_id: transportadoraId,
          entrada_ponto: inicioOperacao,
          saida_ponto: terminoOperacao,
          tipo_calculo_snapshot: 'volume',
          valor_unitario_snapshot: Number(getVal(row, 'VALOR UNITARIO', 'VAL UNIT.', 'VALOR UNIT.', 'UNITARIO') || 0),

          quantidade: Number(getVal(row, 'QUANTITATIVO', 'QTD', 'QUANTIDADE', 'VOLUMES') || 1),
          quantidade_colaboradores: qtdColaboradores,
          valor_total: Number(getVal(row, 'TOTAL', 'VALOR TOTAL') || 0),

          placa: getVal(row, 'PLACA'),
          nf_numero: getVal(row, 'NF', 'NOTA FISCAL'),
          ctrc: getVal(row, 'CTRC'),
          percentual_iss: Number(getVal(row, 'LÍQUOTA DE ISS', 'LIQUOTA DE ISS', '% ISS', 'ISS') || 0),
          valor_descarga: Number(getVal(row, 'VALOR DE DESCARGA', 'VAL DESCARGA', 'DESCARGA') || 0),
          custo_com_iss: Number(getVal(row, 'CUSTO COM ISS', 'CUSTO ISS', 'ISS TOTAL') || 0),
          valor_unitario_filme: Number(getVal(row, 'UNIT FILME', 'VALOR FILME') || 0),
          quantidade_filme: Number(getVal(row, 'QTD FILME', 'QUANTIDADE FILME') || 0),
          valor_total_filme: Number(getVal(row, 'TOTAL FILME', 'CUSTO FILME') || 0),
          valor_faturamento_nf: Number(getVal(row, 'FATURAMENTO - NF', 'FATURAMENTO', 'LIQUIDO') || 0),
          avaliacao_json: {
            origem_importacao: "planilha",
            contexto_importacao: {
              id_planilha: getVal(row, 'ID'),
              empresa_planilha: getVal(row, 'EMPRESA'),
              forma_pagamento: getVal(row, 'FORMA DE PAGAMENTO'),
              observacao: getVal(row, 'OBSERVAÇÃO', 'OBSERVACAO'),
            },
            linha_original: normalizeSpreadsheetRow(row),
          },

          status: 'pendente',
          origem_dado: 'importacao'
        });
        count++;
      }
      const replacedCount = await OperacaoProducaoService.replaceImportedBatch(
        selectedEmpresaId,
        importedOperations,
      );

      const datasImportadas = Array.from(
        new Set(importedOperations.map((item) => item.data_operacao)),
      ).sort();

      if (datasImportadas.length > 0) {
        setSelectedDate(new Date(`${datasImportadas[0]}T12:00:00`));
      }

      toast.success(`${replacedCount} registros operacionais importados com sucesso!`, {
        description:
          datasImportadas.length === 1
            ? `${ignoredRows > 0 ? `${ignoredRows} linha(s) sem data válida foram ignoradas. ` : ""}Dados atualizados para ${format(new Date(`${datasImportadas[0]}T12:00:00`), "dd/MM/yyyy")}.`
            : `${ignoredRows > 0 ? `${ignoredRows} linha(s) sem data válida foram ignoradas. ` : ""}Todas as linhas importadas já estão disponíveis na aba Operações.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
      await queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      await queryClient.refetchQueries({ queryKey: ["operacoes"] });
      await queryClient.refetchQueries({ queryKey: ["operacoes-grid"] });
      setImportModalOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao processar a planilha.";
      toast.error("Erro na importação de planilha.", { description: message });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
    }
  };

  return (
    <AppShell
      title="Central Operacional"
      subtitle={`Importar, validar e corrigir o dia operacional · ${format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
      rightPanel={<RightPanel />}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal h-10 px-4 esc-card-hover border-border border",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {format(selectedDate, "dd/MM/yyyy")}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="w-[280px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Selecione a empresa" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge
                className={cn(
                  "h-10 px-3 rounded-md font-semibold",
                  filteredIssues.length > 0
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong"
                )}
              >
                {filteredIssues.length > 0
                  ? `${filteredIssues.length} inconsistência(s) em aberto`
                  : "Dia consistente até o momento"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Relatórios
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/importacoes")}>
                <UploadCloud className="h-4 w-4 mr-2" />
                Histórico completo
              </Button>
              <Button
                size="sm"
                className="shadow-lg shadow-primary/20"
                onClick={handleProcessar}
                disabled={processMutation.isPending || isLoading}
              >
                {processMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                {processMutation.isPending ? "Processando..." : "Processar dia"}
              </Button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando o contexto operacional consolidado...
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard label="Colaboradores" value={colaboradores.length.toString()} icon={Building2} />
              <MetricCard label="Operações" value={operacoes.length.toString()} icon={UploadCloud} />
              <MetricCard
                label="Total do dia"
                value={`R$ ${totalCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={PlayCircle}
                accent
              />
              <MetricCard label="Inconsistências" value={filteredIssues.length.toString()} icon={AlertTriangle} />
              <MetricCard
                label="Última sincronização"
                value={ultimaImportacao ? new Date(ultimaImportacao.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sem sync"}
                icon={Upload}
              />
            </div>

            <Tabs defaultValue="processamento" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <TabsTrigger value="processamento">Processamento</TabsTrigger>
                <TabsTrigger value="importacoes">Importações</TabsTrigger>
                <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
              </TabsList>

              <TabsContent value="processamento" className="space-y-5">
                <section className="esc-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Resumo do dia operacional</h2>
                      <p className="text-sm text-muted-foreground">
                        Dados operacionais na tela principal. Resultado consolidado e status inteligente aparecem ao selecionar um colaborador.
                      </p>
                    </div>
                    {selectedEmpresaId === "all" && (
                      <Badge className="bg-info-soft text-info-strong">
                        Selecione uma empresa para processar
                      </Badge>
                    )}
                  </div>
                  <PontoOperacoesBlock date={dateValue} empresaId={selectedEmpresaId} filterOperationsByDate={false} />
                </section>
              </TabsContent>

              <TabsContent value="importacoes" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Importações e sincronizações</h2>
                      <p className="text-sm text-muted-foreground">
                        Acompanhamento do que entrou hoje antes do processamento.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {confirmClear ? (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-1.5">
                          <span className="text-xs font-medium text-destructive-strong">
                            Confirmar limpeza do dia?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={handleClearImports}
                            disabled={clearMutation.isPending}
                          >
                            {clearMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Sim, limpar"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setConfirmClear(false)}
                            disabled={clearMutation.isPending}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive-soft hover:text-destructive-strong border-destructive/30"
                          onClick={handleClearImports}
                          disabled={!selectedEmpresaId}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpar importações
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar planilha
                      </Button>
                      <Button size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar agora
                      </Button>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Data / hora</th>
                        <th className="px-3 h-11 font-medium">Origem</th>
                        <th className="px-3 h-11 font-medium">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Registros</th>
                        <th className="px-3 h-11 font-medium text-center">Duração</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((item) => {
                        const status = statusMap[item.status as keyof typeof statusMap] || statusMap.parcial;
                        const Icon = status.icon;
                        return (
                          <tr key={item.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[52px] text-muted-foreground">
                              {new Date(item.data).toLocaleString("pt-BR")}
                            </td>
                            <td className="px-3 text-foreground">{item.origem}</td>
                            <td className="px-3 text-muted-foreground">{item.empresas?.nome || "—"}</td>
                            <td className="px-3 text-center font-display font-medium">{item.contagem_registros}</td>
                            <td className="px-3 text-center text-muted-foreground">{item.duracao}</td>
                            <td className="px-5 text-center">
                              <span className={cn("esc-chip inline-flex items-center gap-1", status.cls)}>
                                <Icon className="h-3 w-3" />
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma importação registrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="inconsistencias" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Correções no mesmo fluxo</h2>
                      <p className="text-sm text-muted-foreground">
                        Revise, corrija e volte a processar sem sair do contexto.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/inconsistencias")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir visão completa
                    </Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Tipo</th>
                        <th className="px-3 h-11 font-medium">Colaborador</th>
                        <th className="px-3 h-11 font-medium">Descrição</th>
                        <th className="px-3 h-11 font-medium text-center">Status</th>
                        <th className="px-5 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((issue, index) => (
                        <tr key={issue.id || index} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[60px]">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning-strong" />
                              <span className="font-medium text-foreground">{issue.tipo_servico}</span>
                            </div>
                          </td>
                          <td className="px-3 text-foreground">{issue.colaboradores?.nome || "—"}</td>
                          <td className="px-3 text-muted-foreground">
                            {issue.quantidade} {issue.tipo_servico === "Volume" ? "volumes" : "carros"} lançados por{" "}
                            {issue.colaboradores?.nome}
                          </td>
                          <td className="px-3 text-center">
                            <StatusChip status={issue.status} />
                          </td>
                          <td className="px-5 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 hover:bg-success-soft hover:text-success-strong border-muted"
                              onClick={() => handleResolve(issue)}
                            >
                              Corrigir
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredIssues.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma inconsistência encontrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <JustificationModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        status={pendingStatus}
        isLoading={isUpdating}
      />

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Importar Operações via Planilha"
        description="O sistema lerá a coluna DATA de cada linha automaticamente. Cada linha será importada na sua própria data. Linhas sem DATA válida serão ignoradas. A coluna COL será gravada como quantidade de colaboradores."
        onUpload={handleImport}
      />
    </AppShell>
  );
};

export default CentralOperacional;
