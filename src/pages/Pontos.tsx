import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  FileUp,
  Loader2,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import {
  SpreadsheetUploadModal,
  type SpreadsheetValidationResult,
} from "@/components/shared/SpreadsheetUploadModal";
import { MetricCard } from "@/components/painel/MetricCard";
import { PontoTableBlock } from "@/components/ponto/PontoTableBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ColaboradorService,
  EmpresaService,
  ImportacaoModelosService,
  PontoService,
} from "@/services/base.service";
import { ensurePreCadastrosFromImportedPontos } from "@/services/preCadastroColaborador.service";

type EmpresaOption = {
  id: string;
  nome: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCompanyText = (value: string) => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/\b(ltda|me|eireli)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeStatus = (status?: string | null): string => {
  const value = status?.toString().trim();
  if (!value) return "Pendente";

  const map: Record<string, string> = {
    presente: "Presente",
    ausente: "Ausente",
    falta: "Falta",
    atestado: "Atestado",
    folga: "Folga",
    ferias: "Férias",
    férias: "Férias",
    homeoffice: "Home Office",
    "home office": "Home Office",
    bancohoras: "Banco de Horas",
    "banco de horas": "Banco de Horas",
    pendente: "Pendente",
    processado: "Processado",
    inconsistente: "Inconsistente",
    ok: "ok",
    ajustado: "ajustado",
    incompleto: "incompleto",
  };

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return map[normalized] || "Pendente";
};

const getImportRowValue = (row: Record<string, unknown>, ...columns: string[]) => {
  const targets = columns.map((column) => normalizeText(column));
  const entry = Object.entries(row).find(([key]) => targets.includes(normalizeText(key)));
  return String(entry?.[1] ?? "").trim();
};

const parseIsoDateLike = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }
  return "";
};

const parseTimeLike = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.replace(".", ":");
  if (/^\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) return normalized;
  return null;
};

const normalizeCpf = (value: string) => value.replace(/\D/g, "");

const findEmpresaMatch = (empresas: EmpresaOption[], nome: string) => {
  const normalizedTarget = normalizeCompanyText(nome);
  if (!normalizedTarget) return null;

  return (
    empresas.find((empresa) => normalizeCompanyText(empresa.nome) === normalizedTarget) ??
    empresas.find((empresa) => {
      const candidate = normalizeCompanyText(empresa.nome);
      return candidate.includes(normalizedTarget) || normalizedTarget.includes(candidate);
    }) ??
    null
  );
};

const MONTH_NAME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2026, index, 1);
  const labelBase = format(date, "MMMM", { locale: ptBR });
  return {
    value: String(index + 1).padStart(2, "0"),
    label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1),
  };
});

const YEAR_OPTIONS = Array.from(
  new Set(
    Array.from({ length: 24 }, (_, index) =>
      String(startOfMonth(addMonths(new Date(), -index)).getFullYear()),
    ),
  ),
).sort((a, b) => Number(b) - Number(a));

