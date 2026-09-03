import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('tipos_servico_operacional')
    .select('*')
    .limit(1);
    
  if (error) console.error(error);
  else {
    console.log("Keys available:", Object.keys(data[0]));
    console.log("Sample data:", data[0]);
  }
}

run();
