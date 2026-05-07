import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

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

  async getByColaborador(collabId: string, startDate?: Date, endDate?: Date) {
    let query = supabase
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', collabId);

    if (startDate) {
      query = query.gte('data', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('data', endDate.toISOString());
    }

    const { data, error } = await query.order('data', { ascending: false });
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
        .select('colaborador_id, empresa_id, quantidade_minutos, data_vencimento')
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
        hasMovement: true,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    for (const evento of eventosData || []) {
      if (!evento.colaborador_id) continue;

      const current = aggregates.get(evento.colaborador_id) || {
        empresa_id: evento.empresa_id ?? null,
        saldo_minutos: 0,
        saldo_from_saldos: false,
        minutos_vencidos: 0,
        minutos_a_vencer_30d: 0,
        hasMovement: false,
      };

      const quantidadeMinutos = Number(evento.quantidade_minutos ?? 0);

      if (!current.saldo_from_saldos) {
        current.saldo_minutos += quantidadeMinutos;
      }

      current.empresa_id = current.empresa_id ?? evento.empresa_id ?? null;
      current.hasMovement = true;

      if (evento.data_vencimento && quantidadeMinutos > 0) {
        const vencimento = new Date(evento.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);

        if (vencimento < today) {
          current.minutos_vencidos += quantidadeMinutos;
        } else if (vencimento <= in30Days) {
          current.minutos_a_vencer_30d += quantidadeMinutos;
        }
      }

      aggregates.set(evento.colaborador_id, current);
    }

    const collaboratorIds = Array.from(aggregates.keys());

    if (!includeWithoutMovement && collaboratorIds.length === 0) {
      return [];
    }

    const { data: colaboradoresData, error: colaboradoresError } = includeWithoutMovement
      ? await supabase
          .from('colaboradores')
          .select('id, nome, matricula, empresa_id')
          .order('nome', { ascending: true })
      : await supabase
          .from('colaboradores')
          .select('id, nome, matricula, empresa_id')
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
          hasMovement: false,
        };

        if (!includeWithoutMovement && !aggregate.hasMovement) {
          return null;
        }

        const status = this.getStatus(aggregate.saldo_minutos);

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          matricula: colaborador.matricula,
          empresa_id: colaborador.empresa_id,
          empresa: empresaMap.get(colaborador.empresa_id ?? aggregate.empresa_id ?? '') || null,
          saldo_minutos: aggregate.saldo_minutos,
          minutos_vencidos: aggregate.minutos_vencidos,
          minutos_a_vencer_30d: aggregate.minutos_a_vencer_30d,
          saldo_formatado: this.formatMinutes(aggregate.saldo_minutos),
          vencido_formatado: this.formatMinutes(aggregate.minutos_vencidos),
          a_vencer_formatado: this.formatMinutes(aggregate.minutos_a_vencer_30d),
          status,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  private formatMinutes(totalMinutes: number) {
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${hours}h ${minutes}m`;
  }

  private getStatus(totalMinutes: number) {
    if (totalMinutes < -120) return 'critico';
    if (totalMinutes > 0) return 'positivo';
    return 'ok';
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
    return this.create({
      acao,
      modulo,
      impacto,
      detalhes: detalhes || {},
      user_id: user?.id || null
    });
  }
}
export const AuditoriaService = new AuditoriaServiceClass();
