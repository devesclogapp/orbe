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
          operacoes_producao(
            servicos:servico_id (nome),
            produtos:produto_id (nome)
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
        empresas:empresa_id(nome),
        receitas_operacionais_itens(
          id, valor_item,
          operacoes_producao(
            id, data_operacao, quantidade, status, horario_inicio, horario_fim, observacao,
            produtos:produto_id (nome),
            servicos:servico_id (nome),
            fornecedores:fornecedor_id (nome_fantasia, razao_social),
            transportadoras:transportadora_id (nome_fantasia, razao_social),
            formas_pagamento_operacional:forma_pagamento_id (nome)
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

  async logEvent(tenantId: string, receitaId: string, acao: string, detalhesText: string, detalhesJson?: any) {
    const { data, error } = await supabase
      .from('receitas_operacionais_historico')
      .insert({
         tenant_id: tenantId,
         receita_id: receitaId,
         acao: acao,
         descricao: detalhesText, // Assumindo que a view ou log frontend interprete isso, passaremos como detalhes no json tbm pra ser seguro
         detalhes: { texto: detalhesText, ...detalhesJson }
      });
    
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

      await supabase
        .from('receitas_operacionais_historico')
        .insert({
           tenant_id: tenantId,
           receita_id: receitaId,
           status_anterior: atual?.status,
           status_novo: newStatus,
           acao: 'Alteração de Status via Painel',
        });
      
      return updated;
  }
}

export const ReceitasService = new ReceitasServiceClass();
