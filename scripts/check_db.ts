import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  const { data, error } = await supabase
    .from('custos_extras_operacionais')
    .select('id, pipeline_status, status_pagamento, descricao')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log('DB RESULTS:', data);
}
main();
