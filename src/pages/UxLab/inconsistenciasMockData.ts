/**
 * inconsistenciasMockData.ts
 * Dataset oficial isolado para prototipação visual da Central de Inconsistências no UX Lab (UX09).
 * 
 * Contratos funcionais baseados na auditoria técnica (Etapa 01):
 * - Pergunta central: "O que está impedindo o fluxo de continuar, por que está impedindo e quem precisa agir?"
 * - Separação estrita: Inconsistência factual ≠ Aprovação humana ≠ Decisão RH de Ponto (Falta/DSR).
 * - Fila padrão exibe exclusivamente impedimentos ATIVOS.
 * - Suporte a 5 Famílias e 6 Domínios: Volume, Serviços Extras, Custos Extras, Diaristas, Intermitentes, Ponto CLT.
 * - Totalmente em conformidade com DS-01 / DS-02.
 */

export type DominioInconsistencia =
  | "OPERACAO"
  | "SERVICO_EXTRA"
  | "CUSTO_EXTRA"
  | "DIARISTA"
  | "INTERMITENTE"
  | "PONTO_CLT";

export type NaturezaInconsistencia =
  | "CADASTRAL_VINCULO"
  | "DOCUMENTAL"
  | "OPERACIONAL"
  | "RH_PONTO"
  | "FINANCEIRO_PAGAMENTO";

export type ResponsavelInconsistencia =
  | "ENCARREGADO"
  | "RH"
  | "FINANCEIRO"
  | "ADMIN";

export interface RastreabilidadeInconsistencia {
  origem: string;
  detectadoPor: string;
  detectadoEm: string;
  ultimaAtualizacao: string;
  motivoDevolucao?: string;
  dadosTecnicos?: Record<string, any>;
}

export interface DetalhesDrawerInconsistencia {
  oqueAconteceu: string;
  porqueFluxoParou: string;
  oquePrecisaSerFeito: string;
  ondeCorrigir: string;
  depoisDaCorrecao: string;
  rastreabilidade: RastreabilidadeInconsistencia;
}

export interface ItemInconsistenciaMock {
  id: string;
  codigo: string;
  dominio: DominioInconsistencia;
  dominioLabel: string;
  empresaId: string;
  empresaNome: string;
  unidadeNome: string;
  referencia: string;
  colaboradorNome?: string;
  natureza: NaturezaInconsistencia;
  naturezaLabel: string;
  tituloHumano: string;
  oqueEstaErrado: string;
  impactoNoFluxo: string;
  responsavel: ResponsavelInconsistencia;
  responsavelLabel: string;
  detectadoEm: string;
  bloqueante: boolean;
  status: "ATIVA" | "RESOLVIDA" | "ARQUIVADA";
  moduloDestino: string;
  rotaDestino: string;
  ctaLabel: string;
  detalhesDrawer: DetalhesDrawerInconsistencia;
}

export const MOCK_EMPRESAS_INCONSISTENCIAS: Array<{ id: string; nome: string }> = [
  { id: "all", nome: "Todas as Empresas" },
  { id: "emp-ambev", nome: "Cervejaria Ambev S.A." },
  { id: "emp-votorantim", nome: "Votorantim Cimentos" },
  { id: "emp-mdias", nome: "M. Dias Branco Alimentos" },
  { id: "emp-esclog", nome: "ESC Logística Matriz" },
  { id: "emp-norte", nome: "Distribuidora Norte Brasil" },
  { id: "emp-ceramica", nome: "Cerâmica Belém Unidade Industrial" },
];

