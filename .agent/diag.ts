import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
    console.error('Sem URL do Supabase');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        const { count: c1, error: e1 } = await supabase.from('receitas_operacionais').select('*', { count: 'exact', head: true });
        if (e1) console.error('Erro receitas:', e1.message);
        
        const { count: c2, error: e2 } = await supabase.from('receitas_operacionais_itens').select('*', { count: 'exact', head: true });
        if (e2) console.error('Erro itens:', e2.message);
        
        console.log(`count_receitas: ${c1}`);
        console.log(`count_itens: ${c2}`);
        
    } catch(e) {
        console.error(e);
    }
}
run();
