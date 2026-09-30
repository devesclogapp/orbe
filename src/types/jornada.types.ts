/**
 * ==============================================================================
 * TIPOS DA ENTIDADE: JORNADA DE TRABALHO (CLT)
 * Módulo: RH / Processamento CLT
 * Domínio: Escalas e Jornadas de Trabalho (Desacoplado de Banco de Horas)
 * ==============================================================================
 */

export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export type DiaSemana = typeof DIAS_SEMANA[number];

export type TipoDiaJornada = 'TRABALHO' | 'FOLGA' | 'DSR' | 'COMPENSADO';

export type TipoEscala = 'SEMANAL' | '5X2' | '6X1' | '12X36';

export type PoliticaFeriado = 'FOLGA_DSR' | 'TRABALHA_NORMAL' | 'TRABALHA_EXTRA';

export interface DiaJornada {
  trabalhavel: boolean;
  minutos_previstos: number;
  tipo: TipoDiaJornada;
  entrada?: string | null;
  saida_almoco?: string | null;
  retorno_almoco?: string | null;
  saida?: string | null;
  intervalo_min?: number | null;
}

export type GradeSemanal = Record<DiaSemana, DiaJornada>;

export interface JornadaTrabalho {
  id: string;
  tenant_id: string;
  empresa_id: string | null; // null indica padrão global do tenant
  nome: string;
  descricao?: string | null;
  tipo_escala: TipoEscala;
  carga_semanal_minutos: number;
  grade_semanal: GradeSemanal;
  politica_feriado: PoliticaFeriado;
  vigencia_inicio: string; // YYYY-MM-DD
  vigencia_fim?: string | null; // YYYY-MM-DD
  padrao: boolean;
  status: 'ativo' | 'inativo';
  created_at?: string;
  updated_at?: string;
}

export interface CriarJornadaDTO {
  tenant_id?: string;
  empresa_id?: string | null;
  nome: string;
  descricao?: string | null;
  tipo_escala?: TipoEscala;
  carga_semanal_minutos?: number;
  grade_semanal: GradeSemanal;
  politica_feriado?: PoliticaFeriado;
  vigencia_inicio: string;
  vigencia_fim?: string | null;
  padrao?: boolean;
  status?: 'ativo' | 'inativo';
}

export interface AtualizarJornadaDTO {
  empresa_id?: string | null;
  nome?: string;
  descricao?: string | null;
  tipo_escala?: TipoEscala;
  carga_semanal_minutos?: number;
  grade_semanal?: GradeSemanal;
  politica_feriado?: PoliticaFeriado;
  vigencia_inicio?: string;
  vigencia_fim?: string | null;
  padrao?: boolean;
  status?: 'ativo' | 'inativo';
}

export interface ValidacaoGradeResult {
  valida: boolean;
  erros: string[];
  somaMinutos: number;
}

/**
 * Validador canônico de Grade Semanal
 * Garante as 5 regras de integridade operacional:
 * 1. Todos os 7 dias presentes
 * 2. Minutos não negativos
 * 3. Dias não trabalháveis não podem ter minutos positivos
 * 4. Tipos válidos (TRABALHO, FOLGA, DSR, COMPENSADO)
 * 5. Consistência entre a soma da grade e carga_semanal_minutos (se informada)
 */
export function validarGradeSemanal(
  grade: unknown,
  cargaSemanalMinutos?: number
): ValidacaoGradeResult {
  const erros: string[] = [];
  let somaMinutos = 0;

  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) {
    return { valida: false, erros: ['Grade semanal deve ser um objeto JSON válido'], somaMinutos: 0 };
  }

  const obj = grade as Record<string, unknown>;

  for (const dia of DIAS_SEMANA) {
    if (!(dia in obj)) {
      erros.push(`Dia '${dia}' ausente na grade semanal.`);
      continue;
    }

    const diaObj = obj[dia];
    if (!diaObj || typeof diaObj !== 'object' || Array.isArray(diaObj)) {
      erros.push(`Configuração do dia '${dia}' deve ser um objeto.`);
      continue;
    }

    const d = diaObj as Record<string, unknown>;

    if (typeof d.trabalhavel !== 'boolean') {
      erros.push(`Dia '${dia}': campo 'trabalhavel' deve ser booleano.`);
    }

    if (typeof d.minutos_previstos !== 'number' || Number.isNaN(d.minutos_previstos)) {
      erros.push(`Dia '${dia}': campo 'minutos_previstos' deve ser numérico.`);
    } else {
      if (d.minutos_previstos < 0) {
        erros.push(`Dia '${dia}': minutos previstos não podem ser negativos (${d.minutos_previstos}).`);
      }

      if (d.trabalhavel === false && d.minutos_previstos > 0) {
        erros.push(`Dia '${dia}': dia não trabalhável não pode ter minutos positivos (${d.minutos_previstos}).`);
      }

      if (d.trabalhavel === true) {
        somaMinutos += d.minutos_previstos;
      }
    }

    const tiposValidos: TipoDiaJornada[] = ['TRABALHO', 'FOLGA', 'DSR', 'COMPENSADO'];
    if (d.tipo && !tiposValidos.includes(d.tipo as TipoDiaJornada)) {
      erros.push(`Dia '${dia}': tipo '${d.tipo}' inválido. Valores aceitos: ${tiposValidos.join(', ')}.`);
    }
  }

  if (cargaSemanalMinutos !== undefined && cargaSemanalMinutos !== null) {
    if (cargaSemanalMinutos < 0) {
      erros.push(`Carga semanal não pode ser negativa (${cargaSemanalMinutos}).`);
    } else if (somaMinutos !== cargaSemanalMinutos) {
      erros.push(
        `Inconsistência de carga semanal: a soma da grade (${somaMinutos} min) diverge da carga contratual informada (${cargaSemanalMinutos} min).`
      );
    }
  }

  return {
    valida: erros.length === 0,
    erros,
    somaMinutos,
  };
}

// ==============================================================================
// TIPOS DO RESOLVER DE JORNADA (FIX 04.2-B)
// ==============================================================================

export type OrigemJornada = 'COLABORADOR' | 'EMPRESA' | 'TENANT';

export type TipoDiaResolvido =
  | 'TRABALHO'
  | 'FOLGA'
  | 'DSR'
  | 'COMPENSADO'
  | 'FERIADO'
  | 'SEM_JORNADA';

export type TipoFeriado = 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL';

export interface FeriadoInfo {
  feriado: boolean;
  tipoFeriado?: TipoFeriado | null;
  nomeFeriado?: string | null;
}

export interface FeriadoCustomizadoDTO {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: TipoFeriado;
}

export interface JornadaResolveInput {
  tenantId: string;
  data: string; // YYYY-MM-DD (Dia civil)
  colaboradorId?: string | null;
  colaboradorJornadaId?: string | null;
  empresaId?: string | null;
  jornadasDisponiveis?: JornadaTrabalho[]; // Para resolução em lote / testes isolados sem query ao banco
  feriadosCustomizados?: FeriadoCustomizadoDTO[];
}

export interface JornadaResolveResult {
  temJornadaConfigurada: boolean;
  jornadaId: string | null;
  cargaSemanalMinutos?: number | null;
  origem: OrigemJornada | null;
  data: string;
  diaSemana: DiaSemana;
  trabalhavel: boolean;
  minutosPrevistos: number | null;
  tipoDia: TipoDiaResolvido;
  feriado: boolean;
  tipoFeriado?: TipoFeriado | null;
  nomeFeriado?: string | null;
  politicaFeriado?: PoliticaFeriado | null;
  mensagem?: string;
}

