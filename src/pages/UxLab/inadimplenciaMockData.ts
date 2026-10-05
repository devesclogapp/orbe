// ==============================================================================
// ORBE ERP — UX14: INADIMPLÊNCIA & COBRANÇA
// Mock Dataset Canônico, Tipagens de Domínio e Calculadora de Aging (Mock Only)
// ==============================================================================

import { differenceInDays, parseISO } from "date-fns";

export const DATA_REFERENCIA_UX14 = "2026-10-31";

export type ModalidadeReceitaReal = "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL";

export type StatusReceitaInadimplente =
  | "aguardando_fechamento"
  | "pendente_cobranca"
  | "cobranca_gerada"
  | "cobranca_enviada"
  | "pendente_recebimento";

export type FaixaAging = "1_30" | "31_60" | "61_90" | "mais_90";

export interface ItemReceitaInadimplenteMock {
  id: string;
  refOrigem: string;
  tipoOrigem: "Operação por Volume" | "Serviço Extra";
  descricao: string;
  valor: number;
  data: string;
}

export interface HistoricoCobrancaMock {
  dataHora: string;
  acao: string;
  usuario: string;
  detalhes?: string;
}

export interface TituloInadimplenteMock {
  id: string;
  empresaId: string;
  clienteNome: string;
  modalidade: ModalidadeReceitaReal;
  competencia: string;
  competenciaFormatada: string;
  vencimento: string; // YYYY-MM-DD
  valorTotal: number;
  status: StatusReceitaInadimplente;
  observacao?: string | null;
  itens: ItemReceitaInadimplenteMock[];
  historico: HistoricoCobrancaMock[];
}

export interface ClienteInadimplenteResumo {
  empresaId: string;
  clienteNome: string;
  totalInadimplente: number;
  quantidadeTitulos: number;
  maiorAtrasoDias: number;
  tituloMaisAntigoVencimento: string;
  faixaMaisCritica: FaixaAging;
  faixaMaisCriticaLabel: string;
  titulos: TituloInadimplenteMock[];
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  dias_mais_90: number;
  qtd_1_30: number;
  qtd_31_60: number;
  qtd_61_90: number;
  qtd_mais_90: number;
}

export interface KpiAgingTotais {
  totalInadimplente: number;
  quantidadeTotal: number;
  dias_1_30: number;
  qtd_1_30: number;
  dias_31_60: number;
  qtd_31_60: number;
  dias_61_90: number;
  qtd_61_90: number;
  dias_mais_90: number;
  qtd_mais_90: number;
  totalAcima60Dias: number;
  qtdAcima60Dias: number;
  percentualAcima60Dias: number;
}

// ==============================================================================
// FUNÇÕES AUXILIARES CANÔNICAS DE AGING E SEMÂNTICA
// ==============================================================================

export function calcularDiasAtraso(vencimento: string, dataRef = DATA_REFERENCIA_UX14): number {
  const dRef = parseISO(dataRef);
  const dVenc = parseISO(vencimento);
  return differenceInDays(dRef, dVenc);
}

export function getFaixaAging(diasAtraso: number): FaixaAging {
  if (diasAtraso <= 30) return "1_30";
  if (diasAtraso <= 60) return "31_60";
  if (diasAtraso <= 90) return "61_90";
  return "mais_90";
}

export function getFaixaAgingLabel(faixa: FaixaAging): string {
  switch (faixa) {
    case "1_30":
      return "1 a 30 dias";
    case "31_60":
      return "31 a 60 dias";
    case "61_90":
      return "61 a 90 dias";
    case "mais_90":
      return "+90 dias";
  }
}

export function getFaixaAgingBadgeClass(faixa: FaixaAging): string {
  switch (faixa) {
    case "1_30":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "31_60":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    case "61_90":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "mais_90":
      return "bg-red-100 text-red-800 border-red-300 font-semibold dark:bg-red-950/60 dark:text-red-300 dark:border-red-700";
  }
}

export function getStatusCobrancaLabel(status: StatusReceitaInadimplente): string {
  switch (status) {
    case "aguardando_fechamento":
      return "Aguardando Fechamento";
    case "pendente_cobranca":
      return "Cobrança Pendente";
    case "cobranca_gerada":
      return "Cobrança Gerada";
    case "cobranca_enviada":
      return "Cobrança Enviada";
    case "pendente_recebimento":
      return "Aguardando Recebimento";
  }
}

