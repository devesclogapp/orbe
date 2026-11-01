/**
 * pontoRegularizacao.types.ts
 *
 * Tipos para a entidade e fluxo de Regularização Controlada de Marcações pelo RH/Admin (FIX CP04.8).
 *
 * Princípio Fundamental:
 * BATIDA ORIGINAL IMPORTADA ≠ BATIDA REGULARIZADA PELO RH.
 * Preservação integral do dado factual importado do RHiD e rastreabilidade total da intervenção humana.
 */

export type CampoMarcacaoRegularizavel = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";

export interface PontoRegularizacao {
  id: string;
  tenant_id: string;
  registro_ponto_id: string;
  colaborador_id: string;
  data: string; // YYYY-MM-DD
  campo_alterado: CampoMarcacaoRegularizavel;
  valor_original: string | null;
  valor_regularizado: string; // HH:MM
  justificativa: string;
  executado_por: string;
  executado_por_nome: string;
  ativo: boolean;
  substituido_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegularizarMarcacaoInput {
  registroPontoId: string;
  colaboradorId: string;
  data: string;
  campo: CampoMarcacaoRegularizavel;
  novoHorario: string; // HH:MM
  justificativa: string;
}

export type RegularizacoesAtivasPontoMap = Partial<
  Record<CampoMarcacaoRegularizavel, PontoRegularizacao>
>;
