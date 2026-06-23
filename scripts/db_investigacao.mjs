import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const result = {
        policies: null,
        columns: null,
        err: null
    };

    try {
        // 1. pg_policies
        const { data: pol, error: e1 } = await supabase.from('pg_policies').select('*').eq('tablename', 'clientes');
        result.policies = pol || e1;

        // 2. financeiro_consolidados_cliente schema type via OpenAPI fetch (since information_schema is restricted)
        const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const res = await fetch(url);
        const spec = await res.json();
        result.columns = spec?.definitions?.["financeiro_consolidados_cliente"]?.properties;
    } catch (e) {
        result.err = e.message;
    }

    fs.writeFileSync('db_investigacao.json', JSON.stringify(result, null, 2));
}

run();
