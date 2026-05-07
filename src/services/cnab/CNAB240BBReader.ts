export interface CNAB240BBReaderContext {
  banco: string;
  fileName?: string;
  uploadedAt?: string;
}

export type CnabRetornoOcorrenciaTipo = 'info' | 'warning' | 'error';

export interface CnabRetornoOcorrencia {
  codigo: string;
  mensagem: string;
  tipo: CnabRetornoOcorrenciaTipo;
  linha?: number;
  segmento?: string;
}

export interface CnabRetornoTitulo {
  nossoNumero?: string;
  documentoEmpresa?: string;
  valorPago?: number;
  valorTarifa?: number;
  dataOcorrencia?: string;
  ocorrencias: CnabRetornoOcorrencia[];
}

export interface CnabRetornoResumo {
  banco: string;
  quantidadeTitulos: number;
  quantidadeLiquidados: number;
  quantidadeRejeitados: number;
  valorTotalPago: number;
}

export interface CnabRetornoParseResult {
  resumo: CnabRetornoResumo;
  titulos: CnabRetornoTitulo[];
  ocorrenciasArquivo: CnabRetornoOcorrencia[];
  metadados: {
    fileName?: string;
    layout?: 'CNAB240';
  };
}

export interface CnabRetornoReader {
  parse(content: string, context: CNAB240BBReaderContext): Promise<CnabRetornoParseResult>;
}

export class CNAB240BBReader implements CnabRetornoReader {
  async parse(_content: string, _context: CNAB240BBReaderContext): Promise<CnabRetornoParseResult> {
    throw new Error('CNAB240BBReader ainda nao implementado. Estrutura reservada para a Fase 8.2.');
  }
}
