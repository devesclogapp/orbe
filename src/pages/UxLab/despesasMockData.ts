/**
 * despesasMockData.ts
 * Dataset oficial para prototipação visual da Central de Despesas & Contas a Pagar no UX Lab (UX12).
 *
 * Contratos funcionais baseados na auditoria técnica:
 * - Fluxo A: Custos Extras (PAGO_EMPRESA, REEMBOLSO_COLABORADOR, PAGAMENTO_PENDENTE / FORNECEDOR).
 * - Fluxo B: Mão de Obra (DIARISTAS, INTERMITENTES, CLT / FOLHA) representados em nível de lotes homologados.
 * - Suporte a derivadas de vencimento (VENCIDO • X dias) sem criar status persistidos arbitrários.
 * - Isolado do backend de produção.
 */

export type OrigemDespesa = "CUSTOS_EXTRAS" | "DIARISTAS" | "INTERMITENTES" | "CLT";

export type TipoDespesa =
  | "PAGO_EMPRESA"
  | "REEMBOLSO_COLABORADOR"
  | "PAGAMENTO_PENDENTE"
  | "MAO_DE_OBRA";

export type SituacaoFinanceiraUX =
  | "AGUARDANDO_LIBERACAO"
  | "A_PAGAR"
  | "PRONTA_BANCO"
  | "PAGA";

export interface HistoricoEventoDespesa {
  id: string;
  data: string;
  usuario: string;
  papel: string;
  acao: string;
  descricao: string;
}

export interface DespesaObrigacaoMock {
  id: string;
  codigo: string;
  origem: OrigemDespesa;
  tipo: TipoDespesa;
  titulo: string;
  descricao: string;
  categoria: string;
  beneficiarioNome: string;
  beneficiarioDocumento?: string;
  empresaId: string;
  empresaNome: string;
  competencia: string;
  competenciaFormatada: string;
  dataDespesa?: string;
  dataVencimento?: string | null;
  periodoReferencia?: string;
  valor: number;
  situacao: SituacaoFinanceiraUX;
  dataPagamento?: string | null;
  formaLiquidacao?: string | null;
  quantidadePessoas?: number;
  quantidadeUnidades?: string;
  comprovanteDisponivel?: boolean;
  historico: HistoricoEventoDespesa[];
}

export const DATA_REFERENCIA_SISTEMA = "2026-10-15";

/**
 * Helper para verificar se um título está vencido com base na data de referência
 */
export function calcularDiasVencimento(dataVencimento?: string | null, situacao?: SituacaoFinanceiraUX): {
  isVencido: boolean;
  diasAtraso: number;
  diasParaVencer: number;
} {
  if (!dataVencimento || situacao === "PAGA") {
    return { isVencido: false, diasAtraso: 0, diasParaVencer: 0 };
  }

  const venc = new Date(dataVencimento + "T12:00:00Z");
  const hoje = new Date(DATA_REFERENCIA_SISTEMA + "T12:00:00Z");
  const diffTime = hoje.getTime() - venc.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { isVencido: true, diasAtraso: diffDays, diasParaVencer: 0 };
  }
  return { isVencido: false, diasAtraso: 0, diasParaVencer: Math.abs(diffDays) };
}

