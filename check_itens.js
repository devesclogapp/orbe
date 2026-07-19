import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/(?:VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_ANON_KEY)=(.*)/);

const BASE_URL = urlMatch[1].trim();
const KEY = keyMatch[1].trim();

async function req(path, method = 'GET', body = null) {
    const url = `${BASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error(`HTTP ERRO ${res.status} [${path}]: ${txt}`);
        throw new Error(`Rest error`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function main() {
    const lotes = await req('rh_financeiro_lotes?select=id,valor_total,status,total_colaboradores&tipo=eq.INTERMITENTES');
    console.log(`Lotes Intermitentes (financeiro):`, JSON.stringify(lotes, null, 2));

    if (lotes && lotes.length > 0) {
        for (const l of lotes) {
            const itens = await req(`rh_financeiro_lote_itens?select=id,status,valor_calculado,colaborador_id&lote_id=eq.${l.id}`);
            console.log(`-> Lote ${l.id} tem ${itens?.length || 0} itens.`);
        }
    }
}

main().catch(console.error);
