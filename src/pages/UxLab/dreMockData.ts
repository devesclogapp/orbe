/**
 * MOCK DATA — DRE OPERACIONAL (UX-LAB PROTOTIPAÇÃO ISOLADA)
 *
 * Este arquivo alimenta exclusivamente a prototipação experimental do DRE no UX-LAB.
 * NÃO impacta qualquer dado real de produção.
 *
 * DESIGN SYSTEM — REGRA CROMÁTICA GLOBAL:
 *   MONOCROMÁTICO INSTITUCIONAL PARA CATEGORIAS.
 *   CORES SEMÂNTICAS PARA ESTADOS.
 *
 * INTEGRIDADE ARITMÉTICA (HOTFIX 04.1):
 *   Cada empresa possui dataset próprio por competência (sem rateio ou proporcionalidade).
 *   O consolidado "Todas as empresas" é a soma estrita dos componentes das unidades.
 *
 *   Outubro/2026 (Consolidado):
 *     Receita:        380.000 (160k Matriz + 125k Porto + 95k Campinas)
 *     Folha CLT:      140.000 ( 58k Matriz +  47k Porto + 35k Campinas)
 *     Diaristas:       64.000 ( 26k Matriz +  22k Porto + 16k Campinas)
 *     Intermitentes:   32.000 ( 14k Matriz +  10k Porto +  8k Campinas)
 *     Custos Extras:   30.000 ( 12k Matriz +  10k Porto +  8k Campinas)
 *     Custos Diretos: 266.000 (110k Matriz +  89k Porto + 67k Campinas)
 *     Resultado:      114.000 ( 50k Matriz +  36k Porto + 28k Campinas)
 *     Margem:          30,0%  (114.000 / 380.000 = 30,0%)
 */

export interface DREDetalheItem {
  label: string;
  valor: number;
  percentualPai: number;
  nota?: string;
}

export interface DRELedgerItem {
  id: string;
  tipo: 'receita' | 'deducao' | 'resultado';
  sinal: '+' | '-' | '=';
  label: string;
  descricao: string;
  valor: number;
  percentualReceita: number;
  deltaPercent: number;
  cor: string;
  detalhes: DREDetalheItem[];
  compValor?: number;
}

export interface DREByEmpresaItem {
  id: string;
  empresa: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  deltaReceita: number;
  deltaMargem: number;
}

export interface DREComposicaoItem {
  nome: string;
  valor: number;
  percentual: number;
  cor: string;
}

export interface DRETendenciaItem {
  mes: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  isCurrent?: boolean;
}

/**
 * ESCALA TONAL AZUL ORBE — CATEGORIAS DE DADOS
 */
export const ORBE_BLUE_SCALE = {
  light: {
    data100: '#1D4ED8', // Folha CLT & Encargos (Azul Royal Profundo)
    data75:  '#2563EB', // Diaristas Operacionais (Azul Primário)
    data55:  '#3B82F6', // Trabalhadores Intermitentes (Azul Médio)
    data35:  '#60A5FA', // Custos Extras & Logística (Azul Suave)
  },
  dark: {
    data100: '#3B82F6', // Folha CLT & Encargos (Azul Royal Luminoso)
    data75:  '#60A5FA', // Diaristas Operacionais (Azul Claro)
    data55:  '#93C5FD', // Trabalhadores Intermitentes (Azul Pastel)
    data35:  '#BFDBFE', // Custos Extras & Logística (Azul Gelo Suave)
  },
  canonical: {
    clt: '#1D4ED8',
    diaristas: '#2563EB',
    intermitentes: '#3B82F6',
    custosExtras: '#60A5FA',
  }
};

// ── DATASET DISCRETO POR EMPRESA E POR COMPETÊNCIA ──────────────────────────

export interface DRECompanyData {
  receitaOperacional: number;
  folhaCLT: number;
  diaristas: number;
  intermitentes: number;
  custosExtras: number;
}

export const DRE_EMPRESAS_INFO: Record<string, { id: string; empresa: string }> = {
  'esc-matriz': { id: 'esc-matriz', empresa: 'ESC Logística — Matriz Barueri' },
  'esc-porto': { id: 'esc-porto', empresa: 'ESC Logística — Filial Santos Porto' },
  'esc-campinas': { id: 'esc-campinas', empresa: 'ESC Logística — Hub Campinas' },
};

