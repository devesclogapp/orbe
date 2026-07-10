import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    const { data: cols } = await supabase
        .from('colaboradores')
        .select('id, nome, cpf, matricula, empresa_id')
        .order('created_at', { ascending: false })
        .limit(100);

    let output = "=== 100 ÚLTIMOS COLABORADORES ===\n";
    if (cols) {
        cols.forEach(c => output += `- ${c.nome} (empresa: ${c.empresa_id})\n`);
    } else {
        output += "Nenhum.\n";
    }
    fs.writeFileSync('all_colabs.txt', output);
    console.log("Salvo em all_colabs.txt");
}

run();
