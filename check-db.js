const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('lancamentos_intermitentes')
        .select('id, data_referencia, nome_colaborador, convocacao, origem')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Erro:', error);
    } else {
        data.forEach(d => {
            console.log(`ID: ${d.id} | Data Ref: ${d.data_referencia} | Nome: ${d.nome_colaborador} | Convocacao: ${d.convocacao} | Origem: ${d.origem}`);
        });
    }
}
run();
