/**
 * MOCK DATASET — UX07 CUSTOS EXTRAS V2
 * 
 * Fiel aos contratos, regras e constraints auditados na Fase 01:
 * - Entidade: public.custos_extras_operacionais
 * - Categorias: OPERACIONAL | ADMINISTRATIVO | MERENDA | MANUTENCAO | TRANSPORTE | COMUNICACAO | OUTROS
 * - Origem do Recurso: PAGO_EMPRESA | REEMBOLSO_COLABORADOR | PAGAMENTO_PENDENTE | LEGACY
 * - Pipeline Status: RECEBIDO | EM_VALIDACAO | APROVADO_OPERACAO | ENVIADO_FINANCEIRO | FINALIZADO | REPROVADO
 * - Status Pagamento: A_PAGAR | PAGO | ATRASADO | CANCELADO
 * - Composição de Valor: quantidade * valor_unitario = total
 * 
 * Regras Transversais:
 * - PAGO_EMPRESA representa desembolso já realizado pela empresa (caixinha/cartão); nunca gera obrigação futura a pagar.
 * - REEMBOLSO_COLABORADOR vincula-se a colaborador e gera título A_PAGAR após aprovação.
 * - PAGAMENTO_PENDENTE vincula-se a fornecedor e data de vencimento, gerando título A_PAGAR após aprovação.
 * - Valores aprovados ficam protegidos por imutabilidade.
 */

export type CategoriaCustoExtra =
  | "OPERACIONAL"
  | "ADMINISTRATIVO"
  | "MERENDA"
  | "MANUTENCAO"
  | "TRANSPORTE"
  | "COMUNICACAO"
  | "OUTROS";

export type OrigemRecursoCustoExtra =
  | "PAGO_EMPRESA"
  | "REEMBOLSO_COLABORADOR"
  | "PAGAMENTO_PENDENTE"
  | "LEGACY";

export type PipelineStatusCustoExtra =
  | "RECEBIDO"
  | "EM_VALIDACAO"
  | "APROVADO_OPERACAO"
  | "ENVIADO_FINANCEIRO"
  | "FINALIZADO"
  | "REPROVADO";

export type StatusPagamentoCustoExtra =
  | "A_PAGAR"
  | "PAGO"
  | "ATRASADO"
  | "CANCELADO";

export interface CustoExtraMock {
  id: string;
  codigo: string; // CE-2026-XXX
  empresa_id: string;
  empresa_nome: string;
  unidade_id?: string;
  unidade_nome: string;
  data: string; // YYYY-MM-DD (fato gerador / competência)
  
  // Categorização & Descrição
  categoria_custo: CategoriaCustoExtra;
  descricao: string;
  
  // Quantitativo & Valor
  quantidade: number;
  valor_unitario: number;
  total: number; // quantidade * valor_unitario
  
  // Modelo de Liquidação & Favorecido
  origem_recurso: OrigemRecursoCustoExtra;
  forma_pagamento_nome: string;
  favorecido_colaborador_id?: string;
  favorecido_colaborador_nome?: string;
  favorecido_fornecedor_id?: string;
  favorecido_fornecedor_nome?: string;
  data_vencimento?: string | null; // YYYY-MM-DD
  
  // Governança & Estados Desacoplados
  pipeline_status: PipelineStatusCustoExtra;
  status_pagamento: StatusPagamentoCustoExtra;
  justificativa_devolucao?: string | null;
  observacao?: string | null;
  responsavel_nome: string;
  
  // Diagnóstico & Despacho
  diagnostico: {
    responsavelAtual: string;
    proximoPasso: string;
    orientacaoOperacional: string;
  };
}

export const MOCK_EMPRESAS_CUSTOS_EXTRAS = [
  { id: "todas", nome: "Todas as Empresas" },
  { id: "emp-01", nome: "ESC LOG — Matriz Castanhal" },
  { id: "emp-02", nome: "ESC LOG — CD Benevides" },
  { id: "emp-03", nome: "ESC LOG — Operações Belém" },
];

export const MOCK_CATEGORIAS_CUSTOS: { id: CategoriaCustoExtra | "todos"; nome: string }[] = [
  { id: "todos", nome: "Todas as Categorias" },
  { id: "OPERACIONAL", nome: "Operacional" },
  { id: "ADMINISTRATIVO", nome: "Administrativo" },
  { id: "MERENDA", nome: "Merenda / Lanche" },
  { id: "MANUTENCAO", nome: "Manutenção" },
  { id: "TRANSPORTE", nome: "Transporte" },
  { id: "COMUNICACAO", nome: "Comunicação" },
  { id: "OUTROS", nome: "Outros Custos" },
];

