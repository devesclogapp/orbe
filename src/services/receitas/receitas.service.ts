import { supabase } from '@/lib/supabase';
import { BaseService, cleanUuid, getCurrentTenantId, operationalClient, sanitizePayload, requireAuthenticatedUserId } from '../domain/base.service';
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

class ServicosExtrasOperacionaisServiceClass extends BaseService<'servicos_extras_operacionais'> {
  constructor() { super('servicos_extras_operacionais' as any); }

  async getMonthsWithData(empresaId?: string) {
    let query = operationalClient
      .from('servicos_extras_operacionais')
      .select('data');
    
    if (empresaId && empresaId !== 'all') {
      query = query.eq('empresa_id', empresaId);
    }
    
    const { data } = await query;
    const months = new Set<string>();
    for (const row of data ?? []) {
      const dataMes = String(row.data ?? '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(dataMes)) {
        months.add(dataMes);
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('servicos_extras_operacionais')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('servicos_extras_operacionais')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  async getWithEmpresas(empresaId?: string, competencia?: string) {
    try {
      let query = operationalClient
        .from('servicos_extras_operacionais' as any)
        .select(`
          *, 
          empresas(nome),
          formas_pagamento_operacional(nome),
          tipos_servico_operacional(nome)
        `);
      
      if (empresaId) query = query.eq('empresa_id', empresaId);
      if (competencia) {
        const parts = competencia.split('-');
        const year = Number(parts[0]);
        const moPart = parts[1];
        
        if (moPart === 'all' || !moPart) {
          query = query.gte('data', `${year}-01-01`).lt('data', `${year + 1}-01-01`);
        } else if (parts.length === 2) {
          const mo = Number(moPart);
          const nextMonth = mo === 12 ? 1 : mo + 1;
          const nextYear = mo === 12 ? year + 1 : year;
          const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
          query = query.gte('data', `${year}-${String(mo).padStart(2, '0')}-01`).lt('data', nextMonthStr);
        } else if (parts.length === 3) {
          query = query.eq('data', competencia);
        }
      }
      
      const { data, error } = await query.order('data', { ascending: false });
      
      if (error) {
        console.warn('Falha ao buscar serviços extras com empresas, tentando simplificado:', error);
        let simpleQuery = operationalClient
          .from('servicos_extras_operacionais' as any)
          .select('*');
        
        if (empresaId) simpleQuery = simpleQuery.eq('empresa_id', empresaId);
        if (competencia) {
          const parts = competencia.split('-');
          const year = Number(parts[0]);
          const moPart = parts[1];
          if (moPart === 'all' || !moPart) {
            simpleQuery = simpleQuery.gte('data', `${year}-01-01`).lt('data', `${year + 1}-01-01`);
          } else {
            const mo = Number(moPart);
            const nextMo = mo === 12 ? 1 : mo + 1;
            const nextYr = mo === 12 ? year + 1 : year;
            const nextMonthStr = `${nextYr}-${String(nextMo).padStart(2, '0')}-01`;
            simpleQuery = simpleQuery.gte('data', `${year}-${String(mo).padStart(2, '0')}-01`).lt('data', nextMonthStr);
          }
        }
        const { data: simpleData, error: simpleError } = await simpleQuery.order('data', { ascending: false });
        
        if (simpleError) throw simpleError;
        return simpleData ?? [];
      }
        const resultData = data ?? [];
        
        // Resolver responsável
        const responsavelIds = Array.from(new Set(resultData.map((item: any) => item.criado_por).filter(Boolean)));
        let profilesMap: Record<string, string> = {};
        if (responsavelIds.length > 0) {
          try {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', responsavelIds);
            if (profiles) {
              profilesMap = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
            }
          } catch (e) {
            console.warn("Falha ao resolver perfis em getWithEmpresas", e);
          }
        }

        return resultData.map((item: any) => ({
          ...item,
          responsavel_nome: item.criado_por ? (profilesMap[item.criado_por] || null) : null
        }));
    } catch (e) {
      console.error('Erro crítico em ServicosExtrasOperacionaisService:', e);
      return [];
    }
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const userId = await requireAuthenticatedUserId();
    
    // Garantir que campos obrigatórios de pipeline e total estejam presentes
    const payloadClean = sanitizePayload({
      ...payload,
      tenant_id: tenantId,
      criado_por: userId,
      pipeline_status: 'PENDENTE',
      status_pagamento: 'PENDENTE',
      atualizado_em: new Date().toISOString()
    }) as any;

    const { data, error } = await operationalClient
      .from('servicos_extras_operacionais')
      .insert(payloadClean)
      .select(`
        *,
        empresas(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }
}
export const ServicosExtrasOperacionaisService = new ServicosExtrasOperacionaisServiceClass();
