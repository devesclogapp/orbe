import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runExactAudit() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const { count: cJornadas } = await supabase.from('jornadas_trabalho').select('*', { count: 'exact', head: true });
  const { count: cRegras } = await supabase.from('banco_horas_regras').select('*', { count: 'exact', head: true });
  const { count: cEventos } = await supabase.from('banco_horas_eventos').select('*', { count: 'exact', head: true });
  const { count: cSaldos } = await supabase.from('banco_horas_saldos').select('*', { count: 'exact', head: true });
  const { count: cFechamento } = await supabase.from('fechamento_mensal').select('*', { count: 'exact', head: true });
  const { count: cColabs } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true });

  const { count: cPontosTotal } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true });
  const { count: cPontosProc } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'PROCESSADO');
  const { count: cPontosPendProc } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'PENDENTE_PROCESSAMENTO');
  const { count: cPontosPend } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'pendente');
  const { count: cPontosIncons } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'INCONSISTENTE');

  console.log('=== AUDITORIA PRODUÇÃO READ-ONLY EXATA CP05.4 ===');
  console.log('jornadas_trabalho count:', cJornadas);
  console.log('banco_horas_regras count:', cRegras);
  console.log('banco_horas_eventos count:', cEventos);
  console.log('banco_horas_saldos count:', cSaldos);
  console.log('fechamento_mensal count:', cFechamento);
  console.log('colaboradores count:', cColabs);
  console.log('registros_ponto total count:', cPontosTotal);
  console.log('registros_ponto PROCESSADO count:', cPontosProc);
  console.log('registros_ponto PENDENTE_PROCESSAMENTO count:', cPontosPendProc);
  console.log('registros_ponto pendente count:', cPontosPend);
  console.log('registros_ponto INCONSISTENTE count:', cPontosIncons);
}

runExactAudit().catch(console.error);
