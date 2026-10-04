// UX LAB — MOCK DATA PARA OPERAÇÕES POR VOLUME V2 (PROTÓTIPO 1)
// Dados simulados estritamente compatíveis com os contratos auditados na Fase 01 & 01.1

export type OperationalStatus =
  | "RECEBIDO"
  | "EM_VALIDACAO"
  | "EM_RESTRICAO"
  | "AGUARDANDO_FATURAMENTO"
  | "FATURADO"
  | "RECEBIDO_FINANCEIRO"
  | "CONCLUIDO";

export type RhStatus =
  | "PENDENTE_RH"
  | "EM_ANALISE_RH"
  | "VALIDADO_RH"
  | "DEVOLVIDO_RH";

export type ModalidadeFinanceira =
  | "FATURAMENTO_MENSAL"
  | "DUPLICATA"
  | "CAIXA_IMEDIATO";

export interface ColaboradorVinculadoMock {
  id: string;
  nome: string;
  cargo: string;
  cpf: string;
  entrada_ponto: string | null;
  saida_ponto: string | null;
  had_infraction: boolean;
  infraction_notes?: string | null;
}

export interface MaterialConsumidoMock {
  id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  valor_unitario_snapshot: number;
  valor_total: number;
}

export interface OperacaoVolumeMock {
  id: string;
  codigo: string;
  empresa_id: string;
  empresa_nome: string;
  unidade_id: string;
  unidade_nome: string;
  data_operacao: string; // YYYY-MM-DD
  tipo_servico_id: string;
  tipo_servico_nome: string;
  transportadora_id: string;
  transportadora_nome: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  produto_carga_id?: string;
  produto_carga_nome?: string;
  placa: string;
  ctrc?: string;
  nf_numero_raw: string; // "SIM", "NÃO", "89211", etc.
  
  // Equipe (Headcount declarado vs vinculados - conceitos distintos comprovados)
  quantidade_colaboradores: number;
  colaboradores_vinculados: ColaboradorVinculadoMock[];
  
  // Horários in loco
  entrada_ponto: string | null;
  saida_ponto: string | null;
  
  // Preços e Composição
  tipo_calculo_snapshot: "volume" | "fixo" | "colaborador";
  quantidade: number;
  unidade_medida: string;
  valor_unitario_snapshot: number;
  regra_comercial_aplicada?: string;
  valor_descarga: number;
  percentual_iss: number;
  custo_com_iss: number;
  valor_total_materiais: number;
  valor_total: number;
  materiais: MaterialConsumidoMock[];
  
  // Status & Governança
  status: OperationalStatus;
  status_rh: RhStatus;
  status_pagamento: "PENDENTE" | "RECEBIDO";
  data_pagamento?: string | null;
  forma_pagamento_nome: string;
  modalidade: ModalidadeFinanceira;
  fatura_referencia?: string; // Para Faturamento Mensal (ex: "FAT-2026-09-BENEV") ou Duplicata
  
  // Diagnóstico & Restrições
  motivo_restricao?: string | null;
  responsavel_pendencia?: "Operação" | "RH" | "Financeiro" | "Fornecedor";
  motivo_devolucao_rh?: string | null;
  observacoes?: string;
  responsavel_nome: string;
  atualizado_em: string;
}

