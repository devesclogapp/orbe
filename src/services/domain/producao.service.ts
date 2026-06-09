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
  operationalClient 
} from './base.service';



class PontoServiceClass extends BaseService<'registros_ponto'> {
  constructor() { super('registros_ponto'); }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    return super.create({ ...payload, tenant_id: tenantId } as any);
  }

  async update(id: string, payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    return super.update(id, { ...payload, tenant_id: tenantId } as any);
  }

  async getByDate(date: string, empresaId?: string) {
    let query = supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByMonth(month: string, empresaId?: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('registros_ponto')
      .select('*, colaboradores(nome, cargo, matricula, cpf, empresas(nome))')
      .or(`competencia.eq.${month},and(data.gte.${month}-01,data.lt.${nextMonthStr})`)
      .order('data', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getMonthsWithData(empresaId?: string) {
    let query = supabase
      .from('registros_ponto')
      .select('data, competencia')
      .order('data', { ascending: false })
      .limit(1000);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const months = new Set<string>();
    for (const row of data ?? []) {
      const competencia = String(row.competencia ?? '').slice(0, 7);
      const dataMes = String(row.data ?? '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(competencia)) {
        months.add(competencia);
        continue;
      }
      if (/^\d{4}-\d{2}$/.test(dataMes)) {
        months.add(dataMes);
      }
    }

    return Array.from(months).sort().reverse();
  }

  async getByCollaborator(collabId: string) {
    const { data, error } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', collabId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async deleteImported(month: string, empresaId?: string | null) {
    const [year, monthNumber] = month.split('-').map(Number);
    if (!year || !monthNumber) {
      throw new Error('Período inválido para limpar importação.');
    }

    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const tenantId = await getCurrentTenantId();

    let pontosQuery = supabase
      .from('registros_ponto')
      .select('id, colaborador_id')
      .eq('tenant_id', tenantId)
      .eq('origem', 'importacao')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);

    if (empresaId) {
      pontosQuery = pontosQuery.eq('empresa_id', empresaId);
    }

    const { data: pontos, error: pontosError } = await pontosQuery;
    if (pontosError) throw pontosError;

    const pontoIds = (pontos ?? []).map((ponto) => ponto.id);
    const colaboradorIds = Array.from(
      new Set((pontos ?? []).map((ponto) => ponto.colaborador_id).filter(Boolean)),
    ) as string[];

    if (pontoIds.length === 0) {
      return 0;
    }

    const { error: eventosError } = await supabase
      .from('banco_horas_eventos')
      .delete()
      .in('registro_ponto_id', pontoIds);
    if (eventosError) throw eventosError;

    const { error: inconsistenciasError } = await supabase
      .from('processamento_rh_inconsistencias')
      .delete()
      .in('registro_ponto_id', pontoIds);
    if (inconsistenciasError) throw inconsistenciasError;

    let logsDeleteQuery = supabase
      .from('processamento_rh_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('periodo_mes', monthNumber)
      .eq('periodo_ano', year);

    if (empresaId) {
      logsDeleteQuery = logsDeleteQuery.eq('empresa_id', empresaId);
    }

    const { error: logsError } = await logsDeleteQuery;
    if (logsError) throw logsError;

    let fechamentoDeleteQuery = supabase
      .from('fechamento_mensal')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('mes', monthNumber)
      .eq('ano', year);

    if (empresaId) {
      fechamentoDeleteQuery = fechamentoDeleteQuery.eq('empresa_id', empresaId);
    }

    if (colaboradorIds.length > 0) {
      fechamentoDeleteQuery = fechamentoDeleteQuery.in('colaborador_id', colaboradorIds);
    }

    const { error: fechamentoError } = await fechamentoDeleteQuery;
    if (fechamentoError) throw fechamentoError;

    let pontosDeleteQuery = supabase
      .from('registros_ponto')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('origem', 'importacao')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);

    if (empresaId) {
      pontosDeleteQuery = pontosDeleteQuery.eq('empresa_id', empresaId);
    }

    const { data: deletedPontos, error: deletePontosError } = await pontosDeleteQuery.select('id');
    if (deletePontosError) throw deletePontosError;

    for (const colaboradorId of colaboradorIds) {
      const { data: eventosRestantes, error: eventosRestantesError } = await supabase
        .from('banco_horas_eventos')
        .select('quantidade_minutos, data, empresa_id')
        .eq('tenant_id', tenantId)
        .eq('colaborador_id', colaboradorId)
        .order('data', { ascending: true });

      if (eventosRestantesError) throw eventosRestantesError;

      if (!eventosRestantes || eventosRestantes.length === 0) {
        const { error: saldoDeleteError } = await supabase
          .from('banco_horas_saldos')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('colaborador_id', colaboradorId);
        if (saldoDeleteError) throw saldoDeleteError;
        continue;
      }

      const saldoAtualMinutos = eventosRestantes.reduce(
        (acc, evento) => acc + Number(evento.quantidade_minutos ?? 0),
        0,
      );
      const horasPositivasMinutos = eventosRestantes
        .filter((evento) => Number(evento.quantidade_minutos ?? 0) > 0)
        .reduce((acc, evento) => acc + Number(evento.quantidade_minutos ?? 0), 0);
      const horasNegativasMinutos = Math.abs(
        eventosRestantes
          .filter((evento) => Number(evento.quantidade_minutos ?? 0) < 0)
          .reduce((acc, evento) => acc + Number(evento.quantidade_minutos ?? 0), 0),
      );
      const ultimoEvento = eventosRestantes[eventosRestantes.length - 1];

      const { error: saldoUpsertError } = await supabase
        .from('banco_horas_saldos')
        .upsert(
          {
            tenant_id: tenantId,
            empresa_id: ultimoEvento?.empresa_id ?? null,
            colaborador_id: colaboradorId,
            saldo_atual_minutos: saldoAtualMinutos,
            horas_positivas_minutos: horasPositivasMinutos,
            horas_negativas_minutos: horasNegativasMinutos,
            ultima_movimentacao: ultimoEvento?.data
              ? new Date(`${ultimoEvento.data}T00:00:00`).toISOString()
              : null,
            ultima_atualizacao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,colaborador_id' },
        );
      if (saldoUpsertError) throw saldoUpsertError;
    }

    return deletedPontos?.length ?? pontoIds.length;
  }

  async importarPontos(payload: FormData) {
    const { data, error } = await (supabase as any).functions.invoke('importar-pontos-manual', {
      body: payload,
    });
    if (error) throw error;
    return data;
  }
}
export const PontoService = new PontoServiceClass();

class ConsolidadoServiceClass {
  async getByCompetencia(competencia: string, empresaId?: string) {
    let qC = supabase
      .from('financeiro_consolidados_cliente')
      .select('*, clientes(nome)')
      .eq('competencia', competencia);

    if (empresaId) qC = qC.eq('empresa_id', empresaId);

    let qCol = supabase
      .from('financeiro_consolidados_colaborador')
      .select('*, colaboradores(nome, cargo)')
      .eq('competencia', competencia);

    if (empresaId) qCol = qCol.eq('empresa_id', empresaId);

    const [resC, resCol] = await Promise.all([qC, qCol]);

    if (resC.error || resCol.error) throw resC.error || resCol.error;
    return { clientes: resC.data, colaboradores: resCol.data };
  }

  async getClientConsolidadoById(id: string) {
    const { data, error } = await supabase
      .from('financeiro_consolidados_cliente')
      .select('*, clientes(nome, empresa_id), empresas:empresa_id(nome)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async approveBatch(ids: string[]) {
    const { error } = await supabase
      .from('financeiro_consolidados_cliente')
      .update({ status: 'aprovado' })
      .in('id', ids);
    if (error) throw error;
  }
}
export const ConsolidadoService = new ConsolidadoServiceClass();

class ConfiguracaoOperacionalServiceClass extends BaseService<'configuracoes_operacionais'> {
  constructor() { super('configuracoes_operacionais'); }

  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase
      .from('configuracoes_operacionais')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsert(payload: any) {
    await requireAuthenticatedUserId();
    const empresaId = cleanUuid(payload?.empresa_id);
    if (!empresaId) {
      throw new Error('Empresa inválida para salvar configuração operacional.');
    }

    const payloadClean = sanitizePayload({
      ...payload,
      empresa_id: empresaId,
    }) as Record<string, any>;

    const { data: existente, error: lookupError } = await supabase
      .from('configuracoes_operacionais')
      .select('id')
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existente?.id) {
      const { data, error } = await supabase
        .from('configuracoes_operacionais')
        .update(payloadClean)
        .eq('id', existente.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('configuracoes_operacionais')
      .insert(payloadClean)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
export const ConfiguracaoOperacionalService = new ConfiguracaoOperacionalServiceClass();

class RegraOperacionalServiceClass {
  async getAll(empresaId?: string) {
    let query = operationalClient
      .from('fornecedor_valores_servico')
      .select(`
        *,
        empresas:empresa_id(nome),
        tipos_regra_operacional:tipo_regra_id(nome, coluna_planilha, unidade_medida),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .order('ativo', { ascending: false })
      .order('vigencia_inicio', { ascending: false })
      .order('created_at', { ascending: false });

    if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);

    const { data, error } = await query;
    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      if (errorCode === 'PGRST205' || errorMessage.includes('custos_extras_operacionais')) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }
      throw error;
    }
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    
    const tenantId = await getCurrentTenantId();
    
    // Campos fundamentais da tabela base + tenant_id (obrigatório)
    const payloadCleaned: Record<string, unknown> = {
      tenant_id: tenantId,
      tipo_calculo: payload.tipo_calculo,
      valor_unitario: payload.valor_unitario,
      vigencia_inicio: payload.vigencia_inicio,
      vigencia_fim: payload.vigencia_fim || null,
      ativo: payload.ativo,
    };
    
    // Helper para adicionar campo UUID apenas se válido
    const tryAddUuid = (fieldName: string) => {
      const val = payload[fieldName];
      if (val !== undefined && val != null) {
        const strVal = String(val).trim();
        if (strVal !== '') {
          const cleaned = cleanUuid(strVal);
          if (cleaned) {
            payloadCleaned[fieldName] = cleaned;
          }
        }
      }
    };
    
    // Campos UUID opcionais
    tryAddUuid('empresa_id');
    tryAddUuid('unidade_id');
    tryAddUuid('tipo_servico_id');
    tryAddUuid('fornecedor_id');
    tryAddUuid('transportadora_id');
    tryAddUuid('produto_carga_id');
    tryAddUuid('tipo_regra_id');
    tryAddUuid('forma_pagamento_id');


    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payloadCleaned)
      .select()
      .single();

    if (error) {
      console.error('[REGRAS] Erro ao inserir:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: payloadCleaned
      });
      throw error;
    }
    return data;
  }

  async createMany(payloads: Record<string, any>[]) {
    if (payloads.length === 0) return [];


    const tenantId = await getCurrentTenantId();
    
    // Helper para adicionar campo UUID apenas se válido
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryAddUuid = (fieldName: string, obj: any, target: any) => {
        const val = obj[fieldName];
        if (val !== undefined && val != null) {
          const strVal = String(val).trim();
          if (strVal !== '') {
            const cleaned = cleanUuid(strVal);
            if (cleaned) {
              target[fieldName] = cleaned;
            }
          }
        }
      };
      
      const uuidFieldNames = [
        'empresa_id', 'unidade_id', 'tipo_servico_id', 'fornecedor_id', 
        'transportadora_id', 'produto_carga_id', 'tipo_regra_id', 'forma_pagamento_id'
      ];

      const payloadsWithTenant = payloads.map(p => {
        const cleaned: Record<string, unknown> = {
          tenant_id: tenantId,
          tipo_calculo: p.tipo_calculo,
          valor_unitario: p.valor_unitario,
          vigencia_inicio: p.vigencia_inicio,
          vigencia_fim: p.vigencia_fim || null,
          ativo: p.ativo,
        };
        
        for (const field of uuidFieldNames) {
          tryAddUuid(field, p, cleaned);
        }
        
        return cleaned;
      });


    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payloadsWithTenant)
      .select();

    if (error) {
      console.error('[REGRAS] createMany - erro ao inserir:', {
        code: error.code,
        message: error.message,
        payloads: payloadsWithTenant
      });
      throw error;
    }
    return data ?? [];
  }

  async update(id: string, payload: Record<string, any>) {

    // Helper para adicionar campo UUID apenas se válido
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyNullableUuid = (fieldName: string, obj: any, target: any) => {
      if (!(fieldName in obj)) return;

      const val = obj[fieldName];
      if (val == null || String(val).trim() === '') {
        target[fieldName] = null;
        return;
      }

      const cleaned = cleanUuid(String(val).trim());
      if (cleaned) {
        target[fieldName] = cleaned;
      }
    };

    const uuidFields = [
      'empresa_id', 'unidade_id', 'tipo_servico_id', 'fornecedor_id', 
      'transportadora_id', 'produto_carga_id', 'tipo_regra_id', 'forma_pagamento_id'
    ];
    
    const payloadCleaned: Record<string, unknown> = {};
    
    for (const field of uuidFields) {
      applyNullableUuid(field, payload, payloadCleaned);
    }
    
    // Copiar campos não-UUID
    if (payload.tipo_calculo !== undefined) payloadCleaned.tipo_calculo = payload.tipo_calculo;
    if (payload.valor_unitario !== undefined) payloadCleaned.valor_unitario = payload.valor_unitario;
    if (payload.vigencia_inicio !== undefined) payloadCleaned.vigencia_inicio = payload.vigencia_inicio;
    if (payload.vigencia_fim !== undefined) payloadCleaned.vigencia_fim = payload.vigencia_fim || null;
    if (payload.ativo !== undefined) payloadCleaned.ativo = payload.ativo;


    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .update(payloadCleaned)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[REGRAS] update - erro ao atualizar:', {
        code: error.code,
        message: error.message,
        payload: payloadCleaned
      });
      throw error;
    }
    return data;
  }

  async inativar(id: string) {
    return this.update(id, { ativo: false });
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('fornecedor_valores_servico')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async hasActiveConflict(params: {
    empresaId?: string | null;
    tipoServicoId?: string | null;
    fornecedorId?: string | null;
    transportadoraId?: string | null;
    produtoCargaId?: string | null;
    tipoRegraId?: string;
    tipoCalculo: string;
    vigenciaInicio: string;
    vigenciaFim?: string | null;
    excludeId?: string;
  }) {
    let query = operationalClient
      .from('fornecedor_valores_servico')
      .select('id, vigencia_inicio, vigencia_fim')
      .eq('tipo_calculo', params.tipoCalculo)
      .eq('ativo', true);

    query = params.empresaId
      ? query.eq('empresa_id', params.empresaId)
      : query.is('empresa_id', null);

    query = params.tipoServicoId
      ? query.eq('tipo_servico_id', params.tipoServicoId)
      : query.is('tipo_servico_id', null);

    query = params.fornecedorId
      ? query.eq('fornecedor_id', params.fornecedorId)
      : query.is('fornecedor_id', null);

    if (params.tipoRegraId) {
      query = query.eq('tipo_regra_id', params.tipoRegraId);
    }

    query = params.transportadoraId
      ? query.eq('transportadora_id', params.transportadoraId)
      : query.is('transportadora_id', null);

    query = params.produtoCargaId
      ? query.eq('produto_carga_id', params.produtoCargaId)
      : query.is('produto_carga_id', null);

    if (params.excludeId) query = query.neq('id', params.excludeId);

    const { data, error } = await query;
    if (error) throw error;

    const inicioNovo = new Date(`${params.vigenciaInicio}T00:00:00`);
    const fimNovo = params.vigenciaFim ? new Date(`${params.vigenciaFim}T23:59:59`) : null;

    return (data ?? []).some((item: any) => {
      const inicioExistente = new Date(`${item.vigencia_inicio}T00:00:00`);
      const fimExistente = item.vigencia_fim ? new Date(`${item.vigencia_fim}T23:59:59`) : null;

      const novoAntesDoFimExistente = !fimExistente || inicioNovo <= fimExistente;
      const existenteAntesDoFimNovo = !fimNovo || inicioExistente <= fimNovo;

      return novoAntesDoFimExistente && existenteAntesDoFimNovo;
    });
  }
}
export const RegraOperacionalService = new RegraOperacionalServiceClass();

class OperacaoProducaoServiceClass {
  private sanitizeOperacaoPayload(payload: Record<string, any>) {
    const { 
      // Campos de UI/Display que não existem no banco
      categoria_servico, 
      categoria_custo, 
      tipo_calculo, 
      descricao_servico, 
      modalidade_financeira, 
      produto_label,
      transportadora_label,
      tipo_servico_label,
      quantidade_label,
      horario_inicio_label,
      horario_fim_label,
      valor_unitario_label,
      valor_total_label,
      criado_em_label,
      forma_pagamento_label,
      encarregado_label,
      empresa_label,
      unidade_label,
      tipo_lancamento,
      // quantidade_colaboradores, // Mantido: é coluna no banco
      data,
      nf_emite,
      iss_percentual,
      valor_iss,
      valor_total_liquido,
      justificativa_data,
      placa_veiculo,
      valor_unitario_manual,
      status_financeiro,
      data_vencimento,
      horario_inicio,
      horario_fim,
      ...rest 
    } = payload;

    // Campos removidos pois NÃO existem na tabela operacoes_producao.
    // tipo_calculo: o campo correto é tipo_calculo_snapshot
    // *_label e origem: criados na camada de serviço para display
    void categoria_servico;
    void categoria_custo;
    void tipo_calculo;
    void descricao_servico;
    void modalidade_financeira;

    // Normaliza tipo_calculo_snapshot para os únicos valores aceitos pelo banco.
    // Valores legados ('fixo', 'operation', 'daily') são mapeados para 'volume'.
    // O único valor alternativo válido é 'colaborador'.
    const normalizeTipoCalculoSnapshot = (value: unknown): 'volume' | 'colaborador' => {
      if (value === 'colaborador') return 'colaborador';
      // Todos os outros ('fixo', 'operation', 'daily', 'volume', undefined, null)
      // são normalizados para 'volume'.
      return 'volume';
    };

    if (rest.tipo_calculo_snapshot !== undefined) {
      rest.tipo_calculo_snapshot = normalizeTipoCalculoSnapshot(rest.tipo_calculo_snapshot);
    } else {
      // Garantir que o campo sempre está presente com valor válido no INSERT
      rest.tipo_calculo_snapshot = 'volume';
    }

    return rest;
  }

  private buildLegacyTipoCalculoPayload(payload: Record<string, any>) {
    // Mantido por compatibilidade, mas o sanitize agora evita chegar aqui.
    return { ...payload };
  }

  private async getEmpresaIdsFromTenant(tenantId: string | null): Promise<string[] | null> {
    if (!tenantId) return null;
    const { data } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId);
    return data?.map(e => e.id) || null;
  }

  async isAvailable() {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .select('id')
      .limit(1);

    return !error;
  }

  async getInconsistencies() {
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, colaboradores:collaborator_id(id, nome, cargo, cpf)),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome),
        unidades:unidade_id(nome),
        operacao_producao_materiais!operacao_id(*)
      `)
      .in('status', ['inconsistente', 'com_alerta', 'aguardando_validacao', 'pendente', 'validado_rh', 'aprovado_financeiro', 'concluido'])
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateWithOverride(id: string, payload: Record<string, any>, justification: string) {
    if (justification) {
      payload.justificativa_retroativa = justification;
    }
    return this.update(id, payload);
  }

  async create(payload: Record<string, any>) {
    const tenantId = await getCurrentTenantId();
    const safePayload = { ...this.sanitizeOperacaoPayload(payload), tenant_id: tenantId };
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .insert(safePayload)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, colaboradores:collaborator_id(id, nome, cargo, cpf)),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome),
        unidades:unidade_id(nome)
      `)
      .single();

    if (error) {
      console.error('[OPERACOES_PRODUCAO] Erro ao inserir:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: safePayload,
      });
      throw error;
    }
    return data;
  }

  async createWithColaboradores(
    payload: Record<string, any>,
    colaboradores: Array<{
      collaborator_id: string;
      colaborador_id?: string;
      had_infraction: boolean;
      infraction_type_id?: string | null;
      infraction_notes?: string | null;
    }>,
    materiais?: Array<{
      material_id: string;
      nome_snapshot: string;
      unidade_snapshot: string;
      valor_unitario_snapshot: number;
      quantidade: number;
      valor_total: number;
    }>,
  ) {
    const registro = await this.create(payload);

    // 1. Vincular Colaboradores
    if (colaboradores && colaboradores.length > 0) {
      const colaboradoresNormalizados = colaboradores
        .map((item) => ({
          collaborator_id: item.collaborator_id ?? item.colaborador_id ?? null,
          had_infraction: item.had_infraction,
          infraction_type_id: item.infraction_type_id ?? null,
          infraction_notes: item.infraction_notes ?? null,
        }))
        .filter((item) => Boolean(item.collaborator_id));

      if (colaboradoresNormalizados.length > 0) {
        const { error } = await operationalClient
          .from('production_entry_collaborators')
          .insert(
            colaboradoresNormalizados.map((item) => ({
              production_entry_id: registro.id,
              collaborator_id: item.collaborator_id,
              had_infraction: item.had_infraction,
              infraction_type_id: item.infraction_type_id ?? null,
              infraction_notes: item.infraction_notes ?? null,
            })),
          );

        if (error) throw error;
      }
    }

    // 2. Vincular Materiais
    if (materiais && materiais.length > 0) {
      const { error: matError } = await operationalClient
        .from('operacao_producao_materiais')
        .insert(
          materiais.map((m) => ({
            operacao_id: registro.id,
            material_id: m.material_id,
            nome_snapshot: m.nome_snapshot,
            unidade_snapshot: m.unidade_snapshot,
            valor_unitario_snapshot: m.valor_unitario_snapshot,
            quantidade: m.quantidade,
            valor_total: m.valor_total,
          })),
        );

      if (matError) throw matError;
    }

    return this.getByDate(registro.data_operacao, registro.empresa_id, registro.unidade_id)
      .then((items) => items.find((item: any) => item.id === registro.id) ?? registro);
  }

  async vincularMateriais(
    operacaoId: string,
    materiais: Array<{
      material_id: string;
      nome_snapshot: string;
      unidade_snapshot: string;
      valor_unitario_snapshot: number;
      quantidade: number;
      valor_total: number;
    }>
  ) {
    if (!materiais || materiais.length === 0) return null;

    const { error } = await operationalClient
      .from('operacao_producao_materiais')
      .insert(
        materiais.map((m) => ({
          operacao_id: operacaoId,
          material_id: m.material_id,
          nome_snapshot: m.nome_snapshot,
          unidade_snapshot: m.unidade_snapshot,
          valor_unitario_snapshot: m.valor_unitario_snapshot,
          quantidade: m.quantidade,
          valor_total: m.valor_total,
        }))
      );

    if (error) throw error;
    return true;
  }

  async update(id: string, payload: Record<string, any>) {
    const safePayload = this.sanitizeOperacaoPayload(payload);
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .update(safePayload)
      .eq('id', id)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, colaboradores:collaborator_id(id, nome, cargo, cpf)),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome),
        unidades:unidade_id(nome),
        empresas:empresa_id(id, nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async getByDate(date: string, empresaId?: string, unidadeId?: string | null) {
    let query = operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, colaboradores:collaborator_id(id, nome, cargo, cpf)),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome),
        unidades:unidade_id(nome),
        empresas:empresa_id(id, nome),
        operacao_producao_materiais!operacao_id(*)
      `)
      .eq('data_operacao', date)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return [];

    const userIdsToFetch = Array.from(new Set(
      data.filter((row: any) => row.criado_por && !row.responsavel_nome).map((row: any) => row.criado_por)
    ));

    const responsaveisMap = new Map<string, string>();
    if (userIdsToFetch.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIdsToFetch);
        
      if (profiles) {
        profiles.forEach((p: any) => responsaveisMap.set(p.user_id, p.full_name));
      }
    }

    return data.map((item: any) => ({
      ...item,
      responsavel_nome: item.responsavel_nome ?? responsaveisMap.get(item.criado_por) ?? "—"
    }));
  }

  async getAll(empresaId?: string, tenantId?: string | null, unidadeId?: string | null, competencia?: string) {
    const currentTenantId = tenantId || await getCurrentTenantId();
    
    let query = operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, colaboradores:collaborator_id(id, nome, cargo, cpf)),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome),
        unidades:unidade_id(nome),
        empresas:empresa_id(id, nome),
        operacao_producao_materiais!operacao_id(*)
      `)
      .eq('tenant_id', currentTenantId)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }
    if (unidadeId) query = query.eq('unidade_id', unidadeId);
    if (typeof competencia === 'string' && competencia.includes('-')) {
      const parts = competencia.split('-');
      const year = Number(parts[0]);
      const moPart = parts[1];
      
      if (!year || isNaN(year)) return [];

      if (moPart === 'all' || !moPart || isNaN(Number(moPart))) {
        // Range anual: YYYY-01-01 até (YYYY+1)-01-01
        query = query.gte('data_operacao', `${year}-01-01`).lt('data_operacao', `${year + 1}-01-01`);
      } else {
        // Range mensal: YYYY-MM-01 até (YYYY-MM+1)-01
        const mo = Number(moPart);
        const nextMonth = mo === 12 ? 1 : mo + 1;
        const nextYear = mo === 12 ? year + 1 : year;
        const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        query = query.gte('data_operacao', `${year}-${String(mo).padStart(2, '0')}-01`).lt('data_operacao', nextMonthStr);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return [];

    const userIdsToFetch = Array.from(new Set(
      data.filter((row: any) => row.criado_por && !row.responsavel_nome).map((row: any) => row.criado_por)
    ));

    const responsaveisMap = new Map<string, string>();
    if (userIdsToFetch.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIdsToFetch);
        
      if (profiles) {
        profiles.forEach((p: any) => responsaveisMap.set(p.user_id, p.full_name));
      }
    }

    return data.map((item: any) => ({
      ...item,
      responsavel_nome: item.responsavel_nome ?? responsaveisMap.get(item.criado_por) ?? "—"
    }));
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getProfile(userId: string) {
    return supabase
      .from('profiles')
      .select('*, perfis:perfis_usuarios(*)')
      .eq('user_id', userId)
      .maybeSingle();
  }

  async cancel(id: string, userId: string, reason: string) {
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .update({
        status: 'cancelado',
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        motivo_exclusao: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteImported(empresaId?: string | null, dataInicio?: string, dataFim?: string) {
    let query = operationalClient
      .from('operacoes_producao')
      .delete()
      .select('id')
      .in('origem_dado', ['importacao', 'ajuste']);

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (dataInicio) query = query.gte('data_operacao', dataInicio);
    if (dataFim)    query = query.lte('data_operacao', dataFim);

    const { data, error } = await query;
    if (error) {
      const errorMessage = String((error as any)?.message ?? "");
      const errorCode = String((error as any)?.code ?? "");
      if (errorCode === 'PGRST205' || errorMessage.includes('custos_extras_operacionais')) {
        throw new Error('A tabela de custos extras ainda nao existe no banco. Aplique a migration 20260430170000_custos_extras_operacionais.sql.');
      }
      throw error;
    }
    return data?.length ?? 0;
  }

  async deleteImportedByDates(datas: string[], empresaId?: string | null) {
    const uniqueDates = Array.from(new Set(datas.filter(Boolean)));
    if (uniqueDates.length === 0) return 0;

    let query = operationalClient
      .from('operacoes_producao')
      .delete()
      .select('id')
      .eq('origem_dado', 'importacao')
      .in('data_operacao', uniqueDates);

    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) throw error;
    return data?.length ?? 0;
  }

  async replaceImportedBatch(empresaId: string, items: Record<string, unknown>[]) {
    const { data, error } = await operationalClient.rpc('replace_imported_operacoes_producao', {
      p_empresa_id: empresaId,
      p_items: items,
    });

    if (error) throw error;
    return Number(data ?? 0);
  }

  async getResumoDoDia(date: string, empresaId?: string, unidadeId?: string | null) {
    let query = operationalClient
      .from('vw_operacoes_producao_resumo_dia')
      .select('*')
      .eq('data_operacao', date);

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMonthsWithData(empresaId?: string, tenantId?: string | null) {
    const currentTenantId = tenantId || await getCurrentTenantId();
    
    let query = operationalClient
      .from('operacoes_producao')
      .select('data_operacao')
      .eq('tenant_id', currentTenantId)
      .is('deleted_at', null)
      .order('data_operacao', { ascending: false })
      .limit(1000);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const months = new Set<string>();
    for (const row of data ?? []) {
      const dataMes = String(row.data_operacao ?? '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(dataMes)) {
        months.add(dataMes);
      }
    }

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }
}
export const OperacaoProducaoService = new OperacaoProducaoServiceClass();
class OperacaoProducaoMateriaisServiceClass extends BaseService<'operacao_producao_materiais'> {
  constructor() { super('operacao_producao_materiais'); }

  async getByOperacao(operacaoId: string) {
    const { data, error } = await supabase
      .from('operacao_producao_materiais')
      .select('*')
      .eq('operacao_id', operacaoId);
    if (error) throw error;
    return data ?? [];
  }
}
export const OperacaoProducaoMateriaisService = new OperacaoProducaoMateriaisServiceClass();
