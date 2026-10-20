import { describe, it, expect, beforeEach } from 'vitest';
import { DespesasContasPagarOficialService } from '@/services/despesasOficial.service';
import { DashboardConsolidadoService } from '@/services/dashboard.service';
import { buildDREKpis, buildDRELedger } from '@/services/adapters/dreOficialAdapter';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

const TARGET = {
  tenantId: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
  empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  competencia: '2026-10',
  loteId: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
};

describe('AUDITORIA REAL DE REFLEXOS FINANCEIROS — ETAPA 7D', () => {
  beforeEach(() => {
    // Configura o ambiente como HOMOLOGACAO
    localStorage.setItem('esc-log-environment', 'homologacao');
  });

  it('1. Deve autenticar e consultar DespesasContasPagarOficialService em ambiente Homologacao', async () => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    expect(authErr).toBeNull();
    expect(authData.user).not.toBeNull();

    expect(EnvironmentService.getCurrentEnvironment()).toBe('homologacao');

    const despesasResult = await DespesasContasPagarOficialService.fetchDespesasFederadas({
      competencia: TARGET.competencia,
      empresaId: TARGET.empresaId,
    });

    console.log(`\n=== DESPESAS FEDERADAS (2026-10) ===`);
    console.log(`Total itens: ${despesasResult.itens.length}`);
    despesasResult.itens.forEach((d) => {
      console.log(`- [${d.id}] ${d.codigo} | ${d.titulo} | R$ ${d.valor} | Situação: ${d.situacao} | Status: ${d.statusReal}`);
    });
    console.log(`KPIs Despesas:`, JSON.stringify(despesasResult.stats, null, 2));

    const itemDiarista = despesasResult.itens.find(i => i.origem === 'DIARISTAS' && i.canonicalId === TARGET.loteId);
    expect(itemDiarista).toBeDefined();
    expect(itemDiarista?.valor).toBe(350);
    expect(itemDiarista?.situacao).toBe('PAGA');
    expect(itemDiarista?.statusReal).toBe('PAGO');

    // Com o lote PAGO, não deve constar em A Pagar nem Prontas para Execução
    expect(itemDiarista?.readinessBancario).toBe(false);
    expect(despesasResult.stats.aPagar).toBe(0);
    expect(despesasResult.stats.prontasExecucao).toBe(0);
    expect(despesasResult.stats.pagasLiquidadas).toBe(350);
  });

  it('2. Deve consultar DashboardConsolidadoService e DRE para 2026-10 em ambiente Homologacao', async () => {
    expect(EnvironmentService.getCurrentEnvironment()).toBe('homologacao');

    const kpis = await DashboardConsolidadoService.getKpisByCompetencia(TARGET.competencia, TARGET.empresaId);

    console.log(`\n=== DASHBOARD CONSOLIDADO & DRE (2026-10) ===`);
    console.log(`Competencia: ${kpis.competencia}`);
    console.log(`Diaristas Valor Aprovado: R$ ${kpis.diaristasValorAprovado}`);
    console.log(`Fin Valor Aprovado: R$ ${kpis.finValorAprovado}`);
    console.log(`Fin Valor Enviado Banco: R$ ${kpis.finValorEnviadoBanco}`);
    console.log(`Fin Valor Histórico Banco: R$ ${kpis.finValorHistoricoBanco}`);
    console.log(`Auditoria Diferenca Total: R$ ${kpis.auditoriaCompetencia.diferencaTotal}`);
    console.log(`Auditoria Status: ${kpis.auditoriaCompetencia.status}`);

    const dreKpis = buildDREKpis(kpis, null, false);
    console.log(`\nDRE KPIs:`);
    console.log(`- Receita: ${dreKpis.receita.formatted}`);
    console.log(`- Custos: ${dreKpis.custos.formatted}`);
    console.log(`- Resultado: ${dreKpis.resultado.formatted}`);

    const dreLedger = buildDRELedger(kpis, null);
    console.log(`\nDRE Ledger:`);
    dreLedger.forEach(li => {
      console.log(`- [${li.id}] ${li.label}: R$ ${li.valor.toFixed(2)} (${li.percentualReceita}%)`);
      li.detalhes?.forEach(det => console.log(`    * ${det.label}: R$ ${det.valor.toFixed(2)}`));
    });

    // O lote de R$ 350,00 deve constar em Diaristas
    const ledgerDiaristas = dreLedger.find(l => l.id === 'diaristas');
    expect(ledgerDiaristas).toBeDefined();
    expect(ledgerDiaristas?.valor).toBe(350);
  });

  it('3. Deve comprovar Isolamento Estrito: no ambiente Producao, o lote de homologacao NAO aparece', async () => {
    localStorage.setItem('esc-log-environment', 'production');
    expect(EnvironmentService.getCurrentEnvironment()).toBe('production');

    // Em produção, buscar empresa de teste deve ser bloqueado ou retornar vazio
    await expect(
      DespesasContasPagarOficialService.fetchDespesasFederadas({
        competencia: TARGET.competencia,
        empresaId: TARGET.empresaId,
      })
    ).rejects.toThrowError(/não pode ser consultada no ambiente de Produção/);
  });
});
