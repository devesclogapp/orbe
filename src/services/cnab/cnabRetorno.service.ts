import { supabase } from '@/lib/supabase';
import {
  CNAB240BBReader,
  type CnabRetornoDetalhe,
  type CnabRetornoParseResult,
} from './CNAB240BBReader';
import { CnabRemessaArquivoService, type CnabRemessaHistoricoItem } from './cnabRemessaArquivo.service';
import { mapearOcorrenciaBB } from './retorno/ocorrenciasBB';
import { CnabConciliacaoService } from './cnabConciliacao.service';
import { getCurrentTenantId } from '../domain/base.service';
import { EnvironmentService } from '../environment/EnvironmentService';
import { EnvironmentQueryFilter } from '../environment/EnvironmentQueryFilter';

export type CnabRetornoArquivoStatus = 'processado' | 'processado_com_pendencias' | 'erro';
export type CnabRetornoItemStatus = 'pago' | 'rejeitado' | 'divergente' | 'pendente' | 'desconhecido';
export type CnabConciliacaoStatus =
  | 'aguardando_conciliacao'
  | 'conciliado'
  | 'divergente'
  | 'rejeitado_banco'
  | 'revertido';

export interface CnabRetornoArquivo {
  id: string;
  remessa_arquivo_id?: string | null;
  nome_arquivo: string;
  hash_arquivo: string;
  banco_codigo: string;
  data_processamento: string;
  usuario_processamento?: string | null;
  total_linhas: number;
  total_processados: number;
  total_sucesso: number;
  total_rejeitado: number;
  total_divergente: number;
  total_pendente: number;
  status: CnabRetornoArquivoStatus;
  erros_json: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CnabRetornoItem {
  id: string;
  retorno_arquivo_id: string;
  remessa_arquivo_id?: string | null;
  lote_id?: string | null;
  diaristas_lote_id?: string | null;
  intermitentes_lote_id?: string | null;
  fatura_id?: string | null;
  colaborador_id?: string | null;
  nome_favorecido?: string | null;
  documento_favorecido?: string | null;
  valor_esperado?: number | null;
  valor_retornado?: number | null;
  data_ocorrencia?: string | null;
  codigo_ocorrencia?: string | null;
  descricao_ocorrencia?: string | null;
  status: CnabRetornoItemStatus;
  status_conciliacao?: CnabConciliacaoStatus;
  observacao_conciliacao?: string | null;
  conciliado_em?: string | null;
  conciliado_por?: string | null;
  revertido_em?: string | null;
  revertido_por?: string | null;
  linha_original: string;
  parsed_json: Record<string, unknown>;
  created_at: string;
}

interface FaturaComColaborador {
  id: string;
  lote_remessa_id?: string | null;
  colaborador_id?: string | null;
  valor: number;
  nosso_numero?: string | null;
  competencia?: string | null;
  colaboradores?: {
    id: string;
    nome?: string | null;
    cpf?: string | null;
  } | null;
}

interface MatchResult {
  fatura: FaturaComColaborador | null;
  criterio: string;
}

export interface ProcessarRetornoResult {
  arquivo: CnabRetornoArquivo;
  itens: CnabRetornoItem[];
  resumo: {
    totalProcessado: number;
    pagos: number;
    rejeitados: number;
    divergentes: number;
    pendentes: number;
    desconhecidos: number;
  };
  remessaRelacionada: CnabRemessaHistoricoItem | null;
  parseResult: CnabRetornoParseResult;
}

function normalizeDoc(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function moneyEquals(left?: number | null, right?: number | null): boolean {
  return Math.abs(Number(left || 0) - Number(right || 0)) < 0.01;
}

async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((item) => item.toString(16).padStart(2, '0')).join('');
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function buildFaturaPrefix(faturaId: string): string {
  return `PGT${faturaId.substring(0, 8).toUpperCase()}`;
}

function classifyItem(detalhe: CnabRetornoDetalhe, fatura: FaturaComColaborador | null): CnabRetornoItemStatus {
  const ocorrencia = mapearOcorrenciaBB(detalhe.codigoOcorrencia);

  if (!fatura) {
    return ocorrencia.statusBase === 'pago' ? 'pendente' : 'desconhecido';
  }

  if (ocorrencia.statusBase === 'rejeitado') {
    return 'rejeitado';
  }

  if (ocorrencia.statusBase === 'pago') {
    if (!moneyEquals(fatura.valor, detalhe.valorPago)) {
      return 'divergente';
    }
    return 'pago';
  }

  if (ocorrencia.statusBase === 'pendente') {
    return 'pendente';
  }

  return 'desconhecido';
}

export const CnabRetornoService = {
  async listarHistorico(limit = 20): Promise<CnabRetornoArquivo[]> {
    const { data, error } = await supabase
      .from('cnab_retorno_arquivos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Erro ao listar retornos bancarios: ${error.message}`);
    return (data ?? []) as CnabRetornoArquivo[];
  },

  async listarItens(retornoArquivoId: string): Promise<CnabRetornoItem[]> {
    const { data, error } = await supabase
      .from('cnab_retorno_itens')
      .select('*')
      .eq('retorno_arquivo_id', retornoArquivoId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Erro ao listar itens do retorno: ${error.message}`);
    return (data ?? []) as CnabRetornoItem[];
  },

  async processarArquivo(file: File, banco: string): Promise<ProcessarRetornoResult> {
    const content = await file.text();
    if (!content.trim()) {
      throw new Error('Arquivo de retorno vazio.');
    }

    const fileName = file.name;
    const hash = await sha256(content);

    const { data: duplicate, error: duplicateError } = await supabase
      .from('cnab_retorno_arquivos')
      .select('id, nome_arquivo, created_at')
      .eq('hash_arquivo', hash)
      .maybeSingle();

    if (duplicateError) {
      throw new Error(`Erro ao verificar duplicidade do retorno: ${duplicateError.message}`);
    }

    if (duplicate) {
      throw new Error(`Arquivo de retorno ja processado anteriormente (${duplicate.nome_arquivo}).`);
    }

    const reader = new CNAB240BBReader();

    let parseResult: CnabRetornoParseResult;

    try {
      parseResult = await reader.parse(content, {
        banco,
        fileName,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error) {
      await CnabRemessaArquivoService.registrarAuditoria({
        acao: 'erro_retorno',
        detalhes: {
          nome_arquivo: fileName,
          banco,
          erro: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    const remessaRelacionada = await this.localizarRemessaRelacionada(parseResult);
    const faturasRelacionadas = await this.carregarFaturasRelacionadas(remessaRelacionada, parseResult);
    const itensPersistiveis = parseResult.detalhes.map((detalhe) => {
      const match = this.matchDetalhe(detalhe, faturasRelacionadas);
      const status = classifyItem(detalhe, match.fatura);
      const ocorrencia = mapearOcorrenciaBB(detalhe.codigoOcorrencia);

      return {
        remessa_arquivo_id: remessaRelacionada?.id ?? null,
        lote_id: remessaRelacionada?.lote_id ?? null,
        diaristas_lote_id: remessaRelacionada?.diaristas_lote_id ?? null,
        intermitentes_lote_id: remessaRelacionada?.intermitentes_lote_id ?? null,
        fatura_id: match.fatura?.id ?? null,
        colaborador_id: match.fatura?.colaborador_id ?? null,
        nome_favorecido: detalhe.nomeFavorecido || match.fatura?.colaboradores?.nome || null,
        documento_favorecido: detalhe.documentoFavorecido || match.fatura?.colaboradores?.cpf || null,
        valor_esperado: match.fatura?.valor ?? null,
        valor_retornado: detalhe.valorPago ?? null,
        data_ocorrencia: detalhe.dataOcorrencia ?? null,
        codigo_ocorrencia: detalhe.codigoOcorrencia,
        descricao_ocorrencia: detalhe.descricaoOcorrencia || ocorrencia.mensagem,
        status,
        status_conciliacao: 'aguardando_conciliacao',
        linha_original: detalhe.linhaOriginal,
        parsed_json: {
          ...detalhe.parsedJson,
          match_criterio: match.criterio,
        },
      };
    });

    const resumo = {
      totalProcessado: itensPersistiveis.length,
      pagos: itensPersistiveis.filter((item) => item.status === 'pago').length,
      rejeitados: itensPersistiveis.filter((item) => item.status === 'rejeitado').length,
      divergentes: itensPersistiveis.filter((item) => item.status === 'divergente').length,
      pendentes: itensPersistiveis.filter((item) => item.status === 'pendente').length,
      desconhecidos: itensPersistiveis.filter((item) => item.status === 'desconhecido').length,
    };

    const rpcPayloadItens = itensPersistiveis.map(item => ({
      remessa_id: item.remessa_arquivo_id,
      remessa_item_id: null,
      origem_tipo: remessaRelacionada?.intermitentes_lote_id ? 'INTERMITENTE' : (remessaRelacionada?.diaristas_lote_id ? 'CLT' : 'FATURA'),
      origem_id: item.colaborador_id ? item.fatura_id : null,
      status: item.status,
      data_ocorrencia: item.data_ocorrencia,
      codigo_ocorrencia: item.codigo_ocorrencia,
      descricao_ocorrencia: item.descricao_ocorrencia,
      valor_esperado: item.valor_esperado,
      valor_pago: item.valor_retornado,
      linha_original: item.linha_original
    }));

    // For tracking the origins
    if (remessaRelacionada?.diaristas_lote_id) { rpcPayloadItens.forEach(i => i.origem_tipo = 'CLT'); /* Because Diaristas are treated alongside CLT in RH tables natively mostly, or simply as RH_FINANCEIRO_ITEM - but the RPC uses 'CLT' or 'INTERMITENTE' */ }

    // Execute atomic RPC Block
    const { data: rpcResult, error: rpcError } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
      p_empresa_id: remessaRelacionada?.contas_bancarias_empresa?.empresa_id,
      p_conta_bancaria_id: remessaRelacionada?.conta_bancaria_id,
      p_banco_codigo: banco,
      p_nome_arquivo: fileName,
      p_hash_arquivo: hash,
      p_itens: rpcPayloadItens
    });

    if (rpcError) {
      throw new Error(`Divergência / Erro Crítico na Transação de Retorno CNAB RPC: ${rpcError.message}`);
    }

    try {
      await supabase.rpc('log_audit', {
        p_action: 'PROCESS_CNAB240_RETORNO',
        p_details: JSON.stringify({
          remessa_arquivo_id: remessaRelacionada?.id ?? null,
          diaristas_lote_id: remessaRelacionada?.diaristas_lote_id ?? null,
          nome_arquivo: fileName,
          total_processado: resumo.totalProcessado,
          pagos: resumo.pagos,
          rejeitados: resumo.rejeitados,
          divergentes: resumo.divergentes,
          pendentes: resumo.pendentes,
          desconhecidos: resumo.desconhecidos,
        }),
      });
    } catch (_error) {
      // audit never blocks
    }

    // Attempt to automatically perform specific business lowerings if not rolled back natively
    try {
      if (rpcResult?.retorno_arquivo_id) {
         await CnabConciliacaoService.processarBaixaAutomatica(rpcResult.retorno_arquivo_id);
      }
    } catch (_error) {
       // Automatic low could wait
    }

    return {
      arquivo: { id: rpcResult?.retorno_arquivo_id } as any, // Mock struct for the caller
      itens: [] as any[], // No longer fully mapped locally avoiding cache issues
      resumo,
      remessaRelacionada,
      parseResult,
    };
  },

  async localizarRemessaRelacionada(parseResult: CnabRetornoParseResult): Promise<CnabRemessaHistoricoItem | null> {
    const sequencial = parseResult.metadados.sequencialArquivo;
    if (!sequencial) return null;

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
          empresa_id,
          banco_codigo,
          banco_nome,
          agencia,
          conta,
          convenio
        )
      `)
      .eq('sequencial_arquivo', sequencial)
      .eq('banco_codigo', parseResult.estrutura.headerArquivo.banco);

    if (error) {
      throw new Error(`Erro ao localizar remessa relacionada: ${error.message}`);
    }

    const candidatosIniciais = (data ?? []) as CnabRemessaHistoricoItem[];
    if (!candidatosIniciais.length) return null;

    const candidatos: CnabRemessaHistoricoItem[] = [];
    const tenantId = await getCurrentTenantId();
    for (const cand of candidatosIniciais) {
      const conta = cand.contas_bancarias_empresa as ({ empresa_id?: string | null, convenio?: string | null } & Record<string, unknown>) | null;
      if (conta?.empresa_id) {
         try {
           await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId: conta.empresa_id });
           candidatos.push(cand);
         } catch (e) {
           console.warn('[CNAB Retorno] Ignorando candidato fora do escopo de ambiente:', cand.id);
         }
      }
    }
    
    if (!candidatos.length) return null;

    const agenciaArquivo = parseResult.estrutura.headerArquivo.agencia;
    const contaArquivo = parseResult.estrutura.headerArquivo.conta;
    const convenioArquivo = parseResult.estrutura.headerArquivo.convenio;

    return (
      candidatos.find((item) => {
        const conta = item.contas_bancarias_empresa as ({ convenio?: string | null } & Record<string, unknown>) | null;
        return (
          normalizeDoc(String(conta?.agencia || '')) === normalizeDoc(agenciaArquivo) &&
          normalizeDoc(String(conta?.conta || '')) === normalizeDoc(contaArquivo) &&
          normalizeDoc(String(conta?.convenio || '')) === normalizeDoc(convenioArquivo)
        );
      }) ||
      candidatos.find((item) =>
        moneyEquals(Number(item.total_valor || item.lotes_remessa?.valor_total || 0), parseResult.resumo.valorTotalPago)
      ) ||
      candidatos[0]
    );  },

  async carregarFaturasRelacionadas(
    remessaRelacionada: CnabRemessaHistoricoItem | null,
    parseResult: CnabRetornoParseResult
  ): Promise<FaturaComColaborador[]> {
    const tenantId = await getCurrentTenantId();

    if (remessaRelacionada?.lote_id) {
       // Lotes RH Padrão (CLT) - Fetches the rh_financeiro_lote_itens as faturas
       let query = supabase.from('rh_financeiro_lote_itens').select('id, lote_id, colaborador_id, valor_calculado, colaboradores(id, nome, cpf)').eq('lote_id', remessaRelacionada.lote_id);
       const { data, error } = await query;
       if (error) throw new Error(`Erro ao carregar itens RH Financeiro do Lote CLT: ${error.message}`);
       return (data ?? []).map((x: any) => ({
          id: x.id,
          lote_remessa_id: x.lote_id,
          colaborador_id: x.colaborador_id,
          valor: x.valor_calculado,
          colaboradores: x.colaboradores
       })) as unknown as FaturaComColaborador[];
    }

    if (remessaRelacionada?.intermitentes_lote_id) {
      const { data: loteData, error: loteError } = await supabase
        .from('intermitentes_lotes_fechamento')
        .select('empresa_id, competencia')
        .eq('id', remessaRelacionada.intermitentes_lote_id)
        .maybeSingle();

      if (loteError || !loteData?.empresa_id || !loteData?.competencia) return [];
      
      const { data: parentRHLote } = await supabase.from('rh_financeiro_lotes')
          .select('id').eq('tenant_id', tenantId).eq('empresa_id', loteData.empresa_id).eq('competencia', loteData.competencia).eq('tipo', 'INTERMITENTES').maybeSingle();
          
      if (!parentRHLote) return [];
      
      const { data: items } = await supabase.from('rh_financeiro_lote_itens').select('id, lote_id, colaborador_id, valor_calculado, colaboradores(id, nome, cpf)').eq('lote_id', parentRHLote.id);
      
      return (items ?? []).map((x: any) => ({
          id: x.id,
          lote_remessa_id: x.lote_id,
          colaborador_id: x.colaborador_id,
          valor: x.valor_calculado,
          colaboradores: x.colaboradores
      })) as unknown as FaturaComColaborador[];
    }

    if (remessaRelacionada?.diaristas_lote_id) {
      const { data: loteData, error: loteError } = await supabase
        .from('diaristas_lotes_fechamento')
        .select('empresa_id, mes_referencia')
        .eq('id', remessaRelacionada.diaristas_lote_id)
        .maybeSingle();

      if (loteError || !loteData?.empresa_id || !loteData?.mes_referencia) return [];

      const { data: parentRHLote } = await supabase.from('rh_financeiro_lotes')
          .select('id').eq('tenant_id', tenantId).eq('empresa_id', loteData.empresa_id).eq('competencia', loteData.mes_referencia).eq('tipo', 'DIARISTAS').maybeSingle();
          
      if (!parentRHLote) return [];
      
      const { data: items } = await supabase.from('rh_financeiro_lote_itens').select('id, lote_id, colaborador_id, valor_calculado, colaboradores(id, nome, cpf)').eq('lote_id', parentRHLote.id);

      return (items ?? []).map((x: any) => ({
          id: x.id,
          lote_remessa_id: x.lote_id,
          colaborador_id: x.colaborador_id,
          valor: x.valor_calculado,
          colaboradores: x.colaboradores
      })) as unknown as FaturaComColaborador[];
    }

    // Else Faturas normais (Operacional avulso, não vinculado a lote RH/Diarista)
    const docs = Array.from(new Set(parseResult.detalhes.map((item) => normalizeDoc(item.documentoFavorecido)).filter(Boolean)));
    if (!docs.length) return [];

    let queryDocs = supabase.from('faturas').select('id, lote_remessa_id, colaborador_id, valor, nosso_numero, competencia, empresa_id, colaboradores(id, nome, cpf)');
    const finalQuery = await EnvironmentQueryFilter.applyEmpresaScope(queryDocs, { tenantId, column: 'empresa_id', includeNullInProduction: false });
    const { data, error } = await finalQuery;

    if (error) return [];
    return ((data ?? []) as any as FaturaComColaborador[]).filter((item) => docs.includes(normalizeDoc(item.colaboradores?.cpf)));
  },

  matchDetalhe(detalhe: CnabRetornoDetalhe, faturas: FaturaComColaborador[]): MatchResult {
    const seuNumero = String(detalhe.seuNumero || detalhe.documentoEmpresa || '').trim().toUpperCase();
    const nossoNumero = String(detalhe.nossoNumero || '').trim().toUpperCase();
    const documento = normalizeDoc(detalhe.documentoFavorecido);

    const bySeuNumero = faturas.find((fatura) => buildFaturaPrefix(fatura.id) === seuNumero);
    if (bySeuNumero) return { fatura: bySeuNumero, criterio: 'seu_numero_prefixo' };

    const byNossoNumero = nossoNumero
      ? faturas.find((fatura) => String(fatura.nosso_numero || '').trim().toUpperCase() === nossoNumero)
      : null;
    if (byNossoNumero) return { fatura: byNossoNumero, criterio: 'nosso_numero' };

    const byDocumentoValor = documento
      ? faturas.find(
          (fatura) =>
            normalizeDoc(fatura.colaboradores?.cpf) === documento && moneyEquals(fatura.valor, detalhe.valorPago)
        )
      : null;
    if (byDocumentoValor) return { fatura: byDocumentoValor, criterio: 'documento_valor' };

    const byDocumento = documento
      ? faturas.find((fatura) => normalizeDoc(fatura.colaboradores?.cpf) === documento)
      : null;
    if (byDocumento) return { fatura: byDocumento, criterio: 'documento' };

    const byValor = faturas.find((fatura) => moneyEquals(fatura.valor, detalhe.valorPago));
    if (byValor) return { fatura: byValor, criterio: 'valor' };

    return { fatura: null, criterio: 'nao_encontrado' };
  },
};
