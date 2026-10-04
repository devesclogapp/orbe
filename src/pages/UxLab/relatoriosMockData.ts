/**
 * MOCK DATA — RELATÓRIOS V2 (UX-LAB PROTOTIPAÇÃO ISOLADA)
 * Baseada estritamente nas tabelas, campos e relacionamentos homologados na Fase 01.1.
 * Segregação por empresa, sem cruzamentos fictícios e sem R06.
 */

export interface ReportMeta {
  id: string;
  code: string;
  title: string;
  description: string;
  category: "OPERACIONAL" | "PESSOAS & RH" | "FINANCEIRO & FATURAMENTO";
  status: "ready" | "in_preparation";
  outputFormats: Array<"CSV" | "PDF">;
  primaryTemporalType: "data_operacao" | "competencia" | "ciclo_semanal" | "data_custo";
}

export const RELATORIOS_CATALOGO: ReportMeta[] = [
  // OPERACIONAL
  {
    id: "r01-operacoes-volume",
    code: "R01",
    title: "Analítico de Operações por Volume",
    description: "Operações, cargas, quantidades, valores e status de descargas",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_operacao",
  },
  {
    id: "r04-custos-extras",
    code: "R04",
    title: "Custos Extras Operacionais",
    description: "Despesas extraordinárias por período, unidade e categoria de gasto",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_custo",
  },
  {
    id: "r07-servicos-extras",
    code: "R07",
    title: "Analítico de Serviços Extras",
    description: "Serviços adicionais, transbordos, enlonamento e faturamentos complementares",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_operacao",
  },

  // PESSOAS & RH
  {
    id: "r02-fechamento-diaristas",
    code: "R02",
    title: "Fechamento de Diaristas",
    description: "Consolidação de diárias, funções, lotes semanais e liquidações",
    category: "PESSOAS & RH",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "ciclo_semanal",
  },
  {
    id: "r05-banco-horas",
    code: "R05",
    title: "Consolidado de Banco de Horas",
    description: "Créditos, débitos, saldos acumulados e horas a vencer em horas e minutos",
    category: "PESSOAS & RH",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "competencia",
  },

  // FINANCEIRO & FATURAMENTO
  {
    id: "r03-faturamento-receitas",
    code: "R03",
    title: "Faturamento e Receitas",
    description: "Receitas por cliente, competência, modalidade e situação de recebimento",
    category: "FINANCEIRO & FATURAMENTO",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "competencia",
  },
];

export interface EmpresaOption {
  id: string;
  name: string;
  document: string;
  city: string;
}

export const EMPRESAS_DISPONIVEIS: EmpresaOption[] = [
  { id: "emp-01", name: "ESC LOG — Matriz Castanhal", document: "08.452.912/0001-44", city: "Castanhal / PA" },
  { id: "emp-02", name: "ESC LOG — CD Benevides", document: "08.452.912/0002-25", city: "Benevides / PA" },
  { id: "emp-03", name: "ESC LOG — Operações Belém", document: "08.452.912/0003-06", city: "Belém / PA" },
];

// ============================================================
// DATASET R01 — ANALÍTICO DE OPERAÇÕES POR VOLUME
// ============================================================
export type TipoServicoReal =
  | "Descarga"
  | "Carga"
  | "Transbordo"
  | "Movimentação"
  | "Separação"
  | "Apoio Operacional";

export type StatusOperacaoReal =
  | "CONCLUIDO"
  | "FATURADO"
  | "AGUARDANDO_FATURAMENTO"
  | "EM_VALIDACAO"
  | "RECEBIDO"
  | "EM_RESTRICAO";

export interface OperacaoVolumeRow {
  id: string;
  empresaId: string;
  dataOperacao: string; // YYYY-MM-DD
  codigoOperacional: string;
  unidade: string;
  transportadora: string;
  tipoServico: TipoServicoReal;
  produtoCarga: string;
  quantidade: number;
  valorUnitario: number;
  totalBruto: number;
  materiais: number;
  iss: number;
  placa: string;
  nfNumero: string | null; // Persistido em operacoes_producao.nf_numero TEXT (número real ou null quando não emitida)
  status: StatusOperacaoReal;
}

