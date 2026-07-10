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
    // 1. Check newly imported Collaborators
    const { data: cols, error: errCol } = await supabase.from('colaboradores')
        .select('*')
        .eq('tipo', 'INTERMITENTE')
        .order('created_at', { ascending: false });

    if (errCol) console.error("Error cols:", errCol);

    const cpfs = cols?.map(c => c.cpf).filter(c => c);
    const duplicatesCpf = cpfs?.filter((e, i, a) => a.indexOf(e) !== i);

    // 2. Check lancamentos
    const { data: lancamentos, error: errLanc } = await supabase.from('lancamentos_intermitentes')
        .select(`
            *
        `)
        .order('created_at', { ascending: false });

    if (errLanc) console.error("Error lancamentos:", errLanc);

    let recebidos = [];
    let zeros = [];
    let sumStats = {};
    if (lancamentos && lancamentos.length > 0) {
        recebidos = lancamentos.filter(l => l.status === 'RECEBIDO');
        zeros = recebidos.filter(l => Number(l.horas_trabalhadas || 0) === 0);

        sumStats = {
            numCols: new Set(recebidos.map(l => l.colaborador_id)).size,
            totalRows: recebidos.length,
            sumHoras: recebidos.reduce((acc, l) => acc + Number(l.horas_trabalhadas || 0), 0),
            sumNormais: recebidos.reduce((acc, l) => acc + Number(l.horas_normais || 0), 0),
            sumValor: recebidos.reduce((acc, l) => acc + Number(l.valor_total || 0), 0)
        };
    }

    fs.writeFileSync('intermitentes-data.json', JSON.stringify({
        total_colaboradores: cols?.length || 0,
        duplicatesCpf,
        total_lancamentos: lancamentos?.length || 0,
        samples: lancamentos?.slice(0, 5),
        recebidos_count: recebidos.length,
        zeros_count: zeros.length,
        sumStats
    }, null, 2));
    console.log("Data saved to intermitentes-data.json");
}
run().catch(console.error);
