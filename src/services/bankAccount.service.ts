import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

export interface ContaBancariaEmpresa {
  id: string;
  tenant_id: string;
  empresa_id?: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito?: string;
  conta: string;
  conta_digito?: string;
  convenio?: string;
  carteira?: string;
  variacao_carteira?: string;
  cedente_nome: string;
  cedente_cnpj: string;
  tipo_conta: string;
  tipo_servico: string;
  ativo: boolean;
  is_padrao: boolean;
  created_at: string;
  updated_at: string;
}

class BankAccountServiceClass extends BaseService<'contas_bancarias_empresa'> {
  constructor() {
    super('contas_bancarias_empresa');
  }

  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true);
    
    if (error) throw error;
    return data as ContaBancariaEmpresa[];
  }

  async setPadrao(id: string, empresaId: string) {
    // 1. Remove padrão anterior na empresa
    await supabase
      .from('contas_bancarias_empresa')
      .update({ is_padrao: false })
      .eq('empresa_id', empresaId);

    // 2. Define o novo padrão
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .update({ is_padrao: true })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data;
  }

  async toggleAtivo(id: string, ativo: boolean) {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .update({ ativo })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data;
  }
}

export const BankAccountService = new BankAccountServiceClass();