export const DRE_DATASET_POR_EMPRESA: Record<string, Record<string, DRECompanyData>> = {
  '2026-10': {
    'esc-matriz': {
      receitaOperacional: 160000,
      folhaCLT: 58000,
      diaristas: 26000,
      intermitentes: 14000,
      custosExtras: 12000,
    },
    'esc-porto': {
      receitaOperacional: 125000,
      folhaCLT: 47000,
      diaristas: 22000,
      intermitentes: 10000,
      custosExtras: 10000,
    },
    'esc-campinas': {
      receitaOperacional: 95000,
      folhaCLT: 35000,
      diaristas: 16000,
      intermitentes: 8000,
      custosExtras: 8000,
    },
  },
  '2026-09': {
    'esc-matriz': {
      receitaOperacional: 150000,
      folhaCLT: 56000,
      diaristas: 25000,
      intermitentes: 13000,
      custosExtras: 9000,
    },
    'esc-porto': {
      receitaOperacional: 115000,
      folhaCLT: 45000,
      diaristas: 21000,
      intermitentes: 10000,
      custosExtras: 7000,
    },
    'esc-campinas': {
      receitaOperacional: 85000,
      folhaCLT: 34000,
      diaristas: 16000,
      intermitentes: 7000,
      custosExtras: 6000,
    },
  },
  '2026-08': {
    'esc-matriz': {
      receitaOperacional: 155000,
      folhaCLT: 57000,
      diaristas: 25500,
      intermitentes: 13500,
      custosExtras: 11000,
    },
    'esc-porto': {
      receitaOperacional: 120000,
      folhaCLT: 46000,
      diaristas: 21500,
      intermitentes: 10000,
      custosExtras: 9500,
    },
    'esc-campinas': {
      receitaOperacional: 90000,
      folhaCLT: 35000,
      diaristas: 16000,
      intermitentes: 7500,
      custosExtras: 7500,
    },
  },
  '2026-07': {
    'esc-matriz': {
      receitaOperacional: 152000,
      folhaCLT: 55000,
      diaristas: 25000,
      intermitentes: 13000,
      custosExtras: 10000,
    },
    'esc-porto': {
      receitaOperacional: 118000,
      folhaCLT: 45000,
      diaristas: 21000,
      intermitentes: 10000,
      custosExtras: 9000,
    },
    'esc-campinas': {
      receitaOperacional: 88000,
      folhaCLT: 34000,
      diaristas: 15500,
      intermitentes: 7500,
      custosExtras: 7000,
    },
  },
};

// ── SNAPSHOT RESOLUTION ENGINE ────────────────────────────────────────────────

export interface DRESnapshot {
  competencia: string;
  competenciaLabel: string;
  empresaId: string;
  empresaLabel: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  clt: number;
  diaristas: number;
  intermitentes: number;
  custosExtras: number;
}

const COMPETENCIAS_LABELS: Record<string, string> = {
  '2026-10': 'Outubro / 2026',
  '2026-09': 'Setembro / 2026',
  '2026-08': 'Agosto / 2026',
  '2026-07': 'Julho / 2026',
};

/**
 * Retorna o snapshot DRE exato para competência e empresa selecionadas.
 * Se empresaId === 'all', soma matematicamente os dados das 3 empresas.
 * Se empresaId específica, busca o dataset direto daquela empresa.
 * NUNCA utiliza rateio ou percentual arbitrário.
 */
export function getDRESnapshot(competencia: string, empresaId: string = 'all'): DRESnapshot {
  const compData = DRE_DATASET_POR_EMPRESA[competencia] || DRE_DATASET_POR_EMPRESA['2026-10'];
  const competenciaLabel = COMPETENCIAS_LABELS[competencia] || competencia;

  if (empresaId && empresaId !== 'all') {
    const raw = compData[empresaId] || compData['esc-matriz'];
    const info = DRE_EMPRESAS_INFO[empresaId] || { id: empresaId, empresa: 'Unidade Específica' };
    const receita = raw.receitaOperacional;
    const clt = raw.folhaCLT;
    const diaristas = raw.diaristas;
    const intermitentes = raw.intermitentes;
    const custosExtras = raw.custosExtras;
    const custos = clt + diaristas + intermitentes + custosExtras;
    const resultado = receita - custos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;

    return {
      competencia,
      competenciaLabel,
      empresaId,
      empresaLabel: info.empresa,
      receita,
      custos,
      resultado,
      margem,
      clt,
      diaristas,
      intermitentes,
      custosExtras,
    };
  }

  // Consolidado: soma matemática estrita de todas as empresas
  let receita = 0;
  let clt = 0;
  let diaristas = 0;
  let intermitentes = 0;
  let custosExtras = 0;

  Object.values(compData).forEach((emp) => {
    receita += emp.receitaOperacional;
    clt += emp.folhaCLT;
    diaristas += emp.diaristas;
    intermitentes += emp.intermitentes;
    custosExtras += emp.custosExtras;
  });

  const custos = clt + diaristas + intermitentes + custosExtras;
  const resultado = receita - custos;
  const margem = receita > 0 ? (resultado / receita) * 100 : 0;

  return {
    competencia,
    competenciaLabel,
    empresaId: 'all',
    empresaLabel: 'Consolidado Geral (Todas Unidades)',
    receita,
    custos,
    resultado,
    margem,
    clt,
    diaristas,
    intermitentes,
    custosExtras,
  };
}

