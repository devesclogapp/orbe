import { createClient } from '@supabase/supabase-js';
import { DespesasContasPagarOficialService } from '../src/services/despesasOficial.service';
import { DashboardConsolidadoService } from '../src/services/dashboard.service';
import { buildDREKpis, buildDRELedger } from '../src/services/adapters/dreOficialAdapter';
import { supabase } from '../src/lib/supabase';

const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

const TARGET = {
  tenantId: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
  empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  competencia: '2026-10',
  loteId: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
};

async function main() {
  console.log('=== TESTE DE SERVIÇOS FINANCEIROS, CONTAS A PAGAR E DRE ===\n');

  // Autenticar a sessão global do supabase
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr) {
    console.error('Falha de autenticacao:', authErr.message);
    process.exit(1);
  }

  console.log('Autenticado como:', authData.user.email);

  // 1. DespesasContasPagarOficialService
  console.log('\n--- 1. DESPESAS & CONTAS A PAGAR FEDERADAS (DespesasContasPagarOficialService) ---');
  try {
    const despesasResult = await DespesasContasPagarOficialService.getDespesasFederadas({
      competencia: TARGET.competencia,
      empresaId: TARGET.empresaId,
    });

    console.log(`Total despesas retornadas para ${TARGET.competencia}:`, despesasResult.itens.length);
    despesasResult.itens.forEach((d) => {
      console.log(`\nItem: [${d.id}]`);
      console.log(`  Origem: ${d.origem}`);
      console.log(`  Tipo: ${d.tipo}`);
      console.log(`  Código: ${d.codigo}`);
      console.log(`  Título: ${d.titulo}`);
      console.log(`  Valor: R$ ${d.valor}`);
      console.log(`  Situação UX: ${d.situacao}`);
      console.log(`  Status Real: ${d.statusReal}`);
      console.log(`  Readiness Bancário: ${d.readinessBancario}`);
    });

    console.log('\nKPIs de Despesas:');
    console.log(JSON.stringify(despesasResult.kpis, null, 2));
  } catch (err) {
    console.error('Erro em getDespesasFederadas:', err);
  }

  // 2. DashboardConsolidadoService (KPIs Operacionais e Financeiros)
  console.log('\n--- 2. DASHBOARD CONSOLIDADO (DashboardConsolidadoService) ---');
  try {
    const kpis = await DashboardConsolidadoService.getKPIs(TARGET.competencia, TARGET.empresaId);
    console.log('KPIs Consolidados para 2026-10:');
    console.log('  Competência:', kpis.competencia);
    console.log('  Tipo de Fluxo:', kpis.tipoFluxo);
    console.log('  Fluxos Presentes:', kpis.fluxosPresentes);
    console.log('  Diaristas Valor Aprovado:', kpis.diaristasValorAprovado);
    console.log('  Fin Valor Aprovado:', kpis.finValorAprovado);
    console.log('  Fin Valor Enviado Banco:', kpis.finValorEnviadoBanco);
    console.log('  Fin Valor Histórico Banco:', kpis.finValorHistoricoBanco);
    console.log('  Faturamento Total:', kpis.faturamentoTotal);
    console.log('  Custos Gerais:', kpis.custosGerais);
    console.log('  Lucro Real:', kpis.lucroReal);
    console.log('  Auditoria Competência Resumo:');
    console.log(JSON.stringify(kpis.auditoriaCompetencia, null, 2));

    // 3. DRE Oficial Adapter
    console.log('\n--- 3. RESULTADO OPERACIONAL (DRE) ADAPTER ---');
    const dreKpis = buildDREKpis(kpis, null, false);
    console.log('DRE KPIs:');
    console.log('  Receita:', dreKpis.receita.formatted);
    console.log('  Custos:', dreKpis.custos.formatted);
    console.log('  Resultado:', dreKpis.resultado.formatted);
    console.log('  Margem:', dreKpis.margem.formatted);

    const dreLedger = buildDRELedger(kpis, null);
    console.log('\nDRE Ledger Itens:');
    dreLedger.forEach((li) => {
      console.log(`  [${li.id}] ${li.label} (${li.sinal}) -> R$ ${li.valor.toFixed(2)} (${li.percentualReceita}%)`);
      if (li.detalhes && li.detalhes.length > 0) {
        li.detalhes.forEach((det) => {
          console.log(`     - ${det.label}: R$ ${det.valor.toFixed(2)}`);
        });
      }
    });
  } catch (err) {
    console.error('Erro em DashboardConsolidadoService / DRE:', err);
  }
}

main();
