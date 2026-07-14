import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
    const { data } = await supabase.from('tenants').select('*').limit(10);
    fs.writeFileSync('_check.json', JSON.stringify(data, null, 2));
}
run();
