import { BusinessPipeline } from '@/types/contextualHelp';

/**
 * Catálogo Canônico de Pipelines de Processo do ORBE ERP.
 * Mapeado a partir dos fluxos reais implementados no banco e nas telas do sistema.
 */
export const BUSINESS_PIPELINES: Record<string, BusinessPipeline> = {
  // ==========================================
  // 1. OPERAÇÕES POR VOLUME (Pipeline de Receitas)
  // ==========================================
  'pipeline-operacoes-volume': {
    id: 'pipeline-operacoes-volume',
    title: 'Ciclo de Operações por Volume & Receitas',
    description: 'Fluxo que controla desde o lançamento da carga/descarga na doca até a aprovação operacional, validação RH, cobrança e conciliação bancária.',
    flowType: 'OPERACAO_VOLUME',
    steps: [
      {
        id: 'op-lancamento',
        stepNumber: 1,
        name: 'Lançamento em Campo (Doca)',
        objective: 'Registrar a operação realizada na unidade informando empresa, serviço, volume, placa, colaboradores e horários de turno.',
        responsibleRole: ['ENCARREGADO', 'GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Volume maior que zero, horários de entrada e saída válidos (HH:MM) e ao menos um colaborador vinculado.',
        nextStepPossible: 'Aprovação Operacional (Supervisão).',
        screenPath: '/producao',
      },
      {
        id: 'op-aprovacao-operacional',
        stepNumber: 2,
        name: 'Aprovação Operacional',
        objective: 'Supervisão audita integridade física e operacional do lançamento via rpc_operacao_validar_aprovar, gerando receita a faturar.',
        responsibleRole: ['ADMIN', 'SUPER_ADMIN', 'GESTOR', 'FINANCEIRO'],
        conditionsToAdvance: 'Sem restrições operacionais ativas (EM_RESTRICAO bloqueado), horários consistentes e conferência concluída.',
        nextStepPossible: 'Validação pelo RH e Classificação Comercial no Financeiro.',
        screenPath: '/operacoes-volume',
      },
      {
        id: 'op-validacao-rh',
        stepNumber: 3,
        name: 'Validação RH da Equipe',
        objective: 'RH audita apontamentos e horas dos colaboradores alocados, aprovando a produção via rpc_rh_aprovar_operacao.',
        responsibleRole: ['RH', 'ADMIN', 'SUPER_ADMIN', 'GESTOR'],
        conditionsToAdvance: 'Operação já aprovada na doca (status em AGUARDANDO_FATURAMENTO ou posterior). Não permite aprovação prematura.',
        nextStepPossible: 'Conclusão da operação (se receita já recebida) ou permanência aguardando recebimento.',
        screenPath: '/rh/aprovacoes',
      },
      {
        id: 'op-faturamento-cobranca',
        stepNumber: 4,
        name: 'Classificação Comercial & Cobrança',
        objective: 'Financeiro define modalidade de cobrança (Caixa Imediato, Boleto/Duplicata ou Faturamento Mensal) e emite cobrança para o cliente.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Operação aprovada operacionalmente com valor total e dados fiscais confirmados.',
        nextStepPossible: 'Confirmação do pagamento pelo cliente.',
        screenPath: '/financeiro/receitas',
      },
      {
        id: 'op-recebimento-conciliacao',
        stepNumber: 5,
        name: 'Recebimento & Conciliação Bancária',
        objective: 'Confirmação da entrada do valor e conciliação com o extrato bancário oficial. Reconhecimento no DRE.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Crédito efetivo em conta corrente ou liquidação confirmada.',
        nextStepPossible: 'Processo concluído e receita conciliada.',
        screenPath: '/financeiro/retorno',
      },
    ],
  },

  // ==========================================
  // 2. DIARISTAS (Ciclo Semanal & Lote RH/Financeiro)
  // ==========================================
  'pipeline-diaristas': {
    id: 'pipeline-diaristas',
    title: 'Ciclo Semanal de Diaristas',
    description: 'Fluxo completo de presença semanal, apuração de diárias, lote RH, remessa CNAB e conciliação de pagamento.',
    flowType: 'DIARISTAS',
    steps: [
      {
        id: 'diarista-grade',
        stepNumber: 1,
        name: 'Apontamento Diário na Grade',
        objective: 'Registrar presença integral (P), meia diária (MP) ou falta (F) de cada diarista convocado na semana.',
        responsibleRole: ['ENCARREGADO', 'GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Turnos preenchidos conforme escala real de campo.',
        nextStepPossible: 'Fechamento do Período Semanal.',
        screenPath: '/producao/diaristas',
      },
      {
        id: 'diarista-fechamento',
        stepNumber: 2,
        name: 'Fechamento do Lote Semanal',
        objective: 'Consolidar os apontamentos da semana em lote único e submeter para auditoria do RH (status AGUARDANDO_VALIDACAO_RH).',
        responsibleRole: ['ENCARREGADO', 'GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Todos os 7 dias da competência devidamente apontados sem pendências abertas.',
        nextStepPossible: 'Auditoria e aprovação na Central de Aprovações do RH.',
        screenPath: '/producao/diaristas',
      },
      {
        id: 'diarista-validacao-rh',
        stepNumber: 3,
        name: 'Validação e Aprovação RH',
        objective: 'RH audita presenças, valores por diária, dados bancários/PIX e aprova ou devolve com justificativa formal.',
        responsibleRole: ['RH', 'ADMIN'],
        conditionsToAdvance: 'Conferência dos valores calculados contra os limites contratuais da unidade.',
        nextStepPossible: 'Envio ao Financeiro para liberação de pagamento.',
        screenPath: '/rh/aprovacoes',
      },
      {
        id: 'diarista-aprovacao-fin-cnab',
        stepNumber: 4,
        name: 'Aprovação Financeira & Remessa CNAB',
        objective: 'Financeiro autoriza lote de despesas e gera arquivo de remessa bancária CNAB 240 / PIX para processamento pelo banco.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Lote aprovado pelo RH e contas bancárias homologadas.',
        nextStepPossible: 'Processamento bancário e download do arquivo de retorno.',
        screenPath: '/financeiro/remessa',
      },
      {
        id: 'diarista-retorno-conciliacao',
        stepNumber: 5,
        name: 'Retorno Bancário & Baixa Individual',
        objective: 'Importação do arquivo de retorno bancário, conciliação e liquidação final dos pagamentos dos diaristas.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Arquivo de retorno bancário processado com sucesso.',
        nextStepPossible: 'Lote marcado como PAGO e arquivado na timeline de auditoria.',
        screenPath: '/financeiro/retorno',
      },
    ],
  },

  // ==========================================
  // 3. SERVIÇOS EXTRAS (Lote 1)
  // ==========================================
  'pipeline-servicos-extras': {
    id: 'pipeline-servicos-extras',
    title: 'Esteira de Serviços Extras',
    description: 'Fluxo para registro e cobrança de serviços extraordinários (paletização, montagem de kits, transbordo ou retrabalho).',
    flowType: 'SERVICOS_EXTRAS',
    steps: [
      {
        id: 'se-lancamento',
        stepNumber: 1,
        name: 'Lançamento em Campo',
        objective: 'Encarregado registra serviço executado fora do contrato padrão informando tipo, descrição, quantidade e empresa.',
        responsibleRole: ['ENCARREGADO', 'GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Descrição clara da atividade e quantidade/valor informados.',
        nextStepPossible: 'Recepção e conferência pela gestão operacional.',
        screenPath: '/producao/servicos-extras',
      },
      {
        id: 'se-conferencia-operacional',
        stepNumber: 2,
        name: 'Conferência Operacional',
        objective: 'Gestor confere se o serviço procede e aprova para faturamento ou devolve para retificação.',
        responsibleRole: ['GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Validação da autorização da empresa cliente.',
        nextStepPossible: 'Geração da receita operacional faturável.',
        screenPath: '/operacional/servicos-extras',
      },
      {
        id: 'se-faturamento',
        stepNumber: 3,
        name: 'Faturamento & Cobrança',
        objective: 'Financeiro inclui o serviço aprovado no faturamento do cliente (à vista ou fatura mensal).',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Serviço com status APROVADO.',
        nextStepPossible: 'Recebimento e conciliação financeira.',
        screenPath: '/financeiro/receitas',
      },
      {
        id: 'se-recebimento-dre',
        stepNumber: 4,
        name: 'Recebimento & Reconhecimento DRE',
        objective: 'Baixa do recebimento e apropriação do resultado no DRE operacional da empresa atendida.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Liquidação da cobrança confirmada.',
        nextStepPossible: 'Receita conciliada.',
        screenPath: '/financeiro/dre',
      },
    ],
  },

  // ==========================================
  // 4. CUSTOS EXTRAS (Lote 1)
  // ==========================================
  'pipeline-custos-extras': {
    id: 'pipeline-custos-extras',
    title: 'Gestão de Custos Extras Operacionais',
    description: 'Fluxo para controle de despesas imprevistas na operação (ferramentas, alimentação, EPIs, combustível ou reparos).',
    flowType: 'CUSTOS_EXTRAS',
    steps: [
      {
        id: 'ce-lancamento',
        stepNumber: 1,
        name: 'Apontamento do Custo em Campo',
        objective: 'Registrar a despesa ocorrida durante o turno anexando recibo/cupom, valor e categoria.',
        responsibleRole: ['ENCARREGADO', 'GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Valor preenchido, categoria selecionada e justificativa informada.',
        nextStepPossible: 'Auditoria pela coordenação operacional.',
        screenPath: '/producao/custos-extras',
      },
      {
        id: 'ce-auditoria-classificacao',
        stepNumber: 2,
        name: 'Auditoria & Classificação',
        objective: 'Coordenação audita legitimidade e define se o custo é operacional (imputável ao cliente) ou despesa interna.',
        responsibleRole: ['GESTOR', 'ADMIN'],
        conditionsToAdvance: 'Comprovante válido e conformidade com o teto de gastos da unidade.',
        nextStepPossible: 'Apropriação no DRE e, se aplicável, reembolso financeiro.',
        screenPath: '/operacional/custos-extras',
      },
      {
        id: 'ce-contas-pagar-dre',
        stepNumber: 3,
        name: 'Impacto no DRE e Pagamento',
        objective: 'Lançamento reduz a margem operacional do contrato no DRE e gera programação de desembolso no financeiro.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Custo aprovado pela coordenação.',
        nextStepPossible: 'Despesa quitada e registrada no fechamento mensal.',
        screenPath: '/financeiro/dre',
      },
    ],
  },

  // ==========================================
  // 5. CLT (Pontos, Horas Extras, Banco de Horas & Folha)
  // ==========================================
  'pipeline-clt-pontos': {
    id: 'pipeline-clt-pontos',
    title: 'Apuração de Pontos CLT & Banco de Horas',
    description: 'Pipeline de captura diária via coletor/REP, motor de regras trabalhistas, compensações e fechamento mensal da folha.',
    flowType: 'CLT_PONTO',
    steps: [
      {
        id: 'clt-coleta-importacao',
        stepNumber: 1,
        name: 'Coleta & Importação REP',
        objective: 'Automação diária (7h) ou importação de arquivos do coletor eletrônico contendo batidas dos colaboradores CLT.',
        responsibleRole: ['SISTEMA', 'RH', 'ADMIN'],
        conditionsToAdvance: 'Arquivo processado sem divergência de matrícula/CPF.',
        nextStepPossible: 'Processamento das regras pelo Motor RH.',
        screenPath: '/rh/pontos',
      },
      {
        id: 'clt-apuracao-motor',
        stepNumber: 2,
        name: 'Apuração pelo Motor RH',
        objective: 'Cálculo automatizado de jornada diária, tolerâncias legais, atrasos, faltas, adicionais noturnos e horas extras.',
        responsibleRole: ['RH', 'ADMIN'],
        conditionsToAdvance: 'Quatro marcações completas ou justificativa de abono deferida pelo RH.',
        nextStepPossible: 'Alimentação do Banco de Horas e Compensações.',
        screenPath: '/rh/pontos',
      },
      {
        id: 'clt-banco-horas',
        stepNumber: 3,
        name: 'Gestão de Banco de Horas',
        objective: 'Apuração dos saldos positivos e negativos no ciclo trimestral, aplicando regras de compensação contratual.',
        responsibleRole: ['RH', 'ADMIN'],
        conditionsToAdvance: 'Período mensal fechado e aprovado.',
        nextStepPossible: 'Consolidação na Folha Mensal CLT.',
        screenPath: '/rh/banco-horas',
      },
      {
        id: 'clt-fechamento-folha',
        stepNumber: 4,
        name: 'Fechamento da Folha Mensal',
        objective: 'Envio das horas homologadas (extras a pagar, descontos e adicionais) para integração contábil e emissão de contracheques.',
        responsibleRole: ['RH', 'FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Todas as inconsistências do mês tratadas e aprovadas pelo gestor.',
        nextStepPossible: 'Competência CLT concluída.',
        screenPath: '/rh/fechamento',
      },
    ],
  },

  // ==========================================
  // 6. INTERMITENTES (Convocação, Horas & Remessa)
  // ==========================================
  'pipeline-intermitentes': {
    id: 'pipeline-intermitentes',
    title: 'Ciclo de Colaboradores Intermitentes',
    description: 'Fluxo para convocação, registro de jornada prestada, cálculo proporcional com encargos e pagamento via CNAB.',
    flowType: 'INTERMITENTES',
    steps: [
      {
        id: 'int-convocacao-horas',
        stepNumber: 1,
        name: 'Convocação & Registro de Horas',
        objective: 'Registro do chamado formal e apontamento das horas trabalhadas no período de prestação intermitente.',
        responsibleRole: ['RH', 'ENCARREGADO', 'ADMIN'],
        conditionsToAdvance: 'Convocação aceita e horários de entrada/saída lançados.',
        nextStepPossible: 'Fechamento do Lote Intermitente.',
        screenPath: '/rh/intermitentes',
      },
      {
        id: 'int-fechamento-lote',
        stepNumber: 2,
        name: 'Fechamento do Lote & Encargos',
        objective: 'Cálculo automático da remuneração proporcional, DSR, 13º proporcional e férias com terço constitucional.',
        responsibleRole: ['RH', 'ADMIN'],
        conditionsToAdvance: 'Período encerrado sem horas em aberto.',
        nextStepPossible: 'Validação pelo Financeiro e inclusão no CNAB.',
        screenPath: '/rh/intermitentes',
      },
      {
        id: 'int-aprovacao-cnab',
        stepNumber: 3,
        name: 'Aprovação Financeira & Remessa',
        objective: 'Geração do arquivo CNAB para liquidação bancária individual dos intermitentes convocados.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Dados bancários e tributários validados.',
        nextStepPossible: 'Processamento bancário.',
        screenPath: '/financeiro/remessa',
      },
      {
        id: 'int-liquidacao-retorno',
        stepNumber: 4,
        name: 'Retorno Bancário & Recibo',
        objective: 'Confirmação da liquidação bancária e disponibilização dos comprovantes individuais de prestação de serviço.',
        responsibleRole: ['FINANCEIRO', 'RH'],
        conditionsToAdvance: 'Retorno processado com sucesso.',
        nextStepPossible: 'Ciclo intermitente concluído.',
        screenPath: '/financeiro/retorno',
      },
    ],
  },

  // ==========================================
  // 7. RECEITAS OPERACIONAIS (Ciclo Completo de Clientes)
  // ==========================================
  'pipeline-receitas-faturamento': {
    id: 'pipeline-receitas-faturamento',
    title: 'Pipeline de Faturamento & Recebimentos',
    description: 'Fluxo desacoplado de despesas que gerencia o ciclo completo de contas a receber das empresas clientes atendidas.',
    flowType: 'RECEITAS',
    steps: [
      {
        id: 'rec-origem-operacional',
        stepNumber: 1,
        name: 'Reconhecimento da Operação',
        objective: 'Operação por Volume ou Serviço Extra aprovado operacionalmente na doca dá origem à receita bruta a faturar.',
        responsibleRole: ['OPERACIONAL', 'GESTOR'],
        conditionsToAdvance: 'Validação operacional confirmada na doca.',
        nextStepPossible: 'Classificação comercial e emissão de cobrança.',
        screenPath: '/operacoes-volume',
      },
      {
        id: 'rec-classificacao-modalidade',
        stepNumber: 2,
        name: 'Classificação Financeira',
        objective: 'Financeiro define condição comercial: À Vista (Caixa Imediato), Duplicata/Boleto ou Faturamento Mensal consolidado.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Contrato comercial e alíquotas de impostos (ISS) configurados.',
        nextStepPossible: 'Emissão e envio para cobrança.',
        screenPath: '/financeiro/receitas',
      },
      {
        id: 'rec-emissao-cobranca',
        stepNumber: 3,
        name: 'Emissão de Cobrança',
        objective: 'Geração de boleto, fatura ou nota de débito para a empresa tomadora do serviço.',
        responsibleRole: ['FINANCEIRO'],
        conditionsToAdvance: 'Receita devidamente classificada no pipeline.',
        nextStepPossible: 'Acompanhamento do vencimento e liquidação.',
        screenPath: '/financeiro/receitas',
      },
      {
        id: 'rec-confirmacao-recebimento',
        stepNumber: 4,
        name: 'Confirmação de Recebimento',
        objective: 'Registro do pagamento efetuado pelo cliente (PIX, transferência ou crédito). Não depende da conciliação bancária.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Comprovante de pagamento válido recebido.',
        nextStepPossible: 'Encaminhamento à Central de Conciliações e DRE.',
        screenPath: '/financeiro/receitas',
      },
      {
        id: 'rec-conciliacao-dre',
        stepNumber: 5,
        name: 'Conciliação Bancária & DRE',
        objective: 'Cruzamento com extrato bancário na aba Faturamentos e reconhecimento da receita líquida no DRE da competência.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Lançamento bancário correspondente identificado no extrato.',
        nextStepPossible: 'Receita totalmente liquidada e auditada.',
        screenPath: '/financeiro/retorno',
      },
    ],
  },

  // ==========================================
  // 8. DESPESAS OPERACIONAIS & CNAB (Ciclo Fornecedores e Colaboradores)
  // ==========================================
  'pipeline-despesas-cnab': {
    id: 'pipeline-despesas-cnab',
    title: 'Pipeline de Despesas, Remessas & CNAB',
    description: 'Fluxo para autorização e pagamento bancário de lotes de diaristas, intermitentes, fornecedores e custos operacionais.',
    flowType: 'DESPESAS_CNAB',
    steps: [
      {
        id: 'desp-origem-lote',
        stepNumber: 1,
        name: 'Origem da Despesa',
        objective: 'Lote fechado pelo RH (Diaristas/Intermitentes) ou solicitação de fornecedor entra na fila financeira.',
        responsibleRole: ['RH', 'ADMIN'],
        conditionsToAdvance: 'Validação prévia das presenças e valores calculados.',
        nextStepPossible: 'Aprovação financeira e liberação de desembolso.',
        screenPath: '/rh/aprovacoes',
      },
      {
        id: 'desp-aprovacao-gestor',
        stepNumber: 2,
        name: 'Aprovação Financeira',
        objective: 'Gestor financeiro audita totalizadores, limites de caixa e autoriza a inclusão dos pagamentos na remessa bancária.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Saldo disponível e contas favorecidas sem restrições.',
        nextStepPossible: 'Geração de arquivo de remessa CNAB.',
        screenPath: '/financeiro/geral',
      },
      {
        id: 'desp-geracao-remessa',
        stepNumber: 3,
        name: 'Geração de Remessa CNAB',
        objective: 'Geração do lote bancário CNAB 240 / PIX com controle sequencial rigoroso para envio ao internet banking.',
        responsibleRole: ['FINANCEIRO'],
        conditionsToAdvance: 'Dados bancários e chaves PIX completos de todos os favorecidos.',
        nextStepPossible: 'Envio ao banco e retorno no dia útil seguinte.',
        screenPath: '/financeiro/remessa',
      },
      {
        id: 'desp-processamento-retorno',
        stepNumber: 4,
        name: 'Retorno Bancário & Baixa Final',
        objective: 'Importação do arquivo de retorno, conciliação dos comprovantes e quitação dos débitos na base.',
        responsibleRole: ['FINANCEIRO', 'ADMIN'],
        conditionsToAdvance: 'Arquivo de retorno bancário processado sem inconsistências.',
        nextStepPossible: 'Despesas quitadas e integradas ao DRE.',
        screenPath: '/financeiro/retorno',
      },
    ],
  },
};

/**
 * Função utilitária para obter o pipeline associado a um guia contextual pelo ID.
 */
export const getPipelineForGuide = (pipelineId?: string): BusinessPipeline | null => {
  if (!pipelineId) return null;
  return BUSINESS_PIPELINES[pipelineId] || null;
};

/**
 * Resolve o pipeline canônico e a etapa atual a partir do guia contextual.
 * Suporta configuração explícita no guia e fallback inteligente por domínio.
 */
export const resolvePipelineForGuide = (
  guide?: any
): { pipeline: BusinessPipeline; currentStepId?: string } | null => {
  if (!guide) return null;

  let pipelineId = guide.pipelineId;
  let currentStepId = guide.currentPipelineStepId;

  if (!pipelineId && guide.id) {
    const id = guide.id.toLowerCase();
    if (id.includes('volume') || id === 'torre-operacional-pipeline' || (id.includes('operac') && !id.includes('regra'))) {
      pipelineId = 'pipeline-operacoes-volume';
      currentStepId = id.includes('producao') ? 'op-lancamento' : 'op-aprovacao-operacional';
    } else if (id.includes('diarista')) {
      pipelineId = 'pipeline-diaristas';
      currentStepId = id.includes('producao') ? 'diarista-grade' : 'diarista-validacao-rh';
    } else if (id.includes('servico') && id.includes('extra')) {
      pipelineId = 'pipeline-servicos-extras';
      currentStepId = id.includes('producao') ? 'se-lancamento' : 'se-conferencia-operacional';
    } else if (id.includes('custo') && id.includes('extra')) {
      pipelineId = 'pipeline-custos-extras';
      currentStepId = id.includes('producao') ? 'ce-lancamento' : 'ce-auditoria-classificacao';
    } else if (id.includes('clt') || id.includes('ponto') || id.includes('banco-horas') || id.includes('ciclos')) {
      pipelineId = 'pipeline-clt-pontos';
      currentStepId = id.includes('banco') ? 'clt-banco-horas' : (id.includes('ciclos') ? 'clt-fechamento-folha' : 'clt-coleta-importacao');
    } else if (id.includes('intermitente')) {
      pipelineId = 'pipeline-intermitentes';
      currentStepId = 'int-fechamento-lote';
    } else if (id.includes('receita') || id.includes('faturamento') || id.includes('dre')) {
      pipelineId = 'pipeline-receitas-faturamento';
      currentStepId = id.includes('faturamento')
        ? 'rec-emissao-cobranca'
        : id.includes('dre')
        ? 'rec-conciliacao-dre'
        : 'rec-classificacao-modalidade';
    } else if (id.includes('despesa') || id.includes('cnab') || id.includes('remessa')) {
      pipelineId = 'pipeline-despesas-cnab';
      currentStepId = 'desp-aprovacao-gestor';
    } else if (id.includes('aprovac')) {
      pipelineId = 'pipeline-operacoes-volume';
      currentStepId = 'op-validacao-rh';
    }
  }

  if (!pipelineId || !BUSINESS_PIPELINES[pipelineId]) return null;

  return {
    pipeline: BUSINESS_PIPELINES[pipelineId],
    currentStepId: currentStepId,
  };
};

