/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';

class ReportServiceClass extends BaseService<'relatorios_catalogo'> {
  constructor() {
    super('relatorios_catalogo');
  }

  async getFavorites(userId: string) {
    const { data, error } = await supabase
      .from('relatorios_favoritos')
      .select('*, relatorios_catalogo(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  }

  async toggleFavorite(userId: string, reportId: string) {
    const { data: existing } = await supabase
      .from('relatorios_favoritos')
      .select('id')
      .eq('user_id', userId)
      .eq('relatorio_id', reportId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('relatorios_favoritos').delete().eq('id', existing.id);
      if (error) throw error;
      return false;
    } else {
      const { error } = await supabase.from('relatorios_favoritos').insert({ user_id: userId, relatorio_id: reportId });
      if (error) throw error;
      return true;
    }
  }

  async getAgendamentos() {
    const { data, error } = await supabase
      .from('relatorios_agendamentos')
      .select('*, relatorios_catalogo(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createAgendamento(data: any) {
    const { error } = await supabase.from('relatorios_agendamentos').insert(data);
    if (error) throw error;
  }

  async updateAgendamento(id: string, data: any) {
    const { error } = await supabase.from('relatorios_agendamentos').update(data).eq('id', id);
    if (error) throw error;
  }

  async deleteAgendamento(id: string) {
    const { error } = await supabase.from('relatorios_agendamentos').delete().eq('id', id);
    if (error) throw error;
  }
}

export const ReportService = new ReportServiceClass();

class LayoutServiceClass extends BaseService<'relatorios_layouts_exportacao'> {
  constructor() {
    super('relatorios_layouts_exportacao');
  }

  async getLayouts() {
    return this.getAll();
  }
}

export const LayoutService = new LayoutServiceClass();