export const MOCK_DESPESAS_OBRIGACOES: DespesaObrigacaoMock[] = [
  // ── FLUXO A: CUSTOS EXTRAS — PAGO_EMPRESA (3 registros) ──────────────────
  {
    id: "desp-001",
    codigo: "CE-2026-181",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGO_EMPRESA",
    titulo: "Combustível Operacional Frota",
    descricao: "Abastecimento dos caminhões de transferência Castanhal-Belém",
    categoria: "Combustível & Frotas",
    beneficiarioNome: "Posto Rota Norte Ltda",
    beneficiarioDocumento: "CNPJ **.412.980/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-05",
    dataVencimento: null,
    valor: 680.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-05",
    formaLiquidacao: "Cartão Corporativo Empresa",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h1",
        data: "05/10/2026 09:15",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Despesa registrada no portal operacional como PAGO_EMPRESA.",
      },
      {
        id: "h2",
        data: "05/10/2026 14:30",
        usuario: "Mariana RH",
        papel: "RH / Validação",
        acao: "Aprovação Operacional",
        descricao: "Comprovante fiscal auditado e despesa finalizada sem contas a pagar futuras.",
      },
    ],
  },
  {
    id: "desp-002",
    codigo: "CE-2026-182",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGO_EMPRESA",
    titulo: "Material de Limpeza & EPIs CD",
    descricao: "Aquisição de luvas antiderrapantes e material sanitário para docas",
    categoria: "Insumos & EPIs",
    beneficiarioNome: "Distribuidora Pará EPIs",
    beneficiarioDocumento: "CNPJ **.891.220/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-02",
    dataVencimento: null,
    valor: 1250.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-02",
    formaLiquidacao: "Desembolso Direto Caixa",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h3",
        data: "02/10/2026 11:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Cupom fiscal anexado.",
      },
      {
        id: "h4",
        data: "02/10/2026 16:00",
        usuario: "Mariana RH",
        papel: "RH / Validação",
        acao: "Aprovação",
        descricao: "Aprovado e conciliado com adiantamento operacional.",
      },
    ],
  },
  {
    id: "desp-003",
    codigo: "CE-2026-183",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGO_EMPRESA",
    titulo: "Conserto Emergencial de Paleteira",
    descricao: "Troca de retentor hidráulico e roletes da paleteira #03",
    categoria: "Manutenção Operacional",
    beneficiarioNome: "Mecânica HidroPeças",
    beneficiarioDocumento: "CNPJ **.334.112/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-09",
    dataVencimento: null,
    valor: 890.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-09",
    formaLiquidacao: "PIX Corporativo Caixa",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h5",
        data: "09/10/2026 15:20",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Serviço emergencial em doca.",
      },
      {
        id: "h6",
        data: "09/10/2026 17:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Aprovado sem pendência.",
      },
    ],
  },

  // ── FLUXO A: CUSTOS EXTRAS — REEMBOLSO_COLABORADOR (3 registros) ─────────
  {
    id: "desp-004",
    codigo: "CE-2026-184",
    origem: "CUSTOS_EXTRAS",
    tipo: "REEMBOLSO_COLABORADOR",
    titulo: "Refeição de Equipe em Horário Extraordinário",
    descricao: "Alimentação para 4 colaboradores em descarga noturna CN4C",
    categoria: "Alimentação Operacional",
    beneficiarioNome: "João M**** (Colaborador)",
    beneficiarioDocumento: "CPF ***.452.889-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-08",
    dataVencimento: null,
    valor: 420.0,
    situacao: "AGUARDANDO_LIBERACAO",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h7",
        data: "08/10/2026 23:40",
        usuario: "João M****",
        papel: "Colaborador",
        acao: "Lançamento",
        descricao: "Cupom discriminado anexado pelo operador.",
      },
      {
        id: "h8",
        data: "09/10/2026 08:30",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação Operacional",
        descricao: "Validação operacional concluída. Encaminhado para liberação financeira.",
      },
    ],
  },
  {
    id: "desp-005",
    codigo: "CE-2026-185",
    origem: "CUSTOS_EXTRAS",
    tipo: "REEMBOLSO_COLABORADOR",
    titulo: "Compra Emergencial de Filme Stretch",
    descricao: "Aquisição de 4 bobinas para paletização urgente de carga refrigerada",
    categoria: "Insumos Operacionais",
    beneficiarioNome: "Marcos S**** (Encarregado)",
    beneficiarioDocumento: "CPF ***.721.302-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-10",
    dataVencimento: null,
    valor: 310.0,
    situacao: "A_PAGAR",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h9",
        data: "10/10/2026 14:10",
        usuario: "Marcos S****",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Registro inserido com nota fiscal.",
      },
      {
        id: "h10",
        data: "11/10/2026 09:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Validado e enviado ao Financeiro.",
      },
      {
        id: "h11",
        data: "12/10/2026 11:30",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Liberação Financeira",
        descricao: "Obrigação liberada para pagamento via PIX.",
      },
    ],
  },
  {
    id: "desp-006",
    codigo: "CE-2026-186",
    origem: "CUSTOS_EXTRAS",
    tipo: "REEMBOLSO_COLABORADOR",
    titulo: "Pedágios e Taxas de Deslocamento",
    descricao: "Ressarcimento de tarifas rodoviárias em rota especial",
    categoria: "Transporte & Deslocamento",
    beneficiarioNome: "Rafael T**** (Motorista)",
    beneficiarioDocumento: "CPF ***.901.442-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-04",
    dataVencimento: null,
    valor: 180.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-06",
    formaLiquidacao: "PIX Transferência Direta",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h12",
        data: "04/10/2026 18:00",
        usuario: "Rafael T****",
        papel: "Motorista",
        acao: "Lançamento",
        descricao: "Recibos de praça de pedágio anexados.",
      },
      {
        id: "h13",
        data: "05/10/2026 10:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Validado.",
      },
      {
        id: "h14",
        data: "06/10/2026 16:45",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Pagamento Concluído",
        descricao: "Reembolso efetuado via chave PIX cadastrada.",
      },
    ],
  },

  // ── FLUXO A: CUSTOS EXTRAS — PAGAMENTO_PENDENTE / FORNECEDORES (4 registros) ─
  {
    id: "desp-007",
    codigo: "CE-2026-187",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGAMENTO_PENDENTE",
    titulo: "Locação Mensal de Empilhadeira Elétrica",
    descricao: "Fatura de locação de equipamento CD Castanhal (Outubro/26)",
    categoria: "Locação de Máquinas",
    beneficiarioNome: "LocaMáquinas Brasil Ltda",
    beneficiarioDocumento: "CNPJ **.554.120/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-01",
    dataVencimento: "2026-10-25",
    valor: 4500.0,
    situacao: "A_PAGAR",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h15",
        data: "01/10/2026 10:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Fatura de locação anexada com boleto bancário.",
      },
      {
        id: "h16",
        data: "02/10/2026 11:30",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação Operacional",
        descricao: "Validado sem ressalvas.",
      },
    ],
  },
  {
    id: "desp-008",
    codigo: "CE-2026-188",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGAMENTO_PENDENTE",
    titulo: "Fornecimento de Gás GLP Empilhadeiras P20",
    descricao: "Entrega de 8 cilindros de gás GLP para operação de movimentação",
    categoria: "Insumos & Combustível",
    beneficiarioNome: "SuperGás Industrial Castanhal",
    beneficiarioDocumento: "CNPJ **.776.321/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-10-03",
    dataVencimento: "2026-10-16",
    valor: 1840.0,
    situacao: "A_PAGAR",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h17",
        data: "03/10/2026 14:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "NF-e e boleto registrados.",
      },
      {
        id: "h18",
        data: "04/10/2026 09:15",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Aprovado para pagamento no prazo.",
      },
    ],
  },
  {
    id: "desp-009",
    codigo: "CE-2026-189",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGAMENTO_PENDENTE",
    titulo: "Manutenção Preventiva de Rede Elétrica e Transformador",
    descricao: "Inspeção e laudo técnico NR-10 nas subestações do centro de distribuição",
    categoria: "Serviços Técnicos / Manutenção",
    beneficiarioNome: "Elétrica Potência Norte Engenharia",
    beneficiarioDocumento: "CNPJ **.221.890/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-09-20",
    dataVencimento: "2026-09-28", // Vencido em relação a DATA_REFERENCIA_SISTEMA (15/10/2026)
    valor: 2750.0,
    situacao: "A_PAGAR",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h19",
        data: "20/09/2026 16:30",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Nota de serviço com retenção de impostos.",
      },
      {
        id: "h20",
        data: "22/09/2026 10:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Operação aprovada.",
      },
    ],
  },
  {
    id: "desp-010",
    codigo: "CE-2026-190",
    origem: "CUSTOS_EXTRAS",
    tipo: "PAGAMENTO_PENDENTE",
    titulo: "Aquisição de 100 Pallets Padrão PBR",
    descricao: "Reposição de pallets de madeira tratada para estocagem vertical",
    categoria: "Ativos & Embalagens",
    beneficiarioNome: "Madeireira & Pallets Castanhal",
    beneficiarioDocumento: "CNPJ **.665.433/0001-**",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    dataDespesa: "2026-09-25",
    dataVencimento: "2026-10-02",
    valor: 3850.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-02",
    formaLiquidacao: "Boleto Bancário Liquidado",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h21",
        data: "25/09/2026 11:20",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Recebimento de carga de pallets.",
      },
      {
        id: "h22",
        data: "26/09/2026 14:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Aprovação",
        descricao: "Aprovado.",
      },
      {
        id: "h23",
        data: "02/10/2026 15:30",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Pagamento Concluído",
        descricao: "Boleto pago no banco com autenticação anexada.",
      },
    ],
  },

  // ── FLUXO B: MÃO DE OBRA — DIARISTAS (2 lotes) ───────────────────────────
  {
    id: "desp-011",
    codigo: "LT-DIA-SEM40",
    origem: "DIARISTAS",
    tipo: "MAO_DE_OBRA",
    titulo: "Lote Diaristas — Semana 40 (05 a 11/10)",
    descricao: "Consolidação semanal de diárias operacionais homologadas",
    categoria: "Mão de Obra Diaristas",
    beneficiarioNome: "6 Diaristas Operacionais (Lote)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    periodoReferencia: "29/09 a 05/10/2026",
    quantidadePessoas: 6,
    quantidadeUnidades: "18 diárias apuradas",
    valor: 2160.0,
    situacao: "PRONTA_BANCO",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h24",
        data: "06/10/2026 08:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Fechamento de Ciclo",
        descricao: "Grade semanal fechada com 18 diárias registradas.",
      },
      {
        id: "h25",
        data: "06/10/2026 11:45",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Validação RH",
        descricao: "Lote conferido e validado com status VALIDADO_RH.",
      },
      {
        id: "h26",
        data: "07/10/2026 09:30",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Aprovação Financeira",
        descricao: "Lote aprovado para geração de remessa CNAB 240.",
      },
    ],
  },
  {
    id: "desp-012",
    codigo: "LT-DIA-SEM39",
    origem: "DIARISTAS",
    tipo: "MAO_DE_OBRA",
    titulo: "Lote Diaristas — Semana 39 (22 a 28/09)",
    descricao: "Diárias operacionais semanais liquidadas no banco",
    categoria: "Mão de Obra Diaristas",
    beneficiarioNome: "8 Diaristas Operacionais (Lote)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-09",
    competenciaFormatada: "Setembro / 2026",
    periodoReferencia: "22/09 a 28/09/2026",
    quantidadePessoas: 8,
    quantidadeUnidades: "28 diárias apuradas",
    valor: 3420.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-03",
    formaLiquidacao: "Retorno Bancário CNAB 240 BB (Conciliado)",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h27",
        data: "29/09/2026 08:30",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Fechamento",
        descricao: "Fechamento semanal.",
      },
      {
        id: "h28",
        data: "30/09/2026 10:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Validação RH",
        descricao: "Validado.",
      },
      {
        id: "h29",
        data: "02/10/2026 14:00",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Remessa CNAB Gerada",
        descricao: "Arquivo de remessa enviado ao Banco do Brasil.",
      },
      {
        id: "h30",
        data: "03/10/2026 17:15",
        usuario: "Retorno Bancário (Automático)",
        papel: "Sistema Bancário",
        acao: "Liquidação Bancária",
        descricao: "Retorno processado com 8 créditos confirmados com sucesso.",
      },
    ],
  },

  // ── FLUXO B: MÃO DE OBRA — INTERMITENTES (2 lotes) ───────────────────────
  {
    id: "desp-013",
    codigo: "LT-INT-2026-10-Q1",
    origem: "INTERMITENTES",
    tipo: "MAO_DE_OBRA",
    titulo: "Lote Intermitentes — 1ª Quinzena Outubro/26",
    descricao: "Jornadas e horas de trabalhadores intermitentes convocados",
    categoria: "Mão de Obra Intermitentes",
    beneficiarioNome: "5 Colaboradores Intermitentes (Lote)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    periodoReferencia: "01/10 a 15/10/2026",
    quantidadePessoas: 5,
    quantidadeUnidades: "210h apuradas",
    valor: 4850.0,
    situacao: "PRONTA_BANCO",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h31",
        data: "15/10/2026 17:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Fechamento de Ciclo",
        descricao: "Convocação quinzenal encerrada e horas consolidadas.",
      },
      {
        id: "h32",
        data: "15/10/2026 18:30",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Validação RH",
        descricao: "Apontamentos validados contra as escalas de convocação.",
      },
    ],
  },
  {
    id: "desp-014",
    codigo: "LT-INT-2026-09-Q2",
    origem: "INTERMITENTES",
    tipo: "MAO_DE_OBRA",
    titulo: "Lote Intermitentes — 2ª Quinzena Setembro/26",
    descricao: "Horas intermitentes quitadas via crédito bancário",
    categoria: "Mão de Obra Intermitentes",
    beneficiarioNome: "7 Colaboradores Intermitentes (Lote)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-09",
    competenciaFormatada: "Setembro / 2026",
    periodoReferencia: "16/09 a 30/09/2026",
    quantidadePessoas: 7,
    quantidadeUnidades: "280h apuradas",
    valor: 6300.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-05",
    formaLiquidacao: "Retorno Bancário CNAB 240 BB (Conciliado)",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h33",
        data: "01/10/2026 09:00",
        usuario: "Carlos Encarregado",
        papel: "Encarregado",
        acao: "Fechamento",
        descricao: "Fechamento quinzenal.",
      },
      {
        id: "h34",
        data: "02/10/2026 11:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Validação",
        descricao: "Validado.",
      },
      {
        id: "h35",
        data: "05/10/2026 16:30",
        usuario: "Retorno Bancário",
        papel: "Sistema Bancário",
        acao: "Liquidação",
        descricao: "Conciliação bancária 100% efetuada.",
      },
    ],
  },

  // ── FLUXO B: MÃO DE OBRA — CLT / FOLHA (2 lotes) ─────────────────────────
  {
    id: "desp-015",
    codigo: "LT-CLT-2026-10",
    origem: "CLT",
    tipo: "MAO_DE_OBRA",
    titulo: "Folha Salarial & Variável CLT — Outubro/2026",
    descricao: "Fechamento mensal de banco de horas, adicionais e folha CLT",
    categoria: "Folha CLT & Encargos",
    beneficiarioNome: "42 Colaboradores CLT (Lote Consolidado)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-10",
    competenciaFormatada: "Outubro / 2026",
    periodoReferencia: "01/10 a 31/10/2026",
    quantidadePessoas: 42,
    quantidadeUnidades: "42 colaboradores CLT",
    valor: 58000.0,
    situacao: "PRONTA_BANCO",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h36",
        data: "14/10/2026 18:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Fechamento Mensal CLT",
        descricao: "Motor RH processou eventos, banco de horas e adicionais noturnos.",
      },
      {
        id: "h37",
        data: "15/10/2026 10:30",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Aprovação Financeira",
        descricao: "Lote homologado. Pronto para emissão de remessa salarial na Central Bancária.",
      },
    ],
  },
  {
    id: "desp-016",
    codigo: "LT-CLT-2026-09",
    origem: "CLT",
    tipo: "MAO_DE_OBRA",
    titulo: "Folha Salarial & Variável CLT — Setembro/2026",
    descricao: "Folha de pagamento mensal liquidada aos colaboradores",
    categoria: "Folha CLT & Encargos",
    beneficiarioNome: "41 Colaboradores CLT (Lote)",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    competencia: "2026-09",
    competenciaFormatada: "Setembro / 2026",
    periodoReferencia: "01/09 a 30/09/2026",
    quantidadePessoas: 41,
    quantidadeUnidades: "41 colaboradores CLT",
    valor: 56700.0,
    situacao: "PAGA",
    dataPagamento: "2026-10-05",
    formaLiquidacao: "Remessa CNAB 240 Folha Salarial BB (Conciliado)",
    comprovanteDisponivel: true,
    historico: [
      {
        id: "h38",
        data: "30/09/2026 18:00",
        usuario: "Mariana RH",
        papel: "RH",
        acao: "Fechamento",
        descricao: "Folha apurada.",
      },
      {
        id: "h39",
        data: "01/10/2026 11:00",
        usuario: "Flávio Financeiro",
        papel: "Financeiro",
        acao: "Aprovação",
        descricao: "Aprovado.",
      },
      {
        id: "h40",
        data: "05/10/2026 08:30",
        usuario: "Sistema Bancário",
        papel: "CNAB Retorno",
        acao: "Conciliação Concluída",
        descricao: "41 salários creditados com sucesso.",
      },
    ],
  },
];

