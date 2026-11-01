import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
    await supabase.auth.signInWithPassword({
        email: env.E2E_TEST_EMAIL,
        password: env.E2E_TEST_PASSWORD
    });

    const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'registros_ponto'::regclass;
        `
    });

    if (error) {
        // Se exec_sql nao existir, sem problemas
        console.log('rpc exec_sql error (expected if not exists):', error.message);
    } else {
        console.log('Constraints de registros_ponto:', data);
    }
}

main().catch(console.error);
