import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Check column type for status
    const { data, error } = await supabase.rpc('get_column_info', { table_name: 'intermitentes_lotes_fechamento', column_name: 'status' }).catch(() => ({ data: null, error: 'RPC failed' }));
    console.log("RPC check error:", error, "Data:", data);

    // Instead of querying info_schema directly via REST (which might fail), let's just attempt to see if there's a CHECK constraint or ENUM by causing a type error or just reading the DB structure if possible.
    // Actually, we can fetch the old batch:
    const loteId = '6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0';
    const { data: lote, error: errLote } = await supabase.from('intermitentes_lotes_fechamento').select('*').eq('id', loteId).single();
    console.log("Lote:", lote, "Error:", errLote);

    const { data: lancamentos, error: errLanc } = await supabase.from('lancamentos_intermitentes').select('*').eq('lote_fechamento_id', loteId);
    console.log("Lançamentos:", lancamentos?.length, "Error:", errLanc);

    if (lancamentos && lancamentos.length > 0) {
        const empresas = new Set(lancamentos.map(l => l.empresa_id));
        console.log("Empresas vinculadas aos lançamentos:", Array.from(empresas));
    }
}

run();