export interface DespesasKpiStats {
  despesasReconhecidas: number;
  despesasNoPeriodo: number;
  aPagar: number;
  prontasPagamento: number;
  prontasExecucao: number;
  prontasLiquidacaoDireta: number;
  prontasViaBanco: number;
  pagasLiquidadas: number;
  maoDeObraProntaBanco: number;
  qtdReconhecidas: number;
  qtdAPagar: number;
  qtdProntasPagamento: number;
  qtdProntasExecucao: number;
  qtdPagasLiquidadas: number;
  qtdProntasBanco: number;
}

/**
 * Cálculo determinístico dos 4 KPIs com integridade matemática formal:
 * - Despesas no Período = Obrigações e desembolsos movimentados no período financeiro
 * - A Pagar = Obrigações ativas pendentes de liquidação (não inclui PAGO_EMPRESA)
 * - Prontas para Execução = Subconjunto de A PAGAR apto para avanço (Custos Extras A_PAGAR + Mão de Obra PRONTA_BANCO)
 *   Breakdown: R$ 9.400 liquidação direta • R$ 65.010 via banco
 * - Pagas / Liquidadas = Obrigações liquidadas na competência (inclui PAGO_EMPRESA já finalizado)
 * - Mão de Obra Pronta p/ Banco = Lotes de mão de obra aptos para envio à Central Bancária
 */
