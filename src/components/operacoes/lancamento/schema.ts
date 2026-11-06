import * as z from "zod";

export interface RegraOcorrenciaLogistica {
  id: string;
  label: string;
  funcoes: string[];
}

export const REGRAS_OCORRENCIAS_LOGISTICA: RegraOcorrenciaLogistica[] = [
  { id: "carga_avaria", label: "Avaria / Dano à Carga", funcoes: ["*"] },
  { id: "carga_integridade", label: "Integridade da Carga / Violação", funcoes: ["*"] },
  { id: "carga_empilhamento", label: "Empilhamento Incorreto / Fora da Norma", funcoes: ["Conferente", "Auxiliar de Logística", "Operador de Empilhadeira", "*"] },
  { id: "carga_segregacao", label: "Segregação Incorreta de Produto", funcoes: ["Conferente", "*"] },
  { id: "epi_ausente", label: "EPI: Não utilização / Uso incorreto de EPI", funcoes: ["*"] },
  { id: "pontualidade_atraso", label: "Atraso injustificado no início da operação", funcoes: ["*"] },
  { id: "desvio_conduta", label: "Desvio de conduta / Postura inadequada", funcoes: ["*"] },
  { id: "uniforme_irregular", label: "Uniforme incompleto / irregular", funcoes: ["*"] },
  { id: "nf_verificacao", label: "Divergência na conferência de NF / Carga", funcoes: ["Conferente", "*"] },
  { id: "veiculo_inspecao", label: "Inspeção pré-operação do veículo negligenciada", funcoes: ["Motorista", "Operador de Empilhadeira", "*"] },
  { id: "veiculo_velocidade", label: "Excesso de velocidade no pátio / armazém", funcoes: ["Motorista", "Operador de Empilhadeira", "*"] },
  { id: "seg_procedimento", label: "Descumprimento de procedimento de segurança operacional", funcoes: ["*"] },
  { id: "outra_ocorrencia", label: "Outra ocorrência operacional", funcoes: ["*"] },
];

export function getRegrasOcorrenciaPorCargo(cargo?: string | null): RegraOcorrenciaLogistica[] {
  if (!cargo) return REGRAS_OCORRENCIAS_LOGISTICA;
  const cargoNorm = cargo.toLowerCase().trim();
  return REGRAS_OCORRENCIAS_LOGISTICA.filter(
    (r) => r.funcoes.includes("*") || r.funcoes.some((f) => f.toLowerCase() === cargoNorm)
  );
}

export const condutaColaboradorSchema = z.object({
  collaborator_id: z.string().optional(),
  had_infraction: z.boolean().default(false),
  infraction_type_id: z.string().optional().nullable(),
  infraction_notes: z.string().optional().nullable(),
  valor_provisorio: z.number().optional().default(0),
  infracao_codigo: z.string().optional().nullable(),
});

export type ColaboradorConduta = z.infer<typeof condutaColaboradorSchema>;

export function validarCondutasEquipe(
  selectedIds: string[],
  condutas: Record<string, { had_infraction: boolean; infraction_type_id?: string | null; infraction_notes?: string | null }> | undefined,
  colaboradores: Array<{ id: string; nome: string }>
): string | null {
  if (!condutas) return null;
  for (const id of selectedIds) {
    const c = condutas[id];
    if (c?.had_infraction) {
      const colab = colaboradores.find((item) => item.id === id);
      const nome = colab?.nome || "Colaborador";
      if (!c.infraction_type_id || c.infraction_type_id.trim() === "") {
        return `Informe o tipo de ocorrência para o colaborador ${nome}.`;
      }
      if (!c.infraction_notes || c.infraction_notes.trim() === "") {
        return `Informe a descrição detalhada da ocorrência para o colaborador ${nome}.`;
      }
    }
  }
  return null;
}

export const productionSchema = z.object({
  // Identificação e Contexto
  tipo_lancamento: z.enum(["operacao_padrao", "transbordo_servico_extra", "custos_extras", "servicos_especificos", "diaristas"]),
  modalidade_financeira: z.enum(["CAIXA_IMEDIATO", "DUPLICATA", "FATURAMENTO_MENSAL", "CUSTO_DESPESA", "FECHAMENTO_MENSAL_EMPRESA", "DUPLICATA_FORNECEDOR"]).default("CAIXA_IMEDIATO"),
  data: z.string().min(1, "Data é obrigatória"),
  empresa_id: z.string().uuid("Selecione uma empresa válida"),
  unidade_id: z.string().uuid("Selecione uma unidade válida").optional().nullable(),
  
  // Serviço e Operação
  tipo_servico: z.string().min(1, "Selecione o tipo de serviço"),
  descricao_servico: z.string().optional(),
  categoria_servico: z.string().default("SERVICO_VOLUME"),
  
  // Entidades Envolvidas
  transportadora: z.string().uuid().optional().nullable(),
  fornecedor: z.string().uuid().optional().nullable(),
  produto: z.string().uuid().optional().nullable(),
  
  // Quantidades e Valores
  quantidade: z.coerce.number().min(0.01, "Quantidade deve ser maior que zero"),
  quantidade_colaboradores: z.coerce.number().min(1, "Mínimo 1 colaborador"),
  valor_unitario: z.coerce.number().optional(),
  valor_unitario_manual: z.coerce.number().optional().nullable(),
  
  // Financeiro
  forma_pagamento: z.string().min(1, "Forma de pagamento é obrigatória"),
  data_vencimento: z.string().optional().nullable(),
  status_financeiro: z.string().default("PENDENTE"),
  
  // Fiscal
  nf_emite: z.boolean().default(false),
  nf_numero: z.string().optional(),
  ctrc: z.string().optional(),
  iss_percentual: z.coerce.number().default(0),
  valor_iss: z.coerce.number().default(0),
  valor_total_liquido: z.coerce.number().default(0),
  
  // Logística / Detalhes
  horario_inicio: z.string().optional(),
  horario_fim: z.string().optional(),
  placa_veiculo: z.string().optional(),
  justificativa_data: z.string().optional(),
  observacao: z.string().optional(),
  responsavel_nome: z.string().optional(),
  regra_periodo_id: z.string().uuid("Selecione um período válido").optional().nullable(),

  // Condutas e Ocorrências dos Colaboradores da Equipe
  condutas: z.record(z.string(), condutaColaboradorSchema).optional(),
});

export type ProductionFormValues = z.infer<typeof productionSchema>;

export const DEFAULT_PRODUCTION_VALUES: Partial<ProductionFormValues> = {
  tipo_lancamento: "operacao_padrao",
  modalidade_financeira: "CAIXA_IMEDIATO",
  data: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
  quantidade: 0,
  quantidade_colaboradores: 1,
  nf_emite: false,
  status_financeiro: "PENDENTE",
  categoria_servico: "SERVICO_VOLUME",
};
