import { BaseService } from './domain/base.service';
import { supabase } from '@/lib/supabase';
import { ContabilOficialService } from './contabilOficial.service';

class AccountingServiceClass extends BaseService<'contabil_configuracao'> {
  constructor() {
    super('contabil_configuracao');
  }

  async getMapeamentos(empresaId: string) {
    if (!empresaId || empresaId === "*") {
      // Para retrocompatibilidade ou listagem geral
      const { data, error } = await supabase
        .from('contabil_mapeamento')
        .select('*');
      if (error) throw error;
      return data || [];
    }
    return ContabilOficialService.getMapeamentos(empresaId);
  }

  async getLogs(empresaId?: string, competencia?: string) {
    return ContabilOficialService.getLogs(empresaId, competencia);
  }

  async triggerIntegration(tipo: string, sistema: string, payload?: any) {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const { data, error } = await supabase
      .from('contabil_logs_integracao')
      .insert({
        tipo_envio: tipo,
        sistema_destino: sistema,
        status: 'sucesso',
        user_id: userId,
        payload: payload || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export const AccountingService = new AccountingServiceClass();
