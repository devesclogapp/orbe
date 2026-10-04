// ==============================================================================
// ORBE ERP — UX11: CENTRAL DE RECEITAS & CONTAS A RECEBER
// Mock Dataset Canônico e Tipagens de Domínio (Mock Only — Sem Backend)
// ==============================================================================

export type ModalidadeReceitaReal = "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL";

export type StatusReceitaReal =
  | "aguardando_fechamento"
  | "pendente_cobranca"
  | "cobranca_gerada"
  | "cobranca_enviada"
  | "pendente_recebimento"
  | "recebido"
  | "pago"
  | "conciliado"
  | "cancelado";

export type EstagioFinanceiroUX =
  | "TODOS"
  | "A_FATURAR_FECHAR"
  | "COBRANCA_PENDENTE"
  | "A_RECEBER"
  | "RECEBIDAS";

export type OrigemReceitaReal = "Operação por Volume" | "Serviço Extra" | "Origem Mista";

export interface ReceitaItemMock {
  id: string;
  refOrigem: string; // Ex: OPV-8831, SEX-2201
  tipoOrigem: "Operação por Volume" | "Serviço Extra";
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
}

export interface ReceitaEventoHistoricoMock {
  dataHora: string; // DD/MM HH:mm
  acao: string;
  usuario: string;
  detalhes?: string;
}

export interface ReceitaOperacionalMock {
  id: string; // Ex: REC-2026-1042
  clienteNome: string;
  clienteId: string;
  modalidade: ModalidadeReceitaReal;
  origemPrincipal: OrigemReceitaReal;
  competencia: string; // YYYY-MM
  competenciaFormatada: string; // Ex: Outubro / 2026
  vencimento: string; // YYYY-MM-DD
  dataRecebimento?: string | null; // YYYY-MM-DD
  valorTotal: number;
  status: StatusReceitaReal;
  observacao?: string | null; // Ex: "FATURA_COMPLEMENTAR"
  itens: ReceitaItemMock[];
  historico: ReceitaEventoHistoricoMock[];
}

/**
 * Mapeamento Canônico: Status Persistido -> Agrupamento UX
 */
export function getEstagioUX(status: StatusReceitaReal): EstagioFinanceiroUX {
  switch (status) {
    case "aguardando_fechamento":
      return "A_FATURAR_FECHAR";
    case "pendente_cobranca":
    case "cobranca_gerada":
      return "COBRANCA_PENDENTE";
    case "cobranca_enviada":
    case "pendente_recebimento":
      return "A_RECEBER";
    case "recebido":
    case "pago":
    case "conciliado":
      return "RECEBIDAS";
    default:
      return "A_RECEBER";
  }
}

export function getEstagioUXLabel(estagio: EstagioFinanceiroUX): string {
  switch (estagio) {
    case "A_FATURAR_FECHAR":
      return "A Faturar / Fechar";
    case "COBRANCA_PENDENTE":
      return "Cobrança Pendente";
    case "A_RECEBER":
      return "A Receber";
    case "RECEBIDAS":
      return "Recebidas";
    case "TODOS":
    default:
      return "Todos";
  }
}

export function getModalidadeLabel(mod: ModalidadeReceitaReal): string {
  switch (mod) {
    case "CAIXA_IMEDIATO":
      return "Caixa Imediato";
    case "DUPLICATA":
      return "Duplicata";
    case "FATURAMENTO_MENSAL":
      return "Faturamento Mensal";
    default:
      return mod;
  }
}

