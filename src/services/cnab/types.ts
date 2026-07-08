export interface CNAB240Result {
  content: string;
  fileName: string;
  totalLinhas: number;
  totalValor: number;
  sequencial: number;
  hash: string;
  arquivoId: string;
  inconsistencias?: string[];
}

export interface CNAB240GenerateOptions {
  loteId: string;
  competencia?: string;
  contaBancariaId?: string;
  rhLoteId?: string;
  modo?: 'homologacao' | 'producao';
  salvarConteudo?: boolean;
}

export interface ICNAB240Writer {
  generateCNAB240(options: CNAB240GenerateOptions): Promise<CNAB240Result>;
}
