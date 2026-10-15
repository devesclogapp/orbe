/**
 * GERADOR E VALIDADOR DE RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (HOMOLOGAÇÃO)
 *
 * ESPECIFICAÇÃO CANÔNICA DE FORMATO: ORBE_SIMULACAO_CNAB_V1
 * Versão: 1.0
 *
 * Regra de Segurança Bancária:
 * Empresas em ambiente de homologação (empresas.is_teste = true) NUNCA geram
 * arquivos posicionais FEBRABAN transmissíveis ao banco.
 * Elas geram exclusivamente relatórios estruturados de simulação com gramática restrita,
 * identificação na primeira linha e fechamento explícito.
 */

export interface ParametrosRelatorioSimulacao {
  origem: 'CLT' | 'DIARISTAS' | 'INTERMITENTES' | 'FATURA';
  empresaNome: string;
  bancoCodigo: string;
  bancoNome?: string;
  sequencial: number;
  totalRegistros: number;
  totalValor: number;
  dataGeracao?: Date;
  beneficiarios?: Array<{
    nome: string;
    valor: number;
    cpf?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
  }>;
}

export interface ResultadoRelatorioSimulacao {
  fileName: string;
  content: string;
  modo: 'homologacao';
  versao: '1.0';
  modalidade: 'CLT' | 'DIARISTAS' | 'INTERMITENTES' | 'FATURA';
}

export function gerarRelatorioSimulacaoHomologacao(
  params: ParametrosRelatorioSimulacao
): ResultadoRelatorioSimulacao {
  const now = params.dataGeracao ?? new Date();
  const seqFormatado = String(params.sequencial).padStart(6, '0');
  const bancoSigla = params.bancoCodigo === '341' ? 'ITAU' : params.bancoCodigo === '001' ? 'BB' : 'BANCO';
  const dataFmt = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  
  const fileName = `SIMULACAO_HOMOLOGACAO_${bancoSigla}_${dataFmt}_SEQ${seqFormatado}.txt`;

  const linhasRelatorio = [
    'ORBE_SIMULACAO_CNAB_V1',
    '================================================================================',
    'ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)',
    'TIPO: SIMULACAO_NAO_BANCARIA',
    'SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO',
    'ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN E NÃO PODE SER TRANSMITIDO AO BANCO',
    '================================================================================',
    'VERSAO_FORMATO: 1.0',
    `MODALIDADE: ${params.origem}`,
    `EMPRESA: ${params.empresaNome}`,
    `BANCO: ${params.bancoNome || (params.bancoCodigo === '341' ? 'BANCO ITAÚ (341)' : 'BANCO DO BRASIL (001)')}`,
    `DATA_GERACAO: ${now.toISOString()}`,
    `SEQUENCIAL_SIMULADO: ${seqFormatado}`,
    `TOTAL_REGISTROS: ${params.totalRegistros}`,
    `TOTAL_VALOR: R$ ${params.totalValor.toFixed(2)}`,
    '--------------------------------------------------------------------------------',
  ];

  if (params.beneficiarios && params.beneficiarios.length > 0) {
    linhasRelatorio.push('RELAÇÃO DE FAVORECIDOS / LANÇAMENTOS SIMULADOS:');
    params.beneficiarios.forEach((b, idx) => {
      const idxFmt = String(idx + 1).padStart(3, '0');
      const valFmt = b.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      linhasRelatorio.push(`[${idxFmt}] ${b.nome} — R$ ${valFmt}`);
    });
    linhasRelatorio.push('--------------------------------------------------------------------------------');
  }

  linhasRelatorio.push(
    'STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO',
    'FIM_RELATORIO_SIMULACAO',
    '================================================================================'
  );

  const content = linhasRelatorio.join('\r\n') + '\r\n';

  return {
    fileName,
    content,
    modo: 'homologacao',
    versao: '1.0',
    modalidade: params.origem,
  };
}