export const MOCK_R01_DATA: OperacaoVolumeRow[] = [
  // Castanhal (emp-01)
  {
    id: "op-101",
    empresaId: "emp-01",
    dataOperacao: "2026-09-02",
    codigoOperacional: "OP-2026-0841",
    unidade: "Doca 01 — Crossdocking",
    transportadora: "Transportadora Rápido Norte",
    tipoServico: "Descarga",
    produtoCarga: "Laticínios Refrigerados",
    quantidade: 1450,
    valorUnitario: 0.85,
    totalBruto: 1232.50,
    materiais: 45.00,
    iss: 61.63,
    placa: "OBX-4182",
    nfNumero: "89211",
    status: "CONCLUIDO",
  },
  {
    id: "op-102",
    empresaId: "emp-01",
    dataOperacao: "2026-09-04",
    codigoOperacional: "OP-2026-0849",
    unidade: "Doca 03 — Carga Seca",
    transportadora: "TransBrasil Cargas",
    tipoServico: "Descarga",
    produtoCarga: "Fardos de Grãos e Farináceos",
    quantidade: 3200,
    valorUnitario: 0.65,
    totalBruto: 2080.00,
    materiais: 0.00,
    iss: 104.00,
    placa: "QDX-9014",
    nfNumero: "10492",
    status: "CONCLUIDO",
  },
  {
    id: "op-103",
    empresaId: "emp-01",
    dataOperacao: "2026-09-11",
    codigoOperacional: "OP-2026-0872",
    unidade: "Doca 02 — Armazenagem",
    transportadora: "Logística Express Amazônia",
    tipoServico: "Movimentação",
    produtoCarga: "Bebidas e Destilados",
    quantidade: 820,
    valorUnitario: 1.10,
    totalBruto: 902.00,
    materiais: 60.00,
    iss: 45.10,
    placa: "JTR-3390",
    nfNumero: null, // Operação sem NF emitida (exibirá travessão —)
    status: "FATURADO",
  },
  {
    id: "op-104",
    empresaId: "emp-01",
    dataOperacao: "2026-09-18",
    codigoOperacional: "OP-2026-0901",
    unidade: "Doca 01 — Crossdocking",
    transportadora: "Transportadora Rápido Norte",
    tipoServico: "Descarga",
    produtoCarga: "Congelados / Carnes",
    quantidade: 2100,
    valorUnitario: 0.95,
    totalBruto: 1995.00,
    materiais: 85.00,
    iss: 99.75,
    placa: "OBX-4182",
    nfNumero: "89540",
    status: "CONCLUIDO",
  },
  {
    id: "op-105",
    empresaId: "emp-01",
    dataOperacao: "2026-09-25",
    codigoOperacional: "OP-2026-0933",
    unidade: "Doca 04 — Expedição",
    transportadora: "Rodoviário Pará-Sul",
    tipoServico: "Carga",
    produtoCarga: "Eletrodomésticos Linha Branca",
    quantidade: 640,
    valorUnitario: 2.40,
    totalBruto: 1536.00,
    materiais: 120.00,
    iss: 76.80,
    placa: "KLS-2201",
    nfNumero: "77290",
    status: "AGUARDANDO_FATURAMENTO",
  },
  {
    id: "op-106",
    empresaId: "emp-01",
    dataOperacao: "2026-09-29",
    codigoOperacional: "OP-2026-0955",
    unidade: "Doca 02 — Armazenagem",
    transportadora: "TransBrasil Cargas",
    tipoServico: "Descarga",
    produtoCarga: "Materiais de Limpeza",
    quantidade: 1900,
    valorUnitario: 0.70,
    totalBruto: 1330.00,
    materiais: 30.00,
    iss: 66.50,
    placa: "QDX-9014",
    nfNumero: "10884",
    status: "EM_VALIDACAO",
  },

  // Benevides (emp-02)
  {
    id: "op-201",
    empresaId: "emp-02",
    dataOperacao: "2026-09-03",
    codigoOperacional: "OP-2026-0844",
    unidade: "Armazém Geral — Setor A",
    transportadora: "TransNorte Rodoviário",
    tipoServico: "Descarga",
    produtoCarga: "Óleos e Gorduras Vegetais",
    quantidade: 2800,
    valorUnitario: 0.75,
    totalBruto: 2100.00,
    materiais: 50.00,
    iss: 105.00,
    placa: "NVW-1049",
    nfNumero: "33201",
    status: "CONCLUIDO",
  },
  {
    id: "op-202",
    empresaId: "emp-02",
    dataOperacao: "2026-09-14",
    codigoOperacional: "OP-2026-0888",
    unidade: "Pátio de Triagem",
    transportadora: "Jumbo Transportes",
    tipoServico: "Transbordo",
    produtoCarga: "Embalagens Industriais",
    quantidade: 1100,
    valorUnitario: 1.25,
    totalBruto: 1375.00,
    materiais: 0.00,
    iss: 68.75,
    placa: "RFG-7811",
    nfNumero: null, // Sem NF (exibe —)
    status: "FATURADO",
  },
  {
    id: "op-203",
    empresaId: "emp-02",
    dataOperacao: "2026-09-22",
    codigoOperacional: "OP-2026-0920",
    unidade: "Armazém Geral — Setor B",
    transportadora: "TransNorte Rodoviário",
    tipoServico: "Descarga",
    produtoCarga: "Açúcar e Adoçantes",
    quantidade: 4500,
    valorUnitario: 0.58,
    totalBruto: 2610.00,
    materiais: 90.00,
    iss: 130.50,
    placa: "NVW-1049",
    nfNumero: "33890",
    status: "AGUARDANDO_FATURAMENTO",
  },

  // Belém (emp-03)
  {
    id: "op-301",
    empresaId: "emp-03",
    dataOperacao: "2026-09-08",
    codigoOperacional: "OP-2026-0860",
    unidade: "Terminal Portuário 01",
    transportadora: "Navegação Fluvial Guamá",
    tipoServico: "Movimentação",
    produtoCarga: "Carga Geral Fracionada",
    quantidade: 1800,
    valorUnitario: 1.80,
    totalBruto: 3240.00,
    materiais: 140.00,
    iss: 162.00,
    placa: "BARCA-04",
    nfNumero: "99014",
    status: "CONCLUIDO",
  },
  {
    id: "op-302",
    empresaId: "emp-03",
    dataOperacao: "2026-09-24",
    codigoOperacional: "OP-2026-0930",
    unidade: "Terminal Portuário 01",
    transportadora: "Navegação Fluvial Guamá",
    tipoServico: "Carga",
    produtoCarga: "Polpa de Frutas Congeladas",
    quantidade: 2200,
    valorUnitario: 1.65,
    totalBruto: 3630.00,
    materiais: 180.00,
    iss: 181.50,
    placa: "BARCA-07",
    nfNumero: "99388",
    status: "RECEBIDO",
  },
];

