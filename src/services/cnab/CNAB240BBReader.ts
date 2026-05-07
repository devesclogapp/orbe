import { SegmentoARetornoParser } from './retorno/SegmentoARetorno';
import { SegmentoBRetornoParser } from './retorno/SegmentoBRetorno';
import { mapearOcorrenciaBB } from './retorno/ocorrenciasBB';

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

export interface CnabRetornoHeaderArquivo {
  banco: string;
  lote: string;
  tipoRegistro: string;
  tipoInscricao: string;
  inscricao: string;
  convenio: string;
  agencia: string;
  conta: string;
  nomeEmpresa: string;
  nomeBanco: string;
  codigoArquivo: string;
  dataGeracao?: string;
  horaGeracao?: string;
  numeroSequencialArquivo?: number;
}

export interface CnabRetornoHeaderLote {
  banco: string;
  lote: number;
  tipoRegistro: string;
  operacao: string;
  tipoServico: string;
  formaLancamento: string;
  layout: string;
  inscricao: string;
  convenio: string;
  agencia: string;
  conta: string;
  nomeEmpresa: string;
}

export interface CnabRetornoTrailerLote {
  banco: string;
  lote: number;
  quantidadeRegistros: number;
  somatorioValores: number;
}

export interface CnabRetornoTrailerArquivo {
  banco: string;
  quantidadeLotes: number;
  quantidadeRegistros: number;
}

export interface CnabRetornoDetalhe {
  linha: number;
  lote: number;
  segmento: string;
  numeroSequencial: number;
  codigoMovimento: string;
  codigoOcorrencia: string;
  descricaoOcorrencia: string;
  valorPago?: number;
  valorTarifa?: number;
  dataOcorrencia?: string;
  seuNumero?: string;
  nossoNumero?: string;
  documentoEmpresa?: string;
  documentoFavorecido?: string;
  nomeFavorecido?: string;
  parsedJson: Record<string, unknown>;
  linhaOriginal: string;
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
  quantidadePendentes: number;
  valorTotalPago: number;
}

export interface CnabRetornoParseResult {
  resumo: CnabRetornoResumo;
  titulos: CnabRetornoTitulo[];
  detalhes: CnabRetornoDetalhe[];
  ocorrenciasArquivo: CnabRetornoOcorrencia[];
  metadados: {
    fileName?: string;
    layout?: 'CNAB240';
    uploadedAt?: string;
    totalLinhas: number;
    sequencialArquivo?: number;
  };
  estrutura: {
    headerArquivo: CnabRetornoHeaderArquivo;
    headerLotes: CnabRetornoHeaderLote[];
    trailerLotes: CnabRetornoTrailerLote[];
    trailerArquivo: CnabRetornoTrailerArquivo;
  };
}

export interface CnabRetornoReader {
  parse(content: string, context: CNAB240BBReaderContext): Promise<CnabRetornoParseResult>;
}

