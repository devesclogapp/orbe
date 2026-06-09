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
  opacity: string; // Tailwind opacity class
  icon?: string;
}

export const OPERATIONAL_STATUS_CONFIG: Record<OperationalStatus, StatusConfig> = {
  RECEBIDO: {
    label: '🟡 Em análise RH',
    description: 'Arquivo ou registro recebido, aguardando início da validação.',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    variant: 'secondary',
    opacity: 'opacity-100'
  },
  VALIDANDO: {
    label: '🟡 Em análise RH',
    description: 'O sistema está conferindo a integridade dos dados.',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    variant: 'warning',
    opacity: 'opacity-[0.95]'
  },
  INCONSISTENTE: {
    label: 'Inconsistente',
    description: 'Foram detectadas falhas que impedem o processamento automático.',
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    variant: 'destructive',
    opacity: 'opacity-100'
  },
  PENDENTE_PROCESSAMENTO: {
    label: '🟡 Em análise RH',
    description: 'Dados validados e aptos para o processamento no RH.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-100',
    variant: 'warning',
    opacity: 'opacity-100'
  },
  PROCESSADO: {
    label: '🟢 Validado RH',
    description: 'Cálculos realizados e saldo integrado ao Banco de Horas.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-100',
    variant: 'success',
    opacity: 'opacity-[0.95]'
  },
  REPROCESSANDO: {
    label: 'Reprocessando',
    description: 'Executando nova versão da importação.',
    color: 'text-primary-strong',
    bg: 'bg-primary-soft',
    variant: 'info',
    opacity: 'opacity-100',
    icon: 'RotateCcw'
  },
  REPROCESSADO: {
    label: 'Reprocessado',
    description: 'Superado por uma nova execução.',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    variant: 'outline',
    opacity: 'opacity-[0.70]',
    icon: 'History'
  },
  FECHADO: {
    label: '⚫ Concluído',
    description: 'Competência encerrada e enviada para o Financeiro.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-100 shadow-none',
    variant: 'default',
    opacity: 'opacity-[0.60]'
  },
  ERRO: {
    label: 'Erro Técnico',
    description: 'Ocorreu uma falha sistêmica durante a operação.',
    color: 'text-red-700',
    bg: 'bg-red-100',
    variant: 'destructive',
    opacity: 'opacity-100'
  },
  CANCELADO: {
    label: 'Cancelado',
    description: 'Operação interrompida ou descartada manualmente.',
    color: 'text-slate-500',
    bg: 'bg-slate-200',
    variant: 'outline',
    opacity: 'opacity-[0.60]'
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
    variant: 'outline',
    opacity: 'opacity-100'
  };
};
