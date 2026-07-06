import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDashboardQueries() {
    const startRange = '2026-01-01';
    const endRange = '2027-01-01';
    const yearPart = 2026;

    console.log("1. receitas_operacionais");
    const r1 = await supabase.from('receitas_operacionais')
        .select('valor_total, status, created_at, updated_at')
        .gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`);
    if (r1.error) console.error("Error 1:", r1.error);
    else console.log("Success 1:", r1.data.length);

    console.log("2. diaristas_lotes_fechamento");
    const r2 = await supabase.from('diaristas_lotes_fechamento')
        .select('valor_total, status, periodo_inicio, created_at, updated_at')
        .gte('periodo_inicio', startRange)
        .lt('periodo_inicio', endRange);
    if (r2.error) console.error("Error 2:", r2.error);

    console.log("3. rh_financeiro_lotes");
    const r3 = await supabase.from('rh_financeiro_lotes')
        .select('status, created_at, updated_at, lote_itens:rh_financeiro_lote_itens(valor_calculado)')
        .gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`);
    if (r3.error) console.error("Error 3:", r3.error);

    console.log("4. lotes_remessa");
    const r4 = await supabase.from('lotes_remessa')
        .select('id, valor_total, status, status_conciliacao, created_at')
        .gte('competencia', `${yearPart}-01`).lt('competencia', `${yearPart + 1}-01`);
    if (r4.error) console.error("Error 4:", r4.error);
    else console.log("Success 4:", r4.data.length);

    console.log("5. custos_extras_operacionais");
    const r5 = await supabase.from('custos_extras_operacionais')
        .select('total, status_pagamento, criado_em, atualizado_em')
        .gte('data', startRange)
        .lt('data', endRange);
    if (r5.error) console.error("Error 5:", r5.error);

    console.log("6. servicos_extras_operacionais");
    const r6 = await supabase.from('servicos_extras_operacionais')
        .select('total, pipeline_status, criado_em, atualizado_em')
        .gte('data', startRange)
        .lt('data', endRange);
    if (r6.error) console.error("Error 6:", r6.error);
}

testDashboardQueries().then(() => console.log("Done."));