function slice(line: string, start: number, end: number): string {
  return line.slice(start - 1, end);
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function parseNumber(value: string): number {
  const normalized = digits(value);
  return normalized ? Number(normalized) : 0;
}

function parseMoney(value: string): number {
  return parseNumber(value) / 100;
}

function parseDate(value: string): string | undefined {
  const raw = digits(value);
  if (raw.length !== 8 || raw === '00000000') return undefined;

  const day = raw.slice(0, 2);
  const month = raw.slice(2, 4);
  const year = raw.slice(4, 8);
  return `${year}-${month}-${day}`;
}

function parseTime(value: string): string | undefined {
  const raw = digits(value);
  if (raw.length !== 6 || raw === '000000') return undefined;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`;
}

function buildFriendlyError(errors: string[]): Error {
  return new Error(`Arquivo de retorno invalido:\n- ${errors.join('\n- ')}`);
}

export class CNAB240BBReader implements CnabRetornoReader {
  async parse(content: string, context: CNAB240BBReaderContext): Promise<CnabRetornoParseResult> {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized
      .split('\n')
      .map((line) => line.replace(/\uFEFF/g, ''))
      .filter((line) => line.length > 0);

    if (!lines.length) {
      throw new Error('Arquivo de retorno vazio.');
    }

    const errors: string[] = [];
    const ocorrenciasArquivo: CnabRetornoOcorrencia[] = [];
    const headerLotes: CnabRetornoHeaderLote[] = [];
    const trailerLotes: CnabRetornoTrailerLote[] = [];
    const detalhes: CnabRetornoDetalhe[] = [];
    let currentDetalhe: CnabRetornoDetalhe | null = null;
    let headerArquivo: CnabRetornoHeaderArquivo | null = null;
    let trailerArquivo: CnabRetornoTrailerArquivo | null = null;

    const flushDetalhe = () => {
      if (currentDetalhe) {
        detalhes.push(currentDetalhe);
        currentDetalhe = null;
      }
    };

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      if (line.length !== 240) {
        errors.push(`Linha ${lineNo} deve possuir 240 caracteres. Atual: ${line.length}.`);
        return;
      }

      const bancoLinha = slice(line, 1, 3).trim();
      if (bancoLinha !== '001') {
        errors.push(`Linha ${lineNo} possui banco ${bancoLinha || 'vazio'} e nao pertence ao Banco do Brasil.`);
      }

      const tipoRegistro = slice(line, 8, 8);

      if (tipoRegistro === '0') {
        flushDetalhe();
        headerArquivo = {
          banco: bancoLinha,
          lote: slice(line, 4, 7),
          tipoRegistro,
          tipoInscricao: slice(line, 18, 18).trim(),
          inscricao: digits(slice(line, 19, 32)),
          convenio: digits(slice(line, 33, 52)),
          agencia: digits(slice(line, 53, 57)),
          conta: digits(slice(line, 59, 70)),
          nomeEmpresa: slice(line, 72, 101).trim(),
          nomeBanco: slice(line, 102, 131).trim(),
          codigoArquivo: slice(line, 143, 143).trim(),
          dataGeracao: parseDate(slice(line, 144, 151)),
          horaGeracao: parseTime(slice(line, 152, 157)),
          numeroSequencialArquivo: parseNumber(slice(line, 158, 163)),
        };

        if (headerArquivo.codigoArquivo !== '2') {
          errors.push('Header de arquivo nao esta marcado como retorno (codigo esperado: 2).');
        }
        return;
      }

      if (tipoRegistro === '1') {
        flushDetalhe();
        headerLotes.push({
          banco: bancoLinha,
          lote: parseNumber(slice(line, 4, 7)),
          tipoRegistro,
          operacao: slice(line, 9, 9).trim(),
          tipoServico: slice(line, 10, 11).trim(),
          formaLancamento: slice(line, 12, 13).trim(),
          layout: slice(line, 14, 16).trim(),
          inscricao: digits(slice(line, 19, 33)),
          convenio: digits(slice(line, 34, 53)),
          agencia: digits(slice(line, 54, 58)),
          conta: digits(slice(line, 60, 71)),
          nomeEmpresa: slice(line, 73, 102).trim(),
        });
        return;
      }

      if (tipoRegistro === '3') {
        const segmento = slice(line, 14, 14).trim().toUpperCase();

        if (segmento === 'A') {
          flushDetalhe();
          const parsed = SegmentoARetornoParser.parse(line);
          const codigoOcorrencia = (parsed.ocorrencias[0] || parsed.codigoMovimento || '??').toUpperCase();
          const ocorrencia = mapearOcorrenciaBB(codigoOcorrencia);

          currentDetalhe = {
            linha: lineNo,
            lote: parsed.lote,
            segmento,
            numeroSequencial: parsed.numeroSequencial,
            codigoMovimento: parsed.codigoMovimento,
            codigoOcorrencia,
            descricaoOcorrencia: ocorrencia.mensagem,
            valorPago: parsed.valorReal > 0 ? parsed.valorReal : parsed.valorPagamento,
            valorTarifa: undefined,
            dataOcorrencia: parsed.dataReal || parsed.dataPagamento,
            seuNumero: parsed.seuNumero,
            nossoNumero: parsed.nossoNumero,
            documentoEmpresa: parsed.seuNumero || parsed.nossoNumero,
            nomeFavorecido: parsed.nomeFavorecido,
            parsedJson: parsed as unknown as Record<string, unknown>,
            linhaOriginal: line,
          };

          if (ocorrencia.tipo === 'warning') {
            ocorrenciasArquivo.push({
              codigo: ocorrencia.codigo,
              mensagem: ocorrencia.mensagem,
              tipo: ocorrencia.tipo,
              linha: lineNo,
              segmento,
            });
          }
          return;
        }

        if (segmento === 'B') {
          const parsed = SegmentoBRetornoParser.parse(line);
          if (!currentDetalhe) {
            ocorrenciasArquivo.push({
              codigo: 'SB',
              mensagem: 'Segmento B encontrado sem segmento A imediatamente anterior.',
              tipo: 'warning',
              linha: lineNo,
              segmento,
            });
            return;
          }

          currentDetalhe = {
            ...currentDetalhe,
            documentoFavorecido: parsed.documentoFavorecido,
            parsedJson: {
              ...currentDetalhe.parsedJson,
              segmentoB: parsed,
            },
          };
          return;
        }

        ocorrenciasArquivo.push({
          codigo: 'SEG',
          mensagem: `Segmento ${segmento || 'vazio'} nao suportado neste fluxo de retorno.`,
          tipo: 'warning',
          linha: lineNo,
          segmento,
        });
        return;
      }

      if (tipoRegistro === '5') {
        flushDetalhe();
        trailerLotes.push({
          banco: bancoLinha,
          lote: parseNumber(slice(line, 4, 7)),
          quantidadeRegistros: parseNumber(slice(line, 18, 23)),
          somatorioValores: parseMoney(slice(line, 24, 41)),
        });
        return;
      }

      if (tipoRegistro === '9') {
        flushDetalhe();
        trailerArquivo = {
          banco: bancoLinha,
          quantidadeLotes: parseNumber(slice(line, 18, 23)),
          quantidadeRegistros: parseNumber(slice(line, 24, 29)),
        };
        return;
      }

      errors.push(`Linha ${lineNo} possui tipo de registro ${tipoRegistro || 'vazio'} invalido.`);
    });

    flushDetalhe();

    if (!headerArquivo) errors.push('Header de arquivo nao encontrado.');
    if (!headerLotes.length) errors.push('Header de lote nao encontrado.');
    if (!detalhes.length) errors.push('Nenhum segmento de detalhe suportado foi encontrado.');
    if (!trailerLotes.length) errors.push('Trailer de lote nao encontrado.');
    if (!trailerArquivo) errors.push('Trailer de arquivo nao encontrado.');

    if (headerArquivo && headerArquivo.banco !== context.banco) {
      errors.push(`Banco informado na tela (${context.banco}) nao confere com o arquivo (${headerArquivo.banco}).`);
    }

    if (trailerArquivo && trailerArquivo.quantidadeRegistros !== lines.length) {
      errors.push(
        `Trailer do arquivo informa ${trailerArquivo.quantidadeRegistros} registros, mas o arquivo possui ${lines.length} linhas validas.`
      );
    }

    if (trailerArquivo && trailerArquivo.quantidadeLotes !== headerLotes.length) {
      errors.push(
        `Trailer do arquivo informa ${trailerArquivo.quantidadeLotes} lotes, mas foram encontrados ${headerLotes.length} headers de lote.`
      );
    }

    headerLotes.forEach((headerLote) => {
      const trailerLote = trailerLotes.find((item) => item.lote === headerLote.lote);
      if (!trailerLote) {
        errors.push(`Lote ${headerLote.lote} nao possui trailer correspondente.`);
        return;
      }

      const registrosNoLote = lines.filter((line) => parseNumber(slice(line, 4, 7)) === headerLote.lote).length;
      if (trailerLote.quantidadeRegistros !== registrosNoLote) {
        errors.push(
          `Lote ${headerLote.lote} informa ${trailerLote.quantidadeRegistros} registros no trailer, mas foram encontrados ${registrosNoLote}.`
        );
      }
    });

    if (errors.length) {
      throw buildFriendlyError(errors);
    }

    const titulos = detalhes.map((detalhe) => ({
      nossoNumero: detalhe.nossoNumero,
      documentoEmpresa: detalhe.documentoEmpresa,
      valorPago: detalhe.valorPago,
      valorTarifa: detalhe.valorTarifa,
      dataOcorrencia: detalhe.dataOcorrencia,
      ocorrencias: [
        {
          codigo: detalhe.codigoOcorrencia,
          mensagem: detalhe.descricaoOcorrencia,
          tipo: mapearOcorrenciaBB(detalhe.codigoOcorrencia).tipo,
          linha: detalhe.linha,
          segmento: detalhe.segmento,
        },
      ],
    }));

    const quantidadeLiquidados = detalhes.filter(
      (detalhe) => mapearOcorrenciaBB(detalhe.codigoOcorrencia).statusBase === 'pago'
    ).length;
    const quantidadeRejeitados = detalhes.filter(
      (detalhe) => mapearOcorrenciaBB(detalhe.codigoOcorrencia).statusBase === 'rejeitado'
    ).length;
    const quantidadePendentes = detalhes.length - quantidadeLiquidados - quantidadeRejeitados;
    const valorTotalPago = detalhes.reduce((total, detalhe) => total + Number(detalhe.valorPago || 0), 0);

    return {
      resumo: {
        banco: headerArquivo!.banco,
        quantidadeTitulos: detalhes.length,
        quantidadeLiquidados,
        quantidadeRejeitados,
        quantidadePendentes,
        valorTotalPago,
      },
      titulos,
      detalhes,
      ocorrenciasArquivo,
      metadados: {
        fileName: context.fileName,
        layout: 'CNAB240',
        uploadedAt: context.uploadedAt,
        totalLinhas: lines.length,
        sequencialArquivo: headerArquivo!.numeroSequencialArquivo,
      },
      estrutura: {
        headerArquivo: headerArquivo!,
        headerLotes,
        trailerLotes,
        trailerArquivo: trailerArquivo!,
      },
    };
  }
}
