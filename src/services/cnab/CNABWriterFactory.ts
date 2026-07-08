import { ICNAB240Writer } from './types';
import { CNAB240BBWriter } from './CNAB240BBWriter';
import { CNAB240ItauWriter } from './CNAB240ItauWriter';

export class CNABWriterFactory {
  /**
   * Obtém o gerador CNAB240 adequado conforme o banco.
   * Banco 001 -> CNAB240BBWriter
   * Banco 341 -> CNAB240ItauWriter
   */
  static create(codigoBanco: string): ICNAB240Writer {
    switch (codigoBanco) {
      case '341':
        return new CNAB240ItauWriter();
      case '001':
      default:
        // Por padrão (legado), retorna o do BB caso não especificado ou se for 001
        return new CNAB240BBWriter();
    }
  }
}
