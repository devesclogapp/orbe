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

    const { count: totalPontosSetembro } = await supabase
        .from('registros_ponto')
        .select('*', { count: 'exact', head: true })
        .or('is_teste.is.null,is_teste.eq.false')
        .in('status_processamento', ['pendente', 'PENDENTE', 'PENDENTE_PROCESSAMENTO'])
        .gte('data', '2026-09-01')
        .lte('data', '2026-09-30');

    console.log(`Contagem EXATA de pontos pendentes em setembro/2026: ${totalPontosSetembro}`);

    // Verificar se existe algum colaborador com status_cadastro != pendente_complemento
    const { data: colabsStatus } = await supabase
        .from('colaboradores')
        .select('id, nome, status_cadastro, cadastro_provisorio, tipo_colaborador, regime_trabalho')
        .or('is_teste.is.null,is_teste.eq.false');

    const statusCadastroSet = new Set(colabsStatus.map(c => c.status_cadastro));
    const cadastroProvisorioSet = new Set(colabsStatus.map(c => c.cadastro_provisorio));
    console.log('Valores distintos de status_cadastro:', Array.from(statusCadastroSet));
    console.log('Valores distintos de cadastro_provisorio:', Array.from(cadastroProvisorioSet));
}

main().catch(console.error);
