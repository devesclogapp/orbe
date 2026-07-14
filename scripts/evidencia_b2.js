import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    try {
        const { data: cols } = await supabase.from('lancamentos_intermitentes').select('*').limit(1);

        const { data: bad, error: bErr } = await supabase.from('lancamentos_intermitentes')
            .select('*')
            .eq('nome_colaborador', 'Intermitente Bad')
            .order('created_at', { ascending: false })
            .limit(1);

        const { count, error: cErr } = await supabase.from('empresas')
            .select('*', { count: 'exact', head: true })
            .ilike('nome', '%Dept (Teste)%');

        fs.writeFileSync('evidencia_b2.json', JSON.stringify({ cols_sample: cols, bad, count, bErr, cErr }, null, 2));
    } catch (e) {
        fs.writeFileSync('evidencia_b2.json', JSON.stringify({ error: e.message }));
    }
}
run();
