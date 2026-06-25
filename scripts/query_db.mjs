import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const getEnv = () => {
    const content = fs.readFileSync('.env.local', 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length) {
            env[key.trim()] = values.join('=').trim();
        }
    });
    return env;
};

const env = getEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Querying db...");
    const { data: BENEVIDES, error: err1 } = await supabase.from('empresas').select('id, nome, tenant_id').ilike('nome', '%BENEVIDES%');
    console.log("BENE", BENEVIDES, err1);

    const { data: CASTANHAL, error: err2 } = await supabase.from('empresas').select('id, nome, tenant_id').ilike('nome', '%Castanhal%');
    console.log("CASTANHAL", CASTANHAL, err2);

    // Also let's check RLS by selecting without filters to see if anon can read all.
    const { data: ANY, error: err3 } = await supabase.from('empresas').select('id').limit(1);
    console.log("ANY check:", ANY?.length, err3);
}

run();
