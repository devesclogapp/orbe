import { describe, it, expect } from "vitest";
import {
  resolvePontoPresentation,
  formatFactualPunches,
} from "./rhPresentation.service";
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

describe("FIX 04.2-E — Sinalização das Pendências CLT na Interface RH", () => {
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

  const colabProvisorio: any = {
    ...colabApto,
    id: "colab-jorge",
    nome: "Jorge Bruno Ferreira De Souza",
    cadastro_provisorio: true,
    status_cadastro: "pendente_complemento",
  };

  const jornadaEmpresa = mockJornada({
    tenant_id: tenantId,
    empresa_id: empresaId,
    padrao: true,
  });

  const regraBanco: any = {
    id: "r-banco-1",
    tenant_id: tenantId,
    empresa_id: empresaId,
    bh_ativo: true,
    status: "ativo",
    carga_horaria_diaria: 8,
  };

  // 1. Bloqueio Cadastral -> CADASTRO PENDENTE
  it("1. bloqueio cadastral → Cadastro Pendente", () => {
    const ponto = {
      id: "p1",
      tenant_id: tenantId,
      data: "2026-09-28",
      entrada: "08:00",
      saida: "17:00",
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabProvisorio,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("CADASTRO_PENDENTE");
    expect(res.badgeLabel).toBe("Cadastro Pendente");
    expect(res.isBloqueado).toBe(true);
    expect(res.acaoNecessaria).toBe("Completar dados contratuais na Central de Cadastros.");
  });

  // 2. jornada_nao_parametrizada -> Jornada não parametrizada
  it("2. jornada_nao_parametrizada → Jornada Não Parametrizada", () => {
    const ponto = {
      id: "p2",
      tenant_id: tenantId,
      data: "2026-09-28",
      entrada: "08:00",
      saida: "17:00",
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [], // Sem jornadas
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("JORNADA_NAO_PARAMETRIZADA");
    expect(res.badgeLabel).toBe("Jornada Não Parametrizada");
    expect(res.explicacao).toContain("Não existe uma jornada de trabalho válida configurada");
    expect(res.acaoNecessaria).toBe("Ação necessária: Configurar jornada de trabalho.");
    expect(res.isBloqueado).toBe(true);
  });

  // 3. regra_banco_nao_parametrizada -> Regra de banco não parametrizada
  it("3. regra_banco_nao_parametrizada → Regra de Banco Não Parametrizada", () => {
    const ponto = {
      id: "p3",
      tenant_id: tenantId,
      data: "2026-09-28",
      entrada: "08:00",
      saida: "17:00",
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [], // Sem regra de banco
    });

    expect(res.statusVisual).toBe("REGRA_BANCO_NAO_PARAMETRIZADA");
    expect(res.badgeLabel).toBe("Regra de Banco Não Parametrizada");
    expect(res.explicacao).toContain("não existe uma política de banco de horas/compensação configurada");
    expect(res.acaoNecessaria).toBe("Ação necessária: Configurar regra de banco de horas.");
    expect(res.isBloqueado).toBe(true);
  });

  // 4. marcacao_incompleta -> Marcação incompleta
  it("4. marcacao_incompleta → Marcação Incompleta", () => {
    const ponto = {
      id: "p4",
      tenant_id: tenantId,
      data: "2026-09-15",
      entrada: "08:03",
      saida_almoco: "11:52",
      retorno_almoco: "17:52",
      saida: null,
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("MARCACAO_INCOMPLETA");
    expect(res.badgeLabel).toBe("Marcação Incompleta");
    expect(res.explicacao).toContain("Existem marcações de ponto insuficientes para calcular a jornada com segurança");
    expect(res.isBloqueado).toBe(true);
  });

  // 5. marcacao_invalida -> Marcação inválida
  it("5. marcacao_invalida → Marcação Inválida", () => {
    const ponto = {
      id: "p5",
      tenant_id: tenantId,
      data: "2026-09-28",
      entrada: "08:00",
      saida_almoco: "14:00",
      retorno_almoco: "12:00", // retorno antes do almoço
      saida: "17:00",
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("MARCACAO_INVALIDA");
    expect(res.badgeLabel).toBe("Marcação Inválida");
    expect(res.explicacao).toContain("As marcações possuem uma sequência de horários incompatível");
    expect(res.isBloqueado).toBe(true);
  });

  // 6. falta_pendente_justificativa -> Falta pendente de justificativa
  it("6. falta_pendente_justificativa → Falta Pendente de Justificativa", () => {
    const ponto = {
      id: "p6",
      tenant_id: tenantId,
      data: "2026-09-28", // Segunda-feira (trabalhável)
      entrada: null,
      saida_almoco: null,
      retorno_almoco: null,
      saida: null,
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("FALTA_PENDENTE_JUSTIFICATIVA");
    expect(res.badgeLabel).toBe("Falta Pendente de Justificativa");
    expect(res.explicacao).toContain("Era um dia previsto de trabalho, mas não existem marcações suficientes");
    expect(res.isBloqueado).toBe(true);
  });

  // 7. trabalho_em_dia_nao_trabalhavel -> Trabalho em dia não trabalhável
  it("7. trabalho_em_dia_nao_trabalhavel → Trabalho em Dia Não Trabalhável", () => {
    const ponto = {
      id: "p7",
      tenant_id: tenantId,
      data: "2026-09-27", // Domingo (DSR na grade)
      entrada: "08:00",
      saida_almoco: "12:00",
      retorno_almoco: "13:00",
      saida: "17:00",
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.statusVisual).toBe("TRABALHO_EM_DIA_NAO_TRABALHAVEL");
    expect(res.badgeLabel).toBe("Trabalho em Dia Não Trabalhável");
    expect(res.explicacao).toContain("Foram encontradas marcações em um dia configurado como não trabalhável");
    expect(res.isBloqueado).toBe(true);
  });

  // 8. valores financeiros/saldos aparecem como — quando bloqueado
  it("8. valores financeiros/saldos aparecem como — quando bloqueado", () => {
    const ponto = {
      id: "p8",
      tenant_id: tenantId,
      data: "2026-09-15",
      entrada: "08:03",
      saida_almoco: "11:52",
      retorno_almoco: "17:52",
      saida: null,
      status_processamento: "pendente",
    };

    const res = resolvePontoPresentation({
      ponto,
      colaborador: colabApto,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    expect(res.isBloqueado).toBe(true);
    expect(res.horasExtra).toBe("—");
    expect(res.atraso).toBe("—");
    expect(res.saldoDia).toBe("—");
    expect(res.saldoAcumulado).toBe("—");
    expect(res.horasBrutas).toBe("—");
  });

  // 9. marcação ausente aparece como —, nunca 00:00
  it("9. marcação ausente aparece como —, nunca 00:00", () => {
    const ponto = {
      entrada: "08:03:00",
      saida_almoco: null,
      retorno_almoco: "",
      saida: "17:53:00",
    };

    const factual = formatFactualPunches(ponto);
    expect(factual.entrada).toBe("08:03");
    expect(factual.saida_almoco).toBe("—");
    expect(factual.retorno_almoco).toBe("—");
    expect(factual.saida).toBe("17:53");

    // Garantir que nenhuma marcação ausente vira "00:00"
    expect(factual.saida_almoco).not.toBe("00:00");
    expect(factual.retorno_almoco).not.toBe("00:00");
  });

  // 10. precedência cadastral sobre demais bloqueios (Caso Jorge Bruno)
  it("10. precedência cadastral sobre demais bloqueios (Caso Jorge Bruno em 28/09 com 4 batidas válidas)", () => {
    const pontoJorge = {
      id: "p-jorge-28",
      tenant_id: tenantId,
      data: "2026-09-28",
      entrada: "08:03:00",
      saida_almoco: "11:56:00",
      retorno_almoco: "14:04:00",
      saida: "17:53:00",
      status_processamento: "pendente",
    };

    // Jorge possui 4 batidas perfeitas, mas cadastro_provisorio = true
    const res = resolvePontoPresentation({
      ponto: pontoJorge,
      colaborador: colabProvisorio,
      jornadas: [jornadaEmpresa],
      regras: [regraBanco],
    });

    // Deve acusar primariamente CADASTRO_PENDENTE
    expect(res.statusVisual).toBe("CADASTRO_PENDENTE");
    expect(res.badgeLabel).toBe("Cadastro Pendente");
    expect(res.isBloqueado).toBe(true);

    // Marcações factuais são preservadas exatamente
    expect(res.marcacoes.entrada).toBe("08:03");
    expect(res.marcacoes.saida_almoco).toBe("11:56");
    expect(res.marcacoes.retorno_almoco).toBe("14:04");
    expect(res.marcacoes.saida).toBe("17:53");

    // Sem saldos hipotéticos
    expect(res.saldoDia).toBe("—");
    expect(res.horasExtra).toBe("—");
    expect(res.atraso).toBe("—");
  });
});
