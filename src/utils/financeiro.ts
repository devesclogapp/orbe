import { addDays, endOfMonth, isAfter, startOfDay } from "date-fns";
import { RegrasFinanceirasService } from "@/services/base.service";

export type ModalidadeFinanceira =
  | "CAIXA_IMEDIATO"
  | "DUPLICATA"
  | "FATURAMENTO_MENSAL"
  | "CUSTO_DESPESA";

export type StatusPagamento = "PENDENTE" | "RECEBIDO" | "ATRASADO";

export function getModalidadeLabel(mod: ModalidadeFinanceira) {
  switch (mod) {
    case "CAIXA_IMEDIATO": return "Deposito";
    case "DUPLICATA": return "Boleto";
    case "FATURAMENTO_MENSAL": return "Deposito (mensal)";
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

const getVencimentoPadrao = (modalidade: ModalidadeFinanceira, dataOp: Date): Date => {
  switch (modalidade) {
    case "DUPLICATA": return addDays(dataOp, 7);
    case "FATURAMENTO_MENSAL": return endOfMonth(dataOp);
    default: return dataOp;
  }
};

export function classificarFinanceiroSync(operacao: any, empresa: any = {}): { modalidade: ModalidadeFinanceira; vencimento: Date; regra: any } {
  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;

  let modalidade: ModalidadeFinanceira;

  if (
    modalidadeManual === "CAIXA_IMEDIATO" ||
    modalidadeManual === "DUPLICATA" ||
    modalidadeManual === "FATURAMENTO_MENSAL" ||
    modalidadeManual === "CUSTO_DESPESA"
  ) {
    modalidade = modalidadeManual;
  } else {
    const origemAba = normalizeFinanceText(contextoImportacao.origem_aba || operacao.origem_aba || "");
    if (origemAba.includes("CUSTOS EXTRAS") || operacao.tipo_lancamento === "DESPESA") {
      modalidade = "CUSTO_DESPESA";
    } else {
      const meio_pagamento = normalizeFinanceText(
        operacao.forma_pagamento?.nome ??
        contextoImportacao.forma_pagamento ??
        getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? ""
      );

      if (meio_pagamento.includes("BOLETO")) {
        modalidade = "DUPLICATA";
      } else if (empresa.tem_fechamento_mensal === true && ["DEPOSITO", "PIX", "TRANSFERENCIA"].some(m => meio_pagamento.includes(m))) {
        modalidade = "FATURAMENTO_MENSAL";
      } else if (["DEPOSITO", "PIX", "TRANSFERENCIA"].some(mod => meio_pagamento.includes(mod))) {
        modalidade = "CAIXA_IMEDIATO";
      } else {
        modalidade = "CAIXA_IMEDIATO";
      }
    }
  }

  const vencimento = vencimentoManual && !Number.isNaN(vencimentoManual.getTime())
    ? vencimentoManual
    : getVencimentoPadrao(modalidade, dataOp);

  return { modalidade, vencimento, regra: null };
}

export async function classificarFinanceiro(operacao: any, empresa: any = {}): Promise<{ modalidade: ModalidadeFinanceira; vencimento: Date; regra: any }> {
  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;

  let modalidade: ModalidadeFinanceira;
  let regra: any = null;

  if (
    modalidadeManual === "CAIXA_IMEDIATO" ||
    modalidadeManual === "DUPLICATA" ||
    modalidadeManual === "FATURAMENTO_MENSAL" ||
    modalidadeManual === "CUSTO_DESPESA"
  ) {
    modalidade = modalidadeManual;
  } else {
    const origemAba = normalizeFinanceText(contextoImportacao.origem_aba || operacao.origem_aba || "");
    if (origemAba.includes("CUSTOS EXTRAS") || operacao.tipo_lancamento === "DESPESA") {
      modalidade = "CUSTO_DESPESA";
    } else {
      const meio_pagamento = normalizeFinanceText(
        operacao.forma_pagamento?.nome ??
        contextoImportacao.forma_pagamento ??
        getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? ""
      );

      if (meio_pagamento.includes("BOLETO")) {
        modalidade = "DUPLICATA";
      } else if (empresa.tem_fechamento_mensal === true && ["DEPOSITO", "PIX", "TRANSFERENCIA"].some(m => meio_pagamento.includes(m))) {
        modalidade = "FATURAMENTO_MENSAL";
      } else if (["DEPOSITO", "PIX", "TRANSFERENCIA"].some(mod => meio_pagamento.includes(mod))) {
        modalidade = "CAIXA_IMEDIATO";
      } else {
        modalidade = "CAIXA_IMEDIATO";
      }
    }
  }

  try {
    const resultado = await RegrasFinanceirasService.classificarFinanceiro(
      dataOp.toISOString().split('T')[0],
      modalidade,
      empresa.id
    );
    if (resultado && resultado.regra_encontrada) {
      regra = resultado;
      return {
        modalidade,
        vencimento: vencimentoManual && !Number.isNaN(vencimentoManual.getTime())
          ? vencimentoManual
          : resultado.data_vencimento ? new Date(resultado.data_vencimento + 'T12:00:00Z') : dataOp,
        regra: resultado
      };
    }
  } catch (e) {
    console.warn('Erro ao buscar regras financeiras do banco, usando fallback:', e);
  }

  const getVencimentoPadrao = (mod: ModalidadeFinanceira): Date => {
    switch (mod) {
      case "DUPLICATA": return addDays(dataOp, 7);
      case "FATURAMENTO_MENSAL": return endOfMonth(dataOp);
      default: return dataOp;
    }
  };

  return {
    modalidade,
    vencimento: vencimentoManual && !Number.isNaN(vencimentoManual.getTime())
      ? vencimentoManual
      : getVencimentoPadrao(modalidade),
    regra: null
  };
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
  const contextoImportacao = getContextoImportacao(operacao);
  
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

  const financeiro = classificarFinanceiroSync(operacao, empresa);
  const statusPagamentoRaw = String(operacao.status_pagamento ?? "").toUpperCase().trim();

  const dataVencimento = financeiro.vencimento 
    ? new Date(financeiro.vencimento) 
    : new Date(operacao.data_operacao ? new Date(operacao.data_operacao + 'T12:00:00Z') : new Date());

  let status_pagamento: StatusPagamento = "PENDENTE";
  if (statusPagamentoRaw === "RECEBIDO" || statusPagamentoRaw === "ATRASADO" || statusPagamentoRaw === "PENDENTE") {
    status_pagamento = statusPagamentoRaw as StatusPagamento;
  } else if (isAfter(startOfDay(new Date()), startOfDay(dataVencimento))) {
    status_pagamento = "ATRASADO";
  }

  const formaPagamentoValue = operacao.forma_pagamento?.nome ?? 
    contextoImportacao.forma_pagamento ?? 
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? "";

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
