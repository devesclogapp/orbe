/**
 * aprovacoesMockData.ts
 * Dataset oficial para prototipação visual da Central de Aprovações no UX Lab (UX08).
 * 
 * Contratos funcionais baseados na auditoria técnica:
 * - 5 Filas de Decisão: Operação por Volume, Serviço Extra, Custo Extra, Lote Diaristas, Lote Intermitentes.
 * - Lotes de Diaristas e Intermitentes tratados como UNIDADE DE DECISÃO.
 * - Suporte explícito ao princípio Fail-Closed (itens com inconsistência impeditiva).
 * - Rastreabilidade com histórico, justificativas e metadados de criação/devolução.
 */

export type DominioAprovacao =
  | "OPERACAO"
  | "SERVICO_EXTRA"
  | "CUSTO_EXTRA"
  | "DIARISTA"
  | "INTERMITENTE";

export type SituacaoDecisao =
  | "PENDENTE"
  | "REQUER_ATENCAO"
  | "DEVOLVIDO"
  | "BLOQUEADO_INCONSISTENCIA"
  | "APROVADO";

export interface ItemChecklistIntegridade {
  item: string;
  valido: boolean;
  detalhe?: string;
}

export interface HistoricoEventoAprovacao {
  id: string;
  data: string;
  usuario: string;
  papel: string;
  acao: string;
  descricao: string;
  motivo?: string;
}

export interface ItemComposicaoLote {
  id: string;
  nome: string;
  cargoOuFuncao?: string;
  quantidade?: number | string;
  horasOuDias?: string;
  valor: number;
  status?: string;
  detalhe?: string;
}

export interface ItemAprovacaoMock {
  id: string;
  codigo: string;
  dominio: DominioAprovacao;
  empresaId: string;
  empresaNome: string;
  unidadeNome?: string;
  titulo: string;
  descricaoResumida: string;
  origem: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  
  // Grandezas Financeiras e Físicas
  valorMonetario?: number;
  valorFormatado?: string;
  grandezaFisica?: string;
  modalidadeFinanceira?: string;
  origemRecurso?: "PAGO_EMPRESA" | "REEMBOLSO_COLABORADOR" | "PAGAMENTO_PENDENTE" | "FATURAMENTO_MENSAL";
  
  // Estados de Decisão e Governança
  situacao: SituacaoDecisao;
  rawStatusOriginal: string;
  isFailClosed: boolean;
  motivoBloqueio?: string;
  rotaEspecialista: string;
  
  // Checklist e Composição para Drawer
  checklist: ItemChecklistIntegridade[];
  composicao: ItemComposicaoLote[];
  historico: HistoricoEventoAprovacao[];
  
  // Metadados Específicos
  metadados?: {
    headcount?: number;
    volumeTotal?: number;
    tipoServicoNome?: string;
    categoriaCusto?: string;
    comprovanteUrl?: string;
    semanaOperacional?: string;
    competencia?: string;
    periodoInicio?: string;
    periodoFim?: string;
    totalDiarias?: number;
    totalColaboradores?: number;
    totalHoras?: number;
    dadosBancariosValidados?: boolean;
    emiteNf?: boolean;
    aliquotaIss?: number;
  };
}

export const MOCK_EMPRESAS_APROVACOES = [
  { id: "all", nome: "Todas as Empresas" },
  { id: "emp-benevides", nome: "ESC Log Benevides" },
  { id: "emp-castanhal", nome: "ESC Log Castanhal" },
  { id: "emp-belem", nome: "ESC Log Belém Matriz" },
  { id: "emp-santarem", nome: "ESC Log Santarém" },
  { id: "emp-maraba", nome: "ESC Log Marabá" },
];

