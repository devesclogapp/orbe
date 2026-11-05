/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutService } from "@/services/report.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  Layers,
  FileSpreadsheet,
  Save,
  Download,
  Building2,
  CheckCircle2,
  Lock,
  ArrowLeft,
  RefreshCw,
  Code2,
  Check,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Info,
  Sliders,
  FileText,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { GuiaUsoDrawer } from "@/pages/Relatorios/components/GuiaUsoDrawer";
import { GUIA_LAYOUTS_EXPORTACAO } from "@/pages/Relatorios/components/guiasContabeisData";
import { useContadorScope } from "@/hooks/useContadorScope";

interface ColunaDef {
  key: string;
  label: string;
  descricao: string;
  sampleVal: string;
}

const TODAS_COLUNAS: ColunaDef[] = [
  { key: "DATA", label: "Data", descricao: "Data do lançamento contábil", sampleVal: "2026-10-05" },
  { key: "CONTA_DEBITO", label: "Conta Débito", descricao: "Código da conta a débito no plano de contas", sampleVal: "1.1.02.001" },
  { key: "CONTA_CREDITO", label: "Conta Crédito", descricao: "Código da conta a crédito no plano de contas", sampleVal: "3.1.01.001" },
  { key: "VALOR", label: "Valor", descricao: "Valor monetário do lançamento", sampleVal: "15420.50" },
  { key: "HISTORICO", label: "Histórico", descricao: "Texto descritivo do lançamento", sampleVal: "Faturamento Operação por Volume" },
  { key: "DOCUMENTO", label: "Documento", descricao: "Número do documento ou título fiscal", sampleVal: "DOC-202610-001" },
  { key: "CENTRO_CUSTO", label: "Centro de Custo", descricao: "Centro de custo operacional vinculado", sampleVal: "OPERACAO_LOGISTICA" },
  { key: "ORIGEM", label: "Origem", descricao: "Classificação operacional da operação", sampleVal: "RECEITA_OPERACAO_VOLUME" },
  { key: "EMPRESA", label: "Empresa", descricao: "Nome da empresa titular do lançamento", sampleVal: "ESC LOG TRANSPORTES" },
];

