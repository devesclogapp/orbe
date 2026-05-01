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

export function classificarFinanceiro(operacao: any, empresa: any = {}): { modalidade: ModalidadeFinanceira; vencimento: Date } {
  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;
  const meio_pagamento = normalizeFinanceText(
    operacao.forma_pagamento?.nome ?? 
    contextoImportacao.forma_pagamento ?? 
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? ""
  );

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

  // Se houver uma origem explicita de Custos Extras no objeto avaliacao_json fallback
  const origemAba = normalizeFinanceText(contextoImportacao.origem_aba || operacao.origem_aba || "");
  if (origemAba.includes("CUSTOS EXTRAS") || operacao.tipo_lancamento === "DESPESA") {
    return finalizarFinanceiro("CUSTO_DESPESA", dataOp);
  }

  if (origemAba.includes("TRANSBORDO DISMELO")) {
    return finalizarFinanceiro("TRANSBORDO_30D", addDays(dataOp, 30));
  }

  if (meio_pagamento.includes("BOLETO")) {
    // Media de 7 dias ou definido por uma regra financeira futura (5 a 10 dias)
    return finalizarFinanceiro("DUPLICATA_FORNECEDOR", addDays(dataOp, 7));
  }

  const isPagamentoImediato = ["DEPOSITO", "PIX", "TRANSFERENCIA"].some(mod => meio_pagamento.includes(mod));

  if (empresa.tem_fechamento_mensal === true && isPagamentoImediato) {
    return finalizarFinanceiro("FECHAMENTO_MENSAL_EMPRESA", endOfMonth(dataOp));
  }

  if (isPagamentoImediato) {
    return finalizarFinanceiro("CAIXA_IMEDIATO", dataOp);
  }

  return finalizarFinanceiro("CAIXA_IMEDIATO", dataOp);
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
  percentualIss,
  quantidadeFilme,
  valorUnitarioFilme,
  nfRaw,
}: {
  quantidade: number;
  valorUnitario: number;
  percentualIss: number;
  quantidadeFilme: number;
  valorUnitarioFilme: number;
  nfRaw: string;
}) {
  const isNfSim = nfRaw === "S" || nfRaw === "SIM";
  const isNfNao = nfRaw === "N" || nfRaw === "NAO" || nfRaw === "NÃO";

  const percentualCalculado = isNfSim ? 5 : isNfNao ? 0 : percentualIss;
  const valorDescargaCalculado = Math.max(quantidade, 0) * valorUnitario;
  const custoIssCalculado = valorDescargaCalculado * (percentualCalculado / 100);
  const totalFilmeCalculado = valorUnitarioFilme * quantidadeFilme;
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
  
  // Utilizar regras diretamente quando nao houver gravado, senao usar snapshot gravado
  const valoresCalculados = calcularValoresOperacao({
    quantidade,
    valorUnitario,
    percentualIss: Number(operacao.percentual_iss || 0),
    quantidadeFilme: Number(operacao.quantidade_filme || 0),
    valorUnitarioFilme: Number(operacao.valor_unitario_filme || 0),
    nfRaw: String(operacao.nf_numero ?? "").toUpperCase().trim()
  });

  const valor_descarga = Number(operacao.valor_descarga) || valoresCalculados.valorDescargaCalculado;
  
  // Como as importacoes originais estavam ignorando o total filme / custo iss (gravados como 0)
  // Vamos buscar calcular ativamente aqui para dashboard / kpis ate estarmos 100% migrados
  const custo_com_iss = Number(operacao.custo_com_iss) || valoresCalculados.custoIssCalculado;
  const total_e_filme = Number(operacao.valor_total_filme) || valoresCalculados.totalFilmeCalculado;

  const total_final = valor_descarga + custo_com_iss + total_e_filme;

  const empresa = empresas.find?.((e: any) => e.id === operacao.empresa_id) || {};

  const financeiro = classificarFinanceiro(operacao, empresa);
  const statusPagamentoRaw = String(operacao.status_pagamento ?? "").toUpperCase().trim();

  let status_pagamento: StatusPagamento = "PENDENTE";
  if (statusPagamentoRaw === "RECEBIDO" || statusPagamentoRaw === "ATRASADO" || statusPagamentoRaw === "PENDENTE") {
    status_pagamento = statusPagamentoRaw as StatusPagamento;
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