/**
 * Retorna os dados por empresa para a aba "Por Empresa" na competência informada.
 * Deriva deltas de receita e margem comparando com a competência anterior.
 */
export function getDREByEmpresaForCompetencia(competencia: string): DREByEmpresaItem[] {
  const currentSnap = DRE_DATASET_POR_EMPRESA[competencia] || DRE_DATASET_POR_EMPRESA['2026-10'];
  // Encontra competência anterior para cálculo de deltas
  const comps = Object.keys(DRE_DATASET_POR_EMPRESA);
  const idx = comps.indexOf(competencia);
  const prevComp = idx < comps.length - 1 ? comps[idx + 1] : '2026-09';
  const prevSnap = DRE_DATASET_POR_EMPRESA[prevComp] || DRE_DATASET_POR_EMPRESA['2026-09'];

  return Object.entries(DRE_EMPRESAS_INFO).map(([id, info]) => {
    const cur = currentSnap[id];
    const prev = prevSnap[id];

    const receita = cur.receitaOperacional;
    const custos = cur.folhaCLT + cur.diaristas + cur.intermitentes + cur.custosExtras;
    const resultado = receita - custos;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;

    const prevReceita = prev ? prev.receitaOperacional : receita;
    const prevCustos = prev ? prev.folhaCLT + prev.diaristas + prev.intermitentes + prev.custosExtras : custos;
    const prevResultado = prevReceita - prevCustos;
    const prevMargem = prevReceita > 0 ? (prevResultado / prevReceita) * 100 : 0;

    const deltaReceita = prevReceita > 0 ? ((receita - prevReceita) / prevReceita) * 100 : 0;
    const deltaMargem = margem - prevMargem; // estritamente em pontos percentuais (pp)

    return {
      id,
      empresa: info.empresa,
      receita,
      custos,
      resultado,
      margem,
      deltaReceita,
      deltaMargem,
    };
  });
}

// ── CONSTANTES E DADOS RETROCOMPATÍVEIS PARA OUTUBRO / 2026 ─────────────────

const outSnapshot = getDRESnapshot('2026-10', 'all');

export const DRE_RECEITA_OPERACIONAL = outSnapshot.receita; // 380.000
export const DRE_RECEITA_BRUTA = DRE_RECEITA_OPERACIONAL; // Alias
export const DRE_CUSTOS_TOTAIS = outSnapshot.custos; // 266.000
export const DRE_RESULTADO = outSnapshot.resultado; // 114.000
export const DRE_MARGEM = outSnapshot.margem; // 30.0%
export const DRE_MARGEM_MES_ANTERIOR = 28.9;

export const DRE_BY_EMPRESA: DREByEmpresaItem[] = getDREByEmpresaForCompetencia('2026-10');

