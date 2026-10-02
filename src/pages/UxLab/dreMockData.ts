/**
 * ORBE UX LAB — Resultado Operacional (DRE) Mock Data
 *
 * Ambiente de prototipação exclusivo (/ux-lab/dre).
 * Dados matematicamente coerentes para validação da arquitetura visual.
 * NÃO impacta qualquer dado real de produção.
 *
 * CONSISTÊNCIA ARITMÉTICA:
 *   Receita Bruta:      482.350  (100,0%)
 *   Custos Totais:      347.120  ( 71,9%) ? CLT 180.500 + Diaristas 83.300 + Interm. 41.650 + Extras 41.670 ?
 *   Resultado:          135.230  ( 28,0%) ? 482.350 - 347.120 ?
 *   Por empresa:        185.000 + 156.350 + 141.000 = 482.350 ?
 *                       128.000 + 112.000 + 107.120 = 347.120 ?
 *                        57.000 +  44.350 +  33.880 = 135.230 ?
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

export const DRE_RECEITA_BRUTA = 482350;
export const DRE_CUSTOS_TOTAIS = 347120;
export const DRE_RESULTADO = 135230;
export const DRE_MARGEM = 28.0;
export const DRE_MARGEM_META = 25.0;
export const DRE_MARGEM_MES_ANTERIOR = 26.5;

export const DRE_LEDGER: DRELedgerItem[] = [
  {
    id: 'receita-bruta',
    tipo: 'receita',
    sinal: '+',
    label: 'Receita Operacional Bruta',
    descricao: 'Total faturado pelas operações de campo nesta competência. Inclui faturamento mensal por contrato, duplicatas a prazo e caixa imediato (operações spot).',
    valor: 482350,
    percentualReceita: 100.0,
    deltaPercent: 8.4,
    cor: '#64748B',
    detalhes: [
      { label: 'Faturamento Mensal (contratos recorrentes)', valor: 238750, percentualPai: 49.5, nota: 'Faturamento consolidado por contrato mensal' },
      { label: 'Duplicatas a prazo (15–30 dias)', valor: 145200, percentualPai: 30.1, nota: 'Transportadoras e clientes PJ com prazo negociado' },
      { label: 'Caixa Imediato (à vista / spot)', valor: 98400, percentualPai: 20.4, nota: 'Carregamentos avulsos e serviços extras faturáveis' },
    ],
  },
  {
    id: 'folha-clt',
    tipo: 'deducao',
    sinal: '-',
    label: 'Folha CLT & Encargos',
    descricao: 'Remuneração base, horas extras, adicional noturno e encargos trabalhistas estimados dos colaboradores com vínculo CLT.',
    valor: 180500,
    percentualReceita: 37.4,
    deltaPercent: 3.2,
    cor: '#2563EB',
    detalhes: [
      { label: 'Salário base (74 colaboradores)', valor: 125400, percentualPai: 69.5 },
      { label: 'Horas extras 50% — 210h acumuladas', valor: 14200, percentualPai: 7.9 },
      { label: 'Horas extras 100% — 132h acumuladas', valor: 11800, percentualPai: 6.5 },
      { label: 'Adicional noturno — 98h acumuladas', valor: 9100, percentualPai: 5.0 },
      { label: 'Encargos INSS / FGTS (estimativa)', valor: 20000, percentualPai: 11.1, nota: 'Provisão mensal estimada sobre folha bruta' },
    ],
  },
  {
    id: 'diaristas',
    tipo: 'deducao',
    sinal: '-',
    label: 'Diaristas Operacionais',
    descricao: 'Pagamentos semanais de diaristas registrados, com presença validada pelo RH e aprovação financeira. Quatro ciclos semanais nesta competência.',
    valor: 83300,
    percentualReceita: 17.3,
    deltaPercent: -1.1,
    cor: '#059669',
    detalhes: [
      { label: 'Semana 40 (11–17/Out) — 28 diaristas', valor: 18200, percentualPai: 21.9, nota: 'Lote concluído · CNAB liquidado' },
      { label: 'Semana 41 (18–24/Out) — 28 diaristas', valor: 21850, percentualPai: 26.2, nota: 'Lote concluído · CNAB liquidado' },
      { label: 'Semana 42 (25–31/Out) — 28 diaristas', valor: 20100, percentualPai: 24.1, nota: 'Lote concluído · CNAB liquidado' },
      { label: 'Semana 43 (1–7/Nov) — 28 diaristas', valor: 23150, percentualPai: 27.8, nota: 'Em validação RH · previsão de pagamento: sexta-feira 14h' },
    ],
  },
  {
    id: 'intermitentes',
    tipo: 'deducao',
    sinal: '-',
    label: 'Trabalhadores Intermitentes',
    descricao: 'Convocações e horas cumpridas por trabalhadores com regime intermitente no período. Lote em processamento.',
    valor: 41650,
    percentualReceita: 8.6,
    deltaPercent: 0.8,
    cor: '#7C3AED',
    detalhes: [
      { label: '16 convocações ativas — 128 horas cumpridas', valor: 41650, percentualPai: 100.0, nota: 'Lote #INT-43 em processamento · média ~R$325/colaborador' },
    ],
  },
  {
    id: 'custos-extras',
    tipo: 'deducao',
    sinal: '-',
    label: 'Custos Extras & Logística',
    descricao: 'Despesas operacionais variáveis da competência: alimentação, EPIs, materiais, combustível e outros custos administrativos de suporte.',
    valor: 41670,
    percentualReceita: 8.6,
    deltaPercent: -5.2,
    cor: '#D97706',
    detalhes: [
      { label: 'Lanches e alimentação operacional', valor: 8400, percentualPai: 20.2 },
      { label: 'EPIs e uniformes', valor: 6200, percentualPai: 14.9 },
      { label: 'Materiais e ferramentas de operação', valor: 5470, percentualPai: 13.1 },
      { label: 'Combustível e transporte logístico', valor: 12400, percentualPai: 29.7 },
      { label: 'Outros custos administrativos', valor: 9200, percentualPai: 22.1 },
    ],
  },
];

export const DRE_RESULTADO_LINE: DRELedgerItem = {
  id: 'resultado-operacional',
  tipo: 'resultado',
  sinal: '=',
  label: 'Resultado Operacional',
  descricao: 'Resultado antes de impostos sobre lucro, depreciações e ajustes contábeis estatutários. Relatório gerencial operacional.',
  valor: 135230,
  percentualReceita: 28.04,
  deltaPercent: 14.2,
  cor: '#16A34A',
  detalhes: [],
};

export const DRE_COMPOSICAO: DREComposicaoItem[] = [
  { nome: 'Folha CLT & Encargos', valor: 180500, percentual: 52.0, cor: '#2563EB' },
  { nome: 'Diaristas Operacionais', valor: 83300, percentual: 24.0, cor: '#059669' },
  { nome: 'Intermitentes', valor: 41650, percentual: 12.0, cor: '#7C3AED' },
  { nome: 'Custos Extras & Logística', valor: 41670, percentual: 12.0, cor: '#D97706' },
];

export const DRE_BY_EMPRESA: DREByEmpresaItem[] = [
  { id: 'esc-matriz', empresa: 'ESC Logística — Matriz Barueri', receita: 185000, custos: 128000, resultado: 57000, margem: 30.8, deltaReceita: 10.2, deltaMargem: 1.8 },
  { id: 'esc-porto', empresa: 'ESC Logística — Filial Santos Porto', receita: 156350, custos: 112000, resultado: 44350, margem: 28.4, deltaReceita: 7.1, deltaMargem: 0.9 },
  { id: 'esc-campinas', empresa: 'ESC Logística — Hub Campinas', receita: 141000, custos: 107120, resultado: 33880, margem: 24.0, deltaReceita: 8.1, deltaMargem: -0.3 },
];

export const DRE_TENDENCIA_12M: DRETendenciaItem[] = [
  { mes: 'Nov/25', receita: 398000, custos: 305000, resultado:  93000, margem: 23.4 },
  { mes: 'Dez/25', receita: 415000, custos: 318000, resultado:  97000, margem: 23.4 },
  { mes: 'Jan/26', receita: 388000, custos: 293000, resultado:  95000, margem: 24.5 },
  { mes: 'Fev/26', receita: 405000, custos: 308000, resultado:  97000, margem: 24.0 },
  { mes: 'Mar/26', receita: 428000, custos: 320000, resultado: 108000, margem: 25.2 },
  { mes: 'Abr/26', receita: 441000, custos: 330000, resultado: 111000, margem: 25.2 },
  { mes: 'Mai/26', receita: 452000, custos: 338000, resultado: 114000, margem: 25.2 },
  { mes: 'Jun/26', receita: 445000, custos: 335000, resultado: 110000, margem: 24.7 },
  { mes: 'Jul/26', receita: 458000, custos: 340000, resultado: 118000, margem: 25.8 },
  { mes: 'Ago/26', receita: 463000, custos: 347000, resultado: 116000, margem: 25.1 },
  { mes: 'Set/26', receita: 445000, custos: 327000, resultado: 118000, margem: 26.5 },
  { mes: 'Out/26', receita: 482350, custos: 347120, resultado: 135230, margem: 28.0, isCurrent: true },
];