export function getStatusCobrancaBadgeClass(status: StatusReceitaInadimplente): string {
  switch (status) {
    case "aguardando_fechamento":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
    case "pendente_cobranca":
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    case "cobranca_gerada":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    case "cobranca_enviada":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    case "pendente_recebimento":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  }
}

export function getContextoCobrancaDescricao(status: StatusReceitaInadimplente): string {
  switch (status) {
    case "pendente_cobranca":
      return "Documento de cobrança ainda não registrado como gerado.";
    case "cobranca_gerada":
      return "Documento de cobrança gerado. Envio ainda não registrado.";
    case "cobranca_enviada":
      return "Cobrança registrada como enviada ao cliente.";
    case "pendente_recebimento":
      return "Pagamento aguardando confirmação de recebimento.";
    case "aguardando_fechamento":
      return "Lote mensal consolidado aguardando fechamento definitivo.";
  }
}

export function getModalidadeLabel(modalidade: ModalidadeReceitaReal): string {
  switch (modalidade) {
    case "CAIXA_IMEDIATO":
      return "Caixa Imediato";
    case "DUPLICATA":
      return "Duplicata";
    case "FATURAMENTO_MENSAL":
      return "Faturamento Mensal";
  }
}

// ==============================================================================
// DATASET CANÔNICO DETERMINÍSTICO (12 TÍTULOS VENCIDOS - TOTAL R$ 280.600,00)
// ==============================================================================

