import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log('URL:', process.env.VITE_SUPABASE_URL);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.VITE_SUPABASE_ANON_KEY as string
);

async function run() {
  const { data: hist } = await supabase
    .from('historico_importacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2);
  
  console.log('Históricos:', JSON.stringify(hist, null, 2));

  const { data: lanc } = await supabase
    .from('lancamentos_intermitentes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Lancamentos:', JSON.stringify(lanc, null, 2));
}

run();
