import { describe, it, expect, vi } from 'vitest';
import {
  resolveRemuneracaoColaborador,
  calculateCompensation
} from './rhProcessing.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({}) }),
    }),
  }
}));

describe('FIX CP03.2 — Cálculo Monetário do CLT Mensal e Regressão de Regimes', () => {
  describe('1. CASO CLT MENSAL (valor_base = 1518, modelo_calculo = CLT_MENSAL, tipo_contrato = mensal)', () => {
    const cltColab = {
      id: 'test-clt-1',
      nome: 'Colaborador CLT Teste',
      valor_base: 1518,
      salario_base: null,
      valor_hora: null,
      valor_diaria: null,
      modelo_calculo: 'CLT_MENSAL',
      tipo_contrato: 'mensal',
      tipo_colaborador: 'clt'
    };

    it('deve derivar valor-hora usando divisor legal 220 (1518 / 220 = R$ 6,90)', () => {
      const rem = resolveRemuneracaoColaborador(cltColab, 8);
      expect(rem.modeloAplicado).toBe('CLT_MENSAL');
      expect(rem.valorHora).toBeCloseTo(6.90, 2);
      expect(rem.salarioMensal).toBe(1518);
    });

    it('deve calcular valor-dia base para falta conforme art. 64 da CLT (1518 / 30 = R$ 50,60)', () => {
      const rem = resolveRemuneracaoColaborador(cltColab, 8);
      expect(rem.valorDiaBase).toBeCloseTo(50.60, 2);
    });

    it('deve calcular 1 hora extra a 50% exatamente como R$ 10,35 (6.90 * 1.5)', () => {
      const pontoExtra: any = {
        id: 'ponto-extra',
        data: '2026-09-01',
        entrada: '08:00',
        saida_almoco: '12:00',
        retorno_almoco: '13:00',
        saida: '18:00', // 9h trabalhadas
        status: 'Normal'
      };
      const res = calculateCompensation({
        ponto: pontoExtra,
        regra: { id: 'r1', carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
        colaborador: cltColab
      });

      expect(res.minutosExtra).toBe(60);
      expect(res.valorHoraBase).toBeCloseTo(6.90, 2);
      expect(res.valorExtras).toBeCloseTo(10.35, 2);
      expect(res.valorAtraso).toBe(0);
      expect(res.valorDia).toBeCloseTo(60.95, 2); // 50.60 base + 10.35 extra
    });

    it('deve calcular 1 hora de atraso exatamente como R$ 6,90', () => {
      const pontoAtraso: any = {
        id: 'ponto-atraso',
        data: '2026-09-02',
        entrada: '09:00',
        saida_almoco: '12:00',
        retorno_almoco: '13:00',
        saida: '17:00', // 7h trabalhadas
        status: 'Normal'
      };
      const res = calculateCompensation({
        ponto: pontoAtraso,
        regra: { id: 'r1', carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
        colaborador: cltColab
      });

      expect(res.atrasoMinutes).toBe(60);
      expect(res.valorHoraBase).toBeCloseTo(6.90, 2);
      expect(res.valorAtraso).toBeCloseTo(6.90, 2);
      expect(res.valorExtras).toBe(0);
      expect(res.valorDia).toBeCloseTo(43.70, 2); // 50.60 base - 6.90 atraso
    });

    it('deve calcular falta integral deduzindo R$ 50,60 (sem duplicar em atraso)', () => {
      const pontoFalta: any = {
        id: 'ponto-falta',
        data: '2026-09-03',
        entrada: null,
        saida_almoco: null,
        retorno_almoco: null,
        saida: null,
        status: 'Falta'
      };
      const res = calculateCompensation({
        ponto: pontoFalta,
        regra: { id: 'r1', carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
        colaborador: cltColab
      });

      expect(res.minutosDebito).toBe(480);
      expect(res.atrasoMinutes).toBe(0); // Falta não é atraso
      expect(res.valorAtraso).toBe(0);
      expect(res.valorFalta).toBeCloseTo(50.60, 2);
      expect(res.valorDia).toBe(0);
    });
  });

  describe('2. CASOS DE REGRESSÃO E SEGREGAÇÃO DE REGIMES', () => {
    it('DIARIA: continua interpretando valor_base como valor da diária', () => {
      const diaristaColab = {
        id: 'test-diarista',
        nome: 'Diarista Teste',
        valor_base: 140,
        valor_diaria: 140,
        modelo_calculo: 'Diária',
        tipo_contrato: 'diaria',
        tipo_colaborador: 'DIARISTA'
      };
      const rem = resolveRemuneracaoColaborador(diaristaColab, 8);
      expect(rem.modeloAplicado).toBe('DIARIA');
      expect(rem.valorDiaBase).toBe(140);
      expect(rem.valorHora).toBeCloseTo(17.50, 2); // 140 / 8

      const pontoExtra: any = {
        id: 'p-d-extra',
        data: '2026-09-01',
        entrada: '08:00',
        saida_almoco: '12:00',
        retorno_almoco: '13:00',
        saida: '18:00',
        status: 'Normal'
      };
      const res = calculateCompensation({
        ponto: pontoExtra,
        regra: { id: 'r1', carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
        colaborador: diaristaColab
      });
      expect(res.valorExtras).toBeCloseTo(26.25, 2); // 1.0 * 17.50 * 1.5
      expect(res.valorDia).toBeCloseTo(166.25, 2); // 140 + 26.25
    });

    it('HORISTA: continua interpretando valor_base como valor da hora', () => {
      const horistaColab = {
        id: 'test-horista',
        nome: 'Horista Teste',
        valor_base: 25,
        valor_hora: 25,
        modelo_calculo: 'Horista',
        tipo_contrato: 'Hora',
        tipo_colaborador: 'CLT'
      };
      const rem = resolveRemuneracaoColaborador(horistaColab, 8);
      expect(rem.modeloAplicado).toBe('HORISTA');
      expect(rem.valorHora).toBe(25);
      expect(rem.valorDiaBase).toBe(200); // 25 * 8

      const pontoExtra: any = {
        id: 'p-h-extra',
        data: '2026-09-01',
        entrada: '08:00',
        saida_almoco: '12:00',
        retorno_almoco: '13:00',
        saida: '18:00',
        status: 'Normal'
      };
      const res = calculateCompensation({
        ponto: pontoExtra,
        regra: { id: 'r1', carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
        colaborador: horistaColab
      });
      expect(res.valorExtras).toBeCloseTo(37.50, 2); // 1.0 * 25 * 1.5
      expect(res.valorDia).toBeCloseTo(237.50, 2); // 200 + 37.50
    });

    it('PRODUCAO: preserva semântica própria', () => {
      const producaoColab = {
        id: 'test-prod',
        nome: 'Producao Teste',
        valor_base: 120,
        modelo_calculo: 'Produção',
        tipo_contrato: 'Operação',
        tipo_colaborador: 'PRODUCAO'
      };
      const rem = resolveRemuneracaoColaborador(producaoColab, 8);
      expect(rem.modeloAplicado).toBe('PRODUCAO');
      expect(rem.valorDiaBase).toBe(120);
      expect(rem.valorHora).toBeCloseTo(15.00, 2); // 120 / 8
    });

    it('INTERMITENTE: não é impactado', () => {
      const intermitenteColab = {
        id: 'test-interm',
        nome: 'Intermitente Teste',
        valor_base: 0,
        tipo_contrato: 'INTERMITENTE',
        tipo_colaborador: 'INTERMITENTE'
      };
      const rem = resolveRemuneracaoColaborador(intermitenteColab, 8);
      expect(rem.valorHora).toBe(0);
      expect(rem.valorDiaBase).toBe(0);
    });
  });
});
