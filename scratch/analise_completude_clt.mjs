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

    const { data: colabsClt } = await supabase
        .from('colaboradores')
        .select('*')
        .or('is_teste.is.null,is_teste.eq.false')
        .or('tipo_colaborador.eq.clt,regime_trabalho.eq.CLT')
        .neq('tipo_colaborador', 'DIARISTA');

    console.log(`Análise de completude cadastral dos ${colabsClt.length} colaboradores CLT:`);

    let comMatricula = 0;
    let comCpf = 0;
    let comEmpresa = 0;
    let comModeloCalculo = 0;
    let comTipoContrato = 0;
    let comJornadaContratada = 0;
    let comSalarioBase = 0;
    let comValorBase = 0;
    let comValorHora = 0;

    for (const c of colabsClt) {
        if (c.matricula) comMatricula++;
        if (c.cpf) comCpf++;
        if (c.empresa_id) comEmpresa++;
        if (c.modelo_calculo) comModeloCalculo++;
        if (c.tipo_contrato) comTipoContrato++;
        if (c.jornada_contratada) comJornadaContratada++;
        if (c.salario_base) comSalarioBase++;
        if (c.valor_base) comValorBase++;
        if (c.valor_hora) comValorHora++;
    }

    console.log(`- Com matrícula: ${comMatricula}/${colabsClt.length}`);
    console.log(`- Com CPF: ${comCpf}/${colabsClt.length}`);
    console.log(`- Com empresa_id: ${comEmpresa}/${colabsClt.length}`);
    console.log(`- Com modelo_calculo: ${comModeloCalculo}/${colabsClt.length}`);
    console.log(`- Com tipo_contrato: ${comTipoContrato}/${colabsClt.length}`);
    console.log(`- Com jornada_contratada: ${comJornadaContratada}/${colabsClt.length}`);
    console.log(`- Com salario_base: ${comSalarioBase}/${colabsClt.length}`);
    console.log(`- Com valor_base: ${comValorBase}/${colabsClt.length}`);
    console.log(`- Com valor_hora: ${comValorHora}/${colabsClt.length}`);

    // Distribuição de modelos de cálculo
    const modelos = {};
    for (const c of colabsClt) {
        const m = c.modelo_calculo || 'NÃO DEFINIDO';
        modelos[m] = (modelos[m] || 0) + 1;
    }
    console.log('\nDistribuição de modelos de cálculo:', modelos);

    // Distribuição de jornadas contratadas
    const jornadas = {};
    for (const c of colabsClt) {
        const j = c.jornada_contratada ?? 'NÃO DEFINIDO';
        jornadas[j] = (jornadas[j] || 0) + 1;
    }
    console.log('Distribuição de jornadas contratadas:', jornadas);
}

main().catch(console.error);
