import { supabase } from '@/lib/supabase';
import {
  type CnabRetornoDetalhe,
  type CnabRetornoParseResult,
} from './CNAB240BBReader';
import { CNABRetornoReaderFactory, mapearOcorrenciaRetorno } from './CNABRetornoReaderFactory';
import { CnabRemessaArquivoService, type CnabRemessaHistoricoItem } from './cnabRemessaArquivo.service';
import { CnabConciliacaoService } from './cnabConciliacao.service';
import { getCurrentTenantId } from '../domain/base.service';
import { EnvironmentService } from '../environment/EnvironmentService';

export type CnabRetornoArquivoStatus = 'processado' | 'processado_com_pendencias' | 'erro';
export type CnabRetornoItemStatus = 'pago' | 'rejeitado' | 'divergente' | 'pendente' | 'desconhecido';
export type CnabConciliacaoStatus =
  | 'aguardando_conciliacao'
  | 'conciliado'
  | 'conciliacao_parcial'
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
  remessa_item_id?: string | null;
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
  origem_tipo?: string | null;
  parsed_json: Record<string, unknown>;
  created_at: string;
}

interface FaturaComColaborador {
  id: string;
  remessa_item_id?: string | null;
  lote_id?: string | null;
  diaristas_lote_id?: string | null;
  intermitentes_lote_id?: string | null;
  colaborador_id?: string | null;
  valor: number;
  valor_consolidado?: number;
  seu_numero_esperado?: string | null;
  nosso_numero?: string | null;
  competencia?: string | null;
  origem_tipo?: 'CLT' | 'INTERMITENTE' | 'DIARISTA' | 'FATURA';
  colaboradores?: {
    id: string;
    nome?: string | null;
    cpf?: string | null;
  } | null;
}

export function toCents(value?: number | string | null): number {
  if (value === null || value === undefined || value === '') return 0;
  return Math.round(Number(value) * 100);
}

