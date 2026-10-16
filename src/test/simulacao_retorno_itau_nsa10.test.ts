import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';

function pad(str: any, len: number, char = ' ', alignRight = false): string {
  const s = String(str || '');
  if (s.length > len) return s.slice(0, len);
  return alignRight ? s.padStart(len, char) : s.padEnd(len, char);
}

function padNum(num: any, len: number): string {
  const n = String(Math.round(Number(num) || 0));
  return n.padStart(len, '0');
}

function formatCents(val: number): string {
  return padNum(Math.round(val * 100), 15);
}

describe('EXECUÇÃO LOCAL DO RETORNO SIMULADO ITAÚ NSA 10', () => {
  const filePath = path.resolve('scratch/SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET');

  it('1. Deve gerar fisicamente o arquivo sintético de retorno Itaú NSA 10', () => {
    const linhas: string[] = [];

    // Linha 1: Header de Arquivo (Tipo 0) - 240 caracteres
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

    // Linha 2: Header de Lote (Tipo 1) - 240 caracteres
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

    // Linha 3: Detalhe 1 - Segmento A (R$ 150,00) - 240 caracteres
    const segA1 = (
      '341' +
      '0001' +
      '3' +
      '00001' +
      'A' +
      '0' +
      '00' +
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
      pad('00', 10)
    );
    linhas.push(segA1);

    // Linha 4: Detalhe 1 - Segmento B - 240 caracteres
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

    // Linha 5: Detalhe 2 - Segmento A (R$ 200,00) - 240 caracteres
    const segA2 = (
      '341' +
      '0001' +
      '3' +
      '00003' +
      'A' +
      '0' +
      '00' +
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

    // Linha 6: Detalhe 2 - Segmento B - 240 caracteres
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

    // Linha 7: Trailer de Lote (Tipo 5) - 240 caracteres
    const trailerLote = (
      '341' +
      '0001' +
      '5' +
      pad('', 9) +
      padNum('6', 6) +
      padNum(Math.round(350.00 * 100), 18) +
      pad('', 199)
    );
    linhas.push(trailerLote);

    // Linha 8: Trailer de Arquivo (Tipo 9) - 240 caracteres
    const trailerArquivo = (
      '341' +
      '9999' +
      '9' +
      pad('', 9) +
      padNum('1', 6) +
      padNum('8', 6) +
      pad('', 211)
    );
    linhas.push(trailerArquivo);

    // Verificação de 240 caracteres em todas as linhas
    expect(linhas.length).toBe(8);
    linhas.forEach((l, idx) => {
      expect(l.length, `Linha ${idx + 1} deve ter 240 caracteres`).toBe(240);
    });

    const fileContent = linhas.join('\r\n') + '\r\n';
    fs.writeFileSync(filePath, fileContent, 'utf8');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('2. Deve executar contra CNAB240ItauReader e validar estrutura de retorno', async () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const reader = CNABRetornoReaderFactory.getReader(fileContent, '341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);

    const parseResult = await reader.parse(fileContent, {
      banco: '341',
      fileName: 'SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET',
      uploadedAt: new Date().toISOString(),
    });

    expect(parseResult.estrutura.headerArquivo.banco).toBe('341');
    expect(parseResult.estrutura.headerArquivo.codigoArquivo).toBe('2');
    expect(parseResult.metadados.sequencialArquivo).toBe(10);
    expect(parseResult.detalhes.length).toBe(2);
    expect(parseResult.resumo.valorTotalPago).toBe(350);

    // Item 1
    const d1 = parseResult.detalhes[0];
    expect(d1.valorPago).toBe(150);
    expect(d1.nomeFavorecido).toBe('HOMOLOGACAO ITAU 001');
    expect(d1.seuNumero).toBe('INT183C011A7EAF4402');
    expect(d1.documentoFavorecido).toBe('00023423053038');
    expect(d1.codigoOcorrencia).toBe('00');

    // Item 2
    const d2 = parseResult.detalhes[1];
    expect(d2.valorPago).toBe(200);
    expect(d2.nomeFavorecido).toBe('HOMOLOGACAO ITAU 002');
    expect(d2.seuNumero).toBe('INT183C011A7035D08D');
    expect(d2.documentoFavorecido).toBe('00015367253318');
    expect(d2.codigoOcorrencia).toBe('00');
  });

  it('3. Deve executar o matcher real do ORBE (matchDetalhe) e conciliar os 2 itens da NSA 10', async () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const reader = CNABRetornoReaderFactory.getReader(fileContent, '341');
    const parseResult = await reader.parse(fileContent, {
      banco: '341',
      fileName: 'SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET',
      uploadedAt: new Date().toISOString(),
    });

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
        origem_tipo: 'INTERMITENTE' as const,
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
        origem_tipo: 'INTERMITENTE' as const,
      },
    ];

    const match1 = CnabRetornoService.matchDetalhe(parseResult.detalhes[0], faturasNSA10);
    expect(match1.fatura).not.toBeNull();
    expect(match1.fatura?.remessa_item_id).toBe('8747f08b-282e-4421-bea0-56d51f34accc');
    expect(match1.criterio).toBe('seu_numero_forte');

    const match2 = CnabRetornoService.matchDetalhe(parseResult.detalhes[1], faturasNSA10);
    expect(match2.fatura).not.toBeNull();
    expect(match2.fatura?.remessa_item_id).toBe('e2988b43-9530-462b-b745-dbed11f70864');
    expect(match2.criterio).toBe('seu_numero_forte');
  });
});
