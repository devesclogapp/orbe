import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
    const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', PROD_TENANT_ID)
        .single();
        
    let tenantId = tenantData?.id || PROD_TENANT_ID;

    // Buscar a Empresa
    const { data: emp, error: empErr } = await supabase
        .from('empresas')
        .select('id, nome, is_teste, cadastro_provisorio')
        .eq('tenant_id', tenantId)
        .eq('is_teste', true)
        .limit(1)
        .maybeSingle();

    fs.writeFileSync('e2e_debug_info.json', JSON.stringify({
        usedKey: 'ANON_KEY',
        tenantIdUsado: tenantId, 
        empData: emp || null, 
        empError: empErr || null,
        matchesProdTenant: tenantId === PROD_TENANT_ID
    }, null, 2));

    console.log("Debug info written to e2e_debug_info.json");
}

run();
