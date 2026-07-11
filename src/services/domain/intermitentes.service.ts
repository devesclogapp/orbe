import { supabase } from '@/lib/supabase';
import { BaseService, getCurrentTenantId } from './base.service';
import {
  gerarCNAB240BB,
  downloadCNAB240,
  validarBeneficiarios,
  type EmpresaRemessa,
  type BeneficiarioPagamento,
} from '../cnab/cnab240-posicional';
import { CnabRemessaArquivoService } from '../cnab/cnabRemessaArquivo.service';

export type StatusLoteIntermitente =
  | 'AGUARDANDO_VALIDACAO_RH'
  | 'VALIDADO_RH'
  | 'DEVOLVIDO'
  | 'CANCELADO'
  | 'FECHADO_FINANCEIRO'
  | 'CNAB_GERADO'
  | 'PAGO';

export interface IntermitenteLoteFechamento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_registros: number;
  valor_total: number;
  status: StatusLoteIntermitente;
  observacoes?: string | null;
  created_by?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { nome: string } | null;
}

class IntermitentesLoteServiceClass extends BaseService<'intermitentes_lotes_fechamento'> {
  constructor() {
    super('intermitentes_lotes_fechamento');
  }

  async fecharPeriodo(params: {
    empresaId: string | null;
    periodoInicio: string;
    periodoFim: string;
    fechadoPor: string;
    observacoes?: string;
  }) {
    const tenantId = await getCurrentTenantId();

    // Buscar lançamentos abertos
    let query = supabase
      .from('lancamentos_intermitentes')
      .select('id, total')
      .eq('status_pipeline', 'RECEBIDO')
      .is('lote_fechamento_id', null)
      .gte('data_referencia', params.periodoInicio)
      .lte('data_referencia', params.periodoFim);

    if (params.empresaId) {
       query = query.eq('empresa_id', params.empresaId);
    }

    const { data: lancamentos, error: queryError } = await query;
    if (queryError) throw queryError;

    if (!lancamentos || lancamentos.length === 0) {
      throw new Error('Nenhum lançamento pendente encontrado para o período/filtro informado.');
    }

    const quantidade_registros = lancamentos.length;
    const valor_total = lancamentos.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const competencia = params.periodoInicio.substring(0, 7); // yyyy-MM

    // Criar o Lote
    const { data: lote, error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .insert({
        tenant_id: tenantId,
        empresa_id: params.empresaId ?? null,
        competencia,
        periodo_inicio: params.periodoInicio,
        periodo_fim: params.periodoFim,
        quantidade_registros,
        valor_total,
        status: 'AGUARDANDO_VALIDACAO_RH',
        observacoes: params.observacoes,
        created_by: params.fechadoPor,
      })
      .select()
      .single();

    if (loteError) throw loteError;

    const lancamentoIds = lancamentos.map(l => l.id);

    // TODO: Num cenário de altíssima volumetria seria ideal uma RPC transaction (como nos diaristas). 
    // Como estamos na Fase 1, o update massivo usando IN serve perfeitamente.
    const { error: updateError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({
        lote_fechamento_id: lote.id,
        status_pipeline: 'EM_ANALISE_RH'
      })
      .in('id', lancamentoIds);

    if (updateError) throw updateError;

    return lote as IntermitenteLoteFechamento;
  }

  async listarLotes(filtros?: { status?: string, competencia?: string }) {
    let query = this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .order('created_at', { ascending: false });

    if (filtros?.status) query = query.eq('status', filtros.status);
    if (filtros?.competencia) query = query.eq('competencia', filtros.competencia);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getLoteDetalhe(loteId: string) {
    const { data: lote, error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('id', loteId)
      .single();

    if (loteError) throw loteError;

    const { data: itens, error: itensError } = await this.supabase
      .from('lancamentos_intermitentes')
      .select('*')
      .eq('lote_fechamento_id', loteId)
      .order('nome_colaborador', { ascending: true });

    if (itensError) throw itensError;

    return { ...lote, itens: itens ?? [] };
  }

  async getResumoLoteIntermitente(loteId: string) {
    const data = await this.getLoteDetalhe(loteId);
    if (!data) return null;

    // Calcular montantes exatos dos itens agrupados para validar auditorialmente 
    // se os inserts correspondem perfeitamente à âncora do Lote pai.
    const uniqueColabs = new Set(data.itens.map(i => i.colaborador_id || i.nome_colaborador));
    const realTotalHoras = data.itens.reduce((acc, curr) => acc + Number(curr.horas_trabalhadas || 0), 0);
    const realTotalValor = data.itens.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
    const itensOrfaosOuVazados = data.itens.filter(i => i.status_pipeline !== 'EM_ANALISE_RH' && i.status_pipeline !== 'RECEBIDO').length;

    return {
      loteId: data.id,
      status: data.status,
      tenantId: data.tenant_id,
      periodoInicio: data.periodo_inicio,
      periodoFim: data.periodo_fim,
      quantidadeRegistros: data.itens.length, // Lançamentos que desceram com o Lote de fechamento
      quantidadeColaboradores: uniqueColabs.size,
      totalHoras: Number(realTotalHoras.toFixed(2)),
      valorTotal: Number(realTotalValor.toFixed(2)),
      criadoPor: data.created_by,
      criadoEm: data.created_at,
      lotePayloadMatches: data.itens.length === data.quantidade_registros,
      loteInconsistencies: itensOrfaosOuVazados
    };
  }

  async getByEmpresaParaFinanceiro(empresaId: string) {
    const { data, error } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .eq('empresa_id', empresaId)
      .in('status', ['VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'cnab_gerado'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async aprovarFinanceiro(loteId: string, validadoPor: string) {
    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({
        status: 'FECHADO_FINANCEIRO',
        validated_by: validadoPor,
        validated_at: new Date().toISOString()
      })
      .eq('id', loteId);

    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'ENVIADO_FINANCEIRO' }) // Equivalente local, a instrução disse ENVIADO_FINANCEIRO ou equivalente
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async validarLote(loteId: string, validadoPor: string) {
    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({
        status: 'VALIDADO_RH',
        validated_by: validadoPor,
        validated_at: new Date().toISOString()
      })
      .eq('id', loteId);

    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'APROVADO_RH' }) // Ou APROVADO_RH dependendo do enum
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async devolverLote(loteId: string, observacao: string) {
    if (!observacao) throw new Error('A observação é obrigatória para devolver um lote.');

    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({ status: 'DEVOLVIDO', observacoes: observacao })
      .eq('id', loteId);
    if (loteError) throw loteError;

    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'DEVOLVIDO' })
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;
    return true;
  }

  async reabrirLote(loteId: string) {
    const { error: itemError } = await this.supabase
      .from('lancamentos_intermitentes')
      .update({ status_pipeline: 'RECEBIDO', lote_fechamento_id: null })
      .eq('lote_fechamento_id', loteId);

    if (itemError) throw itemError;

    const { error: loteError } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({ status: 'CANCELADO' })
      .eq('id', loteId);

    if (loteError) throw loteError;
    return true;
  }

  // ─── CNAB240 ─────────────────────────────────────────────────────────────
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

    // 1. Buscar lote
    const { data: lote, error: loteErr } = await this.supabase
      .from('intermitentes_lotes_fechamento')
      .select('*')
      .eq('id', loteId)
      .single();
    if (loteErr || !lote) throw new Error('Lote não encontrado.');
    if (!['FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO'].includes(String(lote.status || ''))) {
      throw new Error('Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro antes da remessa.');
    }

    // 2. Buscar lançamentos
    const { data: lancamentos } = await this.supabase
      .from('lancamentos_intermitentes')
      .select('*')
      .eq('lote_fechamento_id', loteId);

    if (!lancamentos || lancamentos.length === 0)
      throw new Error('Nenhum lançamento encontrado para este lote.');

    // 3. Agregar valores por colaborador (intermitente)
    const colaboradoresMapInfo = new Map<string, {
      colaborador_id: string;
      nome: string;
      cpf: string;
      valor: number;
    }>();

    for (const l of lancamentos) {
      const key = l.colaborador_id || l.nome_colaborador;
      if (!colaboradoresMapInfo.has(key)) {
        colaboradoresMapInfo.set(key, {
          colaborador_id: l.colaborador_id ?? '',
          nome: l.nome_colaborador ?? '',
          cpf: l.cpf_colaborador ?? '',
          valor: 0,
        });
      }
      colaboradoresMapInfo.get(key)!.valor += Number(l.total || 0);
    }

    // 4. Buscar dados bancários dos colaboradores
    const colaboradoresIds = Array.from(colaboradoresMapInfo.values())
      .map(d => d.colaborador_id)
      .filter(Boolean);

    const { data: colaboradoresData } = await this.supabase
      .from('colaboradores')
      .select('id, nome, nome_completo, cpf, banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta')
      .in('id', colaboradoresIds.length > 0 ? colaboradoresIds : ['00000000-0000-0000-0000-000000000000']);

    const bancoColaboradoresMap = new Map<string, any>();
    for (const c of (colaboradoresData ?? [])) {
      bancoColaboradoresMap.set(c.id, c);
    }

    // 5. Validar e montar lista de beneficiários
    const pendencias: string[] = [];
    const beneficiarios: BeneficiarioPagamento[] = [];
    const now = new Date();

    for (const [, d] of colaboradoresMapInfo) {
      const col = bancoColaboradoresMap.get(d.colaborador_id);
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

    if (pendencias.length > 0) {
      throw new Error(
        `Dados bancários incompletos para ${pendencias.length} intermitente(s):\n\n` +
        pendencias.map(p => `• ${p}`).join('\n') +
        '\n\nAtualize o cadastro de cada intermitente antes de gerar o CNAB.'
      );
    }

    // 6. Montar empresa remetente e buscar dados de conta
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

    // 7. Gerar arquivo posicional
    const resultado = gerarCNAB240BB(empresaRemessa, beneficiarios, {
      tipo_servico: 20,
      numero_arquivo: sequencialArquivo,
    });

    // 8. Gravar remoto enviando intermitentesLoteId e download
    await CnabRemessaArquivoService.registrar({
      loteId: null,
      diaristasLoteId: null,
      intermitentesLoteId: loteId,
      nomeArquivo: resultado.nome_arquivo,
      conteudoArquivo: resultado.conteudo,
      totalRegistros: resultado.total_linhas,
      totalValor: resultado.valor_total,
      bancoCodigo: empresaRemetente.banco_codigo || '001',
      bancoNome: empresaRemetente.nome_empresa_banco || contaBancariaSelecionada?.banco_nome || 'BANCO DO BRASIL',
      contaBancariaId: contaBancariaSelecionada?.id,
      competencia: lote.competencia,
      modo: 'producao',
      sequencialArquivo,
    });
    
    downloadCNAB240(resultado);

    // 9. Atualizar status do lote (cnab_gerado)
    await this.supabase
      .from('intermitentes_lotes_fechamento')
      .update({
        status: 'CNAB_GERADO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', loteId);

    // O status de `lancamentos_intermitentes` mantém como ENVIADO_FINANCEIRO ou 
    // afins conforme a constraint, a instrução disse para não violar e manter ENVIADO_FINANCEIRO.
    
    return {
      nomeArquivo:    resultado.nome_arquivo,
      totalRegistros: resultado.total_beneficiarios,
      valorTotal:     resultado.valor_total,
    };
  }
}

export const IntermitentesLoteService = new IntermitentesLoteServiceClass();
