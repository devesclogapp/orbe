import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getTransportadoraDuplicateMessage, getTransportadoraErrorMessage } from '@/utils/transportadoraValidation';
import {
  gerarCNAB240BB,
  downloadCNAB240,
  validarBeneficiarios,
  type EmpresaRemessa,
  type BeneficiarioPagamento,
} from './cnab/cnab240-posicional';
import { CnabRemessaArquivoService } from './cnab/cnabRemessaArquivo.service';

import { BaseService, sanitizePayload, cleanUuid, validateUuidFields, getCurrentTenantId, getTenantQueryFilter, extractReferencedTableFromFkError } from './core.service';



class CustoExtraOperacionalServiceClass {
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

  async getByDate(date: string, empresaId?: string) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .eq('data', date)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
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
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .like('data', `${competencia}%`)
      .order('data', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
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

    const { data, error } = await operationalClient
      .from('custos_extras_operacionais')
      .insert(items)
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

  async getWithEmpresas(empresaId?: string) {
    try {
      let query = supabase
        .from('servicos_extras_operacionais' as any)
        .select('*, empresas(nome)');
      
      if (empresaId) query = query.eq('empresa_id', empresaId);
      
      const { data, error } = await query.order('data', { ascending: false });
      
      if (error) {
        console.warn('Falha ao buscar serviços extras com empresas, tentando simplificado:', error);
        let simpleQuery = supabase
          .from('servicos_extras_operacionais' as any)
          .select('*');
        
        if (empresaId) simpleQuery = simpleQuery.eq('empresa_id', empresaId);
        const { data: simpleData, error: simpleError } = await simpleQuery.order('data', { ascending: false });
        
        if (simpleError) throw simpleError;
        return simpleData ?? [];
      }
      return data ?? [];
    } catch (e) {
      console.error('Erro crítico em ServicosExtrasOperacionaisService:', e);
      return [];
    }
  }
}
export const ServicosExtrasOperacionaisService = new ServicosExtrasOperacionaisServiceClass();