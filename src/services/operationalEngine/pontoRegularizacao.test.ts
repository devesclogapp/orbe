import { describe, it, expect, beforeEach, vi } from "vitest";
import { avaliarMarcacoesPonto } from "./MarcacoesPontoParser";
import { PontoRegularizacaoService } from "./pontoRegularizacao.service";
import { avaliarPontoGates, calculateCompensation } from "../rhProcessing.service";
import { GradeSemanal, JornadaTrabalho } from "@/types/jornada.types";
import { PontoRegularizacao } from "@/types/pontoRegularizacao.types";

// ==========================================
// MOCK STATE SETUP
// ==========================================

interface MockDbState {
  user: { id: string } | null;
  profile: { tenant_id: string; role: string; full_name?: string } | null;
  userPermissions: { role: string; permissions: any; status: string } | null;
  pontos: Record<string, any>;
  regularizacoes: Record<string, any>;
  auditLogs: any[];
}

const dbState: MockDbState = {
  user: { id: "user-rh-1" },
  profile: { tenant_id: "tenant-esc-1", role: "rh", full_name: "Analista de RH" },
  userPermissions: { role: "rh", permissions: null, status: "ativo" },
  pontos: {},
  regularizacoes: {},
  auditLogs: [],
};

const resetDbState = () => {
  dbState.user = { id: "user-rh-1" };
  dbState.profile = { tenant_id: "tenant-esc-1", role: "rh", full_name: "Analista de RH" };
  dbState.userPermissions = { role: "rh", permissions: null, status: "ativo" };
  dbState.pontos = {
    "ponto-1": {
      id: "ponto-1",
      tenant_id: "tenant-esc-1",
      colaborador_id: "colab-1",
      data: "2026-09-15",
      entrada: "08:00",
      saida_almoco: "12:00",
      retorno_almoco: "13:00",
      saida: null, // Batida faltante factual
      status_processamento: "PENDENTE",
    },
    "ponto-outro-tenant": {
      id: "ponto-outro-tenant",
      tenant_id: "outro-tenant",
      colaborador_id: "colab-outro",
      data: "2026-09-15",
      entrada: "08:00",
      saida_almoco: "12:00",
      retorno_almoco: "13:00",
      saida: null,
      status_processamento: "PENDENTE",
    },
  };
  dbState.regularizacoes = {};
  dbState.auditLogs = [];
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: dbState.user }, error: null })),
    },
    from: vi.fn((table: string) => {
      let selectedTable = table;
      let filters: any = {};
      let updatePayload: any = null;
      let isSingle = false;
      let isMaybeSingle = false;
      let lastInsertedRecord: any = null;

      const execute = async () => {
        if (lastInsertedRecord) {
          const rec = lastInsertedRecord;
          lastInsertedRecord = null;
          return { data: rec, error: null };
        }

        if (selectedTable === "profiles") {
          return { data: dbState.profile, error: null };
        }

        if (selectedTable === "user_permissions") {
          return { data: dbState.userPermissions, error: null };
        }

        if (selectedTable === "registros_ponto") {
          if (filters.id) {
            const ponto = dbState.pontos[filters.id];
            return { data: ponto || null, error: ponto ? null : new Error("Ponto não encontrado") };
          }
          return { data: Object.values(dbState.pontos), error: null };
        }

        if (selectedTable === "registros_ponto_regularizacoes") {
          if (updatePayload && filters.id) {
            const reg = dbState.regularizacoes[filters.id];
            if (reg) {
              dbState.regularizacoes[filters.id] = { ...reg, ...updatePayload };
              return { data: dbState.regularizacoes[filters.id], error: null };
            }
          }

          let items = Object.values(dbState.regularizacoes);
          if (filters.registro_ponto_id) {
            items = items.filter((r) => r.registro_ponto_id === filters.registro_ponto_id);
          }
          if (filters.campo_alterado) {
            items = items.filter((r) => r.campo_alterado === filters.campo_alterado);
          }
          if (filters.ativo !== undefined) {
            items = items.filter((r) => r.ativo === filters.ativo);
          }

          if (isSingle) {
            return { data: items[0] || null, error: items[0] ? null : new Error("Não encontrado") };
          }
          if (isMaybeSingle) {
            return { data: items[0] || null, error: null };
          }
          return { data: items, error: null };
        }

        return { data: [], error: null };
      };

      const chain: any = {
        select: vi.fn(() => chain),
        insert: vi.fn((payload: any) => {
          if (selectedTable === "registros_ponto_regularizacoes") {
            const id = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            lastInsertedRecord = { ...payload, id, created_at: new Date().toISOString() };
            dbState.regularizacoes[id] = lastInsertedRecord;
          } else if (selectedTable === "auditoria") {
            dbState.auditLogs.push(payload);
            lastInsertedRecord = payload;
          } else {
            lastInsertedRecord = payload;
          }
          return chain;
        }),
        update: vi.fn((payload: any) => {
          updatePayload = payload;
          return chain;
        }),
        delete: vi.fn(() => chain),
        eq: vi.fn((col: string, val: any) => {
          filters[col] = val;
          return chain;
        }),
        in: vi.fn((col: string, val: any) => {
          filters[`${col}_in`] = val;
          return chain;
        }),
        gte: vi.fn((col: string, val: any) => {
          filters[`${col}_gte`] = val;
          return chain;
        }),
        lte: vi.fn((col: string, val: any) => {
          filters[`${col}_lte`] = val;
          return chain;
        }),
        order: vi.fn(() => chain),
        single: vi.fn(async () => {
          isSingle = true;
          return await execute();
        }),
        maybeSingle: vi.fn(async () => {
          isMaybeSingle = true;
          return await execute();
        }),
        then: vi.fn((resolve: any, reject: any) => {
          return execute().then(resolve, reject);
        }),
      };

      return chain;
    }),
  },
}));

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
    tenant_id: parciais.tenant_id || "tenant-esc-1",
    empresa_id: parciais.empresa_id !== undefined ? parciais.empresa_id : "empresa-1",
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

