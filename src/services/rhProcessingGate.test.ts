import { describe, it, expect, vi } from 'vitest';
import {
  avaliarPontoGates,
  calculateCompensation,
} from './rhProcessing.service';
import { JornadaTrabalho, GradeSemanal } from '@/types/jornada.types';

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

function mockGrade44h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    ter: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: 528, tipo: 'TRABALHO' },
    sab: { trabalhavel: false, minutos_previstos: 0, tipo: 'COMPENSADO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

function mockJornada(parciais: Partial<JornadaTrabalho>): JornadaTrabalho {
  return {
    id: parciais.id || 'jornada-1',
    tenant_id: parciais.tenant_id || 'tenant-test',
    empresa_id: parciais.empresa_id !== undefined ? parciais.empresa_id : 'empresa-test',
    nome: parciais.nome || 'Jornada Empresa Teste',
    descricao: null,
    tipo_escala: 'SEMANAL',
    carga_semanal_minutos: 2640,
    grade_semanal: parciais.grade_semanal || mockGrade44h(),
    politica_feriado: parciais.politica_feriado || 'FOLGA_DSR',
    vigencia_inicio: parciais.vigencia_inicio || '2026-01-01',
    vigencia_fim: parciais.vigencia_fim !== undefined ? parciais.vigencia_fim : null,
    padrao: parciais.padrao !== undefined ? parciais.padrao : true,
    status: parciais.status || 'ativo',
  };
}

describe('FIX 04.2-C — Gates de Segurança e Bloqueio de Fallback no Pipeline CLT', () => {
  const tenantId = 'tenant-test';
  const empresaId = 'empresa-test';

  const colabApto: any = {
    id: 'colab-apto-1',
    tenant_id: tenantId,
    empresa_id: empresaId,
    nome: 'Colaborador Apto',
    matricula: '1001',
    cpf: '12345678901',
    status: 'ativo',
    cadastro_provisorio: false,
    status_cadastro: 'completo',
    modelo_calculo: 'CLT_MENSAL',
    tipo_contrato: 'mensal',
    tipo_colaborador: 'CLT',
    valor_base: 1518,
  };

  const colabBloqueado: any = {
    ...colabApto,
    id: 'colab-bloqueado-1',
    nome: 'Colaborador Bloqueado Provisório',
    cadastro_provisorio: true,
    status_cadastro: 'pendente_complemento',
  };

  const pontoSegunda: any = {
    id: 'ponto-seg-1',
    tenant_id: tenantId,
    empresa_id: empresaId,
    colaborador_id: colabApto.id,
    data: '2026-09-28', // Segunda-feira (dia útil normal)
    entrada: '08:00',
    saida_almoco: '12:00',
    retorno_almoco: '13:00',
    saida: '17:48',
    status: 'Normal',
  };

  const pontoDomingo: any = {
    id: 'ponto-dom-1',
    tenant_id: tenantId,
    empresa_id: empresaId,
    colaborador_id: colabApto.id,
    data: '2026-09-27', // Domingo (DSR)
    entrada: null,
    saida_almoco: null,
    retorno_almoco: null,
    saida: null,
    status: 'pendente',
  };

  it('CENÁRIO A — Cadastro apto + SEM jornada configurada: Bloqueado com JORNADA_NAO_PARAMETRIZADA', async () => {
    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [], // Nenhuma jornada
      regrasRuntime: [],
    });

    expect(res.passouCadastral).toBe(true);
    expect(res.passouJornada).toBe(false);
    expect(res.bloqueado).toBe(true);
    expect(res.tipoBloqueio).toBe('jornada_nao_parametrizada');
    expect(res.motivoBloqueio).toContain('Jornada de trabalho não parametrizada');
    expect(res.resolucaoJornada?.minutosPrevistos).toBeNull();
  });

  it('CENÁRIO B — Cadastro bloqueado (provisório): Gate cadastral tem precedência total', async () => {
    const jornadaEmpresa = mockJornada({ tenant_id: tenantId, empresa_id: empresaId });

    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabBloqueado,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [],
    });

    expect(res.passouCadastral).toBe(false);
    expect(res.bloqueado).toBe(true);
    expect(res.tipoBloqueio).toBe('bloqueio_cadastral');
    expect(res.motivoBloqueio).toContain('Cadastro provisório');
  });

  it('CENÁRIO C — Cadastro apto + jornada válida da empresa: Atravessa Gate de Jornada', async () => {
    const jornadaEmpresa = mockJornada({
      id: 'j-empresa-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      padrao: true,
    });
    const regraBanco: any = {
      id: 'r-banco-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      bh_ativo: true,
      status: 'ativo',
      carga_horaria_diaria: 8,
      tolerancia_atraso: 10,
      tolerancia_hora_extra: 10,
    };

    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [regraBanco],
    });

    expect(res.passouCadastral).toBe(true);
    expect(res.passouJornada).toBe(true);
    expect(res.passouRegraBanco).toBe(true);
    expect(res.bloqueado).toBe(false);
    expect(res.resolucaoJornada?.origem).toBe('EMPRESA');
    expect(res.resolucaoJornada?.minutosPrevistos).toBe(528);
  });

  it('CENÁRIO D — Cadastro apto + jornada específica do colaborador: Origem COLABORADOR', async () => {
    const jornadaEmpresa = mockJornada({
      id: 'j-empresa-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      padrao: true,
    });
    const jornadaColab = mockJornada({
      id: 'j-colab-especifica',
      tenant_id: tenantId,
      empresa_id: empresaId,
      padrao: false,
    });

    const colabComJornada = {
      ...colabApto,
      jornada_id: 'j-colab-especifica',
    };

    const regraBanco: any = {
      id: 'r-banco-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      bh_ativo: true,
      status: 'ativo',
      carga_horaria_diaria: 8,
    };

    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabComJornada,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa, jornadaColab],
      regrasRuntime: [regraBanco],
    });

    expect(res.bloqueado).toBe(false);
    expect(res.resolucaoJornada?.origem).toBe('COLABORADOR');
    expect(res.resolucaoJornada?.jornadaId).toBe('j-colab-especifica');
  });

  it('CENÁRIO E — Jornada fora de vigência: Bloqueado no Gate de Jornada', async () => {
    const jornadaForaVigencia = mockJornada({
      tenant_id: tenantId,
      empresa_id: empresaId,
      vigencia_inicio: '2026-10-01', // vigência futura para data de 2026-09-28
    });

    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaForaVigencia],
      regrasRuntime: [],
    });

    expect(res.bloqueado).toBe(true);
    expect(res.tipoBloqueio).toBe('jornada_nao_parametrizada');
  });

  it('CENÁRIO F — Domingo / DSR parametrizado com 0 min previstos: NÃO é SEM_JORNADA e NÃO debita 8h', async () => {
    const jornadaEmpresa = mockJornada({
      tenant_id: tenantId,
      empresa_id: empresaId,
      padrao: true,
      grade_semanal: mockGrade44h(), // dom = 0 min DSR
    });
    const regraBanco: any = {
      id: 'r-banco-1',
      tenant_id: tenantId,
      empresa_id: empresaId,
      bh_ativo: true,
      status: 'ativo',
      carga_horaria_diaria: 8,
    };

    const res = await avaliarPontoGates({
      tenantId,
      ponto: pontoDomingo,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [regraBanco],
    });

    expect(res.passouJornada).toBe(true);
    expect(res.bloqueado).toBe(false);
    expect(res.resolucaoJornada?.tipoDia).toBe('DSR');
    expect(res.resolucaoJornada?.trabalhavel).toBe(false);
    expect(res.resolucaoJornada?.minutosPrevistos).toBe(0);

    // Validação do cálculo de compensação: com 0 min previstos, ausência em domingo DSR resulta em 0 débito!
    const calculo = calculateCompensation({
      ponto: pontoDomingo,
      regra: res.regra!,
      colaborador: colabApto,
      minutosPrevistosJornada: res.resolucaoJornada?.minutosPrevistos,
    });

    expect(calculo.jornadaMinutes).toBe(0);
    expect(calculo.minutosDebito).toBe(0);
    expect(calculo.atrasoMinutes).toBe(0);
    expect(calculo.saldoDia).toBe(0);
    expect(calculo.valorAtraso).toBe(0);
    expect(calculo.valorFalta).toBe(0);
  });

  it('CENÁRIO G — Nenhuma jornada e nenhuma regra de banco: NENHUM fallback de 8h é criado', async () => {
    // 1. Sem jornada
    const resSemJornada = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [],
      regrasRuntime: [],
    });

    expect(resSemJornada.bloqueado).toBe(true);
    expect(resSemJornada.tipoBloqueio).toBe('jornada_nao_parametrizada');

    // 2. Com jornada mas sem regra de banco
    const jornadaEmpresa = mockJornada({ tenant_id: tenantId, empresa_id: empresaId });
    const resSemBanco = await avaliarPontoGates({
      tenantId,
      ponto: pontoSegunda,
      colaborador: colabApto,
      resolvedEmpresaId: empresaId,
      jornadasRuntime: [jornadaEmpresa],
      regrasRuntime: [], // Nenhuma regra de banco ativa
    });

    expect(resSemBanco.passouJornada).toBe(true);
    expect(resSemBanco.passouRegraBanco).toBe(false);
    expect(resSemBanco.bloqueado).toBe(true);
    expect(resSemBanco.tipoBloqueio).toBe('regra_banco_nao_parametrizada');
    expect(resSemBanco.motivoBloqueio).toContain('Regra de banco de horas/compensação não parametrizada');
  });
});
