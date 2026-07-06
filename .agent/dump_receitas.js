import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpReceitas() {
    const { data: receitas, error } = await supabase
        .from('receitas_operacionais')
        .select('*')
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${receitas.length} records.`);
        console.log(JSON.stringify(receitas, null, 2));
    }
}

dumpReceitas();
