import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface TrailerArquivoParams {
  quantidadeLotes: number;
  quantidadeRegistros: number;
}

export class TrailerArquivo {
  static generate(params: TrailerArquivoParams): string {
    const f = CNAB240Formatter;

    // 01.9 - Banco (001) [3 bytes]
    let line = f.padLeftZero(1, 3);
    // 02.9 - Lote (9999) [4 bytes]
    line += '9999';
    // 03.9 - Tipo de registro (9) [1 byte]
    line += '9';
    // 04.9 - Espaco [9 bytes]
    line += f.padRightSpace('', 9);
    // 05.9 - Quantidade de Lotes do Arquivo [6 bytes]
    line += f.padLeftZero(params.quantidadeLotes, 6);
    // 06.9 - Quantidade de Registros do Arquivo [6 bytes] (Header + Lotes + Trailer)
    line += f.padLeftZero(params.quantidadeRegistros, 6);
    // 07.9 - Qtde Contas Conciliacao [6 bytes]
    line += f.padLeftZero(0, 6);
    // 08.9 - Espaco [205 bytes]
    line += f.padRightSpace('', 205);

    CNAB240Validator.validateLineLength(line, 'Trailer de Arquivo (Registro 9)');
    return line;
  }
}
