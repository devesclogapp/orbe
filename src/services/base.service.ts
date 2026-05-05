import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Table = keyof Database['public']['Tables'];

// SERVIÇO GENÉRICO DE CRUD
export class BaseService<T extends Table> {
  public supabase = supabase;
  constructor(protected table: T) {}

  async getAll() {
    const { data, error } = await supabase.from(this.table).select('*');
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase.from(this.table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(payload: Database['public']['Tables'][T]['Insert']) {
    const { data, error } = await supabase.from(this.table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database['public']['Tables'][T]['Update']) {
    const { data, error } = await supabase.from(this.table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async updateWithOverride(id: string, payload: Database['public']['Tables'][T]['Update'], justification: string) {
    const { error: rpcError } = await supabase.rpc('set_session_variable', {
      name: 'app.override_justification',
      value: justification
    });

    if (rpcError) {
      console.error('Erro ao definir justificativa de override:', rpcError);
      throw new Error('Falha ao registrar justificativa no servidor.');
    }

    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from(this.table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

// ==================================================
// SERVIÇOS ESPECÍFICOS
// ==================================================

class EmpresaServiceClass extends BaseService<'empresas'> {
  constructor() { super('empresas'); }

  async getAll() {
    const { data, error, count } = await supabase
      .from('empresas')
      .select('*', { count: 'exact' });
    console.log('EmpresaService.getAll:', { data, error, count });
    if (error) throw error;
    return data;
  }

  async getWithCounts() {
    const { data, error } = await supabase
      .from('empresas')
      .select(`
        *,
        colaboradores:colaboradores(count),
        coletores:coletores(count)
      `);
    if (error) throw error;

    return data.map(item => ({
      ...item,
      total_colaboradores: (item.colaboradores as any)?.[0]?.count || 0,
      total_coletores: (item.coletores as any)?.[0]?.count || 0
    }));
  }
}
export const EmpresaService = new EmpresaServiceClass();

class ColaboradorServiceClass extends BaseService<'colaboradores'> {
  constructor() { super('colaboradores'); }

  async getWithEmpresa(empresaId?: string) {
    let query = supabase
      .from('colaboradores')
      .select('*, empresas(nome, cidade, estado)')
      .order('created_at', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
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
}
export const ColaboradorService = new ColaboradorServiceClass();

class PerfilUsuarioServiceClass extends BaseService<'perfis_usuarios'> {
  constructor() { super('perfis_usuarios'); }
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('perfis_usuarios')
      .select('*, empresas(nome, cidade, estado)')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
export const PerfilUsuarioService = new PerfilUsuarioServiceClass();

class ColetorServiceClass extends BaseService<'coletores'> {
  constructor() { super('coletores'); }
  async getWithEmpresa() {
    const { data, error } = await supabase.from('coletores').select('*, empresas(nome)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const ColetorService = new ColetorServiceClass();

class LogSincronizacaoServiceClass extends BaseService<'logs_sincronizacao'> {
  constructor() { super('logs_sincronizacao'); }
  async getWithEmpresa() {
    const { data, error } = await supabase.from('logs_sincronizacao').select('*, empresas(nome)').order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const LogSincronizacaoService = new LogSincronizacaoServiceClass();

class ResultadosServiceClass extends BaseService<'resultados_processamento'> {
  constructor() { super('resultados_processamento'); }

  async getSummary() {
    const { data, error } = await supabase.from('resultados_processamento').select('*, empresas(nome)').order('data', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getByMonth(month: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('resultados_processamento')
      .select('*')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr)
      .order('data', { ascending: true });
    if (error) throw error;
    return data;
  }
}
export const ResultadosService = new ResultadosServiceClass();

class OperacaoServiceClass extends BaseService<'operacoes'> {
  constructor() { super('operacoes'); }

  async getAllPainel(empresaId?: string) {
    let operacoesQuery = supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))');

    if (empresaId) {
      operacoesQuery = operacoesQuery.eq('empresa_id', empresaId);
    }

    const operacoesLegadasRes = await operacoesQuery;
    const operacoesProducao = await OperacaoProducaoService.getAll(empresaId).catch(() => []);

    if (operacoesLegadasRes.error) throw operacoesLegadasRes.error;

    const operacoesLegadas = operacoesLegadasRes.data ?? [];
    const fallbackDate = new Date().toISOString().split('T')[0];

    const legadasNormalizadas = operacoesLegadas.map((item: any) => ({
      ...item,
      origem: 'operacoes',
      data_referencia: item.data ?? fallbackDate,
      produto_label: item.produto ?? null,
      transportadora_label: item.transportadora ?? null,
      tipo_servico_label: item.tipo_servico ?? null,
      quantidade_label: Number(item.quantidade || 0),
      horario_inicio_label: item.horario_inicio ?? null,
      horario_fim_label: item.horario_fim ?? null,
      valor_unitario_label: Number(item.valor_unitario || 0),
      valor_total_label: Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      criado_em_label: item.created_at ?? item.data_criacao ?? null,
    }));

    const producaoNormalizada = (operacoesProducao ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes_producao',
      data_referencia: item.data_operacao ?? fallbackDate,
      data_operacao: item.data_operacao ?? fallbackDate,
      quantidade_colaboradores: Number(item.quantidade_colaboradores ?? 1),
      produto_label: item.produtos_carga?.nome ?? item.avaliacao_json?.contexto_operacional?.produto ?? null,
      transportadora_label: item.transportadoras_clientes?.nome ?? null,
      tipo_servico_label: item.tipos_servico_operacional?.nome ?? null,
      quantidade_label: Number(
        item.tipo_calculo_snapshot === 'colaborador'
          ? item.quantidade_colaboradores
            ?? item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores
            ?? item.quantidade
            ?? 0
          : item.quantidade ?? 0,
      ),
      horario_inicio_label: item.entrada_ponto ?? null,
      horario_fim_label: item.saida_ponto ?? null,
      valor_unitario_label: Number(item.valor_unitario_snapshot || 0),
      valor_total_label: Number(item.valor_total || 0),
      placa: item.placa ?? null,
      nf_numero: item.nf_numero ?? null,
      ctrc: item.ctrc ?? null,
      percentual_iss: item.percentual_iss ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
    }));

    return [...producaoNormalizada, ...legadasNormalizadas].sort((a: any, b: any) => {
      const aTime = new Date(a.criado_em_label ?? `${a.data_referencia}T${a.horario_inicio_label ?? '00:00:00'}`).getTime();
      const bTime = new Date(b.criado_em_label ?? `${b.data_referencia}T${b.horario_inicio_label ?? '00:00:00'}`).getTime();
      return bTime - aTime;
    });
  }

  async getByDate(date: string, empresaId?: string) {
    let query = supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('data', date);

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByMonth(month: string) {
    const [year, mo] = month.split('-').map(Number);
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr);
    if (error) throw error;
    return data;
  }

  async getInconsistencies() {
    const { data, error } = await supabase
      .from('operacoes')
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .eq('status', 'inconsistente');
    if (error) throw error;
    return data;
  }

  async getWeeklyHistory() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('resultados_processamento')
      .select('*')
      .gte('data', dateStr)
      .order('data', { ascending: true });

    if (error) throw error;
    return data ?? []; // FIX: era `result`, corrigido para `data`
  }

  async getPainelByDate(date: string, empresaId?: string) {
    const [operacoesLegadas, operacoesProducao] = await Promise.all([
      this.getByDate(date, empresaId),
      OperacaoProducaoService.getByDate(date, empresaId).catch(() => []),
    ]);

    const legadasNormalizadas = (operacoesLegadas ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes',
      data_referencia: item.data ?? date,
      produto_label: item.produto ?? null,
      transportadora_label: item.transportadora ?? null,
      tipo_servico_label: item.tipo_servico ?? null,
      quantidade_label: Number(item.quantidade || 0),
      horario_inicio_label: item.horario_inicio ?? null,
      horario_fim_label: item.horario_fim ?? null,
      valor_unitario_label: Number(item.valor_unitario || 0),
      valor_total_label: Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      criado_em_label: item.created_at ?? item.data_criacao ?? null,
    }));

    const producaoNormalizada = (operacoesProducao ?? []).map((item: any) => ({
      ...item,
      origem: 'operacoes_producao',
      data_referencia: item.data_operacao ?? date,
      data_operacao: item.data_operacao ?? date,
      quantidade_colaboradores: Number(item.quantidade_colaboradores ?? 1),
      produto_label: item.produtos_carga?.nome ?? item.avaliacao_json?.contexto_operacional?.produto ?? null,
      transportadora_label: item.transportadoras_clientes?.nome ?? null,
      tipo_servico_label: item.tipos_servico_operacional?.nome ?? null,
      quantidade_label: Number(
        item.tipo_calculo_snapshot === 'colaborador'
          ? item.quantidade_colaboradores
            ?? item.avaliacao_json?.contexto_operacional?.quantidade_colaboradores
            ?? item.quantidade
            ?? 0
          : item.quantidade ?? 0,
      ),
      horario_inicio_label: item.entrada_ponto ?? null,
      horario_fim_label: item.saida_ponto ?? null,
      valor_unitario_label: Number(item.valor_unitario_snapshot || 0),
      valor_total_label: Number(item.valor_total || 0),
      placa: item.placa ?? null,
      nf_numero: item.nf_numero ?? null,
      ctrc: item.ctrc ?? null,
      percentual_iss: item.percentual_iss ? Number(item.percentual_iss) : null,
      valor_descarga: item.valor_descarga ? Number(item.valor_descarga) : null,
      custo_com_iss: item.custo_com_iss ? Number(item.custo_com_iss) : null,
      valor_unitario_filme: item.valor_unitario_filme ? Number(item.valor_unitario_filme) : null,
      quantidade_filme: item.quantidade_filme ? Number(item.quantidade_filme) : null,
      valor_total_filme: item.valor_total_filme ? Number(item.valor_total_filme) : null,
      valor_faturamento_nf: item.valor_faturamento_nf ? Number(item.valor_faturamento_nf) : null,
      criado_em_label: item.criado_em ?? null,
    }));

    return [...producaoNormalizada, ...legadasNormalizadas].sort((a: any, b: any) => {
      const aTime = new Date(a.criado_em_label ?? `${a.data_referencia}T${a.horario_inicio_label ?? '00:00:00'}`).getTime();
      const bTime = new Date(b.criado_em_label ?? `${b.data_referencia}T${b.horario_inicio_label ?? '00:00:00'}`).getTime();
      return bTime - aTime;
    });
  }
}
export const OperacaoService = new OperacaoServiceClass();

class PontoServiceClass extends BaseService<'registros_ponto'> {
  constructor() { super('registros_ponto'); }

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
      .select('*, colaboradores(nome, cargo, empresas(nome))')
      .gte('data', `${month}-01`)
      .lt('data', nextMonthStr)
      .order('data', { ascending: false });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getByCollaborator(collabId: string) {
    const { data, error } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', collabId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const PontoService = new PontoServiceClass();

class ClienteServiceClass extends BaseService<'clientes'> {
  constructor() { super('clientes'); }
}
export const ClienteService = new ClienteServiceClass();

class RegraCalculoServiceClass extends BaseService<'financeiro_regras'> {
  constructor() { super('financeiro_regras'); }

  async getAllActive() {
    const { data, error } = await supabase
      .from('financeiro_regras')
      .select('*')
      .eq('esta_ativa', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data;
  }

  async getByCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('financeiro_regras')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('esta_ativa', true);
    if (error) throw error;
    return data;
  }

  async updateVersioned(id: string, payload: any) {
    const { data, error } = await supabase.rpc('create_new_rule_version', {
      p_regra_id: id,
      p_new_data: payload
    });
    if (error) throw error;
    return data;
  }
}
export const RegraCalculoService = new RegraCalculoServiceClass();

class RegrasFinanceirasServiceClass extends BaseService<'regras_financeiras'> {
  constructor() { super('regras_financeiras'); }

  async getAllActive() {
    const { data, error } = await supabase
      .from('regras_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data;
  }

  async getByModalidade(modalidade: string) {
    const { data, error } = await supabase
      .from('regras_financeiras')
      .select('*')
      .eq('modalidade_financeira', modalidade)
      .eq('ativo', true)
      .order('empresa_id', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }

  async getFormasPermitidas(modalidade: string, empresaId?: string) {
    const { data, error } = await supabase.rpc('get_formas_pagamento_permitidas', {
      p_modalidade_financeira: modalidade,
      p_empresa_id: empresaId ?? null
    });
    if (error) throw error;
    return data;
  }

  async classificarFinanceiro(dataOperacao: string, modalidade: string, empresaId?: string) {
    const { data, error } = await supabase.rpc('classificar_financeiro_operacao', {
      p_data_operacao: dataOperacao,
      p_modalidade_financeira: modalidade,
      p_empresa_id: empresaId ?? null
    });
    if (error) throw error;
    return data;
  }
}
export const RegrasFinanceirasService = new RegrasFinanceirasServiceClass();

class CompetenciaServiceClass extends BaseService<'financeiro_competencias'> {
  constructor() { super('financeiro_competencias'); }

  async getByMonth(month: string, empresaId: string) {
    const dateStr = month.includes('-') ? `${month}-01` : month;
    const { data, error } = await supabase
      .from('financeiro_competencias')
      .select('*')
      .eq('competencia', dateStr)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getAtual(empresaId: string) {
    const month = new Date().toISOString().substring(0, 7);
    return this.getByMonth(month, empresaId);
  }
}
export const CompetenciaService = new CompetenciaServiceClass();

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

class UnidadeServiceClass extends BaseService<'unidades'> {
  constructor() { super('unidades'); }
  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase.from('unidades').select('*').eq('empresa_id', empresaId);
    if (error) throw error;
    return data;
  }
}
export const UnidadeService = new UnidadeServiceClass();

class EquipeServiceClass extends BaseService<'equipes'> {
  constructor() { super('equipes'); }
  async getWithDetails() {
    const { data, error } = await supabase
      .from('equipes')
      .select('*, unidades(nome), empresas(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const EquipeService = new EquipeServiceClass();

class ConfigTipoOperacaoServiceClass extends BaseService<'config_tipos_operacao'> {
  constructor() { super('config_tipos_operacao'); }
}
export const ConfigTipoOperacaoService = new ConfigTipoOperacaoServiceClass();

class ConfigProdutoServiceClass extends BaseService<'config_produtos'> {
  constructor() { super('config_produtos'); }
}
export const ConfigProdutoService = new ConfigProdutoServiceClass();

class ConfigTipoDiaServiceClass extends BaseService<'config_tipos_dia'> {
  constructor() { super('config_tipos_dia'); }
}
export const ConfigTipoDiaService = new ConfigTipoDiaServiceClass();

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
    const { data, error } = await supabase
      .from('configuracoes_operacionais')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
export const ConfiguracaoOperacionalService = new ConfiguracaoOperacionalServiceClass();

// ==================================================
// SERVIÇOS OPERACIONAIS V2 (/producao)
// ==================================================
const operationalClient: any = supabase;

class UnidadeOperacionalServiceClass {
  async getByEmpresa(empresaId: string) {
    const { data, error } = await operationalClient
      .from('unidades')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
export const UnidadeOperacionalService = new UnidadeOperacionalServiceClass();

class TipoServicoOperacionalServiceClass {
  async getByEmpresa(empresaId?: string) {
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getAllActive() {
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('tipos_servico_operacional')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('tipos_servico_operacional')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
export const TipoServicoOperacionalService = new TipoServicoOperacionalServiceClass();

class TransportadoraClienteServiceClass {
  async getByEmpresa(empresaId?: string) {
    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('transportadoras_clientes')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('transportadoras_clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
export const TransportadoraClienteService = new TransportadoraClienteServiceClass();

class FornecedorServiceClass {
  async getByEmpresa(empresaId?: string) {
    const { data, error } = await operationalClient
      .from('fornecedores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('fornecedores')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('fornecedores')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('fornecedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
export const FornecedorService = new FornecedorServiceClass();

class ProdutoCargaServiceClass {
  async getByFornecedor(fornecedorId: string) {
    const { data, error } = await operationalClient
      .from('produtos_carga')
      .select('*')
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('produtos_carga')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
export const ProdutoCargaService = new ProdutoCargaServiceClass();

class FormaPagamentoOperacionalServiceClass {
  async getAllActive() {
    const { data, error } = await operationalClient
      .from('formas_pagamento_operacional')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('formas_pagamento_operacional')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
export const FormaPagamentoOperacionalService = new FormaPagamentoOperacionalServiceClass();

class FornecedorValorServicoServiceClass {
  async resolverValor(params: {
    empresaId: string;
    unidadeId?: string | null;
    tipoServicoId: string;
    fornecedorId?: string | null;
    transportadoraId?: string | null;
    produtoCargaId?: string | null;
    dataOperacao?: string;
  }) {
    const { data, error } = await operationalClient.rpc('resolver_valor_operacao', {
      p_empresa_id: params.empresaId,
      p_unidade_id: params.unidadeId ?? null,
      p_tipo_servico_id: params.tipoServicoId,
      p_fornecedor_id: params.fornecedorId,
      p_transportadora_id: params.transportadoraId ?? null,
      p_produto_carga_id: params.produtoCargaId ?? null,
      p_data_operacao: params.dataOperacao ?? null,
    });

    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data;
  }

  async resolverIss(params: {
    empresaId: string;
    tipoServicoId?: string | null;
    dataOperacao?: string;
  }) {
    const { data, error } = await operationalClient.rpc('resolver_iss_operacao', {
      p_empresa_id: params.empresaId,
      p_tipo_servico_id: params.tipoServicoId ?? null,
      p_data_operacao: params.dataOperacao ?? null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data;
  }
}
export const FornecedorValorServicoService = new FornecedorValorServicoServiceClass();

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
    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(payloads: Record<string, any>[]) {
    if (payloads.length === 0) return [];

    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .insert(payloads)
      .select();

    if (error) throw error;
    return data ?? [];
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('fornecedor_valores_servico')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
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
  async isAvailable() {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .select('id')
      .limit(1);

    return !error;
  }

  async create(payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .insert(payload)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async createWithColaboradores(
    payload: Record<string, any>,
    colaboradores: Array<{
      collaborator_id: string;
      had_infraction: boolean;
      infraction_type_id?: string | null;
      infraction_notes?: string | null;
    }>,
  ) {
    const registro = await this.create(payload);

    if (colaboradores.length > 0) {
      const { error } = await operationalClient
        .from('production_entry_collaborators')
        .insert(
          colaboradores.map((item) => ({
            production_entry_id: registro.id,
            collaborator_id: item.collaborator_id,
            had_infraction: item.had_infraction,
            infraction_type_id: item.infraction_type_id ?? null,
            infraction_notes: item.infraction_notes ?? null,
          })),
        );

      if (error) throw error;
    }

    return registro;
  }

  async update(id: string, payload: Record<string, any>) {
    const { data, error } = await operationalClient
      .from('operacoes_producao')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
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
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .eq('data_operacao', date)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getAll(empresaId?: string, unidadeId?: string | null) {
    let query = operationalClient
      .from('operacoes_producao')
      .select(`
        *,
        colaboradores:colaborador_id(nome, cargo),
        tipos_servico_operacional:tipo_servico_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        produtos_carga:produto_carga_id(nome),
        formas_pagamento_operacional:forma_pagamento_id(nome)
      `)
      .order('criado_em', { ascending: false });

    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (unidadeId) query = query.eq('unidade_id', unidadeId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async delete(id: string) {
    const { error } = await operationalClient
      .from('operacoes_producao')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
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
}
export const OperacaoProducaoService = new OperacaoProducaoServiceClass();

class CustoExtraOperacionalServiceClass {
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

  async getAll(empresaId?: string) {
    let query = operationalClient
      .from('custos_extras_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false });

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

// ==================================================
// STORAGE SERVICE
// ==================================================
export const StorageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return data;
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};

// ==================================================
// AI SERVICE & EDGE FUNCTIONS
// ==================================================
export const AIService = {
  async processDay(data: string, empresaId: string) {
    const { data: res, error } = await supabase.functions.invoke('process-day', {
      body: { data_processamento: data, empresa_id: empresaId }
    });
    if (error) throw error;
    return res;
  }
};

export class TipoRegraOperacionalServiceClass {
  async getAllActive() {
    const { data, error } = await supabase
      .from('tipos_regra_operacional' as any)
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: any) {
    const { data, error } = await supabase
      .from('tipos_regra_operacional' as any)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
export const TipoRegraOperacionalService = new TipoRegraOperacionalServiceClass();

// ==================================================
// MÓDULO DIARISTAS
// ==================================================

export type CodigoMarcacao = 'P' | 'MP' | 'AUSENTE';
export type StatusLancamentoDiarista = 'em_aberto' | 'fechado_para_pagamento' | 'pago' | 'cancelado';

export interface LancamentoDiaristaPayload {
  empresa_id: string;
  diarista_id: string;
  nome_colaborador: string;
  cpf_colaborador?: string | null;
  funcao_colaborador?: string | null;
  data_lancamento: string;
  codigo_marcacao: CodigoMarcacao;
  quantidade_diaria: number;
  valor_diaria_base: number;
  valor_calculado: number;
  cliente_unidade?: string | null;
  operacao_servico?: string | null;
  encarregado_id?: string | null;
  encarregado_nome?: string | null;
  observacao?: string | null;
}

class DiaristaServiceClass {
  async getByEmpresa(empresaId: string, apenasAtivos = true) {
    let query = supabase
      .from('colaboradores')
      .select('id, nome, cpf, telefone, cargo, valor_base, status, empresa_id, permitir_lancamento_operacional, deleted_at')
      .eq('empresa_id', empresaId)
      .eq('tipo_colaborador', 'DIARISTA')
      .eq('permitir_lancamento_operacional', true)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (apenasAtivos) query = query.eq('status', 'ativo');

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((c: any) => ({
      ...c,
      funcao: c.cargo ?? '—',
      valor_diaria: Number(c.valor_base ?? 0),
    }));
  }

  async create(payload: Record<string, any>) {
    const mapped = {
      nome: payload.nome,
      cpf: payload.cpf ?? null,
      telefone: payload.telefone ?? null,
      cargo: payload.funcao ?? payload.cargo ?? null,
      valor_base: payload.valor_diaria ?? payload.valor_base ?? 0,
      status: payload.status ?? 'ativo',
      empresa_id: payload.empresa_id,
      tipo_colaborador: 'DIARISTA',
      permitir_lancamento_operacional: payload.permitir_lancamento_operacional ?? true,
    };
    const { data, error } = await supabase
      .from('colaboradores')
      .insert(mapped)
      .select()
      .single();
    if (error) throw error;
    return { ...data, funcao: data.cargo, valor_diaria: Number(data.valor_base ?? 0) };
  }

  async update(id: string, payload: Record<string, any>) {
    const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
    if (payload.nome !== undefined)      mapped.nome = payload.nome;
    if (payload.cpf !== undefined)       mapped.cpf = payload.cpf;
    if (payload.telefone !== undefined)  mapped.telefone = payload.telefone;
    if (payload.funcao !== undefined)    mapped.cargo = payload.funcao;
    if (payload.cargo !== undefined)     mapped.cargo = payload.cargo;
    if (payload.valor_diaria !== undefined) mapped.valor_base = payload.valor_diaria;
    if (payload.valor_base !== undefined)   mapped.valor_base = payload.valor_base;
    if (payload.status !== undefined)    mapped.status = payload.status;
    if (payload.deleted_at !== undefined) mapped.deleted_at = payload.deleted_at;
    if (payload.permitir_lancamento_operacional !== undefined)
      mapped.permitir_lancamento_operacional = payload.permitir_lancamento_operacional;

    const { data, error } = await supabase
      .from('colaboradores')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { ...data, funcao: data.cargo, valor_diaria: Number(data.valor_base ?? 0) };
  }

  async softDelete(id: string) {
    return this.update(id, { deleted_at: new Date().toISOString(), status: 'inativo' });
  }

  async toggleStatus(id: string, status: 'ativo' | 'inativo') {
    return this.update(id, { status });
  }
}
export const DiaristaService = new DiaristaServiceClass();

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
    let query = (supabase as any)
      .from('lancamentos_diaristas')
      .select('*')
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .order('data_lancamento', { ascending: false })
      .order('nome_colaborador', { ascending: true });

    if (empresaId) query = query.eq('empresa_id', empresaId);

    if (filtros?.status) query = query.eq('status', filtros.status);
    if (filtros?.funcao) query = query.eq('funcao_colaborador', filtros.funcao);
    if (filtros?.encarregado_id) query = query.eq('encarregado_id', filtros.encarregado_id);
    if (filtros?.cliente_unidade) query = query.ilike('cliente_unidade', `%${filtros.cliente_unidade}%`);

    const { data, error } = await query;
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
}
export const LoteFechamentoDiaristaService = new LoteFechamentoDiaristaServiceClass();

// ==================================================
// TIPOS PARA REGRAS DINÂMICAS
// ==================================================

export interface RegraModulo {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  ativo: boolean;
}

export interface RegraCampo {
  id: number;
  modulo_id: number;
  nome: string;
  tipo: string; // text, number, select, boolean, date
  obrigatorio: boolean;
  ordem?: number;
  opcoes_json?: string;
}

export interface RegraDado {
  id: number;
  modulo_id: number;
  dados: any; // JSONB
}

// ==================================================
// SERVIÇOS PARA REGRAS DINÂMICAS
// ==================================================

class RegrasModulosServiceClass {
  private readonly table = 'regras_modulos';

  async listar(): Promise<RegraModulo[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data as RegraModulo[];
  }

  async buscarPorId(id: number): Promise<RegraModulo | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as RegraModulo | null;
  }

  async criar(data: Omit<RegraModulo, 'id' | 'ativo'>): Promise<RegraModulo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .insert({ ...data, ativo: true })
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraModulo;
  }

  async atualizar(id: number, data: Partial<Omit<RegraModulo, 'id' | 'ativo'>>): Promise<RegraModulo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraModulo;
  }

  async inativar(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ ativo: false })
      .eq('id', id);
    if (error) throw error;
  }

  async excluir(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasModulosService = new RegrasModulosServiceClass();

class RegrasCamposServiceClass {
  private readonly table = 'regras_campos';

  async listarPorModulo(moduloId: number): Promise<RegraCampo[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('modulo_id', moduloId)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    return data as RegraCampo[];
  }

  async criar(data: Omit<RegraCampo, 'id'>): Promise<RegraCampo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraCampo;
  }

  async atualizar(id: number, data: Partial<RegraCampo>): Promise<RegraCampo> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraCampo;
  }

  async excluir(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasCamposService = new RegrasCamposServiceClass();

class RegrasDadosServiceClass {
  private readonly table = 'regras_dados';

  async listarPorModulo(moduloId: number): Promise<RegraDado[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('modulo_id', moduloId);
    if (error) throw error;
    return data as RegraDado[];
  }

  async criar(data: Omit<RegraDado, 'id'>): Promise<RegraDado> {
    const { data: result, error } = await supabase
      .from(this.table)
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraDado;
  }

  async atualizar(id: number, data: Partial<RegraDado>): Promise<RegraDado> {
    const { data: result, error } = await supabase
      .from(this.table)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return result as RegraDado;
  }

  async buscarPorModalidadeEForma(modalidadeFinanceira: string, formaPagamento: string): Promise<RegraDado | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select('dados')
      .contains('dados', { modalidade_financeira: modalidadeFinanceira, forma_pagamento: formaPagamento })
      .limit(1)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data as RegraDado | null;
  }

  async excluir(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
export const RegrasDadosService = new RegrasDadosServiceClass();

// ==================================================
// MÓDULO REGRAS DE MARCAÇÃO DE DIARISTAS
// ==================================================

export interface RegraMarcacaoDiaristaPayload {
  empresa_id: string | null;
  codigo: string;
  descricao: string;
  multiplicador: number;
  ativo: boolean;
}

class RegraMarcacaoDiaristaServiceClass {
  async getAll() {
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .select('*, empresas:empresa_id(nome)')
      .order('codigo', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async create(payload: RegraMarcacaoDiaristaPayload) {
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .insert(payload)
      .select('*, empresas:empresa_id(nome)')
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Partial<RegraMarcacaoDiaristaPayload>) {
    const { data, error } = await supabase
      .from('regras_marcacao_diaristas' as any)
      .update(payload)
      .eq('id', id)
      .select('*, empresas:empresa_id(nome)')
      .single();
    if (error) throw error;
    return data;
  }
}

export const RegraMarcacaoDiaristaService = new RegraMarcacaoDiaristaServiceClass();