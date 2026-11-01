import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // Consultar uma inserção com rollback via erro ou apenas consultar via RPC se houver,
  // ou tentar selecionar campos conhecidos
  const testCols = [
    'id', 'tenant_id', 'empresa_id', 'nome', 'prazo_compensacao_dias', 'tipo',
    'status', 'carga_horaria_diaria', 'tolerancia_atraso', 'tolerancia_hora_extra',
    'limite_diario_banco', 'validade_horas', 'regra_compensacao', 'regra_vencimento',
    'bh_ativo', 'jornada_contratada', 'origem_ponto', 'created_at', 'updated_at',
    'colaborador_id', 'cargo_id', 'escala_id', 'dias_semana', 'horario_entrada', 'horario_saida'
  ];

  console.log('Testando existência de colunas em banco_horas_regras...');
  for (const col of testCols) {
    const { error } = await supabase.from('banco_horas_regras').select(col).limit(1);
    if (!error) {
      console.log(`  ✅ Coluna EXISTE: ${col}`);
    } else {
      console.log(`  ❌ Coluna NÃO EXISTE: ${col} (${error.message})`);
    }
  }
}

run().catch(console.error);
