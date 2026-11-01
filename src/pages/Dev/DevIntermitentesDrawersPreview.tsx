import React, { useState } from "react";
import { format } from "date-fns";
import {
  CalendarCheck,
  Building2,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Banknote,
  Calendar,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Eye,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { DrawerSecundarioShell } from "@/components/continuity/DrawerSecundarioShell";
import { cn, decimalParaHora, formatCurrency } from "@/lib/utils";
import {
  getRhStatusBadge,
  getFinanceiroStatusBadge,
  getLoteDrawerBadge,
  getDrawerFooterActions,
  getIntermitentesPipelineStages,
  getIntermitentesTimelineSteps,
  getSituacaoBadge,
} from "@/pages/Operacional/IntermitentesLotes";

// ============================================================================
// FIXTURES EM MEMÓRIA — 100% ISOLADAS (SEM CONEXÃO AO SUPABASE OU SERVIÇOS)
// ============================================================================

export interface LotePreviewFixture {
  id: string;
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  empresa_id: string;
  empresa: {
    id: string;
    nome: string;
  };
  quantidade_registros: number;
  horas_trabalhadas: number;
  horas_normais: number;
  he_50: number;
  valor_total: number;
  status: string;
  status_financeiro: string;
  created_at: string;
  validated_at: string | null;
  observacoes?: string;
  itens: Array<{
    id: string;
    nome_colaborador: string;
    cargo: string;
    convocacao: string;
    data_referencia: string;
    horas_trabalhadas: number;
    horas_normais: number;
    he_50: number;
    total: number;
    status_pipeline: string;
  }>;
}

const FIXTURES_INICIAIS: LotePreviewFixture[] = [
  {
    id: "hml-int-lote-rh-001",
    competencia: "10/2026",
    periodo_inicio: "2026-10-01",
    periodo_fim: "2026-10-07",
    empresa_id: "emp-hml-001",
    empresa: {
      id: "emp-hml-001",
      nome: "ESC Logística — Castanhal Operações",
    },
    quantidade_registros: 4,
    horas_trabalhadas: 36.5,
    horas_normais: 32.0,
    he_50: 4.5,
    valor_total: 1420.5,
    status: "VALIDADO_RH",
    status_financeiro: "AGUARDANDO_FINANCEIRO",
    created_at: "2026-10-07T18:00:00Z",
    validated_at: "2026-10-08T10:30:00Z",
    observacoes: "Lote conferido pelo RH e validado para avanço financeiro.",
    itens: [
      {
        id: "item-hml-001",
        nome_colaborador: "CLT-HML-001 João Pereira (Intermitente HML)",
        cargo: "Operador de Carga",
        convocacao: "CONV-2026-10-001",
        data_referencia: "2026-10-02",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 355.0,
        status_pipeline: "APURADO",
      },
      {
        id: "item-hml-002",
        nome_colaborador: "CLT-HML-002 Maria Fernandes (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-10-002",
        data_referencia: "2026-10-03",
        horas_trabalhadas: 9.5,
        horas_normais: 8.0,
        he_50: 1.5,
        total: 385.5,
        status_pipeline: "APURADO",
      },
      {
        id: "item-hml-003",
        nome_colaborador: "CLT-HML-003 Carlos Eduardo (Intermitente HML)",
        cargo: "Auxiliar Operacional",
        convocacao: "CONV-2026-10-003",
        data_referencia: "2026-10-04",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 340.0,
        status_pipeline: "APURADO",
      },
      {
        id: "item-hml-004",
        nome_colaborador: "CLT-HML-004 Lucas Mendes (Intermitente HML)",
        cargo: "Operador de Empilhadeira",
        convocacao: "CONV-2026-10-004",
        data_referencia: "2026-10-05",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 340.0,
        status_pipeline: "APURADO",
      },
    ],
  },
  {
    id: "hml-int-lote-fin-002",
    competencia: "10/2026",
    periodo_inicio: "2026-10-01",
    periodo_fim: "2026-10-07",
    empresa_id: "emp-hml-002",
    empresa: {
      id: "emp-hml-002",
      nome: "ESC Logística — Matriz Belém",
    },
    quantidade_registros: 3,
    horas_trabalhadas: 27.0,
    horas_normais: 24.0,
    he_50: 3.0,
    valor_total: 980.0,
    status: "AGUARDANDO_PAGAMENTO",
    status_financeiro: "FECHADO_FINANCEIRO",
    created_at: "2026-10-06T17:00:00Z",
    validated_at: "2026-10-07T11:00:00Z",
    observacoes: "Aprovado financeiramente. Liberado para inclusão na remessa CNAB.",
    itens: [
      {
        id: "item-hml-005",
        nome_colaborador: "CLT-HML-005 Ana Paula Santos (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-10-005",
        data_referencia: "2026-10-02",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 330.0,
        status_pipeline: "HOMOLOGADO_FINANCEIRO",
      },
      {
        id: "item-hml-006",
        nome_colaborador: "CLT-HML-001 João Pereira (Intermitente HML)",
        cargo: "Operador de Carga",
        convocacao: "CONV-2026-10-006",
        data_referencia: "2026-10-03",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 330.0,
        status_pipeline: "HOMOLOGADO_FINANCEIRO",
      },
      {
        id: "item-hml-007",
        nome_colaborador: "CLT-HML-003 Carlos Eduardo (Intermitente HML)",
        cargo: "Auxiliar Operacional",
        convocacao: "CONV-2026-10-007",
        data_referencia: "2026-10-04",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 320.0,
        status_pipeline: "HOMOLOGADO_FINANCEIRO",
      },
    ],
  },
  {
    id: "hml-int-lote-pago-003",
    competencia: "09/2026",
    periodo_inicio: "2026-09-24",
    periodo_fim: "2026-09-30",
    empresa_id: "emp-hml-001",
    empresa: {
      id: "emp-hml-001",
      nome: "ESC Logística — Castanhal Operações",
    },
    quantidade_registros: 5,
    horas_trabalhadas: 45.0,
    horas_normais: 40.0,
    he_50: 5.0,
    valor_total: 1850.0,
    status: "PAGO",
    status_financeiro: "FINALIZADO",
    created_at: "2026-09-30T19:00:00Z",
    validated_at: "2026-10-01T09:00:00Z",
    observacoes: "Arquivo de retorno bancário processado. Quitação integral concluída.",
    itens: [
      {
        id: "item-hml-008",
        nome_colaborador: "CLT-HML-002 Maria Fernandes (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-09-020",
        data_referencia: "2026-09-25",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 370.0,
        status_pipeline: "PAGO",
      },
      {
        id: "item-hml-009",
        nome_colaborador: "CLT-HML-004 Lucas Mendes (Intermitente HML)",
        cargo: "Operador de Empilhadeira",
        convocacao: "CONV-2026-09-021",
        data_referencia: "2026-09-26",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 370.0,
        status_pipeline: "PAGO",
      },
      {
        id: "item-hml-010",
        nome_colaborador: "CLT-HML-001 João Pereira (Intermitente HML)",
        cargo: "Operador de Carga",
        convocacao: "CONV-2026-09-022",
        data_referencia: "2026-09-27",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 370.0,
        status_pipeline: "PAGO",
      },
      {
        id: "item-hml-011",
        nome_colaborador: "CLT-HML-003 Carlos Eduardo (Intermitente HML)",
        cargo: "Auxiliar Operacional",
        convocacao: "CONV-2026-09-023",
        data_referencia: "2026-09-28",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 370.0,
        status_pipeline: "PAGO",
      },
      {
        id: "item-hml-012",
        nome_colaborador: "CLT-HML-005 Ana Paula Santos (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-09-024",
        data_referencia: "2026-09-29",
        horas_trabalhadas: 9.0,
        horas_normais: 8.0,
        he_50: 1.0,
        total: 370.0,
        status_pipeline: "PAGO",
      },
    ],
  },
  {
    id: "hml-int-lote-cnab-004",
    competencia: "10/2026",
    periodo_inicio: "2026-10-01",
    periodo_fim: "2026-10-07",
    empresa_id: "emp-hml-003",
    empresa: {
      id: "emp-hml-003",
      nome: "ESC Logística — Terminal Portuário",
    },
    quantidade_registros: 2,
    horas_trabalhadas: 16.0,
    horas_normais: 16.0,
    he_50: 0.0,
    valor_total: 580.0,
    status: "CNAB_GERADO",
    status_financeiro: "CNAB_GERADO",
    created_at: "2026-10-07T12:00:00Z",
    validated_at: "2026-10-07T16:00:00Z",
    observacoes: "Arquivo de remessa CNAB transmitido. Aguardando processamento bancário.",
    itens: [
      {
        id: "item-hml-013",
        nome_colaborador: "CLT-HML-001 João Pereira (Intermitente HML)",
        cargo: "Operador de Carga",
        convocacao: "CONV-2026-10-010",
        data_referencia: "2026-10-02",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 290.0,
        status_pipeline: "REMESSA_GERADA",
      },
      {
        id: "item-hml-014",
        nome_colaborador: "CLT-HML-003 Carlos Eduardo (Intermitente HML)",
        cargo: "Auxiliar Operacional",
        convocacao: "CONV-2026-10-011",
        data_referencia: "2026-10-03",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 290.0,
        status_pipeline: "REMESSA_GERADA",
      },
    ],
  },
  {
    id: "hml-int-lote-rh-005",
    competencia: "10/2026",
    periodo_inicio: "2026-10-08",
    periodo_fim: "2026-10-14",
    empresa_id: "emp-hml-002",
    empresa: {
      id: "emp-hml-002",
      nome: "ESC Logística — Matriz Belém",
    },
    quantidade_registros: 3,
    horas_trabalhadas: 24.0,
    horas_normais: 24.0,
    he_50: 0.0,
    valor_total: 840.0,
    status: "AGUARDANDO_VALIDACAO_RH",
    status_financeiro: "PENDENTE_RH",
    created_at: "2026-10-09T18:00:00Z",
    validated_at: null,
    observacoes: "Período fechado recentemente. Fila de análise do RH.",
    itens: [
      {
        id: "item-hml-015",
        nome_colaborador: "CLT-HML-002 Maria Fernandes (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-10-015",
        data_referencia: "2026-10-09",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 280.0,
        status_pipeline: "EM_ANALISE_RH",
      },
      {
        id: "item-hml-016",
        nome_colaborador: "CLT-HML-004 Lucas Mendes (Intermitente HML)",
        cargo: "Operador de Empilhadeira",
        convocacao: "CONV-2026-10-016",
        data_referencia: "2026-10-09",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 280.0,
        status_pipeline: "EM_ANALISE_RH",
      },
      {
        id: "item-hml-017",
        nome_colaborador: "CLT-HML-005 Ana Paula Santos (Intermitente HML)",
        cargo: "Conferente",
        convocacao: "CONV-2026-10-017",
        data_referencia: "2026-10-09",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 280.0,
        status_pipeline: "EM_ANALISE_RH",
      },
    ],
  },
  {
    id: "hml-int-lote-dev-006",
    competencia: "10/2026",
    periodo_inicio: "2026-10-01",
    periodo_fim: "2026-10-07",
    empresa_id: "emp-hml-001",
    empresa: {
      id: "emp-hml-001",
      nome: "ESC Logística — Castanhal Operações",
    },
    quantidade_registros: 2,
    horas_trabalhadas: 18.0,
    horas_normais: 16.0,
    he_50: 2.0,
    valor_total: 620.0,
    status: "DEVOLVIDO",
    status_financeiro: "DEVOLVIDO_RH",
    created_at: "2026-10-07T14:00:00Z",
    validated_at: null,
    observacoes: "Divergência apontada pelo RH no colaborador Carlos Eduardo (horas extras não autorizadas na escala).",
    itens: [
      {
        id: "item-hml-018",
        nome_colaborador: "CLT-HML-003 Carlos Eduardo (Intermitente HML)",
        cargo: "Auxiliar Operacional",
        convocacao: "CONV-2026-10-018",
        data_referencia: "2026-10-04",
        horas_trabalhadas: 10.0,
        horas_normais: 8.0,
        he_50: 2.0,
        total: 350.0,
        status_pipeline: "DEVOLVIDO",
      },
      {
        id: "item-hml-019",
        nome_colaborador: "CLT-HML-001 João Pereira (Intermitente HML)",
        cargo: "Operador de Carga",
        convocacao: "CONV-2026-10-019",
        data_referencia: "2026-10-05",
        horas_trabalhadas: 8.0,
        horas_normais: 8.0,
        he_50: 0.0,
        total: 270.0,
        status_pipeline: "DEVOLVIDO",
      },
    ],
  },
];

export const DevIntermitentesDrawersPreview: React.FC = () => {
  // Estado local dos lotes simulados (em memória)
  const [lotes, setLotes] = useState<LotePreviewFixture[]>(FIXTURES_INICIAIS);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [isSecondaryDrawerOpen, setIsSecondaryDrawerOpen] = useState(false);
  const [openConfirmarAprovacaoFinanceira, setOpenConfirmarAprovacaoFinanceira] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Log de auditoria em memória (feed de interações do tester)
  const [logEventos, setLogEventos] = useState<
    Array<{ id: string; hora: string; acao: string; detalhes: string }>
  >([
    {
      id: "init",
      hora: new Date().toLocaleTimeString("pt-BR"),
      acao: "LABORATORIO_CARREGADO",
      detalhes:
        "Ambiente Preview DEV carregado com 6 fixtures em memória. Zero chamadas a Supabase, RPC ou CNAB.",
    },
  ]);

  const addLog = (acao: string, detalhes: string) => {
    setLogEventos((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        hora: new Date().toLocaleTimeString("pt-BR"),
        acao,
        detalhes,
      },
      ...prev.slice(0, 9),
    ]);
  };

  // Lote selecionado
  const selectedLote = lotes.find((l) => l.id === selectedLoteId) || null;

  // Lotes filtrados na tabela
  const filteredLotes =
    statusFilter === "ALL"
      ? lotes
      : lotes.filter((l) => l.status === statusFilter);

  // Abertura e fechamento de Drawers
  const handleOpenPrimaryDrawer = (lote: LotePreviewFixture) => {
    setSelectedLoteId(lote.id);
    setIsSecondaryDrawerOpen(false);
    addLog(
      "DRAWER_PRIMARIO_ABERTO",
      `Lote #${lote.id.substring(0, 8)} (${lote.status}) · ${lote.empresa.nome}`
    );
  };

  const handleCloseDrawers = () => {
    if (selectedLoteId) {
      addLog("DRAWERS_FECHADOS", `Fechada visualização do lote #${selectedLoteId.substring(0, 8)}`);
    }
    setSelectedLoteId(null);
    setIsSecondaryDrawerOpen(false);
    setOpenConfirmarAprovacaoFinanceira(false);
  };

  const handleClosePrimary = () => {
    if (isSecondaryDrawerOpen || openConfirmarAprovacaoFinanceira) return;
    handleCloseDrawers();
  };

  const handleOpenSecondaryDrawer = () => {
    setIsSecondaryDrawerOpen(true);
    addLog(
      "DRAWER_SECUNDARIO_ABERTO",
      `Linha do tempo canônica visualizada para lote #${selectedLote?.id.substring(0, 8)}`
    );
  };

  // Simulação de Aprovação Financeira (100% em memória)
  const handleSimularAprovacaoFinanceira = () => {
    if (!selectedLote) return;

    // Atualiza o estado do lote em memória de VALIDADO_RH -> AGUARDANDO_PAGAMENTO
    setLotes((prev) =>
      prev.map((l) => {
        if (l.id === selectedLote.id) {
          return {
            ...l,
            status: "AGUARDANDO_PAGAMENTO",
            status_financeiro: "FECHADO_FINANCEIRO",
            observacoes: "Aprovado financeiramente em simulação de laboratório DEV.",
          };
        }
        return l;
      })
    );

    addLog(
      "APROVACAO_FINANCEIRA_SIMULADA",
      `Lote #${selectedLote.id.substring(0, 8)} avançado para AGUARDANDO_PAGAMENTO (em memória).`
    );

    toast.info(
      "[Preview DEV] Simulação de aprovação financeira executada em memória com sucesso! O status do lote avançou para AGUARDANDO_PAGAMENTO. Nenhuma gravação persistida."
    );

    setOpenConfirmarAprovacaoFinanceira(false);
  };

  // Reset de fixtures
  const handleResetFixtures = () => {
    setLotes(FIXTURES_INICIAIS);
    setSelectedLoteId(null);
    setIsSecondaryDrawerOpen(false);
    setOpenConfirmarAprovacaoFinanceira(false);
    addLog("FIXTURES_RESTAURADAS", "Fixtures em memória restauradas ao estado original.");
    toast.success("Fixtures restauradas ao estado padrão.");
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Pessoas & RH", href: "/operacional/intermitentes" },
        { label: "Lotes de Intermitentes", href: "/operacional/intermitentes/lotes" },
        { label: "Preview DEV Drawers" },
      ]}
      title="Preview DEV — Drawers de Lotes de Intermitentes"
      description="Ambiente isolado de validação e homologação visual dos componentes DrawerPrimarioShell, DrawerSecundarioShell e Modal de Aprovação Financeira."
    >
      <div className="space-y-6">
        {/* Banner de Segurança & Isolamento */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm">
                  Ambiente de Laboratório DEV — 100% em Memória
                </h3>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono">
                  DEV MODE ONLY
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta rota opera exclusivamente com fixtures locais estáticas. Nenhuma consulta,
                mutação RPC ou persistência é disparada contra o Supabase, serviços de lote ou
                remessas CNAB. Utilize para conferir a fidelidade visual e a transição de estados dos
                Drawers.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0 gap-1.5"
            onClick={handleResetFixtures}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Fixtures</span>
          </Button>
        </div>

        {/* Filtros de Cenário e Estatísticas Rápidas */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1 font-mono uppercase tracking-wider">
              Filtrar por Cenário:
            </span>
            {[
              { id: "ALL", label: "Todos os Lotes (6)" },
              { id: "VALIDADO_RH", label: "Validado RH (Pronto p/ Financeiro)" },
              { id: "AGUARDANDO_PAGAMENTO", label: "Aprovado Financeiro" },
              { id: "CNAB_GERADO", label: "Remessa CNAB" },
              { id: "PAGO", label: "Pago / Conciliado" },
              { id: "AGUARDANDO_VALIDACAO_RH", label: "Em Análise RH" },
              { id: "DEVOLVIDO", label: "Devolvido RH" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "text-xs h-8",
                  statusFilter === f.id ? "font-bold" : "font-normal"
                )}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground font-mono">
            Exibindo <strong>{filteredLotes.length}</strong> de <strong>{lotes.length}</strong> lotes
          </div>
        </div>

        {/* Tabela de Lotes com Ações de Detalhes */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">
                Lotes Disponíveis para Homologação de Drawers
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Clique em <strong>"Detalhes"</strong> para inspecionar o Drawer Primário
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-muted-foreground font-semibold text-left">
                  <th className="py-3 px-4">Lote / Identificador</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Competência / Período</th>
                  <th className="py-3 px-4 text-center">Registros</th>
                  <th className="py-3 px-4 text-center">Horas</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4">Status RH</th>
                  <th className="py-3 px-4">Status Financeiro</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLotes.map((lote) => {
                  const isSelected = selectedLoteId === lote.id;
                  return (
                    <tr
                      key={lote.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors cursor-pointer",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => handleOpenPrimaryDrawer(lote)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        <div className="flex flex-col">
                          <span>INT-{lote.competencia}-{lote.id.substring(0, 4)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            #{lote.id.substring(0, 8)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{lote.empresa.nome}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{lote.competencia}</span>
                          <span className="text-[10px]">
                            {lote.periodo_inicio} a {lote.periodo_fim}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-medium text-foreground">
                        {lote.quantidade_registros}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {decimalParaHora(lote.horas_trabalhadas)}
                          </span>
                          <span className="text-[10px]">
                            {decimalParaHora(lote.horas_normais)} norm · {decimalParaHora(lote.he_50)} HE50
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(lote.valor_total)}
                      </td>

                      <td className="py-3.5 px-4">
                        {getRhStatusBadge(lote.status)}
                      </td>

                      <td className="py-3.5 px-4">
                        {getFinanceiroStatusBadge(lote.status_financeiro, lote.status)}
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7 gap-1 font-semibold"
                          onClick={() => handleOpenPrimaryDrawer(lote)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalhes</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel de Auditoria e Eventos em Memória */}
        <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground font-mono">
                Registro de Eventos Simulados (Somente em Memória)
              </h4>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Últimas {logEventos.length} ações
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {logEventos.map((evt) => (
              <div
                key={evt.id}
                className="p-2 bg-card border border-border/50 rounded-lg flex items-start justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] py-0 font-bold">
                    {evt.acao}
                  </Badge>
                  <span className="text-foreground text-[11px]">{evt.detalhes}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{evt.hora}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── DRAWER PRIMÁRIO: COMPOSIÇÃO DO LOTE ── */}
        <DrawerPrimarioShell
          isOpen={!!selectedLoteId}
          onClose={handleClosePrimary}
          title={
            selectedLote
              ? `Lote INT-${selectedLote.competencia}-${selectedLote.id.substring(0, 4)}`
              : "Composição do Lote"
          }
          subtitle={
            selectedLote ? (
              <span className="flex flex-col gap-0.5 mt-1">
                <span className="font-semibold text-foreground">
                  {selectedLote.empresa?.nome || "Empresa"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Competência: {selectedLote.competencia} · Fechado em:{" "}
                  {selectedLote.created_at
                    ? format(new Date(selectedLote.created_at), "dd/MM/yyyy HH:mm")
                    : "—"}
                </span>
              </span>
            ) : undefined
          }
          badge={selectedLote ? getLoteDrawerBadge(selectedLote.status) : null}
          footer={(() => {
            if (!selectedLote) return null;
            const footerActions = getDrawerFooterActions(selectedLote.status);

            return (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={handleCloseDrawers}
                >
                  Fechar
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                    onClick={handleOpenSecondaryDrawer}
                  >
                    <span>Ver fluxo completo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>

                  {footerActions.canAprovarFinanceiro && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      onClick={() => setOpenConfirmarAprovacaoFinanceira(true)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aprovar Financeiro</span>
                    </Button>
                  )}

                  {footerActions.canAvancarRemessa && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      onClick={() => {
                        addLog(
                          "ACAO_SIMULADA_REMESSA",
                          `Tester clicou em Avançar para Remessa para lote #${selectedLote.id.substring(0, 8)}`
                        );
                        toast.info(
                          `[Preview DEV] Ação 'Avançar para Remessa' simulada com sucesso para lote #${selectedLote.id.substring(0, 8)}. Em produção, navega para a Central Bancária.`
                        );
                      }}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Avançar para Remessa</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {footerActions.canVerConciliacao && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold gap-1.5 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                      onClick={() => {
                        addLog(
                          "ACAO_SIMULADA_CONCILIACAO",
                          `Tester clicou em Ver Conciliação Bancária para lote #${selectedLote.id.substring(0, 8)}`
                        );
                        toast.info(
                          `[Preview DEV] Ação 'Ver Conciliação Bancária' simulada com sucesso para lote #${selectedLote.id.substring(0, 8)}. Em produção, navega para a tela de Retorno Bancário.`
                        );
                      }}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Ver Conciliação Bancária</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        >
          {selectedLote && (
            <div className="p-6 space-y-6">
              {/* Pipeline Horizontal Compacto */}
              {(() => {
                const pipeline = getIntermitentesPipelineStages(selectedLote.status);
                return (
                  <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                        Pipeline do Lote
                      </p>
                      {pipeline.allCompleted && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-mono">
                          5/5 Concluído
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium gap-1">
                      {/* 1. Recebido */}
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Recebido</span>
                      </div>

                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-1",
                          pipeline.connector1 ? "bg-emerald-500/40" : "bg-border"
                        )}
                      />

                      {/* 2. Fechamento */}
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Fechamento</span>
                      </div>

                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-1",
                          pipeline.connector2 ? "bg-emerald-500/40" : "bg-border"
                        )}
                      />

                      {/* 3. Validação RH */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[2].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : pipeline.stages[2].status === "current"
                            ? "text-amber-600 dark:text-amber-400 font-bold"
                            : pipeline.stages[2].status === "error"
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[2].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : pipeline.stages[2].status === "error" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>Validação RH</span>
                      </div>

                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-1",
                          pipeline.connector3 ? "bg-emerald-500/40" : "bg-border"
                        )}
                      />

                      {/* 4. Financeiro */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[3].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : pipeline.stages[3].status === "current"
                            ? "text-blue-600 dark:text-blue-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[3].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Clock
                            className={cn(
                              "w-3.5 h-3.5",
                              pipeline.stages[3].status === "current"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-muted-foreground/60"
                            )}
                          />
                        )}
                        <span>Financeiro</span>
                      </div>

                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-1",
                          pipeline.connector4 ? "bg-emerald-500/40" : "bg-border"
                        )}
                      />

                      {/* 5. CNAB / Pago */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[4].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : pipeline.stages[4].status === "current"
                            ? "text-indigo-600 dark:text-indigo-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[4].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Banknote
                            className={cn(
                              "w-3.5 h-3.5",
                              pipeline.stages[4].status === "current"
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-muted-foreground/60"
                            )}
                          />
                        )}
                        <span>CNAB/Pago</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Governança Contábil / Diagnóstico Operacional */}
              {selectedLote.status === "VALIDADO_RH" && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        Lote Homologado pelo RH — Aguardando Financeiro
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                      >
                        Ação Necessária
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Lote conferido pelo RH e sincronizado como obrigação contábil.<br />
                      <strong>Impacto:</strong> Lançamentos operacionais congelados contra alterações.<br />
                      <strong>Próxima Ação:</strong> Executar aprovação financeira para autorizar a geração da remessa bancária.<br />
                      <strong>Destino:</strong> Central Bancária (CNAB 240 / Lotes RH).
                    </p>
                  </div>
                </div>
              )}

              {["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(selectedLote.status) && (
                <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        Aprovado pelo Financeiro — Liberado para Remessa
                      </p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Obrigação contábil aprovada pelo Financeiro.<br />
                      <strong>Impacto:</strong> Lote apto para inclusão em remessa bancária CNAB 240.<br />
                      <strong>Próxima Ação:</strong> Gerar arquivo de remessa ou incluir em lote bancário.<br />
                      <strong>Destino:</strong> Módulo Bancário → Remessas Intermitentes.
                    </p>
                  </div>
                </div>
              )}

              {selectedLote.status === "CNAB_GERADO" && (
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <Banknote className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        Remessa CNAB Gerada — Aguardando Retorno
                      </p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Remessa bancária emitida e transmitida à instituição pagadora.<br />
                      <strong>Impacto:</strong> Pagamento em processamento interbancário.<br />
                      <strong>Próxima Ação:</strong> Importar o arquivo de retorno (.RET) para quitação definitiva.<br />
                      <strong>Destino:</strong> Retorno Bancário & Conciliação.
                    </p>
                  </div>
                </div>
              )}

              {selectedLote.status === "PAGO" && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        Ciclo Operacional & Financeiro Liquidado (PAGO)
                      </p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Retorno bancário conciliado com sucesso.<br />
                      <strong>Impacto:</strong> Quitação integral confirmada para todos os colaboradores do lote.<br />
                      <strong>Próxima Ação:</strong> Arquivado como histórico contábil e operacional.<br />
                      <strong>Destino:</strong> Terminal do Pipeline.
                    </p>
                  </div>
                </div>
              )}

              {["DEVOLVIDO", "DEVOLVIDO_RH"].includes(selectedLote.status) && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Lote Devolvido pelo RH</p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> O RH identificou inconsistências nas jornadas ou valores e devolveu o lote.<br />
                      <strong>Impacto:</strong> O lote não pode avançar para o Financeiro até o reprocessamento.<br />
                      <strong>Próxima Ação:</strong> Reabrir lote em Recebidos ou ajustar apontamentos apontados.<br />
                      <strong>Destino:</strong> Intermitentes Recebidos.
                    </p>
                  </div>
                </div>
              )}

              {/* Totais do Lote */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Valor Total
                  </span>
                  <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(selectedLote.valor_total)}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Registros
                  </span>
                  <p className="text-base font-bold font-mono text-foreground mt-0.5">
                    {selectedLote.quantidade_registros}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Horas Totais
                  </span>
                  <p className="text-base font-bold font-mono text-foreground mt-0.5">
                    {decimalParaHora(selectedLote.horas_trabalhadas)}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Horas Extras (50%)
                  </span>
                  <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {decimalParaHora(selectedLote.he_50)}
                  </p>
                </div>
              </div>

              {/* Composição Individual dos Colaboradores */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-bold text-foreground text-sm">
                      Composição do Lote ({selectedLote.itens?.length || 0} lançamentos)
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {decimalParaHora(selectedLote.horas_normais)} normais ·{" "}
                    {decimalParaHora(selectedLote.he_50)} HE50
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedLote.itens?.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-card border border-border rounded-lg shadow-xs flex flex-col gap-2 hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-foreground text-xs">
                            {item.nome_colaborador || "Colaborador"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.cargo || "Auxiliar"} · {item.convocacao || "Sem Convocação"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.total)}
                          </span>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(item.data_referencia + "T12:00:00"), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                        <span>
                          Jornada: {decimalParaHora(item.horas_trabalhadas)} trab (
                          {decimalParaHora(item.horas_normais)} norm
                          {Number(item.he_50) > 0 ? ` · ${decimalParaHora(item.he_50)} HE50` : ""})
                        </span>
                        <Badge variant="outline" className="text-[10px] font-medium py-0">
                          {item.status_pipeline}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informações de Auditoria e Fechamento */}
              <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1 text-muted-foreground">
                <p className="flex justify-between">
                  <span>Status no Financeiro:</span>
                  <span className="font-semibold text-foreground">
                    {selectedLote.status_financeiro || "AGUARDANDO_FINANCEIRO"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Validado por RH em:</span>
                  <span className="font-semibold text-foreground">
                    {selectedLote.validated_at
                      ? format(new Date(selectedLote.validated_at), "dd/MM/yyyy HH:mm:ss")
                      : "—"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Observações:</span>
                  <span className="italic text-foreground">
                    {selectedLote.observacoes || "Nenhuma observação registrada."}
                  </span>
                </p>
              </div>
            </div>
          )}
        </DrawerPrimarioShell>

        {/* ── DRAWER SECUNDÁRIO: LINHA DO TEMPO / FLUXO COMPLETO ── */}
        <DrawerSecundarioShell
          isOpen={isSecondaryDrawerOpen}
          onBack={() => setIsSecondaryDrawerOpen(false)}
          onClose={handleCloseDrawers}
          title="Linha do Tempo — Intermitentes"
          widthClass="w-full sm:max-w-2xl"
          badge={selectedLote ? getLoteDrawerBadge(selectedLote.status) : null}
          hideOverlay={true}
          subtitle={
            selectedLote ? (
              <span>
                Lote #{selectedLote.id.substring(0, 8)} · Período: {selectedLote.periodo_inicio} até{" "}
                {selectedLote.periodo_fim}
              </span>
            ) : undefined
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setIsSecondaryDrawerOpen(false)}
              >
                ← Voltar aos detalhes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleCloseDrawers}
              >
                Fechar
              </Button>
            </div>
          }
        >
          {selectedLote && (
            <div className="p-6 space-y-6">
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                    Empresa / Lote
                  </p>
                  <p className="font-semibold text-sm text-foreground">
                    {selectedLote.empresa?.nome || "Empresa"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    INT-{selectedLote.competencia}-{selectedLote.id.substring(0, 4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                    Valor Total do Lote
                  </p>
                  <p className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedLote.valor_total)}
                  </p>
                </div>
              </div>

              {/* Stepper Vertical Canônico */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Etapas do Ciclo Operacional & Financeiro
                </h4>

                {(() => {
                  const timelineSteps = getIntermitentesTimelineSteps(
                    selectedLote.status,
                    selectedLote
                  );
                  const isLotePago = selectedLote.status === "PAGO";

                  return (
                    <div
                      className={cn(
                        "relative border-l-2 ml-4 pl-6 space-y-8 transition-colors",
                        isLotePago ? "border-emerald-500/40" : "border-border"
                      )}
                    >
                      {timelineSteps.map((step) => {
                        const isStepDone = step.state === "done";
                        const isStepCurrent = step.state === "current";
                        const isStepError = step.state === "error";

                        return (
                          <div key={step.number} className="relative">
                            <div
                              className={cn(
                                "absolute -left-[31px] top-0 p-1 rounded-full border-2 transition-all",
                                step.number === 6 && isLotePago
                                  ? "bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-500/20"
                                  : isStepDone
                                  ? "bg-emerald-500/15 border-emerald-600 text-emerald-600 dark:text-emerald-400"
                                  : isStepCurrent
                                  ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400"
                                  : isStepError
                                  ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400"
                                  : "bg-muted border-border text-muted-foreground"
                              )}
                            >
                              {step.number === 5 && !isStepDone ? (
                                <Banknote className="w-3.5 h-3.5" />
                              ) : isStepCurrent ? (
                                <Clock className="w-3.5 h-3.5" />
                              ) : isStepError ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "font-bold text-sm",
                                    isStepDone
                                      ? "text-foreground"
                                      : isStepCurrent
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {step.title}
                                </span>
                                <Badge className={step.badgeClass}>{step.badgeText}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {step.description}
                              </p>
                              {step.timestamp && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Data: {step.timestamp}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DrawerSecundarioShell>

        {/* ── MODAL: CONFIRMAR APROVAÇÃO FINANCEIRA ── */}
        <Dialog
          open={openConfirmarAprovacaoFinanceira}
          onOpenChange={setOpenConfirmarAprovacaoFinanceira}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-display">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Confirmar Aprovação Financeira
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Aprovação formal da obrigação contábil para liberação de remessa bancária.
              </DialogDescription>
            </DialogHeader>

            {selectedLote && (
              <div className="space-y-3 py-2 text-xs">
                <div className="p-3.5 bg-muted/40 border border-border rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-semibold text-foreground">
                      {selectedLote.empresa?.nome || "Empresa"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Identificador do Lote:</span>
                    <span className="font-mono font-bold text-foreground">
                      INT-{selectedLote.competencia}-{selectedLote.id.substring(0, 4)} (
                      {`Lote ${selectedLote.id.substring(0, 6)}`})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registros:</span>
                    <span className="font-semibold text-foreground">
                      {selectedLote.quantidade_registros} registros
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground font-medium">Valor Total:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(selectedLote.valor_total)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-900 dark:text-blue-300 leading-relaxed text-[11px]">
                  <p className="font-semibold mb-1">Efeito desta ação (Simulado em Memória):</p>
                  <p>
                    O status do lote avançará para <strong>AGUARDANDO_PAGAMENTO</strong>{" "}
                    (FECHADO_FINANCEIRO). A obrigação será homologada e liberada formalmente para emissão
                    da remessa CNAB 240 na Central Bancária.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setOpenConfirmarAprovacaoFinanceira(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                onClick={handleSimularAprovacaoFinanceira}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar Aprovação Financeira (Simulação)</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
};

export default DevIntermitentesDrawersPreview;
