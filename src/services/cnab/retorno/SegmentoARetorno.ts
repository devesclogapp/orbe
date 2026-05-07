export interface SegmentoARetorno {
  banco: string;
  lote: number;
  tipoRegistro: string;
  numeroSequencial: number;
  segmento: 'A';
  tipoMovimento: string;
  codigoMovimento: string;
  camara: string;
  bancoFavorecido: string;
  agenciaFavorecido: string;
  digitoAgenciaFavorecido: string;
  contaFavorecido: string;
  digitoContaFavorecido: string;
  digitoAgenciaContaFavorecido: string;
  nomeFavorecido: string;
  seuNumero: string;
  dataPagamento?: string;
  valorPagamento: number;
  nossoNumero: string;
  dataReal?: string;
  valorReal: number;
  ocorrencias: string[];
}

function slice(line: string, start: number, end: number): string {
  return line.slice(start - 1, end);
}

function parseNumber(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function parseMoney(value: string): number {
  return parseNumber(value) / 100;
}

function parseDate(value: string): string | undefined {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 8 || raw === '00000000') return undefined;

  const day = raw.slice(0, 2);
  const month = raw.slice(2, 4);
  const year = raw.slice(4, 8);

  return `${year}-${month}-${day}`;
}

function parseOcorrencias(raw: string): string[] {
  const normalized = raw.toUpperCase();
  const values: string[] = [];

  for (let index = 0; index < normalized.length; index += 2) {
    const code = normalized.slice(index, index + 2).trim();
    if (code) values.push(code);
  }

  return values;
}

export class SegmentoARetornoParser {
  static parse(line: string): SegmentoARetorno {
    return {
      banco: slice(line, 1, 3).trim(),
      lote: parseNumber(slice(line, 4, 7)),
      tipoRegistro: slice(line, 8, 8),
      numeroSequencial: parseNumber(slice(line, 9, 13)),
      segmento: 'A',
      tipoMovimento: slice(line, 15, 15).trim(),
      codigoMovimento: slice(line, 16, 17).trim(),
      camara: slice(line, 18, 20).trim(),
      bancoFavorecido: slice(line, 21, 23).trim(),
      agenciaFavorecido: slice(line, 24, 28).trim(),
      digitoAgenciaFavorecido: slice(line, 29, 29).trim(),
      contaFavorecido: slice(line, 30, 41).trim(),
      digitoContaFavorecido: slice(line, 42, 42).trim(),
      digitoAgenciaContaFavorecido: slice(line, 43, 43).trim(),
      nomeFavorecido: slice(line, 44, 73).trim(),
      seuNumero: slice(line, 74, 93).trim(),
      dataPagamento: parseDate(slice(line, 94, 101)),
      valorPagamento: parseMoney(slice(line, 120, 134)),
      nossoNumero: slice(line, 135, 154).trim(),
      dataReal: parseDate(slice(line, 155, 162)),
      valorReal: parseMoney(slice(line, 163, 177)),
      ocorrencias: parseOcorrencias(slice(line, 231, 240)),
    };
  }
}
