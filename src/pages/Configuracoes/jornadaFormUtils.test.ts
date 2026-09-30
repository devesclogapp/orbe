import { describe, it, expect } from 'vitest';
import {
  minutesToTime,
  timeToMinutes,
  formatMinutesToHours,
  calcularCargaSemanal,
  derivarDivisorMensal,
  criarGradeVazia,
  criarGradeTemplate44h,
  criarGradeTemplate40h,
  criarGradeTemplate36h,
  formatarResumoGrade,
  validarFormularioJornada,
} from './jornadaFormUtils';

describe('FIX CP04.6 — Utilitários e Validação do Formulário de Jornada', () => {
  describe('Conversões de Horário (minutesToTime / timeToMinutes)', () => {
    it('1. Deve converter minutos para string HH:MM corretamente', () => {
      expect(minutesToTime(528)).toBe('08:48');
      expect(minutesToTime(480)).toBe('08:00');
      expect(minutesToTime(360)).toBe('06:00');
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(null)).toBe('00:00');
      expect(minutesToTime(undefined)).toBe('00:00');
    });

    it('2. Deve converter string HH:MM para minutos corretamente', () => {
      expect(timeToMinutes('08:48')).toBe(528);
      expect(timeToMinutes('08:00')).toBe(480);
      expect(timeToMinutes('06:00')).toBe(360);
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('')).toBe(0);
      expect(timeToMinutes(null as any)).toBe(0);
    });

    it('3. Deve formatar minutos de carga semanal com elegância (formatMinutesToHours)', () => {
      expect(formatMinutesToHours(2640)).toBe('44h00');
      expect(formatMinutesToHours(2400)).toBe('40h00');
      expect(formatMinutesToHours(2160)).toBe('36h00');
      expect(formatMinutesToHours(1800)).toBe('30h00');
      expect(formatMinutesToHours(528)).toBe('08h48');
      expect(formatMinutesToHours(0)).toBe('00h00');
    });
  });

  describe('Cálculo em Tempo Real da Carga Semanal e Divisor Mensal', () => {
    it('4. Deve calcular corretamente carga semanal de 44h (2640 min)', () => {
      const grade44h = criarGradeTemplate44h();
      const carga = calcularCargaSemanal(grade44h);
      expect(carga).toBe(2640);
      expect(derivarDivisorMensal(carga)).toBe(220);
    });

    it('5. Deve calcular corretamente carga semanal de 40h (2400 min)', () => {
      const grade40h = criarGradeTemplate40h();
      const carga = calcularCargaSemanal(grade40h);
      expect(carga).toBe(2400);
      expect(derivarDivisorMensal(carga)).toBe(200);
    });

    it('6. Deve calcular corretamente carga semanal de 36h (2160 min)', () => {
      const grade36h = criarGradeTemplate36h();
      const carga = calcularCargaSemanal(grade36h);
      expect(carga).toBe(2160);
      expect(derivarDivisorMensal(carga)).toBe(180);
    });

    it('7. Grade vazia deve resultar em 0 minutos e divisor 0', () => {
      const gradeVazia = criarGradeVazia();
      const carga = calcularCargaSemanal(gradeVazia);
      expect(carga).toBe(0);
      expect(derivarDivisorMensal(carga)).toBe(0);
    });
  });

  describe('Resumo Visual da Grade (formatarResumoGrade)', () => {
    it('8. Deve resumir adequadamente semana 44h (Seg-Sex 08:48, Sáb Comp, Dom DSR)', () => {
      const grade = criarGradeTemplate44h();
      const resumo = formatarResumoGrade(grade);
      expect(resumo).toContain('Seg-Sex: 08:48');
      expect(resumo).toContain('Sáb: Compensado');
      expect(resumo).toContain('Dom: DSR');
    });

    it('9. Deve resumir semana com dias diferentes adequadamente', () => {
      const grade = criarGradeTemplate44h();
      grade.qua = { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' };
      const resumo = formatarResumoGrade(grade);
      expect(resumo).toContain('SEG: 08:48');
      expect(resumo).toContain('QUA: 08:00');
    });
  });

  describe('Validação do Formulário (validarFormularioJornada)', () => {
    it('10. Deve aprovar formulário válido para jornada geral', () => {
      const grade = criarGradeTemplate44h();
      const resultado = validarFormularioJornada({
        nome: 'Jornada Padrão 44h',
        vigencia_inicio: '2026-01-01',
        escopo: 'geral',
        empresa_id: null,
        grade_semanal: grade,
        carga_semanal_minutos: 2640,
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.erros).toHaveLength(0);
    });

    it('11. Deve reprovar formulário sem nome', () => {
      const grade = criarGradeTemplate44h();
      const resultado = validarFormularioJornada({
        nome: '   ',
        vigencia_inicio: '2026-01-01',
        escopo: 'geral',
        grade_semanal: grade,
        carga_semanal_minutos: 2640,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toContain('O nome da jornada é obrigatório.');
    });

    it('12. Deve reprovar formulário sem vigência inicial', () => {
      const grade = criarGradeTemplate44h();
      const resultado = validarFormularioJornada({
        nome: 'Jornada Teste',
        vigencia_inicio: '',
        escopo: 'geral',
        grade_semanal: grade,
        carga_semanal_minutos: 2640,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toContain('A vigência inicial é obrigatória.');
    });

    it('13. Deve reprovar escopo empresa sem empresa_id selecionada', () => {
      const grade = criarGradeTemplate44h();
      const resultado = validarFormularioJornada({
        nome: 'Jornada Empresa',
        vigencia_inicio: '2026-01-01',
        escopo: 'empresa',
        empresa_id: '',
        grade_semanal: grade,
        carga_semanal_minutos: 2640,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toContain('Selecione uma empresa válida para a jornada de escopo específico.');
    });

    it('14. Deve reprovar jornada com carga semanal zero', () => {
      const grade = criarGradeVazia();
      const resultado = validarFormularioJornada({
        nome: 'Jornada Sem Horas',
        vigencia_inicio: '2026-01-01',
        escopo: 'geral',
        grade_semanal: grade,
        carga_semanal_minutos: 0,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toContain('A jornada deve possuir pelo menos um dia de trabalho com carga horária maior que zero.');
    });

    it('15. Deve reprovar quando soma da grade divergir da carga semanal informada', () => {
      const grade = criarGradeTemplate44h(); // soma 2640
      const resultado = validarFormularioJornada({
        nome: 'Jornada Divergente',
        vigencia_inicio: '2026-01-01',
        escopo: 'geral',
        grade_semanal: grade,
        carga_semanal_minutos: 2400, // divergiu propositalmente
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.erros.some((e) => e.includes('Inconsistência de carga semanal'))).toBe(true);
    });
  });
});