export interface MatchResult {
  fatura: FaturaComColaborador | null;
  faturas: FaturaComColaborador[];
  isConsolidado: boolean;
  criterio:
    | 'seu_numero_forte'
    | 'seu_numero_prefixo'
    | 'nosso_numero'
    | 'documento_valor'
    | 'documento'
    | 'valor'
    | 'nao_encontrado';
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

function buildFaturaPrefix(faturaId?: string | null): string {
  if (!faturaId) return '';
  return `PGT${String(faturaId).substring(0, 8).toUpperCase()}`;
}

function classifyItem(
  detalhe: CnabRetornoDetalhe,
  match: MatchResult | FaturaComColaborador | null,
  banco: string
): CnabRetornoItemStatus {
  const ocorrencia = mapearOcorrenciaRetorno(banco, detalhe.codigoOcorrencia);

  const faturas: FaturaComColaborador[] = !match
    ? []
    : 'faturas' in match
    ? match.faturas
    : [match];

  if (!faturas.length) {
    return ocorrencia.statusBase === 'pago' ? 'pendente' : 'desconhecido';
  }

  if (ocorrencia.statusBase === 'rejeitado') {
    return 'rejeitado';
  }

  if (ocorrencia.statusBase === 'pago') {
    const detalheCents = toCents(detalhe.valorPago);
    const sumCents = faturas.reduce((acc, f) => acc + toCents(f.valor), 0);

    if (detalheCents !== sumCents) {
      return 'divergente';
    }
    return 'pago';
  }

  if (ocorrencia.statusBase === 'pendente') {
    return 'pendente';
  }

  return 'desconhecido';
}

async function readFileContent(file: File): Promise<string> {
  if (!file) {
    throw new Error('Arquivo de retorno não fornecido.');
  }
  if (typeof (file as unknown) === 'string') {
    throw new Error('Contrato inválido: CnabRetornoService.processarArquivo requer um objeto File nativo.');
  }
  if (typeof file.text === 'function') {
    return await file.text();
  }
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo com FileReader.'));
      reader.readAsText(file);
    });
  }
  if (typeof Response !== 'undefined' && typeof Blob !== 'undefined' && file instanceof Blob) {
    return await new Response(file).text();
  }
  throw new Error('Não foi possível ler o arquivo: ambiente sem suporte a file.text(), arrayBuffer() ou FileReader.');
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
    const content = await readFileContent(file);
    if (!content.trim()) {
      throw new Error('Arquivo de retorno vazio.');
    }

    const fileName = file.name || 'retorno.ret';
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

    // Fábrica multibanco: identifica o banco e cria o reader apropriado (001 -> BB, 341 -> Itaú)
    const reader = CNABRetornoReaderFactory.getReader(content, banco);

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
    if (!remessaRelacionada) {
      const nsaFormatado = String(
        parseResult.metadados.sequencialArquivo ||
        parseResult.estrutura.headerArquivo?.sequencialArquivo ||
        ''
      ).padStart(6, '0');
      throw new Error(
        `Remessa bancária correspondente não encontrada para Banco ${banco} / NSA ${nsaFormatado}. Nenhuma baixa foi realizada.`
      );
    }

    const faturasRelacionadas = await this.carregarFaturasRelacionadas(remessaRelacionada, parseResult);

    const itensPersistiveis: any[] = [];

    for (const detalhe of parseResult.detalhes) {
      const match = this.matchDetalhe(detalhe, faturasRelacionadas);
      const status = classifyItem(detalhe, match, banco);
      const ocorrencia = mapearOcorrenciaRetorno(banco, detalhe.codigoOcorrencia);

      if (match.faturas.length > 1) {
        // Desdobramento 1:N (pagamento bancário consolidado com múltiplos lançamentos operacionais)
        for (const faturaItem of match.faturas) {
          const valorEsperado = faturaItem.valor;
          // Contabilidade segura: se o retorno liquidou com sucesso, a baixa de cada item
          // é exatamente o seu valor unitário, somando o valor retornado sem duplicar.
          const valorPagoItem = status === 'pago' ? valorEsperado : 0;
          const origemTipo = faturaItem.origem_tipo || 'FATURA';

          const loteId = origemTipo === 'FATURA' ? (faturaItem.lote_id || remessaRelacionada?.lote_id || null) : (origemTipo === 'CLT' ? (faturaItem.lote_id || remessaRelacionada?.lote_id || null) : null);
          const diaristasLoteId = origemTipo === 'DIARISTA' ? (faturaItem.diaristas_lote_id || remessaRelacionada?.diaristas_lote_id || null) : null;
          const intermitentesLoteId = origemTipo === 'INTERMITENTE' ? (faturaItem.intermitentes_lote_id || remessaRelacionada?.intermitentes_lote_id || null) : null;

          const faturaId = origemTipo === 'FATURA' ? (faturaItem.id ?? null) : null;
          const origemId = faturaItem.id ?? null;

          itensPersistiveis.push({
            remessa_arquivo_id: remessaRelacionada?.id ?? null,
            remessa_item_id: faturaItem.remessa_item_id ?? null,
            lote_id: loteId,
            diaristas_lote_id: diaristasLoteId,
            intermitentes_lote_id: intermitentesLoteId,
            fatura_id: faturaId,
            origem_id: origemId,
            colaborador_id: faturaItem.colaborador_id ?? null,
            nome_favorecido: detalhe.nomeFavorecido || faturaItem.colaboradores?.nome || null,
            documento_favorecido: detalhe.documentoFavorecido || faturaItem.colaboradores?.cpf || null,
            valor_esperado: valorEsperado,
            valor_retornado: valorPagoItem,
            data_ocorrencia: detalhe.dataOcorrencia ?? null,
            codigo_ocorrencia: detalhe.codigoOcorrencia,
            descricao_ocorrencia: detalhe.descricaoOcorrencia || ocorrencia.mensagem,
            status,
            status_conciliacao: (status === 'rejeitado' ? 'rejeitado_banco' : (status === 'pago' ? 'conciliado' : 'aguardando_conciliacao')) as CnabConciliacaoStatus,
            linha_original: detalhe.linhaOriginal,
            fatura_origem_tipo: origemTipo,
            parsed_json: {
              ...detalhe.parsedJson,
              match_criterio: match.criterio,
              is_consolidado: true,
              total_itens_grupo: match.faturas.length,
              valor_retornado_grupo: detalhe.valorPago,
              seu_numero_retorno: detalhe.seuNumero,
              remessa_item_id: faturaItem.remessa_item_id,
              origem_tipo: origemTipo,
            },
          });
        }
      } else {
        // 1:1 ou Não Encontrado
        const faturaItem = match.faturas[0] || null;
        const valorEsperado = faturaItem?.valor ?? null;
        const valorPagoItem = status === 'pago' ? (valorEsperado ?? detalhe.valorPago) : (status === 'rejeitado' ? 0 : detalhe.valorPago);
        const origemTipo = faturaItem?.origem_tipo || 'FATURA';

        const loteId = origemTipo === 'FATURA' ? (faturaItem?.lote_id || remessaRelacionada?.lote_id || null) : (origemTipo === 'CLT' ? (faturaItem?.lote_id || remessaRelacionada?.lote_id || null) : null);
        const diaristasLoteId = origemTipo === 'DIARISTA' ? (faturaItem?.diaristas_lote_id || remessaRelacionada?.diaristas_lote_id || null) : null;
        const intermitentesLoteId = origemTipo === 'INTERMITENTE' ? (faturaItem?.intermitentes_lote_id || remessaRelacionada?.intermitentes_lote_id || null) : null;
        const faturaId = origemTipo === 'FATURA' ? (faturaItem?.id ?? null) : null;
        const origemId = faturaItem?.id ?? null;

        itensPersistiveis.push({
          remessa_arquivo_id: remessaRelacionada?.id ?? null,
          remessa_item_id: faturaItem?.remessa_item_id ?? null,
          lote_id: loteId,
          diaristas_lote_id: diaristasLoteId,
          intermitentes_lote_id: intermitentesLoteId,
          fatura_id: faturaId,
          origem_id: origemId,
          colaborador_id: faturaItem?.colaborador_id ?? null,
          nome_favorecido: detalhe.nomeFavorecido || faturaItem?.colaboradores?.nome || null,
          documento_favorecido: detalhe.documentoFavorecido || faturaItem?.colaboradores?.cpf || null,
          valor_esperado: valorEsperado,
          valor_retornado: valorPagoItem,
          data_ocorrencia: detalhe.dataOcorrencia ?? null,
          codigo_ocorrencia: detalhe.codigoOcorrencia,
          descricao_ocorrencia: detalhe.descricaoOcorrencia || ocorrencia.mensagem,
          status,
          status_conciliacao: (status === 'rejeitado' ? 'rejeitado_banco' : (status === 'pago' ? 'conciliado' : 'aguardando_conciliacao')) as CnabConciliacaoStatus,
          linha_original: detalhe.linhaOriginal,
          fatura_origem_tipo: origemTipo,
          parsed_json: {
            ...detalhe.parsedJson,
            match_criterio: match.criterio,
            is_consolidado: false,
            seu_numero_retorno: detalhe.seuNumero,
            remessa_item_id: faturaItem?.remessa_item_id,
            origem_tipo: origemTipo,
          },
        });
      }
    }

    const resumo = {
      totalProcessado: parseResult.detalhes.length,
      pagos: parseResult.detalhes.filter((detalhe) => {
        const m = this.matchDetalhe(detalhe, faturasRelacionadas);
        return classifyItem(detalhe, m, banco) === 'pago';
      }).length,
      rejeitados: parseResult.detalhes.filter((detalhe) => {
        const m = this.matchDetalhe(detalhe, faturasRelacionadas);
        return classifyItem(detalhe, m, banco) === 'rejeitado';
      }).length,
      divergentes: parseResult.detalhes.filter((detalhe) => {
        const m = this.matchDetalhe(detalhe, faturasRelacionadas);
        return classifyItem(detalhe, m, banco) === 'divergente';
      }).length,
      pendentes: parseResult.detalhes.filter((detalhe) => {
        const m = this.matchDetalhe(detalhe, faturasRelacionadas);
        return classifyItem(detalhe, m, banco) === 'pendente';
      }).length,
      desconhecidos: parseResult.detalhes.filter((detalhe) => {
        const m = this.matchDetalhe(detalhe, faturasRelacionadas);
        return classifyItem(detalhe, m, banco) === 'desconhecido';
      }).length,
    };

    const rpcPayloadItens = itensPersistiveis.map(item => ({
      remessa_id: remessaRelacionada?.id ?? null,
      remessa_item_id: item.remessa_item_id,
      origem_tipo: item.fatura_origem_tipo,
      origem_id: item.origem_id,
      fatura_id: item.fatura_id ?? null,
      lote_id: item.lote_id ?? null,
      diaristas_lote_id: item.diaristas_lote_id ?? null,
      intermitentes_lote_id: item.intermitentes_lote_id ?? null,
      colaborador_id: item.colaborador_id,
      nome_favorecido: item.nome_favorecido,
      documento_favorecido: item.documento_favorecido,
      status: item.status,
      status_conciliacao: item.status_conciliacao,
      data_ocorrencia: item.data_ocorrencia,
      codigo_ocorrencia: item.codigo_ocorrencia,
      descricao_ocorrencia: item.descricao_ocorrencia,
      valor_esperado: item.valor_esperado,
      valor_pago: item.valor_retornado,
      valor_retornado_grupo: item.parsed_json?.valor_retornado_grupo ?? item.valor_retornado,
      linha_original: item.linha_original,
      parsed_json: item.parsed_json
    }));

    // Validação estrita do contexto da remessa relacionada para fail-closed e garantia do contrato da RPC
    const empresaId = remessaRelacionada.contas_bancarias_empresa?.empresa_id || remessaRelacionada.empresa_id;
    const contaBancariaId = remessaRelacionada.conta_bancaria_id || remessaRelacionada.contas_bancarias_empresa?.id;

    if (!empresaId) {
      throw new Error(
        `Empresa pagadora não identificada na remessa relacionada (${remessaRelacionada.nome_arquivo || remessaRelacionada.id}). Abortando processamento para evitar inconsistência.`
      );
    }

    if (!contaBancariaId) {
      throw new Error(
        `Conta bancária pagadora não identificada na remessa relacionada (${remessaRelacionada.nome_arquivo || remessaRelacionada.id}). Abortando processamento para evitar inconsistência.`
      );
    }

    // Executando atomic RPC Block
    const { data: rpcResult, error: rpcError } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
      p_empresa_id: empresaId,
      p_conta_bancaria_id: contaBancariaId,
      p_banco_codigo: banco,
      p_nome_arquivo: fileName,
      p_hash_arquivo: hash,
      p_itens: rpcPayloadItens
    });

    if (rpcError) {
      throw new Error(`Divergência / Erro Crítico na Transação de Retorno CNAB RPC: ${rpcError.message}`);
    }

    // Enriquecimento e garantia de metadados em cnab_retorno_itens (rastreabilidade completa)
    if (rpcResult?.retorno_arquivo_id) {
      try {
        const { data: itensCriados } = await supabase
          .from('cnab_retorno_itens')
          .select('id, valor_esperado, valor_retornado, linha_original')
          .eq('retorno_arquivo_id', rpcResult.retorno_arquivo_id)
          .order('created_at', { ascending: true });

        if (itensCriados && itensCriados.length === itensPersistiveis.length) {
          for (let idx = 0; idx < itensCriados.length; idx++) {
            const criado = itensCriados[idx];
            const p = itensPersistiveis[idx];
            await supabase
              .from('cnab_retorno_itens')
              .update({
                lote_id: p.lote_id,
                diaristas_lote_id: p.diaristas_lote_id,
                intermitentes_lote_id: p.intermitentes_lote_id,
                fatura_id: p.fatura_id,
                colaborador_id: p.colaborador_id,
                nome_favorecido: p.nome_favorecido,
                documento_favorecido: p.documento_favorecido,
                status_conciliacao: p.status_conciliacao,
                parsed_json: p.parsed_json,
              })
              .eq('id', criado.id);
          }
        }
      } catch (enrichError) {
        console.warn('[CNAB Retorno] Aviso ao enriquecer metadados dos itens de retorno:', enrichError);
      }
    }

    try {
      await supabase.rpc('log_audit', {
        p_action: 'PROCESS_CNAB240_RETORNO',
        p_details: JSON.stringify({
          remessa_arquivo_id: remessaRelacionada?.id ?? null,
          diaristas_lote_id: remessaRelacionada?.diaristas_lote_id ?? null,
          banco_codigo: banco,
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

    // Executar baixa financeira orientada por item com integridade de lote
    if (rpcResult?.retorno_arquivo_id) {
      const concResult = await CnabConciliacaoService.processarBaixaAutomatica(rpcResult.retorno_arquivo_id);
      if (!concResult.success) {
        console.error('[CNAB Retorno] Falha na conciliação automática pós-retorno:', concResult.message);
        throw new Error(`Falha na conciliação automática pós-retorno: ${concResult.message}`);
      }
    }

    return {
      arquivo: { id: rpcResult?.retorno_arquivo_id } as any,
      itens: [] as any[],
      resumo,
      remessaRelacionada,
      parseResult,
    };
  },

  async localizarRemessaRelacionada(parseResult: CnabRetornoParseResult): Promise<CnabRemessaHistoricoItem | null> {
    const sequencial = parseResult.metadados.sequencialArquivo;
    if (!sequencial) return null;

    const bancoArquivo = parseResult.estrutura.headerArquivo.banco;

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
      .eq('sequencial_arquivo', sequencial);

    if (error) {
      throw new Error(`Erro ao localizar remessa relacionada: ${error.message}`);
    }

    // Filtrar com suporte a banco_codigo persistido ou derivado da conta bancária pagadora
    const candidatosIniciais = ((data ?? []) as CnabRemessaHistoricoItem[]).filter((cand: any) => {
      const bancoCand = cand.banco_codigo || cand.contas_bancarias_empresa?.banco_codigo;
      return bancoCand === bancoArquivo;
    });

    if (!candidatosIniciais.length) return null;

    const candidatos: CnabRemessaHistoricoItem[] = [];
    const tenantId = await getCurrentTenantId();
    for (const cand of candidatosIniciais) {
      const conta = cand.contas_bancarias_empresa as ({ empresa_id?: string | null, convenio?: string | null } & Record<string, unknown>) | null;
      if (conta?.empresa_id) {
         try {
           await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId: conta.empresa_id });
           candidatos.push(cand);
         } catch (_e) {
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
    );
  },

  async carregarFaturasRelacionadas(
    remessaRelacionada: CnabRemessaHistoricoItem | null,
    _parseResult: CnabRetornoParseResult
  ): Promise<FaturaComColaborador[]> {
    if (!remessaRelacionada?.id) return [];

    const { data: itensRemessa, error: itensErr } = await supabase
      .from('cnab_remessa_itens')
      .select('id, remessa_id, origem_tipo, origem_id, fatura_id, lote_item_id, valor')
      .eq('remessa_id', remessaRelacionada.id);

    if (itensErr || !itensRemessa || itensRemessa.length === 0) return [];

    const rhItemIds = itensRemessa.filter(i => i.origem_tipo === 'CLT').map(i => i.origem_id);
    const intermitenteItemIds = itensRemessa.filter(i => i.origem_tipo === 'INTERMITENTE').map(i => i.origem_id);
    const faturaIds = itensRemessa.filter(i => i.origem_tipo === 'FATURA').map(i => i.origem_id);
    const diaristaItemIds = itensRemessa.filter(i => i.origem_tipo === 'DIARISTA').map(i => i.origem_id);

    let resolvedFaturas: FaturaComColaborador[] = [];

    if (rhItemIds.length > 0) {
      const { data: rhData } = await supabase
        .from('rh_financeiro_lote_itens')
        .select('id, lote_id, colaborador_id, valor_calculado, colaboradores(id, nome, cpf)')
        .in('id', rhItemIds);
        
      if (rhData) {
        const mapped = rhData.map((x: any) => ({
          id: x.id,
          remessa_item_id: itensRemessa.find(i => i.origem_id === x.id)?.id || null,
          lote_id: remessaRelacionada?.lote_id || null,
          diaristas_lote_id: null,
          intermitentes_lote_id: null,
          colaborador_id: x.colaborador_id,
          valor: Number(x.valor_calculado),
          colaboradores: x.colaboradores,
          origem_tipo: 'CLT' as const,
        }));
        resolvedFaturas = resolvedFaturas.concat(mapped as any);
      }
    }

    // Suporte Canônico a Intermitentes (resolvendo via lancamentos_intermitentes)
    if (intermitenteItemIds.length > 0) {
      const { data: intermitentesData } = await supabase
        .from('lancamentos_intermitentes')
        .select('id, lote_fechamento_id, colaborador_id, total, nome_colaborador, cpf_colaborador')
        .in('id', intermitenteItemIds);

      if (intermitentesData && intermitentesData.length > 0) {
        const colabIds = [...new Set(intermitentesData.map((d: any) => d.colaborador_id).filter(Boolean))];
        const { data: colabs } = await supabase
          .from('colaboradores')
          .select('id, nome, cpf')
          .in('id', colabIds.length > 0 ? colabIds : ['00000000-0000-0000-0000-000000000000']);
        const colabMap = new Map((colabs || []).map((c: any) => [c.id, c]));

        // Calcular a soma consolidada por intermitente dentro do lote
        const somaPorColab = new Map<string, number>();
        intermitentesData.forEach((d: any) => {
          const colabId = d.colaborador_id || d.id;
          somaPorColab.set(colabId, (somaPorColab.get(colabId) || 0) + Number(d.total || 0));
        });

        const mapped = intermitentesData.map((x: any) => {
          const colab = colabMap.get(x.colaborador_id);
          const cleanLote = (x.lote_fechamento_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          const cleanColab = (x.colaborador_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          const seuNumeroEsperado = (cleanLote && cleanColab) ? `INT${cleanLote}${cleanColab}` : null;
          const valorConsolidado = somaPorColab.get(x.colaborador_id || x.id) || Number(x.total);

          return {
            id: x.id,
            remessa_item_id: itensRemessa.find(i => i.origem_id === x.id)?.id || null,
            lote_id: null,
            diaristas_lote_id: null,
            intermitentes_lote_id: x.lote_fechamento_id || remessaRelacionada?.intermitentes_lote_id || null,
            colaborador_id: x.colaborador_id,
            valor: Number(x.total),
            valor_consolidado: valorConsolidado,
            seu_numero_esperado: seuNumeroEsperado,
            colaboradores: {
              id: x.colaborador_id,
              nome: x.nome_colaborador || colab?.nome || null,
              cpf: x.cpf_colaborador || colab?.cpf || null,
            },
            origem_tipo: 'INTERMITENTE' as const,
          };
        });
        resolvedFaturas = resolvedFaturas.concat(mapped as any);
      }
    }

    if (faturaIds.length > 0) {
      const { data: faturasData } = await supabase
        .from('faturas')
        .select('id, lote_remessa_id, colaborador_id, valor, nosso_numero, competencia, empresa_id, colaboradores(id, nome, cpf)')
        .in('id', faturaIds);
        
      if (faturasData) {
        resolvedFaturas = resolvedFaturas.concat(
          faturasData.map((f: any) => ({
            ...f,
            remessa_item_id: itensRemessa.find(i => i.origem_id === f.id)?.id || null,
            lote_id: f.lote_remessa_id || remessaRelacionada?.lote_id || null,
            diaristas_lote_id: null,
            intermitentes_lote_id: null,
            valor: Number(f.valor),
            origem_tipo: 'FATURA' as const,
          })) as any
        );
      }
    }

    // Suporte Canônico a Diaristas
    if (diaristaItemIds.length > 0) {
      const { data: diaristasData } = await supabase
        .from('lancamentos_diaristas')
        .select('id, lote_fechamento_id, diarista_id, valor_calculado, nome_colaborador, cpf_colaborador')
        .in('id', diaristaItemIds);

      if (diaristasData && diaristasData.length > 0) {
        const colabIds = [...new Set(diaristasData.map((d: any) => d.diarista_id).filter(Boolean))];
        const { data: colabs } = await supabase
          .from('colaboradores')
          .select('id, nome, cpf')
          .in('id', colabIds.length > 0 ? colabIds : ['00000000-0000-0000-0000-000000000000']);
        const colabMap = new Map((colabs || []).map((c: any) => [c.id, c]));

        // Calcular a soma consolidada por diarista dentro do lote
        const somaPorDiarista = new Map<string, number>();
        diaristasData.forEach((d: any) => {
          const colabId = d.diarista_id;
          somaPorDiarista.set(colabId, (somaPorDiarista.get(colabId) || 0) + Number(d.valor_calculado || 0));
        });

        const mapped = diaristasData.map((x: any) => {
          const colab = colabMap.get(x.diarista_id);
          const cleanLote = (x.lote_fechamento_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          const cleanColab = (x.diarista_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          const seuNumeroEsperado = (cleanLote && cleanColab) ? `DIA${cleanLote}${cleanColab}` : null;
          const valorConsolidado = somaPorDiarista.get(x.diarista_id) || Number(x.valor_calculado);

          return {
            id: x.id,
            remessa_item_id: itensRemessa.find(i => i.origem_id === x.id)?.id || null,
            lote_id: null,
            diaristas_lote_id: x.lote_fechamento_id || remessaRelacionada?.diaristas_lote_id || null,
            intermitentes_lote_id: null,
            colaborador_id: x.diarista_id,
            valor: Number(x.valor_calculado),
            valor_consolidado: valorConsolidado,
            seu_numero_esperado: seuNumeroEsperado,
            colaboradores: {
              id: x.diarista_id,
              nome: x.nome_colaborador || colab?.nome || null,
              cpf: x.cpf_colaborador || colab?.cpf || null,
            },
            origem_tipo: 'DIARISTA' as const,
          };
        });
        resolvedFaturas = resolvedFaturas.concat(mapped as any);
      }
    }

    return resolvedFaturas;
  },

  matchDetalhe(detalhe: CnabRetornoDetalhe, faturas: FaturaComColaborador[]): MatchResult {
    const seuNumero = String(detalhe.seuNumero || detalhe.documentoEmpresa || '').trim().toUpperCase();
    const nossoNumero = String(detalhe.nossoNumero || '').trim().toUpperCase();
    const documento = normalizeDoc(detalhe.documentoFavorecido);
    const detalheCents = toCents(detalhe.valorPago);

    // 1. Identificador Forte (seu_numero determinístico: Diaristas DIA... ou CLT/Fatura PGT...)
    if (seuNumero) {
      // 1A. Identificador Forte (Diarista DIA<Lote8><Colab8> ou Intermitente INT<Lote8><Colab8>)
      const identificadorForteMatches = faturas.filter((f) => f.seu_numero_esperado && f.seu_numero_esperado.toUpperCase() === seuNumero);
      if (identificadorForteMatches.length > 0) {
        // Se temos N itens para esse seu_numero, verificar se a soma exata é igual ao valor retornado
        const sumCents = identificadorForteMatches.reduce((acc, f) => acc + toCents(f.valor), 0);
        if (sumCents === detalheCents) {
          return {
            fatura: identificadorForteMatches[0],
            faturas: identificadorForteMatches,
            isConsolidado: identificadorForteMatches.length > 1,
            criterio: 'seu_numero_forte',
          };
        }

        // Se a soma total não bate com o valor retornado, verificar se o retorno corresponde a um item individual
        const single = identificadorForteMatches.find((f) => toCents(f.valor) === detalheCents);
        if (single) {
          return {
            fatura: single,
            faturas: [single],
            isConsolidado: false,
            criterio: 'seu_numero_forte',
          };
        }

        // Caso o valor divirja do total e dos unitários, retorna o conjunto para classificação divergente
        return {
          fatura: identificadorForteMatches[0],
          faturas: identificadorForteMatches,
          isConsolidado: identificadorForteMatches.length > 1,
          criterio: 'seu_numero_forte',
        };
      }

      // 1B. Prefixo de Fatura PGT...
      const bySeuNumeroPrefixo = faturas.find((fatura) => Boolean(fatura.id) && buildFaturaPrefix(fatura.id) === seuNumero);
      if (bySeuNumeroPrefixo) {
        return {
          fatura: bySeuNumeroPrefixo,
          faturas: [bySeuNumeroPrefixo],
          isConsolidado: false,
          criterio: 'seu_numero_prefixo',
        };
      }
    }

    // 2. Nosso Número (atribuído pelo banco na remessa ou boleto)
    if (nossoNumero) {
      const byNossoNumero = faturas.find((f) => String(f.nosso_numero || '').trim().toUpperCase() === nossoNumero);
      if (byNossoNumero) {
        return {
          fatura: byNossoNumero,
          faturas: [byNossoNumero],
          isConsolidado: false,
          criterio: 'nosso_numero',
        };
      }
    }

    // 3. Fallback Documento (CPF/CNPJ) + Valor
    if (documento) {
      const docMatches = faturas.filter((f) => normalizeDoc(f.colaboradores?.cpf) === documento);
      if (docMatches.length > 0) {
        // Verificar se todos os itens desse colaborador somam exatamente detalheCents
        const sumCents = docMatches.reduce((acc, f) => acc + toCents(f.valor), 0);
        if (sumCents === detalheCents) {
          return {
            fatura: docMatches[0],
            faturas: docMatches,
            isConsolidado: docMatches.length > 1,
            criterio: 'documento_valor',
          };
        }

        // Se não bate a soma, verificar se bate com algum item individual
        const single = docMatches.find((f) => toCents(f.valor) === detalheCents);
        if (single) {
          return {
            fatura: single,
            faturas: [single],
            isConsolidado: false,
            criterio: 'documento_valor',
          };
        }
      }
    }

    // 4. Fallback Apenas Documento (CPF/CNPJ)
    if (documento) {
      const docMatches = faturas.filter((f) => normalizeDoc(f.colaboradores?.cpf) === documento);
      if (docMatches.length > 0) {
        return {
          fatura: docMatches[0],
          faturas: docMatches,
          isConsolidado: docMatches.length > 1,
          criterio: 'documento',
        };
      }
    }

    // 5. Fallback Apenas Valor
    // 5A. Verificar se existe algum grupo de itens do mesmo colaborador cuja soma é exatamente detalheCents
    const colabGroups = new Map<string, FaturaComColaborador[]>();
    for (const f of faturas) {
      const key = `${f.origem_tipo || 'FATURA'}_${f.colaborador_id || f.id}_${f.lote_id || f.diaristas_lote_id || f.intermitentes_lote_id || ''}`;
      const list = colabGroups.get(key) || [];
      list.push(f);
      colabGroups.set(key, list);
    }
    for (const [, group] of colabGroups) {
      const sumCents = group.reduce((acc, f) => acc + toCents(f.valor), 0);
      if (sumCents === detalheCents) {
        return {
          fatura: group[0],
          faturas: group,
          isConsolidado: group.length > 1,
          criterio: 'valor',
        };
      }
    }

    // 5B. Item individual com valor exato
    const singleValor = faturas.find((f) => toCents(f.valor) === detalheCents);
    if (singleValor) {
      return {
        fatura: singleValor,
        faturas: [singleValor],
        isConsolidado: false,
        criterio: 'valor',
      };
    }

    return {
      fatura: null,
      faturas: [],
      isConsolidado: false,
      criterio: 'nao_encontrado',
    };
  },
};
