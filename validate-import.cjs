const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) VITE_SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

const body = {
    "tenant_id": "09ccafb6-2cf2-4c83-ac3d-a2913947693c",
    "origem": "tio_digital_relatorio_pagamento",
    "arquivo_origem": "teste_relatorio_pagamento_tio.xlsx",
    "items": [
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
            "total": 88.84
        }
    ]
};

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
    console.log("Simulando execução Edge Function local para inserir!");

    const tenant_id = body.tenant_id;
    const items = body.items;
    const rootOrigem = body.origem || 'tio_digital';
    const rootArquivoOrigem = body.arquivo_origem || null;

    const validos = [];

    for (const item of items) {
        const rawName = item.colaborador_nome || item.colaborador;
        const compVal = item.data ? item.data.substring(0, 7) : 'SEM-COMP';

        const launchBase = {
            tenant_id,
            nome_colaborador: rawName || 'Desconhecido',
            data_referencia: item.data,
            competencia: compVal,
            convocacao: item.convocacao || 'Sem referência',
            cargo: item.cargo,
            departamento: item.departamento,
            horas_trabalhadas: parseFloatSafe(item.horas_trabalhadas),
            horas_normais: parseFloatSafe(item.horas_normais),
            he_50: parseFloatSafe(item.he_50),
            he_100: parseFloatSafe(item.he_100),
            hora_noturna: parseFloatSafe(item.hora_noturna),
            total: parseFloatSafe(item.total),
            origem: item.origem || rootOrigem,
            arquivo_origem: item.arquivo_origem || rootArquivoOrigem,
            status_pipeline: 'RECEBIDO'
        };

        validos.push(launchBase);
    }

    const fnUrl = VITE_SUPABASE_URL + '/rest/v1/lancamentos_intermitentes';

    try {
        const reqMap = await fetch(fnUrl, {
            method: 'POST',
            headers: {
                'apikey': VITE_SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(validos)
        });

        if (reqMap.status === 201) {
            console.log("HTTP 200 (EDGE Simulada Sucesso).");
        } else {
            console.log("Falha:", reqMap.status);
        }
        const resJSON = await reqMap.json();
        console.log("Inseridos:", JSON.stringify(resJSON, null, 2));

    } catch (err) {
        console.error("ERROR =>", err.message);
    }
}

testFetch();