export const OPERACOES_VOLUME_MOCKS: OperacaoVolumeMock[] = [
  // CENÁRIO A: Operação recém-lançada (RECEBIDO / PENDENTE_RH)
  {
    id: "op-mock-001",
    codigo: "OP-8821",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 04",
    data_operacao: "2026-10-03",
    tipo_servico_id: "srv-desc-pal",
    tipo_servico_nome: "Descarga Paletizada",
    transportadora_id: "transp-jamef",
    transportadora_nome: "Jamef Encomendas",
    fornecedor_id: "forn-ambev",
    fornecedor_nome: "Ambev S/A",
    produto_carga_id: "prod-bebidas",
    produto_carga_nome: "Cervejas e Bebidas Refrigeradas",
    placa: "BRA-2E19",
    ctrc: "CTRC-104921",
    nf_numero_raw: "89211",
    quantidade_colaboradores: 4,
    colaboradores_vinculados: [
      { id: "col-01", nome: "José Carlos Alcantara", cargo: "Ajudante Operacional", cpf: "332.***.***-11", entrada_ponto: "07:45", saida_ponto: "12:15", had_infraction: false },
      { id: "col-02", nome: "Marcos Vinicius de Souza", cargo: "Ajudante Operacional", cpf: "441.***.***-22", entrada_ponto: "07:45", saida_ponto: "12:15", had_infraction: false },
      { id: "col-03", nome: "Tiago Ribeiro Santos", cargo: "Operador de Empilhadeira", cpf: "512.***.***-33", entrada_ponto: "07:40", saida_ponto: "12:15", had_infraction: false },
      { id: "col-04", nome: "Lucas Mendes da Silva", cargo: "Conferente de Carga", cpf: "219.***.***-44", entrada_ponto: "07:40", saida_ponto: "12:20", had_infraction: false },
    ],
    entrada_ponto: "07:45",
    saida_ponto: "12:15",
    tipo_calculo_snapshot: "volume",
    quantidade: 1850,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.42,
    regra_comercial_aplicada: "Tabela Padrão Ambev SP (Score 60)",
    valor_descarga: 777.00,
    percentual_iss: 0.05,
    custo_com_iss: 38.85,
    valor_total_materiais: 45.00,
    valor_total: 860.85,
    materiais: [
      { id: "mat-01", nome_snapshot: "Filme Stretch 500x25", unidade_snapshot: "bobina", quantidade: 1, valor_unitario_snapshot: 45.00, valor_total: 45.00 }
    ],
    status: "RECEBIDO",
    status_rh: "PENDENTE_RH",
    status_pagamento: "PENDENTE",
    forma_pagamento_nome: "Faturamento Mensal 30d",
    modalidade: "FATURAMENTO_MENSAL",
    fatura_referencia: "Fatura Mensal Out/2026 (Em aberto)",
    responsavel_nome: "Claudio Encarregado",
    atualizado_em: "2026-10-03T12:30:00Z"
  },

  // CENÁRIO B: Em validação (EM_VALIDACAO / PENDENTE_RH)
  {
    id: "op-mock-002",
    codigo: "OP-8820",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 02",
    data_operacao: "2026-10-03",
    tipo_servico_id: "srv-desc-granel",
    tipo_servico_nome: "Descarga Granel com Triagem",
    transportadora_id: "transp-braspress",
    transportadora_nome: "Braspress Transportes",
    fornecedor_id: "forn-nestle",
    fornecedor_nome: "Nestlé Brasil Ltda",
    produto_carga_id: "prod-choc",
    produto_carga_nome: "Confeitos e Chocolates",
    placa: "RTE-4E21",
    ctrc: "CTRC-104880",
    nf_numero_raw: "91402",
    quantidade_colaboradores: 3,
    colaboradores_vinculados: [
      { id: "col-05", nome: "Danilo Pereira", cargo: "Ajudante Operacional", cpf: "109.***.***-55", entrada_ponto: "06:00", saida_ponto: "11:00", had_infraction: false },
      { id: "col-06", nome: "Rafael Antunes", cargo: "Ajudante Operacional", cpf: "882.***.***-66", entrada_ponto: "06:00", saida_ponto: "11:00", had_infraction: false },
      { id: "col-07", nome: "Gilberto Lemos", cargo: "Conferente", cpf: "710.***.***-77", entrada_ponto: "06:00", saida_ponto: "11:15", had_infraction: false },
    ],
    entrada_ponto: "06:00",
    saida_ponto: "11:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 3200,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.38,
    regra_comercial_aplicada: "Tabela Especial Nestlé Doca SP (Score 62)",
    valor_descarga: 1216.00,
    percentual_iss: 0.05,
    custo_com_iss: 60.80,
    valor_total_materiais: 0,
    valor_total: 1276.80,
    materiais: [],
    status: "EM_VALIDACAO",
    status_rh: "PENDENTE_RH",
    status_pagamento: "PENDENTE",
    forma_pagamento_nome: "Faturamento Mensal 30d",
    modalidade: "FATURAMENTO_MENSAL",
    fatura_referencia: "Fatura Mensal Out/2026 (Em aberto)",
    responsavel_nome: "Fernanda Supervisora",
    atualizado_em: "2026-10-03T11:45:00Z"
  },

  // CENÁRIO C: Em restrição (EM_RESTRICAO / DEVOLVIDO_RH — Horário de saída ausente e alerta do RH)
  {
    id: "op-mock-003",
    codigo: "OP-8819",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-02",
    unidade_nome: "Filial Campinas - Doca 01",
    data_operacao: "2026-10-02",
    tipo_servico_id: "srv-desc-pal",
    tipo_servico_nome: "Descarga Paletizada",
    transportadora_id: "transp-rodonaves",
    transportadora_nome: "Rodonaves Transportes",
    fornecedor_id: "forn-mondelez",
    fornecedor_nome: "Mondelez Brasil",
    produto_carga_id: "prod-biscoito",
    produto_carga_nome: "Biscoitos e Snacks",
    placa: "QWE-8821",
    nf_numero_raw: "SIM", // Polimórfico: emissão solicitada, número ainda não preenchido
    quantidade_colaboradores: 2,
    colaboradores_vinculados: [
      { id: "col-08", nome: "Fernando Gomes", cargo: "Ajudante Operacional", cpf: "312.***.***-88", entrada_ponto: "08:10", saida_ponto: null, had_infraction: false },
      { id: "col-09", nome: "Carlos Henrique", cargo: "Ajudante Operacional", cpf: "449.***.***-99", entrada_ponto: "08:10", saida_ponto: null, had_infraction: false },
    ],
    entrada_ponto: "08:10",
    saida_ponto: null, // RESTRIÇÃO!
    tipo_calculo_snapshot: "volume",
    quantidade: 1400,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.45,
    regra_comercial_aplicada: "Tabela Geral Mondelez Campinas (Score 58)",
    valor_descarga: 630.00,
    percentual_iss: 0.05,
    custo_com_iss: 31.50,
    valor_total_materiais: 0,
    valor_total: 661.50,
    materiais: [],
    status: "EM_RESTRICAO",
    status_rh: "DEVOLVIDO_RH",
    status_pagamento: "PENDENTE",
    forma_pagamento_nome: "Boleto Faturado 15d",
    modalidade: "DUPLICATA",
    motivo_restricao: "Horário de término in loco não informado pelo encarregado",
    responsavel_pendencia: "Operação",
    motivo_devolucao_rh: "Apontamento diverge da catraca do coletor. Encarregado deve retificar horário de encerramento.",
    responsavel_nome: "Claudio Encarregado",
    atualizado_em: "2026-10-02T19:10:00Z"
  },

  // CENÁRIO D: Aguardando faturamento (AGUARDANDO_FATURAMENTO / VALIDADO_RH)
  {
    id: "op-mock-004",
    codigo: "OP-8818",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 08",
    data_operacao: "2026-10-02",
    tipo_servico_id: "srv-paletizacao",
    tipo_servico_nome: "Paletização e Aplicação de Filme",
    transportadora_id: "transp-patrus",
    transportadora_nome: "Patrus Transportes",
    fornecedor_id: "forn-coca",
    fornecedor_nome: "Coca-Cola Femsa",
    produto_carga_id: "prod-refr",
    produto_carga_nome: "Refrigerantes e Sucos",
    placa: "FGH-9102",
    ctrc: "CTRC-104712",
    nf_numero_raw: "78104",
    quantidade_colaboradores: 4,
    colaboradores_vinculados: [
      { id: "col-10", nome: "Paulo Sergio Reis", cargo: "Ajudante", cpf: "661.***.***-00", entrada_ponto: "13:00", saida_ponto: "18:00", had_infraction: false },
      { id: "col-11", nome: "Bruno de Oliveira", cargo: "Ajudante", cpf: "772.***.***-11", entrada_ponto: "13:00", saida_ponto: "18:00", had_infraction: false },
      { id: "col-12", nome: "Marcelo Dias", cargo: "Operador de Paleteira", cpf: "883.***.***-22", entrada_ponto: "13:00", saida_ponto: "18:00", had_infraction: false },
      { id: "col-13", nome: "Vitor Hugo", cargo: "Conferente", cpf: "994.***.***-33", entrada_ponto: "13:00", saida_ponto: "18:10", had_infraction: false },
    ],
    entrada_ponto: "13:00",
    saida_ponto: "18:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 48,
    unidade_medida: "paletes",
    valor_unitario_snapshot: 14.50,
    regra_comercial_aplicada: "Tabela Coca-Cola Palete Fechado (Score 62)",
    valor_descarga: 696.00,
    percentual_iss: 0.05,
    custo_com_iss: 34.80,
    valor_total_materiais: 90.00,
    valor_total: 820.80,
    materiais: [
      { id: "mat-02", nome_snapshot: "Filme Stretch Alta Resistência", unidade_snapshot: "bobina", quantidade: 2, valor_unitario_snapshot: 45.00, valor_total: 90.00 }
    ],
    status: "AGUARDANDO_FATURAMENTO",
    status_rh: "VALIDADO_RH",
    status_pagamento: "PENDENTE",
    forma_pagamento_nome: "Faturamento Mensal 30d",
    modalidade: "FATURAMENTO_MENSAL",
    fatura_referencia: "Fatura Mensal Out/2026 (Em aberto)",
    responsavel_nome: "Fernanda Supervisora",
    atualizado_em: "2026-10-02T18:30:00Z"
  },

  // CENÁRIO E: Faturada com RH pendente (FATURADO / PENDENTE_RH — Assimetria Comprovada)
  {
    id: "op-mock-005",
    codigo: "OP-8815",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 05",
    data_operacao: "2026-09-29",
    tipo_servico_id: "srv-desc-pal",
    tipo_servico_nome: "Descarga Paletizada",
    transportadora_id: "transp-jamef",
    transportadora_nome: "Jamef Encomendas",
    fornecedor_id: "forn-ambev",
    fornecedor_nome: "Ambev S/A",
    placa: "XYZ-1122",
    ctrc: "CTRC-103980",
    nf_numero_raw: "88901",
    quantidade_colaboradores: 3,
    colaboradores_vinculados: [
      { id: "col-14", nome: "Alexandre Pires", cargo: "Ajudante", cpf: "123.***.***-44", entrada_ponto: "07:30", saida_ponto: "12:00", had_infraction: false },
      { id: "col-15", nome: "Caio Junqueira", cargo: "Ajudante", cpf: "234.***.***-55", entrada_ponto: "07:30", saida_ponto: "12:00", had_infraction: false },
      { id: "col-16", nome: "Leandro Costa", cargo: "Conferente", cpf: "345.***.***-66", entrada_ponto: "07:30", saida_ponto: "12:10", had_infraction: false },
    ],
    entrada_ponto: "07:30",
    saida_ponto: "12:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 2100,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.42,
    regra_comercial_aplicada: "Tabela Padrão Ambev SP",
    valor_descarga: 882.00,
    percentual_iss: 0.05,
    custo_com_iss: 44.10,
    valor_total_materiais: 0,
    valor_total: 926.10,
    materiais: [],
    status: "FATURADO",
    status_rh: "PENDENTE_RH", // Pipeline financeiro avançou, mas RH ainda não fechou apuração
    status_pagamento: "PENDENTE",
    forma_pagamento_nome: "Faturamento Mensal 30d",
    modalidade: "FATURAMENTO_MENSAL",
    fatura_referencia: "FAT-2026-09-BENEV (Consolidada Set/26)",
    responsavel_nome: "Claudio Encarregado",
    atualizado_em: "2026-09-30T17:00:00Z"
  },

  // CENÁRIO F: Recebida/regular com RH pendente (RECEBIDO_FINANCEIRO / PENDENTE_RH — Assimetria de Conclusão)
  {
    id: "op-mock-006",
    codigo: "OP-8810",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 01",
    data_operacao: "2026-09-25",
    tipo_servico_id: "srv-desc-granel",
    tipo_servico_nome: "Descarga Granel com Triagem",
    transportadora_id: "transp-braspress",
    transportadora_nome: "Braspress Transportes",
    fornecedor_id: "forn-nestle",
    fornecedor_nome: "Nestlé Brasil Ltda",
    placa: "KJH-5509",
    ctrc: "CTRC-103500",
    nf_numero_raw: "87410",
    quantidade_colaboradores: 4,
    // Headcount declarado = 4, mas vinculados = 2 (comprovando que não deve quebrar nem ser marcado como erro)
    colaboradores_vinculados: [
      { id: "col-17", nome: "Marcos Vinicius de Souza", cargo: "Ajudante", cpf: "441.***.***-22", entrada_ponto: "08:00", saida_ponto: "14:00", had_infraction: false },
      { id: "col-18", nome: "José Carlos Alcantara", cargo: "Ajudante", cpf: "332.***.***-11", entrada_ponto: "08:00", saida_ponto: "14:00", had_infraction: false },
    ],
    entrada_ponto: "08:00",
    saida_ponto: "14:00",
    tipo_calculo_snapshot: "volume",
    quantidade: 2800,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.38,
    regra_comercial_aplicada: "Tabela Especial Nestlé Doca SP",
    valor_descarga: 1064.00,
    percentual_iss: 0.05,
    custo_com_iss: 53.20,
    valor_total_materiais: 0,
    valor_total: 1117.20,
    materiais: [],
    status: "RECEBIDO_FINANCEIRO",
    status_rh: "PENDENTE_RH", // Pagamento liquidado, mas ainda retido de CONCLUIDO pois RH não validou
    status_pagamento: "RECEBIDO",
    data_pagamento: "2026-10-01",
    forma_pagamento_nome: "PIX À Vista",
    modalidade: "CAIXA_IMEDIATO",
    fatura_referencia: "REC-PIX-8810",
    responsavel_nome: "Claudio Encarregado",
    atualizado_em: "2026-10-01T15:20:00Z"
  },

  // CENÁRIO G: Concluída (CONCLUIDO / VALIDADO_RH — Ciclo Integralmente Finalizado)
  {
    id: "op-mock-007",
    codigo: "OP-8801",
    empresa_id: "emp-benevides",
    empresa_nome: "Benevides Participações",
    unidade_id: "un-sp-01",
    unidade_nome: "CD São Paulo - Doca 03",
    data_operacao: "2026-09-20",
    tipo_servico_id: "srv-desc-pal",
    tipo_servico_nome: "Descarga Paletizada",
    transportadora_id: "transp-jamef",
    transportadora_nome: "Jamef Encomendas",
    fornecedor_id: "forn-ambev",
    fornecedor_nome: "Ambev S/A",
    placa: "KOL-9921",
    ctrc: "CTRC-102910",
    nf_numero_raw: "86199",
    quantidade_colaboradores: 3,
    colaboradores_vinculados: [
      { id: "col-19", nome: "Tiago Ribeiro Santos", cargo: "Operador", cpf: "512.***.***-33", entrada_ponto: "08:00", saida_ponto: "12:30", had_infraction: false },
      { id: "col-20", nome: "Lucas Mendes da Silva", cargo: "Conferente", cpf: "219.***.***-44", entrada_ponto: "08:00", saida_ponto: "12:30", had_infraction: false },
      { id: "col-21", nome: "José Carlos Alcantara", cargo: "Ajudante", cpf: "332.***.***-11", entrada_ponto: "08:00", saida_ponto: "12:30", had_infraction: false },
    ],
    entrada_ponto: "08:00",
    saida_ponto: "12:30",
    tipo_calculo_snapshot: "volume",
    quantidade: 1950,
    unidade_medida: "cx",
    valor_unitario_snapshot: 0.42,
    regra_comercial_aplicada: "Tabela Padrão Ambev SP",
    valor_descarga: 819.00,
    percentual_iss: 0.05,
    custo_com_iss: 40.95,
    valor_total_materiais: 0,
    valor_total: 859.95,
    materiais: [],
    status: "CONCLUIDO",
    status_rh: "VALIDADO_RH",
    status_pagamento: "RECEBIDO",
    data_pagamento: "2026-09-30",
    forma_pagamento_nome: "Faturamento Mensal 30d",
    modalidade: "FATURAMENTO_MENSAL",
    fatura_referencia: "FAT-2026-09-BENEV (Liquidada)",
    responsavel_nome: "Fernanda Supervisora",
    atualizado_em: "2026-09-30T18:00:00Z"
  }
];

