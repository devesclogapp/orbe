/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseService } from './domain/base.service';
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

  async getAgendamentos(empresaId?: string) {
    let query = supabase
      .from('relatorios_agendamentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId && empresaId !== 'TODAS') {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createAgendamento(data: any) {
    const { data: inserted, error } = await supabase
      .from('relatorios_agendamentos')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  async updateAgendamento(id: string, data: any) {
    const { data: updated, error } = await supabase
      .from('relatorios_agendamentos')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
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

  async getLayouts(empresaId?: string) {
    let query = supabase
      .from('relatorios_layouts_exportacao')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId && empresaId !== 'TODAS') {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}

export const LayoutService = new LayoutServiceClass();
