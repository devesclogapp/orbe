import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function parseNumericWithDefault(value, defaultValue) {
  if (value === "" || value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

async function fixAndAudit() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // 1. Confirmar contagens antes
  const { count: cEventosAntes } = await supabase.from('banco_horas_eventos').select('*', { count: 'exact', head: true });
  const { count: cSaldosAntes } = await supabase.from('banco_horas_saldos').select('*', { count: 'exact', head: true });
  const { count: cFechamentoAntes } = await supabase.from('fechamento_mensal').select('*', { count: 'exact', head: true });

  console.log('ANTES DA CORREÇÃO:');
  console.log('banco_horas_eventos:', cEventosAntes);
  console.log('banco_horas_saldos:', cSaldosAntes);
  console.log('fechamento_mensal:', cFechamentoAntes);

  // 2. Buscar a regra existente
  const { data: regras } = await supabase.from('banco_horas_regras').select('*');
  const target = regras[0];
  console.log('Regra alvo antes da correção:', target.id, target.nome, 'adicional:', target.adicional_hora_extra_percentual);

  // 3. Atualizar com 0% (adicional_hora_extra_percentual = 0)
  const { data: updated, error: errUpdate } = await supabase
    .from('banco_horas_regras')
    .update({ adicional_hora_extra_percentual: 0 })
    .eq('id', target.id)
    .select('*')
    .single();

  if (errUpdate) {
    console.error('Erro ao atualizar regra para 0%:', errUpdate);
    process.exit(1);
  }

  console.log('Regra alvo após correção para 0%:', updated.id, updated.nome, 'adicional persistido:', updated.adicional_hora_extra_percentual);

  // 4. Testar leitura simulando getWithEmpresa e reabertura do form
  const { data: readBack } = await supabase
    .from('banco_horas_regras')
    .select('*')
    .eq('id', target.id)
    .single();

  const valorFormReaberto = String(parseNumericWithDefault(readBack.adicional_hora_extra_percentual, 50));
  const valorTabelaExibido = `+${parseNumericWithDefault(readBack.adicional_hora_extra_percentual, 50)}%`;

  console.log('Valor retornado ao reabrir formulário de edição:', valorFormReaberto);
  console.log('Valor renderizado na tabela:', valorTabelaExibido);

  // 5. Confirmar contagens depois
  const { count: cEventosDepois } = await supabase.from('banco_horas_eventos').select('*', { count: 'exact', head: true });
  const { count: cSaldosDepois } = await supabase.from('banco_horas_saldos').select('*', { count: 'exact', head: true });
  const { count: cFechamentoDepois } = await supabase.from('fechamento_mensal').select('*', { count: 'exact', head: true });

  console.log('DEPOIS DA CORREÇÃO:');
  console.log('banco_horas_eventos:', cEventosDepois);
  console.log('banco_horas_saldos:', cSaldosDepois);
  console.log('fechamento_mensal:', cFechamentoDepois);
}

fixAndAudit().catch(console.error);