export const MOCK_TITULOS_INADIMPLENTES: TituloInadimplenteMock[] = [
  // 1. Logística Transvale S.A.
  {
    id: "REC-2026-0812",
    empresaId: "emp-transvale",
    clienteNome: "Logística Transvale S.A.",
    modalidade: "FATURAMENTO_MENSAL",
    competencia: "2026-07",
    competenciaFormatada: "Julho / 2026",
    vencimento: "2026-08-10",
    valorTotal: 42800.0,
    status: "cobranca_enviada",
    observacao: "Fatura consolidada mensal",
    itens: [
      { id: "item-01", refOrigem: "OPV-7710", tipoOrigem: "Operação por Volume", descricao: "Descarga e Transbordo Granel", valor: 28400.0, data: "2026-07-15" },
      { id: "item-02", refOrigem: "SEX-1020", tipoOrigem: "Serviço Extra", descricao: "Enlonamento de Carreta Rodoviária", valor: 14400.0, data: "2026-07-22" },
    ],
    historico: [
      { dataHora: "01/08 09:30", acao: "Receita criada", usuario: "Sistema ORBE", detalhes: "Fechamento mensal consolidado" },
      { dataHora: "02/08 14:15", acao: "Cobrança gerada", usuario: "Financeiro", detalhes: "Fatura Comercial PDF emitida" },
      { dataHora: "03/08 10:00", acao: "Cobrança registrada como enviada", usuario: "Financeiro", detalhes: "Envio declarado para faturamento do cliente" },
    ],
  },
  {
    id: "REC-2026-0925",
    empresaId: "emp-transvale",
    clienteNome: "Logística Transvale S.A.",
    modalidade: "DUPLICATA",
    competencia: "2026-09",
    competenciaFormatada: "Setembro / 2026",
    vencimento: "2026-09-25",
    valorTotal: 18450.0,
    status: "cobranca_enviada",
    itens: [
      { id: "item-03", refOrigem: "OPV-8840", tipoOrigem: "Operação por Volume", descricao: "Operação por Volume Carga Fracionada", valor: 18450.0, data: "2026-09-10" },
    ],
    historico: [
      { dataHora: "10/09 18:20", acao: "Receita criada", usuario: "Sistema ORBE", detalhes: "Origem: Operação por Volume" },
      { dataHora: "11/09 11:00", acao: "Cobrança gerada", usuario: "Financeiro" },
      { dataHora: "12/09 15:40", acao: "Cobrança registrada como enviada", usuario: "Financeiro" },
    ],
  },
  {
    id: "REC-2026-1005",
    empresaId: "emp-transvale",
    clienteNome: "Logística Transvale S.A.",
    modalidade: "CAIXA_IMEDIATO",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-05",
    valorTotal: 6200.0,
    status: "pendente_recebimento",
    itens: [
      { id: "item-04", refOrigem: "SEX-1502", tipoOrigem: "Serviço Extra", descricao: "Apoio Operacional Noturno Transbordo", valor: 6200.0, data: "2026-10-05" },
    ],
    historico: [
      { dataHora: "05/10 22:30", acao: "Receita criada", usuario: "Encarregado Operação", detalhes: "Caixa Imediato (PIX/Depósito)" },
    ],
  },

  // 2. Indústria Metalúrgica Alvorada
  {
    id: "REC-2026-0518",
    empresaId: "emp-alvorada",
    clienteNome: "Indústria Metalúrgica Alvorada",
    modalidade: "FATURAMENTO_MENSAL",
    competencia: "2026-04",
    competenciaFormatada: "Abril / 2026",
    vencimento: "2026-05-20",
    valorTotal: 56700.0,
    status: "cobranca_enviada",
    itens: [
      { id: "item-05", refOrigem: "OPV-6120", tipoOrigem: "Operação por Volume", descricao: "Descarga Pesada Bobinas de Aço", valor: 38700.0, data: "2026-04-12" },
      { id: "item-06", refOrigem: "SEX-0912", tipoOrigem: "Serviço Extra", descricao: "Movimentação Especial com Empilhadeira 7T", valor: 18000.0, data: "2026-04-24" },
    ],
    historico: [
      { dataHora: "02/05 08:00", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "03/05 10:30", acao: "Cobrança gerada", usuario: "Financeiro" },
      { dataHora: "04/05 14:00", acao: "Cobrança registrada como enviada", usuario: "Financeiro" },
    ],
  },
  {
    id: "REC-2026-0612",
    empresaId: "emp-alvorada",
    clienteNome: "Indústria Metalúrgica Alvorada",
    modalidade: "DUPLICATA",
    competencia: "2026-06",
    competenciaFormatada: "Junho / 2026",
    vencimento: "2026-06-30",
    valorTotal: 24300.0,
    status: "cobranca_gerada",
    itens: [
      { id: "item-07", refOrigem: "OPV-7200", tipoOrigem: "Operação por Volume", descricao: "Carregamento Perfis e Vigas Metálicas", valor: 24300.0, data: "2026-06-15" },
    ],
    historico: [
      { dataHora: "16/06 09:10", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "17/06 11:20", acao: "Cobrança gerada", usuario: "Financeiro", detalhes: "Documento emitido aguardando registro de envio" },
    ],
  },

  // 3. Distribuidora Nordeste Cargo
  {
    id: "REC-2026-0910",
    empresaId: "emp-nordeste",
    clienteNome: "Distribuidora Nordeste Cargo",
    modalidade: "FATURAMENTO_MENSAL",
    competencia: "2026-08",
    competenciaFormatada: "Agosto / 2026",
    vencimento: "2026-09-15",
    valorTotal: 33900.0,
    status: "cobranca_enviada",
    itens: [
      { id: "item-08", refOrigem: "OPV-8110", tipoOrigem: "Operação por Volume", descricao: "Descarga Paletizada Alimentos Secos", valor: 33900.0, data: "2026-08-20" },
    ],
    historico: [
      { dataHora: "01/09 09:00", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "02/09 16:15", acao: "Cobrança gerada", usuario: "Financeiro" },
      { dataHora: "03/09 09:30", acao: "Cobrança registrada como enviada", usuario: "Financeiro" },
    ],
  },
  {
    id: "REC-2026-1015",
    empresaId: "emp-nordeste",
    clienteNome: "Distribuidora Nordeste Cargo",
    modalidade: "DUPLICATA",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-18",
    valorTotal: 12150.0,
    status: "pendente_cobranca",
    itens: [
      { id: "item-09", refOrigem: "SEX-1601", tipoOrigem: "Serviço Extra", descricao: "Reembalagem e Separação de Pallets Quebrados", valor: 12150.0, data: "2026-10-08" },
    ],
    historico: [
      { dataHora: "08/10 17:00", acao: "Receita criada", usuario: "Sistema ORBE", detalhes: "Serviço Extra aprovado pela Operação" },
    ],
  },

  // 4. Cerealista São Paulo Ltda.
  {
    id: "REC-2026-0801",
    empresaId: "emp-cerealista",
    clienteNome: "Cerealista São Paulo Ltda.",
    modalidade: "DUPLICATA",
    competencia: "2026-07",
    competenciaFormatada: "Julho / 2026",
    vencimento: "2026-08-05",
    valorTotal: 19500.0,
    status: "cobranca_enviada",
    itens: [
      { id: "item-10", refOrigem: "OPV-7550", tipoOrigem: "Operação por Volume", descricao: "Descarga Sacaria Grãos 60kg", valor: 19500.0, data: "2026-07-20" },
    ],
    historico: [
      { dataHora: "21/07 08:30", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "22/07 14:00", acao: "Cobrança gerada", usuario: "Financeiro" },
      { dataHora: "23/07 10:15", acao: "Cobrança registrada como enviada", usuario: "Financeiro" },
    ],
  },
  {
    id: "REC-2026-1020",
    empresaId: "emp-cerealista",
    clienteNome: "Cerealista São Paulo Ltda.",
    modalidade: "CAIXA_IMEDIATO",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-22",
    valorTotal: 8900.0,
    status: "pendente_recebimento",
    itens: [
      { id: "item-11", refOrigem: "SEX-1680", tipoOrigem: "Serviço Extra", descricao: "Descarga Urgente Fim de Semana", valor: 8900.0, data: "2026-10-22" },
    ],
    historico: [
      { dataHora: "22/10 19:40", acao: "Receita criada", usuario: "Encarregado Operação" },
    ],
  },

  // 5. Frigorífico Serra Azul
  {
    id: "REC-2026-0928",
    empresaId: "emp-serra-azul",
    clienteNome: "Frigorífico Serra Azul",
    modalidade: "FATURAMENTO_MENSAL",
    competencia: "2026-09",
    competenciaFormatada: "Setembro / 2026",
    vencimento: "2026-10-10",
    valorTotal: 27600.0,
    status: "cobranca_gerada",
    itens: [
      { id: "item-12", refOrigem: "OPV-8910", tipoOrigem: "Operação por Volume", descricao: "Movimentação Câmara Fria e Congelados", valor: 27600.0, data: "2026-09-18" },
    ],
    historico: [
      { dataHora: "01/10 08:30", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "03/10 11:00", acao: "Cobrança gerada", usuario: "Financeiro" },
    ],
  },
  {
    id: "REC-2026-0715",
    empresaId: "emp-serra-azul",
    clienteNome: "Frigorífico Serra Azul",
    modalidade: "DUPLICATA",
    competencia: "2026-07",
    competenciaFormatada: "Julho / 2026",
    vencimento: "2026-07-25",
    valorTotal: 14800.0,
    status: "cobranca_enviada",
    itens: [
      { id: "item-13", refOrigem: "OPV-7610", tipoOrigem: "Operação por Volume", descricao: "Estufagem de Contêiner Frigorificado", valor: 14800.0, data: "2026-07-10" },
    ],
    historico: [
      { dataHora: "11/07 10:00", acao: "Receita criada", usuario: "Sistema ORBE" },
      { dataHora: "12/07 15:30", acao: "Cobrança gerada", usuario: "Financeiro" },
      { dataHora: "13/07 09:45", acao: "Cobrança registrada como enviada", usuario: "Financeiro" },
    ],
  },

  // 6. Expresso Litoral Sul
  {
    id: "REC-2026-0905",
    empresaId: "emp-litoral",
    clienteNome: "Expresso Litoral Sul",
    modalidade: "DUPLICATA",
    competencia: "2026-08",
    competenciaFormatada: "Agosto / 2026",
    vencimento: "2026-09-08",
    valorTotal: 15300.0,
    status: "aguardando_fechamento",
    itens: [
      { id: "item-14", refOrigem: "OPV-8250", tipoOrigem: "Operação por Volume", descricao: "Descarga Rápida Cross-Docking", valor: 15300.0, data: "2026-08-28" },
    ],
    historico: [
      { dataHora: "29/08 09:20", acao: "Receita criada", usuario: "Sistema ORBE" },
    ],
  },
];

