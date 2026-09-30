import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });
  console.log('auth user:', auth?.user?.id, 'tenant_id:', auth?.user?.user_metadata?.tenant_id, 'err:', authErr?.message);

  const rEmpresasTbl = await supabase.from('banco_horas_regras_empresas').select('*').limit(1);
  console.log('banco_horas_regras_empresas query:', rEmpresasTbl.data, 'error:', rEmpresasTbl.error);

  const rRegras = await supabase.from('banco_horas_regras').select('*').limit(1);
  console.log('banco_horas_regras query:', rRegras.data, 'error:', rRegras.error);

  // Let's test insert on banco_horas_regras with escopo
  const testRegra = {
    nome: 'TEST_ESCOPO_PROBE',
    status: 'inativo',
    bh_ativo: false,
    vigencia_inicio: '2026-01-01',
    vigencia_fim: '2026-01-02',
    adicional_hora_extra_percentual: 50,
    prazo_compensacao_dias: 60,
    tipo: 'acumula',
    is_teste: true,
    empresa_id: null
  };

  const { data: inserted, error: insertErr } = await supabase.from('banco_horas_regras').insert(testRegra).select('*').single();
  console.log('Inserted probe:', inserted ? Object.keys(inserted) : null, 'error:', insertErr?.message);

  if (inserted?.id) {
    // Check if escopo column exists
    console.log('Has escopo in inserted?', 'escopo' in inserted, 'value:', inserted.escopo);
    await supabase.from('banco_horas_regras').delete().eq('id', inserted.id);
    console.log('Deleted probe');
  }
}

inspect().catch(console.error);
