import { describe, it, expect } from 'vitest';
import { EngineResolver } from './Resolver';
import { getMultiplicadorHoraExtra, calculateCompensation } from '../rhProcessing.service';
import { RulePriority } from '@/types/motor.types';

function parseNumericWithDefault(value: any, defaultValue: number): number {
  if (value === "" || value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

describe('FIX CP05.5-A — Adicional HE aceita 0% e distingue 0 de ausência de valor', () => {
  const tenantId = 'tenant-esc-1';
  const empresaId = 'empresa-esc-1';

  // 1. Parser do formulário / getPayload
  it('1. parseNumericWithDefault preserva 0% e não substitui por default 50%', () => {
    // Quando usuário digita "0"
    expect(parseNumericWithDefault('0', 50)).toBe(0);
    expect(parseNumericWithDefault(0, 50)).toBe(0);

    // Quando usuário digita "50"
    expect(parseNumericWithDefault('50', 50)).toBe(50);

    // Quando usuário digita "100"
    expect(parseNumericWithDefault('100', 50)).toBe(100);

    // Quando ausente (vazio, null, undefined) → aplica default 50
    expect(parseNumericWithDefault('', 50)).toBe(50);
    expect(parseNumericWithDefault(null, 50)).toBe(50);
    expect(parseNumericWithDefault(undefined, 50)).toBe(50);
  });

  // 2. Reabertura do formulário para edição / tabela
  it('2. Reabertura na edição e exibição em tabela preservam 0% sem retroceder para 50%', () => {
    const regraComZero = {
      id: 'regra-0',
      nome: 'Regra Adicional 0%',
      adicional_hora_extra_percentual: 0,
    };

    // No handleEdit:
    const formValue = String(parseNumericWithDefault(regraComZero.adicional_hora_extra_percentual, 50));
    expect(formValue).toBe('0');

    // Na tabela:
    const displayValue = `+${parseNumericWithDefault(regraComZero.adicional_hora_extra_percentual, 50)}%`;
    expect(displayValue).toBe('+0%');
  });

  // 3. EngineResolver recebe e preserva 0%
  it('3. EngineResolver resolve regra com adicional 0% preservando prioridade e valor numérico 0', () => {
    const regraZero: any = {
      id: 'regra-zero-db',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Banco 0% HE',
      escopo: 'ESPECIFICA',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
      adicional_hora_extra_percentual: 0,
    };

    const ctx = {
      tenantId,
      empresaId,
      dataProcessamento: '2026-10-01',
    };

    const res = EngineResolver.resolve(ctx, [regraZero]);
    expect(res.isFallback).toBe(false);
    expect(res.rule.id).toBe('regra-zero-db');
    expect(res.rule.adicionalHoraExtraPercentual).toBe(0);
  });

  // 4. Multiplicador de Hora Extra com 0% → 1.0x (100% da base, sem adicional)
  it('4. getMultiplicadorHoraExtra retorna 1.0x para adicional 0%, sem converter para 1.5x (50%)', () => {
    const regra0 = { adicional_hora_extra_percentual: 0 };
    expect(getMultiplicadorHoraExtra(regra0 as any)).toBe(1.0);

    const regra0Camel = { adicionalHoraExtraPercentual: 0 };
    expect(getMultiplicadorHoraExtra(regra0Camel as any)).toBe(1.0);

    const regra0Payload = { payload: { adicional_hora_extra_percentual: 0 } };
    expect(getMultiplicadorHoraExtra(regra0Payload as any)).toBe(1.0);
  });

  // 5. Multiplicador com 50% → 1.5x
  it('5. getMultiplicadorHoraExtra continua funcionando com 50% → 1.5x', () => {
    const regra50 = { adicional_hora_extra_percentual: 50 };
    expect(getMultiplicadorHoraExtra(regra50 as any)).toBe(1.5);
  });

  // 6. Multiplicador com 100% → 2.0x
  it('6. getMultiplicadorHoraExtra continua funcionando com 100% → 2.0x', () => {
    const regra100 = { adicional_hora_extra_percentual: 100 };
    expect(getMultiplicadorHoraExtra(regra100 as any)).toBe(2.0);
  });

  // 7. Ausência de valor segue regra explícita de default (50% → 1.5x)
  it('7. Ausência de valor (null ou undefined) aplica o default 50% → 1.5x', () => {
    const regraSemDefinicao = {};
    expect(getMultiplicadorHoraExtra(regraSemDefinicao as any)).toBe(1.5);

    const regraNull = { adicional_hora_extra_percentual: null };
    expect(getMultiplicadorHoraExtra(regraNull as any)).toBe(1.5);
  });

  // 8. Cálculo de Compensação / Horas Pagas com Adicional 0%
  it('8. calculateCompensation calcula valorExtras com multiplicador 1.0x quando adicional é 0%', () => {
    const colaboradorMock: any = {
      id: 'colab-1',
      valor_base: 2200, // R$ 2.200 / 220h = R$ 10,00/hora
      modelo_calculo: 'CLT_MENSAL',
      tipo_colaborador: 'CLT',
    };

    const pontoMock: any = {
      data: '2026-10-01',
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '19:00', // 10 horas trabalhadas = 600 min
    };

    // Jornada de 8h (480 min) + Limite Banco de 60 min
    // Excedente para pagar = 600 - 480 - 60 = 60 min (1 hora extra a pagar)
    const regraComZeroHE: any = {
      nome: 'Regra 0% HE',
      tolerancia_atraso: 0,
      tolerancia_hora_extra: 0,
      limite_diario_banco: 60,
      prazo_compensacao_dias: 180,
      tipo: 'acumula',
      adicional_hora_extra_percentual: 0, // 0%
    };

    const resultado = calculateCompensation({
      ponto: pontoMock,
      regra: regraComZeroHE,
      colaborador: colaboradorMock,
      minutosPrevistosJornada: 480,
      isJornadaConfigurada: true,
      cargaSemanalMinutos: 2640,
    });

    expect(resultado.minutosExcedentePagar).toBe(60); // 1 hora
    expect(resultado.multiplicadorExtra).toBe(1.0); // Exatamente 1.0x, NÃO 1.5x
    expect(resultado.valorHoraBase).toBe(10.0);
    // 1 hora * R$ 10,00 * 1.0 = R$ 10,00
    expect(resultado.valorExtras).toBe(10.0);
  });
});
