export type TipoJornada = "CLT" | "diarista" | "intermitente";

export type Competencia = {
  mes: number;
  ano: number;
  competenciaString: string; // "YYYY-MM"
};

export type CalendarioContext = {
  competencia: Competencia;
  isDomingo: boolean;
  isFeriado: boolean;
  isDiaUtil: boolean;
  jornadaPrevistaDiaria: number; // Ex: fallback 8, CLT 7.33 (220/30)
};

export type OperationalContext = {
  tenantId: string;
  empresaId?: string | null;
  colaboradorId?: string | null;
  operacaoId?: string | null;
  tipoServicoId?: string | null;
  tipoColaborador?: TipoJornada | string;
  dataProcessamento: string; // ISO Date YYYY-MM-DD
  calendario?: CalendarioContext;
};

export enum RulePriority {
  ESPECIFICA = 100, // Regra específica de 1 única empresa
  COMPARTILHADA = 80, // Regra compartilhada entre 2+ empresas selecionadas
  EMPRESA = 80, // Compatibilidade com chamadas anteriores
  SERVICO = 60, // Regra para o tipo de serviço (ex: descarga padrão)
  GERAL_TENANT = 40, // Regra geral para todas as empresas do tenant
  COLABORADOR = 40, // Regra específica por colaborador
  GLOBAL = 20, // Regra genérica / fallback
}

export type EscopoResolvido = "ESPECIFICA" | "COMPARTILHADA" | "GERAL_TENANT" | "SEM_REGRA";

export interface RuleResolutionResult {
  rule: AbstractRule;
  isFallback: boolean;
  escopoResolvido: EscopoResolvido;
}

export type AbstractRule = {
  id: string;
  nome: string;
  tipoOrigem: "regras_operacionais" | "banco_horas_regras" | "regras_diaristas" | "banco_horas_fallback";
  prioridade: RulePriority;
  status: "ativo" | "inativo" | "pendente" | string;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  adicionalHoraExtraPercentual?: number | null;
  escopo?: "TODAS_EMPRESAS" | "COMPARTILHADA" | "ESPECIFICA" | null;
  empresasIds?: string[];
  // Generic fields that map the original table
  payload: Record<string, any>;
};

export type RuleAuditLog = {
  tenantId: string;
  dataProcessamento: string;
  contextoHash: string; // Resumo do operational context
  regraUsadaId?: string;
  regraOrigem?: string;
  prioridadeAplicada?: number;
  foiFallback: boolean;
  mensagem: string;
  timestamp: string;
  // Audit Logs Temporais (Fase 3)
  competenciaUsada?: string;
  jornadaEsperada?: number;
  calendarioAplicado?: boolean;
};
