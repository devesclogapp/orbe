import { describe, it, expect, vi } from 'vitest';
import { EngineResolver } from './Resolver';
import { RulePriority, OperationalContext } from '@/types/motor.types';
import { validarConflitoRegrasBH, checarSobreposicaoVigencia, BHRegraService } from '@/services/v4.service';
import { avaliarPontoGates } from '../rhProcessing.service';
import { JornadaTrabalho } from '@/types/jornada.types';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

function mockJornada(tenantId: string, empresaId: string): JornadaTrabalho {
  return {
    id: 'jornada-padrao',
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: 'Jornada Teste 44h',
    descricao: null,
    tipo_escala: 'SEMANAL',
    carga_semanal_minutos: 2640,
    grade_semanal: {
      seg: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
      ter: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
      qua: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
      qui: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
      sex: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
      sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'COMPENSADO' },
      dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
    },
    politica_feriado: 'FOLGA_DSR',
    vigencia_inicio: '2026-01-01',
    vigencia_fim: null,
    padrao: true,
    status: 'ativo',
  };
}

function criarContexto(overrides: Partial<OperationalContext> = {}): OperationalContext {
  return {
    tenantId: 'tenant-esc-1',
    empresaId: 'empresa-A',
    colaboradorId: 'colab-1',
    operacaoId: null,
    dataProcessamento: '2026-10-01',
    tipoColaborador: 'CLT',
    ...overrides,
  };
}

