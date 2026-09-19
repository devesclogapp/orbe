/**
 * Domínio Compartilhado de Formulários de Custos Extras (Fase 1.1A)
 * 
 * Centraliza as regras de negócio, opções visuais, validações e
 * montagem de payload para os formulários de Custos Extras (Portal Encarregado e Admin).
 * 
 * Regra Arquitetural:
 * - A escolha visual padrão é 'PAGO_EMPRESA' (UX), mas o envio ao banco é sempre explícito.
 * - 'origem_recurso' (QUEM pagou / existência de obrigação) é desacoplado de 'forma_pagamento_id' (COMO pagou).
 * - Novos registros entram obrigatoriamente com pipeline_status = 'RECEBIDO' e status_pagamento = 'A_PAGAR'.
 */

export type OrigemRecursoCustoExtra =
  | "PAGO_EMPRESA"
  | "REEMBOLSO_COLABORADOR"
  | "PAGAMENTO_PENDENTE";

export type OrigemRecursoBanco = OrigemRecursoCustoExtra | "LEGACY";

export interface OpcaoOrigemRecurso {
  value: OrigemRecursoCustoExtra;
  label: string;
  descricao: string;
  subtitulo?: string;
}

export const OPCOES_ORIGEM_RECURSO: readonly OpcaoOrigemRecurso[] = [
  {
    value: "PAGO_EMPRESA",
    label: "Pago pela empresa",
    descricao: "A empresa já realizou o pagamento.",
    subtitulo: "Gasto já desembolsado pela empresa (cartão corporativo, dinheiro do caixa, PIX corporativo).",
  },
  {
    value: "REEMBOLSO_COLABORADOR",
    label: "Pago por colaborador",
    descricao: "O colaborador utilizou recurso próprio e deverá ser reembolsado.",
    subtitulo: "Reembolso posterior pela empresa ao colaborador responsável.",
  },
  {
    value: "PAGAMENTO_PENDENTE",
    label: "Ainda não foi pago",
    descricao: "A despesa ainda possui pagamento pendente.",
    subtitulo: "Boleto, fatura de fornecedor ou nota a prazo aguardando liquidação.",
  },
] as const;

export interface CustoExtraFormInput {
  empresa_id: string;
  unidade_id?: string | null;
  data: string;
  categoria: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  forma_pagamento_id: string;
  origem_recurso: OrigemRecursoCustoExtra;
  favorecido_colaborador_id?: string | null;
  favorecido_fornecedor_id?: string | null;
  data_vencimento?: string | null;
  observacao?: string | null;
}

export interface CustoExtraValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  message?: string;
}

/**
 * Validação rigorosa dos campos do formulário antes do envio.
 */
