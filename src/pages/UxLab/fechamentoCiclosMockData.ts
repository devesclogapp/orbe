/**
 * ORBE ERP — UX10: HUB TRANSVERSAL DE FECHAMENTO DE CICLOS
 * Mock Dataset Oficial para o UX Lab (Determinístico, Isolado de Produção)
 *
 * NOTAS DE SEGURANÇA (AUDITORIA CHECKPOINT 01.1):
 * SEC-UX10-01: RLS das tabelas de fechamento não possui segregação de role suficiente (apenas tenant_id).
 * SEC-UX10-02: Imutabilidade pós-fechamento depende atualmente da camada de aplicação/services TypeScript.
 */

export type DominioFechamento = "OPERACIONAL" | "DIARISTAS" | "INTERMITENTES" | "CLT";

export type EstadoVisualFechamento =
  | "PRONTO_PARA_FECHAR"
  | "BLOQUEADO"
  | "AGUARDANDO_APROVACAO"
  | "FECHADO";

export interface SemanaOperacionalMock {
  numero: 1 | 2 | 3 | 4 | 5;
  periodo: string;
  status: "fechado" | "bloqueado" | "pronto" | "aberto";
  volume: number;
  horas: number;
  valor: number;
  inconsistencias?: number;
  fechadoEm?: string;
  fechadoPor?: string;
}

export interface ChecklistItemMock {
  id: string;
  titulo: string;
  tipo: "sucesso" | "bloqueio" | "aviso";
  descricao?: string;
}

export interface DetalhesConsolidacaoMock {
  colaboradores: number;
  quantidadePrincipal: string; // ex: "18 diárias" ou "164h apuradas"
  valorTotal: number;
  detalhes?: { rotulo: string; quantidade: number; valor: number }[];
}

export interface CicloFechamentoItemMock {
  id: string;
  dominio: DominioFechamento;
  titulo: string;
  subtitulo: string;
  periodo: string;
  competencia: string;
  empresaId: string;
  empresaNome: string;
  estadoVisual: EstadoVisualFechamento;
  statusMotorOriginal: string;
  statusRhOriginal: string;
  statusFinanceiroOriginal: string;
  grandezaResumo: string;
  valorTotal: number;
  responsavelPapel: string;
  responsavelNome: string;
  totalImpedimentos: number;
  ctaTexto: string;
  ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA";
  semanasTimeline?: SemanaOperacionalMock[];
  checklist: ChecklistItemMock[];
  consolidacao?: DetalhesConsolidacaoMock;
  efeitoFechamento: string;
  rastreabilidade: {
    empresa: string;
    competencia: string;
    periodo: string;
    responsavel: string;
    dataHoraRevisao: string;
    fechadoEm?: string;
    fechadoPor?: string;
  };
}

export const MOCK_EMPRESAS_FECHAMENTO = [
  { id: "all", nome: "Consolidado Geral (Todas as Unidades)" },
  { id: "emp-castanhal", nome: "ESC Logística — Matriz Castanhal" },
  { id: "emp-belem", nome: "ESC Logística — Filial Belém" },
  { id: "emp-maraba", nome: "ESC Logística — Filial Marabá" },
];

