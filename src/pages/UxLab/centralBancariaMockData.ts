/**
 * DATASET MOCK DETERMINÍSTICO E ISOLADO — CENTRAL BANCÁRIA & CNAB (UX LAB PROTO 1)
 *
 * Princípios Obrigatórios:
 * 1. Isolado exclusivamente no UX Lab (sem backend / sem alterar serviços reais).
 * 2. Somente origens bancarizadas: CLT, DIARISTAS, INTERMITENTES (ZERO CUSTOS EXTRAS).
 * 3. Multibanco real: Banco do Brasil (001) e Itaú Unibanco (341).
 * 4. Coerência matemática absoluta: Todos os KPIs são derivados estritamente do dataset.
 * 5. Dados bancários e pessoais rigorosamente mascarados por segurança visual.
 */

export type OrigemBancaria = "CLT" | "DIARISTAS" | "INTERMITENTES";

export type SituacaoBancaria =
  | "PRONTO_BANCO"      // Homologado, pronto para gerar remessa
  | "REMESSA_GERADA"   // Remessa criada e arquivo TXT gerado (não baixado)
  | "ARQUIVO_BAIXADO"   // Arquivo baixado pelo operador (não enviado)
  | "ENVIADO_MANUAL"    // Transmissão manual confirmada pelo operador
  | "LIQUIDADO"         // Retorno processado com sucesso pelo banco
  | "CONCILIADO"        // Baixa confirmada e lote integralmente conciliado
  | "REJEITADO"         // Rejeição bancária apontada no arquivo de retorno
  | "DIVERGENTE";       // Valor retornado difere do valor esperado

export type EstagioBancarioTab =
  | "TODAS"
  | "PRONTAS_BANCO"
  | "REMESSAS"
  | "AGUARDANDO_RETORNO"
  | "CONCILIACAO"
  | "PENDENCIAS";

export interface ContaPagadoraMock {
  id: string;
  bancoCodigo: "001" | "341";
  bancoNome: "Banco do Brasil" | "Itaú Unibanco";
  agencia: string;
  agenciaMascarada: string;
  conta: string;
  contaMascarada: string;
  convenio?: string;
  cedenteNome: string;
  cedenteCnpjMascarado: string;
  permiteCnab: boolean;
  ativo: boolean;
}

export interface ItemObrigacaoBancariaMock {
  id: string;
  referencia: string;
  origemTipo: OrigemBancaria;
  loteCodigo?: string;
  empresaId: string;
  empresaNome: string;
  competencia: string;
  favorecidoDescricao: string;
  favorecidoNomeMascarado: string;
  documentoFavorecidoMascarado: string;
  dadosBancariosFavorecidoMascarado: string;
  quantidadeFavorecidos: number;
  valorTotal: number;
  valorEsperado: number;
  valorRetornado?: number;
  diferencaValor?: number;
  contaPagadora: ContaPagadoraMock;
  situacao: SituacaoBancaria;

  // Metadados de Remessa
  remessaId?: string;
  remessaNumero?: string;
  remessaNsa?: number;
  remessaHash?: string;
  remessaDataGeracao?: string;
  remessaDataDownload?: string;
  remessaDataEnvio?: string;
  remessaNomeArquivo?: string;
  remessaQtdRegistros?: number;
  observacaoEnvio?: string;

  // Metadados de Retorno
  retornoId?: string;
  retornoData?: string;
  codigoOcorrencia?: string;
  motivoRejeicaoCodigo?: string;
  motivoRejeicaoDescricao?: string;
  impactoRejeicao?: string;
  acaoRejeicaoRecomendada?: string;

  // Conciliação Manual (para Divergentes)
  valorConciliadoManual?: number;
  justificativaConciliacao?: string;
  conciliadoEm?: string;
  conciliadoPor?: string;

  // Pré-validação de Remessa
  preValidacao: {
    contaValida: boolean;
    dadosObrigatorios: boolean;
    favorecidosAptos: boolean;
    valorConsolidado: boolean;
    inconsistencias: string[];
  };

