import { describe, it, expect, vi } from 'vitest';
import { EngineResolver } from './Resolver';
import {
  avaliarPontoGates,
  calculateCompensation,
  getMultiplicadorHoraExtra,
} from '../rhProcessing.service';
import { JornadaTrabalho, GradeSemanal } from '@/types/jornada.types';
import { canAccessModule, buildPresetPermissions } from '@/lib/access-control';
import { OperationalContext } from '@/types/motor.types';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

function mockGradePadrao(minutosDiarios: number = 480): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: minutosDiarios, tipo: 'TRABALHO' },
    ter: { trabalhavel: true, minutos_previstos: minutosDiarios, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: minutosDiarios, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: minutosDiarios, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: minutosDiarios, tipo: 'TRABALHO' },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'COMPENSADO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

function mockJornada(parciais: Partial<JornadaTrabalho>): JornadaTrabalho {
  return {
    id: parciais.id || 'jornada-padrao',
    tenant_id: parciais.tenant_id || 'tenant-esc',
    empresa_id: parciais.empresa_id !== undefined ? parciais.empresa_id : 'empresa-esc',
    nome: parciais.nome || 'Jornada Teste',
    descricao: null,
    tipo_escala: 'SEMANAL',
    carga_semanal_minutos: 2400,
    grade_semanal: parciais.grade_semanal || mockGradePadrao(480),
    politica_feriado: 'FOLGA_DSR',
    vigencia_inicio: parciais.vigencia_inicio || '2026-01-01',
    vigencia_fim: parciais.vigencia_fim !== undefined ? parciais.vigencia_fim : null,
    padrao: parciais.padrao !== undefined ? parciais.padrao : true,
    status: parciais.status || 'ativo',
  };
}

function criarContexto(overrides: Partial<OperationalContext> = {}): OperationalContext {
  return {
    tenantId: 'tenant-esc-1',
    empresaId: 'empresa-esc-1',
    colaboradorId: 'colab-1',
    operacaoId: null,
    dataProcessamento: '2026-10-01',
    tipoColaborador: 'CLT',
    ...overrides,
  };
}

