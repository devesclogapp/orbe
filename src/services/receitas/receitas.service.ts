import { supabase } from '@/lib/supabase';
import { BaseService, cleanUuid, getCurrentTenantId } from '../domain/base.service';
import type { ReceitaOperacional, ReceitaOperacionalItem, ModalidadeReceita } from '@/types/receitas.types';

class ReceitasServiceClass extends BaseService<'receitas_operacionais'> {
  constructor() {
    super('receitas_operacionais');
  }

  async getPipelinePainel(tenantId: string, empresaId?: string, competencia?: string) {
    let query = supabase
      .from('receitas_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome),
        receitas_operacionais_itens(
          id, valor_item,
          operacoes_producao(id, data_operacao, quantidade)
        )
      `)
      .eq('tenant_id', tenantId);

    if (empresaId && empresaId !== 'all') {
      query = query.eq('empresa_id', empresaId);
    }
    
    if (competencia) {
      // Como não tem campo data obrigatório para gerar competência via insert hoje,
      // usaremos created_at via GTE LTE ou similar. Por hora vamos trazer até 500 ultmos ou tratar por data de vencimento.
      query = query.order('created_at', { ascending: false }).limit(500); 
    } else {
      query = query.order('created_at', { ascending: false }).limit(500); 
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro na query getPipelinePainel receitas:', error);
      throw error;
    }

    return data;
  }
}

export const ReceitasService = new ReceitasServiceClass();
