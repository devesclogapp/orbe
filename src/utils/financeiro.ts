import { addDays, endOfMonth, isAfter, startOfDay } from "date-fns";

export type ModalidadeFinanceira =
  | "CAIXA_IMEDIATO"
  | "DUPLICATA_FORNECEDOR"
  | "FECHAMENTO_MENSAL_EMPRESA"
  | "TRANSBORDO_30D"
  | "CUSTO_DESPESA";

export type StatusPagamento = "PENDENTE" | "RECEBIDO" | "ATRASADO";

export function getModalidadeLabel(mod: ModalidadeFinanceira) {
  switch (mod) {
    case "CAIXA_IMEDIATO": return "Deposito";
    case "DUPLICATA_FORNECEDOR": return "Boleto";
    case "FECHAMENTO_MENSAL_EMPRESA": return "Deposito (mensal)";
    case "TRANSBORDO_30D": return "Transbordo (30 dias)";
    case "CUSTO_DESPESA": return "Custo";
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

const getOrigemAba = (operacao: any) =>
  normalizeFinanceText(
    operacao.avaliacao_json?.contexto_importacao?.origem_aba ||
    operacao.origem_aba ||
    ""
  );

export function classificarFinanceiro(operacao: any, _empresa: any = {}): { modalidade: ModalidadeFinanceira; vencimento: Date } {
  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const origemAba = getOrigemAba(operacao);
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;

  const finalizarFinanceiro = (modalidade: ModalidadeFinanceira, vencimentoPadrao: Date) => ({
    modalidade,
    vencimento:
      vencimentoManual && !Number.isNaN(vencimentoManual.getTime())
        ? vencimentoManual
        : vencimentoPadrao,
  });

  if (
    modalidadeManual === "CAIXA_IMEDIATO" ||
    modalidadeManual === "DUPLICATA_FORNECEDOR" ||
    modalidadeManual === "FECHAMENTO_MENSAL_EMPRESA" ||
    modalidadeManual === "TRANSBORDO_30D" ||
    modalidadeManual === "CUSTO_DESPESA"
  ) {
    return finalizarFinanceiro(modalidadeManual, dataOp);
  }

  // Regra temporaria: a modalidade deve refletir exatamente a aba de origem da planilha.
  if (origemAba.includes("CUSTOS EXTRAS")) {
    return finalizarFinanceiro("CUSTO_DESPESA", dataOp);
  }

  if (origemAba.includes("TRANSBORDO DISMELO")) {
    return finalizarFinanceiro("TRANSBORDO_30D", addDays(dataOp, 30));
  }

  if (origemAba.includes("DUPLICATAS A VOLUME")) {
    return finalizarFinanceiro("FECHAMENTO_MENSAL_EMPRESA", endOfMonth(dataOp));
  }

  if (origemAba.includes("DUPLICATAS")) {
    return finalizarFinanceiro("DUPLICATA_FORNECEDOR", addDays(dataOp, 7));
  }

  if (origemAba.includes("CAIXA")) {
    return finalizarFinanceiro("CAIXA_IMEDIATO", dataOp);
  }

  // Fallback seguro enquanto a classificacao depende somente da aba.
  return finalizarFinanceiro("CAIXA_IMEDIATO", dataOp);
}

export function processarOperacao(operacao: any, empresas: any[] = []) {
  // QTD de volume (na base pode variar dependendo da configuracao da operacao, usamos fallback padrao)
  const quantidade = Number(operacao.quantidade || 0);

  // O unitario que veio do snapshot do banco na hora da criacao
  const valorUnitario = Number(operacao.valor_unitario_snapshot || operacao.valor_unitario_label || 0);

  const valor_descarga = quantidade * valorUnitario;
  const custo_com_iss = 0;
  const total_e_filme = 0;
  const total_final = valor_descarga + custo_com_iss + total_e_filme;

  const empresa = empresas.find?.((e: any) => e.id === operacao.empresa_id) || {};

  const financeiro = classificarFinanceiro(operacao, empresa);
  const statusPagamentoRaw = String(operacao.status_pagamento ?? "").toUpperCase().trim();

  let status_pagamento: StatusPagamento = "PENDENTE";
  if (statusPagamentoRaw === "RECEBIDO" || statusPagamentoRaw === "ATRASADO" || statusPagamentoRaw === "PENDENTE") {
    status_pagamento = statusPagamentoRaw;
  } else if (isAfter(startOfDay(new Date()), startOfDay(financeiro.vencimento))) {
    status_pagamento = "ATRASADO";
  }

  return {
    ...operacao,
    valorDescargaCalculado: valor_descarga,
    totalFinalCalculado: total_final,
    modalidadeFinanceira: financeiro.modalidade,
    dataVencimento: financeiro.vencimento.toISOString().split("T")[0],
    statusPagamento: status_pagamento,
  };
}
