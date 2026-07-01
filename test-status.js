import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('operacoes_producao')
        .select('id, status')
        .limit(1);

    if (error) {
        console.error("Error fetching", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No operacoes found");
        return;
    }

    const currentStatus = data[0].status;
    console.log(`Trying to update item ${itemId} from status ${currentStatus} to 'aprovado'`);

    const res1 = await supabase.from('operacoes_producao').update({ status: 'aprovado' }).eq('id', itemId);
    console.log("Res 1:", res1.error);

    const res2 = await supabase.from('operacoes_producao').update({ status: 'validado_rh' }).eq('id', itemId);
    console.log("Res 2:", res2.error);

    const res3 = await supabase.from('operacoes_producao').update({ justificativa_recusa: 'test' }).eq('id', itemId);
    console.log("Res 3 justificativa_recusa:", res3.error);

    const res4 = await supabase.from('operacoes_producao').update({ justificativa: 'test' }).eq('id', itemId);
    console.log("Res 4 justificativa:", res4.error);
}

main();