export const MOCK_CICLOS_FECHAMENTO: CicloFechamentoItemMock[] = [
  // 1. MOTOR: CICLO OPERACIONAL SEMANAL
  {
    id: "ciclo-operacional-semanal",
    dominio: "OPERACIONAL",
    titulo: "Ciclo Operacional Semanal",
    subtitulo: "Apuração de Volumes, Produtividade & Apontamentos Operacionais",
    periodo: "Semana 3 • 15/10 a 21/10",
    competencia: "2026-10",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    estadoVisual: "BLOQUEADO",
    statusMotorOriginal: "aberto",
    statusRhOriginal: "pendente",
    statusFinanceiroOriginal: "pendente",
    grandezaResumo: "3.450 vols • 380h estimadas",
    valorTotal: 17250.0,
    responsavelPapel: "Operação / RH",
    responsavelNome: "Carlos Encarregado & DP Local",
    totalImpedimentos: 2,
    ctaTexto: "Ver 2 bloqueios",
    ctaTipo: "INCONSISTENCIAS",
    semanasTimeline: [
      {
        numero: 1,
        periodo: "01/10 a 07/10",
        status: "fechado",
        volume: 2840,
        horas: 320,
        valor: 14200.0,
        fechadoEm: "2026-10-08T10:30:00Z",
        fechadoPor: "Juliana Santos (RH Master)",
      },
      {
        numero: 2,
        periodo: "08/10 a 14/10",
        status: "fechado",
        volume: 3120,
        horas: 340,
        valor: 15600.0,
        fechadoEm: "2026-10-15T11:00:00Z",
        fechadoPor: "Juliana Santos (RH Master)",
      },
      {
        numero: 3,
        periodo: "15/10 a 21/10",
        status: "bloqueado",
        volume: 3450,
        horas: 380,
        valor: 17250.0,
        inconsistencias: 2,
      },
      {
        numero: 4,
        periodo: "22/10 a 28/10",
        status: "aberto",
        volume: 1200,
        horas: 140,
        valor: 6000.0,
      },
      {
        numero: 5,
        periodo: "29/10 a 31/10",
        status: "aberto",
        volume: 0,
        horas: 0,
        valor: 0.0,
      },
    ],
    checklist: [
      {
        id: "chk-op-1",
        titulo: "Operações da S1 e S2 homologadas e fechadas",
        tipo: "sucesso",
        descricao: "5.960 volumes consolidados nas semanas anteriores",
      },
      {
        id: "chk-op-2",
        titulo: "Pontos operacionais importados",
        tipo: "sucesso",
        descricao: "Apontamentos diários sincronizados com a portaria",
      },
      {
        id: "chk-op-3",
        titulo: "2 inconsistências operacionais na Semana 3",
        tipo: "bloqueio",
        descricao: "1 batida de ponto incompleta e 1 operação sem transportadora",
      },
    ],
    efeitoFechamento:
      "Consolida as operações e horas da semana operacional, calculando a produtividade e disponibilizando o lote para validação formal de RH.",
    rastreabilidade: {
      empresa: "ESC Logística — Matriz Castanhal",
      competencia: "Outubro / 2026",
      periodo: "Semana 3 • 15/10 a 21/10",
      responsavel: "Carlos Encarregado (Gestão Operacional)",
      dataHoraRevisao: "2026-10-18T14:30:00Z",
    },
  },

  // 2. MOTOR: DIARISTAS (LOTE SEMANAL)
  {
    id: "ciclo-diaristas-sem40",
    dominio: "DIARISTAS",
    titulo: "Diaristas — Lote Semanal",
    subtitulo: "Grade de Presença, Quantidade de Diárias & Liquidação Semanal",
    periodo: "Semana 40 • 29/09 a 05/10",
    competencia: "2026-10",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    estadoVisual: "PRONTO_PARA_FECHAR",
    statusMotorOriginal: "VALIDADO_RH",
    statusRhOriginal: "VALIDADO_RH",
    statusFinanceiroOriginal: "AGUARDANDO_FINANCEIRO",
    grandezaResumo: "18 diárias • 6 diaristas",
    valorTotal: 2160.0,
    responsavelPapel: "RH / Financeiro",
    responsavelNome: "Juliana Santos (RH Master)",
    totalImpedimentos: 0,
    ctaTexto: "Revisar e Fechar",
    ctaTipo: "FECHAMENTO",
    consolidacao: {
      colaboradores: 6,
      quantidadePrincipal: "18 diárias registradas",
      valorTotal: 2160.0,
      detalhes: [
        { rotulo: "Ajudante de Carga Diarista (4 colab.)", quantidade: 12, valor: 1440.0 },
        { rotulo: "Conferente Diarista (2 colab.)", quantidade: 6, valor: 720.0 },
      ],
    },
    checklist: [
      {
        id: "chk-dia-1",
        titulo: "Grade semanal 100% preenchida",
        tipo: "sucesso",
        descricao: "18 presenças apuradas sem marcações órfãs",
      },
      {
        id: "chk-dia-2",
        titulo: "Cadastros bancários e PIX íntegros",
        tipo: "sucesso",
        descricao: "Todos os 6 diaristas aptos para liquidação eletrônica",
      },
      {
        id: "chk-dia-3",
        titulo: "Validação RH formalmente concluída",
        tipo: "sucesso",
        descricao: "Validado por Juliana Santos em 06/10/2026 às 16:45",
      },
      {
        id: "chk-dia-4",
        titulo: "Nenhum impedimento ativo na Central de Inconsistências",
        tipo: "sucesso",
        descricao: "Zero pendências cadastrais ou de vínculo",
      },
    ],
    efeitoFechamento:
      "Este fechamento consolidará o lote semanal de Diaristas (R$ 2.160,00) e o disponibilizará para continuidade do processamento financeiro.",
    rastreabilidade: {
      empresa: "ESC Logística — Matriz Castanhal",
      competencia: "Outubro / 2026",
      periodo: "Semana 40 • 29/09 a 05/10",
      responsavel: "Juliana Santos (RH Master)",
      dataHoraRevisao: "2026-10-06T16:45:00Z",
    },
  },

  // 3. MOTOR: INTERMITENTES (LOTE QUINZENAL)
  {
    id: "ciclo-intermitentes-1q",
    dominio: "INTERMITENTES",
    titulo: "Contrato Intermitente — Lote Quinzenal",
    subtitulo: "Convocações, Horas Efetivas Apuradas & Remuneração",
    periodo: "1ª Quinzena • Outubro/2026",
    competencia: "2026-10",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    estadoVisual: "AGUARDANDO_APROVACAO",
    statusMotorOriginal: "AGUARDANDO_VALIDACAO_RH",
    statusRhOriginal: "AGUARDANDO_VALIDACAO_RH",
    statusFinanceiroOriginal: "PENDENTE",
    grandezaResumo: "12 colaboradores • 164h apuradas",
    valorTotal: 8420.0,
    responsavelPapel: "Gestor RH / Operação",
    responsavelNome: "Marcos Gerente Operacional",
    totalImpedimentos: 1,
    ctaTexto: "Abrir Aprovações",
    ctaTipo: "APROVACOES",
    consolidacao: {
      colaboradores: 12,
      quantidadePrincipal: "164 horas apuradas",
      valorTotal: 8420.0,
      detalhes: [
        { rotulo: "Operador de Empilhadeira Intermitente (4 colab.)", quantidade: 64, valor: 3840.0 },
        { rotulo: "Auxiliar de Carga Intermitente (8 colab.)", quantidade: 100, valor: 4580.0 },
      ],
    },
    checklist: [
      {
        id: "chk-int-1",
        titulo: "Convocações e jornadas registradas no período",
        tipo: "sucesso",
        descricao: "164 horas apuradas em 12 contratos ativos",
      },
      {
        id: "chk-int-2",
        titulo: "1 autorização de hora extraordinária pendente",
        tipo: "aviso",
        descricao: "Aguardando autorização da gerência na Central de Aprovações (UX08)",
      },
    ],
    efeitoFechamento:
      "Após a autorização da pendência na Central de Aprovações, o lote quinzenal ficará apto para fechamento e envio ao Financeiro.",
    rastreabilidade: {
      empresa: "ESC Logística — Matriz Castanhal",
      competencia: "Outubro / 2026",
      periodo: "1ª Quinzena • 01/10 a 15/10",
      responsavel: "Marcos Gerente Operacional",
      dataHoraRevisao: "2026-10-16T09:15:00Z",
    },
  },

  // 4. MOTOR: CLT / FOLHA MENSAL
  {
    id: "ciclo-clt-mensal",
    dominio: "CLT",
    titulo: "CLT — Folha Mensal & Banco de Horas",
    subtitulo: "Consolidação de Ponto, Horas Extras, Adicionais e Folha Base",
    periodo: "Competência Mensal • Outubro/2026",
    competencia: "2026-10",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    estadoVisual: "BLOQUEADO",
    statusMotorOriginal: "EM_APURACAO",
    statusRhOriginal: "PENDENTE_DECISOES",
    statusFinanceiroOriginal: "PENDENTE",
    grandezaResumo: "42 colaboradores • 7.392h normais",
    valorTotal: 98450.0,
    responsavelPapel: "RH Master",
    responsavelNome: "Roberto DP (RH Master)",
    totalImpedimentos: 5,
    ctaTexto: "Ver 5 impedimentos",
    ctaTipo: "INCONSISTENCIAS",
    consolidacao: {
      colaboradores: 42,
      quantidadePrincipal: "7.392h apuradas",
      valorTotal: 98450.0,
      detalhes: [
        { rotulo: "Folha Salarial Base (FOLHA_BASE)", quantidade: 42, valor: 82500.0 },
        { rotulo: "Horas Extras & Adicional Noturno (FOLHA_VARIAVEL)", quantidade: 42, valor: 11450.0 },
        { rotulo: "Banco de Horas a Pagar / Reflexos (BANCO_HORAS)", quantidade: 42, valor: 4500.0 },
      ],
    },
    checklist: [
      {
        id: "chk-clt-1",
        titulo: "Pontos importados do coletor RHID",
        tipo: "sucesso",
        descricao: "1.260 marcações sincronizadas na competência",
      },
      {
        id: "chk-clt-2",
        titulo: "3 decisões de ponto pendentes no Motor RH",
        tipo: "bloqueio",
        descricao: "Atestados médicos e justificativas de atraso pendentes de homologação",
      },
      {
        id: "chk-clt-3",
        titulo: "2 colaboradores com cadastro incompleto",
        tipo: "bloqueio",
        descricao: "Falta de dados bancários (PIX/Conta) para emissão de folha",
      },
    ],
    efeitoFechamento:
      "Gera formalmente os 3 lotes no financeiro: FOLHA_BASE, FOLHA_VARIAVEL e BANCO_HORAS em rh_financeiro_lotes.",
    rastreabilidade: {
      empresa: "ESC Logística — Matriz Castanhal",
      competencia: "Outubro / 2026",
      periodo: "Competência Mensal • Outubro/2026",
      responsavel: "Roberto DP (RH Master)",
      dataHoraRevisao: "2026-10-20T11:30:00Z",
    },
  },

  // 5. MOTOR AUXILIAR HISTÓRICO: DIARISTAS SEMANA ANTERIOR (FECHADO)
  {
    id: "ciclo-diaristas-sem39-fechado",
    dominio: "DIARISTAS",
    titulo: "Diaristas — Semana 39 (Consolidado)",
    subtitulo: "Lote Semanal Quitado e Conciliado",
    periodo: "Semana 39 • 22/09 a 28/09",
    competencia: "2026-10",
    empresaId: "emp-castanhal",
    empresaNome: "ESC Logística — Matriz Castanhal",
    estadoVisual: "FECHADO",
    statusMotorOriginal: "FECHADO_FINANCEIRO",
    statusRhOriginal: "VALIDADO_RH",
    statusFinanceiroOriginal: "PAGO",
    grandezaResumo: "24 diárias • 7 diaristas",
    valorTotal: 2880.0,
    responsavelPapel: "Financeiro",
    responsavelNome: "Ana Controladoria",
    totalImpedimentos: 0,
    ctaTexto: "Ver Fechamento",
    ctaTipo: "CONSULTA",
    consolidacao: {
      colaboradores: 7,
      quantidadePrincipal: "24 diárias liquidadas",
      valorTotal: 2880.0,
      detalhes: [
        { rotulo: "Ajudante de Carga Diarista (5 colab.)", quantidade: 18, valor: 2160.0 },
        { rotulo: "Conferente Diarista (2 colab.)", quantidade: 6, valor: 720.0 },
      ],
    },
    checklist: [
      {
        id: "chk-d39-1",
        titulo: "Grade semanal validada pelo RH",
        tipo: "sucesso",
        descricao: "Validado em 29/09/2026 por Juliana Santos",
      },
      {
        id: "chk-d39-2",
        titulo: "Remessa CNAB240 gerada e liquidada",
        tipo: "sucesso",
        descricao: "Arquivo CNAB_20260930_ITAU.REM processado pelo banco",
      },
      {
        id: "chk-d39-3",
        titulo: "Conciliação bancária 100% concluída",
        tipo: "sucesso",
        descricao: "Retorno bancário conciliado sem divergências",
      },
    ],
    efeitoFechamento:
      "Lote consolidado e quitado. Alterações requerem processo formal de ajuste retroativo no ciclo seguinte.",
    rastreabilidade: {
      empresa: "ESC Logística — Matriz Castanhal",
      competencia: "Outubro / 2026",
      periodo: "Semana 39 • 22/09 a 28/09",
      responsavel: "Ana Controladoria (Financeiro)",
      dataHoraRevisao: "2026-09-30T17:00:00Z",
      fechadoEm: "2026-09-30T17:00:00Z",
      fechadoPor: "Ana Controladoria (UUID 8f19...)",
    },
  },
];
