import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';

class AccountingServiceClass extends BaseService<'contabil_configuracao'> {
  constructor() {
    super('contabil_configuracao');
  }

  async getMapeamentos(empresaId: string) {
    const { data, error } = await supabase
      .from('contabil_mapeamento')
      .select('*')
      .eq('empresa_id', empresaId);
    if (error) throw error;
    return data;
  }

  async getLogs() {
    const { data, error } = await supabase
      .from('contabil_logs_integracao')
      .select('*')
      .order('execucao_data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async triggerIntegration(tipo: string, sistema: string) {
    // Simulação de gatilho de integração
    const { data, error } = await supabase
      .from('contabil_logs_integracao')
      .insert({
        tipo_envio: tipo,
        sistema_destino: sistema,
        status: 'sucesso', // No MVP simulamos sucesso
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export const AccountingService = new AccountingServiceClass();
