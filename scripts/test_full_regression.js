import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getE2EContext } from './utils/e2e-guard.ts';

dotenv.config({ path: '.env.local' });

async function runTests() {
    console.log("=== INICIANDO REGRESSÃO CIRÚRGICA ===");
    const { supabase, tenantId } = await getE2EContext();
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    console.log(`✅ TenantID configurado: ${tenantId}\n`);

    const dataReferencia = '2026-07-28';

    // 1. TESTE CLT (importar-pontos-rhid)
    console.log("=== 1. TESTANDO CLT (importar-pontos-rhid) ===");
    const payloadRhid = {
        tenant_id: tenantId,
        items: [
            {
                data: dataReferencia,
                pessoa_nome: "Colaborador Zumbi Novo",
                pessoa_matricula: "MAT-9999",
                empresa_nome: "Empresa Inedita Auto-Curativa SA",
                horas_trabalhadas: 8
            },
            {
                data: dataReferencia,
                pessoa_nome: "Colaborador Existente Mock",
                pessoa_matricula: "MAT-1111",
                empresa_nome: "Empresa Existente Mock SA",
                horas_trabalhadas: 4
            }
        ]
    };

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/importar-pontos-rhid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'x-tenant-id': tenantId
            },
            body: JSON.stringify(payloadRhid)
        });

        const text = await res.text();
        console.log("-> Resposta RHID:", text);
    } catch (err) {
        console.error("-> Erro RHID:", err);
    }

    // 2. TESTE INTERMITENTES (importar-intermitentes-tio)
    console.log("\n=== 2. TESTANDO TIO DIGITAL (importar-intermitentes-tio) ===");
    const payloadTio = {
        tenant_id: tenantId,
        items: [
            {
                data: dataReferencia,
                colaborador_nome: "Intermitente Sem Rumo",
                departamento: "Empresa Inedita Auto-Curativa SA", // A que o CLT deve ter acabado de criar
                horas: 6
            },
            {
                data: dataReferencia,
                colaborador_nome: "Intermitente Em Nova Empresa",
                departamento: "Departamento Desconhecido ZXZX", // Vai forçar a criacao auto-curativa do TIO
                horas: 7
            }
        ]
    };

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/importar-intermitentes-tio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'x-tenant-id': tenantId
            },
            body: JSON.stringify(payloadTio)
        });

        const text = await res.text();
        console.log("-> Resposta TIO:", text);
    } catch (err) {
        console.error("-> Erro TIO:", err);
    }
}

runTests();
