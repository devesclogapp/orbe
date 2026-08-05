import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing URL/KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log("--- INICIANDO AUDITORIA REST ---");
  
  // Login to ensure we can hit RLS / functions properly if needed
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local',
    password: process.env.E2E_TEST_PASSWORD || '123456'
  });
  
  // 1. Check Tables
  for (const table of ['cnab_remessas_arquivos', 'cnab_remessa_itens', 'cnab_retorno_arquivos', 'cnab_retorno_itens']) {
     const { error } = await supabase.from(table).select('id').limit(1);
     if (error && error.code === '42P01') {
         console.log(`[FAIL] Table ${table} DOES NOT EXIST.`);
     } else {
         console.log(`[PASS] Table ${table} exists (code: ${error?.code || 'success'}).`);
     }
  }
  
  // 2. Check RPCs
  for (const rpc of ['rpc_registrar_cnab_remessa', 'rpc_aplicar_cnab_retorno']) {
     const { error } = await supabase.rpc(rpc, {});
     // A missing function usually comes back as 404/PGRST202 or 42883
     if (error && (error.code === 'PGRST202' || error.code === '42883')) {
         console.log(`[FAIL] RPC ${rpc} DOES NOT EXIST.`);
     } else {
         console.log(`[PASS] RPC ${rpc} exists (threw expected logic error or success: code ${error?.code || 'success'}, msg: ${error?.message}).`);
     }
  }

  console.log("--- FIM DA AUDITORIA ---");
}

check();
