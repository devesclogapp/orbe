import { supabase } from '@/lib/supabase';

export type TipoDecisaoOcorrencia =
  | 'ARQUIVADA_SEM_PENALIDADE'
  | 'ADVERTENCIA_FORMAL'
  | 'PROPOSTA_RESSARCIMENTO';

export type StatusDecisaoOcorrencia =
  | 'PENDENTE'
  | 'AUTORIZADO'
  | 'APLICADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'REVISADO';

export interface OcorrenciaDecisaoRecord {
  id: string;
  tenant_id: string;
  empresa_id: string;
  operacao_id: string;
  collaborator_id: string;
  infracao_id?: string | null;
  infracao_codigo: string;
  valor_provisorio_snapshot: number;
  tipo_decisao: TipoDecisaoOcorrencia;
  status: StatusDecisaoOcorrencia;
  valor_autorizado: number;
  competencia_sugerida?: string | null;
  fundamento_legal: string;
  evidencias_anexas?: Array<{ nome?: string; url?: string; tipo?: string }>;
  decidido_por: string;
  decidido_por_nome: string;
  revisado_de_id?: string | null;
  motivo_cancelamento?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrarDecisaoParams {
  tenant_id?: string;
  empresa_id: string;
  operacao_id: string;
  collaborator_id: string;
  infracao_codigo?: string;
  valor_provisorio_snapshot?: number;
  tipo_decisao: TipoDecisaoOcorrencia;
  valor_autorizado?: number;
  competencia_sugerida?: string | null;
  fundamento_legal: string;
  evidencias_anexas?: Array<{ nome?: string; url?: string; tipo?: string }>;
  decidido_por: string;
  decidido_por_nome: string;
}

export interface RevisarDecisaoParams {
  decisaoId: string;
  motivo_cancelamento: string;
  novaDecisao?: Omit<RegistrarDecisaoParams, 'empresa_id' | 'operacao_id' | 'collaborator_id'>;
}

export interface CalculoLiquidosColaborador {
  valorBase: number;
  descontoProvisorio: number;
  descontoAutorizado: number;
  liquidoProjetado: number;
  liquidoAutorizado: number;
  statusDeliberacao: StatusDecisaoOcorrencia | 'SEM_OCORRENCIA';
}

export class OcorrenciasDecisaoService {
  /**
   * Calcula isoladamente o Líquido Projetado e o Líquido Autorizado para um colaborador.
   * Regra estrita:
   * A. Líquido projetado = base - desconto provisório pendente
   * B. Líquido autorizado = base - desconto formalmente aprovado (nunca gera saldo negativo)
   */
  static calcularLiquidos(
    valorBase: number,
    decisaoAtiva?: OcorrenciaDecisaoRecord | null,
    valorProvisorioSnapshot?: number
  ): CalculoLiquidosColaborador {
    const base = Math.max(0, Number(valorBase || 0));
    const provisorio = Math.max(0, Number(valorProvisorioSnapshot || 0));

    let autorizado = 0;
    let status: StatusDecisaoOcorrencia | 'SEM_OCORRENCIA' = 'SEM_OCORRENCIA';

    if (decisaoAtiva) {
      status = decisaoAtiva.status;
      if (decisaoAtiva.status === 'AUTORIZADO' || decisaoAtiva.status === 'APLICADO') {
        autorizado = Math.max(0, Number(decisaoAtiva.valor_autorizado || 0));
      }
    } else if (provisorio > 0) {
      status = 'PENDENTE';
    }

    // O desconto nunca pode exceder o valor base (não permite líquido negativo)
    const liquidoProjetado = Math.max(0, base - provisorio);
    const liquidoAutorizado = Math.max(0, base - autorizado);

    return {
      valorBase: base,
      descontoProvisorio: provisorio,
      descontoAutorizado: autorizado,
      liquidoProjetado,
      liquidoAutorizado,
      statusDeliberacao: status,
    };
  }

