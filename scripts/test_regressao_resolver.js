// scripts/test_regressao_resolver.js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getE2EContext } from './utils/e2e-guard.ts';

dotenv.config({ path: '.env.local' });

async function runTests() {
    console.log("=== INICIANDO REGRESSÃO CIRÚRGICA ===");

    const { supabase, tenantId } = await getE2EContext();
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    console.log(`✅ TenantID isolado para o teste: ${tenantId}`);

    // Pegar uma Empresa existente para os testes Reutilizados
    const { data: dbEmp, error: dbEmpErr } = await supabase.from('empresas').select('id, nome').eq('tenant_id', tenantId).not('nome', 'is', null).limit(1);
    const empresaExistenteNome = dbEmp && dbEmp[0] ? dbEmp[0].nome : "Empresa Default Teste";

    const dataReferencia = '2026-07-27';

    // 1. TESTE CLT (importar-pontos-rhid)
    console.log("\n=== TESTANDO CLT (importar-pontos-rhid) ===");
    const payloadRhid = {
        tenant_id: tenantId,
        items: [
            {
                data: dataReferencia,
                pessoa_nome: "Colaborador Zumbi Novo",
                pessoa_matricula: "MAT-9999",
                empresa_nome: "Empresa Totalmente Nova e Fantasma SA",
                horas_trabalhadas: 8,
                entrada: "08:00",
                saida: "17:00"
            },
            {
                data: dataReferencia,
                pessoa_nome: "Colaborador Existente", // Para simplificar, vou mandar só nome
                pessoa_matricula: "MAT-1111",
                empresa_nome: empresaExistenteNome, // Empresa que já existe
                horas_trabalhadas: 4,
            }
        ]
    };

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/importar-pontos-rhid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`, // Fallback se tiver anon role
                'x-tenant-id': tenantId
            },
            body: JSON.stringify(payloadRhid)
        });

        const json = await res.json();
        console.log("Resposta RHID:", json);
    } catch (err) {
        console.error("Erro RHID:", err);
    }

    // 2. TESTE INTERMITENTES (importar-intermitentes-tio)
    console.log("\n=== TESTANDO TIO DIGITAL (importar-intermitentes-tio) ===");
    const payloadTio = {
        tenant_id: tenantId,
        items: [
            {
                data: dataReferencia,
                colaborador_nome: "Intermitente Sem Rumo",
                departamento: "Empresa Totalmente Nova e Fantasma SA", // A que acabou de ser criada pelo RHID, ou criará de novo se omitir 
                horas: 6,
            },
            {
                data: dataReferencia,
                colaborador_nome: "Intermitente Existente",
                departamento: "Departamento Desconhecido ZXZX", // Essa deverá acionar a criacao auto-curativa do Resolver
                horas: 7,
            }
        ]
    };

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/importar-intermitentes-tio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
                'x-tenant-id': tenantId
            },
            body: JSON.stringify(payloadTio)
        });

        const json = await res.json();
        console.log("Resposta TIO:", json);
    } catch (err) {
        console.error("Erro TIO:", err);
    }
}

runTests();