// ============================================================
// DATASET R05 — CONSOLIDADO DE BANCO DE HORAS
// Estritamente em HORAS / MINUTOS. Sem R$, sem passivo.
// ============================================================
export interface BancoHorasRow {
  id: string;
  empresaId: string;
  matricula: string;
  colaboradorNome: string;
  competencia: string; // YYYY-MM
  saldoMinutos: number;
  saldoFormatado: string;
  creditosMinutos: number;
  creditosFormatado: string;
  debitosMinutos: number;
  debitosFormatado: string;
  aVencer30dMinutos: number;
  aVencer30dFormatado: string;
  vencidasMinutos: number;
  vencidasFormatado: string;
  status: "OK" | "A Vencer" | "Débito Crítico" | "Saldo Positivo";
}

export const MOCK_R05_DATA: BancoHorasRow[] = [
  // Castanhal (emp-01) - 2026-09
  {
    id: "bh-101",
    empresaId: "emp-01",
    matricula: "CLT-0041",
    colaboradorNome: "Antônio Carlos Silva",
    competencia: "2026-09",
    saldoMinutos: 1110,
    saldoFormatado: "+18h 30m",
    creditosMinutos: 1560,
    creditosFormatado: "+26h 00m",
    debitosMinutos: -450,
    debitosFormatado: "-07h 30m",
    aVencer30dMinutos: 360,
    aVencer30dFormatado: "06h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "A Vencer",
  },
  {
    id: "bh-102",
    empresaId: "emp-01",
    matricula: "CLT-0048",
    colaboradorNome: "Marcos Paulo Pereira",
    competencia: "2026-09",
    saldoMinutos: -510,
    saldoFormatado: "-08h 30m",
    creditosMinutos: 120,
    creditosFormatado: "+02h 00m",
    debitosMinutos: -630,
    debitosFormatado: "-10h 30m",
    aVencer30dMinutos: 0,
    aVencer30dFormatado: "00h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "Débito Crítico",
  },
  {
    id: "bh-103",
    empresaId: "emp-01",
    matricula: "CLT-0052",
    colaboradorNome: "Cleber Rodrigues Santos",
    competencia: "2026-09",
    saldoMinutos: 620,
    saldoFormatado: "+10h 20m",
    creditosMinutos: 780,
    creditosFormatado: "+13h 00m",
    debitosMinutos: -160,
    debitosFormatado: "-02h 40m",
    aVencer30dMinutos: 0,
    aVencer30dFormatado: "00h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "Saldo Positivo",
  },
  {
    id: "bh-104",
    empresaId: "emp-01",
    matricula: "CLT-0063",
    colaboradorNome: "Raimundo Nonato Lima",
    competencia: "2026-09",
    saldoMinutos: 45,
    saldoFormatado: "+00h 45m",
    creditosMinutos: 240,
    creditosFormatado: "+04h 00m",
    debitosMinutos: -195,
    debitosFormatado: "-03h 15m",
    aVencer30dMinutos: 0,
    aVencer30dFormatado: "00h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "OK",
  },
  {
    id: "bh-105",
    empresaId: "emp-01",
    matricula: "CLT-0071",
    colaboradorNome: "José Edivaldo Moreira",
    competencia: "2026-09",
    saldoMinutos: 1480,
    saldoFormatado: "+24h 40m",
    creditosMinutos: 1800,
    creditosFormatado: "+30h 00m",
    debitosMinutos: -320,
    debitosFormatado: "-05h 20m",
    aVencer30dMinutos: 720,
    aVencer30dFormatado: "12h 00m",
    vencidasMinutos: 180,
    vencidasFormatado: "03h 00m",
    status: "A Vencer",
  },

  // Benevides (emp-02) - 2026-09
  {
    id: "bh-201",
    empresaId: "emp-02",
    matricula: "CLT-0104",
    colaboradorNome: "Valdinei de Jesus Rocha",
    competencia: "2026-09",
    saldoMinutos: 750,
    saldoFormatado: "+12h 30m",
    creditosMinutos: 900,
    creditosFormatado: "+15h 00m",
    debitosMinutos: -150,
    debitosFormatado: "-02h 30m",
    aVencer30dMinutos: 0,
    aVencer30dFormatado: "00h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "Saldo Positivo",
  },
  {
    id: "bh-202",
    empresaId: "emp-02",
    matricula: "CLT-0112",
    colaboradorNome: "Samuel Ferreira Braga",
    competencia: "2026-09",
    saldoMinutos: -390,
    saldoFormatado: "-06h 30m",
    creditosMinutos: 60,
    creditosFormatado: "+01h 00m",
    debitosMinutos: -450,
    debitosFormatado: "-07h 30m",
    aVencer30dMinutos: 0,
    aVencer30dFormatado: "00h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "Débito Crítico",
  },

  // Belém (emp-03) - 2026-09
  {
    id: "bh-301",
    empresaId: "emp-03",
    matricula: "CLT-0205",
    colaboradorNome: "Geraldo Magela Souza",
    competencia: "2026-09",
    saldoMinutos: 540,
    saldoFormatado: "+09h 00m",
    creditosMinutos: 600,
    creditosFormatado: "+10h 00m",
    debitosMinutos: -60,
    debitosFormatado: "-01h 00m",
    aVencer30dMinutos: 180,
    aVencer30dFormatado: "03h 00m",
    vencidasMinutos: 0,
    vencidasFormatado: "00h 00m",
    status: "A Vencer",
  },
];

// ============================================================
// DATASET R03 — FATURAMENTO E RECEITAS
// Apenas Operações e Serviços Extras como origens. Custos Extras excluídos.
// ============================================================
export type ModalidadeReceitaReal = "FATURAMENTO_MENSAL" | "DUPLICATA" | "CAIXA_IMEDIATO";

