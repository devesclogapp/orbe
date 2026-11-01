/**
 * pontoDecisao.types.ts
 *
 * Tipos para a Camada Auditável de Decisão RH do Ponto (FIX CP06.6-A).
 * Princípio: Decisão RH é um overlay de governança sobre o ponto original,
 * nunca uma sobrescrita silenciosa do dado factual.
 */

export type TipoDecisaoPonto =
  | "FALTA_INJUSTIFICADA_CONFIRMADA"
  | "FALTA_JUSTIFICADA_ABONADA"
  | "DSR_DIRECIONADO_BANCO_HORAS"
  | "DSR_DIRECIONADO_HORA_EXTRA";

export interface PontoDecisao {
  id: string;
  tenant_id: string;
  registro_ponto_id: string;
  colaborador_id: string;
  data: string;
  tipo_decisao: TipoDecisaoPonto;
  justificativa: string;
  executado_por: string;
  executado_por_nome: string;
  ativo: boolean;
  substituido_por?: string | null;
  revogado_por?: string | null;
  revogado_em?: string | null;
  motivo_revogacao?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrarDecisaoInput {
  registroPontoId: string;
  colaboradorId?: string;
  data?: string;
  tipoDecisao: TipoDecisaoPonto;
  justificativa: string;
}

export interface RevogarDecisaoInput {
  decisaoId: string;
  motivoRevogacao: string;
}

export interface PontoDecisaoOverlay {
  id: string;
  tipo_decisao: TipoDecisaoPonto;
  justificativa: string;
  executado_por_nome: string;
  created_at: string;
}
