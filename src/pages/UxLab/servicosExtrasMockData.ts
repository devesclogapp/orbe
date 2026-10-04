/**
 * MOCK DATASET — UX06 SERVIÇOS EXTRAS V2
 * 
 * Fiel aos contratos e constraints auditados na Fase 01:
 * - Entidade: public.servicos_extras_operacionais
 * - Headcount: quantidade_colaboradores INTEGER (estritamente número de pessoas, sem equipe nominal/CPFs)
 * - Pipeline Status: PENDENTE | EM_VALIDACAO | APROVADO_OPERACAO | APROVADO_FINANCEIRO | FATURADO | CONCLUIDO | DEVOLVIDO
 * - Modalidades: CAIXA_IMEDIATO | DUPLICATA | FATURAMENTO_MENSAL
 * - Composição de Valor: (quantidade * valor_unitario_efetivo) + custo_materiais
 */

export type PipelineStatusServicoExtra =
  | "PENDENTE"
  | "EM_VALIDACAO"
  | "APROVADO_OPERACAO"
  | "APROVADO_FINANCEIRO"
  | "FATURADO"
  | "CONCLUIDO"
  | "DEVOLVIDO";

export type ModalidadeFinanceiraServicoExtra =
  | "CAIXA_IMEDIATO"
  | "DUPLICATA"
  | "FATURAMENTO_MENSAL";

export type StatusPagamentoServicoExtra =
  | "PENDENTE"
  | "RECEBIDO"
  | "ATRASADO";

export interface MaterialConsumidoMock {
  material_id: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  valor_unitario_snapshot: number;
  valor_total: number;
}

export interface ServicoExtraMock {
  id: string;
  codigo: string; // SX-2026-XXX
  empresa_id: string;
  empresa_nome: string;
  unidade_nome: string;
  data: string; // YYYY-MM-DD
  tipo_servico_id: string;
  tipo_servico_nome: string;
  descricao_servico: string;
  tomador_nome: string;
  
  // Quantitativo & Headcount
  quantidade: number;
  unidade_cobranca_snapshot: string;
  quantidade_colaboradores: number; // Headcount auditado: estritamente número inteiro de pessoas
  
  // Precificação
  valor_unitario_base: number;
  valor_unitario_snapshot: number;
  regra_periodo_codigo: string; // PADRAO | N1 | N2 | DOMINGO
  multiplicador_periodo: number; // 1.0, 1.25, 1.50
  valor_unitario_efetivo: number;
  
  // Materiais consumidos
  materiais?: MaterialConsumidoMock[];
  custo_materiais: number;
  total: number; // (quantidade * valor_unitario_efetivo) + custo_materiais
  
  // Fiscal
  emite_nf: boolean;
  nf_numero: string | null;
  iss_percentual: number;
  valor_iss: number;
  
  // Financeiro
  forma_pagamento_nome: string;
  modalidade_financeira: ModalidadeFinanceiraServicoExtra;
  status_pagamento: StatusPagamentoServicoExtra; // Apenas leitura, sem dropdown destrutivo
  
  // Esteira de Governança
  pipeline_status: PipelineStatusServicoExtra;
  justificativa_devolucao?: string | null;
  responsavel_nome: string;
  observacao?: string | null;
  
  // Diagnóstico & Despacho
  diagnostico: {
    categoria: "atencao" | "bloqueio" | "normal" | "concluido";
    responsavelAtual: string;
    proximoPasso: string;
    orientacaoOperacional: string;
  };
}

export const MOCK_EMPRESAS_SERVICOS_EXTRAS = [
  { id: "todas", nome: "Todas as Empresas" },
  { id: "emp-01", nome: "ESC LOG — Matriz Castanhal" },
  { id: "emp-02", nome: "ESC LOG — CD Benevides" },
  { id: "emp-03", nome: "ESC LOG — Operações Belém" },
];

