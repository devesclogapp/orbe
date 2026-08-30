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
        fatura_origem_tipo: (match.fatura as any)?.origem_tipo || 'FATURA',
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
      remessa_item_id: null,
      origem_tipo: (item as any).fatura_origem_tipo || 'FATURA',
      origem_id: item.colaborador_id ? item.fatura_id : null,
      status: item.status,
      data_ocorrencia: item.data_ocorrencia,
      codigo_ocorrencia: item.codigo_ocorrencia,
      descricao_ocorrencia: item.descricao_ocorrencia,
      valor_esperado: item.valor_esperado,
      valor_pago: item.valor_retornado,
      linha_original: item.linha_original
    }));

    // Executando atomic RPC Block
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
    if (!remessaRelacionada?.id) return [];

    const { data: itensRemessa, error: itensErr } = await supabase
      .from('cnab_remessa_itens')
      .select('origem_tipo, origem_id, fatura_id, lote_item_id')
      .eq('remessa_id', remessaRelacionada.id);

    if (itensErr || !itensRemessa || itensRemessa.length === 0) return [];

    const rhItemIds = itensRemessa.filter(i => i.origem_tipo === 'CLT' || i.origem_tipo === 'INTERMITENTE').map(i => i.origem_id);
    const faturaIds = itensRemessa.filter(i => i.origem_tipo === 'FATURA').map(i => i.origem_id);

    let resolvedFaturas: FaturaComColaborador[] = [];

    if (rhItemIds.length > 0) {
      const { data: rhData } = await supabase
        .from('rh_financeiro_lote_itens')
        .select('id, lote_id, colaborador_id, valor_calculado, colaboradores(id, nome, cpf)')
        .in('id', rhItemIds);
        
      if (rhData) {
        const mapped = rhData.map((x: any) => ({
          lote_remessa_id: x.lote_id,
          colaborador_id: x.colaborador_id,
          valor: x.valor_calculado,
          colaboradores: x.colaboradores,
          origem_tipo: 'CLT'
        }));
        resolvedFaturas = resolvedFaturas.concat(mapped as any);
      }
    }

    if (faturaIds.length > 0) {
      const { data: faturasData } = await supabase
        .from('faturas')
        .select('id, lote_remessa_id, colaborador_id, valor, nosso_numero, competencia, empresa_id, colaboradores(id, nome, cpf)')
        .in('id', faturaIds);
        
      if (faturasData) {
        resolvedFaturas = resolvedFaturas.concat(faturasData.map((f: any) => ({ ...f, origem_tipo: 'FATURA' })) as any);
      }
    }

    return resolvedFaturas;
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
