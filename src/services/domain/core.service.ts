import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getTransportadoraDuplicateMessage, getTransportadoraErrorMessage } from '@/utils/transportadoraValidation';
import {
  gerarCNAB240BB,
  downloadCNAB240,
  validarBeneficiarios,
  type EmpresaRemessa,
  type BeneficiarioPagamento,
} from '../cnab/cnab240-posicional';
import { CnabRemessaArquivoService } from '../cnab/cnabRemessaArquivo.service';



type Table = keyof Database['public']['Tables'];

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

function normalizeCpfDigits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '').trim();
}

function hasDadosBancariosMinimosColaborador(payload: Record<string, any>) {
  const tipoColaborador = String(payload.tipo_colaborador ?? '').trim().toUpperCase();
  if (tipoColaborador === 'DIARISTA') {
    return true;
  }

  const nomeBancario = String(payload.nome_completo ?? '').trim();
  const bancoCodigo = String(payload.banco_codigo ?? '').trim();
  const agencia = String(payload.agencia ?? '').trim();
  const agenciaDigito = String(payload.agencia_digito ?? '').trim();
  const conta = String(payload.conta ?? '').trim();
  const contaDigito = String(payload.conta_digito ?? payload.digito_conta ?? '').trim();
  const tipoConta = String(payload.tipo_conta ?? '').trim();

  return Boolean(
    nomeBancario &&
    bancoCodigo &&
    agencia &&
    agenciaDigito &&
    conta &&
    contaDigito &&
    tipoConta
  );
}

export function hasComplementoMinimoColaborador(payload: Record<string, any>) {
  const cpf = normalizeCpfDigits(payload.cpf);
  const telefone = String(payload.telefone ?? '').replace(/\D/g, '').trim();
  const matricula = String(payload.matricula ?? '').trim();
  const empresaId = cleanUuid(payload.empresa_id);
  const cargo = String(payload.cargo ?? '').trim();

  return Boolean(cpf && telefone && matricula && empresaId && cargo) && hasDadosBancariosMinimosColaborador(payload);
}

export function inferRegimeTrabalho(tipoColaborador?: string | null): string {
  const tipo = String(tipoColaborador ?? "").trim().toUpperCase();
  if (tipo === "CLT") return "CLT";
  if (tipo === "INTERMITENTE") return "Intermitente";
  if (tipo === "DIARISTA") return "Diarista";
  if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Freelancer";
  if (tipo === "TERCEIRIZADO") return "Terceirizado";
  return "CLT";
}

export function inferModeloCalculo(tipoColaborador?: string | null): string {
  const tipo = String(tipoColaborador ?? "").trim().toUpperCase();
  if (tipo === "CLT") return "Mensal";
  if (tipo === "DIARISTA") return "Diária";
  if (tipo === "PRODUÇÃO" || tipo === "PRODUCAO") return "Produção";
  if (tipo === "INTERMITENTE") return "Horista";
  if (tipo === "TERCEIRIZADO") return "Produção";
  return "Mensal";
}