export const LayoutsExportacao: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { role, isAdmin } = useAccessControl();
  const { isContador, filterEmpresas, validateOrFallbackEmpresaId, empresasAutorizadasIds } = useContadorScope();

  const isAuthorized = useMemo(() => {
    if (isAdmin) return true;
    const normalized = (role || "").toLowerCase();
    return normalized === "admin" || normalized === "financeiro" || normalized === "contador";
  }, [role, isAdmin]);

  const paramEmpresaId = searchParams.get("empresa_id") || "";
  const paramCompetencia = searchParams.get("competencia") || "";

  // Carregar lista de empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_layouts"],
    queryFn: async () => {
      const data = await EmpresaService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  const availableEmpresas = useMemo(() => {
    return filterEmpresas(empresas);
  }, [empresas, filterEmpresas]);

  const activeEmpresaId = useMemo(() => {
    if (isContador) {
      return validateOrFallbackEmpresaId(paramEmpresaId, availableEmpresas);
    }
    return paramEmpresaId || availableEmpresas[0]?.id || empresas[0]?.id || "";
  }, [paramEmpresaId, isContador, availableEmpresas, empresas, validateOrFallbackEmpresaId]);
  const activeEmpresa = empresas.find((e) => e.id === activeEmpresaId);
  const activeEmpresaNome = activeEmpresa?.nome || "Empresa Homologada";

  // Carregar layouts da empresa selecionada
  const { data: layoutsEmpresa = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["report_layouts", activeEmpresaId],
    queryFn: () => LayoutService.getLayouts(activeEmpresaId),
    enabled: isAuthorized && !!activeEmpresaId,
  });

  // Configurações do Layout da Empresa
  const [isGuiaOpen, setIsGuiaOpen] = useState(false);
  const [delimitador, setDelimitador] = useState<string>(";");
  const [codificacao, setCodificacao] = useState<string>("UTF-8");
  const [formatoData, setFormatoData] = useState<string>("DD/MM/YYYY");
  const [formatoNumero, setFormatoNumero] = useState<string>("BRL"); // "BRL" = 1.234,56 ou "DECIMAL" = 1234.56
  const [colunasAtivas, setColunasAtivas] = useState<string[]>([
    "DATA",
    "CONTA_DEBITO",
    "CONTA_CREDITO",
    "VALOR",
    "HISTORICO",
    "DOCUMENTO",
    "CENTRO_CUSTO",
    "ORIGEM",
    "EMPRESA",
  ]);

  // Sincronizar configuração salva quando layoutsEmpresa mudar
  useEffect(() => {
    const layoutSalvo = layoutsEmpresa.find(
      (l: any) => l.empresa_id === activeEmpresaId && l.destino === "ORBE_CSV_PARTIDAS_DOBRADAS"
    );

    if (layoutSalvo && layoutSalvo.colunas) {
      const cfg = layoutSalvo.colunas;
      if (typeof cfg === "object" && !Array.isArray(cfg)) {
        if (cfg.delimitador) setDelimitador(cfg.delimitador);
        if (cfg.codificacao) setCodificacao(cfg.codificacao);
        if (cfg.formato_data) setFormatoData(cfg.formato_data);
        if (cfg.formato_numero) setFormatoNumero(cfg.formato_numero);
        if (Array.isArray(cfg.colunas)) setColunasAtivas(cfg.colunas);
      } else if (Array.isArray(cfg) && cfg.length > 0) {
        // Formato legado de array de colunas
        setColunasAtivas(cfg.map((c: any) => (typeof c === "string" ? c : c.field || c.key)).filter(Boolean));
      }
    }
  }, [layoutsEmpresa, activeEmpresaId]);

  const handleEmpresaChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("empresa_id", val);
    setSearchParams(next, { replace: true });
  };

  const handleBackToHub = () => {
    const params = new URLSearchParams();
    if (activeEmpresaId) params.set("empresa_id", activeEmpresaId);
    if (paramCompetencia) params.set("competencia", paramCompetencia);
    const qs = params.toString();
    navigate(`/relatorios${qs ? `?${qs}` : ""}`);
  };

  // Mutação para Salvar Configurações
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeEmpresaId) throw new Error("Selecione uma empresa válida.");

      const payload = {
        empresa_id: activeEmpresaId,
        nome: `Layout CSV Partidas Dobradas — ${activeEmpresaNome}`,
        tipo: "csv",
        destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
        status: "ativo",
        colunas: {
          delimitador,
          codificacao,
          formato_data: formatoData,
          formato_numero: formatoNumero,
          colunas: colunasAtivas,
        },
      };

      const existing = layoutsEmpresa.find(
        (l: any) => l.empresa_id === activeEmpresaId && l.destino === "ORBE_CSV_PARTIDAS_DOBRADAS"
      );

      if (existing?.id) {
        return LayoutService.update(existing.id, payload);
      } else {
        return LayoutService.create(payload as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_layouts", activeEmpresaId] });
      toast.success(`Layout contábil de ${activeEmpresaNome} salvo com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(`Falha ao salvar layout: ${err.message || "Erro desconhecido"}`);
    },
  });

  // Alternar Coluna
  const handleToggleColumn = (colKey: string) => {
    if (colunasAtivas.includes(colKey)) {
      if (colunasAtivas.length <= 2) {
        toast.error("O layout deve possuir pelo menos duas colunas.");
        return;
      }
      setColunasAtivas(colunasAtivas.filter((k) => k !== colKey));
    } else {
      setColunasAtivas([...colunasAtivas, colKey]);
    }
  };

  // Mover Coluna para Cima / Baixo
  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= colunasAtivas.length) return;
    const next = [...colunasAtivas];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setColunasAtivas(next);
  };

  // Resetar para Padrão ORBE
  const handleResetToDefault = () => {
    setDelimitador(";");
    setCodificacao("UTF-8");
    setFormatoData("DD/MM/YYYY");
    setFormatoNumero("BRL");
    setColunasAtivas([
      "DATA",
      "CONTA_DEBITO",
      "CONTA_CREDITO",
      "VALOR",
      "HISTORICO",
      "DOCUMENTO",
      "CENTRO_CUSTO",
      "ORIGEM",
      "EMPRESA",
    ]);
    toast.info("Configuração redefinida para o Padrão Oficial ORBE.");
  };

  // Formatação de Amostra Determinística
  const formatSampleVal = (col: ColunaDef, val: string) => {
    if (col.key === "DATA") {
      if (formatoData === "DD/MM/YYYY") return "05/10/2026";
      if (formatoData === "YYYY-MM-DD") return "2026-10-05";
      if (formatoData === "DDMMYYYY") return "05102026";
    }
    if (col.key === "VALOR") {
      const num = parseFloat(val);
      if (formatoNumero === "BRL") {
        return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return num.toFixed(2);
    }
    return val;
  };

  // Geração da Prévia do Arquivo (Amostra Fictícia Neutra)
  const previewContent = useMemo(() => {
    const orderedCols = colunasAtivas
      .map((k) => TODAS_COLUNAS.find((c) => c.key === k))
      .filter(Boolean) as ColunaDef[];

    const header = orderedCols.map((c) => c.label).join(delimitador);

    // Linha 1 de Exemplo (Receita)
    const row1 = orderedCols
      .map((c) => {
        if (c.key === "EMPRESA") return activeEmpresaNome;
        return formatSampleVal(c, c.sampleVal);
      })
      .join(delimitador);

    // Linha 2 de Exemplo (Despesa)
    const row2 = orderedCols
      .map((c) => {
        if (c.key === "DATA") {
          return formatoData === "DD/MM/YYYY"
            ? "12/10/2026"
            : formatoData === "YYYY-MM-DD"
            ? "2026-10-12"
            : "12102026";
        }
        if (c.key === "CONTA_DEBITO") return "4.1.02.005";
        if (c.key === "CONTA_CREDITO") return "1.1.01.002";
        if (c.key === "VALOR") {
          return formatoNumero === "BRL" ? "4.850,00" : "4850.00";
        }
        if (c.key === "HISTORICO") return "Fechamento Semanal Diaristas";
        if (c.key === "DOCUMENTO") return "LOTE-DIA-202641";
        if (c.key === "CENTRO_CUSTO") return "OPERACAO_LOGISTICA";
        if (c.key === "ORIGEM") return "DESPESA_DIARISTAS";
        if (c.key === "EMPRESA") return activeEmpresaNome;
        return c.sampleVal;
      })
      .join(delimitador);

    return `${header}\n${row1}\n${row2}`;
  }, [
    colunasAtivas,
    delimitador,
    formatoData,
    formatoNumero,
    activeEmpresaNome,
  ]);

  // Download do Arquivo Modelo sem Dados Reais
  const handleDownloadTemplate = () => {
    const blob = new Blob([previewContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `modelo_exportacao_contabil_${activeEmpresaNome.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Arquivo-modelo baixado com sucesso!");
  };

  if (!isAuthorized) {
    return (
      <AppShell
        title="Layouts de Exportação Contábil"
        subtitle="Parametrização do formato de arquivo de partidas dobradas e mapeamento de colunas por empresa"
        backPath={isContador ? "/relatorios/integracao" : "/relatorios"}
      >
        <div className="p-8 max-w-2xl mx-auto border border-border rounded-xl bg-card text-center space-y-4 my-12">
          <Lock className="h-12 w-12 text-destructive mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Acesso Restrito aos Layouts Contábeis</h3>
          <p className="text-sm text-muted-foreground">
            A parametrização de layouts de exportação contábil é restrita aos perfis Administrativo e Financeiro.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(isContador ? "/relatorios/integracao" : "/relatorios")}>
            Voltar para Central de Relatórios
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Layouts de Exportação Contábil"
      subtitle="Parametrização do formato de arquivo de partidas dobradas e mapeamento de colunas por empresa"
      backPath={isContador ? `/relatorios/integracao?empresa_id=${activeEmpresaId}&competencia=${paramCompetencia}` : `/relatorios?empresa_id=${activeEmpresaId}&competencia=${paramCompetencia}`}
    >
      <div className="space-y-4 pb-16">
        {/* BARRA SUPERIOR DE COMANDOS */}
        <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {availableEmpresas.length > 0 && (
              <div className="w-64">
                <Select value={activeEmpresaId} onValueChange={handleEmpresaChange}>
                  <SelectTrigger className="h-9 text-sm bg-background/60 font-medium">
                    <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Selecione a Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmpresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-sm">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-normal bg-muted/40 border-border/60">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Configuração Paramétrica
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Auxiliares */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/50"
              onClick={() => setIsGuiaOpen(true)}
            >
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Guia de Uso</span>
            </Button>

            <FerramentasContabeisMenu
              empresaId={activeEmpresaId}
              competencia={paramCompetencia}
            />

            {/* Secundárias */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
              onClick={handleResetToDefault}
            >
              <Sliders className="h-4 w-4" />
              <span>Restaurar Padrão ORBE</span>
            </Button>

            {/* Primária */}
            <Button
              size="sm"
              className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              <span>{saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}</span>
            </Button>
          </div>
        </header>

      {/* Card Informativo do Layout Padrão ORBE */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground">
                Layout Padrão ORBE — Partidas Dobradas
              </h3>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                Padrão Homologado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Exportação determinística em CSV estruturada com partidas dobradas (Débito e Crédito balanceados), com cabeçalho canônico e rastreabilidade total por hash de integridade.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60 shrink-0"
          onClick={handleDownloadTemplate}
        >
          <Download className="h-4 w-4 text-primary" />
          <span>Baixar Arquivo-Modelo (Template)</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel de Parametrizações do Layout */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-xl border border-border bg-card space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Parâmetros do Arquivo
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Defina os delimitadores e formatações de saída para <strong>{activeEmpresaNome}</strong>
              </p>
            </div>

            {/* Delimitador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Delimitador de Campos</Label>
              <Select value={delimitador} onValueChange={setDelimitador}>
                <SelectTrigger className="h-8.5 text-xs font-mono">
                  <SelectValue placeholder="Delimitador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=";">Ponto e Vírgula ( ; ) — Padrão Brasil</SelectItem>
                  <SelectItem value=",">Vírgula ( , ) — Padrão Internacional</SelectItem>
                  <SelectItem value="	">Tabulação ( TAB ) — Colunas Tabuladas</SelectItem>
                  <SelectItem value="|">Pipe ( | )</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Codificação */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Codificação de Caracteres</Label>
              <Select value={codificacao} onValueChange={setCodificacao}>
                <SelectTrigger className="h-8.5 text-xs font-mono">
                  <SelectValue placeholder="Codificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTF-8">UTF-8 (Universal / Padrão Web)</SelectItem>
                  <SelectItem value="ISO-8859-1">ISO-8859-1 (Windows ANSI / Latin-1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Formato de Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Formato de Data</Label>
              <Select value={formatoData} onValueChange={setFormatoData}>
                <SelectTrigger className="h-8.5 text-xs font-mono">
                  <SelectValue placeholder="Formato de Data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Ex: 05/10/2026 — Padrão BR)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (Ex: 2026-10-05 — Padrão ISO)</SelectItem>
                  <SelectItem value="DDMMYYYY">DDMMYYYY (Ex: 05102026 — Sem separador)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Formato Monetário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Formato de Valores Monetários</Label>
              <Select value={formatoNumero} onValueChange={setFormatoNumero}>
                <SelectTrigger className="h-8.5 text-xs font-mono">
                  <SelectValue placeholder="Formato Monetário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">1.234,56 (Vírgula decimal — Padrão Brasil)</SelectItem>
                  <SelectItem value="DECIMAL">1234.56 (Ponto decimal — Padrão Numérico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seleção e Ordenação de Colunas */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-primary" />
                  Seleção e Ordenação de Colunas
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Marque as colunas ativas e use as setas para ajustar a sequência no CSV
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {colunasAtivas.length} de {TODAS_COLUNAS.length}
              </Badge>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {TODAS_COLUNAS.map((col) => {
                const isSelected = colunasAtivas.includes(col.key);
                const orderIndex = colunasAtivas.indexOf(col.key);

                return (
                  <div
                    key={col.key}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                      isSelected
                        ? "bg-card border-border shadow-xs"
                        : "bg-muted/30 border-dashed border-border/60 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                      />
                      <label
                        htmlFor={`col-${col.key}`}
                        className="cursor-pointer font-medium text-foreground select-none"
                      >
                        {col.label}
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {col.key}
                        </span>
                      </label>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-bold text-primary mr-1">
                          #{orderIndex + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={orderIndex === 0}
                          onClick={() => handleMoveColumn(orderIndex, "up")}
                          title="Mover para cima"
                        >
                          <MoveUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={orderIndex === colunasAtivas.length - 1}
                          onClick={() => handleMoveColumn(orderIndex, "down")}
                          title="Mover para baixo"
                        >
                          <MoveDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pré-Visualização Interativa do Arquivo */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Pré-Visualização do Arquivo CSV</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {codificacao}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Delim: &quot;{delimitador === "	" ? "TAB" : delimitador}&quot;
                </Badge>
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3 text-primary" />
                  Visualização de exemplo determinístico (dados simulados neutros sem expor a base real):
                </span>
                <span className="font-mono text-[10px]">{colunasAtivas.length} colunas</span>
              </div>

              <div className="relative rounded-lg border border-border bg-muted/60 p-4 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed flex-1 min-h-[220px]">
                <code>{previewContent}</code>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Compatível com as rotinas de exportação do ERP ORBE</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto h-9 px-4 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 text-primary" />
                <span>Baixar Amostra (.csv)</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Guia de Uso Contextual (CONT-06) */}
      <GuiaUsoDrawer
        isOpen={isGuiaOpen}
        onClose={() => setIsGuiaOpen(false)}
        data={GUIA_LAYOUTS_EXPORTACAO}
      />
    </AppShell>
  );
};

export default LayoutsExportacao;
