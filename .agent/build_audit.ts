import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function check() {
  let md = `# Relatório de Auditoria — Bloco 4 (Banco Conectado)\n\n`;
  md += `| Objeto | Esperado | Encontrado | Evidência SQL (Ou REST/API) | Status PASS/FAIL |\n`;
  md += `| :--- | :--- | :--- | :--- | :---: |\n`;

  let passAll = true;
  
  await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local',
    password: process.env.E2E_TEST_PASSWORD || '123456'
  });
  
  for (const table of ['cnab_remessa_itens', 'cnab_remessas_arquivos', 'cnab_retorno_arquivos', 'cnab_retorno_itens']) {
     const { error } = await supabase.from(table).select('id').limit(1);
     const exists = !(error && error.code === '42P01');
     if (!exists) passAll = false;
     md += `| Tabela \`${table}\` | EXISTE | ${exists ? 'SIM' : 'NÃO'} | REST API | ${exists ? 'PASS' : 'FAIL'} |\n`;
  }
  
  for (const rpc of ['rpc_registrar_cnab_remessa', 'rpc_aplicar_cnab_retorno']) {
     const { error } = await supabase.rpc(rpc, {});
     const exists = !(error && (error.code === 'PGRST202' || error.code === '42883'));
     if (!exists) passAll = false;
     md += `| RPC \`${rpc}\` | EXISTE | ${exists ? 'SIM' : 'NÃO'} | REST API | ${exists ? 'PASS' : 'FAIL'} |\n`;
  }
  
  md += `\n## VEREDITO\n`;
  if (!passAll) {
     md += `**NO-GO para smoke financeiro**\n\nFaltam recursos.`;
  } else {
     md += `**PASS**. O banco suporta o Bloco 4.\n`;
  }

  fs.writeFileSync('.agent/bloco4_database_audit_result.md', md);
}

check();
