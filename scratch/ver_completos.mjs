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

    const { data: colabsCompletos } = await supabase
        .from('colaboradores')
        .select('*')
        .or('is_teste.is.null,is_teste.eq.false')
        .eq('status_cadastro', 'completo');

    console.log(`Colaboradores com status_cadastro = 'completo': ${colabsCompletos.length}`);
    for (const c of colabsCompletos) {
        console.log(`- Nome: ${c.nome} | Tipo: ${c.tipo_colaborador} | Regime: ${c.regime_trabalho} | Provisório: ${c.cadastro_provisorio} | Empresa: ${c.empresa_id}`);
    }

    const { data: colabsNaoProvisorios } = await supabase
        .from('colaboradores')
        .select('*')
        .or('is_teste.is.null,is_teste.eq.false')
        .eq('cadastro_provisorio', false);

    console.log(`\nColaboradores com cadastro_provisorio = false: ${colabsNaoProvisorios.length}`);
    for (const c of colabsNaoProvisorios) {
        console.log(`- Nome: ${c.nome} | Tipo: ${c.tipo_colaborador} | Regime: ${c.regime_trabalho} | StatusCadastro: ${c.status_cadastro} | Empresa: ${c.empresa_id}`);
    }
}

main().catch(console.error);
