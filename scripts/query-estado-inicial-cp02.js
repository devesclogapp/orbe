import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("=== ESTADO INICIAL - CHECKPOINT 02 ===");

    // Lançamentos
    const { data: lancamentos, error: errLanc } = await supabase.from('lancamentos_intermitentes')
        .select('*');
    if (errLanc) console.error("Erro lançamentos:", errLanc);

    const recebidos = lancamentos?.filter(l => l.status === 'RECEBIDO') || [];

    // Lotes de fechamento
    const { data: lotes, error: errLotes } = await supabase.from('intermitentes_lotes_fechamento')
        .select('*');
    if (errLotes) console.error("Erro lotes:", errLotes);

    const estado_inicial = {
        lancamentos_totais: lancamentos?.length || 0,
        lancamentos_recebidos: recebidos.length,
        colaboradores_unicos_recebidos: new Set(recebidos.map(l => l.colaborador_id)).size,
        total_horas_recebidos: recebidos.reduce((acc, l) => acc + Number(l.horas_trabalhadas || 0), 0),
        valor_total_recebidos: recebidos.reduce((acc, l) => acc + Number(l.valor_total || 0), 0),
        lotes_pendentes_ou_fechados: lotes || [],
        lancamentos_por_status: lancamentos?.reduce((acc, l) => {
            acc[l.status] = (acc[l.status] || 0) + 1;
            return acc;
        }, {}) || {}
    };

    console.log(JSON.stringify(estado_inicial, null, 2));
    fs.writeFileSync('cp02-estado-inicial.json', JSON.stringify(estado_inicial, null, 2));
}

run().catch(console.error);