export const DRE_LEDGER: DRELedgerItem[] = [
  {
    id: 'receita-operacional',
    tipo: 'receita',
    sinal: '+',
    label: 'Receita Operacional',
    descricao: 'Total faturado pelas operações de campo nesta competência. Inclui faturamento mensal por contrato, duplicatas a prazo e caixa imediato (operações spot).',
    valor: outSnapshot.receita,
    percentualReceita: 100.0,
    deltaPercent: 8.6,
    cor: '#64748B',
    detalhes: [
      { label: 'Faturamento Mensal (contratos recorrentes)', valor: 190000, percentualPai: 50.0, nota: 'Faturamento consolidado por contrato mensal' },
      { label: 'Duplicatas a prazo (15–30 dias)', valor: 114000, percentualPai: 30.0, nota: 'Transportadoras e clientes PJ com prazo negociado' },
      { label: 'Caixa Imediato (à vista / spot)', valor: 76000, percentualPai: 20.0, nota: 'Carregamentos avulsos e serviços extras faturáveis' },
    ],
  },
  {
    id: 'folha-clt',
    tipo: 'deducao',
    sinal: '-',
    label: 'Folha CLT',
    descricao: 'Remuneração base, horas extras apuradas e liquidação de banco de horas aprovadas nos lotes de RH/Financeiro dos colaboradores CLT.',
    valor: outSnapshot.clt,
    percentualReceita: (outSnapshot.clt / outSnapshot.receita) * 100,
    deltaPercent: 3.7,
    cor: ORBE_BLUE_SCALE.canonical.clt,
    detalhes: [
      { label: 'Lote Folha Base (74 colaboradores)', valor: 112000, percentualPai: 80.0, nota: 'Salários base contratuais apurados no Lote FOLHA_BASE' },
      { label: 'Lote Folha Variável (Horas Extras & Ajustes)', valor: 20000, percentualPai: 14.3, nota: 'Horas extras e variáveis consolidadas no Lote FOLHA_VARIAVEL' },
      { label: 'Lote Banco de Horas (Liquidação Financeira)', valor: 8000, percentualPai: 5.7, nota: 'Eventos de banco de horas com reflexo financeiro apurado no Lote BANCO_HORAS' },
    ],
  },
  {
    id: 'diaristas',
    tipo: 'deducao',
    sinal: '-',
    label: 'Diaristas Operacionais',
    descricao: 'Pagamentos semanais de diaristas registrados, com presença validada pelo RH e aprovação financeira. Quatro ciclos semanais nesta competência.',
    valor: outSnapshot.diaristas,
    percentualReceita: (outSnapshot.diaristas / outSnapshot.receita) * 100,
    deltaPercent: 3.2,
    cor: ORBE_BLUE_SCALE.canonical.diaristas,
    detalhes: [
      { label: 'Semana 40 (11–17/Out) • 28 diaristas', valor: 15000, percentualPai: 23.4, nota: 'Lote concluído • CNAB liquidado' },
      { label: 'Semana 41 (18–24/Out) • 28 diaristas', valor: 16500, percentualPai: 25.8, nota: 'Lote concluído • CNAB liquidado' },
      { label: 'Semana 42 (25–31/Out) • 28 diaristas', valor: 15500, percentualPai: 24.2, nota: 'Lote concluído • CNAB liquidado' },
      { label: 'Semana 43 (1–7/Nov) • 28 diaristas', valor: 17000, percentualPai: 26.6, nota: 'Em validação RH • previsão de pagamento: sexta-feira 14h' },
    ],
  },
  {
    id: 'intermitentes',
    tipo: 'deducao',
    sinal: '-',
    label: 'Trabalhadores Intermitentes',
    descricao: 'Convocações e horas cumpridas por trabalhadores com regime intermitente no período. Lote em processamento.',
    valor: outSnapshot.intermitentes,
    percentualReceita: (outSnapshot.intermitentes / outSnapshot.receita) * 100,
    deltaPercent: 6.7,
    cor: ORBE_BLUE_SCALE.canonical.intermitentes,
    detalhes: [
      { label: '16 convocações ativas • 128 horas cumpridas', valor: 32000, percentualPai: 100.0, nota: 'Lote #INT-43 em processamento' },
    ],
  },
  {
    id: 'custos-extras',
    tipo: 'deducao',
    sinal: '-',
    label: 'Custos Extras & Logística',
    descricao: 'Despesas operacionais variáveis da competência: alimentação, EPIs, materiais, combustível e outros custos administrativos de suporte.',
    valor: outSnapshot.custosExtras,
    percentualReceita: (outSnapshot.custosExtras / outSnapshot.receita) * 100,
    deltaPercent: 36.4,
    cor: ORBE_BLUE_SCALE.canonical.custosExtras,
    detalhes: [
      { label: 'Lanches e alimentação operacional', valor: 7000, percentualPai: 23.3 },
      { label: 'EPIs e uniformes', valor: 5000, percentualPai: 16.7 },
      { label: 'Materiais e ferramentas de operação', valor: 4000, percentualPai: 13.3 },
      { label: 'Combustível e transporte logístico', valor: 8000, percentualPai: 26.7 },
      { label: 'Outros custos administrativos', valor: 6000, percentualPai: 20.0 },
    ],
  },
];

