/**
 * ORBE DESIGN SYSTEM — TOKENS OFICIAIS & MATRIZ VISUAL TRANSVERSAL
 * 
 * Filosofia: "Neutro por padrão. Cor por significado."
 * Identidade Institucional: ROYAL BLUE (#2563EB) + NEUTROS
 * Base Dark: Dark V4 (Luminância Pura, sem neon / glow)
 */

export const ORBE_LAYOUT_TOKENS = {
  workspaceMax: "1560px",
  pagePaddingX: "1.5rem", // 24px (p-4 md:p-6)
  pagePaddingY: "1.5rem", // 24px
  sectionGap: "1.5rem",   // 24px (space-y-6)
  cardGap: "1rem",        // 16px (gap-4)
} as const;

export const ORBE_ROYAL_BLUE = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB", // Cor Primária Oficial
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
  950: "#172554",
} as const;

export const ORBE_DARK_V4_NEUTRALS = {
  canvas: "#0B0D10",       // Fundo geral profundo
  sidebar: "#0D1014",      // Sidebar & Topbar
  surface: "#111419",      // Nível 1 (Trilhas, containers de seções)
  card: "#15191F",         // Nível 2 (Cards padrão, blocos analíticos)
  elevated: "#1A1F27",     // Nível 3 (Hover, Drawers, Modais, Popovers)
  border: "rgba(255, 255, 255, 0.06)", // Bordas estruturais discretas
  borderStrong: "rgba(255, 255, 255, 0.12)",
  textPrimary: "#F1F3F5",  // Off-white calmo
  textSecondary: "#A0A7B2",// Cinza legível para contexto e rótulos
  textTertiary: "#69717D", // Metadados e legendas silenciosas
  iconNeutral: "#A0A7B2",
} as const;

export const ORBE_LIGHT_NEUTRALS = {
  canvas: "#F8FAFC",
  sidebar: "#FFFFFF",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  elevated: "#F1F5F9",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  iconNeutral: "#64748B",
} as const;

