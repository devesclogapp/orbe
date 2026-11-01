import { describe, it, expect, beforeEach, vi } from "vitest";
import { avaliarMarcacoesPonto } from "./MarcacoesPontoParser";
import { PontoDecisaoService } from "./pontoDecisao.service";
import { avaliarPontoGates, calculateCompensation } from "../rhProcessing.service";
import { JornadaTrabalho } from "@/types/jornada.types";
import { PontoDecisao } from "@/types/pontoDecisao.types";

// ==========================================
// MOCK STATE SETUP
// ==========================================

interface MockDbState {
  user: { id: string } | null;
  profile: { tenant_id: string; role: string; full_name?: string } | null;
  userPermissions: { role: string; permissions: any; status: string } | null;
  pontos: Record<string, any>;
  decisoes: Record<string, any>;
  auditLogs: any[];
}

const dbState: MockDbState = {
  user: { id: "user-rh-1" },
  profile: { tenant_id: "tenant-esc-1", role: "rh", full_name: "Analista de RH" },
  userPermissions: { role: "rh", permissions: null, status: "ativo" },
  pontos: {},
  decisoes: {},
  auditLogs: [],
};

const resetDbState = () => {
  dbState.user = { id: "user-rh-1" };
  dbState.profile = { tenant_id: "tenant-esc-1", role: "rh", full_name: "Analista de RH" };
  dbState.userPermissions = { role: "rh", permissions: null, status: "ativo" };
  dbState.pontos = {
    "ponto-falta": {
      id: "ponto-falta",
      tenant_id: "tenant-esc-1",
      colaborador_id: "colab-1",
      data: "2026-10-09", // Sexta-feira
      entrada: null,
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status: "Normal", // Status bruto factual do RHiD
      status_processamento: "PENDENTE",
    },
    "ponto-dsr": {
      id: "ponto-dsr",
      tenant_id: "tenant-esc-1",
      colaborador_id: "colab-1",
      data: "2026-10-11", // Domingo (DSR)
      entrada: "08:00",
      saida_almoco: "12:00",
      retorno_almoco: "13:00",
      saida: "17:00",
      status: "Normal",
      status_processamento: "PENDENTE",
    },
    "ponto-outro-tenant": {
      id: "ponto-outro-tenant",
      tenant_id: "outro-tenant",
      colaborador_id: "colab-outro",
      data: "2026-10-09",
      entrada: null,
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status_processamento: "PENDENTE",
    },
  };
  dbState.decisoes = {};
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

        if (selectedTable === "registros_ponto_decisoes") {
          if (updatePayload && filters.id) {
            const dec = dbState.decisoes[filters.id];
            if (dec) {
              dbState.decisoes[filters.id] = { ...dec, ...updatePayload };
              return { data: dbState.decisoes[filters.id], error: null };
            }
          }

          let items = Object.values(dbState.decisoes);
          if (filters.id) {
            items = items.filter((d) => d.id === filters.id);
          }
          if (filters.registro_ponto_id) {
            items = items.filter((d) => d.registro_ponto_id === filters.registro_ponto_id);
          }
          if (filters.ativo !== undefined) {
            items = items.filter((d) => d.ativo === filters.ativo);
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
          if (selectedTable === "registros_ponto_decisoes") {
            const id = `dec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            lastInsertedRecord = { ...payload, id, created_at: new Date().toISOString() };
            dbState.decisoes[id] = lastInsertedRecord;
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
        gte: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn(() => {
          isSingle = true;
          return execute();
        }),
        maybeSingle: vi.fn(() => {
          isMaybeSingle = true;
          return execute();
        }),
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };

      return chain;
    }),
  },
}));

vi.mock("@/services/v4.service", () => ({
  AuditoriaService: {
    log: vi.fn(async (acao, modulo, gravidade, dados) => {
      dbState.auditLogs.push({ acao, modulo, gravidade, dados });
    }),
  },
}));

// Mock Jornada de 44h (Seg-Sex 8h = 480 min, Sábado 4h = 240 min, Domingo DSR 0 min)
const mockJornadaCLT: JornadaTrabalho = {
  id: "jornada-clt-padrao",
  tenant_id: "tenant-esc-1",
  nome: "Jornada Padrão CLT - 44h",
  tipo_escala: "semanal",
  tipo_jornada: "fixa",
  carga_horaria_semanal_minutos: 2640,
  carga_horaria_diaria_minutos: 480,
  permite_intervalo_flexivel: false,
  tolerancia_entrada_minutos: 0,
  tolerancia_saida_minutos: 0,
  status: "ativo",
  grade_semanal: {
    segunda: { trabalhada: true, minutos: 480, turnos: [{ entrada: "08:00", saida: "17:00", intervalo_minutos: 60 }] },
    terca: { trabalhada: true, minutos: 480, turnos: [{ entrada: "08:00", saida: "17:00", intervalo_minutos: 60 }] },
    quarta: { trabalhada: true, minutos: 480, turnos: [{ entrada: "08:00", saida: "17:00", intervalo_minutos: 60 }] },
    quinta: { trabalhada: true, minutos: 480, turnos: [{ entrada: "08:00", saida: "17:00", intervalo_minutos: 60 }] },
    sexta: { trabalhada: true, minutos: 480, turnos: [{ entrada: "08:00", saida: "17:00", intervalo_minutos: 60 }] },
    sabado: { trabalhada: true, minutos: 240, turnos: [{ entrada: "08:00", saida: "12:00", intervalo_minutos: 0 }] },
    domingo: { trabalhada: false, minutos: 0, turnos: [] },
  },
  vigencia_inicio: "2026-09-30",
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
};

const mockColaborador = {
  id: "colab-1",
  nome: "Colaborador HML",
  matricula: "HML-001",
  tipo_colaborador: "CLT",
  modelo_calculo: "CLT_MENSAL",
  salario_base: 1518.0,
  salario: 1518.0,
  empresa_id: "empresa-1",
  tenant_id: "tenant-esc-1",
  jornada_id: "jornada-clt-padrao",
  ativo: true,
};

const mockRegraBH = {
  id: "regra-bh-1",
  nome: "Regra Banco de Horas Padrão",
  limite_diario_banco: 120,
  tolerancia_atraso: 0,
  tolerancia_hora_extra: 0,
  adicional_hora_extra_percentual: 50,
  bh_ativo: true,
};

// ==========================================
// TEST SUITE
// ==========================================

describe("FIX CP06.6-A — Camada Auditável de Decisão RH do Ponto", () => {
  beforeEach(() => {
    resetDbState();
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // TESTE 1: Bloqueio sem decisão prévia
  // --------------------------------------------------------------------------
  it("1. Sem decisão RH: Falta em dia trabalhável continua retida como FALTA_PENDENTE_JUSTIFICATIVA", () => {
    const ponto = dbState.pontos["ponto-falta"];
    const avaliacao = avaliarMarcacoesPonto({
      ponto,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: true,
        minutosPrevistos: 480,
      },
    });

    expect(avaliacao.calculavel).toBe(false);
    expect(avaliacao.tipo).toBe("FALTA_PENDENTE_JUSTIFICATIVA");
    expect(avaliacao.minutosTrabalhados).toBeNull();
  });

  it("2. Sem decisão RH: Trabalho em DSR continua retido como TRABALHO_EM_DIA_NAO_TRABALHAVEL", () => {
    const ponto = dbState.pontos["ponto-dsr"];
    const avaliacao = avaliarMarcacoesPonto({
      ponto,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: false,
        minutosPrevistos: 0,
      },
    });

    expect(avaliacao.calculavel).toBe(false);
    expect(avaliacao.tipo).toBe("TRABALHO_EM_DIA_NAO_TRABALHAVEL");
    expect(avaliacao.minutosTrabalhados).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TESTE 2: Governança de Perfil (Encarregado Bloqueado vs Admin/RH Autorizado)
  // --------------------------------------------------------------------------
  it("3. Encarregado é bloqueado de registrar decisão (Fail-Closed)", async () => {
    dbState.profile!.role = "encarregado";
    dbState.userPermissions!.role = "encarregado";

    await expect(
      PontoDecisaoService.registrarDecisao({
        registroPontoId: "ponto-falta",
        tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
        justificativa: "Tentativa por encarregado",
      })
    ).rejects.toThrow(/perfil operacional \(encarregado\) não possui autorização/);
  });

  it("4. Admin e RH são autorizados a registrar decisão", async () => {
    dbState.profile!.role = "rh";
    dbState.userPermissions!.role = "rh";

    const decisao = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
      justificativa: "Atestado médico homologado pelo ambulatório",
    });

    expect(decisao.id).toBeDefined();
    expect(decisao.tipo_decisao).toBe("FALTA_JUSTIFICADA_ABONADA");
    expect(decisao.ativo).toBe(true);
    expect(decisao.executado_por_nome).toBe("Analista de RH");
  });

  // --------------------------------------------------------------------------
  // TESTE 3: Caso 1A — Falta Confirmada (FALTA_INJUSTIFICADA_CONFIRMADA)
  // --------------------------------------------------------------------------
  it("5. Falta Confirmada: Motor autoriza débito de -480 min reutilizando lógica de calculateCompensation", async () => {
    const decisao = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_INJUSTIFICADA_CONFIRMADA",
      justificativa: "Falta injustificada confirmada após decorrido prazo legal",
    });

    const pontoEfetivo = PontoDecisaoService.anexarDecisao(dbState.pontos["ponto-falta"], decisao);

    // Gate 4 avalia decisão
    const avaliacao = avaliarMarcacoesPonto({
      ponto: pontoEfetivo,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: true,
        minutosPrevistos: 480,
      },
    });

    expect(avaliacao.calculavel).toBe(true);
    expect(avaliacao.tipo).toBe("FALTA_CONFIRMADA");
    expect(avaliacao.minutosTrabalhados).toBe(0);
    expect(avaliacao.possuiDecisaoRh).toBe(true);

    // Motor de compensação
    const comp = calculateCompensation({
      ponto: pontoEfetivo,
      regra: mockRegraBH,
      colaborador: mockColaborador,
      minutosPrevistosJornada: 480,
      avaliacaoMarcacoes: avaliacao,
    });

    expect(comp.workedMinutes).toBe(0);
    expect(comp.jornadaMinutes).toBe(480);
    expect(comp.minutosDebito).toBe(480);
    expect(comp.saldoDia).toBe(-480); // Débito exato da jornada
    expect(comp.minutosBanco).toBe(0);
    expect(comp.minutosExcedentePagar).toBe(0);
    expect(comp.valorFalta).toBeGreaterThan(0); // Aplica dedução salarial
    expect(comp.valorDia).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TESTE 4: Caso 1B — Falta Abonada (FALTA_JUSTIFICADA_ABONADA)
  // --------------------------------------------------------------------------
  it("6. Falta Abonada: Jornada preservada, sem débito BH (saldo 0), sem HE, salário base mantido", async () => {
    const decisao = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
      justificativa: "Atestado médico de 1 dia homologado pelo RH",
    });

    const pontoEfetivo = PontoDecisaoService.anexarDecisao(dbState.pontos["ponto-falta"], decisao);

    const avaliacao = avaliarMarcacoesPonto({
      ponto: pontoEfetivo,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: true,
        minutosPrevistos: 480,
      },
    });

    expect(avaliacao.calculavel).toBe(true);
    expect(avaliacao.tipo).toBe("FALTA_ABONADA");
    expect(avaliacao.minutosTrabalhados).toBe(0);

    const comp = calculateCompensation({
      ponto: pontoEfetivo,
      regra: mockRegraBH,
      colaborador: mockColaborador,
      minutosPrevistosJornada: 480,
      avaliacaoMarcacoes: avaliacao,
    });

    expect(comp.workedMinutes).toBe(0);
    expect(comp.jornadaMinutes).toBe(480); // Jornada prevista preservada
    expect(comp.saldoDia).toBe(0); // SEM débito no Banco de Horas
    expect(comp.minutosDebito).toBe(0);
    expect(comp.minutosBanco).toBe(0);
    expect(comp.minutosExcedentePagar).toBe(0);
    expect(comp.valorFalta).toBe(0); // SEM desconto salarial
    expect(comp.valorDia).toBe(comp.valorDiaBase); // Salário base integral mantido
  });

  // --------------------------------------------------------------------------
  // TESTE 5: Caso 2A — DSR Direcionado para Banco de Horas
  // --------------------------------------------------------------------------
  it("7. DSR → Banco de Horas: Minutos factuais (480) creditados integralmente no BH", async () => {
    const decisao = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-dsr",
      tipoDecisao: "DSR_DIRECIONADO_BANCO_HORAS",
      justificativa: "Acordo operacional para compensação futura em Banco de Horas",
    });

    const pontoEfetivo = PontoDecisaoService.anexarDecisao(dbState.pontos["ponto-dsr"], decisao);

    const avaliacao = avaliarMarcacoesPonto({
      ponto: pontoEfetivo,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: false,
        minutosPrevistos: 0,
      },
    });

    expect(avaliacao.calculavel).toBe(true);
    expect(avaliacao.tipo).toBe("DSR_DIRECIONADO_BH");
    expect(avaliacao.minutosTrabalhados).toBe(480); // 08-12 + 13-17

    const comp = calculateCompensation({
      ponto: pontoEfetivo,
      regra: mockRegraBH,
      colaborador: mockColaborador,
      minutosPrevistosJornada: 0,
      avaliacaoMarcacoes: avaliacao,
    });

    expect(comp.workedMinutes).toBe(480);
    expect(comp.jornadaMinutes).toBe(0);
    expect(comp.saldoDia).toBe(480); // Crédito integral em BH
    expect(comp.minutosBanco).toBe(480);
    expect(comp.minutosExcedentePagar).toBe(0);
    expect(comp.valorExtras).toBe(0); // Vai para BH, não para pagamento em dinheiro
  });

  // --------------------------------------------------------------------------
  // TESTE 6: Caso 2B — DSR Direcionado para Pagamento (Hora Extra)
  // --------------------------------------------------------------------------
  it("8. DSR → Pagamento: Minutos factuais (480) segregados para pagamento SEM criar crédito BH simultâneo", async () => {
    const decisao = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-dsr",
      tipoDecisao: "DSR_DIRECIONADO_HORA_EXTRA",
      justificativa: "Autorização de pagamento de horas extras em folha",
    });

    const pontoEfetivo = PontoDecisaoService.anexarDecisao(dbState.pontos["ponto-dsr"], decisao);

    const avaliacao = avaliarMarcacoesPonto({
      ponto: pontoEfetivo,
      jornadaResolvida: {
        temJornadaConfigurada: true,
        trabalhavel: false,
        minutosPrevistos: 0,
      },
    });

    expect(avaliacao.calculavel).toBe(true);
    expect(avaliacao.tipo).toBe("DSR_DIRECIONADO_HE");
    expect(avaliacao.minutosTrabalhados).toBe(480);

    const comp = calculateCompensation({
      ponto: pontoEfetivo,
      regra: mockRegraBH,
      colaborador: mockColaborador,
      minutosPrevistosJornada: 0,
      avaliacaoMarcacoes: avaliacao,
    });

    expect(comp.workedMinutes).toBe(480);
    expect(comp.jornadaMinutes).toBe(0);
    expect(comp.saldoDia).toBe(0); // SEM crédito simultâneo no Banco de Horas
    expect(comp.minutosBanco).toBe(0);
    expect(comp.minutosExcedentePagar).toBe(480); // Segregado para folha
    expect(comp.minutosExtra).toBe(480);
    expect(comp.valorExtras).toBeGreaterThan(0); // Gera valor financeiro a pagar
  });

  // --------------------------------------------------------------------------
  // TESTE 7: Imutabilidade do Ponto Bruto Original
  // --------------------------------------------------------------------------
  it("9. Ponto bruto original permanece 100% intacto sem sobrescrita de status factual", async () => {
    const pontoOriginalAntes = { ...dbState.pontos["ponto-falta"] };

    await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_INJUSTIFICADA_CONFIRMADA",
      justificativa: "Confirmação de falta sem tocar no ponto bruto",
    });

    const pontoOriginalDepois = dbState.pontos["ponto-falta"];
    expect(pontoOriginalDepois.status).toBe(pontoOriginalAntes.status);
    expect(pontoOriginalDepois.status).not.toBe("Falta");
    expect(pontoOriginalDepois.entrada).toBeNull();
    expect(pontoOriginalDepois.saida).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TESTE 8: Substituição com Histórico e Revogação
  // --------------------------------------------------------------------------
  it("10. Substituição inativa decisão anterior com substituido_por; Revogação reabre bloqueio", async () => {
    // 1. Primeira decisão: Falta Confirmada
    const dec1 = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_INJUSTIFICADA_CONFIRMADA",
      justificativa: "Decisão inicial de falta",
    });

    expect(dec1.ativo).toBe(true);

    // 2. Substituição: Colaborador apresentou atestado retroativo -> Abonar Falta
    const dec2 = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
      justificativa: "Atestado entregue posteriormente com comprovação",
    });

    expect(dbState.decisoes[dec1.id].ativo).toBe(false);
    expect(dbState.decisoes[dec1.id].substituido_por).toBe(dec2.id);
    expect(dbState.decisoes[dec2.id].ativo).toBe(true);

    // 3. Revogação formal
    const revogada = await PontoDecisaoService.revogarDecisao({
      decisaoId: dec2.id,
      motivoRevogacao: "Anulação administrativa para nova auditoria médica",
    });

    expect(revogada.ativo).toBe(false);
    expect(revogada.motivo_revogacao).toContain("Anulação administrativa");

    // 4. Avaliação pós-revogação volta a bloquear o ponto no Gate 4
    const pontoSemDecisaoAtiva = PontoDecisaoService.anexarDecisao(dbState.pontos["ponto-falta"], null);
    const avaliacaoBloqueada = avaliarMarcacoesPonto({
      ponto: pontoSemDecisaoAtiva,
      jornadaResolvida: { temJornadaConfigurada: true, trabalhavel: true, minutosPrevistos: 480 },
    });

    expect(avaliacaoBloqueada.calculavel).toBe(false);
    expect(avaliacaoBloqueada.tipo).toBe("FALTA_PENDENTE_JUSTIFICATIVA");
  });

  // --------------------------------------------------------------------------
  // TESTE 9: Isolamento Cross-Tenant
  // --------------------------------------------------------------------------
  it("11. Isolamento Cross-Tenant: Proibido registrar decisão para ponto de outro tenant", async () => {
    await expect(
      PontoDecisaoService.registrarDecisao({
        registroPontoId: "ponto-outro-tenant",
        tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
        justificativa: "Tentativa de injeção cross-tenant",
      })
    ).rejects.toThrow(/registro de ponto pertence a outro tenant/);
  });

  // --------------------------------------------------------------------------
  // TESTE 10: Auditoria Central do Sistema
  // --------------------------------------------------------------------------
  it("12. Toda decisão e revogação gera log na tabela de auditoria central", async () => {
    const dec = await PontoDecisaoService.registrarDecisao({
      registroPontoId: "ponto-falta",
      tipoDecisao: "FALTA_JUSTIFICADA_ABONADA",
      justificativa: "Justificativa auditada com sucesso",
    });

    expect(dbState.auditLogs.length).toBeGreaterThan(0);
    const logDecisao = dbState.auditLogs.find((l) => l.acao === "decisao_rh_ponto");
    expect(logDecisao).toBeDefined();
    expect(logDecisao.dados.tipo_decisao).toBe("FALTA_JUSTIFICADA_ABONADA");
    expect(logDecisao.dados.executado_por_nome).toBe("Analista de RH");

    await PontoDecisaoService.revogarDecisao({
      decisaoId: dec.id,
      motivoRevogacao: "Revogação auditada com sucesso",
    });

    const logRevogacao = dbState.auditLogs.find((l) => l.acao === "revogar_decisao_rh_ponto");
    expect(logRevogacao).toBeDefined();
    expect(logRevogacao.dados.motivo_revogacao).toContain("Revogação auditada");
  });
});
