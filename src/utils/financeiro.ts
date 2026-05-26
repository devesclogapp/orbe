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
  const match = normalizedEntries.find(([k]) => String(k) === normalizedKey || String(k).includes(normalizedKey));
  return match?.[1] ?? null;
};

export function calcularValoresOperacao({
  quantidade,
  valorUnitario,
  percentualIss = 0,
  quantidadeFilme = 0,
  valorUnitarioFilme = 0,
  nfRaw,
}: {
  quantidade: number;
  valorUnitario: number;
  percentualIss?: number;
  quantidadeFilme?: number;
  valorUnitarioFilme?: number;
  nfRaw?: string | null;
}) {
  const valorDescargaCalculado = Math.max(quantidade, 0) * Math.max(valorUnitario, 0);
  const nfInformada = String(nfRaw ?? "")
    .trim()
    .toUpperCase();
  const aplicaIss = nfInformada !== "" && nfInformada !== "NAO" && nfInformada !== "NÃO";
  
  // Regra crítica: se aplica ISS, o percentual mínimo é 5% (0.05)
  let percentualCalculado = 0;
  if (aplicaIss) {
    percentualCalculado = percentualIss > 0 ? percentualIss : 0.05;
  }

  const custoIssCalculado = valorDescargaCalculado * percentualCalculado;
  const totalFilmeCalculado = Math.max(quantidadeFilme, 0) * Math.max(valorUnitarioFilme, 0);
  const totalFinalCalculado = valorDescargaCalculado + custoIssCalculado + totalFilmeCalculado;

  return {
    percentualCalculado,
    valorDescargaCalculado,
    custoIssCalculado,
    totalFilmeCalculado,
    totalFinalCalculado,
  };
}

export function processarOperacao(operacao: any, empresas: any[] = []) {
  const quantidade = Number(operacao.quantidade || 0);
  const valorUnitario = Number(operacao.valor_unitario_snapshot || operacao.valor_unitario_label || 0);
  const percentualIss = Number(operacao.percentual_iss || 0);
  const quantidadeFilme = Number(operacao.quantidade_filme || 0);
  const valorUnitarioFilme = Number(operacao.valor_unitario_filme || 0);
  
  const valoresCalculados = calcularValoresOperacao({
    quantidade,
    valorUnitario,
    percentualIss,
    quantidadeFilme,
    valorUnitarioFilme,
    nfRaw: operacao.nf_numero,
  });

  const valorDescargaProp = operacao.valor_descarga !== null && operacao.valor_descarga !== undefined && operacao.valor_descarga !== '' ? Number(operacao.valor_descarga) : null;
  const custoComIssProp = operacao.custo_com_iss !== null && operacao.custo_com_iss !== undefined && operacao.custo_com_iss !== '' ? Number(operacao.custo_com_iss) : null;
  const totalFinalProp = operacao.total_final !== null && operacao.total_final !== undefined && operacao.total_final !== '' ? Number(operacao.total_final) : null;

  const valor_descarga = valorDescargaProp ?? valoresCalculados.valorDescargaCalculado;
  const custo_com_iss = custoComIssProp ?? valoresCalculados.custoIssCalculado;
  const total_final = totalFinalProp ?? valoresCalculados.totalFinalCalculado;

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
    valor_descarga,
    custo_com_iss,
    total_final,
    valorDescargaCalculado: valor_descarga,
    totalFinalCalculado: total_final,
    modalidadeFinanceira: financeiro.modalidade,
    dataVencimento: dataVencimento.toISOString().split("T")[0],
    statusPagamento: status_pagamento,
    formaPagamento: formaPagamentoValue,
  };
}