  // Timeline de Auditoria
  timeline: Array<{
    etapa: string;
    dataHora: string;
    responsavel: string;
    descricao: string;
    status: "concluido" | "atual" | "pendente" | "erro";
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTAS PAGADORAS MOCK
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_CONTAS_PAGADORAS: Record<string, ContaPagadoraMock> = {
  "bb-matriz": {
    id: "cta-bb-01",
    bancoCodigo: "001",
    bancoNome: "Banco do Brasil",
    agencia: "3240",
    agenciaMascarada: "Ag. 3240",
    conta: "45210-8",
    contaMascarada: "Cc •••• 45210-8",
    convenio: "3129840",
    cedenteNome: "ESC LOGÍSTICA E DISTRIBUIÇÃO LTDA",
    cedenteCnpjMascarado: "08.765.432/0001-••",
    permiteCnab: true,
    ativo: true,
  },
  "itau-matriz": {
    id: "cta-itau-01",
    bancoCodigo: "341",
    bancoNome: "Itaú Unibanco",
    agencia: "0452",
    agenciaMascarada: "Ag. 0452",
    conta: "88901-4",
    contaMascarada: "Cc •••• 88901-4",
    convenio: "98745",
    cedenteNome: "ESC LOGÍSTICA E DISTRIBUIÇÃO LTDA",
    cedenteCnpjMascarado: "08.765.432/0001-••",
    permiteCnab: true,
    ativo: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DATASET PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_CENTRAL_BANCARIA_ITENS: ItemObrigacaoBancariaMock[] = [
  // ── 1. PRONTOS PARA BANCO ──────────────────────────────────────────────────
  {
    id: "OBR-PRONTO-001",
    referencia: "RH-CLT-202610",
    origemTipo: "CLT",
    loteCodigo: "LOTE-CLT-1026-MATRIZ",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "Folha CLT Oficial (24 Colaboradores)",
    favorecidoNomeMascarado: "Folha CLT Consolidada (24 Beneficiários)",
    documentoFavorecidoMascarado: "Múltiplos Favorecidos (24)",
    dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
    quantidadeFavorecidos: 24,
    valorTotal: 68450.0,
    valorEsperado: 68450.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "PRONTO_BANCO",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Fechamento RH",
        dataHora: "28/10/2026 09:30",
        responsavel: "RH Operacional",
        descricao: "Fechamento mensal de horas e variáveis concluído.",
        status: "concluido",
      },
      {
        etapa: "Aprovação Financeira",
        dataHora: "28/10/2026 14:15",
        responsavel: "Financeiro / Controladoria",
        descricao: "Obrigação aprovada no fluxo de Despesas.",
        status: "concluido",
      },
      {
        etapa: "Pronto para Remessa CNAB",
        dataHora: "29/10/2026 08:00",
        responsavel: "Central Bancária",
        descricao: "Aguardando geração do arquivo de remessa CNAB240.",
        status: "atual",
      },
    ],
  },
  {
    id: "OBR-PRONTO-002",
    referencia: "DIA-SEM43-01",
    origemTipo: "DIARISTAS",
    loteCodigo: "LOTE-DIA-SEM43-MATRIZ",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "Sem 43/2026",
    favorecidoDescricao: "Lote Semanal Diaristas (12 Colaboradores)",
    favorecidoNomeMascarado: "Grade Diaristas Sem 43 (12 Beneficiários)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (12)",
    dadosBancariosFavorecidoMascarado: "Contas PIX / Transferência BB",
    quantidadeFavorecidos: 12,
    valorTotal: 14800.0,
    valorEsperado: 14800.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "PRONTO_BANCO",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Fechamento Semanal",
        dataHora: "27/10/2026 18:00",
        responsavel: "Encarregado Operacional",
        descricao: "Grade semanal fechada e lançamentos consolidados.",
        status: "concluido",
      },
      {
        etapa: "Validação RH",
        dataHora: "28/10/2026 10:45",
        responsavel: "RH",
        descricao: "Presenças e diárias auditadas sem pendências.",
        status: "concluido",
      },
      {
        etapa: "Aprovação Financeira",
        dataHora: "28/10/2026 16:30",
        responsavel: "Financeiro",
        descricao: "Lote liberado para pagamento bancário.",
        status: "concluido",
      },
      {
        etapa: "Pronto para Remessa CNAB",
        dataHora: "29/10/2026 08:00",
        responsavel: "Central Bancária",
        descricao: "Liberado para geração de arquivo CNAB Banco do Brasil.",
        status: "atual",
      },
    ],
  },
  {
    id: "OBR-PRONTO-003",
    referencia: "INT-202610-01",
    origemTipo: "INTERMITENTES",
    loteCodigo: "LOTE-INT-1026-MATRIZ",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "Lote Intermitentes 2ª Quinzena (8 Convocados)",
    favorecidoNomeMascarado: "Intermitentes Convocados (8 Beneficiários)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (8)",
    dadosBancariosFavorecidoMascarado: "Contas Corrente Itaú",
    quantidadeFavorecidos: 8,
    valorTotal: 18250.0,
    valorEsperado: 18250.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["itau-matriz"],
    situacao: "PRONTO_BANCO",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Fechamento Operacional",
        dataHora: "26/10/2026 17:00",
        responsavel: "Encarregado Operacional",
        descricao: "Convocação e horas fechadas no portal operacional.",
        status: "concluido",
      },
      {
        etapa: "Aprovação Financeira",
        dataHora: "27/10/2026 15:20",
        responsavel: "Financeiro",
        descricao: "Aprovado na Central de Despesas.",
        status: "concluido",
      },
      {
        etapa: "Pronto para Remessa CNAB",
        dataHora: "28/10/2026 08:00",
        responsavel: "Central Bancária",
        descricao: "Pronto para geração do arquivo SISPAG Itaú.",
        status: "atual",
      },
    ],
  },

  // ── 2. EM TRÂNSITO BANCÁRIO (REMESSA_GERADA / ARQUIVO_BAIXADO / ENVIADO_MANUAL) ──
  {
    id: "OBR-TRANS-001",
    referencia: "REM-202610-001",
    origemTipo: "CLT",
    loteCodigo: "LOTE-CLT-OP-1026",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "Folha CLT Operacional (11 Colaboradores)",
    favorecidoNomeMascarado: "Folha CLT Turno Noturno (11 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (11)",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag •••• Cc •••••",
    quantidadeFavorecidos: 11,
    valorTotal: 34200.0,
    valorEsperado: 34200.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "REMESSA_GERADA",
    remessaId: "rem-bb-1041",
    remessaNumero: "REM-202610-001",
    remessaNsa: 1041,
    remessaHash: "8a4f91b7e2c04d5a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a",
    remessaDataGeracao: "29/10/2026 09:15",
    remessaNomeArquivo: "CNAB240_BB_20261029_SEQ001041.txt",
    remessaQtdRegistros: 26,
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Geração da Remessa",
        dataHora: "29/10/2026 09:15",
        responsavel: "Carlos Mendonça (Financeiro)",
        descricao: "Arquivo CNAB240 gerado com NSA 1041. Hash SHA-256 persistido.",
        status: "concluido",
      },
      {
        etapa: "Download do Arquivo",
        dataHora: "29/10/2026 09:16",
        responsavel: "Sistema",
        descricao: "Aguardando download pelo operador.",
        status: "atual",
      },
    ],
  },
  {
    id: "OBR-TRANS-002",
    referencia: "REM-202610-002",
    origemTipo: "DIARISTAS",
    loteCodigo: "LOTE-DIA-SEM42-MATRIZ",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "Sem 42/2026",
    favorecidoDescricao: "Diaristas Sem 42 (10 Colaboradores)",
    favorecidoNomeMascarado: "Diaristas Eventuais (10 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (10)",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag •••• Cc •••••",
    quantidadeFavorecidos: 10,
    valorTotal: 12600.0,
    valorEsperado: 12600.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "ARQUIVO_BAIXADO",
    remessaId: "rem-bb-1042",
    remessaNumero: "REM-202610-002",
    remessaNsa: 1042,
    remessaHash: "3f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c8a4f91b7e2c04d5a9f8e7d6c5b4a3f2e",
    remessaDataGeracao: "28/10/2026 14:20",
    remessaDataDownload: "28/10/2026 14:22",
    remessaNomeArquivo: "CNAB240_BB_20261028_SEQ001042.txt",
    remessaQtdRegistros: 24,
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Geração da Remessa",
        dataHora: "28/10/2026 14:20",
        responsavel: "Carlos Mendonça (Financeiro)",
        descricao: "Remessa gerada com NSA 1042.",
        status: "concluido",
      },
      {
        etapa: "Download do Arquivo",
        dataHora: "28/10/2026 14:22",
        responsavel: "Carlos Mendonça",
        descricao: "Arquivo baixado para envio no Internet Banking.",
        status: "concluido",
      },
      {
        etapa: "Envio ao Banco",
        dataHora: "28/10/2026 14:25",
        responsavel: "Operador Financeiro",
        descricao: "Aguardando confirmação manual de transmissão bancária.",
        status: "atual",
      },
    ],
  },
  {
    id: "OBR-TRANS-003",
    referencia: "REM-202610-003",
    origemTipo: "INTERMITENTES",
    loteCodigo: "LOTE-INT-1Q-1026",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "Intermitentes 1ª Quinzena (9 Convocados)",
    favorecidoNomeMascarado: "Intermitentes Convocação Especial (9 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (9)",
    dadosBancariosFavorecidoMascarado: "Itaú Ag •••• Cc •••••",
    quantidadeFavorecidos: 9,
    valorTotal: 22100.0,
    valorEsperado: 22100.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["itau-matriz"],
    situacao: "ENVIADO_MANUAL",
    remessaId: "rem-itau-1043",
    remessaNumero: "REM-202610-003",
    remessaNsa: 1043,
    remessaHash: "5b4a3f2e1d0c9b8a7f6e5d4c8a4f91b73f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
    remessaDataGeracao: "27/10/2026 11:10",
    remessaDataDownload: "27/10/2026 11:12",
    remessaDataEnvio: "27/10/2026 11:30",
    remessaNomeArquivo: "SISPAG_ITAU_20261027_SEQ001043.txt",
    remessaQtdRegistros: 22,
    observacaoEnvio: "Arquivo transmitido via Itaú Empresas SISPAG às 11h30 pelo operador.",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Geração da Remessa",
        dataHora: "27/10/2026 11:10",
        responsavel: "Renata Souza (Financeiro)",
        descricao: "Remessa gerada com NSA 1043.",
        status: "concluido",
      },
      {
        etapa: "Download & Envio",
        dataHora: "27/10/2026 11:30",
        responsavel: "Renata Souza",
        descricao: "Upload confirmado no Internet Banking Itaú.",
        status: "concluido",
      },
      {
        etapa: "Aguardando Retorno Bancário",
        dataHora: "28/10/2026 08:00",
        responsavel: "Banco / Retorno",
        descricao: "Aguardando importação do arquivo de retorno (.RET).",
        status: "atual",
      },
    ],
  },
  {
    id: "OBR-TRANS-004",
    referencia: "REM-202610-004",
    origemTipo: "CLT",
    loteCodigo: "LOTE-CLT-VAR-1026",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "Adicionais & Horas Extras CLT (6 Colaboradores)",
    favorecidoNomeMascarado: "Variáveis Folha CLT (6 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (6)",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag •••• Cc •••••",
    quantidadeFavorecidos: 6,
    valorTotal: 15400.0,
    valorEsperado: 15400.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "ENVIADO_MANUAL",
    remessaId: "rem-bb-1044",
    remessaNumero: "REM-202610-004",
    remessaNsa: 1044,
    remessaHash: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c8a4f91b7e2c04d5a3f8e7d6c5b4a3f2e",
    remessaDataGeracao: "27/10/2026 16:00",
    remessaDataDownload: "27/10/2026 16:05",
    remessaDataEnvio: "27/10/2026 16:45",
    remessaNomeArquivo: "CNAB240_BB_20261027_SEQ001044.txt",
    remessaQtdRegistros: 16,
    observacaoEnvio: "Transmitido via Gerenciador Financeiro BB às 16h45.",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Geração da Remessa",
        dataHora: "27/10/2026 16:00",
        responsavel: "Carlos Mendonça",
        descricao: "Remessa gerada com NSA 1044.",
        status: "concluido",
      },
      {
        etapa: "Envio Confirmado",
        dataHora: "27/10/2026 16:45",
        responsavel: "Carlos Mendonça",
        descricao: "Upload confirmado no portal do Banco do Brasil.",
        status: "concluido",
      },
      {
        etapa: "Aguardando Retorno Bancário",
        dataHora: "28/10/2026 08:00",
        responsavel: "Banco / Retorno",
        descricao: "Aguardando importação do arquivo de retorno (.RET).",
        status: "atual",
      },
    ],
  },

  // ── 3. LIQUIDADAS / CONCILIADAS NO PERÍODO ─────────────────────────────────
  {
    id: "OBR-LIQ-001",
    referencia: "LIQ-CLT-202610-01",
    origemTipo: "CLT",
    loteCodigo: "LOTE-CLT-0926-QUITADO",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-09",
    favorecidoDescricao: "Salários CLT Competência Setembro (26 Colaboradores)",
    favorecidoNomeMascarado: "Folha CLT Setembro (26 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (26)",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag •••• Cc •••••",
    quantidadeFavorecidos: 26,
    valorTotal: 74300.0,
    valorEsperado: 74300.0,
    valorRetornado: 74300.0,
    diferencaValor: 0.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "CONCILIADO",
    remessaId: "rem-bb-1038",
    remessaNumero: "REM-202609-008",
    remessaNsa: 1038,
    remessaDataGeracao: "05/10/2026 10:00",
    remessaDataEnvio: "05/10/2026 11:00",
    retornoId: "ret-bb-0926",
    retornoData: "06/10/2026 07:30",
    codigoOcorrencia: "00",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Remessa Gerada",
        dataHora: "05/10/2026 10:00",
        responsavel: "Carlos Mendonça",
        descricao: "NSA 1038 gerado com sucesso.",
        status: "concluido",
      },
      {
        etapa: "Envio ao Banco",
        dataHora: "05/10/2026 11:00",
        responsavel: "Carlos Mendonça",
        descricao: "Transmitido ao Banco do Brasil.",
        status: "concluido",
      },
      {
        etapa: "Retorno & Baixa",
        dataHora: "06/10/2026 07:30",
        responsavel: "Motor Retorno CNAB",
        descricao: "26 de 26 títulos liquidados com sucesso. Lote conciliado.",
        status: "concluido",
      },
    ],
  },
  {
    id: "OBR-LIQ-002",
    referencia: "LIQ-DIA-SEM41-01",
    origemTipo: "DIARISTAS",
    loteCodigo: "LOTE-DIA-SEM41-QUITADO",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "Sem 41/2026",
    favorecidoDescricao: "Diaristas Sem 41 (14 Colaboradores)",
    favorecidoNomeMascarado: "Diaristas Eventuais (14 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (14)",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag •••• Cc •••••",
    quantidadeFavorecidos: 14,
    valorTotal: 16500.0,
    valorEsperado: 16500.0,
    valorRetornado: 16500.0,
    diferencaValor: 0.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "LIQUIDADO",
    remessaId: "rem-bb-1039",
    remessaNumero: "REM-202610-009",
    remessaNsa: 1039,
    remessaDataGeracao: "19/10/2026 14:00",
    remessaDataEnvio: "19/10/2026 14:30",
    retornoId: "ret-bb-sem41",
    retornoData: "20/10/2026 08:15",
    codigoOcorrencia: "00",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Remessa Gerada",
        dataHora: "19/10/2026 14:00",
        responsavel: "Renata Souza",
        descricao: "NSA 1039 gerado com sucesso.",
        status: "concluido",
      },
      {
        etapa: "Retorno Processado",
        dataHora: "20/10/2026 08:15",
        responsavel: "Motor Retorno CNAB",
        descricao: "14 diaristas liquidados. Lote promovido para PAGO.",
        status: "concluido",
      },
    ],
  },
  {
    id: "OBR-LIQ-003",
    referencia: "LIQ-INT-202609-01",
    origemTipo: "INTERMITENTES",
    loteCodigo: "LOTE-INT-0926-QUITADO",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-09",
    favorecidoDescricao: "Intermitentes Convocação Setembro (10 Colaboradores)",
    favorecidoNomeMascarado: "Intermitentes Setembro (10 Favorecidos)",
    documentoFavorecidoMascarado: "Múltiplos CPFs (10)",
    dadosBancariosFavorecidoMascarado: "Itaú Ag •••• Cc •••••",
    quantidadeFavorecidos: 10,
    valorTotal: 21800.0,
    valorEsperado: 21800.0,
    valorRetornado: 21800.0,
    diferencaValor: 0.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["itau-matriz"],
    situacao: "CONCILIADO",
    remessaId: "rem-itau-1040",
    remessaNumero: "REM-202609-010",
    remessaNsa: 1040,
    remessaDataGeracao: "12/10/2026 10:30",
    remessaDataEnvio: "12/10/2026 11:15",
    retornoId: "ret-itau-0926",
    retornoData: "13/10/2026 08:00",
    codigoOcorrencia: "00",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Remessa SISPAG",
        dataHora: "12/10/2026 10:30",
        responsavel: "Renata Souza",
        descricao: "NSA 1040 emitido.",
        status: "concluido",
      },
      {
        etapa: "Retorno & Baixa",
        dataHora: "13/10/2026 08:00",
        responsavel: "Motor Retorno CNAB",
        descricao: "10 de 10 pagamentos creditados com sucesso.",
        status: "concluido",
      },
    ],
  },

  // ── 4. PENDÊNCIAS BANCÁRIAS (REJEITADOS & DIVERGENTES) ─────────────────────
  {
    id: "OBR-PEND-REJ-001",
    referencia: "REJ-DIA-202610-01",
    origemTipo: "DIARISTAS",
    loteCodigo: "LOTE-DIA-SEM42-MATRIZ",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "Sem 42/2026",
    favorecidoDescricao: "M*** A*** S*** (Diarista - Carga Noturna)",
    favorecidoNomeMascarado: "M*** A*** S*** (Diarista)",
    documentoFavorecidoMascarado: "•••.542.891-••",
    dadosBancariosFavorecidoMascarado: "Banco do Brasil Ag 3240 Cc 99881-0",
    quantidadeFavorecidos: 1,
    valorTotal: 1350.0,
    valorEsperado: 1350.0,
    valorRetornado: 0.0,
    diferencaValor: 1350.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["bb-matriz"],
    situacao: "REJEITADO",
    remessaId: "rem-bb-1042",
    remessaNumero: "REM-202610-002",
    remessaNsa: 1042,
    retornoId: "ret-bb-sem42-pend",
    retornoData: "29/10/2026 07:45",
    codigoOcorrencia: "04",
    motivoRejeicaoCodigo: "04",
    motivoRejeicaoDescricao: "Conta corrente do favorecido encerrada ou dígito verificador inválido.",
    impactoRejeicao: "Esta obrigação permanece em aberto e o lote semanal não pode ser integralmente quitado.",
    acaoRejeicaoRecomendada: "Corrigir os dados bancários do colaborador no cadastro de RH para liberação em lote futuro.",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: false,
      valorConsolidado: true,
      inconsistencias: ["Conta do favorecido rejeitada pelo banco (Código 04)."],
    },
    timeline: [
      {
        etapa: "Remessa Enviada",
        dataHora: "28/10/2026 14:20",
        responsavel: "Carlos Mendonça",
        descricao: "Item enviado na remessa NSA 1042.",
        status: "concluido",
      },
      {
        etapa: "Retorno Bancário Rejeitado",
        dataHora: "29/10/2026 07:45",
        responsavel: "Banco do Brasil",
        descricao: "Ocorrência 04: Conta de crédito inválida/encerrada.",
        status: "erro",
      },
    ],
  },
  {
    id: "OBR-PEND-REJ-002",
    referencia: "REJ-CLT-202610-02",
    origemTipo: "CLT",
    loteCodigo: "LOTE-CLT-OP-1026",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "F*** P*** R*** (Operador Empilhadeira)",
    favorecidoNomeMascarado: "F*** P*** R*** (CLT)",
    documentoFavorecidoMascarado: "•••.129.774-••",
    dadosBancariosFavorecidoMascarado: "Itaú Ag 0452 Cc 12345-6",
    quantidadeFavorecidos: 1,
    valorTotal: 3420.0,
    valorEsperado: 3420.0,
    valorRetornado: 0.0,
    diferencaValor: 3420.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["itau-matriz"],
    situacao: "REJEITADO",
    remessaId: "rem-itau-1043",
    remessaNumero: "REM-202610-003",
    remessaNsa: 1043,
    retornoId: "ret-itau-1026-pend",
    retornoData: "28/10/2026 08:30",
    codigoOcorrencia: "03",
    motivoRejeicaoCodigo: "03",
    motivoRejeicaoDescricao: "CPF do titular da conta difere do favorecido informado na remessa.",
    impactoRejeicao: "Pagamento não creditado. Salário retido aguardando retificação cadastral de titularidade.",
    acaoRejeicaoRecomendada: "Solicitar comprovante de titularidade bancária e atualizar o cadastro do colaborador no RH.",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: false,
      valorConsolidado: true,
      inconsistencias: ["Divergência de titularidade CPF vs Conta no banco de destino."],
    },
    timeline: [
      {
        etapa: "Remessa Enviada",
        dataHora: "27/10/2026 11:30",
        responsavel: "Renata Souza",
        descricao: "Item enviado na remessa NSA 1043.",
        status: "concluido",
      },
      {
        etapa: "Retorno Bancário Rejeitado",
        dataHora: "28/10/2026 08:30",
        responsavel: "Itaú Unibanco",
        descricao: "Ocorrência 03: CPF do favorecido não confere com o titular.",
        status: "erro",
      },
    ],
  },
  {
    id: "OBR-PEND-DIV-001",
    referencia: "DIV-INT-202610-01",
    origemTipo: "INTERMITENTES",
    loteCodigo: "LOTE-INT-1Q-1026",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    favorecidoDescricao: "R*** L*** B*** (Ajudante de Carga)",
    favorecidoNomeMascarado: "R*** L*** B*** (Intermitente)",
    documentoFavorecidoMascarado: "•••.882.310-••",
    dadosBancariosFavorecidoMascarado: "Itaú Ag 0452 Cc 77651-2",
    quantidadeFavorecidos: 1,
    valorTotal: 2450.0,
    valorEsperado: 2450.0,
    valorRetornado: 2435.0,
    diferencaValor: 15.0,
    contaPagadora: MOCK_CONTAS_PAGADORAS["itau-matriz"],
    situacao: "DIVERGENTE",
    remessaId: "rem-itau-1043",
    remessaNumero: "REM-202610-003",
    remessaNsa: 1043,
    retornoId: "ret-itau-1026-div",
    retornoData: "28/10/2026 08:30",
    codigoOcorrencia: "BD",
    motivoRejeicaoCodigo: "BD",
    motivoRejeicaoDescricao: "Diferença de valor liquidado pelo banco (R$ 2.435,00) em relação ao valor da remessa (R$ 2.450,00). Requer conciliação manual da tesouraria.",
    impactoRejeicao: "Diferença financeira de R$ 15,00 exige conferência e justificativa na conciliação manual.",
    acaoRejeicaoRecomendada: "Revisar conciliação informando o valor final apurado e justificativa operacional.",
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      valorConsolidado: false,
      inconsistencias: ["Divergência de valor liquidado vs esperado no retorno."],
    },
    timeline: [
      {
        etapa: "Remessa Enviada",
        dataHora: "27/10/2026 11:30",
        responsavel: "Renata Souza",
        descricao: "Remetido valor esperado de R$ 2.450,00.",
        status: "concluido",
      },
      {
        etapa: "Retorno com Divergência",
        dataHora: "28/10/2026 08:30",
        responsavel: "Motor Retorno CNAB",
        descricao: "Retorno recebido com valor liquidado de R$ 2.435,00 (diferença de R$ 15,00).",
        status: "erro",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO DERIVADA DE ESTATÍSTICAS E KPIS
// ─────────────────────────────────────────────────────────────────────────────
export interface CentralBancariaKpiStats {
  // KPI 1: Prontas para Banco
  prontasValor: number;
  prontasQtdLotes: number;

  // KPI 2: Em Trânsito Bancário
  emTransitoValor: number;
  emTransitoQtdRemessas: number;
  emTransitoBaixadasQtd: number;
  emTransitoEnviadasQtd: number;
  emTransitoGeradasQtd: number;

  // KPI 3: Liquidadas no Período
  liquidadasValor: number;
  liquidadasQtdItens: number;
  liquidadasQtdLotes: number;

  // KPI 4: Pendências Bancárias
  pendenciasValor: number;
  pendenciasQtdTotal: number;
  pendenciasRejeitadosQtd: number;
  pendenciasRejeitadosValor: number;
  pendenciasDivergentesQtd: number;
  pendenciasDivergentesValor: number;

  // Totalizador Geral
  totalRegistros: number;
  totalValorGeral: number;
}

export function calculateCentralBancariaKpiStats(
  items: ItemObrigacaoBancariaMock[]
): CentralBancariaKpiStats {
  // 1. Prontas para Banco
  const prontas = items.filter((i) => i.situacao === "PRONTO_BANCO");
  const prontasValor = prontas.reduce((acc, i) => acc + i.valorTotal, 0);
  const prontasQtdLotes = prontas.length;

  // 2. Em Trânsito Bancário
  const emTransito = items.filter((i) =>
    ["REMESSA_GERADA", "ARQUIVO_BAIXADO", "ENVIADO_MANUAL"].includes(i.situacao)
  );
  const emTransitoValor = emTransito.reduce((acc, i) => acc + i.valorTotal, 0);
  const emTransitoQtdRemessas = emTransito.length;
  const emTransitoBaixadasQtd = items.filter((i) => i.situacao === "ARQUIVO_BAIXADO").length;
  const emTransitoEnviadasQtd = items.filter((i) => i.situacao === "ENVIADO_MANUAL").length;
  const emTransitoGeradasQtd = items.filter((i) => i.situacao === "REMESSA_GERADA").length;

  // 3. Liquidadas / Conciliadas
  const liquidadas = items.filter((i) =>
    ["LIQUIDADO", "CONCILIADO"].includes(i.situacao)
  );
  const liquidadasValor = liquidadas.reduce((acc, i) => acc + (i.valorRetornado ?? i.valorTotal), 0);
  const liquidadasQtdItens = liquidadas.reduce((acc, i) => acc + i.quantidadeFavorecidos, 0);
  const liquidadasQtdLotes = liquidadas.length;

  // 4. Pendências (Rejeitados + Divergentes)
  const rejeitados = items.filter((i) => i.situacao === "REJEITADO");
  const divergentes = items.filter((i) => i.situacao === "DIVERGENTE");
  const pendenciasRejeitadosQtd = rejeitados.length;
  const pendenciasRejeitadosValor = rejeitados.reduce((acc, i) => acc + i.valorTotal, 0);
  const pendenciasDivergentesQtd = divergentes.length;
  const pendenciasDivergentesValor = divergentes.reduce((acc, i) => acc + i.valorTotal, 0);
  const pendenciasValor = pendenciasRejeitadosValor + pendenciasDivergentesValor;
  const pendenciasQtdTotal = pendenciasRejeitadosQtd + pendenciasDivergentesQtd;

  const totalRegistros = items.length;
  const totalValorGeral = items.reduce((acc, i) => acc + i.valorTotal, 0);

  return {
    prontasValor,
    prontasQtdLotes,
    emTransitoValor,
    emTransitoQtdRemessas,
    emTransitoBaixadasQtd,
    emTransitoEnviadasQtd,
    emTransitoGeradasQtd,
    liquidadasValor,
    liquidadasQtdItens,
    liquidadasQtdLotes,
    pendenciasValor,
    pendenciasQtdTotal,
    pendenciasRejeitadosQtd,
    pendenciasRejeitadosValor,
    pendenciasDivergentesQtd,
    pendenciasDivergentesValor,
    totalRegistros,
    totalValorGeral,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS VISUAIS E DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
export function getSituacaoBadge(situacao: SituacaoBancaria) {
  switch (situacao) {
    case "PRONTO_BANCO":
      return {
        label: "Pronto para Banco",
        variant: "neutral" as const,
        className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/40 font-semibold",
      };
    case "REMESSA_GERADA":
      return {
        label: "Remessa Gerada",
        variant: "info" as const,
        className: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800/40 font-semibold",
      };
    case "ARQUIVO_BAIXADO":
      return {
        label: "Arquivo Baixado",
        variant: "info" as const,
        className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40 font-semibold",
      };
    case "ENVIADO_MANUAL":
      return {
        label: "Enviado ao Banco",
        variant: "warning" as const,
        className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 font-semibold",
      };
    case "LIQUIDADO":
    case "CONCILIADO":
      return {
        label: situacao === "CONCILIADO" ? "Conciliado" : "Liquidado",
        variant: "success" as const,
        className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 font-semibold",
      };
    case "REJEITADO":
      return {
        label: "Rejeitado pelo Banco",
        variant: "critical" as const,
        className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/40 font-bold",
      };
    case "DIVERGENTE":
      return {
        label: "Divergente",
        variant: "warning" as const,
        className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800/50 font-bold",
      };
  }
}

export function getOrigemBadge(origem: OrigemBancaria) {
  switch (origem) {
    case "CLT":
      return {
        label: "CLT",
        className: "bg-muted/70 text-muted-foreground border-border/80 font-medium",
      };
    case "DIARISTAS":
      return {
        label: "DIARISTAS",
        className: "bg-muted/70 text-muted-foreground border-border/80 font-medium",
      };
    case "INTERMITENTES":
      return {
        label: "INTERMITENTES",
        className: "bg-muted/70 text-muted-foreground border-border/80 font-medium",
      };
  }
}

// Aliases para compatibilidade total
export const MOCK_CENTRAL_BANCARIA = MOCK_CENTRAL_BANCARIA_ITENS;
export type CentralBancariaItemMock = ItemObrigacaoBancariaMock;
export type SituacaoBancariaUX = SituacaoBancaria;
export const getSituacaoBancariaBadge = getSituacaoBadge;
export const getOrigemBancariaBadge = getOrigemBadge;
export const mascararConta = (conta: string) => `•••• ${conta.slice(-5)}`;

