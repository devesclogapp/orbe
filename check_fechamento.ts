import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// ensure we load from correct path
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// If the table uses RLS, we might need the service role key to see everything easily if we're not authenticated.
// But wait, the user operates as an authenticated Admin/Financeiro. We may query the table using the service key or login.
// Since service role might not be available, let's see. Let's try ANON first.

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Querying intermitentes_lotes_fechamento for VALIDADO_RH...');
  const { data, error } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*')
    .eq('status', 'VALIDADO_RH');

  if (error) {
    console.error('Error fetching batches:', error);
  } else {
    console.log('Found batches:', JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
      const loteId = data[0].id;
      const { data: lancamentos, error: errLanc } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .eq('lote_fechamento_id', loteId);
        
      if (!errLanc) {
        console.log(`Found ${lancamentos.length} lancamentos for lote ${loteId}.`);
      }
    }
  }
}

main().catch(console.error);
