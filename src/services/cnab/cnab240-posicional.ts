/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CNAB240 — Gerador Posicional Real FEBRABAN / Banco do Brasil           ║
 * ║                                                                          ║
 * ║  Cada linha possui EXATAMENTE 240 caracteres.                            ║
 * ║  Campos são montados posição a posição conforme layout oficial.           ║
 * ║  Acentos são normalizados (ANSI-safe).                                   ║
 * ║  Exportação em Windows-1252 (ANSI) conforme padrão bancário.             ║
 * ║                                                                          ║
 * ║  Referência: Manual Técnico BB/FEBRABAN CNAB240 v14.4                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { BB } from './segmentos/cnab240-bb-layout';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

export interface EmpresaRemessa {
  /** CNPJ somente dígitos (14) */
  cnpj: string;
  /** Razão social — será normalizada e truncada a 30 chars */
  razao_social: string;
  /** Agência sem dígito */
  agencia: string;
  /** Dígito verificador da agência (1 char) */
  agencia_digito: string;
  /** Conta sem dígito */
  conta: string;
  /** Dígito verificador da conta (1 char) */
  conta_digito: string;
  /** Convênio bancário (até 20 chars) — obrigatório para BB */
  convenio: string;
  /** Endereço da empresa (opcional) */
  logradouro?: string;
  numero?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface BeneficiarioPagamento {
  /** Nome completo — será normalizado e truncado */
  nome: string;
  /** CPF somente dígitos (11) */
  cpf: string;
  /** Código COMPE do banco (3 dígitos) */
  banco_codigo: string;
  /** Agência sem dígito */
  agencia: string;
  /** Dígito da agência */
  agencia_digito: string;
  /** Conta sem dígito */
  conta: string;
  /** Dígito da conta */
  conta_digito: string;
  /** corrente | poupanca */
  tipo_conta: 'corrente' | 'poupanca';
  /** Valor em R$ (ex: 150.50) */
  valor: number;
  /** Data de pagamento */
  data_pagamento: Date;
  /** Número do documento (identificador do pagamento para o banco) — máx 20 chars */
  seu_numero?: string;
  /** Logradouro do beneficiário (para segmento B) */
  logradouro?: string;
  numero_end?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface OpcoesCNAB240 {
  /** Número sequencial do arquivo (001..999999). Default: 1 */
  numero_arquivo?: number;
  /** Data de geração — default: agora */
  data_geracao?: Date;
  /** Gerar Segmento B (dados complementares / CPF)? Default: true */
  incluir_segmento_b?: boolean;
  /** Tipo serviço do lote: 20=Fornecedor, 30=Salários. Default: 20 */
  tipo_servico?: number;
}

export interface ResultadoCNAB240 {
  /** Conteúdo do arquivo como string (com \r\n) */
  conteudo: string;
  /** Buffer Windows-1252 — pronto para download (ArrayBuffer) */
  buffer: ArrayBuffer;
  /** Nome do arquivo sugerido */
  nome_arquivo: string;
  /** Quantidade de linhas (registros) */
  total_linhas: number;
  /** Valor total somado */
  valor_total: number;
  /** Total de beneficiários processados */
  total_beneficiarios: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FORMATAÇÃO POSICIONAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove acentos, cedilha e caracteres especiais não-ASCII.
 * Mantém letras A-Z, 0-9, espaço, e pontuação básica.
 */
function normalizar(v: string | null | undefined): string {
  if (!v) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritics
    .replace(/[Ç]/g, 'C')
    .replace(/[ç]/g, 'C')
    .replace(/[ÃÀÁÂä]/gi, 'A')
    .replace(/[ÉÈÊë]/gi, 'E')
    .replace(/[ÍÌÎï]/gi, 'I')
    .replace(/[ÓÒÔÕö]/gi, 'O')
    .replace(/[ÚÙÛü]/gi, 'U')
    .replace(/[^a-zA-Z0-9 .,\/\-_&@()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Campo ALFANUMÉRICO — alinhado à esquerda, preenchido com espaços à direita.
 * Normaliza acentos. Trunca se exceder `len`.
 */
function alfa(v: string | null | undefined, len: number): string {
  const clean = normalizar(v);
  return clean.padEnd(len, ' ').substring(0, len);
}

/**
 * Campo NUMÉRICO — alinhado à direita, preenchido com zeros à esquerda.
 * Remove tudo que não for dígito. Trunca da ESQUERDA se exceder `len`.
 */
function num(v: string | number | null | undefined, len: number): string {
  const clean = String(v ?? '').replace(/\D/g, '');
  return clean.padStart(len, '0').slice(-len);
}

/**
 * Valor monetário em centavos, sem separador — 15 dígitos por padrão.
 * Ex: 150.50 → "000000000015050"
 */
function valor(v: number, len = 15): string {
  const centavos = Math.round(Math.abs(v) * 100);
  return String(centavos).padStart(len, '0').slice(-len);
}

/** Data no formato DDMMAAAA (8 chars) */
function dataFmt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

/** Hora no formato HHMMSS (6 chars) */
function horaFmt(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}${mi}${ss}`;
}

/** Zeros repetidos: `zeros(9)` → `'000000000'` */
function zeros(n: number): string {
  return '0'.repeat(n);
}

/** Espaços repetidos: `spaces(5)` → `'     '` */
function spaces(n: number): string {
  return ' '.repeat(n);
}

/** Valida linha e lança erro se não tiver 240 chars */
function assertLinha(linha: string, descricao: string): string {
  if (linha.length !== 240) {
    throw new Error(
      `[CNAB240] Linha inválida — ${descricao}: esperado 240 chars, obtido ${linha.length}.\n` +
      `  Conteúdo: |${linha}|`
    );
  }
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS DE SEGMENTOS — BANCO DO BRASIL (001)
// ─────────────────────────────────────────────────────────────────────────────

function buildHeaderArquivo(emp: EmpresaRemessa, agora: Date, numArquivo: number): string {
  const cnpj = num(emp.cnpj.replace(/\D/g, ''), 14);
  const tipoInscricao = cnpj.length === 11 ? '1' : '2'; // sempre CNPJ = 2

  // Monta campo a campo conforme layout BB
  // Pos 001-003  (3) Banco
  let l = BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote = 0000 (header arquivo)
  l += '0000';
  // Pos 008-008  (1) Tipo = 0
  l += '0';
  // Pos 009-017  (9) Brancos
  l += spaces(9);
  // Pos 018-018  (1) Tipo inscrição (2=CNPJ)
  l += tipoInscricao;
  // Pos 019-032 (14) CNPJ
  l += cnpj;
  // Pos 033-052 (20) Convênio
  l += alfa(emp.convenio, 20);
  // Pos 053-057  (5) Agência
  l += num(emp.agencia, 5);
  // Pos 058-058  (1) Dígito agência
  l += alfa(emp.agencia_digito || ' ', 1);
  // Pos 059-070 (12) Conta
  l += num(emp.conta, 12);
  // Pos 071-071  (1) Dígito conta
  l += alfa(emp.conta_digito || ' ', 1);
  // Pos 072-072  (1) Dígito ag/conta
  l += spaces(1);
  // Pos 073-102 (30) Nome empresa
  l += alfa(emp.razao_social, 30);
  // Pos 103-132 (30) Nome banco
  l += alfa(BB.NOME_BANCO, 30);
  // Pos 133-142 (10) Uso FEBRABAN
  l += spaces(10);
  // Pos 143-143  (1) Remessa=1 / Retorno=2
  l += '1';
  // Pos 144-151  (8) Data geração DDMMAAAA
  l += dataFmt(agora);
  // Pos 152-157  (6) Hora geração HHMMSS
  l += horaFmt(agora);
  // Pos 158-163  (6) Nseq arquivo
  l += num(numArquivo, 6);
  // Pos 164-166  (3) Versão layout
  l += BB.VERSAO_LAYOUT_ARQUIVO;
  // Pos 167-171  (5) Densidade — 01600 bpi padrão
  l += num(1600, 5);
  // Pos 172-191 (20) Reservado banco
  l += spaces(20);
  // Pos 192-211 (20) Reservado empresa
  l += spaces(20);
  // Pos 212-240 (29) Uso FEBRABAN
  l += spaces(29);

  return assertLinha(l, 'Header de Arquivo');
}

function buildHeaderLote(
  emp: EmpresaRemessa,
  numLote: number,
  tipoServico: number,
  agora: Date
): string {
  const cnpj = num(emp.cnpj.replace(/\D/g, ''), 14);
  const tipoInscricao = '2'; // sempre CNPJ

  // Forma de lançamento: 41=TED (tranf. entre bancos diferentes)
  // Para pagto entre contas do mesmo banco: 01=CC, 05=Poupança
  // Usamos 41 como padrão pois beneficiários podem ser de qualquer banco
  const formaLancamento = num(BB.FORMA_LANCAMENTO_TED, 2);

  let l = '';
  // Pos 001-003  (3) Banco
  l += BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote
  l += num(numLote, 4);
  // Pos 008-008  (1) Tipo = 1
  l += '1';
  // Pos 009-009  (1) Operação = C (crédito)
  l += 'C';
  // Pos 010-011  (2) Tipo serviço (20=Fornecedor, 30=Salário)
  l += num(tipoServico, 2);
  // Pos 012-013  (2) Forma lançamento
  l += formaLancamento;
  // Pos 014-016  (3) Versão layout lote
  l += BB.VERSAO_LAYOUT_LOTE;
  // Pos 017-017  (1) Brancos
  l += spaces(1);
  // Pos 018-018  (1) Tipo inscrição
  l += tipoInscricao;
  // Pos 019-032 (14) CNPJ
  l += cnpj;
  // Pos 033-052 (20) Convênio
  l += alfa(emp.convenio, 20);
  // Pos 053-057  (5) Agência
  l += num(emp.agencia, 5);
  // Pos 058-058  (1) Dígito agência
  l += alfa(emp.agencia_digito || ' ', 1);
  // Pos 059-070 (12) Conta
  l += num(emp.conta, 12);
  // Pos 071-071  (1) Dígito conta
  l += alfa(emp.conta_digito || ' ', 1);
  // Pos 072-072  (1) Dígito ag/conta
  l += spaces(1);
  // Pos 073-102 (30) Nome empresa
  l += alfa(emp.razao_social, 30);
  // Pos 103-142 (40) Mensagem 1 / Finalidade do lote
  l += alfa('PAGAMENTO DIARISTAS', 40);
  // Pos 143-172 (30) Logradouro
  l += alfa(emp.logradouro || '', 30);
  // Pos 173-177  (5) Número
  l += num(emp.numero || '0', 5);
  // Pos 178-192 (15) Complemento
  l += alfa('', 15);
  // Pos 193-212 (20) Cidade
  l += alfa(emp.cidade || '', 20);
  // Pos 213-217  (5) CEP (5 primeiros dígitos)
  const cepDigits = (emp.cep || '').replace(/\D/g, '');
  l += num(cepDigits.slice(0, 5) || '0', 5);
  // Pos 218-220  (3) Sufixo CEP (últimos 3)
  l += num(cepDigits.slice(5, 8) || '0', 3);
  // Pos 221-222  (2) Estado
  l += alfa(emp.estado || '', 2);
  // Pos 223-230  (8) Uso FEBRABAN
  l += spaces(8);
  // Pos 231-240 (10) Ocorrências
  l += spaces(10);

  return assertLinha(l, 'Header de Lote');
}

function buildSegmentoA(
  emp: EmpresaRemessa,
  numLote: number,
  numSeq: number,
  ben: BeneficiarioPagamento
): string {
  const isMesmoBanco = ben.banco_codigo === BB.CODIGO_BANCO;
  const camara = isMesmoBanco ? BB.CAMARA_CC : BB.CAMARA_TED;
  const finTED = BB.FINALIDADE_TED_CC; // 00001 = crédito em CC

  let l = '';
  // Pos 001-003  (3) Banco
  l += BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote
  l += num(numLote, 4);
  // Pos 008-008  (1) Tipo = 3 (detalhe)
  l += '3';
  // Pos 009-013  (5) Nseq no lote
  l += num(numSeq, 5);
  // Pos 014-014  (1) Segmento A
  l += 'A';
  // Pos 015-015  (1) Tipo movimento: 0=Inclusão
  l += '0';
  // Pos 016-017  (2) Código instrução: 00=Inclusão
  l += '00';
  // Pos 018-020  (3) Câmara compensação
  l += camara;
  // Pos 021-023  (3) Banco favorecido
  l += num(ben.banco_codigo, 3);
  // Pos 024-028  (5) Agência favorecido
  l += num(ben.agencia, 5);
  // Pos 029-029  (1) Dígito agência favorecido
  l += alfa(ben.agencia_digito || ' ', 1);
  // Pos 030-041 (12) Conta favorecido
  l += num(ben.conta, 12);
  // Pos 042-042  (1) Dígito conta favorecido
  l += alfa(ben.conta_digito || ' ', 1);
  // Pos 043-043  (1) Dígito ag/conta favorecido
  l += spaces(1);
  // Pos 044-073 (30) Nome favorecido
  l += alfa(ben.nome, 30);
  // Pos 074-093 (20) Seu número (Nro Doc Empresa)
  l += alfa(ben.seu_numero || '', 20);
  // Pos 094-101  (8) Data pagamento DDMMAAAA
  l += dataFmt(ben.data_pagamento);
  // Pos 102-104  (3) Tipo moeda
  l += 'BRL';
  // Pos 105-119 (15) Quantidade moeda (zeros para BRL)
  l += zeros(15);
  // Pos 120-134 (15) Valor pagamento (em centavos, sem separador)
  l += valor(ben.valor, 15);
  // Pos 135-154 (20) Nosso número (Nro Doc Banco — retorno)
  l += spaces(20);
  // Pos 155-162  (8) Data real efetivação (zeros na remessa)
  l += zeros(8);
  // Pos 163-177 (15) Valor real efetivação (zeros na remessa)
  l += zeros(15);
  // Pos 178-217 (40) Outras informações
  l += spaces(40);
  // Pos 218-219  (2) Código finalidade DOC (espaços — campo obrigatório só para DOC)
  l += spaces(2);
  // Pos 220-224  (5) Código finalidade TED (00001=crédito CC, 00005=salário)
  l += finTED;
  // Pos 225-226  (2) Código finalidade complementar
  l += spaces(2);
  // Pos 227-229  (3) Uso FEBRABAN
  l += spaces(3);
  // Pos 230-230  (1) Aviso (0=sem aviso)
  l += '0';
  // Pos 231-240 (10) Ocorrências
  l += spaces(10);

  return assertLinha(l, `Segmento A (seq ${numSeq})`);
}

function buildSegmentoB(
  numLote: number,
  numSeq: number,
  ben: BeneficiarioPagamento
): string {
  const cpf = num(ben.cpf.replace(/\D/g, ''), 14);
  const tipoInscricao = cpf.replace(/^0+/, '').length <= 11 ? '1' : '2';
  const cepDigits = (ben.cep || '').replace(/\D/g, '');

  let l = '';
  // Pos 001-003  (3) Banco
  l += BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote
  l += num(numLote, 4);
  // Pos 008-008  (1) Tipo = 3
  l += '3';
  // Pos 009-013  (5) Nseq
  l += num(numSeq, 5);
  // Pos 014-014  (1) Segmento B
  l += 'B';
  // Pos 015-017  (3) Uso FEBRABAN
  l += spaces(3);
  // Pos 018-018  (1) Tipo inscrição (1=CPF)
  l += tipoInscricao;
  // Pos 019-032 (14) CPF/CNPJ favorecido
  l += cpf;
  // Pos 033-062 (30) Logradouro
  l += alfa(ben.logradouro || 'NAO INFORMADO', 30);
  // Pos 063-067  (5) Número
  l += num(ben.numero_end || '0', 5);
  // Pos 068-082 (15) Complemento
  l += alfa(ben.complemento || '', 15);
  // Pos 083-097 (15) Bairro
  l += alfa(ben.bairro || '', 15);
  // Pos 098-117 (20) Cidade
  l += alfa(ben.cidade || 'NAO INFORMADO', 20);
  // Pos 118-122  (5) CEP
  l += num(cepDigits.slice(0, 5) || '0', 5);
  // Pos 123-125  (3) Sufixo CEP
  l += num(cepDigits.slice(5, 8) || '0', 3);
  // Pos 126-127  (2) Estado
  l += alfa(ben.estado || 'SP', 2);
  // Pos 128-135  (8) Data vencimento (zeros = pagto imediato)
  l += zeros(8);
  // Pos 136-150 (15) Valor documento
  l += zeros(15);
  // Pos 151-165 (15) Valor abatimento
  l += zeros(15);
  // Pos 166-180 (15) Valor desconto
  l += zeros(15);
  // Pos 181-195 (15) Valor mora
  l += zeros(15);
  // Pos 196-210 (15) Valor multa
  l += zeros(15);
  // Pos 211-225 (15) Código doc favorecido
  l += spaces(15);
  // Pos 226-226  (1) Aviso
  l += '0';
  // Pos 227-240 (14) Uso FEBRABAN
  l += spaces(14);

  return assertLinha(l, `Segmento B (seq ${numSeq})`);
}

function buildTrailerLote(
  numLote: number,
  qtdRegistros: number,
  qtdPagamentos: number,
  somaValores: number
): string {
  let l = '';
  // Pos 001-003  (3) Banco
  l += BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote
  l += num(numLote, 4);
  // Pos 008-008  (1) Tipo = 5
  l += '5';
  // Pos 009-017  (9) Uso FEBRABAN
  l += spaces(9);
  // Pos 018-023  (6) Qtd registros do lote (header + detalhes + trailer)
  l += num(qtdRegistros, 6);
  // Pos 024-029  (6) Qtd títulos débito (0 para pagamentos)
  l += zeros(6);
  // Pos 030-046 (17) Valor total débito
  l += zeros(17);
  // Pos 047-052  (6) Qtd títulos crédito (=qtd pagamentos)
  l += num(qtdPagamentos, 6);
  // Pos 053-069 (17) Valor total crédito (em centavos, 17 dígitos)
  l += valor(somaValores, 17);
  // Pos 070-075  (6) Qtd outras
  l += zeros(6);
  // Pos 076-092 (17) Valor outras
  l += zeros(17);
  // Pos 093-098  (6) Número aviso débito
  l += zeros(6);
  // Pos 099-230 (132) Uso FEBRABAN
  l += spaces(132);
  // Pos 231-240 (10) Ocorrências
  l += spaces(10);

  return assertLinha(l, 'Trailer de Lote');
}

function buildTrailerArquivo(
  qtdLotes: number,
  qtdRegistros: number
): string {
  let l = '';
  // Pos 001-003  (3) Banco
  l += BB.CODIGO_BANCO;
  // Pos 004-007  (4) Lote = 9999
  l += '9999';
  // Pos 008-008  (1) Tipo = 9
  l += '9';
  // Pos 009-017  (9) Uso FEBRABAN
  l += spaces(9);
  // Pos 018-023  (6) Qtd lotes
  l += num(qtdLotes, 6);
  // Pos 024-029  (6) Qtd total de registros do arquivo
  l += num(qtdRegistros, 6);
  // Pos 030-035  (6) Qtd contas conciliação (não obrigatório)
  l += zeros(6);
  // Pos 036-240 (205) Uso FEBRABAN
  l += spaces(205);

  return assertLinha(l, 'Trailer de Arquivo');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSÃO PARA WINDOWS-1252
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte string (já sem acentos, pois `normalizar()` foi aplicado)
 * para Uint8Array encodado em Windows-1252 (ANSI).
 *
 * Como o conteúdo já foi normalizado para ASCII básico pela função `normalizar()`,
 * a conversão é 1:1 para os primeiros 127 codepoints.
 * Caracteres residuais acima de 127 são mapeados via tabela cp1252.
 */
function encodeWindows1252(text: string): ArrayBuffer {
  // Tabela de mapeamento unicode → cp1252 para chars 128-159
  // (os 160+ são idênticos ao unicode latin-1, exceto essa faixa)
  const cp1252ExtraMap: Record<number, number> = {
    0x20AC: 0x80, // €
    0x201A: 0x82, // ‚
    0x0192: 0x83, // ƒ
    0x201E: 0x84, // „
    0x2026: 0x85, // …
    0x2020: 0x86, // †
    0x2021: 0x87, // ‡
    0x02C6: 0x88, // ˆ
    0x2030: 0x89, // ‰
    0x0160: 0x8A, // Š
    0x2039: 0x8B, // ‹
    0x0152: 0x8C, // Œ
    0x017D: 0x8E, // Ž
    0x2018: 0x91, // '
    0x2019: 0x92, // '
    0x201C: 0x93, // "
    0x201D: 0x94, // "
    0x2022: 0x95, // •
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x02DC: 0x98, // ˜
    0x2122: 0x99, // ™
    0x0161: 0x9A, // š
    0x203A: 0x9B, // ›
    0x0153: 0x9C, // œ
    0x017E: 0x9E, // ž
    0x0178: 0x9F, // Ÿ
  };

  // Usa ArrayBuffer explícito para compatibilidade com BlobPart (evita SharedArrayBuffer)
  const buffer = new ArrayBuffer(text.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes[i] = code;
    } else if (cp1252ExtraMap[code] !== undefined) {
      bytes[i] = cp1252ExtraMap[code];
    } else if (code >= 0x80 && code <= 0xFF) {
      bytes[i] = code;
    } else {
      bytes[i] = 0x3F; // '?' para chars fora do range cp1252
    }
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO PRÉVIA DOS DADOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidacaoBeneficiario {
  valido: boolean;
  erros: string[];
}

export function validarBeneficiarios(beneficiarios: BeneficiarioPagamento[]): ValidacaoBeneficiario {
  const erros: string[] = [];

  if (beneficiarios.length === 0) {
    erros.push('Nenhum beneficiário para gerar o arquivo CNAB.');
    return { valido: false, erros };
  }

  beneficiarios.forEach((b, idx) => {
    const prefix = `Beneficiário ${idx + 1} (${b.nome || 'sem nome'})`;
    const cpf = b.cpf?.replace(/\D/g, '') ?? '';
    if (!b.nome?.trim())                erros.push(`${prefix}: nome é obrigatório.`);
    if (cpf.length !== 11)              erros.push(`${prefix}: CPF inválido (${cpf.length} dígitos encontrados, esperado 11).`);
    if (!b.banco_codigo?.trim())        erros.push(`${prefix}: código do banco ausente.`);
    if (!b.agencia?.trim())             erros.push(`${prefix}: agência ausente.`);
    if (!b.conta?.trim())               erros.push(`${prefix}: conta ausente.`);
    if (!b.conta_digito?.trim())        erros.push(`${prefix}: dígito da conta ausente.`);
    if (!(b.valor > 0))                 erros.push(`${prefix}: valor deve ser maior que zero (atual: ${b.valor}).`);
    if (!(b.data_pagamento instanceof Date) || isNaN(b.data_pagamento.getTime())) {
      erros.push(`${prefix}: data de pagamento inválida.`);
    }
  });

  return { valido: erros.length === 0, erros };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera arquivo CNAB240 real FEBRABAN para Banco do Brasil.
 * Cada linha tem EXATAMENTE 240 caracteres.
 * Exporta em Windows-1252 (ANSI).
 */
export function gerarCNAB240BB(
  empresa: EmpresaRemessa,
  beneficiarios: BeneficiarioPagamento[],
  opcoes: OpcoesCNAB240 = {}
): ResultadoCNAB240 {
  // ── Opções com defaults ───────────────────────────────────────────────────
  const agora        = opcoes.data_geracao ?? new Date();
  const numArquivo   = opcoes.numero_arquivo ?? 1;
  const inclSegB     = opcoes.incluir_segmento_b !== false; // default true
  const tipoServico  = opcoes.tipo_servico ?? BB.TIPO_SERVICO_FORNECEDOR;

  // ── Validação ─────────────────────────────────────────────────────────────
  const validacao = validarBeneficiarios(beneficiarios);
  if (!validacao.valido) {
    throw new Error(
      `Arquivo CNAB não pode ser gerado — dados inválidos:\n` +
      validacao.erros.map(e => `• ${e}`).join('\n')
    );
  }

  const numLote = 1; // Um único lote por arquivo
  const segmentosParaBen = inclSegB ? 2 : 1; // A (+B por beneficiário)

  // ── Linha counter ─────────────────────────────────────────────────────────
  const linhas: string[] = [];

  // ── 1. Header de Arquivo ──────────────────────────────────────────────────
  linhas.push(buildHeaderArquivo(empresa, agora, numArquivo));

  // ── 2. Header de Lote ─────────────────────────────────────────────────────
  linhas.push(buildHeaderLote(empresa, numLote, tipoServico, agora));

  // ── 3. Detalhes ───────────────────────────────────────────────────────────
  let numSeqLote = 1;
  let somaValores = 0;

  for (const ben of beneficiarios) {
    // Segmento A
    linhas.push(buildSegmentoA(empresa, numLote, numSeqLote++, ben));
    // Segmento B (dados complementares / CPF do favorecido)
    if (inclSegB) {
      linhas.push(buildSegmentoB(numLote, numSeqLote++, ben));
    }
    somaValores += ben.valor;
  }

  // ── 4. Trailer de Lote ────────────────────────────────────────────────────
  // Qtd registros lote = Header Lote + Segmentos + Trailer Lote
  const qtdDetalhes = beneficiarios.length * segmentosParaBen;
  const qtdRegistrosLote = 1 /* header lote */ + qtdDetalhes + 1 /* trailer lote */;
  linhas.push(buildTrailerLote(numLote, qtdRegistrosLote, beneficiarios.length, somaValores));

  // ── 5. Trailer de Arquivo ─────────────────────────────────────────────────
  // Qtd total = Header Arquivo + conteúdo do(s) lote(s) + Trailer Arquivo
  const qtdTotalRegistros = 1 /* header arq */ + qtdRegistrosLote + 1 /* trailer arq */;
  linhas.push(buildTrailerArquivo(1 /* qtd lotes */, qtdTotalRegistros));

  // ── Montagem ──────────────────────────────────────────────────────────────
  // CNAB: linhas separadas por CRLF (\r\n), sem linha final em branco
  const conteudo = linhas.join('\r\n') + '\r\n';

  // ── Buffer Windows-1252 ───────────────────────────────────────────────────
  // Codificar linha por linha (já estão normalizadas)
  const encoder = encodeWindows1252(conteudo);

  // ── Nome do arquivo ───────────────────────────────────────────────────────
  const datePart = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}`;
  const nomeArquivo = `CB${datePart}${String(numArquivo).padStart(6, '0')}.txt`;

  return {
    conteudo,
    buffer: encoder,
    nome_arquivo: nomeArquivo,
    total_linhas: linhas.length,
    valor_total: somaValores,
    total_beneficiarios: beneficiarios.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIO — DOWNLOAD BROWSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispara o download do arquivo CNAB240 no browser como ANSI/Windows-1252.
 * Esta função é isomórfica (não faz nada em SSR/Node).
 */
export function downloadCNAB240(resultado: ResultadoCNAB240): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([resultado.buffer], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = resultado.nome_arquivo;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIO — VERIFICADOR DE LINHAS (para debug)
// ─────────────────────────────────────────────────────────────────────────────

/** Verifica se todas as linhas do conteúdo têm exatamente 240 chars */
export function verificarLinhas(conteudo: string): { ok: boolean; erros: string[] } {
  const linhas = conteudo.split(/\r\n|\r|\n/).filter(l => l.length > 0);
  const erros: string[] = [];

  linhas.forEach((linha, idx) => {
    if (linha.length !== 240) {
      erros.push(`Linha ${idx + 1}: ${linha.length} chars (esperado 240) → |${linha.substring(0, 30)}...|`);
    }
  });

  return { ok: erros.length === 0, erros };
}
