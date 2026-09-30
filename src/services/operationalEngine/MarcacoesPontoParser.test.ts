import { describe, it, expect } from "vitest";
import {
  avaliarMarcacoesPonto,
  parseMarcacoesPonto,
  parseTimeToMinutes,
} from "./MarcacoesPontoParser";
import {
  avaliarPontoGates,
  calculateCompensation,
} from "../rhProcessing.service";
import { GradeSemanal, JornadaTrabalho } from "@/types/jornada.types";

function mockGrade44h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 528, tipo: "TRABALHO" },
    ter: { trabalhavel: true, minutos_previstos: 528, tipo: "TRABALHO" },
    qua: { trabalhavel: true, minutos_previstos: 528, tipo: "TRABALHO" },
    qui: { trabalhavel: true, minutos_previstos: 528, tipo: "TRABALHO" },
    sex: { trabalhavel: true, minutos_previstos: 528, tipo: "TRABALHO" },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: "COMPENSADO" },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: "DSR" },
  };
}

function mockJornada(parciais: Partial<JornadaTrabalho>): JornadaTrabalho {
  return {
    id: parciais.id || "jornada-1",
    tenant_id: parciais.tenant_id || "tenant-test",
    empresa_id: parciais.empresa_id !== undefined ? parciais.empresa_id : "empresa-test",
    nome: parciais.nome || "Jornada Empresa Teste",
    descricao: null,
    tipo_escala: "SEMANAL",
    carga_semanal_minutos: 2640,
    grade_semanal: parciais.grade_semanal || mockGrade44h(),
    politica_feriado: parciais.politica_feriado || "FOLGA_DSR",
    vigencia_inicio: parciais.vigencia_inicio || "2026-01-01",
    vigencia_fim: parciais.vigencia_fim !== undefined ? parciais.vigencia_fim : null,
    padrao: parciais.padrao !== undefined ? parciais.padrao : true,
    status: parciais.status || "ativo",
  };
}

