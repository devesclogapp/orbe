import {
  DiaSemana,
  JornadaTrabalho,
  JornadaResolveInput,
  JornadaResolveResult,
  OrigemJornada,
  TipoDiaResolvido,
  TipoFeriado,
} from '../../types/jornada.types';
import { OperationalCalendarService } from './OperationalCalendarService';
import { supabase } from '@/lib/supabase';

/**
 * Converte data civil em formato YYYY-MM-DD para o dia da semana padronizado.
 * Utiliza UTC às 12:00:00 para blindagem total contra qualquer fuso horário local.
 */
export function getDiaSemanaCivil(dataStr: string): DiaSemana {
  if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new Error(`Data civil inválida: '${dataStr}'. Formato esperado: YYYY-MM-DD.`);
  }

  const [year, month, day] = dataStr.split('-').map(Number);
  const dateUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayIndex = dateUtc.getUTCDay(); // 0 = dom, 1 = seg, 2 = ter, 3 = qua, 4 = qui, 5 = sex, 6 = sab

  const mapa: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return mapa[dayIndex];
}

/**
 * Verifica se a data civil consultada está estritamente dentro da vigência da jornada.
 * Comparação lexicográfica direta em YYYY-MM-DD (inclusiva no início e no fim).
 */
export function isJornadaEmVigencia(jornada: JornadaTrabalho, dataCivil: string): boolean {
  if (dataCivil < jornada.vigencia_inicio) {
    return false;
  }
  if (jornada.vigencia_fim && dataCivil > jornada.vigencia_fim) {
    return false;
  }
  return true;
}

