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

import { 
  BaseService, 
  sanitizePayload, 
  cleanUuid, 
  validateUuidFields, 
  getCurrentTenantId, 
  getTenantQueryFilter, 
  extractReferencedTableFromFkError, 
  requireAuthenticatedUserId, 
  operationalClient,
  Table
} from './base.service';

import { 
  inferRegimeTrabalho, 
  inferModeloCalculo, 
  normalizeContratoToken, 
  hasComplementoMinimoColaborador 
} from './core.service';

import type { EncarregadoColaboradorFiltroConfig } from './core.service';
export type { EncarregadoColaboradorFiltroConfig };



// ==================================================
// SERVIÇOS ESPECÍFICOS
// ==================================================

class EmpresaServiceClass extends BaseService<'empresas'> {
  constructor() { super('empresas'); }

  // RLS garante isolamento por tenant_id automaticamente.
  // Não precisamos passar tenantId como parâmetro — o Supabase filtra pela session.
  async getAll() {
    // Uso da exportação dinâmica 'supabase' (Proxy) que resolve para o client correto
    const { data, error } = await (supabase as any)
      .from('empresas')
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getWithCounts() {
    // Uso da exportação dinâmica 'supabase' (Proxy) que resolve para o client correto
    const { data: empresas, error } = await (supabase as any)
      .from('empresas')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    // Buscar contagens separadamente
    const { data: colaboradores } = await (supabase as any).from('colaboradores').select('empresa_id');
    const { data: coletores } = await (supabase as any).from('coletores').select('empresa_id');

    const contagemColaboradores = new Map<string, number>();
    const contagemColetores = new Map<string, number>();
    
    (colaboradores || []).forEach(c => {
      contagemColaboradores.set(c.empresa_id, (contagemColaboradores.get(c.empresa_id) || 0) + 1);
    });
    (coletores || []).forEach(c => {
      contagemColetores.set(c.empresa_id, (contagemColetores.get(c.empresa_id) || 0) + 1);
    });

    return (empresas || []).map(e => ({
      ...e,
      total_colaboradores: contagemColaboradores.get(e.id) || 0,
      total_coletores: contagemColetores.get(e.id) || 0
    }));
  }

  // Override do create para incluir tenant_id automaticamente
  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    const cnpjDigits = (payload.cnpj || '').replace(/\D/g, '');
    
    // Bloquear duplicidade de CNPJ dentro do mesmo tenant
    if (cnpjDigits) {
      const { data: existing } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .eq('cnpj', payload.cnpj)
        .maybeSingle();
      
      if (existing) {
        throw new Error(`Já existe uma empresa "${existing.nome}" cadastrada com este CNPJ.`);
      }
    }

    const payloadWithTenant = {
      ...payload,
      tenant_id: tenantId
    };

    const { data, error } = await supabase
      .from('empresas')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
      }
      throw error;
    }
    return data;
  }
  
  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    const cnpjDigits = (payload.cnpj || '').replace(/\D/g, '');
    
    if (cnpjDigits) {
      const { data: existing } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .eq('cnpj', payload.cnpj)
        .neq('id', id)
        .maybeSingle();
      
      if (existing) {
        throw new Error(`Já existe uma empresa "${existing.nome}" cadastrada com este CNPJ.`);
      }
    }

    const { data, error } = await supabase
      .from('empresas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
      }
      throw error;
    }
    return data;
  }
  
  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string }> {
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (colaborador) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { data: coletor } = await supabase
      .from('coletores')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (coletor) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { data: operacao } = await supabase
      .from('operacoes')
      .select('id')
      .eq('empresa_id', id)
      .limit(1)
      .maybeSingle();
    
    if (operacao) {
      return { success: false, error: 'Esta empresa possui vínculos operacionais e não pode ser excluída.' };
    }
    
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }
}
export const EmpresaService = new EmpresaServiceClass();

class ColaboradorServiceClass extends BaseService<'colaboradores'> {
  constructor() { super('colaboradores'); }


  private isMissingColaboradorColumnError(error: any, column: string) {
    const msg = String(error?.message ?? '');
    return msg.includes(`Could not find the '${column}' column of 'colaboradores'`);
  }

