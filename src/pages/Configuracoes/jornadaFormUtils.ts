/**
 * ==============================================================================
 * UTILITÁRIOS E FORMATAÇÃO: FORMULÁRIO DE JORNADA DE TRABALHO
 * Módulo: Preferências > Configurações Operacionais
 * Responsabilidade: Conversão de horários, cálculo em tempo real de carga semanal,
 * templates neutros de grade e validação estrutural.
 * ==============================================================================
 */

import {
  DiaSemana,
  GradeSemanal,
  TipoDiaJornada,
  validarGradeSemanal,
  ValidacaoGradeResult,
} from '@/types/jornada.types';

export interface DiaConfigItem {
  key: DiaSemana;
  nomeCurto: string;
  nomeCompleto: string;
}

export const DIAS_CONFIG: DiaConfigItem[] = [
  { key: 'seg', nomeCurto: 'Seg', nomeCompleto: 'Segunda-feira' },
  { key: 'ter', nomeCurto: 'Ter', nomeCompleto: 'Terça-feira' },
  { key: 'qua', nomeCurto: 'Qua', nomeCompleto: 'Quarta-feira' },
  { key: 'qui', nomeCurto: 'Qui', nomeCompleto: 'Quinta-feira' },
  { key: 'sex', nomeCurto: 'Sex', nomeCompleto: 'Sexta-feira' },
  { key: 'sab', nomeCurto: 'Sáb', nomeCompleto: 'Sábado' },
  { key: 'dom', nomeCurto: 'Dom', nomeCompleto: 'Domingo' },
];

export const TIPOS_DIA_OPTIONS: Array<{ value: TipoDiaJornada; label: string; desc: string }> = [
  { value: 'TRABALHO', label: 'Trabalho', desc: 'Dia com cumprimento de jornada' },
  { value: 'COMPENSADO', label: 'Compensado', desc: 'Horas compensadas durante a semana' },
  { value: 'DSR', label: 'DSR', desc: 'Descanso Semanal Remunerado' },
  { value: 'FOLGA', label: 'Folga', desc: 'Dia de folga contratual' },
];

/**
 * Converte minutos inteiros para formato HH:MM (ex: 528 -> "08:48")
 */
export function minutesToTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
    return '00:00';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converte string HH:MM para minutos inteiros (ex: "08:48" -> 528)
 */
export function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || m < 0) return 0;
  return h * 60 + m;
}

/**
 * Formata minutos para exibição de carga semanal (ex: 2640 -> "44h00", 2400 -> "40h00")
 */
