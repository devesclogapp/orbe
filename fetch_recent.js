import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].trim();
const anonKey = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY')).split('=')[1].trim();

async function run() {
    const query = `${url}/rest/v1/operacoes_producao?select=${encodeURIComponent('*,empresas(nome),produtos_carga(nome),production_entry_collaborators(*)')}&order=criado_em.desc&limit=5`;
    const res = await fetch(query, {
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
