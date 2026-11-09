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

async function fetchLogs() {
    const res = await fetch(`${baseUrl}/rest/v1/audit_log?select=*&limit=5`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const logs = await res.json();
    fs.writeFileSync('.agent/audit_res.json', JSON.stringify(logs, null, 2));
}

fetchLogs();
