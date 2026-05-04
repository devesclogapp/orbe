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
    // 1. Definir a justificativa na variável de sessão via RPC
    const { error: rpcError } = await supabase.rpc('set_session_variable', {
      name: 'app.override_justification',
      value: justification
    });

    if (rpcError) {
      console.error('Erro ao definir justificativa de override:', rpcError);
      throw new Error('Falha ao registrar justificativa no servidor.');
    }

    // 2. Executar o update normalmente
    // A trigger no banco irá capturar a variável de sessão
    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Se houver erro de trigger (ex: falta de justificativa ou role), ele virá aqui
      throw error;
    }

    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from(this.table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

// SERVIÇOS ESPECÍFICOS
class EmpresaServiceClass extends BaseService<'empresas'> {
  constructor() { super('empresas'); }

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

  /**
   * Retorna colaboradores do tipo DIARISTA que têm lançamento operacional permitido.
   * Usado pela tela /producao/diaristas (DiaristasLancamento) como fonte de dados.
   */
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
    // Mapeia campos para o formato esperado pela tela de lançamento
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
    // Calculando o próximo mês para o limite superior (exclusivo)
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
    // Calculando o próximo mês para o limite superior (exclusivo)
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
    return data;
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
      data_operacao: item.data_operacao ?? date,  // garantido explicitamente
      quantidade_colaboradores: Number(item.quantidade_colaboradores ?? 1),  // garantido explicitamente
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
      // Novas colunas mapeadas do Excel
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

// SERVIÇOS OPERACIONAIS V2 (/producao)
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

// STORAGE SERVICE
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

// AI SERVICE & EDGE FUNCTIONS
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
    // Diaristas estão na tabela 'colaboradores' com tipo_colaborador = 'DIARISTA'
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

    // Mapear campos para o formato esperado pelo componente
    return (data ?? []).map((c: any) => ({
      ...c,
      funcao: c.cargo ?? '—',
      valor_diaria: Number(c.valor_base ?? 0),
    }));
  }

  async create(payload: Record<string, any>) {
    // Criar diarista na tabela colaboradores
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
    // Mapear campos de volta para colaboradores
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

    // Filtro opcional: sem empresaId = todas as empresas (visão consolidada)
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
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('data_lancamento', data)
      .order('nome_colaborador', { ascending: true });

    if (error) throw error;
    return result ?? [];
  }

  async createBatch(registros: LancamentoDiaristaPayload[]) {
    if (registros.length === 0) return [];
    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .insert(registros)
      .select();
    if (error) throw error;
    return data ?? [];
  }

  async updateStatus(ids: string[], status: StatusLancamentoDiarista, loteId?: string) {
    const payload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (loteId) payload.lote_fechamento_id = loteId;

    const { error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .update(payload)
      .in('id', ids);
    if (error) throw error;
  }

  async cancelar(id: string) {
    const { error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async getByLoteId(loteId: string) {
    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .order('data_lancamento', { ascending: true })
      .order('nome_colaborador', { ascending: true });
    
    if (error) throw error;
    return data ?? [];
  }

  /** Cria um ajuste vinculado a um lançamento de referência (positivo ou negativo). */
  async criarAjuste(params: {
    empresaId: string;
    referenciaLancamentoId: string;
    valorAjuste: number;
    motivo: string;
    adjustedBy: string;
    adjustedByNome: string;
    /** Copia estes campos do lançamento original: diarista_id, nome, funcao, data */
    original: {
      diarista_id: string;
      nome_colaborador: string;
      funcao_colaborador: string;
      data_lancamento: string;
      codigo_marcacao: string;
      lote_fechamento_id?: string | null;
    };
  }) {
    const payload = {
      empresa_id: params.empresaId,
      diarista_id: params.original.diarista_id,
      nome_colaborador: params.original.nome_colaborador,
      funcao_colaborador: params.original.funcao_colaborador,
      data_lancamento: params.original.data_lancamento,
      codigo_marcacao: params.original.codigo_marcacao,
      tipo_lancamento: 'diarista',
      tipo_registro: 'ajuste',
      referencia_lancamento_id: params.referenciaLancamentoId,
      motivo_ajuste: params.motivo,
      valor_calculado: params.valorAjuste,
      valor_diaria_base: 0,
      quantidade_diaria: params.valorAjuste > 0 ? 1 : -1,
      status: 'em_aberto',
      adjusted_by: params.adjustedBy,
      adjusted_by_nome: params.adjustedByNome,
      adjusted_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from('lancamentos_diaristas')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
export const LancamentoDiaristaService = new LancamentoDiaristaServiceClass();

class LoteFechamentoDiaristaServiceClass {
  async fecharPeriodo(params: {
    empresaId: string;
    periodoInicio: string;
    periodoFim: string;
    fechadoPor: string;
    fechadoPorNome?: string;
    observacoes?: string;
  }) {
    const { data: todosRegistros, error: errBusca } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select('id, valor_calculado, status')
      .eq('empresa_id', params.empresaId)
      .gte('data_lancamento', params.periodoInicio)
      .lte('data_lancamento', params.periodoFim);

    if (errBusca) throw errBusca;
    if (!todosRegistros || todosRegistros.length === 0) {
      throw new Error('Nenhum registro encontrado para o período selecionado.');
    }

    if (todosRegistros.some((r: any) => r.status === 'fechado_para_pagamento' || r.status === 'pago')) {
      throw new Error('Existem registros neste período que já estão fechados ou pagos.');
    }

    const registros = todosRegistros.filter((r: any) => r.status === 'em_aberto');

    if (registros.length === 0) {
      throw new Error('Nenhum registro em aberto encontrado para o período selecionado.');
    }

    const valorTotal = registros.reduce((acc: number, r: any) => acc + Number(r.valor_calculado || 0), 0);

    // 2. Criar o lote de fechamento
    const { data: lote, error: errLote } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .insert({
        empresa_id: params.empresaId,
        periodo_inicio: params.periodoInicio,
        periodo_fim: params.periodoFim,
        total_registros: registros.length,
        valor_total: valorTotal,
        status: 'fechado_para_pagamento',
        fechado_por: params.fechadoPor,
        fechado_por_nome: params.fechadoPorNome ?? null,
        fechado_em: new Date().toISOString(),
        observacoes: params.observacoes ?? null,
      })
      .select()
      .single();

    if (errLote) throw errLote;

    // 3. Atualizar status dos registros
    const ids = registros.map((r: any) => r.id);
    await LancamentoDiaristaService.updateStatus(ids, 'fechado_para_pagamento', lote.id);

    // 4. Integração financeira
    const { error: errFin } = await (supabase as any)
      .from('lancamentos_financeiros')
      .insert({
        empresa_id: params.empresaId,
        tipo: 'saida',
        categoria: 'pagamento_diaristas',
        valor: valorTotal,
        referencia_id: lote.id,
        status: 'pendente',
      });
    
    if (errFin) {
        console.error("Erro ao integrar com o financeiro:", errFin);
        // Mesmo se falhar a integração, talvez não devamos travar o lote, mas o prompt pede para criar.
    }

    return lote;
  }

  async getByEmpresa(empresaId: string) {
    const { data, error } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fechado_em', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /** Apenas lotes prontos para ação do Financeiro (após fechamento pelo RH) */
  async getByEmpresaParaFinanceiro(empresaId: string) {
    const { data, error } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .select('*')
      .eq('empresa_id', empresaId)
      .in('status', ['fechado_para_pagamento', 'cnab_gerado', 'pago'])
      .order('fechado_em', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async marcarComoPago(loteId: string, paidBy?: string, paidByNome?: string) {
    const { error } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .update({ 
        status: 'pago',
        paid_by: paidBy ?? null,
        paid_by_nome: paidByNome ?? null,
        paid_at: new Date().toISOString()
      })
      .eq('id', loteId);
    if (error) throw error;

    // atualizar registros vinculados
    const { error: errLanc } = await (supabase as any)
      .from('lancamentos_diaristas')
      .update({ status: 'pago', updated_at: new Date().toISOString() })
      .eq('lote_fechamento_id', loteId);
    if (errLanc) throw errLanc;

    // Atualizar também o financeiro, se existir.
    await (supabase as any)
      .from('lancamentos_financeiros')
      .update({ status: 'pago', updated_at: new Date().toISOString() })
      .eq('referencia_id', loteId)
      .eq('categoria', 'pagamento_diaristas');
  }

  async reabrirPeriodo(loteId: string, reopenedBy: string, reopenedByNome: string) {
    const { error } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .update({
        status: 'em_aberto',
        reopened_by: reopenedBy,
        reopened_by_nome: reopenedByNome,
        reopened_at: new Date().toISOString()
      })
      .eq('id', loteId);
    
    if (error) throw error;

    // Atualizar registros vinculados
    const { error: errLanc } = await (supabase as any)
      .from('lancamentos_diaristas')
      .update({ 
        status: 'em_aberto', 
        updated_at: new Date().toISOString()
      })
      .eq('lote_fechamento_id', loteId);

    if (errLanc) throw errLanc;
    
    // Attempt to cancel in financeiro if it exists
    await (supabase as any)
      .from('lancamentos_financeiros')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('referencia_id', loteId)
      .eq('categoria', 'pagamento_diaristas');
  }

  /**
   * Gera, valida e baixa um arquivo CNAB240 para o lote de pagamento de diaristas.
   *
   * Fluxo:
   *  1. Carrega lançamentos do lote (agrupados por diarista)
   *  2. Carrega dados bancários de cada diarista
   *  3. Valida completude (CPF, banco, agência, conta, dígito, valor)
   *  4. Gera o conteúdo CNAB240
   *  5. Registra a geração em cnab_geracoes
   *  6. Dispara o download no browser
   *
   * @throws Error com lista de inconsistências se a validação falhar
   */
  async gerarCNABParaLote(params: {
    loteId: string;
    empresaId: string;
    geradoPor: string;
    geradoPorNome: string;
    /** Dados da empresa pagadora necessários para o Header do arquivo */
    empresaRemetente: {
      cnpj: string;
      razao_social: string;
      banco_codigo: string;
      agencia: string;
      agencia_digito?: string;
      conta: string;
      digito_conta: string;
      convenio_bancario?: string;
      codigo_empresa_banco?: string;
      nome_empresa_banco?: string;
    };
    /** Data de pagamento desejada (padrão: hoje) */
    dataPagamento?: Date;
  }) {
    // 1. Carregar lançamentos do lote (normais apenas, sem ajustes agrupados)
    const { data: lancamentos, error: errLanc } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select('diarista_id, nome_colaborador, valor_calculado')
      .eq('lote_fechamento_id', params.loteId)
      .neq('tipo_registro', 'ajuste');

    if (errLanc) throw errLanc;
    if (!lancamentos || lancamentos.length === 0) {
      throw new Error('Nenhum lançamento encontrado no lote.');
    }

    // 2. Agrupar por diarista e somar valores
    const mapaValores: Record<string, { nome: string; valor: number }> = {};
    for (const l of lancamentos) {
      if (!mapaValores[l.diarista_id]) {
        mapaValores[l.diarista_id] = { nome: l.nome_colaborador, valor: 0 };
      }
      mapaValores[l.diarista_id].valor += Number(l.valor_calculado || 0);
    }

    // Incluir ajustes no valor total
    const { data: ajustes } = await (supabase as any)
      .from('lancamentos_diaristas')
      .select('diarista_id, valor_calculado')
      .eq('lote_fechamento_id', params.loteId)
      .eq('tipo_registro', 'ajuste');

    for (const aj of (ajustes ?? [])) {
      if (mapaValores[aj.diarista_id]) {
        mapaValores[aj.diarista_id].valor += Number(aj.valor_calculado || 0);
      }
    }

    const diaristaIds = Object.keys(mapaValores);

    // 3. Carregar dados bancários
    const { data: colaboradores, error: errCol } = await supabase
      .from('colaboradores')
      .select('id, nome, cpf, nome_completo, banco_codigo, agencia, conta, digito_conta, tipo_conta')
      .in('id', diaristaIds);

    if (errCol) throw errCol;

    const mapaColaboradores: Record<string, any> = {};
    for (const c of (colaboradores ?? [])) {
      mapaColaboradores[c.id] = c;
    }

    // 4. Validar e montar registros
    const erros: string[] = [];
    const dataPagamento = params.dataPagamento ?? new Date();

    const { validarRegistrosCNAB, gerarCNAB240 } = await import('@/utils/cnab240');

    const registros = diaristaIds.map((id) => {
      const col = mapaColaboradores[id];
      const dadosValor = mapaValores[id];
      return {
        nome: (col?.nome_completo || col?.nome || dadosValor.nome || '').trim(),
        cpf: col?.cpf ?? '',
        banco_codigo: col?.banco_codigo ?? '',
        agencia: col?.agencia ?? '',
        conta: col?.conta ?? '',
        digito_conta: col?.digito_conta ?? '',
        tipo_conta: (col?.tipo_conta ?? 'corrente') as 'corrente' | 'poupanca',
        valor: dadosValor.valor,
        data_pagamento: dataPagamento,
      };
    }).filter((r) => r.valor > 0); // Ignora registros com valor zerado

    const { valido, erros: errosValidacao } = validarRegistrosCNAB(registros);
    erros.push(...errosValidacao);

    if (!valido) {
      throw new Error(
        `Não é possível gerar o CNAB. Corrija os dados bancários:\n\n${erros.join('\n')}`
      );
    }

    // 5. Gerar conteúdo CNAB240
    const conteudo = gerarCNAB240(params.empresaRemetente, registros);

    // 6. Registrar no banco de auditoria
    const loteIdShort = params.loteId.substring(0, 8).toUpperCase();
    const dataStr = dataPagamento.toISOString().split('T')[0].replace(/-/g, '');
    const nomeArquivo = `CNAB_DIARISTAS_LOTE_${loteIdShort}_${dataStr}.txt`;
    const valorTotal = registros.reduce((s, r) => s + r.valor, 0);

    const { error: errInsert } = await (supabase as any)
      .from('cnab_geracoes')
      .insert({
        empresa_id: params.empresaId,
        lote_id: params.loteId,
        cnab_generated_by: params.geradoPor,
        cnab_generated_by_nome: params.geradoPorNome,
        cnab_file_name: nomeArquivo,
        quantidade_registros: registros.length,
        valor_total: valorTotal,
      });

    if (errInsert) throw errInsert;

    // 6.5. Atualiza o status do lote para cnab_gerado
    const { error: errStatus } = await (supabase as any)
      .from('lotes_fechamento_diaristas')
      .update({ status: 'cnab_gerado', updated_at: new Date().toISOString() })
      .eq('id', params.loteId);

    if (errStatus) throw errStatus;

    // 7. Disparar download
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);

    return { nomeArquivo, totalRegistros: registros.length, valorTotal };
  }
}
export const LoteFechamentoDiaristaService = new LoteFechamentoDiaristaServiceClass();

export interface RegraMarcacaoDiaristaPayload {
  empresa_id: string | null;
  codigo: string;
  descricao: string;
  multiplicador: number;
  ativo: boolean;
}

class RegraMarcacaoDiaristaServiceClass {
  async getByEmpresa(empresaId: string | null) {
    let query = (supabase as any).from("regras_marcacao_diaristas").select("*").order("ativo", { ascending: false }).order("codigo", { ascending: true });
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    } else {
      query = query.is("empresa_id", null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getAll() {
    const { data, error } = await (supabase as any).from("regras_marcacao_diaristas").select(`
      *,
      empresas (nome)
    `).order("codigo", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async create(payload: RegraMarcacaoDiaristaPayload) {
    const { data, error } = await (supabase as any).from("regras_marcacao_diaristas").insert([payload]).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Partial<RegraMarcacaoDiaristaPayload>) {
    const { data, error } = await (supabase as any)
      .from("regras_marcacao_diaristas")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await (supabase as any).from("regras_marcacao_diaristas").delete().eq("id", id);
    if (error) throw error;
  }
}
export const RegraMarcacaoDiaristaService = new RegraMarcacaoDiaristaServiceClass();
