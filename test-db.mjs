import fs from 'fs';
import https from 'https';

let SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if ((!SUPABASE_URL || !SUPABASE_KEY) && fs.existsSync('.env.local')) {
    const envStr = fs.readFileSync('.env.local', 'utf8');
    envStr.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [k, ...vals] = trimmed.split('=');
        if (k && vals.length) {
            const cleanKey = k.trim();
            const cleanVal = vals.join('=').trim().replace(/^["']|["']$/g, '');
            if (cleanKey === 'VITE_SUPABASE_URL' && !SUPABASE_URL) SUPABASE_URL = cleanVal;
            if (cleanKey === 'VITE_SUPABASE_ANON_KEY' && !SUPABASE_KEY) SUPABASE_KEY = cleanVal;
        }
    });
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
    process.exit(1);
}

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
        const out = {};
        const empresaNome = 'DISMELO CASTANHAL';
        const emps = await fetchSupa(`empresas?select=id,nome&nome=eq.${encodeURIComponent(empresaNome)}&limit=1`);
        const empId = emps[0]?.id;
        out.empresa = { nome: empresaNome, id: empId };

        const lotes = await fetchSupa(`diaristas_lotes_fechamento?select=*&periodo_inicio=lte.2026-06-07&periodo_fim=gte.2026-06-01${empId ? '&empresa_id=eq.' + empId : ''}`);
        out.lotes = Array.isArray(lotes) ? lotes : { error: lotes };

        const qLanc = `lancamentos_diaristas?select=*&data_lancamento=gte.2026-06-01&data_lancamento=lte.2026-06-07${empId ? '&empresa_id=eq.' + empId : ''}`;
        const lanc = await fetchSupa(qLanc);

        if (!Array.isArray(lanc)) {
            out.lancamentos = { error: lanc };
        } else {
            const statMap = {};
            let comLote = 0, comCiclo = 0;
            lanc.forEach(i => {
                statMap[i.status] = (statMap[i.status] || 0) + 1;
                if (i.lote_fechamento_id) comLote++;
                if (i.diarista_ciclo_id) comCiclo++;
            });
            out.lancamentos = {
                total: lanc.length,
                status_agrupados: statMap,
                com_lote_id: comLote,
                com_ciclo_id: comCiclo,
                tenant_sample: lanc.length > 0 ? lanc[0].tenant_id : null
            };
        }

        fs.writeFileSync('db_out.json', JSON.stringify(out, null, 2));
    } catch (err) {
        fs.writeFileSync('db_out.json', JSON.stringify({ error: err }));
    }
}
run();
