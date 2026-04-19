import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

class BHRegraServiceClass extends BaseService<'banco_horas_regras'> {
  constructor() { super('banco_horas_regras'); }

  async getWithEmpresa() {
    const { data, error } = await supabase
      .from('banco_horas_regras')
      .select('*, empresas(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const BHRegraService = new BHRegraServiceClass();

class BHEventoServiceClass extends BaseService<'banco_horas_eventos'> {
  constructor() { super('banco_horas_eventos'); }

  async getByColaborador(collabId: string) {
    const { data, error } = await supabase
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', collabId)
      .order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getSaldosGerais() {
    // Em um sistema real, isso seria uma view ou função RPC para eficiência.
    // Para o MVP V4, vamos simular ou buscar dados agregados.
    const { data, error } = await supabase
      .from('colaboradores')
      .select(`
        id, 
        nome, 
        matricula,
        empresas(nome),
        banco_horas_eventos(quantidade_minutos)
      `);
    
    if (error) throw error;

    return data.map(c => {
      const eventos = (c.banco_horas_eventos as any[]) || [];
      const saldoMinutos = eventos.reduce((acc, curr) => acc + (curr.quantidade_minutos || 0), 0);
      
      return {
        id: c.id,
        nome: c.nome,
        matricula: c.matricula,
        empresa: (c.empresas as any)?.nome,
        saldo_minutos: saldoMinutos,
        saldo_formatado: this.formatMinutes(saldoMinutos),
        status: saldoMinutos < 0 ? 'crítico' : saldoMinutos === 0 ? 'ok' : 'positivo'
      };
    });
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
}
export const UserProfileService = new UserProfileServiceClass();

class AuditoriaServiceClass extends BaseService<'auditoria'> {
  constructor() { super('auditoria'); }

  async log(acao: string, modulo: string, impacto: 'baixo' | 'medio' | 'critico', detalhes?: any) {
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
