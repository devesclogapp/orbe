import { supabase } from '@/lib/supabase';
import {
  JornadaTrabalho,
  CriarJornadaDTO,
  AtualizarJornadaDTO,
  validarGradeSemanal,
} from '@/types/jornada.types';

export class JornadaServiceClass {
  private tableName = 'jornadas_trabalho';

  /**
   * Lista jornadas de trabalho com filtros opcionais de status e empresa
   */
  async listar(filtros?: {
    status?: 'ativo' | 'inativo';
    empresa_id?: string | null;
  }): Promise<JornadaTrabalho[]> {
    let query = (supabase as any)
      .from(this.tableName)
      .select('*')
      .order('padrao', { ascending: false })
      .order('nome', { ascending: true });

    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros?.empresa_id !== undefined) {
      if (filtros.empresa_id === null) {
        query = query.is('empresa_id', null);
      } else {
        query = query.eq('empresa_id', filtros.empresa_id);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as JornadaTrabalho[];
  }

  /**
   * Busca uma jornada de trabalho por ID
   */
  async buscarPorId(id: string): Promise<JornadaTrabalho | null> {
    if (!id) return null;
    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data || null) as JornadaTrabalho | null;
  }

  /**
   * Lista todas as jornadas associadas a uma determinada empresa
   */
  async listarPorEmpresa(empresaId: string): Promise<JornadaTrabalho[]> {
    return this.listar({ empresa_id: empresaId, status: 'ativo' });
  }

  /**
   * Busca a jornada padrão ativa da empresa (ou a global do tenant se empresa_id for null)
   */
  async buscarPadraoEmpresa(empresaId?: string | null): Promise<JornadaTrabalho | null> {
    let query = (supabase as any)
      .from(this.tableName)
      .select('*')
      .eq('padrao', true)
      .eq('status', 'ativo');

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    } else {
      query = query.is('empresa_id', null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data || null) as JornadaTrabalho | null;
  }

  /**
   * Cria uma nova jornada de trabalho aplicando validação estrita da grade semanal
   */
  async criar(dto: CriarJornadaDTO): Promise<JornadaTrabalho> {
    // 1. Validação estrita da Grade Semanal
    const validacao = validarGradeSemanal(dto.grade_semanal, dto.carga_semanal_minutos);
    if (!validacao.valida) {
      throw new Error(`Grade semanal inválida: ${validacao.erros.join('; ')}`);
    }

    const cargaSemanal = dto.carga_semanal_minutos ?? validacao.somaMinutos;

    // 2. Se for definida como padrão e ativa, desmarcar padrão anterior no mesmo escopo
    if (dto.padrao && dto.status !== 'inativo') {
      await this.desmarcarPadraoAnterior(dto.empresa_id ?? null);
    }

    const payload = {
      tenant_id: dto.tenant_id,
      empresa_id: dto.empresa_id ?? null,
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim() || null,
      tipo_escala: dto.tipo_escala || 'SEMANAL',
      carga_semanal_minutos: cargaSemanal,
      grade_semanal: dto.grade_semanal,
      politica_feriado: dto.politica_feriado || 'FOLGA_DSR',
      vigencia_inicio: dto.vigencia_inicio,
      vigencia_fim: dto.vigencia_fim || null,
      padrao: Boolean(dto.padrao),
      status: dto.status || 'ativo',
    };

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as JornadaTrabalho;
  }

  /**
   * Atualiza uma jornada existente
   */
  async atualizar(id: string, dto: AtualizarJornadaDTO): Promise<JornadaTrabalho> {
    const jornadaAtual = await this.buscarPorId(id);
    if (!jornadaAtual) {
      throw new Error(`Jornada de trabalho com id '${id}' não encontrada.`);
    }

    // Validação da grade caso tenha sido fornecida
    const gradeParaValidar = dto.grade_semanal ?? jornadaAtual.grade_semanal;
    const cargaParaValidar = dto.carga_semanal_minutos ?? jornadaAtual.carga_semanal_minutos;
    const validacao = validarGradeSemanal(gradeParaValidar, cargaParaValidar);
    if (!validacao.valida) {
      throw new Error(`Grade semanal inválida: ${validacao.erros.join('; ')}`);
    }

    const empresaIdResolvida = dto.empresa_id !== undefined ? dto.empresa_id : jornadaAtual.empresa_id;
    const padraoResolvido = dto.padrao !== undefined ? dto.padrao : jornadaAtual.padrao;
    const statusResolvido = dto.status !== undefined ? dto.status : jornadaAtual.status;

    // Se tornou-se padrão e ativa, desmarcar padrão anterior no mesmo escopo
    if (padraoResolvido && statusResolvido === 'ativo') {
      await this.desmarcarPadraoAnterior(empresaIdResolvida, id);
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.nome !== undefined) payload.nome = dto.nome.trim();
    if (dto.descricao !== undefined) payload.descricao = dto.descricao?.trim() || null;
    if (dto.empresa_id !== undefined) payload.empresa_id = dto.empresa_id;
    if (dto.tipo_escala !== undefined) payload.tipo_escala = dto.tipo_escala;
    if (dto.carga_semanal_minutos !== undefined) payload.carga_semanal_minutos = dto.carga_semanal_minutos;
    if (dto.grade_semanal !== undefined) payload.grade_semanal = dto.grade_semanal;
    if (dto.politica_feriado !== undefined) payload.politica_feriado = dto.politica_feriado;
    if (dto.vigencia_inicio !== undefined) payload.vigencia_inicio = dto.vigencia_inicio;
    if (dto.vigencia_fim !== undefined) payload.vigencia_fim = dto.vigencia_fim;
    if (dto.padrao !== undefined) payload.padrao = dto.padrao;
    if (dto.status !== undefined) payload.status = dto.status;

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as JornadaTrabalho;
  }

  /**
   * Desativa uma jornada (Soft delete - preserva integridade histórica de pontos passados)
   */
  async desativar(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from(this.tableName)
      .update({
        status: 'inativo',
        padrao: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Garante idempotência: desmarca 'padrao' de jornadas anteriores ativas no mesmo escopo
   */
  private async desmarcarPadraoAnterior(
    empresaId: string | null,
    ignorarId?: string
  ): Promise<void> {
    let query = (supabase as any)
      .from(this.tableName)
      .update({ padrao: false, updated_at: new Date().toISOString() })
      .eq('padrao', true)
      .eq('status', 'ativo');

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    } else {
      query = query.is('empresa_id', null);
    }

    if (ignorarId) {
      query = query.neq('id', ignorarId);
    }

    const { error } = await query;
    if (error) {
      console.warn('[JornadaService] Aviso ao desmarcar padrão anterior:', error.message);
    }
  }
}

export const JornadaService = new JornadaServiceClass();
