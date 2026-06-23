import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const result = {
        etapa1: null,
        etapa2: null
    };

    const empresa_id = 'fbcbc831-f5c5-470b-894c-7e3ea7df5660';
    const competenciaStr = '2026-06';
    const cicloCompetencia = '2026-06-01'; // Formatar como os ciclos salvos, ou seja "2026-06"

    // 1. Validar Massa
    const { data: q1, count: count1 } = await supabase
        .from('operacoes_producao')
        .select('id, data_operacao, status', { count: 'exact' })
        .eq('empresa_id', empresa_id);

    result.etapa1 = { count: count1, datas: q1?.map(x => x.data_operacao), status: q1?.map(x => x.status) };

    // 2. Validar Ciclos
    const { data: q2 } = await supabase
        .from('ciclos_operacionais')
        .select('id, status_rh, status_financeiro, competencia')
        .eq('empresa_id', empresa_id)
        .eq('competencia', competenciaStr);

    result.etapa2 = q2;

    fs.writeFileSync('db_valida_final.json', JSON.stringify(result, null, 2));
}

run();