  /**
   * Busca todas as decisões registradas para uma determinada operação.
   */
  static async getByOperacaoId(operacaoId: string): Promise<OcorrenciaDecisaoRecord[]> {
    if (!operacaoId) return [];

    try {
      const { data, error } = await supabase
        .from('operacoes_ocorrencias_decisoes')
        .select('*')
        .eq('operacao_id', operacaoId)
        .order('created_at', { ascending: false });

      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('relation') || msg.includes('does not exist')) {
          console.warn('[OcorrenciasDecisaoService] Tabela operacoes_ocorrencias_decisoes não existe no ambiente remoto.');
          return [];
        }
        throw error;
      }

      return (data || []) as OcorrenciaDecisaoRecord[];
    } catch (err) {
      console.error('[OcorrenciasDecisaoService] Erro ao buscar decisões por operação:', err);
      return [];
    }
  }

  /**
   * Busca a decisão ativa de um colaborador específico na operação.
   */
  static async getAtivaPorColaboradorEOperacao(
    operacaoId: string,
    collaboratorId: string
  ): Promise<OcorrenciaDecisaoRecord | null> {
    if (!operacaoId || !collaboratorId) return null;

    try {
      const { data, error } = await supabase
        .from('operacoes_ocorrencias_decisoes')
        .select('*')
        .eq('operacao_id', operacaoId)
        .eq('collaborator_id', collaboratorId)
        .in('status', ['PENDENTE', 'AUTORIZADO'])
        .maybeSingle();

      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('relation') || msg.includes('does not exist')) {
          return null;
        }
        throw error;
      }

      return (data as OcorrenciaDecisaoRecord) || null;
    } catch (err) {
      console.error('[OcorrenciasDecisaoService] Erro ao buscar decisão ativa:', err);
      return null;
    }
  }

  /**
   * Registra uma nova deliberação administrativa de ocorrência.
   * Valida obrigatoriedade de fundamentação legal e integridade dos dados.
   */
  static async registrarDecisao(params: RegistrarDecisaoParams): Promise<OcorrenciaDecisaoRecord> {
    const {
      tenant_id,
      empresa_id,
      operacao_id,
      collaborator_id,
      infracao_codigo = 'OUTRA_OCORRENCIA',
      valor_provisorio_snapshot = 0,
      tipo_decisao,
      valor_autorizado = 0,
      competencia_sugerida = null,
      fundamento_legal,
      evidencias_anexas = [],
      decidido_por,
      decidido_por_nome,
    } = params;

    if (!operacao_id || !collaborator_id || !empresa_id) {
      throw new Error('Identificadores obrigatórios ausentes (operação, colaborador ou empresa).');
    }

    if (!fundamento_legal || fundamento_legal.trim().length < 10) {
      throw new Error('A fundamentação legal/contratual é obrigatória (mínimo de 10 caracteres).');
    }

    let statusFinal: StatusDecisaoOcorrencia = 'AUTORIZADO';

    if (tipo_decisao === 'ARQUIVADA_SEM_PENALIDADE') {
      statusFinal = 'REJEITADO'; // Arquivado sem desconto financeiro
    } else if (tipo_decisao === 'ADVERTENCIA_FORMAL') {
      statusFinal = 'AUTORIZADO'; // Advertência formal registrada (sem valor pecuniário)
    } else if (tipo_decisao === 'PROPOSTA_RESSARCIMENTO') {
      if (valor_autorizado <= 0) {
        throw new Error('Para ressarcimento autorizado, o valor deve ser maior que zero.');
      }
      if (!competencia_sugerida || !/^\d{4}-\d{2}$/.test(competencia_sugerida)) {
        throw new Error('A competência sugerida deve estar no formato AAAA-MM (ex: 2026-11).');
      }
      statusFinal = 'AUTORIZADO';
    }

    // Prevenção de duplicidade: não pode haver mais de uma decisão ativa
    const decisaoExistente = await this.getAtivaPorColaboradorEOperacao(operacao_id, collaborator_id);
    if (decisaoExistente) {
      throw new Error(
        `Já existe uma deliberação ativa (${decisaoExistente.tipo_decisao}) para este colaborador nesta operação. Revise ou cancele a anterior primeiro.`
      );
    }

    const payload = {
      tenant_id: tenant_id || (await this.resolveCurrentTenantId()),
      empresa_id,
      operacao_id,
      collaborator_id,
      infracao_codigo,
      valor_provisorio_snapshot: Number(valor_provisorio_snapshot || 0),
      tipo_decisao,
      status: statusFinal,
      valor_autorizado: tipo_decisao === 'PROPOSTA_RESSARCIMENTO' ? Number(valor_autorizado) : 0,
      competencia_sugerida: tipo_decisao === 'PROPOSTA_RESSARCIMENTO' ? competencia_sugerida : null,
      fundamento_legal: fundamento_legal.trim(),
      evidencias_anexas,
      decidido_por,
      decidido_por_nome,
    };

    const { data, error } = await supabase
      .from('operacoes_ocorrencias_decisoes')
      .insert(payload)
      .select()
      .single();

    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('relation') || msg.includes('does not exist')) {
        throw new Error(
          'Tabela operacoes_ocorrencias_decisoes não encontrada no banco. Aplique a migration antes de persistir.'
        );
      }
      throw error;
    }

    return data as OcorrenciaDecisaoRecord;
  }

  /**
   * Cancela ou revisa uma deliberação anterior, mantendo histórico imutável.
   */
  static async cancelarOuRevisar(params: RevisarDecisaoParams): Promise<{
    anterior: OcorrenciaDecisaoRecord;
    nova?: OcorrenciaDecisaoRecord;
  }> {
    const { decisaoId, motivo_cancelamento, novaDecisao } = params;

    if (!decisaoId) throw new Error('ID da decisão é obrigatório.');
    if (!motivo_cancelamento || motivo_cancelamento.trim().length < 5) {
      throw new Error('O motivo do cancelamento ou revisão é obrigatório (mínimo de 5 caracteres).');
    }

    const novoStatus: StatusDecisaoOcorrencia = novaDecisao ? 'REVISADO' : 'CANCELADO';

    const { data: anterior, error: errUpdate } = await supabase
      .from('operacoes_ocorrencias_decisoes')
      .update({
        status: novoStatus,
        motivo_cancelamento: motivo_cancelamento.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', decisaoId)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    let nova: OcorrenciaDecisaoRecord | undefined;
    if (novaDecisao) {
      let statusNova: StatusDecisaoOcorrencia = 'AUTORIZADO';
      if (novaDecisao.tipo_decisao === 'ARQUIVADA_SEM_PENALIDADE') statusNova = 'REJEITADO';

      const payloadNova = {
        tenant_id: anterior.tenant_id,
        empresa_id: anterior.empresa_id,
        operacao_id: anterior.operacao_id,
        collaborator_id: anterior.collaborator_id,
        infracao_codigo: novaDecisao.infracao_codigo || anterior.infracao_codigo,
        valor_provisorio_snapshot: anterior.valor_provisorio_snapshot,
        tipo_decisao: novaDecisao.tipo_decisao,
        status: statusNova,
        valor_autorizado:
          novaDecisao.tipo_decisao === 'PROPOSTA_RESSARCIMENTO' ? Number(novaDecisao.valor_autorizado || 0) : 0,
        competencia_sugerida:
          novaDecisao.tipo_decisao === 'PROPOSTA_RESSARCIMENTO' ? novaDecisao.competencia_sugerida : null,
        fundamento_legal: novaDecisao.fundamento_legal.trim(),
        evidencias_anexas: novaDecisao.evidencias_anexas || [],
        decidido_por: novaDecisao.decidido_por,
        decidido_por_nome: novaDecisao.decidido_por_nome,
        revisado_de_id: anterior.id,
      };

      const { data: novaData, error: errNova } = await supabase
        .from('operacoes_ocorrencias_decisoes')
        .insert(payloadNova)
        .select()
        .single();

      if (errNova) throw errNova;
      nova = novaData as OcorrenciaDecisaoRecord;
    }

    return { anterior: anterior as OcorrenciaDecisaoRecord, nova };
  }

  private static async resolveCurrentTenantId(): Promise<string> {
    try {
      const { data } = await supabase.rpc('current_tenant_id');
      if (data) return data;
    } catch {
      // Ignora erro se RPC não existir
    }
    return '00000000-0000-0000-0000-000000000000';
  }
}