export const MOCK_EMPRESAS = [
  { id: "todas", nome: "Todas as Empresas" },
  { id: "emp-benevides", nome: "Benevides Participações" },
  { id: "emp-ambev", nome: "Ambev Distribuição Logística" },
  { id: "emp-log-sp", nome: "Log Express São Paulo" }
];

export const MOCK_SERVICOS = [
  { id: "todos", nome: "Todos os Serviços" },
  { id: "srv-desc-pal", nome: "Descarga Paletizada" },
  { id: "srv-desc-granel", nome: "Descarga Granel com Triagem" },
  { id: "srv-paletizacao", nome: "Paletização e Aplicação de Filme" }
];

export const MOCK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "todos", label: "Todos os Status Operacionais" },
  { value: "RECEBIDO", label: "Recebido (Aberto)" },
  { value: "EM_VALIDACAO", label: "Em Validação" },
  { value: "EM_RESTRICAO", label: "Em Restrição" },
  { value: "AGUARDANDO_FATURAMENTO", label: "Aguardando Faturamento" },
  { value: "FATURADO", label: "Faturado" },
  { value: "RECEBIDO_FINANCEIRO", label: "Recebido no Financeiro" },
  { value: "CONCLUIDO", label: "Concluído" }
];

export const MOCK_STATUS_RH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "todos", label: "Todos os Status RH" },
  { value: "PENDENTE_RH", label: "Pendente RH" },
  { value: "EM_ANALISE_RH", label: "Em Análise RH" },
  { value: "VALIDADO_RH", label: "Validado RH" },
  { value: "DEVOLVIDO_RH", label: "Devolvido RH" }
];
