import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getTransportadoraDuplicateMessage, getTransportadoraErrorMessage } from '@/utils/transportadoraValidation';

type Table = keyof Database['public']['Tables'];

// Helper para limpar valores UUID
function cleanUuid(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(v) ? v : null;
}

function extractReferencedTableFromFkError(error: { details?: string | null; message?: string | null }) {
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
      console.log(`[SANITIZE] ${key}: "" -> null`);
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
        console.log(`[UUID INVALID] ${field}: "${value}"`);
      }
    }
  }
}

// Função helper para obter tenant_id de forma segura
async function getCurrentTenantId(): Promise<string> {
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

async function requireAuthenticatedUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Sessão inválida. Faça login novamente para continuar.');
  }
  return user.id;
}

function normalizeConfigTipoOperacaoValue(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isDuplicateConstraintError(error: { code?: string | null; message?: string | null; details?: string | null }) {
  const raw = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return error.code === '23505' || raw.includes('duplicate') || raw.includes('unique');
}

export function getConfigTipoOperacaoErrorMessage(
  error: unknown,
  action: 'criar' | 'atualizar' | 'excluir' = 'criar'
) {
  const supabaseError = (error ?? {}) as {
    code?: string | null;
    message?: string | null;
    details?: string | null;
  };
  const rawMessage = `${supabaseError.message ?? ''} ${supabaseError.details ?? ''}`.toLowerCase();

  if (isDuplicateConstraintError(supabaseError)) {
    return 'Já existe um tipo de operação com este nome ou código.';
  }

  if (rawMessage.includes('row-level security')) {
    return action === 'excluir'
      ? 'Você não tem permissão para excluir este tipo de operação.'
      : 'Você não tem permissão para salvar este tipo de operação neste tenant.';
  }

  if (rawMessage.includes('usuário sem tenant')) {
    return 'Seu usuário está sem tenant associado. Contate o administrador.';
  }

  if (rawMessage.includes('sessão inválida')) {
    return 'Sua sessão expirou. Entre novamente e tente de novo.';
  }

  return action === 'excluir'
    ? 'Não foi possível excluir o tipo de operação.'
    : 'Não foi possível salvar o tipo de operação.';
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
    const { data, error } = await supabase.from(this.table).select('*');
    if (error) throw error;
    return data || [];
  }

  async getById(id: string) {
    const { data, error } = await supabase.from(this.table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(payload: Database['public']['Tables'][T]['Insert']) {
    const { data, error } = await supabase.from(this.table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database['public']['Tables'][T]['Update']) {
    const { data, error } = await supabase.from(this.table).update(payload).eq('id', id).select().single();
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
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from(this.table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

// ==================================================
// SERVIÇOS ESPECÍFICOS
// ==================================================

class EmpresaServiceClass extends BaseService<'empresas'> {
  constructor() { super('empresas'); }

  // RLS garante isolamento por tenant_id automaticamente.
  // Não precisamos passar tenantId como parâmetro — o Supabase filtra pela session.
  async getAll() {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getWithCounts() {
    const { data: empresas, error } = await supabase
      .from('empresas')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    // Buscar contagens separadamente
    const { data: colaboradores } = await supabase.from('colaboradores').select('empresa_id');
    const { data: coletores } = await supabase.from('coletores').select('empresa_id');

    const contagemColaboradores = new Map<string, number>();
    const contagemColetores = new Map<string, number>();
    
    (colaboradores || []).forEach(c => {
      contagemColaboradores.set(c.empresa_id, (contagemColaboradores.get(c.empresa_id) || 0) + 1);
    });
    (coletores || []).forEach(c => {
      contagemColetores.set(c.empresa_id, (contagemColetores.get(c.empresa_id) || 0) + 1);
    });

    return (empresas || []).map(e => ({
      ...e,
      total_colaboradores: contagemColaboradores.get(e.id) || 0,
      total_coletores: contagemColetores.get(e.id) || 0
    }));
  }

  // Override do create para incluir tenant_id automaticamente
  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    const cnpjDigits = (payload.cnpj || '').replace(/\D/g, '');
    
    // Bloquear duplicidade de CNPJ dentro do mesmo tenant
    if (cnpjDigits) {
      const { data: existing } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .eq('cnpj', payload.cnpj)
        .maybeSingle();
      
      if (existing) {
        throw new Error(`Já existe uma empresa "${existing.nome}" cadastrada com este CNPJ.`);
      }
    }

    const payloadWithTenant = {
      ...payload,
      tenant_id: tenantId
    };

    const { data, error } = await supabase
      .from('empresas')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
      }
      throw error;
    }
    return data;
  }
  
  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    const cnpjDigits = (payload.cnpj || '').replace(/\D/g, '');
    
    if (cnpjDigits) {
      const { data: existing } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .eq('cnpj', payload.cnpj)
        .neq('id', id)
        .maybeSingle();
      
      if (existing) {
        throw new Error(`Já existe uma empresa "${existing.nome}" cadastrada com este CNPJ.`);
      }
    }

    const { data, error } = await supabase
      .from('empresas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
      }
      throw error;
    }
    return data;
  }
  
  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string }> {
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (colaborador) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { data: coletor } = await supabase
      .from('coletores')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (coletor) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { data: operacao } = await supabase
      .from('operacoes')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (operacao) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }
}
export const EmpresaService = new EmpresaServiceClass();

class ColaboradorServiceClass extends BaseService<'colaboradores'> {
  constructor() { super('colaboradores'); }

  async getAllForProducao() {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nome, funcao, empresa_id')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    // Validar empresa_id
    const empresaIdClean = cleanUuid(payload.empresa_id);
    if (!empresaIdClean) {
      throw new Error('Selecione uma empresa válida.');
    }

    // Validar duplicidade por CPF dentro do mesmo tenant
    const cpfClean = payload.cpf ? String(payload.cpf).replace(/\D/g, '') : null;
    if (cpfClean && cpfClean.length === 11) {
      const { data: existing } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('cpf', cpfClean)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (existing) {
        throw new Error('Já existe um colaborador cadastrado com este CPF.');
      }
    }

    // Limpar campos UUID opcionais
    const cleanedPayload = {
      ...payload,
      cpf: cpfClean,
      empresa_id: empresaIdClean,
      unidade_id: cleanUuid(payload.unidade_id),
      tenant_id: tenantId,
    };

    const { data, error } = await supabase
      .from('colaboradores')
      .insert(cleanedPayload)
      .select()
      .single();

    if (error) {
      const details = error.details ? `\nDetalhe: ${error.details}` : '';
      const hint = error.hint ? `\nSugestão: ${error.hint}` : '';
      throw new Error(`${error.message}${details}${hint}`);
    }
    return data;
  }

  async getWithEmpresa(empresaId?: string) {
    let query = supabase
      .from('colaboradores')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data: colaboradores, error } = await query;
    if (error) throw error;

    // Buscar empresas separadamente
    const { data: empresas } = await supabase.from('empresas').select('id, nome, cidade, estado');
    
    // Join manual
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (colaboradores || []).map(c => ({
      ...c,
      empresas: empresaMap.get(c.empresa_id) || null
    }));
  }

  async update(id: string, payload: Record<string, any>) {
    const cleanedPayload: Record<string, any> = {
      nome: payload.nome,
      cpf: payload.cpf ?? null,
      telefone: payload.telefone ?? null,
      cargo: payload.cargo ?? null,
      matricula: payload.matricula ?? null,
      empresa_id: cleanUuid(payload.empresa_id),
      tipo_contrato: payload.tipo_contrato ?? null,
      tipo_colaborador: payload.tipo_colaborador ?? null,
      valor_base: Number(payload.valor_base) || 0,
      flag_faturamento: payload.flag_faturamento ?? false,
      permitir_lancamento_operacional: payload.permitir_lancamento_operacional ?? false,
      status: payload.status ?? 'ativo',
      nome_completo: payload.nome_completo ?? null,
      banco_codigo: payload.banco_codigo ?? null,
      agencia: payload.agencia ?? null,
      agencia_digito: payload.agencia_digito ?? null,
      conta: payload.conta ?? null,
      conta_digito: payload.conta_digito ?? null,
      tipo_conta: payload.tipo_conta ?? null,
      unidade_id: cleanUuid(payload.unidade_id),
      deleted_at: payload.deleted_at ?? null,
    };

    if (!cleanedPayload.empresa_id) {
      throw new Error('Selecione uma empresa válida.');
    }

    const { data, error } = await supabase
      .from('colaboradores')
      .update(cleanedPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const details = error.details ? `\nDetalhe: ${error.details}` : '';
      const hint = error.hint ? `\nSugestão: ${error.hint}` : '';
      throw new Error(`${error.message}${details}${hint}`);
    }
    return data;
  }

  async getDiaristas(empresaId: string, apenasAtivos = true) {
    let query = (supabase as any)
      .from('colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('tipo_colaborador', 'DIARISTA')
      .eq('permitir_lancamento_operacional', true)
      .order('nome', { ascending: true });

    if (apenasAtivos) query = query.eq('status', 'ativo');

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf ?? null,
      funcao: c.cargo ?? null,
      valor_diaria: Number(c.valor_base ?? 0),
      status: c.status,
      empresa_id: c.empresa_id,
    }));
  }
}
export const ColaboradorService = new ColaboradorServiceClass();