export const MOCK_TIPOS_SERVICO_EXTRAS = [
  { id: "todos", nome: "Todos os Serviços Extras" },
  { id: "ts-01", nome: "Conserto de Pallets" },
  { id: "ts-02", nome: "Transbordo de Carga" },
  { id: "ts-03", nome: "Pintura de Pallets" },
  { id: "ts-04", nome: "Enlonamento de Carga" },
  { id: "ts-05", nome: "Montagem de Estrutura" },
  { id: "ts-06", nome: "Apoio Operacional Noturno" },
];

export const MOCK_PIPELINE_STATUS_OPTIONS: Array<{
  id: string;
  label: string;
  value: PipelineStatusServicoExtra | "todos";
}> = [
  { id: "todos", label: "Todos os Status", value: "todos" },
  { id: "pendente", label: "Pendente", value: "PENDENTE" },
  { id: "em_validacao", label: "Em Validação", value: "EM_VALIDACAO" },
  { id: "devolvido", label: "Devolvido (Ajuste)", value: "DEVOLVIDO" },
  { id: "aprovado_operacao", label: "Aprovado Operação", value: "APROVADO_OPERACAO" },
  { id: "aprovado_financeiro", label: "Aprovado Financeiro", value: "APROVADO_FINANCEIRO" },
  { id: "faturado", label: "Faturado", value: "FATURADO" },
  { id: "concluido", label: "Concluído", value: "CONCLUIDO" },
];

