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
    // [DEPRECATION NOTICE]: Por conta do Etapa 04 - Auditoria Atômica (Domain Hardening), 
    // todas as triggers críticas e eventos nascem das próprias funções RPC.
    // Ignoramos eventlogs arbitrários oriundos do client React.
    console.warn("[SECURITY] logEvent is deprecated. Financial transitions generate logs entirely on DB via RPCs. Call suppressed: ", acao);
    return { success: true, bypassed: true };
  }

  async updateStatus(tenantId: string, receitaId: string, newStatus: string) {
      let rpcName = '';
      let rpcParams: any = { p_receita_id: receitaId };

      switch(newStatus) {
        case 'cobranca_gerada':
        case 'pendente_cobranca': // Kanban usa essa chave local 
          rpcName = 'rpc_receita_gerar_cobranca';
          break;
        case 'cobranca_enviada':
          rpcName = 'rpc_receita_registrar_envio';
          break;
        case 'recebido':
          rpcName = 'rpc_receita_confirmar_recebimento';
          // p_data_recebimento omisso usa = CURRENT_DATE interno.
          break;
        case 'cancelado':
          rpcName = 'rpc_receita_cancelar_ou_estornar';
          rpcParams['p_motivo'] = 'Cancelamento/Estorno via dor do módulo Dashboard.';
          break;
        default:
          throw new Error('ESTADO_NAO_AUTORIZADO: Transição financeira bloqueada por Domain Hardening. O Status (' + newStatus + ') não atende os trâmites do Banco de Dados.');
      }

      const { data: responseData, error: errUpdate } = await supabase.rpc(rpcName, rpcParams);
      
      if (errUpdate) {
         if (errUpdate.message.includes('Idempotente')) {
            console.log(`[Domain] Idempotência ativada em ${rpcName}: `, errUpdate.message);
         } else {
            throw errUpdate;
         }
      }

      // Re-busca o dataset final apenas para devolver no padrão anterior (compatibility mode)
      const { data: updated } = await supabase
        .from('receitas_operacionais')
        .select('*')
        .eq('id', receitaId)
        .single();

      return updated;
  }

  async updateReceita(tenantId: string, receitaId: string, payload: Partial<ReceitaOperacional>) {
    // Domain Hardening (Etapa 07: Segurança Financeira)
    // Omitimos tentativas de editar campos críticos e matemáticos pelo Frontend.
    delete payload.valor_total;
    delete payload.status;
    delete payload.modalidade;
    delete payload.tenant_id;
    delete payload.empresa_id;

    if (Object.keys(payload).length === 0) {
       console.log('Update de receita dropado. Nenhum campo seguro para modificação presente.');
       return { id: receitaId };
    }

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