export class JornadaResolver {
  /**
   * Resolução puramente síncrona em memória a partir de jornadasDisponiveis.
   */
  static resolveSync(input: JornadaResolveInput): JornadaResolveResult {
    const { tenantId, data, colaboradorJornadaId, empresaId } = input;
    const diaSemana = getDiaSemanaCivil(data);

    // 1. Identificação de Feriado (Nacional ou Customizado)
    let isFeriado = false;
    let tipoFeriado: TipoFeriado | null = null;
    let nomeFeriado: string | null = null;

    if (input.feriadosCustomizados && input.feriadosCustomizados.length > 0) {
      const custom = input.feriadosCustomizados.find((f) => f.data === data);
      if (custom) {
        isFeriado = true;
        tipoFeriado = custom.tipo;
        nomeFeriado = custom.nome;
      }
    }

    if (!isFeriado) {
      const nacionalInfo = OperationalCalendarService.getFeriadoNacionalInfo(data);
      if (nacionalInfo.feriado) {
        isFeriado = true;
        tipoFeriado = 'NACIONAL';
        nomeFeriado = nacionalInfo.nome;
      }
    }

    // 2. Filtragem de jornadas do Tenant
    const candidatos: JornadaTrabalho[] = (input.jornadasDisponiveis || []).filter(
      (j) => j.tenant_id === tenantId && j.status === 'ativo'
    );

    // 3. Aplicação da Hierarquia de Precedência com Validação de Vigência
    let jornadaEscolhida: JornadaTrabalho | null = null;
    let origemEscolhida: OrigemJornada | null = null;

    // 3.1 Precedência 1: Jornada específica do colaborador
    if (colaboradorJornadaId) {
      const especifica = candidatos.find((j) => j.id === colaboradorJornadaId);
      if (especifica && isJornadaEmVigencia(especifica, data)) {
        jornadaEscolhida = especifica;
        origemEscolhida = 'COLABORADOR';
      }
    }

    // 3.2 Precedência 2: Jornada padrão ativa da empresa
    if (!jornadaEscolhida && empresaId) {
      const padraoEmpresa = candidatos.find(
        (j) => j.empresa_id === empresaId && j.padrao === true && isJornadaEmVigencia(j, data)
      );
      if (padraoEmpresa) {
        jornadaEscolhida = padraoEmpresa;
        origemEscolhida = 'EMPRESA';
      }
    }

    // 3.3 Precedência 3: Jornada padrão global do tenant (empresa_id = null)
    if (!jornadaEscolhida) {
      const padraoGlobal = candidatos.find(
        (j) => j.empresa_id === null && j.padrao === true && isJornadaEmVigencia(j, data)
      );
      if (padraoGlobal) {
        jornadaEscolhida = padraoGlobal;
        origemEscolhida = 'TENANT';
      }
    }

    // 3.4 Precedência 4: Nenhuma jornada encontrada
    if (!jornadaEscolhida) {
      return {
        temJornadaConfigurada: false,
        jornadaId: null,
        cargaSemanalMinutos: null,
        origem: null,
        data,
        diaSemana,
        trabalhavel: false,
        minutosPrevistos: null,
        tipoDia: 'SEM_JORNADA',
        feriado: isFeriado,
        tipoFeriado,
        nomeFeriado,
        politicaFeriado: null,
        mensagem: 'Nenhuma jornada de trabalho configurada ou em vigência para este contexto.',
      };
    }

    // 4. Extração do Dia da Grade Semanal
    const diaGrade = jornadaEscolhida.grade_semanal[diaSemana];
    if (!diaGrade) {
      return {
        temJornadaConfigurada: false,
        jornadaId: jornadaEscolhida.id,
        cargaSemanalMinutos: null,
        origem: origemEscolhida,
        data,
        diaSemana,
        trabalhavel: false,
        minutosPrevistos: null,
        tipoDia: 'SEM_JORNADA',
        feriado: isFeriado,
        tipoFeriado,
        nomeFeriado,
        politicaFeriado: jornadaEscolhida.politica_feriado,
        mensagem: `Dia da semana '${diaSemana}' não encontrado na grade semanal da jornada.`,
      };
    }

    // 5. Tratamento de Feriado (Sem qualquer cálculo financeiro)
    if (isFeriado) {
      const politica = jornadaEscolhida.politica_feriado || 'FOLGA_DSR';

      if (politica === 'FOLGA_DSR') {
        return {
          temJornadaConfigurada: true,
          jornadaId: jornadaEscolhida.id,
          cargaSemanalMinutos: jornadaEscolhida.carga_semanal_minutos,
          origem: origemEscolhida,
          data,
          diaSemana,
          trabalhavel: false,
          minutosPrevistos: 0,
          tipoDia: 'FERIADO',
          feriado: true,
          tipoFeriado,
          nomeFeriado,
          politicaFeriado: politica,
          mensagem: `Feriado (${nomeFeriado || 'Nacional'}) com política de Folga/DSR. Zero minutos previstos.`,
        };
      }

      return {
        temJornadaConfigurada: true,
        jornadaId: jornadaEscolhida.id,
        cargaSemanalMinutos: jornadaEscolhida.carga_semanal_minutos,
        origem: origemEscolhida,
        data,
        diaSemana,
        trabalhavel: diaGrade.trabalhavel,
        minutosPrevistos: diaGrade.minutos_previstos,
        tipoDia: 'FERIADO',
        feriado: true,
        tipoFeriado,
        nomeFeriado,
        politicaFeriado: politica,
        mensagem: `Feriado (${nomeFeriado || 'Nacional'}) com escala de trabalho prevista (${diaGrade.minutos_previstos} min).`,
      };
    }

    // 6. Dia Normal de Grade
    return {
      temJornadaConfigurada: true,
      jornadaId: jornadaEscolhida.id,
      cargaSemanalMinutos: jornadaEscolhida.carga_semanal_minutos,
      origem: origemEscolhida,
      data,
      diaSemana,
      trabalhavel: diaGrade.trabalhavel,
      minutosPrevistos: diaGrade.minutos_previstos,
      tipoDia: diaGrade.tipo,
      feriado: false,
      tipoFeriado: null,
      nomeFeriado: null,
      politicaFeriado: jornadaEscolhida.politica_feriado,
    };
  }

  /**
   * Resolve a expectativa diária de jornada e calendário para uma data específica.
   */
  static async resolve(input: JornadaResolveInput): Promise<JornadaResolveResult> {
    if (input.jornadasDisponiveis) {
      return JornadaResolver.resolveSync(input);
    }

    // Consulta ao banco caso não tenham sido passadas em lote
    const { data: dbJornadas, error } = await (supabase as any)
      .from('jornadas_trabalho')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('status', 'ativo');

    if (error) {
      console.warn('[JornadaResolver] Erro ao buscar jornadas no banco:', error.message);
    }

    return JornadaResolver.resolveSync({
      ...input,
      jornadasDisponiveis: (dbJornadas || []) as JornadaTrabalho[],
    });
  }
}
