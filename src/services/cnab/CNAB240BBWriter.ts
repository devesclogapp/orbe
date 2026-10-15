import { supabase } from '@/lib/supabase';
import { HeaderArquivo } from './segmentos/HeaderArquivo';
import { HeaderLote } from './segmentos/HeaderLote';
import { SegmentoA } from './segmentos/SegmentoA';
import { TrailerLote } from './segmentos/TrailerLote';
import { TrailerArquivo } from './segmentos/TrailerArquivo';
import { SegmentoB } from './segmentos/SegmentoB';
import { CnabRemessaArquivoService } from './cnabRemessaArquivo.service';
import { gerarRelatorioSimulacaoHomologacao } from './simulacaoHomologacao.service';

import { ICNAB240Writer, CNAB240GenerateOptions, CNAB240Result } from './types';
import { CNABBase } from './CNABBase';

async function fetchLoteData(loteId: string, contaBancariaId?: string, rhLoteId?: string) {
  return CNABBase.fetchLoteData(loteId, contaBancariaId, rhLoteId);
}



export class CNAB240BBWriter implements ICNAB240Writer {
  async generateCNAB240(options: CNAB240GenerateOptions): Promise<CNAB240Result>;
  async generateCNAB240(loteId: string): Promise<CNAB240Result>;

  async generateCNAB240(
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
      rhLoteId,
      modo,
      salvarConteudo = true,
    } = opts;

    const now = new Date();
    const inconsistencias: string[] = [];
    const { conta, faturas, valorEsperadoLote, isTeste } = await fetchLoteData(loteId, contaBancariaId, rhLoteId);

    // Determinação estrita e canônica do modo via empresas.is_teste (Fail-Closed)
    // A autoridade de empresas.is_teste prevalece absolutamente sobre qualquer parâmetro recebido
    const modoEfetivo: 'homologacao' | 'producao' =
      typeof isTeste === 'boolean'
        ? (isTeste ? 'homologacao' : 'producao')
        : (modo === 'homologacao' ? 'homologacao' : 'producao');

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
    
    if (faturas.length === 0) {
      throw new Error('Nenhum título válido encontrado para gerar a remessa CNAB.');
    }

    // CHECK RIGOROSO DE DIVERGÊNCIA DE VALORES CNAB vs FINANCEIRO
    let totalFavorecidosCalculadoManual = 0;
    for (const fatura of faturas) {
       totalFavorecidosCalculadoManual += Number((fatura as Record<string, number>).valor ?? 0);
    }
    const sumTruncated = Number(totalFavorecidosCalculadoManual.toFixed(2));
    
    if (valorEsperadoLote > 0 && Math.abs(sumTruncated - valorEsperadoLote) > 0.05) {
       throw new Error(`Divergência entre lote financeiro R$ ${valorEsperadoLote.toFixed(2)} e total da remessa CNAB R$ ${sumTruncated.toFixed(2)}. Geração cancelada.`);
    }

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
      const col = (fatura as Record<string, unknown>).colaboradores as Record<string, any> | null;

      if (!col) {
        inconsistencias.push(`Fatura ${(fatura as Record<string, string>).id?.substring(0, 8)} sem colaborador vinculado.`);
        continue;
      }

      // Banking data is stored directly on colaboradores (flat columns)
      const bancoCodigo = String(col.banco_codigo ?? '');
      const agencia = String(col.agencia ?? '');
      const agenciaDigito = String(col.agencia_digito ?? '0');
      const contaNum = String(col.conta ?? '');
      const digitoConta = String(col.digito_conta ?? '0');

      if (!bancoCodigo || !agencia || !contaNum) {
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
            bancoFavorecido: bancoCodigo,
            agenciaFavorecido: agencia,
            digitoAgenciaFavorecido: agenciaDigito,
            contaFavorecido: contaNum,
            digitoContaFavorecido: digitoConta,
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
            enderecoFavorecido: '',
            numeroFavorecido: '',
            cidadeFavorecido: '',
            cepFavorecido: '',
            estadoFavorecido: '',
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

    let content: string;
    let fileName: string;
    const padZero = (n: number) => n.toString().padStart(2, '0');
    const seqFormatado = String(sequencialGlobal).padStart(6, '0');

    // Se for HOMOLOGAÇÃO, gerar exclusivamente relatório de simulação canônico ORBE_SIMULACAO_CNAB_V1
    if (modoEfetivo === 'homologacao') {
      const modalidadeSimulacao = rhLoteId ? 'CLT' : 'FATURA';
      const relatorio = gerarRelatorioSimulacaoHomologacao({
        origem: modalidadeSimulacao,
        empresaNome: conta.empresas?.nome || 'EMPRESA HOMOLOGACAO',
        bancoCodigo: '001',
        bancoNome: 'BANCO DO BRASIL (001)',
        sequencial: sequencialGlobal,
        totalRegistros: totalTitulosValidos,
        totalValor: totalValorLote,
        beneficiarios: faturas.map((f: any) => ({
          nome: f.colaborador?.nome || f.favorecido_nome || 'FAVORECIDO',
          valor: Number(f.valor ?? 0),
          cpf: f.colaborador?.cpf || f.favorecido_cpf,
        })),
      });
      fileName = relatorio.fileName;
      content = relatorio.content;
    } else {
      content = linhas.join('\r\n') + '\r\n';
      fileName = `CNAB240_BB_${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}_SEQ${seqFormatado}.txt`;
    }

    const itensParaRpc = faturas.map(fura => {
      const rec = fura as any;
      const tipo = rhLoteId ? 'CLT' : 'FATURA';
      return {
        origem_tipo: tipo,
        origem_id: rec.id,
        fatura_id: tipo === 'FATURA' ? rec.id : undefined,
        lote_item_id: tipo === 'CLT' ? rec.id : undefined,
        valor: Number(rec.valor ?? 0)
      };
    });

    let arquivoRegistrado: Awaited<ReturnType<typeof CnabRemessaArquivoService.registrar>>;

    arquivoRegistrado = await CnabRemessaArquivoService.registrar({
      loteId,
      rhLoteId: rhLoteId || undefined,
      nomeArquivo: fileName,
      conteudoArquivo: salvarConteudo ? content : '',
      totalRegistros: linhas.length,
      quantidadeItensFinanceiros: itensParaRpc.length,
      quantidadeRegistrosCnab: linhas.length,
      totalValor: totalValorLote,
      bancoCodigo: conta.banco_codigo ?? '001',
      bancoNome: conta.banco_nome ?? 'BANCO DO BRASIL',
      contaBancariaId,
      competencia,
      modo: modoEfetivo,
      sequencialArquivo: sequencialGlobal,
      itens: itensParaRpc,
    });

    if (!arquivoRegistrado?.id || arquivoRegistrado.id === 'nao-registrado') {
      throw new Error('Falha de persistência CNAB: O arquivo não foi registrado com sucesso no banco de dados.');
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
      modo: arquivoRegistrado.modo,
      inconsistencias,
    };
  }

  static async redownload(arquivoId: string): Promise<{ content: string; fileName: string } | null> {
    const arquivo = await CnabRemessaArquivoService.buscarPorId(arquivoId);
    if (!arquivo) return null;

    // Bloqueio de Segurança Bancária: Arquivos de homologação não podem ser baixados em formato bancário
    if (arquivo.modo === 'homologacao') {
      throw new Error('Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.');
    }

    if (!arquivo.conteudo_arquivo) return null;

    await CnabRemessaArquivoService.marcarComoBaixado(arquivoId);

    return {
      content: arquivo.conteudo_arquivo,
      fileName: arquivo.nome_arquivo,
    };
  }
}
