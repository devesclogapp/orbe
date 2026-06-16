const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) VITE_SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

const payload = {
    // We don't have a reliable tenant ID locally right off the bat, maybe we can fetch one first if we had the service key, 
    // but let's just leave it empty and let the Edge Function fail or we find a tenant?
    // Since we access Orbe ERP, there's test data in `tenants`.
};

async function testFetch() {
    console.log("Checking if local Supabase edge function works...", VITE_SUPABASE_URL);

    const testPayload = {
        "tenant_id": "8f830aab-1763-4ba0-a35c-fe2ab96996db", // dummy, we need a real one if it fails
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
        ]
    };

    const fnUrl = VITE_SUPABASE_URL.replace('localhost:54321', '127.0.0.1:54321') + '/functions/v1/importar-intermitentes-tio';

    try {
        const req = await fetch(fnUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        const res = await req.json();
        console.log("RESULTADO =>", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("ERROR =>", err.message);

        // let's try direct insert in case function isn't hosted
        console.log("Edge function fetch failed, probably not running via 'supabase functions serve'.");
    }
}

testFetch();
