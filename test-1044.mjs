import fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY;

async function fetchSupa(endpoint) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        console.error("HTTP Erro:", res.status, res.statusText);
        console.error(await res.text());
        return null;
    }
    return res.json();
}

async function run() {
    try {
        console.log("== HISTORICO 10:44 ==");
        // Buscando todas as importacoes do dia pra achar a hora exata
        const hist = await fetchSupa('historico_importacoes?select=id,status,quantidade_registros,created_at,origem,erro_processamento');
        if (hist) {
            console.log(JSON.stringify(hist.slice(0, 10), null, 2));
            const exec1044 = hist.find(h => h.created_at.includes('13:44:') || h.created_at.includes('10:44:'));
            if (exec1044) {
                console.log("ACHOU A EXECUÇÃO DAS 10:44:");
                console.log(JSON.stringify(exec1044, null, 2));
            } else {
                console.log("-> Nao achou 10:44 exato (talvez seja block RLS). Listando as primeiras 3:");
                console.log(hist.slice(0, 3));
            }
        }

        console.log("\n== REGISTROS DE DUPLICATAS NA TABELA DE PONTO ==");
        // RPC calls are not directly possible without pg_dump or defined function.
        // Let's at least check the records today
        const points = await fetchSupa('registros_ponto?select=id,created_at,data,colaborador_id,status,origem&limit=100');
        if (!points) {
            console.log("Registros Ponto não retornaram dados (Provável bloqueio RLS na Anon Key).");
        } else {
            console.log(`Total records fetched: ${points.length}`);
            if (points.length > 0) {
                const dups = {};
                points.forEach(p => {
                    const key = p.data + '_' + p.colaborador_id;
                    dups[key] = (dups[key] || 0) + 1;
                });
                let duplosCount = 0;
                for (const k in dups) { if (dups[k] > 1) { console.log('Duplicado:', k, 'Qtd:', dups[k]); duplosCount++; } }
                console.log('Total de casos duplicados (data+colab):', duplosCount);
            }
        }

    } catch (err) {
        console.error('Error', err);
    }
}
run();
