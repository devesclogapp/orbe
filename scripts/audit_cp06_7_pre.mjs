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

async function main() {
  console.log('=== AUDITORIA PRÉ-EXECUÇÃO CP06.7 ===');
  
  // 1. Login com o usuário de teste E2E
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });

  if (authErr || !authData.user) {
    console.error('Falha na autenticação:', authErr);
    process.exit(1);
  }
  console.log(`[AUTH] Conectado como: ${authData.user.email} (ID: ${authData.user.id})`);

  // 2. Verificar profile do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, role, tenant_id, full_name')
    .eq('user_id', authData.user.id)
    .single();
  console.log('[PROFILE]', profile);

  // 3. Verificar se a tabela registros_ponto_decisoes existe e pode ser lida
  const { data: decisoes, error: decErr } = await supabase
    .from('registros_ponto_decisoes')
    .select('*')
    .limit(5);

  if (decErr) {
    console.error('❌ Erro consultando registros_ponto_decisoes:', decErr);
  } else {
    console.log(`✅ registros_ponto_decisoes existe! Total retornado: ${decisoes.length}`);
  }

  // 4. Verificar se a tabela registros_ponto_regularizacoes existe
  const { data: regs, error: regErr } = await supabase
    .from('registros_ponto_regularizacoes')
    .select('*')
    .limit(5);

  if (regErr) {
    console.error('❌ Erro consultando registros_ponto_regularizacoes:', regErr);
  } else {
    console.log(`✅ registros_ponto_regularizacoes existe! Total retornado: ${regs.length}`);
  }

  // 5. Verificar o colaborador sintético
  const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('id, nome, matricula, is_teste, empresa_id, tenant_id')
    .eq('id', EXPECTED_COLAB_ID)
    .single();

  console.log('[COLABORADOR SINTÉTICO]', colab);

  // 6. Verificar pontos de C6 (08/10), C7 (09/10), C9 (11/10)
  const { data: pontosAlvo, error: ptsErr } = await supabase
    .from('registros_ponto')
    .select('id, data, status_processamento, status, entrada, saida_almoco, retorno_almoco, saida, observacoes')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .in('data', ['2026-10-08', '2026-10-09', '2026-10-11'])
    .order('data');

  console.log('[PONTOS ALVO C6, C7, C9]');
  console.table(pontosAlvo);

  // 7. Verificar se já existem regularizações ou decisões para esse colaborador
  const { data: colabRegs } = await supabase
    .from('registros_ponto_regularizacoes')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  console.log(`[REGULARIZAÇÕES HML EXISTENTES]: ${colabRegs?.length || 0}`);
  if (colabRegs?.length) console.table(colabRegs);

  const { data: colabDecs } = await supabase
    .from('registros_ponto_decisoes')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  console.log(`[DECISÕES RH HML EXISTENTES]: ${colabDecs?.length || 0}`);
  if (colabDecs?.length) console.table(colabDecs);

  // 8. Contadores antes da execução
  const PROD_TENANT_ID = profile.tenant_id;
  const countTable = async (tbl, filter) => {
    let q = supabase.from(tbl).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count ?? 0;
  };

  const contagens = {
    colaboradoresReais: await countTable('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    colaboradoresTeste: await countTable('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
    pontosReais: await countTable('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    pontosTeste: await countTable('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
    eventosBhReais: await countTable('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    eventosBhHml: await countTable('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', EXPECTED_COLAB_ID)),
    saldosBhReais: await countTable('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    saldosBhHml: await countTable('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', EXPECTED_COLAB_ID)),
    regularizacoesHml: await countTable('registros_ponto_regularizacoes', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    decisoesRhHml: await countTable('registros_ponto_decisoes', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    fechamentoMensal: await countTable('fechamento_mensal', q => q.eq('tenant_id', PROD_TENANT_ID)),
  };

  console.log('\n--- CONTAGENS BASE ANTES DO CP06.7 ---');
  console.table(contagens);

  // Saldo atual HML
  const { data: saldoHml } = await supabase
    .from('banco_horas_saldos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .single();
  console.log('[SALDO HML ATUAL]:', saldoHml);
}

main().catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
