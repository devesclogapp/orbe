import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

export const operationalClient = supabase;

export type Table = keyof Database['public']['Tables'];

// Helper para limpar valores UUID
export function cleanUuid(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(v) ? v : null;
}

export function extractReferencedTableFromFkError(error: { details?: string | null; message?: string | null }) {
  const raw = `${error.details ?? ""} ${error.message ?? ""}`;
  const match = raw.match(/table\s+"([^"]+)"/i);
  return match?.[1] ?? null;
}

// ============================================================
// SANITIZAÇÃO GLOBAL DE PAYLOADS
// Detecta e converte strings vazias em null
// ============================================================
export function sanitizePayload(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(item => sanitizePayload(item));

  const result: Record<string, unknown> = {};
  const entry = data as Record<string, unknown>;

  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'string' && value === '') {
      result[key] = null;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================
// VALIDAR CAMPOS UUID DO PAYLOAD
// ============================================================
export function validateUuidFields(data: Record<string, unknown>, ...fields: string[]): void {
  for (const field of fields) {
    const value = data[field];
    if (value !== null && value !== undefined && value !== '') {
      const cleaned = cleanUuid(String(value));
      if (!cleaned && String(value).trim() !== '') {
      }
    }
  }
}

// Função helper para obter tenant_id de forma segura
export async function getCurrentTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (error || !profile?.tenant_id || profile.tenant_id === '') {
    console.error('Tenant não encontrado:', { profile, error });
    throw new Error('Usuário sem tenant associado. Contate o administrador.');
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(profile.tenant_id)) {
    throw new Error(`Tenant_id inválido: ${profile.tenant_id}`);
  }

  return profile.tenant_id;
}

export async function requireAuthenticatedUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sessão inválida. Faça login novamente para continuar.');
  }
  return user.id;
}

// Função auxiliar para obter filtro de tenant
export const getTenantQueryFilter = async (table: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.tenant_id) return {};

    const TABLES_WITH_EMPRESA_ID = [
      'operacoes', 'operacoes_producao', 'custos_extras_operacionais',
      'servicos_extras_operacionais',
      'colaboradores', 'diaristas', 'registros_ponto', 'unidades',
      'transportadoras_clientes', 'fornecedores', 'produtos_carga'
    ];

    if (TABLES_WITH_EMPRESA_ID.includes(table)) {
      const { data: empresas } = await supabase
        .from('empresas')
        .select('id')
        .eq('tenant_id', profile.tenant_id);
      
      if (empresas && empresas.length > 0) {
        return { empresa_id: { in: empresas.map(e => e.id) } };
      }
      return { empresa_id: 'eq.none' };
    }

    return { tenant_id: profile.tenant_id };
  } catch {
    return {};
  }
};

// SERVIÇO GENÉRICO DE CRUD
export class BaseService<T extends Table> {
  public supabase = supabase;
  constructor(protected table: T) {}

  async getAll() {
    const { data, error } = await supabase.from(this.table as string).select('*');
    if (error) throw error;
    return data || [];
  }

  async getById(id: string) {
    const { data, error } = await supabase.from(this.table as string).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(payload: Database['public']['Tables'][T]['Insert']) {
    const cleanPayload = sanitizePayload(payload) as Database['public']['Tables'][T]['Insert'];
    const { data, error } = await supabase.from(this.table as string).insert(cleanPayload).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database['public']['Tables'][T]['Update']) {
    const cleanPayload = sanitizePayload(payload) as Database['public']['Tables'][T]['Update'];
    const { data, error } = await supabase.from(this.table as string).update(cleanPayload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async updateWithOverride(id: string, payload: Database['public']['Tables'][T]['Update'], justification: string) {
    const { error: rpcError } = await supabase.rpc('set_session_variable', {
      name: 'app.override_justification',
      value: justification
    });

    if (rpcError) {
      console.error('Erro ao definir justificativa de override:', rpcError);
      throw new Error('Falha ao registrar justificativa no servidor.');
    }

    const { data, error } = await supabase
      .from(this.table as string)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from(this.table as string).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}
