import dotenv from 'dotenv';
import { getE2EContext } from './utils/e2e-guard.ts';
dotenv.config({ path: '.env.local' });

async function run() {
    console.log("=== INJETANDO E2E HML PONTOS ===");

    const { supabase, tenantId } = await getE2EContext();
    console.log("Tenant Id:", tenantId);

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    const dateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const cenarios = [
        { nome: 'CLT-HML-001', entrada: '08:00', saida_almoco: '12:00', retorno_almoco: '13:00', saida: '17:00', hrs: '08:00', ext: '00:00', atr: '00:00', flt: '00:00' },
        { nome: 'CLT-HML-002', entrada: '08:00', saida_almoco: '12:00', retorno_almoco: '13:00', saida: '19:00', hrs: '10:00', ext: '02:00', atr: '00:00', flt: '00:00' },
        { nome: 'CLT-HML-003', entrada: '09:00', saida_almoco: '12:00', retorno_almoco: '13:00', saida: '17:00', hrs: '07:00', ext: '00:00', atr: '01:00', flt: '00:00' },
        { nome: 'CLT-HML-004', entrada: '08:00', saida_almoco: '12:00', retorno_almoco: '13:00', saida: null, hrs: '04:00', ext: '00:00', atr: '00:00', flt: '00:00' },
        { nome: 'CLT-HML-005', entrada: null, saida_almoco: null, retorno_almoco: null, saida: null, hrs: '00:00', ext: '00:00', atr: '00:00', flt: '08:00' },
    ];

    const payload = cenarios.map(c => ({
        tenant_id: tenantId,
        empresa_nome: 'HOMOLOGAÇÃO',
        pessoa_nome: c.nome,
        // Optional identifiers if they don't have them in the mock payload it should match by name
        data: dateStr,
        entrada: c.entrada,
        saida_almoco: c.saida_almoco,
        retorno_almoco: c.retorno_almoco,
        saida: c.saida,
        horas_trabalhadas: c.hrs,
        hora_extra: c.ext,
        atraso: c.atr,
        falta: c.flt
    }));

    // Post to EDGE FUNCTION directly to simulate Tio Digital
    const functionUrl = `${supabaseUrl}/functions/v1/importar-pontos-rhid`;
    console.log(`Disparando webhook: ${functionUrl}`);

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}` // Usando a Anon key que invoca a edge funct normal
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("HTTP Code:", res.status);
        console.dir(data, { depth: null });
    } catch (e) {
        console.error("Erro Fetch:", e);
    }
}

run();
