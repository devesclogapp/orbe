/**
 * ORBE UX LAB — Mock Data Demonstrativo
 * 
 * ATENÇÃO: Estes dados são exclusivamente demonstrativos e utilizados
 * unicamente no ambiente de prototipação (/ux-lab).
 * NENHUM dado é gravado no banco ou compartilhado com o backend real.
 */

export interface ExecutiveSummary {
  competencia: string;
  empresaSelecionada: string;
  statusFechamento: {
    clt: 'aberto' | 'em_analise' | 'fechado';
    diaristas: 'aberto' | 'em_analise' | 'fechado';
    financeiro: 'aberto' | 'em_analise' | 'fechado';
  };
  kpis: {
    faturamentoTotal: number;
    faturamentoDelta: number; // percentual vs mês anterior
    custosTotais: number;
    custosDelta: number;
    lucroOperacional: number;
    lucroDelta: number;
    margemOperacional: number; // percentual
    margemMeta: number;
    caixaRecebido: number;
    aReceber: number;
    aReceberAtrasado: number;
    aPagarTotal: number;
    aPagarHoje: number;
  };
  evolucaoSemanal: Array<{
    semana: string;
    receita: number;
    custos: number;
    lucro: number;
    margem: number;
  }>;
  distribuicaoCustos: Array<{
    categoria: string;
    valor: number;
    percentual: number;
    cor: string;
  }>;
  operacaoVolume: {
    totalDescargas: number;
    volumeCaixas: number;
    produtividadeMediaCxH: number;
    aprovadasPercent: number;
    pendentesConferencia: number;
    modalidades: {
      caixaImediato: number;
      duplicatas: number;
      mensal: number;
    };
  };
  rhClt: {
    totalColaboradores: number;
    horasExtrasTotal: number;
    horasExtras50: number;
    horasExtras100: number;
    adicionalNoturnoHoras: number;
    saldoBancoGeralMinutos: number; // minutos
    colaboradoresSaldoCritico: number;
    alertasCadastrais: number;
  };
  diaristas: {
    totalAtivos: number;
    presencasSemanaAtual: number;
    valorSemanaAtual: number;
    valorAcumuladoMes: number;
    statusCicloSemanal: string;
    previsaoPagamento: string;
    lotesConcluidosMes: number;
  };
  intermitentes: {
    totalCadastrados: number;
    convocacoesAtivas: number;
    horasCumpridas: number;
    valorSemanaAtual: number;
    valorAcumuladoMes: number;
    statusLote: string;
    remessaCnabStatus: string;
  };
  radarAlertas: Array<{
    id: string;
    tipo: 'critico' | 'atencao' | 'info';
    modulo: string;
    titulo: string;
    descricao: string;
    valor?: number;
    tempo: string;
    acaoLabel: string;
    origemRota: string;
  }>;
}

