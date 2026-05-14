import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';
import { CicloOperacionalService } from './operationalEngine/CicloOperacionalService';

const ALERT_WINDOW_DAYS = 30;
const NEAR_DUE_WINDOW_DAYS = 7;
const CRITICAL_DEBIT_THRESHOLD = -90;
const EXCESS_BANK_THRESHOLD = 2400;
const OLD_BALANCE_WINDOW_DAYS = 60;
const EXTRATO_EVENT_ORIGIN = 'extrato_colaborador';

type ExtratoActionType = 'ajuste_manual' | 'compensacao' | 'pagamento' | 'folga';

interface ExtratoActionInput {
  eventoId: string;
  tipo: ExtratoActionType;
  observacao: string;
  minutos?: number;
  dataFolga?: string | null;
}

class BHRegraServiceClass extends BaseService<'banco_horas_regras'> {
  constructor() { super('banco_horas_regras'); }

  async getWithEmpresa() {
    const { data: regras, error } = await supabase
      .from('banco_horas_regras')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    return (regras || []).map(r => ({ ...r, empresas: empresaMap.get(r.empresa_id) || null }));
  }
}
export const BHRegraService = new BHRegraServiceClass();

class BHEventoServiceClass extends BaseService<'banco_horas_eventos'> {
  constructor() { super('banco_horas_eventos'); }

  private getEventMinutes(evento: any) {
    return Number(evento?.minutos ?? evento?.quantidade_minutos ?? 0);
  }

  private getEventDate(evento: any) {
    return String(evento?.data_evento ?? evento?.data ?? evento?.created_at ?? '');
  }

  private getLegacyTipoValue(tipo: ExtratoActionType, deltaMinutos: number) {
    if (tipo === 'pagamento' || tipo === 'compensacao' || tipo === 'folga') {
      return 'atraso';
    }

    return deltaMinutos >= 0 ? 'hora_extra' : 'atraso';
  }

  private getCycleKey(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const quarter = Math.floor((month - 1) / 3) + 1;
    const safeDay = Number.isFinite(day) ? day : 1;
    return {
      competencia: `${year}-${String(month).padStart(2, '0')}`,
      cicloTrimestral: `${year}-T${quarter}`,
      safeDate: `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`,
    };
  }

  private async getExecutionContext() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('Sessão inválida. Faça login novamente para continuar.');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (error || !profile?.tenant_id) {
      throw new Error('Usuário sem tenant associado. Contate o administrador.');
    }

    return {
      userId: user.id,
      tenantId: profile.tenant_id as string,
      userName: String(profile.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Usuário interno'),
    };
  }

  private async assertPeriodoAberto(tenantId: string, dataEvento: string, label: string) {
    const { competencia, safeDate } = this.getCycleKey(dataEvento);
    const ciclos = await CicloOperacionalService.getCiclosDaCompetencia(tenantId, competencia);
    const semana = CicloOperacionalService.getSemanaOperacionalDaData(safeDate);
    const ciclo = ciclos.find((item) => item.semana_operacional === semana);

    if (ciclo && (ciclo.status === 'fechado' || ciclo.status === 'enviado_financeiro')) {
      throw new Error(`Não é permitido registrar ${label} em período fechado.`);
    }
  }

