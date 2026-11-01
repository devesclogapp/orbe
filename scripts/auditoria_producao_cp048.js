import { getE2EContext } from './utils/e2e-guard.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log("=== AUDITORIA PRODUÇÃO FIX CP04.8 — BASELINE ===");
  const { supabase, tenantId } = await getE2EContext();

  const [
    { count: totalColaboradores },
    { count: totalPontos },
    { count: pontosProcessados },
    { count: pontosPendentes },
    { count: pontosIncompletos },
    { count: eventosBh },
    { count: saldosBh },
    { count: jornadas },
    { count: regrasBh },
    { count: fechamentosRh },
    { count: lotesRh }
  ] = await Promise.all([
    supabase.from('colaboradores').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status_processamento', 'PROCESSADO'),
    supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status_processamento', 'PENDENTE'),
    supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['incompleto', 'Incompleto']),
    supabase.from('banco_horas_eventos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('banco_horas_saldos').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('jornadas_trabalho').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('banco_horas_regras').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('fechamentos_rh').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('rh_financeiro_lotes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const baseline = {
    tenantId,
    totalColaboradores,
    totalPontos,
    pontosProcessados,
    pontosPendentes,
    pontosIncompletos,
    eventosBh,
    saldosBh,
    jornadas,
    regrasBh,
    fechamentosRh,
    lotesRh
  };

  console.log("BASELINE PRODUÇÃO:", JSON.stringify(baseline, null, 2));
}

main().catch(err => {
  console.error("Erro na auditoria:", err);
  process.exit(1);
});
