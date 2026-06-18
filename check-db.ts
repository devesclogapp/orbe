import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lhkjtcfizmspilhryap.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Faltando variaveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('lancamentos_intermitentes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro:', error);
  } else {
    data.forEach(d => {
      console.log(`ID: ${d.id} | Data Ref: ${d.data_referencia} | Nome: ${d.nome_colaborador} | Convocacao: ${d.convocacao} | Origem: ${d.origem}`);
    });
  }
}

run();
