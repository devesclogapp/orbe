import { supabase } from '@/lib/supabase';
import { HeaderArquivo } from './segmentos/HeaderArquivo';
import { HeaderLote } from './segmentos/HeaderLote';
import { SegmentoA } from './segmentos/SegmentoA';
import { TrailerLote } from './segmentos/TrailerLote';
import { TrailerArquivo } from './segmentos/TrailerArquivo';
import { SegmentoB } from './segmentos/SegmentoB';
import { CnabRemessaArquivoService } from './cnabRemessaArquivo.service';

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
  modo?: 'homologacao' | 'producao';
  salvarConteudo?: boolean;
}

async function fetchLoteData(loteId: string, contaBancariaId?: string) {
  let conta: Record<string, any> | null = null;

  if (contaBancariaId) {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .select(`
        *,
        empresas:empresa_id (
          id,
          nome,
          cidade,
          estado
        )
      `)
      .eq('id', contaBancariaId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar conta bancária: ${error.message}`);
    }

    conta = data;
  }

  const { data: faturas, error } = await supabase
    .from('faturas')
    .select(`
      id, valor, competencia,
      colaboradores (
        id, nome, cpf,
        dados_bancarios (
          banco, agencia, digito_agencia, conta, digito_conta, tipo_conta,
          endereco, numero, cidade, cep, estado
        )
      )
    `)
    .eq('lote_remessa_id', loteId)
    .neq('status', 'pago');

  if (error) throw new Error(`Erro ao buscar faturas do lote: ${error.message}`);

  return { conta, faturas: faturas ?? [] };
}

export class CNAB240BBWriter {
  static async generateCNAB240(options: CNAB240GenerateOptions): Promise<CNAB240Result>;
  static async generateCNAB240(loteId: string): Promise<CNAB240Result>;

  static async generateCNAB240(
    optionsOrLoteId: CNAB240GenerateOptions | string
  ): Promise<CNAB240Result> {
    const opts: CNAB240GenerateOptions =
      typeof optionsOrLoteId === 'string'
        ? { loteId: optionsOrLoteId }
        : optionsOrLoteId;

    const {
      loteId,
      competencia,
      contaBancariaId,
      modo = 'producao',
      salvarConteudo = true,
    } = opts;

    const now = new Date();
    const inconsistencias: string[] = [];
    const { conta, faturas } = await fetchLoteData(loteId, contaBancariaId);

    if (!faturas.length) {
      throw new Error('Lote vazio - nenhuma fatura encontrada para geração CNAB.');
    }

    if (!contaBancariaId || !conta) {
      throw new Error('Conta bancária da empresa é obrigatória para gerar remessa CNAB.');
    }

    const sequencialGlobal = await CnabRemessaArquivoService.getNextSequencial(
      contaBancariaId,
      String(conta.banco_codigo ?? '001')
    );

    const empresa = {
      cpfCnpj: String(conta.cedente_cnpj ?? '').replace(/\D/g, ''),
      convenio: String(conta.convenio ?? '').replace(/\D/g, ''),
      agencia: String(conta.agencia ?? ''),
      digitoAgencia: String(conta.agencia_digito ?? ''),
      conta: String(conta.conta ?? ''),
      digitoConta: String(conta.conta_digito ?? ''),
      nomeEmpresa: String(conta.cedente_nome ?? conta.empresas?.nome ?? ''),
      cepEmpresa: '',
      cidadeEmpresa: String(conta.empresas?.cidade ?? ''),
      estadoEmpresa: String(conta.empresas?.estado ?? ''),
      enderecoEmpresa: '',
      bancoNome: String(conta.banco_nome ?? 'BANCO DO BRASIL'),
    };

    const linhas: string[] = [];
    let totalValorLote = 0;
    let totalTitulosValidos = 0;

    try {
      linhas.push(
        HeaderArquivo.generate({
          cpfCnpj: empresa.cpfCnpj,
          convenio: empresa.convenio,
          agencia: empresa.agencia,
          digitoAgencia: empresa.digitoAgencia,
          conta: empresa.conta,
          digitoConta: empresa.digitoConta,
          nomeEmpresa: empresa.nomeEmpresa,
          nomeBanco: empresa.bancoNome,
          dataGeracao: now,
          horaGeracao: now,
          numeroSequencialArquivo: sequencialGlobal,
        })
      );
    } catch (e: unknown) {
      inconsistencias.push(`Erro no Header Arquivo: ${(e as Error).message}`);
    }

    try {
      linhas.push(
        HeaderLote.generate({
          loteId: 1,
          tipoServico: 20,
          formaLancamento: 41,
          cpfCnpj: empresa.cpfCnpj,
          convenio: empresa.convenio,
          agencia: empresa.agencia,
          digitoAgencia: empresa.digitoAgencia,
          conta: empresa.conta,
          digitoConta: empresa.digitoConta,
          nomeEmpresa: empresa.nomeEmpresa,
          cepEmpresa: empresa.cepEmpresa,
          cidadeEmpresa: empresa.cidadeEmpresa,
          estadoEmpresa: empresa.estadoEmpresa,
          enderecoEmpresa: empresa.enderecoEmpresa,
        })
      );
    } catch (e: unknown) {
      inconsistencias.push(`Erro no Header Lote: ${(e as Error).message}`);
    }

    let sequencialLote = 1;

    for (const fatura of faturas) {
      const col = (fatura as Record<string, unknown>).colaboradores as Record<string, unknown> | null;
      const dados = col?.dados_bancarios as Record<string, string> | null;

      if (!col) {
        inconsistencias.push(`Fatura ${(fatura as Record<string, string>).id?.substring(0, 8)} sem colaborador vinculado.`);
        continue;
      }

      if (!dados?.banco || !dados?.agencia || !dados?.conta) {
        inconsistencias.push(`Colaborador ${col.nome} sem dados bancários completos.`);
        continue;
      }

      const valor = Number((fatura as Record<string, number>).valor ?? 0);
      if (valor <= 0) {
        inconsistencias.push(`Valor zerado para colaborador: ${col.nome}`);
        continue;
      }

      totalValorLote += valor;
      totalTitulosValidos += 1;

      try {
        linhas.push(
          SegmentoA.generate({
            loteId: 1,
            sequencialRegistro: sequencialLote++,
            bancoFavorecido: dados.banco,
            agenciaFavorecido: dados.agencia,
            digitoAgenciaFavorecido: dados.digito_agencia ?? '0',
            contaFavorecido: dados.conta,
            digitoContaFavorecido: dados.digito_conta ?? '0',
            nomeFavorecido: String(col.nome ?? 'FAVORECIDO'),
            seuNumero: `PGT${(fatura as Record<string, string>).id?.substring(0, 8).toUpperCase() ?? '00000000'}`,
            dataPagamento: now,
            valorPagamento: valor,
          })
        );
      } catch (e: unknown) {
        inconsistencias.push(`Erro Segmento A (${col.nome}): ${(e as Error).message}`);
      }

      try {
        linhas.push(
          SegmentoB.generate({
            loteId: 1,
            sequencialRegistro: sequencialLote++,
            cpfCnpjFavorecido: String(col.cpf ?? '').replace(/\D/g, ''),
            enderecoFavorecido: dados.endereco ?? '',
            numeroFavorecido: dados.numero ?? '',
            cidadeFavorecido: dados.cidade ?? '',
            cepFavorecido: dados.cep ?? '',
            estadoFavorecido: dados.estado ?? '',
          })
        );
      } catch (e: unknown) {
        inconsistencias.push(`Erro Segmento B (${col.nome}): ${(e as Error).message}`);
      }
    }

    if (totalTitulosValidos === 0) {
      throw new Error('Nenhum título válido encontrado para gerar a remessa CNAB.');
    }

    try {
      linhas.push(
        TrailerLote.generate({
          loteId: 1,
          quantidadeRegistros: sequencialLote + 1,
          somatorioValores: totalValorLote,
        })
      );
    } catch (e: unknown) {
      inconsistencias.push(`Erro no Trailer Lote: ${(e as Error).message}`);
    }

    try {
      linhas.push(
        TrailerArquivo.generate({
          quantidadeLotes: 1,
          quantidadeRegistros: linhas.length + 1,
        })
      );
    } catch (e: unknown) {
      inconsistencias.push(`Erro no Trailer Arquivo: ${(e as Error).message}`);
    }

    const content = linhas.join('\r\n') + '\r\n';
    const padZero = (n: number) => n.toString().padStart(2, '0');
    const seqFormatado = String(sequencialGlobal).padStart(6, '0');
    const fileName = `CNAB240_BB_${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}_SEQ${seqFormatado}.txt`;

    let arquivoRegistrado: Awaited<ReturnType<typeof CnabRemessaArquivoService.registrar>>;

    try {
      arquivoRegistrado = await CnabRemessaArquivoService.registrar({
        loteId,
        nomeArquivo: fileName,
        conteudoArquivo: salvarConteudo ? content : '',
        totalRegistros: linhas.length,
        totalValor: totalValorLote,
        bancoCodigo: conta.banco_codigo ?? '001',
        bancoNome: conta.banco_nome ?? 'BANCO DO BRASIL',
        contaBancariaId,
        competencia,
        modo,
        sequencialArquivo: sequencialGlobal,
      });
    } catch (regErr: unknown) {
      const msg = (regErr as Error).message;
      if (msg.includes('já possui remessa') || msg.includes('idêntico')) {
        throw regErr;
      }

      inconsistencias.push(`Aviso: Não foi possível registrar metadados do arquivo: ${msg}`);
      arquivoRegistrado = { id: 'nao-registrado' } as Awaited<ReturnType<typeof CnabRemessaArquivoService.registrar>>;
    }

    const hash = await CnabRemessaArquivoService.generateHash(content);

    if (inconsistencias.length > 0) {
      console.warn('[CNAB240] Inconsistências encontradas:', inconsistencias);
    }

    return {
      content,
      fileName,
      totalLinhas: linhas.length,
      totalValor: totalValorLote,
      sequencial: sequencialGlobal,
      hash,
      arquivoId: arquivoRegistrado.id,
      inconsistencias,
    };
  }

  static async redownload(arquivoId: string): Promise<{ content: string; fileName: string } | null> {
    const arquivo = await CnabRemessaArquivoService.buscarPorId(arquivoId);
    if (!arquivo || !arquivo.conteudo_arquivo) return null;

    await CnabRemessaArquivoService.marcarComoBaixado(arquivoId);

    return {
      content: arquivo.conteudo_arquivo,
      fileName: arquivo.nome_arquivo,
    };
  }
}