export type StatusReceitaPersistido =
  | "pendente_recebimento"
  | "pendente_cobranca"
  | "aguardando_fechamento"
  | "cobranca_enviada"
  | "recebido"
  | "conciliado"
  | "cancelado";

export interface FaturamentoReceitaRow {
  id: string;
  empresaId: string;
  competencia: string; // YYYY-MM
  competenciaFormatada: string; // MM/YYYY
  clienteNome: string;
  modalidade: ModalidadeReceitaReal; // Persistido em receitas_operacionais.modalidade
  origem: "Operação por Volume" | "Serviço Extra"; // Persistido por item (operacao_id vs servico_extra_id)
  valorFaturado: number;
  vencimento: string; // YYYY-MM-DD
  dataRecebimento: string | null; // YYYY-MM-DD (null quando não recebido)
  status: StatusReceitaPersistido; // Persistido em receitas_operacionais.status
}

/**
 * Tradução de apresentação para Modalidade Real (Persistida)
 */
export function getModalidadeLabel(modalidade: ModalidadeReceitaReal): string {
  switch (modalidade) {
    case "FATURAMENTO_MENSAL":
      return "Faturamento Mensal";
    case "DUPLICATA":
      return "Duplicata";
    case "CAIXA_IMEDIATO":
      return "Caixa Imediato";
    default:
      return modalidade;
  }
}

/**
 * Tradução de apresentação para Status Real (Persistido)
 */
