import * as z from "zod";

export const productionSchema = z.object({
  // Identificação e Contexto
  tipo_lancamento: z.enum(["operacao_padrao", "transbordo_servico_extra", "custos_extras"]),
  modalidade_financeira: z.enum(["CAIXA_IMEDIATO", "DUPLICATA", "FATURAMENTO_MENSAL", "CUSTO_DESPESA", "FECHAMENTO_MENSAL_EMPRESA", "DUPLICATA_FORNECEDOR"]),
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
});

export type ProductionFormValues = z.infer<typeof productionSchema>;

export const DEFAULT_PRODUCTION_VALUES: Partial<ProductionFormValues> = {
  tipo_lancamento: "operacao_padrao",
  data: new Date().toISOString().split('T')[0],
  quantidade: 0,
  quantidade_colaboradores: 1,
  nf_emite: false,
  status_financeiro: "PENDENTE",
  categoria_servico: "SERVICO_VOLUME",
};