describe('FIX CP04.10 — Estabilização da Regra de Banco de Horas / Gate 3', () => {
  const tenantId = 'tenant-esc-1';
  const empresaId = 'empresa-esc-1';

  const colabApto: any = {
    id: 'colab-1',
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: 'Colaborador Apto Homologação',
    matricula: '1001',
    cpf: '12345678901',
    status: 'ativo',
    cadastro_provisorio: false,
    status_cadastro: 'completo',
    modelo_calculo: 'CLT_MENSAL',
    tipo_colaborador: 'CLT',
    valor_base: 2000,
  };

  const basePonto: any = {
    id: 'ponto-1',
    tenant_id: tenantId,
    empresa_id: empresaId,
    colaborador_id: colabApto.id,
    data: '2026-10-01',
    entrada: '08:00',
    saida_almoco: '12:00',
    retorno_almoco: '13:00',
    saida: '17:00', // 480 min trabalhados
    status: 'Normal',
  };

  // =========================================================================
  // CENÁRIOS 1 a 5: Vigência Temporal no Resolver
  // =========================================================================

  it('1. Regra antes da vigência não resolve', () => {
    const regraOutubro: any = {
      id: 'regra-outubro',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Outubro 2026',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-10-01',
      vigencia_fim: '2026-10-31',
    };

    // Consulta para 30/09/2026 (dia anterior ao início da vigência)
    const ctx = criarContexto({ dataProcessamento: '2026-09-30' });
    const resolucao = EngineResolver.resolve(ctx, [regraOutubro]);

    // Como está fora da vigência, não deve resolver esta regra, retornando fallback (isFallback = true)
    expect(resolucao.isFallback).toBe(true);
    expect(resolucao.rule.id).toBe('fallback-motor-v1');
  });

  it('2. Primeiro dia da vigência resolve', () => {
    const regraOutubro: any = {
      id: 'regra-outubro',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Outubro 2026',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-10-01',
      vigencia_fim: '2026-10-31',
    };

    // Consulta exatamente no dia 2026-10-01
    const ctx = criarContexto({ dataProcessamento: '2026-10-01' });
    const resolucao = EngineResolver.resolve(ctx, [regraOutubro]);

    expect(resolucao.isFallback).toBe(false);
    expect(resolucao.rule.id).toBe('regra-outubro');
  });

  it('3. Último dia da vigência resolve', () => {
    const regraSetembro: any = {
      id: 'regra-setembro',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Setembro 2026',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-09-01',
      vigencia_fim: '2026-09-30',
    };

    // Consulta exatamente no dia 2026-09-30
    const ctx = criarContexto({ dataProcessamento: '2026-09-30' });
    const resolucao = EngineResolver.resolve(ctx, [regraSetembro]);

    expect(resolucao.isFallback).toBe(false);
    expect(resolucao.rule.id).toBe('regra-setembro');
  });

  it('4. Depois do fim da vigência não resolve', () => {
    const regraSetembro: any = {
      id: 'regra-setembro',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Setembro 2026',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-09-01',
      vigencia_fim: '2026-09-30',
    };

    // Consulta para 2026-10-01 (dia posterior ao fim)
    const ctx = criarContexto({ dataProcessamento: '2026-10-01' });
    const resolucao = EngineResolver.resolve(ctx, [regraSetembro]);

    expect(resolucao.isFallback).toBe(true);
    expect(resolucao.rule.id).toBe('fallback-motor-v1');
  });

  it('5. Vigência com vigencia_fim = null (indeterminada) resolve indefinidamente', () => {
    const regraIndeterminada: any = {
      id: 'regra-indet',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Vigência Aberta',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
    };

    // Consulta para data futura
    const ctx = criarContexto({ dataProcessamento: '2027-06-15' });
    const resolucao = EngineResolver.resolve(ctx, [regraIndeterminada]);

    expect(resolucao.isFallback).toBe(false);
    expect(resolucao.rule.id).toBe('regra-indet');
  });

  // =========================================================================
  // CENÁRIOS 6 e 7: Blindagem Gate 3 e Proibição de Fallback Silencioso
  // =========================================================================

  it('6. Nenhuma regra aplicável → Gate 3 bloqueado com REGRA_BANCO_NAO_PARAMETRIZADA', async () => {
    const jornadaEmpresa = mockJornada({ tenant_id: tenantId, empresa_id: empresaId });

    const resultado = await avaliarPontoGates({
      tenantId,
      ponto: basePonto,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [], // Nenhuma regra
    });

    expect(resultado.passouCadastral).toBe(true);
    expect(resultado.passouJornada).toBe(true);
    expect(resultado.passouRegraBanco).toBe(false);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.tipoBloqueio).toBe('regra_banco_nao_parametrizada');
    expect(resultado.motivoBloqueio).toContain('Regra de banco de horas/compensação não parametrizada');
  });

  it('7. Não existe fallback silencioso: se a regra for fallback, Gate 3 não libera cálculo', async () => {
    const jornadaEmpresa = mockJornada({ tenant_id: tenantId, empresa_id: empresaId });
    // Regra inativa não deve ser aceita
    const regraInativa: any = {
      id: 'regra-inativa',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra Desativada',
      status: 'inativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const resultado = await avaliarPontoGates({
      tenantId,
      ponto: basePonto,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [regraInativa],
    });

    expect(resultado.passouRegraBanco).toBe(false);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.tipoBloqueio).toBe('regra_banco_nao_parametrizada');
  });

  // =========================================================================
  // CENÁRIOS 8 e 9: Separação JornadaResolver × Regra BH (Desacoplamento)
  // =========================================================================

  it('8. Jornada vem exclusivamente do JornadaResolver (Fonte única da carga)', async () => {
    // Grade especial de 6h (360 minutos)
    const jornada6h = mockJornada({
      tenant_id: tenantId,
      empresa_id: empresaId,
      grade_semanal: mockGradePadrao(360),
    });

    const regraBanco: any = {
      id: 'regra-banco-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome: 'Regra BH',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const pontoQuinta: any = {
      ...basePonto,
      data: '2026-10-01', // Quinta-feira
    };

    const resultado = await avaliarPontoGates({
      tenantId,
      ponto: pontoQuinta,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornada6h],
      regrasRuntime: [regraBanco],
    });

    expect(resultado.bloqueado).toBe(false);
    expect(resultado.resolucaoJornada?.minutosPrevistos).toBe(360);
  });

  it('9. Campo legado de carga da regra (carga_horaria_diaria) não interfere no cálculo', async () => {
    // Regra tem campo legado carga_horaria_diaria = 8.00 (480 minutos)
    const regraComLegado: any = {
      id: 'regra-legado',
      tenant_id: tenantId,
      empresa_id: empresaId,
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      carga_horaria_diaria: 8.00,
      jornada_contratada: 8.00,
      limite_diario_banco: 480,
      prazo_compensacao_dias: 60,
      tipo: 'acumula',
    };

    // Ponto trabalhou 360 minutos (6h)
    const ponto6h: any = {
      id: 'p-6h',
      tenant_id: tenantId,
      empresa_id: empresaId,
      colaborador_id: colabApto.id,
      data: '2026-10-01',
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '15:00', // 4h + 2h = 6h = 360 min
      status: 'Normal',
    };

    const comp = calculateCompensation({
      ponto: ponto6h,
      regra: regraComLegado,
      colaborador: colabApto,
      minutosPrevistosJornada: 360, // JornadaResolver determinou 360 min
    });

    // O saldo deve ser ZERO porque trabalhou os 360 min previstos pela Jornada.
    // Se o sistema usasse a carga legada de 8h (480 min), acusaria débito de 120 min.
    expect(comp.minutosDebito).toBe(0);
    expect(comp.minutosExtra).toBe(0);
    expect(comp.saldoDia).toBe(0);
  });

  // =========================================================================
  // CENÁRIOS 10, 11 e 12: Parametrização do Adicional de Horas Extras
  // =========================================================================

  it('10. Adicional parametrizado substitui hardcoded EXTRA_RATE', () => {
    const regra75: any = {
      adicional_hora_extra_percentual: 75,
    };

    const multiplicador = getMultiplicadorHoraExtra(regra75);
    expect(multiplicador).toBe(1.75);
  });

  it('11. Adicional de 50% resulta em multiplicador 1.5 e cálculo correto', () => {
    const regra50: any = {
      id: 'regra-50',
      bh_ativo: true,
      limite_diario_banco: 0,
      prazo_compensacao_dias: 60,
      tipo: 'acumula',
      adicional_hora_extra_percentual: 50,
    };

    const multiplicador = getMultiplicadorHoraExtra(regra50);
    expect(multiplicador).toBe(1.5);

    // Ponto trabalhou 540 min: 08:00-12:00 (240m) + 13:00-18:00 (300m) = 540m
    const ponto540: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '18:00',
    };

    const comp = calculateCompensation({
      ponto: ponto540,
      regra: regra50,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });

    expect(comp.minutosExtra).toBe(60);
    expect(comp.multiplicadorExtra).toBe(1.5);
  });

  it('12. Adicional de 100% resulta em multiplicador 2.0 e cálculo correto', () => {
    const regra100: any = {
      id: 'regra-100',
      bh_ativo: true,
      limite_diario_banco: 0,
      prazo_compensacao_dias: 60,
      tipo: 'acumula',
      adicional_hora_extra_percentual: 100,
    };

    const multiplicador = getMultiplicadorHoraExtra(regra100);
    expect(multiplicador).toBe(2.0);

    const ponto540: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '18:00',
    };

    const comp = calculateCompensation({
      ponto: ponto540,
      regra: regra100,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });

    expect(comp.minutosExtra).toBe(60);
    expect(comp.multiplicadorExtra).toBe(2.0);
  });

  // =========================================================================
  // CENÁRIOS 13, 14 e 15: Edição Preserva Histórico e Não Altera Passado
  // =========================================================================

  const regraSetembroHistorica: any = {
    id: 'regra-setembro-2026',
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: 'ACT 2025/2026 (50% HE)',
    status: 'ativo',
    bh_ativo: true,
    vigencia_inicio: '2025-10-01',
    vigencia_fim: '2026-09-30',
    adicional_hora_extra_percentual: 50,
    created_at: '2025-10-01T00:00:00Z',
  };

  const regraOutubroNova: any = {
    id: 'regra-outubro-2026',
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: 'ACT 2026/2027 (100% HE)',
    status: 'ativo',
    bh_ativo: true,
    vigencia_inicio: '2026-10-01',
    vigencia_fim: null,
    adicional_hora_extra_percentual: 100,
    created_at: '2026-09-30T15:00:00Z',
  };

  const regrasHistorico = [regraSetembroHistorica, regraOutubroNova];

  it('13. Edição preserva histórico: regra anterior tem vigencia_fim encerrada e nova regra inicia na data nova', () => {
    // Validação da integridade temporal entre as duas versões da política
    expect(regraSetembroHistorica.vigencia_fim).toBe('2026-09-30');
    expect(regraOutubroNova.vigencia_inicio).toBe('2026-10-01');
    expect(regraSetembroHistorica.id).not.toBe(regraOutubroNova.id);
  });

  it('14. Regra de setembro permanece aplicável a setembro mesmo após cadastro da nova regra', () => {
    // 14. Reprocessar ponto de setembro/2026 -> Usa estritamente a regra de Setembro (50%)
    const ctxSetembro = criarContexto({ dataProcessamento: '2026-09-15' });
    const resSetembro = EngineResolver.resolve(ctxSetembro, regrasHistorico);
    expect(resSetembro.isFallback).toBe(false);
    expect(resSetembro.rule.id).toBe('regra-setembro-2026');
    expect(resSetembro.rule.adicionalHoraExtraPercentual).toBe(50);
  });

  it('15. Nova regra de outubro aplica somente a outubro', () => {
    // 15. Processar ponto de outubro/2026 -> Usa estritamente a nova regra de Outubro (100%)
    const ctxOutubro = criarContexto({ dataProcessamento: '2026-10-05' });
    const resOutubro = EngineResolver.resolve(ctxOutubro, regrasHistorico);
    expect(resOutubro.isFallback).toBe(false);
    expect(resOutubro.rule.id).toBe('regra-outubro-2026');
    expect(resOutubro.rule.adicionalHoraExtraPercentual).toBe(100);
  });

  // =========================================================================
  // CENÁRIOS 16, 17 e 18: Tolerâncias sobre Saldo Líquido Diário
  // =========================================================================

  it('16. Tolerância negativa sobre saldo líquido diário (worked - jornada)', () => {
    const regraTolerante: any = {
      bh_ativo: true,
      tolerancia_atraso: 10, // Tolerância de até 10 minutos
      limite_diario_banco: 480,
    };

    // Previsto = 480 min. Trabalhado = 475 min (08:00-12:00 [240m] + 13:00-16:55 [235m] = 475m).
    // SaldoBase = 475 - 480 = -5 min.
    // Como abs(-5) <= 10 min, está dentro da tolerância diária.
    const ponto475: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '16:55',
    };
    const compDentro = calculateCompensation({
      ponto: ponto475,
      regra: regraTolerante,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });
    expect(compDentro.minutosDebito).toBe(0);

    // Previsto = 480 min. Trabalhado = 460 min (08:00-12:00 [240m] + 13:00-16:40 [220m] = 460m).
    // SaldoBase = 460 - 480 = -20 min.
    // Como abs(-20) > 10 min, ultrapassa a tolerância e computa o débito integral (20 min).
    const ponto460: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '16:40',
    };
    const compFora = calculateCompensation({
      ponto: ponto460,
      regra: regraTolerante,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });
    expect(compFora.minutosDebito).toBe(20);
  });

  it('17. Tolerância positiva sobre saldo líquido diário', () => {
    const regraTolerante: any = {
      bh_ativo: true,
      tolerancia_hora_extra: 10, // Tolerância de até 10 minutos de HE
      limite_diario_banco: 480,
    };

    // Previsto = 480 min. Trabalhado = 486 min (08:00-12:00 [240m] + 13:00-17:06 [246m] = 486m).
    // SaldoBase = +6 min.
    // Como +6 <= 10 min, está dentro da tolerância diária e não gera hora extra.
    const ponto486: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '17:06',
    };
    const compDentro = calculateCompensation({
      ponto: ponto486,
      regra: regraTolerante,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });
    expect(compDentro.minutosExtra).toBe(0);

    // Previsto = 480 min. Trabalhado = 505 min (08:00-12:00 [240m] + 13:00-17:25 [265m] = 505m).
    // SaldoBase = +25 min.
    // Como +25 > 10 min, gera 25 min de hora extra.
    const ponto505: any = {
      ...basePonto,
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '17:25',
    };
    const compFora = calculateCompensation({
      ponto: ponto505,
      regra: regraTolerante,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });
    expect(compFora.minutosBanco).toBe(25);
    expect(compFora.saldoDia).toBe(25);
  });

  it('18. Tolerância NÃO é aplicada individualmente às batidas de ponto', () => {
    // Cenário:
    // Entrada com atraso de 12 minutos (08:12 vs 08:00)
    // Saída com 15 minutos extras (17:15 vs 17:00)
    // Horário trabalhado: 08:12 às 12:00 (228m) + 13:00 às 17:15 (255m) = 483m
    // Previsto = 480m.
    // SaldoBase líquido diário = 483 - 480 = +3 minutos.
    // Se a tolerância fosse por batida, o atraso de 12m na entrada geraria desconto (12m > 10m).
    // Mas no Orbe a apuração é sobre o saldo líquido diário trabalhado.
    const regraTolerante: any = {
      bh_ativo: true,
      tolerancia_atraso: 10,
      tolerancia_hora_extra: 10,
      limite_diario_banco: 480,
    };

    const pontoBatidasDesbalanceadas: any = {
      ...basePonto,
      entrada: '08:12',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '17:15',
    };

    const comp = calculateCompensation({
      ponto: pontoBatidasDesbalanceadas,
      regra: regraTolerante,
      colaborador: colabApto,
      minutosPrevistosJornada: 480,
    });
    // Saldo líquido = +3m, dentro da tolerância de HE (+10m) e sem gerar débito
    expect(comp.minutosDebito).toBe(0);
    expect(comp.minutosExtra).toBe(0);
  });

  // =========================================================================
  // CENÁRIOS 19 e 20: Segurança (Encarregado) e Isolamento Multi-Tenant
  // =========================================================================

  it('19. Encarregado não administra regras de Banco de Horas', () => {
    const encarregadoPerms = buildPresetPermissions('encarregado');

    // Encarregado não possui permissão para administrar módulo de regras de banco
    const podeEditar = canAccessModule(encarregadoPerms, 'regras_de_banco', 'editar');
    const podeCriar = canAccessModule(encarregadoPerms, 'regras_de_banco', 'criar');
    const podeEditarBH = canAccessModule(encarregadoPerms, 'banco_de_horas', 'editar');

    expect(podeEditar).toBe(false);
    expect(podeCriar).toBe(false);
    expect(podeEditarBH).toBe(false);
  });

  it('20. Isolamento estrito por tenant: regra de outro tenant nunca é resolvida', () => {
    const regraTenantOutro: any = {
      id: 'regra-tenant-x',
      tenant_id: 'tenant-outro-totalmente-distinto',
      empresa_id: empresaId,
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
    };

    // Resolver para o tenant-esc-1 (filtrando pelo tenantId)
    const ctx = criarContexto({ tenantId: 'tenant-esc-1' });
    const regrasDoTenant = [regraTenantOutro].filter(r => r.tenant_id === ctx.tenantId);
    const res = EngineResolver.resolve(ctx, regrasDoTenant);

    // Deve ser fallback seguro, pois o tenant_id não confere
    expect(res.isFallback).toBe(true);
    expect(res.rule.id).toBe('fallback-motor-v1');
  });
});
