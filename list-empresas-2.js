import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceRoleMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const serviceKey = serviceRoleMatch ? serviceRoleMatch[1].trim() : envFile.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n]+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
    const { data } = await supabase.from('empresas').select('id, nome');
    console.log(data?.map(d => d.nome).join(', '));
}
check();
