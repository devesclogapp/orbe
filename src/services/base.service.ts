import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Table = keyof Database['public']['Tables'];

// SERVIÇO GENÉRICO DE CRUD
export class BaseService<T extends Table> {
  public supabase = supabase;
  constructor(protected table: T) {}

  async getAll() {
    const { data, error } = await supabase.from(this.table).select('*');
    if (error) throw error;
    return data;
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

  async delete(id: string) {
    const { error } = await supabase.from(this.table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

// SERVIÇOS ESPECÍFICOS
class EmpresaServiceClass extends BaseService<'empresas'> {
  constructor() { super('empresas'); }

  async getWithCounts() {
    const { data, error } = await supabase
      .from('empresas')
      .select(`
        *,
        colaboradores:colaboradores(count),
        coletores:coletores(count)
      `);
    if (error) throw error;
    
    return data.map(item => ({
      ...item,
      total_colaboradores: (item.colaboradores as any)?.[0]?.count || 0,
      total_coletores: (item.coletores as any)?.[0]?.count || 0
    }));
  }
}
export const EmpresaService = new EmpresaServiceClass();

class ColaboradorServiceClass extends BaseService<'colaboradores'> {
  constructor() { super('colaboradores'); }

  async getWithEmpresa() {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*, empresas(nome, cidade, estado)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const ColaboradorService = new ColaboradorServiceClass();

class ColetorServiceClass extends BaseService<'coletores'> {
  constructor() { super('coletores'); }
  async getWithEmpresa() {
    const { data, error } = await supabase.from('coletores').select('*, empresas(nome)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const ColetorService = new ColetorServiceClass();

class LogSincronizacaoServiceClass extends BaseService<'logs_sincronizacao'> {
  constructor() { super('logs_sincronizacao'); }
  async getWithEmpresa() {
    const { data, error } = await supabase.from('logs_sincronizacao').select('*, empresas(nome)').order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const LogSincronizacaoService = new LogSincronizacaoServiceClass();

class ResultadosServiceClass extends BaseService<'resultados_processamento'> {
  constructor() { super('resultados_processamento'); }
  async getSummary() {
    const { data, error } = await supabase.from('resultados_processamento').select('*, empresas(nome)').order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const ResultadosService = new ResultadosServiceClass();

class OperacaoServiceClass extends BaseService<'operacoes'> {
  constructor() { super('operacoes'); }
  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);
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
    return data;
  }
}
export const OperacaoService = new OperacaoServiceClass();

class PontoServiceClass extends BaseService<'registros_ponto'> {
  constructor() { super('registros_ponto'); }
  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);
    if (error) throw error;
    return data;
  }
  async getByCollaborator(collabId: string) {
    const { data, error } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', collabId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const PontoService = new PontoServiceClass();

class ClienteServiceClass extends BaseService<'clientes'> {
  constructor() { super('clientes'); }
}
export const ClienteService = new ClienteServiceClass();

class RegraCalculoServiceClass extends BaseService<'financeiro_regras'> {
  constructor() { super('financeiro_regras'); }
  async getByCliente(clienteId: string) {
    const { data, error } = await supabase.from('financeiro_regras').select('*').eq('cliente_id', clienteId).eq('status', 'ativo');
    if (error) throw error;
    return data;
  }
}
export const RegraCalculoService = new RegraCalculoServiceClass();

class CompetenciaServiceClass extends BaseService<'financeiro_competencias'> {
  constructor() { super('financeiro_competencias'); }
  async getAtual() {
    const firstDay = new Date();
    firstDay.setDate(1);
    const dateStr = firstDay.toISOString().split('T')[0];
    
    const { data, error } = await supabase.from('financeiro_competencias').select('*').eq('competencia', dateStr).maybeSingle();
    if (error) throw error;
    return data;
  }
}
export const CompetenciaService = new CompetenciaServiceClass();

class ConsolidadoServiceClass {
  async getByCompetencia(competencia: string) {
    const { data: clientes, error: errC } = await supabase.from('financeiro_consolidados_cliente').select('*, clientes(nome)').eq('competencia', competencia);
    const { data: colaboradores, error: errCol } = await supabase.from('financeiro_consolidados_colaborador').select('*, colaboradores(nome, cargo)').eq('competencia', competencia);
    
    if (errC || errCol) throw errC || errCol;
    return { clientes, colaboradores };
  }
}
export const ConsolidadoService = new ConsolidadoServiceClass();

// STORAGE SERVICE
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

// AI SERVICE & EDGE FUNCTIONS
export const AIService = {
  async processDay(data: string, empresaId: string) {
    const { data: res, error } = await supabase.functions.invoke('process-day', {
      body: { data_processamento: data, empresa_id: empresaId }
    });
    if (error) throw error;
    return res;
  }
};
