const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) VITE_SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

const payload = {
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

async function checkDeployment() {
    console.log('--- ETAPA 1: VERIFICAR TABELA ---');
    try {
        const reqT = await fetch(VITE_SUPABASE_URL + '/rest/v1/lancamentos_intermitentes?select=id', {
            headers: { 'apikey': VITE_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY }
        });
        console.log("Tabela Status:", reqT.status);
    } catch (err) {
        console.log("Falha na tabela:", err.message);
    }

    console.log('\n--- ETAPA 2: TESTAR EDGE FUNCTION ---');
    try {
        const reqFUrl = VITE_SUPABASE_URL + '/functions/v1/importar-intermitentes-tio';

        // Dummy POST to check if 404
        const reqFOptions = await fetch(reqFUrl, {
            method: 'OPTIONS'
        });
        console.log("Edge Function Options Status:", reqFOptions.status);

        // THE REAL POST PAYLOAD
        console.log("-> Disparando payload do Tio Digital...");
        const reqPost = await fetch(reqFUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY,  // Will act as ANON but edge might bypass or fail. Let's see if we used anon key.
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log("Edge Function POST Status:", reqPost.status);
        const resJSON = await reqPost.json();
        console.log("Edge Function Result:", JSON.stringify(resJSON, null, 2));

    } catch (err) {
        console.error("Falha na chamada Edge:", err.message);
    }

    console.log('\n--- ETAPA 3: VERIFICAR DADOS PERSISTIDOS ---');
    try {
        const reqData = await fetch(VITE_SUPABASE_URL + '/rest/v1/lancamentos_intermitentes?select=nome_colaborador,status_pipeline,origem,arquivo_origem', {
            headers: { 'apikey': VITE_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + VITE_SUPABASE_ANON_KEY }
        });
        const veriData = await reqData.json();
        console.log("Dados salvos e lidos pelo frontend:", JSON.stringify(veriData, null, 2));
    } catch (e) {
        console.log("Erro Lendo Dados:", e.message);
    }
}

checkDeployment();