export const DRE_RESULTADO_LINE: DRELedgerItem = {
  id: 'resultado-operacional',
  tipo: 'resultado',
  sinal: '=',
  label: 'Resultado Operacional',
  descricao: 'Resultado antes de impostos sobre lucro, depreciações e ajustes contábeis estatutários. Relatório gerencial operacional.',
  valor: outSnapshot.resultado,
  percentualReceita: outSnapshot.margem,
  deltaPercent: 12.9,
  cor: '#1D4ED8',
  detalhes: [],
};

export const DRE_COMPOSICAO: DREComposicaoItem[] = [
  { nome: 'Folha CLT & Encargos', valor: outSnapshot.clt, percentual: (outSnapshot.clt / outSnapshot.custos) * 100, cor: ORBE_BLUE_SCALE.canonical.clt },
  { nome: 'Diaristas Operacionais', valor: outSnapshot.diaristas, percentual: (outSnapshot.diaristas / outSnapshot.custos) * 100, cor: ORBE_BLUE_SCALE.canonical.diaristas },
  { nome: 'Intermitentes', valor: outSnapshot.intermitentes, percentual: (outSnapshot.intermitentes / outSnapshot.custos) * 100, cor: ORBE_BLUE_SCALE.canonical.intermitentes },
  { nome: 'Custos Extras & Logística', valor: outSnapshot.custosExtras, percentual: (outSnapshot.custosExtras / outSnapshot.custos) * 100, cor: ORBE_BLUE_SCALE.canonical.custosExtras },
];

export const DRE_TENDENCIA_12M: DRETendenciaItem[] = [
  { mes: 'Nov/25', receita: 310000, custos: 225000, resultado:  85000, margem: 27.4 },
  { mes: 'Dez/25', receita: 330000, custos: 238000, resultado:  92000, margem: 27.9 },
  { mes: 'Jan/26', receita: 315000, custos: 230000, resultado:  85000, margem: 27.0 },
  { mes: 'Fev/26', receita: 325000, custos: 234000, resultado:  91000, margem: 28.0 },
  { mes: 'Mar/26', receita: 340000, custos: 245000, resultado:  95000, margem: 27.9 },
  { mes: 'Abr/26', receita: 345000, custos: 248000, resultado:  97000, margem: 28.1 },
  { mes: 'Mai/26', receita: 350000, custos: 252000, resultado:  98000, margem: 28.0 },
  { mes: 'Jun/26', receita: 348000, custos: 250000, resultado:  98000, margem: 28.2 },
  { mes: 'Jul/26', receita: 358000, custos: 252000, resultado: 106000, margem: 29.6 },
  { mes: 'Ago/26', receita: 365000, custos: 260000, resultado: 105000, margem: 28.8 },
  { mes: 'Set/26', receita: 350000, custos: 249000, resultado: 101000, margem: 28.9 },
  { mes: 'Out/26', receita: 380000, custos: 266000, resultado: 114000, margem: 30.0, isCurrent: true },
];

export interface DRECompetenciaSnapshot {
  competencia: string;
  competenciaLabel: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  clt: number;
  diaristas: number;
  intermitentes: number;
  custosExtras: number;
}

export const DRE_COMPETENCIAS_MAP: Record<string, DRECompetenciaSnapshot> = {
  '2026-10': {
    competencia: '2026-10',
    competenciaLabel: 'Outubro / 2026',
    receita: 380000,
    custos: 266000,
    resultado: 114000,
    margem: 30.0,
    clt: 140000,
    diaristas: 64000,
    intermitentes: 32000,
    custosExtras: 30000,
  },
  '2026-09': {
    competencia: '2026-09',
    competenciaLabel: 'Setembro / 2026',
    receita: 350000,
    custos: 249000,
    resultado: 101000,
    margem: 28.9,
    clt: 135000,
    diaristas: 62000,
    intermitentes: 30000,
    custosExtras: 22000,
  },
  '2026-08': {
    competencia: '2026-08',
    competenciaLabel: 'Agosto / 2026',
    receita: 365000,
    custos: 260000,
    resultado: 105000,
    margem: 28.8,
    clt: 138000,
    diaristas: 63000,
    intermitentes: 31000,
    custosExtras: 28000,
  },
  '2026-07': {
    competencia: '2026-07',
    competenciaLabel: 'Julho / 2026',
    receita: 358000,
    custos: 252000,
    resultado: 106000,
    margem: 29.6,
    clt: 134000,
    diaristas: 61500,
    intermitentes: 30500,
    custosExtras: 26000,
  },
};
