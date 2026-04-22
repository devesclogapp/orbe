import { supabase } from '@/lib/supabase';

export interface DemoParams {
  quantidade_empresas: number;
  colaboradores_por_empresa: number;
  dias: number;
  operacoes_por_dia: number;
  percentual_inconsistencias: number;
  user_id?: string;
}

export interface DemoLote {
  id: string;
  nome: string;
  parametros: DemoParams;
  totais: {
    empresas: number;
    clientes: number;
    colaboradores: number;
    pontos: number;
    operacoes: number;
  };
  created_at: string;
}

export interface DemoResultado {
  success: boolean;
  lote_id: string;
  nome: string;
  totais: DemoLote['totais'];
  error?: string;
}

export interface DeleteResultado {
  success: boolean;
  totais_excluidos: {
    operacoes: number;
    pontos: number;
    colaboradores: number;
    clientes: number;
    empresas: number;
    lotes: number;
  };
  error?: string;
}

export const DemoService = {
  /** Gera um lote de dados de demonstração */
  async gerarDemo(params: DemoParams): Promise<DemoResultado> {
    const { data, error } = await supabase.functions.invoke('generate-demo-data', {
      body: params,
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error ?? 'Falha ao gerar demo');
    return data as DemoResultado;
  },

  /** Exclui um lote específico ou todos os dados de teste */
  async excluirDemo(lote_id?: string): Promise<DeleteResultado> {
    const { data, error } = await supabase.functions.invoke('delete-demo-data', {
      body: { lote_id },
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error ?? 'Falha ao excluir demo');
    return data as DeleteResultado;
  },

  /** Lista todos os lotes de demo existentes */
  async listarLotes(): Promise<DemoLote[]> {
    const { data, error } = await supabase
      .from('demo_lotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DemoLote[];
  },
};