export function calculateDespesasKpiStats(data: DespesaObrigacaoMock[]): DespesasKpiStats {
  let despesasNoPeriodo = 0;
  let aPagar = 0;
  let prontasLiquidacaoDireta = 0;
  let prontasViaBanco = 0;
  let pagasLiquidadas = 0;
  let maoDeObraProntaBanco = 0;

  let qtdReconhecidas = 0;
  let qtdAPagar = 0;
  let qtdProntasExecucao = 0;
  let qtdPagasLiquidadas = 0;
  let qtdProntasBanco = 0;

  for (const item of data) {
    const val = item.valor || 0;
    despesasNoPeriodo += val;
    qtdReconhecidas += 1;

    if (
      item.situacao === "AGUARDANDO_LIBERACAO" ||
      item.situacao === "A_PAGAR" ||
      item.situacao === "PRONTA_BANCO"
    ) {
      aPagar += val;
      qtdAPagar += 1;
    }

    if (item.tipo !== "MAO_DE_OBRA" && item.situacao === "A_PAGAR") {
      prontasLiquidacaoDireta += val;
      qtdProntasExecucao += 1;
    }

    if (item.tipo === "MAO_DE_OBRA" && item.situacao === "PRONTA_BANCO") {
      prontasViaBanco += val;
      qtdProntasExecucao += 1;
      maoDeObraProntaBanco += val;
      qtdProntasBanco += 1;
    }

    if (item.situacao === "PAGA") {
      pagasLiquidadas += val;
      qtdPagasLiquidadas += 1;
    }
  }

  const prontasExecucao = prontasLiquidacaoDireta + prontasViaBanco;

  return {
    despesasReconhecidas: despesasNoPeriodo,
    despesasNoPeriodo,
    aPagar,
    prontasPagamento: prontasExecucao,
    prontasExecucao,
    prontasLiquidacaoDireta,
    prontasViaBanco,
    pagasLiquidadas,
    maoDeObraProntaBanco,
    qtdReconhecidas,
    qtdAPagar,
    qtdProntasPagamento: qtdProntasExecucao,
    qtdProntasExecucao,
    qtdPagasLiquidadas,
    qtdProntasBanco,
  };
}

