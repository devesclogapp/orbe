import { supabase } from '@/lib/supabase';
import { BaseService, cleanUuid, getCurrentTenantId } from '../domain/base.service';
import type { ReceitaOperacional, ReceitaOperacionalItem, ModalidadeReceita } from '@/types/receitas.types';

class ReceitasServiceClass extends BaseService<'receitas_operacionais'> {
  constructor() {
    super('receitas_operacionais');
  }

  async getPipelinePainel(tenantId: string, empresaId?: string, competencia?: string) {
    let query = supabase
      .from('receitas_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome),
        receitas_operacionais_itens(
          id,
          valor_item,
          operacoes_producao(
            id,
            servicos:tipos_servico_operacional(nome)
          )
        )
      `)
      .eq('tenant_id', tenantId);

    if (empresaId && empresaId !== 'all') {
      query = query.eq('empresa_id', empresaId);
    }
    
    if (competencia) {
      query = query.order('created_at', { ascending: false }).limit(500); 
    } else {
      query = query.order('created_at', { ascending: false }).limit(500); 
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro na query getPipelinePainel receitas:', error);
      throw error;
    }

    return data;
  }

  async getReceitaDetalhes(receitaId: string) {
    // Faz a query pesada sob demanda (lazy load)
    const { data, error } = await supabase
      .from('receitas_operacionais')
      .select(`
        *,
        empresas(nome),
        receitas_operacionais_itens(
          id, valor_item,
          operacoes_producao(
            *,
            produtos:produtos_carga (*),
            servicos:tipos_servico_operacional (*),
            fornecedores (*),
            transportadoras:transportadoras_clientes (*),
            formas_pagamento_operacional (*)
          )
        )
      `)
      .eq('id', receitaId)
      .single();

    if (error) throw error;
    return data;
  }

  async getHistorico(receitaId: string) {
    const { data, error } = await supabase
        .from('receitas_operacionais_historico')
        .select('*')
        .eq('receita_id', receitaId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async logEvent(tenantId: string, receitaId: string, acao: string, detalhesText: string, detalhesJson?: any, statusAnterior?: string, statusNovo?: string) {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    const userEmail = authData?.user?.email || 'Sistema';

    const payload: any = {
      tenant_id: tenantId,
      receita_id: receitaId,
      acao: acao,
      usuario_id: userId,
      detalhes: { texto: detalhesText, usuario_email: userEmail, ...detalhesJson }
    };

    if (statusAnterior) payload.status_anterior = statusAnterior;
    if (statusNovo) payload.status_novo = statusNovo;

    const { data, error } = await supabase
      .from('receitas_operacionais_historico')
      .insert(payload);
    
    if (error) throw error;
    return data;
  }

  async updateStatus(tenantId: string, receitaId: string, newStatus: string) {
      const { data: atual, error: errBusca } = await supabase
        .from('receitas_operacionais')
        .select('status')
        .eq('id', receitaId)
        .single();
      
      if (errBusca) throw errBusca;

      if (atual?.status === newStatus) return atual;

      const { data: updated, error: errUpdate } = await supabase
        .from('receitas_operacionais')
        .update({ status: newStatus })
        .eq('id', receitaId)
        .select()
        .single();
      
      if (errUpdate) throw errUpdate;

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const userEmail = authData?.user?.email || 'Sistema';

      await supabase
        .from('receitas_operacionais_historico')
        .insert({
           tenant_id: tenantId,
           receita_id: receitaId,
           status_anterior: atual?.status,
           status_novo: newStatus,
           acao: 'Alteração da Situação Financeira',
           usuario_id: userId,
           detalhes: { texto: 'A situação financeira da receita foi atualizada.', usuario_email: userEmail }
        });
      
      return updated;
  }

  async updateReceita(tenantId: string, receitaId: string, payload: Partial<ReceitaOperacional>) {
    const { data, error } = await supabase
      .from('receitas_operacionais')
      .update(payload)
      .eq('id', receitaId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const ReceitasService = new ReceitasServiceClass();
