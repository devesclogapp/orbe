import { createClient } from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/@supabase/supabase-js/dist/index.mjs';
import dotenv from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/dotenv/lib/main.js';
dotenv.config({ path: 'y:/2026/ERP ESC LOG/Orbe/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function check() {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
        console.error("Auth error:", authErr);
        return;
    }
    const token = authData.session.access_token;

    const resp = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/openapi+json, application/json'
        }
    });
    console.log("Status with user token:", resp.status);
    const text = await resp.text();
    try {
        const spec = JSON.parse(text);
        if (spec.paths) {
            console.log("Paths count:", Object.keys(spec.paths).length);
            const rpcPaths = Object.keys(spec.paths).filter(p => p.includes('rpc'));
            console.log("RPC paths matching 'rpc':", rpcPaths);
            if (spec.paths['/rpc/rpc_aplicar_cnab_retorno']) {
                console.log("\nDetails of /rpc/rpc_aplicar_cnab_retorno:");
                console.log(JSON.stringify(spec.paths['/rpc/rpc_aplicar_cnab_retorno'], null, 2));
            }
        } else {
            console.log("Parsed JSON:", spec);
        }
    } catch (e) {
        console.log("Raw text:", text);
    }
}

check();