export const MOCK_EXECUTIVE_SUMMARY: ExecutiveSummary = {
  competencia: 'Outubro / 2026',
  empresaSelecionada: 'Consolidado Geral (Todas Unidades)',
  statusFechamento: {
    clt: 'aberto',
    diaristas: 'em_analise',
    financeiro: 'aberto',
  },
  kpis: {
    faturamentoTotal: 482350,
    faturamentoDelta: 8.4,
    custosTotais: 347120,
    custosDelta: -2.1,
    lucroOperacional: 135230,
    lucroDelta: 14.2,
    margemOperacional: 28.0,
    margemMeta: 25.0,
    caixaRecebido: 310000,
    aReceber: 172350,
    aReceberAtrasado: 14200,
    aPagarTotal: 128400,
    aPagarHoje: 18500,
  },
  evolucaoSemanal: [
    { semana: 'Sem 40', receita: 112000, custos: 82000, lucro: 30000, margem: 26.8 },
    { semana: 'Sem 41', receita: 124500, custos: 89000, lucro: 35500, margem: 28.5 },
    { semana: 'Sem 42', receita: 118000, custos: 84500, lucro: 33500, margem: 28.4 },
    { semana: 'Sem 43 (Atual)', receita: 127850, custos: 91620, lucro: 36230, margem: 28.3 },
  ],
  distribuicaoCustos: [
    { categoria: 'Folha CLT & Encargos', valor: 180500, percentual: 52.0, cor: '#2563EB' },
    { categoria: 'Diaristas Operacionais', valor: 83300, percentual: 24.0, cor: '#10B981' },
    { categoria: 'Intermitentes', valor: 41650, percentual: 12.0, cor: '#8B5CF6' },
    { categoria: 'Custos Extras & Logística', valor: 41670, percentual: 12.0, cor: '#F59E0B' },
  ],
  operacaoVolume: {
    totalDescargas: 1420,
    volumeCaixas: 284500,
    produtividadeMediaCxH: 212,
    aprovadasPercent: 97.8,
    pendentesConferencia: 14,
    modalidades: {
      caixaImediato: 98400,
      duplicatas: 145200,
      mensal: 238750,
    },
  },
  rhClt: {
    totalColaboradores: 74,
    horasExtrasTotal: 342,
    horasExtras50: 210,
    horasExtras100: 132,
    adicionalNoturnoHoras: 98,
    saldoBancoGeralMinutos: 25680, // +428 horas
    colaboradoresSaldoCritico: 3,
    alertasCadastrais: 1,
  },
  diaristas: {
    totalAtivos: 28,
    presencasSemanaAtual: 52,
    valorSemanaAtual: 8840,
    valorAcumuladoMes: 83300,
    statusCicloSemanal: 'Sem. 43: Aguardando Validação RH',
    previsaoPagamento: 'Sexta-feira 14h',
    lotesConcluidosMes: 3,
  },
  intermitentes: {
    totalCadastrados: 34,
    convocacoesAtivas: 16,
    horasCumpridas: 128,
    valorSemanaAtual: 14250,
    valorAcumuladoMes: 41650,
    statusLote: 'Lote #INT-43 em processamento',
    remessaCnabStatus: 'Remessa pronta p/ envio',
  },
  radarAlertas: [
    {
      id: 'alt-1',
      tipo: 'critico',
      modulo: 'Financeiro / Cobrança',
      titulo: '2 faturas com atraso superior a 10 dias',
      descricao: 'Cliente Transportes Sul possui duplicatas vencidas somando R$ 14.200.',
      valor: 14200,
      tempo: 'Vencido há 12d',
      acaoLabel: 'Cobrar Cliente',
      origemRota: '/financeiro/inadimplencia',
    },
    {
      id: 'alt-2',
      tipo: 'atencao',
      modulo: 'Diaristas / Fechamento',
      titulo: 'Lote semanal de diaristas pendente de aprovação',
      descricao: '52 presenças lançadas aguardando validação do RH para envio ao banco.',
      valor: 8840,
      tempo: 'Hoje 14h',
      acaoLabel: 'Conferir Lote',
      origemRota: '/operacional/diaristas',
    },
    {
      id: 'alt-3',
      tipo: 'atencao',
      modulo: 'CLT / Banco de Horas',
      titulo: '3 colaboradores com débito crítico no banco',
      descricao: 'Saldo negativo acima de -20 horas acumuladas na competência atual.',
      tempo: 'Competência Out/26',
      acaoLabel: 'Ver Extrato',
      origemRota: '/clt/banco-horas',
    },
    {
      id: 'alt-4',
      tipo: 'info',
      modulo: 'Automação / REP',
      titulo: 'Sincronização RHID executada com sucesso',
      descricao: '74 espelhos de ponto importados às 07:00 sem inconsistências de hardware.',
      tempo: 'Hoje 07:01',
      acaoLabel: 'Ver Pontos',
      origemRota: '/operacional/pontos',
    },
  ],
};

export const MOCK_EMPRESAS_OPTIONS = [
  { value: 'all', label: 'Consolidado Geral (Todas Unidades)' },
  { value: 'esc-matriz', label: 'ESC Logística — Matriz Barueri' },
  { value: 'esc-porto', label: 'ESC Logística — Filial Santos Porto' },
  { value: 'esc-campinas', label: 'ESC Logística — Hub Campinas' },
];

export const MOCK_COMPETENCIAS_OPTIONS = [
  { value: '2026-10', label: 'Outubro / 2026 (Atual)' },
  { value: '2026-09', label: 'Setembro / 2026 (Fechado)' },
  { value: '2026-08', label: 'Agosto / 2026 (Fechado)' },
  { value: '2026-07', label: 'Julho / 2026 (Fechado)' },
];
