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
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: env.E2E_TEST_EMAIL,
        password: env.E2E_TEST_PASSWORD
    });

    if (authErr) {
        console.error('Auth error:', authErr);
        return;
    }
    console.log('Autenticado como:', auth.user.email);

    // 1. Colaborador Jorge Bruno
    const { data: colabs, error: colabsErr } = await supabase
        .from('colaboradores')
        .select('*')
        .or('matricula.eq.44,cpf.eq.00695498266,nome.ilike.%Jorge Bruno%');

    console.log('\n=== 1. COLABORADOR JORGE BRUNO ===');
    console.log(JSON.stringify(colabs, null, 2));

    const jorge = colabs?.[0];
    const empresaId = jorge?.empresa_id;
    const colabId = jorge?.id;
    const tenantId = jorge?.tenant_id;

    // 2. Empresa
    console.log('\n=== 2. EMPRESA ===');
    if (empresaId) {
        const { data: empresa } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', empresaId);
        console.log(JSON.stringify(empresa, null, 2));
    }

    // 3. Regras de Banco de Horas
    console.log('\n=== 3. REGRAS DE BANCO DE HORAS ===');
    const { data: regras } = await supabase
        .from('banco_horas_regras')
        .select('*');
    console.log(JSON.stringify(regras, null, 2));

    // 4. Pontos em Setembro/2026
    console.log('\n=== 4. PONTOS DO JORGE EM SETEMBRO/2026 ===');
    let pontosQuery = supabase
        .from('registros_ponto')
        .select('*')
        .gte('data', '2026-09-01')
        .lte('data', '2026-09-30')
        .order('data', { ascending: true });

    if (colabId) {
        pontosQuery = pontosQuery.eq('colaborador_id', colabId);
    } else {
        pontosQuery = pontosQuery.eq('matricula_colaborador', '44');
    }

    const { data: pontos, error: pontosErr } = await pontosQuery;
    if (pontosErr) console.error('Erro pontos:', pontosErr);
    console.log(`Total de pontos encontrados: ${pontos?.length}`);

    // Exibir amostras
    console.log('\nExemplos de pontos:');
    for (const p of pontos || []) {
        console.log(`Data: ${p.data} | Ent: ${p.entrada} | SAlm: ${p.saida_almoco} | RAlm: ${p.retorno_almoco} | Sai: ${p.saida} | Status: ${p.status} | StatusProc: ${p.status_processamento} | HorasCalc: ${p.horas_calculadas} | SaldoDia: ${p.saldo_dia} | MinExtra: ${p.minutos_extra} | MinAtraso: ${p.minutos_atraso} | Regra: ${p.regra_aplicada}`);
    }

    // 5. Inconsistencias
    console.log('\n=== 5. INCONSISTENCIAS DO JORGE ===');
    if (colabId) {
        const { data: incons } = await supabase
            .from('processamento_rh_inconsistencias')
            .select('*')
            .eq('colaborador_id', colabId);
        console.log(JSON.stringify(incons, null, 2));
    }

    // 6. Eventos BH
    console.log('\n=== 6. EVENTOS BH DO JORGE ===');
    if (colabId) {
        const { data: eventos } = await supabase
            .from('banco_horas_eventos')
            .select('*')
            .eq('colaborador_id', colabId);
        console.log(JSON.stringify(eventos, null, 2));
    }

    // 7. Saldos BH
    console.log('\n=== 7. SALDOS BH DO JORGE ===');
    if (colabId) {
        const { data: saldos } = await supabase
            .from('banco_horas_saldos')
            .select('*')
            .eq('colaborador_id', colabId);
        console.log(JSON.stringify(saldos, null, 2));
    }
}

main().catch(console.error);
