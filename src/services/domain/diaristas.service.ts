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



class LancamentoDiaristaServiceClass {
  async getByPeriodo(
    empresaId: string | null | undefined,
    inicio: string,
    fim: string,
    filtros?: {
      diarista_nome?: string;
      funcao?: string;
      status?: StatusLancamentoDiarista;
      cliente_unidade?: string;
      encarregado_id?: string;
    },
  ) {
    const client = supabase as any;

    let query = client
      .from('lancamentos_diaristas')
      .select(`
        *,
        empresa:empresas(id, nome)
      `)
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim);

    // Aplica filtro de empresa quando fornecido
    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    // Aplica filtros opcionais
    if (filtros?.status) {
      // Aceita tanto lowercase quanto uppercase
      const statusLower = filtros.status.toLowerCase();
      const statusUpper = filtros.status.toUpperCase();
      if (statusLower === statusUpper) {
        query = query.eq('status', filtros.status);
      } else {
        query = query.in('status', [statusLower, statusUpper, filtros.status]);
      }
    }

    if (filtros?.encarregado_id) {
      query = query.eq('encarregado_id', filtros.encarregado_id);
    }

    const { data, error } = await query;
    console.log(`[DiaristaService.getByPeriodo] empresa=${empresaId ?? 'TODAS'} periodo=${inicio}→${fim} status=${filtros?.status ?? 'todos'} | resultado=${(data ?? []).length} registros`, error ? `ERRO: ${error.message}` : '');
    if (error) throw error;
    return data ?? [];
  }

  async getByData(empresaId: string, data: string) {
    const { data: result, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select(`*`)
      .eq('empresa_id', empresaId)
      .eq('data_lancamento', data);

    if (error) throw error;
    return result ?? [];
  }

  async getByLoteId(loteId: string) {
    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .order('nome_colaborador', { ascending: true })
      .order('data_lancamento', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async criarAjuste(params: {
    empresaId: string;
    referenciaLancamentoId: string;
    valorAjuste: number;
    motivo: string;
    adjustedBy: string;
    adjustedByNome: string;
    original: {
      diarista_id: string;
      nome_colaborador: string;
      funcao_colaborador: string;
      data_lancamento: string;
      codigo_marcacao: string;
      lote_fechamento_id: string;
    }
  }) {
    const tenantId = await getCurrentTenantId();
    const payload = {
      tenant_id: tenantId,
      empresa_id: params.empresaId,
      diarista_id: params.original.diarista_id,
      nome_colaborador: params.original.nome_colaborador,
      funcao_colaborador: params.original.funcao_colaborador,
      data_lancamento: params.original.data_lancamento,
      codigo_marcacao: params.original.codigo_marcacao,
      quantidade_diaria: 0,
      valor_calculado: params.valorAjuste,
      tipo_registro: 'ajuste',
      status: 'EM_ABERTO', // Ou poderia pegar o status do lote
      referencia_lancamento_id: params.referenciaLancamentoId,
      lote_fechamento_id: params.original.lote_fechamento_id,
      motivo_ajuste: params.motivo,
      adjusted_by: params.adjustedBy,
      adjusted_by_nome: params.adjustedByNome,
      adjusted_at: new Date().toISOString()
    };

    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .insert([payload])
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async apagarLoteAberto(empresaId: string, registros: { diarista_id: string; data: string }[]) {
    if (registros.length === 0) return true;
    
    const diaristaIds = [...new Set(registros.map(r => r.diarista_id))];
    const datas = [...new Set(registros.map(r => r.data))];

    const { error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .delete()
      .eq('empresa_id', empresaId)
      .in('diarista_id', diaristaIds)
      .in('data_lancamento', datas)
      .in('status', ['em_aberto', 'EM_ABERTO']);

    if (error) throw error;
    return true;
  }

  async createBatch(registros: LancamentoDiaristaPayload[]) {
    if (registros.length === 0) return [];

    const tenantId = await getCurrentTenantId();

    // Whitelist: somente colunas que existem na tabela lancamentos_diaristas
    const VALID_COLUMNS = new Set([
      'empresa_id', 'diarista_id', 'nome_colaborador', 'cpf_colaborador',
      'funcao_colaborador', 'data_lancamento', 'codigo_marcacao',
      'quantidade_diaria', 'valor_diaria_base', 'valor_calculado',
      'cliente_unidade', 'operacao_servico', 'encarregado_id',
      'encarregado_nome', 'observacao', 'status', 'lote_fechamento_id',
      'unidade_id', 'local_id', 'tipo_registro',
      'editado_admin', 'editado_por', 'editado_em', 'motivo_edicao',
      'tenant_id',
    ]);

    const payload = registros.map((r) => {
      const raw: Record<string, unknown> = { ...r, tenant_id: tenantId, status: 'EM_ABERTO' };
      // Remove campos que não existem na tabela (ex: tipo_lancamento)
      const sanitized: Record<string, unknown> = {};
      for (const key of Object.keys(raw)) {
        if (VALID_COLUMNS.has(key)) {
          sanitized[key] = raw[key];
        }
      }
      return sanitized;
    });

    // Estratégia idempotente: DELETE + INSERT
    // Apaga registros em aberto existentes para as mesmas chaves (empresa/diarista/data)
    // antes de inserir os novos. Isso evita duplicatas sem depender de constraint parcial.
    const chaves = payload.map(p => ({
      empresa_id: p.empresa_id as string,
      diarista_id: p.diarista_id as string,
      data_lancamento: p.data_lancamento as string,
    }));

    // Agrupa por empresa para minimizar roundtrips
    const empresaId = chaves[0]?.empresa_id;
    if (empresaId) {
      const datas = [...new Set(chaves.map(c => c.data_lancamento))];
      const diaristaIds = [...new Set(chaves.map(c => c.diarista_id))];

      await (supabase as any)
        .from('lancamentos_diaristas')
        .delete()
        .eq('empresa_id', empresaId)
        .in('diarista_id', diaristaIds)
        .in('data_lancamento', datas)
        .in('status', ['em_aberto', 'EM_ABERTO']);
    }

    console.log(`[DiaristaService.createBatch] Inserindo ${payload.length} registros. Primeiro:`, payload[0]);
    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .insert(payload)
      .select('id, nome_colaborador, data_lancamento');

    if (error) {
      console.error(`[DiaristaService.createBatch] ERRO no INSERT:`, error);
      throw error;
    }
    console.log(`[DiaristaService.createBatch] OK — ${(data ?? []).length} registros inseridos`);
    return data ?? [];
  }

  async updateAdmin(id: string, payload: Partial<LancamentoDiaristaPayload> & { editado_admin: boolean; editado_por: string; editado_em: string; motivo_edicao: string }) {
      const { data, error } = await (supabase as any)
        .from('lancamentos_diaristas')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
  }

  async deleteAdmin(id: string) {
      const { error } = await (supabase as any)
        .from('lancamentos_diaristas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
  }
}
export const LancamentoDiaristaService = new LancamentoDiaristaServiceClass();

class LoteFechamentoDiaristaServiceClass extends BaseService<'diaristas_lotes_fechamento'> {
  constructor() {
    super('diaristas_lotes_fechamento');
  }

  async getLotes(empresaId: string, mes: string) {
    const { data, error } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('mes_referencia', mes);
    if (error) throw error;
    return data;
  }

  async getLotesPorPeriodo(inicio: string, fim: string, empresaId?: string | null) {
    // Lógica de INTERSEÇÃO: retorna lotes cujo período se sobrepõe ao intervalo filtrado.
    // Um lote intersecta [inicio, fim] se: periodo_inicio <= fim AND periodo_fim >= inicio
    // (ao contrário da lógica de contenção que só retornava lotes completamente dentro do filtro)
    let query = this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .lte('periodo_inicio', fim)    // lote começa antes ou no final do nosso período
      .gte('periodo_fim', inicio)    // lote termina depois ou no início do nosso período
      .order('created_at', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getLancamentosByLoteIds(loteIds: string[]) {
    if (!loteIds.length) return [];
    const { data, error } = await (this.supabase as any)
      .from('lancamentos_diaristas')
      .select(`
        *,
        empresa:empresas(id, nome)
      `)
      .in('lote_fechamento_id', loteIds)
      .order('data_lancamento', { ascending: true });
    if (error) {
      console.error('[LoteFechamentoDiaristaService.getLancamentosByLoteIds] Erro:', error);
      throw error;
    }
    return data ?? [];
  }

  async getByEmpresaParaFinanceiro(empresaId: string) {
    const { data, error } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('empresa_id', empresaId)
      .in('status', ['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'pago', 'cnab_gerado'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getLoteDetalhe(loteId: string) {
    const { data: lote, error: loteError } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('id', loteId)
      .single();

    if (loteError) throw loteError;

    const { data: itens, error: itensError } = await this.supabase
      .from('lancamentos_diaristas')
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .order('nome_colaborador', { ascending: true });

    if (itensError) throw itensError;

    const mappedItens = (itens || []).map(it => ({
      id: it.id,
      tipo_evento: it.tipo_registro === 'ajuste' ? 'AJUSTE' : 'DIARIA',
      nome_colaborador: it.nome_colaborador,
      minutos: 0,
      horas: it.quantidade_diaria || 1,
      valor_calculado: it.valor_calculado,
      status: it.status
    }));

    // Contagem de colaboradores distintos
    const distinctColaboradores = new Set((itens || []).map(it => it.diarista_id)).size;

    // Mapear para o formato que o modal da Central Financeira espera
    return {
      ...lote,
      competencia: lote.mes_referencia, // Mapeia mes_referencia para competencia
      total_colaboradores: distinctColaboradores || lote.total_registros, // Mapeia total_registros ou conta distintos
      itens: mappedItens
    };
  }

  async fecharPeriodo({ empresaId, periodoInicio, periodoFim, fechadoPor, fechadoPorNome, fechadoPorRole, observacoes, tipoFechamento = 'operacional' }: {
    empresaId: string;
    periodoInicio: string;
    periodoFim: string;
    fechadoPor: string;
    fechadoPorNome: string;
    fechadoPorRole: string;
    observacoes?: string;
    tipoFechamento?: 'operacional' | 'administrativo';
  }) {
    const { data: lancamentos, error: errorLanc } = await this.supabase
      .from('lancamentos_diaristas')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('data_lancamento', periodoInicio)
      .lte('data_lancamento', periodoFim)
      .in('status', ['em_aberto', 'EM_ABERTO']);

    if (errorLanc) throw errorLanc;

    const diaristasMap = new Map();
    let totalRegistros = 0;
    let valorTotal = 0;

    (lancamentos || []).forEach((l: any) => {
      const key = l.diarista_id;
      if (!diaristasMap.has(key)) {
        diaristasMap.set(key, {
          diarista_id: key,
          nome_colaborador: l.nome_colaborador || 'Diarista',
          cpf: l.cpf_colaborador ?? null,
          banco: null,
          agencia: null,
          conta: null,
          quantidade_dias: 0,
          valor_dia: l.valor_diaria_base || 0,
          valor_final: 0,
        });
      }
      const entry = diaristasMap.get(key);
      entry.quantidade_dias += l.quantidade_diaria ?? 1;
      entry.valor_final += l.valor_calculado ?? 0;
      totalRegistros += 1;
      valorTotal += l.valor_calculado ?? 0;
    });

    const mesRef = periodoInicio.substring(0, 7);

    const tenantId = await getCurrentTenantId();

    // Verifica se já existe um lote para o período e empresa
    let { data: loteExistente } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('periodo_inicio', periodoInicio)
      .eq('periodo_fim', periodoFim)
      .single();

    let lote;

    if (loteExistente) {
      // Reutiliza o lote existente, atualizando os valores
      const { data: loteAtualizado, error: errorUpdate } = await this.supabase
        .from('diaristas_lotes_fechamento')
        .update({
          total_registros: totalRegistros,
          valor_total: valorTotal,
          status: 'AGUARDANDO_VALIDACAO_RH', // Garante que o status seja atualizado
          fechado_por: fechadoPor,
          fechado_por_nome: fechadoPorNome,
          fechado_em: new Date().toISOString(),
          observacoes,
          // tipo_fechamento: tipoFechamento, // Removido temporariamente para evitar erro de coluna inexistente
        })
        .eq('id', loteExistente.id)
        .select()
        .single();
      
      if (errorUpdate) throw errorUpdate;
      lote = loteAtualizado;

    } else {
      // Cria um novo lote se não existir
      const { data: novoLote, error: errorLote } = await this.supabase
        .from('diaristas_lotes_fechamento')
        .insert({
          empresa_id: empresaId,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          mes_referencia: mesRef,
          total_registros: totalRegistros,
          valor_total: valorTotal,
          status: 'AGUARDANDO_VALIDACAO_RH',
          fechado_por: fechadoPor,
          fechado_por_nome: fechadoPorNome,
          fechado_em: new Date().toISOString(),
          observacoes,
          // tipo_fechamento: tipoFechamento, // Removido temporariamente para evitar erro de coluna inexistente
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (errorLote) throw errorLote;
      lote = novoLote;
    }

    if (!lote) {
      throw new Error("Não foi possível criar ou encontrar um lote de fechamento.");
    }

    const { error: fecharError } = await this.supabase.rpc('fechar_periodo_diaristas', {
      p_empresa_id: empresaId,
      p_periodo_inicio: periodoInicio,
      p_periodo_fim: periodoFim,
      p_lote_id: lote.id,
      p_tenant_id: tenantId,
      p_usuario_id: fechadoPor,
      p_usuario_nome: fechadoPorNome,
      p_usuario_role: fechadoPorRole
    });

    if (fecharError) throw fecharError;

    return {
      ...lote,
      total_registros: totalRegistros,
      valor_total: valorTotal,
    };
  }

  async validarPeriodo(loteId: string, usuarioId: string, usuarioNome: string, usuarioRole: string) {
    const { error } = await this.supabase.rpc('validar_periodo_diaristas', {
      p_lote_id: loteId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
      p_usuario_role: usuarioRole
    });
    if (error) throw error;
    return true;
  }

  async validarEEncerrar(loteId: string, usuarioId: string, usuarioNome: string, usuarioRole: string, targetStatus: 'FECHADO_FINANCEIRO' | 'PAGO') {
    const { error } = await this.supabase.rpc('validar_e_encerrar_diaristas', {
      p_lote_id: loteId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
      p_usuario_role: usuarioRole,
      p_target_status: targetStatus
    });
    if (error) throw error;
    return true;
  }

  async reabrirPeriodo(
    loteId: string,
    usuarioId: string,
    usuarioNome: string,
    usuarioRole: string,
    motivo: string,
    tipoReabertura: 'operacional' | 'administrativa' = 'operacional'
  ) {
    const { error } = await (this.supabase as any).rpc('reabrir_periodo_diaristas', {
      p_lote_id:          loteId,
      p_usuario_id:       usuarioId,
      p_usuario_nome:     usuarioNome,
      p_usuario_role:     usuarioRole,
      p_motivo:           motivo,
      p_tipo_reabertura:  tipoReabertura,
    });
    if (error) throw error;
    return true;
  }

  async aprovarFinanceiro(loteId: string, usuarioId: string, usuarioNome: string, usuarioRole: string) {
    const { error } = await this.supabase.rpc('aprovar_financeiro_diaristas', {
      p_lote_id: loteId,
      p_usuario_id: usuarioId,
      p_usuario_nome: usuarioNome,
      p_usuario_role: usuarioRole
    });
    if (error) throw error;
    return true;
  }

  async marcarComoPago(loteId: string, usuarioId: string | undefined, usuarioNome: string) {
    void loteId;
    void usuarioId;
    void usuarioNome;
    throw new Error('Pagamento manual desabilitado: o lote de diaristas so pode virar PAGO apos retorno bancario conciliado.');
    /*
    
    if (!lote) throw new Error('Lote não encontrado.');
    if (String(lote.status) !== 'cnab_gerado') {
      throw new Error('Pagamento bloqueado: o lote precisa ter remessa CNAB gerada antes da liquidação manual.');
    }

    // Usa RPC SECURITY DEFINER para garantir bypass de RLS e atomicidade
    */
    // (atualiza lote + lançamentos + log em uma transação)
  }


  // ─── CNAB240 ─────────────────────────────────────────────────────────────
  // Gera o arquivo de remessa CNAB240 FEBRABAN real para pagamento de diaristas.
  // Layout posicional: cada linha tem EXATAMENTE 240 caracteres.
  // Segmentos: Header Arquivo (0), Header Lote (1), Segmento A (3A),
  // Segmento B (3B), Trailer Lote (5), Trailer Arquivo (9).
  // Exportação: Windows-1252 (ANSI) conforme padrão bancário.
  async gerarCNABParaLote(params: {
    loteId: string;
    empresaId: string;
    geradoPor: string;
    geradoPorNome: string;
    empresaRemetente: {
      cnpj: string;
      razao_social: string;
      banco_codigo: string;
      agencia: string;
      agencia_digito?: string;
      conta: string;
      digito_conta?: string;
      convenio_bancario?: string;
      codigo_empresa_banco?: string;
      nome_empresa_banco?: string;
    };
  }): Promise<{ nomeArquivo: string; totalRegistros: number; valorTotal: number }> {
    const { loteId, empresaId, geradoPor, geradoPorNome, empresaRemetente } = params;
    const normalizeDigits = (value?: string | null) => String(value ?? '').replace(/\D/g, '');

    // ── 1. Buscar lote ────────────────────────────────────────────────────────
    const { data: lote, error: loteErr } = await this.supabase
      .from('diaristas_lotes_fechamento')
      .select('*')
      .eq('id', loteId)
      .single();
    if (loteErr || !lote) throw new Error('Lote não encontrado.');
    if (!['FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO'].includes(String(lote.status || ''))) {
      throw new Error('Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro antes da remessa.');
    }

    // ── 2. Buscar lançamentos — tenta por lote_fechamento_id, depois por período
    let lancamentos: any[] = [];
    const { data: porLote } = await this.supabase
      .from('lancamentos_diaristas' as any)
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .neq('tipo_registro', 'ajuste');

    if (porLote && porLote.length > 0) {
      lancamentos = porLote;
    } else {
      const { data: porPeriodo } = await this.supabase
        .from('lancamentos_diaristas' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data_lancamento', lote.periodo_inicio)
        .lte('data_lancamento', lote.periodo_fim)
        .neq('tipo_registro', 'ajuste');
      lancamentos = porPeriodo ?? [];
    }

    if (lancamentos.length === 0)
      throw new Error('Nenhum lançamento encontrado para este lote.');

    // ── 3. Agregar valores por diarista ───────────────────────────────────────
    const diaristasMap = new Map<string, {
      diarista_id: string;
      nome: string;
      cpf: string;
      valor: number;
    }>();

    for (const l of lancamentos) {
      const key = l.diarista_id || l.nome_colaborador;
      if (!diaristasMap.has(key)) {
        diaristasMap.set(key, {
          diarista_id: l.diarista_id ?? '',
          nome: l.nome_colaborador ?? '',
          cpf: l.cpf_colaborador ?? '',
          valor: 0,
        });
      }
      diaristasMap.get(key)!.valor += Number(l.valor_calculado || 0);
    }

    // ── 4. Buscar dados bancários dos colaboradores ───────────────────────────
    const diaristasIds = Array.from(diaristasMap.values())
      .map(d => d.diarista_id)
      .filter(Boolean);

    const { data: colaboradoresData } = await this.supabase
      .from('colaboradores' as any)
      .select('id, nome, nome_completo, cpf, banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta')
      .in('id', diaristasIds.length > 0 ? diaristasIds : ['00000000-0000-0000-0000-000000000000']);

    const colaboradoresMap = new Map<string, any>();
    for (const c of (colaboradoresData ?? [])) {
      colaboradoresMap.set(c.id, c);
    }

    // ── 5. Validar e montar lista de beneficiários ────────────────────────────
    const pendencias: string[] = [];
    const beneficiarios: BeneficiarioPagamento[] = [];
    const now = new Date();

    for (const [, d] of diaristasMap) {
      const col = colaboradoresMap.get(d.diarista_id);
      const banco        = col?.banco_codigo?.trim();
      const agencia      = col?.agencia?.trim();
      const conta        = col?.conta?.trim();
      const digito       = col?.digito_conta?.trim();
      const agDigito     = col?.agencia_digito?.trim() || ' ';
      const cpf          = (col?.cpf || d.cpf || '').replace(/\D/g, '');
      const tipoConta    = col?.tipo_conta === 'poupanca' ? 'poupanca' as const : 'corrente' as const;

      const faltando: string[] = [];
      if (!banco)             faltando.push('banco');
      if (!agencia)           faltando.push('agência');
      if (!conta)             faltando.push('conta');
      if (!digito)            faltando.push('dígito da conta');
      if (cpf.length !== 11)  faltando.push(`CPF inválido (${cpf.length} dígitos)`);
      if (d.valor <= 0)       faltando.push('valor zerado ou negativo');

      if (faltando.length > 0) {
        pendencias.push(`${d.nome}: falta ${faltando.join(', ')}`);
      } else {
        beneficiarios.push({
          nome:           col?.nome_completo?.trim() || d.nome,
          cpf,
          valor:          d.valor,
          banco_codigo:   banco!,
          agencia:        agencia!,
          agencia_digito: agDigito,
          conta:          conta!,
          conta_digito:   digito!,
          tipo_conta:     tipoConta,
          data_pagamento: now,
        });
      }
    }

    // Bloquear se há pendências
    if (pendencias.length > 0) {
      throw new Error(
        `Dados bancários incompletos para ${pendencias.length} diarista(s):\n\n` +
        pendencias.map(p => `• ${p}`).join('\n') +
        '\n\nAtualize o cadastro de cada diarista antes de gerar o CNAB.'
      );
    }

    // ── 6. Montar empresa remetente ───────────────────────────────────────────
    const empresaRemessa: EmpresaRemessa = {
      cnpj:           (empresaRemetente.cnpj || '').replace(/\D/g, ''),
      razao_social:   empresaRemetente.razao_social,
      agencia:        empresaRemetente.agencia,
      agencia_digito: empresaRemetente.agencia_digito || ' ',
      conta:          empresaRemetente.conta,
      conta_digito:   empresaRemetente.digito_conta || ' ',
      convenio:       empresaRemetente.convenio_bancario || '',
    };
    const { data: contasEmpresaData } = await this.supabase
      .from('contas_bancarias_empresa')
      .select('id, banco_codigo, banco_nome, agencia, agencia_digito, conta, conta_digito, convenio, ativo, is_padrao')
      .eq('empresa_id', empresaId)
      .eq('ativo', true);

    const contaBancariaSelecionada = (contasEmpresaData ?? []).find((conta: any) =>
      normalizeDigits(conta?.banco_codigo) === normalizeDigits(empresaRemetente.banco_codigo) &&
      normalizeDigits(conta?.agencia) === normalizeDigits(empresaRemetente.agencia) &&
      normalizeDigits(conta?.conta) === normalizeDigits(empresaRemetente.conta) &&
      normalizeDigits(conta?.convenio) === normalizeDigits(empresaRemetente.convenio_bancario)
    ) ?? (contasEmpresaData ?? []).find((conta: any) => Boolean(conta?.is_padrao)) ?? null;

    let sequencialArquivo = 1;
    if (contaBancariaSelecionada?.id) {
      sequencialArquivo = await CnabRemessaArquivoService.getNextSequencial(
        contaBancariaSelecionada.id,
        empresaRemetente.banco_codigo || '001'
      );
    } else {
      const { data: ultimoSequencial } = await this.supabase
        .from('cnab_remessas_arquivos')
        .select('sequencial_arquivo')
        .eq('banco_codigo', empresaRemetente.banco_codigo || '001')
        .is('conta_bancaria_id', null)
        .order('sequencial_arquivo', { ascending: false })
        .limit(1)
        .maybeSingle();

      sequencialArquivo = Math.max(1, Number(ultimoSequencial?.sequencial_arquivo || 0) + 1);
    }

    // ── 7. Gerar CNAB240 posicional ───────────────────────────────────────────
    // Tipo serviço: 20=Fornecedor (pagamentos a prestadores de serviço)
    const resultado = gerarCNAB240BB(empresaRemessa, beneficiarios, {
      tipo_servico: 20,
      numero_arquivo: sequencialArquivo,
    });

    // ── 8. Disparar download ──────────────────────────────────────────────────
    // Exportação em Windows-1252 (ANSI) — padrão bancário FEBRABAN
    const tenantId = await getCurrentTenantId();
    await CnabRemessaArquivoService.registrar({
      loteId: null,
      diaristasLoteId: loteId,
      nomeArquivo: resultado.nome_arquivo,
      conteudoArquivo: resultado.conteudo,
      totalRegistros: resultado.total_linhas,
      totalValor: resultado.valor_total,
      bancoCodigo: empresaRemetente.banco_codigo || '001',
      bancoNome: empresaRemetente.nome_empresa_banco || contaBancariaSelecionada?.banco_nome || 'BANCO DO BRASIL',
      contaBancariaId: contaBancariaSelecionada?.id,
      competencia: lote.mes_referencia,
      modo: 'producao',
      sequencialArquivo,
    });
    downloadCNAB240(resultado);

    // ── 9. Atualizar status do lote ───────────────────────────────────────────
    await this.supabase
      .from('diaristas_lotes_fechamento')
      .update({
        status: 'cnab_gerado',
        status_conciliacao: 'aguardando_conciliacao',
        updated_at: new Date().toISOString(),
      })
      .eq('id', loteId);

    // ── 10. Registrar auditoria ───────────────────────────────────────────────
    await this.supabase.from('diaristas_logs_fechamento' as any).insert({
      empresa_id:     empresaId,
      tenant_id:      tenantId,
      usuario_id:     geradoPor,
      usuario_nome:   geradoPorNome,
      usuario_role:   'financeiro',
      acao:           'GEROU_CNAB',
      periodo_inicio: lote.periodo_inicio,
      periodo_fim:    lote.periodo_fim,
      motivo: [
        `Arquivo CNAB240 gerado: ${resultado.nome_arquivo}`,
        `Beneficiários: ${resultado.total_beneficiarios}`,
        `Total linhas: ${resultado.total_linhas}`,
        `Valor total: R$ ${resultado.valor_total.toFixed(2)}`,
      ].join(' | '),
    });

    return {
      nomeArquivo:    resultado.nome_arquivo,
      totalRegistros: resultado.total_beneficiarios,
      valorTotal:     resultado.valor_total,
    };
  }
}
export const LoteFechamentoDiaristaService = new LoteFechamentoDiaristaServiceClass();

// SERVIÇO DE CICLOS DE DIARISTAS
class DiaristaCicloServiceClass {
  async getRegraFechamento() {
    const { data, error } = await supabase
      .from('regras_fechamento')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateRegraFechamento(id: string, payload: any) {
    const { data, error } = await supabase
      .from('regras_fechamento')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getCicloAtual() {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .eq('status', 'aberto')
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getCiclos(limit = 10) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async getCicloById(id: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async criarCiclo(dataInicio: string, dataFim: string, regraId?: string) {
    const regra = regraId ? { regra_fechamento_id: regraId } : {};
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .insert({
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'aberto',
        ...regra
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async criarCicloSemanal(diaFechamento: number) {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diasAteSexta = (5 - diaSemana + 7) % 7 || 7;
    
    const dataFim = new Date(hoje);
    dataFim.setDate(hoje.getDate() + diasAteSexta);
    
    const dataInicio = new Date(dataFim);
    dataInicio.setDate(dataFim.getDate() - 6);

    return this.criarCiclo(
      dataInicio.toISOString().split('T')[0],
      dataFim.toISOString().split('T')[0]
    );
  }

  async fecharCiclo(id: string, userId: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .update({
        status: 'fechado',
        fechado_por: userId,
        fechado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async enviarFinanceiro(id: string, userId: string) {
    const { data, error } = await supabase
      .from('ciclos_diaristas')
      .update({
        status: 'enviado',
        enviado_por: userId,
        enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getLotes() {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .select('*, ciclos:ciclo_id(data_inicio, data_fim)')
      .order('gerado_em', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getLoteByCiclo(cicloId: string) {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .select('*, itens:lote_pagamento_itens(*)')
      .eq('ciclo_id', cicloId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async criarLote(cicloId: string, userId: string, itens: any[]) {
    const valorTotal = itens.reduce((sum, item) => sum + Number(item.valor_final || 0), 0);

    const { data: lote, error: errorLote } = await supabase
      .from('lote_pagamento_diaristas')
      .insert({
        ciclo_id: cicloId,
        quantidade_diaristas: itens.length,
        valor_total: valorTotal,
        status: 'pendente',
        gerado_por: userId,
        gerado_em: new Date().toISOString()
      })
      .select()
      .single();
    if (errorLote) throw errorLote;

    const itensComLote = itens.map(item => ({
      ...item,
      lote_id: lote.id
    }));

    const { error: errorItens } = await supabase
      .from('lote_pagamento_itens')
      .insert(itensComLote);
    if (errorItens) throw errorItens;

    await supabase
      .from('ciclos_diaristas')
      .update({ valor_total: valorTotal, diaristas_count: itens.length })
      .eq('id', cicloId);

    return this.getLoteByCiclo(cicloId);
  }

  async marcarEnviadoFinanceiro(loteId: string) {
    const { data, error } = await supabase
      .from('lote_pagamento_diaristas')
      .update({
        enviado_financeiro: true,
        enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', loteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async adicionarLancamento(cicloId: string, colaboradorId: string, tipo: string, valor: number, motivo: string, userId: string) {
    const { data, error } = await supabase
      .from('lancamentos_adicionais_diaristas')
      .insert({
        ciclo_id: cicloId,
        colaborador_id: colaboradorId,
        tipo,
        valor,
        motivo,
        criado_por: userId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getLancamentosByCiclo(cicloId: string) {
    const { data, error } = await supabase
      .from('lancamentos_adicionais_diaristas')
      .select('*')
      .eq('ciclo_id', cicloId);
    if (error) throw error;
    return data ?? [];
  }

  async verificarFechamentoAutomatico() {
    const regra = await this.getRegraFechamento();
    if (!regra || !regra.auto_fechar) return null;

    const hoje = new Date();
    const diaSemana = hoje.getDay();

    if (diaSemana !== regra.dia_fechamento) return null;

    const cicloAberto = await this.getCicloAtual();
    if (!cicloAberto) return null;

    return { cicloId: cicloAberto.id, regra };
  }
}

export const DiaristaCicloService = new DiaristaCicloServiceClass();