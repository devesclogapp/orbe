import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
console.log(process.env.VITE_SUPABASE_URL);

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('operacoes_producao')
    .select('id')
    .is('deleted_at', null)
    .limit(1);
if (error) console.log('ERROR:', JSON.stringify(error, null, 2));
else console.log('DATA:', data);
