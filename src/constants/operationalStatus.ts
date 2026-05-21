/**
 * Status operacionais oficiais do ERP Orbe
 * Utilizados para padronizar o ciclo de vida de importações e registros de ponto.
 */

export type OperationalStatus = 
  | 'RECEBIDO'
  | 'VALIDANDO'
  | 'INCONSISTENTE'
  | 'PENDENTE_PROCESSAMENTO'
  | 'PROCESSADO'
  | 'FECHADO'
  | 'ERRO'
  | 'CANCELADO'
  | 'REPROCESSANDO'
  | 'REPROCESSADO';

interface StatusConfig {
  label: string;
  description: string;
  color: string; // Tailwind class
  bg: string;    // Tailwind class
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  icon?: string;
}

export const OPERATIONAL_STATUS_CONFIG: Record<OperationalStatus, StatusConfig> = {
  RECEBIDO: {
    label: 'Recebido',
    description: 'Arquivo ou registro recebido, aguardando início da validação.',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    variant: 'secondary'
  },
  VALIDANDO: {
    label: 'Validando',
    description: 'O sistema está conferindo a integridade dos dados.',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    variant: 'warning'
  },
  INCONSISTENTE: {
    label: 'Inconsistente',
    description: 'Foram detectadas falhas que impedem o processamento automático.',
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    variant: 'destructive'
  },
  PENDENTE_PROCESSAMENTO: {
    label: 'Pendente RH',
    description: 'Dados validados e aptos para o processamento no RH.',
    color: 'text-indigo-700',
    bg: 'bg-indigo-100',
    variant: 'info'
  },
  PROCESSADO: {
    label: 'Processado',
    description: 'Cálculos realizados e saldo integrado ao Banco de Horas.',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    variant: 'success'
  },
  REPROCESSANDO: {
    label: 'Reprocessando',
    description: 'Executando nova versão da importação.',
    color: 'text-primary-strong',
    bg: 'bg-primary-soft',
    variant: 'info',
    icon: 'RotateCcw'
  },
  REPROCESSADO: {
    label: 'Reprocessado',
    description: 'Superado por uma nova execução.',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    variant: 'outline',
    icon: 'History'
  },
  FECHADO: {
    label: 'Fechado',
    description: 'Competência encerrada e enviada para o Financeiro.',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    variant: 'default'
  },
  ERRO: {
    label: 'Erro Técnico',
    description: 'Ocorreu uma falha sistêmica durante a operação.',
    color: 'text-red-700',
    bg: 'bg-red-100',
    variant: 'destructive'
  },
  CANCELADO: {
    label: 'Cancelado',
    description: 'Operação interrompida ou descartada manualmente.',
    color: 'text-slate-500',
    bg: 'bg-slate-200',
    variant: 'outline'
  }
};

/**
 * Helper para obter a configuração com fallback
 */
export const getOperationalStatus = (status?: string | null): StatusConfig => {
  const s = String(status || '').toUpperCase() as OperationalStatus;
  return OPERATIONAL_STATUS_CONFIG[s] || {
    label: status || 'Indefinido',
    description: 'Status não mapeado no sistema.',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    variant: 'outline'
  };
};