  private async getSaldoAtual(tenantId: string, colaboradorId: string) {
    const { data, error } = await supabase
      .from('banco_horas_saldos')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('colaborador_id', colaboradorId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  private async aplicarSaldoIncremental(params: {
    tenantId: string;
    colaboradorId: string;
    empresaId: string | null;
    deltaMinutos: number;
    dataEvento: string;
    saldoAtual: any;
  }) {
    const saldoAnterior = Number(params.saldoAtual?.saldo_atual_minutos ?? 0);
    const saldoResultante = saldoAnterior + params.deltaMinutos;
    const horasPositivas = Number(params.saldoAtual?.horas_positivas_minutos ?? 0) + Math.max(params.deltaMinutos, 0);
    const horasNegativas = Number(params.saldoAtual?.horas_negativas_minutos ?? 0) + Math.max(-params.deltaMinutos, 0);
    const ultimaMovimentacaoAtual = params.saldoAtual?.ultima_movimentacao
      ? new Date(params.saldoAtual.ultima_movimentacao).getTime()
      : 0;
    const novaMovimentacao = new Date(`${params.dataEvento}T00:00:00`).getTime();
    const ultimaMovimentacaoIso = new Date(Math.max(ultimaMovimentacaoAtual, novaMovimentacao)).toISOString();

    const { error } = await supabase
      .from('banco_horas_saldos')
      .upsert(
        {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          empresa_id: params.empresaId,
          saldo_atual_minutos: saldoResultante,
          horas_positivas_minutos: horasPositivas,
          horas_negativas_minutos: horasNegativas,
          ultima_movimentacao: ultimaMovimentacaoIso,
          ultima_atualizacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,colaborador_id' },
      );

    if (error) throw error;
    return { saldoAnterior, saldoResultante };
  }

  async registrarAcaoExtrato(input: ExtratoActionInput) {
    const observacao = String(input.observacao ?? '').trim();
    if (!observacao) {
      throw new Error('A observação é obrigatória para registrar a ação.');
    }

    const { data: eventoOrigem, error: eventoError } = await supabase
      .from('banco_horas_eventos')
      .select('*')
      .eq('id', input.eventoId)
      .single();

    if (eventoError || !eventoOrigem) {
      throw new Error('Evento de origem não encontrado.');
    }

    const contexto = await this.getExecutionContext();
    const minutosOrigem = this.getEventMinutes(eventoOrigem);
    const statusOrigem = String(eventoOrigem.status ?? 'ativo').trim().toLowerCase();
    const dataOrigem = this.getEventDate(eventoOrigem).slice(0, 10);

    if (!dataOrigem) {
      throw new Error('O evento selecionado não possui data válida para operação.');
    }

    if (['cancelado', 'compensado', 'pago'].includes(statusOrigem)) {
      throw new Error('Este evento não está mais disponível para ação operacional.');
    }

    await this.assertPeriodoAberto(contexto.tenantId, dataOrigem, 'ação operacional');

    let deltaMinutos = 0;
    let dataEvento = new Date().toISOString().slice(0, 10);
    let statusNovoEvento: string = 'ativo';
    let statusEventoOrigem: string | null = null;
    let descricao = '';
    const metadata: Record<string, unknown> = {
      origem_evento_id: eventoOrigem.id,
      origem_tipo_evento: eventoOrigem.tipo_evento ?? eventoOrigem.tipo ?? null,
      origem_data_evento: dataOrigem,
      origem_minutos: minutosOrigem,
    };

    if (input.tipo === 'ajuste_manual') {
      const minutosInformados = Number(input.minutos ?? 0);
      if (!Number.isInteger(minutosInformados) || minutosInformados === 0) {
        throw new Error('Informe um ajuste em minutos, positivo ou negativo, diferente de zero.');
      }

      deltaMinutos = minutosInformados;
      statusNovoEvento = 'ajustado';
      descricao = `Ajuste manual vinculado ao evento de ${dataOrigem}`;
      metadata.ajuste_minutos = minutosInformados;
    } else {
      if (minutosOrigem <= 0) {
        throw new Error('Somente eventos com saldo positivo podem ser compensados, pagos ou lançados como folga.');
      }

      const saldoAtual = await this.getSaldoAtual(contexto.tenantId, eventoOrigem.colaborador_id);
      const saldoDisponivel = Number(saldoAtual?.saldo_atual_minutos ?? 0);
      if (saldoDisponivel < minutosOrigem) {
        throw new Error('O saldo atual disponível é insuficiente para executar esta ação sem recálculo histórico.');
      }

      deltaMinutos = -Math.abs(minutosOrigem);

      if (input.tipo === 'compensacao') {
        statusNovoEvento = 'compensado';
        statusEventoOrigem = 'compensado';
        descricao = `Compensação manual do evento de ${dataOrigem}`;
      }

      if (input.tipo === 'pagamento') {
        statusNovoEvento = 'pago';
        statusEventoOrigem = 'pago';
        descricao = `Pagamento do banco de horas referente ao evento de ${dataOrigem}`;
        metadata.financeiro = {
          status: 'pendente_preparacao',
          modulo_destino: 'financeiro',
        };
      }

      if (input.tipo === 'folga') {
        const dataFolga = String(input.dataFolga ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFolga)) {
          throw new Error('Informe uma data válida para a folga.');
        }

        dataEvento = dataFolga;
        statusNovoEvento = 'compensado';
        statusEventoOrigem = 'compensado';
        descricao = `Folga lançada com abatimento do banco referente ao evento de ${dataOrigem}`;
        metadata.data_folga = dataFolga;
      }
    }

    await this.assertPeriodoAberto(contexto.tenantId, dataEvento, input.tipo.replace('_', ' '));

    const saldoAtual = await this.getSaldoAtual(contexto.tenantId, eventoOrigem.colaborador_id);
    const saldoAnterior = Number(saldoAtual?.saldo_atual_minutos ?? 0);
    const saldoResultante = saldoAnterior + deltaMinutos;

    const { cicloTrimestral } = this.getCycleKey(dataEvento);
    const legacyTipo = this.getLegacyTipoValue(input.tipo, deltaMinutos);
    const insertPayload = {
      tenant_id: contexto.tenantId,
      colaborador_id: eventoOrigem.colaborador_id,
      empresa_id: eventoOrigem.empresa_id ?? null,
      registro_ponto_id: null,
      referencia_evento_id: eventoOrigem.id,
      data: dataEvento,
      data_evento: dataEvento,
      tipo: legacyTipo,
      tipo_evento: input.tipo,
      quantidade_minutos: deltaMinutos,
      minutos: deltaMinutos,
      saldo_anterior: saldoAnterior,
      saldo_atual: saldoResultante,
      saldo_resultante: saldoResultante,
      origem: EXTRATO_EVENT_ORIGIN,
      descricao,
      observacao,
      ciclo_trimestral: cicloTrimestral,
      status: statusNovoEvento,
      executado_por: contexto.userId,
      executado_por_nome: contexto.userName,
      data_folga: input.tipo === 'folga' ? dataEvento : null,
      reflexo_financeiro_pendente: input.tipo === 'pagamento',
      contexto_operacao: metadata,
    };

    const { data: novoEvento, error: insertError } = await supabase
      .from('banco_horas_eventos')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) throw insertError;

    await this.aplicarSaldoIncremental({
      tenantId: contexto.tenantId,
      colaboradorId: eventoOrigem.colaborador_id,
      empresaId: eventoOrigem.empresa_id ?? null,
      deltaMinutos,
      dataEvento,
      saldoAtual,
    });

    if (statusEventoOrigem) {
      const { error: updateError } = await supabase
        .from('banco_horas_eventos')
        .update({ status: statusEventoOrigem })
        .eq('id', eventoOrigem.id);

      if (updateError) throw updateError;
    }

    try {
      await AuditoriaService.log('registrar_acao_extrato_banco_horas', 'banco_horas', 'medio', {
        tipo_acao: input.tipo,
        colaborador_id: eventoOrigem.colaborador_id,
        empresa_id: eventoOrigem.empresa_id ?? null,
        evento_origem_id: eventoOrigem.id,
        evento_resultante_id: novoEvento.id,
        tipo_legado: legacyTipo,
        minutos_aplicados: deltaMinutos,
        saldo_anterior: saldoAnterior,
        saldo_resultante: saldoResultante,
        executado_por: contexto.userId,
        executado_por_nome: contexto.userName,
        data_evento: dataEvento,
        observacao,
      });
    } catch (auditError) {
      console.warn('[BHEventoService] Auditoria central nao registrada para acao do extrato:', auditError);
    }

    return novoEvento;
  }

  async getByColaborador(collabId: string, startDate?: Date, endDate?: Date) {
    let query = supabase
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', collabId);

    if (startDate) {
      query = query.gte('data_evento', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      query = query.lte('data_evento', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query
      .order('data_evento', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getSaldosGerais(options?: { includeWithoutMovement?: boolean }) {
    const includeWithoutMovement = options?.includeWithoutMovement ?? false;

    const [
      { data: saldosData, error: saldosError },
      { data: eventosData, error: eventosError },
    ] = await Promise.all([
      supabase
        .from('banco_horas_saldos')
        .select('colaborador_id, empresa_id, saldo_atual_minutos'),
      supabase
        .from('banco_horas_eventos')
        .select('colaborador_id, empresa_id, quantidade_minutos, minutos, data_vencimento, ciclo_trimestral, tipo_evento, status, data_evento, created_at')
        .or('is_teste.is.null,is_teste.eq.false'),
    ]);

    if (saldosError) throw saldosError;
    if (eventosError) throw eventosError;

    const aggregates = new Map<string, {
      empresa_id: string | null;
      saldo_minutos: number;
      saldo_from_saldos: boolean;
      minutos_vencidos: number;
      minutos_a_vencer_30d: number;
      minutos_a_vencer_7d: number;
      saldo_antigo_minutos: number;
      proximo_vencimento: string | null;
      dias_para_vencer: number | null;
      hasMovement: boolean;
    }>();

    for (const saldo of saldosData || []) {
      if (!saldo.colaborador_id) continue;

      aggregates.set(saldo.colaborador_id, {
        empresa_id: saldo.empresa_id ?? null,
        saldo_minutos: Number(saldo.saldo_atual_minutos ?? 0),
        saldo_from_saldos: true,
        minutos_vencidos: 0,
        minutos_a_vencer_30d: 0,
        minutos_a_vencer_7d: 0,
        saldo_antigo_minutos: 0,
        proximo_vencimento: null,
        dias_para_vencer: null,
        hasMovement: true,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + ALERT_WINDOW_DAYS);

    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + NEAR_DUE_WINDOW_DAYS);

    const oldBalanceLimit = new Date(today);
    oldBalanceLimit.setDate(oldBalanceLimit.getDate() - OLD_BALANCE_WINDOW_DAYS);

    const cycleAggregates = new Map<string, {
      colaborador_id: string;
      empresa_id: string | null;
      saldo_minutos: number;
      data_vencimento: string | null;
      data_referencia: string | null;
    }>();

    for (const evento of eventosData || []) {
      if (!evento.colaborador_id) continue;

      const current = aggregates.get(evento.colaborador_id) || {
        empresa_id: evento.empresa_id ?? null,
        saldo_minutos: 0,
        saldo_from_saldos: false,
        minutos_vencidos: 0,
        minutos_a_vencer_30d: 0,
        minutos_a_vencer_7d: 0,
        saldo_antigo_minutos: 0,
        proximo_vencimento: null,
        dias_para_vencer: null,
        hasMovement: false,
      };

      const quantidadeMinutos = this.getEventMinutes(evento);

      if (!current.saldo_from_saldos) {
        current.saldo_minutos += quantidadeMinutos;
      }

      current.empresa_id = current.empresa_id ?? evento.empresa_id ?? null;
      current.hasMovement = true;

      aggregates.set(evento.colaborador_id, current);

      const cycleKey = `${evento.colaborador_id}:${evento.ciclo_trimestral || this.getEventDate(evento).slice(0, 7)}`;
      const cycle = cycleAggregates.get(cycleKey) || {
        colaborador_id: evento.colaborador_id,
        empresa_id: evento.empresa_id ?? null,
        saldo_minutos: 0,
        data_vencimento: evento.data_vencimento ?? null,
        data_referencia: this.getEventDate(evento).slice(0, 10) || null,
      };
      cycle.saldo_minutos += quantidadeMinutos;
      cycle.empresa_id = cycle.empresa_id ?? evento.empresa_id ?? null;
      cycle.data_vencimento = cycle.data_vencimento ?? evento.data_vencimento ?? null;
      cycle.data_referencia =
        cycle.data_referencia ?? (this.getEventDate(evento).slice(0, 10) || null);
      cycleAggregates.set(cycleKey, cycle);
    }

    for (const cycle of cycleAggregates.values()) {
      if (!cycle.colaborador_id || !cycle.data_vencimento || cycle.saldo_minutos <= 0) continue;

      const current = aggregates.get(cycle.colaborador_id);
      if (!current) continue;

      const vencimento = new Date(cycle.data_vencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);

      if (current.proximo_vencimento === null || vencimento < new Date(`${current.proximo_vencimento}T00:00:00`)) {
        current.proximo_vencimento = cycle.data_vencimento;
        current.dias_para_vencer = diffDays;
      }

      if (vencimento < today) {
        current.minutos_vencidos += cycle.saldo_minutos;
      } else if (vencimento <= in30Days) {
        current.minutos_a_vencer_30d += cycle.saldo_minutos;
        if (vencimento <= in7Days) {
          current.minutos_a_vencer_7d += cycle.saldo_minutos;
        }
      }

      const dataReferencia = cycle.data_referencia ? new Date(`${cycle.data_referencia}T00:00:00`) : null;
      if (dataReferencia && dataReferencia <= oldBalanceLimit) {
        current.saldo_antigo_minutos += cycle.saldo_minutos;
      }
    }

    const collaboratorIds = Array.from(aggregates.keys());

    if (!includeWithoutMovement && collaboratorIds.length === 0) {
      return [];
    }

    const { data: colaboradoresData, error: colaboradoresError } = includeWithoutMovement
      ? await supabase
          .from('colaboradores')
          .select('id, nome, matricula, empresa_id, status_cadastro, cadastro_provisorio, valor_hora, salario_base, valor_diaria, valor_base')
          .order('nome', { ascending: true })
      : await supabase
          .from('colaboradores')
          .select('id, nome, matricula, empresa_id, status_cadastro, cadastro_provisorio, valor_hora, salario_base, valor_diaria, valor_base')
          .in('id', collaboratorIds)
          .order('nome', { ascending: true });

    if (colaboradoresError) throw colaboradoresError;

    const colaboradores = colaboradoresData || [];
    const empresaIds = Array.from(
      new Set(
        colaboradores
          .map((colaborador) => colaborador.empresa_id)
          .concat(Array.from(aggregates.values()).map((entry) => entry.empresa_id))
          .filter(Boolean),
      ),
    ) as string[];

    const { data: empresasData, error: empresasError } = empresaIds.length > 0
      ? await supabase
          .from('empresas')
          .select('id, nome')
          .in('id', empresaIds)
      : { data: [], error: null };

    if (empresasError) throw empresasError;

    const empresaMap = new Map((empresasData || []).map((empresa) => [empresa.id, empresa.nome]));

    return colaboradores
      .map((colaborador) => {
        const aggregate = aggregates.get(colaborador.id) || {
          empresa_id: colaborador.empresa_id ?? null,
          saldo_minutos: 0,
          saldo_from_saldos: false,
          minutos_vencidos: 0,
          minutos_a_vencer_30d: 0,
          minutos_a_vencer_7d: 0,
          saldo_antigo_minutos: 0,
          proximo_vencimento: null,
          dias_para_vencer: null,
          hasMovement: false,
        };

        if (!includeWithoutMovement && !aggregate.hasMovement) {
          return null;
        }

        const valorHoraEstimado = this.getEstimatedHourlyValue(colaborador);
        const estimativaValor = Math.max(aggregate.saldo_minutos, 0) / 60 * valorHoraEstimado;
        const statusData = this.getStatus({
          totalMinutes: aggregate.saldo_minutos,
          minutesExpired: aggregate.minutos_vencidos,
          minutesDueSoon: aggregate.minutos_a_vencer_7d,
          oldBalanceMinutes: aggregate.saldo_antigo_minutos,
          hasPendingRh:
            colaborador.status_cadastro === 'pendente_complemento' ||
            Boolean(colaborador.cadastro_provisorio),
        });

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          matricula: colaborador.matricula,
          empresa_id: colaborador.empresa_id,
          empresa: empresaMap.get(colaborador.empresa_id ?? aggregate.empresa_id ?? '') || null,
          saldo_minutos: aggregate.saldo_minutos,
          minutos_vencidos: aggregate.minutos_vencidos,
          minutos_a_vencer_30d: aggregate.minutos_a_vencer_30d,
          minutos_a_vencer_7d: aggregate.minutos_a_vencer_7d,
          saldo_antigo_minutos: aggregate.saldo_antigo_minutos,
          saldo_formatado: this.formatMinutes(aggregate.saldo_minutos),
          vencido_formatado: this.formatMinutes(aggregate.minutos_vencidos),
          a_vencer_formatado: this.formatMinutes(aggregate.minutos_a_vencer_30d),
          a_vencer_7d_formatado: this.formatMinutes(aggregate.minutos_a_vencer_7d),
          saldo_antigo_formatado: this.formatMinutes(aggregate.saldo_antigo_minutos),
          proximo_vencimento: aggregate.proximo_vencimento,
          dias_para_vencer: aggregate.dias_para_vencer,
          status: statusData.status,
          status_label: statusData.label,
          status_priority: statusData.priority,
          precisa_acao_rh: statusData.status === 'aguardando_rh',
          valor_hora_estimado: valorHoraEstimado,
          estimativa_valor: Number(estimativaValor.toFixed(2)),
        };
      })
      .sort((a, b) => {
        if (a.status_priority !== b.status_priority) {
          return b.status_priority - a.status_priority;
        }

        if (a.saldo_minutos !== b.saldo_minutos) {
          return a.saldo_minutos - b.saldo_minutos;
        }

        return String(a.nome || '').localeCompare(String(b.nome || ''));
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  async getTimelineOperacional(limit = 60) {
    const { data: eventos, error } = await supabase
      .from('banco_horas_eventos')
      .select('id, colaborador_id, empresa_id, tipo_evento, tipo, status, descricao, observacao, data_evento, created_at, quantidade_minutos, minutos, origem, saldo_anterior, saldo_atual, saldo_resultante, referencia_evento_id, registro_ponto_id, executado_por, executado_por_nome, contexto_operacao, data_vencimento, data_folga')
      .or('is_teste.is.null,is_teste.eq.false')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const colaboradorIds = Array.from(new Set((eventos || []).map((evento) => evento.colaborador_id).filter(Boolean))) as string[];
    const empresaIds = Array.from(new Set((eventos || []).map((evento) => evento.empresa_id).filter(Boolean))) as string[];
    const executorIds = Array.from(new Set((eventos || []).map((evento) => evento.executado_por).filter(Boolean))) as string[];

    const [{ data: colaboradores }, { data: empresas }, { data: profiles }] = await Promise.all([
      colaboradorIds.length > 0
        ? supabase.from('colaboradores').select('id, nome, matricula').in('id', colaboradorIds)
        : Promise.resolve({ data: [], error: null }),
      empresaIds.length > 0
        ? supabase.from('empresas').select('id, nome').in('id', empresaIds)
        : Promise.resolve({ data: [], error: null }),
      executorIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name').in('user_id', executorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const colaboradorMap = new Map((colaboradores || []).map((colaborador) => [colaborador.id, colaborador]));
    const empresaMap = new Map((empresas || []).map((empresa) => [empresa.id, empresa.nome]));
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.full_name]));

    return (eventos || []).map((evento) => {
      const categoria = this.getTimelineCategory(evento.tipo_evento ?? evento.tipo ?? '');
      const colaborador = colaboradorMap.get(evento.colaborador_id);
      const minutos = this.getEventMinutes(evento);
      const timelineStatus = this.getTimelineStatus({
        tipoEvento: String(evento.tipo_evento ?? evento.tipo ?? ''),
        status: String(evento.status ?? ''),
        minutos,
        dataVencimento: evento.data_vencimento ?? null,
      });

      return {
        id: evento.id,
        categoria,
        categoria_label: this.getTimelineCategoryLabel(categoria),
        origem: evento.origem ?? null,
        colaborador_id: evento.colaborador_id,
        colaborador_nome: colaborador?.nome ?? 'Colaborador nao identificado',
        matricula: colaborador?.matricula ?? null,
        empresa_id: evento.empresa_id,
        empresa_nome: empresaMap.get(evento.empresa_id ?? '') ?? 'Sem empresa',
        descricao: evento.descricao ?? evento.observacao ?? 'Movimento operacional',
        observacao: evento.observacao ?? null,
        status: evento.status ?? 'ativo',
        status_timeline: timelineStatus.status,
        status_timeline_label: timelineStatus.label,
        data_evento: evento.data_evento ?? null,
        data_vencimento: evento.data_vencimento ?? null,
        data_folga: evento.data_folga ?? null,
        created_at: evento.created_at ?? null,
        minutos,
        minutos_formatados: this.formatMinutes(minutos),
        tipo_evento: evento.tipo_evento ?? evento.tipo ?? 'evento',
        executado_por: evento.executado_por ?? null,
        executado_por_nome: evento.executado_por_nome ?? profileMap.get(evento.executado_por ?? '') ?? 'Sistema',
        saldo_anterior: Number(evento.saldo_anterior ?? 0),
        saldo_resultante: Number(evento.saldo_resultante ?? evento.saldo_atual ?? 0),
        saldo_anterior_formatado: this.formatMinutes(Number(evento.saldo_anterior ?? 0)),
        saldo_resultante_formatado: this.formatMinutes(Number(evento.saldo_resultante ?? evento.saldo_atual ?? 0)),
        referencia_evento_id: evento.referencia_evento_id ?? null,
        registro_ponto_id: evento.registro_ponto_id ?? null,
        contexto_operacao: evento.contexto_operacao ?? null,
      };
    });
  }

  private formatMinutes(totalMinutes: number) {
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes}m`;
  }

  private getEstimatedHourlyValue(colaborador: any) {
    const directValue = Number(colaborador?.valor_hora ?? 0);
    if (directValue > 0) return directValue;

    const salaryBase = Number(colaborador?.salario_base ?? 0);
    if (salaryBase > 0) return salaryBase / 220;

    const dailyValue = Number(colaborador?.valor_diaria ?? 0);
    if (dailyValue > 0) return dailyValue / 8;

    const baseValue = Number(colaborador?.valor_base ?? 0);
    if (baseValue > 0) return baseValue / 8;

    return 0;
  }

  private getStatus(params: {
    totalMinutes: number;
    minutesExpired: number;
    minutesDueSoon: number;
    oldBalanceMinutes: number;
    hasPendingRh: boolean;
  }) {
    if (params.hasPendingRh) {
      return { status: 'aguardando_rh', label: 'Aguardando acao RH', priority: 110 };
    }

    if (params.totalMinutes <= CRITICAL_DEBIT_THRESHOLD) {
      return { status: 'debito_critico', label: 'Debito Critico', priority: 100 };
    }

    if (params.minutesExpired > 0 || params.minutesDueSoon > 0) {
      return { status: 'horas_a_vencer', label: 'Horas a vencer', priority: 90 };
    }

    if (params.totalMinutes < 0) {
      return { status: 'debito_leve', label: 'Debito Leve', priority: 70 };
    }

    if (params.totalMinutes >= EXCESS_BANK_THRESHOLD || params.oldBalanceMinutes > 0) {
      return { status: 'excesso_banco', label: 'Excesso de banco', priority: 60 };
    }

    if (params.totalMinutes > 0) {
      return { status: 'saldo_positivo', label: 'Saldo Positivo', priority: 50 };
    }

    return { status: 'ok', label: 'OK', priority: 10 };
  }

  private getTimelineCategory(tipoEvento: string) {
    if (tipoEvento === 'pagamento') return 'pagamentos';
    if (tipoEvento === 'folga') return 'folgas';
    if (tipoEvento === 'ajuste_manual' || tipoEvento === 'compensacao') return 'ajustes';
    if (tipoEvento === 'vencimento') return 'vencimentos';
    return 'creditos_rh';
  }

  private getTimelineCategoryLabel(categoria: string) {
    if (categoria === 'pagamentos') return 'Pagamentos';
    if (categoria === 'folgas') return 'Folgas';
    if (categoria === 'ajustes') return 'Ajustes';
    if (categoria === 'vencimentos') return 'Vencimentos';
    return 'Creditos RH';
  }

  private getTimelineStatus(params: {
    tipoEvento: string;
    status: string;
    minutos: number;
    dataVencimento: string | null;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = params.dataVencimento ? new Date(`${params.dataVencimento}T00:00:00`) : null;
    if (dueDate) {
      dueDate.setHours(0, 0, 0, 0);
    }

    const isNearDue =
      dueDate &&
      dueDate >= today &&
      dueDate <= new Date(today.getTime() + NEAR_DUE_WINDOW_DAYS * 86400000);

    if (params.status === 'pago' || params.tipoEvento === 'pagamento') {
      return { status: 'pago', label: 'Pago' };
    }

    if (params.tipoEvento === 'folga') {
      return { status: 'folga_lancada', label: 'Folga lancada' };
    }

    if (params.status === 'compensado' || params.tipoEvento === 'compensacao') {
      return { status: 'compensado', label: 'Compensado' };
    }

    if (params.tipoEvento === 'vencimento' || (dueDate && dueDate < today && params.minutos > 0)) {
      return { status: 'vencido', label: 'Vencido' };
    }

    if (isNearDue && params.minutos > 0) {
      return { status: 'proximo_vencimento', label: 'Proximo do vencimento' };
    }

    if (params.minutos <= CRITICAL_DEBIT_THRESHOLD) {
      return { status: 'critico', label: 'Critico' };
    }

    if (params.tipoEvento === 'ajuste_manual' || params.status === 'ajustado') {
      return { status: 'em_analise', label: 'Em analise' };
    }

    return { status: 'ok', label: 'OK' };
  }
}
export const BHEventoService = new BHEventoServiceClass();

class ProfileServiceClass extends BaseService<'perfis'> {
  constructor() { super('perfis'); }
}
export const ProfileService = new ProfileServiceClass();

class UserProfileServiceClass extends BaseService<'perfis_usuarios'> {
  constructor() { super('perfis_usuarios'); }

  async getWithDetails() {
    const { data, error } = await supabase
      .from('perfis_usuarios')
      .select('*, perfis(nome), empresas(nome)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async manageUser(payload: any) {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: payload
    });
    if (error) {
       let errorMsg = error.message;
       // Tentar extrair o JSON real de erro do Edge Function se disponivel
       try {
         const jsonText = await error.context?.text?.();
         if (jsonText) {
             const json = JSON.parse(jsonText);
             if (json.error) errorMsg = json.error;
         }
       } catch(e) {}
       throw new Error(errorMsg);
    }
    return data;
  }
}
export const UserProfileService = new UserProfileServiceClass();

class AuditoriaServiceClass extends BaseService<'auditoria'> {
  constructor() { super('auditoria'); }

  async log(acao: string, modulo: string, impacto: 'baixo' | 'medio' | 'critico', detalhes?: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser();
    let tenant_id: string | undefined;

    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      if (profile?.tenant_id) {
        tenant_id = profile.tenant_id;
      }
    }

    const payload = {
      acao,
      modulo,
      impacto,
      detalhes: detalhes || {},
      user_id: user?.id || null
    } as Record<string, unknown>;

    if (tenant_id) {
      payload.tenant_id = tenant_id;
    }

    try {
      return await this.create(payload as any);
    } catch (error) {
      const message = String((error as { message?: string | null })?.message ?? '').toLowerCase();
      const missingTenantColumn =
        message.includes("tenant_id") &&
        (message.includes("auditoria") || message.includes("schema cache"));

      if (missingTenantColumn && 'tenant_id' in payload) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.tenant_id;
        return this.create(fallbackPayload as any);
      }

      throw error;
    }
  }
}
export const AuditoriaService = new AuditoriaServiceClass();
