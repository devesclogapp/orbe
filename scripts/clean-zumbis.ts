import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("No service role key found. Skipping.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
    console.log("🔍 Procurando zumbis...");
    const { data: zumbis, error: errz } = await supabase.from('colaboradores').select('id, nome')
        .in('nome', ['Colaborador Existente Mock', 'Colaborador Zumbi Novo']);

    if (errz) {
        console.error("ERRO ao buscar zumbis:", errz);
        return;
    }

    if (!zumbis || zumbis.length === 0) {
        console.log("Nenhum zumbi encontrado!");
        return;
    }

    console.log(`Encontrei ${zumbis.length} zumbis. Apagando suas dependências de pontos...`);
    
    for (const z of zumbis) {
        await supabase.from('registros_ponto').delete().eq('colaborador_id', z.id);
        console.log(`⚠️ Limpou pontos de ${z.nome}`);
    }

    console.log("Removendo zumbis base...");
    const { error: delErr } = await supabase.from('colaboradores').delete().in('id', zumbis.map(z => z.id));
    if (delErr) {
        console.error("ERRO ao deletar zumbis:", delErr);
    } else {
        console.log("✅ Zumbis totalmente exterminados da producao.");
    }
}

run();
