import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
    const { data, error } = await supabase.rpc('get_triggers_for_table', { table_name: 'diaristas_lotes_fechamento' });
    if (error) {
        if (error.code === 'PGRST202') {
            console.log('RPC does not exist, using standard query...');
            // just query pg_trigger if we can, but anon key might not have access
        }
    } else {
        console.log(data);
    }
}
checkTriggers();