// Função helper para obter tenant_id de forma segura
export function normalizeContratoToken(value?: string | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

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
    const cleanPayload = sanitizePayload(payload) as Database['public']['Tables'][T]['Insert'];
    const { data, error } = await supabase.from(this.table).insert(cleanPayload).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database['public']['Tables'][T]['Update']) {
    const cleanPayload = sanitizePayload(payload) as Database['public']['Tables'][T]['Update'];
    const { data, error } = await supabase.from(this.table).update(cleanPayload).eq('id', id).select().single();
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

  private normalizePainelToken(value: unknown) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private buildPainelDedupKey(item: any) {
    const data = item.data_operacao ?? item.data_referencia ?? item.data ?? '';
    const empresa = item.empresa_id ?? '';
    const tipoServico = this.normalizePainelToken(item.tipo_servico_label ?? item.tipo_servico ?? '');
    const transportadora = this.normalizePainelToken(item.transportadora_label ?? item.transportadora ?? '');
    const fornecedor = this.normalizePainelToken(item.fornecedores?.nome ?? item.fornecedor?.nome ?? '');
    const produto = this.normalizePainelToken(item.produto_label ?? item.produto ?? '');
    const quantidade = Number(item.quantidade ?? item.quantidade_label ?? 0);
    const placa = this.normalizePainelToken(item.placa ?? '');

    return [data, empresa, tipoServico, transportadora, fornecedor, produto, quantidade, placa].join('|');
  }

  private mergePainelOperacoes(producaoNormalizada: any[], legadasNormalizadas: any[]) {
    const dedupKeysProducao = new Set(producaoNormalizada.map((item) => this.buildPainelDedupKey(item)));
    const legadasFiltradas = legadasNormalizadas.filter((item) => !dedupKeysProducao.has(this.buildPainelDedupKey(item)));

    return [...producaoNormalizada, ...legadasFiltradas].sort((a: any, b: any) => {
      const aTime = new Date(a.criado_em_label ?? `${a.data_referencia}T${a.horario_inicio_label ?? '00:00:00'}`).getTime();
      const bTime = new Date(b.criado_em_label ?? `${b.data_referencia}T${b.horario_inicio_label ?? '00:00:00'}`).getTime();
      return bTime - aTime;
    });
  }

  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  private isIgnorableLegacyOperacoesError(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined) {
    if (!error) return false;

    const errorCode = String(error.code ?? "");
    const rawMessage = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

    return (
      ["PGRST200", "PGRST201", "PGRST202", "PGRST205", "42P01"].includes(errorCode) ||
      rawMessage.includes("operacoes") ||
      rawMessage.includes("colaboradores") ||
      rawMessage.includes("relationship") ||
      rawMessage.includes("not found") ||
      rawMessage.includes("does not exist")
    );
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

    if (operacoesLegadasRes.error && !this.isIgnorableLegacyOperacoesError(operacoesLegadasRes.error)) {
      throw operacoesLegadasRes.error;
    }

    const operacoesLegadas = operacoesLegadasRes.error ? [] : (operacoesLegadasRes.data ?? []);
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
      percentual_iss: item.percentual_iss != null ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga != null ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss != null ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme != null ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme != null ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme != null ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf != null ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
      // ─── Campos normalizados para exibição consistente ───
      forma_pagamento_label: item.formas_pagamento_operacional?.nome ?? item.forma_pagamento_snapshot ?? null,
      forma_pagamento_snapshot: item.forma_pagamento_snapshot ?? item.formas_pagamento_operacional?.nome ?? null,
      observacao: item.observacao ?? (item.avaliacao_json?.contexto_importacao as any)?.observacao ?? null,
      encarregado_label: item.responsavel_nome ?? null,
      data_vencimento: item.data_vencimento ?? (item.avaliacao_json?.contexto_importacao as any)?.data_vencimento_override ?? null,
      empresa_label: item.empresas?.nome ?? null,
      unidade_label: item.unidades?.nome ?? null,
    }));

    return this.mergePainelOperacoes(producaoNormalizada, legadasNormalizadas);
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
      percentual_iss: item.percentual_iss != null ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga != null ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss != null ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme != null ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme != null ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme != null ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf != null ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
    }));

    return this.mergePainelOperacoes(producaoNormalizada, legadasNormalizadas);
  }
}
export const OperacaoService = new OperacaoServiceClass();

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

class HistoricoImportacaoServiceClass extends BaseService<'historico_importacoes'> {
  constructor() { super('historico_importacoes'); }

