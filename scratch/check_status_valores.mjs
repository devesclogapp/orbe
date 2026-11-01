import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
    await supabase.auth.signInWithPassword({
        email: env.E2E_TEST_EMAIL,
        password: env.E2E_TEST_PASSWORD
    });

    const { data: pontos } = await supabase
        .from('registros_ponto')
        .select('id, status_processamento, status, data, colaborador_id, matricula_colaborador')
        .gte('data', '2026-09-01')
        .lte('data', '2026-09-30');

    const statusProcessamentoSet = new Set();
    const statusSet = new Set();
    for (const p of pontos || []) {
        statusProcessamentoSet.add(p.status_processamento);
        statusSet.add(p.status);
    }

    console.log('Valores distintos de status_processamento em setembro/2026:', Array.from(statusProcessamentoSet));
    console.log('Valores distintos de status em setembro/2026:', Array.from(statusSet));

    const jorgePontos = pontos.filter(p => p.matricula_colaborador === '44');
    console.log('Total pontos Jorge em setembro:', jorgePontos.length);
    console.log('status_processamento dos pontos do Jorge:', Array.from(new Set(jorgePontos.map(p => p.status_processamento))));

    // Verificar se existe algum ponto com PENDENTE_PROCESSAMENTO
    const { count: pendentesProcessamentoCount } = await supabase
        .from('registros_ponto')
        .select('*', { count: 'exact', head: true })
        .eq('status_processamento', 'PENDENTE_PROCESSAMENTO');

    const { count: pendenteCount } = await supabase
        .from('registros_ponto')
        .select('*', { count: 'exact', head: true })
        .eq('status_processamento', 'pendente');

    console.log('Count com PENDENTE_PROCESSAMENTO no banco todo:', pendentesProcessamentoCount);
    console.log('Count com pendente no banco todo:', pendenteCount);
}

main().catch(console.error);
