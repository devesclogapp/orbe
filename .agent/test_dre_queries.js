import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAll() {
    console.log("Testing receitas_operacionais...");
    const res1 = await supabase.from('receitas_operacionais').select('valor_total, status, created_at, updated_at').limit(1);
    if (res1.error) console.error("Error 1:", res1.error);

    console.log("Testing diaristas_lotes_fechamento...");
    const res2 = await supabase.from('diaristas_lotes_fechamento').select('valor_total, status, periodo_inicio, created_at, updated_at').limit(1);
    if (res2.error) console.error("Error 2:", res2.error);

    console.log("Testing rh_financeiro_lotes...");
    const res3 = await supabase.from('rh_financeiro_lotes').select('status, created_at, updated_at, lote_itens:rh_financeiro_lote_itens(valor_calculado)').limit(1);
    if (res3.error) console.error("Error 3:", res3.error);

    console.log("Testing lotes_remessa...");
    const res4 = await supabase.from('lotes_remessa').select('id, valor_total, status, status_conciliacao, created_at').limit(1);
    if (res4.error) console.error("Error 4:", res4.error);

    console.log("Testing cnab_remessas_arquivos...");
    const res5 = await supabase.from('cnab_remessas_arquivos').select('id, lote_id, total_valor, status, competencia, data_geracao, updated_at').limit(1);
    if (res5.error) console.error("Error 5:", res5.error);

    console.log("Testing cnab_retorno_itens...");
    const res6 = await supabase.from('cnab_retorno_itens').select(`valor_retornado, status, created_at, remessa_arquivo:cnab_remessas_arquivos!remessa_arquivo_id(competencia)`).limit(1);
    if (res6.error) console.error("Error 6:", res6.error);

    console.log("Testing custos_extras_operacionais...");
    const res7 = await supabase.from('custos_extras_operacionais').select('total, status_pagamento, criado_em, atualizado_em').limit(1);
    if (res7.error) console.error("Error 7:", res7.error);

    console.log("Testing servicos_extras_operacionais...");
    const res8 = await supabase.from('servicos_extras_operacionais').select('total, pipeline_status, criado_em, atualizado_em').limit(1);
    if (res8.error) console.error("Error 8:", res8.error);
}

testAll().then(() => console.log("Done."));