  private getMissingColaboradorColumn(error: any) {
    const msg = String(error?.message ?? '');
    const match = msg.match(/Could not find the '([^']+)' column of 'colaboradores'/);
    return match?.[1] ?? null;
  }

  private async insertColaboradorWithFallback(payload: Record<string, any>) {
    let insertPayload = { ...payload };

    while (true) {
      const { data, error } = await supabase
        .from('colaboradores')
        .insert(insertPayload)
        .select()
        .single();

      if (!error) return data;

      const missingColumn = this.getMissingColaboradorColumn(error);
      if (missingColumn && missingColumn in insertPayload) {
        delete insertPayload[missingColumn];
        continue;
      }

      throw error;
    }
  }

  private async updateColaboradorWithFallback(id: string, payload: Record<string, any>) {
    let updatePayload = { ...payload };

    while (true) {
      const { data, error } = await supabase
        .from('colaboradores')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (!error) return data;

      const missingColumn = this.getMissingColaboradorColumn(error);
      if (missingColumn && missingColumn in updatePayload) {
        delete updatePayload[missingColumn];
        continue;
      }

      throw error;
    }
  }

  async getAllForProducao() {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nome, funcao, empresa_id')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    
    // Validar empresa_id
    const empresaIdClean = cleanUuid(payload.empresa_id);
    if (!empresaIdClean) {
      throw new Error('Selecione uma empresa válida.');
    }

    // Validar duplicidade por CPF dentro do mesmo tenant
    const cpfClean = payload.cpf ? String(payload.cpf).replace(/\D/g, '') : null;
    if (cpfClean && cpfClean.length === 11) {
      const { data: existing } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('cpf', cpfClean)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (existing) {
        throw new Error('Já existe um colaborador cadastrado com este CPF.');
      }
    }

    // Limpar campos UUID opcionais
    const cleanedPayload = {
      ...payload,
      cpf: cpfClean,
      empresa_id: empresaIdClean,
      regime_trabalho: payload.regime_trabalho ?? inferRegimeTrabalho(payload.tipo_colaborador),
      modelo_calculo: payload.modelo_calculo ?? inferModeloCalculo(payload.tipo_colaborador),
      unidade_id: cleanUuid(payload.unidade_id),
      tenant_id: tenantId,
      status_cadastro: payload.status_cadastro ?? 'completo',
      origem_cadastro: payload.origem_cadastro ?? 'manual',
      origem_detalhe: payload.origem_detalhe ?? null,
      chave_pix: payload.chave_pix ?? null,
      banco_validado: payload.banco_validado ?? false,
      matricula: payload.matricula?.trim() === "" ? null : payload.matricula,
    };

    let insertPayload = { ...cleanedPayload };
    let { data, error } = await supabase
      .from('colaboradores')
      .insert(insertPayload)
      .select()
      .single();

    if (
      error &&
      (this.isMissingColaboradorColumnError(error, 'modelo_calculo') ||
        this.isMissingColaboradorColumnError(error, 'regime_trabalho'))
    ) {
      const { modelo_calculo, regime_trabalho, ...legacyPayload } = insertPayload;
      ({ data, error } = await supabase
        .from('colaboradores')
        .insert(legacyPayload)
        .select()
        .single());
    }

    if (error) {
      const details = error.details ? `\nDetalhe: ${error.details}` : '';
      const hint = error.hint ? `\nSugestão: ${error.hint}` : '';
      throw new Error(`${error.message}${details}${hint}`);
    }
    return data;
  }

  async getWithEmpresa(empresaId?: string) {
    let query = supabase
      .from('colaboradores')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data: colaboradores, error } = await query;
    if (error) throw error;

    // Buscar empresas separadamente
    const { data: empresas } = await supabase.from('empresas').select('id, nome, cidade, estado');
    
    // Join manual
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (colaboradores || []).map(c => ({
      ...c,
      empresas: empresaMap.get(c.empresa_id) || null
    }));
  }

  async getByEmpresaWithOperationalFilters(
    empresaId: string,
    filterConfig?: EncarregadoColaboradorFiltroConfig | null
  ) {
    const shouldFilterByEmpresa = filterConfig?.filtrar_por_empresa !== false;
    const shouldRequireAtivos = filterConfig?.somente_ativos !== false;

    let query = supabase
      .from('colaboradores')
      .select('*')
      .order('nome', { ascending: true });

    if (shouldFilterByEmpresa) {
      query = query.eq('empresa_id', empresaId);
    }

    if (shouldRequireAtivos) {
      query = query.eq('status', 'ativo');
    }

    const { data: colaboradores, error } = await query;
    if (error) throw error;

    const { data: empresas } = await supabase.from('empresas').select('id, nome, cidade, estado');
    const empresaMap = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));
    const tiposColaboradorPermitidos = new Set((filterConfig?.tipos_colaborador_permitidos ?? []).map(normalizeContratoToken));
    const regimesPermitidos = new Set((filterConfig?.regimes_trabalho_permitidos ?? []).map(normalizeContratoToken));
    const modelosPermitidos = new Set((filterConfig?.modelos_calculo_permitidos ?? []).map(normalizeContratoToken));
    const contratosPermitidos = new Set((filterConfig?.tipos_contrato_permitidos ?? []).map(normalizeContratoToken));

    return (colaboradores || [])
      .filter((colaborador: any) => {
        if (colaborador.deleted_at) return false;
        if (filterConfig?.somente_cadastro_completo && String(colaborador.status_cadastro ?? '').toLowerCase() !== 'completo') return false;
        if (filterConfig?.excluir_cadastro_provisorio && Boolean(colaborador.cadastro_provisorio)) return false;
        if (filterConfig?.exigir_permitir_lancamento_operacional && !colaborador.permitir_lancamento_operacional) return false;
        if (tiposColaboradorPermitidos.size > 0 && !tiposColaboradorPermitidos.has(normalizeContratoToken(colaborador?.tipo_colaborador))) return false;
        if (regimesPermitidos.size > 0 && !regimesPermitidos.has(normalizeContratoToken(colaborador?.regime_trabalho))) return false;
        if (modelosPermitidos.size > 0 && !modelosPermitidos.has(normalizeContratoToken(colaborador?.modelo_calculo))) return false;
        if (contratosPermitidos.size > 0 && !contratosPermitidos.has(normalizeContratoToken(colaborador?.tipo_contrato))) return false;
        return true;
      })
      .map((colaborador: any) => ({
        ...colaborador,
        empresas: empresaMap.get(colaborador.empresa_id) || null
      }));
  }

  async getEligibleForOperacaoVolume(empresaId: string) {
    const { data: colaboradores, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) throw error;

    const { data: empresas } = await supabase.from('empresas').select('id, nome, cidade, estado');
    const empresaMap = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));

    return (colaboradores || [])
      .filter((colaborador: any) => {
        const tipoContrato = normalizeContratoToken(colaborador?.tipo_contrato);
        const modeloCalculo = normalizeContratoToken(colaborador?.modelo_calculo);

        return (
          tipoContrato === 'operacao' ||
          tipoContrato === 'por_operacao' ||
          modeloCalculo === 'producao' ||
          modeloCalculo === 'por_producao'
        );
      })
      .map((colaborador: any) => ({
        ...colaborador,
        empresas: empresaMap.get(colaborador.empresa_id) || null
      }));
  }

  async update(id: string, payload: Record<string, any>) {
    const { data: current, error: currentError } = await supabase
      .from('colaboradores')
      .select('status_cadastro, cadastro_provisorio, origem_cadastro')
      .eq('id', id)
      .single();

    if (currentError) throw currentError;

    const cleanedPayload: Record<string, any> = {
      nome: payload.nome,
      cpf: payload.cpf ?? null,
      telefone: payload.telefone ?? null,
      cargo: payload.cargo ?? null,
      matricula: payload.matricula ?? null,
      empresa_id: cleanUuid(payload.empresa_id),
      tipo_contrato: payload.tipo_contrato ?? null,
      tipo_colaborador: payload.tipo_colaborador ?? null,
      regime_trabalho: payload.regime_trabalho ?? inferRegimeTrabalho(payload.tipo_colaborador),
      modelo_calculo: payload.modelo_calculo ?? inferModeloCalculo(payload.tipo_colaborador),
      valor_base: Number(payload.valor_base) || 0,
      flag_faturamento: payload.flag_faturamento ?? false,
      permitir_lancamento_operacional: payload.permitir_lancamento_operacional ?? false,
      status: payload.status ?? 'ativo',
      nome_completo: payload.nome_completo ?? null,
      banco_codigo: payload.banco_codigo ?? null,
      agencia: payload.agencia ?? null,
      agencia_digito: payload.agencia_digito ?? null,
      conta: payload.conta ?? null,
      conta_digito: payload.conta_digito ?? null,
      digito_conta: payload.conta_digito ?? payload.digito_conta ?? null,
      tipo_conta: payload.tipo_conta ?? null,
      pis: payload.pis ? String(payload.pis).replace(/\D/g, '') : null,
      chave_pix: payload.chave_pix ?? null,
      banco_validado: payload.banco_validado ?? false,
      unidade_id: cleanUuid(payload.unidade_id),
      deleted_at: payload.deleted_at ?? null,
    };

    // Forward explicit status_cadastro / cadastro_provisorio from frontend
    if (payload.status_cadastro !== undefined) {
      cleanedPayload.status_cadastro = payload.status_cadastro;
    }
    if (payload.cadastro_provisorio !== undefined) {
      cleanedPayload.cadastro_provisorio = payload.cadastro_provisorio;
    }

    if (payload.salario_base != null) {
      cleanedPayload.salario_base = Number(payload.salario_base) || 0;
    }
    if (payload.valor_hora != null) {
      cleanedPayload.valor_hora = Number(payload.valor_hora) || 0;
    }
    if (payload.valor_diaria != null) {
      cleanedPayload.valor_diaria = Number(payload.valor_diaria) || 0;
    }

    if (!cleanedPayload.empresa_id) {
      throw new Error('Selecione uma empresa válida.');
    }

    if (
      (current?.status_cadastro === 'pendente_complemento' || current?.cadastro_provisorio) &&
      hasComplementoMinimoColaborador(cleanedPayload)
    ) {
      cleanedPayload.status_cadastro = 'completo';
      cleanedPayload.cadastro_provisorio = false;
      cleanedPayload.origem_cadastro = current?.origem_cadastro ?? 'manual';
    }

    let updatePayload = { ...cleanedPayload };
    let { data, error } = await supabase
      .from('colaboradores')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (
      error &&
      (this.isMissingColaboradorColumnError(error, 'modelo_calculo') ||
        this.isMissingColaboradorColumnError(error, 'regime_trabalho'))
    ) {
      const { modelo_calculo, regime_trabalho, ...legacyPayload } = updatePayload;
      ({ data, error } = await supabase
        .from('colaboradores')
        .update(legacyPayload)
        .eq('id', id)
        .select()
        .single());
    }

    if (error) {
      const details = error.details ? `\nDetalhe: ${error.details}` : '';
      const hint = error.hint ? `\nSugestão: ${error.hint}` : '';
      throw new Error(`${error.message}${details}${hint}`);
    }
    return data;
  }

  async getDiaristas(empresaId: string, apenasAtivos = true) {
    let query = (supabase as any)
      .from('colaboradores')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('tipo_colaborador', 'DIARISTA')
      .eq('permitir_lancamento_operacional', true)
      .order('nome', { ascending: true });

    if (apenasAtivos) query = query.eq('status', 'ativo');

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf ?? null,
      funcao: c.cargo ?? null,
      valor_diaria: Number(c.valor_base ?? 0),
      status: c.status,
      empresa_id: c.empresa_id,
    }));
  }

  /**
   * Verifica se já existe um colaborador com o CPF informado no tenant atual.
   * Retorna { exists: true, nome } se houver duplicata; { exists: false } caso contrário.
   */
  async checkCpfExists(cpf: string): Promise<{ exists: boolean; nome?: string }> {
    const cpfClean = String(cpf).replace(/\D/g, '');
    if (cpfClean.length !== 11) return { exists: false };

    try {
      const tenantId = await getCurrentTenantId();
      const { data } = await supabase
        .from('colaboradores')
        .select('id, nome')
        .eq('cpf', cpfClean)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .maybeSingle();

      if (data) {
        return { exists: true, nome: data.nome };
      }
    } catch {
      // Em caso de erro de rede, deixa prosseguir — a validação final no create pega
    }
    return { exists: false };
  }
}
export const ColaboradorService = new ColaboradorServiceClass();

