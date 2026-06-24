import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getTransportadoraDuplicateMessage, getTransportadoraErrorMessage } from '@/utils/transportadoraValidation';
import {
  gerarCNAB240BB,
  downloadCNAB240,
  validarBeneficiarios,
  type EmpresaRemessa,
  type BeneficiarioPagamento,
} from '../cnab/cnab240-posicional';
import { CnabRemessaArquivoService } from '../cnab/cnabRemessaArquivo.service';

import { BaseService, sanitizePayload, cleanUuid, validateUuidFields, getCurrentTenantId, getTenantQueryFilter, extractReferencedTableFromFkError, operationalClient, requireAuthenticatedUserId } from './base.service';



class CustoExtraOperacionalServiceClass {
  async getMonthsWithData(empresaId?: string, tenantId?: string | null) {
    let query = operationalClient
      .from('custos_extras_operacionais')
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

  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  async update(id: string, payload: Record<string, unknown>) {
    const { data, error } = await operationalClient
      .from('custos_extras_operacionais')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('custos_extras_operacionais')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getByDate(date: string) {
    const { data: rawData, error } = await operationalClient
      .from('custos_extras_operacionais')
      .select('*, empresas:empresa_id(nome), forma_pagamento_ref:forma_pagamento_id(nome)')
      .eq('data', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[CustoExtraOperacionalService] Erro em getByDate:", error);
      throw error;
    }

    const data = rawData ?? [];
    
    // Resolver responsável
    const responsavelIds = Array.from(new Set(data.map(item => item.responsavel_id).filter(Boolean)));
    let profilesMap: Record<string, string> = {};
    if (responsavelIds.length > 0) {
      try {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', responsavelIds);
        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
        }
      } catch (e) {
        console.warn("Falha ao resolver perfis na operacao por data", e);
      }
    }

    return data.map(item => ({
      ...item,
      responsavel_nome: item.responsavel_id ? (profilesMap[item.responsavel_id] || item.responsavel_nome || null) : (item.responsavel_nome || null)
    }));
  }

  async getAll(empresaId?: string, tenantId?: string | null) {
    let empresaIds = empresaId ? [empresaId] : undefined;
    
    if (!empresaId && tenantId) {
      empresaIds = await this.getEmpresaIdsFromTenant(tenantId);
      if (!empresaIds || empresaIds.length === 0) return [];
    }

    let query = operationalClient
      .from('custos_extras_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false });

    if (empresaIds && empresaIds.length > 0) {
      query = query.in('empresa_id', empresaIds);
    } else if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getByCompetencia(competencia: string, empresaId?: string) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .select('*, empresas:empresa_id(nome), forma_pagamento_ref:forma_pagamento_id(nome)');

    if (competencia) {
      const parts = competencia.split('-');
      const year = Number(parts[0]);
      const moPart = parts[1];
      
      if (moPart === 'all' || !moPart) {
        query = query.gte('data', `${year}-01-01`).lt('data', `${year + 1}-01-01`);
      } else {
        const mo = Number(moPart);
        const nextMonth = mo === 12 ? 1 : mo + 1;
        const nextYear = mo === 12 ? year + 1 : year;
        const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        query = query.gte('data', `${year}-${String(mo).padStart(2, '0')}-01`).lt('data', nextMonthStr);
      }
    }
    query = query.order('data', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data: rawData, error } = await query;
    if (error) {
      console.error("[CustoExtraOperacionalService] Erro em getByCompetencia:", error);
      throw error;
    }
    
    const data = rawData ?? [];
    
    // Resolver responsável
    const responsavelIds = Array.from(new Set(data.map(item => item.responsavel_id).filter(Boolean)));
    let profilesMap: Record<string, string> = {};
    if (responsavelIds.length > 0) {
      try {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', responsavelIds);
        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
        }
      } catch (e) {
        console.warn("Falha ao resolver perfis em getByCompetencia", e);
      }
    }

    return data.map(item => ({
      ...item,
      responsavel_nome: item.responsavel_id ? (profilesMap[item.responsavel_id] || item.responsavel_nome || null) : (item.responsavel_nome || null)
    }));
  }

  async deleteImported(empresaId?: string | null) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .delete()
      .select('id')
      .eq('origem_dado', 'importacao');

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data?.length ?? 0;
  }

  async createMany(items: Record<string, unknown>[]) {
    if (items.length === 0) return [];
    
    // Injetar tenant_id automaticamente para garantir isolamento
    let tenantId: string | null = null;
    try {
      tenantId = await getCurrentTenantId();
    } catch {
      // se não conseguir, usa o que vier no payload
    }

    // Sanitiza todos os itens para converter strings vazias em null
    const sanitizedItems = items.map(item => {
      const base = tenantId ? { ...item, tenant_id: tenantId } : item;
      return sanitizePayload(base) as Record<string, unknown>;
    });

    const { data, error } = await operationalClient
      .from('custos_extras_operacionais')
      .insert(sanitizedItems)
      .select('id');

    if (error) throw error;
    return data ?? [];
  }

  async replaceImportedBatch(empresaId: string, items: Record<string, unknown>[]) {
    const { data, error } = await operationalClient.rpc('replace_imported_custos_extras_operacionais', {
      p_empresa_id: empresaId,
      p_items: items,
    });

    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      const functionMissing =
        errorCode === 'PGRST202' ||
        errorMessage.includes('replace_imported_custos_extras_operacionais');

      const tableMissing =
        errorCode === 'PGRST205' ||
        errorMessage.includes('custos_extras_operacionais');

      if (tableMissing) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }

      if (!functionMissing) throw error;

      await this.deleteImported(empresaId);
      const inserted = await this.createMany(
        items.map((item) => ({
          ...item,
          empresa_id: empresaId,
        })),
      );
      return inserted.length;
    }

    return Number(data ?? 0);
  }
}
export const CustoExtraOperacionalService = new CustoExtraOperacionalServiceClass();
// @ts-ignore
class FormasPagamentoServiceClass extends BaseService<any> {
  constructor() { super('formas_pagamento'); }
}
export const FormasPagamentoService = new FormasPagamentoServiceClass();

// @ts-ignore
class TaxasImpostosServiceClass extends BaseService<any> {
  constructor() { super('taxas_impostos'); }
}
export const TaxasImpostosService = new TaxasImpostosServiceClass();

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
        const responsavelIds = Array.from(new Set(resultData.map(item => item.criado_por).filter(Boolean)));
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

        return resultData.map(item => ({
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