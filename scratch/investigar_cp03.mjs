import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const validateColaboradorApto = (colaborador) => {
  if (!colaborador) return { apto: false, motivos: ["Colaborador não identificado no cadastro"] };
  const motivos = [];
  if (String(colaborador.tipo_colaborador ?? "").trim().toUpperCase() === "DIARISTA") {
    motivos.push("Diaristas não participam do Banco de Horas CLT");
  }
  if (colaborador.status_cadastro === "pendente_complemento") {
    motivos.push("Cadastro pendente de complemento");
  }
  if (colaborador.cadastro_provisorio === true) {
    motivos.push("Cadastro provisório ainda não completado");
  }
  const modelo = String(colaborador.modelo_calculo ?? "").trim();
  const contrato = String(colaborador.tipo_contrato ?? "").trim();
  if (!modelo && !contrato) {
    motivos.push("Tipo de contrato ou modelo de cálculo não definido");
  }
  const statusLc = String(colaborador.status ?? "").toLowerCase();
  if (["bloqueado", "inativo"].includes(statusLc)) {
    motivos.push(`Colaborador com status ${statusLc}`);
  }
  return { apto: motivos.length === 0, motivos };
};

async function main() {
    await supabase.auth.signInWithPassword({
        email: env.E2E_TEST_EMAIL,
        password: env.E2E_TEST_PASSWORD
    });

    console.log('=== CP03: INVESTIGAÇÃO DE ELEGIBILIDADE E REGRAS DE JORNADA ===\n');

    // 1. Buscar empresas para mapeamento de nomes
    const { data: empresas = [] } = await supabase
        .from('empresas')
        .select('id, nome, cadastro_provisorio, status');
    const empresaMap = new Map(empresas.map(e => [e.id, e.nome]));

    // 2. Buscar todos os colaboradores da base de produção
    // Filtro is_teste: null ou false
    const { data: todosColabs = [], error: colabErr } = await supabase
        .from('colaboradores')
        .select('*')
        .or('is_teste.is.null,is_teste.eq.false')
        .order('nome', { ascending: true });

    if (colabErr) {
        console.error('Erro ao buscar colaboradores:', colabErr);
        process.exit(1);
    }

    console.log(`Total de colaboradores encontrados na produção: ${todosColabs.length}`);

    // Identificar tipos de colaboradores existentes
    const tipos = new Set(todosColabs.map(c => `${c.tipo_colaborador || 'nulo'} / ${c.regime_trabalho || 'nulo'}`));
    console.log('Tipos / Regimes encontrados:', Array.from(tipos));

    // Filtrar colaboradores CLT
    // CLT: tipo_colaborador = 'clt' ou regime_trabalho = 'CLT' e tipo_colaborador !== 'DIARISTA' e !== 'INTERMITENTE'
    const colabsClt = todosColabs.filter(c => {
        const tipo = String(c.tipo_colaborador || '').toLowerCase();
        const regime = String(c.regime_trabalho || '').toUpperCase();
        if (tipo === 'diarista' || tipo === 'intermitente') return false;
        return tipo === 'clt' || regime === 'CLT';
    });

    console.log(`\n--- PARTE A: MAPEAR ELEGIBILIDADE REAL ---`);
    console.log(`Total de colaboradores CLT reais na produção: ${colabsClt.length}`);

    const aptos = [];
    const bloqueados = [];
    const motivosContagem = {};

    for (const colab of colabsClt) {
        const validacao = validateColaboradorApto(colab);
        if (validacao.apto) {
            aptos.push(colab);
        } else {
            bloqueados.push({
                colab,
                motivos: validacao.motivos
            });
            const motivoChave = validacao.motivos.sort().join(' + ');
            motivosContagem[motivoChave] = (motivosContagem[motivoChave] || 0) + 1;
        }
    }

    console.log(`- Quantidade APTA ao processamento RH: ${aptos.length}`);
    console.log(`- Quantidade BLOQUEADA: ${bloqueados.length}`);
    console.log('\nMotivos de bloqueio agrupados:');
    for (const [motivo, count] of Object.entries(motivosContagem)) {
        console.log(`  * [${count} colabs]: ${motivo}`);
    }

    if (aptos.length > 0) {
        console.log('\n--- LISTA DOS COLABORADORES CLT APTOS ---');
        aptos.forEach((c, idx) => {
            console.log(`\n[APTO #${idx + 1}]`);
            console.log(`- Nome: ${c.nome}`);
            console.log(`- Matrícula: ${c.matricula || '—'}`);
            console.log(`- CPF: ${c.cpf || '—'}`);
            console.log(`- Empresa: ${empresaMap.get(c.empresa_id) || c.empresa_id || '—'}`);
            console.log(`- modelo_calculo: ${c.modelo_calculo || '—'}`);
            console.log(`- tipo_contrato: ${c.tipo_contrato || '—'}`);
            console.log(`- status_cadastro: ${c.status_cadastro || '—'}`);
            console.log(`- cadastro_provisorio: ${c.cadastro_provisorio}`);
            console.log(`- bh_ativo: ${c.bh_ativo}`);
            console.log(`- jornada_contratada: ${c.jornada_contratada}`);
            console.log(`- salario_base / valor_hora / valor_base: ${c.salario_base} / ${c.valor_hora} / ${c.valor_base}`);
        });
    } else {
        console.log('\nNENHUM COLABORADOR CLT ENCONTRA-SE APTO (TODOS BLOQUEADOS NO GATE CADASTRAL).');
    }

    // 3. PARTE B: ESTADO ATUAL DE banco_horas_regras
    console.log('\n--- PARTE B: ESTADO ATUAL DE banco_horas_regras ---');
    const { data: regrasAtuais = [], error: regrasErr } = await supabase
        .from('banco_horas_regras')
        .select('*');

    console.log(`Total de regras cadastradas em banco_horas_regras: ${regrasAtuais.length}`);
    if (regrasAtuais.length > 0) {
        console.log(JSON.stringify(regrasAtuais, null, 2));
    } else {
        console.log('Confirmação: A tabela banco_horas_regras continua 100% VAZIA no banco.');
    }

    // 4. PARTE C & D: PONTOS PENDENTES NA COMPETÊNCIA SETEMBRO/2026 E SIMULAÇÃO DE LEITURA
    console.log('\n--- PARTE C & D: SIMULAÇÃO DE LEITURA DO PROCESSAMENTO ---');
    const { data: pontosPendentesSetembro = [], error: pontosErr } = await supabase
        .from('registros_ponto')
        .select('*')
        .or('is_teste.is.null,is_teste.eq.false')
        .in('status_processamento', ['pendente', 'PENDENTE', 'PENDENTE_PROCESSAMENTO'])
        .gte('data', '2026-09-01')
        .lte('data', '2026-09-30');

    console.log(`Total de pontos pendentes encontrados em setembro/2026 (produção): ${pontosPendentesSetembro.length}`);

    // Colaboradores distintos que possuem pontos pendentes em setembro/2026
    const colabIdsComPontos = new Set(pontosPendentesSetembro.map(p => p.colaborador_id).filter(Boolean));
    console.log(`Total de colaboradores com pontos pendentes em setembro/2026: ${colabIdsComPontos.size}`);

    // Verificar desses colaboradores, quantos passariam pelo gate
    let pontosDeAptos = 0;
    let pontosDeBloqueados = 0;
    const colabsAptosComPonto = [];
    const colabsBloqueadosComPonto = [];

    for (const colabId of colabIdsComPontos) {
        const colab = todosColabs.find(c => c.id === colabId);
        const pontosDoColab = pontosPendentesSetembro.filter(p => p.colaborador_id === colabId);
        const val = validateColaboradorApto(colab);
        if (val.apto) {
            pontosDeAptos += pontosDoColab.length;
            colabsAptosComPonto.push({ colab, pontosCount: pontosDoColab.length });
        } else {
            pontosDeBloqueados += pontosDoColab.length;
            colabsBloqueadosComPonto.push({ colab, pontosCount: pontosDoColab.length, motivos: val.motivos });
        }
    }

    console.log(`- Colaboradores com pontos que ATRAVESSARIAM o Gate: ${colabsAptosComPonto.length}`);
    console.log(`- Pontos que seriam processados: ${pontosDeAptos}`);
    console.log(`- Colaboradores com pontos que seriam BLOQUEADOS: ${colabsBloqueadosComPonto.length}`);
    console.log(`- Pontos que seriam bloqueados no Gate: ${pontosDeBloqueados}`);

    if (colabsAptosComPonto.length > 0) {
        console.log('\nColaboradores com pontos que passariam pelo Gate:');
        colabsAptosComPonto.forEach(item => {
            console.log(`  * ${item.colab.nome} (Matrícula ${item.colab.matricula}, ${item.pontosCount} pontos)`);
        });
    }

    // Verificar se há pontos sem colaborador_id vinculado
    const pontosSemColab = pontosPendentesSetembro.filter(p => !p.colaborador_id);
    console.log(`- Pontos pendentes sem colaborador_id vinculado: ${pontosSemColab.length}`);
}

main().catch(console.error);