  async getRecent(options: { 
    empresaId?: string, 
    status?: string, 
    origem?: string, 
    coletorId?: string,
    startDate?: string,
    endDate?: string,
    limit?: number 
  } = {}) {
    // IMPORTANTE: Não usar joins relacionais automáticos (PostgREST) aqui.
    // - 'coletores(nome)' falha com 400: a coluna se chama 'nome_coletor', não 'nome'.
    // - 'unidades_operacionais(nome)' pode falhar se o PostgREST não reconhecer a FK.
    // Solução: select simples + lookup paralelo de empresas/coletores.
    let query = supabase
      .from('historico_importacoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.empresaId && options.empresaId !== 'all') {
      query = query.eq('empresa_id', options.empresaId);
    }
    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }
    if (options.origem && options.origem !== 'all') {
      query = query.eq('origem', options.origem);
    }
    if (options.coletorId && options.coletorId !== 'all') {
      query = query.eq('coletor_id', options.coletorId);
    }
    if (options.startDate) {
      query = query.gte('created_at', `${options.startDate}T00:00:00`);
    }
    if (options.endDate) {
      query = query.lte('created_at', `${options.endDate}T23:59:59`);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[HistoricoImportacaoService.getRecent] Falha na query principal', {
        options,
        error,
      });
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Lookup paralelo: empresas e coletores (separado para evitar join problemático)
    const empresaIds = [...new Set(data.map((r: any) => r.empresa_id).filter(Boolean))];
    const coletorIds = [...new Set(data.map((r: any) => r.coletor_id).filter(Boolean))];
    const unidadeIds = [...new Set(data.map((r: any) => r.unidade_id).filter(Boolean))];

    const [empresasRes, coletoresRes, unidadesRes] = await Promise.allSettled([
      empresaIds.length > 0
        ? supabase.from('empresas').select('id, nome').in('id', empresaIds)
        : Promise.resolve({ data: [] }),
      coletorIds.length > 0
        ? supabase.from('coletores').select('id, nome_coletor').in('id', coletorIds)
        : Promise.resolve({ data: [] }),
      unidadeIds.length > 0
        ? supabase.from('unidades_operacionais').select('id, nome').in('id', unidadeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const empresaMap = new Map(
      (empresasRes.status === 'fulfilled' ? (empresasRes.value as any).data ?? [] : [])
        .map((e: any) => [e.id, e])
    );
    const coletorMap = new Map(
      (coletoresRes.status === 'fulfilled' ? (coletoresRes.value as any).data ?? [] : [])
        .map((c: any) => [c.id, c])
    );
    const unidadeMap = new Map(
      (unidadesRes.status === 'fulfilled' ? (unidadesRes.value as any).data ?? [] : [])
        .map((u: any) => [u.id, u])
    );

    // Enriquecer registros com dados relacionais
    return data.map((row: any) => ({
      ...row,
      empresas: row.empresa_id ? (empresaMap.get(row.empresa_id) ?? null) : null,
      unidades_operacionais: row.unidade_id ? (unidadeMap.get(row.unidade_id) ?? null) : null,
      coletores: row.coletor_id
        ? (() => {
            const c = coletorMap.get(row.coletor_id);
            return c ? { ...c, nome: c.nome_coletor } : null;
          })()
        : null,
    }));
  }

  async reprocess(importacaoId: string, motivo: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).functions.invoke('importar-pontos-google-drive', {
      body: { 
        parent_importacao_id: importacaoId, 
        reprocessado_motivo: motivo,
        reprocessado_por: user?.id
      },
    });
    if (error) throw error;
    return data;
  }
}
export const HistoricoImportacaoService = new HistoricoImportacaoServiceClass();

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

export interface EncarregadoColaboradorFiltroConfig {
  ativo?: boolean;
  sem_equipe?: boolean;
  campo_filtro?: 'tipo_colaborador' | 'tipo_contrato';
  valores_filtro?: string[];
  filtrar_por_empresa?: boolean;
  somente_ativos?: boolean;
  somente_cadastro_completo?: boolean;
  excluir_cadastro_provisorio?: boolean;
  tipos_colaborador_permitidos?: string[];
  regimes_trabalho_permitidos?: string[];
  modelos_calculo_permitidos?: string[];
  tipos_contrato_permitidos?: string[];
  exigir_permitir_lancamento_operacional?: boolean;
}

// ==================================================
// SERVIÇOS OPERACIONAIS V2 (/producao)
// ==================================================
export const operationalClient: any = supabase;

