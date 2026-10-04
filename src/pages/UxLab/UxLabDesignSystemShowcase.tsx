import React, { useState } from "react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { useUxLabTheme } from "@/components/ux-lab/UxLabThemeContext";
import {
  ORBE_ROYAL_BLUE,
  ORBE_DARK_V4_NEUTRALS,
  ORBE_LIGHT_NEUTRALS,
  ORBE_SEMANTIC_MATRIX,
  ORBE_RADIUS_SCALE,
  ORBE_SPACING_SCALE,
  ORBE_TYPOGRAPHY_SCALE,
  ORBE_SHADOW_SCALE,
  ORBE_BORDER_TOKENS,
  ORBE_LAYOUT_TOKENS,
} from "@/components/ux-lab/design-system/tokens";
import {
  OrbePageContainer,
  OrbePageHeader,
  OrbeSection,
  OrbeCard,
  OrbeKpiCard,
  OrbeButton,
  OrbeBadge,
  OrbeStatusBadge,
  OrbeInput,
  OrbeSearchInput,
  OrbeSelect,
  OrbeFilterBar,
  OrbeTable,
  OrbeTableColumn,
  OrbeDrawer,
  OrbeDocumentHeader,
  OrbeControleDocumental,
} from "@/components/ux-lab/design-system";
import { UxPipelineStepper, PipelineStepConfig } from "@/components/ux-lab/UxPipelineStepper";
import {
  Sparkles,
  Layers,
  Palette,
  Type,
  Maximize2,
  Square,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Table as TableIcon,
  GitCommit,
  PanelRight,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  ShieldCheck,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface SampleTableRow {
  id: string;
  codigo: string;
  cliente: string;
  servico: string;
  volume: number;
  valor: number;
  status: "success" | "warning" | "danger" | "info";
  statusLabel: string;
}

const SAMPLE_DATA: SampleTableRow[] = [
  {
    id: "1",
    codigo: "OP-2026-001",
    cliente: "Ambev Distribuição",
    servico: "Descarga Paletizada",
    volume: 1250,
    valor: 4375.0,
    status: "success",
    statusLabel: "Concluído",
  },
  {
    id: "2",
    codigo: "OP-2026-002",
    cliente: "Nestlé Brasil",
    servico: "Movimentação Interna",
    volume: 850,
    valor: 2975.0,
    status: "warning",
    statusLabel: "Aguardando RH",
  },
  {
    id: "3",
    codigo: "OP-2026-003",
    cliente: "M. Dias Branco",
    servico: "Carregamento Noturno CN5C",
    volume: 3100,
    valor: 10850.0,
    status: "danger",
    statusLabel: "Em Restrição",
  },
  {
    id: "4",
    codigo: "OP-2026-004",
    cliente: "Heineken Brasil",
    servico: "Transbordo de Carga",
    volume: 450,
    valor: 1575.0,
    status: "info",
    statusLabel: "Em Processamento",
  },
];

const SAMPLE_PIPELINE_STEPS: PipelineStepConfig[] = [
  { key: "LANCADO", label: "Lançamento", responsible: "Encarregado" },
  { key: "VALIDACAO_RH", label: "Validação RH", responsible: "RH Operacional" },
  { key: "APROVACAO_FIN", label: "Aprovação Financeira", responsible: "Controladoria" },
  { key: "FATURADO", label: "Faturamento", responsible: "Financeiro" },
  { key: "CONCILIADO", label: "Conciliação / Baixa", responsible: "Bancário" },
];

export const UxLabDesignSystemShowcase: React.FC = () => {
  const { theme, toggleTheme, isDark } = useUxLabTheme();

  // Estados de demonstração interativa
  const [selectedKpi, setSelectedKpi] = useState<string>("kpi-1");
  const [selectedTableRow, setSelectedTableRow] = useState<string | number>("1");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [demoFilterSearch, setDemoFilterSearch] = useState<string>("");
  const [demoSelect, setDemoSelect] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Tabela columns definition
  const tableColumns: OrbeTableColumn<SampleTableRow>[] = [
    {
      id: "codigo",
      header: "Código / ID",
      align: "left",
      width: "120px",
      render: (row) => (
        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
          {row.codigo}
        </span>
      ),
    },
    {
      id: "cliente",
      header: "Cliente / Empresa",
      align: "left",
      render: (row) => <span className="font-medium text-foreground">{row.cliente}</span>,
    },
    {
      id: "servico",
      header: "Serviço Operacional",
      align: "left",
      render: (row) => <span className="text-muted-foreground">{row.servico}</span>,
    },
    {
      id: "volume",
      header: "Volume (UN)",
      align: "right",
      render: (row) => (
        <span className="font-mono font-medium">{row.volume.toLocaleString("pt-BR")}</span>
      ),
    },
    {
      id: "valor",
      header: "Valor Bruto",
      align: "right",
      render: (row) => (
        <span className="font-mono font-bold text-foreground">
          {row.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status Esteira",
      align: "center",
      render: (row) => (
        <OrbeStatusBadge status={row.status} label={row.statusLabel} />
      ),
    },
    {
      id: "stepper",
      header: "Esteira",
      align: "center",
      render: (row) => (
        <UxPipelineStepper
          steps={SAMPLE_PIPELINE_STEPS}
          currentStepKey={
            row.status === "success"
              ? "CONCILIADO"
              : row.status === "warning"
              ? "VALIDACAO_RH"
              : row.status === "danger"
              ? "APROVACAO_FIN"
              : "LANCADO"
          }
          exceptionState={
            row.status === "danger"
              ? { isException: true, label: "Reprovado", stepKey: "APROVACAO_FIN" }
              : null
          }
          variant="compact"
        />
      ),
    },
  ];

  return (
    <UxLabShell
      title="Design System & Tokens Oficiais"
      subtitle="Catálogo visual transversal e congelado do ORBE ERP (DS-01)"
      activeItem="design-system"
    >
      <OrbePageContainer>
        {/* Header Oficial da Página */}
        <OrbePageHeader
          badge={<OrbeBadge variant="solid">DS-01 OFICIAL</OrbeBadge>}
          title="ORBE Design System & Foundations"
          description="Linguagem visual unificada, tokens transversais e componentes primitivos para todas as telas do ERP ORBE."
          actions={
            <div className="flex items-center gap-2">
              <OrbeButton
                variant="secondary"
                size="sm"
                icon={isDark ? Sun : Moon}
                onClick={toggleTheme}
              >
                Modo {isDark ? "Claro (Light)" : "Escuro (Dark V4)"}
              </OrbeButton>
              <OrbeButton
                variant="primary"
                size="sm"
                icon={PanelRight}
                onClick={() => setDrawerOpen(true)}
              >
                Abrir Drawer Demo
              </OrbeButton>
            </div>
          }
        />

        {/* ── 01 FOUNDATIONS ── */}
        <OrbeSection
          title="01. Fundamentos Arquiteturais"
          description="Filosofia de design e princípios centrais do sistema"
          badge={<OrbeBadge variant="institutional">01</OrbeBadge>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OrbeCard variant="surface">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <Palette className="h-4 w-4" />
                  <span>NEUTRO POR PADRÃO. COR POR SIGNIFICADO.</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Superfícies e tipografia constroem a hierarquia antes de bordas. Cores
                  vivas são estritamente funcionais e reservadas para estados semânticos
                  ou identificação institucional.
                </p>
              </div>
            </OrbeCard>

            <OrbeCard variant="surface">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <Maximize2 className="h-4 w-4" />
                  <span>WORKSPACE GLOBAL: 1560px</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Todas as páginas do ERP compartilham a mesma largura máxima de referência
                  do Dashboard Executivo (<code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">max-w-[1560px]</code>).
                  Proibido larguras arbitrárias.
                </p>
              </div>
            </OrbeCard>

            <OrbeCard variant="surface">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <Moon className="h-4 w-4" />
                  <span>DARK V4: LUMINÂNCIA PURA</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O tema escuro utiliza o Canvas <code className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">#0B0D10</code> com
                  profundidade por elevação luminosa e Royal Blue como luz funcional.
                  Sem neon, sem glow excessivo.
                </p>
              </div>
            </OrbeCard>
          </div>
        </OrbeSection>

        {/* ── 02 COLORS ── */}
        <OrbeSection
          title="02. Identidade Cromática & Matriz Semântica"
          description="Escala Royal Blue, Neutros e Cores Semânticas de Estado"
          badge={<OrbeBadge variant="institutional">02</OrbeBadge>}
        >
          <div className="space-y-5">
            {/* Royal Blue Scale */}
            <OrbeCard variant="surface">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-display text-foreground uppercase tracking-wider">
                    Escala Royal Blue Oficial (#2563EB)
                  </h3>
                  <span className="text-[11px] text-muted-foreground">CTA, Seleção, Foco e Identidade Institucional</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
                  {Object.entries(ORBE_ROYAL_BLUE).map(([weight, hex]) => (
                    <div key={weight} className="space-y-1 text-center">
                      <div
                        className="h-12 w-full rounded-lg border border-border/40 shadow-2xs flex items-center justify-center text-[10px] font-mono font-bold"
                        style={{
                          backgroundColor: hex,
                          color: Number(weight) > 400 ? "#ffffff" : "#0f172a",
                        }}
                      >
                        {weight}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">{hex}</div>
                    </div>
                  ))}
                </div>
              </div>
            </OrbeCard>

            {/* Neutros Light & Dark */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OrbeCard variant="surface">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold font-display text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    Neutros — Light Mode
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(ORBE_LIGHT_NEUTRALS).map(([name, hex]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-muted-foreground">{name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-3.5 w-3.5 rounded-sm border border-border/80" style={{ backgroundColor: hex }} />
                          <span className="font-mono text-[11px] font-medium">{hex}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </OrbeCard>

              <OrbeCard variant="surface">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold font-display text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-blue-400" />
                    Neutros — Dark Mode V4
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(ORBE_DARK_V4_NEUTRALS).map(([name, hex]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-muted-foreground">{name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-3.5 w-3.5 rounded-sm border border-white/20" style={{ backgroundColor: hex }} />
                          <span className="font-mono text-[11px] font-medium truncate max-w-[80px]">{hex}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </OrbeCard>
            </div>

            {/* Matriz Semântica */}
            <OrbeCard variant="surface">
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-display text-foreground uppercase tracking-wider">
                  Matriz Semântica de Estados
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {Object.entries(ORBE_SEMANTIC_MATRIX).map(([key, item]) => (
                    <div
                      key={key}
                      className="p-3 rounded-xl border border-border/80 dark:border-white/[0.06] bg-card dark:bg-[#15191F] space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                        <span className="text-xs font-bold font-display uppercase text-foreground">{key}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight min-h-[30px]">
                        {item.label}
                      </div>
                      <OrbeStatusBadge
                        status={key as any}
                        label={key.toUpperCase()}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </OrbeCard>

            {/* Do / Don't */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>DO (Práticas Oficiais)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Usar Royal Blue (#2563EB) para CTA principal, foco e seleções.</li>
                  <li>Usar Verde exclusivamente para Concluído, Pago, Regular ou Conciliado.</li>
                  <li>Usar Âmbar para pendências e itens que exigem atenção.</li>
                  <li>Usar Vermelho/Rose para bloqueios, restrições e devoluções reais.</li>
                  <li>Manter dados técnicos em tipografia Monospace.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                  <XCircle className="h-4 w-4" />
                  <span>DON'T (Proibições Estritas)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>PROIBIDO: Usar botões institucionais ou CTAs laranjas.</li>
                  <li>PROIBIDO: Usar roxo/lilás para diferenciar categorias arbitrariamente.</li>
                  <li>PROIBIDO: Usar cores semânticas (verde/vermelho/âmbar) de forma decorativa.</li>
                  <li>PROIBIDO: Glows, neon e bordas luminosas em Dark Mode.</li>
                  <li>PROIBIDO: Cards aninhados sem limite (máximo 1 nível interno).</li>
                </ul>
              </div>
            </div>
          </div>
        </OrbeSection>

        {/* ── 03 TYPOGRAPHY ── */}
        <OrbeSection
          title="03. Hierarquia Tipográfica Oficial"
          description="Escala tipográfica baseada em Manrope (Display) e Inter (Sans)"
          badge={<OrbeBadge variant="institutional">03</OrbeBadge>}
        >
          <OrbeCard variant="surface">
            <div className="divide-y divide-border/60 dark:divide-white/[0.05]">
              {Object.entries(ORBE_TYPOGRAPHY_SCALE).map(([key, item]) => (
                <div key={key} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-[220px]">
                    <div className="text-xs font-bold font-display text-foreground">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">{item.usage}</div>
                    <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">{item.font}</div>
                  </div>
                  <div className="flex-1 text-left">
                    <div className={item.spec}>
                      {key === "kpiNumber"
                        ? "R$ 4.280.950,00"
                        : key === "monoTechnical"
                        ? "CN5C • OP-2026-004 • 10.110 UN"
                        : key === "label"
                        ? "EMPRESA / UNIDADE TOMADORA"
                        : key === "metadata"
                        ? "2026-10-04 15:30:00 • USER-ID: 7FA92C"
                        : "Demonstrativo Operacional & Financeiro do ERP ORBE"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OrbeCard>
        </OrbeSection>

        {/* ── 04 & 05 SPACING & RADIUS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spacing */}
          <OrbeSection
            title="04. Escala de Espaçamento"
            description="Múltiplos de 4px para alinhamento geométrico"
            badge={<OrbeBadge variant="institutional">04</OrbeBadge>}
          >
            <OrbeCard variant="surface">
              <div className="space-y-2.5">
                {ORBE_SPACING_SCALE.map((sp) => (
                  <div key={sp.step} className="flex items-center gap-3 text-xs">
                    <span className="w-16 font-mono font-semibold text-foreground text-[11px]">{sp.step}</span>
                    <span className="w-12 font-mono text-muted-foreground text-[11px]">{sp.px}px</span>
                    <div className="flex-1 bg-muted/40 rounded-sm h-4 flex items-center">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full rounded-sm"
                        style={{ width: `${Math.min(sp.px * 3, 200)}px` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{sp.usage}</span>
                  </div>
                ))}
              </div>
            </OrbeCard>
          </OrbeSection>

          {/* Radius */}
          <OrbeSection
            title="05. Escala de Border Radius"
            description="Bordas controladas para estética profissional"
            badge={<OrbeBadge variant="institutional">05</OrbeBadge>}
          >
            <OrbeCard variant="surface">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {Object.entries(ORBE_RADIUS_SCALE).map(([key, item]) => (
                  <div
                    key={key}
                    className="p-3 border border-border/80 dark:border-white/[0.08] bg-muted/20 rounded-lg space-y-2 text-center"
                  >
                    <div
                      className={`h-10 w-full bg-card dark:bg-[#1A1F27] border border-blue-500/40 shadow-xs flex items-center justify-center font-mono font-bold text-xs ${item.className}`}
                    >
                      {item.value}
                    </div>
                    <div>
                      <div className="font-bold text-foreground capitalize">radius-{key}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight pt-0.5">{item.usage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </OrbeCard>
          </OrbeSection>
        </div>

        {/* ── 06 SHADOWS & BORDERS ── */}
        <OrbeSection
          title="06. Sombras & Bordas Estruturais"
          description="Profundidade sem exagero"
          badge={<OrbeBadge variant="institutional">06</OrbeBadge>}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(ORBE_SHADOW_SCALE).map(([key, cls]) => (
              <div
                key={key}
                className={`p-3.5 bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.08] rounded-xl text-center space-y-1 ${cls}`}
              >
                <div className="text-xs font-bold font-mono text-foreground">{key}</div>
                <div className="text-[10px] text-muted-foreground">Shadow Token</div>
              </div>
            ))}
          </div>
        </OrbeSection>

        {/* ── 07 BUTTONS ── */}
        <OrbeSection
          title="07. Botões & Ações Interativas"
          description="Variantes Primária, Secundária, Ghost e Destrutiva com tamanhos e estados"
          badge={<OrbeBadge variant="institutional">07</OrbeBadge>}
        >
          <OrbeCard variant="surface">
            <div className="space-y-5">
              {/* Variantes Principais */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Variantes Oficiais
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <OrbeButton variant="primary" icon={Plus}>
                    Primário (Royal Blue)
                  </OrbeButton>
                  <OrbeButton variant="secondary" icon={Download}>
                    Secundário Neutro
                  </OrbeButton>
                  <OrbeButton variant="ghost" icon={SlidersHorizontal}>
                    Ghost / Transparente
                  </OrbeButton>
                  <OrbeButton variant="destructive" icon={Trash2}>
                    Destrutivo Real
                  </OrbeButton>
                </div>
              </div>

              {/* Tamanhos */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tamanhos (sm, md, lg)
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <OrbeButton variant="primary" size="sm">
                    Pequeno (sm - 32px)
                  </OrbeButton>
                  <OrbeButton variant="primary" size="md">
                    Médio (md - 36px)
                  </OrbeButton>
                  <OrbeButton variant="primary" size="lg">
                    Grande (lg - 40px)
                  </OrbeButton>
                </div>
              </div>

              {/* Estados */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Estados Especiais (Loading / Disabled)
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <OrbeButton variant="primary" loading>
                    Processando...
                  </OrbeButton>
                  <OrbeButton variant="secondary" loading>
                    Carregando...
                  </OrbeButton>
                  <OrbeButton variant="primary" disabled>
                    Desabilitado
                  </OrbeButton>
                  <OrbeButton variant="secondary" disabled>
                    Desabilitado
                  </OrbeButton>
                </div>
              </div>
            </div>
          </OrbeCard>
        </OrbeSection>

        {/* ── 08 INPUTS & FILTERS ── */}
        <OrbeSection
          title="08. Inputs, Selects & Barra de Filtros"
          description="Controles densos de alta usabilidade para o ERP"
          badge={<OrbeBadge variant="institutional">08</OrbeBadge>}
        >
          <div className="space-y-3">
            <OrbeFilterBar
              activeCount={demoFilterSearch || demoSelect !== "all" ? 2 : 0}
              onClear={() => {
                setDemoFilterSearch("");
                setDemoSelect("all");
              }}
              actions={
                <OrbeButton variant="primary" size="sm" icon={Plus}>
                  Novo Lançamento
                </OrbeButton>
              }
            >
              <OrbeSearchInput
                value={demoFilterSearch}
                onChange={(e) => setDemoFilterSearch(e.target.value)}
                placeholder="Pesquisar por cliente, código ou serviço..."
                className="w-64"
              />

              <OrbeSelect
                value={demoSelect}
                onChange={(e) => setDemoSelect(e.target.value)}
              >
                <option value="all">Todas as Empresas</option>
                <option value="matriz">Matriz Castanhal</option>
                <option value="belem">Filial Belém</option>
                <option value="maraba">Filial Marabá</option>
              </OrbeSelect>

              <OrbeInput
                type="date"
                defaultValue="2026-10-01"
                icon={Calendar}
                className="w-36"
              />
            </OrbeFilterBar>
          </div>
        </OrbeSection>

        {/* ── 09 BADGES & STATUS ── */}
        <OrbeSection
          title="09. Badges Institucionais vs Status Semânticos"
          description="Separação estrita entre categoria/contexto e estado da esteira"
          badge={<OrbeBadge variant="institutional">09</OrbeBadge>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Institucionais */}
            <OrbeCard variant="surface">
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Badges Institucionais (Categorias & Contexto)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <OrbeBadge variant="institutional">Royal Blue Institucional</OrbeBadge>
                  <OrbeBadge variant="neutral">Neutro / Rótulo</OrbeBadge>
                  <OrbeBadge variant="outline">Outline Técnico</OrbeBadge>
                  <OrbeBadge variant="solid">Solid Oficial</OrbeBadge>
                </div>
              </div>
            </OrbeCard>

            {/* Semânticos */}
            <OrbeCard variant="surface">
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Badges Semânticos (Estados Reais)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <OrbeStatusBadge status="success" label="CONCLUÍDO / PAGO" />
                  <OrbeStatusBadge status="warning" label="PENDENTE RH" pulse />
                  <OrbeStatusBadge status="danger" label="EM RESTRIÇÃO" />
                  <OrbeStatusBadge status="info" label="EM PROCESSAMENTO" />
                  <OrbeStatusBadge status="neutral" label="HISTÓRICO" />
                </div>
              </div>
            </OrbeCard>
          </div>
        </OrbeSection>

        {/* ── 10 CARDS ── */}
        <OrbeSection
          title="10. Cards & Painéis Analíticos"
          description="Variantes Surface, KPI, Analytical, Compact e Interactive"
          badge={<OrbeBadge variant="institutional">10</OrbeBadge>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <OrbeKpiCard
              label="Receita Bruta Total"
              value="R$ 1.845.200"
              subValue="142 operações realizadas"
              status="info"
              trend={{ value: "+12.4%", positive: true }}
              interactive
              selected={selectedKpi === "kpi-1"}
              onClick={() => setSelectedKpi("kpi-1")}
            />

            <OrbeKpiCard
              label="Volume Movimentado"
              value="84.320 UN"
              subValue="Média: 593 UN / carga"
              status="success"
              trend={{ value: "+5.1%", positive: true }}
              interactive
              selected={selectedKpi === "kpi-2"}
              onClick={() => setSelectedKpi("kpi-2")}
            />

            <OrbeKpiCard
              label="Pendências de Validação"
              value="6 lotes"
              subValue="Aguardando aprovação RH"
              status="warning"
              interactive
              selected={selectedKpi === "kpi-3"}
              onClick={() => setSelectedKpi("kpi-3")}
            />

            <OrbeKpiCard
              label="Inconsistências Críticas"
              value="2 registros"
              subValue="Bloqueados para remessa"
              status="danger"
              trend={{ value: "-2 resolvidos", positive: true }}
              interactive
              selected={selectedKpi === "kpi-4"}
              onClick={() => setSelectedKpi("kpi-4")}
            />
          </div>
        </OrbeSection>

        {/* ── 11 TABLES ── */}
        <OrbeSection
          title="11. Tabela Densa Oficial do ERP"
          description="Alta densidade, alinhamento técnico e paginação integrada"
          badge={<OrbeBadge variant="institutional">11</OrbeBadge>}
        >
          <OrbeTable
            columns={tableColumns}
            data={SAMPLE_DATA}
            keyExtractor={(row) => row.id}
            selectedId={selectedTableRow}
            onRowClick={(row) => {
              setSelectedTableRow(row.id);
              toast.info(`Selecionado: ${row.codigo} — ${row.cliente}`);
            }}
            pagination={{
              page: currentPage,
              totalPages: 4,
              totalItems: 16,
              pageSize: 4,
              onPageChange: (p) => setCurrentPage(p),
            }}
          />
        </OrbeSection>

        {/* ── 12 PIPELINE STEPPER ── */}
        <OrbeSection
          title="12. Esteira Operacional (Pipeline Stepper)"
          description="Variantes compacta (tabelas) e detalhada (drawers e painéis)"
          badge={<OrbeBadge variant="institutional">12</OrbeBadge>}
        >
          <OrbeCard variant="surface">
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Variante Detalhada (Detailed Stepper — Painéis & Drawers)
                </span>
                <UxPipelineStepper
                  steps={SAMPLE_PIPELINE_STEPS}
                  currentStepKey="APROVACAO_FIN"
                  variant="detailed"
                />
              </div>

              <div className="space-y-2 pt-3 border-t border-border/60 dark:border-white/[0.05]">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Variante Compacta (Compact Stepper — Linhas de Tabela)
                </span>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Normal:</span>
                    <UxPipelineStepper
                      steps={SAMPLE_PIPELINE_STEPS}
                      currentStepKey="VALIDACAO_RH"
                      variant="compact"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Exceção / Bloqueio:</span>
                    <UxPipelineStepper
                      steps={SAMPLE_PIPELINE_STEPS}
                      currentStepKey="APROVACAO_FIN"
                      exceptionState={{ isException: true, label: "Reprovado no Financeiro" }}
                      variant="compact"
                    />
                  </div>
                </div>
              </div>
            </div>
          </OrbeCard>
        </OrbeSection>

        {/* ── 13 DRAWERS ── */}
        <OrbeSection
          title="13. Shell Canônico de Drawer Especialista"
          description="Estrutura de 4 fases: Diagnóstico → Pipeline → Contexto → Despacho"
          badge={<OrbeBadge variant="institutional">13</OrbeBadge>}
        >
          <OrbeCard variant="surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Drawer Especialista Padronizado</h3>
                <p className="text-xs text-muted-foreground">
                  Suporta fluxo unificado de diagnóstico, esteira visual, dados do lançamento e ações de despacho.
                </p>
              </div>
              <OrbeButton
                variant="primary"
                icon={PanelRight}
                onClick={() => setDrawerOpen(true)}
              >
                Testar Abertura do Drawer
              </OrbeButton>
            </div>
          </OrbeCard>

          {/* Drawer Real Renderizado */}
          <OrbeDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="OP-2026-003 • Carregamento Noturno CN5C"
            subtitle="M. Dias Branco • Matriz Castanhal • Setembro/2026"
            badge={<OrbeStatusBadge status="danger" label="EM RESTRIÇÃO" />}
            footerActions={
              <>
                <OrbeButton variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                  Cancelar
                </OrbeButton>
                <OrbeButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    toast.success("Ação de despacho homologada com sucesso!");
                    setDrawerOpen(false);
                  }}
                >
                  Liberar & Despachar
                </OrbeButton>
              </>
            }
          >
            {/* Bloco 1: Diagnóstico */}
            <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Diagnóstico Operacional: Inconsistência de Taxa</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O valor unitário informado (R$ 3,50) difere da tarifa cadastrada em contrato (R$ 3,20). Requer aprovação da Controladoria.
              </p>
            </div>

            {/* Bloco 2: Pipeline */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Esteira do Lançamento
              </span>
              <UxPipelineStepper
                steps={SAMPLE_PIPELINE_STEPS}
                currentStepKey="APROVACAO_FIN"
                exceptionState={{ isException: true, label: "Pendente Controladoria" }}
                variant="detailed"
              />
            </div>

            {/* Bloco 3: Contexto & Dados */}
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Dados Especializados da Operação
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Tomador:</span>
                  <span className="font-semibold text-foreground">M. Dias Branco</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Volume:</span>
                  <span className="font-semibold font-mono text-foreground">3.100 UN</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Valor Unitário:</span>
                  <span className="font-semibold font-mono text-foreground">R$ 3,50 / UN</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Total Calculado:</span>
                  <span className="font-bold font-mono text-foreground">R$ 10.850,00</span>
                </div>
              </div>
            </div>
          </OrbeDrawer>
        </OrbeSection>

        {/* ── 14 DOCUMENT COMPONENTS (R01 PILOT) ── */}
        <OrbeSection
          title="14. Componentes de Relatórios & Dossiês (Piloto R01)"
          description="Document Header e Controle Documental oficiais homologados"
          badge={<OrbeBadge variant="institutional">14</OrbeBadge>}
        >
          <div className="space-y-4">
            {/* Header Documental */}
            <OrbeDocumentHeader
              reportCode="R01"
              reportTitle="Analítico de Operações por Volume"
              empresaNome="ESC Logística • Matriz Castanhal"
              competencia="Setembro/2026"
              badgeText="Oficial"
            />

            {/* Controle Documental */}
            <OrbeControleDocumental
              reportCode="R01"
              totalRegistros={6}
              fonte="Operações por Volume • Módulo Operacional"
              criterios="Registros homologados de descarga e movimentação por volume na competência 2026-09"
              hashRastreabilidade="ORBE-SEC-7FA92C-R01"
            />
          </div>
        </OrbeSection>
      </OrbePageContainer>
    </UxLabShell>
  );
};

export default UxLabDesignSystemShowcase;
