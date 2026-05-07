import { supabase } from '@/lib/supabase';

// ============================================================
// Tipos
// ============================================================

export type CnabStatus =
  | 'gerado'
  | 'baixado'
  | 'enviado_manual'
  | 'homologado'
  | 'erro_homologacao';

export type CnabModo = 'homologacao' | 'producao';

export type CnabAcaoAuditoria =
  | 'geracao'
  | 'download'
  | 'envio_manual'
  | 'homologacao'
  | 'erro_homologacao'
  | 'validacao'
  | 'upload_retorno'
  | 'processamento_retorno'
  | 'erro_retorno'
  | 'divergencia_retorno';

export interface CnabRemessaArquivo {
  id: string;
  tenant_id: string;
  lote_id: string | null;
  nome_arquivo: string;
  sequencial_arquivo: number;
  hash_arquivo: string;
  conteudo_arquivo?: string | null;
  total_registros: number;
  total_valor: number;
  banco_codigo?: string | null;
  banco_nome?: string | null;
  conta_bancaria_id?: string | null;
  status: CnabStatus;
  modo: CnabModo;
  competencia?: string | null;
  usuario_geracao?: string | null;
  data_geracao: string;
  usuario_envio?: string | null;
  data_envio?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrarRemessaParams {
  loteId: string | null;
  nomeArquivo: string;
  conteudoArquivo: string; // texto do arquivo CNAB
  totalRegistros: number;
  totalValor: number;
  bancoCodigo?: string;
  bancoNome?: string;
  contaBancariaId?: string;
  competencia?: string;
  modo?: CnabModo;
  sequencialArquivo?: number;
}

export interface CnabRemessaHistoricoItem extends CnabRemessaArquivo {
  lotes_remessa?: {
    id: string;
    competencia?: string | null;
    quantidade_titulos?: number | null;
    valor_total?: number | null;
    status?: string | null;
  } | null;
  contas_bancarias_empresa?: {
    id: string;
    banco_codigo?: string | null;
    banco_nome?: string | null;
    agencia?: string | null;
    conta?: string | null;
  } | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Gera SHA-256 do conteúdo usando SubtleCrypto (WebCrypto API)
 * Compatível com browser e Node 18+
 */
async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sincronizarStatusLote(loteId: string | null | undefined, status: CnabStatus): Promise<void> {
  if (!loteId) return;

  const { error } = await supabase
    .from('lotes_remessa')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', loteId);

  if (error) {
    console.warn('[CNAB] Falha ao sincronizar status do lote:', error);
  }
}

// ============================================================
// Serviço
// ============================================================

export const CnabRemessaArquivoService = {
  // ——— Sequencial —————————————————————————————————————————
  /**
   * Obtém o próximo sequencial CNAB de forma atômica.
   * Usa função SQL que faz INSERT/UPDATE com lock de linha.
   */
  async getNextSequencial(contaBancariaId: string, bancoCodigo: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Buscar tenant_id atual
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.tenant_id) throw new Error('Tenant não identificado');

    const { data, error } = await supabase.rpc('get_next_cnab_sequencial', {
      p_tenant_id: profile.tenant_id,
      p_conta_bancaria_id: contaBancariaId,
      p_banco_codigo: bancoCodigo,
    });

    if (error) throw new Error(`Erro ao obter sequencial CNAB: ${error.message}`);
    return data as number;
  },

  // ——— Hash ————————————————————————————————————————————————
  async generateHash(content: string): Promise<string> {
    return sha256(content);
  },

  // ——— Duplicidade ——————————————————————————————————————————
  /**
   * Verifica se já existe um arquivo CNAB com o mesmo hash.
   * Retorna o registro existente se encontrado.
   */
  async checkDuplicate(hash: string): Promise<CnabRemessaArquivo | null> {
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .eq('hash_arquivo', hash)
      .maybeSingle();

    if (error) throw new Error(`Erro ao verificar duplicidade: ${error.message}`);
    return data as CnabRemessaArquivo | null;
  },

  /**
   * Verifica se o lote já possui uma remessa gerada.
   */
  async checkLoteJaRemessado(loteId: string): Promise<CnabRemessaArquivo | null> {
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .eq('lote_id', loteId)
      .not('status', 'eq', 'erro_homologacao') // erro pode ser regenerado
      .maybeSingle();

    if (error) throw new Error(`Erro ao verificar lote: ${error.message}`);
    return data as CnabRemessaArquivo | null;
  },

