import { addDays, endOfMonth, isAfter, startOfDay } from "date-fns";
import { RegrasFinanceirasService } from "@/services/base.service";

export type ModalidadeFinanceira =
  | "CAIXA_IMEDIATO"
  | "DUPLICATA_FORNECEDOR"
  | "FECHAMENTO_MENSAL_EMPRESA"
  | "TRANSBORDO_30D";

export type StatusPagamento = "PENDENTE" | "RECEBIDO" | "ATRASADO";

export function getModalidadeLabel(mod: ModalidadeFinanceira | string) {
  switch (mod) {
    case "CAIXA_IMEDIATO": return "Caixa Imediato";
    case "DUPLICATA_FORNECEDOR": return "Duplicata";
    case "FECHAMENTO_MENSAL_EMPRESA": return "Fechamento Mensal";
    case "TRANSBORDO_30D": return "Transbordo 30d";
    default: return mod;
  }
}

const normalizeFinanceText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const getContextoImportacao = (operacao: any) =>
  (operacao?.avaliacao_json?.contexto_importacao as Record<string, unknown> | undefined) ?? {};

const getVencimentoPadrao = (modalidade: ModalidadeFinanceira, dataOp: Date): Date => {
  switch (modalidade) {
    case "DUPLICATA_FORNECEDOR": return addDays(dataOp, 7);
    case "FECHAMENTO_MENSAL_EMPRESA": return endOfMonth(dataOp);
    default: return dataOp;
  }
};

export function classificarFinanceiroSync(operacao: any, empresa: any = {}): { modalidade: ModalidadeFinanceira; vencimento: Date } {
  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;

  let modalidade: ModalidadeFinanceira;

  // Prioridade de classificação conforme regra crítica:
  // 1. BOLETO
  // 2. EMPRESA COM FECHAMENTO
  // 3. CAIXA IMEDIATO

  const meio_pagamento = normalizeFinanceText(
    operacao.forma_pagamento?.nome ??
    contextoImportacao.forma_pagamento ??
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? 
    getLinhaOriginalValue(operacao, "MEIO DE PAGAMENTO") ?? ""
  );

  if (meio_pagamento.includes("BOLETO")) {
    modalidade = "DUPLICATA_FORNECEDOR";
  } else if (empresa.tem_fechamento_mensal === true && ["DEPOSITO", "PIX", "TRANSFERENCIA"].some(m => meio_pagamento.includes(m))) {
    modalidade = "FECHAMENTO_MENSAL_EMPRESA";
  } else if (["DEPOSITO", "PIX", "TRANSFERENCIA"].some(mod => meio_pagamento.includes(mod))) {
    modalidade = "CAIXA_IMEDIATO";
  } else if (modalidadeManual === "TRANSBORDO_30D") {
    modalidade = "TRANSBORDO_30D";
  } else {
    // Fallback se não bater em nada
    modalidade = "CAIXA_IMEDIATO";
  }

  const vencimento = vencimentoManual && !Number.isNaN(vencimentoManual.getTime())
    ? vencimentoManual
    : getVencimentoPadrao(modalidade, dataOp);

  return { modalidade, vencimento };
}

export async function classificarFinanceiro(operacao: any, empresa: any = {}): Promise<{ modalidade: ModalidadeFinanceira; vencimento: Date; regra: any }> {
  // Mantemos a versão async para chamadas que precisam do banco, mas seguindo a nova lógica de labels
  const sync = classificarFinanceiroSync(operacao, empresa);
  let modalidade = sync.modalidade;
  let vencimento = sync.vencimento;
  let regra: any = null;

  try {
    const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
    const resultado = await RegrasFinanceirasService.classificarFinanceiro(
      dataOp.toISOString().split('T')[0],
      modalidade,
      empresa.id
    );
    if (resultado && resultado.regra_encontrada) {
      regra = resultado;
      vencimento = resultado.data_vencimento ? new Date(resultado.data_vencimento + 'T12:00:00Z') : vencimento;
    }
  } catch (e) {
    console.warn('Erro ao buscar regras financeiras do banco, usando fallback:', e);
  }

  return { modalidade, vencimento, regra };
}

const getLinhaOriginalValue = (item: Record<string, unknown>, key: string) => {
  const linhaOriginal = (item.avaliacao_json as { linha_original?: Record<string, unknown> } | undefined)?.linha_original;
  if (!linhaOriginal) return null;
  const normalizedEntries = Object.entries(linhaOriginal).map(([k, v]) => [k.toUpperCase().replace(":", "").trim(), v]);
  const normalizedKey = key.toUpperCase().replace(":", "").trim();
  const match = normalizedEntries.find(([k]) => k === normalizedKey || k.includes(normalizedKey));
  return match?.[1] ?? null;
};

export function calcularValoresOperacao({
  quantidade,
  valorUnitario,
}: {
  quantidade: number;
  valorUnitario: number;
}) {
  // Regra Simplificada conforme prompt:
  // valor_descarga = quantidade_volume * valor_unitario
  // custo_com_iss = 0
  // total_e_filme = 0
  // total_final = valor_descarga

  const valorDescargaCalculado = Math.max(quantidade, 0) * valorUnitario;
  
  return {
    percentualCalculado: 0,
    valorDescargaCalculado: valorDescargaCalculado,
    custoIssCalculado: 0,
    totalFilmeCalculado: 0,
    totalFinalCalculado: valorDescargaCalculado,
  };
}

export function processarOperacao(operacao: any, empresas: any[] = []) {
  const quantidade = Number(operacao.quantidade || 0);
  const valorUnitario = Number(operacao.valor_unitario_snapshot || operacao.valor_unitario_label || 0);
  
  const valoresCalculados = calcularValoresOperacao({
    quantidade,
    valorUnitario,
  });

  const valor_descarga = valoresCalculados.valorDescargaCalculado;
  const total_final = valoresCalculados.totalFinalCalculado;

  const empresa = empresas.find?.((e: any) => e.id === operacao.empresa_id) || {};

  const financeiro = classificarFinanceiroSync(operacao, empresa);
  
  const statusPagamentoRaw = String(operacao.status_pagamento ?? "").toUpperCase().trim();
  const dataVencimento = financeiro.vencimento;

  let status_pagamento: StatusPagamento = "PENDENTE";
  if (statusPagamentoRaw === "RECEBIDO") {
    status_pagamento = "RECEBIDO";
  } else if (isAfter(startOfDay(new Date()), startOfDay(dataVencimento))) {
    status_pagamento = "ATRASADO";
  }

  const contextoImportacao = getContextoImportacao(operacao);
  const formaPagamentoValue = operacao.forma_pagamento?.nome ?? 
    contextoImportacao.forma_pagamento ?? 
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? 
    getLinhaOriginalValue(operacao, "MEIO DE PAGAMENTO") ?? "";

  return {
    ...operacao,
    valorDescargaCalculado: valor_descarga,
    totalFinalCalculado: total_final,
    modalidadeFinanceira: financeiro.modalidade,
    dataVencimento: dataVencimento.toISOString().split("T")[0],
    statusPagamento: status_pagamento,
    formaPagamento: formaPagamentoValue,
  };
}

