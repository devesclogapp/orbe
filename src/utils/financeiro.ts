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

let _cachedRegrasFinanceiras: any[] = [];

export function setCachedRegrasFinanceiras(rules: any[]) {
  if (Array.isArray(rules) && rules.length > 0) {
    _cachedRegrasFinanceiras = rules;
  }
}

export function getCachedRegrasFinanceiras(): any[] {
  return _cachedRegrasFinanceiras;
}

export function resolverPrazoDias({
  modalidade,
  empresaId,
  regrasFinanceiras,
}: {
  modalidade: string;
  empresaId?: string | null;
  regrasFinanceiras?: any[];
}): number | null {
  const activeRules = Array.isArray(regrasFinanceiras)
    ? regrasFinanceiras
    : _cachedRegrasFinanceiras;

  const isModalidadeDuplicata = modalidade === "DUPLICATA" || modalidade === "DUPLICATA_FORNECEDOR";

  // 1. Regra específica da empresa
  if (empresaId) {
    const regraEmpresa = activeRules.find(
      (r) =>
        r.ativo !== false &&
        (r.modalidade_financeira === modalidade || (isModalidadeDuplicata && r.modalidade_financeira === "DUPLICATA")) &&
        r.empresa_id === empresaId &&
        r.prazo_dias != null
    );
    if (regraEmpresa) {
      return Number(regraEmpresa.prazo_dias);
    }
  }

  // 2. Regra padrão global (empresa_id IS NULL)
  const regraGlobal = activeRules.find(
    (r) =>
      r.ativo !== false &&
      (r.modalidade_financeira === modalidade || (isModalidadeDuplicata && r.modalidade_financeira === "DUPLICATA")) &&
      !r.empresa_id &&
      r.prazo_dias != null
  );
  if (regraGlobal) {
    return Number(regraGlobal.prazo_dias);
  }

  // 3. Ausência de configuração: tratada explicitamente sem fallback numérico arbitrário
  return null;
}

