import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    console.log("--- HISTORICO RECENTE ---");
    const { data: history } = await supabase
        .from('historico_importacoes')
        .select('id, created_at, status, quantidade_registros, origem, nome_arquivo')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(JSON.stringify(history, null, 2));

    if (history && history.length > 0) {
        const latestId = history[0].id;
        console.log("\n--- REGISTROS PONTO PARA O ULTIMO LOTE (" + latestId + ") ---");
        const { data: pontos, count } = await supabase
            .from('registros_ponto')
            .select('id, data, competencia, colaborador_id, empresa_id, tenant_id', { count: 'exact' })
            .eq('importacao_id', latestId);

        console.log("Count:", count);
        if (pontos && pontos.length > 0) {
            console.log("Amostra do primeiro registro:", JSON.stringify(pontos[0], null, 2));
        } else {
            console.log("Nenhum registro encontrado vinculado a este ID de importação.");
        }

        console.log("\n--- BUSCA GERAL POR DATA (2026-05) ---");
        const { data: gPontos, count: gCount } = await supabase
            .from('registros_ponto')
            .select('id, data, competencia, tenant_id', { count: 'exact' })
            .gte('data', '2026-05-01')
            .lte('data', '2026-05-31')
            .limit(5);
        console.log("Total em Maio:", gCount);
        console.log("Amostra:", JSON.stringify(gPontos, null, 2));
    }
}
investigate();