describe("FIX 04.2-D — Validação e Interpretação Segura das Marcações CLT", () => {
  const jornadaTrabalhoPadrao = {
    temJornadaConfigurada: true,
    trabalhavel: true,
    minutosPrevistos: 480,
    tipoDia: "TRABALHO",
  };

  const jornadaDsrPadrao = {
    temJornadaConfigurada: true,
    trabalhavel: false,
    minutosPrevistos: 0,
    tipoDia: "DSR",
  };

  describe("1. Funções Puras do Parser (parseTimeToMinutes)", () => {
    it("deve converter horários válidos em minutos a partir da meia-noite", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("08:03")).toBe(483);
      expect(parseTimeToMinutes("11:56")).toBe(716);
      expect(parseTimeToMinutes("14:04")).toBe(844);
      expect(parseTimeToMinutes("17:53")).toBe(1073);
      expect(parseTimeToMinutes("23:59")).toBe(1439);
    });

    it("deve aceitar formato com segundos ignorando-os na contagem de minutos", () => {
      expect(parseTimeToMinutes("08:03:00")).toBe(483);
      expect(parseTimeToMinutes("17:53:45")).toBe(1073);
    });

    it("deve retornar null para strings inválidas ou horas/minutos fora do padrão", () => {
      expect(parseTimeToMinutes("")).toBe(null);
      expect(parseTimeToMinutes("abc")).toBe(null);
      expect(parseTimeToMinutes("24:00")).toBe(null);
      expect(parseTimeToMinutes("12:60")).toBe(null);
      expect(parseTimeToMinutes("-01:00")).toBe(null);
    });
  });

  describe("2. Cenários Obrigatórios de Teste (A até J)", () => {
    // CENÁRIO A: 4 batidas válidas (08:03 / 11:56 / 14:04 / 17:53) -> 462 min (7h42) calculável
    it("CENÁRIO A — 4 batidas válidas: apura exatamente 462 minutos e calculavel = true", () => {
      const ponto = {
        entrada: "08:03",
        saida_almoco: "11:56",
        retorno_almoco: "14:04",
        saida: "17:53",
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(res.calculavel).toBe(true);
      expect(res.tipo).toBe("COMPLETA");
      expect(res.quantidadeMarcacoes).toBe(4);
      expect(res.minutosTrabalhados).toBe(462); // (11:56 - 08:03 = 233) + (17:53 - 14:04 = 229) = 462 min (7h42)
      expect(res.motivo).toBeNull();
      expect(res.marcacoesPreservadas).toHaveLength(4);
    });

    // CENÁRIO B: 3 batidas -> MARCACAO_INCOMPLETA, minutos = null, zero efeito financeiro
    it("CENÁRIO B — 3 batidas: resulta em MARCACAO_INCOMPLETA, minutos = null", () => {
      const ponto = {
        entrada: "08:03",
        saida_almoco: "11:52",
        retorno_almoco: "17:52",
        saida: null, // saída ausente
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("MARCACAO_INCOMPLETA");
      expect(res.quantidadeMarcacoes).toBe(3);
      expect(res.minutosTrabalhados).toBeNull(); // NUNCA 0!
      expect(res.motivo).toContain("Três marcações registradas");
      expect(res.marcacoesPreservadas).toHaveLength(3);
    });

    // CENÁRIO C: 1 batida -> MARCACAO_INCOMPLETA
    it("CENÁRIO C — 1 batida: resulta em MARCACAO_INCOMPLETA, minutos = null", () => {
      const ponto = {
        entrada: "08:00",
        saida_almoco: null,
        retorno_almoco: null,
        saida: null,
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("MARCACAO_INCOMPLETA");
      expect(res.quantidadeMarcacoes).toBe(1);
      expect(res.minutosTrabalhados).toBeNull();
      expect(res.motivo).toContain("Apenas uma marcação registrada");
    });

    // CENÁRIO D: 0 batidas + DSR 0 min -> válido, workedMinutes = 0, saldo = 0
    it("CENÁRIO D — 0 batidas + DSR 0 min: dia não trabalhável válido, minutos = 0", () => {
      const ponto = {
        entrada: null,
        saida_almoco: null,
        retorno_almoco: null,
        saida: null,
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaDsrPadrao,
      });

      expect(res.calculavel).toBe(true);
      expect(res.tipo).toBe("SEM_MARCACOES");
      expect(res.quantidadeMarcacoes).toBe(0);
      expect(res.minutosTrabalhados).toBe(0);
      expect(res.motivo).toBeNull();
    });

    // CENÁRIO E: 0 batidas + jornada 480 -> FALTA_PENDENTE_JUSTIFICATIVA (não calcula -480 automaticamente)
    it("CENÁRIO E — 0 batidas + dia trabalhável 480 min: FALTA_PENDENTE_JUSTIFICATIVA, não calcula saldo", () => {
      const ponto = {
        entrada: null,
        saida_almoco: null,
        retorno_almoco: null,
        saida: null,
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("FALTA_PENDENTE_JUSTIFICATIVA");
      expect(res.quantidadeMarcacoes).toBe(0);
      expect(res.minutosTrabalhados).toBeNull(); // NUNCA 0 nem -480!
      expect(res.motivo).toContain("Retido para justificativa, abono ou regularização pelo RH");
    });

    // CENÁRIO F: 4 batidas fora da ordem cronológica -> MARCACAO_INVALIDA
    it("CENÁRIO F — 4 batidas fora de ordem: resulta em MARCACAO_INVALIDA", () => {
      const ponto = {
        entrada: "08:00",
        saida_almoco: "14:00",
        retorno_almoco: "12:00", // retorno anterior à saída de almoço
        saida: "17:00",
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("MARCACAO_INVALIDA");
      expect(res.minutosTrabalhados).toBeNull();
      expect(res.motivo).toContain("Retorno do almoço anterior ou igual à saída");
    });

    // CENÁRIO G: 2 batidas sem regra explícita -> retido / incompleto
    it("CENÁRIO G — 2 batidas sem autorização explícita: resulta em MARCACAO_INCOMPLETA", () => {
      const ponto = {
        entrada: "08:00",
        saida_almoco: null,
        retorno_almoco: null,
        saida: "17:00",
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaTrabalhoPadrao,
        permiteJornadaSemIntervalo: false, // padrão
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("MARCACAO_INCOMPLETA");
      expect(res.minutosTrabalhados).toBeNull();
      expect(res.motivo).toContain("requer autorização ou regra explícita");
    });

    // CENÁRIO H: dia não trabalhável + batidas -> TRABALHO_EM_DIA_NAO_TRABALHAVEL (retido para RH)
    it("CENÁRIO H — Dia não trabalhável com batidas: TRABALHO_EM_DIA_NAO_TRABALHAVEL, sem crédito automático", () => {
      const ponto = {
        entrada: "08:00",
        saida_almoco: "12:00",
        retorno_almoco: "13:00",
        saida: "17:00",
      };

      const res = avaliarMarcacoesPonto({
        ponto,
        jornadaResolvida: jornadaDsrPadrao, // Domingo/DSR
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("TRABALHO_EM_DIA_NAO_TRABALHAVEL");
      expect(res.minutosTrabalhados).toBeNull();
      expect(res.motivo).toContain("Trabalho registrado em dia não trabalhável");
    });

    // CENÁRIO I: registro incompleto NUNCA alcança calculateCompensation (lança erro se forçado)
    it("CENÁRIO I — Registro incompleto nunca alcança calculateCompensation (lança erro explícito)", () => {
      const pontoIncompleto: any = {
        id: "ponto-incompleto",
        data: "2026-09-15",
        entrada: "08:03",
        saida_almoco: "11:52",
        retorno_almoco: "17:52",
        saida: null,
        status: "Normal",
      };

      const avaliacao = avaliarMarcacoesPonto({
        ponto: pontoIncompleto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(avaliacao.calculavel).toBe(false);

      // Ao tentar executar calculateCompensation com avaliação não calculável, lança erro de segurança
      expect(() => {
        calculateCompensation({
          ponto: pontoIncompleto,
          regra: { id: "r1", carga_horaria_diaria: 8 },
          colaborador: null,
          minutosPrevistosJornada: 480,
          avaliacaoMarcacoes: avaliacao,
        });
      }).toThrow(/calculateCompensation não pode ser invocado para marcações não calculáveis/);
    });

    // CENÁRIO J: registro completo alcança cálculo normalmente com minutos e valores exatos
    it("CENÁRIO J — Registro completo alcança cálculo normalmente e gera saldo determinístico", () => {
      const pontoCompleto: any = {
        id: "ponto-completo",
        data: "2026-09-28",
        entrada: "08:03",
        saida_almoco: "11:56",
        retorno_almoco: "14:04",
        saida: "17:53", // 462 minutos
        status: "Normal",
      };

      const avaliacao = avaliarMarcacoesPonto({
        ponto: pontoCompleto,
        jornadaResolvida: jornadaTrabalhoPadrao,
      });

      expect(avaliacao.calculavel).toBe(true);

      const calculo = calculateCompensation({
        ponto: pontoCompleto,
        regra: {
          id: "r1",
          carga_horaria_diaria: 8,
          tolerancia_atraso: 5,
          tolerancia_hora_extra: 0,
          limite_diario_banco: 480,
        },
        colaborador: {
          id: "c1",
          valor_base: 1518,
          modelo_calculo: "CLT_MENSAL",
          tipo_contrato: "mensal",
          tipo_colaborador: "CLT",
        },
        minutosPrevistosJornada: 480,
        avaliacaoMarcacoes: avaliacao,
      });

      // 462 min trabalhados vs 480 min previstos = -18 min déficit
      // Tolerância de 5 min: -18 < -5 -> minutosDebito = 18, saldoDia = -18
      expect(calculo.workedMinutes).toBe(462);
      expect(calculo.jornadaMinutes).toBe(480);
      expect(calculo.minutosDebito).toBe(18);
      expect(calculo.saldoDia).toBe(-18);
      expect(calculo.valorHoraBase).toBeCloseTo(6.90, 2);
    });
  });

  describe("3. Simulação Read-Only do Caso Jorge Bruno", () => {
    it("Simulação Jorge Completo (28/09/2026): 08:03 / 11:56 / 14:04 / 17:53 -> 7h42 (462 min)", () => {
      const pontoJorgeCompleto = {
        data: "2026-09-28",
        entrada: "08:03:00",
        saida_almoco: "11:56:00",
        retorno_almoco: "14:04:00",
        saida: "17:53:00",
      };

      const res = avaliarMarcacoesPonto({
        ponto: pontoJorgeCompleto,
        jornadaResolvida: {
          temJornadaConfigurada: true,
          trabalhavel: true,
          minutosPrevistos: 528, // 8h48 da escala 44h seg-sex
          tipoDia: "TRABALHO",
        },
      });

      expect(res.calculavel).toBe(true);
      expect(res.tipo).toBe("COMPLETA");
      expect(res.minutosTrabalhados).toBe(462);
      expect(res.quantidadeMarcacoes).toBe(4);
    });

    it("Simulação Jorge Incompleto (15/09/2026): 08:03 / 11:52 / 17:52 / null -> MARCACAO_INCOMPLETA, zero débito automático", () => {
      const pontoJorgeIncompleto = {
        data: "2026-09-15",
        entrada: "08:03:00",
        saida_almoco: "11:52:00",
        retorno_almoco: "17:52:00",
        saida: null,
      };

      const res = avaliarMarcacoesPonto({
        ponto: pontoJorgeIncompleto,
        jornadaResolvida: {
          temJornadaConfigurada: true,
          trabalhavel: true,
          minutosPrevistos: 528,
          tipoDia: "TRABALHO",
        },
      });

      expect(res.calculavel).toBe(false);
      expect(res.tipo).toBe("MARCACAO_INCOMPLETA");
      expect(res.quantidadeMarcacoes).toBe(3);
      expect(res.minutosTrabalhados).toBeNull();
      // Não produz minutos trabalhados = 0 e não autoriza débito automático
    });
  });

  describe("4. Integração E2E com avaliarPontoGates (Gate 1 -> Gate 2 -> Gate 3 -> Gate 4)", () => {
    const tenantId = "tenant-test";
    const empresaId = "empresa-test";

    const colabApto: any = {
      id: "colab-apto-1",
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: "Colaborador Apto",
      matricula: "1001",
      cpf: "12345678901",
      status: "ativo",
      cadastro_provisorio: false,
      status_cadastro: "completo",
      modelo_calculo: "CLT_MENSAL",
      tipo_contrato: "mensal",
      tipo_colaborador: "CLT",
      valor_base: 1518,
    };

    const jornadaEmpresa = mockJornada({
      tenant_id: tenantId,
      empresa_id: empresaId,
      padrao: true,
      grade_semanal: mockGrade44h(),
    });

    const regraBanco: any = {
      id: "r-banco-1",
      tenant_id: tenantId,
      empresa_id: empresaId,
      bh_ativo: true,
      status: "ativo",
      carga_horaria_diaria: 8,
    };

    it("deve bloquear no Gate 4 quando as marcações forem incompletas (3 batidas)", async () => {
      const pontoIncompleto: any = {
        id: "ponto-inc-1",
        tenant_id: tenantId,
        empresa_id: empresaId,
        colaborador_id: colabApto.id,
        data: "2026-09-15", // Terça-feira
        entrada: "08:03",
        saida_almoco: "11:52",
        retorno_almoco: "17:52",
        saida: null,
      };

      const gateRes = await avaliarPontoGates({
        tenantId,
        ponto: pontoIncompleto,
        colaborador: colabApto,
        resolvedEmpresaId: empresaId,
        jornadasRuntime: [jornadaEmpresa],
        regrasRuntime: [regraBanco],
      });

      // Passou pelos primeiros 3 gates
      expect(gateRes.passouCadastral).toBe(true);
      expect(gateRes.passouJornada).toBe(true);
      expect(gateRes.passouRegraBanco).toBe(true);

      // Bloqueado legitimamente no Gate 4
      expect(gateRes.passouConsistenciaMarcacoes).toBe(false);
      expect(gateRes.bloqueado).toBe(true);
      expect(gateRes.tipoBloqueio).toBe("marcacao_incompleta");
      expect(gateRes.avaliacaoMarcacoes?.calculavel).toBe(false);
      expect(gateRes.avaliacaoMarcacoes?.minutosTrabalhados).toBeNull();
    });

    it("deve aprovar todos os 4 Gates quando as marcações forem 4 batidas válidas", async () => {
      const pontoValido: any = {
        id: "ponto-val-1",
        tenant_id: tenantId,
        empresa_id: empresaId,
        colaborador_id: colabApto.id,
        data: "2026-09-28", // Segunda-feira
        entrada: "08:03",
        saida_almoco: "11:56",
        retorno_almoco: "14:04",
        saida: "17:53",
      };

      const gateRes = await avaliarPontoGates({
        tenantId,
        ponto: pontoValido,
        colaborador: colabApto,
        resolvedEmpresaId: empresaId,
        jornadasRuntime: [jornadaEmpresa],
        regrasRuntime: [regraBanco],
      });

      expect(gateRes.passouCadastral).toBe(true);
      expect(gateRes.passouJornada).toBe(true);
      expect(gateRes.passouRegraBanco).toBe(true);
      expect(gateRes.passouConsistenciaMarcacoes).toBe(true);
      expect(gateRes.bloqueado).toBe(false);
      expect(gateRes.tipoBloqueio).toBeNull();
      expect(gateRes.avaliacaoMarcacoes?.calculavel).toBe(true);
      expect(gateRes.avaliacaoMarcacoes?.minutosTrabalhados).toBe(462);
    });
  });
});
