import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { 
  BaseService, 
  sanitizePayload, 
  cleanUuid, 
  validateUuidFields, 
  getCurrentTenantId, 
  getTenantQueryFilter, 
  extractReferencedTableFromFkError,
  operationalClient,
  requireAuthenticatedUserId
} from './base.service';

export type ServicoEspecificoRegra = Database['public']['Tables']['servicos_especificos_regras']['Row'];
export type ServicoEspecificoLancamento = Database['public']['Tables']['servicos_especificos_lancamentos']['Row'];

export class ServicoEspecificoServiceClass extends BaseService<'servicos_especificos_regras'> {
  constructor() {
    super('servicos_especificos_regras');
  }

  // --- REGRAS ---

  async getRegrasByEmpresa(empresaId: string) {
    const filter = await getTenantQueryFilter('servicos_especificos_regras');
    const { data, error } = await supabase
      .from('servicos_especificos_regras')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .match(filter)
      .order('codigo', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async upsertRegra(payload: Partial<ServicoEspecificoRegra>) {
    const tenantId = await getCurrentTenantId();
    const data = {
      ...payload,
      tenant_id: tenantId,
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('servicos_especificos_regras')
      .upsert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  // --- LANÇAMENTOS ---

  async getLancamentosByPeriodo(empresaId: string, inicio: string, fim: string) {
    const filter = await getTenantQueryFilter('servicos_especificos_lancamentos');
    const { data, error } = await operationalClient
      .from('servicos_especificos_lancamentos')
      .select(`
        *,
        regra:regra_id (codigo, descricao, periodo),
        empresa:empresa_id (nome),
        unidade:unidade_id (nome)
      `)
      .eq('empresa_id', empresaId)
      .gte('data_operacao', inicio)
      .lte('data_operacao', fim)
      .match(filter)
      .order('data_operacao', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createLancamento(payload: any) {
    const tenantId = await getCurrentTenantId();
    const userId = await requireAuthenticatedUserId();
    
    // Sanitização e Preparação
    const data = sanitizePayload({
      ...payload,
      tenant_id: tenantId,
      usuario_id: userId,
      status: payload.status || 'RECEBIDO'
    });

    const { data: result, error } = await operationalClient
      .from('servicos_especificos_lancamentos')
      .insert(data)
      .select()
      .single();

    if (error) {
      const table = extractReferencedTableFromFkError(error);
      if (table) {
        throw new Error(`Erro de vínculo: registro não encontrado na tabela ${table}`);
      }
      throw error;
    }

    return result;
  }

  async updateLancamento(id: string, payload: any) {
    const data = sanitizePayload({
      ...payload,
      updated_at: new Date().toISOString()
    });

    const { data: result, error } = await operationalClient
      .from('servicos_especificos_lancamentos')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async deleteLancamento(id: string) {
    const { error } = await operationalClient
      .from('servicos_especificos_lancamentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

export const ServicoEspecificoService = new ServicoEspecificoServiceClass();
