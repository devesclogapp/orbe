import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '../domain/base.service';

export interface EncerramentoHomologacaoParams {
  empresaId: string;
  justificativa: string;
  competencia?: string;
}

export interface EncerramentoHomologacaoResultado {
  success: boolean;
  empresaId: string;
  empresaNome?: string;
  usuarioId: string;
  dataEncerramento: string;
  justificativa: string;
  competencia?: string | null;
  totaisEncerrados: {
    operacoesProducao: number;
    servicosExtras: number;
    custosExtras: number;
    lancamentosDiaristas: number;
    lotesDiaristas: number;
    lotesIntermitentes: number;
    lotesRh: number;
    receitasOperacionais: number;
    faturas: number;
    consolidadosCliente: number;
    consolidadosColaborador: number;
  };
}

export class HomologacaoEncerramentoService {
  /**
   * Executa o encerramento lógico seguro de dados de homologação para uma empresa de testes.
   * Não realiza exclusão física (DELETE) de registros.
   * Não afeta empresas reais de produção (is_teste = false).
   * Registra operador, timestamp e justificativa para auditoria.
   */
  static async encerrarHomologacao(params: EncerramentoHomologacaoParams): Promise<EncerramentoHomologacaoResultado> {
    const { empresaId, justificativa, competencia } = params;

    if (!empresaId) {
      throw new Error('Empresa ID é obrigatório para o encerramento.');
    }

    if (!justificativa || justificativa.trim().length < 10) {
      throw new Error('Justificativa obrigatória com no mínimo 10 caracteres para encerramento de homologação.');
    }

    const tenantId = await getCurrentTenantId();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'sistema-homologacao';

    // 1. Validar empresa e integridade do escopo de testes
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('id, nome, is_teste, tenant_id')
      .eq('id', empresaId)
      .maybeSingle();

    if (empErr || !empresa) {
      throw new Error(`Empresa ${empresaId} não encontrada.`);
    }

    if (empresa.tenant_id !== tenantId) {
      throw new Error('Acesso negado: Empresa pertence a outro tenant.');
    }

    if (empresa.is_teste !== true) {
      throw new Error('Bloqueio de Segurança: Apenas empresas de homologação (is_teste = true) podem ser encerradas por esta rotina.');
    }

    // 2. Tenta executar via RPC atômica caso a migration tenha sido aplicada
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_encerrar_homologacao_empresa', {
        p_empresa_id: empresaId,
        p_justificativa: justificativa.trim(),
        p_competencia: competencia || null
      });

      if (!rpcErr && rpcData && (rpcData as any).success) {
        return rpcData as EncerramentoHomologacaoResultado;
      }
    } catch {
      // Fallback para execução atômica via camada de serviços compatível
    }

    // 3. Fallback de Encerramento Lógico Seguro (Respeitando Constraints Existentes)
    const closureNote = ` [ENCERRAMENTO_HOMOLOGACAO: ${justificativa.trim()}]`;
    const nowIso = new Date().toISOString();

    const totais = {
      operacoesProducao: 0,
      servicosExtras: 0,
      custosExtras: 0,
      lancamentosDiaristas: 0,
      lotesDiaristas: 0,
      lotesIntermitentes: 0,
      lotesRh: 0,
      receitasOperacionais: 0,
      faturas: 0,
      consolidadosCliente: 0,
      consolidadosColaborador: 0,
    };

    // 3.1 Operações por volume pendentes -> Soft Delete Seguro e Auditável (Zero Risco de Faturamento / DRE)
    let opQuery = supabase
      .from('operacoes_producao')
      .select('id, observacoes')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', ['RECEBIDO', 'EM_VALIDACAO', 'EM_RESTRICAO', 'AGUARDANDO_FATURAMENTO']);
    if (competencia) {
      opQuery = opQuery.gte('data_operacao', `${competencia}-01`).lte('data_operacao', `${competencia}-31`);
    }
    const { data: ops } = await opQuery;
    if (ops && ops.length > 0) {
      const ids = ops.map(o => o.id);
      await supabase
        .from('operacoes_producao')
        .update({
          deleted_at: nowIso,
          deleted_by: user?.id ?? null,
          motivo_exclusao: `HOMOLOGAÇÃO ENCERRADA: ${justificativa.trim()}`,
          status: 'EM_RESTRICAO',
          status_rh: 'DEVOLVIDO_RH',
          updated_at: nowIso,
        })
        .in('id', ids);
      totais.operacoesProducao = ids.length;
    }

    // 3.2 Serviços Extras pendentes -> DEVOLVIDO (Respeita pipeline_status real)
    let seQuery = supabase
      .from('servicos_extras_operacionais')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('pipeline_status', ['PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'APROVADO_FINANCEIRO']);
    if (competencia) {
      seQuery = seQuery.gte('data', `${competencia}-01`).lte('data', `${competencia}-31`);
    }
    const { data: ses } = await seQuery;
    if (ses && ses.length > 0) {
      const ids = ses.map(s => s.id);
      await supabase
        .from('servicos_extras_operacionais')
        .update({
          pipeline_status: 'DEVOLVIDO',
          status_pagamento: 'CANCELADO',
          justificativa_devolucao: `HOMOLOGAÇÃO ENCERRADA: ${justificativa.trim()}`,
          atualizado_em: nowIso,
        })
        .in('id', ids);
      totais.servicosExtras = ids.length;
    }

    // 3.3 Custos Extras pendentes -> REPROVADO / CANCELADO (Soft Delete)
    let ceQuery = supabase
      .from('custos_extras_operacionais')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('pipeline_status', ['RECEBIDO', 'EM_VALIDACAO', 'APROVADO_OPERACAO']);
    if (competencia) {
      ceQuery = ceQuery.gte('data', `${competencia}-01`).lte('data', `${competencia}-31`);
    }
    const { data: ces } = await ceQuery;
    if (ces && ces.length > 0) {
      const ids = ces.map(c => c.id);
      await supabase
        .from('custos_extras_operacionais')
        .update({
          pipeline_status: 'REPROVADO',
          status_pagamento: 'CANCELADO',
          deleted_at: nowIso,
          observacoes: `HOMOLOGAÇÃO ENCERRADA: ${justificativa.trim()}`,
          atualizado_em: nowIso,
        })
        .in('id', ids);
      totais.custosExtras = ids.length;
    }

    // 3.4 Lançamentos Diaristas pendentes -> CANCELADO
    let diaQuery = supabase
      .from('lancamentos_diaristas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('status', ['PENDENTE', 'EM_ABERTO', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO']);
    if (competencia) {
      diaQuery = diaQuery.gte('data_lancamento', `${competencia}-01`).lte('data_lancamento', `${competencia}-31`);
    }
    const { data: dias } = await diaQuery;
    if (dias && dias.length > 0) {
      const ids = dias.map(d => d.id);
      await supabase
        .from('lancamentos_diaristas')
        .update({ status: 'CANCELADO' })
        .in('id', ids);
      totais.lancamentosDiaristas = ids.length;
    }

    // 3.5 Lotes Diaristas pendentes -> CANCELADO
    let lotesDiaQuery = supabase
      .from('diaristas_lotes_fechamento')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('status', ['ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO', 'ENVIADO_FINANCEIRO']);
    if (competencia) {
      lotesDiaQuery = lotesDiaQuery.eq('mes_referencia', competencia);
    }
    const { data: lotesDia } = await lotesDiaQuery;
    if (lotesDia && lotesDia.length > 0) {
      const ids = lotesDia.map(l => l.id);
      await supabase
        .from('diaristas_lotes_fechamento')
        .update({ status: 'CANCELADO', updated_at: nowIso })
        .in('id', ids);
      totais.lotesDiaristas = ids.length;
    }

    // 3.6 Lotes Intermitentes pendentes -> CANCELADO
    let lotesIntQuery = supabase
      .from('intermitentes_lotes_fechamento')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('status', ['ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO', 'ENVIADO_FINANCEIRO']);
    if (competencia) {
      lotesIntQuery = lotesIntQuery.eq('competencia', competencia);
    }
    const { data: lotesInt } = await lotesIntQuery;
    if (lotesInt && lotesInt.length > 0) {
      const ids = lotesInt.map(l => l.id);
      await supabase
        .from('intermitentes_lotes_fechamento')
        .update({ status: 'CANCELADO', updated_at: nowIso })
        .in('id', ids);
      totais.lotesIntermitentes = ids.length;
    }

    // 3.7 Lotes RH pendentes -> CANCELADO
    const { data: lotesRh } = await supabase
      .from('rh_financeiro_lotes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('status', ['AGUARDANDO_FINANCEIRO', 'EM_ANALISE_FINANCEIRA', 'AGUARDANDO_PAGAMENTO']);
    if (lotesRh && lotesRh.length > 0) {
      const ids = lotesRh.map(l => l.id);
      await supabase
        .from('rh_financeiro_lotes')
        .update({ status: 'CANCELADO', updated_at: nowIso })
        .in('id', ids);
      totais.lotesRh = ids.length;
    }

    // 3.8 Receitas Operacionais pendentes -> cancelado
    let recQuery = supabase
      .from('receitas_operacionais')
      .select('id, observacao')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .in('status', ['aguardando_fechamento', 'pendente_cobranca', 'cobranca_gerada', 'cobranca_enviada', 'pendente_recebimento']);
    if (competencia) {
      recQuery = recQuery.eq('competencia', competencia);
    }
    const { data: recs } = await recQuery;
    if (recs && recs.length > 0) {
      const ids = recs.map(r => r.id);
      await supabase
        .from('receitas_operacionais')
        .update({
          status: 'cancelado',
          observacao: closureNote,
          updated_at: nowIso,
        })
        .in('id', ids);
      totais.receitasOperacionais = ids.length;
    }

    // 3.9 Faturas pendentes -> cancelada
    let fatQuery = supabase
      .from('faturas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pendente');
    if (competencia) {
      fatQuery = fatQuery.eq('competencia', competencia);
    }
    const { data: fats } = await fatQuery;
    if (fats && fats.length > 0) {
      const ids = fats.map(f => f.id);
      await supabase
        .from('faturas')
        .update({
          status: 'cancelada',
          motivo_rejeicao: `HOMOLOGAÇÃO ENCERRADA: ${justificativa.trim()}`
        })
        .in('id', ids);
      totais.faturas = ids.length;
    }

    // 3.10 Consolidados Cliente pendentes -> cancelado
    let cCliQuery = supabase
      .from('financeiro_consolidados_cliente')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pendente');
    if (competencia) {
      cCliQuery = cCliQuery.eq('competencia', `${competencia}-01`);
    }
    const { data: cClis } = await cCliQuery;
    if (cClis && cClis.length > 0) {
      const ids = cClis.map(c => c.id);
      await supabase
        .from('financeiro_consolidados_cliente')
        .update({ status: 'cancelado' })
        .in('id', ids);
      totais.consolidadosCliente = ids.length;
    }

    // 3.11 Consolidados Colaborador pendentes -> cancelado
    let cColQuery = supabase
      .from('financeiro_consolidados_colaborador')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pendente');
    if (competencia) {
      cColQuery = cColQuery.eq('competencia', `${competencia}-01`);
    }
    const { data: cCols } = await cColQuery;
    if (cCols && cCols.length > 0) {
      const ids = cCols.map(c => c.id);
      await supabase
        .from('financeiro_consolidados_colaborador')
        .update({ status: 'cancelado' })
        .in('id', ids);
      totais.consolidadosColaborador = ids.length;
    }

    // 4. Registro de Auditoria
    try {
      await supabase.from('cnab_auditoria_bancaria').insert({
        tenant_id: tenantId,
        acao: 'homologacao',
        usuario_id: userId,
        usuario_nome: 'Sistema / Operador',
        detalhes: {
          tipo: 'ENCERRAMENTO_LOGICO_HOMOLOGACAO',
          empresa_id: empresaId,
          empresa_nome: empresa.nome,
          justificativa: justificativa.trim(),
          competencia: competencia || null,
          totais,
          timestamp: nowIso
        }
      });
    } catch {
      // Auditoria nunca bloqueia
    }

    return {
      success: true,
      empresaId,
      empresaNome: empresa.nome,
      usuarioId: userId,
      dataEncerramento: nowIso,
      justificativa: justificativa.trim(),
      competencia: competencia || null,
      totaisEncerrados: totais,
    };
  }
}
