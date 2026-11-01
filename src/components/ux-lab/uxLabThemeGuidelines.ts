/**
 * UX LAB — DIRETRIZES FUNDAMENTAIS DE DESIGN DE INTERFACE ESCURA (DARK UI)
 * 
 * Este conjunto de princípios rege a evolução visual do ORBE UX LAB e
 * serve de base obrigatória para Torre Operacional, DRE, Financeiro, RH
 * e todas as telas subsequentes.
 * 
 * Filosofia Central: "LOW CONTRAST ≠ LOW LEGIBILITY"
 */

export const DARK_UI_PRINCIPLES = {
  // 1. Evitar preto (#000000) e branco (#FFFFFF) puros indiscriminados
  surfaces: {
    canvas: "#11151C",       // Fundo geral profundo slate/grafite azulado
    sidebar: "#151A22",      // Superfície escura dedicada com separação serena
    card: "#181D25",         // Superfície elevada principal
    popover: "#1C222C",      // Superfície elevada para modais, popovers e drawers
    subSurface: "#202630",   // Superfície interna sutil para áreas agrupadas
    border: "#242C38",       // Bordas estruturais discretas e silenciosas
  },

  // 2. Três níveis claros de tipografia (eliminando a sensação de "branco luminoso")
  typography: {
    primary: "#E2E8F0",      // Off-white suave para títulos e métricas dominantes
    secondary: "#94A3B8",    // Cinza claro azulado para rótulos e contextos
    tertiary: "#64748B",     // Cinza calmo para metadados e legendas
  },

  // 3. Azul Royal Institucional com duas funções intencionais
  royalBlue: {
    interactive: "#2563EB",  // CTA primário, foco e interação dominante
    surfaceSoft: "rgba(37, 99, 235, 0.12)", // Fundo suave para seleção ativa
    accentDark: "#3B82F6",   // Séries de gráficos e pequenos destaques sem neon
  },

  // 4. Regras Canônicas
  rules: [
    "1. Evitar preto e branco puros. Utilizar superfícies slate/grafite azulado.",
    "2. Superfícies criam hierarquia antes de bordas.",
    "3. Bordas são estritamente estruturais, nunca decorativas (eliminar efeito de grade/planilha).",
    "4. Azul representa identidade e interação, sem substituir cores semânticas.",
    "5. Vermelho, âmbar e verde são semânticos; aplicar apenas em pequenos sinais (dots/labels).",
    "6. Cor nunca deve ser necessária para compreender o conteúdo.",
    "7. Evitar containers dentro de containers quando espaço e tipografia resolvem o agrupamento.",
    "8. Todo componente deve ser avaliado Light + Dark desde sua concepção.",
  ] as const,
};
