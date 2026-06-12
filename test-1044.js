const fs = require('fs');
const https = require('https');

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY;

function fetchSupa(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        const req = https.request(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) { resolve(data); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    try {
        console.log("== HISTORICO 10:44 ==");
        // 10:44 BRT = 13:44 UTC
        const hist = await fetchSupa('historico_importacoes?select=id,status,quantidade_registros,created_at,origem,erro_processamento&created_at=gte.2026-06-12T13:40:00Z&created_at=lte.2026-06-12T14:50:00Z');
        console.log(JSON.stringify(hist, null, 2));

        console.log("\n== REGISTROS PONTO UPSERTADOS HOJE (LIMIT 5) ==");
        const points = await fetchSupa('registros_ponto?select=id,created_at,data,colaborador_id,status,origem&created_at=gte.2026-06-12T13:40:00Z&order=created_at.desc&limit=5');
        console.log(JSON.stringify(points, null, 2));

    } catch (err) {
        console.error('Error', err);
    }
}
run();