export function getStatusReceitaLabel(status: StatusReceitaPersistido): string {
  switch (status) {
    case "pendente_recebimento":
      return "Pendente Recebimento";
    case "pendente_cobranca":
      return "Pendente Cobrança";
    case "aguardando_fechamento":
      return "Aguardando Fechamento";
    case "cobranca_enviada":
      return "Cobrança Enviada";
    case "recebido":
      return "Recebido";
    case "conciliado":
      return "Conciliado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

/**
 * ESTADO DERIVADO: Situação de Liquidação e Atraso
 * Rastreabilidade semântica:
 * - "PERSISTIDO": O valor vem diretamente da coluna receitas_operacionais.status.
 * - "DERIVADO": Calculado quando a cobrança está em aberto (status != recebido/conciliado/cancelado)
 *   e a data de vencimento é menor que a data de corte operacional (2026-10-03).
 */
export function getSituacaoDerivadaReceita(
  row: FaturamentoReceitaRow,
  dataReferencia: string = "2026-10-03"
): {
  isAtrasado: boolean;
  diasAtraso: number;
  descricao: string;
} {
  if (row.status === "conciliado" || row.status === "recebido" || row.status === "cancelado") {
    return { isAtrasado: false, diasAtraso: 0, descricao: "Liquidado" };
  }
  if (row.dataRecebimento) {
    return { isAtrasado: false, diasAtraso: 0, descricao: "Liquidado" };
  }
  if (row.vencimento < dataReferencia) {
    const dVenc = new Date(row.vencimento).getTime();
    const dRef = new Date(dataReferencia).getTime();
    const dias = Math.max(1, Math.round((dRef - dVenc) / (1000 * 60 * 60 * 24)));
    return { isAtrasado: true, diasAtraso: dias, descricao: `Em Atraso (${dias}d)` };
  }
  return { isAtrasado: false, diasAtraso: 0, descricao: "No Prazo" };
}

export const MOCK_R03_DATA: FaturamentoReceitaRow[] = [
  // Castanhal (emp-01) - 2026-09
  {
    id: "rec-101",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Distribuidora Líder Alimentos S/A",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Operação por Volume",
    valorFaturado: 14820.00,
    vencimento: "2026-10-10",
    dataRecebimento: "2026-10-09",
    status: "conciliado",
  },
  {
    id: "rec-102",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Supermercados Amazônia Ltda",
    modalidade: "DUPLICATA",
    origem: "Operação por Volume",
    valorFaturado: 8940.50,
    vencimento: "2026-10-15",
    dataRecebimento: null,
    status: "cobranca_enviada",
  },
  {
    id: "rec-103",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Supermercados Amazônia Ltda",
    modalidade: "DUPLICATA",
    origem: "Serviço Extra",
    valorFaturado: 1450.00,
    vencimento: "2026-10-15",
    dataRecebimento: null,
    status: "cobranca_enviada",
  },
  {
    id: "rec-104",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Atacadão do Norte Distribuição",
    modalidade: "CAIXA_IMEDIATO",
    origem: "Operação por Volume",
    valorFaturado: 3200.00,
    vencimento: "2026-09-28",
    dataRecebimento: "2026-09-28",
    status: "recebido",
  },
  {
    id: "rec-105",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Frigorífico Boi Gordo S/A",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Operação por Volume",
    valorFaturado: 21650.00,
    vencimento: "2026-10-20",
    dataRecebimento: null,
    status: "aguardando_fechamento",
  },
  {
    id: "rec-106",
    empresaId: "emp-01",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Comercial de Grãos do Guamá",
    modalidade: "DUPLICATA",
    origem: "Operação por Volume",
    valorFaturado: 5400.00,
    vencimento: "2026-09-25", // Vencimento anterior a 2026-10-03 (derivará "Em Atraso")
    dataRecebimento: null,
    status: "pendente_cobranca",
  },

  // Benevides (emp-02) - 2026-09
  {
    id: "rec-201",
    empresaId: "emp-02",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Bunge Alimentos Regional",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Operação por Volume",
    valorFaturado: 19800.00,
    vencimento: "2026-10-10",
    dataRecebimento: "2026-10-10",
    status: "conciliado",
  },
  {
    id: "rec-202",
    empresaId: "emp-02",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Bunge Alimentos Regional",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Serviço Extra",
    valorFaturado: 2750.00,
    vencimento: "2026-10-10",
    dataRecebimento: "2026-10-10",
    status: "recebido",
  },
  {
    id: "rec-203",
    empresaId: "emp-02",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Cargill Agrícola Pará",
    modalidade: "DUPLICATA",
    origem: "Operação por Volume",
    valorFaturado: 12400.00,
    vencimento: "2026-10-18",
    dataRecebimento: null,
    status: "cobranca_enviada",
  },

  // Belém (emp-03) - 2026-09
  {
    id: "rec-301",
    empresaId: "emp-03",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Exportadora Portuária Norte",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Operação por Volume",
    valorFaturado: 38900.00,
    vencimento: "2026-10-05",
    dataRecebimento: "2026-10-05",
    status: "conciliado",
  },
  {
    id: "rec-302",
    empresaId: "emp-03",
    competencia: "2026-09",
    competenciaFormatada: "09/2026",
    clienteNome: "Exportadora Portuária Norte",
    modalidade: "FATURAMENTO_MENSAL",
    origem: "Serviço Extra",
    valorFaturado: 4500.00,
    vencimento: "2026-10-05",
    dataRecebimento: "2026-10-05",
    status: "recebido",
  },
];

// ============================================================
// DATASET R02 — FECHAMENTO DE DIARISTAS
// ============================================================

export type FuncaoDiarista =
  | "Ajudante Geral"
  | "Conferente"
  | "Movimentador"
  | "Empilhador"
  | "Operador Paleteira";

export type StatusLoteDiarista =
  | "em_aberto"
  | "fechado_para_pagamento"
  | "enviado_financeiro"
  | "pago"
  | "cancelado";

export interface DiaristaFechamentoRow {
  id: string;
  empresaId: string;
  cicloId: string;
  cicloLabel: string;
  dataLancamento: string;
  colaboradorNome: string;
  cpfMascarado: string;
  funcao: FuncaoDiarista;
  codigoMarcacao: "P" | "MP";
  quantidadeDiarias: number;
  valorDiariaBase: number;
  total: number;
  loteCodigo: string;
  statusLote: StatusLoteDiarista;
}

export function getStatusLoteDiaristaLabel(status: StatusLoteDiarista): {
  label: string;
  className: string;
} {
  switch (status) {
    case "pago":
      return {
        label: "Pago",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "enviado_financeiro":
      return {
        label: "Enviado Financeiro",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "fechado_para_pagamento":
      return {
        label: "Fechado p/ Pgto",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      };
    case "em_aberto":
      return {
        label: "Em Aberto",
        className: "bg-muted text-muted-foreground border-border/60",
      };
    case "cancelado":
      return {
        label: "Cancelado",
        className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      };
    default:
      return {
        label: status,
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export const MOCK_R02_DATA: DiaristaFechamentoRow[] = [
  // Castanhal (emp-01) - Ciclo 39/2026 (21/09 a 27/09)
  {
    id: "dia-101",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-21",
    colaboradorNome: "Raimundo Nonato Silva",
    cpfMascarado: "***.***.812-44",
    funcao: "Ajudante Geral",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 120.00,
    total: 120.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-102",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-22",
    colaboradorNome: "Raimundo Nonato Silva",
    cpfMascarado: "***.***.812-44",
    funcao: "Ajudante Geral",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 120.00,
    total: 120.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-103",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-23",
    colaboradorNome: "Raimundo Nonato Silva",
    cpfMascarado: "***.***.812-44",
    funcao: "Ajudante Geral",
    codigoMarcacao: "MP",
    quantidadeDiarias: 0.5,
    valorDiariaBase: 120.00,
    total: 60.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-104",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-21",
    colaboradorNome: "José Ribamar Souza",
    cpfMascarado: "***.***.329-15",
    funcao: "Movimentador",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 130.00,
    total: 130.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-105",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-22",
    colaboradorNome: "José Ribamar Souza",
    cpfMascarado: "***.***.329-15",
    funcao: "Movimentador",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 130.00,
    total: 130.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-106",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-21",
    colaboradorNome: "Carlos Augusto Meireles",
    cpfMascarado: "***.***.954-71",
    funcao: "Conferente",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 160.00,
    total: 160.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-107",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-23",
    colaboradorNome: "Carlos Augusto Meireles",
    cpfMascarado: "***.***.954-71",
    funcao: "Conferente",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 160.00,
    total: 160.00,
    loteCodigo: "LOTE-DIA-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-108",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-24",
    colaboradorNome: "Manoel Messias Pinheiro",
    cpfMascarado: "***.***.118-80",
    funcao: "Ajudante Geral",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 110.00,
    total: 110.00,
    loteCodigo: "LOTE-DIA-2026-39-02",
    statusLote: "enviado_financeiro",
  },
  {
    id: "dia-109",
    empresaId: "emp-01",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-25",
    colaboradorNome: "Francisco Aldemir Santos",
    cpfMascarado: "***.***.602-09",
    funcao: "Operador Paleteira",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 150.00,
    total: 150.00,
    loteCodigo: "LOTE-DIA-2026-39-02",
    statusLote: "enviado_financeiro",
  },
  // Castanhal (emp-01) - Ciclo 38/2026 (14/09 a 20/09)
  {
    id: "dia-110",
    empresaId: "emp-01",
    cicloId: "ciclo-38-2026",
    cicloLabel: "Ciclo 38/2026 (14/09 a 20/09)",
    dataLancamento: "2026-09-15",
    colaboradorNome: "Raimundo Nonato Silva",
    cpfMascarado: "***.***.812-44",
    funcao: "Ajudante Geral",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 120.00,
    total: 120.00,
    loteCodigo: "LOTE-DIA-2026-38-01",
    statusLote: "pago",
  },
  {
    id: "dia-111",
    empresaId: "emp-01",
    cicloId: "ciclo-38-2026",
    cicloLabel: "Ciclo 38/2026 (14/09 a 20/09)",
    dataLancamento: "2026-09-16",
    colaboradorNome: "José Ribamar Souza",
    cpfMascarado: "***.***.329-15",
    funcao: "Movimentador",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 130.00,
    total: 130.00,
    loteCodigo: "LOTE-DIA-2026-38-01",
    statusLote: "pago",
  },

  // CD Benevides (emp-02) - Ciclo 39/2026
  {
    id: "dia-201",
    empresaId: "emp-02",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-22",
    colaboradorNome: "Edilson Barbosa Lima",
    cpfMascarado: "***.***.431-77",
    funcao: "Ajudante Geral",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 125.00,
    total: 125.00,
    loteCodigo: "LOTE-BEN-2026-39-01",
    statusLote: "fechado_para_pagamento",
  },
  {
    id: "dia-202",
    empresaId: "emp-02",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-23",
    colaboradorNome: "Joaquim Pereira Filho",
    cpfMascarado: "***.***.559-02",
    funcao: "Conferente",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 165.00,
    total: 165.00,
    loteCodigo: "LOTE-BEN-2026-39-01",
    statusLote: "fechado_para_pagamento",
  },
  {
    id: "dia-203",
    empresaId: "emp-02",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-24",
    colaboradorNome: "Lucas Gabriel Alencar",
    cpfMascarado: "***.***.210-98",
    funcao: "Empilhador",
    codigoMarcacao: "MP",
    quantidadeDiarias: 0.5,
    valorDiariaBase: 110.00,
    total: 55.00,
    loteCodigo: "LOTE-BEN-2026-39-01",
    statusLote: "fechado_para_pagamento",
  },

  // Operações Belém (emp-03) - Ciclo 39/2026
  {
    id: "dia-301",
    empresaId: "emp-03",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-21",
    colaboradorNome: "Waldir Souza Ramos",
    cpfMascarado: "***.***.773-12",
    funcao: "Movimentador",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 135.00,
    total: 135.00,
    loteCodigo: "LOTE-BEL-2026-39-01",
    statusLote: "pago",
  },
  {
    id: "dia-302",
    empresaId: "emp-03",
    cicloId: "ciclo-39-2026",
    cicloLabel: "Ciclo 39/2026 (21/09 a 27/09)",
    dataLancamento: "2026-09-23",
    colaboradorNome: "Benedito Nazareno Silva",
    cpfMascarado: "***.***.644-83",
    funcao: "Operador Paleteira",
    codigoMarcacao: "P",
    quantidadeDiarias: 1.0,
    valorDiariaBase: 155.00,
    total: 155.00,
    loteCodigo: "LOTE-BEL-2026-39-01",
    statusLote: "pago",
  },
];

// ============================================================
// DATASET R04 — CUSTOS EXTRAS OPERACIONAIS (DESPESAS)
// ============================================================

export type CategoriaCustoExtra = "MERENDA" | "ADMINISTRATIVO" | "OPERACIONAL" | "FORNECEDOR";
export type OrigemRecursoCusto = "CAIXINHA" | "TRANSFERENCIA" | "BOLETO" | "REEMBOLSO";
export type StatusCustoExtra = "PENDENTE" | "ATRASADO" | "PAGO";

export interface CustoExtraRow {
  id: string;
  empresaId: string;
  data: string;
  unidade: string;
  categoriaCusto: CategoriaCustoExtra;
  descricao: string;
  favorecidoTipo: "Colaborador" | "Fornecedor";
  favorecidoNome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  origemRecurso: OrigemRecursoCusto;
  lancadorNome: string;
  status: StatusCustoExtra;
}

export function getStatusCustoExtraLabel(status: StatusCustoExtra): {
  label: string;
  className: string;
} {
  switch (status) {
    case "PAGO":
      return {
        label: "Pago",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "PENDENTE":
      return {
        label: "Pendente",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "ATRASADO":
      return {
        label: "Atrasado",
        className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      };
    default:
      return {
        label: status,
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getCategoriaCustoLabel(cat: CategoriaCustoExtra): string {
  switch (cat) {
    case "MERENDA":
      return "Merenda / Lanche";
    case "ADMINISTRATIVO":
      return "Administrativo";
    case "OPERACIONAL":
      return "Operacional";
    case "FORNECEDOR":
      return "Fornecedor";
    default:
      return cat;
  }
}

export const MOCK_R04_DATA: CustoExtraRow[] = [
  // Castanhal (emp-01)
  {
    id: "cst-101",
    empresaId: "emp-01",
    data: "2026-09-04",
    unidade: "Matriz Castanhal",
    categoriaCusto: "MERENDA",
    descricao: "Café da manhã e lanche p/ equipe de descarga noturna",
    favorecidoTipo: "Colaborador",
    favorecidoNome: "Carlos Eduardo (Encarregado)",
    quantidade: 1,
    valorUnitario: 185.00,
    total: 185.00,
    origemRecurso: "CAIXINHA",
    lancadorNome: "Carlos Eduardo (Encarregado)",
    status: "PAGO",
  },
  {
    id: "cst-102",
    empresaId: "emp-01",
    data: "2026-09-09",
    unidade: "Matriz Castanhal",
    categoriaCusto: "OPERACIONAL",
    descricao: "Reparo emergencial de solda na rampa da doca 03",
    favorecidoTipo: "Fornecedor",
    favorecidoNome: "Metalúrgica Castanhal Ltda",
    quantidade: 1,
    valorUnitario: 420.00,
    total: 420.00,
    origemRecurso: "BOLETO",
    lancadorNome: "Roberto Matos (Supervisor)",
    status: "PAGO",
  },
  {
    id: "cst-103",
    empresaId: "emp-01",
    data: "2026-09-14",
    unidade: "Matriz Castanhal",
    categoriaCusto: "ADMINISTRATIVO",
    descricao: "Pranchetas plásticas e bobinas térmicas p/ apontamentos",
    favorecidoTipo: "Fornecedor",
    favorecidoNome: "Papelaria Modelo Eireli",
    quantidade: 4,
    valorUnitario: 35.00,
    total: 140.00,
    origemRecurso: "CAIXINHA",
    lancadorNome: "Carlos Eduardo (Encarregado)",
    status: "PAGO",
  },
  {
    id: "cst-104",
    empresaId: "emp-01",
    data: "2026-09-18",
    unidade: "Matriz Castanhal",
    categoriaCusto: "OPERACIONAL",
    descricao: "Aquisição de botinas de segurança reposição imediata",
    favorecidoTipo: "Colaborador",
    favorecidoNome: "Manoel Messias Pinheiro",
    quantidade: 2,
    valorUnitario: 125.00,
    total: 250.00,
    origemRecurso: "REEMBOLSO",
    lancadorNome: "Roberto Matos (Supervisor)",
    status: "PENDENTE",
  },
  {
    id: "cst-105",
    empresaId: "emp-01",
    data: "2026-09-25",
    unidade: "Matriz Castanhal",
    categoriaCusto: "FORNECEDOR",
    descricao: "Locação de empilhadeira reserva por sobrecarga de pátio",
    favorecidoTipo: "Fornecedor",
    favorecidoNome: "Locamaq Máquinas e Equipamentos",
    quantidade: 1,
    valorUnitario: 950.00,
    total: 950.00,
    origemRecurso: "BOLETO",
    lancadorNome: "Roberto Matos (Supervisor)",
    status: "ATRASADO",
  },

  // CD Benevides (emp-02)
  {
    id: "cst-201",
    empresaId: "emp-02",
    data: "2026-09-08",
    unidade: "CD Benevides",
    categoriaCusto: "MERENDA",
    descricao: "Lanche e água mineral p/ descarga de carretas frigoríficas",
    favorecidoTipo: "Colaborador",
    favorecidoNome: "Jorge Silva (Encarregado)",
    quantidade: 1,
    valorUnitario: 145.00,
    total: 145.00,
    origemRecurso: "CAIXINHA",
    lancadorNome: "Jorge Silva (Encarregado)",
    status: "PAGO",
  },
  {
    id: "cst-202",
    empresaId: "emp-02",
    data: "2026-09-19",
    unidade: "CD Benevides",
    categoriaCusto: "OPERACIONAL",
    descricao: "Troca de óleo e filtros da paleteira hidráulica 02",
    favorecidoTipo: "Fornecedor",
    favorecidoNome: "Auto Peças e Hidráulica Benevides",
    quantidade: 1,
    valorUnitario: 310.00,
    total: 310.00,
    origemRecurso: "TRANSFERENCIA",
    lancadorNome: "Jorge Silva (Encarregado)",
    status: "PAGO",
  },

  // Operações Belém (emp-03)
  {
    id: "cst-301",
    empresaId: "emp-03",
    data: "2026-09-12",
    unidade: "Porto Belém",
    categoriaCusto: "OPERACIONAL",
    descricao: "Fita isolante pesada e cabos de amarração p/ contêiner",
    favorecidoTipo: "Fornecedor",
    favorecidoNome: "Casa dos Parafusos Belém",
    quantidade: 3,
    valorUnitario: 65.00,
    total: 195.00,
    origemRecurso: "CAIXINHA",
    lancadorNome: "Valter Fonseca (Encarregado Porto)",
    status: "PAGO",
  },
  {
    id: "cst-302",
    empresaId: "emp-03",
    data: "2026-09-22",
    unidade: "Porto Belém",
    categoriaCusto: "MERENDA",
    descricao: "Alimentação de apoio equipe embarque noturno",
    favorecidoTipo: "Colaborador",
    favorecidoNome: "Waldir Souza Ramos",
    quantidade: 1,
    valorUnitario: 160.00,
    total: 160.00,
    origemRecurso: "REEMBOLSO",
    lancadorNome: "Valter Fonseca (Encarregado Porto)",
    status: "PENDENTE",
  },
];

// ============================================================
// DATASET R07 — ANALÍTICO DE SERVIÇOS EXTRAS
// ============================================================

export type ModalidadeServicoExtra =
  | "DEPOSITO_IMEDIATO"
  | "CAIXA_IMEDIATO"
  | "DUPLICATA"
  | "FATURAMENTO_MENSAL";

export type PipelineStatusServicoExtra =
  | "PENDENTE"
  | "EM_VALIDACAO"
  | "APROVADO_OPERACAO"
  | "APROVADO_FINANCEIRO"
  | "FATURADO"
  | "CONCLUIDO"
  | "DEVOLVIDO";

export interface ServicoExtraRow {
  id: string;
  empresaId: string;
  data: string;
  tipoServico: string;
  descricao: string;
  tomadorNome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  modalidadeFinanceira: ModalidadeServicoExtra;
  nfNumero: string | null;
  pipelineStatus: PipelineStatusServicoExtra;
}

export function getPipelineStatusServicoExtraLabel(status: PipelineStatusServicoExtra): {
  label: string;
  className: string;
} {
  switch (status) {
    case "CONCLUIDO":
      return {
        label: "Concluído",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    case "FATURADO":
      return {
        label: "Faturado",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      };
    case "APROVADO_FINANCEIRO":
      return {
        label: "Aprov. Financeiro",
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      };
    case "APROVADO_OPERACAO":
      return {
        label: "Aprov. Operação",
        className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      };
    case "EM_VALIDACAO":
      return {
        label: "Em Validação",
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      };
    case "PENDENTE":
      return {
        label: "Pendente",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "DEVOLVIDO":
      return {
        label: "Devolvido",
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      };
    default:
      return {
        label: status,
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export const MOCK_R07_DATA: ServicoExtraRow[] = [
  // Castanhal (emp-01)
  {
    id: "se-101",
    empresaId: "emp-01",
    data: "2026-09-05",
    tipoServico: "Conserto de Pallets",
    descricao: "Substituição de tábuas quebradas e reforço em pallets padrão PBR",
    tomadorNome: "Bunge Alimentos Regional",
    quantidade: 85,
    valorUnitario: 22.00,
    total: 1870.00,
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    nfNumero: "004581",
    pipelineStatus: "CONCLUIDO",
  },
  {
    id: "se-102",
    empresaId: "emp-01",
    data: "2026-09-11",
    tipoServico: "Transbordo de Carga",
    descricao: "Transbordo emergencial de carga com avaria de assoalho em carreta baú",
    tomadorNome: "Transportadora Rápido Norte",
    quantidade: 1,
    valorUnitario: 1450.00,
    total: 1450.00,
    modalidadeFinanceira: "DUPLICATA",
    nfNumero: "004592",
    pipelineStatus: "FATURADO",
  },
  {
    id: "se-103",
    empresaId: "emp-01",
    data: "2026-09-17",
    tipoServico: "Pintura de Pallets",
    descricao: "Pintura de tocos de pallets e marcação padrão cliente com tinta epóxi",
    tomadorNome: "Amaggi Exportação e Navegação",
    quantidade: 120,
    valorUnitario: 18.00,
    total: 2160.00,
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    nfNumero: "004601",
    pipelineStatus: "APROVADO_FINANCEIRO",
  },
  {
    id: "se-104",
    empresaId: "emp-01",
    data: "2026-09-22",
    tipoServico: "Enlonamento de Carga",
    descricao: "Aplicação e amarração de lona vinílica dupla face em 3 carretas graneleiras",
    tomadorNome: "Cooperativa Agrícola Paraense",
    quantidade: 3,
    valorUnitario: 280.00,
    total: 840.00,
    modalidadeFinanceira: "DEPOSITO_IMEDIATO",
    nfNumero: "004610",
    pipelineStatus: "CONCLUIDO",
  },
  {
    id: "se-105",
    empresaId: "emp-01",
    data: "2026-09-26",
    tipoServico: "Montagem de Estrutura",
    descricao: "Montagem provisória de estrado de suporte p/ bags de farelo de soja",
    tomadorNome: "Cargill Agrícola Pará",
    quantidade: 2,
    valorUnitario: 750.00,
    total: 1500.00,
    modalidadeFinanceira: "DUPLICATA",
    nfNumero: null,
    pipelineStatus: "APROVADO_OPERACAO",
  },
  {
    id: "se-106",
    empresaId: "emp-01",
    data: "2026-09-28",
    tipoServico: "Apoio Operacional Noturno",
    descricao: "Equipe extraordinária p/ triagem e pesagem de fardos avariados",
    tomadorNome: "JBS Aves Castanhal",
    quantidade: 1,
    valorUnitario: 680.00,
    total: 680.00,
    modalidadeFinanceira: "CAIXA_IMEDIATO",
    nfNumero: null,
    pipelineStatus: "PENDENTE",
  },

  // CD Benevides (emp-02)
  {
    id: "se-201",
    empresaId: "emp-02",
    data: "2026-09-14",
    tipoServico: "Conserto de Pallets",
    descricao: "Reparo em pallets padrão duas entradas p/ estoque pulmão",
    tomadorNome: "Bunge Alimentos Regional",
    quantidade: 50,
    valorUnitario: 22.00,
    total: 1100.00,
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    nfNumero: "002140",
    pipelineStatus: "CONCLUIDO",
  },
  {
    id: "se-202",
    empresaId: "emp-02",
    data: "2026-09-23",
    tipoServico: "Transbordo de Carga",
    descricao: "Transferência de 26 pallets refrigerados entre veículos",
    tomadorNome: "Transportadora Transamazônica",
    quantidade: 1,
    valorUnitario: 1650.00,
    total: 1650.00,
    modalidadeFinanceira: "DUPLICATA",
    nfNumero: "002155",
    pipelineStatus: "FATURADO",
  },

  // Operações Belém (emp-03)
  {
    id: "se-301",
    empresaId: "emp-03",
    data: "2026-09-10",
    tipoServico: "Enlonamento de Carga",
    descricao: "Enlonamento reforçado p/ travessia de balsa fluvial",
    tomadorNome: "Exportadora Portuária Norte",
    quantidade: 5,
    valorUnitario: 300.00,
    total: 1500.00,
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    nfNumero: "009101",
    pipelineStatus: "CONCLUIDO",
  },
  {
    id: "se-302",
    empresaId: "emp-03",
    data: "2026-09-24",
    tipoServico: "Conserto de Pallets",
    descricao: "Reforma geral de pallets de madeira p/ zona de cais",
    tomadorNome: "Exportadora Portuária Norte",
    quantidade: 100,
    valorUnitario: 25.00,
    total: 2500.00,
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    nfNumero: "009120",
    pipelineStatus: "CONCLUIDO",
  },
];