  // ——— Registro ————————————————————————————————————————————
  /**
   * Registra um novo arquivo CNAB gerado com todos os metadados.
   * Bloqueia duplicidade ANTES de inserir.
   */
  async registrar(params: RegistrarRemessaParams): Promise<CnabRemessaArquivo> {
    const {
      loteId,
      nomeArquivo,
      conteudoArquivo,
      totalRegistros,
      totalValor,
      bancoCodigo = '001',
      bancoNome = 'BANCO DO BRASIL',
      contaBancariaId,
      competencia,
      modo = 'producao',
      sequencialArquivo,
    } = params;

    // 1. Verificar lote já remessado
    if (loteId) {
      const existente = await this.checkLoteJaRemessado(loteId);
      if (existente) {
        throw new Error(
          `Lote já possui remessa CNAB gerada (arquivo: ${existente.nome_arquivo}, status: ${existente.status}). ` +
          `Para reenviar, marque o arquivo anterior como erro primeiro.`
        );
      }
    }

    // 2. Gerar hash
    const hash = await this.generateHash(conteudoArquivo);

    // 3. Verificar hash duplicado
    const duplicado = await this.checkDuplicate(hash);
    if (duplicado) {
      throw new Error(
        `Arquivo CNAB idêntico já foi gerado anteriormente (${duplicado.nome_arquivo}, ${duplicado.data_geracao}). ` +
        `Hash SHA-256: ${hash.substring(0, 16)}...`
      );
    }

    // 4. Obter próximo sequencial
    let sequencial = sequencialArquivo ?? 1;
    if (!sequencialArquivo && contaBancariaId) {
      sequencial = await this.getNextSequencial(contaBancariaId, bancoCodigo);
    }

    // 5. Obter usuário atual
    const { data: { user } } = await supabase.auth.getUser();

    // 6. Inserir registro
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .insert({
        lote_id: loteId,
        nome_arquivo: nomeArquivo,
        sequencial_arquivo: sequencial,
        hash_arquivo: hash,
        conteudo_arquivo: conteudoArquivo, // Salvar conteúdo para auditoria
        total_registros: totalRegistros,
        total_valor: totalValor,
        banco_codigo: bancoCodigo,
        banco_nome: bancoNome,
        conta_bancaria_id: contaBancariaId,
        status: 'gerado',
        modo,
        competencia,
        usuario_geracao: user?.id,
        data_geracao: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao registrar remessa CNAB: ${error.message}`);

    // 7. Registrar auditoria
    await this.registrarAuditoria({
      arquivoId: data.id,
      loteId,
      acao: 'geracao',
      detalhes: {
        nome_arquivo: nomeArquivo,
        sequencial,
        total_registros: totalRegistros,
        total_valor: totalValor,
        hash: hash.substring(0, 16) + '...',
        modo,
      },
    });

    return data as CnabRemessaArquivo;
  },

  // ——— Atualização de status ———————————————————————————————

  async marcarComoBaixado(arquivoId: string): Promise<void> {
    const arquivo = await this.buscarPorId(arquivoId);
    if (!arquivo) throw new Error('Arquivo CNAB não encontrado');

    if (arquivo.status === 'gerado') {
      const { error } = await supabase
        .from('cnab_remessas_arquivos')
        .update({ status: 'baixado', updated_at: new Date().toISOString() })
        .eq('id', arquivoId);

      if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
      await sincronizarStatusLote(arquivo.lote_id, 'baixado');
    }

    await this.registrarAuditoria({
      arquivoId,
      loteId: arquivo.lote_id,
      acao: 'download',
      detalhes: { timestamp: new Date().toISOString() },
    });
  },

  async marcarComoEnviadoManual(arquivoId: string, observacoes?: string): Promise<void> {
    const arquivo = await this.buscarPorId(arquivoId);
    if (!arquivo) throw new Error('Arquivo CNAB não encontrado');
    if (arquivo.status === 'enviado_manual') return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('cnab_remessas_arquivos')
      .update({
        status: 'enviado_manual',
        usuario_envio: user?.id,
        data_envio: new Date().toISOString(),
        observacoes: observacoes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', arquivoId);

    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);

    await sincronizarStatusLote(arquivo.lote_id, 'enviado_manual');

    await this.registrarAuditoria({
      arquivoId,
      loteId: arquivo.lote_id,
      acao: 'envio_manual',
      detalhes: { observacoes, timestamp: new Date().toISOString() },
    });
  },

  async marcarComoHomologado(arquivoId: string, observacoes?: string): Promise<void> {
    const arquivo = await this.buscarPorId(arquivoId);
    if (!arquivo) throw new Error('Arquivo CNAB não encontrado');
    if (arquivo.status === 'homologado') return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('cnab_remessas_arquivos')
      .update({
        status: 'homologado',
        usuario_homologacao: user?.id,
        data_homologacao: new Date().toISOString(),
        observacoes: observacoes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', arquivoId);

    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);

    await sincronizarStatusLote(arquivo.lote_id, 'homologado');

    await this.registrarAuditoria({
      arquivoId,
      loteId: arquivo.lote_id,
      acao: 'homologacao',
      detalhes: { observacoes, timestamp: new Date().toISOString() },
    });
  },

  async marcarComoErroHomologacao(arquivoId: string, observacoes?: string): Promise<void> {
    const arquivo = await this.buscarPorId(arquivoId);
    if (!arquivo) throw new Error('Arquivo CNAB não encontrado');
    if (arquivo.status === 'erro_homologacao') return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('cnab_remessas_arquivos')
      .update({
        status: 'erro_homologacao',
        usuario_homologacao: user?.id,
        data_homologacao: new Date().toISOString(),
        observacoes: observacoes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', arquivoId);

    if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);

    await sincronizarStatusLote(arquivo.lote_id, 'erro_homologacao');

    await this.registrarAuditoria({
      arquivoId,
      loteId: arquivo.lote_id,
      acao: 'erro_homologacao',
      detalhes: { observacoes, timestamp: new Date().toISOString() },
    });
  },

  // ——— Listagem ————————————————————————————————————————————

  async listar(filtros?: {
    competencia?: string;
    status?: CnabStatus;
    contaBancariaId?: string;
    limit?: number;
  }): Promise<CnabRemessaArquivo[]> {
    let query = supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .order('created_at', { ascending: false });

    if (filtros?.competencia) query = query.eq('competencia', filtros.competencia);
    if (filtros?.status) query = query.eq('status', filtros.status);
    if (filtros?.contaBancariaId) query = query.eq('conta_bancaria_id', filtros.contaBancariaId);
    if (filtros?.limit) query = query.limit(filtros.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar remessas: ${error.message}`);
    return (data ?? []) as CnabRemessaArquivo[];
  },

  async buscarPorId(id: string): Promise<CnabRemessaArquivo | null> {
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar arquivo: ${error.message}`);
    return data as CnabRemessaArquivo | null;
  },

  async listarHistorico(limit = 100): Promise<CnabRemessaHistoricoItem[]> {
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .select(`
        *,
        lotes_remessa (
          id,
          competencia,
          quantidade_titulos,
          valor_total,
          status
        ),
        contas_bancarias_empresa (
          id,
          banco_codigo,
          banco_nome,
          agencia,
          conta
        )
      `)
      .order('data_geracao', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Erro ao listar histórico de remessas: ${error.message}`);
    return (data ?? []) as CnabRemessaHistoricoItem[];
  },

  // ——— Auditoria bancária ——————————————————————————————————

  async registrarAuditoria(params: {
    arquivoId?: string | null;
    loteId?: string | null;
    acao: CnabAcaoAuditoria;
    detalhes?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let usuarioNome: string | null = null;

      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        usuarioNome = profile?.full_name ?? null;
      }

      await supabase.from('cnab_auditoria_bancaria').insert({
        arquivo_id: params.arquivoId ?? null,
        lote_id: params.loteId ?? null,
        acao: params.acao,
        usuario_id: user?.id ?? null,
        usuario_nome: usuarioNome,
        detalhes: params.detalhes ?? {},
      });
    } catch (e) {
      // Auditoria nunca deve bloquear fluxo principal
      console.warn('[CNAB Auditoria] Falha ao registrar:', e);
    }
  },

  async listarAuditoria(arquivoId?: string, limit = 50): Promise<unknown[]> {
    let query = supabase
      .from('cnab_auditoria_bancaria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (arquivoId) query = query.eq('arquivo_id', arquivoId);

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar auditoria: ${error.message}`);
    return data ?? [];
  },
};
