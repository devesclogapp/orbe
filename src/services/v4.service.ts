import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

class BHRegraServiceClass extends BaseService<'banco_horas_regras'> {
  constructor() { super('banco_horas_regras'); }

  async getWithEmpresa() {
    const { data: regras, error } = await supabase
      .from('banco_horas_regras')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (regras || []).map(r => ({ ...r, empresas: empresaMap.get(r.empresa_id) || null }));
  }
}
export const BHRegraService = new BHRegraServiceClass();

class BHEventoServiceClass extends BaseService<'banco_horas_eventos'> {
  constructor() { super('banco_horas_eventos'); }

  async getByColaborador(collabId: string, startDate?: Date, endDate?: Date) {
    let query = supabase
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', collabId);

    if (startDate) {
      query = query.gte('data', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('data', endDate.toISOString());
    }

    const { data, error } = await query.order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getSaldosGerais() {
    // Usa a RPC get_bh_saldos_gerais que agrega na DB via view vw_bh_saldos_colaboradores
    // Isso elimina o N+1 de queries que existia antes e inclui saldo vencido e a vencer
    const { data, error } = await supabase.rpc('get_bh_saldos_gerais');
    if (error) throw error;

    return (data || []).map((row: {
      id: string;
      nome: string;
      matricula: string;
      empresa_id: string;
      empresa_nome: string;
      saldo_minutos: number;
      minutos_vencidos: number;
      minutos_a_vencer_30d: number;
      status: string;
    }) => ({
      id: row.id,
      nome: row.nome,
      matricula: row.matricula,
      empresa_id: row.empresa_id,
      empresa: row.empresa_nome,
      saldo_minutos: row.saldo_minutos,
      minutos_vencidos: row.minutos_vencidos,
      minutos_a_vencer_30d: row.minutos_a_vencer_30d,
      saldo_formatado: this.formatMinutes(row.saldo_minutos),
      vencido_formatado: this.formatMinutes(row.minutos_vencidos),
      a_vencer_formatado: this.formatMinutes(row.minutos_a_vencer_30d),
      status: row.status,
    }));
  }

  private formatMinutes(totalMinutes: number) {
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes}m`;
  }
}
export const BHEventoService = new BHEventoServiceClass();

class ProfileServiceClass extends BaseService<'perfis'> {
  constructor() { super('perfis'); }
}
export const ProfileService = new ProfileServiceClass();

class UserProfileServiceClass extends BaseService<'perfis_usuarios'> {
  constructor() { super('perfis_usuarios'); }

  async getWithDetails() {
    const { data, error } = await supabase
      .from('perfis_usuarios')
      .select('*, perfis(nome), empresas(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async manageUser(payload: any) {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: payload
    });
    if (error) {
       let errorMsg = error.message;
       // Tentar extrair o JSON real de erro do Edge Function se disponivel
       try {
         const jsonText = await error.context?.text?.();
         if (jsonText) {
             const json = JSON.parse(jsonText);
             if (json.error) errorMsg = json.error;
         }
       } catch(e) {}
       throw new Error(errorMsg);
    }
    return data;
  }
}
export const UserProfileService = new UserProfileServiceClass();

class AuditoriaServiceClass extends BaseService<'auditoria'> {
  constructor() { super('auditoria'); }

  async log(acao: string, modulo: string, impacto: 'baixo' | 'medio' | 'critico', detalhes?: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser();
    return this.create({
      acao,
      modulo,
      impacto,
      detalhes: detalhes || {},
      user_id: user?.id || null
    });
  }
}
export const AuditoriaService = new AuditoriaServiceClass();
