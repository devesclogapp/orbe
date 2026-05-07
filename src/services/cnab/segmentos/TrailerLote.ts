import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface TrailerLoteParams {
  loteId: number;
  quantidadeRegistros: number;
  somatorioValores: number;
}

export class TrailerLote {
  static generate(params: TrailerLoteParams): string {
    const f = CNAB240Formatter;

    // 01.5 - Banco (001) [3 bytes]
    let line = f.padLeftZero(1, 3);
    // 02.5 - Lote [4 bytes]
    line += f.padLeftZero(params.loteId, 4);
    // 03.5 - Tipo de Registro (5) [1 byte]
    line += '5';
    // 04.5 - Espaco [9 bytes]
    line += f.padRightSpace('', 9);
    // 05.5 - Quantidade de Registros do Lote [6 bytes] (Header + Detalhes + Trailer)
    line += f.padLeftZero(params.quantidadeRegistros, 6);
    // 06.5 - Somatorio dos Valores [18 bytes]
    line += f.formatMoney(params.somatorioValores, 18);
    // 07.5 - Somatorio Qtd Moedas [18 bytes]
    line += f.padLeftZero(0, 18);
    // 08.5 - Numero Aviso Debito [6 bytes]
    line += f.padLeftZero(0, 6);
    // 09.5 - Espaco [165 bytes]
    line += f.padRightSpace('', 165);
    // 10.5 - Ocorrencias [10 bytes]
    line += f.padRightSpace('', 10);

    CNAB240Validator.validateLineLength(line, 'Trailer de Lote (Registro 5)');
    return line;
  }
}
