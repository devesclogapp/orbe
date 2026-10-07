import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL || '',
    password: process.env.E2E_TEST_PASSWORD || ''
  });

  const { data: lotes, error: lotErr } = await supabase
    .from('rh_financeiro_lotes')
    .select('*, empresas(*)')
    .or('valor_total.eq.494.28,valor_total.eq.494.3');
  console.log('Lotes com valor 494.28:', lotes);

  if (!lotes || lotes.length === 0) {
    const { data: todos } = await supabase
      .from('rh_financeiro_lotes')
      .select('id, competencia, empresa_id, valor_total, empresas(nome)')
      .limit(20);
    console.log('Todos lotes:', todos);
    return;
  }

  for (const l of lotes) {
    console.log('\n=== LOTE ENCONTRADO ===', l);
    const { data: itens } = await supabase
      .from('rh_financeiro_lote_itens')
      .select('*, colaboradores(*)')
      .eq('lote_id', l.id);
    console.log('Itens:', JSON.stringify(itens, null, 2));
  }
}

main();