export function getSituacaoBadge(situacao: SituacaoFinanceiraUX, dataVencimento?: string | null): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
} {
  const { isVencido, diasAtraso } = calcularDiasVencimento(dataVencimento, situacao);

  if (isVencido && situacao !== "PAGA") {
    return {
      label: `VENCIDO • ${diasAtraso}d`,
      variant: "destructive",
      className: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-semibold",
    };
  }

  switch (situacao) {
    case "AGUARDANDO_LIBERACAO":
      return {
        label: "Aguardando Liberação",
        variant: "secondary",
        className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-medium",
      };
    case "A_PAGAR":
      return {
        label: "A Pagar",
        variant: "secondary",
        className: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-semibold",
      };
    case "PRONTA_BANCO":
      return {
        label: "Pronto p/ Banco",
        variant: "secondary",
        className: "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 font-semibold",
      };
    case "PAGA":
      return {
        label: "Paga / Liquidada",
        variant: "default",
        className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-semibold",
      };
    default:
      return {
        label: situacao,
        variant: "outline",
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

export function getOrigemLabel(origem: OrigemDespesa): string {
  switch (origem) {
    case "CUSTOS_EXTRAS":
      return "Custos Extras";
    case "DIARISTAS":
      return "Diaristas";
    case "INTERMITENTES":
      return "Intermitentes";
    case "CLT":
      return "CLT / Folha";
    default:
      return origem;
  }
}

export function getTipoLabel(tipo: TipoDespesa): string {
  switch (tipo) {
    case "PAGO_EMPRESA":
      return "Pago pela Empresa";
    case "REEMBOLSO_COLABORADOR":
      return "Reembolso";
    case "PAGAMENTO_PENDENTE":
      return "Pagamento Pendente";
    case "MAO_DE_OBRA":
      return "Mão de Obra";
    default:
      return tipo;
  }
}