class PerfilUsuarioServiceClass extends BaseService<'perfis_usuarios'> {
  constructor() { super('perfis_usuarios'); }
  async getByUserId(userId: string) {
    const { data: perfil, error } = await supabase
      .from('perfis_usuarios')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!perfil) return null;
    
    const { data: empresa } = await supabase.from('empresas').select('id, nome, cidade, estado').eq('id', perfil.empresa_id).maybeSingle();
    return { ...perfil, empresas: empresa };
  }
}
export const PerfilUsuarioService = new PerfilUsuarioServiceClass();

class ColetorServiceClass extends BaseService<'coletores'> {
  constructor() { super('coletores'); }
  async getWithEmpresa() {
    const { data: coletores, error } = await supabase.from('coletores').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (coletores || []).map(c => ({ ...c, empresas: empresaMap.get(c.empresa_id) || null }));
  }
}
export const ColetorService = new ColetorServiceClass();

class LogSincronizacaoServiceClass extends BaseService<'logs_sincronizacao'> {
  constructor() { super('logs_sincronizacao'); }
  async getWithEmpresa() {
    const { data: logs, error } = await supabase.from('logs_sincronizacao').select('*').order('data', { ascending: false });
    if (error) throw error;
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (logs || []).map(l => ({ ...l, empresas: empresaMap.get(l.empresa_id) || null }));
  }
}
export const LogSincronizacaoService = new LogSincronizacaoServiceClass();

class ResultadosServiceClass extends BaseService<'resultados_processamento'> {
  constructor() { super('resultados_processamento'); }

  async getSummary() {
    const { data: resultados, error } = await supabase.from('resultados_processamento').select('*').order('data', { ascending: false });
    if (error) throw error;
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (resultados || []).map(r => ({ ...r, empresas: empresaMap.get(r.empresa_id) || null }));
  }

  async getByMonth(month: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('resultados_processamento')
      .select('*')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr)
      .order('data', { ascending: true });
    if (error) throw error;
    return data;
  }
}
export const ResultadosService = new ResultadosServiceClass();

class OperacaoServiceClass extends BaseService<'operacoes'> {
  constructor() { super('operacoes'); }

  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  async getAllPainel(empresaId?: string, tenantId?: string | null) {
    let empresaIds = empresaId ? [empresaId] : undefined;
    
    if (!empresaId && tenantId) {
      empresaIds = await this.getEmpresaIdsFromTenant(tenantId);
      if (!empresaIds || empresaIds.length === 0) return [];
    }

    let operacoesQuery = supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))');

    if (empresaIds && empresaIds.length > 0) {
      operacoesQuery = operacoesQuery.in('empresa_id', empresaIds);
    }

    const operacoesLegadasRes = await operacoesQuery;
    const operacoesProducao = await OperacaoProducaoService.getAll(empresaId, tenantId).catch(() => []);

    if (operacoesLegadasRes.error) throw operacoesLegadasRes.error;

    const operacoesLegadas = operacoesLegadasRes.data ?? [];
    const fallbackDate = new Date().toISOString().split('T')[0];

    const legadasNormalizadas = operacoesLegadas.map((item: any) => ({
      ...item,
      origem: 'operacoes',
      data_referencia: item.data ?? fallbackDate,
      produto_label: item.produto ?? null,
      transportadora_label: item.transportadora ?? null,
      tipo_servico_label: item.tipo_servico ?? null,
      quantidade_label: Number(item.quantidade || 0),
      horario_inicio_label: item.horario_inicio ?? null,
      horario_fim_label: item.horario_fim ?? null,
      valor_unitario_label: Number(item.valor_unitario || 0),
      valor_total_label: Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      criado_em_label: item.created_at ?? item.data_criacao ?? null,
    }));

    const producaoNormalizada = (operacoesProducao ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes_producao',
      data_referencia: item.data_operacao ?? fallbackDate,
      data_operacao: item.data_operacao ?? fallbackDate,
      quantidade_colaboradores: Number(item.quantidade_colaboradores ?? 1),
      produto_label: item.produtos_carga?.nome ?? item.avaliacao_json?.contexto_operacional?.produto ?? null,
      transportadora_label: item.transportadoras_clientes?.nome ?? null,
      tipo_servico_label: item.tipos_servico_operacional?.nome ?? null,
      quantidade_label: Number(
        item.tipo_calculo_snapshot === 'colaborador'
          ? item.quantidade_colaboradores
            ?? item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores
            ?? item.quantidade
            ?? 0
          : item.quantidade ?? 0,
      ),
      horario_inicio_label: item.entrada_ponto ?? null,
      horario_fim_label: item.saida_ponto ?? null,
      valor_unitario_label: Number(item.valor_unitario_snapshot || 0),
      valor_total_label: Number(item.valor_total || 0),
      placa: item.placa ?? null,
      nf_numero: item.nf_numero ?? null,
      ctrc: item.ctrc ?? null,
      percentual_iss: item.percentual_iss ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
    }));

    return [...producaoNormalizada, ...legadasNormalizadas].sort((a: any, b: any) => {
      const aTime = new Date(a.criado_em_label ?? `${a.data_referencia}T${a.horario_inicio_label ?? '00:00:00'}`).getTime();
      const bTime = new Date(b.criado_em_label ?? `${b.data_referencia}T${b.horario_inicio_label ?? '00:00:00'}`).getTime();
      return bTime - aTime;
    });
  }

  async getByDate(date: string, empresaId?: string) {
    let query = supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByMonth(month: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);
    if (error) throw error;
    return data;
  }

  async getInconsistencies() {
    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('status', 'inconsistente');
    if (error) throw error;
    return data;
  }

  async getWeeklyHistory() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('resultados_processamento')
      .select('*')
      .gte('data', dateStr)
      .order('data', { ascending: true });

    if (error) throw error;
    return data ?? []; // FIX: era `result`, corrigido para `data`
  }

  async getPainelByDate(date: string, empresaId?: string) {
    const [operacoesLegadas, operacoesProducao] = await Promise.all([
      this.getByDate(date, empresaId),
      OperacaoProducaoService.getByDate(date, empresaId).catch(() => []),
    ]);

    const legadasNormalizadas = (operacoesLegadas ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes',
      data_referencia: item.data ?? date,
      produto_label: item.produto ?? null,
      transportadora_label: item.transportadora ?? null,
      tipo_servico_label: item.tipo_servico ?? null,
      quantidade_label: Number(item.quantidade || 0),
      horario_inicio_label: item.horario_inicio ?? null,
      horario_fim_label: item.horario_fim ?? null,
      valor_unitario_label: Number(item.valor_unitario || 0),
      valor_total_label: Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      criado_em_label: item.created_at ?? item.data_criacao ?? null,
    }));

    const producaoNormalizada = (operacoesProducao ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes_producao',
      data_referencia: item.data_operacao ?? date,
      data_operacao: item.data_operacao ?? date,
      quantidade_colaboradores: Number(item.quantidade_colaboradores ?? 1),
      produto_label: item.produtos_carga?.nome ?? item.avaliacao_json?.contexto_operacional?.produto ?? null,
      transportadora_label: item.transportadoras_clientes?.nome ?? null,
      tipo_servico_label: item.tipos_servico_operacional?.nome ?? null,
      quantidade_label: Number(
        item.tipo_calculo_snapshot === 'colaborador'
          ? item.quantidade_colaboradores
            ?? item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores
            ?? item.quantidade
            ?? 0
          : item.quantidade ?? 0,
      ),
      horario_inicio_label: item.entrada_ponto ?? null,
      horario_fim_label: item.saida_ponto ?? null,
      valor_unitario_label: Number(item.valor_unitario_snapshot || 0),
      valor_total_label: Number(item.valor_total || 0),
      placa: item.placa ?? null,
      nf_numero: item.nf_numero ?? null,
      ctrc: item.ctrc ?? null,
      percentual_iss: item.percentual_iss ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
    }));

    return [...producaoNormalizada, ...legadasNormalizadas].sort((a: any, b: any) => {
      const aTime = new Date(a.criado_em_label ?? `${a.data_referencia}T${a.horario_inicio_label ?? '00:00:00'}`).getTime();
      const bTime = new Date(b.criado_em_label ?? `${b.data_referencia}T${b.horario_inicio_label ?? '00:00:00'}`).getTime();
      return bTime - aTime;
    });
  }
}
export const OperacaoService = new OperacaoServiceClass();

class PontoServiceClass extends BaseService<'registros_ponto'> {
  constructor() { super('registros_ponto'); }