class UnidadeOperacionalServiceClass {
  async getByEmpresa(empresaId: string) {
    if (!empresaId) return [];

    // Consulta ambas as tabelas para cobrir unidades criadas por qualquer fluxo.
    // 'unidades_operacionais' é a FK oficial dos coletores.
    // 'unidades' é a tabela legada usada em outros módulos.
    const [resNova, resLegada] = await Promise.allSettled([
      operationalClient
        .from('unidades_operacionais')
        .select('id, nome, codigo, status')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true }),
      operationalClient
        .from('unidades')
        .select('id, nome, status')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true }),
    ]);

    const nova: any[] = resNova.status === 'fulfilled' && !resNova.value.error
      ? (resNova.value.data ?? [])
      : [];

    const legada: any[] = resLegada.status === 'fulfilled' && !resLegada.value.error
      ? (resLegada.value.data ?? [])
      : [];

    // Deduplicar por id
    const seen = new Set(nova.map((u: any) => u.id));
    const merged = [...nova, ...legada.filter((u: any) => !seen.has(u.id))];
    return merged;
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
export type StatusLancamentoDiarista = 'EM_ABERTO' | 'AGUARDANDO_VALIDACAO_RH' | 'VALIDADO_RH' | 'FECHADO_FINANCEIRO' | 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO';

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
  unidade_id?: string | null;
  local_id?: string | null;
  operacao_servico?: string | null;
  encarregado_id?: string | null;
  encarregado_nome?: string | null;
  observacao?: string | null;
  editado_admin?: boolean;
  editado_por?: string;
  editado_em?: string;
  motivo_edicao?: string;
}

class DiaristaServiceClass {
  async getByEmpresa(empresaId: string, apenasAtivos = true) {
    let query = supabase
      .from('colaboradores')
      .select('id, nome, matricula, cpf, telefone, cargo, valor_base, status, empresa_id, permitir_lancamento_operacional, deleted_at, banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta, chave_pix, nome_completo, observacoes')
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
      // Indica se possui dados bancários completos para CNAB
      tem_dados_bancarios: !!(c.banco_codigo && c.agencia && c.conta && c.digito_conta && c.cpf),
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
      // Dados bancários
      banco_codigo:   payload.banco_codigo?.trim()   || null,
      agencia:        payload.agencia?.trim()         || null,
      agencia_digito: payload.agencia_digito?.trim()  || null,
      conta:          payload.conta?.trim()           || null,
      digito_conta:   payload.digito_conta?.trim()    || null,
      tipo_conta:     payload.tipo_conta              || 'corrente',
      chave_pix:      payload.chave_pix?.trim()       || null,
      nome_completo:  payload.nome_completo?.trim()   || null,
      observacoes:    payload.observacoes?.trim()      || null,
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
    // Dados bancários
    if (payload.banco_codigo !== undefined)   mapped.banco_codigo   = payload.banco_codigo?.trim()   || null;
    if (payload.agencia !== undefined)        mapped.agencia        = payload.agencia?.trim()         || null;
    if (payload.agencia_digito !== undefined) mapped.agencia_digito = payload.agencia_digito?.trim()  || null;
    if (payload.conta !== undefined)          mapped.conta          = payload.conta?.trim()           || null;
    if (payload.digito_conta !== undefined)   mapped.digito_conta   = payload.digito_conta?.trim()    || null;
    if (payload.tipo_conta !== undefined)     mapped.tipo_conta     = payload.tipo_conta              || 'corrente';
    if (payload.chave_pix !== undefined)      mapped.chave_pix      = payload.chave_pix?.trim()       || null;
    if (payload.nome_completo !== undefined)  mapped.nome_completo  = payload.nome_completo?.trim()   || null;
    if (payload.observacoes !== undefined)    mapped.observacoes    = payload.observacoes?.trim()     || null;

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

// ==================================================
// TIPOS PARA REGRAS DINMICAS
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
// SERVIÇOS PARA REGRAS DINMICAS
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