export const MOCK_ORIGEM_RECURSO_OPTIONS: { id: OrigemRecursoCustoExtra | "todos"; nome: string }[] = [
  { id: "todos", nome: "Todas as Origens" },
  { id: "PAGO_EMPRESA", nome: "Pago pela Empresa" },
  { id: "REEMBOLSO_COLABORADOR", nome: "Reembolso a Colaborador" },
  { id: "PAGAMENTO_PENDENTE", nome: "Pagamento a Fornecedor" },
  { id: "LEGACY", nome: "Registro Histórico (Legado)" },
];

export const MOCK_PIPELINE_STATUS_OPTIONS: { id: PipelineStatusCustoExtra | "todos"; nome: string }[] = [
  { id: "todos", nome: "Todos os Status de Pipeline" },
  { id: "RECEBIDO", nome: "Recebido" },
  { id: "EM_VALIDACAO", nome: "Em Validação" },
  { id: "APROVADO_OPERACAO", nome: "Aprovado Operação" },
  { id: "ENVIADO_FINANCEIRO", nome: "Enviado ao Financeiro" },
  { id: "FINALIZADO", nome: "Finalizado" },
  { id: "REPROVADO", nome: "Reprovado" },
];

export const MOCK_STATUS_PAGAMENTO_OPTIONS: { id: StatusPagamentoCustoExtra | "todos"; nome: string }[] = [
  { id: "todos", nome: "Todas as Situações de Pagamento" },
  { id: "A_PAGAR", nome: "A Pagar" },
  { id: "PAGO", nome: "Pago" },
  { id: "ATRASADO", nome: "Atrasado" },
  { id: "CANCELADO", nome: "Cancelado" },
];

/**
 * Dataset explícito cobrindo obrigatoriamente os 10 cenários auditados:
 * 1. RECEBIDO + PAGO_EMPRESA
 * 2. EM_VALIDACAO + PAGO_EMPRESA
 * 3. REPROVADO (+ justificativa_devolucao)
 * 4. APROVADO_OPERACAO + REEMBOLSO_COLABORADOR + A_PAGAR
 * 5. ENVIADO_FINANCEIRO + PAGAMENTO_PENDENTE + A_PAGAR
 * 6. Obrigação ATRASADA (PAGAMENTO_PENDENTE + ATRASADO)
 * 7. FINALIZADO + PAGO_EMPRESA + PAGO
 * 8. FINALIZADO + REEMBOLSO_COLABORADOR + PAGO
 * 9. FINALIZADO + PAGAMENTO_PENDENTE (fornecedor) + PAGO
 * 10. Registro LEGACY
 * + Cenários complementares para robustez de filtros e busca.
 */