// ==============================================================================
// MOTORES DE CONSOLIDAÇÃO E RESUMO
// ==============================================================================

export function calcularKpisInadimplencia(titulos: TituloInadimplenteMock[], dataRef = DATA_REFERENCIA_UX14): KpiAgingTotais {
  const kpis: KpiAgingTotais = {
    totalInadimplente: 0,
    quantidadeTotal: 0,
    dias_1_30: 0,
    qtd_1_30: 0,
    dias_31_60: 0,
    qtd_31_60: 0,
    dias_61_90: 0,
    qtd_61_90: 0,
    dias_mais_90: 0,
    qtd_mais_90: 0,
    totalAcima60Dias: 0,
    qtdAcima60Dias: 0,
    percentualAcima60Dias: 0,
  };

  for (const t of titulos) {
    const dias = calcularDiasAtraso(t.vencimento, dataRef);
    if (dias <= 0) continue; // Não vencido

    const val = Number(t.valorTotal) || 0;
    kpis.totalInadimplente += val;
    kpis.quantidadeTotal += 1;

    if (dias <= 30) {
      kpis.dias_1_30 += val;
      kpis.qtd_1_30 += 1;
    } else if (dias <= 60) {
      kpis.dias_31_60 += val;
      kpis.qtd_31_60 += 1;
    } else if (dias <= 90) {
      kpis.dias_61_90 += val;
      kpis.qtd_61_90 += 1;
      kpis.totalAcima60Dias += val;
      kpis.qtdAcima60Dias += 1;
    } else {
      kpis.dias_mais_90 += val;
      kpis.qtd_mais_90 += 1;
      kpis.totalAcima60Dias += val;
      kpis.qtdAcima60Dias += 1;
    }
  }

  if (kpis.totalInadimplente > 0) {
    kpis.percentualAcima60Dias = Number(((kpis.totalAcima60Dias / kpis.totalInadimplente) * 100).toFixed(1));
  }

  return kpis;
}

