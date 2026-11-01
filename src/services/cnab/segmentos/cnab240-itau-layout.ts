/**
 * CNAB240 — Layout Posicional Banco Itaú (341) — SISPAG
 *
 * Referência: Manual Técnico Itaú SISPAG / CNAB240 FEBRABAN
 * Código do Banco Itaú: 341
 */

export const ITAU = {
  CODIGO_BANCO: '341',
  NOME_BANCO: 'BANCO ITAU SA',
  VERSAO_LAYOUT_ARQUIVO: '081',
  VERSAO_LAYOUT_LOTE: '040',
  // Forma de lançamento:
  // 01 = Crédito em Conta Corrente (mesmo banco)
  // 41 = TED outra titularidade, outra IF
  // 43 = TED mesma titularidade, outra IF
  FORMA_LANCAMENTO_TED: '41',
  FORMA_LANCAMENTO_CC: '01',
  // Câmara compensação:
  // 018 = STR (TED)
  // 700 = DOC
  // 000 = Mesmo banco (Crédito em C/C Itaú)
  CAMARA_TED: '018',
  CAMARA_CC: '000',
  // Tipo serviço: 20=Pagamento a Fornecedores / Prestadores, 30=Pagamento de Salários
  TIPO_SERVICO_FORNECEDOR: 20,
  TIPO_SERVICO_SALARIO: 30,
};