export const CUSTOS_EXTRAS_MOCKS: CustoExtraMock[] = [
  // 1. RECEBIDO + PAGO_EMPRESA
  {
    id: "ce-mock-001",
    codigo: "CE-2026-001",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Galpão A — Pátio 2",
    data: "2026-10-03", // Hoje
    categoria_custo: "MERENDA",
    descricao: "Lanche noturno para equipe de descarga emergencial",
    quantidade: 15,
    valor_unitario: 12.00,
    total: 180.00,
    origem_recurso: "PAGO_EMPRESA",
    forma_pagamento_nome: "Dinheiro (Caixinha Filial)",
    pipeline_status: "RECEBIDO",
    status_pagamento: "PAGO", // PAGO_EMPRESA: desembolso já ocorreu, nunca A_PAGAR
    responsavel_nome: "Carlos Eduardo Silva (Encarregado)",
    observacao: "Cupom fiscal anexado na prancheta de turno. 15 kits de lanches.",
    diagnostico: {
      responsavelAtual: "Gestor Operacional / RH da Filial",
      proximoPasso: "Atestar recibo e encaminhar para validação de despesa extraordinária.",
      orientacaoOperacional: "Despesa desembolsada no ato pela empresa. Não gera passivo futuro após aprovação.",
    },
  },

  // 2. EM_VALIDACAO + PAGO_EMPRESA
  {
    id: "ce-mock-002",
    codigo: "CE-2026-002",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    unidade_nome: "Plataforma Central",
    data: "2026-10-03", // Hoje
    categoria_custo: "OPERACIONAL",
    descricao: "Combustível diesel para gerador auxiliar durante queda de energia",
    quantidade: 1,
    valor_unitario: 350.00,
    total: 350.00,
    origem_recurso: "PAGO_EMPRESA",
    forma_pagamento_nome: "Cartão Corporativo",
    pipeline_status: "EM_VALIDACAO",
    status_pagamento: "PAGO", // PAGO_EMPRESA: desembolso já ocorreu, nunca A_PAGAR
    responsavel_nome: "Roberto Mendes (Encarregado CD)",
    observacao: "Posto Ipiranga KM 14. Abastecimento emergencial para manter câmara fria.",
    diagnostico: {
      responsavelAtual: "Supervisão Operacional",
      proximoPasso: "Validar nota fiscal e homologar conclusão da despesa.",
      orientacaoOperacional: "Gasto com cartão da empresa. Conclusão da validação liquida automaticamente o registro.",
    },
  },

  // 3. REPROVADO (+ justificativa_devolucao clara)
  {
    id: "ce-mock-003",
    codigo: "CE-2026-003",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Administrativo Pátio",
    data: "2026-10-02",
    categoria_custo: "ADMINISTRATIVO",
    descricao: "Almoço com visitantes comerciais sem identificação de participantes",
    quantidade: 1,
    valor_unitario: 420.00,
    total: 420.00,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    forma_pagamento_nome: "Reembolso em Conta Corrente",
    favorecido_colaborador_id: "colab-001",
    favorecido_colaborador_nome: "Alexandre Barreto (Supervisor)",
    pipeline_status: "REPROVADO",
    status_pagamento: "A_PAGAR",
    justificativa_devolucao: "Despesa sem cupom fiscal discriminado e fora da política de refeições operacionais. Necessário apresentar recibo fiscal válido e autorização prévia da gerência.",
    responsavel_nome: "Mariana Alencar (Controladoria RH)",
    observacao: "Devolvido ao supervisor para reapresentação do comprovante adequado.",
    diagnostico: {
      responsavelAtual: "Alexandre Barreto (Supervisor Solicitante)",
      proximoPasso: "Apresentar comprovante fiscal válido ou estornar a solicitação de reembolso.",
      orientacaoOperacional: "Bloqueio impeditivo. Nenhum pagamento será programado enquanto a pendência persistir.",
    },
  },

  // 4. APROVADO_OPERACAO + REEMBOLSO_COLABORADOR + A_PAGAR
  {
    id: "ce-mock-004",
    codigo: "CE-2026-004",
    empresa_id: "emp-03",
    empresa_nome: "ESC LOG — Operações Belém",
    unidade_nome: "Doca 04",
    data: "2026-10-01",
    categoria_custo: "MANUTENCAO",
    descricao: "Compra urgente de rolos de fita de arquear e lacres no comércio local",
    quantidade: 2,
    valor_unitario: 130.00,
    total: 260.00,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    forma_pagamento_nome: "PIX Colaborador",
    favorecido_colaborador_id: "colab-002",
    favorecido_colaborador_nome: "Carlos Alberto Santos (Líder Operacional)",
    pipeline_status: "APROVADO_OPERACAO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Fernando Costa (Gerente Belém)",
    observacao: "Colaborador comprou no armarinho vizinho para não parar o carregamento da carreta 42.",
    diagnostico: {
      responsavelAtual: "Central de Pagamentos / Financeiro",
      proximoPasso: "Enviar para lote de remessa financeira de reembolso.",
      orientacaoOperacional: "Valores protegidos após aprovação. Reembolso devido ao colaborador Carlos Alberto Santos.",
    },
  },

  // 5. ENVIADO_FINANCEIRO + PAGAMENTO_PENDENTE + A_PAGAR
  {
    id: "ce-mock-005",
    codigo: "CE-2026-005",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Oficina Pátio 1",
    data: "2026-10-02",
    categoria_custo: "MANUTENCAO",
    descricao: "Manutenção preventiva e troca de rolamentos em paleteira manual PT-08",
    quantidade: 1,
    valor_unitario: 890.00,
    total: 890.00,
    origem_recurso: "PAGAMENTO_PENDENTE",
    forma_pagamento_nome: "Boleto Bancário 15 Dias",
    favorecido_fornecedor_id: "forn-001",
    favorecido_fornecedor_nome: "Hidráulica Silva & Filhos Ltda (CNPJ: 14.882.100/0001-44)",
    data_vencimento: "2026-10-17",
    pipeline_status: "ENVIADO_FINANCEIRO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Rodrigo Vasconcelos (Manutenção)",
    observacao: "Boleto enviado em anexo. Vencimento em 17/10/2026.",
    diagnostico: {
      responsavelAtual: "Contas a Pagar / Tesouraria",
      proximoPasso: "Agendar pagamento no banco e realizar baixa após conciliação.",
      orientacaoOperacional: "Obrigação financeira confirmada para o fornecedor Hidráulica Silva. Vencimento em 17/10/2026.",
    },
  },

  // 6. Obrigação ATRASADA (PAGAMENTO_PENDENTE + ATRASADO)
  {
    id: "ce-mock-006",
    codigo: "CE-2026-006",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    unidade_nome: "Galpão Principal",
    data: "2026-09-25", // Setembro
    categoria_custo: "MANUTENCAO",
    descricao: "Reparo emergencial de mangueiras hidráulicas da empilhadeira Hyster 02",
    quantidade: 1,
    valor_unitario: 1450.00,
    total: 1450.00,
    origem_recurso: "PAGAMENTO_PENDENTE",
    forma_pagamento_nome: "Boleto Bancário",
    favorecido_fornecedor_id: "forn-002",
    favorecido_fornecedor_nome: "Mecânica Pesada do Norte Eireli",
    data_vencimento: "2026-09-28", // Vencimento anterior a hoje
    pipeline_status: "ENVIADO_FINANCEIRO",
    status_pagamento: "ATRASADO",
    responsavel_nome: "Roberto Mendes (Encarregado CD)",
    observacao: "Boleto venceu no dia 28/09. Necessário reemitir com juros ou liquidar com prioridade.",
    diagnostico: {
      responsavelAtual: "Tesouraria / Gestão de Contas a Pagar",
      proximoPasso: "Contatar fornecedor para atualização de boleto e realizar liquidação imediata.",
      orientacaoOperacional: "Obrigação vencida em 28/09/2026. Prioridade crítica de pagamento.",
    },
  },

  // 7. FINALIZADO + PAGO_EMPRESA + PAGO
  {
    id: "ce-mock-007",
    codigo: "CE-2026-007",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Galpão B",
    data: "2026-10-01",
    categoria_custo: "OPERACIONAL",
    descricao: "Galões de água mineral e descartáveis para hidratação de equipe de pátio",
    quantidade: 12,
    valor_unitario: 20.00,
    total: 240.00,
    origem_recurso: "PAGO_EMPRESA",
    forma_pagamento_nome: "PIX Corporativo",
    pipeline_status: "FINALIZADO",
    status_pagamento: "PAGO",
    responsavel_nome: "Valéria Ramos (Supervisora)",
    observacao: "Comprovante arquivado. Fornecedor local de água mineral entrega semanal.",
    diagnostico: {
      responsavelAtual: "Ciclo Concluído",
      proximoPasso: "Nenhuma ação pendente. Registro consolidado no resultado operacional.",
      orientacaoOperacional: "Desembolso já ocorrido no ato pela empresa. Não gera obrigação futura.",
    },
  },

  // 8. FINALIZADO + REEMBOLSO_COLABORADOR + PAGO
  {
    id: "ce-mock-008",
    codigo: "CE-2026-008",
    empresa_id: "emp-03",
    empresa_nome: "ESC LOG — Operações Belém",
    unidade_nome: "Doca Externa",
    data: "2026-09-29",
    categoria_custo: "COMUNICACAO",
    descricao: "Recarga emergencial de plano de dados para celular de comunicação operacional",
    quantidade: 1,
    valor_unitario: 60.00,
    total: 60.00,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    forma_pagamento_nome: "PIX Reembolso",
    favorecido_colaborador_id: "colab-003",
    favorecido_colaborador_nome: "Marcos Vinícius Lima (Operador de Doca)",
    pipeline_status: "FINALIZADO",
    status_pagamento: "PAGO",
    responsavel_nome: "Fernando Costa (Gerente Belém)",
    observacao: "Reembolso efetuado via lote bancário do dia 30/09.",
    diagnostico: {
      responsavelAtual: "Ciclo Concluído",
      proximoPasso: "Reembolso liquidado e conciliado na conta do colaborador Marcos Vinícius.",
      orientacaoOperacional: "Reembolso comprovadamente pago ao colaborador. Ciclo encerrado.",
    },
  },

  // 9. FINALIZADO + PAGAMENTO_PENDENTE (fornecedor) + PAGO
  {
    id: "ce-mock-009",
    codigo: "CE-2026-009",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Pátio Principal",
    data: "2026-09-20",
    categoria_custo: "OPERACIONAL",
    descricao: "Locação extraordinária de paleteira elétrica adicional para pico de descarga",
    quantidade: 3,
    valor_unitario: 400.00,
    total: 1200.00,
    origem_recurso: "PAGAMENTO_PENDENTE",
    forma_pagamento_nome: "Transferência TED / NF 8820",
    favorecido_fornecedor_id: "forn-003",
    favorecido_fornecedor_nome: "MoveCarga Locações & Equipamentos",
    data_vencimento: "2026-09-28",
    pipeline_status: "FINALIZADO",
    status_pagamento: "PAGO",
    responsavel_nome: "Rodrigo Vasconcelos (Manutenção)",
    observacao: "NF 8820 quitada em 26/09 via conciliação bancária.",
    diagnostico: {
      responsavelAtual: "Ciclo Concluído",
      proximoPasso: "Título liquidado no financeiro e integrado na DRE de Setembro/2026.",
      orientacaoOperacional: "Pagamento ao fornecedor MoveCarga quitado com sucesso.",
    },
  },

  // 10. Registro LEGACY
  {
    id: "ce-mock-010",
    codigo: "CE-2026-010",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Pátio Geral",
    data: "2026-09-15",
    categoria_custo: "OUTROS",
    descricao: "Pequenos reparos civis no piso de manobra (migração do sistema legado)",
    quantidade: 1,
    valor_unitario: 580.00,
    total: 580.00,
    origem_recurso: "LEGACY",
    forma_pagamento_nome: "Registro Migrado",
    pipeline_status: "FINALIZADO",
    status_pagamento: "PAGO",
    responsavel_nome: "Importação Automática Legado",
    observacao: "Registro histórico migrado da base operacional anterior. Dados congelados.",
    diagnostico: {
      responsavelAtual: "Arquivo Histórico",
      proximoPasso: "Registro preservado para integridade contábil e fiscal.",
      orientacaoOperacional: "Registro histórico sem alteração de valores permitida.",
    },
  },

  // 11. Complementar: RECEBIDO + REEMBOLSO_COLABORADOR
  {
    id: "ce-mock-011",
    codigo: "CE-2026-011",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    unidade_nome: "Portaria e Balança",
    data: "2026-10-03", // Hoje
    categoria_custo: "TRANSPORTE",
    descricao: "Taxa de pedágio e estacionamento em comboio de transferência",
    quantidade: 1,
    valor_unitario: 145.00,
    total: 145.00,
    origem_recurso: "REEMBOLSO_COLABORADOR",
    forma_pagamento_nome: "Reembolso em Folha / PIX",
    favorecido_colaborador_id: "colab-004",
    favorecido_colaborador_nome: "João Paulo Batista (Motorista)",
    pipeline_status: "RECEBIDO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "João Paulo Batista (Motorista)",
    observacao: "Cupons de pedágio da rodovia PA-150 anexados.",
    diagnostico: {
      responsavelAtual: "Encarregado de Transporte / RH",
      proximoPasso: "Conferir comprovantes de pedágio e encaminhar para aprovação.",
      orientacaoOperacional: "Reembolso aguardando primeira conferência operacional.",
    },
  },

  // 12. Complementar: EM_VALIDACAO + PAGAMENTO_PENDENTE
  {
    id: "ce-mock-012",
    codigo: "CE-2026-012",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Galpão A",
    data: "2026-10-02",
    categoria_custo: "OPERACIONAL",
    descricao: "Recarga e inspeção anual de extintores de incêndio do galpão de armazenamento",
    quantidade: 1,
    valor_unitario: 680.00,
    total: 680.00,
    origem_recurso: "PAGAMENTO_PENDENTE",
    forma_pagamento_nome: "Fatura a Prazo 20 Dias",
    favorecido_fornecedor_id: "forn-004",
    favorecido_fornecedor_nome: "PrevFogo Segurança e Extintores Ltda",
    data_vencimento: "2026-10-22",
    pipeline_status: "EM_VALIDACAO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Carlos Eduardo Silva (Encarregado)",
    observacao: "Laudo técnico de conformidade dos extintores emitido pelo fornecedor.",
    diagnostico: {
      responsavelAtual: "Técnico de Segurança do Trabalho / RH",
      proximoPasso: "Validar certificado de conformidade para liberar o pagamento da fatura.",
      orientacaoOperacional: "Fatura de fornecedor pendente de aprovação técnica.",
    },
  },
];