export function validateCustoExtraForm(input: Partial<CustoExtraFormInput>): CustoExtraValidationResult {
  const errors: Record<string, string> = {};

  if (!input.empresa_id) {
    errors.empresa_id = "Selecione a empresa.";
  }

  if (!input.categoria) {
    errors.categoria = "Selecione a categoria.";
  }

  if (!input.descricao?.trim()) {
    errors.descricao = "Informe a descrição do custo.";
  }

  if (input.valor_unitario === undefined || input.valor_unitario === null || Number(input.valor_unitario) <= 0) {
    errors.valor_unitario = "Informe um valor unitário válido maior que zero.";
  }

  if (!input.quantidade || Number(input.quantidade) <= 0) {
    errors.quantidade = "Informe uma quantidade válida maior que zero.";
  }

  if (!input.forma_pagamento_id) {
    errors.forma_pagamento_id = "Selecione a forma de pagamento.";
  }

  // Validação de origem_recurso (OBRIGATÓRIO e explícito)
  if (!input.origem_recurso) {
    errors.origem_recurso = "Selecione quem pagou esta despesa (origem do recurso).";
  } else if (!["PAGO_EMPRESA", "REEMBOLSO_COLABORADOR", "PAGAMENTO_PENDENTE"].includes(input.origem_recurso)) {
    errors.origem_recurso = "Origem de recurso inválida.";
  }

  // Validação condicional por origem_recurso
  if (input.origem_recurso === "REEMBOLSO_COLABORADOR") {
    if (!input.favorecido_colaborador_id) {
      errors.favorecido_colaborador_id = "Selecione o colaborador que realizou o pagamento para reembolso.";
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    message: valid ? undefined : Object.values(errors)[0],
  };
}

export interface BuildCustoExtraPayloadOptions {
  tenantId?: string | null;
  userId?: string | null;
  origemLancamento: "encarregado" | "admin";
}

/**
 * Montagem de payload estrito e sanitizado para INSERT em custos_extras_operacionais.
 * Garante que campos incompatíveis com a origem selecionada sejam limpos.
 */
export function buildCustoExtraInsertPayload(
  input: CustoExtraFormInput,
  options: BuildCustoExtraPayloadOptions
) {
  const validation = validateCustoExtraForm(input);
  if (!validation.valid) {
    throw new Error(validation.message || "Dados do custo extra incompletos ou inválidos.");
  }

  const quantidade = Number(input.quantidade) || 1;
  const valorUnitario = Number(input.valor_unitario) || 0;
  const total = Math.round(quantidade * valorUnitario * 100) / 100;

  // Limpeza condicional estrita de favorecidos com base na origem_recurso
  let favorecidoColaboradorId: string | null = null;
  let favorecidoFornecedorId: string | null = null;
  let dataVencimento: string | null = null;

  if (input.origem_recurso === "REEMBOLSO_COLABORADOR") {
    favorecidoColaboradorId = input.favorecido_colaborador_id || null;
  } else if (input.origem_recurso === "PAGAMENTO_PENDENTE") {
    favorecidoFornecedorId = input.favorecido_fornecedor_id || null;
    dataVencimento = input.data_vencimento || null;
  }
  // PAGO_EMPRESA garante explicitamente favorecido_colaborador_id = null e favorecido_fornecedor_id = null

  return {
    tenant_id: options.tenantId || null,
    empresa_id: input.empresa_id,
    unidade_id: input.unidade_id || null,
    data: input.data,
    categoria_custo: input.categoria,
    descricao: input.descricao.trim(),
    quantidade,
    valor_unitario: valorUnitario,
    total,
    forma_pagamento_id: input.forma_pagamento_id,
    origem_recurso: input.origem_recurso,
    favorecido_colaborador_id: favorecidoColaboradorId,
    favorecido_fornecedor_id: favorecidoFornecedorId,
    data_vencimento: dataVencimento,
    operacao_id: null,
    observacao: input.observacao?.trim() || null,
    pipeline_status: "RECEBIDO" as const,
    status_pagamento: "A_PAGAR" as const,
    origem_dado: "manual",
    origem_lancamento: options.origemLancamento,
    responsavel_id: options.userId || null,
  };
}

export interface OrigemRecursoBadgeInfo {
  label: string;
  labelCompleto: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
}

/**
 * Helper para obter badge legível da origem do recurso
 */
export function getOrigemRecursoBadge(origem?: string | null): OrigemRecursoBadgeInfo {
  switch (origem) {
    case "PAGO_EMPRESA":
      return {
        label: "Empresa",
        labelCompleto: "Pago pela empresa",
        variant: "secondary",
        className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
      };
    case "REEMBOLSO_COLABORADOR":
      return {
        label: "Reembolso",
        labelCompleto: "Pago por colaborador / Reembolso",
        variant: "secondary",
        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
      };
    case "PAGAMENTO_PENDENTE":
      return {
        label: "Pendente",
        labelCompleto: "Ainda não foi pago",
        variant: "secondary",
        className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
      };
    case "LEGACY":
    default:
      return {
        label: "Legado",
        labelCompleto: "Registro legado",
        variant: "outline",
        className: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800"
      };
  }
}

/**
 * Mensagem contextual e discreta exibida na aprovação RH de Custos Extras.
 */
export function getOrigemRecursoApprovalNotice(origem?: string | null): string | null {
  switch (origem) {
    case "PAGO_EMPRESA":
      return "Pago pela empresa — ao aprovar, o lançamento será concluído sem gerar novo pagamento.";
    case "REEMBOLSO_COLABORADOR":
      return "Pago por colaborador — ao aprovar, seguirá para reembolso.";
    case "PAGAMENTO_PENDENTE":
      return "Ainda não foi pago — ao aprovar, seguirá para o fluxo financeiro.";
    default:
      return null;
  }
}

/**
 * Mensagem contextual e discreta exibida no detalhe do Custo Extra conforme o estado de aprovação.
 */
export function getOrigemRecursoStatusNotice(origem?: string | null, isAprovado?: boolean): string | null {
  if (isAprovado) {
    switch (origem) {
      case "PAGO_EMPRESA":
        return "Despesa paga pela empresa. Aprovada pelo RH e concluída sem gerar contas a pagar.";
      case "REEMBOLSO_COLABORADOR":
        return "Despesa aprovada pelo RH. Encaminhada para reembolso ao colaborador.";
      case "PAGAMENTO_PENDENTE":
        return "Despesa aprovada pelo RH. Encaminhada para o fluxo financeiro de pagamentos.";
      default:
        return null;
    }
  }
  return getOrigemRecursoApprovalNotice(origem);
}
