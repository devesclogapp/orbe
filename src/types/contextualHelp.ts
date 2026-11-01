export type HelpGuideStep = {
  step: number;
  title: string;
  description: string;
};

export type HelpGuideField = {
  term: string;
  explanation: string;
  type?: 'campo' | 'status' | 'indicador' | 'regra';
};

export type HelpGuideIssue = {
  question: string;
  answer: string;
};

export type PipelineStepData = {
  id: string;
  stepNumber: number;
  name: string;
  objective: string;
  responsibleRole: ('ADMIN' | 'SUPER_ADMIN' | 'GESTOR' | 'RH' | 'FINANCEIRO' | 'ENCARREGADO' | 'CLIENTE' | 'SISTEMA')[];
  conditionsToAdvance: string;
  nextStepPossible: string;
  screenPath?: string;
};

export type BusinessPipeline = {
  id: string;
  title: string;
  description: string;
  flowType:
    | 'OPERACAO_VOLUME'
    | 'DIARISTAS'
    | 'SERVICOS_EXTRAS'
    | 'CUSTOS_EXTRAS'
    | 'CLT_PONTO'
    | 'INTERMITENTES'
    | 'RECEITAS'
    | 'DESPESAS_CNAB'
    | 'RH_CENTRAL';
  steps: PipelineStepData[];
};

export type HelpGuideData = {
  id: string;
  routePattern: string;
  title: string;
  category: string;
  targetRole?: ('ADMIN' | 'RH' | 'FINANCEIRO' | 'ENCARREGADO' | 'CLIENTE')[];
  purpose: string;
  whenToUse: string;
  howItWorks: HelpGuideStep[];
  fieldsAndStatus: HelpGuideField[];
  checklist: string[];
  nextSteps: string;
  commonIssues: HelpGuideIssue[];
  pipelineId?: string;
  currentPipelineStepId?: string;
};

