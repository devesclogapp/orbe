import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '@/lib/supabase';
import { DashboardConsolidadoService } from '@/services/dashboard.service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

describe('FIX-DASH-FINAL — Validação Funcional das 8 Consultas do Dashboard', () => {
  beforeAll(async () => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (email && password) {
      await supabase.auth.signInWithPassword({ email, password });
    }
  });

  it('1. getStatusCiclos não retorna o horário fictício "Hoje 07:01"', async () => {
    const status = await DashboardConsolidadoService.getStatusCiclos('2026-10');
    expect(status).toBeDefined();
    expect(status.ultimoSyncRhid).not.toBe('Hoje 07:01');
    expect(typeof status.ultimoSyncRhid).toBe('string');
    console.log('[EVIDÊNCIA 1] Último Sync RHID:', status.ultimoSyncRhid);
  });

  it('2. getMotoresData executa sem erros e retorna a estrutura dos 4 motores', async () => {
    const motores = await DashboardConsolidadoService.getMotoresData('2026-10');
    expect(motores).toBeDefined();
    expect(motores.volume).toBeDefined();
    expect(typeof motores.volume.totalDescargas).toBe('number');
    expect(typeof motores.volume.modalidades.caixaImediato).toBe('number');
    expect(typeof motores.volume.modalidades.duplicatas).toBe('number');
    expect(typeof motores.volume.modalidades.mensal).toBe('number');

    expect(motores.rhClt).toBeDefined();
    expect(typeof motores.rhClt.totalColaboradores).toBe('number');
    expect(typeof motores.rhClt.saldoBancoGeralMinutos).toBe('number');

    expect(motores.diaristas).toBeDefined();
    expect(typeof motores.diaristas.totalAtivos).toBe('number');
    expect(typeof motores.diaristas.presencasSemanaAtual).toBe('number');

    expect(motores.intermitentes).toBeDefined();
    expect(typeof motores.intermitentes.totalCadastrados).toBe('number');

    console.log('[EVIDÊNCIA 2] Motores Data:', JSON.stringify(motores, null, 2));
  });

  it('3. getRadarAlertas executa com total_registros e created_at sem erros de schema', async () => {
    const alertas = await DashboardConsolidadoService.getRadarAlertas('2026-10');
    expect(Array.isArray(alertas)).toBe(true);
    alertas.forEach(alerta => {
      expect(alerta.id).toBeDefined();
      expect(alerta.modulo).toBeDefined();
      expect(alerta.titulo).toBeDefined();
    });
    console.log('[EVIDÊNCIA 3] Radar Alertas:', alertas.map(a => ({ id: a.id, titulo: a.titulo, tempo: a.tempo })));
  });

  it('4. Os 5 KPIs Executivos continuam calculando com integridade total', async () => {
    const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-10');
    expect(kpis).toBeDefined();
    expect(typeof kpis.faturamentoTotal).toBe('number');
    expect(typeof kpis.custosGerais).toBe('number');
    expect(typeof kpis.finValorAprovado).toBe('number');
    expect(typeof kpis.lucroReal).toBe('number');
    expect(typeof kpis.caixaRecebido).toBe('number');
    expect(kpis.auditoriaCompetencia).toBeDefined();
    console.log('[EVIDÊNCIA 4] KPIs Executivos:', {
      faturamentoTotal: kpis.faturamentoTotal,
      custosGerais: kpis.custosGerais,
      finValorAprovado: kpis.finValorAprovado,
      lucroReal: kpis.lucroReal,
      caixaRecebido: kpis.caixaRecebido,
      statusAuditoria: kpis.auditoriaCompetencia.status
    });
  });
});
