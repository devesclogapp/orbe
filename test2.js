const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const client = createClient(url, key);

async function test() {
    const { data, error } = await client.from('lancamentos_diaristas')
        .select('*')
        .gte('data_lancamento', '2026-05-25')
        .lte('data_lancamento', '2026-05-31')
        .order('data_lancamento', { ascending: false })
        .order('nome_colaborador', { ascending: true });
    console.log('lancamentos_diaristas error:', error);

    const { data: lotes, error: errorLotes } = await client
        .from('diaristas_lotes_fechamento')
        .select('*, empresa:empresas(nome)')
        .gte('periodo_inicio', '2026-05-25')
        .lte('periodo_fim', '2026-05-31')
        .order('created_at', { ascending: false });
    console.log('lotes error:', errorLotes);
}
test();
