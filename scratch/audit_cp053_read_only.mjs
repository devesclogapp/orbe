import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const rJornadas = await supabase.from('jornadas_trabalho').select('id, nome, padrao, status, created_at');
  const rRegras = await supabase.from('banco_horas_regras').select('id, nome, status, is_teste', { count: 'exact' });
  const rEventos = await supabase.from('banco_horas_eventos').select('id, is_teste', { count: 'exact' });
  const rSaldos = await supabase.from('banco_horas_saldos').select('id, is_teste', { count: 'exact' });
  const rPontos = await supabase.from('registros_ponto').select('status_processamento');
  const rFechamento = await supabase.from('fechamento_mensal').select('id', { count: 'exact' });
  const rColabs = await supabase.from('colaboradores').select('id, jornada_id', { count: 'exact' });

  // Agrupamento de registros de ponto por status
  const pontosMap = {};
  for (const p of rPontos.data || []) {
    const st = p.status_processamento || 'null';
    pontosMap[st] = (pontosMap[st] || 0) + 1;
  }

  console.log("=== AUDITORIA PRODUÇÃO READ-ONLY CP05.3 ===");
  console.log("JORNADAS:", rJornadas.data, "error:", rJornadas.error);
  console.log("BANCO_HORAS_REGRAS total count:", rRegras.count, "error:", rRegras.error);
  console.log("BANCO_HORAS_EVENTOS total count:", rEventos.count, "error:", rEventos.error);
  console.log("BANCO_HORAS_SALDOS total count:", rSaldos.count, "error:", rSaldos.error);
  console.log("REGISTROS_PONTO BREAKDOWN:", pontosMap, "total:", rPontos.data?.length);
  console.log("FECHAMENTO_MENSAL count:", rFechamento.count, "error:", rFechamento.error);
  console.log("COLABORADORES total count:", rColabs.count, "error:", rColabs.error);
}

check().catch(console.error);