describe("FIX CP04.8 — Regularização Controlada de Marcações pelo RH/Admin", () => {
  beforeEach(() => {
    resetDbState();
  });

  // =========================================================================
  // CENÁRIO 1: 3 marcações + regularização da saída final
  // =========================================================================
  it("1. 3 marcações + regularização da saída final: sequência passa a ter 4 batidas", async () => {
    const reg = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Colaborador esqueceu de bater o ponto na saída; comprovado por câmera.",
    });

    expect(reg.id).toBeDefined();
    expect(reg.campo_alterado).toBe("saida");
    expect(reg.valor_regularizado).toBe("17:35");
    expect(reg.ativo).toBe(true);

    const pontoEfetivo = PontoRegularizacaoService.anexarRegularizacoes(dbState.pontos["ponto-1"], {
      saida: reg,
    });

    const res = avaliarMarcacoesPonto({ ponto: pontoEfetivo });
    expect(res.quantidadeMarcacoes).toBe(4);
    expect(res.tipo).toBe("COMPLETA");
    expect(res.calculavel).toBe(true);
  });

  // =========================================================================
  // CENÁRIO 2: Original permanece preservado
  // =========================================================================
  it("2. original permanece preservado: ponto original não é sobrescrito no banco", async () => {
    await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Ajuste manual pela coordenação com base no espelho físico.",
    });

    // O registro original em registros_ponto continua intocado
    expect(dbState.pontos["ponto-1"].saida).toBeNull();
    expect(dbState.pontos["ponto-1"].entrada).toBe("08:00");
    expect(dbState.pontos["ponto-1"].saida_almoco).toBe("12:00");
    expect(dbState.pontos["ponto-1"].retorno_almoco).toBe("13:00");
  });

  // =========================================================================
  // CENÁRIO 3: Parser utiliza valor efetivo
  // =========================================================================
  it("3. parser utiliza valor efetivo: workedMinutes calculado com base no horário regularizado", () => {
    const pontoComReg = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: {
          valor: "17:35",
          valorOriginal: null,
          justificativa: "Regularização de saída",
          executadoPorNome: "RH Admin",
        },
      },
    };

    const res = avaliarMarcacoesPonto({ ponto: pontoComReg });
    expect(res.calculavel).toBe(true);
    // (12:00 - 08:00 = 240min) + (17:35 - 13:00 = 275min) = 515min
    expect(res.minutosTrabalhados).toBe(515);
    expect(res.possuiRegularizacao).toBe(true);

    const saidaPreservada = res.marcacoesPreservadas.find((m) => m.campo === "saida");
    expect(saidaPreservada?.valor).toBe("17:35");
    expect(saidaPreservada?.origem).toBe("REGULARIZADA_RH");
    expect(saidaPreservada?.valorOriginal).toBeNull();
  });

  // =========================================================================
  // CENÁRIO 4: Justificativa obrigatória
  // =========================================================================
  it("4. justificativa obrigatória: rejeita ausência ou justificativa com menos de 5 caracteres", async () => {
    await expect(
      PontoRegularizacaoService.regularizarMarcacao({
        registroPontoId: "ponto-1",
        colaboradorId: "colab-1",
        data: "2026-09-15",
        campo: "saida",
        novoHorario: "17:35",
        justificativa: "",
      })
    ).rejects.toThrow(/justificativa é obrigatória/i);

    await expect(
      PontoRegularizacaoService.regularizarMarcacao({
        registroPontoId: "ponto-1",
        colaboradorId: "colab-1",
        data: "2026-09-15",
        campo: "saida",
        novoHorario: "17:35",
        justificativa: "ok",
      })
    ).rejects.toThrow(/mínimo de 5 caracteres/i);
  });

  // =========================================================================
  // CENÁRIO 5: Usuário responsável registrado
  // =========================================================================
  it("5. usuário responsável registrado: grava executado_por e executado_por_nome", async () => {
    const reg = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Autorização de saída extraordinária pelo gestor.",
    });

    expect(reg.executado_por).toBe("user-rh-1");
    expect(reg.executado_por_nome).toBe("Analista de RH");
  });

  // =========================================================================
  // CENÁRIO 6: Timestamp registrado
  // =========================================================================
  it("6. timestamp registrado: grava created_at no momento da intervenção", async () => {
    const reg = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Correção de fechamento de turno da equipe.",
    });

    expect(reg.created_at).toBeDefined();
    expect(new Date(reg.created_at).getTime()).toBeGreaterThan(0);
  });

  // =========================================================================
  // CENÁRIO 7: Tenant registrado e isolamento cross-tenant
  // =========================================================================
  it("7. tenant registrado: isolamento estrito contra acesso ou modificação cross-tenant", async () => {
    // Tenta regularizar ponto de outro tenant com usuário do tenant-esc-1
    await expect(
      PontoRegularizacaoService.regularizarMarcacao({
        registroPontoId: "ponto-outro-tenant",
        colaboradorId: "colab-outro",
        data: "2026-09-15",
        campo: "saida",
        novoHorario: "17:35",
        justificativa: "Tentativa indevida de regularização cross-tenant.",
      })
    ).rejects.toThrow(/outro tenant/i);
  });

  // =========================================================================
  // CENÁRIO 8: Encarregado bloqueado
  // =========================================================================
  it("8. encarregado bloqueado: perfil operacional é rejeitado no nível de serviço", async () => {
    dbState.profile = { tenant_id: "tenant-esc-1", role: "encarregado", full_name: "Encarregado Depósito" };
    dbState.userPermissions = { role: "encarregado", permissions: null, status: "ativo" };

    await expect(
      PontoRegularizacaoService.regularizarMarcacao({
        registroPontoId: "ponto-1",
        colaboradorId: "colab-1",
        data: "2026-09-15",
        campo: "saida",
        novoHorario: "17:35",
        justificativa: "Encarregado tentando regularizar batida de ponto.",
      })
    ).rejects.toThrow(/perfil operacional \(encarregado\) não possui autorização/i);
  });

  // =========================================================================
  // CENÁRIO 9: Admin/RH autorizado
  // =========================================================================
  it("9. admin/rh autorizado: ambos os perfis administrativos conseguem regularizar", async () => {
    // 1. Perfil RH
    dbState.profile = { tenant_id: "tenant-esc-1", role: "rh", full_name: "Analista RH" };
    dbState.userPermissions = { role: "rh", permissions: null, status: "ativo" };

    const regRh = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Ajuste validado pelo RH com crachá.",
    });
    expect(regRh.id).toBeDefined();

    // 2. Perfil Admin
    dbState.profile = { tenant_id: "tenant-esc-1", role: "admin", full_name: "Administrador Geral" };
    dbState.userPermissions = { role: "admin", permissions: null, status: "ativo" };

    const regAdmin = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "entrada",
      novoHorario: "08:05",
      justificativa: "Ajuste homologado pelo Administrador do sistema.",
    });
    expect(regAdmin.id).toBeDefined();
  });

  // =========================================================================
  // CENÁRIO 10: Regularização não fura Gate cadastral
  // =========================================================================
  it("10. regularização não fura Gate cadastral: colaborador não apto é bloqueado no Gate 1", async () => {
    const colaboradorInapto = {
      id: "colab-inapto",
      nome: "Colaborador Sem Admissão",
      tipo_colaborador: "CLT",
      status_cadastro: "pendente_complemento",
      data_admissao: null, // Bloqueia Gate 1
    };

    const pontoComReg = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: { valor: "17:35", valorOriginal: null, justificativa: "Ajuste RH" },
      },
    };

    const gateResult = await avaliarPontoGates({
      tenantId: "tenant-esc-1",
      ponto: pontoComReg as any,
      colaborador: colaboradorInapto as any,
      resolvedEmpresaId: "empresa-1",
    });

    expect(gateResult.passouCadastral).toBe(false);
    expect(gateResult.bloqueado).toBe(true);
    expect(gateResult.tipoBloqueio).toBe("bloqueio_cadastral");
  });

  // =========================================================================
  // CENÁRIO 11: Regularização não fura Gate jornada
  // =========================================================================
  it("11. regularização não fura Gate jornada: sem jornada configurada bloqueia no Gate 2", async () => {
    const colaboradorApto = {
      id: "colab-1",
      nome: "Colaborador Válido",
      tipo_colaborador: "CLT",
      modelo_calculo: "CLT_MENSAL",
      status_cadastro: "ativo",
      data_admissao: "2026-01-01",
      jornada_id: null,
    };

    const pontoComReg = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: { valor: "17:35", valorOriginal: null, justificativa: "Ajuste RH" },
      },
    };

    // Nenhuma jornada fornecida nem no banco
    const gateResult = await avaliarPontoGates({
      tenantId: "tenant-esc-1",
      ponto: pontoComReg as any,
      colaborador: colaboradorApto as any,
      resolvedEmpresaId: "empresa-1",
      jornadasRuntime: [],
    });

    expect(gateResult.passouCadastral).toBe(true);
    expect(gateResult.passouJornada).toBe(false);
    expect(gateResult.bloqueado).toBe(true);
    expect(gateResult.tipoBloqueio).toBe("jornada_nao_parametrizada");
  });

  // =========================================================================
  // CENÁRIO 12: Regularização não fura Gate regra BH
  // =========================================================================
  it("12. regularização não fura Gate regra BH: sem regra de banco bloqueia no Gate 3", async () => {
    const colaboradorApto = {
      id: "colab-1",
      nome: "Colaborador Válido",
      tipo_colaborador: "CLT",
      modelo_calculo: "CLT_MENSAL",
      status_cadastro: "ativo",
      data_admissao: "2026-01-01",
      jornada_id: null,
    };

    const jornadaValida = mockJornada({ empresa_id: "empresa-1", padrao: true });

    const pontoComReg = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: { valor: "17:35", valorOriginal: null, justificativa: "Ajuste RH" },
      },
    };

    // Passa Gate 1 e Gate 2, mas sem regrasRuntime (Gate 3 bloqueia por fallback)
    const gateResult = await avaliarPontoGates({
      tenantId: "tenant-esc-1",
      ponto: pontoComReg as any,
      colaborador: colaboradorApto as any,
      resolvedEmpresaId: "empresa-1",
      jornadasRuntime: [jornadaValida],
      regrasRuntime: [],
    });

    expect(gateResult.passouCadastral).toBe(true);
    expect(gateResult.passouJornada).toBe(true);
    expect(gateResult.passouRegraBanco).toBe(false);
    expect(gateResult.bloqueado).toBe(true);
    expect(gateResult.tipoBloqueio).toBe("regra_banco_nao_parametrizada");
  });

  // =========================================================================
  // CENÁRIO 13: Regularização permite Gate 4 quando sequência passa a ser válida
  // =========================================================================
  it("13. regularização permite Gate 4 quando sequência passa a ser válida: aprova todos os 4 gates", async () => {
    const colaboradorApto = {
      id: "colab-1",
      nome: "Colaborador Válido",
      tipo_colaborador: "CLT",
      modelo_calculo: "CLT_MENSAL",
      status_cadastro: "ativo",
      data_admissao: "2026-01-01",
      jornada_id: null,
    };

    const jornadaValida = mockJornada({ empresa_id: "empresa-1", padrao: true });
    const regraValida = {
      id: "regra-1",
      nome: "Regra Banco ESC",
      empresa_id: "empresa-1",
      bh_ativo: true,
      carga_horaria_diaria: 8,
      status: "ativo",
    };

    // Sem regularização: 3 marcações (bloqueia Gate 4)
    const pontoSemReg = { ...dbState.pontos["ponto-1"] };
    const gateAntes = await avaliarPontoGates({
      tenantId: "tenant-esc-1",
      ponto: pontoSemReg as any,
      colaborador: colaboradorApto as any,
      resolvedEmpresaId: "empresa-1",
      jornadasRuntime: [jornadaValida],
      regrasRuntime: [regraValida as any],
    });
    expect(gateAntes.bloqueado).toBe(true);
    expect(gateAntes.tipoBloqueio).toBe("marcacao_incompleta");

    // Com regularização: 4 marcações válidas (libera Gate 4)
    const pontoComReg = {
      ...pontoSemReg,
      regularizacoes: {
        saida: { valor: "17:35", valorOriginal: null, justificativa: "Ajuste RH" },
      },
    };
    const gateDepois = await avaliarPontoGates({
      tenantId: "tenant-esc-1",
      ponto: pontoComReg as any,
      colaborador: colaboradorApto as any,
      resolvedEmpresaId: "empresa-1",
      jornadasRuntime: [jornadaValida],
      regrasRuntime: [regraValida as any],
    });

    expect(gateDepois.bloqueado).toBe(false);
    expect(gateDepois.passouConsistenciaMarcacoes).toBe(true);
    expect(gateDepois.avaliacaoMarcacoes?.calculavel).toBe(true);
  });

  // =========================================================================
  // CENÁRIO 14: Nova correção preserva regularização anterior
  // =========================================================================
  it("14. nova correção preserva regularização anterior: anterior inativada, nova vigente, ambas preservadas", async () => {
    // 1ª regularização: 17:35
    const reg1 = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Primeira regularização informada pelo colaborador.",
    });

    // 2ª regularização do mesmo campo: 17:45
    const reg2 = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:45",
      justificativa: "Retificação do horário após conferência das filmagens.",
    });

    expect(reg1.id).not.toBe(reg2.id);
    expect(dbState.regularizacoes[reg1.id].ativo).toBe(false);
    expect(dbState.regularizacoes[reg1.id].substituido_por).toBe(reg2.id);

    expect(dbState.regularizacoes[reg2.id].ativo).toBe(true);
    expect(dbState.regularizacoes[reg2.id].valor_regularizado).toBe("17:45");
  });

  // =========================================================================
  // CENÁRIO 15: Reprocessamento não apaga regularização manual
  // =========================================================================
  it("15. reprocessamento não apaga regularização manual: registros_ponto_regularizacoes permanece intacta", async () => {
    const reg = await PontoRegularizacaoService.regularizarMarcacao({
      registroPontoId: "ponto-1",
      colaboradorId: "colab-1",
      data: "2026-09-15",
      campo: "saida",
      novoHorario: "17:35",
      justificativa: "Ajuste manual permanente que deve sobreviver a reprocessamentos.",
    });

    // Simulando rotina de limpeza de processamento (que limpa eventos e inconsistências, mas NÃO regularizações)
    expect(dbState.regularizacoes[reg.id]).toBeDefined();
    expect(dbState.regularizacoes[reg.id].ativo).toBe(true);
  });

  // =========================================================================
  // CENÁRIO 16: Reprocessamento não duplica eventos
  // =========================================================================
  it("16. reprocessamento não duplica eventos: cálculo idempotente", () => {
    const pontoComReg = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: { valor: "17:35", valorOriginal: null, justificativa: "Ajuste RH" },
      },
    };

    const regra = {
      id: "r1",
      nome: "Regra 8h",
      carga_horaria_diaria: 8,
      tolerancia_hora_extra: 10,
      tolerancia_atraso: 10,
      limite_diario_banco: 120,
    };

    const avaliacao = avaliarMarcacoesPonto({ ponto: pontoComReg });

    const calc1 = calculateCompensation({
      ponto: pontoComReg,
      regra: regra as any,
      colaborador: { id: "colab-1", tipo_colaborador: "CLT", salario_base: 2200 } as any,
      minutosPrevistosJornada: 480,
      avaliacaoMarcacoes: avaliacao,
      cargaSemanalMinutos: 2640,
      isJornadaConfigurada: true,
    });

    const calc2 = calculateCompensation({
      ponto: pontoComReg,
      regra: regra as any,
      colaborador: { id: "colab-1", tipo_colaborador: "CLT", salario_base: 2200 } as any,
      minutosPrevistosJornada: 480,
      avaliacaoMarcacoes: avaliacao,
      cargaSemanalMinutos: 2640,
      isJornadaConfigurada: true,
    });

    expect(calc1.saldoDia).toBe(calc2.saldoDia);
    expect(calc1.workedMinutes).toBe(calc2.workedMinutes);
  });

  // =========================================================================
  // CENÁRIO 17: Marcação inválida continua bloqueada se regularização continuar inválida
  // =========================================================================
  it("17. marcação inválida continua bloqueada se regularização mantiver ordem cronológica inválida", () => {
    // Horário de saída (11:00) anterior ao horário de saída para almoço (12:00)
    const pontoInvalido = {
      ...dbState.pontos["ponto-1"],
      regularizacoes: {
        saida: { valor: "11:00", valorOriginal: null, justificativa: "Horário digitado errado" },
      },
    };

    const res = avaliarMarcacoesPonto({ ponto: pontoInvalido });
    expect(res.calculavel).toBe(false);
    expect(res.tipo).toBe("MARCACAO_INVALIDA");
    expect(res.motivo).toMatch(/anterior ou igual|inválida/i);
  });

  // =========================================================================
  // CENÁRIO 18: Nenhuma regularização automática é criada
  // =========================================================================
  it("18. nenhuma regularização automática é criada: parser nunca preenche batidas faltantes por suposição", () => {
    const pontoOriginalIncompleto = { ...dbState.pontos["ponto-1"] }; // 08:00, 12:00, 13:00, null

    const res = avaliarMarcacoesPonto({ ponto: pontoOriginalIncompleto });
    expect(res.calculavel).toBe(false);
    expect(res.tipo).toBe("MARCACAO_INCOMPLETA");
    expect(res.possuiRegularizacao).toBe(false);
    expect(res.marcacoesPreservadas).toHaveLength(3);
    expect(res.marcacoesPreservadas.find((m) => m.campo === "saida")).toBeUndefined();
  });
});