export const MOCK_ITENS_INCONSISTENCIAS: ItemInconsistenciaMock[] = [
  // =========================================================================
  // 1. OPERAÇÕES POR VOLUME
  // =========================================================================
  {
    id: "inc-op-01",
    codigo: "OP-2026-104",
    dominio: "OPERACAO",
    dominioLabel: "Operação por Volume",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Descarga 2.400 un · Palete Fechado",
    natureza: "OPERACIONAL",
    naturezaLabel: "Operacional",
    tituloHumano: "Horário de início e término não informado",
    oqueEstaErrado: "A operação foi lançada sem os horários de início e conclusão da descarga.",
    impactoNoFluxo: "Trava a validação das horas de equipe pelo RH e o faturamento.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T08:15:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Operações por Volume",
    rotaDestino: "/ux-lab/operacoes-volume",
    ctaLabel: "Abrir em Operações",
    detalhesDrawer: {
      oqueAconteceu: "O encarregado registrou a descarga física mas não informou os horários de início e término no coletor operacional.",
      porqueFluxoParou: "O motor de apuração RH não pode calcular as horas trabalhadas dos colaboradores envolvidos sem os marcos temporais.",
      oquePrecisaSerFeito: "Preencher os horários reais de início e conclusão nos dados da operação.",
      ondeCorrigir: "Operações por Volume → Editar Operação",
      depoisDaCorrecao: "Após o preenchimento, a operação retorna automaticamente para a fila de validação do RH.",
      rastreabilidade: {
        origem: "Portal do Encarregado (Coletor Mobile)",
        detectadoPor: "Motor Operacional de Validação",
        detectadoEm: "04/10/2026 às 08:15",
        ultimaAtualizacao: "04/10/2026 às 08:15",
        dadosTecnicos: { entrada_ponto: null, saida_ponto: null, quantidade: 2400 },
      },
    },
  },
  {
    id: "inc-op-02",
    codigo: "OP-2026-098",
    dominio: "OPERACAO",
    dominioLabel: "Operação por Volume",
    empresaId: "emp-norte",
    empresaNome: "Distribuidora Norte Brasil",
    unidadeNome: "CD Castanhal",
    referencia: "Carga Granel 1.800 un · Carreta 03",
    natureza: "OPERACIONAL",
    naturezaLabel: "Operacional",
    tituloHumano: "Operação devolvida pelo RH para revisão",
    oqueEstaErrado: "A equipe informada diverge dos colaboradores presentes no turno de descarga.",
    impactoNoFluxo: "Trava o fechamento do rateio operacional e a remuneração dos ajudantes.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T09:40:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Operações por Volume",
    rotaDestino: "/ux-lab/operacoes-volume",
    ctaLabel: "Abrir em Operações",
    detalhesDrawer: {
      oqueAconteceu: "Durante a conferência do RH, foi identificado que 2 colaboradores listados não constavam no apontamento de portaria do dia.",
      porqueFluxoParou: "O RH devolveu a operação para que o encarregado ajuste a lista exata dos colaboradores que executaram o serviço.",
      oquePrecisaSerFeito: "Ajustar os colaboradores vinculados na operação e reenviar.",
      ondeCorrigir: "Operações por Volume → Revisão de Lançamento",
      depoisDaCorrecao: "A operação retornará com status corrigido para reanálise na Central de Validação RH.",
      rastreabilidade: {
        origem: "Painel de Validação RH",
        detectadoPor: "Mariana Souza (Analista RH)",
        detectadoEm: "04/10/2026 às 09:40",
        ultimaAtualizacao: "04/10/2026 às 09:40",
        motivoDevolucao: "Colaboradores Paulo Silva e Jorge Matos não constam na escala física deste turno. Favor verificar equipe real.",
        dadosTecnicos: { status_rh: "DEVOLVIDO_RH", headcount_informado: 5, headcount_validado: 3 },
      },
    },
  },
  {
    id: "inc-op-03",
    codigo: "OP-2026-112",
    dominio: "OPERACAO",
    dominioLabel: "Operação por Volume",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Movimentação Interna 950 un · Bloco B",
    natureza: "FINANCEIRO_PAGAMENTO",
    naturezaLabel: "Financeiro",
    tituloHumano: "Retida em restrição comercial (forma de pagamento ausente)",
    oqueEstaErrado: "A modalidade comercial ou tabela de faturamento do cliente não foi definida.",
    impactoNoFluxo: "Trava a geração de duplicata e faturamento comercial.",
    responsavel: "ADMIN",
    responsavelLabel: "Admin",
    detectadoEm: "2026-10-04T11:20:00Z",
    bloqueante: false,
    status: "ATIVA",
    moduloDestino: "Operações por Volume",
    rotaDestino: "/ux-lab/operacoes-volume",
    ctaLabel: "Abrir em Operações",
    detalhesDrawer: {
      oqueAconteceu: "A operação foi concluída em campo, porém o contrato da empresa não possui forma de cobrança associada a esta filial.",
      porqueFluxoParou: "O sistema não consegue determinar se o faturamento é via Boleto Direto ou Fechamento Mensal Consolidado.",
      oquePrecisaSerFeito: "Definir a forma de pagamento padrão nas configurações comerciais da empresa.",
      ondeCorrigir: "Cadastros → Empresas / Regras Comerciais",
      depoisDaCorrecao: "A restrição é levantada e a operação segue diretamente para o lote de Faturamento.",
      rastreabilidade: {
        origem: "Motor de Regras Comerciais",
        detectadoPor: "Sistema ORBE (Validação de Contrato)",
        detectadoEm: "04/10/2026 às 11:20",
        ultimaAtualizacao: "04/10/2026 às 11:20",
        dadosTecnicos: { status: "EM_RESTRICAO", forma_pagamento_id: null },
      },
    },
  },

  // =========================================================================
  // 2. SERVIÇOS EXTRAS
  // =========================================================================
  {
    id: "inc-sx-01",
    codigo: "SX-2026-03",
    dominio: "SERVICO_EXTRA",
    dominioLabel: "Serviço Extra",
    empresaId: "emp-votorantim",
    empresaNome: "Votorantim Cimentos",
    unidadeNome: "Fábrica Primavera",
    referencia: "Enlonamento de Carreta Especial · 4h",
    natureza: "OPERACIONAL",
    naturezaLabel: "Operacional",
    tituloHumano: "Devolvido para correção de medição de horas",
    oqueEstaErrado: "Horas de enlonamento informadas superiores ao limite autorizado na Ordem de Serviço.",
    impactoNoFluxo: "Trava a autorização financeira e emissão de cobrança ao cliente.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T10:05:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Serviços Extras",
    rotaDestino: "/ux-lab/servicos-extras",
    ctaLabel: "Abrir em Serviços Extras",
    detalhesDrawer: {
      oqueAconteceu: "O supervisor de faturamento identificou que foram lançadas 4h de serviço, enquanto o ticket de entrada registrou apenas 2h15 de permanência da carreta.",
      porqueFluxoParou: "Não é permitido faturar horas divergentes do registro de portaria do cliente.",
      oquePrecisaSerFeito: "Ajustar o apontamento de horas conforme o ticket físico ou anexar justificativa assinada pelo cliente.",
      ondeCorrigir: "Serviços Extras → Detalhe do Serviço SX-2026-03",
      depoisDaCorrecao: "O serviço retorna para a fila de aprovação da Central de Aprovações (UX08).",
      rastreabilidade: {
        origem: "Central de Aprovações (Supervisão Financeira)",
        detectadoPor: "Carlos Eduardo (Supervisor)",
        detectadoEm: "04/10/2026 às 10:05",
        ultimaAtualizacao: "04/10/2026 às 10:05",
        motivoDevolucao: "Horas apontadas (4h) excedem o ticket de permanência da fábrica (2h15). Ajustar apontamento.",
        dadosTecnicos: { status: "DEVOLVIDO", quantidade_informada: 4, limite_os: 2.25 },
      },
    },
  },
  {
    id: "inc-sx-02",
    codigo: "SX-2026-08",
    dominio: "SERVICO_EXTRA",
    dominioLabel: "Serviço Extra",
    empresaId: "emp-mdias",
    empresaNome: "M. Dias Branco Alimentos",
    unidadeNome: "Moinho Belém",
    referencia: "Remontagem de Paletes Avariados · 18 paletes",
    natureza: "DOCUMENTAL",
    naturezaLabel: "Documental",
    tituloHumano: "Comprovante de medição física não anexado",
    oqueEstaErrado: "Falta o registro fotográfico ou laudo de avaria exigido pelo cliente para faturamento.",
    impactoNoFluxo: "Trava a aprovação da medição e liberação do pagamento da equipe.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T12:00:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Serviços Extras",
    rotaDestino: "/ux-lab/servicos-extras",
    ctaLabel: "Abrir em Serviços Extras",
    detalhesDrawer: {
      oqueAconteceu: "O serviço de remontagem exige anexo de foto dos paletes recuperados como evidência contratual.",
      porqueFluxoParou: "O cliente recusa o faturamento de serviços de avaria sem anexo documental.",
      oquePrecisaSerFeito: "Fazer o upload da foto dos paletes ou relatório assinado pelo conferente do cliente.",
      ondeCorrigir: "Serviços Extras → Anexar Documento",
      depoisDaCorrecao: "Com o comprovante anexado, o item avança para aprovação operacional e faturamento.",
      rastreabilidade: {
        origem: "Validação Contratual",
        detectadoPor: "Sistema ORBE (Checklist Documental)",
        detectadoEm: "04/10/2026 às 12:00",
        ultimaAtualizacao: "04/10/2026 às 12:00",
        dadosTecnicos: { comprovante_url: null, exige_comprovante: true },
      },
    },
  },

  // =========================================================================
  // 3. CUSTOS EXTRAS
  // =========================================================================
  {
    id: "inc-cx-01",
    codigo: "CX-2026-19",
    dominio: "CUSTO_EXTRA",
    dominioLabel: "Custo Extra",
    empresaId: "emp-esclog",
    empresaNome: "ESC Logística Matriz",
    unidadeNome: "Garagem Central",
    referencia: "Aquisição de EPI Emergencial · R$ 380,00",
    natureza: "DOCUMENTAL",
    naturezaLabel: "Documental",
    tituloHumano: "Comprovante fiscal não foi anexado",
    oqueEstaErrado: "Despesa lançada sem cupom fiscal ou nota de compra digitalizada.",
    impactoNoFluxo: "Trava a aprovação do reembolso e prestação de contas no Financeiro.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T13:10:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Custos Extras",
    rotaDestino: "/ux-lab/custos-extras",
    ctaLabel: "Abrir em Custos Extras",
    detalhesDrawer: {
      oqueAconteceu: "O encarregado comprou luvas e óculos de proteção mas esqueceu de enviar a foto da nota fiscal no formulário.",
      porqueFluxoParou: "Nenhuma despesa de caixa ou reembolso pode ser autorizada sem comprovação fiscal idônea.",
      oquePrecisaSerFeito: "Anexar a foto legível do cupom fiscal ou DANFE da compra.",
      ondeCorrigir: "Custos Extras → Anexar Comprovante",
      depoisDaCorrecao: "O custo extra ingressa na Central de Aprovações para liberação do pagamento.",
      rastreabilidade: {
        origem: "Portal do Encarregado (Lançamento de Despesa)",
        detectadoPor: "Motor Financeiro de Governança",
        detectadoEm: "04/10/2026 às 13:10",
        ultimaAtualizacao: "04/10/2026 às 13:10",
        dadosTecnicos: { comprovante_url: null, valor: 380.0, categoria: "EPI" },
      },
    },
  },
  {
    id: "inc-cx-02",
    codigo: "CX-2026-24",
    dominio: "CUSTO_EXTRA",
    dominioLabel: "Custo Extra",
    empresaId: "emp-ceramica",
    empresaNome: "Cerâmica Belém Unidade Industrial",
    unidadeNome: "CD Ananindeua",
    referencia: "Serviço de Solda Mecânica · R$ 450,00",
    natureza: "FINANCEIRO_PAGAMENTO",
    naturezaLabel: "Financeiro",
    tituloHumano: "Favorecido sem chave PIX ou CPF/CNPJ válido",
    oqueEstaErrado: "A chave PIX informada para o prestador autônomo é inexistente no Banco Central.",
    impactoNoFluxo: "Trava a inclusão no lote de pagamento e geração do arquivo bancário.",
    responsavel: "FINANCEIRO",
    responsavelLabel: "Financeiro",
    detectadoEm: "2026-10-04T14:25:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Custos Extras",
    rotaDestino: "/ux-lab/custos-extras",
    ctaLabel: "Abrir em Custos Extras",
    detalhesDrawer: {
      oqueAconteceu: "O prestador informou uma chave PIX com dígito invertido, impedindo a validação automática na remessa bancária.",
      porqueFluxoParou: "A inclusão de dados bancários inválidos rejeita o arquivo de remessa CNAB240 do banco pagador.",
      oquePrecisaSerFeito: "Solicitar chave PIX correta ao prestador e atualizar o favorecido no lançamento.",
      ondeCorrigir: "Custos Extras → Favorecido / Dados Bancários",
      depoisDaCorrecao: "O lançamento fica apto para inclusão no próximo lote de pagamentos do Financeiro.",
      rastreabilidade: {
        origem: "Pré-validação Bancária CNAB",
        detectadoPor: "Validador Motor CNAB240",
        detectadoEm: "04/10/2026 às 14:25",
        ultimaAtualizacao: "04/10/2026 às 14:25",
        dadosTecnicos: { favorecido: "Oficina de Solda Ramos", chave_pix: "999888777000", validacao_bancaria: false },
      },
    },
  },

  // =========================================================================
  // 4. DIARISTAS
  // =========================================================================
  {
    id: "inc-dia-01",
    codigo: "DIA-2026-S43-01",
    dominio: "DIARISTA",
    dominioLabel: "Diaristas",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Diarista: Marcos Antônio Silva (CPF ...482-01)",
    natureza: "CADASTRAL_VINCULO",
    naturezaLabel: "Cadastral",
    tituloHumano: "Dados bancários ausentes (impede geração de pagamento CNAB)",
    oqueEstaErrado: "O diarista possui diárias válidas na semana, mas não tem conta ou PIX cadastrado.",
    impactoNoFluxo: "Trava a geração do lote CNAB240 e o pagamento de toda a remessa semanal.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T08:30:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Central de Cadastros",
    rotaDestino: "/cadastros",
    ctaLabel: "Abrir em Cadastros",
    detalhesDrawer: {
      oqueAconteceu: "O colaborador diarista trabalhou 4 diárias na Semana 43, mas seu cadastro básico não contém agência/conta nem chave PIX.",
      porqueFluxoParou: "O validador fail-closed do CNAB240 barra o fechamento do lote enquanto houver beneficiário sem dados bancários completos.",
      oquePrecisaSerFeito: "Cadastrar a chave PIX ou conta bancária válida no perfil do colaborador diarista.",
      ondeCorrigir: "Central de Cadastros → Colaboradores → Marcos Antônio Silva",
      depoisDaCorrecao: "O lote semanal de diaristas é recalculado e liberado para geração da remessa bancária no Financeiro.",
      rastreabilidade: {
        origem: "Validador Motor CNAB240 (validarBeneficiarios)",
        detectadoPor: "Sistema ORBE (Regra de Pagamento)",
        detectadoEm: "04/10/2026 às 08:30",
        ultimaAtualizacao: "04/10/2026 às 08:30",
        dadosTecnicos: { total_diarias: 4, valor_semanal: 600.0, banco_codigo: null, chave_pix: null },
      },
    },
  },
  {
    id: "inc-dia-02",
    codigo: "DIA-2026-S43-L02",
    dominio: "DIARISTA",
    dominioLabel: "Diaristas",
    empresaId: "emp-votorantim",
    empresaNome: "Votorantim Cimentos",
    unidadeNome: "Fábrica Primavera",
    referencia: "Lote Semanal Diaristas · Semana 43 · 8 Colaboradores",
    natureza: "RH_PONTO",
    naturezaLabel: "RH & Ponto",
    tituloHumano: "Lote semanal devolvido pelo RH por duplicidade de presença",
    oqueEstaErrado: "Foram registradas 2 diárias cheias no mesmo dia para o colaborador Rafael Costa.",
    impactoNoFluxo: "Trava a validação RH do lote e o envio para aprovação financeira.",
    responsavel: "ENCARREGADO",
    responsavelLabel: "Encarregado",
    detectadoEm: "2026-10-04T15:00:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Grade de Diaristas",
    rotaDestino: "/rh/diaristas",
    ctaLabel: "Abrir em Diaristas",
    detalhesDrawer: {
      oqueAconteceu: "O encarregado marcou presença na grade matutina e na grade noturna para o mesmo colaborador na terça-feira (01/10).",
      porqueFluxoParou: "A política operacional proíbe acúmulo de duas diárias integrais no mesmo turno/data sem autorização de hora extra.",
      oquePrecisaSerFeito: "Ajustar a marcação na grade semanal para 1 diária ou converter a segunda em adicional de horas.",
      ondeCorrigir: "Pessoas & RH → Diaristas (Grade & Lotes)",
      depoisDaCorrecao: "O lote é revalidado e avança para aprovação e fechamento do RH.",
      rastreabilidade: {
        origem: "Painel de Fechamento de Diaristas",
        detectadoPor: "Juliana Mendes (Analista RH)",
        detectadoEm: "04/10/2026 às 15:00",
        ultimaAtualizacao: "04/10/2026 às 15:00",
        motivoDevolucao: "Duplicidade de marcação para Rafael Costa na terça-feira. Ajustar para 1 diária.",
        dadosTecnicos: { status: "DEVOLVIDO", lote_id: "lote-dia-s43-02", total_colaboradores: 8 },
      },
    },
  },

  // =========================================================================
  // 5. INTERMITENTES
  // =========================================================================
  {
    id: "inc-int-01",
    codigo: "INT-2026-44",
    dominio: "INTERMITENTE",
    dominioLabel: "Intermitentes",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Lançamento Importado: Fernando Santos (CPF ...771-33)",
    natureza: "CADASTRAL_VINCULO",
    naturezaLabel: "Cadastral",
    tituloHumano: "Colaborador não vinculado (órfão cadastral na importação)",
    oqueEstaErrado: "O CPF do colaborador presente no arquivo CSV não está cadastrado na base oficial.",
    impactoNoFluxo: "Trava o fechamento do lote de intermitentes e o repasse financeiro.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T07:45:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Central de Cadastros",
    rotaDestino: "/cadastros",
    ctaLabel: "Abrir em Cadastros",
    detalhesDrawer: {
      oqueAconteceu: "A importação diária de intermitentes processou o apontamento de horas, mas o CPF 123.456.771-33 não possui registro na tabela de colaboradores.",
      porqueFluxoParou: "Lançamentos sem colaborador vinculado ficam órfãos e não podem gerar folha nem remessa de pagamento.",
      oquePrecisaSerFeito: "Realizar o pré-cadastro ou cadastro completo do colaborador na Central de Cadastros.",
      ondeCorrigir: "Central de Cadastros → Novo Colaborador",
      depoisDaCorrecao: "O vínculo `colaborador_id` é preenchido automaticamente e o lançamento entra no fechamento do período.",
      rastreabilidade: {
        origem: "Importador Automático de Intermitentes (CSV)",
        detectadoPor: "Motor de Saneamento de Importação",
        detectadoEm: "04/10/2026 às 07:45",
        ultimaAtualizacao: "04/10/2026 às 07:45",
        dadosTecnicos: { colaborador_id: null, cpf_importado: "123.456.771-33", horas_trabalhadas: 8.5 },
      },
    },
  },
  {
    id: "inc-int-02",
    codigo: "INT-2026-45",
    dominio: "INTERMITENTE",
    dominioLabel: "Intermitentes",
    empresaId: "all",
    empresaNome: "Sem Empresa Associada",
    unidadeNome: "Departamento DEP-LOG-NOVO",
    referencia: "Lançamento Importado: Rodrigo Alencar (Matrícula 9012)",
    natureza: "CADASTRAL_VINCULO",
    naturezaLabel: "Cadastral",
    tituloHumano: "Empresa não associada ao lançamento",
    oqueEstaErrado: "O departamento informado no arquivo de ponto não possui correspondência com as empresas do ORBE.",
    impactoNoFluxo: "Trava o fechamento do lote da unidade e apropriação de custos.",
    responsavel: "ADMIN",
    responsavelLabel: "Admin",
    detectadoEm: "2026-10-04T07:50:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Central de Cadastros",
    rotaDestino: "/cadastros",
    ctaLabel: "Abrir em Cadastros",
    detalhesDrawer: {
      oqueAconteceu: "O arquivo de ponto continha o departamento `DEP-LOG-NOVO`, que ainda não foi mapeado para nenhuma empresa ou filial ativa.",
      porqueFluxoParou: "Sem `empresa_id`, o sistema não sabe a qual centro de custo ou cliente a despesa pertence.",
      oquePrecisaSerFeito: "Mapear o departamento externo para a empresa correta nas configurações de integração.",
      ondeCorrigir: "Cadastros & Sistema → Mapeamento de Empresas / Departamentos",
      depoisDaCorrecao: "O lançamento é associado à empresa correspondente e fica elegível para fechamento.",
      rastreabilidade: {
        origem: "Importador Automático de Intermitentes",
        detectadoPor: "Motor de Ingestão de Ponto",
        detectadoEm: "04/10/2026 às 07:50",
        ultimaAtualizacao: "04/10/2026 às 07:50",
        dadosTecnicos: { empresa_id: null, departamento_origem: "DEP-LOG-NOVO" },
      },
    },
  },
  {
    id: "inc-int-03",
    codigo: "INT-2026-49",
    dominio: "INTERMITENTE",
    dominioLabel: "Intermitentes",
    empresaId: "emp-norte",
    empresaNome: "Distribuidora Norte Brasil",
    unidadeNome: "CD Castanhal",
    referencia: "Apontamento Noturno: Roberto Lima · R$ 220,00",
    natureza: "OPERACIONAL",
    naturezaLabel: "Operacional",
    tituloHumano: "Lançamento intermitente devolvido pelo RH",
    oqueEstaErrado: "Adicional noturno lançado em horário diurno sem respaldo de escala de convocação.",
    impactoNoFluxo: "Trava a validação do fechamento da competência quinzenal.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T16:15:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Intermitentes",
    rotaDestino: "/operacional/intermitentes-recebidos",
    ctaLabel: "Abrir em Intermitentes",
    detalhesDrawer: {
      oqueAconteceu: "O RH identificou cobrança de taxa de adicional noturno em convocação que encerrou às 18h00.",
      porqueFluxoParou: "Valores divergentes da escala contratada não podem ser enviados para autorização de pagamento.",
      oquePrecisaSerFeito: "Revisar as horas e recalcular o valor da convocação intermitente.",
      ondeCorrigir: "Pessoas & RH → Intermitentes → Roberto Lima",
      depoisDaCorrecao: "O lançamento é liberado e incorporado ao lote quinzenal de fechamento.",
      rastreabilidade: {
        origem: "Conferência de Convocação RH",
        detectadoPor: "Mariana Souza (Analista RH)",
        detectadoEm: "04/10/2026 às 16:15",
        ultimaAtualizacao: "04/10/2026 às 16:15",
        motivoDevolucao: "Adicional noturno indevido para turno das 10h às 18h. Recalcular valor base.",
        dadosTecnicos: { status_pipeline: "DEVOLVIDO", valor_solicitado: 220.0, valor_correto: 180.0 },
      },
    },
  },

  // =========================================================================
  // 6. CLT / PONTO (GATES 1 A 4)
  // =========================================================================
  {
    id: "inc-clt-01",
    codigo: "PNT-2026-081",
    dominio: "PONTO_CLT",
    dominioLabel: "Ponto CLT",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Colaborador: Lucas Moura · Matrícula 1042",
    natureza: "CADASTRAL_VINCULO",
    naturezaLabel: "Cadastral",
    tituloHumano: "Cadastro pendente de complemento contratual (Gate 1)",
    oqueEstaErrado: "Colaborador importado com cadastro provisório (faltam salário-base e modelo de cálculo).",
    impactoNoFluxo: "Trava o cálculo de saldo de horas e fechamento da folha mensal.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T07:05:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Central de Cadastros",
    rotaDestino: "/cadastros",
    ctaLabel: "Abrir em Cadastros",
    detalhesDrawer: {
      oqueAconteceu: "O colaborador foi pré-cadastrado na importação do REP, mas seu perfil está como `pendente_complemento`.",
      porqueFluxoParou: "O Gate 1 do Motor CLT exige tipo de contrato, modelo de cálculo e valor-base para calcular proventos com segurança jurídica.",
      oquePrecisaSerFeito: "Completar os dados contratuais e salário na Central de Cadastros.",
      ondeCorrigir: "Central de Cadastros → Colaboradores → Lucas Moura",
      depoisDaCorrecao: "O Gate 1 é aprovado e o ponto do colaborador avança automaticamente para apuração da jornada.",
      rastreabilidade: {
        origem: "Motor de Avaliação de Gates CLT (Gate 1 — Cadastral)",
        detectadoPor: "rhPresentation.service (Gate 1)",
        detectadoEm: "04/10/2026 às 07:05",
        ultimaAtualizacao: "04/10/2026 às 07:05",
        dadosTecnicos: { statusVisual: "CADASTRO_PENDENTE", cadastro_provisorio: true, salario_base: null },
      },
    },
  },
  {
    id: "inc-clt-02",
    codigo: "PNT-2026-082",
    dominio: "PONTO_CLT",
    dominioLabel: "Ponto CLT",
    empresaId: "emp-votorantim",
    empresaNome: "Votorantim Cimentos",
    unidadeNome: "Fábrica Primavera",
    referencia: "Colaboradora: Juliana Costa · 03/10/2026",
    natureza: "RH_PONTO",
    naturezaLabel: "RH & Ponto",
    tituloHumano: "Jornada de trabalho não parametrizada (Gate 2)",
    oqueEstaErrado: "Não existe escala de trabalho configurada para este colaborador ou filial nesta data.",
    impactoNoFluxo: "Trava o cálculo de horas extras e compensação de jornada.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T07:10:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Regras Operacionais",
    rotaDestino: "/regras-operacionais",
    ctaLabel: "Abrir em Regras",
    detalhesDrawer: {
      oqueAconteceu: "O sistema encontrou batidas de ponto legítimas, mas não localizou nenhuma escala de trabalho (ex: 44h semanais, 12x36 ou 5x2) vinculada.",
      porqueFluxoParou: "Sem jornada de referência, é impossível calcular se as horas trabalhadas são normais ou extras.",
      oquePrecisaSerFeito: "Vincular uma jornada de trabalho ativa ao colaborador ou cadastrar a escala da filial.",
      ondeCorrigir: "Regras & Tarifas → Jornadas de Trabalho",
      depoisDaCorrecao: "O Gate 2 é liberado e o ponto é recalculado contra a jornada configurada.",
      rastreabilidade: {
        origem: "JornadaResolver.ts (Gate 2 — Jornada)",
        detectadoPor: "Motor de Avaliação de Gates CLT",
        detectadoEm: "04/10/2026 às 07:10",
        ultimaAtualizacao: "04/10/2026 às 07:10",
        dadosTecnicos: { statusVisual: "JORNADA_NAO_PARAMETRIZADA", jornada_id: null },
      },
    },
  },
  {
    id: "inc-clt-03",
    codigo: "PNT-2026-083",
    dominio: "PONTO_CLT",
    dominioLabel: "Ponto CLT",
    empresaId: "emp-mdias",
    empresaNome: "M. Dias Branco Alimentos",
    unidadeNome: "Moinho Belém",
    referencia: "Colaborador: Carlos Mendes · 02/10/2026",
    natureza: "RH_PONTO",
    naturezaLabel: "RH & Ponto",
    tituloHumano: "Regra de banco de horas não configurada (Gate 3)",
    oqueEstaErrado: "A jornada foi identificada, mas a política de compensação de horas não foi homologada.",
    impactoNoFluxo: "Trava a apuração de saldo e consolidação do banco de horas mensal.",
    responsavel: "ADMIN",
    responsavelLabel: "Admin",
    detectadoEm: "2026-10-04T07:12:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Regras Operacionais",
    rotaDestino: "/regras-operacionais",
    ctaLabel: "Abrir em Regras",
    detalhesDrawer: {
      oqueAconteceu: "A empresa possui colaboradores CLT mas a convenção coletiva com limites de tolerância e percentuais de hora extra não foi ativada.",
      porqueFluxoParou: "O princípio fail-closed bloqueia qualquer fallback silencioso para evitar passivos trabalhistas.",
      oquePrecisaSerFeito: "Parametrizar e ativar a regra de banco de horas da empresa.",
      ondeCorrigir: "Regras & Tarifas → Regras de Banco de Horas",
      depoisDaCorrecao: "Com a regra ativa, os saldos diários e acumulados são processados automaticamente.",
      rastreabilidade: {
        origem: "MotorExecutavel.resolveRule (Gate 3 — Política de Banco)",
        detectadoPor: "Motor Operacional CLT",
        detectadoEm: "04/10/2026 às 07:12",
        ultimaAtualizacao: "04/10/2026 às 07:12",
        dadosTecnicos: { statusVisual: "REGRA_BANCO_NAO_PARAMETRIZADA", isFallback: true },
      },
    },
  },
  {
    id: "inc-clt-04",
    codigo: "PNT-2026-084",
    dominio: "PONTO_CLT",
    dominioLabel: "Ponto CLT",
    empresaId: "emp-esclog",
    empresaNome: "ESC Logística Matriz",
    unidadeNome: "Matriz Belém",
    referencia: "Colaborador: André Almeida · 03/10/2026",
    natureza: "RH_PONTO",
    naturezaLabel: "RH & Ponto",
    tituloHumano: "Marcação incompleta (Gate 4 — falta batida de almoço)",
    oqueEstaErrado: "O coletor registrou apenas entrada (08:00) e saída (17:00), sem o intervalo intrajornada.",
    impactoNoFluxo: "Trava o cálculo da jornada líquida e o fechamento do espelho de ponto.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T07:15:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Processamento RH",
    rotaDestino: "/banco-horas/processamento",
    ctaLabel: "Abrir no Processamento RH",
    detalhesDrawer: {
      oqueAconteceu: "O colaborador esqueceu de bater o ponto na saída ou no retorno do almoço.",
      porqueFluxoParou: "O cálculo de horas líquidas não pode ser inferido sem as 4 marcações regulamentares.",
      oquePrecisaSerFeito: "Regularizar a marcação faltante no modal auditável com justificativa formal.",
      ondeCorrigir: "Pessoas & RH → Processamento RH → Regularizar Marcação",
      depoisDaCorrecao: "A regularização é salva em `registros_ponto_regularizacoes` e o ponto torna-se apto para cálculo.",
      rastreabilidade: {
        origem: "MarcacoesPontoParser (Gate 4 — Integridade)",
        detectadoPor: "Motor de Avaliação de Batidas",
        detectadoEm: "04/10/2026 às 07:15",
        ultimaAtualizacao: "04/10/2026 às 07:15",
        dadosTecnicos: { statusVisual: "MARCACAO_INCOMPLETA", batidas: ["08:00", "—", "—", "17:00"] },
      },
    },
  },
  {
    id: "inc-clt-05",
    codigo: "PNT-2026-085",
    dominio: "PONTO_CLT",
    dominioLabel: "Ponto CLT",
    empresaId: "emp-ambev",
    empresaNome: "Cervejaria Ambev S.A.",
    unidadeNome: "CD Benevides",
    referencia: "Colaboradora: Beatriz Rocha · 02/10/2026",
    natureza: "RH_PONTO",
    naturezaLabel: "RH & Ponto",
    tituloHumano: "Marcação inválida (Gate 4 — horários fora de ordem cronológica)",
    oqueEstaErrado: "A saída de almoço (13:30) foi registrada com horário posterior ao retorno (13:00).",
    impactoNoFluxo: "Trava a apuração de horas para evitar cálculo negativo de intervalo.",
    responsavel: "RH",
    responsavelLabel: "RH",
    detectadoEm: "2026-10-04T07:20:00Z",
    bloqueante: true,
    status: "ATIVA",
    moduloDestino: "Processamento RH",
    rotaDestino: "/banco-horas/processamento",
    ctaLabel: "Abrir no Processamento RH",
    detalhesDrawer: {
      oqueAconteceu: "Houve inversão no registro das batidas de almoço no relógio de ponto físico.",
      porqueFluxoParou: "Horários cronologicamente invertidos corrompem o cálculo de horas trabalhadas.",
      oquePrecisaSerFeito: "Ajustar os horários reais no modal de regularização auditável do RH.",
      ondeCorrigir: "Pessoas & RH → Processamento RH → Regularizar Marcação",
      depoisDaCorrecao: "O espelho de ponto é atualizado e validado pelo Motor RH.",
      rastreabilidade: {
        origem: "MarcacoesPontoParser (Gate 4 — Integridade)",
        detectadoPor: "Motor de Validação Cronológica",
        detectadoEm: "04/10/2026 às 07:20",
        ultimaAtualizacao: "04/10/2026 às 07:20",
        dadosTecnicos: { statusVisual: "MARCACAO_INVALIDA", batidas: ["08:00", "13:30", "13:00", "17:00"] },
      },
    },
  },
];