export function classificarFinanceiroSync(
  operacao: any,
  empresa: any = {},
  regrasFinanceiras?: any[]
): { modalidade: ModalidadeFinanceira; vencimento: Date | null } {
  if (Array.isArray(regrasFinanceiras) && regrasFinanceiras.length > 0) {
    setCachedRegrasFinanceiras(regrasFinanceiras);
  }

  const contextoImportacao = getContextoImportacao(operacao);
  const modalidadeManual = normalizeFinanceText(contextoImportacao.modalidade_financeira_override);
  const vencimentoManualRaw = String(contextoImportacao.data_vencimento_override ?? "").trim();
  const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
  const vencimentoManual = vencimentoManualRaw ? new Date(`${vencimentoManualRaw}T12:00:00Z`) : null;

  let modalidade: ModalidadeFinanceira;

  // Prioridade de classificação:
  // 1. BOLETO
  // 2. EMPRESA COM FECHAMENTO
  // 3. CAIXA IMEDIATO

  const meio_pagamento = normalizeFinanceText(
    operacao.formas_pagamento_operacional?.nome ??
    operacao.forma_pagamento?.nome ??
    contextoImportacao.forma_pagamento ??
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ?? 
    getLinhaOriginalValue(operacao, "MEIO DE PAGAMENTO") ?? ""
  );

  if (meio_pagamento.includes("BOLETO")) {
    modalidade = "DUPLICATA_FORNECEDOR";
  } else if (meio_pagamento.includes("MENSAL") || meio_pagamento.includes("FATURAMENTO")) {
    modalidade = "FECHAMENTO_MENSAL_EMPRESA";
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

  // 1. SOURCE OF TRUTH: Se a operação já possui data_vencimento física definida
  const dataVencimentoFisicaRaw = operacao.data_vencimento ? String(operacao.data_vencimento).trim() : "";
  if (dataVencimentoFisicaRaw) {
    const dataFisica = new Date(
      dataVencimentoFisicaRaw.includes("T")
        ? dataVencimentoFisicaRaw
        : `${dataVencimentoFisicaRaw}T12:00:00Z`
    );
    if (!Number.isNaN(dataFisica.getTime())) {
      return { modalidade, vencimento: dataFisica };
    }
  }

  // 2. Data manual explicitamente definida no contexto/override
  if (vencimentoManual && !Number.isNaN(vencimentoManual.getTime())) {
    return { modalidade, vencimento: vencimentoManual };
  }

  // 3. Resolução por modalidade e regras financeiras da empresa / global
  if (modalidade === "CAIXA_IMEDIATO") {
    return { modalidade, vencimento: dataOp };
  }

  if (modalidade === "FECHAMENTO_MENSAL_EMPRESA") {
    return { modalidade, vencimento: endOfMonth(dataOp) };
  }

  if (modalidade === "DUPLICATA_FORNECEDOR") {
    const empresaId = operacao.empresa_id || empresa.id || null;
    const prazo = resolverPrazoDias({
      modalidade: "DUPLICATA",
      empresaId,
      regrasFinanceiras: Array.isArray(regrasFinanceiras) ? regrasFinanceiras : _cachedRegrasFinanceiras,
    });

    if (prazo !== null) {
      return { modalidade, vencimento: addDays(dataOp, prazo) };
    }

    // Ausência de regra cadastrada: retorna null explicitamente (sem D+7 hardcoded oculto)
    return { modalidade, vencimento: null };
  }

  return { modalidade, vencimento: null };
}

export async function classificarFinanceiro(operacao: any, empresa: any = {}): Promise<{ modalidade: ModalidadeFinanceira; vencimento: Date | null; regra: any }> {
  try {
    const rules = await RegrasFinanceirasService.getAllActive();
    setCachedRegrasFinanceiras(rules);
  } catch (e) {
    console.warn('Erro ao atualizar cache de regras financeiras:', e);
  }

  const sync = classificarFinanceiroSync(operacao, empresa);
  let modalidade = sync.modalidade;
  let vencimento = sync.vencimento;
  let regra: any = null;

  try {
    const dataOp = operacao.data_operacao ? new Date(`${operacao.data_operacao}T12:00:00Z`) : new Date();
    const resultado = await RegrasFinanceirasService.classificarFinanceiro(
      dataOp.toISOString().split('T')[0],
      modalidade === 'DUPLICATA_FORNECEDOR' ? 'DUPLICATA' : modalidade,
      empresa.id
    );
    if (resultado && resultado.regra_encontrada) {
      regra = resultado;
      if (!operacao.data_vencimento && resultado.data_vencimento) {
        vencimento = new Date(resultado.data_vencimento + 'T12:00:00Z');
      }
    }
  } catch (e) {
    console.warn('Erro ao buscar regras financeiras do banco:', e);
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
  valorTotalMateriais = 0,
}: {
  quantidade: number;
  valorUnitario: number;
  percentualIss?: number;
  quantidadeFilme?: number;
  valorUnitarioFilme?: number;
  nfRaw?: string | null;
  valorTotalMateriais?: number;
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
  // Fórmula ajustada: O ISS aumenta o valor total do dia
  const totalFinalCalculado = valorDescargaCalculado + custoIssCalculado + totalFilmeCalculado + (valorTotalMateriais || 0);

  return {
    percentualCalculado,
    valorDescargaCalculado,
    custoIssCalculado,
    totalFilmeCalculado,
    valorTotalMateriais: valorTotalMateriais || 0,
    totalFinalCalculado,
  };
}

export function processarOperacao(operacao: any, empresas: any[] = [], regrasFinanceiras: any[] = []) {
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
    valorTotalMateriais: Number(operacao.valor_total_materiais || 0),
  });

  // Priorizamos o cálculo em tempo real para garantir que a regra (Descarga + ISS + Materiais) seja refletida
  const valor_descarga = valoresCalculados.valorDescargaCalculado;
  const custo_com_iss = valoresCalculados.custoIssCalculado;
  const total_final = valoresCalculados.totalFinalCalculado;

  const empresa = empresas.find?.((e: any) => e.id === operacao.empresa_id) || {};

  const financeiro = classificarFinanceiroSync(operacao, empresa, regrasFinanceiras);
  
  const statusPagamentoRaw = String(operacao.status_pagamento ?? "").toUpperCase().trim();
  const dataVencimento = financeiro.vencimento;

  let status_pagamento: StatusPagamento = "PENDENTE";
  if (["RECEBIDO", "PAGO", "CONCLUIDO", "FINALIZADO"].some(s => statusPagamentoRaw === s)) {
    status_pagamento = "RECEBIDO";
  } else if (dataVencimento && isAfter(startOfDay(new Date()), startOfDay(dataVencimento))) {
    status_pagamento = "ATRASADO";
  }

  const contextoImportacao = getContextoImportacao(operacao);
  // Resolução robusta da forma de pagamento:
  // 1. Join direto formas_pagamento_operacional (operacoes_producao com FK)
  // 2. forma_pagamento_snapshot (texto gravado no lançamento original)
  // 3. forma_pagamento_label (normalizado via getAllPainel)
  // 4. Legacy: forma_pagamento como texto direto
  // 5. contexto_importacao JSON
  // 6. Linha original da planilha
  const formaPagamentoValue =
    operacao.formas_pagamento_operacional?.nome ??
    operacao.forma_pagamento_snapshot ??
    operacao.forma_pagamento_label ??
    (typeof operacao.forma_pagamento === 'string' ? operacao.forma_pagamento : null) ??
    contextoImportacao.forma_pagamento ??
    getLinhaOriginalValue(operacao, "FORMA DE PAGAMENTO") ??
    getLinhaOriginalValue(operacao, "MEIO DE PAGAMENTO") ?? "";

  // Normalizar observação — pode vir de coluna direta ou JSON
  const observacaoValue =
    operacao.observacao ??
    contextoImportacao.observacao ??
    getLinhaOriginalValue(operacao, "OBSERVACAO") ??
    getLinhaOriginalValue(operacao, "OBSERVAÇÃO") ?? "";

  // Normalizar nome do encarregado/responsável
  const encarregadoValue =
    operacao.responsavel_nome ??
    operacao.encarregado_label ??
    "";

  return {
    ...operacao,
    valor_descarga,
    custo_com_iss,
    total_final,
    valorDescargaCalculado: valor_descarga,
    totalFinalCalculado: total_final,
    modalidadeFinanceira: financeiro.modalidade,
    dataVencimento: dataVencimento ? dataVencimento.toISOString().split("T")[0] : null,
    statusPagamento: status_pagamento,
    formaPagamento: formaPagamentoValue,
    observacao: observacaoValue,
    encarregadoLabel: encarregadoValue,
    valor_total_materiais: Number(operacao.valor_total_materiais || 0),
  };
}
