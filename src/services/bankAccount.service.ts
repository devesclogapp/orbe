import { supabase } from '@/lib/supabase';
import { BaseService } from './domain/base.service';

// ============================================================
// Tipos
// ============================================================

export interface ContaBancariaEmpresa {
  id: string;
  tenant_id: string;
  empresa_id?: string | null;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito?: string | null;
  conta: string;
  conta_digito?: string | null;
  convenio?: string | null;
  carteira?: string | null;
  variacao_carteira?: string | null;
  cedente_nome: string;
  cedente_cnpj: string;
  tipo_conta: string;
  tipo_servico: string;
  favorecido?: string | null;
  chave_pix?: string | null;
  permite_cnab: boolean;
  ativo: boolean;
  is_padrao: boolean;
  created_at: string;
  updated_at: string;

  // Join virtual
  empresas?: { id: string; nome: string } | null;
}

export type ContaBancariaCreatePayload = {
  empresa_id: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito?: string | null;
  conta: string;
  conta_digito?: string | null;
  convenio?: string | null;
  carteira?: string | null;
  variacao_carteira?: string | null;
  cedente_nome: string;
  cedente_cnpj: string;
  tipo_conta: string;
  tipo_servico?: string;
  favorecido?: string | null;
  chave_pix?: string | null;
  permite_cnab?: boolean;
  ativo?: boolean;
  is_padrao?: boolean;
};

// ============================================================
// Bancos conhecidos
// ============================================================
export const BANCOS_BRASIL = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '212', nome: 'Original' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '070', nome: 'BRB' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '380', nome: 'PicPay' },
] as const;

// ============================================================
// Helper — obter tenant_id
// ============================================================
async function getCurrentTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (error || !profile?.tenant_id) {
    throw new Error('Usuário sem tenant associado.');
  }
  return profile.tenant_id;
}

// ============================================================
// Serviço
// ============================================================

// Columns that may not exist yet if migration hasn't run
const OPTIONAL_COLUMNS = ['chave_pix', 'favorecido', 'permite_cnab'] as const;

