import { CNAB240BBReader, type CnabRetornoReader } from './CNAB240BBReader';
import { CNAB240ItauReader } from './CNAB240ItauReader';
import { mapearOcorrenciaBB, type CnabOcorrenciaBBMapeada } from './retorno/ocorrenciasBB';
import { mapearOcorrenciaItau, type CnabOcorrenciaItauMapeada } from './retorno/ocorrenciasItau';

export type CnabOcorrenciaUnificada = CnabOcorrenciaBBMapeada | CnabOcorrenciaItauMapeada;

/**
 * Fábrica de Readers para Retorno CNAB240 Multibanco.
 *
 * Bancos atualmente homologados:
 * - 001: Banco do Brasil
 * - 341: Itaú Unibanco
 *
 * NUNCA utiliza BB como fallback para bancos não homologados.
 */
export class CNABRetornoReaderFactory {
  static readonly BANCOS_HOMOLOGADOS: Record<string, string> = {
    '001': 'Banco do Brasil',
    '341': 'Itaú Unibanco',
  };

  /**
   * Verifica se o banco informado possui reader homologado.
   */
  static isBancoHomologado(bancoCodigo: string): boolean {
    const clean = String(bancoCodigo || '').replace(/\D/g, '').padStart(3, '0');
    return clean in this.BANCOS_HOMOLOGADOS;
  }

  /**
   * Obtém instância de reader para um código bancário específico.
   * Lança erro explícito se o banco não estiver homologado.
   */
  static getReaderForBanco(bancoCodigo: string): CnabRetornoReader {
    const clean = String(bancoCodigo || '').replace(/\D/g, '').padStart(3, '0');

    if (clean === '001') {
      return new CNAB240BBReader();
    }

    if (clean === '341') {
      return new CNAB240ItauReader();
    }

    throw new Error(`Banco ${bancoCodigo} ainda não possui retorno CNAB240 homologado no ORBE.`);
  }

  /**
   * Detecta o banco a partir do conteúdo do arquivo CNAB240 (posições 1 a 3 da primeira linha)
   * e retorna a instância apropriada do Reader.
   */
  static getReader(content: string, bancoInformado?: string): CnabRetornoReader {
    if (!content || !content.trim()) {
      throw new Error('Arquivo de retorno vazio.');
    }

    const firstLine = content
      .replace(/\uFEFF/g, '')
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)[0] || '';

    if (firstLine.length < 3) {
      throw new Error('Conteúdo do arquivo não possui estrutura CNAB válida.');
    }

    const bancoArquivo = firstLine.slice(0, 3).trim();

    if (bancoInformado) {
      const cleanInformado = bancoInformado.replace(/\D/g, '').padStart(3, '0');
      if (bancoArquivo && bancoArquivo !== cleanInformado) {
        throw new Error(
          `Banco informado na tela (${bancoInformado}) não confere com o código do banco no arquivo (${bancoArquivo}).`
        );
      }
    }

    const bancoFinal = bancoArquivo || bancoInformado || '';
    return this.getReaderForBanco(bancoFinal);
  }
}

/**
 * Mapeia ocorrência bancária de forma sensível ao banco de origem (BB 001 vs Itaú 341).
 */
export function mapearOcorrenciaRetorno(banco: string, codigo: string): CnabOcorrenciaUnificada {
  const cleanBanco = String(banco || '').replace(/\D/g, '').padStart(3, '0');

  if (cleanBanco === '341') {
    return mapearOcorrenciaItau(codigo);
  }

  if (cleanBanco === '001') {
    return mapearOcorrenciaBB(codigo);
  }

  return {
    codigo: codigo || '??',
    mensagem: `Ocorrência (${codigo || 'vazio'}) em banco ${banco} não homologado.`,
    tipo: 'warning',
    statusBase: 'desconhecido',
  };
}
