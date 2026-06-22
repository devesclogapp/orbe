import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://lifgjtcflzmspilhryap.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.log("Missing key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: clientes } = await supabase.from('clientes').select('*');
    const { data: consolidados } = await supabase.from('financeiro_consolidados_cliente').select('*');
    const { data: faturas } = await supabase.from('faturas').select('*');

    console.log("Qtd Clientes:", clientes?.length);
    const mirror = clientes?.find(c => c.nome.includes('Dismelo'));
    console.log("Dismelo Client exists?", !!mirror, mirror);

    console.log("Qtd Consolidados:", consolidados?.length);
    if (consolidados?.length > 0) {
        console.log("Últimos Consolidados:", JSON.stringify(consolidados.slice(0, 3), null, 2));
    }

    console.log("Qtd Faturas:", faturas?.length);
}

run();
