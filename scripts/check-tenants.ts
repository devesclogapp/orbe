import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
    const { data, error } = await supabase.from('tenants').select('*').limit(1);
    console.log(error);
    if (data) {
        console.log(Object.keys(data[0]));
    }
}
run();