export const SERVICOS_EXTRAS_MOCKS: ServicoExtraMock[] = [
  // ── Cenário A: PENDENTE (Recém-capturado em campo, aguarda triagem da operação) ──
  {
    id: "se-101",
    codigo: "SX-2026-101",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Galpão Principal A",
    data: "2026-10-03",
    tipo_servico_id: "ts-06",
    tipo_servico_nome: "Apoio Operacional Noturno",
    descricao_servico: "Equipe extraordinária para triagem e pesagem de fardos avariados em chuva torrencial.",
    tomador_nome: "JBS Aves Castanhal",
    quantidade: 1,
    unidade_cobranca_snapshot: "op",
    quantidade_colaboradores: 4, // 4 pessoas
    valor_unitario_base: 680.0,
    valor_unitario_snapshot: 680.0,
    regra_periodo_codigo: "N1",
    multiplicador_periodo: 1.25,
    valor_unitario_efetivo: 850.0,
    custo_materiais: 0,
    total: 850.0,
    emite_nf: false,
    nf_numero: null,
    iss_percentual: 0,
    valor_iss: 0,
    forma_pagamento_nome: "PIX / À Vista",
    modalidade_financeira: "CAIXA_IMEDIATO",
    status_pagamento: "PENDENTE",
    pipeline_status: "PENDENTE",
    responsavel_nome: "Carlos Eduardo (Encarregado)",
    observacao: "Executado entre 22h e 02h para evitar retenção de caminhão refrigerado.",
    diagnostico: {
      categoria: "normal",
      responsavelAtual: "Operação / Gestor de Pátio",
      proximoPasso: "Encaminhar para conferência técnica e validação de turno",
      orientacaoOperacional: "Verificar se as 4 pessoas escaladas constam no livro de turno e se o horário noturno N1 está justificado.",
    },
  },

  // ── Cenário B: EM_VALIDACAO (Em conferência técnica e conferência de insumos) ──
  {
    id: "se-102",
    codigo: "SX-2026-102",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Setor de Paletização",
    data: "2026-10-03",
    tipo_servico_id: "ts-01",
    tipo_servico_nome: "Conserto de Pallets",
    descricao_servico: "Substituição de tábuas partidas e reforço estrutural em 85 pallets padrão PBR.",
    tomador_nome: "Bunge Alimentos Regional",
    quantidade: 85,
    unidade_cobranca_snapshot: "un",
    quantidade_colaboradores: 3, // 3 pessoas
    valor_unitario_base: 22.0,
    valor_unitario_snapshot: 22.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 22.0,
    materiais: [
      {
        material_id: "mat-01",
        nome_snapshot: "Madeira Eucalipto Tratada (Tábuas 1,20m)",
        unidade_snapshot: "pç",
        quantidade: 40,
        valor_unitario_snapshot: 6.5,
        valor_total: 260.0,
      },
      {
        material_id: "mat-02",
        nome_snapshot: "Pregos Anelados Reforçados",
        unidade_snapshot: "kg",
        quantidade: 3,
        valor_unitario_snapshot: 25.0,
        valor_total: 75.0,
      },
    ],
    custo_materiais: 335.0,
    total: 2205.0, // (85 * 22) + 335
    emite_nf: true,
    nf_numero: null,
    iss_percentual: 5.0,
    valor_iss: 110.25,
    forma_pagamento_nome: "Faturamento Quinzenal",
    modalidade_financeira: "FATURAMENTO_MENSAL",
    status_pagamento: "PENDENTE",
    pipeline_status: "EM_VALIDACAO",
    responsavel_nome: "Carlos Eduardo (Encarregado)",
    observacao: "Pallets recebidos do caminhão com umidade e tábuas estaladas no assoalho.",
    diagnostico: {
      categoria: "atencao",
      responsavelAtual: "Gestor Operacional / RH",
      proximoPasso: "Atestar execução física e consumo dos insumos de reparo",
      orientacaoOperacional: "Conferir o lote de madeira e pregos retirados da manutenção e assinar aceite técnico.",
    },
  },

  // ── Cenário C: DEVOLVIDO (Apontamento de inconsistência operacional com justificativa) ──
  {
    id: "se-103",
    codigo: "SX-2026-103",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    unidade_nome: "Doca 04 Frigorificada",
    data: "2026-10-02",
    tipo_servico_id: "ts-02",
    tipo_servico_nome: "Transbordo de Carga",
    descricao_servico: "Transferência emergencial de 26 pallets congelados por pane de termoking.",
    tomador_nome: "Transportadora Transamazônica",
    quantidade: 1,
    unidade_cobranca_snapshot: "op",
    quantidade_colaboradores: 5, // 5 pessoas
    valor_unitario_base: 1650.0,
    valor_unitario_snapshot: 1650.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 1650.0,
    custo_materiais: 0,
    total: 1650.0,
    emite_nf: true,
    nf_numero: null,
    iss_percentual: 5.0,
    valor_iss: 82.5,
    forma_pagamento_nome: "Boleto Bancário 15 Dias",
    modalidade_financeira: "DUPLICATA",
    status_pagamento: "PENDENTE",
    pipeline_status: "DEVOLVIDO",
    justificativa_devolucao: "Divergência entre horário registrado no romaneio e horário de acionamento da equipe de refrigerados. Falta comprovante assinado pelo motorista da transportadora.",
    responsavel_nome: "Jorge Silva (Encarregado)",
    observacao: "Aguardando termo de transbordo assinado.",
    diagnostico: {
      categoria: "bloqueio",
      responsavelAtual: "Encarregado Jorge Silva",
      proximoPasso: "Anexar termo assinado pelo motorista e reenviar para validação",
      orientacaoOperacional: "Item devolvido pelo RH/Operação. Não avança para o financeiro até sanar a documentação física.",
    },
  },

  // ── Cenário D: APROVADO_OPERACAO (Atestado pela operação, trigger disparou receita) ──
  {
    id: "se-104",
    codigo: "SX-2026-104",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Pátio Graneleiro",
    data: "2026-10-01",
    tipo_servico_id: "ts-04",
    tipo_servico_nome: "Enlonamento de Carga",
    descricao_servico: "Aplicação e fixação técnica de lona vinílica dupla face em 3 carretas de grãos.",
    tomador_nome: "Cooperativa Agrícola Paraense",
    quantidade: 3,
    unidade_cobranca_snapshot: "carreta",
    quantidade_colaboradores: 2, // 2 pessoas
    valor_unitario_base: 280.0,
    valor_unitario_snapshot: 280.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 280.0,
    custo_materiais: 0,
    total: 840.0,
    emite_nf: true,
    nf_numero: null,
    iss_percentual: 5.0,
    valor_iss: 42.0,
    forma_pagamento_nome: "Depósito / Transferência",
    modalidade_financeira: "DUPLICATA",
    status_pagamento: "PENDENTE",
    pipeline_status: "APROVADO_OPERACAO",
    responsavel_nome: "Carlos Eduardo (Encarregado)",
    observacao: "Enlonamento aprovado pelo conferente da cooperativa.",
    diagnostico: {
      categoria: "normal",
      responsavelAtual: "Financeiro / Central de Receitas",
      proximoPasso: "Gerar cobrança na Central de Receitas e emitir fatura",
      orientacaoOperacional: "Validação operacional concluída. A receita operacional avulsa já foi provisionada no Financeiro.",
    },
  },

  // ── Cenário E: APROVADO_FINANCEIRO (Revisado pelo financeiro, pronto para emissão fiscal) ──
  {
    id: "se-105",
    codigo: "SX-2026-105",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Estoque Pulmão",
    data: "2026-09-28",
    tipo_servico_id: "ts-03",
    tipo_servico_nome: "Pintura de Pallets",
    descricao_servico: "Identificação cromática com tinta epóxi e estêncil em 120 pallets de exportação.",
    tomador_nome: "Amaggi Exportação e Navegação",
    quantidade: 120,
    unidade_cobranca_snapshot: "pallet",
    quantidade_colaboradores: 2, // 2 pessoas
    valor_unitario_base: 18.0,
    valor_unitario_snapshot: 18.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 18.0,
    custo_materiais: 0,
    total: 2160.0,
    emite_nf: true,
    nf_numero: null,
    iss_percentual: 5.0,
    valor_iss: 108.0,
    forma_pagamento_nome: "Fechamento Mensal Faturado",
    modalidade_financeira: "FATURAMENTO_MENSAL",
    status_pagamento: "PENDENTE",
    pipeline_status: "APROVADO_FINANCEIRO",
    responsavel_nome: "Carlos Eduardo (Encarregado)",
    observacao: "Agrupado na fatura mensal de Setembro/2026 do cliente.",
    diagnostico: {
      categoria: "normal",
      responsavelAtual: "Financeiro / Faturamento Fiscal",
      proximoPasso: "Transmitir lote de NF de Serviços à Prefeitura",
      orientacaoOperacional: "Receita vinculada ao faturamento mensal consolidado. Imutabilidade financeira ativada no banco.",
    },
  },

  // ── Cenário F: FATURADO (NF emitida e cobrança enviada ao tomador) ──
  {
    id: "se-106",
    codigo: "SX-2026-106",
    empresa_id: "emp-01",
    empresa_nome: "ESC LOG — Matriz Castanhal",
    unidade_nome: "Pátio de Cargas Especiais",
    data: "2026-09-25",
    tipo_servico_id: "ts-02",
    tipo_servico_nome: "Transbordo de Carga",
    descricao_servico: "Transbordo emergencial com empilhadeira de carga pesada com assoalho avariado.",
    tomador_nome: "Transportadora Rápido Norte",
    quantidade: 1,
    unidade_cobranca_snapshot: "op",
    quantidade_colaboradores: 3, // 3 pessoas
    valor_unitario_base: 1450.0,
    valor_unitario_snapshot: 1450.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 1450.0,
    custo_materiais: 0,
    total: 1450.0,
    emite_nf: true,
    nf_numero: "004592",
    iss_percentual: 5.0,
    valor_iss: 72.5,
    forma_pagamento_nome: "Boleto 21 Dias",
    modalidade_financeira: "DUPLICATA",
    status_pagamento: "PENDENTE",
    pipeline_status: "FATURADO",
    responsavel_nome: "Roberto Matos (Supervisor)",
    observacao: "Boleto bancário emitido com vencimento em 16/10/2026.",
    diagnostico: {
      categoria: "normal",
      responsavelAtual: "Financeiro / Cobrança Bancária",
      proximoPasso: "Aguardar liquidação bancária via retorno CNAB",
      orientacaoOperacional: "Fatura emitida e entregue ao tomador. Não permite alteração de valor ou cliente.",
    },
  },

  // ── Cenário G: CONCLUIDO (Receita liquidada financeiramente, ciclo encerrado) ──
  {
    id: "se-107",
    codigo: "SX-2026-107",
    empresa_id: "emp-03",
    empresa_nome: "ESC LOG — Operações Belém",
    unidade_nome: "Terminal Portuário Fluvial",
    data: "2026-09-18",
    tipo_servico_id: "ts-04",
    tipo_servico_nome: "Enlonamento de Carga",
    descricao_servico: "Enlonamento reforçado com amarração marítima para travessia de balsa fluvial.",
    tomador_nome: "Exportadora Portuária Norte",
    quantidade: 5,
    unidade_cobranca_snapshot: "carreta",
    quantidade_colaboradores: 4, // 4 pessoas
    valor_unitario_base: 300.0,
    valor_unitario_snapshot: 300.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 300.0,
    custo_materiais: 0,
    total: 1500.0,
    emite_nf: true,
    nf_numero: "009101",
    iss_percentual: 5.0,
    valor_iss: 75.0,
    forma_pagamento_nome: "Depósito / PIX",
    modalidade_financeira: "CAIXA_IMEDIATO",
    status_pagamento: "RECEBIDO",
    pipeline_status: "CONCLUIDO",
    responsavel_nome: "Valter Fonseca (Encarregado Porto)",
    observacao: "Recebimento confirmado via extrato bancário em 18/09/2026.",
    diagnostico: {
      categoria: "concluido",
      responsavelAtual: "Ciclo Concluído (Tesouraria)",
      proximoPasso: "Arquivo de auditoria permanente",
      orientacaoOperacional: "Receita 100% liquidada e conciliada. Registro congelado e protegido contra qualquer modificação.",
    },
  },

  // ── Cenário H: CONCLUIDO (Conserto de pallets em faturamento mensal já liquidado) ──
  {
    id: "se-108",
    codigo: "SX-2026-108",
    empresa_id: "emp-02",
    empresa_nome: "ESC LOG — CD Benevides",
    unidade_nome: "Área de Reparos 02",
    data: "2026-09-10",
    tipo_servico_id: "ts-01",
    tipo_servico_nome: "Conserto de Pallets",
    descricao_servico: "Reforma de 50 pallets padrão duas entradas para estoque pulmão.",
    tomador_nome: "Bunge Alimentos Regional",
    quantidade: 50,
    unidade_cobranca_snapshot: "un",
    quantidade_colaboradores: 2, // 2 pessoas
    valor_unitario_base: 22.0,
    valor_unitario_snapshot: 22.0,
    regra_periodo_codigo: "PADRAO",
    multiplicador_periodo: 1.0,
    valor_unitario_efetivo: 22.0,
    custo_materiais: 0,
    total: 1100.0,
    emite_nf: true,
    nf_numero: "002140",
    iss_percentual: 5.0,
    valor_iss: 55.0,
    forma_pagamento_nome: "Faturamento Mensal Consolidado",
    modalidade_financeira: "FATURAMENTO_MENSAL",
    status_pagamento: "RECEBIDO",
    pipeline_status: "CONCLUIDO",
    responsavel_nome: "Jorge Silva (Encarregado)",
    observacao: "Liquidado no fechamento mensal do cliente.",
    diagnostico: {
      categoria: "concluido",
      responsavelAtual: "Ciclo Concluído (Tesouraria)",
      proximoPasso: "Conciliado no extrato contábil",
      orientacaoOperacional: "Fatura mensal liquidada pelo cliente. Registro em arquivo histórico definitivo.",
    },
  },
];
