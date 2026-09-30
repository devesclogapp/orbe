import { describe, it, expect, vi } from 'vitest';
import {
  calculateCompensation,
  calculateDataVencimento,
} from '../rhProcessing.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({}) }),
    }),
  },
}));

describe('FIX CP05.3 — Segregação Banco de Horas × HE a Pagar + Vencimento D+180', () => {
  const colabCLT = {
    id: 'colab-clt-cp053',
    nome: 'Colaborador Homologação CP05.3',
    valor_base: 1518, // 1518 / 220 = R$ 6,90 / hora
    salario_base: null,
    valor_hora: null,
    valor_diaria: null,
    modelo_calculo: 'CLT_MENSAL',
    tipo_contrato: 'mensal',
    tipo_colaborador: 'CLT',
  };

  const regraPadrao120m: any = {
    id: 'regra-bh-120',
    bh_ativo: true,
    limite_diario_banco: 120, // 120 minutos de teto para crédito em banco
    tolerancia_hora_extra: 0,
    tolerancia_atraso: 0,
    prazo_compensacao_dias: 180,
    adicional_hora_extra_percentual: 50,
  };

  // Helper para simular jornada prevista de 480m (8h) e minutos trabalhados
  const buildPonto = (minutosTrabalhados: number) => {
    const horasTrabalho = Math.floor(minutosTrabalhados / 60);
    const minsRestantes = minutosTrabalhados % 60;
    const entradaMin = 8 * 60; // 08:00
    const saidaAlmocoMin = 12 * 60; // 12:00 (4h)
    const retornoAlmocoMin = 13 * 60; // 13:00
    const segundoPeriodoMin = minutosTrabalhados - 240;
    const saidaMin = retornoAlmocoMin + segundoPeriodoMin;

    const formatHour = (totalMinutes: number) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
      id: `ponto-${minutosTrabalhados}`,
      data: '2026-09-01',
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: formatHour(saidaMin),
      status: 'Normal',
    };
  };

  // =========================================================================
  // 1. CENÁRIOS POSITIVOS COM LIMITE = 120m
  // =========================================================================
  describe('1. Cenários Positivos (Segregação Banco × HE a Pagar)', () => {
    it('+0 min: saldo 0, nada vai para banco nem folha', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480), // 480 trabalhado vs 480 previsto -> 0
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(0);
      expect(res.minutosExcedentePagar).toBe(0);
      expect(res.minutosExtra).toBe(0);
      expect(res.saldoDia).toBe(0);
      expect(res.valorExtras).toBe(0);
    });

    it('+4 min com tolerância HE 5: dentro da tolerância, nada vai para banco nem folha', () => {
      const regraTol5 = { ...regraPadrao120m, tolerancia_hora_extra: 5 };
      const res = calculateCompensation({
        ponto: buildPonto(484), // 484 vs 480 -> +4
        regra: regraTol5,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(0);
      expect(res.minutosExcedentePagar).toBe(0);
      expect(res.minutosExtra).toBe(0);
      expect(res.saldoDia).toBe(0);
      expect(res.valorExtras).toBe(0);
    });

    it('+6 min com tolerância HE 5: ultrapassa tolerância, entra no banco', () => {
      const regraTol5 = { ...regraPadrao120m, tolerancia_hora_extra: 5 };
      const res = calculateCompensation({
        ponto: buildPonto(486), // 486 vs 480 -> +6
        regra: regraTol5,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(6);
      expect(res.minutosExcedentePagar).toBe(0);
      expect(res.minutosExtra).toBe(0);
      expect(res.saldoDia).toBe(6);
      expect(res.valorExtras).toBe(0);
    });

    it('+105 min com limite 120: BH +105 / pagar 0', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 105), // 585 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(105);
      expect(res.minutosExcedentePagar).toBe(0);
      expect(res.minutosExtra).toBe(0);
      expect(res.saldoDia).toBe(105);
      expect(res.valorExtras).toBe(0);
    });

    it('+120 min com limite 120: BH +120 / pagar 0', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 120), // 600 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(120);
      expect(res.minutosExcedentePagar).toBe(0);
      expect(res.minutosExtra).toBe(0);
      expect(res.saldoDia).toBe(120);
      expect(res.valorExtras).toBe(0);
    });

    it('+121 min com limite 120: BH +120 / pagar 1', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 121), // 601 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(120);
      expect(res.minutosExcedentePagar).toBe(1);
      expect(res.minutosExtra).toBe(1);
      expect(res.saldoDia).toBe(120);
      expect(res.valorExtras).toBeGreaterThan(0);
    });

    it('+150 min com limite 120: BH +120 / pagar 30 (REGRA HISTÓRICA)', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 150), // 630 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(120);
      expect(res.minutosExcedentePagar).toBe(30);
      expect(res.minutosExtra).toBe(30);
      expect(res.saldoDia).toBe(120);
      // 30 min = 0.5h * R$ 6.90 * 1.5 = R$ 5,175 -> R$ 5.18
      expect(res.valorExtras).toBeCloseTo(5.18, 2);
    });

    it('+180 min com limite 120: BH +120 / pagar 60 (REGRA HISTÓRICA)', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 180), // 660 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosBanco).toBe(120);
      expect(res.minutosExcedentePagar).toBe(60);
      expect(res.minutosExtra).toBe(60);
      expect(res.saldoDia).toBe(120);
      // 60 min = 1h * R$ 6.90 * 1.5 = R$ 10,35
      expect(res.valorExtras).toBeCloseTo(10.35, 2);
    });
  });

  // =========================================================================
  // 2. CENÁRIOS NEGATIVOS (DÉBITO NÃO É TRUNCADO PELO LIMITE)
  // =========================================================================
  describe('2. Cenários Negativos (Débitos Preservados e Não Truncados)', () => {
    it('-4 min com tolerância atraso 5: dentro da tolerância, débito 0', () => {
      const regraTol5 = { ...regraPadrao120m, tolerancia_atraso: 5 };
      const res = calculateCompensation({
        ponto: buildPonto(480 - 4), // 476 trabalhado
        regra: regraTol5,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosDebito).toBe(0);
      expect(res.saldoDia).toBe(0);
    });

    it('-6 min com tolerância atraso 5: ultrapassa tolerância, debita 6', () => {
      const regraTol5 = { ...regraPadrao120m, tolerancia_atraso: 5 };
      const res = calculateCompensation({
        ponto: buildPonto(480 - 6), // 474 trabalhado
        regra: regraTol5,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosDebito).toBe(6);
      expect(res.saldoDia).toBe(-6);
    });

    it('-105 min: debita 105 integralmente no banco', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 - 105), // 375 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosDebito).toBe(105);
      expect(res.saldoDia).toBe(-105);
      expect(res.minutosBanco).toBe(0);
      expect(res.minutosExcedentePagar).toBe(0);
    });

    it('-120 min: debita 120 integralmente no banco', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 - 120), // 360 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosDebito).toBe(120);
      expect(res.saldoDia).toBe(-120);
      expect(res.minutosBanco).toBe(0);
      expect(res.minutosExcedentePagar).toBe(0);
    });

    it('-150 min: debita 150 integralmente (limite de 120 NÃO trunca débito)', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 - 150), // 330 trabalhado
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      // CONFIRMAÇÃO: Limite de 120 é exclusivo de crédito positivo. Débito é integral (-150m)
      expect(res.minutosDebito).toBe(150);
      expect(res.saldoDia).toBe(-150);
      expect(res.minutosBanco).toBe(0);
      expect(res.minutosExcedentePagar).toBe(0);
    });
  });

  // =========================================================================
  // 3. ADICIONAL DE HORA EXTRA (50% vs 100%)
  // =========================================================================
  describe('3. Adicional de Hora Extra (Valor Monetário vs Minutos Físicos)', () => {
    it('HE pagar 30 min com adicional 50%: minutos permanecem 30, multiplicador 1.5', () => {
      const regra50 = { ...regraPadrao120m, adicional_hora_extra_percentual: 50 };
      const res = calculateCompensation({
        ponto: buildPonto(480 + 150), // +150 -> 120 BH / 30 pagar
        regra: regra50,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosExcedentePagar).toBe(30);
      expect(res.multiplicadorExtra).toBe(1.5);
      // 0.5h * 6.90 * 1.5 = 5.175
      expect(res.valorExtras).toBeCloseTo(5.18, 2);
    });

    it('HE pagar 30 min com adicional 100%: minutos permanecem 30, multiplicador 2.0', () => {
      const regra100 = { ...regraPadrao120m, adicional_hora_extra_percentual: 100 };
      const res = calculateCompensation({
        ponto: buildPonto(480 + 150), // +150 -> 120 BH / 30 pagar
        regra: regra100,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      expect(res.minutosExcedentePagar).toBe(30); // Minutos físicos NÃO são multiplicados!
      expect(res.multiplicadorExtra).toBe(2.0);
      // 0.5h * 6.90 * 2.0 = 6.90
      expect(res.valorExtras).toBeCloseTo(6.90, 2);
    });
  });

  // =========================================================================
  // 4. VENCIMENTO D+180 (SOMA CIVIL DA DATA DO PONTO)
  // =========================================================================
  describe('4. Cálculo de Vencimento D+180 (Civil a partir da Data do Ponto)', () => {
    const regra180Dias: any = {
      prazo_compensacao_dias: 180,
    };

    it('15/08/2026 + 180 dias = 2027-02-11 (não usa fim do trimestre)', () => {
      const venc = calculateDataVencimento('2026-08-15', regra180Dias);
      expect(venc).toBe('2027-02-11');
    });

    it('30/09/2026 + 180 dias = 2027-03-29', () => {
      const venc = calculateDataVencimento('2026-09-30', regra180Dias);
      expect(venc).toBe('2027-03-29');
    });

    it('31/12/2026 + 180 dias = 2027-06-29 (virada de ano correta)', () => {
      const venc = calculateDataVencimento('2026-12-31', regra180Dias);
      expect(venc).toBe('2027-06-29');
    });

    it('prazo_compensacao_dias não configurado retorna null sem inventar prazo', () => {
      const regraSemPrazo: any = { prazo_compensacao_dias: null };
      expect(calculateDataVencimento('2026-08-15', regraSemPrazo)).toBeNull();
      expect(calculateDataVencimento('2026-08-15', null)).toBeNull();
    });
  });

  // =========================================================================
  // 5. PROVA DE AUSÊNCIA DE DUPLICIDADE FINANCEIRA
  // =========================================================================
  describe('5. Auditoria de Segregação e Ausência de Duplicidade Financeira', () => {
    it('+150 produz estritamente BANCO = 120 e HE PAGÁVEL = 30 sem dupla contagem', () => {
      const res = calculateCompensation({
        ponto: buildPonto(480 + 150),
        regra: regraPadrao120m,
        colaborador: colabCLT,
        minutosPrevistosJornada: 480,
      });

      // Parcela que vai para banco_horas_eventos
      const parcelaBancoEventos = res.saldoDia;
      expect(parcelaBancoEventos).toBe(120);

      // Parcela que vai para registros_ponto.minutos_extra e fechamento_mensal.horas_extras
      const parcelaFolhaPagar = res.minutosExtra;
      expect(parcelaFolhaPagar).toBe(30);

      // Prova matemática: A soma das partes segregadas é exatamente o saldo bruto (+150)
      expect(parcelaBancoEventos + parcelaFolhaPagar).toBe(150);

      // Prova de ausência de duplicidade:
      // O banco_horas_eventos NÃO recebe os 30 min (nunca 150)
      expect(parcelaBancoEventos).not.toBe(150);
      // A folha NÃO recebe os 120 min do banco (nunca 150)
      expect(parcelaFolhaPagar).not.toBe(150);
    });
  });
});