class ColetorServiceClass extends BaseService<'coletores'> {
  constructor() { super('coletores'); }

  extractFolderIdFromUrl(url: string | null) {
    if (!url) return null;
    try {
      const parts = url.match(/[-\w]{25,}/);
      return parts ? parts[0] : null;
    } catch {
      return null;
    }
  }

  async getWithEmpresa() {
    const { data: coletores, error } = await supabase
      .from('coletores')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const { data: unidades } = await supabase.from('unidades_operacionais').select('id, nome');
    
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    const unidadeMap = new Map((unidades || []).map(u => [u.id, u]));
    
    return (coletores || []).map((c: any) => ({ 
      ...c, 
      empresas: empresaMap.get(c.empresa_id) || null,
      unidade: unidadeMap.get(c.unidade_id) || null
    }));
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const empresaIdClean = cleanUuid(payload.empresa_id);
    if (!empresaIdClean) throw new Error('Selecione uma empresa válida.');

    const nomeColetor = payload.nome_coletor?.trim() || 'Coletor sem nome';

    // Fallback temporário para campos NOT NULL legados (modelo, serie).
    // Esses valores serão nullable após a migration 20260548 ser aplicada.
    // Por ora, garantimos que o insert não falhe por constraint.
    const modeloValue = payload.modelo?.trim() || null;
    const serieValue = payload.serie?.trim() || null;

    const cleanedPayload: Record<string, any> = {
      nome_coletor:          nomeColetor,
      modelo:                modeloValue,
      serie:                 serieValue,
      empresa_id:            empresaIdClean,
      tenant_id:             tenantId,
      status:                payload.status ?? 'offline',
      unidade_id:            cleanUuid(payload.unidade_id),
      unidade_local:         payload.unidade_local?.trim() || null,
      fabricante:            payload.fabricante?.trim() || null,
      tipo_integracao:       payload.tipo_integracao || null,
      formato_arquivo:       payload.formato_arquivo || null,
      
      folder_entrada_url:     payload.folder_entrada_url?.trim() || null,
      folder_entrada_id:      this.extractFolderIdFromUrl(payload.folder_entrada_url),
      folder_processados_url: payload.folder_processados_url?.trim() || null,
      folder_processados_id:  this.extractFolderIdFromUrl(payload.folder_processados_url),
      folder_erros_url:       payload.folder_erros_url?.trim() || null,
      folder_erros_id:        this.extractFolderIdFromUrl(payload.folder_erros_url),
      
      integracao_ativa:      payload.integracao_ativa ?? true,
      intervalo_sincronizacao_minutos: payload.intervalo_sincronizacao_minutos ?? 5,
    };

    // Se modelo/serie ainda estão NULL, fornece valores temporários para
    // contornar a constraint NOT NULL até a migration ser aplicada.
    if (!cleanedPayload.modelo) cleanedPayload.modelo = 'N/D';
    if (!cleanedPayload.serie) cleanedPayload.serie = `tmp-${Date.now()}`;

    const { data, error } = await supabase
      .from('coletores')
      .insert(cleanedPayload)
      .select()
      .single();

    // Se erro de UNIQUE em serie, gera outro valor e tenta de novo
    if (error && (error.code === '23505' || error.message?.includes('unique'))) {
      cleanedPayload.serie = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: data2, error: error2 } = await supabase
        .from('coletores')
        .insert(cleanedPayload)
        .select()
        .single();
      if (error2) throw error2;
      return data2;
    }

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const cleanedPayload: Record<string, any> = {
      nome_coletor:          payload.nome_coletor?.trim() || null,
      modelo:                payload.modelo?.trim() || null,
      serie:                 payload.serie?.trim() || null,
      empresa_id:            cleanUuid(payload.empresa_id),
      unidade_id:            cleanUuid(payload.unidade_id),
      unidade_local:         payload.unidade_local?.trim() || null,
      fabricante:            payload.fabricante?.trim() || null,
      tipo_integracao:       payload.tipo_integracao || null,
      formato_arquivo:       payload.formato_arquivo || null,
      
      folder_entrada_url:     payload.folder_entrada_url?.trim() || null,
      folder_entrada_id:      this.extractFolderIdFromUrl(payload.folder_entrada_url),
      folder_processados_url: payload.folder_processados_url?.trim() || null,
      folder_processados_id:  this.extractFolderIdFromUrl(payload.folder_processados_url),
      folder_erros_url:       payload.folder_erros_url?.trim() || null,
      folder_erros_id:        this.extractFolderIdFromUrl(payload.folder_erros_url),
      
      integracao_ativa:      payload.integracao_ativa ?? true,
      intervalo_sincronizacao_minutos: payload.intervalo_sincronizacao_minutos ?? 5,
    };