export const ORBE_SEMANTIC_MATRIX = {
  info: {
    label: "Info / Active / Selected",
    bgLight: "bg-blue-50 text-blue-700 border-blue-200",
    bgDark: "dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
    solid: "#2563EB",
    dot: "bg-blue-600 dark:bg-blue-400",
  },
  success: {
    label: "Success / Concluído / Pago / Regular",
    bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bgDark: "dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
    solid: "#10B981",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  warning: {
    label: "Warning / Atenção / Pendência em Aberto",
    bgLight: "bg-amber-50 text-amber-700 border-amber-200",
    bgDark: "dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
    solid: "#F59E0B",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  danger: {
    label: "Danger / Restrição / Devolvido / Inconsistência Crítica",
    bgLight: "bg-rose-50 text-rose-700 border-rose-200",
    bgDark: "dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
    solid: "#E11D48",
    dot: "bg-rose-600 dark:bg-rose-400",
  },
  neutral: {
    label: "Neutral / Rascunho / Informativo / Histórico",
    bgLight: "bg-slate-100 text-slate-700 border-slate-200",
    bgDark: "dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]",
    solid: "#64748B",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
} as const;

export const ORBE_RADIUS_SCALE = {
  xs: { value: "4px", className: "rounded-[4px]", usage: "Elementos técnicos pequenos, micro-tags, células de heatmap" },
  sm: { value: "6px", className: "rounded-[6px]", usage: "Badges, chips, tags documentais" },
  md: { value: "8px", className: "rounded-lg", usage: "Inputs, selects, botões, sub-cards internos" },
  lg: { value: "12px", className: "rounded-xl", usage: "Cards principais, blocos analíticos, tabelas, containers" },
  xl: { value: "16px", className: "rounded-2xl", usage: "Superfícies de destaque e modais especiais" },
  full: { value: "9999px", className: "rounded-full", usage: "Pills de status, avatares, dots indicadores" },
} as const;

export const ORBE_SPACING_SCALE = [
  { step: "space-1", px: 4, usage: "Micro-gaps entre ícone e texto" },
  { step: "space-2", px: 8, usage: "Padding interno de inputs/badges, gap de botões" },
  { step: "space-3", px: 12, usage: "Padding de cards compactos, gap de filtros" },
  { step: "space-4", px: 16, usage: "Padding padrão de cards e células de tabela" },
  { step: "space-5", px: 20, usage: "Padding de headers e modais médios" },
  { step: "space-6", px: 24, usage: "Section gap, page padding horizontal e vertical" },
  { step: "space-8", px: 32, usage: "Separação de grandes blocos" },
  { step: "space-10", px: 40, usage: "Separação macro" },
  { step: "space-12", px: 48, usage: "Espaçamento editorial de grandes relatórios" },
] as const;

export const ORBE_TYPOGRAPHY_SCALE = {
  pageTitle: {
    name: "Page Title (H1)",
    spec: "text-lg sm:text-xl font-bold tracking-tight text-foreground",
    font: "Manrope / Sans",
    usage: "Título principal da página / documento (exatamente 1 por tela)",
  },
  pageDescription: {
    name: "Page Description",
    spec: "text-xs sm:text-sm text-muted-foreground leading-relaxed",
    font: "Inter / Sans",
    usage: "Subtítulo e descrição contextual da tela",
  },
  sectionTitle: {
    name: "Section Title (H2)",
    spec: "text-sm sm:text-base font-bold text-foreground tracking-tight",
    font: "Manrope / Sans",
    usage: "Títulos de seções analíticas e blocos de conteúdo",
  },
  cardTitle: {
    name: "Card Title (H3)",
    spec: "text-xs sm:text-sm font-semibold text-foreground",
    font: "Manrope / Sans",
    usage: "Títulos de cards, gráficos e tabelas",
  },
  body: {
    name: "Body Text",
    spec: "text-xs sm:text-sm text-foreground leading-normal",
    font: "Inter / Sans",
    usage: "Texto corrente e valores descritivos",
  },
  bodySmall: {
    name: "Body Small",
    spec: "text-xs text-muted-foreground",
    font: "Inter / Sans",
    usage: "Texto secundário em listas e tabelas",
  },
  label: {
    name: "Form / Column Label",
    spec: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider",
    font: "Inter / Sans",
    usage: "Cabeçalhos de tabela, labels de filtros e formulários",
  },
  caption: {
    name: "Caption",
    spec: "text-[10px] text-muted-foreground",
    font: "Inter / Sans",
    usage: "Dicas de rodapé, notas explicativas",
  },
  metadata: {
    name: "Metadata / Audit",
    spec: "text-[11px] text-muted-foreground/80 font-mono",
    font: "Font Mono",
    usage: "Datas, CPFs, códigos, timestamps de auditoria",
  },
  kpiNumber: {
    name: "KPI Number",
    spec: "text-xl sm:text-2xl font-black text-foreground font-mono leading-none tracking-tight",
    font: "Font Mono / Manrope",
    usage: "Métricas dominantes de KPI Cards",
  },
  monoTechnical: {
    name: "Technical / Mono",
    spec: "text-xs font-mono font-medium text-foreground",
    font: "Font Mono",
    usage: "Chaves de acesso, códigos de serviço (CN5C, R01), valores monetários",
  },
} as const;

export const ORBE_SHADOW_SCALE = {
  none: "shadow-none",
  "2xs": "shadow-2xs",
  xs: "shadow-xs",
  sm: "shadow-sm",
  md: "shadow-md",
  overlay: "shadow-2xl ring-1 ring-black/5 dark:ring-white/10",
} as const;

export const ORBE_BORDER_TOKENS = {
  subtle: "border border-border/50 dark:border-white/[0.04]",
  default: "border border-border dark:border-white/[0.06]",
  strong: "border border-border/80 dark:border-white/[0.12]",
  focus: "ring-2 ring-blue-600/30 dark:ring-blue-500/40 border-blue-600 dark:border-blue-500",
} as const;
