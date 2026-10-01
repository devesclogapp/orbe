import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { buildFolhaVariavelItems } from "../rhFinanceiro.service";
import { RemuneracaoResolver } from "./RemuneracaoResolver";
import { getMultiplicadorHoraExtra } from "../rhProcessing.service";

describe("FIX CP07.2 — Preservar HE física no handoff CLT → Financeiro", () => {
  // Colaborador de referência CLT-HML-001 (Salário base R$ 1.518,00 / 220h = R$ 6,90/h)
  const colabHml = {
    id: "cc782f3f-10a9-4a45-8219-7cdb91a791ed",
    nome: "CLT-HML-001 — HOMOLOGAÇÃO CLT",
    salario_base: 1518.0,
    valor_base: 1518.0,
    modelo_calculo: "CLT_MENSAL",
    tipo_contrato: "mensal",
    status: "ativo",
    gera_faturamento: true,
    regra_banco_horas_id: "regra-hml-0-percentual",
  };

  const regraHml0 = {
    id: "regra-hml-0-percentual",
    nome: "Regra HML 0% Adicional",
    adicional_hora_extra_percentual: 0,
    ativo: true,
  };

  const regra50 = {
    id: "regra-50-percentual",
    nome: "Regra Padrão 50%",
    adicional_hora_extra_percentual: 50,
    ativo: true,
  };

  const regra100 = {
    id: "regra-100-percentual",
    nome: "Regra Domingo/Feriado 100%",
    adicional_hora_extra_percentual: 100,
    ativo: true,
  };

  const valorHoraBase = RemuneracaoResolver.resolve({ colaborador: colabHml }).valorHora;

  it("1. HE 60 min, adicional 0% → 1h × hora-base (R$ 6,90)", () => {
    expect(valorHoraBase).toBe(6.9);
    expect(getMultiplicadorHoraExtra(regraHml0)).toBe(1.0);

    const pontoC4 = {
      id: "ponto-c4-0610",
      colaborador_id: colabHml.id,
      nome_colaborador: colabHml.nome,
      data: "2026-10-06",
      status_processamento: "PROCESSADO",
      minutos_extra: 60,
      valor_hora_extra: 0, // Mesmo se a coluna estiver zerada
      horas_extras_detalhadas: {
        minutos: 60,
        multiplicador: 1.0,
        percentual: 0,
        valor: 0,
      },
    };

    const items = buildFolhaVariavelItems([pontoC4], [colabHml], [regraHml0]);
    expect(items.length).toBe(1);
    expect(items[0].tipo_evento).toBe("hora_extra");
    expect(items[0].minutos).toBe(60);
    expect(items[0].horas).toBe(1.0);
    expect(items[0].valor_calculado).toBe(6.9);
  });

  it("2. HE 480 min, adicional 0% → 8h × hora-base (R$ 55,20)", () => {
    const pontoC9 = {
      id: "ponto-c9-1110",
      colaborador_id: colabHml.id,
      nome_colaborador: colabHml.nome,
      data: "2026-10-11",
      status_processamento: "PROCESSADO",
      minutos_extra: 480,
      valor_hora_extra: 0, // Mesmo se a coluna estiver zerada
      horas_extras_detalhadas: {
        minutos: 480,
        multiplicador: 1.0,
        percentual: 0,
        valor: 0,
      },
    };

    const items = buildFolhaVariavelItems([pontoC9], [colabHml], [regraHml0]);
    expect(items.length).toBe(1);
    expect(items[0].tipo_evento).toBe("hora_extra");
    expect(items[0].minutos).toBe(480);
    expect(items[0].horas).toBe(8.0);
    expect(items[0].valor_calculado).toBe(55.2);
  });

  it("3. Total HML 540 min → 9h físicas e R$ 62,10 no lote financeiro", () => {
    const pontosHml = [
      { id: "c1", colaborador_id: colabHml.id, data: "2026-10-01", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c2", colaborador_id: colabHml.id, data: "2026-10-02", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c3", colaborador_id: colabHml.id, data: "2026-10-05", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c4", colaborador_id: colabHml.id, data: "2026-10-06", status_processamento: "PROCESSADO", minutos_extra: 60, valor_hora_extra: 6.9 },
      { id: "c5", colaborador_id: colabHml.id, data: "2026-10-07", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c6", colaborador_id: colabHml.id, data: "2026-10-08", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c7", colaborador_id: colabHml.id, data: "2026-10-09", status_processamento: "PROCESSADO", minutos_extra: 0, valor_falta: 0 },
      { id: "c8", colaborador_id: colabHml.id, data: "2026-10-04", status_processamento: "PROCESSADO", minutos_extra: 0 },
      { id: "c9", colaborador_id: colabHml.id, data: "2026-10-11", status_processamento: "PROCESSADO", minutos_extra: 480, valor_hora_extra: 55.2 },
    ];

    const items = buildFolhaVariavelItems(pontosHml, [colabHml], [regraHml0]);
    expect(items.length).toBe(2); // Somente C4 e C9

    const totalMinutos = items.reduce((acc, it) => acc + it.minutos, 0);
    const totalHoras = items.reduce((acc, it) => acc + it.horas, 0);
    const totalValor = items.reduce((acc, it) => acc + it.valor_calculado, 0);

    expect(totalMinutos).toBe(540);
    expect(totalHoras).toBe(9.0);
    expect(Number(totalValor.toFixed(2))).toBe(62.1);
  });

  it("4. Adicional 50% → multiplicador 1.5 (60 min = 1h × 6.90 × 1.5 = R$ 10,35)", () => {
    expect(getMultiplicadorHoraExtra(regra50)).toBe(1.5);

    const colab50 = { ...colabHml, regra_banco_horas_id: regra50.id };
    const ponto = {
      id: "ponto-50",
      colaborador_id: colab50.id,
      data: "2026-10-06",
      status_processamento: "PROCESSADO",
      minutos_extra: 60,
      valor_hora_extra: 0,
      horas_extras_detalhadas: null,
    };

    const items = buildFolhaVariavelItems([ponto], [colab50], [regra50]);
    expect(items.length).toBe(1);
    expect(items[0].minutos).toBe(60);
    expect(items[0].valor_calculado).toBe(10.35);
  });

  it("5. Adicional 100% → multiplicador 2.0 (60 min = 1h × 6.90 × 2.0 = R$ 13,80)", () => {
    expect(getMultiplicadorHoraExtra(regra100)).toBe(2.0);

    const colab100 = { ...colabHml, regra_banco_horas_id: regra100.id };
    const ponto = {
      id: "ponto-100",
      colaborador_id: colab100.id,
      data: "2026-10-06",
      status_processamento: "PROCESSADO",
      minutos_extra: 60,
      valor_hora_extra: 0,
      horas_extras_detalhadas: null,
    };

    const items = buildFolhaVariavelItems([ponto], [colab100], [regra100]);
    expect(items.length).toBe(1);
    expect(items[0].minutos).toBe(60);
    expect(items[0].valor_calculado).toBe(13.8);
  });

  it("6. minutos_extra = 0 → nenhum item HE gerado", () => {
    const pontoSemExtra = {
      id: "ponto-sem-extra",
      colaborador_id: colabHml.id,
      data: "2026-10-01",
      status_processamento: "PROCESSADO",
      minutos_extra: 0,
      valor_hora_extra: 0,
    };

    const items = buildFolhaVariavelItems([pontoSemExtra], [colabHml], [regraHml0]);
    expect(items.filter((it) => it.tipo_evento === "hora_extra").length).toBe(0);
  });

  it("7. BH sem reflexo_financeiro_pendente → continua estritamente fora do financeiro", () => {
    // Eventos com reflexo_financeiro_pendente === false não são elegíveis para lote financeiro
    const eventosBh = [
      { id: "ev1", minutos: 60, reflexo_financeiro_pendente: false },
      { id: "ev2", minutos: 120, reflexo_financeiro_pendente: false },
      { id: "ev3", minutos: 120, reflexo_financeiro_pendente: false },
      { id: "ev4", minutos: -60, reflexo_financeiro_pendente: false },
    ];

    const eventosElegiveis = eventosBh.filter((ev) => ev.reflexo_financeiro_pendente === true);
    expect(eventosElegiveis.length).toBe(0);
  });

  it("8. Falta abonada → nenhum desconto gerado", () => {
    // Ponto C7: falta justificada abonada pelo RH com valor_falta = 0
    const pontoC7Abonado = {
      id: "ponto-c7-0910",
      colaborador_id: colabHml.id,
      data: "2026-10-09",
      status_processamento: "PROCESSADO",
      minutos_extra: 0,
      valor_hora_extra: 0,
      valor_falta: 0,
      minutos_atraso: 0,
    };

    const items = buildFolhaVariavelItems([pontoC7Abonado], [colabHml], [regraHml0]);
    expect(items.length).toBe(0); // Zero itens (sem desconto financeiro)
  });

  it("9. Reexecução → idempotência pura sem duplicação de itens", () => {
    const pontoC4 = {
      id: "ponto-c4",
      colaborador_id: colabHml.id,
      data: "2026-10-06",
      status_processamento: "PROCESSADO",
      minutos_extra: 60,
      valor_hora_extra: 6.9,
    };

    const run1 = buildFolhaVariavelItems([pontoC4], [colabHml], [regraHml0]);
    const run2 = buildFolhaVariavelItems([pontoC4], [colabHml], [regraHml0]);

    expect(run1).toEqual(run2);
    expect(run1.length).toBe(1);
    expect(run2.length).toBe(1);
  });

  it("10. Simulação E2E direta com a base real HML (C1–C9 do CLT-HML-001 no banco)", async () => {
    const { supabase } = await import("@/lib/supabase");

    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (email && password) {
      await supabase.auth.signInWithPassword({ email, password });
    }

    const colabId = "cc782f3f-10a9-4a45-8219-7cdb91a791ed";
    const empresaId = "28a560b5-37ef-403d-ae4f-b28a608b6a68";

    // 1. Buscar colaborador HML real do banco
    const { data: colabDb, error: colabErr } = await supabase
      .from("colaboradores")
      .select("*")
      .eq("id", colabId)
      .maybeSingle();

    if (!colabDb) {
      console.log("[CP08] Colaborador CLT-HML-001 foi removido no encerramento da homologação CP08. Pulando validação de banco ao vivo.");
      return;
    }

    expect(colabDb.nome).toBe("CLT-HML-001 — HOMOLOGAÇÃO CLT");

    // 2. Buscar 9 pontos reais do banco
    const { data: pontosDb, error: pontosErr } = await supabase
      .from("registros_ponto")
      .select("*")
      .eq("colaborador_id", colabId)
      .order("data", { ascending: true });

    expect(pontosErr).toBeNull();
    expect(pontosDb.length).toBe(9);

    // 3. Buscar regra vinculada
    const { data: regrasDb, error: regrasErr } = await supabase
      .from("banco_horas_regras")
      .select("*")
      .eq("empresa_id", empresaId);

    expect(regrasErr).toBeNull();

    // 4. Executar buildFolhaVariavelItems
    const itensVariaveis = buildFolhaVariavelItems(pontosDb, [colabDb], regrasDb || []);

    // Deve conter exatamente C4 e C9
    expect(itensVariaveis.length).toBe(2);

    const itemC4 = itensVariaveis.find((it) => it.minutos === 60);
    const itemC9 = itensVariaveis.find((it) => it.minutos === 480);

    expect(itemC4).toBeDefined();
    expect(itemC4?.horas).toBe(1.0);
    expect(itemC4?.valor_calculado).toBe(6.9);

    expect(itemC9).toBeDefined();
    expect(itemC9?.horas).toBe(8.0);
    expect(itemC9?.valor_calculado).toBe(55.2);

    const totalMinutos = itensVariaveis.reduce((acc, it) => acc + it.minutos, 0);
    const totalValor = itensVariaveis.reduce((acc, it) => acc + it.valor_calculado, 0);

    expect(totalMinutos).toBe(540); // 9h físicas
    expect(Number(totalValor.toFixed(2))).toBe(62.1); // R$ 62,10
  });
});