export function formatMinutesToHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes <= 0) {
    return '00h00';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

/**
 * Calcula a soma em minutos de todos os dias trabalháveis na grade
 */
export function calcularCargaSemanal(grade: GradeSemanal | null | undefined): number {
  if (!grade || typeof grade !== 'object') return 0;
  let total = 0;
  for (const dia of DIAS_CONFIG) {
    const d = grade[dia.key];
    if (d && d.trabalhavel && d.tipo === 'TRABALHO') {
      const min = typeof d.minutos_previstos === 'number' ? d.minutos_previstos : 0;
      if (min > 0) total += min;
    }
  }
  return total;
}

/**
 * Deriva o divisor mensal canônico para uma carga semanal em minutos (Art. 64 CLT / Súmula 431 TST)
 * Fórmula: (cargaSemanalHoras / 6) * 30 = cargaSemanalHoras * 5 = cargaSemanalMinutos / 12
 */
export function derivarDivisorMensal(cargaSemanalMinutos: number): number {
  if (!cargaSemanalMinutos || cargaSemanalMinutos <= 0) return 0;
  return cargaSemanalMinutos / 12;
}

/**
 * Cria uma grade semanal vazia neutra (Seg-Sex 08:00 não persistida até confirmação do usuário)
 */
export function criarGradeVazia(): GradeSemanal {
  return {
    seg: { trabalhavel: false, minutos_previstos: 0, tipo: 'TRABALHO' },
    ter: { trabalhavel: false, minutos_previstos: 0, tipo: 'TRABALHO' },
    qua: { trabalhavel: false, minutos_previstos: 0, tipo: 'TRABALHO' },
    qui: { trabalhavel: false, minutos_previstos: 0, tipo: 'TRABALHO' },
    sex: { trabalhavel: false, minutos_previstos: 0, tipo: 'TRABALHO' },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'COMPENSADO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

/**
 * Template padrão 44h semanais (Seg-Sex 08:48, Sáb Compensado, Dom DSR)
 */
export function criarGradeTemplate44h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' }, // 08:48
    ter: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'COMPENSADO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

/**
 * Template padrão 40h semanais (Seg-Sex 08:00, Sáb Folga, Dom DSR)
 */
export function criarGradeTemplate40h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' }, // 08:00
    ter: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'FOLGA' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

/**
 * Template padrão 36h semanais (Seg-Sáb 06:00, Dom DSR)
 */
export function criarGradeTemplate36h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' }, // 06:00
    ter: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' },
    sab: { trabalhavel: true, minutos_previstos: 360, tipo: 'TRABALHO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

/**
 * Gera um resumo visual amigável dos dias da semana para a listagem
 * Ex: "Seg-Sex 08:48 • Sáb Comp • Dom DSR"
 */
export function formatarResumoGrade(grade: GradeSemanal | null | undefined): string {
  if (!grade) return 'Sem grade configurada';

  // Verificar se Seg-Sex têm a mesma configuração
  const segSexDias: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const segConfig = grade.seg;
  const segSexIguais =
    segConfig &&
    segSexDias.every((d) => {
      const dia = grade[d];
      return (
        dia &&
        dia.tipo === segConfig.tipo &&
        dia.minutos_previstos === segConfig.minutos_previstos
      );
    });

  const partes: string[] = [];

  if (segSexIguais && segConfig) {
    if (segConfig.tipo === 'TRABALHO') {
      partes.push(`Seg-Sex: ${minutesToTime(segConfig.minutos_previstos)}`);
    } else {
      partes.push(`Seg-Sex: ${segConfig.tipo}`);
    }
  } else {
    for (const d of segSexDias) {
      const dia = grade[d];
      if (!dia) continue;
      const label = d.toUpperCase();
      if (dia.tipo === 'TRABALHO') {
        partes.push(`${label}: ${minutesToTime(dia.minutos_previstos)}`);
      } else {
        partes.push(`${label}: ${dia.tipo.substring(0, 4)}`);
      }
    }
  }

  // Sábado
  if (grade.sab) {
    const sab = grade.sab;
    if (sab.tipo === 'TRABALHO') {
      partes.push(`Sáb: ${minutesToTime(sab.minutos_previstos)}`);
    } else if (sab.tipo === 'COMPENSADO') {
      partes.push(`Sáb: Compensado`);
    } else {
      partes.push(`Sáb: ${sab.tipo}`);
    }
  }

  // Domingo
  if (grade.dom) {
    const dom = grade.dom;
    if (dom.tipo === 'TRABALHO') {
      partes.push(`Dom: ${minutesToTime(dom.minutos_previstos)}`);
    } else {
      partes.push(`Dom: ${dom.tipo}`);
    }
  }

  return partes.join(' • ');
}

/**
 * Validação do formulário de criação/edição de jornada antes do envio
 */
export interface ValidacaoFormularioJornadaResult {
  valido: boolean;
  erros: string[];
}

export function validarFormularioJornada(params: {
  nome: string;
  vigencia_inicio: string;
  escopo: 'geral' | 'empresa';
  empresa_id?: string | null;
  grade_semanal: GradeSemanal;
  carga_semanal_minutos: number;
}): ValidacaoFormularioJornadaResult {
  const erros: string[] = [];

  if (!params.nome || !params.nome.trim()) {
    erros.push('O nome da jornada é obrigatório.');
  }

  if (!params.vigencia_inicio || !params.vigencia_inicio.trim()) {
    erros.push('A vigência inicial é obrigatória.');
  }

  if (params.escopo === 'empresa' && (!params.empresa_id || !params.empresa_id.trim())) {
    erros.push('Selecione uma empresa válida para a jornada de escopo específico.');
  }

  if (params.carga_semanal_minutos <= 0) {
    erros.push('A jornada deve possuir pelo menos um dia de trabalho com carga horária maior que zero.');
  }

  const validacaoGrade = validarGradeSemanal(params.grade_semanal, params.carga_semanal_minutos);
  if (!validacaoGrade.valida) {
    erros.push(...validacaoGrade.erros);
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}
