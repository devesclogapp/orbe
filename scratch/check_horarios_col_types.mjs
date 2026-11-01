import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

async function check() {
  // 1. Isolated DB
  const pg = new Client({ host: '127.0.0.1', port: 54332, user: 'postgres', database: 'postgres' });
  await pg.connect();
  const resPg = await pg.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'operacoes_producao' AND column_name IN ('entrada_ponto', 'saida_ponto');
  `);
  console.log('Isolated DB types:', resPg.rows);
  await pg.end();

  // 2. Official Supabase via RPC / sample
  const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: auth } = await sb.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });
  const { data: opData } = await sb.from('operacoes_producao')
    .select('id, entrada_ponto, saida_ponto')
    .not('entrada_ponto', 'is', null)
    .limit(3);
  console.log('Official Supabase sample data:', opData);
}

check().catch(console.error);