/**
 * Helpers amigáveis para apresentação na UI (sem exibir código técnico cru)
 */
export function getFriendlyOrigemRecurso(origem: OrigemRecursoCustoExtra): string {
  switch (origem) {
    case "PAGO_EMPRESA":
      return "Pago pela Empresa";
    case "REEMBOLSO_COLABORADOR":
      return "Reembolso";
    case "PAGAMENTO_PENDENTE":
      return "Pagamento a Fornecedor";
    case "LEGACY":
      return "Registro Legado";
    default:
      return origem;
  }
}

export function getFriendlyPipelineStatus(status: PipelineStatusCustoExtra): string {
  switch (status) {
    case "RECEBIDO":
      return "Recebido";
    case "EM_VALIDACAO":
      return "Em Validação";
    case "APROVADO_OPERACAO":
      return "Aprovado Operação";
    case "ENVIADO_FINANCEIRO":
      return "Enviado ao Financeiro";
    case "FINALIZADO":
      return "Finalizado";
    case "REPROVADO":
      return "Reprovado";
    default:
      return status;
  }
}

export function getFriendlyStatusPagamento(status: StatusPagamentoCustoExtra): string {
  switch (status) {
    case "A_PAGAR":
      return "A Pagar";
    case "PAGO":
      return "Pago";
    case "ATRASADO":
      return "Atrasado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status;
  }
}

