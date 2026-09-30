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

  // Query table structure by inserting and rolling back or testing dummy select
  const { data, error } = await supabase.from('banco_horas_regras').select('*').limit(0);
  console.log('select * from banco_horas_regras error:', error);

  const { data: userProfile } = await supabase.from('colaboradores').select('tenant_id').limit(1).single();
  const realTenantId = userProfile?.tenant_id;
  console.log('Real tenantId:', realTenantId);

  // Let's test insert with null empresa_id to see if empresa_id is nullable:
  const testPayload = {
    tenant_id: realTenantId,
    empresa_id: null,
    nome: '__TEST_PROBE_NULL_EMPRESA__',
    prazo_compensacao_dias: 180,
    tipo: 'acumula',
    bh_ativo: true,
    vigencia_inicio: '2026-01-01',
    vigencia_fim: '2026-01-02',
    is_teste: true,
  };
  const { data: insData, error: insErr } = await supabase
    .from('banco_horas_regras')
    .insert(testPayload)
    .select();
  console.log('Insert test with empresa_id = null:', insData, 'error:', insErr);

  if (insData && insData.length > 0) {
    console.log('Columns on banco_horas_regras row:', Object.keys(insData[0]));
    // Clean up immediately:
    await supabase.from('banco_horas_regras').delete().eq('id', insData[0].id);
    console.log('Cleaned up test probe.');
  }
}

check().catch(console.error);
