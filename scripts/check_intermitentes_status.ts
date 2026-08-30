import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching lotes intermitentes...");
  const { data, error } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, competencia, observacoes, empresa_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
  } else {
    console.log("Lotes: ", JSON.stringify(data, null, 2));
  }

  console.log("Fetching lancamentos_intermitentes devolvidos...");
  const { data: lancs, error: e2 } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, status_pipeline, lote_fechamento_id')
    .eq('status_pipeline', 'DEVOLVIDO_RH')
    .limit(5);

  if (e2) {
      console.error(e2);
  } else {
      console.log("Lancs: ", JSON.stringify(lancs, null, 2));
  }
}

main();
