export interface SegmentoBRetorno {
  banco: string;
  lote: number;
  tipoRegistro: string;
  numeroSequencial: number;
  segmento: 'B';
  tipoInscricao: string;
  documentoFavorecido: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  cep: string;
  estado: string;
}

function slice(line: string, start: number, end: number): string {
  return line.slice(start - 1, end);
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

export class SegmentoBRetornoParser {
  static parse(line: string): SegmentoBRetorno {
    const cepBase = slice(line, 118, 122);
    const cepSufixo = slice(line, 123, 125);

    return {
      banco: slice(line, 1, 3).trim(),
      lote: Number(digits(slice(line, 4, 7)) || 0),
      tipoRegistro: slice(line, 8, 8),
      numeroSequencial: Number(digits(slice(line, 9, 13)) || 0),
      segmento: 'B',
      tipoInscricao: slice(line, 18, 18).trim(),
      documentoFavorecido: digits(slice(line, 19, 32)),
      logradouro: slice(line, 33, 62).trim(),
      numero: slice(line, 63, 67).trim(),
      complemento: slice(line, 68, 82).trim(),
      bairro: slice(line, 83, 97).trim(),
      cidade: slice(line, 98, 117).trim(),
      cep: `${digits(cepBase)}${digits(cepSufixo)}`,
      estado: slice(line, 126, 127).trim(),
    };
  }
}
