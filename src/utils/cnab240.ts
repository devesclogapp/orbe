/**
 * CNAB240 — Gerador de Arquivo de Remessa para Pagamento de Diaristas
 *
 * Padrão: FEBRABAN CNAB240 (versão simplificada para crédito em conta)
 * Layout: Header do Arquivo > [Lote: Header + Segmento A + Trailer] > Trailer do Arquivo
 *
 * Referência: Manual FEBRABAN CNAB240 — Transferências e Pagamentos
 */

// ─── Helpers de formatação ───────────────────────────────────────────────────

/** Preenche com zeros à esquerda até totalizar `len` caracteres */
function zeroLeft(value: string | number, len: number): string {
  return String(value).padStart(len, '0').slice(-len);
}

/** Preenche com espaços à direita até totalizar `len` caracteres */
function strRight(value: string, len: number): string {
  return String(value ?? '').toUpperCase().padEnd(len, ' ').slice(0, len);
}

/** Formata valor monetário em centavos sem ponto (15 dígitos) */
function formatValor(valor: number, len = 15): string {
  const centavos = Math.round(valor * 100);
  return zeroLeft(centavos, len);
}

/** Remove caracteres não numéricos de CPF/CNPJ */
function soDigitos(v: string): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** Data no formato DDMMAAAA */
function formatData(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}${m}${y}`;
}

/** Hora no formato HHMMSS */
function formatHora(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface EmpresaRemetente {
  /** CNPJ somente números */
  cnpj: string;
  /** Razão social (máx 30 chars) */
  razao_social: string;
  /** Código do banco da empresa pagadora (ex: '033') */
  banco_codigo: string;
  /** Agência da empresa */
  agencia: string;
  /** Conta da empresa */
  conta: string;
  /** Dígito da conta */
  digito_conta: string;
}

export interface RegistroPagamento {
  /** Nome do favorecido (máx 30 chars) */
  nome: string;
  /** CPF somente números (11 dígitos) */
  cpf: string;
  /** Código COMPE do banco (3 dígitos, ex: '341') */
  banco_codigo: string;
  /** Agência sem dígito */
  agencia: string;
  /** Conta sem dígito */
  conta: string;
  /** Dígito da conta */
  digito_conta: string;
  /** 'corrente' | 'poupanca' */
  tipo_conta: 'corrente' | 'poupanca';
  /** Valor a pagar (em R$) */
  valor: number;
  /** Data do pagamento */
  data_pagamento: Date;
  /** Número sequencial único deste favorecido no lote */
  sequencial?: number;
}

export interface OpcoesGeracao {
  /** Número sequencial do arquivo (001 a 999) */
  numero_arquivo?: number;
  /** Código da finalidade: 45 = crédito em conta, 01 = TEF */
  finalidade?: string;
}

// ─── Constantes de layout ─────────────────────────────────────────────────────

const BANCO_CODIGO_HEADER = '000'; // Banco do arquivo (use 000 = multiplos bancos ou código do banco pagador)
const VERSAO_LAYOUT_ARQUIVO = '089';
const VERSAO_LAYOUT_LOTE = '040';

// ─── Gerador ─────────────────────────────────────────────────────────────────

export function gerarCNAB240(
  empresa: EmpresaRemetente,
  registros: RegistroPagamento[],
  opcoes: OpcoesGeracao = {},
): string {
  const agora = new Date();
  const numArquivo = zeroLeft(opcoes.numero_arquivo ?? 1, 6);
  const finalidade = opcoes.finalidade ?? '45'; // crédito em conta TED/DOC

  const linhas: string[] = [];

  // ── HEADER DO ARQUIVO (registro tipo 0, 240 chars) ──────────────────────
  linhas.push(buildHeaderArquivo(empresa, agora, numArquivo));

  // ── LOTE único (pagamentos a crédito em conta) ──────────────────────────
  const numLote = '0001';
  const totalLote = registros.length;
  let somaTotalLote = 0;

  // Header do Lote
  linhas.push(buildHeaderLote(empresa, numLote, finalidade, agora));

  // Segmentos de detalhe (um Segmento A por favorecido)
  registros.forEach((reg, idx) => {
    const seq = zeroLeft(idx + 1, 5);
    linhas.push(buildSegmentoA(empresa, numLote, seq, reg, agora));
    somaTotalLote += reg.valor;
  });

  // Trailer do Lote
  // Quantidade de registros = header lote + segmentos A + trailer lote
  const qtdRegistrosLote = 2 + totalLote;
  linhas.push(buildTrailerLote(numLote, qtdRegistrosLote, totalLote, somaTotalLote));

  // ── TRAILER DO ARQUIVO ──────────────────────────────────────────────────
  // Quantidade total de registros = header + header lote + segmentos + trailer lote + trailer arquivo
  const totalRegistrosArquivo = 2 + qtdRegistrosLote;
  linhas.push(buildTrailerArquivo(1, totalRegistrosArquivo, totalLote, somaTotalLote));

  return linhas.join('\r\n') + '\r\n';
}

// ─── Builders de registro ─────────────────────────────────────────────────────

function buildHeaderArquivo(emp: EmpresaRemetente, agora: Date, numArquivo: string): string {
  const banco = zeroLeft(emp.banco_codigo || BANCO_CODIGO_HEADER, 3);
  const cnpj = zeroLeft(soDigitos(emp.cnpj), 14);
  const agencia = zeroLeft(emp.agencia, 5);
  const conta = zeroLeft(emp.conta, 12);
  const digito = zeroLeft(emp.digito_conta, 1);

  return [
    banco,                             // 001-003: Código do banco
    '0000',                            // 004-007: Lote (0000 = header arquivo)
    '0',                               // 008-008: Tipo de registro (0 = header arquivo)
    ' '.repeat(9),                     // 009-017: Uso FEBRABAN (brancos)
    '2',                               // 018-018: Tipo de inscrição empresa (1=CPF, 2=CNPJ)
    cnpj,                              // 019-032: Número inscrição empresa
    ' '.repeat(20),                    // 033-052: Código convênio banco (espaços se não houver)
    agencia,                           // 053-057: Agência empresa
    ' ',                               // 058-058: Dígito da agência
    conta,                             // 059-070: Conta empresa
    digito,                            // 071-071: Dígito da conta
    ' ',                               // 072-072: Dígito agência/conta
    strRight(emp.razao_social, 30),    // 073-102: Nome empresa
    strRight('SICREDI PAGAMENTOS', 10),// 103-112: Nome do banco (pode ajustar)
    ' '.repeat(10),                    // 113-122: Uso FEBRABAN
    '1',                               // 123-123: Código remessa/retorno (1=remessa)
    formatData(agora),                 // 124-131: Data geração (DDMMAAAA)
    formatHora(agora),                 // 132-137: Hora geração (HHMMSS)
    numArquivo,                        // 138-143: Número sequencial do arquivo
    VERSAO_LAYOUT_ARQUIVO,             // 144-146: Versão layout arquivo
    zeroLeft(240, 9),                  // 147-155: Densidade gravação (zeros)
    ' '.repeat(20),                    // 156-175: Reservado banco
    ' '.repeat(20),                    // 176-195: Reservado empresa
    ' '.repeat(29),                    // 196-224: Uso FEBRABAN
    ' '.repeat(10),                    // 225-234: (completar até 240)
    ' '.repeat(6),                     // 235-240
  ].join('').slice(0, 240);
}

function buildHeaderLote(
  emp: EmpresaRemetente,
  numLote: string,
  finalidade: string,
  agora: Date,
): string {
  const banco = zeroLeft(emp.banco_codigo || BANCO_CODIGO_HEADER, 3);
  const cnpj = zeroLeft(soDigitos(emp.cnpj), 14);
  const agencia = zeroLeft(emp.agencia, 5);
  const conta = zeroLeft(emp.conta, 12);
  const digito = zeroLeft(emp.digito_conta, 1);

  return [
    banco,                             // 001-003: Banco
    numLote,                           // 004-007: Número do lote
    '1',                               // 008-008: Tipo de registro (1 = header lote)
    'C',                               // 009-009: Tipo operação (C = crédito)
    '98',                              // 010-011: Tipo serviço (98 = pagamentos/transferências)
    '00',                              // 012-013: Forma lançamento (00 = crédito cc)
    VERSAO_LAYOUT_LOTE,                // 014-016: Versão layout lote
    ' ',                               // 017-017: Uso FEBRABAN
    '2',                               // 018-018: Tipo inscrição empresa (2=CNPJ)
    cnpj,                              // 019-032: Número inscrição empresa
    ' '.repeat(20),                    // 033-052: Convênio
    agencia,                           // 053-057: Agência
    ' ',                               // 058-058: Dígito agência
    conta,                             // 059-070: Conta
    digito,                            // 071-071: Dígito conta
    ' ',                               // 072-072: Dígito agência/conta
    strRight(emp.razao_social, 30),    // 073-102: Nome empresa
    strRight('PAGAMENTO DIARISTAS', 40),// 103-142: Finalidade do lote
    strRight('', 10),                  // 143-152: Histórico C/C
    strRight('', 40),                  // 153-192: Endereço empresa
    zeroLeft(0, 5),                    // 193-197: Número do local
    strRight('', 15),                  // 198-212: Complemento
    strRight('', 20),                  // 213-232: Cidade
    strRight('', 2),                   // 233-234: Estado
    strRight('', 8),                   // 235-242: CEP (mas o campo é menor)
    ' '.repeat(33),                    // Para completar 240
  ].join('').slice(0, 240);
}

function buildSegmentoA(
  emp: EmpresaRemetente,
  numLote: string,
  seq: string,
  reg: RegistroPagamento,
  _agora: Date,
): string {
  const banco = zeroLeft(emp.banco_codigo || BANCO_CODIGO_HEADER, 3);
  const bancoFav = zeroLeft(reg.banco_codigo, 3);
  const agenciaFav = zeroLeft(reg.agencia, 5);
  const contaFav = zeroLeft(reg.conta, 12);
  const digitoFav = zeroLeft(reg.digito_conta, 1);
  const cpfFav = zeroLeft(soDigitos(reg.cpf), 14); // 14 dígitos para CPF (com zeros à esquerda)
  // Tipo conta: 01 = corrente, 05 = poupança (FEBRABAN)
  const tipoConta = reg.tipo_conta === 'poupanca' ? '05' : '01';

  return [
    banco,                              // 001-003: Banco
    numLote,                            // 004-007: Lote
    '3',                                // 008-008: Tipo de registro (3 = detalhe)
    seq,                                // 009-013: Número sequencial do registro no lote
    'A',                                // 014-014: Segmento
    '0',                                // 015-015: Tipo de movimento (0 = inclusão)
    '00',                               // 016-017: Código de instrução (00 = padrão)
    '018',                              // 018-020: Câmara compensação (018=TED, 700=DOC)
    bancoFav,                           // 021-023: Banco do favorecido
    agenciaFav,                         // 024-028: Agência do favorecido
    ' ',                                // 029-029: Dígito da agência
    contaFav,                           // 030-041: Conta do favorecido
    digitoFav,                          // 042-042: Dígito da conta
    ' ',                                // 043-043: Dígito agência/conta
    strRight(reg.nome, 30),             // 044-073: Nome do favorecido
    ' '.repeat(20),                     // 074-093: Número do documento empresa (deixar em branco)
    formatData(reg.data_pagamento),     // 094-101: Data do pagamento
    'BRL',                              // 102-104: Tipo moeda
    zeroLeft(0, 15),                    // 105-119: Quantidade moeda (zeros para BRL)
    zeroLeft(0, 5),                     // 120-124: Número do documento banco
    zeroLeft(0, 8),                     // 125-132: Data efetiva
    formatValor(reg.valor, 15),         // 133-147: Valor do pagamento
    zeroLeft(0, 5),                     // 148-152: Número do documento banco (retorno)
    zeroLeft(0, 8),                     // 153-160: Data real da efetivação
    zeroLeft(0, 15),                    // 161-175: Valor real da efetivação
    ' '.repeat(20),                     // 176-195: Informações complementares
    '00',                               // 196-197: Código finalidade TED (00 = crédito em conta)
    zeroLeft(finalidade(reg), 5),       // 198-202: Código finalidade DOC/TED (45=outros créditos em cc)
    '2',                                // 203-203: Tipo inscrição favorecido (1=CPF, 2=CNPJ)
    cpfFav,                             // 204-217: CPF/CNPJ do favorecido
    tipoConta,                          // 218-219: Tipo conta favorecido
    ' '.repeat(21),                     // 220-240: Completar
  ].join('').slice(0, 240);
}

/** Código finalidade da TED conforme tipo de conta */
function finalidade(_reg: RegistroPagamento): string {
  return '00045'; // crédito em conta — ajuste conforme banco
}

function buildTrailerLote(
  numLote: string,
  qtdRegistros: number,
  qtdPagamentos: number,
  soma: number,
): string {
  return [
    '000',                              // 001-003: Banco
    numLote,                            // 004-007: Lote
    '5',                                // 008-008: Tipo registro (5 = trailer lote)
    ' '.repeat(9),                      // 009-017: Uso FEBRABAN
    zeroLeft(qtdRegistros, 6),          // 018-023: Qtd de registros do lote (incluindo header e trailer)
    zeroLeft(qtdPagamentos, 6),         // 024-029: Qtd de títulos/pagamentos
    zeroLeft(0, 17),                    // 030-046: Valor total (0 pois usamos o campo abaixo)
    formatValor(soma, 18),              // 047-064: Valor total dos pagamentos do lote
    zeroLeft(0, 6),                     // 065-070: Qtd alertas (zeros)
    ' '.repeat(165),                    // 071-235: Uso FEBRABAN (brancos)
    ' '.repeat(5),                      // 236-240: Completar
  ].join('').slice(0, 240);
}

function buildTrailerArquivo(
  qtdLotes: number,
  totalRegistros: number,
  qtdPagamentos: number,
  somaTotal: number,
): string {
  return [
    '000',                              // 001-003: Banco
    '9999',                             // 004-007: Lote (9999 = trailer arquivo)
    '9',                                // 008-008: Tipo registro (9 = trailer arquivo)
    ' '.repeat(9),                      // 009-017: Uso FEBRABAN
    zeroLeft(qtdLotes, 6),              // 018-023: Qtd de lotes do arquivo
    zeroLeft(totalRegistros, 6),        // 024-029: Qtd total de registros do arquivo
    zeroLeft(qtdPagamentos, 6),         // 030-035: Qtd de contas para conciliação (zeros)
    ' '.repeat(205),                    // 036-240: Uso FEBRABAN (brancos/zeros)
  ].join('').slice(0, 240);
}

// ─── Validador ────────────────────────────────────────────────────────────────

export interface ValidacaoCNAB {
  valido: boolean;
  erros: string[];
}

export function validarRegistrosCNAB(registros: RegistroPagamento[]): ValidacaoCNAB {
  const erros: string[] = [];

  if (registros.length === 0) {
    erros.push('Nenhum registro de pagamento encontrado no lote.');
    return { valido: false, erros };
  }

  registros.forEach((r, idx) => {
    const prefixo = `Diarista ${idx + 1} (${r.nome || 'sem nome'})`;

    if (!r.nome?.trim()) erros.push(`${prefixo}: Nome é obrigatório.`);
    if (!r.cpf || soDigitos(r.cpf).length !== 11) erros.push(`${prefixo}: CPF inválido ou ausente.`);
    if (!r.banco_codigo) erros.push(`${prefixo}: Código do banco ausente.`);
    if (!r.agencia) erros.push(`${prefixo}: Agência ausente.`);
    if (!r.conta) erros.push(`${prefixo}: Conta ausente.`);
    if (!r.digito_conta) erros.push(`${prefixo}: Dígito da conta ausente.`);
    if (!r.tipo_conta) erros.push(`${prefixo}: Tipo de conta (corrente/poupança) ausente.`);
    if (!r.valor || r.valor <= 0) erros.push(`${prefixo}: Valor deve ser maior que zero.`);
  });

  return { valido: erros.length === 0, erros };
}
