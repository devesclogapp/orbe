import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env.local', 'utf-8');
const lines = envText.split('\n');
let supabaseUrl = '';
let serviceRole = '';

for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) serviceRole = line.split('=')[1].trim();
}

console.log("URL:", !!supabaseUrl, "SERVICE:", !!serviceRole);

if (!serviceRole) {
    console.log("No service role key found. Getting anon instead...");
    for (const line of lines) {
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) serviceRole = line.split('=')[1].trim();
    }
}

const supabase = createClient(supabaseUrl, serviceRole);

async function checkSchema() {
    const { data, error } = await supabase
        .from('operacoes_producao')
        .select('id, data_operacao, status, status_pagamento')
        .order('criado_em', { ascending: false })
        .limit(3);

    console.log("Error:", error);
    if (data && data.length > 0) {
        console.table(data);
    } else {
        console.log("No rows");
    }
}
checkSchema();
