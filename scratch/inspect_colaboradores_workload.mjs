import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectColaboradores() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const { data: all } = await supabase
    .from('colaboradores')
    .select('nome, tipo_colaborador, modelo_calculo, tipo_contrato, salario_base, valor_base, valor_hora, valor_diaria, jornada_contratada, is_teste');
    
  console.log(`Total colaboradores: ${all?.length || 0}`);
  
  const tipos = {};
  const contratos = {};
  const modelos = {};
  const jornadas = {};

  for (const c of all || []) {
    tipos[c.tipo_colaborador] = (tipos[c.tipo_colaborador] || 0) + 1;
    contratos[c.tipo_contrato] = (contratos[c.tipo_contrato] || 0) + 1;
    modelos[c.modelo_calculo] = (modelos[c.modelo_calculo] || 0) + 1;
    jornadas[c.jornada_contratada] = (jornadas[c.jornada_contratada] || 0) + 1;
  }

  console.log('Distribuicao tipo_colaborador:', tipos);
  console.log('Distribuicao tipo_contrato:', contratos);
  console.log('Distribuicao modelo_calculo:', modelos);
  console.log('Distribuicao jornada_contratada:', jornadas);

  // Filter those with tipo_colaborador = 'clt' or tipo_contrato = 'CLT' or 'mensal'
  const clts = (all || []).filter(c => 
    String(c.tipo_colaborador).toLowerCase() === 'clt' || 
    String(c.tipo_contrato).toLowerCase() === 'clt' ||
    String(c.tipo_contrato).toLowerCase() === 'mensal' ||
    String(c.modelo_calculo).toLowerCase().includes('clt')
  );

  console.log(`\nColaboradores relacionados a CLT/Mensal: ${clts.length}`);
  clts.slice(0, 10).forEach(c => {
    console.log(`  - ${c.nome} | tipo_colab: ${c.tipo_colaborador} | tipo_contrato: ${c.tipo_contrato} | modelo: ${c.modelo_calculo} | salario: ${c.salario_base} | valor_base: ${c.valor_base} | valor_hora: ${c.valor_hora} | jornada_contratada: ${c.jornada_contratada} | is_teste: ${c.is_teste}`);
  });
}

inspectColaboradores();
