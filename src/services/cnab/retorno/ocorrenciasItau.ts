import type { CnabRetornoOcorrenciaTipo } from '../CNAB240BBReader';

export type CnabRetornoItemStatusBase =
  | 'pago'
  | 'rejeitado'
  | 'pendente'
  | 'desconhecido';

export interface CnabOcorrenciaItauMapeada {
  codigo: string;
  mensagem: string;
  tipo: CnabRetornoOcorrenciaTipo;
  statusBase: CnabRetornoItemStatusBase;
}

/**
 * Tabela de Ocorrências de Retorno Itaú (SISPAG / CNAB240)
 * Posição 016-017 do Segmento A
 */
const OCORRENCIAS_ITAU: Record<string, Omit<CnabOcorrenciaItauMapeada, 'codigo'>> = {
  '00': {
    mensagem: 'Crédito ou débito efetivado (liquidado com sucesso).',
    tipo: 'info',
    statusBase: 'pago',
  },
  '01': {
    mensagem: 'Inclusão de registro liberada.',
    tipo: 'info',
    statusBase: 'pendente',
  },
  '02': {
    mensagem: 'Exclusão de registro efetuada.',
    tipo: 'warning',
    statusBase: 'rejeitado',
  },
  '03': {
    mensagem: 'Débito não efetuado (saldo insuficiente ou conta bloqueada).',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  BD: {
    mensagem: 'Inclusão liberada / aguardando processamento.',
    tipo: 'info',
    statusBase: 'pendente',
  },
  AE: {
    mensagem: 'Data de pagamento inválida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  AG: {
    mensagem: 'Agência ou conta corrente do favorecido inválida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  BC: {
    mensagem: 'Banco do favorecido inexistente ou inválido.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  BK: {
    mensagem: 'CPF/CNPJ do favorecido inválido.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  HA: {
    mensagem: 'Erro no lote / lote rejeitado.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  HM: {
    mensagem: 'Erro no segmento / segmento rejeitado.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  RJ: {
    mensagem: 'Pagamento rejeitado pelo banco.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  TA: {
    mensagem: 'Lote não aceito.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  AJ: {
    mensagem: 'Tipo de movimento inválido.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  AM: {
    mensagem: 'Câmara de compensação inválida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
};

/**
 * Tabela de Motivos de Rejeição Itaú (Posições 231-240 do Segmento A)
 */
const MOTIVOS_REJEICAO_ITAU: Record<string, string> = {
  '01': 'Código do banco inválido',
  '02': 'Agência ou conta inválida',
  '03': 'Tipo de inscrição / CPF inválido',
  '04': 'Conta encerrada ou bloqueada',
  '05': 'Saldo insuficiente para débito',
  '06': 'Valor do documento inválido',
  '07': 'Data de pagamento inválida',
  '08': 'Nome do favorecido não confere com o CPF',
  '09': 'Favorecido não cadastrado',
  '10': 'Pagamento cancelado a pedido da empresa',
  'AJ': 'Tipo de movimento inválido',
  'AM': 'Câmara de compensação inválida',
  'BK': 'CPF/CNPJ do favorecido inválido',
  'CE': 'Conta destino inexistente',
  'CI': 'Conta de crédito informada divergente',
  'CP': 'Chave PIX não encontrada',
};

export function mapearOcorrenciaItau(codigo: string): CnabOcorrenciaItauMapeada {
  const normalizado = codigo.trim().toUpperCase();
  const mapeada = OCORRENCIAS_ITAU[normalizado];

  if (mapeada) {
    return {
      codigo: normalizado,
      ...mapeada,
    };
  }

  return {
    codigo: normalizado || '??',
    mensagem: `Ocorrência bancária Itaú desconhecida (${normalizado || 'vazio'}).`,
    tipo: 'warning',
    statusBase: 'desconhecido',
  };
}

export function mapearMotivoRejeicaoItau(codigoMotivo: string): string {
  const normalizado = codigoMotivo.trim().toUpperCase();
  return MOTIVOS_REJEICAO_ITAU[normalizado] || `Motivo de rejeição não catalogado (${normalizado})`;
}
