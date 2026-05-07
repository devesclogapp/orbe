import type { CnabRetornoOcorrenciaTipo } from '../CNAB240BBReader';

export type CnabRetornoItemStatusBase =
  | 'pago'
  | 'rejeitado'
  | 'pendente'
  | 'desconhecido';

export interface CnabOcorrenciaBBMapeada {
  codigo: string;
  mensagem: string;
  tipo: CnabRetornoOcorrenciaTipo;
  statusBase: CnabRetornoItemStatusBase;
}

const OCORRENCIAS_BB: Record<string, Omit<CnabOcorrenciaBBMapeada, 'codigo'>> = {
  '00': {
    mensagem: 'Liquidado com sucesso.',
    tipo: 'info',
    statusBase: 'pago',
  },
  BD: {
    mensagem: 'Conta invalida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  AE: {
    mensagem: 'Data invalida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  AG: {
    mensagem: 'Agencia/conta invalida.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
  RJ: {
    mensagem: 'Pagamento rejeitado.',
    tipo: 'error',
    statusBase: 'rejeitado',
  },
};

export function mapearOcorrenciaBB(codigo: string): CnabOcorrenciaBBMapeada {
  const normalizado = codigo.trim().toUpperCase();
  const mapeada = OCORRENCIAS_BB[normalizado];

  if (mapeada) {
    return {
      codigo: normalizado,
      ...mapeada,
    };
  }

  return {
    codigo: normalizado || '??',
    mensagem: `Ocorrencia bancaria desconhecida (${normalizado || 'vazio'}).`,
    tipo: 'warning',
    statusBase: 'desconhecido',
  };
}
