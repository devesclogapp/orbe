import fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

async function run() {
    const baseUrl = env.VITE_SUPABASE_URL || 'https://lhkjtcfizmspilhryap.supabase.co';
    const url = `${baseUrl}/rest/v1/lancamentos_intermitentes?select=id,data_referencia,nome_colaborador,convocacao,origem&order=created_at.desc&limit=20`;

    const res = await fetch(url, {
        headers: {
            'apikey': env.VITE_SUPABASE_ANON_KEY.replace(/"/g, ''),
            'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '')}`
        }
    });

    const data = await res.json();
    if (res.ok) {
        data.forEach(d => {
            console.log(`ID: ${d.id} | Data Ref: ${d.data_referencia} | Nome: ${d.nome_colaborador} | Convocacao: ${d.convocacao} | Origem: ${d.origem}`);
        });
    } else {
        console.error('Error fetching data:', data);
    }
}

run();
