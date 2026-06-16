const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) VITE_SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

const payload = [
    {
        "colaborador_nome": "DAVID LOHAN DE MELO MENEZES",
        "data": "2026-05-28",
        "periodo_original": "28/05/2026 - 29/05/2026",
        "convocacao": "Carga e descarga - Cópia",
        "cargo": "CARREGADOR DE CARGA E DESCARGA",
        "departamento": "Operacional Noturno",
        "horas_trabalhadas": "07:59",
        "horas_normais": "02:58",
        "he_50": "00:01",
        "he_100": "00:00",
        "hora_noturna": "05:42",
        "total": 88.84,
        "origem": "tio_digital_relatorio_pagamento",
        "arquivo_origem": "teste_relatorio_pagamento_tio.xlsx"
    },
    {
        "colaborador_nome": "ESAU DA COSTA DOS SANTOS",
        "data": "2026-05-27",
        "periodo_original": "27/05/2026 - 27/05/2026",
        "convocacao": "Carga e descarga",
        "cargo": "CARREGADOR DE CARGA E DESCARGA",
        "departamento": "BENEVIDES",
        "horas_trabalhadas": "10:36",
        "horas_normais": "10:36",
        "he_50": "00:00",
        "he_100": "00:00",
        "hora_noturna": "00:00",
        "total": 100.53,
        "origem": "tio_digital_relatorio_pagamento",
        "arquivo_origem": "teste_relatorio_pagamento_tio.xlsx"
    }
];

const parseFloatSafe = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'string' && val.includes(':')) {
        const parts = val.split(':');
        const hours = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        return hours + (mins / 60);
    }
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
};

async function testFetch() {
    console.log("Inserindo payload fake no tenant 1...");

    const fnUrl = VITE_SUPABASE_URL + '/rest/v1/lancamentos_intermitentes';

    try {
        // Descobrindo um tenant qualquer
        const reqT = await fetch(VITE_SUPABASE_URL + '/rest/v1/tenants?select=id&limit=1', {
            headers: { 'apikey': VITE_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY }
        });
        const tRes = await reqT.json();
        const tId = tRes[0]?.id;

        if (!tId) throw new Error("No tenant");

        const rows = payload.map(item => ({
            tenant_id: tId,
            nome_colaborador: item.colaborador_nome || 'Desconhecido',
            data_referencia: item.data,
            competencia: item.data.substring(0, 7),
            convocacao: item.convocacao || 'Sem referência',
            cargo: item.cargo,
            departamento: item.departamento,
            horas_trabalhadas: parseFloatSafe(item.horas_trabalhadas),
            horas_normais: parseFloatSafe(item.horas_normais),
            he_50: parseFloatSafe(item.he_50),
            he_100: parseFloatSafe(item.he_100),
            hora_noturna: parseFloatSafe(item.hora_noturna),
            total: parseFloatSafe(item.total),
            origem: 'tio_digital',
            status_pipeline: 'RECEBIDO'
        }));

        const reqMap = await fetch(fnUrl, {
            method: 'POST',
            headers: {
                'apikey': VITE_SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(rows)
        });

        const res = await reqMap.json();
        console.log("INSERT RESULTADO =>", JSON.stringify(res, null, 2));

        const verify = await fetch(fnUrl + '?select=nome_colaborador,total', { headers: { 'apikey': VITE_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY } });
        const veriData = await verify.json();
        console.log("TOTAL NA TABELA: ", veriData.length);
    } catch (err) {
        console.error("ERROR =>", err.message);
    }
}

testFetch();