export function agruparInadimplenciaPorCliente(titulos: TituloInadimplenteMock[], dataRef = DATA_REFERENCIA_UX14): ClienteInadimplenteResumo[] {
  const map = new Map<string, ClienteInadimplenteResumo>();

  for (const t of titulos) {
    const dias = calcularDiasAtraso(t.vencimento, dataRef);
    if (dias <= 0) continue;

    const val = Number(t.valorTotal) || 0;
    if (!map.has(t.empresaId)) {
      map.set(t.empresaId, {
        empresaId: t.empresaId,
        clienteNome: t.clienteNome,
        totalInadimplente: 0,
        quantidadeTitulos: 0,
        maiorAtrasoDias: 0,
        tituloMaisAntigoVencimento: t.vencimento,
        faixaMaisCritica: "1_30",
        faixaMaisCriticaLabel: "1 a 30 dias",
        titulos: [],
        dias_1_30: 0,
        dias_31_60: 0,
        dias_61_90: 0,
        dias_mais_90: 0,
        qtd_1_30: 0,
        qtd_31_60: 0,
        qtd_61_90: 0,
        qtd_mais_90: 0,
      });
    }

    const c = map.get(t.empresaId)!;
    c.titulos.push(t);
    c.totalInadimplente += val;
    c.quantidadeTitulos += 1;

    if (dias > c.maiorAtrasoDias) {
      c.maiorAtrasoDias = dias;
    }

    if (t.vencimento < c.tituloMaisAntigoVencimento) {
      c.tituloMaisAntigoVencimento = t.vencimento;
    }

    if (dias <= 30) {
      c.dias_1_30 += val;
      c.qtd_1_30 += 1;
    } else if (dias <= 60) {
      c.dias_31_60 += val;
      c.qtd_31_60 += 1;
    } else if (dias <= 90) {
      c.dias_61_90 += val;
      c.qtd_61_90 += 1;
    } else {
      c.dias_mais_90 += val;
      c.qtd_mais_90 += 1;
    }
  }

  const clientes = Array.from(map.values());

  for (const c of clientes) {
    if (c.qtd_mais_90 > 0) {
      c.faixaMaisCritica = "mais_90";
      c.faixaMaisCriticaLabel = "+90 dias";
    } else if (c.qtd_61_90 > 0) {
      c.faixaMaisCritica = "61_90";
      c.faixaMaisCriticaLabel = "61 a 90 dias";
    } else if (c.qtd_31_60 > 0) {
      c.faixaMaisCritica = "31_60";
      c.faixaMaisCriticaLabel = "31 a 60 dias";
    } else {
      c.faixaMaisCritica = "1_30";
      c.faixaMaisCriticaLabel = "1 a 30 dias";
    }

    // Ordenar títulos do cliente por maior atraso
    c.titulos.sort((a, b) => calcularDiasAtraso(b.vencimento, dataRef) - calcularDiasAtraso(a.vencimento, dataRef));
  }

  // Ordenar clientes por maior valor inadimplente
  return clientes.sort((a, b) => b.totalInadimplente - a.totalInadimplente);
}
