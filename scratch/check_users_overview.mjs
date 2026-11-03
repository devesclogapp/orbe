import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const { data: rows, error } = await supabase.rpc('admin_list_user_access_overview');
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('--- ADMIN_LIST_USER_ACCESS_OVERVIEW ---');
    console.log(`Total rows: ${rows.length}`);
    rows.forEach(r => {
      console.log(`[${r.record_type}] ${r.full_name || 'N/A'} | role: ${r.role} | status: ${r.status} | email: ${r.email ? r.email.replace(/(?<=.{3}).(?=.*@)/g, '*') : 'N/A'}`);
    });
  }

  // Check tenants table again
  const { data: tenants } = await supabase.from('tenants').select('*');
  console.log('\n--- TENANTS DETAILS ---');
  console.log(tenants);
}

run().catch(console.error);

