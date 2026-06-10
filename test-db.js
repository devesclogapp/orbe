const fs = require('fs');
const https = require('https');

// Simple parse dotenv
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\\n').forEach(line => {
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
        const empresaNome = 'DISMELO CASTANHAL';
        // Get empresa ID
        const empQuery = `empresas?select=id,nome&nome=eq.${encodeURIComponent(empresaNome)}&limit=1`;
        const emps = await fetchSupa(empQuery);
        const empId = emps[0]?.id;
        console.log('Empresa ID:', empId);

        console.log('\\n--- 1. LOTES ---');
        const qLotes = `diaristas_lotes_fechamento?select=id,empresa_id,periodo_inicio,periodo_fim,status,valor_total,quantidade_diaristas,total_registros,tenant_id&periodo_inicio=lte.2026-06-07&periodo_fim=gte.2026-06-01${empId ? '&empresa_id=eq.' + empId : ''}`;
        const lotes = await fetchSupa(qLotes);
        console.log(JSON.stringify(lotes, null, 2));

        console.log('\\n--- 2. LANCAMENTOS ---');
        const qLanc = `lancamentos_diaristas?select=id,status,lote_fechamento_id,diarista_ciclo_id,data_lancamento,tenant_id,empresa_id&data_lancamento=gte.2026-06-01&data_lancamento=lte.2026-06-07${empId ? '&empresa_id=eq.' + empId : ''}`;
        const lanc = await fetchSupa(qLanc);

        console.log(`Total lancamentos: ${lanc?.length}`);
        const statMap = {};
        let comLote = 0, comCiclo = 0;
        lanc?.forEach(i => {
            statMap[i.status] = (statMap[i.status] || 0) + 1;
            if (i.lote_fechamento_id) comLote++;
            if (i.diarista_ciclo_id) comCiclo++;
        });
        console.log('Status agrupados:', JSON.stringify(statMap));
        console.log(`Com lote_id: ${comLote} | Com ciclo_id: ${comCiclo}`);

    } catch (err) {
        console.error('Error', err);
    }
}
run();
