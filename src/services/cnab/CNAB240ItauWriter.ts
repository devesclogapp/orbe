import { ICNAB240Writer, CNAB240GenerateOptions, CNAB240Result } from './types';
import { CNABBase } from './CNABBase';
import { CnabRemessaArquivoService } from './cnabRemessaArquivo.service';

/**
 * Utilitários puros sem regras de negócio (padding, string manipulation)
 */
function zeroLeft(value: string | number, len: number): string {
  return String(value).padStart(len, '0').slice(-len);
}

function strRight(value: string, len: number): string {
  // Limpar acentos e transformar tudo em maiúsculo
  const cleaned = String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return cleaned.padEnd(len, ' ').slice(0, len);
}

function formatValor(valor: number, len = 15): string {
  const centavos = Math.round(valor * 100);
  return zeroLeft(centavos, len);
}

function soDigitos(v: string): string {
  return String(v ?? '').replace(/\D/g, '');
}

function formatData(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}${m}${y}`;
}

function formatHora(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

function garantir240(linha: string, tipo: string): string {
  if (linha.length !== 240) {
    throw new Error(`Linha do tipo ${tipo} não possui 240 posições (tamanho atual: ${linha.length})`);
  }
  return linha;
}

export class CNAB240ItauWriter implements ICNAB240Writer {
  async generateCNAB240(options: CNAB240GenerateOptions): Promise<CNAB240Result> {
    const {
      loteId,
      competencia,
      contaBancariaId,
      rhLoteId,
      modo = 'producao',
      salvarConteudo = true,
    } = options;

    const inconsistencias: string[] = [];
    const now = new Date();

    const { conta, faturas, valorEsperadoLote } = await CNABBase.fetchLoteData(loteId, contaBancariaId, rhLoteId);

    if (!faturas.length) {
      throw new Error('Lote vazio - nenhuma fatura encontrada para geração CNAB Itaú SISPAG.');
    }
    if (!contaBancariaId || !conta) {
      throw new Error('Conta bancária da empresa é obrigatória para gerar remessa CNAB.');
    }

    const sequencialGlobal = await CnabRemessaArquivoService.getNextSequencial(
      contaBancariaId,
      '341'
    );

    // Validação rígida
    let totalFavorecidosCalculadoManual = 0;
    for (const fatura of faturas) {
       totalFavorecidosCalculadoManual += Number((fatura as Record<string, number>).valor ?? 0);
    }
    const sumTruncated = Number(totalFavorecidosCalculadoManual.toFixed(2));
    
    if (valorEsperadoLote > 0 && Math.abs(sumTruncated - valorEsperadoLote) > 0.05) {
       throw new Error(`Divergência entre lote financeiro R$ ${valorEsperadoLote.toFixed(2)} e total da remessa CNAB R$ ${sumTruncated.toFixed(2)}. Geração cancelada.`);
    }

    const empresaCnpj = zeroLeft(soDigitos(conta.cedente_cnpj ?? ''), 14);
    const empresaAgencia = zeroLeft(soDigitos(conta.agencia ?? ''), 5);
    const empresaConta = zeroLeft(soDigitos(conta.conta ?? ''), 12);
    const empresaDac = zeroLeft(soDigitos(conta.conta_digito ?? '0'), 1);
    const empresaNome = strRight(conta.cedente_nome ?? conta.empresas?.nome ?? '', 30);
    
    const linhas: string[] = [];
    
    // -------------------------------------------------------------
    // HEADER DO ARQUIVO ITAU (0)
    // -------------------------------------------------------------
    const headerArquivo = 
      '341' +                           // 01-03: Banco Itaú
      '0000' +                          // 04-07: Lote 0000
      '0' +                             // 08-08: Tipo de registro (Header de Arquivo)
      strRight('', 9) +                 // 09-17: Uso exclusivo FEBRABAN
      '2' +                             // 18-18: Tipo de inscrição (2 = CNPJ)
      empresaCnpj +                     // 19-32: Inscrição / CNPJ
      strRight('', 20) +                // 33-52: Reservado Banco (Brancos)
      empresaAgencia +                  // 53-57: Agência
      ' ' +                             // 58-58: DAC Agência (Branco)
      empresaConta +                    // 59-70: Conta
      empresaDac +                      // 71-71: DAC da conta
      ' ' +                             // 72-72: DAC Ag/Conta (Branco)
      empresaNome +                     // 73-102: Nome da Empresa
      strRight('BANCO ITAU SA', 30) +   // 103-132: Nome do Banco
      strRight('', 10) +                // 133-142: Uso Febraban (Brancos)
      '1' +                             // 143-143: Arquivo Remessa (1)
      formatData(now) +                 // 144-151: Data Geração (DDMMAAAA)
      formatHora(now) +                 // 152-157: Hora Geração (HHMMSS)
      zeroLeft(sequencialGlobal, 6) +   // 158-163: Sequencial do arquivo
      '081' +                           // 164-166: Layout do arquivo (Itaú = 081)
      zeroLeft(0, 5) +                  // 167-171: Densidade de gravação (00000)
      strRight('', 69);                 // 172-240: Reservado Banco (Brancos)

    linhas.push(garantir240(headerArquivo, 'Header de Arquivo'));

    // -------------------------------------------------------------
    // HEADER DO LOTE ITAU (1)
    // -------------------------------------------------------------
    // Segundo o manual Itaú SISPAG:
    // Forma de lancamento (tipo pagamento):
    // 01 - Crédito C/C Itaú, 05 - Doc B, 41 - TED, 03 - DOC, etc. 
    // Por hora vamos assumir genérico para TED/CC (vamos usar '41' TED Outra Titularidade para demais bancos, e '01' se banco for o próprio Itau - 341)
    // Isso é feito dinâmicamente nos detalhes se houver necessidade (O Itau separa lotes por tipo de pagto. Aqui vamos manter simplificado)
    // No Itau SISPAG Conta a Pagar:
    const headerLote =
      '341' +                           // 01-03: Banco Itaú
      '0001' +                          // 04-07: Lote de serviço (0001)
      '1' +                             // 08-08: Header lote
      'C' +                             // 09-09: C = Crédito
      '20' +                            // 10-11: Tipo de serviço (20 = Pagamento Fornecedor)
      '41' +                            // 12-13: Forma lançamento (41 = TED Outro Titular , 01 = C/C. Lotes deveriam ser divididos, aqui usando 41 genérico)
      '040' +                           // 14-16: Versão do layout do lote no Itaú
      ' ' +                             // 17-17: Branco
      '2' +                             // 18-18: Tipo CNPJ (2)
      empresaCnpj +                     // 19-32: CNPJ Epresa
      strRight('', 20) +                // 33-52: Reservado Banco
      empresaAgencia +                  // 53-57: Agência
      ' ' +                             // 58-58: DAC
      empresaConta +                    // 59-70: Conta
      empresaDac +                      // 71-71: DAC
      ' ' +                             // 72-72: DAC Ag/Cc
      empresaNome +                     // 73-102: Razão Social
      strRight('PAGAMENTOS E SALARIOS', 40) + // 103-142: Mensagem
      strRight(conta.empresas?.cidade ?? 'SAO PAULO', 30) + // 143-172: Endereço (usaremos nome cidade apenas)
      strRight('', 4) +                 // 173-176: Numero (se tivesse)
      strRight('', 11) +                // 177-187: Complemento
      strRight(conta.empresas?.cidade ?? 'SAO PAULO', 15) + // 188-202: Cidade
      ' ' +                             // 203-203: Branco
      strRight(conta.empresas?.estado ?? 'SP', 2) + // 204-205: Estado
      strRight('', 8) +                 // 206-213: CEP
      strRight('', 27);                 // 214-240: Brancos complementares

    linhas.push(garantir240(headerLote, 'Header de Lote'));

    // -------------------------------------------------------------
    // DETALHES (SEGMENTOS A e B)
    // -------------------------------------------------------------
    let seqLote = 1;
    let totalTitulosValidos = 0;
    let totalValorLote = 0;

    for (const fatura of faturas) {
      const col = (fatura as Record<string, any>).colaboradores;

      if (!col) {
        inconsistencias.push(`Fatura ${(fatura as Record<string, string>).id?.substring(0, 8)} sem colaborador.`);
        continue;
      }

      const colBanco = zeroLeft(soDigitos(col.banco_codigo ?? ''), 3);
      const colAgencia = zeroLeft(soDigitos(col.agencia ?? ''), 5);
      const colAgenciaD = ' '; // Itau ignora digito agencia (geralmente branco)
      const colConta = zeroLeft(soDigitos(col.conta ?? ''), 12);
      const colContaD = strRight(soDigitos(col.digito_conta ?? '0'), 1);
      const colNome = strRight(col.nome ?? '', 30);
      const colCpf = zeroLeft(soDigitos(col.cpf ?? ''), 14);

      if (colBanco === '000' || !soDigitos(col.agencia) || !soDigitos(col.conta)) {
        inconsistencias.push(`Colaborador ${col.nome} sem dados bancários completos.`);
        continue;
      }

      const valor = Number((fatura as Record<string, number>).valor ?? 0);
      if (valor <= 0) continue;

      totalValorLote += valor;
      totalTitulosValidos++;

      const seuNumero = strRight(`PGT${(fatura as Record<string, string>).id?.substring(0, 8).toUpperCase()}`, 20);
      const dataPagamento = formatData(now);
      
      // Câmara 018 para TED e 700 para DOC em bancos diferentes. Padrão Itau para C/C Itau é 000
      let camaraCompl = '018'; // Padrão TED
      if (colBanco === '341') camaraCompl = '000'; // Mesma titularidade banco

      // TIPO DE REGISTRO / MOVIMENTO (Inclusao = 0) e Cód instrução (00 = inlusão tb)
      const segA = 
        '341' +                             // 01-03: Banco Itaú
        '0001' +                            // 04-07: Lote
        '3' +                               // 08-08: Tipo Serviço de Detalhe (3)
        zeroLeft(seqLote++, 5) +            // 09-13: Num Sequencial do lote
        'A' +                               // 14-14: Segmento
        '0' +                               // 15-15: Tipo 0 = Inclusão de Pagamento
        '00' +                              // 16-17: Codigo da Instrução (00 = Inclusão)
        camaraCompl +                       // 18-20: Câmaras centrais: 018 p/ TED 700 DOC (usamos 018)
        colBanco +                          // 21-23: Banco do favorecido
        colAgencia +                        // 24-28: Agência favorecido
        colAgenciaD +                       // 29-29: DAC Agência (em branco normal)
        colConta +                          // 30-41: Conta favorecido
        colContaD +                         // 42-42: DAC Conta do favorecido
        ' ' +                               // 43-43: Brancos
        colNome +                           // 44-73: Nome favorecido
        seuNumero +                         // 74-93: Seu Documento Número Empresa
        dataPagamento +                     // 94-101: Data Pagamento
        'BRL' +                             // 102-104: Tipo Moeda BRL
        zeroLeft(0, 15) +                   // 105-119: Quantidade moeda = 0
        formatValor(valor, 15) +            // 120-134: Valor do pagamento
        strRight('', 20) +                  // 135-154: Seu doc número banco
        zeroLeft(0, 8) +                    // 155-162: Data efetiva banco (0)
        zeroLeft(0, 15) +                   // 163-177: Valor efetiva banco (0)
        strRight('', 40) +                  // 178-217: Info complementares / Observacao
        '2' +                               // 218-218: Aviso (2 - Não emite aviso)
        strRight('', 10) +                  // 219-228: Ocorrências no retorno 
        zeroLeft(0, 5) +                    // 229-233: Nosso numero
        strRight('', 7);                    // 234-240: Reservado Banco brancos

      linhas.push(garantir240(segA, 'Segmento A'));

      // SEGMENTO B - Informações Pessoais do Favorecido (Obrigatório em TED/DOC pelo Itaú)
      const segB =
        '341' +                             // 01-03: Banco Itaú
        '0001' +                            // 04-07: Lote
        '3' +                               // 08-08: Tipo Serviço de Detalhe (3)
        zeroLeft(seqLote++, 5) +            // 09-13: Num Sequencial do lote
        'B' +                               // 14-14: Segmento B
        strRight('', 3) +                   // 15-17: Espaços Brancos CNAB
        '1' +                               // 18-18: Tipo Inscrição CPF=1 CNPJ=2
        colCpf +                            // 19-32: Número da Cpf/Cnpj
        strRight('', 30) +                  // 33-62: Endereço (Branco)
        zeroLeft(0, 5) +                    // 63-67: Numero endereço
        strRight('', 15) +                  // 68-82: Complemento (Branco)
        strRight('', 15) +                  // 83-97: Bairro (Branco)
        strRight('', 20) +                  // 98-117: Cidade (Branco)
        strRight('', 8) +                   // 118-125: CEP e compl CEP
        strRight('', 2) +                   // 126-127: UF do Estado
        strRight('', 8) +                   // 128-135: Data / Pagto (Zeros/Brancos)
        zeroLeft(0, 15) +                   // 136-150: Valor Desconto
        zeroLeft(0, 15) +                   // 151-165: Valor Abatimento / Mora
        zeroLeft(0, 15) +                   // 166-180: Valor Multa
        strRight('', 15) +                  // 181-195: Codigo documento
        zeroLeft(0, 15) +                   // 196-210: Aviso / Mor
        strRight('', 17) +                  // 211-227: Zeros / Brancos
        strRight('', 13);                   // 228-240: Brancos Febraban

      linhas.push(garantir240(segB, 'Segmento B'));
    }

    if (totalTitulosValidos === 0) {
      throw new Error('Nenhum título válido gerou entradas para Itaú SISPAG.');
    }

    // -------------------------------------------------------------
    // TRAILER DO LOTE ITAU (5)
    // -------------------------------------------------------------
    // Qtd de registros do lote = (Header Lote) + (Detalhes Seg A e B) + (Trailer Lote)
    const qtdRegistrosLote = seqLote + 1; // seqLote já conta os segmentos e começou do numero 1, +1 = Trailer incluso +1 Header
    // Wait, o seqLote incrementou para cada A e para cada B.
    // Ex: 1 header (já computado no index de registros?), seqLote varre detalhes.
    // Qtd Total = Header(1) + Detalhes(seqLote - 1) + Trailer(1) = seqLote + 1
    const totalQtdRegistrosLote = seqLote + 1;
    
    const trailerLote = 
      '341' +                             // 01-03: Banco Itaú
      '0001' +                            // 04-07: Lote
      '5' +                               // 08-08: Tipo Trailer (5)
      strRight('', 9) +                   // 09-17: FEBRABAN
      zeroLeft(totalQtdRegistrosLote, 6)+ // 18-23: Qtd total registros LOTE
      formatValor(totalValorLote, 18) +   // 24-41: Soma das moedas (Valor total lote)
      zeroLeft(0, 18) +                   // 42-59: Valor total (reservado B / moeda cruzado)
      zeroLeft(0, 6) +                    // 60-65: Qtd Aviso
      strRight('', 165) +                 // 66-230: FEBRABAN brancos
      strRight('', 10);                   // 231-240: Códigos FEBRABAN

    linhas.push(garantir240(trailerLote, 'Trailer Lote'));

    // -------------------------------------------------------------
    // TRAILER DO ARQUIVO ITAU (9)
    // -------------------------------------------------------------
    // Qtd Total Arquivo = Header Arq (1) + Registros no Lote (trailers etc inclusos já na const acima) + Trailer Arq(1)
    const totalQtdRegistrosArquivo = totalQtdRegistrosLote + 2;

    const trailerArquivo = 
      '341' +                             // 01-03: Banco Itaú
      '9999' +                            // 04-07: Lote GERAL (9999)
      '9' +                               // 08-08: Tipo Trailer Arq (9)
      strRight('', 9) +                   // 09-17: FERRABAN
      zeroLeft(1, 6) +                    // 18-23: Qtd Lotes no arquivo
      zeroLeft(totalQtdRegistrosArquivo, 6) + // 24-29: Qtd total de registros no ARQUIVO
      zeroLeft(0, 6) +                    // 30-35: Contas p conciliação (000000)
      strRight('', 205);                  // 36-240: Brancos Febraban

    linhas.push(garantir240(trailerArquivo, 'Trailer Arquivo'));

    // Montar buffer final TXT
    const content = linhas.join('\r\n') + '\r\n';
    
    // Nomenclatura isolada e aderente ao ITAU
    const seqFormatado = String(sequencialGlobal).padStart(6, '0');
    // CNAB240_ITAU_YYYYMMDD_SEQ000001.txt
    const fileName = `CNAB240_ITAU_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_SEQ${seqFormatado}.txt`;

    let arquivoRegistrado: any;

    try {
      arquivoRegistrado = await CnabRemessaArquivoService.registrar({
        loteId,
        nomeArquivo: fileName,
        conteudoArquivo: salvarConteudo ? content : '',
        totalRegistros: totalQtdRegistrosArquivo,
        totalValor: totalValorLote,
        bancoCodigo: '341',
        bancoNome: 'BANCO ITAU SA',
        contaBancariaId,
        competencia,
        modo,
        sequencialArquivo: sequencialGlobal,
      });
    } catch (regErr: any) {
      if (regErr.message.includes('já possui remessa') || regErr.message.includes('idêntico')) {
        throw regErr;
      }
      inconsistencias.push(`Aviso: Não foi possível registrar metadados do arquivo: ${regErr.message}`);
      arquivoRegistrado = { id: 'nao-registrado' };
    }

    const hash = await CnabRemessaArquivoService.generateHash(content);

    return {
      content,
      fileName,
      totalLinhas: totalQtdRegistrosArquivo,
      totalValor: totalValorLote,
      sequencial: sequencialGlobal,
      hash,
      arquivoId: arquivoRegistrado.id,
      inconsistencias,
    };
  }
}
