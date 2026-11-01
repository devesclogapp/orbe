import { createClient } from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/@supabase/supabase-js/dist/index.mjs';
import dotenv from 'file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/dotenv/lib/main.js';
dotenv.config({ path: 'y:/2026/ERP ESC LOG/Orbe/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function runAudit() {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
        console.error("Auth error:", authErr);
        return;
    }

    console.log("=== AUDITORIA PÓS-APLICAÇÃO FIX-RET-03 (READ-ONLY) ===\n");

    const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
    const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
    const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';

    // 1. Remessa NSA 10
    const { data: remessa, error: remErr } = await supabase
        .from('cnab_remessas_arquivos')
        .select('*')
        .eq('id', remessaId)
        .single();
    console.log("1. REMESSA NSA 10 (cnab_remessas_arquivos):", remessa, remErr);

    // 2. Itens da Remessa NSA 10
    const { data: remItens, error: remItensErr } = await supabase
        .from('cnab_remessa_itens')
        .select('*')
        .eq('remessa_id', remessaId);
    console.log("\n2. ITENS DA REMESSA NSA 10 (cnab_remessa_itens):", remItens, remItensErr);

    // 3. Lote Operacional Intermitentes
    const { data: loteOp, error: loteOpErr } = await supabase
        .from('intermitentes_lotes_fechamento')
        .select('*')
        .eq('id', loteOpId)
        .single();
    console.log("\n3. LOTE OPERACIONAL (intermitentes_lotes_fechamento):", loteOp, loteOpErr);

    // 4. Lote RH / Financeiro Espelho
    const { data: loteRh, error: loteRhErr } = await supabase
        .from('rh_financeiro_lotes')
        .select('*')
        .eq('id', loteRhId)
        .single();
    console.log("\n4. LOTE RH/FINANCEIRO ESPELHO (rh_financeiro_lotes):", loteRh, loteRhErr);

    // 5. Itens do Lote RH Espelho
    const { data: loteRhItens, error: loteRhItensErr } = await supabase
        .from('rh_financeiro_lote_itens')
        .select('*')
        .eq('lote_id', loteRhId);
    console.log("\n5. ITENS DO LOTE RH ESPELHO (rh_financeiro_lote_itens):", loteRhItens, loteRhItensErr);

    // 6. Lançamentos Intermitentes
    const { data: lancs, error: lancsErr } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .eq('lote_fechamento_id', loteOpId);
    console.log("\n6. LANÇAMENTOS INTERMITENTES:", lancs, lancsErr);

    // 7. Retornos associados à NSA 10
    const { data: retArqs, error: retArqsErr } = await supabase
        .from('cnab_retorno_arquivos')
        .select('*')
        .eq('remessa_arquivo_id', remessaId);
    console.log("\n7. RETORNOS ARQUIVOS VINCULADOS À NSA 10:", retArqs, retArqsErr);

    const { data: retItens, error: retItensErr } = await supabase
        .from('cnab_retorno_itens')
        .select('*')
        .eq('remessa_arquivo_id', remessaId);
    console.log("\n8. RETORNOS ITENS VINCULADOS À NSA 10:", retItens, retItensErr);

    // 8. Empresa
    if (remessa && remessa.empresa_id) {
        const { data: emp, error: empErr } = await supabase
            .from('empresas')
            .select('id, nome, is_teste, tenant_id')
            .eq('id', remessa.empresa_id)
            .single();
        console.log("\n9. EMPRESA VINCULADA:", emp, empErr);
    }

    // 9. Verificar RPC OpenAPI spec
    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        const spec = await resp.json();
        const rpcPath = spec.paths['/rpc/rpc_aplicar_cnab_retorno'];
        console.log("\n10. POSTGREST OPENAPI SPEC FOR rpc_aplicar_cnab_retorno:", JSON.stringify(rpcPath, null, 2));
    } catch (e) {
        console.log("\n10. OPENAPI SPEC fetch error:", e.message);
    }
}

runAudit();