function isMissingColumnError(error: any): string | null {
  const msg = String(error?.message ?? '');
  const match = msg.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

function stripColumn(payload: Record<string, any>, column: string): Record<string, any> {
  const { [column]: _removed, ...rest } = payload;
  return rest;
}
class BankAccountServiceClass extends BaseService<'contas_bancarias_empresa'> {
  constructor() {
    super('contas_bancarias_empresa');
  }

  /** Lista TODAS as contas (ativas e inativas) com join de empresa */
  async getAllWithEmpresa(): Promise<ContaBancariaEmpresa[]> {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .select('*, empresas(id, nome)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ContaBancariaEmpresa[];
  }

  /** Lista contas ATIVAS de uma empresa */
  async getByEmpresa(empresaId: string): Promise<ContaBancariaEmpresa[]> {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('is_padrao', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ContaBancariaEmpresa[];
  }

  /**
   * Lista contas elegíveis para CNAB:
   * - ativas
   * - permite_cnab = true
   */
  async getElegiveisParaCnab(empresaId: string): Promise<ContaBancariaEmpresa[]> {
    let { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .eq('permite_cnab', true)
      .order('is_padrao', { ascending: false });

    // Fallback se a coluna 'permite_cnab' ainda não existir no DB
    if (error) {
      if (isMissingColumnError(error) === 'permite_cnab') {
        ({ data, error } = await supabase
          .from('contas_bancarias_empresa')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('is_padrao', { ascending: false }));
      }
    }

    if (error) throw error;
    return (data ?? []) as ContaBancariaEmpresa[];
  }

  /** Cria conta com tenant_id automático */
  async createConta(payload: ContaBancariaCreatePayload): Promise<ContaBancariaEmpresa> {
    const tenantId = await getCurrentTenantId();

    let insertPayload: Record<string, any> = {
      ...payload,
      tenant_id: tenantId,
      ativo: payload.ativo ?? true,
      permite_cnab: payload.permite_cnab ?? true,
      is_padrao: payload.is_padrao ?? false,
      tipo_servico: payload.tipo_servico ?? 'pagamento',
    };

    let data: any = null;
    let error: any = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      ({ data, error } = await supabase
        .from('contas_bancarias_empresa')
        .insert(insertPayload)
        .select('*, empresas(id, nome)')
        .single());

      if (error) {
        const missingCol = isMissingColumnError(error);
        if (missingCol) {
          console.warn(`[BankAccount] Column '${missingCol}' not found, retrying without it.`);
          insertPayload = stripColumn(insertPayload, missingCol);
          attempts++;
          continue;
        }
        if (error.code === '23505') {
          throw new Error('Já existe uma conta com estes dados para esta empresa.');
        }
        throw error;
      }
      break;
    }

    if (error) throw error;

    // Auditoria
    try {
      await supabase.rpc('log_audit', {
        p_action: 'CREATE_CONTA_BANCARIA',
        p_details: JSON.stringify({
          conta_id: data.id,
          empresa_id: payload.empresa_id,
          banco: payload.banco_nome,
          agencia: payload.agencia,
          conta: payload.conta,
        }),
      });
    } catch { /* auditoria nunca bloqueia */ }

    return data as ContaBancariaEmpresa;
  }

  /** Atualiza conta */
  async updateConta(id: string, payload: Partial<ContaBancariaCreatePayload>): Promise<ContaBancariaEmpresa> {
    let updatePayload: Record<string, any> = { ...payload };
    let data: any = null;
    let error: any = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      ({ data, error } = await supabase
        .from('contas_bancarias_empresa')
        .update(updatePayload)
        .eq('id', id)
        .select('*, empresas(id, nome)')
        .single());

      if (error) {
        const missingCol = isMissingColumnError(error);
        if (missingCol) {
          console.warn(`[BankAccount] Column '${missingCol}' not found, retrying without it.`);
          updatePayload = stripColumn(updatePayload, missingCol);
          attempts++;
          continue;
        }
        throw error;
      }
      break;
    }

    if (error) throw error;

    // Auditoria
    try {
      await supabase.rpc('log_audit', {
        p_action: 'UPDATE_CONTA_BANCARIA',
        p_details: JSON.stringify({ conta_id: id, campos_alterados: Object.keys(payload) }),
      });
    } catch { /* auditoria nunca bloqueia */ }

    return data as ContaBancariaEmpresa;
  }

  /** Define conta como padrão (remove padrão anterior) */
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

  /** Alterna ativo/inativo */
  async toggleAtivo(id: string, ativo: boolean) {
    const { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .update({ ativo })
      .eq('id', id)
      .select();

    if (error) throw error;

    try {
      await supabase.rpc('log_audit', {
        p_action: ativo ? 'ACTIVATE_CONTA_BANCARIA' : 'DEACTIVATE_CONTA_BANCARIA',
        p_details: JSON.stringify({ conta_id: id }),
      });
    } catch { /* auditoria nunca bloqueia */ }

    return data;
  }

  /** Alterna permite_cnab */
  async togglePermiteCnab(id: string, permite_cnab: boolean) {
    let { data, error } = await supabase
      .from('contas_bancarias_empresa')
      .update({ permite_cnab })
      .eq('id', id)
      .select();

    if (error) {
      if (isMissingColumnError(error) === 'permite_cnab') {
        console.warn("[BankAccount] Column 'permite_cnab' not found, ignoring toggle.");
        // Não há onde salvar ainda, então silenciosamente passa para não quebrar a tela
        return [];
      }
      throw error;
    }

    try {
      await supabase.rpc('log_audit', {
        p_action: permite_cnab ? 'ENABLE_CNAB_CONTA' : 'DISABLE_CNAB_CONTA',
        p_details: JSON.stringify({ conta_id: id }),
      });
    } catch { /* auditoria nunca bloqueia */ }

    return data;
  }

  /** Mascara o número da conta para exibição: 12345-6 → ****5-6 */
  mascaraConta(conta: string, digito?: string | null): string {
    const c = String(conta ?? '');
    if (c.length <= 2) return `${c}${digito ? `-${digito}` : ''}`;
    const masked = '*'.repeat(c.length - 2) + c.slice(-2);
    return `${masked}${digito ? `-${digito}` : ''}`;
  }
}

export const BankAccountService = new BankAccountServiceClass();
