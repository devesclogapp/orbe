import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Table = keyof Database['public']['Tables'];

// SERVIÇO GENÉRICO DE CRUD
export class BaseService<T extends Table> {
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
export const EmpresaService = new BaseService('empresas');
export const ColaboradorService = new BaseService('colaboradores');

export const OperacaoService = {
  ...new BaseService('operacoes'),
  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);
    if (error) throw error;
    return data;
  }
};

export const PontoService = {
  ...new BaseService('registros_ponto'),
  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);
    if (error) throw error;
    return data;
  },
  async getByCollaborator(collabId: string) {
    const { data, error } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', collabId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
};

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
