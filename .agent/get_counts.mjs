import fs from 'fs';

const envStr = fs.readFileSync('env_local_copy.txt', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const baseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '');

const tables = [
    'operacoes_producao',
    'lancamentos_diaristas',
    'lancamentos_intermitentes',
    'servicos_extras_operacionais',
    'custos_extras_operacionais',
    'registros_ponto',
    'rh_fechamentos',
    'financeiro_competencias',
    'financeiro_consolidados_cliente',
    'cnab_remessas',
    // The audit table implemented in sprint 3:
    'app_audit_log'
];

async function countTable(table) {
    const url = `${baseUrl}/rest/v1/${table}?select=*`;
    const res = await fetch(url, {
        method: 'HEAD',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Prefer': 'count=exact',
            'Range': '0-0'
        }
    });

    if (res.status === 404) return 0; // table does not exist over postgrest
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
        return parseInt(contentRange.split('/')[1], 10);
    }
    return -1;
}

async function run() {
    const results = {};
    for (const t of tables) {
        results[t] = await countTable(t);
    }
    fs.writeFileSync('.agent/counts.json', JSON.stringify(results, null, 2), 'utf8');
    console.log("Counts saved to .agent/counts.json");
}

run();
