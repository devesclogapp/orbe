import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'example';

const supabase = createClient(supabaseUrl, supabaseKey);

const payload = {
    tenant_id: "00000000-0000-0000-0000-000000000000", // Will be replaced by real tenant_id if available
    items: [
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

async function test() {
    // Try to find a valid tenant
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (tenants && tenants.length > 0) {
        payload.tenant_id = tenants[0].id;
    }

    console.log("Invoking edge function 'importar-intermitentes-tio' with tenant_id", payload.tenant_id);

    const { data, error } = await supabase.functions.invoke('importar-intermitentes-tio', {
        body: payload
    });

    if (error) {
        console.error("EDGE FUNCTION INVOCATION ERROR:", error);
    } else {
        console.log("EDGE FUNCTION RESULT:", data);
    }
}

test();
