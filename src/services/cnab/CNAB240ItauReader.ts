import { SegmentoARetornoParser } from './retorno/SegmentoARetorno';
import { SegmentoBRetornoParser } from './retorno/SegmentoBRetorno';
import { mapearOcorrenciaItau, mapearMotivoRejeicaoItau } from './retorno/ocorrenciasItau';
import type {
  CnabRetornoReader,
  CNAB240BBReaderContext,
  CnabRetornoParseResult,
  CnabRetornoOcorrencia,
  CnabRetornoHeaderArquivo,
  CnabRetornoHeaderLote,
  CnabRetornoTrailerLote,
  CnabRetornoTrailerArquivo,
  CnabRetornoDetalhe,
} from './CNAB240BBReader';

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
  return new Error(`Arquivo de retorno Itaú inválido:\n- ${errors.join('\n- ')}`);
}

export class CNAB240ItauReader implements CnabRetornoReader {
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
      if (bancoLinha !== '341') {
        errors.push(`Linha ${lineNo} possui banco ${bancoLinha || 'vazio'} e não pertence ao Itaú (341).`);
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
          nomeEmpresa: slice(line, 73, 102).trim(),
          nomeBanco: slice(line, 103, 132).trim(),
          codigoArquivo: slice(line, 143, 143).trim(),
          dataGeracao: parseDate(slice(line, 144, 151)),
          horaGeracao: parseTime(slice(line, 152, 157)),
          numeroSequencialArquivo: parseNumber(slice(line, 158, 163)),
        };

        if (headerArquivo.codigoArquivo !== '2') {
          errors.push('Header de arquivo não está marcado como retorno (código esperado: 2).');
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
          inscricao: digits(slice(line, 19, 32)),
          convenio: digits(slice(line, 33, 52)),
          agencia: digits(slice(line, 53, 57)),
          conta: digits(slice(line, 59, 70)),
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
          const ocorrencia = mapearOcorrenciaItau(codigoOcorrencia);

          // Posições 231-240 no Itaú contêm motivos adicionais de rejeição
          const motivosDetalhados = parsed.ocorrencias
            .filter((c) => c !== codigoOcorrencia)
            .map((c) => `${c}: ${mapearMotivoRejeicaoItau(c)}`);

          const descricaoCompleta = motivosDetalhados.length > 0
            ? `${ocorrencia.mensagem} [Motivos: ${motivosDetalhados.join('; ')}]`
            : ocorrencia.mensagem;

          currentDetalhe = {
            linha: lineNo,
            lote: parsed.lote,
            segmento,
            numeroSequencial: parsed.numeroSequencial,
            codigoMovimento: parsed.codigoMovimento,
            codigoOcorrencia,
            descricaoOcorrencia: descricaoCompleta,
            valorPago: parsed.valorReal > 0 ? parsed.valorReal : parsed.valorPagamento,
            valorTarifa: undefined,
            dataOcorrencia: parsed.dataReal || parsed.dataPagamento,
            seuNumero: parsed.seuNumero,
            nossoNumero: parsed.nossoNumero,
            documentoEmpresa: parsed.seuNumero || parsed.nossoNumero,
            nomeFavorecido: parsed.nomeFavorecido,
            parsedJson: {
              ...(parsed as unknown as Record<string, unknown>),
              motivosItau: parsed.ocorrencias,
            },
            linhaOriginal: line,
          };

          if (ocorrencia.tipo === 'warning' || ocorrencia.tipo === 'error') {
            ocorrenciasArquivo.push({
              codigo: ocorrencia.codigo,
              mensagem: descricaoCompleta,
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
          mensagem: `Segmento ${segmento || 'vazio'} não suportado neste fluxo de retorno Itaú.`,
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

      errors.push(`Linha ${lineNo} possui tipo de registro ${tipoRegistro || 'vazio'} inválido.`);
    });

    flushDetalhe();

    if (!headerArquivo) errors.push('Header de arquivo não encontrado.');
    if (!headerLotes.length) errors.push('Header de lote não encontrado.');
    if (!detalhes.length) errors.push('Nenhum segmento de detalhe suportado foi encontrado.');
    if (!trailerLotes.length) errors.push('Trailer de lote não encontrado.');
    if (!trailerArquivo) errors.push('Trailer de arquivo não encontrado.');

    if (headerArquivo && context.banco && headerArquivo.banco !== context.banco.padStart(3, '0')) {
      errors.push(`Banco informado na tela (${context.banco}) não confere com o arquivo (${headerArquivo.banco}).`);
    }

    if (trailerArquivo && trailerArquivo.quantidadeRegistros !== lines.length) {
      errors.push(
        `Trailer do arquivo informa ${trailerArquivo.quantidadeRegistros} registros, mas o arquivo possui ${lines.length} linhas válidas.`
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
        errors.push(`Lote ${headerLote.lote} não possui trailer correspondente.`);
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
          tipo: mapearOcorrenciaItau(detalhe.codigoOcorrencia).tipo,
          linha: detalhe.linha,
          segmento: detalhe.segmento,
        },
      ],
    }));

    const quantidadeLiquidados = detalhes.filter(
      (detalhe) => mapearOcorrenciaItau(detalhe.codigoOcorrencia).statusBase === 'pago'
    ).length;
    const quantidadeRejeitados = detalhes.filter(
      (detalhe) => mapearOcorrenciaItau(detalhe.codigoOcorrencia).statusBase === 'rejeitado'
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