export const MOCK_ITENS_APROVACOES: ItemAprovacaoMock[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. SERVIÇOS EXTRAS
  // ─────────────────────────────────────────────────────────────
  {
    id: "se-001",
    codigo: "SX-2026-08",
    dominio: "SERVICO_EXTRA",
    empresaId: "emp-benevides",
    empresaNome: "ESC Log Benevides",
    unidadeNome: "Armazém Principal",
    titulo: "Reforma de 85 Pallets PBR Avariados",
    descricaoResumida: "Conserto extraordinário e reposição de tocos de madeira para liberação de pátio.",
    origem: "Portal Operacional (Encarregado)",
    criadoPor: "Carlos Eduardo (Encarregado Turno A)",
    criadoEm: "2026-10-04T09:15:00Z",
    atualizadoEm: "2026-10-04T09:15:00Z",
    valorMonetario: 2550.0,
    valorFormatado: "R$ 2.550,00",
    grandezaFisica: "85 pallets",
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    situacao: "PENDENTE",
    rawStatusOriginal: "PENDENTE",
    isFailClosed: false,
    rotaEspecialista: "/operacional/servicos-extras",
    checklist: [
      { item: "Headcount operacional informado", valido: true, detalhe: "4 colaboradores alocados" },
      { item: "Catálogo de serviço homologado", valido: true, detalhe: "Conserto de Pallets PBR (is_extra_service = true)" },
      { item: "Composição de materiais calculada", valido: true, detalhe: "R$ 350,00 em madeira e pregos" },
      { item: "Retenção de ISS apurada", valido: true, detalhe: "5% (R$ 127,50) via regra municipal" },
    ],
    composicao: [
      { id: "c1", nome: "Mão de Obra Reforma", quantidade: 85, horasOuDias: "85 un", valor: 2200.0, detalhe: "R$ 25,88/un" },
      { id: "c2", nome: "Materiais Extras (Tocos/Pregos)", quantidade: 1, horasOuDias: "Kit", valor: 350.0, detalhe: "Snapshot de insumos" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T09:15:00Z",
        usuario: "Carlos Eduardo",
        papel: "Encarregado",
        acao: "Lançamento em Campo",
        descricao: "Serviço extra registrado via Portal Mobile após término da atividade.",
      },
    ],
    metadados: {
      headcount: 4,
      tipoServicoNome: "Conserto e Reforma de Pallets",
      emiteNf: true,
      aliquotaIss: 5,
    },
  },
  {
    id: "se-002",
    codigo: "SX-2026-09",
    dominio: "SERVICO_EXTRA",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Log Castanhal",
    unidadeNome: "Doca 03",
    titulo: "Transbordo Emergencial Carga Avariada",
    descricaoResumida: "Movimentação manual e recondicionamento de fardos após tombamento parcial.",
    origem: "Portal Operacional (Encarregado)",
    criadoPor: "Marcos Vinicius (Encarregado)",
    criadoEm: "2026-10-03T18:40:00Z",
    atualizadoEm: "2026-10-04T08:00:00Z",
    valorMonetario: 3800.0,
    valorFormatado: "R$ 3.800,00",
    grandezaFisica: "1.200 caixas",
    modalidadeFinanceira: "DUPLICATA",
    situacao: "REQUER_ATENCAO",
    rawStatusOriginal: "EM_VALIDACAO",
    isFailClosed: false,
    rotaEspecialista: "/operacional/servicos-extras",
    checklist: [
      { item: "Headcount operacional informado", valido: true, detalhe: "6 colaboradores em turno especial" },
      { item: "Transportadora vinculada", valido: true, detalhe: "Transportadora Rodonaves PA" },
      { item: "Prazo comercial de cobrança", valido: true, detalhe: "Duplicata 15 dias" },
    ],
    composicao: [
      { id: "c1", nome: "Transbordo de Carga Fechada", quantidade: 1, horasOuDias: "Spot", valor: 3800.0, detalhe: "Taxa emergencial noturna" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-03T18:40:00Z",
        usuario: "Marcos Vinicius",
        papel: "Encarregado",
        acao: "Lançamento em Campo",
        descricao: "Lançamento com pedido de urgência por liberação de baú.",
      },
      {
        id: "h2",
        data: "2026-10-04T08:00:00Z",
        usuario: "Mariana Costa",
        papel: "RH / Operações",
        acao: "Início de Validação",
        descricao: "Colocado em análise para cruzamento com escalas noturnas.",
      },
    ],
    metadados: {
      headcount: 6,
      tipoServicoNome: "Transbordo de Carga",
    },
  },
  {
    id: "se-003",
    codigo: "SX-2026-05",
    dominio: "SERVICO_EXTRA",
    empresaId: "emp-belem",
    empresaNome: "ESC Log Belém Matriz",
    unidadeNome: "Galpão 01",
    titulo: "Pintura e Identificação Técnica de 200 Pallets",
    descricaoResumida: "Aplicação de tinta acrílica especial e numeração para controle FIFO de cliente.",
    origem: "Portal Operacional",
    criadoPor: "Roberto Rocha",
    criadoEm: "2026-10-02T14:00:00Z",
    atualizadoEm: "2026-10-03T11:20:00Z",
    valorMonetario: 1900.0,
    valorFormatado: "R$ 1.900,00",
    grandezaFisica: "200 pallets",
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    situacao: "DEVOLVIDO",
    rawStatusOriginal: "DEVOLVIDO",
    isFailClosed: false,
    rotaEspecialista: "/operacional/servicos-extras",
    checklist: [
      { item: "Headcount operacional informado", valido: true, detalhe: "2 colaboradores" },
      { item: "Justificativa de devolução registrada", valido: true, detalhe: "Tinta informada diverge da NF do cliente" },
    ],
    composicao: [
      { id: "c1", nome: "Pintura e Marcação FIFO", quantidade: 200, horasOuDias: "200 un", valor: 1900.0 },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-02T14:00:00Z",
        usuario: "Roberto Rocha",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Lançamento inicial de 200 marcações.",
      },
      {
        id: "h2",
        data: "2026-10-03T11:20:00Z",
        usuario: "Mariana Costa",
        papel: "RH / Operações",
        acao: "Devolução com Justificativa",
        descricao: "Devolvido ao encarregado.",
        motivo: "O tipo de tinta e insumos não confere com o contrato do cliente Danone. Favor anexar foto do padrão executado.",
      },
    ],
    metadados: {
      headcount: 2,
    },
  },
  {
    id: "se-004",
    codigo: "SX-2026-10",
    dominio: "SERVICO_EXTRA",
    empresaId: "emp-santarem",
    empresaNome: "ESC Log Santarém",
    unidadeNome: "Pátio Fluvial",
    titulo: "Enlonamento de 4 Carretas Graneleiras",
    descricaoResumida: "Fixação e amarração de lonas impermeáveis para proteção de carga contra chuva.",
    origem: "Portal Operacional",
    criadoPor: "Danilo Soares",
    criadoEm: "2026-10-04T11:00:00Z",
    atualizadoEm: "2026-10-04T11:00:00Z",
    valorMonetario: 1200.0,
    valorFormatado: "R$ 1.200,00",
    grandezaFisica: "4 carretas",
    modalidadeFinanceira: "CAIXA_IMEDIATO",
    situacao: "PENDENTE",
    rawStatusOriginal: "PENDENTE",
    isFailClosed: false,
    rotaEspecialista: "/operacional/servicos-extras",
    checklist: [
      { item: "Headcount operacional informado", valido: true, detalhe: "3 colaboradores" },
      { item: "Comprovante de execução", valido: true, detalhe: "Fotos anexadas" },
    ],
    composicao: [
      { id: "c1", nome: "Enlonamento Manual Padrão", quantidade: 4, horasOuDias: "4 veículos", valor: 1200.0, detalhe: "R$ 300,00/veículo" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T11:00:00Z",
        usuario: "Danilo Soares",
        papel: "Encarregado",
        acao: "Lançamento em Campo",
        descricao: "Enlonamento concluído com êxito antes do embarque na balsa.",
      },
    ],
    metadados: {
      headcount: 3,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 2. CUSTOS EXTRAS (DESPESAS OPERACIONAIS)
  // ─────────────────────────────────────────────────────────────
  {
    id: "ce-001",
    codigo: "CE-2026-14",
    dominio: "CUSTO_EXTRA",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Log Castanhal",
    unidadeNome: "Armazém 02",
    titulo: "Aquisição Emergencial de 4 Pares de Botas de Segurança (EPI)",
    descricaoResumida: "Substituição imediata para diaristas convocados sem equipamento de proteção individual.",
    origem: "Gestão Operacional de Campo",
    criadoPor: "Marcos Vinicius (Encarregado)",
    criadoEm: "2026-10-04T07:30:00Z",
    atualizadoEm: "2026-10-04T07:30:00Z",
    valorMonetario: 480.0,
    valorFormatado: "R$ 480,00",
    grandezaFisica: "4 pares",
    origemRecurso: "REEMBOLSO_COLABORADOR",
    situacao: "PENDENTE",
    rawStatusOriginal: "RECEBIDO",
    isFailClosed: false,
    rotaEspecialista: "/operacional/custos-extras",
    checklist: [
      { item: "Cupom / Nota Fiscal Anexada", valido: true, detalhe: "DANFE NFC-e nº 44102 anexada" },
      { item: "Classificação de Despesa Válida", valido: true, detalhe: "EPI / Segurança do Trabalho" },
      { item: "Dados Bancários do Favorecido", valido: true, detalhe: "Chave PIX do Encarregado cadastrada" },
    ],
    composicao: [
      { id: "c1", nome: "Bota Couro Bico PVC Marluvas", quantidade: 4, horasOuDias: "4 pares", valor: 480.0, detalhe: "R$ 120,00/par" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T07:30:00Z",
        usuario: "Marcos Vinicius",
        papel: "Encarregado",
        acao: "Solicitação de Reembolso",
        descricao: "Compra realizada em loja de ferragens local para viabilizar início do turno.",
      },
    ],
    metadados: {
      categoriaCusto: "EPIs e Uniformes",
      comprovanteUrl: "/docs/recibos/nfce-44102.pdf",
    },
  },
  {
    id: "ce-002",
    codigo: "CE-2026-12",
    dominio: "CUSTO_EXTRA",
    empresaId: "emp-benevides",
    empresaNome: "ESC Log Benevides",
    unidadeNome: "Pátio Geral",
    titulo: "Manutenção Mecânica de Transpaleteira Hidráulica 2.5T",
    descricaoResumida: "Troca do retentor e óleo hidráulico da bomba após vazamento durante operação de descarga.",
    origem: "Manutenção e Suprimentos",
    criadoPor: "Carlos Eduardo",
    criadoEm: "2026-10-03T16:00:00Z",
    atualizadoEm: "2026-10-04T08:30:00Z",
    valorMonetario: 650.0,
    valorFormatado: "R$ 650,00",
    grandezaFisica: "1 equipamento",
    origemRecurso: "PAGAMENTO_PENDENTE",
    situacao: "REQUER_ATENCAO",
    rawStatusOriginal: "EM_VALIDACAO",
    isFailClosed: false,
    rotaEspecialista: "/operacional/custos-extras",
    checklist: [
      { item: "Ordem de Serviço Fornecedor", valido: true, detalhe: "OS HidroPará nº 8812" },
      { item: "Boleto Fornecedor Cadastrado", valido: true, detalhe: "Vencimento 10/10/2026" },
    ],
    composicao: [
      { id: "c1", nome: "Kit Vedação + Óleo ISO 68", quantidade: 1, horasOuDias: "Kit", valor: 280.0 },
      { id: "c2", nome: "Mão de Obra Especializada", quantidade: 1, horasOuDias: "Serviço", valor: 370.0 },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-03T16:00:00Z",
        usuario: "Carlos Eduardo",
        papel: "Encarregado",
        acao: "Lançamento de Despesa",
        descricao: "Envio de OS do fornecedor HidroPará para validação do RH.",
      },
    ],
    metadados: {
      categoriaCusto: "Manutenção de Equipamentos",
    },
  },
  {
    id: "ce-003",
    codigo: "CE-2026-15",
    dominio: "CUSTO_EXTRA",
    empresaId: "emp-belem",
    empresaNome: "ESC Log Belém Matriz",
    unidadeNome: "Doca 01",
    titulo: "Combustível Emergencial Gerador de Apoio",
    descricaoResumida: "Abastecimento de 50L de diesel S10 devido à queda de energia no pátio.",
    origem: "Gestão Operacional",
    criadoPor: "Roberto Rocha",
    criadoEm: "2026-10-04T10:00:00Z",
    atualizadoEm: "2026-10-04T10:00:00Z",
    valorMonetario: 310.0,
    valorFormatado: "R$ 310,00",
    grandezaFisica: "50 litros",
    origemRecurso: "PAGO_EMPRESA",
    situacao: "PENDENTE",
    rawStatusOriginal: "RECEBIDO",
    isFailClosed: false,
    rotaEspecialista: "/operacional/custos-extras",
    checklist: [
      { item: "Nota Fiscal de Combustível", valido: true, detalhe: "Posto Ipiranga Belém NF 19022" },
      { item: "Cartão Corporativo Empresa", valido: true, detalhe: "Despesa já liquidada pela matriz (Modelo A)" },
    ],
    composicao: [
      { id: "c1", nome: "Diesel S10 (50L)", quantidade: 50, horasOuDias: "50 L", valor: 310.0, detalhe: "R$ 6,20/L" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T10:00:00Z",
        usuario: "Roberto Rocha",
        papel: "Encarregado",
        acao: "Prestação de Contas",
        descricao: "Comprovante de pagamento com cartão corporativo anexado.",
      },
    ],
    metadados: {
      categoriaCusto: "Combustível e Energia",
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 3. LOTES DE DIARISTAS (UNIDADE DE DECISÃO: LOTE SEMANAL)
  // ─────────────────────────────────────────────────────────────
  {
    id: "lote-dia-40-01",
    codigo: "DIA-2026-S40-01",
    dominio: "DIARISTA",
    empresaId: "emp-benevides",
    empresaNome: "ESC Log Benevides",
    unidadeNome: "Centro de Distribuição",
    titulo: "Lote Semanal Diaristas · Semana 40 (29/09 a 05/10)",
    descricaoResumida: "Consolidação de 18 diárias executadas por 6 colaboradores em turnos de carga e descarga.",
    origem: "Fechamento de Grade Semanal",
    criadoPor: "Carlos Eduardo (Fechamento RH Campo)",
    criadoEm: "2026-10-04T12:00:00Z",
    atualizadoEm: "2026-10-04T12:00:00Z",
    valorMonetario: 2160.0,
    valorFormatado: "R$ 2.160,00",
    grandezaFisica: "18 diárias · 6 diaristas",
    modalidadeFinanceira: "LOTE_PAGAMENTO_SEMANAL",
    situacao: "PENDENTE",
    rawStatusOriginal: "AGUARDANDO_VALIDACAO_RH",
    isFailClosed: false,
    rotaEspecialista: "/operacional/diaristas",
    checklist: [
      { item: "Grade semanal fechada sem diárias órfãs", valido: true, detalhe: "100% dos apontamentos agrupados" },
      { item: "Validação cadastral dos diaristas", valido: true, detalhe: "6 CPFs e dados PIX verificados" },
      { item: "Cálculo de diária base consistente", valido: true, detalhe: "Valor tabelado R$ 120,00/diária" },
      { item: "Ausência de sobreposição de turnos", valido: true, detalhe: "Conferido contra registros de ponto" },
    ],
    composicao: [
      { id: "d1", nome: "Antônio Silva Santos", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "4 diárias", valor: 480.0, detalhe: "PIX: 012.***.***-99" },
      { id: "d2", nome: "Benedito Costa Lima", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "3 diárias", valor: 360.0, detalhe: "PIX: 034.***.***-11" },
      { id: "d3", nome: "Cláudio José Ferreira", cargoOuFuncao: "Conferente Diarista", horasOuDias: "4 diárias", valor: 480.0, detalhe: "PIX: 045.***.***-22" },
      { id: "d4", nome: "Damião Pereira Ramos", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "2 diárias", valor: 240.0, detalhe: "PIX: 056.***.***-33" },
      { id: "d5", nome: "Elias Rodrigues Souza", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "3 diárias", valor: 360.0, detalhe: "PIX: 067.***.***-44" },
      { id: "d6", nome: "Fernando Gomes Silva", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "2 diárias", valor: 240.0, detalhe: "PIX: 078.***.***-55" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T12:00:00Z",
        usuario: "Carlos Eduardo",
        papel: "Encarregado",
        acao: "Fechamento do Período",
        descricao: "Grade semanal validada pelo encarregado e enviada para aprovação do RH.",
      },
    ],
    metadados: {
      semanaOperacional: "Semana 40 / 2026",
      competencia: "2026-10",
      totalDiarias: 18,
      totalColaboradores: 6,
      periodoInicio: "2026-09-29",
      periodoFim: "2026-10-05",
      dadosBancariosValidados: true,
    },
  },
  {
    id: "lote-dia-40-02",
    codigo: "DIA-2026-S40-02",
    dominio: "DIARISTA",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Log Castanhal",
    unidadeNome: "Armazém Grãos",
    titulo: "Lote Semanal Diaristas · Semana 40 (29/09 a 05/10)",
    descricaoResumida: "Consolidação de 24 diárias executadas por 8 colaboradores em turnos diurnos e noturnos.",
    origem: "Fechamento de Grade Semanal",
    criadoPor: "Marcos Vinicius",
    criadoEm: "2026-10-04T13:30:00Z",
    atualizadoEm: "2026-10-04T13:30:00Z",
    valorMonetario: 3120.0,
    valorFormatado: "R$ 3.120,00",
    grandezaFisica: "24 diárias · 8 diaristas",
    modalidadeFinanceira: "LOTE_PAGAMENTO_SEMANAL",
    situacao: "PENDENTE",
    rawStatusOriginal: "AGUARDANDO_VALIDACAO_RH",
    isFailClosed: false,
    rotaEspecialista: "/operacional/diaristas",
    checklist: [
      { item: "Grade semanal fechada sem diárias órfãs", valido: true, detalhe: "24 diárias consolidadas" },
      { item: "Validação cadastral dos diaristas", valido: true, detalhe: "8 diaristas regulares" },
      { item: "Adicional de turno noturno apurado", valido: true, detalhe: "6 diárias com taxa noturna R$ 140,00" },
    ],
    composicao: [
      { id: "d1", nome: "Gabriel Moreira Paiva", cargoOuFuncao: "Ajudante Diurno", horasOuDias: "3 diárias", valor: 360.0 },
      { id: "d2", nome: "Helio Nogueira Braga", cargoOuFuncao: "Ajudante Diurno", horasOuDias: "3 diárias", valor: 360.0 },
      { id: "d3", nome: "Igor Valente Castro", cargoOuFuncao: "Ajudante Noturno", horasOuDias: "3 diárias", valor: 420.0 },
      { id: "d4", nome: "Jair Ribeiro Campos", cargoOuFuncao: "Ajudante Noturno", horasOuDias: "3 diárias", valor: 420.0 },
      { id: "d5", nome: "Kleber Santos Duarte", cargoOuFuncao: "Ajudante Diurno", horasOuDias: "3 diárias", valor: 360.0 },
      { id: "d6", nome: "Lucas Mendes Farias", cargoOuFuncao: "Ajudante Diurno", horasOuDias: "3 diárias", valor: 360.0 },
      { id: "d7", nome: "Marcio Pinheiro Leite", cargoOuFuncao: "Ajudante Diurno", horasOuDias: "3 diárias", valor: 360.0 },
      { id: "d8", nome: "Nilton Barreto Teles", cargoOuFuncao: "Conferente Noturno", horasOuDias: "3 diárias", valor: 480.0 },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T13:30:00Z",
        usuario: "Marcos Vinicius",
        papel: "Encarregado",
        acao: "Fechamento do Período",
        descricao: "Lote submetido para validação do RH.",
      },
    ],
    metadados: {
      semanaOperacional: "Semana 40 / 2026",
      competencia: "2026-10",
      totalDiarias: 24,
      totalColaboradores: 8,
      periodoInicio: "2026-09-29",
      periodoFim: "2026-10-05",
      dadosBancariosValidados: true,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 4. LOTES DE INTERMITENTES (UNIDADE DE DECISÃO: LOTE)
  // ─────────────────────────────────────────────────────────────
  {
    id: "lote-int-40-01",
    codigo: "INT-2026-S40-01",
    dominio: "INTERMITENTE",
    empresaId: "emp-benevides",
    empresaNome: "ESC Log Benevides",
    unidadeNome: "Armazém Geral",
    titulo: "Lote de Convocação Intermitente · Semana 40",
    descricaoResumida: "Fechamento de 14 convocações operacionais cumpridas por 7 colaboradores intermitentes.",
    origem: "Apontamento de Convocação Intermitente",
    criadoPor: "Carlos Eduardo",
    criadoEm: "2026-10-04T14:00:00Z",
    atualizadoEm: "2026-10-04T14:00:00Z",
    valorMonetario: 4250.0,
    valorFormatado: "R$ 4.250,00",
    grandezaFisica: "14 registros · 112 horas",
    modalidadeFinanceira: "REMESSA_CNAB_FOLHA",
    situacao: "PENDENTE",
    rawStatusOriginal: "AGUARDANDO_VALIDACAO_RH",
    isFailClosed: false,
    rotaEspecialista: "/operacional/intermitentes/lotes",
    checklist: [
      { item: "Completude cadastral dos 7 colaboradores", valido: true, detalhe: "CPFs, PIS e contas bancárias ativas" },
      { item: "Contratos de intermitente ativos", valido: true, detalhe: "Vínculos CLT Intermitente homologados" },
      { item: "Espelho para o Financeiro calculado", valido: true, detalhe: "R$ 4.250,00 com encargos e DSR calculados" },
    ],
    composicao: [
      { id: "i1", nome: "Ademir Barbosa Prado", cargoOuFuncao: "Operador de Empilhadeira", horasOuDias: "16h (2 conv.)", valor: 720.0 },
      { id: "i2", nome: "Bruno Silveira Neves", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "16h (2 conv.)", valor: 560.0 },
      { id: "i3", nome: "César Augusto Lopes", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "16h (2 conv.)", valor: 560.0 },
      { id: "i4", nome: "Diogo Macedo Cruz", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "16h (2 conv.)", valor: 560.0 },
      { id: "i5", nome: "Everaldo Vasconcelos", cargoOuFuncao: "Conferente", horasOuDias: "16h (2 conv.)", valor: 680.0 },
      { id: "i6", nome: "Fabricio Quintana", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "16h (2 conv.)", valor: 560.0 },
      { id: "i7", nome: "Geraldo Alencar Reis", cargoOuFuncao: "Ajudante de Carga", horasOuDias: "16h (2 conv.)", valor: 610.0 },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T14:00:00Z",
        usuario: "Carlos Eduardo",
        papel: "Encarregado",
        acao: "Fechamento de Convocação",
        descricao: "Apuração semanal das convocações de intermitentes concluída.",
      },
    ],
    metadados: {
      competencia: "2026-10",
      totalColaboradores: 7,
      totalHoras: 112,
      periodoInicio: "2026-09-29",
      periodoFim: "2026-10-05",
      dadosBancariosValidados: true,
    },
  },
  {
    id: "lote-int-40-02",
    codigo: "INT-2026-S40-02",
    dominio: "INTERMITENTE",
    empresaId: "emp-belem",
    empresaNome: "ESC Log Belém Matriz",
    unidadeNome: "Porto de Belém",
    titulo: "Lote de Convocação Intermitente · Operação Noturna Especial",
    descricaoResumida: "Convocação extraordinária de 5 operadores para atracação de navio graneleiro.",
    origem: "Apontamento de Convocação",
    criadoPor: "Roberto Rocha",
    criadoEm: "2026-10-03T20:00:00Z",
    atualizadoEm: "2026-10-04T09:00:00Z",
    valorMonetario: 2100.0,
    valorFormatado: "R$ 2.100,00",
    grandezaFisica: "5 registros · 40 horas",
    modalidadeFinanceira: "REMESSA_CNAB_FOLHA",
    situacao: "BLOQUEADO_INCONSISTENCIA",
    rawStatusOriginal: "AGUARDANDO_VALIDACAO_RH",
    isFailClosed: true,
    motivoBloqueio: "2 colaboradores com pendência bancária (Chave PIX / Conta não cadastrada no perfil). Ação bloqueada pelo motor de segurança.",
    rotaEspecialista: "/colaboradores",
    checklist: [
      { item: "Contratos de intermitente ativos", valido: true, detalhe: "5 contratos válidos" },
      { item: "Completude cadastral bancária", valido: false, detalhe: "Colaboradores Jorge Meireles e Lucas Paiva sem conta bancária cadastrada" },
    ],
    composicao: [
      { id: "i1", nome: "Jorge Meireles (PENDÊNCIA BANCÁRIA)", cargoOuFuncao: "Operador de Guincho", horasOuDias: "8h", valor: 450.0, status: "INCOMPLETO", detalhe: "Sem conta cadastrada" },
      { id: "i2", nome: "Lucas Paiva (PENDÊNCIA BANCÁRIA)", cargoOuFuncao: "Ajudante Portuário", horasOuDias: "8h", valor: 380.0, status: "INCOMPLETO", detalhe: "Sem chave PIX" },
      { id: "i3", nome: "Manuel Tavares", cargoOuFuncao: "Ajudante Portuário", horasOuDias: "8h", valor: 380.0, status: "OK" },
      { id: "i4", nome: "Otávio Fontes", cargoOuFuncao: "Ajudante Portuário", horasOuDias: "8h", valor: 380.0, status: "OK" },
      { id: "i5", nome: "Paulo Henrique Ramos", cargoOuFuncao: "Conferente", horasOuDias: "8h", valor: 510.0, status: "OK" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-03T20:00:00Z",
        usuario: "Roberto Rocha",
        papel: "Encarregado",
        acao: "Lote Criado",
        descricao: "Fechamento submetido.",
      },
      {
        id: "h2",
        data: "2026-10-04T09:00:00Z",
        usuario: "Sistema Orbe (Motor)",
        papel: "Validação Automática",
        acao: "Bloqueio Fail-Closed",
        descricao: "Lote retido devido a pendências de dados bancários que impediriam a remessa CNAB.",
      },
    ],
    metadados: {
      competencia: "2026-10",
      totalColaboradores: 5,
      totalHoras: 40,
      dadosBancariosValidados: false,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 5. OPERAÇÕES POR VOLUME (VALIDAÇÃO RH / OPERACIONAL)
  // ─────────────────────────────────────────────────────────────
  {
    id: "op-001",
    codigo: "OP-2026-10-042",
    dominio: "OPERACAO",
    empresaId: "emp-benevides",
    empresaNome: "ESC Log Benevides",
    unidadeNome: "Doca 02",
    titulo: "Descarga de Carga Fracionada · Danone",
    descricaoResumida: "Movimentação volumétrica de 4.800 caixas de laticínios com 5 colaboradores alocados.",
    origem: "Portal Operacional (Encarregado)",
    criadoPor: "Carlos Eduardo",
    criadoEm: "2026-10-04T06:00:00Z",
    atualizadoEm: "2026-10-04T06:00:00Z",
    valorMonetario: 1440.0,
    valorFormatado: "R$ 1.440,00",
    grandezaFisica: "4.800 caixas · 5 colab.",
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    situacao: "PENDENTE",
    rawStatusOriginal: "PENDENTE_RH",
    isFailClosed: false,
    rotaEspecialista: "/operacoes-volume",
    checklist: [
      { item: "Horário de Entrada do Ponto", valido: true, detalhe: "06:00 (Conferido)" },
      { item: "Horário de Término da Operação", valido: true, detalhe: "10:30 (Conferido)" },
      { item: "Equipe de colaboradores vinculada", valido: true, detalhe: "5 colaboradores CLT regulares" },
      { item: "Conhecimento de Transporte / NF", valido: true, detalhe: "NF-e 88192 anexada" },
    ],
    composicao: [
      { id: "c1", nome: "Descarga de Caixas Fracionadas", quantidade: 4800, horasOuDias: "4.800 un", valor: 1440.0, detalhe: "R$ 0,30/unidade" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-04T06:00:00Z",
        usuario: "Carlos Eduardo",
        papel: "Encarregado",
        acao: "Lançamento de Operação",
        descricao: "Descarga finalizada e apontada pelo encarregado.",
      },
    ],
    metadados: {
      volumeTotal: 4800,
      tipoServicoNome: "Descarga Volumétrica Fracionada",
    },
  },
  {
    id: "op-002",
    codigo: "OP-2026-10-038",
    dominio: "OPERACAO",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Log Castanhal",
    unidadeNome: "Doca 01",
    titulo: "Carregamento Noturno Especial (CN5C)",
    descricaoResumida: "Carregamento noturno tabelado com 5 colaboradores no período N1.",
    origem: "Portal Operacional",
    criadoPor: "Marcos Vinicius",
    criadoEm: "2026-10-03T22:00:00Z",
    atualizadoEm: "2026-10-04T07:15:00Z",
    valorMonetario: 2200.0,
    valorFormatado: "R$ 2.200,00",
    grandezaFisica: "5 colab. · Período N1",
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    situacao: "PENDENTE",
    rawStatusOriginal: "PENDENTE_RH",
    isFailClosed: false,
    rotaEspecialista: "/operacoes-volume",
    checklist: [
      { item: "Horários de início e término preenchidos", valido: true, detalhe: "22:00 às 04:00" },
      { item: "Tabela de serviços específicos CN5C", valido: true, detalhe: "Regra N1 aplicada (1.25x)" },
    ],
    composicao: [
      { id: "c1", nome: "Serviço Específico CN5C Noturno", quantidade: 1, horasOuDias: "6 horas", valor: 2200.0 },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-03T22:00:00Z",
        usuario: "Marcos Vinicius",
        papel: "Encarregado",
        acao: "Lançamento",
        descricao: "Operação executada em regime de urgência.",
      },
    ],
    metadados: {
      tipoServicoNome: "CN5C - Carregamento Noturno 5 Colaboradores",
    },
  },
  {
    id: "op-003",
    codigo: "OP-2026-10-019",
    dominio: "OPERACAO",
    empresaId: "emp-maraba",
    empresaNome: "ESC Log Marabá",
    unidadeNome: "Doca 04",
    titulo: "Descarga de Sacaria 50kg · Trigo",
    descricaoResumida: "Movimentação de 3.200 sacas com registro em restrição por ausência de horário de saída.",
    origem: "Portal Operacional",
    criadoPor: "Antônio Carlos",
    criadoEm: "2026-10-02T08:00:00Z",
    atualizadoEm: "2026-10-03T17:00:00Z",
    valorMonetario: 1600.0,
    valorFormatado: "R$ 1.600,00",
    grandezaFisica: "3.200 sacas",
    modalidadeFinanceira: "FATURAMENTO_MENSAL",
    situacao: "BLOQUEADO_INCONSISTENCIA",
    rawStatusOriginal: "EM_RESTRICAO",
    isFailClosed: true,
    motivoBloqueio: "Horário de saída do ponto não informado pelo encarregado. Registro retido em restrição operacional (Fail-Closed).",
    rotaEspecialista: "/inconsistencias",
    checklist: [
      { item: "Horário de início preenchido", valido: true, detalhe: "08:00" },
      { item: "Horário de término preenchido", valido: false, detalhe: "Horário de saída AUSENTE" },
      { item: "Validação RH autorizada", valido: false, detalhe: "Bloqueado pelo rpc_operacao_regularizar_horarios" },
    ],
    composicao: [
      { id: "c1", nome: "Descarga de Sacaria Pesada", quantidade: 3200, horasOuDias: "3.200 un", valor: 1600.0, detalhe: "R$ 0,50/saco" },
    ],
    historico: [
      {
        id: "h1",
        data: "2026-10-02T08:00:00Z",
        usuario: "Antônio Carlos",
        papel: "Encarregado",
        acao: "Lançamento Incompleto",
        descricao: "Lançamento salvo sem batida de saída.",
      },
      {
        id: "h2",
        data: "2026-10-03T17:00:00Z",
        usuario: "Motor de Validação",
        papel: "Regra de Domínio",
        acao: "Retenção em Restrição",
        descricao: "Operação não pode ser aprovada sem horários completos de início e fim.",
      },
    ],
    metadados: {
      volumeTotal: 3200,
    },
  },
];
