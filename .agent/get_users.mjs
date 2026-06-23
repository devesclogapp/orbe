import fs from 'fs';

const envStr = fs.readFileSync('env_local_copy.txt', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const baseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '');

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
