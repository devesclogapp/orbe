import pkg from 'pg';
import fs from 'fs';
const { Client } = pkg;

async function apply() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  console.log('Connected to isolated postgres 54323.');

  const sql = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
  await client.query(sql);
  console.log('Migration 20261014180000 successfully applied on isolated postgres 54323!');

  await client.end();
}

apply().catch(console.error);
