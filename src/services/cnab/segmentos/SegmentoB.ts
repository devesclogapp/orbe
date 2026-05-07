import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface SegmentoBParams {
  loteId: number;
  sequencialRegistro: number;
  cpfCnpjFavorecido: string;
  enderecoFavorecido?: string;
  numeroFavorecido?: string;
  complementoFavorecido?: string;
  bairroFavorecido?: string;
  cidadeFavorecido?: string;
  cepFavorecido?: string;
  estadoFavorecido?: string;
}

export class SegmentoB {
  static generate(params: SegmentoBParams): string {
    const f = CNAB240Formatter;

    // 01.3 - Banco [3 bytes]
    let line = f.padLeftZero(1, 3);
    // 02.3 - Lote [4 bytes]
    line += f.padLeftZero(params.loteId, 4);
    // 03.3 - Tipo de Registro [1 byte]
    line += '3';
    // 04.3 - Sequencial no lote [5 bytes]
    line += f.padLeftZero(params.sequencialRegistro, 5);
    // 05.3 - Codigo Segmento [1 byte]
    line += 'B';
    // 06.3 - Espaco [3 bytes] (Uso Exclusivo) -> Wait, FEBRABAN is usually 3 bytes here for Seg B 
    line += f.padRightSpace('', 3);
    // 07.3 - Inscricao Favorecido Tipo [1 byte]
    const inscricao = params.cpfCnpjFavorecido.replace(/\D/g, '');
    line += inscricao.length === 11 ? '1' : '2';
    // 08.3 - CPF/CNPJ Favorecido [14 bytes]
    line += f.padLeftZero(inscricao, 14);
    // 09.3 - Logradouro Favorecido [30 bytes]
    line += f.padRightSpace(params.enderecoFavorecido || 'NAO INFORMADO', 30);
    // 10.3 - Numero [5 bytes]
    line += f.padLeftZero(params.numeroFavorecido || 0, 5);
    // 11.3 - Complemento [15 bytes]
    line += f.padRightSpace(params.complementoFavorecido || '', 15);
    // 12.3 - Bairro [15 bytes]
    line += f.padRightSpace(params.bairroFavorecido || '', 15);
    // 13.3 - Cidade [20 bytes]
    line += f.padRightSpace(params.cidadeFavorecido || 'NAO INFORMADO', 20);
    // 14.3 - CEP [5 bytes]
    const cep = (params.cepFavorecido || '').replace(/\D/g, '');
    line += f.padLeftZero(cep.slice(0, 5) || 0, 5);
    // 15.3 - Sufixo CEP [3 bytes]
    line += f.padLeftZero(cep.slice(5, 8) || 0, 3);
    // 16.3 - Estado [2 bytes]
    line += f.padRightSpace(params.estadoFavorecido || 'SP', 2);
    // 17.3 - Data Vencimento [8 bytes]
    line += f.padLeftZero(0, 8);
    // 18.3 - Valor Documento [15 bytes]
    line += f.padLeftZero(0, 15);
    // 19.3 - Abatimento [15 bytes]
    line += f.padLeftZero(0, 15);
    // 20.3 - Desconto [15 bytes]
    line += f.padLeftZero(0, 15);
    // 21.3 - Mora [15 bytes]
    line += f.padLeftZero(0, 15);
    // 22.3 - Multa [15 bytes]
    line += f.padLeftZero(0, 15);
    // 23.3 - Codigo Doc Favorecido [15 bytes]
    line += f.padRightSpace('', 15);
    // 24.3 - Aviso [1 byte]
    line += '0';
    // 25.3 - Codigo UG [6 bytes]
    line += f.padLeftZero(0, 6);
    // 26.3 - ISPB [8 bytes]
    line += f.padLeftZero(0, 8);

    // Padding the rest to reach 240. Let's see:
    // Current sum: 3+4+1+5+1+3+1+14+30+5+15+15+20+5+3+2+8+15+15+15+15+15+15+1+6+8 = 240 !!!
    
    CNAB240Validator.validateLineLength(line, 'Segmento B');
    return line;
  }
}
