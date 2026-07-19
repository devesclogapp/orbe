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
    const allLotes = await req('intermitentes_lotes_fechamento?select=id,status');
    console.log(`Lotes atuais na base:`, JSON.stringify(allLotes, null, 2));
}

main().catch(console.error);
