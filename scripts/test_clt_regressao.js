// scripts/test_clt_regressao.js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function runCLT() {
    console.log("=== INICIANDO REGRESSÃO CIRÚRGICA CLT ===");
    console.log("-> 1. Preparando Payload (Empresa Nova, Colaborador Existente, Colaborador Novo)");

    // Usamos CLT-HML-001 para que a Edge Function do RHID descubra o tenantId magicamente!
    const payloadRhid = {
        items: [
            {
                data: '2026-07-28',
                pessoa_nome: "Colaborador Fantasma V3",
                pessoa_matricula: "NEW-HML-999",
                empresa_nome: "Empresa Inedita Auto-Curativa SA",
                horas_trabalhadas: 8,
            },
            {
                data: '2026-07-28',
                pessoa_nome: "Colaborador Oficial",
                pessoa_matricula: "CLT-HML-001", // Magia do Tenant Resolver Interno
                empresa_nome: "Empresa Inedita Auto-Curativa SA", // Força vínculo
                horas_trabalhadas: 4,
            }
        ]
    };

    console.log("-> 2. Disparando POST para importar-pontos-rhid na NUVEM");
    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/importar-pontos-rhid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(payloadRhid)
        });

        const text = await res.text();
        console.log("-> 3. Resposta Recebida:", text);
    } catch (err) {
        console.error("Erro na Request CLT:", err);
    }
}

runCLT();
