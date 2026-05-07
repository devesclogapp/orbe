import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface SegmentoAParams {
  loteId: number;
  sequencialRegistro: number;
  bancoFavorecido: string;
  agenciaFavorecido: string;
  digitoAgenciaFavorecido: string;
  contaFavorecido: string;
  digitoContaFavorecido: string;
  digitoAgenciaContaFavorecido?: string;
  nomeFavorecido: string;
  seuNumero: string;
  dataPagamento: Date;
  valorPagamento: number;
}

export class SegmentoA {
  static generate(params: SegmentoAParams): string {
    const f = CNAB240Formatter;

    // 01.3 - Banco (001)
    let line = f.padLeftZero(1, 3);
    // 02.3 - Lote
    line += f.padLeftZero(params.loteId, 4);
    // 03.3 - Tipo do registro (3)
    line += '3';
    // 04.3 - Sequencial no lote
    line += f.padLeftZero(params.sequencialRegistro, 5);
    // 05.3 - Codigo segmento
    line += 'A';
    // 06.3 - Tipo de Movimento (0=Inclusao) [1 byte]
    line += '0';
    // 07.3 - Codigo da Instrucao (00=inclusao) [2 bytes]
    line += '00';
    // 08.3 - Camara centralizadora [3 bytes] -> (usamos 000 para envio TED/DOC padrao)
    line += f.padLeftZero(0, 3);
    // 09.3 - Banco Favorecido [3 bytes]
    line += f.padLeftZero(params.bancoFavorecido, 3);
    // 10.3 - Agencia Favorecido [5 bytes]
    line += f.padLeftZero(params.agenciaFavorecido, 5);
    // 11.3 - Digito Ag [1 byte]
    line += f.padRightSpace(params.digitoAgenciaFavorecido, 1);
    // 12.3 - Conta Favorecido [12 bytes]
    line += f.padLeftZero(params.contaFavorecido, 12);
    // 13.3 - Digito Conta [1 byte]
    line += f.padRightSpace(params.digitoContaFavorecido, 1);
    // 14.3 - Digito Ag/Conta Fav [1 byte]
    line += f.padRightSpace(params.digitoAgenciaContaFavorecido || '0', 1);
    // 15.3 - Nome do Favorecido [30 bytes]
    line += f.padRightSpace(params.nomeFavorecido, 30);
    // 16.3 - Seu Numero [20 bytes]
    line += f.padRightSpace(params.seuNumero, 20);
    // 17.3 - Data do Pagamento [8 bytes]
    line += f.formatDate(params.dataPagamento);
    // 18.3 - Tipo de Moeda (BRL) [3 bytes]
    line += f.padRightSpace('BRL', 3);
    // 19.3 - Qtd da Moeda [15 bytes]
    line += f.padLeftZero(0, 15);
    // 20.3 - Valor do Pagamento [15 bytes]
    line += f.formatMoney(params.valorPagamento, 15);
    // 21.3 - Nosso Numero [20 bytes]
    line += f.padRightSpace('', 20);
    // 22.3 - Data Real [8 bytes]
    line += f.padLeftZero(0, 8);
    // 23.3 - Valor Real [15 bytes]
    line += f.padLeftZero(0, 15);
    // 24.3 - Informacao 2 [40 bytes]
    line += f.padRightSpace('', 40);
    // 25.3 - Codigo Finalidade Doc [2 bytes]
    line += f.padRightSpace('', 2);
    // 26.3 - Codigo Finalidade TED [5 bytes]
    line += f.padRightSpace('', 5);
    // 27.3 - Codigo Finalidade Complementar [2 bytes]
    line += f.padRightSpace('', 2);
    // 28.3 - Uso Banco [3 bytes]
    line += f.padRightSpace('', 3);
    // 29.3 - Aviso [1 byte]
    line += '0';
    // 30.3 - Ocorrencias [10 bytes]
    line += f.padRightSpace('', 10);

    CNAB240Validator.validateLineLength(line, 'Segmento A');
    return line;
  }
}
