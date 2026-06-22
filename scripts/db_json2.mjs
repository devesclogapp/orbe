import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function extract() {
    const rs = {};

    const { data: ciclo } = await supabase.from('ciclos_operacionais').select('status_financeiro').eq('id', '319d3f39-26de-42f6-afde-e99e724751b3').single();
    rs.cicloStatus = ciclo?.status_financeiro;

    const { data: errorLogs } = await supabase.from('logs').select('*').limit(5).order('created_at', { ascending: false });
    rs.logs = errorLogs;

    const { data: req } = await supabase.from('operacoes_producao').select('id').eq('empresa_id', 'df3b197e-0330-4c7a-b685-1ac0347bb751').gte('data_operacao', '2026-06-01').lt('data_operacao', '2026-07-01');
    rs.opsCountDf3b = req?.length;

    fs.writeFileSync('db_json2.txt', JSON.stringify(rs, null, 2), 'utf8');
}
extract();
