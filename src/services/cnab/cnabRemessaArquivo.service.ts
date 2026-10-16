import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '../domain/base.service';
import { EnvironmentService, EnvironmentScopeResolutionError } from '../environment/EnvironmentService';
import { EnvironmentQueryFilter } from '../environment/EnvironmentQueryFilter';
import { SimulacaoHomologacaoService } from './simulacaoHomologacao.service';
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
  diaristas_lote_id?: string | null;
  intermitentes_lote_id?: string | null;
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
  diaristasLoteId?: string | null;
  intermitentesLoteId?: string | null;
  rhLoteId?: string | null;
  empresaId?: string | null;
  nomeArquivo: string;
  conteudoArquivo: string; // texto do arquivo CNAB
  totalRegistros: number; // quantidade_itens_financeiros (compatível com a RPC p_total_registros)
  quantidadeItensFinanceiros?: number; // total de títulos / itens pagos (ex: 2)
  quantidadeRegistrosCnab?: number; // total de linhas físicas do arquivo CNAB (ex: 6)
  totalLinhasCnab?: number; // alias para quantidadeRegistrosCnab
  quantidadeBeneficiarios?: number; // total de favorecidos consolidados (ex: 1)
  totalValor: number;
  bancoCodigo?: string;
  bancoNome?: string;
  contaBancariaId?: string;
  competencia?: string;
  modo?: CnabModo;
  sequencialArquivo?: number;
  itens: Array<{
    origem_tipo: string;
    origem_id: string;
    fatura_id?: string | null;
    lote_item_id?: string | null;
    valor: number;
  }>;
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
   * Consulta o próximo sequencial CNAB esperado para a conta pagadora sem mutação prematura.
   * A autoridade única de incremento atômico é a RPC rpc_registrar_cnab_remessa no banco de dados,
   * eliminando o risco de incremento duplo e de sequenciais órfãos em caso de falha de persistência.
   */
  async getNextSequencial(contaBancariaId: string, bancoCodigo: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Buscar tenant_id atual
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.tenant_id) throw new Error('Tenant não identificado');

    // Consulta não-destrutiva do último sequencial registrado
    const { data, error } = await supabase
      .from('cnab_sequencial_controle')
      .select('ultimo_sequencial')
      .eq('conta_bancaria_id', contaBancariaId)
      .maybeSingle();

    if (error) {
      console.warn('[CNAB] Aviso ao consultar cnab_sequencial_controle, fallback para 1:', error.message);
      return 1;
    }

    const ultimo = Number(data?.ultimo_sequencial ?? 0);
    return ultimo + 1;
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

  async checkDiaristasLoteJaRemessado(diaristasLoteId: string): Promise<CnabRemessaArquivo | null> {
    const { data, error } = await supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .eq('diaristas_lote_id', diaristasLoteId)
      .not('status', 'eq', 'erro_homologacao')
      .maybeSingle();

    if (error) throw new Error(`Erro ao verificar lote de diaristas: ${error.message}`);
    return data as CnabRemessaArquivo | null;
  },

  async checkIntermitentesLoteJaRemessado(intermitentesLoteId: string): Promise<CnabRemessaArquivo | null> {
    if (!intermitentesLoteId) return null;
    try {
      // 1. Checar diretamente por intermitentes_lote_id
      const { data: remDireta, error: errDireta } = await supabase
        .from('cnab_remessas_arquivos')
        .select('*')
        .eq('intermitentes_lote_id', intermitentesLoteId)
        .not('status', 'eq', 'erro_homologacao')
        .maybeSingle();

      if (!errDireta && remDireta) return remDireta as CnabRemessaArquivo;

      // 2. Checar por lote_id
      const { data: remLote, error: errLote } = await supabase
        .from('cnab_remessas_arquivos')
        .select('*')
        .eq('lote_id', intermitentesLoteId)
        .not('status', 'eq', 'erro_homologacao')
        .maybeSingle();

      if (!errLote && remLote) return remLote as CnabRemessaArquivo;

      // 3. Checar por cnab_remessa_itens vinculados aos lançamentos do lote (rastreabilidade relacional canônica)
      const { data: lancs } = await supabase
        .from('lancamentos_intermitentes')
        .select('id')
        .eq('lote_fechamento_id', intermitentesLoteId);

      const lancIds = (lancs || []).map((l: any) => l.id).filter(Boolean);
      if (lancIds.length > 0) {
        const { data: itensRemessa } = await supabase
          .from('cnab_remessa_itens')
          .select('remessa_id')
          .eq('origem_tipo', 'INTERMITENTE')
          .in('origem_id', lancIds)
          .limit(1);

        const remId = itensRemessa?.[0]?.remessa_id;
        if (remId) {
          const { data: remHistorica } = await supabase
            .from('cnab_remessas_arquivos')
            .select('*')
            .eq('id', remId)
            .not('status', 'eq', 'erro_homologacao')
            .maybeSingle();

          if (remHistorica) return remHistorica as CnabRemessaArquivo;
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  async checkRhLoteJaRemessado(rhLoteId: string): Promise<CnabRemessaArquivo | null> {
    if (!rhLoteId) return null;

    try {
      const q = supabase.from('cnab_remessas_arquivos');
      if (typeof (q as any)?.select !== 'function') {
        return null;
      }
      const { data, error } = await q
        .select('*')
        .not('status', 'eq', 'erro_homologacao')
        .order('created_at', { ascending: false });

      if (error || !data) return null;

      const encontrada = (data || []).find((r: any) => {
        if (r.lote_id === rhLoteId) return true;
        if (r.observacoes) {
          try {
            const obs = typeof r.observacoes === 'string' ? JSON.parse(r.observacoes) : r.observacoes;
            if (obs?.rh_lote_id === rhLoteId) return true;
          } catch {}
        }
        return false;
      });

      return (encontrada as CnabRemessaArquivo) || null;
    } catch {
      return null;
    }
  },

  // ——— Registro ————————————————————————————————————————————
  /**
   * Registra um novo arquivo CNAB gerado com todos os metadados.
   * Bloqueia duplicidade ANTES de inserir.
   */
  async registrar(params: RegistrarRemessaParams): Promise<CnabRemessaArquivo> {
    const {
      loteId,
      diaristasLoteId,
      intermitentesLoteId,
      rhLoteId,
      empresaId: paramEmpresaId,
      nomeArquivo,
      conteudoArquivo,
      totalRegistros,
      totalValor,
      bancoCodigo = '001',
      bancoNome = 'BANCO DO BRASIL',
      contaBancariaId,
      competencia,
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

    if (diaristasLoteId) {
      const existenteDiaristas = await this.checkDiaristasLoteJaRemessado(diaristasLoteId);
      if (existenteDiaristas) {
        throw new Error(
          `Lote de diaristas ja possui remessa CNAB gerada (arquivo: ${existenteDiaristas.nome_arquivo}, status: ${existenteDiaristas.status}). ` +
          `Para reenviar, marque o arquivo anterior como erro primeiro.`
        );
      }
    }

    if (intermitentesLoteId) {
      const existenteIntermitentes = await this.checkIntermitentesLoteJaRemessado(intermitentesLoteId);
      if (existenteIntermitentes) {
        throw new Error(
          `Lote de intermitentes já possui remessa CNAB gerada (arquivo: ${existenteIntermitentes.nome_arquivo}, status: ${existenteIntermitentes.status}). ` +
          `Para reenviar, marque o arquivo anterior como erro primeiro.`
        );
      }
    }

    if (rhLoteId) {
      const existenteRh = await this.checkRhLoteJaRemessado(rhLoteId);
      if (existenteRh) {
        throw new Error(
          `Lote RH/CLT já possui remessa CNAB gerada (arquivo: ${existenteRh.nome_arquivo}, status: ${existenteRh.status}). ` +
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
    
    // Resolução da Empresa e Segregação de Ambiente (Fail-Closed)
    const tenantId = await getCurrentTenantId();
    let empresaId: string | null = paramEmpresaId || null;

    if (!empresaId && contaBancariaId) {
      const q = supabase.from('contas_bancarias_empresa').select('empresa_id').eq('id', contaBancariaId);
      const { data: contaDados } = typeof (q as any).single === 'function'
        ? await (q as any).single()
        : await (q as any);
      const cRec = Array.isArray(contaDados) ? contaDados[0] : contaDados;
      if (cRec?.empresa_id) {
        empresaId = cRec.empresa_id;
      }
    }

    if (!empresaId && loteId) {
      const q = supabase.from('lotes_remessa').select('empresa_id').eq('id', loteId);
      const { data: loteDados } = typeof (q as any).single === 'function'
        ? await (q as any).single()
        : await (q as any);
      const lRec = Array.isArray(loteDados) ? loteDados[0] : loteDados;
      if (lRec?.empresa_id) {
        empresaId = lRec.empresa_id;
      }
    }

    if (!empresaId && diaristasLoteId) {
      const q = supabase.from('diaristas_lotes_fechamento').select('empresa_id').eq('id', diaristasLoteId);
      const { data: dLote } = typeof (q as any).single === 'function'
        ? await (q as any).single()
        : await (q as any);
      const dRec = Array.isArray(dLote) ? dLote[0] : dLote;
      if (dRec?.empresa_id) {
        empresaId = dRec.empresa_id;
      }
    }

    if (!empresaId && intermitentesLoteId) {
      const q = supabase.from('intermitentes_lotes_fechamento').select('empresa_id').eq('id', intermitentesLoteId);
      const { data: iLote } = typeof (q as any).single === 'function'
        ? await (q as any).single()
        : await (q as any);
      const iRec = Array.isArray(iLote) ? iLote[0] : iLote;
      if (iRec?.empresa_id) {
        empresaId = iRec.empresa_id;
      }
    }

    if (!empresaId) {
      throw new Error('Empresa_id não resolvível via conta bancária ou lote associado.');
    }

    // Validação estrita de ambiente (Fail-Closed: mismatch aborta operação)
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    // Autoridade canônica e intrínseca do modo CNAB derivada de empresas.is_teste (Fail-Closed Estrito)
    const selectQuery = supabase
      .from('empresas')
      .select('id, is_teste');

    let qEmp = typeof (selectQuery as any)?.eq === 'function'
      ? (selectQuery as any).eq('id', empresaId)
      : selectQuery;

    if (tenantId && typeof (qEmp as any)?.eq === 'function') {
      qEmp = (qEmp as any).eq('tenant_id', tenantId);
    }

    const { data: empRes, error: empErr } = typeof (qEmp as any)?.single === 'function'
      ? await (qEmp as any).single()
      : typeof (qEmp as any)?.maybeSingle === 'function'
      ? await (qEmp as any).maybeSingle()
      : await (qEmp as any);

    if (empErr) {
      throw new Error(`Falha técnica ao verificar classificação da empresa para remessa CNAB: ${empErr.message || JSON.stringify(empErr)}`);
    }

    const empRecord = Array.isArray(empRes) ? empRes[0] : empRes;

    if (!empRecord) {
      throw new Error(`Falha de Segurança: Empresa ${empresaId} não encontrada para o tenant ${tenantId}.`);
    }

    if (typeof empRecord.is_teste !== 'boolean') {
      throw new Error(`Falha de Integridade: Empresa ${empresaId} possui classificação de ambiente indefinida (is_teste nulo). Operação abortada.`);
    }

    const modo: CnabModo = empRecord.is_teste ? 'homologacao' : 'producao';

    // Resolução semântica dos contadores:
    // - qtdItensFinanceiros: quantidade de pagamentos/títulos individuais (ex: 2 lançamentos P/MP)
    // - qtdRegistrosCnab: quantidade de linhas físicas no arquivo posicional CNAB (ex: 6 linhas)
    const qtdItensFinanceiros = params.quantidadeItensFinanceiros ?? params.itens?.length ?? params.totalRegistros;
    const qtdRegistrosCnab = params.quantidadeRegistrosCnab ?? params.totalLinhasCnab ?? params.totalRegistros;

    // 6. Inserir registro Atômicamente usando a RPC!
    // IMPORTANTE: p_total_registros na RPC é validado contra v_item_count (jsonb_array_elements(p_itens)).
    // Portanto, p_total_registros DEVE ser a quantidade de itens financeiros (qtdItensFinanceiros),
    // e NÃO a quantidade de linhas físicas do arquivo TXT (qtdRegistrosCnab),
    // eliminando a divergência 6 x 2!
    const observacoesJson = JSON.stringify({
      quantidade_itens_financeiros: qtdItensFinanceiros,
      quantidade_registros_cnab: qtdRegistrosCnab,
      quantidade_beneficiarios: params.quantidadeBeneficiarios ?? null,
      rh_lote_id: params.rhLoteId || null,
    });

    const { data, error } = await supabase.rpc('rpc_registrar_cnab_remessa', {
       p_conta_bancaria_id: contaBancariaId,
       p_lote_id: loteId,
       p_empresa_id: empresaId,
       p_modo: modo,
       p_nome_arquivo: nomeArquivo,
       p_hash_arquivo: hash,
       p_total_valor: totalValor,
       p_total_registros: qtdItensFinanceiros,
       p_itens: params.itens,
       p_diaristas_lote_id: diaristasLoteId || null,
       p_intermitentes_lote_id: intermitentesLoteId || null,
       p_conteudo_arquivo: conteudoArquivo || null,
       p_competencia: params.competencia || null,
       p_observacoes: observacoesJson
    });

    if (error) {
      throw new Error(`Erro Crítico na Transação CNAB RPC: ${error.message}`);
    }

    // 7. Obter dados da remessa registrados atomicamente pela RPC
    const rpcResponse = data as any;
    const finalRemessaId = rpcResponse?.remessa_id || rpcResponse?.id || data;
    const finalSequencial = rpcResponse?.sequencial ?? sequencial;
    const finalNomeArquivo = rpcResponse?.nome_arquivo ?? nomeArquivo;
    const finalHash = rpcResponse?.hash ?? hash;
    const finalConteudo = rpcResponse?.conteudo_arquivo ?? conteudoArquivo;

    // 9. Registrar auditoria (complementar ao RPC)
    await this.registrarAuditoria({
      arquivoId: finalRemessaId,
      loteId,
      acao: 'geracao',
      detalhes: {
        nome_arquivo: finalNomeArquivo,
        sequencial: finalSequencial,
        quantidade_itens_financeiros: qtdItensFinanceiros,
        quantidade_registros_cnab: qtdRegistrosCnab,
        quantidade_beneficiarios: params.quantidadeBeneficiarios,
        total_valor: totalValor,
        hash: finalHash.substring(0, 16) + '...',
        modo,
      },
    });

    return {
      id: finalRemessaId,
      modo,
      sequencial_arquivo: finalSequencial,
      nome_arquivo: finalNomeArquivo,
      hash_arquivo: finalHash,
      conteudo_arquivo: finalConteudo,
    } as CnabRemessaArquivo;
  },

  // ——— Atualização de status e validação de download ——————

  /**
   * FIX-CNAB-05: Validação Positiva de Segurança para Download de Arquivo de Remessa
   *
   * Garante Fail-Closed em todas as condições:
   * 1. Presença do conteúdo no banco de dados.
   * 2. Integridade criptográfica via SHA-256 (quando hash persistido).
   * 3. Ambiente de Homologação:
   *    - Bloqueia SUMARIAMENTE qualquer conteúdo posicional bancário (FEBRABAN 240 chars).
   *    - Exige conformidade estrita com o padrão canônico ORBE_SIMULACAO_CNAB_V1.
   * 4. Ambiente de Produção:
   *    - Bloqueia arquivos de simulação (impedindo confusão operacional).
   */
  async validarDownloadArquivo(arquivo: CnabRemessaArquivo): Promise<{ valido: boolean; tipo: 'simulacao' | 'bancario' }> {
    // 1. Conteúdo obrigatório (Fail-Closed)
    if (!arquivo.conteudo_arquivo || !arquivo.conteudo_arquivo.trim()) {
      throw new Error('Bloqueio de Segurança: Conteúdo do arquivo de remessa ausente ou vazio na base de dados.');
    }

    const conteudo = arquivo.conteudo_arquivo;

    // 2. Inspeção do conteúdo físico (nunca confiar exclusivamente no nome ou metadados)
    const linhas = conteudo.split(/\r?\n/).map(l => l.trimEnd()).filter(Boolean);
    const contemLinhasBancarias = linhas.some(l => l.length === 240 && /^[0-9]{3}/.test(l));
    const isSimulacaoHeader = conteudo.startsWith('ORBE_SIMULACAO_CNAB_V1') || (linhas.length > 0 && linhas[0] === 'ORBE_SIMULACAO_CNAB_V1');

    // 3. Cenário de Homologação (modo === 'homologacao' ou nome iniciando com SIMULACAO_)
    const isHomologacaoContext = arquivo.modo === 'homologacao' || (arquivo.nome_arquivo && arquivo.nome_arquivo.startsWith('SIMULACAO_'));

    if (isHomologacaoContext) {
      // Bloqueio rigoroso de formato bancário em homologação (ex: NSA 9 histórica, arquivo 240 chars ou spoofing de nome)
      if (contemLinhasBancarias || !isSimulacaoHeader) {
        throw new Error(
          'Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.'
        );
      }

      // Validação semântica e estrutural do relatório de simulação canônico
      const validacaoSimulacao = SimulacaoHomologacaoService.validar(conteudo);
      if (!validacaoSimulacao.valido) {
        if (validacaoSimulacao.erro?.includes('posicionais FEBRABAN')) {
          throw new Error(
            'Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.'
          );
        }
        throw new Error(`Bloqueio de Segurança: Estrutura do relatório de simulação inválida (${validacaoSimulacao.erro}).`);
      }

      // 4. Verificação de integridade de Hash (quando hash_arquivo estiver preenchido)
      if (arquivo.hash_arquivo && arquivo.hash_arquivo.trim()) {
        const hashCalculado = await sha256(conteudo);
        if (hashCalculado.toLowerCase() !== arquivo.hash_arquivo.trim().toLowerCase()) {
          throw new Error('Bloqueio de Segurança: Hash do conteúdo persistido diverge do hash oficial registrado na remessa.');
        }
      }

      return { valido: true, tipo: 'simulacao' };
    }

    // 5. Cenário de Produção
    if (isSimulacaoHeader) {
      throw new Error('Bloqueio de Segurança: Arquivo de simulação não pode ser baixado no ambiente de Produção.');
    }

    // Verificação de integridade de Hash em Produção
    if (arquivo.hash_arquivo && arquivo.hash_arquivo.trim()) {
      const hashCalculado = await sha256(conteudo);
      if (hashCalculado.toLowerCase() !== arquivo.hash_arquivo.trim().toLowerCase()) {
        throw new Error('Bloqueio de Segurança: Hash do conteúdo persistido diverge do hash oficial registrado na remessa.');
      }
    }

    return { valido: true, tipo: 'bancario' };
  },

  async marcarComoBaixado(arquivoId: string): Promise<void> {
    const arquivo = await this.buscarPorId(arquivoId);
    if (!arquivo) throw new Error('Arquivo CNAB não encontrado');

    // FIX-CNAB-05: Validação positiva de segurança antes de marcar como baixado
    await this.validarDownloadArquivo(arquivo);

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

    // Bloqueio de Segurança: Remessas de homologação não podem ser transmitidas ou enviadas como operação bancária real
    if (arquivo.modo === 'homologacao') {
      throw new Error('Bloqueio de Segurança: Remessas geradas no ambiente de Homologação não podem ser transmitidas ou marcadas como enviadas ao banco real.');
    }

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

    // Remessas legítimas de produção não transitam pelo status 'homologado'
    if (arquivo.modo === 'producao') {
      throw new Error('Operação inválida: Remessas do ambiente de Produção não utilizam status de homologação.');
    }

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
    const tenantId = await getCurrentTenantId();
    let contasQuery = supabase.from('contas_bancarias_empresa').select('id, empresa_id');
    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
    contasQuery = EnvironmentQueryFilter.applyEmpresaScope(contasQuery, { tenantId, column: 'empresa_id', includeNullInProduction: false, testIds });
    const { data: allowedContas } = await contasQuery;
    const allowedContaIds = (allowedContas ?? []).map(c => c.id);
    if(allowedContaIds.length === 0) allowedContaIds.push('00000000-0000-0000-0000-000000000000');

    let query = supabase
      .from('cnab_remessas_arquivos')
      .select('*')
      .in('conta_bancaria_id', allowedContaIds)
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
    const tenantId = await getCurrentTenantId();
    let contasQuery = supabase.from('contas_bancarias_empresa').select('id, empresa_id');
    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
    contasQuery = EnvironmentQueryFilter.applyEmpresaScope(contasQuery, { tenantId, column: 'empresa_id', includeNullInProduction: false, testIds });
    const { data: allowedContas } = await contasQuery;
    const allowedContaIds = (allowedContas ?? []).map(c => c.id);
    if(allowedContaIds.length === 0) allowedContaIds.push('00000000-0000-0000-0000-000000000000');

    let query = supabase
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
      .in('conta_bancaria_id', allowedContaIds)
      .order('data_geracao', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
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
          .eq('user_id', user.id)
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
