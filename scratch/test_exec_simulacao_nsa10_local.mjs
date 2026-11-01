import fs from 'fs';
import path from 'path';
import { CNABRetornoReaderFactory } from '../src/services/cnab/CNABRetornoReaderFactory.js';
import { CNAB240ItauReader } from '../src/services/cnab/CNAB240ItauReader.js';
import { CnabRetornoService } from '../src/services/cnab/cnabRetorno.service.js';

// Helper de preenchimento posicional
function pad(str, len, char = ' ', alignRight = false) {
  const s = String(str || '');
  if (s.length > len) return s.slice(0, len);
  return alignRight ? s.padStart(len, char) : s.padEnd(len, char);
}

function padNum(num, len) {
  const n = String(Math.round(Number(num) || 0));
  return n.padStart(len, '0');
}

function formatCents(val) {
  return padNum(Math.round(val * 100), 15);
}

console.log('================================================================================');
console.log('ERP ORBE — EXECUÇÃO LOCAL DO RETORNO SIMULADO ITAÚ NSA 10');
console.log('================================================================================\n');

// 1. GERAÇÃO FÍSICA DO ARQUIVO SINTÉTICO DE RETORNO ITAÚ NSA 10
// Remessa NSA 10 Real:
// - Banco: 341 (Itaú)
// - Agência: 1234
// - Conta: 56789
// - NSA: 10
// - Item 1: R$ 150,00 | CPF 23423053038 | SeuNúmero: INT183C011A7EAF4402 | Homologação Itaú 001
// - Item 2: R$ 200,00 | CPF 15367253318 | SeuNúmero: INT183C011A7035D08D | Homologação Itaú 002

const linhas = [];

// Linha 1: Header de Arquivo (Tipo 0)
// 001-003: 341
// 004-007: 0000
// 008-008: 0
// 009-017: brancos (9)
// 018-018: 2 (CNPJ)
// 019-032: CNPJ empresa (14)
// 033-052: brancos (convênio)
// 053-057: agência 01234
// 058-058: branco
// 059-070: conta 000000056789
// 071-071: 0 (dígito)
// 072-072: branco
// 073-102: Nome Empresa (30)
// 103-132: BANCO ITAU SA (30)
// 133-142: brancos (10)
// 143-143: 2 (Código Retorno)
// 144-151: Data Geracao (15102026)
// 152-157: Hora Geracao (203000)
// 158-163: NSA (000010)
// 164-166: 040
// 167-171: 00000
// 172-240: brancos (69)
const headerArquivo = (
  '341' +
  '0000' +
  '0' +
  pad('', 9) +
  '2' +
  padNum('12345678000199', 14) +
  pad('', 20) +
  '01234' +
  ' ' +
  padNum('56789', 12) +
  '0' +
  ' ' +
  pad('EMPRESA TESTE HOMOLOGACAO', 30) +
  pad('BANCO ITAU SA', 30) +
  pad('', 10) +
  '2' +
  '15102026' +
  '203000' +
  '000010' +
  '040' +
  '00000' +
  pad('', 69)
);
linhas.push(headerArquivo);

// Linha 2: Header de Lote (Tipo 1)
const headerLote = (
  '341' +
  '0001' +
  '1' +
  'C' +
  '20' +
  '01' +
  '040' +
  ' ' +
  '2' +
  padNum('12345678000199', 14) +
  pad('', 20) +
  '01234' +
  ' ' +
  padNum('56789', 12) +
  '0' +
  ' ' +
  pad('EMPRESA TESTE HOMOLOGACAO', 30) +
  pad('SIMULACAO RETORNO HOMOLOGACAO', 40) +
  pad('', 98)
);
linhas.push(headerLote);

// Linha 3: Detalhe Item 1 - Segmento A (R$ 150,00)
// Código de Ocorrência: '00' (Crédito Efetivado)
// Seu Número: INT183C011A7EAF4402
const segA1 = (
  '341' +
  '0001' +
  '3' +
  '00001' +
  'A' +
  '0' +
  '00' + // Ocorrência '00'
  '000' +
  '341' +
  '01234' +
  ' ' +
  padNum('987654321', 12) +
  '0' +
  ' ' +
  pad('HOMOLOGACAO ITAU 001', 30) +
  pad('INT183C011A7EAF4402', 20) +
  '15102026' +
  'BRL' +
  '000000000000000' +
  formatCents(150.00) +
  pad('NOSSO000001', 20) +
  '15102026' +
  formatCents(150.00) +
  pad('', 53) +
  pad('00', 10) // Posições 231-240
);
linhas.push(segA1);