    if (!cleanedPayload.empresa_id) throw new Error('Selecione uma empresa válida.');

    const { data, error } = await supabase
      .from('coletores')
      .update(cleanedPayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async resolveByDriveFolder(folderId: string) {
    const { data, error } = await supabase
      .from('coletores')
      .select('*, empresa:empresas(*), unidade:unidades_operacionais(*)')
      .eq('folder_entrada_id', folderId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      success: true,
      empresa_id: data.empresa_id,
      cliente_id: data.empresa?.cliente_id || null,
      unidade_id: data.unidade_id,
      coletor_id: data.id,
      modelo: data.modelo,
      numero_serie: data.serie,
      fabricante: data.fabricante,
      tipo_integracao: data.tipo_integracao,
      formato_arquivo: data.formato_arquivo,
      folder_entrada_id: data.folder_entrada_id,
      folder_processados_id: data.folder_processados_id,
      folder_erros_id: data.folder_erros_id,
      integracao_ativa: data.integracao_ativa,
      intervalo_sincronizacao_minutos: data.intervalo_sincronizacao_minutos
    };
  }
}
export const ColetorService = new ColetorServiceClass();

class UnidadeServiceClass extends BaseService<'unidades'> {
  constructor() { super('unidades'); }
  async getByEmpresa(empresaId: string) {
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
export const UnidadeService = new UnidadeServiceClass();

class TransportadoraClienteServiceClass {
  async getByEmpresa(empresaId?: string) {
    // RLS garante isolamento por tenant_id. empresaId filtra dentro do tenant.
    let query = operationalClient
      .from('transportadoras_clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();

    const nome = String(payload.nome ?? '').trim();
    if (nome) {
      const { data: existing } = await operationalClient
        .from('transportadoras_clientes')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('nome', nome)
        .maybeSingle();

      if (existing) {
        throw new Error(getTransportadoraDuplicateMessage());
      }
    }
    
    const payloadWithTenant = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
      tenant_id: tenantId
    };

    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .insert(payloadWithTenant)
      .select()
      .single();

    if (error) {
      throw new Error(getTransportadoraErrorMessage(error));
    }
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (nome) {
      const { data: existing } = await operationalClient
        .from('transportadoras_clientes')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('nome', nome)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new Error(getTransportadoraDuplicateMessage());
      }
    }

    const payloadCleaned = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
    };

    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .update(payloadCleaned)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(getTransportadoraErrorMessage(error));
    }
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string; detalhes?: { tabela: string; count: number; ids?: string[] }[] }> {

    // As FKs em operacoes_producao e fornecedor_valores_servico são ON DELETE SET NULL
    // Não há vínculos bloqueantes — pode deletar diretamente.
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[TransportadoraClienteService.deleteWithCheck] Erro no delete:`, error);

      // Caso improvável de FK violada (tabela sem SET NULL)
      if (error.code === '23503') {
        const referencedTable = extractReferencedTableFromFkError(error);
        return {
          success: false,
          detalhes: referencedTable ? [{ tabela: referencedTable, count: 1 }] : undefined,
          error: 'Esta transportadora possui vínculos e não pode ser excluída.',
        };
      }
      throw error;
    }

    return { success: true };
  }

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }
}
export const TransportadoraClienteService = new TransportadoraClienteServiceClass();

class FornecedorServiceClass {
  async getByEmpresa(empresaId?: string) {
    // RLS garante isolamento por tenant_id. empresaId filtra dentro do tenant.
    let query = operationalClient
      .from('fornecedores')
      .select('*, produtos_carga(nome)')
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (!nome) {
      throw new Error("Informe o nome do fornecedor.");
    }

    const { data: existing } = await operationalClient
      .from('fornecedores')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('nome', nome)
      .maybeSingle();

    if (existing) {
      throw new Error("Já existe um fornecedor com este nome neste tenant.");
    }
    
    const produtosArray = payload.produtos_associados;
    
    const payloadWithTenant = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
      tenant_id: tenantId
    };
    const payloadToInsert = { ...payloadWithTenant } as any;
    delete payloadToInsert.produtos_associados;
    delete payloadToInsert.produto_id;
    delete payloadToInsert.produtos_carga;

    const { data, error } = await operationalClient
      .from('fornecedores')
      .insert(payloadToInsert)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Já existe um fornecedor com este nome neste tenant.");
      throw error;
    }

    if (produtosArray && Array.isArray(produtosArray) && produtosArray.length > 0 && data) {
        await operationalClient.from('produtos_carga').update({ fornecedor_id: data.id }).in('id', produtosArray);
    }

    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const nome = String(payload.nome ?? '').trim();

    if (!nome) {
      throw new Error("Informe o nome do fornecedor.");
    }

    const { data: existing } = await operationalClient
      .from('fornecedores')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('nome', nome)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      throw new Error("Já existe um fornecedor com este nome neste tenant.");
    }

    const produtosArray = payload.produtos_associados;
    const payloadCleaned = {
      ...payload,
      nome,
      empresa_id: payload.empresa_id ? cleanUuid(payload.empresa_id) : null,
    };
    const payloadToUpdate = { ...payloadCleaned } as any;
    delete payloadToUpdate.produtos_associados;
    delete payloadToUpdate.produto_id;
    delete payloadToUpdate.produtos_carga;

    const { data, error } = await operationalClient
      .from('fornecedores')
      .update(payloadToUpdate)
      .eq('id', id)
      .select();

    if (error) {
      if (error.code === '23505') throw new Error("Já existe um fornecedor com este nome neste tenant.");
      throw error;
    }

    if (produtosArray !== undefined && Array.isArray(produtosArray)) {
       await operationalClient.from('produtos_carga').update({ fornecedor_id: null }).eq('fornecedor_id', id);
       if (produtosArray.length > 0) {
         await operationalClient.from('produtos_carga').update({ fornecedor_id: id }).in('id', produtosArray);
       }
    }

    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('fornecedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await operationalClient
      .from('fornecedores')
      .update({ ativo })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteWithCheck(id: string): Promise<{ success: boolean; error?: string; detalhes?: { tabela: string; count: number; ids?: string[] }[] }> {

    // As FKs em operacoes_producao são ON DELETE SET NULL
    // As FKs em fornecedor_valores_servico e produtos_carga são ON DELETE CASCADE
    const { error, count } = await operationalClient
      .from('fornecedores')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error(`[FornecedorService.deleteWithCheck] Erro no delete:`, error);
      if (error.code === '23503') {
        const referencedTable = extractReferencedTableFromFkError(error);
        return {
          success: false,
          detalhes: referencedTable ? [{ tabela: referencedTable, count: 1 }] : undefined,
          error: 'Este fornecedor possui vínculos e não pode ser excluído.',
        };
      }
      throw error;
    }

    if (count === 0) {
       return {
         success: false,
         error: 'Nenhum registro foi excluído. Pode não existir ou você não tem permissão.'
       };
    }

    return { success: true };
  }
}
export const FornecedorService = new FornecedorServiceClass();