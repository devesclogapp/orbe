import React, { useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Clock,
  Layers,
  Building2,
  Calendar,
  Sparkles,
  BarChart3,
  X,
  Filter,
  CheckCircle2,
  Users,
  Wallet,
  Package,
  TrendingUp,
  Info,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Star,
  FileArchive,
  Printer,
  Download,
  Check,
  AlertCircle,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RELATORIOS_CATALOGO,
  EMPRESAS_DISPONIVEIS,
  ReportMeta,
  MOCK_R01_DATA,
  MOCK_R02_DATA,
  MOCK_R03_DATA,
  MOCK_R04_DATA,
  MOCK_R05_DATA,
  MOCK_R07_DATA,
  getModalidadeLabel,
  getStatusReceitaLabel,
  getSituacaoDerivadaReceita,
  getStatusLoteDiaristaLabel,
  getStatusCustoExtraLabel,
  getCategoriaCustoLabel,
  getPipelineStatusServicoExtraLabel,
} from "./relatoriosMockData";

// Tipos do Filtro Global por Fluxo (HOTFIX 03.2)
export type FluxoId =
  | "todos"
  | "operacoes-volume"
  | "servicos-extras"
  | "custos-extras"
  | "diaristas"
  | "intermitentes"
  | "clt-ponto"
  | "banco-horas"
  | "faturamento-receitas";

export interface FluxoOption {
  id: FluxoId;
  label: string;
  reportCode?: string;
  hasDataset: boolean;
  backlogRef?: string;
  description: string;
}

export const FLUXOS_DISPONIVEIS: FluxoOption[] = [
  { id: "todos", label: "Todos os Fluxos", hasDataset: true, description: "Visão consolidada transversal dos 6 cadernos" },
  { id: "operacoes-volume", label: "Operações por Volume", reportCode: "R01", hasDataset: true, description: "Movimentação operacional, volumes e faturamento primário" },
  { id: "servicos-extras", label: "Serviços Extras", reportCode: "R07", hasDataset: true, description: "Serviços extraordinários e faturamentos adicionais" },
  { id: "custos-extras", label: "Custos Extras", reportCode: "R04", hasDataset: true, description: "Despesas de campo, ferramentas, EPIs e manutenções" },
  { id: "diaristas", label: "Diaristas", reportCode: "R02", hasDataset: true, description: "Apuração semanal de diárias e lotes operacionais" },
  { id: "intermitentes", label: "Intermitentes", hasDataset: false, backlogRef: "UX04-FLOW-INTERMITENTES-01", description: "Caderno em homologação operacional (Backlog UX04)" },
  { id: "clt-ponto", label: "CLT / Ponto & Jornada", hasDataset: false, backlogRef: "UX04-FLOW-CLT-PONTO-01", description: "Caderno em homologação de ponto eletrônico (Backlog UX04)" },
  { id: "banco-horas", label: "Banco de Horas", reportCode: "R05", hasDataset: true, description: "Saldos, créditos/débitos e vencimentos de horas CLT" },
  { id: "faturamento-receitas", label: "Faturamento / Receitas", reportCode: "R03", hasDataset: true, description: "Livro fiscal de receitas faturadas e conciliação" },
];

// Mapeamento canônico das dimensões auditáveis por relatório
const REPORT_DIMENSIONS: Record<string, string[]> = {
  "r01-operacoes-volume": ["Unidade / Doca", "Transportadora", "Tipo de Serviço", "Placa", "NF"],
  "r04-custos-extras": ["Unidade", "Categoria de Gasto", "Favorecido", "Origem Recurso"],
  "r07-servicos-extras": ["Tipo de Serviço", "Tomador / Cliente", "Modalidade Financeira", "NF"],
  "r02-fechamento-diaristas": ["Colaborador", "CPF", "Função", "Lote Semanal"],
  "r05-banco-horas": ["Colaborador", "Matrícula CLT", "Saldo em Horas", "Alerta Vencimento"],
  "r03-faturamento-receitas": ["Cliente / Tomador", "Modalidade de Receita", "Origem", "Situação"],
};

const COMPETENCIAS_DISPONIVEIS = [
  { value: "2026-09", label: "Setembro / 2026 (Oficial Homologado)" },
  { value: "2026-10", label: "Outubro / 2026 (Em Aberto)" },
  { value: "2026-08", label: "Agosto / 2026 (Arquivado)" },
];

function formatBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatMinutosToHourString(minutos: number): string {
  const sign = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export default function UxLabRelatoriosHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros Globais da Central (Empresa + Competência + Fluxo)
  const urlEmpresa = searchParams.get("empresa") || "emp-01";
  const urlCompetencia = searchParams.get("competencia") || "2026-09";
  const urlFluxo = (searchParams.get("fluxo") as FluxoId) || "todos";
  const urlDia = searchParams.get("dia") || null;

  const [empresaId, setEmpresaId] = useState(urlEmpresa);
  const [competencia, setCompetencia] = useState(urlCompetencia);
  const [fluxo, setFluxo] = useState<FluxoId>(urlFluxo);
  const [selectedDay, setSelectedDay] = useState<string | null>(urlDia);

  // Modos do Mapa de Movimentação do Período (Movimentação | Valores | Pendências)
  const [mapaMode, setMapaMode] = useState<"movimentacao" | "valores" | "pendencias">("movimentacao");
  const [hoveredCell, setHoveredCell] = useState<{
    rowLabel: string;
    day: number;
    dateStr: string;
    count: number;
    volume: number;
    valor: number;
    pendencias: number;
    details: string;
  } | null>(null);

  // Busca e Filtros do Catálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | "OPERACIONAL" | "PESSOAS & RH" | "FINANCEIRO & FATURAMENTO">("all");
  const [quickFilter, setQuickFilter] = useState<"todos" | "favoritos" | "recentes">("todos");
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);

  // Favoritos demonstrativos (local-only no UX Lab, backlog UX04-FUTURE-FAV-01)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("orbe_report_favorites");
      return saved ? JSON.parse(saved) : ["r01-operacoes-volume", "r03-faturamento-receitas"];
    } catch {
      return ["r01-operacoes-volume", "r03-faturamento-receitas"];
    }
  });

  const toggleFavorite = (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId];
      try {
        localStorage.setItem("orbe_report_favorites", JSON.stringify(next));
      } catch {
        // LocalStorage fallback
      }
      return next;
    });
  };

  // Estado do Modal Dossiê da Competência
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedDossierReports, setSelectedDossierReports] = useState<string[]>([
    "sintese",
    "r01-operacoes-volume",
    "r04-custos-extras",
    "r07-servicos-extras",
    "r02-fechamento-diaristas",
    "r05-banco-horas",
    "r03-faturamento-receitas",
  ]);
  const [dossierFormat, setDossierFormat] = useState<"pdf_consolidado" | "pdf_individual" | "dados_estruturados">("pdf_consolidado");

  // Referência para o container do catálogo
  const catalogRef = useRef<HTMLDivElement>(null);

  // Sincronizar parâmetros na URL sem recarregar a página
  const updateUrlParams = (newEmpresa: string, newComp: string, newFluxo: FluxoId, newDia: string | null) => {
    const params: Record<string, string> = {
      empresa: newEmpresa,
      competencia: newComp,
    };
    if (newFluxo !== "todos") {
      params.fluxo = newFluxo;
    }
    if (newDia) {
      params.dia = newDia;
    }
    setSearchParams(params);
  };

  const handleEmpresaChange = (newEmpresa: string) => {
    setEmpresaId(newEmpresa);
    updateUrlParams(newEmpresa, competencia, fluxo, selectedDay);
  };

  const handleCompetenciaChange = (newComp: string) => {
    setCompetencia(newComp);
    updateUrlParams(empresaId, newComp, fluxo, selectedDay);
  };

  const handleFluxoChange = (newFluxo: FluxoId) => {
    setFluxo(newFluxo);
    updateUrlParams(empresaId, competencia, newFluxo, selectedDay);
    // Se selecionou fluxo com relatório correspondente, destaca
    const fluxoMeta = FLUXOS_DISPONIVEIS.find((f) => f.id === newFluxo);
    if (fluxoMeta?.reportCode) {
      const targetReport = RELATORIOS_CATALOGO.find((r) => r.code === fluxoMeta.reportCode);
      if (targetReport) {
        setHighlightedReportId(targetReport.id);
      }
    } else {
      setHighlightedReportId(null);
    }
  };

  const handleSelectDay = (dayNum: number) => {
    const dayStr = String(dayNum).padStart(2, "0");
    const nextDay = selectedDay === dayStr ? null : dayStr;
    setSelectedDay(nextDay);
    updateUrlParams(empresaId, competencia, fluxo, nextDay);
  };

  const handleClearDayFilter = () => {
    setSelectedDay(null);
    updateUrlParams(empresaId, competencia, fluxo, null);
  };

  // Empresa Selecionada
  const empresaSelecionada = useMemo(
    () => EMPRESAS_DISPONIVEIS.find((e) => e.id === empresaId) || EMPRESAS_DISPONIVEIS[0],
    [empresaId]
  );

  // ============================================================
  // FILTRAGEM DOS DATASETS CANÔNICOS POR EMPRESA E COMPETÊNCIA
  // ============================================================
  const r01Rows = useMemo(
    () => MOCK_R01_DATA.filter((r) => r.empresaId === empresaId && r.dataOperacao.startsWith(competencia)),
    [empresaId, competencia]
  );

  const r04Rows = useMemo(
    () => MOCK_R04_DATA.filter((r) => r.empresaId === empresaId && r.data.startsWith(competencia)),
    [empresaId, competencia]
  );

  const r07Rows = useMemo(
    () => MOCK_R07_DATA.filter((r) => r.empresaId === empresaId && r.data.startsWith(competencia)),
    [empresaId, competencia]
  );

  const r02Rows = useMemo(
    () => MOCK_R02_DATA.filter((r) => r.empresaId === empresaId && r.dataLancamento.startsWith(competencia)),
    [empresaId, competencia]
  );

  const r05Rows = useMemo(
    () => MOCK_R05_DATA.filter((r) => r.empresaId === empresaId && r.competencia === competencia),
    [empresaId, competencia]
  );

  const r03Rows = useMemo(
    () => MOCK_R03_DATA.filter((r) => r.empresaId === empresaId && r.competencia === competencia),
    [empresaId, competencia]
  );

  // Mapa de contagem de registros por relatório
  const reportCounts = useMemo<Record<string, number>>(() => ({
    "r01-operacoes-volume": r01Rows.length,
    "r04-custos-extras": r04Rows.length,
    "r07-servicos-extras": r07Rows.length,
    "r02-fechamento-diaristas": r02Rows.length,
    "r05-banco-horas": r05Rows.length,
    "r03-faturamento-receitas": r03Rows.length,
  }), [r01Rows, r04Rows, r07Rows, r02Rows, r05Rows, r03Rows]);

  // ============================================================
  // CÁLCULO DOS 4 KPIS CANÔNICOS DA CENTRAL
  // ============================================================

  // 01 — REGISTROS CONSOLIDADOS
  const totalRegistros = useMemo(
    () => r01Rows.length + r02Rows.length + r03Rows.length + r04Rows.length + r05Rows.length + r07Rows.length,
    [r01Rows, r02Rows, r03Rows, r04Rows, r05Rows, r07Rows]
  );

  const relatoriosAtivos = useMemo(() => {
    return [r01Rows, r02Rows, r03Rows, r04Rows, r05Rows, r07Rows].filter((arr) => arr.length > 0).length;
  }, [r01Rows, r02Rows, r03Rows, r04Rows, r05Rows, r07Rows]);

  // 02 — VOLUME OPERACIONAL (EXCLUSIVAMENTE R01 — Correção Canônica)
  const volumeOperacional = useMemo(
    () => r01Rows.reduce((acc, r) => acc + r.quantidade, 0),
    [r01Rows]
  );

  // 03 — RECEITAS REPORTADAS (Livro oficial de faturamento R03)
  const receitasReportadas = useMemo(
    () => r03Rows.reduce((acc, r) => acc + r.valorFaturado, 0),
    [r03Rows]
  );

  // 04 — DESPESAS APURADAS (Diaristas R02 + Custos Extras R04)
  const diaristasTotal = useMemo(
    () => r02Rows.reduce((acc, r) => acc + r.total, 0),
    [r02Rows]
  );

  const custosExtrasTotal = useMemo(
    () => r04Rows.reduce((acc, r) => acc + r.total, 0),
    [r04Rows]
  );

  const despesasApuradas = useMemo(
    () => diaristasTotal + custosExtrasTotal,
    [diaristasTotal, custosExtrasTotal]
  );

  // BANCO DE HORAS (Microindicador secundário em horas/minutos, sem R$)
  const bancoHorasSaldoMinutos = useMemo(
    () => r05Rows.reduce((acc, r) => acc + r.saldoMinutos, 0),
    [r05Rows]
  );

  const bancoHorasAVencerMinutos = useMemo(
    () => r05Rows.reduce((acc, r) => acc + r.aVencer30dMinutos, 0),
    [r05Rows]
  );

  // Agrupamentos por Domínio para o Infográfico 01
  const registrosOperacional = r01Rows.length + r04Rows.length + r07Rows.length;
  const registrosRH = r02Rows.length + r05Rows.length;
  const registrosFinanceiro = r03Rows.length;

  const pctOperacional = totalRegistros > 0 ? Math.round((registrosOperacional / totalRegistros) * 100) : 0;
  const pctRH = totalRegistros > 0 ? Math.round((registrosRH / totalRegistros) * 100) : 0;
  const pctFinanceiro = totalRegistros > 0 ? Math.max(0, 100 - pctOperacional - pctRH) : 0;

  // Maior valor monetário para escala relativa do Infográfico 02
  const maxValorMonetario = useMemo(
    () => Math.max(receitasReportadas, diaristasTotal, custosExtrasTotal, 1),
    [receitasReportadas, diaristasTotal, custosExtrasTotal]
  );

  // ============================================================
  // MAPA DE MOVIMENTAÇÃO DO PERÍODO: CÁLCULO DOS DIAS (01 A 30)
  // ============================================================
  const heatmapRows = useMemo(() => {
    // Inicializador de 30 dias para Setembro/2026
    const makeDays = () => {
      const days: Record<number, { day: number; dateStr: string; count: number; volume: number; valor: number; pendencias: number; details: string }> = {};
      for (let d = 1; d <= 30; d++) {
        days[d] = {
          day: d,
          dateStr: `2026-09-${String(d).padStart(2, "0")}`,
          count: 0,
          volume: 0,
          valor: 0,
          pendencias: 0,
          details: "Sem movimentação",
        };
      }
      return days;
    };

    if (fluxo === "todos") {
      // Visão Transversal: Linhas por processo suportado
      const rowVol = { id: "vol", code: "VOL", label: "Operações por Volume", reportCode: "R01", badge: "R01", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowServ = { id: "serv", code: "SERV", label: "Serviços Extras", reportCode: "R07", badge: "R07", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowCust = { id: "cust", code: "CUST", label: "Custos Extras", reportCode: "R04", badge: "R04", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowDiar = { id: "diar", code: "DIAR", label: "Diaristas de Campo", reportCode: "R02", badge: "R02", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowFat = { id: "fat", code: "FAT", label: "Faturamento / Receitas", reportCode: "R03", badge: "R03", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r01Rows.forEach((r) => {
        const d = parseInt(r.dataOperacao.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cell = rowVol.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.totalBruto;
          if (r.status !== "CONCLUIDO" || !r.nfNumero) cell.pendencias += 1;
          cell.details = `${r.tipoServico} · ${r.quantidade} unid.`;
          rowVol.totalCount += 1;
          rowVol.totalVolume += r.quantidade;
          rowVol.totalValor += r.totalBruto;
          if (r.status !== "CONCLUIDO" || !r.nfNumero) rowVol.totalPendencias += 1;
        }
      });

      r07Rows.forEach((r) => {
        const d = parseInt(r.data.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cell = rowServ.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.total;
          if (r.pipelineStatus !== "FATURADO") cell.pendencias += 1;
          cell.details = `${r.tipoServico} · ${r.tomadorNome}`;
          rowServ.totalCount += 1;
          rowServ.totalVolume += r.quantidade;
          rowServ.totalValor += r.total;
          if (r.pipelineStatus !== "FATURADO") rowServ.totalPendencias += 1;
        }
      });

      r04Rows.forEach((r) => {
        const d = parseInt(r.data.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cell = rowCust.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.total;
          if (r.status !== "PAGO") cell.pendencias += 1;
          cell.details = `${r.descricao} · ${r.favorecidoNome}`;
          rowCust.totalCount += 1;
          rowCust.totalVolume += r.quantidade;
          rowCust.totalValor += r.total;
          if (r.status !== "PAGO") rowCust.totalPendencias += 1;
        }
      });

      r02Rows.forEach((r) => {
        const d = parseInt(r.dataLancamento.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cell = rowDiar.days[d];
          cell.count += 1;
          cell.volume += r.quantidadeDiarias;
          cell.valor += r.total;
          if (r.statusLote !== "PAGO") cell.pendencias += 1;
          cell.details = `${r.colaboradorNome} (${r.funcao})`;
          rowDiar.totalCount += 1;
          rowDiar.totalVolume += r.quantidadeDiarias;
          rowDiar.totalValor += r.total;
          if (r.statusLote !== "PAGO") rowDiar.totalPendencias += 1;
        }
      });

      r03Rows.forEach((r) => {
        const d = parseInt(r.vencimento.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cell = rowFat.days[d];
          cell.count += 1;
          cell.volume += 1;
          cell.valor += r.valorFaturado;
          if (r.status !== "RECEBIDO") cell.pendencias += 1;
          cell.details = `${r.clienteNome} · Fatura ${formatBRL(r.valorFaturado)}`;
          rowFat.totalCount += 1;
          rowFat.totalVolume += 1;
          rowFat.totalValor += r.valorFaturado;
          if (r.status !== "RECEBIDO") rowFat.totalPendencias += 1;
        }
      });

      return [rowVol, rowServ, rowCust, rowDiar, rowFat];
    }

    if (fluxo === "operacoes-volume") {
      // Subdimensões de Operações por Volume: Carreta, Truck e Outros
      const rowCarreta = { id: "carreta", code: "CARRETA", label: "Descarga de Carreta", badge: "R01", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowTruck = { id: "truck", code: "TRUCK", label: "Descarga Caminhão Truck", badge: "R01", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowOutros = { id: "transb", code: "TRANSB", label: "Transbordo / Outros", badge: "R01", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r01Rows.forEach((r) => {
        const d = parseInt(r.dataOperacao.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const targetRow = r.tipoServico.toLowerCase().includes("carreta")
            ? rowCarreta
            : r.tipoServico.toLowerCase().includes("truck")
            ? rowTruck
            : rowOutros;
          const cell = targetRow.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.totalBruto;
          if (r.status !== "CONCLUIDO" || !r.nfNumero) cell.pendencias += 1;
          cell.details = `${r.tipoServico} · ${r.quantidade} unid. (${r.transportadora})`;
          targetRow.totalCount += 1;
          targetRow.totalVolume += r.quantidade;
          targetRow.totalValor += r.totalBruto;
          if (r.status !== "CONCLUIDO" || !r.nfNumero) targetRow.totalPendencias += 1;
        }
      });

      return [rowCarreta, rowTruck, rowOutros];
    }

    if (fluxo === "servicos-extras") {
      const rowPallet = { id: "pallet", code: "PALLET", label: "Pallets / Movimentação", badge: "R07", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowApoio = { id: "apoio", code: "APOIO", label: "Apoio Logístico / Carga", badge: "R07", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r07Rows.forEach((r) => {
        const d = parseInt(r.data.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const targetRow = r.tipoServico.toLowerCase().includes("pallet") ? rowPallet : rowApoio;
          const cell = targetRow.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.total;
          if (r.pipelineStatus !== "FATURADO") cell.pendencias += 1;
          cell.details = `${r.tipoServico} · ${r.tomadorNome}`;
          targetRow.totalCount += 1;
          targetRow.totalVolume += r.quantidade;
          targetRow.totalValor += r.total;
          if (r.pipelineStatus !== "FATURADO") targetRow.totalPendencias += 1;
        }
      });

      return [rowPallet, rowApoio];
    }

    if (fluxo === "custos-extras") {
      const rowFerram = { id: "ferram", code: "FERRAM", label: "Ferramentas & EPIs", badge: "R04", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowAlim = { id: "alim", code: "ALIM", label: "Alimentação & Campo", badge: "R04", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowManut = { id: "manut", code: "MANUT", label: "Manutenção & Outros", badge: "R04", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r04Rows.forEach((r) => {
        const d = parseInt(r.data.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const cat = r.categoriaCusto.toLowerCase();
          const targetRow = cat.includes("ferram") || cat.includes("epi") ? rowFerram : cat.includes("aliment") ? rowAlim : rowManut;
          const cell = targetRow.days[d];
          cell.count += 1;
          cell.volume += r.quantidade;
          cell.valor += r.total;
          if (r.status !== "PAGO") cell.pendencias += 1;
          cell.details = `${r.descricao} · ${r.favorecidoNome}`;
          targetRow.totalCount += 1;
          targetRow.totalVolume += r.quantidade;
          targetRow.totalValor += r.total;
          if (r.status !== "PAGO") targetRow.totalPendencias += 1;
        }
      });

      return [rowFerram, rowAlim, rowManut];
    }

    if (fluxo === "diaristas") {
      const rowCarga = { id: "carga", code: "CARGA", label: "Carga & Descarga", badge: "R02", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowPalet = { id: "palet", code: "PALET", label: "Paletização & Apoio", badge: "R02", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r02Rows.forEach((r) => {
        const d = parseInt(r.dataLancamento.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const targetRow = r.funcao.toLowerCase().includes("carga") ? rowCarga : rowPalet;
          const cell = targetRow.days[d];
          cell.count += 1;
          cell.volume += r.quantidadeDiarias;
          cell.valor += r.total;
          if (r.statusLote !== "PAGO") cell.pendencias += 1;
          cell.details = `${r.colaboradorNome} · ${r.funcao}`;
          targetRow.totalCount += 1;
          targetRow.totalVolume += r.quantidadeDiarias;
          targetRow.totalValor += r.total;
          if (r.statusLote !== "PAGO") targetRow.totalPendencias += 1;
        }
      });

      return [rowCarga, rowPalet];
    }

    if (fluxo === "banco-horas") {
      const rowClt = { id: "clt", code: "CLT-JORN", label: "Jornada CLT (Apuração Mensal)", badge: "R05", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      // Distribuição indicativa nas segundas-feiras para o consolidado
      [7, 14, 21, 28, 30].forEach((d) => {
        const cell = rowClt.days[d];
        cell.count = r05Rows.length;
        cell.details = `${r05Rows.length} colaboradores CLT apurados`;
      });
      rowClt.totalCount = r05Rows.length;
      return [rowClt];
    }

    if (fluxo === "faturamento-receitas") {
      const rowMensal = { id: "mensal", code: "FAT-MENS", label: "Faturamento Mensal", badge: "R03", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };
      const rowAvista = { id: "avista", code: "A-VISTA", label: "Receitas À Vista / Outras", badge: "R03", days: makeDays(), totalCount: 0, totalVolume: 0, totalValor: 0, totalPendencias: 0 };

      r03Rows.forEach((r) => {
        const d = parseInt(r.vencimento.slice(8, 10), 10);
        if (d >= 1 && d <= 30) {
          const targetRow = r.modalidade === "FATURAMENTO_MENSAL" ? rowMensal : rowAvista;
          const cell = targetRow.days[d];
          cell.count += 1;
          cell.volume += 1;
          cell.valor += r.valorFaturado;
          if (r.status !== "RECEBIDO") cell.pendencias += 1;
          cell.details = `${r.clienteNome} · ${formatBRL(r.valorFaturado)}`;
          targetRow.totalCount += 1;
          targetRow.totalVolume += 1;
          targetRow.totalValor += r.valorFaturado;
          if (r.status !== "RECEBIDO") targetRow.totalPendencias += 1;
        }
      });

      return [rowMensal, rowAvista];
    }

    // Fluxos sem dataset (Intermitentes, CLT / Ponto)
    const rowHomolog = {
      id: "homolog",
      code: "HOMOLOG",
      label: "Em Homologação Operacional",
      badge: "Backlog",
      days: makeDays(),
      totalCount: 0,
      totalVolume: 0,
      totalValor: 0,
      totalPendencias: 0,
    };
    return [rowHomolog];
  }, [fluxo, r01Rows, r07Rows, r04Rows, r02Rows, r03Rows, r05Rows]);

  // Função auxiliar de intensidade para o heatmap (0 a 3)
  const getCellIntensity = (
    cell: { count: number; valor: number; pendencias: number },
    mode: "movimentacao" | "valores" | "pendencias"
  ): number => {
    if (mode === "movimentacao") {
      if (cell.count === 0) return 0;
      if (cell.count === 1) return 1;
      if (cell.count === 2) return 2;
      return 3;
    }
    if (mode === "valores") {
      if (cell.valor === 0) return 0;
      if (cell.valor < 3000) return 1;
      if (cell.valor < 8000) return 2;
      return 3;
    }
    // Pendências: Semântico
    if (cell.pendencias === 0) return 0;
    if (cell.pendencias === 1) return 1;
    return 2;
  };

  // Classes visuais da célula do heatmap
  const getCellClasses = (
    level: number,
    mode: "movimentacao" | "valores" | "pendencias",
    isSelected: boolean
  ): string => {
    const base =
      "w-full aspect-square rounded-[2px] border transition-all duration-150 flex items-center justify-center text-[7.5px] sm:text-[8px] cursor-pointer select-none leading-none ";
    const ring = isSelected
      ? "ring-2 ring-primary ring-offset-1 z-10 scale-110 font-bold "
      : "hover:scale-105 ";

    if (mode === "pendencias") {
      if (level === 0) return base + ring + "bg-muted/20 border-border/40 text-muted-foreground/30";
      if (level === 1)
        return (
          base +
          ring +
          "bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-semibold"
        );
      return base + ring + "bg-rose-600 text-white border-rose-500 font-bold shadow-2xs";
    }

    // Monocromático Institucional no Azul ORBE (#2563EB)
    if (level === 0) return base + ring + "bg-muted/20 border-border/40 text-muted-foreground/30";
    if (level === 1)
      return (
        base +
        ring +
        "bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-900/40"
      );
    if (level === 2)
      return (
        base +
        ring +
        "bg-blue-300 dark:bg-blue-900/60 text-blue-950 dark:text-blue-100 border-blue-400 dark:border-blue-800/60 font-semibold"
      );
    return base + ring + "bg-[#2563EB] text-white border-blue-400 font-bold shadow-2xs";
  };

  // ============================================================
  // INTERATIVIDADE INFOGRÁFICO -> CATÁLOGO (DESTACAR FONTE)
  // ============================================================
  const handleHighlightReport = (reportId: string) => {
    setHighlightedReportId(reportId);
    // Rolar suavemente até o catálogo
    const targetElement = document.getElementById(`report-row-${reportId}`);
    if (targetElement && typeof targetElement.scrollIntoView === "function") {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Filtragem do Catálogo (com Filtro Global de Fluxo — HOTFIX 03.2)
  const filteredReports = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return RELATORIOS_CATALOGO.filter((r) => {
      // 1. Filtro Global por Fluxo (HOTFIX 03.2)
      if (fluxo !== "todos") {
        if (fluxo === "operacoes-volume" && r.id !== "r01-operacoes-volume") return false;
        if (fluxo === "servicos-extras" && r.id !== "r07-servicos-extras") return false;
        if (fluxo === "custos-extras" && r.id !== "r04-custos-extras") return false;
        if (fluxo === "diaristas" && r.id !== "r02-fechamento-diaristas") return false;
        if (fluxo === "banco-horas" && r.id !== "r05-banco-horas") return false;
        if (fluxo === "faturamento-receitas" && r.id !== "r03-faturamento-receitas") return false;
        if (fluxo === "intermitentes" || fluxo === "clt-ponto") return false;
      }
      // 2. Filtro Rápido (Todos / Favoritos / Recentes)
      if (quickFilter === "favoritos" && !favorites.includes(r.id)) {
        return false;
      }
      // 3. Filtro de Domínio
      if (domainFilter !== "all" && r.category !== domainFilter) {
        return false;
      }
      // 4. Filtro de Texto (código, título, descrição, categoria ou dimensões)
      if (!term) return true;
      const dims = REPORT_DIMENSIONS[r.id] || [];
      const matchDim = dims.some((d) => d.toLowerCase().includes(term));
      return (
        r.code.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        matchDim
      );
    });
  }, [searchTerm, domainFilter, quickFilter, favorites, fluxo]);

  const categories = ["OPERACIONAL", "PESSOAS & RH", "FINANCEIRO & FATURAMENTO"] as const;

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "relatorios") return;
    if (id === "dashboard") {
      navigate("/ux-lab");
      return;
    }
    if (id === "torre-operacional") {
      navigate("/ux-lab/torre");
      return;
    }
    if (id === "operacoes-volume") {
      navigate("/ux-lab/operacoes-volume");
      return;
    }
    if (id === "servicos-extras") {
      navigate("/ux-lab/servicos-extras");
      return;
    }
    if (id === "custos-extras") {
      navigate("/ux-lab/custos-extras");
      return;
    }
    if (id === "dre") {
      navigate("/ux-lab/dre");
      return;
    }
    if (id === "design-system") {
      navigate("/ux-lab/design-system");
      return;
    }
    toast.info(`Módulo em planejamento: ${label}`, {
      description: "Este módulo especialista será prototipado em sua própria fase do UX Lab.",
    });
  };

  const handleOpenReport = (reportId: string) => {
    navigate(`/ux-lab/relatorios/${reportId}?empresa=${empresaId}&competencia=${competencia}`);
  };

  // ============================================================
  // EMISSÃO DOCUMENTAL RÁPIDA: EXPORTAÇÃO CSV DE UM RELATÓRIO
  // ============================================================
  const handleExportSingleCSV = (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const sanitize = (val: unknown) => `"${String(val ?? "").replaceAll('"', '""')}"`;

    if (reportId === "r01-operacoes-volume") {
      headers = ["Data", "Código", "Unidade", "Transportadora", "Serviço", "Carga", "Quantidade", "Valor Unitário (R$)", "Total Bruto (R$)", "Materiais (R$)", "ISS (R$)", "Placa", "NF", "Status"];
      rows = r01Rows.map((r) => [r.dataOperacao, r.codigoOperacional, r.unidade, r.transportadora, r.tipoServico, r.produtoCarga, r.quantidade, r.valorUnitario.toFixed(2), r.totalBruto.toFixed(2), r.materiais.toFixed(2), r.iss.toFixed(2), r.placa, r.nfNumero || "—", r.status]);
    } else if (reportId === "r02-fechamento-diaristas") {
      headers = ["Data", "Colaborador", "CPF", "Função", "Código", "Quantidade de Diárias", "Valor da Diária (R$)", "Total (R$)", "Lote", "Status do Lote"];
      rows = r02Rows.map((r) => [r.dataLancamento, r.colaboradorNome, r.cpfMascarado, r.funcao, r.codigoMarcacao, r.quantidadeDiarias, r.valorDiariaBase.toFixed(2), r.total.toFixed(2), r.loteCodigo, getStatusLoteDiaristaLabel(r.statusLote).label]);
    } else if (reportId === "r03-faturamento-receitas") {
      headers = ["Competência", "Cliente", "Modalidade", "Origem", "Valor Faturado (R$)", "Vencimento", "Data Recebimento", "Status Persistido", "Situação (Derivada)"];
      rows = r03Rows.map((r) => [r.competenciaFormatada, r.clienteNome, getModalidadeLabel(r.modalidade), r.origem, r.valorFaturado.toFixed(2), r.vencimento, r.dataRecebimento || "—", getStatusReceitaLabel(r.status), getSituacaoDerivadaReceita(r).descricao]);
    } else if (reportId === "r04-custos-extras") {
      headers = ["Data", "Unidade", "Categoria", "Descrição", "Favorecido", "Tipo Favorecido", "Quantidade", "Valor Unitário (R$)", "Total (R$)", "Origem do Recurso", "Lançador", "Status"];
      rows = r04Rows.map((r) => [r.data, r.unidade, getCategoriaCustoLabel(r.categoriaCusto), r.descricao, r.favorecidoNome, r.favorecidoTipo, r.quantidade, r.valorUnitario.toFixed(2), r.total.toFixed(2), r.origemRecurso, r.lancadorNome, getStatusCustoExtraLabel(r.status).label]);
    } else if (reportId === "r05-banco-horas") {
      headers = ["Matrícula", "Colaborador", "Competência", "Saldo Atual", "Créditos", "Débitos", "A Vencer (30d)", "Vencidas", "Status"];
      rows = r05Rows.map((r) => [r.matricula, r.colaboradorNome, r.competencia, r.saldoFormatado, r.creditosFormatado, r.debitosFormatado, r.aVencer30dFormatado, r.vencidasFormatado, r.status]);
    } else if (reportId === "r07-servicos-extras") {
      headers = ["Data", "Tipo de Serviço", "Descrição", "Cliente / Tomador", "Quantidade", "Valor Unitário (R$)", "Total (R$)", "Modalidade Financeira", "NF", "Status Pipeline"];
      rows = r07Rows.map((r) => [r.data, r.tipoServico, r.descricao, r.tomadorNome, r.quantidade, r.valorUnitario.toFixed(2), r.total.toFixed(2), r.modalidadeFinanceira, r.nfNumero || "—", getPipelineStatusServicoExtraLabel(r.pipelineStatus).label]);
    }

    if (rows.length === 0) {
      toast.info("Caderno sem registros no período filtrado para exportação.");
      return;
    }

    const csvContent = "\uFEFF" + [headers.map(sanitize).join(";"), ...rows.map((row) => row.map(sanitize).join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ORBE_${reportId.toUpperCase()}_${empresaId}_${competencia}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Documento emitido em CSV", {
      description: `Arquivo estruturado exportado para a empresa ${empresaSelecionada.name}.`,
    });
  };

  // ============================================================
  // EMISSÃO DOCUMENTAL: DOSSIÊ CONSOLIDADO DA COMPETÊNCIA
  // ============================================================
  const handleGenerateDossier = () => {
    if (dossierFormat === "dados_estruturados") {
      // Exportação de dados estruturados consolidados
      const sanitize = (val: unknown) => `"${String(val ?? "").replaceAll('"', '""')}"`;
      const dossierSummary = [
        ["CADERNO DOCUMENTAL", "ORBE ERP — ESC LOGÍSTICA"],
        ["EMPRESA", `${empresaSelecionada.name} (${empresaSelecionada.document})`],
        ["COMPETÊNCIA", competencia],
        ["TOTAL REGISTROS APURADOS", totalRegistros],
        ["VOLUME OPERACIONAL (R01)", volumeOperacional],
        ["RECEITAS REPORTADAS (R03)", receitasReportadas.toFixed(2)],
        ["DESPESAS APURADAS (R02+R04)", despesasApuradas.toFixed(2)],
        ["BANCO DE HORAS SALDO", formatMinutosToHourString(bancoHorasSaldoMinutos)],
        [],
        ["RELATÓRIOS INCLUÍDOS NO DOSSIÊ", selectedDossierReports.join(", ")],
      ];

      const csvContent = "\uFEFF" + dossierSummary.map((line) => line.map(sanitize).join(";")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `ORBE_DOSSIE_COMPETENCIA_${empresaId}_${competencia}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Dossiê gerado com sucesso", {
        description: "Caderno compilado em arquivo estruturado CSV (UTF-8 BOM).",
      });
      setIsDossierOpen(false);
      return;
    }

    // PDF Consolidado ou PDFs em Lote: Documentação de Backlog arquitetural
    toast.info("Compilação de Dossiê em Lote", {
      description: "Compilação de múltiplos cadernos em PDF cadastrada no backlog arquitetural UX04-FUTURE-DOSSIER-01. Abrindo visão documental do primeiro caderno selecionado.",
    });
    setIsDossierOpen(false);
    const firstReport = selectedDossierReports.find((r) => r !== "sintese") || "r01-operacoes-volume";
    navigate(`/ux-lab/relatorios/${firstReport}?empresa=${empresaId}&competencia=${competencia}`);
  };

  return (
    <UxLabShell
      activeItem="relatorios"
      onSelectItem={handleSidebarSelect}
      title="Central de Relatórios"
      subtitle="Radiografia analítica, cadernos oficiais e exportação documental consolidada"
    >
      <div className="space-y-6 pb-20">
        
        {/* ============================================================ */}
        {/* A — CABEÇALHO DOCUMENTAL INTEGRADO COM SELETORES GLOBAIS    */}
        {/* ============================================================ */}
        <section className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                  ORBE Documental
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {empresaSelecionada.city}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">
                  Fase 03 · Emissão & Integridade
                </Badge>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground font-display">
                Central de Relatórios Oficiais
              </h1>
              <p className="text-xs text-muted-foreground">
                Consolidação dos livros analíticos parametrizados por empresa e competência contábil-operacional.
              </p>
            </div>

            {/* Ações e Seletores Globais de Contexto (Empresa + Competência + Fluxo) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={empresaId} onValueChange={handleEmpresaChange}>
                  <SelectTrigger className="w-[230px] h-9 text-xs font-medium bg-background border-border/80 focus:ring-1 focus:ring-primary" aria-label="Selecione a empresa">
                    <SelectValue placeholder="Selecione a Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESAS_DISPONIVEIS.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={competencia} onValueChange={handleCompetenciaChange}>
                  <SelectTrigger className="w-[220px] h-9 text-xs font-medium bg-background border-border/80 focus:ring-1 focus:ring-primary" aria-label="Selecione a competência">
                    <SelectValue placeholder="Selecione a Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPETENCIAS_DISPONIVEIS.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs font-mono">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor Global de Fluxo (HOTFIX 03.2) */}
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={fluxo} onValueChange={(val) => handleFluxoChange(val as FluxoId)}>
                  <SelectTrigger className="w-[220px] h-9 text-xs font-medium bg-background border-border/80 focus:ring-1 focus:ring-primary" aria-label="Selecione o fluxo">
                    <SelectValue placeholder="Selecione o Fluxo" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLUXOS_DISPONIVEIS.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{f.label}</span>
                          {f.reportCode && (
                            <span className="font-mono text-[10px] text-muted-foreground">({f.reportCode})</span>
                          )}
                          {!f.hasDataset && (
                            <span className="text-[9px] font-mono text-amber-500 font-semibold">[Backlog]</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CTA Institucional: Gerar Dossiê da Competência (Azul Royal #2563EB) */}
              <Button
                type="button"
                onClick={() => setIsDossierOpen(true)}
                className="h-9 px-3.5 text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs transition-all gap-1.5"
              >
                <FileArchive className="h-3.5 w-3.5" />
                <span>Gerar Dossiê da Competência</span>
              </Button>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* B — SÍNTESE DA COMPETÊNCIA (ADAPTADA AO FILTRO DE FLUXO)      */}
        {/* ============================================================ */}
        {fluxo === "todos" ? (
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              
              {/* KPI 01 — REGISTROS CONSOLIDADOS */}
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Registros Consolidados
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {totalRegistros}
                  </span>
                  <span className="text-xs text-muted-foreground">itens</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 pt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span>{relatoriosAtivos}/6 relatórios com movimentação</span>
                </p>
              </div>

              {/* KPI 02 — VOLUME OPERACIONAL (R01 EXCLUSIVO) */}
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Volume Operacional
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {volumeOperacional.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">unid.</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                  Operações por Volume · R01
                </p>
              </div>

              {/* KPI 03 — RECEITAS REPORTADAS (R03) */}
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Receitas Reportadas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(receitasReportadas)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                  Livro de Faturamento · R03
                </p>
              </div>

              {/* KPI 04 — DESPESAS APURADAS (R02 + R04) */}
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Despesas Apuradas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(despesasApuradas)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 pt-0.5 flex-wrap">
                  <span>Diaristas: <strong className="text-foreground font-mono">{formatBRL(diaristasTotal)}</strong></span>
                  <span>·</span>
                  <span>Custos: <strong className="text-foreground font-mono">{formatBRL(custosExtrasTotal)}</strong></span>
                </div>
              </div>

            </div>

            {/* Microinformação Contextual: Banco de Horas (Sem Moeda, Sem Passivo) */}
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Banco de Horas (CLT) · R05:
                </span>
                <span className="text-muted-foreground">
                  Saldo consolidado:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {formatMinutosToHourString(bancoHorasSaldoMinutos)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {formatMinutosToHourString(bancoHorasAVencerMinutos)} a vencer (30d)
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  ({r05Rows.length} colaboradores apurados)
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 inline-block" />
                <span>Base comparativa anterior: fechamento homologado em apuração (UX04-FUTURE-COMPARE-01)</span>
              </div>
            </div>
          </section>
        ) : fluxo === "operacoes-volume" ? (
          /* SÍNTESE ESPECÍFICA: OPERAÇÕES POR VOLUME (R01) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Operações Registradas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r01Rows.length}
                  </span>
                  <span className="text-xs text-muted-foreground">descargas</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                  100% com documento fiscal emitido
                </p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Volume Físico Movimentado
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {volumeOperacional.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">unid.</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                  Volume físico apurado nos manifestos
                </p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Faturamento Bruto Previsto
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(r01Rows.reduce((acc, r) => acc + r.totalBruto, 0))}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                  Faturamento primário de descargas
                </p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Materiais & ISS Documentados
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(r01Rows.reduce((acc, r) => acc + r.materiais + r.iss, 0))}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 pt-0.5">
                  <span>Filme Stretch: <strong className="text-foreground font-mono">{formatBRL(r01Rows.reduce((acc, r) => acc + r.materiais, 0))}</strong></span>
                  <span>·</span>
                  <span>ISS: <strong className="text-foreground font-mono">{formatBRL(r01Rows.reduce((acc, r) => acc + r.iss, 0))}</strong></span>
                </div>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground text-[11px] uppercase font-mono">Subtotal Líquido Apurado:</span>
                <strong className="text-foreground font-mono text-xs">{formatBRL(r01Rows.reduce((acc, r) => acc + r.totalLiquido, 0))}</strong>
                <span>·</span>
                <span>{new Set(r01Rows.map((r) => r.transportadora)).size} transportadoras ativas</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                Caderno Oficial: R01
              </Badge>
            </div>
          </section>
        ) : fluxo === "servicos-extras" ? (
          /* SÍNTESE ESPECÍFICA: SERVIÇOS EXTRAS (R07) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Serviços Executados
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r07Rows.length}
                  </span>
                  <span className="text-xs text-muted-foreground">serviços</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Serviços extraordinários de campo</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Quantidade Física Agregada
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r07Rows.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">itens</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Pallets, carretas e movimentações</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Valor Total dos Serviços
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(r07Rows.reduce((acc, r) => acc + r.total, 0))}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Faturamento adicional apurado</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Tomadores Atendidos
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {new Set(r07Rows.map((r) => r.tomadorNome)).size}
                  </span>
                  <span className="text-xs text-muted-foreground">clientes</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Clientes demandantes no período</p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Modalidades: À Vista, Faturamento Direto e Repasse Operacional</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">Caderno Oficial: R07</Badge>
            </div>
          </section>
        ) : fluxo === "custos-extras" ? (
          /* SÍNTESE ESPECÍFICA: CUSTOS EXTRAS (R04) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Lançamentos de Despesa
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r04Rows.length}
                  </span>
                  <span className="text-xs text-muted-foreground">lançamentos</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Despesas operacionais de campo</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Total Desembolsado
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(custosExtrasTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Total apurado no livro de despesas</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Categorias Ativas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {new Set(r04Rows.map((r) => r.categoriaCusto)).size}
                  </span>
                  <span className="text-xs text-muted-foreground">categorias</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Ferramentas, EPIs, Alimentação e Manutenção</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Favorecidos Distintos
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {new Set(r04Rows.map((r) => r.favorecidoNome)).size}
                  </span>
                  <span className="text-xs text-muted-foreground">favorecidos</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Fornecedores e colaboradores indenizados</p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Classificação de origem: Adiantamento de Campo, Reembolso e Caixa Operacional</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">Caderno Oficial: R04</Badge>
            </div>
          </section>
        ) : fluxo === "diaristas" ? (
          /* SÍNTESE ESPECÍFICA: DIARISTAS (R02) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Diárias Apuradas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r02Rows.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">diárias</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Jornadas e frações validadas</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Valor Total Apurado
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(diaristasTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Desembolso bruto de diárias</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Lotes Emitidos
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {new Set(r02Rows.map((r) => r.loteCodigo)).size}
                  </span>
                  <span className="text-xs text-muted-foreground">lotes</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Fechamentos semanais de campo</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Diaristas Únicos
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {new Set(r02Rows.map((r) => r.colaboradorNome)).size}
                  </span>
                  <span className="text-xs text-muted-foreground">profissionais</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Mobilizados na competência</p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Validação operacional pelo encarregado e aprovação RH</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">Caderno Oficial: R02</Badge>
            </div>
          </section>
        ) : fluxo === "banco-horas" ? (
          /* SÍNTESE ESPECÍFICA: BANCO DE HORAS (R05) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Colaboradores CLT
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r05Rows.length}
                  </span>
                  <span className="text-xs text-muted-foreground">apurados</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Quadro CLT ativo na competência</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Saldo Consolidado
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatMinutosToHourString(bancoHorasSaldoMinutos)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Saldo líquido acumulado em horas</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Créditos vs Débitos
                </span>
                <div className="text-xs font-mono font-bold text-foreground pt-1">
                  <span>+{formatMinutosToHourString(r05Rows.reduce((acc, r) => acc + r.creditosMinutos, 0)).replace("+", "")}</span>
                  <span className="text-muted-foreground font-normal"> / </span>
                  <span className="text-rose-600 dark:text-rose-400">-{formatMinutosToHourString(r05Rows.reduce((acc, r) => acc + r.debitosMinutos, 0)).replace("-", "").replace("+", "")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Créditos de horas e compensações</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · A Vencer em 30 Dias
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
                    {formatMinutosToHourString(bancoHorasAVencerMinutos)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-600/80 font-medium pt-0.5">Saldo sujeito a expiração de acordo</p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Regra CCT e apuração eletrônica de ponto e jornada CLT</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">Caderno Oficial: R05</Badge>
            </div>
          </section>
        ) : fluxo === "faturamento-receitas" ? (
          /* SÍNTESE ESPECÍFICA: FATURAMENTO E RECEITAS (R03) */
          <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  01 · Faturas Fiscais
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {r03Rows.length}
                  </span>
                  <span className="text-xs text-muted-foreground">faturas</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Documentos fiscais emitidos</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  02 · Receitas Reportadas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {formatBRL(receitasReportadas)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Livro de faturamento fiscal</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  03 · Recebimentos Liquidados
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatBRL(r03Rows.filter((r) => r.status === "RECEBIDO").reduce((acc, r) => acc + r.valorFaturado, 0))}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Valores baixados e conciliados</p>
              </div>
              <div className="p-4 md:p-5 space-y-1.5 hover:bg-muted/10 transition-colors">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  04 · Receitas em Aberto
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
                    {formatBRL(r03Rows.filter((r) => r.status !== "RECEBIDO").reduce((acc, r) => acc + r.valorFaturado, 0))}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">Valores a receber e conciliar</p>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Modalidades: Faturamento Mensal, Receitas À Vista e Duplicatas</span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">Caderno Oficial: R03</Badge>
            </div>
          </section>
        ) : (
          /* ESTADO HONESTO PARA FLUXOS SEM DATASET SUPORTADO (Intermitentes, CLT / Ponto) */
          <section className="bg-card border border-dashed border-amber-500/40 rounded-xl p-6 text-center space-y-2 bg-amber-500/5">
            <div className="h-10 w-10 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground font-display">
              Caderno Oficial em Homologação Operacional
            </h3>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              O fluxo <strong>{FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.label}</strong> encontra-se em fase de auditoria e integração com os módulos operacionais do ORBE. Nenhum caderno ou métrica sintética foi fabricado.
            </p>
            <div className="pt-1">
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-300">
                Backlog Arquitetural: {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.backlogRef}
              </Badge>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* FAIXA ANALÍTICA 1: MAPA DE MOVIMENTAÇÃO | ATIVIDADE DOCUMENTAL */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          
          {/* ESQUERDA: MAPA DE MOVIMENTAÇÃO DO PERÍODO (HEATMAP DOCUMENTAL) */}
          <section className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm font-bold tracking-tight text-foreground uppercase font-display flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-[#2563EB]" />
                    <span>Mapa de Movimentação do Período</span>
                  </h3>
                  <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary bg-primary/5">
                    {mapaMode === "movimentacao" ? "Volume de Lançamentos" : mapaMode === "valores" ? "Intensidade Financeira" : "Concentração de Pendências"}
                  </Badge>
                  {selectedDay && (
                    <Badge className="text-[9px] font-mono bg-[#2563EB] text-white flex items-center gap-1">
                      <span>Recorte: Dia {selectedDay}/09/2026</span>
                      <button
                        type="button"
                        onClick={handleClearDayFilter}
                        className="hover:text-white/80 ml-0.5 cursor-pointer"
                        title="Limpar recorte do dia"
                        aria-label="Limpar recorte do dia"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  Matriz de intensidade temporal na competência Setembro / 2026. Clique em uma célula ou dia para aplicar o recorte analítico.
                </p>
              </div>

              {/* Seletor de Modos (Movimentação | Valores | Pendências) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setMapaMode("movimentacao")}
                    className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                      mapaMode === "movimentacao"
                        ? "bg-[#2563EB] text-white shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Movimentação
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapaMode("valores")}
                    className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                      mapaMode === "valores"
                        ? "bg-[#2563EB] text-white shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Valores
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapaMode("pendencias")}
                    className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                      mapaMode === "pendencias"
                        ? "bg-amber-600 text-white shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pendências
                  </button>
                </div>

                {selectedDay && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearDayFilter}
                    className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <X className="h-3 w-3" />
                    <span>Limpar recorte</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Grade de 30 Colunas (Dias 01 a 30) - Sem Scroll Horizontal em Desktop */}
            <div className="w-full space-y-1">
              {/* Linha de Cabeçalho dos Dias (01 a 30) */}
              <div className="flex items-center">
                <div className="w-14 sm:w-16 shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground pr-1 truncate">
                  Dia
                </div>
                <div className="flex-1" style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))", gap: "1.5px" }}>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
                    const dayStr = String(d).padStart(2, "0");
                    const isSelected = selectedDay === dayStr;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleSelectDay(d)}
                        aria-label={`Filtrar pelo dia ${dayStr}`}
                        className={`py-0.5 text-center font-mono text-[7.5px] sm:text-[8px] rounded transition-all cursor-pointer leading-none ${
                          isSelected
                            ? "bg-[#2563EB] text-white font-bold shadow-2xs"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                        title={`Dia ${dayStr}/09/2026 — Clique para recortar`}
                      >
                        {dayStr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Linhas de Processos / Sub-dimensões */}
              {heatmapRows.map((row) => (
                <div key={row.id} className="flex items-center group">
                  <div className="w-14 sm:w-16 shrink-0 flex items-center justify-between pr-1">
                    <span className="font-mono text-[10.5px] font-bold text-foreground truncate" title={row.label}>
                      {row.code}
                    </span>
                    <span className="text-[8.5px] text-muted-foreground font-mono truncate hidden sm:inline">
                      {mapaMode === "movimentacao"
                        ? `${row.totalCount}`
                        : mapaMode === "valores"
                        ? formatBRL(row.totalValor).replace("R$", "").trim()
                        : `${row.totalPendencias}`}
                    </span>
                  </div>
                  <div className="flex-1" style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))", gap: "1.5px" }}>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
                      const cell = row.days[d] || {
                        day: d,
                        dateStr: `2026-09-${String(d).padStart(2, "0")}`,
                        count: 0,
                        volume: 0,
                        valor: 0,
                        pendencias: 0,
                        details: "Sem movimentação",
                      };
                      const level = getCellIntensity(cell, mapaMode);
                      const dayStr = String(d).padStart(2, "0");
                      const isSelected = selectedDay === dayStr;

                      return (
                        <div
                          key={d}
                          onClick={() => handleSelectDay(d)}
                          onMouseEnter={() =>
                            setHoveredCell({
                              rowLabel: row.label,
                              day: d,
                              dateStr: cell.dateStr,
                              count: cell.count,
                              volume: cell.volume,
                              valor: cell.valor,
                              pendencias: cell.pendencias,
                              details: cell.details,
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          className={getCellClasses(level, mapaMode, isSelected)}
                          title={`${cell.dateStr} — ${row.label}\n${cell.count} registros | ${formatBRL(cell.valor)}${cell.pendencias > 0 ? ` | ${cell.pendencias} pendências` : ""}`}
                        >
                          {cell.count > 0 && mapaMode === "movimentacao" ? cell.count : ""}
                          {cell.pendencias > 0 && mapaMode === "pendencias" ? "!" : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Tooltip / Caixa de Inspeção ao Vivo da Célula */}
            <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
              {hoveredCell ? (
                <div className="flex items-center gap-1.5 flex-wrap text-foreground text-[10.5px]">
                  <span className="font-mono font-bold text-primary">{hoveredCell.dateStr}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">{hoveredCell.rowLabel}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono">{hoveredCell.count} reg.</span>
                  {hoveredCell.volume > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono">{hoveredCell.volume.toLocaleString("pt-BR")} unid.</span>
                    </>
                  )}
                  {hoveredCell.valor > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(hoveredCell.valor)}
                      </span>
                    </>
                  )}
                  {hoveredCell.pendencias > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {hoveredCell.pendencias} pend.
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                  <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">Passe o mouse para detalhar as movimentações ou clique para filtrar o dia.</span>
                </div>
              )}

              {/* Legenda de Intensidade */}
              <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground shrink-0 font-mono">
                <span>Intensidade:</span>
                {mapaMode === "pendencias" ? (
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[2px] bg-muted/40 border border-border/60" title="Sem pendências" />
                    <span className="h-2 w-2 rounded-[2px] bg-amber-100 dark:bg-amber-950/50 border border-amber-300" title="Atenção" />
                    <span className="h-2 w-2 rounded-[2px] bg-rose-600 border border-rose-500" title="Crítico" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[2px] bg-muted/40 border border-border/60" title="Neutro (0)" />
                    <span className="h-2 w-2 rounded-[2px] bg-blue-100 dark:bg-blue-950/40 border border-blue-200" title="Baixo (1)" />
                    <span className="h-2 w-2 rounded-[2px] bg-blue-300 dark:bg-blue-900/60 border border-blue-400" title="Médio (2)" />
                    <span className="h-2 w-2 rounded-[2px] bg-[#2563EB] border border-blue-400" title="Pico (3)" />
                  </div>
                )}
                <span className="text-[9px]">Azul ORBE</span>
              </div>
            </div>
          </section>

          {/* DIREITA: ATIVIDADE DOCUMENTAL DO PERÍODO */}
          <section className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase font-display flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Atividade Documental do Período</span>
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {totalRegistros} registros totais
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Origem e proporção dos registros apurados nos livros oficiais. Clique em um relatório para localizá-lo.
              </p>
            </div>

            {/* Barra de Proporção dos 3 Domínios (Monocromático Institucional) */}
            <div className="space-y-2 pt-0.5">
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/60">
                <div
                  style={{ width: `${pctOperacional}%` }}
                  className="bg-primary hover:opacity-90 transition-all"
                  title={`Operacional: ${registrosOperacional} reg. (${pctOperacional}%)`}
                />
                <div
                  style={{ width: `${pctRH}%` }}
                  className="bg-muted-foreground hover:opacity-90 transition-all"
                  title={`Pessoas & RH: ${registrosRH} reg. (${pctRH}%)`}
                />
                <div
                  style={{ width: `${pctFinanceiro}%` }}
                  className="bg-foreground/80 hover:opacity-90 transition-all"
                  title={`Financeiro: ${registrosFinanceiro} reg. (${pctFinanceiro}%)`}
                />
              </div>

              {/* Legenda de Domínios */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                  <span>Operacional: <strong className="text-foreground font-mono">{registrosOperacional}</strong> ({pctOperacional}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />
                  <span>RH: <strong className="text-foreground font-mono">{registrosRH}</strong> ({pctRH}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-foreground/80 inline-block" />
                  <span>Financeiro: <strong className="text-foreground font-mono">{registrosFinanceiro}</strong> ({pctFinanceiro}%)</span>
                </div>
              </div>
            </div>

            {/* Micro-barras Horizontais Interativas por Relatório */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Densidade por Caderno Oficial:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "r01-operacoes-volume", code: "R01", title: "Operações Volume", count: r01Rows.length, domain: "Operacional" },
                  { id: "r04-custos-extras", code: "R04", title: "Custos Extras", count: r04Rows.length, domain: "Operacional" },
                  { id: "r07-servicos-extras", code: "R07", title: "Serviços Extras", count: r07Rows.length, domain: "Operacional" },
                  { id: "r02-fechamento-diaristas", code: "R02", title: "Diaristas", count: r02Rows.length, domain: "RH" },
                  { id: "r05-banco-horas", code: "R05", title: "Banco de Horas", count: r05Rows.length, domain: "RH" },
                  { id: "r03-faturamento-receitas", code: "R03", title: "Faturamento", count: r03Rows.length, domain: "Financeiro" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Destacar relatório ${item.code} no catálogo`}
                    onClick={() => handleHighlightReport(item.id)}
                    className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      highlightedReportId === item.id
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-foreground">{item.code}</span>
                      <span className="font-mono font-semibold text-foreground text-[11px]">{item.count} reg.</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate pt-0.5">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

        </div>

        {/* ============================================================ */}
        {/* FAIXA ANALÍTICA 2: VALORES DOCUMENTADOS | INTEGRIDADE DOCUMENTAL */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          
          {/* ESQUERDA: VALORES DOCUMENTADOS NO PERÍODO */}
          <section className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase font-display flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <span>Valores Documentados no Período</span>
                </h3>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 text-muted-foreground">
                  Grandezas Oficiais
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparação proporcional das grandezas registradas nos livros canônicos de faturamento e desembolsos de campo.
              </p>
            </div>

            {/* Barras Proporcionais das Três Grandezas Oficiais */}
            <div className="space-y-3 pt-0.5">
              
              {/* Receitas Reportadas — R03 */}
              <div
                onClick={() => handleHighlightReport("r03-faturamento-receitas")}
                className="group cursor-pointer space-y-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                title="Clique para localizar o relatório R03 no catálogo"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                      R03
                    </span>
                    <span className="font-medium text-foreground">Receitas Reportadas</span>
                    <span className="text-[10px] text-muted-foreground">({r03Rows.length} faturas)</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {formatBRL(receitasReportadas)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(4, Math.round((receitasReportadas / maxValorMonetario) * 100))}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Diaristas Apurados — R02 */}
              <div
                onClick={() => handleHighlightReport("r02-fechamento-diaristas")}
                className="group cursor-pointer space-y-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                title="Clique para localizar o relatório R02 no catálogo"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                      R02
                    </span>
                    <span className="font-medium text-foreground">Diaristas Apurados</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({r02Rows.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} diárias)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {formatBRL(diaristasTotal)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(4, Math.round((diaristasTotal / maxValorMonetario) * 100))}%` }}
                    className="h-full bg-primary rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Custos Extras — R04 */}
              <div
                onClick={() => handleHighlightReport("r04-custos-extras")}
                className="group cursor-pointer space-y-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                title="Clique para localizar o relatório R04 no catálogo"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                      R04
                    </span>
                    <span className="font-medium text-foreground">Custos Extras</span>
                    <span className="text-[10px] text-muted-foreground">({r04Rows.length} lançamentos)</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {formatBRL(custosExtrasTotal)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(4, Math.round((custosExtrasTotal / maxValorMonetario) * 100))}%` }}
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

            </div>

            {/* Aviso Canônico de Segregação (Anti-DRE) */}
            <div className="pt-2 border-t border-border/60">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  Valores provenientes dos livros oficiais. Não representa resultado contábil ou apuração de margem.
                </span>
              </p>
            </div>
          </section>

          {/* DIREITA: INTEGRIDADE DOCUMENTAL DA COMPETÊNCIA (COMPACTADA) */}
          <section className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3.5">
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase font-display flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Integridade Documental da Competência</span>
                </h3>

                <Badge variant="outline" className="h-5 text-[10px] font-mono font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                  {relatoriosAtivos}/6 cadernos com dados apurados
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Verificação de disponibilidade e consistência dos cadernos canônicos apurados para a empresa e período.
              </p>
            </div>

            {/* Grid Interno Compacto dos 6 Cadernos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                {
                  code: "R01",
                  fluxoKey: "operacoes-volume",
                  title: "Operações por Volume",
                  count: r01Rows.length,
                  detail: `${volumeOperacional.toLocaleString("pt-BR")} unid.`,
                  status: r01Rows.length > 0 ? "Com dados" : "Sem dados",
                },
                {
                  code: "R02",
                  fluxoKey: "diaristas",
                  title: "Fechamento Diaristas",
                  count: r02Rows.length,
                  detail: `${r02Rows.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} diárias`,
                  status: r02Rows.length > 0 ? "Com dados" : "Sem dados",
                },
                {
                  code: "R03",
                  fluxoKey: "faturamento-receitas",
                  title: "Faturamento & Receitas",
                  count: r03Rows.length,
                  detail: `${formatBRL(receitasReportadas)}`,
                  status: r03Rows.length > 0 ? "Com dados" : "Sem dados",
                },
                {
                  code: "R04",
                  fluxoKey: "custos-extras",
                  title: "Custos Extras",
                  count: r04Rows.length,
                  detail: `${formatBRL(custosExtrasTotal)}`,
                  status: r04Rows.length > 0 ? "Com dados" : "Sem dados",
                },
                {
                  code: "R05",
                  fluxoKey: "banco-horas",
                  title: "Consolidado Banco Horas",
                  count: r05Rows.length,
                  detail: `${formatMinutosToHourString(bancoHorasSaldoMinutos)} (${r05Rows.length} colabs)`,
                  status: r05Rows.length > 0 ? "Com dados" : "Sem dados",
                },
                {
                  code: "R07",
                  fluxoKey: "servicos-extras",
                  title: "Serviços Extras",
                  count: r07Rows.length,
                  detail: `${r07Rows.length} serv. adicionais`,
                  status: r07Rows.length > 0 ? "Com dados" : "Sem dados",
                },
              ].map((item) => {
                const isSelectedFluxo = fluxo === item.fluxoKey;
                return (
                  <div
                    key={item.code}
                    className={`p-2 rounded-lg border transition-all flex flex-col justify-between ${
                      isSelectedFluxo
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/70 bg-muted/15 hover:bg-muted/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-mono text-xs font-bold text-foreground">{item.code}</span>
                        {isSelectedFluxo && (
                          <Badge className="text-[8px] h-3.5 px-1 bg-[#2563EB] text-white font-mono">Foco</Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[8.5px] font-mono shrink-0 px-1 py-0 h-4 ${
                          item.status === "Com dados"
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : "border-border/60 text-muted-foreground bg-muted/40"
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <div className="text-[10.5px] font-semibold text-foreground truncate" title={item.title}>
                        {item.title}
                      </div>
                      <p className="text-[9.5px] text-muted-foreground truncate" title={item.detail}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé Compacto de Conformidade e Governança */}
            <div className="pt-2 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5 font-display text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Conformidade e Governança Documental
                </span>
                <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  100% Auditável
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-muted/30 border border-border/60">
                  <div className="text-[9px] text-muted-foreground uppercase font-mono">Cobertura</div>
                  <div className="font-bold text-foreground text-xs font-mono">100%</div>
                </div>
                <div className="p-1.5 rounded-lg bg-muted/30 border border-border/60">
                  <div className="text-[9px] text-muted-foreground uppercase font-mono">Cadernos</div>
                  <div className="font-bold text-foreground text-xs font-mono">6 de 6</div>
                </div>
                <div className="p-1.5 rounded-lg bg-muted/30 border border-border/60">
                  <div className="text-[9px] text-muted-foreground uppercase font-mono">Divergências</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs font-mono">0</div>
                </div>
              </div>

              <p className="text-[9.5px] text-muted-foreground leading-relaxed truncate sm:whitespace-normal">
                Todos os dados apresentados nesta competência foram consolidados a partir dos lançamentos canônicos operacionais.
              </p>
            </div>
          </section>

        </div>

        {/* ============================================================ */}
        {/* EMENTA DOCUMENTAL DA COMPETÊNCIA (ADAPTADA AO FLUXO)         */}
        {/* ============================================================ */}
        <section className="bg-card border border-border/80 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-muted-foreground">
                Ementa Documental do Período:
              </span>
              {fluxo !== "todos" && (
                <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary">
                  {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.label}
                </Badge>
              )}
            </div>

            {fluxo === "todos" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Operações:</span>
                  <span className="font-semibold text-foreground">{r01Rows.length} descargas</span>
                  <span className="text-muted-foreground font-mono"> · {volumeOperacional.toLocaleString("pt-BR")} unid.</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Pessoas / RH:</span>
                  <span className="font-semibold text-foreground">{r02Rows.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} diárias</span>
                  <span className="text-muted-foreground font-mono"> · {r05Rows.length} colabs CLT</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Receitas:</span>
                  <span className="font-semibold text-foreground">{formatBRL(receitasReportadas)}</span>
                  <span className="text-muted-foreground font-mono"> ({r03Rows.length} fat.)</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Despesas Campo:</span>
                  <span className="font-semibold text-foreground">{formatBRL(despesasApuradas)}</span>
                  <span className="text-muted-foreground font-mono"> (Diárias + Custos)</span>
                </div>
              </div>
            ) : fluxo === "operacoes-volume" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Operações:</span>
                  <span className="font-semibold text-foreground">{r01Rows.length} descargas</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Volume:</span>
                  <span className="font-semibold text-foreground">{volumeOperacional.toLocaleString("pt-BR")} unid.</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Faturamento Bruto:</span>
                  <span className="font-semibold text-foreground">{formatBRL(r01Rows.reduce((acc, r) => acc + r.totalBruto, 0))}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Líquido Apurado:</span>
                  <span className="font-semibold text-foreground">{formatBRL(r01Rows.reduce((acc, r) => acc + r.totalLiquido, 0))}</span>
                </div>
              </div>
            ) : fluxo === "servicos-extras" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Serviços:</span>
                  <span className="font-semibold text-foreground">{r07Rows.length} executados</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Qtd Física:</span>
                  <span className="font-semibold text-foreground">{r07Rows.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} itens</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Total Serviços:</span>
                  <span className="font-semibold text-foreground">{formatBRL(r07Rows.reduce((acc, r) => acc + r.total, 0))}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Tomadores:</span>
                  <span className="font-semibold text-foreground">{new Set(r07Rows.map((r) => r.tomadorNome)).size} clientes</span>
                </div>
              </div>
            ) : fluxo === "custos-extras" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Lançamentos:</span>
                  <span className="font-semibold text-foreground">{r04Rows.length} despesas</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Desembolso:</span>
                  <span className="font-semibold text-foreground">{formatBRL(custosExtrasTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Categorias:</span>
                  <span className="font-semibold text-foreground">{new Set(r04Rows.map((r) => r.categoriaCusto)).size} categorias</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Favorecidos:</span>
                  <span className="font-semibold text-foreground">{new Set(r04Rows.map((r) => r.favorecidoNome)).size} distintos</span>
                </div>
              </div>
            ) : fluxo === "diaristas" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Diárias:</span>
                  <span className="font-semibold text-foreground">{r02Rows.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} apuradas</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Valor Total:</span>
                  <span className="font-semibold text-foreground">{formatBRL(diaristasTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Lotes:</span>
                  <span className="font-semibold text-foreground">{new Set(r02Rows.map((r) => r.loteCodigo)).size} semanais</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Diaristas Únicos:</span>
                  <span className="font-semibold text-foreground">{new Set(r02Rows.map((r) => r.colaboradorNome)).size} profissionais</span>
                </div>
              </div>
            ) : fluxo === "banco-horas" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Colaboradores:</span>
                  <span className="font-semibold text-foreground">{r05Rows.length} CLT</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Saldo Líquido:</span>
                  <span className="font-semibold text-foreground font-mono">{formatMinutosToHourString(bancoHorasSaldoMinutos)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Créditos vs Débitos:</span>
                  <span className="font-semibold text-foreground font-mono">+{formatMinutosToHourString(r05Rows.reduce((acc, r) => acc + r.creditosMinutos, 0)).replace("+", "")} / -{formatMinutosToHourString(r05Rows.reduce((acc, r) => acc + r.debitosMinutos, 0)).replace("-", "").replace("+", "")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">A Vencer (30d):</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{formatMinutosToHourString(bancoHorasAVencerMinutos)}</span>
                </div>
              </div>
            ) : fluxo === "faturamento-receitas" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Faturas:</span>
                  <span className="font-semibold text-foreground">{r03Rows.length} emitidas</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Receitas:</span>
                  <span className="font-semibold text-foreground">{formatBRL(receitasReportadas)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Liquidadas:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(r03Rows.filter((r) => r.status === "RECEBIDO").reduce((acc, r) => acc + r.valorFaturado, 0))}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">A Receber:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatBRL(r03Rows.filter((r) => r.status !== "RECEBIDO").reduce((acc, r) => acc + r.valorFaturado, 0))}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                Fluxo em homologação operacional. Mapeado no backlog {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.backlogRef}.
              </div>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* CATÁLOGO OFICIAL DE RELATÓRIOS (2 COLUNAS)                   */}
        {/* ============================================================ */}
        <section ref={catalogRef} className="space-y-4">
          
          {/* Barra de Ferramentas do Catálogo */}
          <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground tracking-tight font-display">
                    Relatórios Oficiais
                  </h2>
                  <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5">
                    {filteredReports.length} de {RELATORIOS_CATALOGO.length} disponíveis
                  </Badge>
                  {fluxo !== "todos" && (
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary bg-primary/10">
                      Fluxo: {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.label}
                    </Badge>
                  )}
                  {selectedDay && (
                    <Badge className="text-[10px] font-mono bg-[#2563EB] text-white">
                      Filtro: Dia {selectedDay}/09
                    </Badge>
                  )}
                  {highlightedReportId && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/40 bg-primary/10 flex items-center gap-1">
                      <span>Foco: {RELATORIOS_CATALOGO.find(r => r.id === highlightedReportId)?.code}</span>
                      <button
                        type="button"
                        onClick={() => setHighlightedReportId(null)}
                        className="hover:text-foreground ml-0.5"
                        title="Limpar foco"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-0.5">
                {/* Filtro Rápido (Todos / Favoritos / Recentes) */}
                <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/60 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuickFilter("todos")}
                    className={`px-2 py-1 rounded-md font-medium transition-all ${
                      quickFilter === "todos" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickFilter("favoritos")}
                    className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                      quickFilter === "favoritos" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Star className={`h-3 w-3 ${quickFilter === "favoritos" ? "text-amber-500 fill-amber-500" : ""}`} />
                    <span>Favoritos ({favorites.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickFilter("recentes")}
                    className={`px-2 py-1 rounded-md font-medium transition-all ${
                      quickFilter === "recentes" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Recentes
                  </button>
                </div>

                {/* Filtro por Domínio */}
                <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/60 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setDomainFilter("all")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      domainFilter === "all" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainFilter("OPERACIONAL")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      domainFilter === "OPERACIONAL" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Operacional
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainFilter("PESSOAS & RH")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      domainFilter === "PESSOAS & RH" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    RH
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainFilter("FINANCEIRO & FATURAMENTO")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      domainFilter === "FINANCEIRO & FATURAMENTO" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Financeiro
                  </button>
                </div>

                {/* Input de Busca */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Buscar por código, nome ou palavra-chave..."
                    className="pl-8.5 pr-8 h-8.5 bg-background text-xs focus-visible:ring-1 focus-visible:ring-primary w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Buscar relatórios por código, título ou palavra-chave"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title="Limpar termo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Banner de Contexto quando Recentes está ativo */}
            {quickFilter === "recentes" && (
              <div className="shrink-0 p-3 rounded-lg border border-border/80 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary shrink-0" />
                  <span>Histórico de emissão e acesso recente cadastrado no backlog arquitetural UX04-FUTURE-RECENT-01. Exibindo cadernos oficiais homologados.</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setQuickFilter("todos")} className="h-7 text-xs">
                  Ver todos
                </Button>
              </div>
            )}

          {/* Listagem Estruturada por Domínios com Grid 2 Colunas */}
          <div className="space-y-6">
            {filteredReports.length > 0 ? (
              categories.map((category) => {
                const reportsInCategory = filteredReports.filter((r) => r.category === category);
                if (reportsInCategory.length === 0) return null;

                return (
                  <section key={category} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/70 pb-1.5 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                          {category}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          — {reportsInCategory.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3.5">
                        {reportsInCategory.map((report) => {
                          const count = reportCounts[report.id] ?? 0;
                          const dimensions = REPORT_DIMENSIONS[report.id] || [];
                          const isHighlighted = highlightedReportId === report.id;
                          const isFav = favorites.includes(report.id);

                          return (
                            <div
                              key={report.id}
                              id={`report-row-${report.id}`}
                              onClick={() => handleOpenReport(report.id)}
                              role="button"
                              tabIndex={0}
                              aria-label={`Abrir relatório ${report.code} — ${report.title}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleOpenReport(report.id);
                                }
                              }}
                              className={`group flex flex-col justify-between p-4 rounded-xl border bg-card hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer shadow-2xs ${
                                isHighlighted
                                  ? "ring-2 ring-primary border-primary bg-primary/5"
                                  : "border-border/80 hover:border-primary/40"
                              }`}
                            >
                              {/* Top: Header do Card (Código + Badges + Favorito) */}
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border/80 group-hover:border-primary/40 group-hover:text-primary transition-colors">
                                      {report.code}
                                    </span>
                                    {isHighlighted && (
                                      <Badge variant="outline" className="text-[9px] font-mono h-4.5 px-1.5 border-primary/50 text-primary bg-primary/10">
                                        Foco no Infográfico
                                      </Badge>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => toggleFavorite(report.id, e)}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"
                                    title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                    aria-label={isFav ? `Remover ${report.code} dos favoritos` : `Favoritar ${report.code}`}
                                  >
                                    <Star
                                      className={`h-4 w-4 ${isFav ? "text-amber-500 fill-amber-500" : "text-muted-foreground/50"}`}
                                    />
                                  </button>
                                </div>

                                {/* Título & Descrição Curta */}
                                <div className="space-y-1">
                                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                    {report.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {report.description}
                                  </p>
                                </div>

                                {/* Dimensões Auditáveis */}
                                <div className="space-y-1 pt-0.5">
                                  <span className="text-[10px] text-muted-foreground font-mono block">Dimensões:</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {dimensions.map((dim) => (
                                      <span
                                        key={dim}
                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/50"
                                      >
                                        {dim}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom: Cobertura + Ações (CSV, PDF e CTA Abrir) */}
                              <div className="pt-3.5 mt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                {/* Contador de registros da competência */}
                                <div className="flex items-center gap-1.5 text-xs font-mono">
                                  {count > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      <span>{count} {count === 1 ? "registro" : "registros"}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                      <span>Sem registros</span>
                                    </span>
                                  )}
                                </div>

                                {/* Ações: CSV, PDF e CTA Abrir */}
                                <div className="flex items-center justify-between sm:justify-end gap-2">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => handleExportSingleCSV(report.id, e)}
                                      className="h-7 px-2 rounded border border-border/80 bg-muted/30 hover:bg-muted hover:border-emerald-500/40 text-[10px] font-mono font-semibold text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
                                      title={`Emitir dados estruturados em CSV de ${report.code}`}
                                    >
                                      <Download className="h-3 w-3" />
                                      <span>CSV</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/ux-lab/relatorios/${report.id}?empresa=${empresaId}&competencia=${competencia}&print=true`);
                                      }}
                                      className="h-7 px-2 rounded border border-border/80 bg-muted/30 hover:bg-muted hover:border-blue-500/40 text-[10px] font-mono font-semibold text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                                      title={`Emitir documento gerencial em PDF de ${report.code}`}
                                    >
                                      <Printer className="h-3 w-3" />
                                      <span>PDF</span>
                                    </button>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs font-medium text-primary hover:text-primary group-hover:translate-x-0.5 transition-all gap-1"
                                  >
                                    <span>Abrir relatório</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              ) : null}

              {filteredReports.length === 0 && (
                <div className="text-center py-14 border border-dashed border-border rounded-xl text-muted-foreground space-y-3 bg-card/40 p-6">
                  <FileSpreadsheet className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                  {fluxo === "intermitentes" || fluxo === "clt-ponto" ? (
                    <>
                      <h3 className="text-sm font-bold text-foreground font-display">
                        Nenhum Caderno Oficial Disponível para o Fluxo {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.label}
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Este fluxo operacional encontra-se em fase de homologação e validação de regras de campo. Caderno documental planejado no backlog arquitetural {FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo)?.backlogRef}.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFluxoChange("todos")}
                        className="mt-2 text-xs"
                      >
                        Voltar para Todos os Fluxos
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Nenhum relatório localizado para os filtros atuais
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tente alterar os termos de busca, limpar favoritos ou selecionar outro domínio.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setDomainFilter("all");
                          setQuickFilter("todos");
                          setFluxo("todos");
                        }}
                        className="mt-2 text-xs"
                      >
                        Limpar todos os filtros
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

        {/* ============================================================ */}
        {/* F — MODAL / SHEET: GERAR DOSSIÊ DA COMPETÊNCIA               */}
        {/* ============================================================ */}
        <Dialog open={isDossierOpen} onOpenChange={setIsDossierOpen}>
          <DialogContent className="max-w-2xl bg-card border-border shadow-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
                  <FileArchive className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold font-display text-foreground">
                    Dossiê da Competência
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Compilação documental e consolidação dos livros canônicos do ORBE ERP.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Contexto do Dossiê */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Empresa Emitente:</span>
                  <span className="font-semibold text-foreground">{empresaSelecionada.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Competência de Apuração:</span>
                  <span className="font-semibold text-foreground font-mono">{competencia} (Setembro / 2026)</span>
                </div>
              </div>

              {/* Seleção de Cadernos a Incluir */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] font-mono">
                    Cadernos a Incluir no Dossiê:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDossierReports.length === 7) {
                        setSelectedDossierReports([]);
                      } else {
                        setSelectedDossierReports(["sintese", "r01-operacoes-volume", "r04-custos-extras", "r07-servicos-extras", "r02-fechamento-diaristas", "r05-banco-horas", "r03-faturamento-receitas"]);
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    {selectedDossierReports.length === 7 ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-border/60 rounded-lg bg-background">
                  
                  {/* Síntese */}
                  <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={selectedDossierReports.includes("sintese")}
                      onCheckedChange={(checked) => {
                        setSelectedDossierReports((prev) =>
                          checked ? [...prev, "sintese"] : prev.filter((id) => id !== "sintese")
                        );
                      }}
                    />
                    <span className="font-semibold text-foreground">Síntese Geral da Competência</span>
                  </label>

                  {/* 6 Relatórios Oficiais */}
                  {RELATORIOS_CATALOGO.map((rep) => (
                    <label key={rep.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                      <Checkbox
                        checked={selectedDossierReports.includes(rep.id)}
                        onCheckedChange={(checked) => {
                          setSelectedDossierReports((prev) =>
                            checked ? [...prev, rep.id] : prev.filter((id) => id !== rep.id)
                          );
                        }}
                      />
                      <span className="truncate">
                        <strong className="font-mono text-foreground mr-1">{rep.code}</strong>
                        <span className="text-muted-foreground">{rep.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Formato de Saída */}
              <div className="space-y-2">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] font-mono">
                  Formato de Saída:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDossierFormat("pdf_consolidado")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      dossierFormat === "pdf_consolidado"
                        ? "border-[#2563EB] bg-[#2563EB]/10 text-foreground"
                        : "border-border/70 hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">PDF Consolidado</div>
                    <div className="text-[10px] text-muted-foreground">Caderno único ordenado</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierFormat("pdf_individual")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      dossierFormat === "pdf_individual"
                        ? "border-[#2563EB] bg-[#2563EB]/10 text-foreground"
                        : "border-border/70 hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">PDFs Individuais</div>
                    <div className="text-[10px] text-muted-foreground">Emissão em lote por relatório</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierFormat("dados_estruturados")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      dossierFormat === "dados_estruturados"
                        ? "border-[#2563EB] bg-[#2563EB]/10 text-foreground"
                        : "border-border/70 hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">Dados Estruturados</div>
                    <div className="text-[10px] text-muted-foreground">Pacote compilado em CSV</div>
                  </button>
                </div>
              </div>

              {/* Aviso Documental */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[10.5px] text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  O Dossiê da Competência é um documento gerencial consolidado do ORBE ERP. Não substitui escriturações fiscais oficiais ou livros fiscais autenticados.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDossierOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateDossier}
                disabled={selectedDossierReports.length === 0}
                className="text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Gerar Dossiê ({selectedDossierReports.length})</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </UxLabShell>
  );
}
