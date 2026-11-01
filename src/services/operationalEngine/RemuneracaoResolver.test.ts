import { describe, it, expect } from "vitest";
import {
  RemuneracaoResolver,
  calcularDivisorMensalFromCargaSemanal,
  REFERENCIA_GERAL_CLT_PADRAO,
} from "./RemuneracaoResolver";

describe("FIX CP04.5 — RemuneracaoResolver: Fonte Única de Remuneração CLT", () => {
  // ---------------------------------------------------------------------------
  // 1. CLT MENSAL COM JORNADA CONFIGURADA 44H
  // ---------------------------------------------------------------------------
  it("1. CLT mensal R$ 1.518 + jornada configurada 44h: divisor 220, hora 6.90, origem JORNADA_CONFIGURADA", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        tipo_contrato: "mensal",
        regime_trabalho: "CLT",
        tipo_colaborador: "clt",
        valor_base: 1518,
        salario_base: null,
      },
      cargaSemanalMinutos: 2640, // 44h
      isJornadaConfigurada: true,
    });

    expect(res.modeloAplicado).toBe("CLT_MENSAL");
    expect(res.salarioMensal).toBe(1518);
    expect(res.divisorMensal).toBe(220);
    expect(res.valorHora).toBe(6.90);
    expect(res.valorDiaBase).toBe(50.60); // 1518 / 30
    expect(res.origemValor).toBe("VALOR_BASE");
    expect(res.origemDivisor).toBe("JORNADA_CONFIGURADA");
    expect(res.cargaSemanalMinutosUtilizada).toBe(2640);
    expect(res.referenciaGeralUtilizada).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. CLT MENSAL COM JORNADA CONFIGURADA 40H
  // ---------------------------------------------------------------------------
  it("2. CLT mensal R$ 1.518 + jornada configurada 40h: divisor 200, hora 7.59, origem JORNADA_CONFIGURADA", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        tipo_contrato: "mensal",
        regime_trabalho: "CLT",
        tipo_colaborador: "clt",
        valor_base: 1518,
      },
      cargaSemanalMinutos: 2400, // 40h
      isJornadaConfigurada: true,
    });

    expect(res.divisorMensal).toBe(200);
    expect(res.valorHora).toBe(7.59); // 1518 / 200 = 7.59
    expect(res.valorDiaBase).toBe(50.60);
    expect(res.origemDivisor).toBe("JORNADA_CONFIGURADA");
    expect(res.cargaSemanalMinutosUtilizada).toBe(2400);
  });

  // ---------------------------------------------------------------------------
  // 3. CLT MENSAL COM JORNADA CONFIGURADA 36H
  // ---------------------------------------------------------------------------
  it("3. CLT mensal R$ 1.518 + jornada configurada 36h: divisor 180, hora 8.4333, origem JORNADA_CONFIGURADA", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        tipo_contrato: "mensal",
        regime_trabalho: "CLT",
        tipo_colaborador: "clt",
        valor_base: 1518,
      },
      cargaSemanalMinutos: 2160, // 36h
      isJornadaConfigurada: true,
    });

    expect(res.divisorMensal).toBe(180);
    expect(res.valorHora).toBe(8.4333); // 1518 / 180 = 8.433333...
    expect(res.valorDiaBase).toBe(50.60);
    expect(res.origemDivisor).toBe("JORNADA_CONFIGURADA");
    expect(res.cargaSemanalMinutosUtilizada).toBe(2160);
  });

  // ---------------------------------------------------------------------------
  // 4. CLT MENSAL SEM JORNADA CONFIGURADA: REFERÊNCIA GERAL CLT
  // ---------------------------------------------------------------------------
  it("4. CLT mensal R$ 1.518 sem jornada configurada: referência geral 44h/220, hora 6.90, origem REFERENCIA_GERAL_CLT", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        tipo_contrato: "mensal",
        regime_trabalho: "CLT",
        tipo_colaborador: "clt",
        valor_base: 1518,
      },
      cargaSemanalMinutos: null,
      isJornadaConfigurada: false,
    });

    expect(res.salarioMensal).toBe(1518);
    expect(res.divisorMensal).toBe(220);
    expect(res.valorHora).toBe(6.90);
    expect(res.valorDiaBase).toBe(50.60);
    expect(res.origemDivisor).toBe("REFERENCIA_GERAL_CLT");
    expect(res.cargaSemanalMinutosUtilizada).toBe(2640);
    expect(res.referenciaGeralUtilizada).toEqual(REFERENCIA_GERAL_CLT_PADRAO);
  });

  // ---------------------------------------------------------------------------
  // 5. PRECEDÊNCIA: SALARIO_BASE PREVALECE SOBRE VALOR_BASE
  // ---------------------------------------------------------------------------
  it("5. salario_base prevalece sobre valor_base quando ambos existem", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        salario_base: 2200,
        valor_base: 1518,
      },
      cargaSemanalMinutos: 2640,
      isJornadaConfigurada: true,
    });

    expect(res.salarioMensal).toBe(2200);
    expect(res.origemValor).toBe("SALARIO_BASE");
    expect(res.valorHora).toBe(10.00); // 2200 / 220
    expect(res.valorDiaBase).toBe(73.33); // 2200 / 30
  });

  // ---------------------------------------------------------------------------
  // 6. VALOR_BASE COMO FALLBACK DE SALÁRIO MENSAL
  // ---------------------------------------------------------------------------
  it("6. valor_base atua legitimamente como fallback de salário mensal quando salario_base é null/0", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        salario_base: null,
        valor_base: 1518,
      },
    });

    expect(res.salarioMensal).toBe(1518);
    expect(res.origemValor).toBe("VALOR_BASE");
    expect(res.valorHora).toBe(6.90);
  });

  // ---------------------------------------------------------------------------
  // 7. DIÁRIA NÃO USA DIVISOR CLT
  // ---------------------------------------------------------------------------
  it("7. DIARIA: não usa divisor CLT, preserva diária e calcula hora por jornada diária", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "DIÁRIA",
        tipo_colaborador: "DIARISTA",
        valor_diaria: 160,
        valor_base: 160,
      },
      minutosJornadaDia: 480, // 8h
    });

    expect(res.modeloAplicado).toBe("DIARIA");
    expect(res.salarioMensal).toBe(0);
    expect(res.divisorMensal).toBe(0);
    expect(res.valorDiaBase).toBe(160.00);
    expect(res.valorHora).toBe(20.00); // 160 / 8
    expect(res.origemValor).toBe("VALOR_DIARIA_DIRETO");
    expect(res.origemDivisor).toBe("NAO_APLICAVEL");
  });

  // ---------------------------------------------------------------------------
  // 8. HORISTA NÃO USA DIVISOR CLT
  // ---------------------------------------------------------------------------
  it("8. HORISTA: não usa divisor CLT, preserva valor_hora e projeta dia por jornada diária", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "HORISTA",
        tipo_contrato: "HORA",
        valor_hora: 25,
      },
      minutosJornadaDia: 480, // 8h
    });

    expect(res.modeloAplicado).toBe("HORISTA");
    expect(res.salarioMensal).toBe(0);
    expect(res.divisorMensal).toBe(0);
    expect(res.valorHora).toBe(25.00);
    expect(res.valorDiaBase).toBe(200.00); // 25 * 8
    expect(res.origemValor).toBe("VALOR_HORA_DIRETO");
    expect(res.origemDivisor).toBe("NAO_APLICAVEL");
  });

  // ---------------------------------------------------------------------------
  // 9. PRODUÇÃO NÃO USA DIVISOR CLT
  // ---------------------------------------------------------------------------
  it("9. PRODUCAO: não reinterpreta valor_base como salário mensal nem aplica divisor 220", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "PRODUÇÃO",
        tipo_contrato: "OPERAÇÃO",
        tipo_colaborador: "PRODUÇÃO",
        valor_base: 120,
      },
      minutosJornadaDia: 480, // 8h
    });

    expect(res.modeloAplicado).toBe("PRODUCAO");
    expect(res.salarioMensal).toBe(0);
    expect(res.divisorMensal).toBe(0);
    expect(res.valorDiaBase).toBe(120.00);
    expect(res.valorHora).toBe(15.00); // 120 / 8
    expect(res.origemValor).toBe("VALOR_BASE");
    expect(res.origemDivisor).toBe("NAO_APLICAVEL");
  });

  // ---------------------------------------------------------------------------
  // 10. INTERMITENTE NÃO USA DIVISOR CLT
  // ---------------------------------------------------------------------------
  it("10. INTERMITENTE: não aplica divisor mensal CLT nem calcula salário mensal", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        tipo_colaborador: "INTERMITENTE",
        tipo_contrato: "INTERMITENTE",
        valor_hora: 30,
      },
      minutosJornadaDia: 480,
    });

    expect(res.modeloAplicado).toBe("INTERMITENTE");
    expect(res.salarioMensal).toBe(0);
    expect(res.divisorMensal).toBe(0);
    expect(res.valorHora).toBe(30.00);
    expect(res.valorDiaBase).toBe(240.00);
    expect(res.origemDivisor).toBe("NAO_APLICAVEL");
  });

  // ---------------------------------------------------------------------------
  // 11 & 12. CENÁRIO REAL DE PRODUÇÃO: EXTRATO E V4 NÃO DIVIDEM POR 8
  // ---------------------------------------------------------------------------
  it("11/12. Caso Real Produção: CLT com valor_base=1518 e salario_base=null resulta em 6.90/h (NÃO 189.75/h)", () => {
    // Esse é o colaborador real presente nos 67 registros do banco
    const colaboradorProducaoReal = {
      id: "colab-real-001",
      nome: "Milton Corrêa da Costa",
      tipo_colaborador: "clt",
      regime_trabalho: "CLT",
      modelo_calculo: "CLT_MENSAL",
      tipo_contrato: "mensal",
      valor_base: 1518,
      salario_base: null,
      valor_hora: null,
      valor_diaria: null,
    };

    const res = RemuneracaoResolver.resolve({
      colaborador: colaboradorProducaoReal,
    });

    // COMPROVAÇÃO: O erro antigo dividia 1518 / 8 = 189.75
    expect(res.valorHora).not.toBe(189.75);
    expect(res.valorHora).toBe(6.90);
    expect(res.salarioMensal).toBe(1518);
    expect(res.divisorMensal).toBe(220);
    expect(res.origemDivisor).toBe("REFERENCIA_GERAL_CLT");
  });

  // ---------------------------------------------------------------------------
  // 13. AUSÊNCIA DE BASE REMUNERATÓRIA TRATADA EXPLICITAMENTE
  // ---------------------------------------------------------------------------
  it("13. Ausência total de base remuneratória: retorna SEM_BASE sem crash nem NaN", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        salario_base: null,
        valor_base: null,
        valor_hora: null,
        valor_diaria: null,
      },
    });

    expect(res.modeloAplicado).toBe("CLT_MENSAL");
    expect(res.origemValor).toBe("SEM_BASE");
    expect(res.salarioMensal).toBe(0);
    expect(res.valorHora).toBe(0);
    expect(res.valorDiaBase).toBe(0);
    expect(isNaN(res.valorHora)).toBe(false);
    expect(isNaN(res.valorDiaBase)).toBe(false);
  });

  it("13b. Colaborador null ou undefined tratado de forma resiliente", () => {
    const resNull = RemuneracaoResolver.resolve({ colaborador: null });
    expect(resNull.modeloAplicado).toBe("SEM_BASE");
    expect(resNull.valorHora).toBe(0);

    const resUndefined = RemuneracaoResolver.resolve({ colaborador: undefined });
    expect(resUndefined.modeloAplicado).toBe("SEM_BASE");
    expect(resUndefined.valorHora).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 14. REMUNERACAORESOLVER NÃO DECIDE JORNADA OU CALENDÁRIO
  // ---------------------------------------------------------------------------
  it("14. RemuneracaoResolver é puro: responsabilidade estrita sobre moeda/divisor, zero calendário", () => {
    const res = RemuneracaoResolver.resolve({
      colaborador: {
        modelo_calculo: "CLT_MENSAL",
        valor_base: 1518,
      },
    });

    // Garante que o retorno contém apenas informações financeiras/remuneratórias
    const keys = Object.keys(res);
    expect(keys).toContain("salarioMensal");
    expect(keys).toContain("divisorMensal");
    expect(keys).toContain("valorHora");
    expect(keys).toContain("valorDiaBase");
    expect(keys).toContain("modeloAplicado");
    expect(keys).toContain("origemValor");
    expect(keys).toContain("origemDivisor");

    // NÃO deve conter decisões operacionais de calendário
    expect(keys).not.toContain("trabalhavel");
    expect(keys).not.toContain("feriado");
    expect(keys).not.toContain("isDomingo");
    expect(keys).not.toContain("minutosTrabalhados");
  });

  // ---------------------------------------------------------------------------
  // 15. TESTE DA FUNÇÃO DE DERIVAÇÃO DE DIVISOR
  // ---------------------------------------------------------------------------
  it("15. Derivação matemática exata de divisor por carga semanal", () => {
    expect(calcularDivisorMensalFromCargaSemanal(2640)).toBe(220); // 44h * 5
    expect(calcularDivisorMensalFromCargaSemanal(2400)).toBe(200); // 40h * 5
    expect(calcularDivisorMensalFromCargaSemanal(2160)).toBe(180); // 36h * 5
    expect(calcularDivisorMensalFromCargaSemanal(1800)).toBe(150); // 30h * 5
    expect(calcularDivisorMensalFromCargaSemanal(1440)).toBe(120); // 24h * 5
    expect(calcularDivisorMensalFromCargaSemanal(0)).toBe(0);
    expect(calcularDivisorMensalFromCargaSemanal(-100)).toBe(0);
  });
});
