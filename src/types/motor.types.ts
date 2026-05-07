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
  ESPECIFICA = 100, // Regra pontual de uma operação
  EMPRESA = 80, // Regra para a empresa/cliente (ex: contrato)
  SERVICO = 60, // Regra para o tipo de serviço (ex: descarga padrão)
  COLABORADOR = 40, // Regra específica por colaborador
  GLOBAL = 20, // Regra genérica / fallback
}

export type AbstractRule = {
  id: string;
  nome: string;
  tipoOrigem: "regras_operacionais" | "banco_horas_regras" | "regras_diaristas" | "banco_horas_fallback";
  prioridade: RulePriority;
  status: "ativo" | "inativo" | "pendente" | string;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
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