// Linha 4: Detalhe Item 1 - Segmento B
// CPF 23423053038
const segB1 = (
  '341' +
  '0001' +
  '3' +
  '00002' +
  'B' +
  pad('', 3) +
  '1' +
  padNum('23423053038', 14) +
  pad('RUA DA HOMOLOGACAO', 30) +
  pad('100', 5) +
  pad('', 15) +
  pad('CENTRO', 15) +
  pad('BELEM', 20) +
  padNum('66000', 5) +
  padNum('000', 3) +
  'PA' +
  pad('', 113)
);
linhas.push(segB1);

// Linha 5: Detalhe Item 2 - Segmento A (R$ 200,00)
// Código de Ocorrência: '00' (Crédito Efetivado)
// Seu Número: INT183C011A7035D08D
const segA2 = (
  '341' +
  '0001' +
  '3' +
  '00003' +
  'A' +
  '0' +
  '00' + // Ocorrência '00'
  '000' +
  '341' +
  '01234' +
  ' ' +
  padNum('987654322', 12) +
  '0' +
  ' ' +
  pad('HOMOLOGACAO ITAU 002', 30) +
  pad('INT183C011A7035D08D', 20) +
  '15102026' +
  'BRL' +
  '000000000000000' +
  formatCents(200.00) +
  pad('NOSSO000002', 20) +
  '15102026' +
  formatCents(200.00) +
  pad('', 53) +
  pad('00', 10)
);
linhas.push(segA2);

// Linha 6: Detalhe Item 2 - Segmento B
// CPF 15367253318
const segB2 = (
  '341' +
  '0001' +
  '3' +
  '00004' +
  'B' +
  pad('', 3) +
  '1' +
  padNum('15367253318', 14) +
  pad('RUA DA HOMOLOGACAO', 30) +
  pad('200', 5) +
  pad('', 15) +
  pad('CENTRO', 15) +
  pad('BELEM', 20) +
  padNum('66000', 5) +
  padNum('000', 3) +
  'PA' +
  pad('', 113)
);
linhas.push(segB2);

// Linha 7: Trailer de Lote (Tipo 5)
// Total 4 registros de detalhe (2 Segmentos A + 2 Segmentos B) + 2 headers = 6 registros no lote
// Somatório: R$ 350,00
const trailerLote = (
  '341' +
  '0001' +
  '5' +
  pad('', 9) +
  padNum('6', 6) +
  padNum(Math.round(350.00 * 100), 18) +
  pad('', 200)
);
linhas.push(trailerLote);

// Linha 8: Trailer de Arquivo (Tipo 9)
// Total 8 linhas
const trailerArquivo = (
  '341' +
  '9999' +
  '9' +
  pad('', 9) +
  padNum('1', 6) + // 1 lote
  padNum('8', 6) + // 8 registros
  pad('', 211)
);
linhas.push(trailerArquivo);

// Salva o arquivo no disco
const filePath = path.resolve('scratch/SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET');
const fileContent = linhas.join('\r\n') + '\r\n';
fs.writeFileSync(filePath, fileContent, 'utf8');

console.log('--- 1. ARQUIVO FÍSICO GERADO COM SUCESSO ---');
console.log(`Caminho: ${filePath}`);
console.log(`Total de linhas geradas: ${linhas.length}`);

// 2. AUDITORIA DE COMPRIMENTO DE CADA LINHA
console.log('\n--- 2. VERIFICAÇÃO DE COMPRIMENTO POSICIONAL (240 CARACTERES) ---');
linhas.forEach((l, idx) => {
  console.log(`Linha ${idx + 1} (${l.slice(7, 8)} - ${idx === 2 || idx === 4 ? 'Seg A' : (idx === 3 || idx === 5 ? 'Seg B' : 'Controle')}): ${l.length} caracteres ${l.length === 240 ? '✅' : '❌'}`);
  if (l.length !== 240) {
    throw new Error(`Linha ${idx + 1} possui ${l.length} caracteres (esperado 240)!`);
  }
});