export function getStatusLabel(status: StatusReceitaReal): string {
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
      return "Pendente Recebimento";
    case "recebido":
      return "Recebido";
    case "pago":
      return "Pago";
    case "conciliado":
      return "Conciliado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

/**
 * ESTADO DERIVADO: Situação de Vencimento
 * VENCIDO é uma condição derivada e NÃO altera o estágio financeiro nem o status persistido.
 * Regra: vencimento < dataCorte AND status NOT IN ('recebido', 'pago', 'conciliado', 'cancelado')
 */
export function getSituacaoVencimento(
  row: ReceitaOperacionalMock,
  dataCorte: string = "2026-10-04"
): { isVencido: boolean; diasAtraso: number; label: string } {
  const isLiquidadoOuCancelado =
    row.status === "recebido" ||
    row.status === "pago" ||
    row.status === "conciliado" ||
    row.status === "cancelado" ||
    !!row.dataRecebimento;

  if (isLiquidadoOuCancelado) {
    return { isVencido: false, diasAtraso: 0, label: "Liquidado" };
  }

  if (row.vencimento < dataCorte) {
    const dVenc = new Date(row.vencimento + "T12:00:00Z").getTime();
    const dCorte = new Date(dataCorte + "T12:00:00Z").getTime();
    const diffDays = Math.max(1, Math.round((dCorte - dVenc) / (1000 * 60 * 60 * 24)));
    return {
      isVencido: true,
      diasAtraso: diffDays,
      label: `VENCIDO • ${diffDays} dias`,
    };
  }

  return { isVencido: false, diasAtraso: 0, label: "No Prazo" };
}

// ==============================================================================
// DATASET CANÔNICO UX11 (13 REGISTROS MOCK)
//
// MATEMÁTICA ESTATÍSTICA:
// 1. Receita Reconhecida = R$ 380.000,00
// 2. A Faturar / Cobrar = R$ 96.400,00  (64.400 [A Faturar / Fechar] + 32.000 [Cobrança Pendente])
// 3. A Receber          = R$ 118.600,00 (38.200 + 46.500 + 32.050 + 1.850)
// 4. Recebido           = R$ 165.000,00 (23.000 + 57.000 + 85.000)
//    - Conciliado       = R$ 142.000,00 (57.000 + 85.000)
// SOMA: 96.400 + 118.600 + 165.000 = R$ 380.000,00
// TOTAL DE REGISTROS: 3 (Fechar) + 3 (Cobrança) + 4 (A Receber) + 3 (Recebidas) = 13 registros
// ==============================================================================

export const MOCK_RECEITAS_OPERACIONAIS: ReceitaOperacionalMock[] = [
  // --------------------------------------------------------------------------
  // GRUPO 1: A FATURAR / FECHAR (3 Registros - R$ 64.400,00)
  // --------------------------------------------------------------------------
  {
    id: "REC-2026-1040",
    clienteNome: "Rede Comercial Delta",
    clienteId: "cli-delta",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Origem Mista",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-11-30",
    valorTotal: 42800.0,
    status: "aguardando_fechamento",
    itens: [
      { id: "it-01", refOrigem: "OPV-8801", tipoOrigem: "Operação por Volume", descricao: "Descarga Noturna — 800 vol", valor: 8200.0, data: "2026-10-01" },
      { id: "it-02", refOrigem: "OPV-8805", tipoOrigem: "Operação por Volume", descricao: "Carregamento Rota Leste — 650 vol", valor: 7150.0, data: "2026-10-02" },
      { id: "it-03", refOrigem: "OPV-8809", tipoOrigem: "Operação por Volume", descricao: "Movimentação Interna — 920 vol", valor: 9400.0, data: "2026-10-02" },
      { id: "it-04", refOrigem: "OPV-8815", tipoOrigem: "Operação por Volume", descricao: "Descarga Palletizada — 700 vol", valor: 7700.0, data: "2026-10-03" },
      { id: "it-05", refOrigem: "OPV-8822", tipoOrigem: "Operação por Volume", descricao: "Carregamento Expresso — 500 vol", valor: 5500.0, data: "2026-10-04" },
      { id: "it-06", refOrigem: "SEX-2201", tipoOrigem: "Serviço Extra", descricao: "Conserto de Pallets — 45 un", valor: 2250.0, data: "2026-10-02" },
      { id: "it-07", refOrigem: "SEX-2203", tipoOrigem: "Serviço Extra", descricao: "Enlonamento Especial de Carga", valor: 2600.0, data: "2026-10-03" },
    ],
    historico: [
      { dataHora: "01/10 08:30", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita mensal aberta na 1ª operação aprovada da competência." },
      { dataHora: "03/10 18:45", acao: "VINCULAR_ITEM", usuario: "Sistema Automático", detalhes: "7 lançamentos acumulados e apurados." },
    ],
  },
  {
    id: "REC-2026-1041",
    clienteNome: "Atacadão Norte Log",
    clienteId: "cli-norte",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-11-30",
    valorTotal: 16600.0,
    status: "aguardando_fechamento",
    itens: [
      { id: "it-08", refOrigem: "OPV-8811", tipoOrigem: "Operação por Volume", descricao: "Descarga de Grãos — 450 vol", valor: 5400.0, data: "2026-10-01" },
      { id: "it-09", refOrigem: "OPV-8814", tipoOrigem: "Operação por Volume", descricao: "Transbordo de Carga — 380 vol", valor: 4800.0, data: "2026-10-02" },
      { id: "it-10", refOrigem: "OPV-8818", tipoOrigem: "Operação por Volume", descricao: "Carregamento Noturno — 520 vol", valor: 6400.0, data: "2026-10-03" },
    ],
    historico: [
      { dataHora: "01/10 09:15", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita mensal iniciada." },
    ],
  },
  {
    id: "REC-2026-1057",
    clienteNome: "Rede Comercial Delta",
    clienteId: "cli-delta",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Serviço Extra",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-11-30",
    valorTotal: 5000.0,
    status: "aguardando_fechamento",
    observacao: "FATURA_COMPLEMENTAR", // Exemplo canônico de Fatura Complementar em fechamento
    itens: [
      { id: "it-21", refOrigem: "SEX-2210", tipoOrigem: "Serviço Extra", descricao: "Serviço Extra Posterior — Transbordo Emergencial", valor: 5000.0, data: "2026-10-04" },
    ],
    historico: [
      { dataHora: "04/10 10:00", acao: "CRIAR_RECEITA_COMPLEMENTAR", usuario: "Sistema Automático", detalhes: "Fatura complementar gerada após fechamento preliminar." },
    ],
  },

  // --------------------------------------------------------------------------
  // GRUPO 2: COBRANÇA PENDENTE (3 Registros - R$ 32.000,00)
  // --------------------------------------------------------------------------
  {
    id: "REC-2026-1042",
    clienteNome: "Transportadora Alfa",
    clienteId: "cli-alfa",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-18",
    valorTotal: 12450.0,
    status: "pendente_cobranca",
    itens: [
      { id: "it-12", refOrigem: "OPV-8831", tipoOrigem: "Operação por Volume", descricao: "Descarga de Linha Branca — 950 vol", valor: 12450.0, data: "2026-10-02" },
    ],
    historico: [
      { dataHora: "02/10 14:10", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita individual criada após aprovação de OPV-8831." },
    ],
  },
  {
    id: "REC-2026-1043",
    clienteNome: "Distribuidora Express",
    clienteId: "cli-express",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-22",
    valorTotal: 14350.0,
    status: "cobranca_gerada",
    itens: [
      { id: "it-13", refOrigem: "OPV-8834", tipoOrigem: "Operação por Volume", descricao: "Carregamento Refrigerado — 1.100 vol", valor: 14350.0, data: "2026-10-02" },
    ],
    historico: [
      { dataHora: "02/10 16:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita aprovada operacionalmente." },
      { dataHora: "03/10 11:20", acao: "GERAR_COBRANCA", usuario: "Financeiro", detalhes: "Fatura Comercial PDF emitida com sucesso." },
    ],
  },
  {
    id: "REC-2026-1044",
    clienteNome: "Logística Vale do Sol",
    clienteId: "cli-valesol",
    modalidade: "DUPLICATA",
    origemPrincipal: "Serviço Extra",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-25",
    valorTotal: 5200.0,
    status: "pendente_cobranca",
    itens: [
      { id: "it-14", refOrigem: "SEX-2204", tipoOrigem: "Serviço Extra", descricao: "Pintura e Reforma de 80 Pallets PBR", valor: 5200.0, data: "2026-10-03" },
    ],
    historico: [
      { dataHora: "03/10 15:40", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita criada a partir da aprovação do Serviço Extra SEX-2204." },
    ],
  },

  // --------------------------------------------------------------------------
  // GRUPO 3: A RECEBER (4 Registros - R$ 118.600,00)
  // --------------------------------------------------------------------------
  {
    id: "REC-2026-1045",
    clienteNome: "Carga Pesada Transportes",
    clienteId: "cli-cargapesada",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-28",
    valorTotal: 38200.0,
    status: "cobranca_enviada",
    itens: [
      { id: "it-15", refOrigem: "OPV-8845", tipoOrigem: "Operação por Volume", descricao: "Descarga de Máquinas Industriais", valor: 38200.0, data: "2026-10-01" },
    ],
    historico: [
      { dataHora: "01/10 10:20", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita aprovada." },
      { dataHora: "02/10 09:30", acao: "GERAR_COBRANCA", usuario: "Financeiro", detalhes: "Fatura gerada." },
      { dataHora: "02/10 10:15", acao: "REGISTRAR_ENVIO", usuario: "Financeiro", detalhes: "Cobrança enviada por e-mail e confirmada no ORBE." },
    ],
  },
  {
    id: "REC-2026-1046",
    clienteNome: "Indústria de Alimentos Belém",
    clienteId: "cli-indbelem",
    modalidade: "FATURAMENTO_MENSAL",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-30",
    valorTotal: 46500.0,
    status: "cobranca_enviada",
    itens: [
      { id: "it-16", refOrigem: "OPV-8828", tipoOrigem: "Operação por Volume", descricao: "Lote Consolidado — 3.500 volumes apurados", valor: 46500.0, data: "2026-10-01" },
    ],
    historico: [
      { dataHora: "01/10 08:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita iniciada." },
      { dataHora: "02/10 14:00", acao: "FECHAR_COMPETENCIA", usuario: "Financeiro", detalhes: "Fechamento antecipado com aceite do cliente." },
      { dataHora: "02/10 15:30", acao: "REGISTRAR_ENVIO", usuario: "Financeiro", detalhes: "Fatura consolidada enviada ao cliente." },
    ],
  },
  {
    id: "REC-2026-1047",
    clienteNome: "Mercantil Castanhal S/A",
    clienteId: "cli-castanhal-mercantil",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-01", // Vencido em 3 dias considerando corte em 04/10
    valorTotal: 32050.0,
    status: "cobranca_enviada",
    itens: [
      { id: "it-17", refOrigem: "OPV-8812", tipoOrigem: "Operação por Volume", descricao: "Descarga de Bebidas — 2.200 vol", valor: 32050.0, data: "2026-10-01" },
    ],
    historico: [
      { dataHora: "01/10 07:30", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita gerada." },
      { dataHora: "01/10 08:45", acao: "REGISTRAR_ENVIO", usuario: "Financeiro", detalhes: "Cobrança enviada com vencimento para 01/10." },
    ],
  },
  {
    id: "REC-2026-1048",
    clienteNome: "Cliente Beta",
    clienteId: "cli-beta",
    modalidade: "CAIXA_IMEDIATO",
    origemPrincipal: "Serviço Extra",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-04",
    valorTotal: 1850.0,
    status: "pendente_recebimento",
    itens: [
      { id: "it-18", refOrigem: "SEX-2201", tipoOrigem: "Serviço Extra", descricao: "Apoio Extraordinário de Transbordo (PIX à vista)", valor: 1850.0, data: "2026-10-04" },
    ],
    historico: [
      { dataHora: "04/10 11:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita de Caixa Imediato gerada. Aguardando comprovante de PIX/dinheiro." },
    ],
  },

  // --------------------------------------------------------------------------
  // GRUPO 4: RECEBIDAS (3 Registros - R$ 165.000,00)
  // Conciliadas: 57.000 + 85.000 = R$ 142.000,00
  // --------------------------------------------------------------------------
  {
    id: "REC-2026-1049",
    clienteNome: "Frigorífico Boi Gordo",
    clienteId: "cli-boigordo",
    modalidade: "CAIXA_IMEDIATO",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-02",
    dataRecebimento: "2026-10-02",
    valorTotal: 23000.0,
    status: "recebido", // Pendente de Conciliação
    itens: [
      { id: "it-19", refOrigem: "OPV-8850", tipoOrigem: "Operação por Volume", descricao: "Descarga de Congelados — PIX Confirmado", valor: 23000.0, data: "2026-10-02" },
    ],
    historico: [
      { dataHora: "02/10 13:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita gerada." },
      { dataHora: "02/10 14:20", acao: "CONFIRMAR_RECEBIMENTO", usuario: "Financeiro / Caixa", detalhes: "PIX confirmado via comprovante Banco Cora. Pendente de conciliação bancária." },
    ],
  },
  {
    id: "REC-2026-1050",
    clienteNome: "Transportes Amazônia Ltda",
    clienteId: "cli-amazonia",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-03",
    dataRecebimento: "2026-10-03",
    valorTotal: 57000.0,
    status: "conciliado", // Conciliada na Central Bancária
    itens: [
      { id: "it-20", refOrigem: "OPV-8820", tipoOrigem: "Operação por Volume", descricao: "Operação de Escoamento Florestal — 4.200 vol", valor: 57000.0, data: "2026-10-01" },
    ],
    historico: [
      { dataHora: "01/10 12:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita gerada." },
      { dataHora: "02/10 09:00", acao: "REGISTRAR_ENVIO", usuario: "Financeiro", detalhes: "Boleto enviado." },
      { dataHora: "03/10 10:15", acao: "CONFIRMAR_RECEBIMENTO", usuario: "Financeiro", detalhes: "Compensação confirmada." },
      { dataHora: "03/10 17:30", acao: "CONCILIAR_RECEITA", usuario: "Central Bancária / Tesouraria", detalhes: "Crédito validado contra extrato bancário. Ciclo concluído." },
    ],
  },
  {
    id: "REC-2026-1051",
    clienteNome: "Mercantil Leste",
    clienteId: "cli-mercantil-leste",
    modalidade: "DUPLICATA",
    origemPrincipal: "Operação por Volume",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    vencimento: "2026-10-04",
    dataRecebimento: "2026-10-04",
    valorTotal: 85000.0,
    status: "conciliado", // Conciliada na Central Bancária
    itens: [
      { id: "it-22", refOrigem: "OPV-8825", tipoOrigem: "Operação por Volume", descricao: "Descarga de Insumos Industriais — 6.000 vol", valor: 85000.0, data: "2026-10-03" },
    ],
    historico: [
      { dataHora: "03/10 08:00", acao: "CRIAR_RECEITA", usuario: "Sistema Automático", detalhes: "Receita aprovada." },
      { dataHora: "03/10 09:30", acao: "REGISTRAR_ENVIO", usuario: "Financeiro", detalhes: "Cobrança enviada ao cliente." },
      { dataHora: "04/10 10:30", acao: "CONFIRMAR_RECEBIMENTO", usuario: "Financeiro", detalhes: "Recebimento confirmado." },
      { dataHora: "04/10 15:45", acao: "CONCILIAR_RECEITA", usuario: "Central Bancária / Tesouraria", detalhes: "Conciliado no extrato bancário." },
    ],
  },
];

/**
 * Helper Programático de Totais e Contagens Derivadas
 */
export function calculateReceitasTotais(dataset: ReceitaOperacionalMock[] = MOCK_RECEITAS_OPERACIONAIS) {
  const ativas = dataset.filter((r) => r.status !== "cancelado");

  let totalReconhecido = 0;
  let valorAFaturarFechar = 0;
  let valorCobrancaPendente = 0;
  let valorAReceber = 0;
  let valorRecebido = 0;
  let valorConciliado = 0;

  const contagensPorEstagio = {
    TODOS: ativas.length,
    A_FATURAR_FECHAR: 0,
    COBRANCA_PENDENTE: 0,
    A_RECEBER: 0,
    RECEBIDAS: 0,
  };

  const contagensPorModalidade = {
    CAIXA_IMEDIATO: 0,
    DUPLICATA: 0,
    FATURAMENTO_MENSAL: 0,
  };

  ativas.forEach((r) => {
    const val = r.valorTotal;
    totalReconhecido += val;

    const est = getEstagioUX(r.status);
    contagensPorEstagio[est] += 1;

    if (r.modalidade === "CAIXA_IMEDIATO") contagensPorModalidade.CAIXA_IMEDIATO += 1;
    if (r.modalidade === "DUPLICATA") contagensPorModalidade.DUPLICATA += 1;
    if (r.modalidade === "FATURAMENTO_MENSAL") contagensPorModalidade.FATURAMENTO_MENSAL += 1;

    if (est === "A_FATURAR_FECHAR") {
      valorAFaturarFechar += val;
    } else if (est === "COBRANCA_PENDENTE") {
      valorCobrancaPendente += val;
    } else if (est === "A_RECEBER") {
      valorAReceber += val;
    } else if (est === "RECEBIDAS") {
      valorRecebido += val;
      if (r.status === "conciliado") {
        valorConciliado += val;
      }
    }
  });

  const valorAFaturarCobrar = valorAFaturarFechar + valorCobrancaPendente;

  return {
    totalRegistros: ativas.length,
    totalReconhecido,
    valorAFaturarFechar,
    valorCobrancaPendente,
    valorAFaturarCobrar,
    valorAReceber,
    valorRecebido,
    valorConciliado,
    contagensPorEstagio,
    contagensPorModalidade,
  };
}
