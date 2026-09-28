/**
 * CNAB240 — Gerador Posicional Real FEBRABAN / Banco Itaú (341) — SISPAG
 *
 * Cada linha possui EXATAMENTE 240 caracteres.
 * Campos são montados posição a posição conforme layout oficial Itaú SISPAG / FEBRABAN.
 * Acentos são normalizados (ANSI-safe).
 * Exportação em Windows-1252 (ANSI) conforme padrão bancário.
 *
 * Referência: Manual Técnico Itaú SISPAG CNAB240 v081/040
 */

import { ITAU } from './segmentos/cnab240-itau-layout';
import {
  EmpresaRemessa,
  BeneficiarioPagamento,
  OpcoesCNAB240,
  ResultadoCNAB240,
  validarBeneficiarios,
} from './cnab240-posicional';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FORMATAÇÃO POSICIONAL
// ─────────────────────────────────────────────────────────────────────────────

function normalizar(v: string | null | undefined): string {
  if (!v) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function alfa(v: string | null | undefined, len: number): string {
  const clean = normalizar(v);
  return clean.padEnd(len, ' ').substring(0, len);
}

function num(v: string | number | null | undefined, len: number): string {
  const clean = String(v ?? '').replace(/\D/g, '');
  return clean.padStart(len, '0').slice(-len);
}

function valor(v: number, len = 15): string {
  const centavos = Math.round(Math.abs(v) * 100);
  return String(centavos).padStart(len, '0').slice(-len);
}

function dataFmt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function horaFmt(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}${mi}${ss}`;
}

function zeros(n: number): string {
  return '0'.repeat(n);
}

function spaces(n: number): string {
  return ' '.repeat(n);
}

function assertLinha(linha: string, descricao: string): string {
  if (linha.length !== 240) {
    throw new Error(
      `[CNAB240 Itaú] Linha inválida — ${descricao}: esperado 240 chars, obtido ${linha.length}.\n` +
      `  Conteúdo: |${linha}|`
    );
  }
  return linha;
}

function encodeWindows1252(text: string): ArrayBuffer {
  const cp1252ExtraMap: Record<number, number> = {
    0x20AC: 0x80,
    0x201A: 0x82,
    0x0192: 0x83,
    0x201E: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02C6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8A,
    0x2039: 0x8B,
    0x0152: 0x8C,
    0x017D: 0x8E,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201C: 0x93,
    0x201D: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02DC: 0x98,
    0x2122: 0x99,
    0x0161: 0x9A,
    0x203A: 0x9B,
    0x0153: 0x9C,
    0x017E: 0x9E,
    0x0178: 0x9F,
  };

  const buffer = new ArrayBuffer(text.length);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      view[i] = code;
    } else if (code in cp1252ExtraMap) {
      view[i] = cp1252ExtraMap[code];
    } else if (code >= 160 && code <= 255) {
      view[i] = code;
    } else {
      view[i] = 0x20;
    }
  }

  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS DE SEGMENTOS — BANCO ITAÚ (341)
// ─────────────────────────────────────────────────────────────────────────────

function buildHeaderArquivoItau(emp: EmpresaRemessa, agora: Date, numArquivo: number): string {
  const cnpj = num(emp.cnpj.replace(/\D/g, ''), 14);
  const tipoInscricao = cnpj.length === 11 ? '1' : '2';

  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += '0000';                            // 004-007 (4) Lote 0000
  l += '0';                               // 008-008 (1) Tipo = 0
  l += spaces(9);                         // 009-017 (9) Brancos FEBRABAN
  l += tipoInscricao;                     // 018-018 (1) 2=CNPJ / 1=CPF
  l += cnpj;                              // 019-032 (14) CNPJ/CPF da empresa
  l += spaces(20);                        // 033-052 (20) Reservado empresa/banco no Itaú
  l += num(emp.agencia, 5);               // 053-057 (5) Agência
  l += spaces(1);                         // 058-058 (1) DAC Agência (Branco no Itaú)
  l += num(emp.conta, 12);                // 059-070 (12) Conta
  l += alfa(emp.conta_digito || '0', 1);  // 071-071 (1) DAC Conta
  l += spaces(1);                         // 072-072 (1) DAC Ag/Conta (Branco)
  l += alfa(emp.razao_social, 30);        // 073-102 (30) Nome empresa
  l += alfa(ITAU.NOME_BANCO, 30);         // 103-132 (30) BANCO ITAU SA
  l += spaces(10);                        // 133-142 (10) Uso FEBRABAN
  l += '1';                               // 143-143 (1) Remessa = 1
  l += dataFmt(agora);                    // 144-151 (8) Data geração DDMMAAAA
  l += horaFmt(agora);                    // 152-157 (6) Hora geração HHMMSS
  l += num(numArquivo, 6);                // 158-163 (6) Sequencial do arquivo
  l += ITAU.VERSAO_LAYOUT_ARQUIVO;        // 164-166 (3) '081' (Layout Itaú)
  l += num(0, 5);                         // 167-171 (5) Densidade '00000'
  l += spaces(69);                        // 172-240 (69) Reservado Banco

  return assertLinha(l, 'Header de Arquivo Itaú');
}

function buildHeaderLoteItau(
  emp: EmpresaRemessa,
  numLote: number,
  tipoServico: number,
  agora: Date,
  todosMesmoBanco: boolean
): string {
  const cnpj = num(emp.cnpj.replace(/\D/g, ''), 14);
  const tipoInscricao = cnpj.length === 11 ? '1' : '2';
  // Forma lançamento: 01=CC Itaú, 41=TED Outra Titularidade
  const formaLancamento = todosMesmoBanco ? ITAU.FORMA_LANCAMENTO_CC : ITAU.FORMA_LANCAMENTO_TED;

  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += num(numLote, 4);                   // 004-007 (4) Lote
  l += '1';                               // 008-008 (1) Tipo = 1
  l += 'C';                               // 009-009 (1) Operação = C (crédito)
  l += num(tipoServico, 2);               // 010-011 (2) Tipo serviço (20=Fornecedor, 30=Salário)
  l += formaLancamento;                   // 012-013 (2) Forma lançamento
  l += ITAU.VERSAO_LAYOUT_LOTE;           // 014-016 (3) '040' (Layout lote Itaú)
  l += spaces(1);                         // 017-017 (1) Branco
  l += tipoInscricao;                     // 018-018 (1) 2=CNPJ
  l += cnpj;                              // 019-032 (14) CNPJ
  l += spaces(20);                        // 033-052 (20) Reservado Banco
  l += num(emp.agencia, 5);               // 053-057 (5) Agência
  l += spaces(1);                         // 058-058 (1) DAC Agência (Branco)
  l += num(emp.conta, 12);                // 059-070 (12) Conta
  l += alfa(emp.conta_digito || '0', 1);  // 071-071 (1) DAC Conta
  l += spaces(1);                         // 072-072 (1) DAC Ag/Conta
  l += alfa(emp.razao_social, 30);        // 073-102 (30) Nome empresa
  l += alfa('PAGAMENTO DIARISTAS', 40);   // 103-142 (40) Finalidade do lote
  l += alfa(emp.logradouro || '', 30);    // 143-172 (30) Logradouro
  l += num(emp.numero || '0', 5);         // 173-177 (5) Número
  l += alfa('', 15);                      // 178-192 (15) Complemento
  l += alfa(emp.cidade || '', 20);        // 193-212 (20) Cidade
  const cepDigits = (emp.cep || '').replace(/\D/g, '');
  l += num(cepDigits || '0', 8);          // 213-220 (8) CEP completo (5+3)
  l += alfa(emp.estado || '', 2);         // 221-222 (2) Estado UF
  l += spaces(18);                        // 223-240 (18) Brancos complementares

  return assertLinha(l, 'Header de Lote Itaú');
}

function buildSegmentoAItau(
  numLote: number,
  numSeq: number,
  ben: BeneficiarioPagamento
): string {
  const isMesmoBanco = ben.banco_codigo === ITAU.CODIGO_BANCO;
  const camara = isMesmoBanco ? ITAU.CAMARA_CC : ITAU.CAMARA_TED;

  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += num(numLote, 4);                   // 004-007 (4) Lote
  l += '3';                               // 008-008 (1) Tipo = 3 (detalhe)
  l += num(numSeq, 5);                    // 009-013 (5) Sequencial no lote
  l += 'A';                               // 014-014 (1) Segmento A
  l += '0';                               // 015-015 (1) Tipo movimento: 0=Inclusão
  l += '00';                              // 016-017 (2) Código instrução: 00=Inclusão
  l += camara;                            // 018-020 (3) Câmara: 000 CC Itaú / 018 TED
  l += num(ben.banco_codigo, 3);          // 021-023 (3) Banco favorecido
  l += num(ben.agencia, 5);               // 024-028 (5) Agência favorecido
  l += alfa(ben.agencia_digito || ' ', 1);// 029-029 (1) DAC Agência favorecido
  l += num(ben.conta, 12);                // 030-041 (12) Conta favorecido
  l += alfa(ben.conta_digito || ' ', 1);  // 042-042 (1) DAC Conta favorecido
  l += spaces(1);                         // 043-043 (1) DAC Ag/Conta
  l += alfa(ben.nome, 30);                // 044-073 (30) Nome favorecido
  l += alfa(ben.seu_numero || '', 20);    // 074-093 (20) Seu número (Doc Empresa)
  l += dataFmt(ben.data_pagamento);       // 094-101 (8) Data pagamento DDMMAAAA
  l += 'BRL';                             // 102-104 (3) Tipo moeda
  l += zeros(15);                         // 105-119 (15) Quantidade moeda
  l += valor(ben.valor, 15);              // 120-134 (15) Valor pagamento (centavos)
  l += spaces(20);                        // 135-154 (20) Nosso número banco
  l += zeros(8);                          // 155-162 (8) Data efetivação
  l += zeros(15);                         // 163-177 (15) Valor efetivação
  l += spaces(40);                        // 178-217 (40) Outras informações
  l += '0';                               // 218-218 (1) Aviso favorecido (0=sem aviso)
  l += spaces(10);                        // 219-228 (10) Ocorrências
  l += spaces(12);                        // 229-240 (12) Brancos complementares

  return assertLinha(l, `Segmento A Itaú (seq ${numSeq})`);
}

function buildSegmentoBItau(
  numLote: number,
  numSeq: number,
  ben: BeneficiarioPagamento
): string {
  const cpf = num(ben.cpf.replace(/\D/g, ''), 14);
  const tipoInscricao = cpf.replace(/^0+/, '').length <= 11 ? '1' : '2';
  const cepDigits = (ben.cep || '').replace(/\D/g, '');

  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += num(numLote, 4);                   // 004-007 (4) Lote
  l += '3';                               // 008-008 (1) Tipo = 3
  l += num(numSeq, 5);                    // 009-013 (5) Sequencial
  l += 'B';                               // 014-014 (1) Segmento B
  l += spaces(3);                         // 015-017 (3) Uso FEBRABAN
  l += tipoInscricao;                     // 018-018 (1) 1=CPF / 2=CNPJ
  l += cpf;                               // 019-032 (14) CPF/CNPJ favorecido
  l += alfa(ben.logradouro || 'NAO INFORMADO', 30); // 033-062 (30) Logradouro
  l += num(ben.numero_end || '0', 5);     // 063-067 (5) Número
  l += alfa(ben.complemento || '', 15);   // 068-082 (15) Complemento
  l += alfa(ben.bairro || '', 15);        // 083-097 (15) Bairro
  l += alfa(ben.cidade || 'NAO INFORMADO', 20); // 098-117 (20) Cidade
  l += num(cepDigits || '0', 8);          // 118-125 (8) CEP completo (5+3)
  l += alfa(ben.estado || '', 2);         // 126-127 (2) Estado UF
  l += zeros(8);                          // 128-135 (8) Data vencimento
  l += zeros(15);                         // 136-150 (15) Valor documento
  l += zeros(15);                         // 151-165 (15) Valor abatimento
  l += zeros(15);                         // 166-180 (15) Valor desconto
  l += zeros(15);                         // 181-195 (15) Valor mora
  l += zeros(15);                         // 196-210 (15) Valor multa
  l += spaces(15);                        // 211-225 (15) Código doc favorecido
  l += '0';                               // 226-226 (1) Aviso
  l += spaces(14);                        // 227-240 (14) Uso FEBRABAN

  return assertLinha(l, `Segmento B Itaú (seq ${numSeq})`);
}

function buildTrailerLoteItau(
  numLote: number,
  qtdRegistros: number,
  somaValores: number
): string {
  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += num(numLote, 4);                   // 004-007 (4) Lote
  l += '5';                               // 008-008 (1) Tipo = 5
  l += spaces(9);                         // 009-017 (9) Uso FEBRABAN
  l += num(qtdRegistros, 6);              // 018-023 (6) Qtd registros do lote
  l += valor(somaValores, 18);            // 024-041 (18) Valor total do lote em centavos
  l += zeros(18);                         // 042-059 (18) Moeda cruzado zeros
  l += zeros(6);                          // 060-065 (6) Qtd aviso zeros
  l += spaces(165);                       // 066-230 (165) Brancos FEBRABAN
  l += spaces(10);                        // 231-240 (10) Ocorrências

  return assertLinha(l, 'Trailer de Lote Itaú');
}

function buildTrailerArquivoItau(
  qtdLotes: number,
  qtdRegistros: number
): string {
  let l = ITAU.CODIGO_BANCO;              // 001-003 (3) Banco 341
  l += '9999';                            // 004-007 (4) Lote = 9999
  l += '9';                               // 008-008 (1) Tipo = 9
  l += spaces(9);                         // 009-017 (9) Uso FEBRABAN
  l += num(qtdLotes, 6);                  // 018-023 (6) Qtd lotes
  l += num(qtdRegistros, 6);              // 024-029 (6) Qtd total de registros
  l += zeros(6);                          // 030-035 (6) Qtd contas conciliação
  l += spaces(205);                       // 036-240 (205) Uso FEBRABAN

  return assertLinha(l, 'Trailer de Arquivo Itaú');
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR PRINCIPAL ITAÚ
// ─────────────────────────────────────────────────────────────────────────────

export function gerarCNAB240Itau(
  empresa: EmpresaRemessa,
  beneficiarios: BeneficiarioPagamento[],
  opcoes: OpcoesCNAB240 = {}
): ResultadoCNAB240 {
  const agora = opcoes.data_geracao ?? new Date();
  const numArquivo = opcoes.numero_arquivo ?? 1;
  const inclSegB = opcoes.incluir_segmento_b !== false;
  const tipoServico = opcoes.tipo_servico ?? ITAU.TIPO_SERVICO_FORNECEDOR;

  const validacao = validarBeneficiarios(beneficiarios, ITAU.CODIGO_BANCO);
  if (!validacao.valido) {
    throw new Error(
      `Arquivo CNAB Itaú não pode ser gerado — dados inválidos:\n` +
      validacao.erros.map(e => `• ${e}`).join('\n')
    );
  }

  const numLote = 1;
  const todosMesmoBanco = beneficiarios.every(b => b.banco_codigo === ITAU.CODIGO_BANCO);

  const linhas: string[] = [];

  // 1. Header de Arquivo
  linhas.push(buildHeaderArquivoItau(empresa, agora, numArquivo));

  // 2. Header de Lote
  linhas.push(buildHeaderLoteItau(empresa, numLote, tipoServico, agora, todosMesmoBanco));

  // 3. Detalhes
  let numSeqLote = 1;
  let somaValores = 0;

  for (const ben of beneficiarios) {
    // Segmento A
    linhas.push(buildSegmentoAItau(numLote, numSeqLote++, ben));
    // Segmento B
    if (inclSegB) {
      linhas.push(buildSegmentoBItau(numLote, numSeqLote++, ben));
    }
    somaValores += ben.valor;
  }

  // 4. Trailer de Lote
  // Qtd registros lote = 1 (header lote) + detalhes + 1 (trailer lote)
  const qtdDetalhes = beneficiarios.length * (inclSegB ? 2 : 1);
  const qtdRegistrosLote = 1 + qtdDetalhes + 1;
  linhas.push(buildTrailerLoteItau(numLote, qtdRegistrosLote, somaValores));

  // 5. Trailer de Arquivo
  // Qtd total = 1 (header arq) + qtdRegistrosLote + 1 (trailer arq)
  const qtdTotalRegistros = 1 + qtdRegistrosLote + 1;
  linhas.push(buildTrailerArquivoItau(1, qtdTotalRegistros));

  // Montagem final com CRLF
  const conteudo = linhas.join('\r\n') + '\r\n';
  const encoder = encodeWindows1252(conteudo);

  const datePart = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}`;
  const nomeArquivo = `CB341_${datePart}${String(numArquivo).padStart(6, '0')}.txt`;

  return {
    conteudo,
    buffer: encoder,
    nome_arquivo: nomeArquivo,
    total_linhas: linhas.length,
    valor_total: somaValores,
    total_beneficiarios: beneficiarios.length,
    banco_codigo: ITAU.CODIGO_BANCO,
  };
}
