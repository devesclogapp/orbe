import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function investigate() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // 1. Obter jornada e regra ativas
  const { data: jornadas } = await supabase.from('jornadas_trabalho').select('*');
  const { data: regras } = await supabase.from('banco_horas_regras').select('*');
  const { data: empresas } = await supabase.from('empresas').select('id, nome');
  const empresaMap = new Map((empresas || []).map(e => [e.id, e.nome]));

  console.log('Jornadas no banco:', jornadas.map(j => ({ id: j.id, nome: j.nome, vigencia_inicio: j.vigencia_inicio, vigencia_fim: j.vigencia_fim, padrao: j.padrao })));
  console.log('Regras no banco:', regras.map(r => ({ id: r.id, nome: r.nome, escopo: r.escopo, vigencia_inicio: r.vigencia_inicio, vigencia_fim: r.vigencia_fim, status: r.status, bh_ativo: r.bh_ativo, adicional: r.adicional_hora_extra_percentual })));

  // 2. Pontos reais com data >= '2026-09-30'
  const { data: pontosRecentes, error: errPontos } = await supabase
    .from('registros_ponto')
    .select('*')
    .gte('data', '2026-09-30')
    .order('data', { ascending: false });

  console.log('\nPontos >= 2026-09-30 encontrados:', pontosRecentes?.length, 'error:', errPontos?.message);

  // Também verificar datas disponíveis próximas caso 30/09 tenha poucos ou nenhum ponto
  const { data: datasDistintas } = await supabase
    .from('registros_ponto')
    .select('data')
    .order('data', { ascending: false })
    .limit(100);

  const setDatas = Array.from(new Set((datasDistintas || []).map(p => p.data))).slice(0, 10);
  console.log('Últimas datas com registros de ponto no banco:', setDatas);

  // Mostrar primeiros 10 pontos >= 2026-09-30
  if (pontosRecentes && pontosRecentes.length > 0) {
    console.log('\nAmostra de pontos >= 2026-09-30:');
    for (const p of pontosRecentes.slice(0, 10)) {
      console.log(`Ponto ID: ${p.id} | Data: ${p.data} | ColabID: ${p.colaborador_id} | Nome: ${p.nome_colaborador} | Matrícula: ${p.matricula_colaborador} | Batidas: [${p.entrada || '-'}, ${p.saida_almoco || '-'}, ${p.retorno_almoco || '-'}, ${p.saida || '-'}] | is_teste: ${p.is_teste}`);
    }
  }

  // 3. Obter colaboradores reais associados aos pontos ou no banco
  const colabIds = Array.from(new Set((pontosRecentes || []).map(p => p.colaborador_id).filter(Boolean)));
  console.log('\nTotal de colabIds únicos nos pontos >= 30/09:', colabIds.length);

  if (colabIds.length > 0) {
    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('id, nome, matricula, cpf, tipo_colaborador, modelo_calculo, status, status_cadastro, cadastro_provisorio, valor_base, jornada_id, empresa_id')
      .in('id', colabIds.slice(0, 20));

    console.log('\nColaboradores amostrados:', colabs);
  }
}

investigate().catch(console.error);
