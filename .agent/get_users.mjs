import fs from 'fs';

function loadEnv() {
    let baseUrl = process.env.VITE_SUPABASE_URL;
    let key = process.env.VITE_SUPABASE_ANON_KEY;

    if ((!baseUrl || !key) && fs.existsSync('.env.local')) {
        const envStr = fs.readFileSync('.env.local', 'utf8');
        envStr.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const [k, ...vals] = trimmed.split('=');
            if (k && vals.length) {
                const cleanKey = k.trim();
                const cleanVal = vals.join('=').trim().replace(/^["']|["']$/g, '');
                if (cleanKey === 'VITE_SUPABASE_URL' && !baseUrl) baseUrl = cleanVal;
                if (cleanKey === 'VITE_SUPABASE_ANON_KEY' && !key) key = cleanVal;
            }
        });
    }

    if (!baseUrl || !key) {
        throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no ambiente ou no .env.local');
    }

    return { baseUrl, key: key.replace(/"/g, '') };
}

const { baseUrl, key } = loadEnv();

const fetchTable = async (table) => {
    const url = `${baseUrl}/rest/v1/${table}?select=*&limit=5`;
    const res = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
    return res.json();
}

async function run() {
    const perfis = await fetchTable('perfis');
    console.log("PERFIS (Users):");
    perfis.forEach(p => console.log(p.email, p.perfil));
}

run();