describe('CP05.4 — ESCOPO GERAL, COMPARTILHADO E ESPECÍFICO DAS REGRAS DE BANCO DE HORAS', () => {
  const tenantId = 'tenant-esc-1';
  const empA = 'empresa-A';
  const empB = 'empresa-B';
  const empC = 'empresa-C';

  // =========================================================================
  // CENÁRIO 1: Somente regra geral → Empresa A resolve regra geral
  // =========================================================================
  it('1. Somente regra geral: Empresa A resolve regra geral', () => {
    const regraGeral: any = {
      id: 'regra-geral',
      tenant_id: tenantId,
      nome: 'Regra Geral Tenant',
      escopo: 'TODAS_EMPRESAS',
      empresa_id: null,
      empresas_ids: [],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
    };

    const ctx = criarContexto({ empresaId: empA, dataProcessamento: '2026-10-01' });
    const res = EngineResolver.resolve(ctx, [regraGeral]);

    expect(res.isFallback).toBe(false);
    expect(res.rule.id).toBe('regra-geral');
    expect(res.escopoResolvido).toBe('GERAL_TENANT');
    expect(res.rule.prioridade).toBe(RulePriority.GERAL_TENANT);
  });

  // =========================================================================
  // CENÁRIO 2: Geral + Compartilhada A/B
  // Empresa A → Compartilhada
  // Empresa C → Geral
  // =========================================================================
  it('2. Geral + compartilhada A/B: Empresa A resolve compartilhada e Empresa C resolve geral', () => {
    const regraGeral: any = {
      id: 'regra-geral',
      tenant_id: tenantId,
      nome: 'Regra Geral',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const regraCompartilhadaAB: any = {
      id: 'regra-comp-ab',
      tenant_id: tenantId,
      nome: 'Regra Compartilhada Filiais A e B',
      escopo: 'COMPARTILHADA',
      empresas_ids: [empA, empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const pool = [regraGeral, regraCompartilhadaAB];

    // Consulta para Empresa A:
    const ctxA = criarContexto({ empresaId: empA });
    const resA = EngineResolver.resolve(ctxA, pool);
    expect(resA.isFallback).toBe(false);
    expect(resA.rule.id).toBe('regra-comp-ab');
    expect(resA.escopoResolvido).toBe('COMPARTILHADA');
    expect(resA.rule.prioridade).toBe(RulePriority.COMPARTILHADA);

    // Consulta para Empresa C (que não está na compartilhada):
    const ctxC = criarContexto({ empresaId: empC });
    const resC = EngineResolver.resolve(ctxC, pool);
    expect(resC.isFallback).toBe(false);
    expect(resC.rule.id).toBe('regra-geral');
    expect(resC.escopoResolvido).toBe('GERAL_TENANT');
  });

  // =========================================================================
  // CENÁRIO 3: Geral + Compartilhada A/B + Específica B
  // A → Compartilhada
  // B → Específica (Precedência 100 > 80)
  // C → Geral
  // =========================================================================
  it('3. Geral + compartilhada A/B + específica B: A resolve compartilhada, B resolve específica, C resolve geral', () => {
    const regraGeral: any = {
      id: 'regra-geral',
      tenant_id: tenantId,
      nome: 'Regra Geral',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const regraCompartilhadaAB: any = {
      id: 'regra-comp-ab',
      tenant_id: tenantId,
      nome: 'Regra Compartilhada A e B',
      escopo: 'COMPARTILHADA',
      empresas_ids: [empA, empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const regraEspecificaB: any = {
      id: 'regra-esp-b',
      tenant_id: tenantId,
      nome: 'Regra Específica Filial B',
      escopo: 'ESPECIFICA',
      empresa_id: empB,
      empresas_ids: [empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const pool = [regraGeral, regraCompartilhadaAB, regraEspecificaB];

    // Empresa A:
    const resA = EngineResolver.resolve(criarContexto({ empresaId: empA }), pool);
    expect(resA.rule.id).toBe('regra-comp-ab');
    expect(resA.escopoResolvido).toBe('COMPARTILHADA');

    // Empresa B:
    const resB = EngineResolver.resolve(criarContexto({ empresaId: empB }), pool);
    expect(resB.rule.id).toBe('regra-esp-b');
    expect(resB.escopoResolvido).toBe('ESPECIFICA');
    expect(resB.rule.prioridade).toBe(RulePriority.ESPECIFICA);

    // Empresa C:
    const resC = EngineResolver.resolve(criarContexto({ empresaId: empC }), pool);
    expect(resC.rule.id).toBe('regra-geral');
    expect(resC.escopoResolvido).toBe('GERAL_TENANT');
  });

  // =========================================================================
  // CENÁRIO 4: Compartilhada sem geral
  // A → Compartilhada
  // C → SEM REGRA / Gate 3 bloqueado
  // =========================================================================
  it('4. Compartilhada sem geral: A resolve compartilhada e C fica SEM REGRA', () => {
    const regraCompartilhadaAB: any = {
      id: 'regra-comp-ab',
      tenant_id: tenantId,
      nome: 'Regra Compartilhada A e B',
      escopo: 'COMPARTILHADA',
      empresas_ids: [empA, empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const pool = [regraCompartilhadaAB];

    const resA = EngineResolver.resolve(criarContexto({ empresaId: empA }), pool);
    expect(resA.isFallback).toBe(false);
    expect(resA.rule.id).toBe('regra-comp-ab');

    const resC = EngineResolver.resolve(criarContexto({ empresaId: empC }), pool);
    expect(resC.isFallback).toBe(true);
    expect(resC.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 5: Específica sem geral
  // B → Específica
  // A → SEM REGRA
  // =========================================================================
  it('5. Específica sem geral: B resolve específica e A fica SEM REGRA', () => {
    const regraEspecificaB: any = {
      id: 'regra-esp-b',
      tenant_id: tenantId,
      nome: 'Regra Específica B',
      escopo: 'ESPECIFICA',
      empresa_id: empB,
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    const pool = [regraEspecificaB];

    const resB = EngineResolver.resolve(criarContexto({ empresaId: empB }), pool);
    expect(resB.isFallback).toBe(false);
    expect(resB.rule.id).toBe('regra-esp-b');

    const resA = EngineResolver.resolve(criarContexto({ empresaId: empA }), pool);
    expect(resA.isFallback).toBe(true);
    expect(resA.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 6: Vigência futura
  // Não pode resolver antes da vigência
  // =========================================================================
  it('6. Vigência futura: Não pode resolver antes do início da vigência', () => {
    const regraFutura: any = {
      id: 'regra-2027',
      tenant_id: tenantId,
      nome: 'Regra Futura 2027',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2027-01-01',
      vigencia_fim: '2027-12-31',
    };

    const ctx = criarContexto({ dataProcessamento: '2026-12-31' });
    const res = EngineResolver.resolve(ctx, [regraFutura]);

    expect(res.isFallback).toBe(true);
    expect(res.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 7: Vigência encerrada
  // Não pode resolver após vigencia_fim
  // =========================================================================
  it('7. Vigência encerrada: Não pode resolver após vigencia_fim', () => {
    const regraPassada: any = {
      id: 'regra-passada',
      tenant_id: tenantId,
      nome: 'Regra Encerrada em Setembro',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-09-30',
    };

    const ctx = criarContexto({ dataProcessamento: '2026-10-01' });
    const res = EngineResolver.resolve(ctx, [regraPassada]);

    expect(res.isFallback).toBe(true);
    expect(res.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 8: Duas regras específicas sobrepostas da mesma empresa
  // → Configuração rejeitada
  // =========================================================================
  it('8. Duas regras específicas sobrepostas: Configuração rejeitada por validarConflitoRegrasBH', () => {
    const regrasExistentes = [
      {
        id: 'regra-esp-1',
        nome: 'Regra Específica A - 2026',
        escopo: 'ESPECIFICA',
        empresa_id: empA,
        empresas_ids: [empA],
        status: 'ativo',
        bh_ativo: true,
        vigencia_inicio: '2026-01-01',
        vigencia_fim: '2026-12-31',
      }
    ];

    const novaRegraConflitante = {
      nome: 'Regra Específica A - Nova Concorrente',
      escopo: 'ESPECIFICA' as const,
      empresa_id: empA,
      empresas_ids: [empA],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-06-01',
      vigencia_fim: '2026-12-31',
    };

    expect(() => {
      validarConflitoRegrasBH(regrasExistentes, novaRegraConflitante);
    }).toThrowError(/Conflito de Regras: A empresa .* já possui uma Regra Específica ativa/);
  });

  // =========================================================================
  // CENÁRIO 9: Duas compartilhadas sobrepostas atingindo mesma empresa
  // → Configuração rejeitada
  // =========================================================================
  it('9. Duas compartilhadas sobrepostas atingindo mesma empresa: Configuração rejeitada', () => {
    const regrasExistentes = [
      {
        id: 'regra-comp-1',
        nome: 'Compartilhada 1 (Empresa 1 + Empresa 2)',
        escopo: 'COMPARTILHADA',
        empresas_ids: [empA, empB],
        status: 'ativo',
        bh_ativo: true,
        vigencia_inicio: '2026-01-01',
        vigencia_fim: '2026-12-31',
      }
    ];

    const novaRegraConflitante = {
      nome: 'Compartilhada 2 (Empresa 2 + Empresa 3)',
      escopo: 'COMPARTILHADA' as const,
      empresas_ids: [empB, empC],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-06-01',
      vigencia_fim: '2026-12-31',
    };

    expect(() => {
      validarConflitoRegrasBH(regrasExistentes, novaRegraConflitante);
    }).toThrowError(/já está associada à Regra Compartilhada ativa/);
  });

  // =========================================================================
  // CENÁRIO 10: Geral + Específica sobrepostas
  // → Permitido; Específica vence
  // =========================================================================
  it('10. Geral + específica sobrepostas: Permitido na validação; Específica vence no Resolver', () => {
    const regrasExistentes = [
      {
        id: 'regra-geral',
        nome: 'Regra Geral',
        escopo: 'TODAS_EMPRESAS',
        status: 'ativo',
        bh_ativo: true,
        vigencia_inicio: '2026-01-01',
        vigencia_fim: null,
      }
    ];

    const novaRegraEspecifica = {
      id: 'regra-esp-a',
      nome: 'Regra Específica A',
      escopo: 'ESPECIFICA' as const,
      empresa_id: empA,
      empresas_ids: [empA],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
    };

    // 1. Validação de conflito não deve lançar erro
    expect(() => {
      validarConflitoRegrasBH(regrasExistentes, novaRegraEspecifica);
    }).not.toThrow();

    // 2. No Resolver, a Específica deve vencer para a Empresa A
    const pool = [...regrasExistentes, novaRegraEspecifica];
    const resA = EngineResolver.resolve(criarContexto({ empresaId: empA }), pool);
    expect(resA.rule.id).toBe('regra-esp-a');
    expect(resA.escopoResolvido).toBe('ESPECIFICA');
  });

  // =========================================================================
  // CENÁRIO 11: Geral + Compartilhada sobrepostas
  // → Permitido; Compartilhada vence
  // =========================================================================
  it('11. Geral + compartilhada sobrepostas: Permitido na validação; Compartilhada vence no Resolver', () => {
    const regrasExistentes = [
      {
        id: 'regra-geral',
        nome: 'Regra Geral',
        escopo: 'TODAS_EMPRESAS',
        status: 'ativo',
        bh_ativo: true,
        vigencia_inicio: '2026-01-01',
      }
    ];

    const novaRegraCompartilhada = {
      id: 'regra-comp-ab',
      nome: 'Regra Compartilhada AB',
      escopo: 'COMPARTILHADA' as const,
      empresas_ids: [empA, empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    expect(() => {
      validarConflitoRegrasBH(regrasExistentes, novaRegraCompartilhada);
    }).not.toThrow();

    const pool = [...regrasExistentes, novaRegraCompartilhada];
    const resA = EngineResolver.resolve(criarContexto({ empresaId: empA }), pool);
    expect(resA.rule.id).toBe('regra-comp-ab');
    expect(resA.escopoResolvido).toBe('COMPARTILHADA');
  });

  // =========================================================================
  // CENÁRIO 12: Compartilhada + Específica sobrepostas
  // → Permitido; Específica vence
  // =========================================================================
  it('12. Compartilhada + específica: Permitido na validação; Específica vence no Resolver', () => {
    const regrasExistentes = [
      {
        id: 'regra-comp-ab',
        nome: 'Regra Compartilhada AB',
        escopo: 'COMPARTILHADA',
        empresas_ids: [empA, empB],
        status: 'ativo',
        bh_ativo: true,
        vigencia_inicio: '2026-01-01',
      }
    ];

    const novaRegraEspecificaB = {
      id: 'regra-esp-b',
      nome: 'Regra Específica B',
      escopo: 'ESPECIFICA' as const,
      empresa_id: empB,
      empresas_ids: [empB],
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    expect(() => {
      validarConflitoRegrasBH(regrasExistentes, novaRegraEspecificaB);
    }).not.toThrow();

    const pool = [...regrasExistentes, novaRegraEspecificaB];
    const resB = EngineResolver.resolve(criarContexto({ empresaId: empB }), pool);
    expect(resB.rule.id).toBe('regra-esp-b');
    expect(resB.escopoResolvido).toBe('ESPECIFICA');
  });

  // =========================================================================
  // CENÁRIO 13: Regra global + empresa criada posteriormente
  // → Global deve alcançá-la
  // =========================================================================
  it('13. Regra global alcança automaticamente empresa criada posteriormente', () => {
    const regraGeral: any = {
      id: 'regra-geral-antiga',
      tenant_id: tenantId,
      nome: 'Regra Geral Existente',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    // Empresa criada futuramente (ex: empresa-nova-2027)
    const empNova = 'empresa-nova-criada-depois';
    const ctx = criarContexto({ empresaId: empNova });

    const res = EngineResolver.resolve(ctx, [regraGeral]);
    expect(res.isFallback).toBe(false);
    expect(res.rule.id).toBe('regra-geral-antiga');
    expect(res.escopoResolvido).toBe('GERAL_TENANT');
  });

  // =========================================================================
  // CENÁRIO 14: Seleção explícita de todas as empresas atuais + empresa nova
  // → Empresa nova NÃO deve entrar na regra compartilhada
  // =========================================================================
  it('14. Seleção explícita de todas as empresas atuais: Empresa nova NÃO entra na compartilhada', () => {
    // Quando o usuário clica em "Selecionar todas", vira uma seleção explícita
    // das empresas existentes naquele instante (A, B, C) sob escopo COMPARTILHADA
    const regraCompartilhadaTodasAtuais: any = {
      id: 'regra-comp-atuais',
      tenant_id: tenantId,
      nome: 'Regra Compartilhada de Filiais Atuais',
      escopo: 'COMPARTILHADA',
      empresas_ids: [empA, empB, empC], // Conjunto fechado
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    // Empresa recém-criada (não estava no conjunto fechado de seleção)
    const empRecente = 'empresa-recem-criada';
    const ctxNova = criarContexto({ empresaId: empRecente });

    const res = EngineResolver.resolve(ctxNova, [regraCompartilhadaTodasAtuais]);
    // Como não é regra geral e a nova empresa não estava no array explícito, bloqueia com SEM_REGRA
    expect(res.isFallback).toBe(true);
    expect(res.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 15: Isolamento tenant A × tenant B
  // =========================================================================
  it('15. Isolamento tenant A x tenant B: Regra do tenant A não é resolvida para tenant B', () => {
    const regraTenantA: any = {
      id: 'regra-tenant-a',
      tenant_id: 'tenant-A',
      nome: 'Regra Tenant A',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
    };

    // Contexto com tenant B (após filtragem segura de tenant na query de serviço)
    // Se o serviço buscar apenas regras do tenant B, o array estará vazio
    const ctxTenantB = criarContexto({ tenantId: 'tenant-B', empresaId: 'empresa-qualquer' });
    const regrasDoTenantB: any[] = []; // Simula retorno da query com tenant_id = tenant-B

    const res = EngineResolver.resolve(ctxTenantB, regrasDoTenantB);
    expect(res.isFallback).toBe(true);
    expect(res.escopoResolvido).toBe('SEM_REGRA');
  });

  // =========================================================================
  // CENÁRIO 16: Integração Gate 3 com avaliarPontoGates
  // =========================================================================
  it('16. Gate 3 bloqueia quando escopo resolve SEM_REGRA e passa quando há regra válida', async () => {
    const colabApto: any = {
      id: 'colab-gate',
      tenant_id: tenantId,
      empresa_id: empA,
      nome: 'Colaborador Teste Escopo',
      matricula: '1001',
      cpf: '12345678901',
      status: 'ativo',
      status_cadastro: 'completo',
      modelo_calculo: 'CLT_MENSAL',
      tipo_colaborador: 'CLT',
      valor_base: 2500,
    };

    const ponto: any = {
      id: 'ponto-teste',
      tenant_id: tenantId,
      empresa_id: empA,
      colaborador_id: colabApto.id,
      data: '2026-10-01',
      entrada: '08:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida: '17:00',
      status: 'Normal',
    };

    const jornada = mockJornada(tenantId, empA);

    // 1. Sem regras disponíveis → Gate 3 bloqueia por regra_banco_nao_parametrizada
    const resBloqueado = await avaliarPontoGates({
      tenantId,
      ponto,
      colaborador: colabApto,
      resolvedEmpresaId: empA,
      jornadasRuntime: [jornada],
      regrasRuntime: [],
    });

    expect(resBloqueado.passouCadastral).toBe(true);
    expect(resBloqueado.passouJornada).toBe(true);
    expect(resBloqueado.passouRegraBanco).toBe(false);
    expect(resBloqueado.bloqueado).toBe(true);
    expect(resBloqueado.tipoBloqueio).toBe('regra_banco_nao_parametrizada');

    // 2. Com regra geral aplicável → Gate 3 passa
    const regraGeral: any = {
      id: 'regra-geral-apta',
      tenant_id: tenantId,
      nome: 'Regra Geral Tenant',
      escopo: 'TODAS_EMPRESAS',
      status: 'ativo',
      bh_ativo: true,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
      tolerancia_atraso: 10,
      tolerancia_hora_extra: 10,
      limite_diario_banco: 120,
      prazo_compensacao_dias: 180,
    };

    const resLiberado = await avaliarPontoGates({
      tenantId,
      ponto,
      colaborador: colabApto,
      resolvedEmpresaId: empA,
      jornadasRuntime: [jornada],
      regrasRuntime: [regraGeral],
    });

    expect(resLiberado.passouCadastral).toBe(true);
    expect(resLiberado.passouJornada).toBe(true);
    expect(resLiberado.passouRegraBanco).toBe(true);
    expect(resLiberado.bloqueado).toBe(false);
  });
});
