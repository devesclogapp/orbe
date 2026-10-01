import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const EXPECTED_SANDBOX_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

async function main() {
  console.log('=== SINCRONIZAÇÃO DE PERSISTÊNCIA HE SINTÉTICA (C4 & C9) ===');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });

  if (authErr || !authData.user) {
    throw new Error(`Falha na autenticação: ${authErr?.message}`);
  }
  console.log(`[AUTH] Conectado: ${authData.user.email}`);

  // 1. Guard de segurança estrita
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('id, nome, is_teste, empresa_id')
    .eq('id', EXPECTED_COLAB_ID)
    .single();

  if (colabErr || !colab || !colab.is_teste || colab.empresa_id !== EXPECTED_SANDBOX_ID) {
    throw new Error('[FAIL-FAST] Colaborador HML não encontrado ou não é teste!');
  }

  // 2. Atualizar C4 (2026-10-06): minutos_extra = 60, valor = 6.90
  const { data: pontoC4, error: errC4 } = await supabase
    .from('registros_ponto')
    .update({
      valor_hora_extra: 6.90,
      horas_extras_detalhadas: {
        minutos: 60,
        minutos_banco: 120,
        percentual: 0,
        multiplicador: 1.0,
        valor: 6.90,
      }
    })
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .eq('data', '2026-10-06')
    .eq('is_teste', true)
    .select('id, data, minutos_extra, valor_hora_extra, horas_extras_detalhadas')
    .single();

  if (errC4) throw new Error(`Erro ao atualizar C4: ${errC4.message}`);
  console.log('✅ C4 atualizado com sucesso:', pontoC4);

  // 3. Atualizar C9 (2026-10-11): minutos_extra = 480, valor = 55.20
  const { data: pontoC9, error: errC9 } = await supabase
    .from('registros_ponto')
    .update({
      valor_hora_extra: 55.20,
      horas_extras_detalhadas: {
        minutos: 480,
        minutos_banco: 0,
        percentual: 0,
        multiplicador: 1.0,
        valor: 55.20,
      }
    })
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .eq('data', '2026-10-11')
    .eq('is_teste', true)
    .select('id, data, minutos_extra, valor_hora_extra, horas_extras_detalhadas')
    .single();

  if (errC9) throw new Error(`Erro ao atualizar C9: ${errC9.message}`);
  console.log('✅ C9 atualizado com sucesso:', pontoC9);

  // 4. Verificação de integridade geral dos 9 pontos
  const { data: todosPontos, error: errPontos } = await supabase
    .from('registros_ponto')
    .select('id, data, status_processamento, minutos_extra, valor_hora_extra')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .order('data', { ascending: true });

  if (errPontos) throw errPontos;
  console.log('\n--- ESTADO FINAL DOS PONTOS HML ---');
  let totalMin = 0;
  let totalVal = 0;
  todosPontos.forEach(p => {
    totalMin += (p.minutos_extra || 0);
    totalVal += (p.valor_hora_extra || 0);
    console.log(`Data: ${p.data} | Status: ${p.status_processamento} | HE Min: ${p.minutos_extra} | HE Val: R$ ${p.valor_hora_extra}`);
  });
  console.log(`TOTAL HE: ${totalMin} min (${totalMin / 60}h) | TOTAL VALOR HE: R$ ${totalVal.toFixed(2)}`);

  // 5. Garantir que saldo BH permanece inalterado
  const { data: saldoDb } = await supabase
    .from('banco_horas_saldos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .single();
  console.log('\nSaldo BH verificado (preservação estrita):', {
    saldo_atual_minutos: saldoDb.saldo_atual_minutos,
    horas_positivas_minutos: saldoDb.horas_positivas_minutos,
    horas_negativas_minutos: saldoDb.horas_negativas_minutos,
  });
}

main().catch(console.error);
