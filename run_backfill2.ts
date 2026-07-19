import { config } from 'dotenv';
config({ path: '.env.local' });
// Inject vite env variables
(globalThis as any).import = {
  meta: {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
    }
  }
};

import { IntermitentesLoteService } from './src/services/domain/intermitentes.service';
import { supabase } from './src/lib/supabase';

async function main() {
  console.log('--- TESTANDO SUPABASE CONNECTION ---');
  const { data: q1, error: err1 } = await supabase.from('intermitentes_lotes_fechamento').select('id, status').eq('status', 'FECHADO_FINANCEIRO');
  
  if (err1) {
    console.error('ERRO SUPABASE:', err1);
    process.exit(1);
  }
  console.log(`Lotes FECHADO_FINANCEIRO encontrados: ${q1?.length}`);
  
  for (const lote of q1 || []) {
    try {
      console.log(`> Sincronizando Lote ${lote.id}...`);
      await IntermitentesLoteService.syncToRHFinanceiro(lote.id, lote.status);
      console.log(`> Lote ${lote.id} sincronizado com sucesso.`);
    } catch (e: any) {
      console.error(`> Erro ao sincronizar ${lote.id}: ${e.message}`);
    }
  }
  
  const { data: fin } = await supabase.from('rh_financeiro_lotes').select('*').eq('tipo', 'INTERMITENTES');
  console.log(`Final: Total de lotes INTERMITENTES em rh_financeiro_lotes: ${fin?.length}`);
}

main().catch(console.error);