export function validarRelatorioSimulacao(
  content: string,
  modalidadeEsperada?: 'CLT' | 'DIARISTAS' | 'INTERMITENTES' | 'FATURA'
): { valido: boolean; erro?: string; versao?: string; modalidade?: string } {
  if (!content || typeof content !== 'string') {
    return { valido: false, erro: 'Conteúdo vazio ou inválido.' };
  }

  // 1. Linhas limpas sem quebras de linha em branco no final
  const rawLines = content.split(/\r?\n/).map(l => l.trimEnd());
  while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim().length === 0) {
    rawLines.pop();
  }

  if (rawLines.length < 19) {
    return { valido: false, erro: `Relatório de simulação incompleto (possui ${rawLines.length} linhas, mínimo requerido é 19).` };
  }

  // 2. Verificação posicional das linhas do cabeçalho
  if (rawLines[0] !== 'ORBE_SIMULACAO_CNAB_V1') {
    return { valido: false, erro: 'Identificador obrigatório "ORBE_SIMULACAO_CNAB_V1" ausente na primeira linha.' };
  }
  if (!/^={10,80}$/.test(rawLines[1])) {
    return { valido: false, erro: 'Linha 2 deve ser separador de cabeçalho (=).' };
  }
  if (rawLines[2] !== 'ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)') {
    return { valido: false, erro: 'Linha 3 inválida para o cabeçalho do relatório.' };
  }
  if (rawLines[3] !== 'TIPO: SIMULACAO_NAO_BANCARIA') {
    return { valido: false, erro: 'Linha 4 deve ser "TIPO: SIMULACAO_NAO_BANCARIA".' };
  }
  if (rawLines[4] !== 'SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO') {
    return { valido: false, erro: 'Linha 5 deve declarar arquivo não bancário.' };
  }
  if (rawLines[5] !== 'ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN E NÃO PODE SER TRANSMITIDO AO BANCO') {
    return { valido: false, erro: 'Linha 6 deve declarar expressamente a proibição de transmissão.' };
  }
  if (!/^={10,80}$/.test(rawLines[6])) {
    return { valido: false, erro: 'Linha 7 deve ser separador de cabeçalho (=).' };
  }
  if (rawLines[7] !== 'VERSAO_FORMATO: 1.0') {
    return { valido: false, erro: 'Versão de formato inválida (requer "VERSAO_FORMATO: 1.0").' };
  }

  const matchModalidade = rawLines[8].match(/^MODALIDADE:\s*(CLT|INTERMITENTES|DIARISTAS|FATURA)$/);
  if (!matchModalidade) {
    return { valido: false, erro: 'Linha 9 deve declarar modalidade válida ("MODALIDADE: CLT|INTERMITENTES|DIARISTAS|FATURA").' };
  }

  const modalidade = matchModalidade[1] as 'CLT' | 'DIARISTAS' | 'INTERMITENTES' | 'FATURA';
  if (modalidadeEsperada && modalidade !== modalidadeEsperada) {
    return { valido: false, erro: `Modalidade declarada (${modalidade}) diverge da esperada (${modalidadeEsperada}).` };
  }

  if (!/^EMPRESA: .+$/.test(rawLines[9])) {
    return { valido: false, erro: 'Linha 10 deve declarar a empresa ("EMPRESA: ...").' };
  }
  if (!/^BANCO: .+$/.test(rawLines[10])) {
    return { valido: false, erro: 'Linha 11 deve declarar o banco ("BANCO: ...").' };
  }
  if (!/^DATA_GERACAO: .+$/.test(rawLines[11])) {
    return { valido: false, erro: 'Linha 12 deve conter a data de geração.' };
  }
  if (!/^SEQUENCIAL_SIMULADO: [0-9]{1,6}$/.test(rawLines[12])) {
    return { valido: false, erro: 'Linha 13 deve conter o sequencial simulado ("SEQUENCIAL_SIMULADO: ...").' };
  }
  if (!/^TOTAL_REGISTROS: [0-9]+$/.test(rawLines[13])) {
    return { valido: false, erro: 'Linha 14 deve conter o total de registros.' };
  }
  if (!/^TOTAL_VALOR: R\$ [0-9]+([.,][0-9]{2})?$/.test(rawLines[14])) {
    return { valido: false, erro: 'Linha 15 deve conter o valor total formatado ("TOTAL_VALOR: R$ ...").' };
  }
  if (!/^-{10,80}$/.test(rawLines[15])) {
    return { valido: false, erro: 'Linha 16 deve ser separador de seção (-).' };
  }

  // 3. Verificação do corpo e encerramento
  const totalLinhas = rawLines.length;
  if (rawLines[16] === 'STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO') {
    if (totalLinhas !== 19) {
      return { valido: false, erro: 'Conteúdo adicional não permitido após o trailer de encerramento do relatório.' };
    }
    if (rawLines[17] !== 'FIM_RELATORIO_SIMULACAO') {
      return { valido: false, erro: 'Linha 18 deve ser "FIM_RELATORIO_SIMULACAO".' };
    }
    if (!/^={10,80}$/.test(rawLines[18])) {
      return { valido: false, erro: 'Linha 19 deve ser fechamento de relatório (=).' };
    }
  } else if (rawLines[16] === 'RELAÇÃO DE FAVORECIDOS / LANÇAMENTOS SIMULADOS:' || rawLines[16] === 'FAVORECIDOS_SIMULADOS:') {
    if (totalLinhas < 22) {
      return { valido: false, erro: 'Seção de favorecidos incompleta.' };
    }
    for (let i = 17; i <= totalLinhas - 5; i++) {
      if (!/^\[[0-9]{1,6}\] [^—\r\n]+ — R\$ [0-9.,]+$/.test(rawLines[i])) {
        return { valido: false, erro: `Linha ${i + 1} fora da estrutura permitida de favorecido: "${rawLines[i]}".` };
      }
    }
    if (!/^-{10,80}$/.test(rawLines[totalLinhas - 4])) {
      return { valido: false, erro: 'Separador de encerramento de favorecidos ausente.' };
    }
    if (rawLines[totalLinhas - 3] !== 'STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO') {
      return { valido: false, erro: 'Status de simulação ausente antes do fechamento.' };
    }
    if (rawLines[totalLinhas - 2] !== 'FIM_RELATORIO_SIMULACAO') {
      return { valido: false, erro: 'Identificador de fim de relatório ausente.' };
    }
    if (!/^={10,80}$/.test(rawLines[totalLinhas - 1])) {
      return { valido: false, erro: 'Linha final deve ser fechamento de relatório (=).' };
    }
  } else {
    return { valido: false, erro: `Conteúdo contém linha inválida fora da estrutura permitida na linha 17: "${rawLines[16]}".` };
  }

  // 4. Bloqueio global contra linhas posicionais bancárias FEBRABAN
  for (const l of rawLines) {
    if (l.length === 240 && /^[0-9]{3}/.test(l)) {
      return { valido: false, erro: 'Conteúdo contém linhas bancárias posicionais FEBRABAN de 240 caracteres.' };
    }
  }

  return { valido: true, versao: '1.0', modalidade };
}

export const SimulacaoHomologacaoService = {
  gerar: gerarRelatorioSimulacaoHomologacao,
  validar: validarRelatorioSimulacao,
};