  async getByDate(date: string, empresaId?: string) {
    let query = supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByMonth(month: string, empresaId?: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr)
      .order('data', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByCollaborator(collabId: string) {
    const { data, error } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', collabId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async deleteImported(month: string, empresaId?: string | null) {
    const [year, monthNumber] = month.split('-').map(Number);
    if (!year || !monthNumber) {
      throw new Error('Periodo invalido para limpar importacao.');
    }

    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const tenantId = await getCurrentTenantId();

    let pontosQuery = supabase
      .from('registros_ponto')
      .select('id, colaborador_id')
      .eq('tenant_id', tenantId)
      .eq('origem', 'importacao')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);

    if (empresaId) {
      pontosQuery = pontosQuery.eq('empresa_id', empresaId);
    }

    const { data: pontos, error: pontosError } = await pontosQuery;
    if (pontosError) throw pontosError;

    const pontoIds = (pontos ?? []).map((ponto) => ponto.id);
    const colaboradorIds = Array.from(
      new Set((pontos ?? []).map((ponto) => ponto.colaborador_id).filter(Boolean)),
    ) as string[];

    if (pontoIds.length === 0) {
      return 0;
    }

    const { error: eventosError } = await supabase
      .from('banco_horas_eventos')
      .delete()
      .in('registro_ponto_id', pontoIds);
    if (eventosError) throw eventosError;

    const { error: inconsistenciasError } = await supabase
      .from('processamento_rh_inconsistencias')
      .delete()
      .in('registro_ponto_id', pontoIds);
    if (inconsistenciasError) throw inconsistenciasError;

    let logsDeleteQuery = supabase
      .from('processamento_rh_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('periodo_mes', monthNumber)
      .eq('periodo_ano', year);

    if (empresaId) {
      logsDeleteQuery = logsDeleteQuery.eq('empresa_id', empresaId);
    }

    const { error: logsError } = await logsDeleteQuery;
    if (logsError) throw logsError;

    let fechamentoDeleteQuery = supabase
      .from('fechamento_mensal')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('mes', monthNumber)
      .eq('ano', year);

    if (empresaId) {
      fechamentoDeleteQuery = fechamentoDeleteQuery.eq('empresa_id', empresaId);
    }

    if (colaboradorIds.length > 0) {
      fechamentoDeleteQuery = fechamentoDeleteQuery.in('colaborador_id', colaboradorIds);
    }

    const { error: fechamentoError } = await fechamentoDeleteQuery;
    if (fechamentoError) throw fechamentoError;

    let pontosDeleteQuery = supabase
      .from('registros_ponto')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('origem', 'importacao')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);

    if (empresaId) {
      pontosDeleteQuery = pontosDeleteQuery.eq('empresa_id', empresaId);
    }

    const { data: deletedPontos, error: deletePontosError } = await pontosDeleteQuery.select('id');
    if (deletePontosError) throw deletePontosError;

    for (const colaboradorId of colaboradorIds) {
      const { data: eventosRestantes, error: eventosRestantesError } = await supabase
        .from('banco_horas_eventos')
        .select('quantidade_minutos, data, empresa_id')
        .eq('tenant_id', tenantId)
        .eq('colaborador_id', colaboradorId)
        .order('data', { ascending: true });

      if (eventosRestantesError) throw eventosRestantesError;

      if (!eventosRestantes || eventosRestantes.length === 0) {
        const { error: saldoDeleteError } = await supabase
          .from('banco_horas_saldos')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('colaborador_id', colaboradorId);
        if (saldoDeleteError) throw saldoDeleteError;
        continue;
      }

      const saldoAtualMinutos = eventosRestantes.reduce(
        (acc, evento) => acc + Number(evento.quantidade_minutos ?? 0),
        0,
      );
      const horasPositivasMinutos = eventosRestantes
        .filter((evento) => Number(evento.quantidade_minutos ?? 0) > 0)
        .reduce((acc, evento) => acc + Number(evento.quantidade_minutos ?? 0), 0);
      const horasNegativasMinutos = Math.abs(
        eventosRestantes
          .filter((evento) => Number(evento.quantidade_minutos ?? 0) < 0)
          .reduce((acc, evento) => acc + Number(evento.quantidade_minutos ?? 0), 0),
      );
      const ultimoEvento = eventosRestantes[eventosRestantes.length - 1];

      const { error: saldoUpsertError } = await supabase
        .from('banco_horas_saldos')
        .upsert(
          {
            tenant_id: tenantId,
            empresa_id: ultimoEvento?.empresa_id ?? null,
            colaborador_id: colaboradorId,
            saldo_atual_minutos: saldoAtualMinutos,
            horas_positivas_minutos: horasPositivasMinutos,
            horas_negativas_minutos: horasNegativasMinutos,
            ultima_movimentacao: ultimoEvento?.data
              ? new Date(`${ultimoEvento.data}T00:00:00`).toISOString()
              : null,
            ultima_atualizacao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,colaborador_id' },
        );
      if (saldoUpsertError) throw saldoUpsertError;
    }

    return deletedPontos?.length ?? pontoIds.length;
  }
}
export const PontoService = new PontoServiceClass();

class ClienteServiceClass extends BaseService<'clientes'> {
  constructor() { super('clientes'); }
}
export const ClienteService = new ClienteServiceClass();

class RegraCalculoServiceClass extends BaseService<'financeiro_regras'> {
  constructor() { super('financeiro_regras'); }

  async getAllActive() {
    const { data, error } = await supabase
      .from('financeiro_regras')
      .select('*')
      .eq('esta_ativa', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data;
  }

  async getByCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('financeiro_regras')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('esta_ativa', true);
    if (error) throw error;
    return data;
  }

  async updateVersioned(id: string, payload: any) {
    const { data, error } = await supabase.rpc('create_new_rule_version', {
      p_regra_id: id,
      p_new_data: payload
    });
    if (error) throw error;
    return data;
  }
}
export const RegraCalculoService = new RegraCalculoServiceClass();

class RegrasFinanceirasServiceClass extends BaseService<'regras_financeiras'> {
  constructor() { super('regras_financeiras'); }

  async getAllActive() {
    const { data, error } = await supabase
      .from('regras_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data;
  }

  async getByModalidade(modalidade: string) {
    const { data, error } = await supabase
      .from('regras_financeiras')
      .select('*')
      .eq('modalidade_financeira', modalidade)
      .eq('ativo', true)
      .order('empresa_id', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }

  async getFormasPermitidas(modalidade: string, empresaId?: string) {
    const { data, error } = await supabase.rpc('get_formas_pagamento_permitidas', {
      p_modalidade_financeira: modalidade,
      p_empresa_id: empresaId ?? null
    });
    if (error) throw error;
    return data;
  }

  async classificarFinanceiro(dataOperacao: string, modalidade: string, empresaId?: string) {
    const { data, error } = await supabase.rpc('classificar_financeiro_operacao', {
      p_data_operacao: dataOperacao,
      p_modalidade_financeira: modalidade,
      p_empresa_id: empresaId ?? null
    });
    if (error) throw error;
    return data;
  }
}
export const RegrasFinanceirasService = new RegrasFinanceirasServiceClass();

class CompetenciaServiceClass extends BaseService<'financeiro_competencias'> {
  constructor() { super('financeiro_competencias'); }

  async getByMonth(month: string, empresaId: string) {
    const dateStr = month.includes('-') ? `${month}-01` : month;
    const { data, error } = await supabase
      .from('financeiro_competencias')
      .select('*')
      .eq('competencia', dateStr)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getAtual(empresaId: string) {
    const month = new Date().toISOString().substring(0, 7);
    return this.getByMonth(month, empresaId);
  }
}
export const CompetenciaService = new CompetenciaServiceClass();

class ConsolidadoServiceClass {
  async getByCompetencia(competencia: string, empresaId?: string) {
    let qC = supabase
      .from('financeiro_consolidados_cliente')
      .select('*, clientes(nome)')
      .eq('competencia', competencia);

    if (empresaId) qC = qC.eq('empresa_id', empresaId);

    let qCol = supabase
      .from('financeiro_consolidados_colaborador')
      .select('*, colaboradores(nome, cargo)')
      .eq('competencia', competencia);

    if (empresaId) qCol = qCol.eq('empresa_id', empresaId);

    const [resC, resCol] = await Promise.all([qC, qCol]);

    if (resC.error || resCol.error) throw resC.error || resCol.error;
    return { clientes: resC.data, colaboradores: resCol.data };
  }

  async getClientConsolidadoById(id: string) {
    const { data, error } = await supabase
      .from('financeiro_consolidados_cliente')
      .select('*, clientes(nome, empresa_id), empresas:empresa_id(nome)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async approveBatch(ids: string[]) {
    const { error } = await supabase
      .from('financeiro_consolidados_cliente')
      .update({ status: 'aprovado' })
      .in('id', ids);
    if (error) throw error;
  }
}
export const ConsolidadoService = new ConsolidadoServiceClass();

class UnidadeServiceClass extends BaseService<'unidades'> {
  constructor() { super('unidades'); }
  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase.from('unidades').select('*').eq('empresa_id', empresaId);
    if (error) throw error;
    return data;
  }
}
export const UnidadeService = new UnidadeServiceClass();

class EquipeServiceClass extends BaseService<'equipes'> {
  constructor() { super('equipes'); }
  async getWithDetails() {
    const { data, error } = await supabase
      .from('equipes')
      .select('*, unidades(nome), empresas(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const EquipeService = new EquipeServiceClass();

class ConfigTipoOperacaoServiceClass extends BaseService<'config_tipos_operacao'> {
  constructor() { super('config_tipos_operacao'); }

  async getAll() {
    const { data, error } = await supabase
      .from('config_tipos_operacao')
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Database['public']['Tables']['config_tipos_operacao']['Insert']) {
    await requireAuthenticatedUserId();
    const tenantId = await getCurrentTenantId();

    const payloadWithTenant = sanitizePayload({
      ...payload,
      tenant_id: tenantId,
    }) as Database['public']['Tables']['config_tipos_operacao']['Insert'];

    const { data, error } = await supabase
      .from('config_tipos_operacao')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database['public']['Tables']['config_tipos_operacao']['Update']) {
    await requireAuthenticatedUserId();
    const tenantId = await getCurrentTenantId();

    const payloadWithTenant = sanitizePayload({
      ...payload,
      tenant_id: tenantId,
    }) as Database['public']['Tables']['config_tipos_operacao']['Update'];

    const { data, error } = await supabase
      .from('config_tipos_operacao')
      .update(payloadWithTenant)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  hasDuplicate(
    items: Array<{ id?: string | null; nome?: string | null; codigo?: string | null }>,
    payload: { id?: string | null; nome?: string | null; codigo?: string | null }
  ) {
    const normalizedNome = normalizeConfigTipoOperacaoValue(payload.nome);
    const normalizedCodigo = normalizeConfigTipoOperacaoValue(payload.codigo);

    return items.some((item) => {
      if (payload.id && item.id === payload.id) return false;

      const sameNome = normalizedNome && normalizeConfigTipoOperacaoValue(item.nome) === normalizedNome;
      const sameCodigo = normalizedCodigo && normalizeConfigTipoOperacaoValue(item.codigo) === normalizedCodigo;
      return sameNome || sameCodigo;
    });
  }
}
export const ConfigTipoOperacaoService = new ConfigTipoOperacaoServiceClass();

class ConfigProdutoServiceClass extends BaseService<'config_produtos'> {
  constructor() { super('config_produtos'); }
}
export const ConfigProdutoService = new ConfigProdutoServiceClass();

class ConfigTipoDiaServiceClass extends BaseService<'config_tipos_dia'> {
  constructor() { super('config_tipos_dia'); }
}
export const ConfigTipoDiaService = new ConfigTipoDiaServiceClass();

class ConfiguracaoOperacionalServiceClass extends BaseService<'configuracoes_operacionais'> {
  constructor() { super('configuracoes_operacionais'); }

  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase
      .from('configuracoes_operacionais')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsert(payload: any) {
    const { data, error } = await supabase
      .from('configuracoes_operacionais')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
export const ConfiguracaoOperacionalService = new ConfiguracaoOperacionalServiceClass();

// ==================================================
// SERVIÇOS OPERACIONAIS V2 (/producao)
// ==================================================
const operationalClient: any = supabase;

class UnidadeOperacionalServiceClass {
  async getByEmpresa(empresaId: string) {
    const { data, error } = await operationalClient
      .from('unidades')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
export const UnidadeOperacionalService = new UnidadeOperacionalServiceClass();

class TipoServicoOperacionalServiceClass {
  async getByEmpresa(empresaId?: string) {
    // RLS garante isolamento por tenant_id. Filtro explícito é defesa em profundidade.
    let query = operationalClient
      .from('tipos_servico_operacional')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getAllActive() {
    // RLS garante isolamento por tenant_id automaticamente.
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    // Verificar se nome já existe
    const { data: existing } = await operationalClient
      .from('tipos_servico_operacional')
      .select('id')
      .ilike('nome', payload.nome)
      .limit(1);
    
    if (existing && existing.length > 0) {
      throw new Error(`Tipo de serviço "${payload.nome}" já existe.`);
    }

    const tenantId = await getCurrentTenantId();
    const payloadWithTenant = { ...payload, tenant_id: tenantId };

    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('tipos_servico_operacional')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const tenantId = await getCurrentTenantId();
    const { error } = await operationalClient
      .from('tipos_servico_operacional')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string; detalhes?: { tabela: string; count: number; ids?: string[] }[] }> {
    const [operacaoResult, regraResult] = await Promise.all([
      operationalClient
        .from('operacoes_producao')
        .select('id')
        .eq('tipo_servico_id', id),
      operationalClient
        .from('fornecedor_valores_servico')
        .select('id')
        .eq('tipo_servico_id', id)
    ]);

    const vinculos: { tabela: string; count: number; ids?: string[] }[] = [];

    if (operacaoResult.data && operacaoResult.data.length > 0) {
      vinculos.push({
        tabela: 'operacoes_producao',
        count: operacaoResult.data.length,
        ids: operacaoResult.data.slice(0, 3).map((r: any) => r.id)
      });
    }

    console.log(`[TipoServicoOperacionalService.deleteWithCheck] ID: ${id}`);
    console.log(`[TipoServicoOperacionalService.deleteWithCheck] Vínculos encontrados:`, vinculos);

    const { error, count } = await operationalClient
      .from('tipos_servico_operacional')
      .delete({ count: 'exact' })
      .eq('id', id)
      .select('id');

    if (error) {
      console.error(`[TipoServicoOperacionalService.deleteWithCheck] Erro no delete:`, error);
      if (error.code === '23503') {
        const referencedTable = extractReferencedTableFromFkError(error);
        return {
          success: false,
          detalhes: referencedTable ? [{ tabela: referencedTable, count: 1 }] : undefined,
          error: 'Este tipo de serviço possui vínculos e não pode ser excluído.'
        };
      }
      throw error;
    }

    if (!count || count === 0) {
        error: 'Nenhum tipo de serviço foi excluído. O registro pode não existir.'
    }

    return { success: true };
  }
}
export const TipoServicoOperacionalService = new TipoServicoOperacionalServiceClass();

class TransportadoraClienteServiceClass {
  async getByEmpresa(empresaId?: string) {
    // RLS garante isolamento por tenant_id. empresaId filtra dentro do tenant.
    let query = operationalClient
      .from('transportadoras_clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();

    const nome = String(payload.nome ?? '').trim();
    if (nome) {
      const { data: existing } = await operationalClient
        .from('transportadoras_clientes')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('nome', nome)
        .maybeSingle();

      if (existing) {
        throw new Error(getTransportadoraDuplicateMessage());
      }
    }
    
    const payloadWithTenant = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
      tenant_id: tenantId
    };

    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) {
      throw new Error(getTransportadoraErrorMessage(error));
    }
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (nome) {
      const { data: existing } = await operationalClient
        .from('transportadoras_clientes')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('nome', nome)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new Error(getTransportadoraDuplicateMessage());
      }
    }

    const payloadCleaned = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
    };

    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .update(payloadCleaned)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(getTransportadoraErrorMessage(error));
    }
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string; detalhes?: { tabela: string; count: number; ids?: string[] }[] }> {
    console.log(`[TransportadoraClienteService.deleteWithCheck] Excluindo ID: ${id}`);

    // As FKs em operacoes_producao e fornecedor_valores_servico são ON DELETE SET NULL
    // Não há vínculos bloqueantes — pode deletar diretamente.
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[TransportadoraClienteService.deleteWithCheck] Erro no delete:`, error);

      // Caso improvável de FK violada (tabela sem SET NULL)
      if (error.code === '23503') {
        const referencedTable = extractReferencedTableFromFkError(error);
        return {
          success: false,
          detalhes: referencedTable ? [{ tabela: referencedTable, count: 1 }] : undefined,
          error: 'Esta transportadora possui vínculos e não pode ser excluída.',
        };
      }
      throw error;
    }

    return { success: true };
  }

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }
}
export const TransportadoraClienteService = new TransportadoraClienteServiceClass();

class FornecedorServiceClass {
  async getByEmpresa(empresaId?: string) {
    // RLS garante isolamento por tenant_id. empresaId filtra dentro do tenant.
    let query = operationalClient
      .from('fornecedores')
      .select('*, produtos_carga(nome)')
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (!nome) {
      throw new Error("Informe o nome do fornecedor.");
    }

    const { data: existing } = await operationalClient
      .from('fornecedores')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('nome', nome)
      .maybeSingle();

    if (existing) {
      throw new Error("Já existe um fornecedor com este nome neste tenant.");
    }
    
    const produtosArray = payload.produtos_associados;
    
    const payloadWithTenant = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
      tenant_id: tenantId
    };
    delete payloadWithTenant.produtos_associados;
    delete payloadWithTenant.produto_id;
    delete payloadWithTenant.produtos_carga;

    const { data, error } = await operationalClient
      .from('fornecedores')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Já existe um fornecedor com este nome neste tenant.");
      throw error;
    }

    if (produtosArray && Array.isArray(produtosArray) && produtosArray.length > 0 && data) {
        await operationalClient.from('produtos_carga').update({ fornecedor_id: data.id }).in('id', produtosArray);
    }

    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (!nome) {
      throw new Error("Informe o nome do fornecedor.");
    }

    const { data: existing } = await operationalClient
      .from('fornecedores')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('nome', nome)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      throw new Error("Já existe um fornecedor com este nome neste tenant.");
    }

    const produtosArray = payload.produtos_associados;
    const payloadCleaned = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
    };
    delete payloadCleaned.produtos_associados;
    delete payloadCleaned.produto_id;
    delete payloadCleaned.produtos_carga;

    const { data, error } = await operationalClient
      .from('fornecedores')
      .update(payloadCleaned)
      .eq('id', id)
      .select();

    if (error) {
      if (error.code === '23505') throw new Error("Já existe um fornecedor com este nome neste tenant.");
      throw error;
    }

    if (produtosArray !== undefined && Array.isArray(produtosArray)) {
       await operationalClient.from('produtos_carga').update({ fornecedor_id: null }).eq('fornecedor_id', id);
       if (produtosArray.length > 0) {
         await operationalClient.from('produtos_carga').update({ fornecedor_id: id }).in('id', produtosArray);
       }
    }

    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('fornecedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await operationalClient
      .from('fornecedores')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string; detalhes?: { tabela: string; count: number; ids?: string[] }[] }> {
    console.log(`[FornecedorService.deleteWithCheck] Excluindo ID: ${id}`);

    // As FKs em operacoes_producao são ON DELETE SET NULL
    // As FKs em fornecedor_valores_servico e produtos_carga são ON DELETE CASCADE
    const { error, count } = await operationalClient
      .from('fornecedores')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error(`[FornecedorService.deleteWithCheck] Erro no delete:`, error);
      if (error.code === '23503') {
        const referencedTable = extractReferencedTableFromFkError(error);
        return {
          success: false,
          detalhes: referencedTable ? [{ tabela: referencedTable, count: 1 }] : undefined,
          error: 'Este fornecedor possui vínculos e não pode ser excluído.',
        };
      }
      throw error;
    }

    if (count === 0) {
       return {
         success: false,
         error: 'Nenhum registro foi excluído. Pode não existir ou você não tem permissão.'
       };
    }

    return { success: true };
  }
}
export const FornecedorService = new FornecedorServiceClass();

class ProdutoCargaServiceClass {
  async getAll() {
    const { data, error } = await operationalClient
      .from('produtos_carga')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getByFornecedor(fornecedorId: string) {
    const { data, error } = await operationalClient
      .from('produtos_carga')
      .select('*')
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const payloadCleaned = {
      ...payload,
      fornecedor_id: payload.fornecedor_id ? cleanUuid(payload.fornecedor_id) : null,
    };

    const { data, error } = await operationalClient
      .from('produtos_carga')
      .insert(payloadCleaned)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const payloadCleaned = {
      ...payload,
      fornecedor_id: payload.fornecedor_id ? cleanUuid(payload.fornecedor_id) : null,
    };
    const { data, error } = await operationalClient
      .from('produtos_carga')
      .update(payloadCleaned)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('produtos_carga')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}
export const ProdutoCargaService = new ProdutoCargaServiceClass();

class FormaPagamentoOperacionalServiceClass {
  async getAllActive() {
    const { data, error } = await operationalClient
      .from('formas_pagamento_operacional')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const payloadWithTenant = { ...payload, tenant_id: tenantId };

    const { data, error } = await operationalClient
      .from('formas_pagamento_operacional')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
export const FormaPagamentoOperacionalService = new FormaPagamentoOperacionalServiceClass();

class FornecedorValorServicoServiceClass {
  async resolverValor(params: {
    empresaId: string;
    unidadeId?: string | null;
    tipoServicoId: string;
    fornecedorId?: string | null;
    transportadoraId?: string | null;
    produtoCargaId?: string | null;
    dataOperacao?: string;
  }) {
    const { data, error } = await operationalClient.rpc('resolver_valor_operacao', {
      p_empresa_id: params.empresaId,
      p_unidade_id: params.unidadeId ?? null,
      p_tipo_servico_id: params.tipoServicoId,
      p_fornecedor_id: params.fornecedorId,
      p_transportadora_id: params.transportadoraId ?? null,
      p_produto_carga_id: params.produtoCargaId ?? null,
      p_data_operacao: params.dataOperacao ?? null,
    });

    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data;
  }

  async resolverIss(params: {
    empresaId: string;
    tipoServicoId?: string | null;
    dataOperacao?: string;
  }) {
    const { data, error } = await operationalClient.rpc('resolver_iss_operacao', {
      p_empresa_id: params.empresaId,
      p_tipo_servico_id: params.tipoServicoId ?? null,
      p_data_operacao: params.dataOperacao ?? null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data;
  }
}
export const FornecedorValorServicoService = new FornecedorValorServicoServiceClass();

class RegraOperacionalServiceClass {
  async getAll(empresaId?: string) {
    let query = operationalClient
      .from('fornecedor_valores_servico')
      .select(`
        *,
        empresas:empresa_id(nome),
        tipos_regra_operacional:tipo_regra_id(nome, coluna_planilha, unidade_medida),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .order('ativo', { ascending: false })
      .order('vigencia_inicio', { ascending: false })
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      if (errorCode === 'PGRST205' || errorMessage.includes('custos_extras_operacionais')) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }
      throw error;
    }
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    console.log('[REGRAS] Payload original:', JSON.stringify(payload));
    
    const tenantId = await getCurrentTenantId();
    
    // Campos fundamentais da tabela base + tenant_id (obrigatório)
    const payloadCleaned: Record<string, unknown> = {
      tenant_id: tenantId,
      tipo_calculo: payload.tipo_calculo,
      valor_unitario: payload.valor_unitario,
      vigencia_inicio: payload.vigencia_inicio,
      vigencia_fim: payload.vigencia_fim || null,
      ativo: payload.ativo,
    };
    
    // Helper para adicionar campo UUID apenas se válido
    const tryAddUuid = (fieldName: string) => {
      const val = payload[fieldName];
      if (val !== undefined && val != null) {
        const strVal = String(val).trim();
        if (strVal !== '') {
          const cleaned = cleanUuid(strVal);
          if (cleaned) {
            payloadCleaned[fieldName] = cleaned;
          }
        }
      }
    };
    
    // Campos UUID opcionais
    tryAddUuid('empresa_id');
    tryAddUuid('unidade_id');
    tryAddUuid('tipo_servico_id');
    tryAddUuid('fornecedor_id');
    tryAddUuid('transportadora_id');
    tryAddUuid('produto_carga_id');
    tryAddUuid('tipo_regra_id');
    tryAddUuid('forma_pagamento_id');

    console.log('[REGRAS] Payload sanitizado:', JSON.stringify(payloadCleaned));

    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payloadCleaned)
      .select()
      .single();

    if (error) {
      console.error('[REGRAS] Erro ao inserir:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: payloadCleaned
      });
      throw error;
    }
    return data;
  }

  async createMany(payloads: Record<string, any>[]) {
    if (payloads.length === 0) return [];

    console.log('[REGRAS] createMany - payloads antes:', JSON.stringify(payloads));

    const tenantId = await getCurrentTenantId();
    
    // Helper para adicionar campo UUID apenas se válido
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryAddUuid = (fieldName: string, obj: any, target: any) => {
        const val = obj[fieldName];
        if (val !== undefined && val != null) {
          const strVal = String(val).trim();
          if (strVal !== '') {
            const cleaned = cleanUuid(strVal);
            if (cleaned) {
              target[fieldName] = cleaned;
            }
          }
        }
      };
      
      const uuidFieldNames = [
        'empresa_id', 'unidade_id', 'tipo_servico_id', 'fornecedor_id', 
        'transportadora_id', 'produto_carga_id', 'tipo_regra_id', 'forma_pagamento_id'
      ];

      const payloadsWithTenant = payloads.map(p => {
        const cleaned: Record<string, unknown> = {
          tenant_id: tenantId,
          tipo_calculo: p.tipo_calculo,
          valor_unitario: p.valor_unitario,
          vigencia_inicio: p.vigencia_inicio,
          vigencia_fim: p.vigencia_fim || null,
          ativo: p.ativo,
        };
        
        for (const field of uuidFieldNames) {
          tryAddUuid(field, p, cleaned);
        }
        
        return cleaned;
      });

    console.log('[REGRAS] createMany - payloads sanitizados:', JSON.stringify(payloadsWithTenant));

    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payloadsWithTenant)
      .select();

    if (error) {
      console.error('[REGRAS] createMany - erro ao inserir:', {
        code: error.code,
        message: error.message,
        payloads: payloadsWithTenant
      });
      throw error;
    }
    return data ?? [];
  }

  async update(id: string, payload: Record<string, any>) {
    console.log('[REGRAS] update - payload antes:', JSON.stringify(payload));

    // Helper para adicionar campo UUID apenas se válido
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyNullableUuid = (fieldName: string, obj: any, target: any) => {
      if (!(fieldName in obj)) return;

      const val = obj[fieldName];
      if (val == null || String(val).trim() === '') {
        target[fieldName] = null;
        return;
      }

      const cleaned = cleanUuid(String(val).trim());
      if (cleaned) {
        target[fieldName] = cleaned;
      }
    };

    const uuidFields = [
      'empresa_id', 'unidade_id', 'tipo_servico_id', 'fornecedor_id', 
      'transportadora_id', 'produto_carga_id', 'tipo_regra_id', 'forma_pagamento_id'
    ];
    
    const payloadCleaned: Record<string, unknown> = {};
    
    for (const field of uuidFields) {
      applyNullableUuid(field, payload, payloadCleaned);
    }
    
    // Copiar campos não-UUID
    if (payload.tipo_calculo !== undefined) payloadCleaned.tipo_calculo = payload.tipo_calculo;
    if (payload.valor_unitario !== undefined) payloadCleaned.valor_unitario = payload.valor_unitario;
    if (payload.vigencia_inicio !== undefined) payloadCleaned.vigencia_inicio = payload.vigencia_inicio;
    if (payload.vigencia_fim !== undefined) payloadCleaned.vigencia_fim = payload.vigencia_fim || null;
    if (payload.ativo !== undefined) payloadCleaned.ativo = payload.ativo;

    console.log('[REGRAS] update - payload sanitizado:', JSON.stringify(payloadCleaned));

    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .update(payloadCleaned)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[REGRAS] update - erro ao atualizar:', {
        code: error.code,
        message: error.message,
        payload: payloadCleaned
      });
      throw error;
    }
    return data;
  }

  async inativar(id: string) {
    return this.update(id, { ativo: false });
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('fornecedor_valores_servico')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async hasActiveConflict(params: {
    empresaId?: string | null;
    tipoServicoId?: string | null;
    fornecedorId?: string | null;
    transportadoraId?: string | null;
    produtoCargaId?: string | null;
    tipoRegraId?: string;
    tipoCalculo: string;
    vigenciaInicio: string;
    vigenciaFim?: string | null;
    excludeId?: string;
  }) {
    let query = operationalClient
      .from('fornecedor_valores_servico')
      .select('id, vigencia_inicio, vigencia_fim')
      .eq('tipo_calculo', params.tipoCalculo)
      .eq('ativo', true);

    query = params.empresaId
      ? query.eq('empresa_id', params.empresaId)
      : query.is('empresa_id', null);

    query = params.tipoServicoId
      ? query.eq('tipo_servico_id', params.tipoServicoId)
      : query.is('tipo_servico_id', null);

    query = params.fornecedorId
      ? query.eq('fornecedor_id', params.fornecedorId)
      : query.is('fornecedor_id', null);

    if (params.tipoRegraId) {
      query = query.eq('tipo_regra_id', params.tipoRegraId);
    }

    query = params.transportadoraId
      ? query.eq('transportadora_id', params.transportadoraId)
      : query.is('transportadora_id', null);

    query = params.produtoCargaId
      ? query.eq('produto_carga_id', params.produtoCargaId)
      : query.is('produto_carga_id', null);

    if (params.excludeId) query = query.neq('id', params.excludeId);

    const { data, error } = await query;
    if (error) throw error;

    const inicioNovo = new Date(`${params.vigenciaInicio}T00:00:00`);
    const fimNovo = params.vigenciaFim ? new Date(`${params.vigenciaFim}T23:59:59`) : null;

    return (data ?? []).some((item: any) => {
      const inicioExistente = new Date(`${item.vigencia_inicio}T00:00:00`);
      const fimExistente = item.vigencia_fim ? new Date(`${item.vigencia_fim}T23:59:59`) : null;

      const novoAntesDoFimExistente = !fimExistente || inicioNovo <= fimExistente;
      const existenteAntesDoFimNovo = !fimNovo || inicioExistente <= fimNovo;

      return novoAntesDoFimExistente && existenteAntesDoFimNovo;
    });
  }
}
export const RegraOperacionalService = new RegraOperacionalServiceClass();

class OperacaoProducaoServiceClass {
  private sanitizeOperacaoPayload(payload: Record<string, any>) {
    const { categoria_servico, ...rest } = payload;
    return rest;
  }

  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  async isAvailable() {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .select('id')
      .limit(1);

    return !error;
  }

  async create(payload: Record<string, any>) {
    const safePayload = this.sanitizeOperacaoPayload(payload);
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .insert(safePayload)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async createWithColaboradores(
    payload: Record<string, any>,
    colaboradores: Array<{
      collaborator_id: string;
      had_infraction: boolean;
      infraction_type_id?: string | null;
      infraction_notes?: string | null;
    }>,
  ) {
    const registro = await this.create(payload);

    if (colaboradores.length > 0) {
      const { error } = await operationalClient
        .from('production_entry_collaborators')
        .insert(
          colaboradores.map((item) => ({
            production_entry_id: registro.id,
            collaborator_id: item.collaborator_id,
            had_infraction: item.had_infraction,
            infraction_type_id: item.infraction_type_id ?? null,
            infraction_notes: item.infraction_notes ?? null,
          })),
        );

      if (error) throw error;
    }

    return registro;
  }

  async update(id: string, payload: Record<string, any>) {
    const safePayload = this.sanitizeOperacaoPayload(payload);
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .update(safePayload)
      .eq('id', id)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async getByDate(date: string, empresaId?: string, unidadeId?: string | null) {
    let query = operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .eq('data_operacao', date)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getAll(empresaId?: string, tenantId?: string | null, unidadeId?: string | null) {
    let empresaIds = empresaId ? [empresaId] : undefined;
    
    if (!empresaId && tenantId) {
      empresaIds = await this.getEmpresaIdsFromTenant(tenantId);
      if (!empresaIds || empresaIds.length === 0) return [];
    }

    let query = operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (empresaIds && empresaIds.length > 0) {
      query = query.in('empresa_id', empresaIds);
    } else if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async cancel(id: string, userId: string, reason: string) {
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .update({
        status: 'cancelado',
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        motivo_exclusao: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteImported(empresaId?: string | null, dataInicio?: string, dataFim?: string) {
    let query = operationalClient
      .from('operacoes_producao')
      .delete()
      .select('id')
      .in('origem_dado', ['importacao', 'ajuste']);

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (dataInicio) query = query.gte('data_operacao', dataInicio);
    if (dataFim)    query = query.lte('data_operacao', dataFim);

    const { data, error } = await query;
    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      if (errorCode === 'PGRST205' || errorMessage.includes('custos_extras_operacionais')) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }
      throw error;
    }
    return data?.length ?? 0;
  }

  async deleteImportedByDates(datas: string[], empresaId?: string | null) {
    const uniqueDates = Array.from(new Set(datas.filter(Boolean)));
    if (uniqueDates.length === 0) return 0;

    let query = operationalClient
      .from('operacoes_producao')
      .delete()
      .select('id')
      .eq('origem_dado', 'importacao')
      .in('data_operacao', uniqueDates);

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data?.length ?? 0;
  }

  async replaceImportedBatch(empresaId: string, items: Record<string, unknown>[]) {
    const { data, error } = await operationalClient.rpc('replace_imported_operacoes_producao', {
      p_empresa_id: empresaId,
      p_items: items,
    });

    if (error) throw error;
    return Number(data ?? 0);
  }

  async getResumoDoDia(date: string, empresaId?: string, unidadeId?: string | null) {
    let query = operationalClient
      .from('vw_operacoes_producao_resumo_dia')
      .select('*')
      .eq('data_operacao', date);

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }
}
export const OperacaoProducaoService = new OperacaoProducaoServiceClass();

class CustoExtraOperacionalServiceClass {
  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  async update(id: string, payload: Record<string, unknown>) {
    const { data, error } = await operationalClient
      .from('custos_extras_operacionais')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('custos_extras_operacionais')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getByDate(date: string, empresaId?: string) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .eq('data', date)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getAll(empresaId?: string, tenantId?: string | null) {
    let empresaIds = empresaId ? [empresaId] : undefined;
    
    if (!empresaId && tenantId) {
      empresaIds = await this.getEmpresaIdsFromTenant(tenantId);
      if (!empresaIds || empresaIds.length === 0) return [];
    }

    let query = operationalClient
      .from('custos_extras_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false });

    if (empresaIds && empresaIds.length > 0) {
      query = query.in('empresa_id', empresaIds);
    } else if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async deleteImported(empresaId?: string | null) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .delete()
      .select('id')
      .eq('origem_dado', 'importacao');

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data?.length ?? 0;
  }

  async createMany(items: Record<string, unknown>[]) {
    if (items.length === 0) return [];

    const { data, error } = await operationalClient
      .from('custos_extras_operacionais')
      .insert(items)
      .select('id');

    if (error) throw error;
    return data ?? [];
  }

  async replaceImportedBatch(empresaId: string, items: Record<string, unknown>[]) {
    const { data, error } = await operationalClient.rpc('replace_imported_custos_extras_operacionais', {
      p_empresa_id: empresaId,
      p_items: items,
    });

    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      const functionMissing =
        errorCode === 'PGRST202' ||
        errorMessage.includes('replace_imported_custos_extras_operacionais');

      const tableMissing =
        errorCode === 'PGRST205' ||
        errorMessage.includes('custos_extras_operacionais');

      if (tableMissing) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }

      if (!functionMissing) throw error;

      await this.deleteImported(empresaId);
      const inserted = await this.createMany(
        items.map((item) => ({
          ...item,
          empresa_id: empresaId,
        })),
      );
      return inserted.length;
    }

    return Number(data ?? 0);
  }
}
export const CustoExtraOperacionalService = new CustoExtraOperacionalServiceClass();

// ==================================================
// STORAGE SERVICE
// ==================================================
export const StorageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return data;
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};

export interface ImportacaoModeloLink {
  id: string;
  tenant_id: string;
  modulo: string;
  nome_arquivo: string | null;
  drive_url: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export class ImportacaoModelosServiceClass {
  async listAll() {
    const { data, error } = await supabase
      .from('importacao_modelos' as any)
      .select('*')
      .order('modulo', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ImportacaoModeloLink[];
  }

  async upsert(payload: {
    modulo: string;
    nome_arquivo?: string | null;
    drive_url: string;
    ativo?: boolean;
  }) {
    const tenantId = await getCurrentTenantId();
    const { data, error } = await supabase
      .from('importacao_modelos' as any)
      .upsert(
        {
          tenant_id: tenantId,
          modulo: payload.modulo,
          nome_arquivo: payload.nome_arquivo ?? null,
          drive_url: payload.drive_url,
          ativo: payload.ativo ?? true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,modulo',
        },
      )
      .select('*')
      .single();

    if (error) throw error;
    return data as ImportacaoModeloLink;
  }

  async remove(id: string) {
    const { error } = await supabase
      .from('importacao_modelos' as any)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}
export const ImportacaoModelosService = new ImportacaoModelosServiceClass();

// ==================================================
// AI SERVICE & EDGE FUNCTIONS
// ==================================================
export const AIService = {
  async processDay(data: string, empresaId: string) {
    const { data: res, error } = await supabase.functions.invoke('process-day', {
      body: { data_processamento: data, empresa_id: empresaId }
    });
    if (error) throw error;
    return res;
  }
};

export class TipoRegraOperacionalServiceClass {
  async getAllActive() {
    const { data, error } = await supabase
      .from('tipos_regra_operacional' as any)
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: any) {
    const tenantId = await getCurrentTenantId();
    const payloadWithTenant = { ...payload, tenant_id: tenantId };

    const { data, error } = await supabase
      .from('tipos_regra_operacional' as any)
      .insert(payloadWithTenant)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
export const TipoRegraOperacionalService = new TipoRegraOperacionalServiceClass();

// ==================================================
// MÓDULO DIARISTAS
// ==================================================

export type CodigoMarcacao = 'P' | 'MP' | 'AUSENTE';
export type StatusLancamentoDiarista = 'em_aberto' | 'fechado_para_pagamento' | 'pago' | 'cancelado';

export interface LancamentoDiaristaPayload {
  empresa_id: string;
  diarista_id: string;
  nome_colaborador: string;
  cpf_colaborador?: string | null;
  funcao_colaborador?: string | null;
  data_lancamento: string;
  tipo_lancamento?: string | null; // campo local, removido antes do insert
  codigo_marcacao: CodigoMarcacao;
  quantidade_diaria: number;
  valor_diaria_base: number;
  valor_calculado: number;
  cliente_unidade?: string | null;
  operacao_servico?: string | null;
  encarregado_id?: string | null;
  encarregado_nome?: string | null;
  observacao?: string | null;
}

class DiaristaServiceClass {
  async getByEmpresa(empresaId: string, apenasAtivos = true) {
    let query = supabase
      .from('colaboradores')
      .select('id, nome, cpf, telefone, cargo, valor_base, status, empresa_id, permitir_lancamento_operacional, deleted_at')
      .eq('empresa_id', empresaId)
      .eq('tipo_colaborador', 'DIARISTA')
      .eq('permitir_lancamento_operacional', true)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (apenasAtivos) query = query.eq('status', 'ativo');

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((c: any) => ({
      ...c,
      funcao: c.cargo ?? '—',
      valor_diaria: Number(c.valor_base ?? 0),
    }));
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const mapped = {
      nome: payload.nome,
      cpf: payload.cpf ?? null,
      telefone: payload.telefone ?? null,
      cargo: payload.funcao ?? payload.cargo ?? null,
      valor_base: payload.valor_diaria ?? payload.valor_base ?? 0,
      status: payload.status ?? 'ativo',
      empresa_id: payload.empresa_id,
      tipo_colaborador: 'DIARISTA',
      permitir_lancamento_operacional: payload.permitir_lancamento_operacional ?? true,
      tenant_id: tenantId,
    };
    const { data, error } = await supabase
      .from('colaboradores')
      .insert(mapped)
      .select()
      .single();
    if (error) throw error;
    return { ...data, funcao: data.cargo, valor_diaria: Number(data.valor_base ?? 0) };
  }

  async update(id: string, payload: Record<string, any>) {
    const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
    if (payload.nome !== undefined)      mapped.nome = payload.nome;
    if (payload.cpf !== undefined)       mapped.cpf = payload.cpf;
    if (payload.telefone !== undefined)  mapped.telefone = payload.telefone;
    if (payload.funcao !== undefined)    mapped.cargo = payload.funcao;
    if (payload.cargo !== undefined)     mapped.cargo = payload.cargo;
    if (payload.valor_diaria !== undefined) mapped.valor_base = payload.valor_diaria;
    if (payload.valor_base !== undefined)   mapped.valor_base = payload.valor_base;
    if (payload.status !== undefined)    mapped.status = payload.status;
    if (payload.deleted_at !== undefined) mapped.deleted_at = payload.deleted_at;
    if (payload.permitir_lancamento_operacional !== undefined)
      mapped.permitir_lancamento_operacional = payload.permitir_lancamento_operacional;

    const { data, error } = await supabase
      .from('colaboradores')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { ...data, funcao: data.cargo, valor_diaria: Number(data.valor_base ?? 0) };
  }

  async softDelete(id: string) {
    return this.update(id, { deleted_at: new Date().toISOString(), status: 'inativo' });
  }

  async toggleStatus(id: string, status: 'ativo' | 'inativo') {
    return this.update(id, { status });
  }
}
export const DiaristaService = new DiaristaServiceClass();

class LancamentoDiaristaServiceClass {
  async getByPeriodo(
    empresaId: string | null | undefined,
    inicio: string,
    fim: string,
    filtros?: {
      diarista_nome?: string;
      funcao?: string;
      status?: StatusLancamentoDiarista;
      cliente_unidade?: string;
      encarregado_id?: string;
    },
  ) {
    let query = (supabase as any)
      .from('lancamentos_diaristas')
      .select('*')
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .order('data_lancamento', { ascending: false })
      .order('nome_colaborador', { ascending: true });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    if (filtros?.status) query = query.eq('status', filtros.status);
    if (filtros?.funcao) query = query.eq('funcao_colaborador', filtros.funcao);
    if (filtros?.encarregado_id) query = query.eq('encarregado_id', filtros.encarregado_id);
    if (filtros?.cliente_unidade) query = query.ilike('cliente_unidade', `%${filtros.cliente_unidade}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getByData(empresaId: string, data: string) {
    const { data: result, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select(`*`)
      .eq('empresa_id', empresaId)
      .eq('data_lancamento', data);

    if (error) throw error;
    return result ?? [];
  }

  async createBatch(registros: LancamentoDiaristaPayload[]) {
    if (registros.length === 0) return [];

    const tenantId = await getCurrentTenantId();

    // Remove campos que podem não existir na tabela (tipo_lancamento é apenas local)
    const payload = registros.map(({ ...r }) => {
      const p: Record<string, unknown> = { ...r, tenant_id: tenantId };
      delete p['tipo_lancamento'];
      return p;
    });

    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .insert(payload)
      .select('id, nome_colaborador, data_lancamento');

    if (error) throw error;
    return data ?? [];
  }
}
export const LancamentoDiaristaService = new LancamentoDiaristaServiceClass();

class LoteFechamentoDiaristaServiceClass extends BaseService<'diaristas_lotes_fechamento'> {
  constructor() {
    super('diaristas_lotes_fechamento');
  }

  async getLotes(empresaId: string, mes: string) {
    const { data, error } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('mes_referencia', mes);
    if (error) throw error;
    return data;
  }

  async fecharPeriodo({ empresaId, periodoInicio, periodoFim, fechadoPor, fechadoPorNome, observacoes }: {
    empresaId: string;
    periodoInicio: string;
    periodoFim: string;
    fechadoPor: string;
    fechadoPorNome: string;
    observacoes?: string;
  }) {
    const { data: lancamentos, error: errorLanc } = await this.supabase
      .from('lancamentos_diaristas')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('data_lancamento', periodoInicio)
      .lte('data_lancamento', periodoFim)
      .eq('status', 'em_aberto');

    if (errorLanc) throw errorLanc;

    const diaristasMap = new Map();
    let totalRegistros = 0;
    let valorTotal = 0;

    (lancamentos || []).forEach((l: any) => {
      const key = l.diarista_id;
      if (!diaristasMap.has(key)) {
        diaristasMap.set(key, {
          diarista_id: key,
          nome_colaborador: l.nome_colaborador || 'Diarista',
          cpf: l.cpf_colaborador ?? null,
          banco: null,
          agencia: null,
          conta: null,
          quantidade_dias: 0,
          valor_dia: l.valor_diaria_base || 0,
          valor_final: 0,
        });
      }
      const entry = diaristasMap.get(key);
      entry.quantidade_dias += l.quantidade_diaria ?? 1;
      entry.valor_final += l.valor_calculado ?? 0;
      totalRegistros += 1;
      valorTotal += l.valor_calculado ?? 0;
    });

    const mesRef = periodoInicio.substring(0, 7);

    const tenantId = await getCurrentTenantId();
    const { data: lote, error: errorLote } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .insert({
        empresa_id: empresaId,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        mes_referencia: mesRef,
        total_registros: totalRegistros,
        valor_total: valorTotal,
        status: 'fechado_para_pagamento',
        fechado_por: fechadoPor,
        fechado_por_nome: fechadoPorNome,
        fechado_em: new Date().toISOString(),
        observacoes,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (errorLote) throw errorLote;

    await this.supabase
      .from('lancamentos_diaristas')
      .update({ status: 'fechado_para_pagamento', lote_fechamento_id: lote.id })
      .eq('empresa_id', empresaId)
      .gte('data_lancamento', periodoInicio)
      .lte('data_lancamento', periodoFim)
      .eq('status', 'em_aberto');

    return {
      ...lote,
      total_registros: totalRegistros,
      valor_total: valorTotal,
    };
  }
}
export const LoteFechamentoDiaristaService = new LoteFechamentoDiaristaServiceClass();

// ==================================================
// TIPOS PARA REGRAS DINÂMICAS
// ==================================================

export interface RegraModulo {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  ativo: boolean;
  module_type?: 'system_fixed' | 'dynamic_custom' | 'financial' | 'tax' | 'rh' | 'operational';
}

export interface RegraCampo {
  id: number;
  modulo_id: number;
  nome: string;
  tipo: string; // text, number, select, boolean, date
  obrigatorio: boolean;
  ordem?: number;
  opcoes_json?: string;
}

export interface RegraDado {
  id: number;
  modulo_id: number;
  dados: any; // JSONB
}

// ==================================================
// SERVIÇOS PARA REGRAS DINÂMICAS
// ==================================================

class RegrasModulosServiceClass {
  private readonly table = 'regras_modulos';

  async listar(): Promise<RegraModulo[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data as RegraModulo[];
  }

  async buscarPorId(id: number): Promise<RegraModulo | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as RegraModulo | null;
  }

  async criar(data: Omit<RegraModulo, 'id' | 'ativo'>): Promise<RegraModulo> {
    const tenantId = await getCurrentTenantId();
    const { data: result, error } = await supabase
      .from(this.table)
      .insert({ ...data, ativo: true, tenant_id: tenantId })
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraModulo;
  }

  async atualizar(id: number, data: Partial<Omit<RegraModulo, 'id' | 'ativo'>>): Promise<RegraModulo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraModulo;
  }

  async inativar(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ ativo: false })
      .eq('id', id);
    if (error) throw error;
  }

  async excluir(id: number): Promise<void> {
    const { error: deleteDadosError } = await supabase
      .from('regras_dados')
      .delete()
      .eq('modulo_id', id);
    if (deleteDadosError) throw deleteDadosError;

    const { error: deleteCamposError } = await supabase
      .from('regras_campos')
      .delete()
      .eq('modulo_id', id);
    if (deleteCamposError) throw deleteCamposError;

    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasModulosService = new RegrasModulosServiceClass();

class RegrasCamposServiceClass {
  private readonly table = 'regras_campos';

  async listarPorModulo(moduloId: number): Promise<RegraCampo[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('modulo_id', moduloId)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return data as RegraCampo[];
  }

  async criar(data: Omit<RegraCampo, 'id'>): Promise<RegraCampo> {
    const tenantId = await getCurrentTenantId();
    const { data: result, error } = await supabase
      .from(this.table)
      .insert({ ...data, tenant_id: tenantId })
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraCampo;
  }

  async atualizar(id: number, data: Partial<RegraCampo>): Promise<RegraCampo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraCampo;
  }

  async excluir(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasCamposService = new RegrasCamposServiceClass();

class RegrasDadosServiceClass {
  private readonly table = 'regras_dados';

  async listarPorModulo(moduloId: number): Promise<RegraDado[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('modulo_id', moduloId);
    if (error) throw error;
    return data as RegraDado[];
  }

  async criar(data: Omit<RegraDado, 'id'>): Promise<RegraDado> {
    const tenantId = await getCurrentTenantId();
    const { data: result, error } = await supabase
      .from(this.table)
      .insert({ ...data, tenant_id: tenantId })
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraDado;
  }

  async atualizar(id: number, data: Partial<RegraDado>): Promise<RegraDado> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraDado;
  }

  async buscarPorModalidadeEForma(modalidadeFinanceira: string, formaPagamento: string): Promise<RegraDado | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select('dados')
      .contains('dados', { modalidade_financeira: modalidadeFinanceira, forma_pagamento: formaPagamento })
      .limit(1)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data as RegraDado | null;
  }

  async excluir(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasDadosService = new RegrasDadosServiceClass();

// ==================================================
// MÓDULO REGRAS DE MARCAÇÃO DE DIARISTAS
// ==================================================

export interface RegraMarcacaoDiaristaPayload {
  empresa_id: string | null;
  codigo: string;
  descricao: string;
  multiplicador: number;
  ativo: boolean;
}

class RegraMarcacaoDiaristaServiceClass {
  async getAll() {
    // RLS garante isolamento por tenant_id automaticamente.
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .select('*, empresas:empresa_id(nome)')
      .order('codigo', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getByEmpresa(empresaId?: string | null) {
    let query = supabase
      .from('regras_marcacao_diaristas' as any)
      .select('*, empresas:empresa_id(nome)')
      .eq('ativo', true)
      .order('codigo', { ascending: true });

    if (empresaId) {
      query = query.or(`empresa_id.is.null,empresa_id.eq.${empresaId}`);
    } else {
      query = query.is('empresa_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const regras = data ?? [];
    const regrasPorCodigo = new Map<string, any>();

    regras.forEach((regra: any) => {
      const codigo = String(regra.codigo ?? '').trim().toUpperCase();
      const existente = regrasPorCodigo.get(codigo);

      if (!existente) {
        regrasPorCodigo.set(codigo, regra);
        return;
      }

      const regraAtualEhEspecifica = regra.empresa_id === empresaId;
      const existenteEhEspecifica = existente.empresa_id === empresaId;

      if (regraAtualEhEspecifica && !existenteEhEspecifica) {
        regrasPorCodigo.set(codigo, regra);
      }
    });

    return Array.from(regrasPorCodigo.values()).sort((a: any, b: any) =>
      String(a.codigo ?? '').localeCompare(String(b.codigo ?? '')),
    );
  }

  async create(payload: RegraMarcacaoDiaristaPayload) {
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .insert(payload)
      .select('*, empresas:empresa_id(nome)')
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Partial<RegraMarcacaoDiaristaPayload>) {
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .update(payload)
      .eq('id', id)
      .select('*, empresas:empresa_id(nome)')
      .single();
    if (error) throw error;
    return data;
  }
}

export const RegraMarcacaoDiaristaService = new RegraMarcacaoDiaristaServiceClass();

// SERVIÇO DE CICLOS DE DIARISTAS
class DiaristaCicloServiceClass {
  async getRegraFechamento() {
    const { data, error } = await supabase
      .from('regras_fechamento')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateRegraFechamento(id: string, payload: any) {
    const { data, error } = await supabase
      .from('regras_fechamento')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getCicloAtual() {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .eq('status', 'aberto')
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getCiclos(limit = 10) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async getCicloById(id: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async criarCiclo(dataInicio: string, dataFim: string, regraId?: string) {
    const regra = regraId ? { regra_fechamento_id: regraId } : {};
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .insert({
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'aberto',
        ...regra
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async criarCicloSemanal(diaFechamento: number) {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diasAteSexta = (5 - diaSemana + 7) % 7 || 7;
    
    const dataFim = new Date(hoje);
    dataFim.setDate(hoje.getDate() + diasAteSexta);
    
    const dataInicio = new Date(dataFim);
    dataInicio.setDate(dataFim.getDate() - 6);

    return this.criarCiclo(
      dataInicio.toISOString().split('T')[0],
      dataFim.toISOString().split('T')[0]
    );
  }

  async fecharCiclo(id: string, userId: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .update({
        status: 'fechado',
        fechado_por: userId,
        fechado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async enviarFinanceiro(id: string, userId: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .update({
        status: 'enviado',
        enviado_por: userId,
        enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getLotes() {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .select('*, ciclos:ciclo_id(data_inicio, data_fim)')
      .order('gerado_em', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getLoteByCiclo(cicloId: string) {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .select('*, itens:lote_pagamento_itens(*)')
      .eq('ciclo_id', cicloId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async criarLote(cicloId: string, userId: string, itens: any[]) {
    const valorTotal = itens.reduce((sum, item) => sum + Number(item.valor_final || 0), 0);

    const { data: lote, error: errorLote } = await supabase
      .from('lote_pagamento_diaristas')
      .insert({
        ciclo_id: cicloId,
        quantidade_diaristas: itens.length,
        valor_total: valorTotal,
        status: 'pendente',
        gerado_por: userId,
        gerado_em: new Date().toISOString()
      })
      .select()
      .single();
    if (errorLote) throw errorLote;

    const itensComLote = itens.map(item => ({
      ...item,
      lote_id: lote.id
    }));

    const { error: errorItens } = await supabase
      .from('lote_pagamento_itens')
      .insert(itensComLote);
    if (errorItens) throw errorItens;

    await supabase
      .from('ciclos_diaristas')
      .update({ valor_total: valorTotal, diaristas_count: itens.length })
      .eq('id', cicloId);

    return this.getLoteByCiclo(cicloId);
  }

  async marcarEnviadoFinanceiro(loteId: string) {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .update({
        enviado_financeiro: true,
        enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', loteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async adicionarLancamento(cicloId: string, colaboradorId: string, tipo: string, valor: number, motivo: string, userId: string) {
    const { data, error } = await supabase
      .from('lancamentos_adicionais_diaristas')
      .insert({
        ciclo_id: cicloId,
        colaborador_id: colaboradorId,
        tipo,
        valor,
        motivo,
        criado_por: userId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getLancamentosByCiclo(cicloId: string) {
    const { data, error } = await supabase
      .from('lancamentos_adicionais_diaristas')
      .select('*')
      .eq('ciclo_id', cicloId);
    if (error) throw error;
    return data ?? [];
  }

  async verificarFechamentoAutomatico() {
    const regra = await this.getRegraFechamento();
    if (!regra || !regra.auto_fechar) return null;

    const hoje = new Date();
    const diaSemana = hoje.getDay();

    if (diaSemana !== regra.dia_fechamento) return null;

    const cicloAberto = await this.getCicloAtual();
    if (!cicloAberto) return null;

    return { cicloId: cicloAberto.id, regra };
  }
}

export const DiaristaCicloService = new DiaristaCicloServiceClass();
// @ts-ignore
class FormasPagamentoServiceClass extends BaseService<any> {
  constructor() { super('formas_pagamento'); }
}
export const FormasPagamentoService = new FormasPagamentoServiceClass();

// @ts-ignore
class TaxasImpostosServiceClass extends BaseService<any> {
  constructor() { super('taxas_impostos'); }
}
export const TaxasImpostosService = new TaxasImpostosServiceClass();