const Pontos = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState<string>(
    format(new Date(), "MM"),
  );
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<{
    novosDetectados: number;
    preCadastrosCriados: number;
  } | null>(null);

  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;
  const selectedDate = useMemo(
    () => new Date(`${selectedMonth}-01T12:00:00`),
    [selectedMonth],
  );
  const monthLabel = format(selectedDate, "MMMM/yyyy", { locale: ptBR });
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<EmpresaOption[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });
  const { data: colaboradores = [] } = useQuery<any[]>({
    queryKey: ["colaboradores_list"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });
  const { data: importacaoModelos = [] } = useQuery<any[]>({
    queryKey: ["importacao_modelos"],
    queryFn: () => ImportacaoModelosService.listAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  const { data: rows = [], isLoading: isLoadingRows } = useQuery<any[]>({
    queryKey: ["ponto", selectedMonth, selectedEmpresaId],
    queryFn: () =>
      PontoService.getByMonth(
        selectedMonth,
        selectedEmpresaId === "all" ? undefined : selectedEmpresaId,
      ),
    enabled: !!selectedEmpresaId,
  });

  const colaboradoresUnicos = useMemo(
    () => new Set(rows.map((row) => row.colaborador_id).filter(Boolean)).size,
    [rows],
  );

  const inconsistencias = useMemo(
    () => rows.filter((row) => row.status === "inconsistente").length,
    [rows],
  );

  const activeImportConfig = useMemo(() => {
    const modeloImportacaoAtivo = importacaoModelos.find(
      (item) => item.modulo === "pontos_recebidos" && item.ativo && item.drive_url,
    );
    const empresaSelecionada =
      selectedEmpresaId && selectedEmpresaId !== "all"
        ? empresas.find((empresa) => empresa.id === selectedEmpresaId) ?? null
        : null;
    const empresaLookup = new Map(empresas.map((empresa) => [normalizeCompanyText(empresa.nome), empresa]));
    const colaboradorByNome = new Map(
      colaboradores.map((colaborador) => [
        `${normalizeText(colaborador.nome ?? "")}::${String(colaborador.empresa_id ?? "")}`,
        colaborador,
      ]),
    );
    const colaboradorByNomeGlobal = new Map(
      colaboradores.map((colaborador) => [normalizeText(colaborador.nome ?? ""), colaborador]),
    );
    const colaboradorByMatricula = new Map(
      colaboradores
        .filter((colaborador) => colaborador.matricula)
        .map((colaborador) => [
          `${String(colaborador.matricula).trim()}::${String(colaborador.empresa_id ?? "")}`,
          colaborador,
        ]),
    );
    const colaboradorByMatriculaGlobal = new Map(
      colaboradores
        .filter((colaborador) => colaborador.matricula)
        .map((colaborador) => [String(colaborador.matricula).trim(), colaborador]),
    );
    const colaboradorByCpf = new Map(
      colaboradores
        .filter((colaborador) => colaborador.cpf)
        .map((colaborador) => [
          `${normalizeCpf(String(colaborador.cpf))}::${String(colaborador.empresa_id ?? "")}`,
          colaborador,
        ]),
    );
    const colaboradorByCpfGlobal = new Map(
      colaboradores
        .filter((colaborador) => colaborador.cpf)
        .map((colaborador) => [normalizeCpf(String(colaborador.cpf)), colaborador]),
    );

    const validateData = (importRows: Record<string, unknown>[]): SpreadsheetValidationResult => {
      const errors: string[] = [];
      const validRows: Record<string, any>[] = [];
      const previewRows: Record<string, any>[] = [];

      importRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const idRaw = getImportRowValue(row, "ID");
        const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA", "NOME DA CLIENTE");
        const colaboradorNome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO");
        const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR");
        const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR");
        const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR");
        const data = parseIsoDateLike(getImportRowValue(row, "DATA", "DATA DO PONTO", "DATA DE REGISTRO"));
        const entrada = parseTimeLike(getImportRowValue(row, "ENTRADA", "INICIO", "INÍCIO", "HORA DE ENTRADA", "HORÁRIO ENTRADA"));
        const saidaAlmoco = parseTimeLike(getImportRowValue(row, "SAIDA ALMOCO", "SAÍDA ALMOÇO", "SAIDA INTERVALO", "SAÍDA INTERVALO", "SAIDA DO ALMOÇO"));
        const retornoAlmoco = parseTimeLike(getImportRowValue(row, "RETORNO ALMOCO", "RETORNO ALMOÇO", "RETORNO INTERVALO", "RETORNO DO ALMOÇO"));
        const saida = parseTimeLike(getImportRowValue(row, "SAIDA", "FIM", "SAÍDA", "HORA DE SAÍDA", "HORÁRIO SAÍDA"));
        const periodo = getImportRowValue(row, "PERIODO", "PERÍODO", "TURNO");
        const tipoDia = getImportRowValue(row, "TIPO DIA", "TIPO DE DIA", "TIPO DE DIA DA SEMANA");
        const status = getImportRowValue(row, "STATUS", "SITUAÇÃO", "SITUACAO") || "pendente";
        const horasTrabalhadas = getImportRowValue(row, "HORAS TRABALHADAS", "HORAS TRAB", "HR TRABALHADAS");
        const horaExtra = getImportRowValue(row, "HORA EXTRA", "HORAS EXTRAS", "HE");
        const falta = getImportRowValue(row, "FALTA", "FALTAS");
        const atraso = getImportRowValue(row, "ATRASO", "ATRASOS", "ATRASO MINUTOS");
        const observacoes = getImportRowValue(row, "OBSERVACOES", "OBSERVAÇÕES", "OBS", "OBSERVAÇÃO", "OBSERV");

        if (!colaboradorNome) {
          errors.push(`Linha ${lineNumber}: informe o campo COLABORADOR (colunas suportadas: COLABORADOR, NOME, FUNCIONÁRIO).`);
          return;
        }

        // Detectar se o valor parece ser um nome de cabeçalho em vez de dados reais
        if (["colaborador", "nome", "funcionario", "trabalhador"].includes(normalizeText(colaboradorNome))) {
          errors.push(`Linha ${lineNumber}: parece que a planilha não tem dados (coluna COLABORADOR contém "${colaboradorNome}"). Verifique se a linha de cabeçalho está correta.`);
          return;
        }

        // Matching de empresa - mais tolerante
        let empresa: any = null;

        // ========== DADOS BRUTOS - SEM VALIDAÇÃO DE EXISTÊNCIA ==========

        // Tentar encontrar empresa para vínculo, mas se não encontrar, aceitar null
        let empresaId: string | null = null;
        let empresaEncontrada: any = null;

        if (empresaSelecionada) {
          empresaId = empresaSelecionada.id;
          empresaEncontrada = empresaSelecionada;
        } else if (empresaNome) {
          const normalizedEmpresaNome = normalizeCompanyText(empresaNome);
          empresaEncontrada = empresaLookup.get(normalizedEmpresaNome);
          if (!empresaEncontrada) {
            empresaEncontrada = empresas.find((e: any) => {
              const normalized = normalizeCompanyText(e.nome || "");
              return normalized.includes(normalizedEmpresaNome) ||
                normalizedEmpresaNome.includes(normalized) ||
                normalized.replace(/\s/g, '').includes(normalizedEmpresaNome.replace(/\s/g, ''));
            });
          }
          empresaId = empresaEncontrada?.id || null;
        }

        // Tentar encontrar colaborador para vínculo, mas se não encontrar, aceitar null
        let colaboradorId: string | null = null;
        if (colaboradorNome) {
          const normalizedColaboradorNome = normalizeText(colaboradorNome);

          // Buscar por qualquer método possível
          const found =
            (matricula
              ? empresaId ? colaboradorByMatricula.get(`${matricula.trim()}::${empresaId}`) : null
              : null) ??
            (matricula ? colaboradorByMatriculaGlobal.get(matricula.trim()) : null) ??
            (cpf
              ? empresaId ? colaboradorByCpf.get(`${normalizeCpf(cpf)}::${empresaId}`) : null
              : null) ??
            (cpf ? colaboradorByCpfGlobal.get(normalizeCpf(cpf)) : null) ??
            (empresaId ? colaboradorByNome.get(`${normalizedColaboradorNome}::${empresaId}`) : null) ??
            colaboradorByNomeGlobal.get(normalizedColaboradorNome);

          if (found?.id) {
            colaboradorId = found.id;
          }
        }

        // Detectar linha vazia ou linha de cabeçalho
        if (!data && !entrada && !saida && !colaboradorNome) {
          // Linha vazia - pode pular ou treating como válida
          // Não adicionar aos erros, apenas pular
        }

        if (!data) {
          errors.push(`Linha ${lineNumber}: DATA é obrigatória.`);
          return;
        }

        // Dados válidos - aceitar qualquer valor (dados brutos)
        const payload = {
          // Campos relacionais podem ser null se não encontrados
          colaborador_id: colaboradorId,
          empresa_id: empresaId,
          // Dados principais
          data,
          entrada,
          saida_almoco: saidaAlmoco,
          retorno_almoco: retornoAlmoco,
          saida,
          periodo: periodo || null,
          tipo_dia: tipoDia || null,
          status: normalizeStatus(status),
          origem: "importacao",
          // Dados brutos da planilha (salvos para exibição)
          nome_colaborador: colaboradorNome || null,
          empresa_nome: empresaNome || null,
          matricula_colaborador: matricula || null,
          cpf_colaborador: cpf || null,
          cargo_colaborador: cargo || null,
          horas_trabalhadas: horasTrabalhadas || null,
          hora_extra: horaExtra || null,
          falta: falta || null,
          atraso: atraso || null,
          observacoes: observacoes || null,
        };

        validRows.push(payload);
        previewRows.push({
          ID: idRaw || "-",
          EMPRESA: empresaNome || "-",
          COLABORADOR: colaboradorNome || "-",
          MATRICULA: matricula || "-",
          CPF: cpf || "-",
          CARGO: cargo || "-",
          DATA: data,
          ENTRADA: entrada ? entrada.slice(0, 5) : "-",
          SAIDA_ALMOCO: saidaAlmoco ? saidaAlmoco.slice(0, 5) : "-",
          RETORNO_ALMOCO: retornoAlmoco ? retornoAlmoco.slice(0, 5) : "-",
          SAIDA: saida ? saida.slice(0, 5) : "-",
          HORAS_TRABALHADAS: horasTrabalhadas || "-",
          HORA_EXTRA: horaExtra || "-",
          FALTA: falta || "-",
          ATRASO: atraso || "-",
          STATUS: payload.status,
          OBSERVACOES: observacoes || "-",
        });
      });

      return {
        validRows,
        errors,
        warnings: [],
        previewRows: previewRows.slice(0, 5),
      };
    };

    return {
      label: "Pontos Recebidos",
      description: "Envie uma planilha compatível com o modelo de pontos recebidos.",
      downloadUrl: modeloImportacaoAtivo?.drive_url,
      expectedColumns: [
        "ID",
        "EMPRESA",
        "COLABORADOR",
        "MATRICULA",
        "CPF",
        "CARGO",
        "DATA",
        "ENTRADA",
        "SAIDA ALMOCO",
        "RETORNO ALMOCO",
        "SAIDA",
        "HORAS TRABALHADAS",
        "HORA EXTRA",
        "FALTA",
        "ATRASO",
        "STATUS",
        "OBSERVACOES",
      ],
      templateFileName: "modelo_pontos_recebidos.xlsx",
      validateData,
    };
  }, [colaboradores, empresas, importacaoModelos, selectedEmpresaId]);

  const valorTotal = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.valor_dia || 0), 0),
    [rows],
  );

  const ultimaSincronizacao = rows[0]?.updated_at || rows[0]?.created_at || null;
  const isLoading = isLoadingEmpresas || isLoadingRows;

  const handleImportPontos = async (importRows: Record<string, any>[]) => {
    const preCadastroResult = await ensurePreCadastrosFromImportedPontos(importRows, "planilha");

    for (const row of preCadastroResult.rowsWithColaboradorId) {
      await PontoService.create(row);
    }

    setLastImportSummary({
      novosDetectados: preCadastroResult.novosDetectados,
      preCadastrosCriados: preCadastroResult.preCadastrosCriados,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ponto"] }),
      queryClient.invalidateQueries({ queryKey: ["colaboradores_list"] }),
      queryClient.invalidateQueries({ queryKey: ["colaboradores_all"] }),
      queryClient.invalidateQueries({ queryKey: ["empresas"] }),
      queryClient.invalidateQueries({ queryKey: ["operational-pulse"] }),
    ]);

    toast.success(
      `${preCadastroResult.novosDetectados} colaboradores novos detectados · ${preCadastroResult.preCadastrosCriados} pre-cadastros criados.`,
    );
  };

  const handleClearImportacao = async () => {
    setIsClearing(true);
    try {
      const deletedCount = await PontoService.deleteImported(
        selectedMonth,
        selectedEmpresaId === "all" ? null : selectedEmpresaId,
      );

      if (deletedCount > 0) {
        toast.success(
          `${deletedCount} registro(s) importado(s) e seus calculos de RH foram removidos com sucesso.`,
        );
      } else {
        toast.info("Nenhum registro de importacao encontrado para remover.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ponto"] }),
        queryClient.invalidateQueries({ queryKey: ["processamento_rh_logs"] }),
        queryClient.invalidateQueries({ queryKey: ["processamento_rh_inconsistencias"] }),
        queryClient.invalidateQueries({ queryKey: ["banco_horas_saldos"] }),
        queryClient.invalidateQueries({ queryKey: ["fechamento_mensal"] }),
      ]);
      setClearModalOpen(false);
    } catch (err: any) {
      console.error("ERRO AO LIMPAR IMPORTACAO:", err);
      toast.error("Erro ao limpar importacao: " + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <AppShell
      title="Pontos"
      subtitle={`Base mensal de jornadas coletadas · ${monthLabelCapitalized}`}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Ano" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
                <SelectTrigger className="w-[180px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Mes" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAME_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  inconsistencias > 0
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong",
                )}
              >
                {inconsistencias > 0
                  ? `${inconsistencias} inconsistencia(s) em aberto`
                  : "Base de ponto consistente"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Planilha
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClearModalOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Importação
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/operacional/dashboard")}>
                <Clock className="mr-2 h-4 w-4" />
                Ver dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/operacional/operacoes")}>
                <FileUp className="mr-2 h-4 w-4" />
                Ir para operacoes
              </Button>
            </div>
          </div>
        </section>

        {lastImportSummary ? (
          <section className="esc-card border border-primary/20 bg-primary/5 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="font-display font-semibold text-foreground">
                  Resumo da ultima importacao
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lastImportSummary.novosDetectados} colaboradores novos detectados
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastImportSummary.preCadastrosCriados} pre-cadastros criados
                </p>
              </div>

              <Button variant="outline" onClick={() => navigate("/cadastros")}>
                Ir para Central de Cadastros
              </Button>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando a base de ponto...
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Colaboradores" value={colaboradoresUnicos.toString()} icon={Users} />
              <MetricCard label="Registros" value={rows.length.toString()} icon={Clock} />
              <MetricCard
                label="Valor do mes"
                value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={Wallet}
                accent
              />
              <MetricCard label="Inconsistencias" value={inconsistencias.toString()} icon={AlertTriangle} />
            </div>

            <section className="esc-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display font-semibold text-foreground">Base mensal de ponto</h2>
                  <p className="text-sm text-muted-foreground">
                    Registros coletados nas empresas e disponibilizados como fonte operacional para o dashboard.
                  </p>
                </div>
                <Badge className="bg-muted text-muted-foreground">
                  {ultimaSincronizacao
                    ? `Ultima sincronizacao ${new Date(ultimaSincronizacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Sem sincronizacao"}
                </Badge>
              </div>

              <PontoTableBlock
                month={selectedMonth}
                monthLabel={monthLabelCapitalized}
                empresaId={selectedEmpresaId}
              />
            </section>
          </>
        )}
      </div>

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Importar planilha - Pontos Recebidos"
        description={activeImportConfig.description}
        onDownloadTemplate={
          activeImportConfig.downloadUrl
            ? () => window.open(activeImportConfig.downloadUrl, "_blank", "noopener,noreferrer")
            : undefined
        }
        expectedColumns={activeImportConfig.expectedColumns}
        templateColumns={activeImportConfig.expectedColumns}
        templateFileName={activeImportConfig.templateFileName}
        requireValidation
        validateData={activeImportConfig.validateData}
        onUpload={handleImportPontos}
      />

      <Dialog open={clearModalOpen} onOpenChange={setClearModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Limpar Importação</DialogTitle>
            <DialogDescription>
              Deseja remover os registros importados via planilha do periodo selecionado?
              Essa acao tambem limpara inconsistencias, eventos e saldos gerados pelo processamento RH desses pontos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearModalOpen(false)}
              disabled={isClearing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearImportacao}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Confirmar Limpeza"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Pontos;
