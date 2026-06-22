import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const result = {
        etapa3: [],
        etapa8: []
    };

    const candidateTables = ['operacoes_producao', 'operacoes'];

    for (const table of candidateTables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (!error && count !== null) {
                result.etapa3.push({ tabela: table, count });
            }
        } catch (e) { }
    }

    const { data: ciclos } = await supabase.from('ciclos_operacionais').select('id, competencia, status_rh, status_financeiro, empresa_id, criado_em').order('criado_em', { ascending: false }).limit(5);
    result.etapa8 = ciclos || [];

    fs.writeFileSync('auditoria_db_output.json', JSON.stringify(result, null, 2));
}
run();
