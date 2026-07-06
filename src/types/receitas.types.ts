export type ModalidadeReceita = 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
export type StatusReceita = 'pendente' | 'aguardando_faturamento' | 'faturado' | 'pago' | 'recebido' | 'conciliado' | 'cancelado';

export interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  unidade_id?: string | null;
  modalidade: ModalidadeReceita;
  competencia?: string | null;
  vencimento?: string | null;
  data_recebimento?: string | null;
  valor_total: number;
  status: StatusReceita;
  observacao?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceitaOperacionalItem {
  id: string;
  receita_id: string;
  tenant_id: string;
  operacao_id?: string | null;
  servico_extra_id?: string | null;
  valor_item: number;
  created_at: string;
}

export interface ReceitaOperacionalHistorico {
  id: string;
  receita_id: string;
  tenant_id: string;
  usuario_id?: string | null;
  acao: string;
  status_anterior?: string | null;
  status_novo?: string | null;
  detalhes?: Record<string, unknown> | null;
  created_at: string;
}
