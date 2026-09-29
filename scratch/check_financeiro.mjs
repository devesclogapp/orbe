import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkFinanceiro() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  console.log('=== VERIFICAÇÃO DE REGISTROS FINANCEIROS / LOTES / CNAB ===\n');

  // 1. Fechamentos RH / Lotes RH
  const { data: fechamentosRh, error: errFechRh } = await supabase
    .from('fechamentos_rh')
    .select('*')
    .limit(20);
  console.log('fechamentos_rh:', fechamentosRh?.length ?? 0);
  if (fechamentosRh?.length > 0) {
    console.log(JSON.stringify(fechamentosRh, null, 2));
  }

  // 2. Lotes de Pagamento
  const { data: lotes, error: errLotes } = await supabase
    .from('lotes_pagamento')
    .select('id, tipo, status, valor_total, competencia, created_at')
    .limit(20);
  console.log('lotes_pagamento:', lotes?.length ?? 0);
  if (lotes?.length > 0) {
    console.log(JSON.stringify(lotes, null, 2));
  }

  // 3. Contas a pagar
  const { data: contasPagar, error: errContas } = await supabase
    .from('contas_pagar')
    .select('id, descricao, valor, status, origem, tipo, competencia, created_at')
    .limit(20);
  console.log('contas_pagar:', contasPagar?.length ?? 0);
  if (contasPagar?.length > 0) {
    console.log(JSON.stringify(contasPagar, null, 2));
  }
}

checkFinanceiro();