export function getFriendlyCategoria(cat: CategoriaCustoExtra): string {
  switch (cat) {
    case "OPERACIONAL":
      return "Operacional";
    case "ADMINISTRATIVO":
      return "Administrativo";
    case "MERENDA":
      return "Merenda / Lanche";
    case "MANUTENCAO":
      return "Manutenção";
    case "TRANSPORTE":
      return "Transporte";
    case "COMUNICACAO":
      return "Comunicação";
    case "OUTROS":
      return "Outros Custos";
    default:
      return cat;
  }
}

/**
 * REGRAS DE COMPOSIÇÃO DOS CARDS (fonte única: cards, navegação e testes)
 *
 * - Custos no Período: todos os registros do contexto filtrado.
 * - Requer Ação: pipeline_status em REPROVADO | EM_VALIDACAO | RECEBIDO.
 * - A Pagar / Financeiro: obrigação financeira aberta =
 *     origem_recurso ≠ PAGO_EMPRESA
 *     E status_pagamento em A_PAGAR | ATRASADO
 *     E pipeline_status em APROVADO_OPERACAO | ENVIADO_FINANCEIRO.
 * - Pagos / Liquidados: status_pagamento = PAGO (desembolso já ocorrido:
 *     PAGO_EMPRESA, ou obrigação liquidada via reembolso/fornecedor/legado).
 *
 * Os grupos representam dimensões diferentes (processo x financeiro), portanto
 * o total geral não precisa ser a soma dos demais. Combinação impossível:
 * PAGO_EMPRESA com A_PAGAR/ATRASADO.
 */
export function isRequerAcao(c: CustoExtraMock): boolean {
  return ["REPROVADO", "EM_VALIDACAO", "RECEBIDO"].includes(c.pipeline_status);
}

export function isObrigacaoAberta(c: CustoExtraMock): boolean {
  return (
    c.origem_recurso !== "PAGO_EMPRESA" &&
    (c.status_pagamento === "A_PAGAR" || c.status_pagamento === "ATRASADO") &&
    ["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(c.pipeline_status)
  );
}

export function isPagoLiquidado(c: CustoExtraMock): boolean {
  return c.status_pagamento === "PAGO";
}
