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
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    try {
        const lotes = await fetchSupa('diaristas_lotes_fechamento?select=id,status,valor_total,empresa_id,periodo_inicio,periodo_fim,empresas(nome)&valor_total=eq.360');
        console.log("== DIARISTAS_LOTES_FECHAMENTO ==");
        console.log(JSON.stringify(lotes, null, 2));

        const fechamentos = await fetchSupa('rh_financeiro_lotes?select=id,status,valor_total,competencia,tipo,empresa_id,empresas(nome)&valor_total=eq.360');
        console.log("== RH_FINANCEIRO_LOTES ==");
        console.log(JSON.stringify(fechamentos, null, 2));
    } catch (err) {
        console.error('Error', err);
    }
}
run();
