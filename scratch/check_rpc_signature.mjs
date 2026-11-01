import { createClient } from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/@supabase/supabase-js/dist/index.mjs';
import dotenv from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/dotenv/lib/main.js';
dotenv.config({ path: 'y:/2026/ERP ESC LOG/Orbe/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function checkLegacyDrop() {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
        console.error("Auth error:", authErr);
        return;
    }

    // Call using old param names
    const rpcRes = await supabase.rpc('rpc_aplicar_cnab_retorno', {
        p_banco_codigo: '341',
        p_nome_arquivo: 'CHECK_SIG.RET',
        p_hash_arquivo: 'check_sig_old',
        p_empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
        p_conta_bancaria_id: 'faecb252-7b9e-407d-93a5-e10466d35b0e',
        p_itens: []
    });

    console.log("RPC call with legacy params:", rpcRes.error?.message);
}

checkLegacyDrop();