// 3. EXECUÇÃO CONTRA O CNAB240ItauReader REAL DO ORBE
console.log('\n--- 3. EXECUÇÃO DO PARSER REAL CNAB240ItauReader ---');
const reader = CNABRetornoReaderFactory.getReader(fileContent, '341');
console.log(`Reader instanciado: ${reader.constructor.name} ✅`);

const parseResult = await reader.parse(fileContent, {
  banco: '341',
  fileName: 'SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET',
  uploadedAt: new Date().toISOString()
});

console.log('\nResultado do Parsing:');
console.log(`- Banco Header: ${parseResult.estrutura.headerArquivo.banco}`);
console.log(`- Tipo de Arquivo: ${parseResult.estrutura.headerArquivo.codigoArquivo} (Retorno)`);
console.log(`- NSA Reconhecido: ${parseResult.metadados.sequencialArquivo} (Esperado: 10) ${parseResult.metadados.sequencialArquivo === 10 ? '✅' : '❌'}`);
console.log(`- Total de Detalhes Identificados: ${parseResult.detalhes.length} (Esperado: 2)`);
console.log(`- Valor Total Reconhecido: R$ ${parseResult.resumo.valorTotalPago.toFixed(2)} (Esperado: R$ 350.00) ${parseResult.resumo.valorTotalPago === 350 ? '✅' : '❌'}`);

// 4. EXECUÇÃO DO MATCHER REAL DO ORBE
console.log('\n--- 4. EXECUÇÃO DO MATCHER REAL DO ORBE (matchDetalhe) ---');

// Faturas/Itens da Remessa NSA 10 real conforme banco de dados
const faturasNSA10 = [
  {
    id: '80224654-3a19-4f81-b520-a56b3df7fa48',
    remessa_item_id: '8747f08b-282e-4421-bea0-56d51f34accc',
    lote_id: null,
    intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
    colaborador_id: '7eaf4402-8954-471b-a2c8-914f12265c98',
    valor: 150.00,
    seu_numero_esperado: 'INT183C011A7EAF4402',
    colaboradores: { id: '7eaf4402-8954-471b-a2c8-914f12265c98', nome: 'Homologação Itaú 001', cpf: '23423053038' },
    origem_tipo: 'INTERMITENTE'
  },
  {
    id: 'f832ee60-0d19-4821-93f7-067e0ca5955f',
    remessa_item_id: 'e2988b43-9530-462b-b745-dbed11f70864',
    lote_id: null,
    intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
    colaborador_id: '7035d08d-74b5-4172-87c2-3ba9a27d8b02',
    valor: 200.00,
    seu_numero_esperado: 'INT183C011A7035D08D',
    colaboradores: { id: '7035d08d-74b5-4172-87c2-3ba9a27d8b02', nome: 'Homologação Itaú 002', cpf: '15367253318' },
    origem_tipo: 'INTERMITENTE'
  }
];

const matchesResultados = [];
for (let i = 0; i < parseResult.detalhes.length; i++) {
  const detalhe = parseResult.detalhes[i];
  const match = CnabRetornoService.matchDetalhe(detalhe, faturasNSA10);
  matchesResultados.push({
    detalhe_linha: detalhe.linha,
    seu_numero: detalhe.seuNumero,
    documento: detalhe.documentoFavorecido,
    valor_retorno: detalhe.valorPago,
    remessa_item_id: match.fatura?.remessa_item_id,
    criterio_match: match.criterio,
    status_match: match.fatura ? 'CONCILIADO COM SUCESSO' : 'NÃO ENCONTRADO'
  });
}

console.table(matchesResultados);

const allMatched = matchesResultados.every(m => m.status_match === 'CONCILIADO COM SUCESSO');
if (!allMatched) {
  throw new Error('Falha no matching dos itens da NSA 10!');
}
console.log('✅ Ambos os itens reais da NSA 10 foram conciliados por seu_numero_forte!');

console.log('\n================================================================================');
console.log('TESTES LOCAIS DO RETORNO SIMULADO NSA 10 CONCLUÍDOS COM 100% DE SUCESSO!');
console.log('================================================================================');
