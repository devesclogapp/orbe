import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
// get service role key or fallback
const serviceRoleMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const serviceKey = serviceRoleMatch ? serviceRoleMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
    const { data: dismelo } = await supabase.from('empresas').select('id, nome').ilike('nome', '%DISMELO CASTANHAL%').limit(1).single();
    if (!dismelo) return console.log("Dismelo not found");
    console.log("Dismelo ID:", dismelo.id);

    const { count, error } = await supabase.from('lancamentos_diaristas')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', dismelo.id)
        .gte('data_lancamento', '2026-06-01')
        .lte('data_lancamento', '2026-06-07');

    console.log("Registros inseridos na semana 01 a 07 de junho:", count);
    if (error) console.log("Erro select:", error);

    const { data: sample, error: error2 } = await supabase.from('lancamentos_diaristas')
        .select('id, encarregado_id, nome_colaborador, data_lancamento')
        .eq('empresa_id', dismelo.id)
        .gte('data_lancamento', '2026-06-01')
        .lte('data_lancamento', '2026-06-07')
        .limit(2);

    if (sample && sample.length > 0) {
        console.log("Sample existe.");
    } else {
        console.log("Nenhum sample");
    }
}

check();
