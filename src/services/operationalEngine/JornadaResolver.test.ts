import { describe, it, expect } from 'vitest';
import {
  JornadaResolver,
  getDiaSemanaCivil,
  isJornadaEmVigencia,
} from './JornadaResolver';
import { JornadaTrabalho, GradeSemanal } from '../../types/jornada.types';

function mockGradePadrao44hCompensado(): GradeSemanal {
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

function mockGradeSabado4h(): GradeSemanal {
  return {
    seg: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    ter: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    qua: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    qui: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    sex: { trabalhavel: true, minutos_previstos: 480, tipo: 'TRABALHO' },
    sab: { trabalhavel: true, minutos_previstos: 240, tipo: 'TRABALHO' },
    dom: { trabalhavel: false, minutos_previstos: 0, tipo: 'DSR' },
  };
}

function criarJornadaMock(parciais: Partial<JornadaTrabalho>): JornadaTrabalho {
  return {
    id: parciais.id || 'jornada-id-default',
    tenant_id: parciais.tenant_id || 'tenant-1',
    empresa_id: parciais.empresa_id !== undefined ? parciais.empresa_id : 'empresa-1',
    nome: parciais.nome || 'Jornada Teste',
    descricao: parciais.descricao || null,
    tipo_escala: parciais.tipo_escala || 'SEMANAL',
    carga_semanal_minutos: parciais.carga_semanal_minutos || 2640,
    grade_semanal: parciais.grade_semanal || mockGradePadrao44hCompensado(),
    politica_feriado: parciais.politica_feriado || 'FOLGA_DSR',
    vigencia_inicio: parciais.vigencia_inicio || '2026-01-01',
    vigencia_fim: parciais.vigencia_fim !== undefined ? parciais.vigencia_fim : null,
    padrao: parciais.padrao !== undefined ? parciais.padrao : true,
    status: parciais.status || 'ativo',
  };
}

describe('FIX 04.2-B — JornadaResolver e Calendário (CLT)', () => {
  const TENANT_A = 'tenant-aaa';
  const TENANT_B = 'tenant-bbb';
  const EMPRESA_1 = 'empresa-111';

  describe('Precedência e Hierarquia', () => {
    it('1. Jornada específica do colaborador vence jornada da empresa', async () => {
      const jornadaEmpresa = criarJornadaMock({
        id: 'j-empresa',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_1,
        padrao: true,
        grade_semanal: mockGradePadrao44hCompensado(), // 528 min na segunda
      });

      const jornadaColaborador = criarJornadaMock({
        id: 'j-colaborador',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_1,
        padrao: false,
        grade_semanal: mockGradeSabado4h(), // 480 min na segunda
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda-feira (dia útil normal)
        colaboradorId: 'colab-1',
        colaboradorJornadaId: 'j-colaborador',
        empresaId: EMPRESA_1,
        jornadasDisponiveis: [jornadaEmpresa, jornadaColaborador],
      });

      expect(result.temJornadaConfigurada).toBe(true);
      expect(result.jornadaId).toBe('j-colaborador');
      expect(result.origem).toBe('COLABORADOR');
      expect(result.minutosPrevistos).toBe(480);
    });

    it('2. Jornada da empresa vence jornada global do tenant', async () => {
      const jornadaGlobal = criarJornadaMock({
        id: 'j-global',
        tenant_id: TENANT_A,
        empresa_id: null,
        padrao: true,
        grade_semanal: mockGradeSabado4h(), // 480 min na segunda
      });

      const jornadaEmpresa = criarJornadaMock({
        id: 'j-empresa',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_1,
        padrao: true,
        grade_semanal: mockGradePadrao44hCompensado(), // 528 min na segunda
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda-feira
        colaboradorId: 'colab-1',
        empresaId: EMPRESA_1,
        jornadasDisponiveis: [jornadaGlobal, jornadaEmpresa],
      });

      expect(result.temJornadaConfigurada).toBe(true);
      expect(result.jornadaId).toBe('j-empresa');
      expect(result.origem).toBe('EMPRESA');
      expect(result.minutosPrevistos).toBe(528);
    });

    it('3. Jornada global funciona quando não há jornada da empresa nem específica', async () => {
      const jornadaGlobal = criarJornadaMock({
        id: 'j-global',
        tenant_id: TENANT_A,
        empresa_id: null,
        padrao: true,
        grade_semanal: mockGradePadrao44hCompensado(),
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda-feira
        colaboradorId: 'colab-1',
        empresaId: 'empresa-sem-jornada',
        jornadasDisponiveis: [jornadaGlobal],
      });

      expect(result.temJornadaConfigurada).toBe(true);
      expect(result.jornadaId).toBe('j-global');
      expect(result.origem).toBe('TENANT');
      expect(result.minutosPrevistos).toBe(528);
    });

    it('4. Nenhuma jornada encontrada: retorna temJornadaConfigurada = false (NÃO assume 8h nem 0)', async () => {
      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28',
        colaboradorId: 'colab-1',
        empresaId: EMPRESA_1,
        jornadasDisponiveis: [], // vazio
      });

      expect(result.temJornadaConfigurada).toBe(false);
      expect(result.jornadaId).toBeNull();
      expect(result.origem).toBeNull();
      expect(result.minutosPrevistos).toBeNull();
      expect(result.tipoDia).toBe('SEM_JORNADA');
      expect(result.trabalhavel).toBe(false);
    });
  });

  describe('Grade Semanal e Dias da Semana', () => {
    it('5. Segunda-feira trabalhável retorna minutos configurados', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        grade_semanal: mockGradePadrao44hCompensado(),
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.diaSemana).toBe('seg');
      expect(result.trabalhavel).toBe(true);
      expect(result.minutosPrevistos).toBe(528);
      expect(result.tipoDia).toBe('TRABALHO');
    });

    it('6. Sábado compensado/folga retorna trabalhavel = false e minutos = 0', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        grade_semanal: mockGradePadrao44hCompensado(),
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-26', // Sábado
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.diaSemana).toBe('sab');
      expect(result.trabalhavel).toBe(false);
      expect(result.minutosPrevistos).toBe(0);
      expect(result.tipoDia).toBe('COMPENSADO');
    });

    it('7. Domingo DSR retorna trabalhavel = false e minutos = 0', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        grade_semanal: mockGradePadrao44hCompensado(),
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-27', // Domingo
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.diaSemana).toBe('dom');
      expect(result.trabalhavel).toBe(false);
      expect(result.minutosPrevistos).toBe(0);
      expect(result.tipoDia).toBe('DSR');
    });
  });

  describe('Vigência Temporal da Jornada', () => {
    it('8. Jornada fora da vigência (anterior ao início ou posterior ao fim) NÃO é utilizada', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        vigencia_inicio: '2026-10-01', // vigência futura
        vigencia_fim: '2026-12-31',
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // antes do início
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.temJornadaConfigurada).toBe(false);
      expect(result.tipoDia).toBe('SEM_JORNADA');
    });

    it('9. vigencia_inicio é inclusiva no primeiro dia de vigência', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        vigencia_inicio: '2026-09-28',
        vigencia_fim: '2026-12-31',
      });

      expect(isJornadaEmVigencia(jornada, '2026-09-28')).toBe(true);
      expect(isJornadaEmVigencia(jornada, '2026-09-27')).toBe(false);
    });

    it('10. vigencia_fim é inclusiva no último dia de vigência', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        vigencia_inicio: '2026-01-01',
        vigencia_fim: '2026-09-30',
      });

      expect(isJornadaEmVigencia(jornada, '2026-09-30')).toBe(true);
      expect(isJornadaEmVigencia(jornada, '2026-10-01')).toBe(false);
    });
  });

  describe('Tratamento de Feriados', () => {
    it('11. Feriado Nacional com política FOLGA_DSR retorna minutosPrevistos = 0 e tipoDia = FERIADO', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        politica_feriado: 'FOLGA_DSR',
        grade_semanal: mockGradePadrao44hCompensado(), // normalmente teria 528 min na segunda
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-07', // 7 de Setembro (Segunda-feira - Independência do Brasil)
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.temJornadaConfigurada).toBe(true);
      expect(result.feriado).toBe(true);
      expect(result.tipoFeriado).toBe('NACIONAL');
      expect(result.nomeFeriado).toContain('Independência');
      expect(result.trabalhavel).toBe(false);
      expect(result.minutosPrevistos).toBe(0);
      expect(result.tipoDia).toBe('FERIADO');
    });

    it('12. Feriado com política de trabalho preserva minutos previstos SEM aplicar efeito financeiro', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        politica_feriado: 'TRABALHA_NORMAL',
        grade_semanal: mockGradePadrao44hCompensado(), // 528 min na segunda
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-07', // 7 de Setembro
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(result.temJornadaConfigurada).toBe(true);
      expect(result.feriado).toBe(true);
      expect(result.trabalhavel).toBe(true);
      expect(result.minutosPrevistos).toBe(528);
      expect(result.tipoDia).toBe('FERIADO');
      // Garantia de ausência de campos de motor financeiro:
      expect((result as any).adicionalExtra).toBeUndefined();
      expect((result as any).fatorMultiplicador).toBeUndefined();
    });
  });

  describe('Proteção de Timezone e Isolamento Multi-Tenant', () => {
    it('13. Data civil não muda dia da semana por efeito de timezone local', () => {
      // 07 de Setembro de 2026 é segunda-feira
      expect(getDiaSemanaCivil('2026-09-07')).toBe('seg');
      // 06 de Setembro de 2026 é domingo
      expect(getDiaSemanaCivil('2026-09-06')).toBe('dom');
      // 05 de Setembro de 2026 é sábado
      expect(getDiaSemanaCivil('2026-09-05')).toBe('sab');
      // 01 de Janeiro de 2026 é quinta-feira
      expect(getDiaSemanaCivil('2026-01-01')).toBe('qui');
    });

    it('14. Tenant A nunca resolve jornada pertencente ao Tenant B', async () => {
      const jornadaTenantB = criarJornadaMock({
        id: 'j-tenant-b',
        tenant_id: TENANT_B, // Tenant B
        empresa_id: null,
        padrao: true,
      });

      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A, // Consultando para Tenant A
        data: '2026-09-28',
        jornadasDisponiveis: [jornadaTenantB],
      });

      expect(result.temJornadaConfigurada).toBe(false);
      expect(result.jornadaId).toBeNull();
      expect(result.tipoDia).toBe('SEM_JORNADA');
    });
  });

  describe('Cenários Operacionais Específicos (Prompt CP04.2-B)', () => {
    it('Cenário A: Grade 44h compensada (Seg-Sex 528 min, Sáb 0 COMPENSADO, Dom 0 DSR)', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        grade_semanal: mockGradePadrao44hCompensado(),
      });

      const seg = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });
      const sab = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-26', // Sábado
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });
      const dom = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-27', // Domingo
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(seg.minutosPrevistos).toBe(528);
      expect(sab.minutosPrevistos).toBe(0);
      expect(sab.tipoDia).toBe('COMPENSADO');
      expect(dom.minutosPrevistos).toBe(0);
      expect(dom.tipoDia).toBe('DSR');
    });

    it('Cenário B: Grade com Sábado 4h (Seg-Sex 480 min, Sáb 240 min, Dom 0 DSR)', async () => {
      const jornada = criarJornadaMock({
        tenant_id: TENANT_A,
        grade_semanal: mockGradeSabado4h(),
      });

      const sab = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-26', // Sábado
        empresaId: 'empresa-1',
        jornadasDisponiveis: [jornada],
      });

      expect(sab.trabalhavel).toBe(true);
      expect(sab.minutosPrevistos).toBe(240);
      expect(sab.tipoDia).toBe('TRABALHO');
    });

    it('Cenário C: Nenhuma jornada disponível (NÃO retorna 480 nem 0 de folga)', async () => {
      const result = await JornadaResolver.resolve({
        tenantId: TENANT_A,
        data: '2026-09-28', // Segunda
        empresaId: 'empresa-1',
        jornadasDisponiveis: [],
      });

      expect(result.temJornadaConfigurada).toBe(false);
      expect(result.minutosPrevistos).toBeNull();
      expect(result.minutosPrevistos).not.toBe(480);
      expect(result.minutosPrevistos).not.toBe(0);
      expect(result.tipoDia).toBe('SEM_JORNADA');
    });
  });
});
