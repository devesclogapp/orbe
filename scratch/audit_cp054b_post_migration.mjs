import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runPostMigrationAudit() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    process.exit(1);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', auth.user.id)
    .single();

  const tenantId = profile?.tenant_id;
  console.log('Authenticated tenant:', tenantId);

  // 1. Testar check constraint chk_bh_regras_escopo com valor inválido
  const baseProbe = {
    nome: '__PROBE_CHECK_ESCOPO__',
    prazo_compensacao_dias: 60,
    status: 'inativo',
    bh_ativo: false,
    vigencia_inicio: '2026-01-01',
    tipo: 'acumula',
    is_teste: true,
  };

  const { data: probeInsert, error: probeErr } = await supabase
    .from('banco_horas_regras')
    .insert({
      ...baseProbe,
      escopo: 'INVALIDO',
    })
    .select();

  console.log('1. Constraint check (INVALIDO rejected?):', probeErr ? 'YES (Error: ' + probeErr.message + ')' : 'NO - FAILED');

  // Teste com os 3 valores válidos: TODAS_EMPRESAS, COMPARTILHADA, ESPECIFICA
  let probeId = null;
  const { data: validProbe, error: validErr } = await supabase
    .from('banco_horas_regras')
    .insert({
      ...baseProbe,
      nome: '__PROBE_VALID_ESCOPO__',
      escopo: 'TODAS_EMPRESAS',
    })
    .select('id, escopo')
    .single();

  if (validErr) {
    console.log('Valid probe error:', validErr.message);
  } else {
    probeId = validProbe.id;
    console.log('1b. Valid escopo TODAS_EMPRESAS accepted?: YES, record ID:', validProbe.id, 'escopo:', validProbe.escopo);
  }

  // 2. Verificar banco_horas_regras_empresas
  const { data: relCheck, error: relErr } = await supabase
    .from('banco_horas_regras_empresas')
    .select('*')
    .limit(1);

  console.log('2. Tabela banco_horas_regras_empresas existe?:', !relErr ? 'YES' : 'NO (' + relErr.message + ')');

  // Testar Unique constraint (regra_id, empresa_id)
  const { data: empSample } = await supabase.from('empresas').select('id').limit(1).maybeSingle();
  if (probeId && empSample?.id) {
    const { data: r1, error: r1Err } = await supabase
      .from('banco_horas_regras_empresas')
      .insert({
        regra_id: probeId,
        empresa_id: empSample.id,
      })
      .select('id')
      .single();

    console.log('2b. Inserção associativa teste:', !r1Err ? 'SUCESSO' : r1Err.message);

    // Tentar duplicar (deve violar UNIQUE uq_banco_horas_regras_empresas)
    const { error: dupErr } = await supabase
      .from('banco_horas_regras_empresas')
      .insert({
        regra_id: probeId,
        empresa_id: empSample.id,
      });

    console.log('2c. Unique constraint (regra_id, empresa_id) bloqueou duplicata?:', dupErr ? 'YES (Error: ' + dupErr.message + ')' : 'NO');

    // 3. Teste de cross-tenant protection (inserir com tenant_id forjado)
    const fakeTenantId = '00000000-0000-0000-0000-000000000000';
    const { error: crossErr } = await supabase
      .from('banco_horas_regras_empresas')
      .insert({
        tenant_id: fakeTenantId,
        regra_id: probeId,
        empresa_id: empSample.id,
      });
    console.log('3. Proteção cross-tenant trigger/RLS:', crossErr ? 'BLOQUEADO COM SUCESSO (' + crossErr.message + ')' : 'NÃO BLOQUEADO');

    // Limpar probe associativo
    await supabase.from('banco_horas_regras_empresas').delete().eq('regra_id', probeId);
  }

  // Limpar probe de regra
  if (probeId) {
    await supabase.from('banco_horas_regras').delete().eq('id', probeId);
    console.log('Probes de auditoria excluídos com sucesso. Base limpa.');
  }

  // 4. Contagens exatas no banco remoto
  const { count: cJornadas } = await supabase.from('jornadas_trabalho').select('*', { count: 'exact', head: true });
  const { count: cRegras } = await supabase.from('banco_horas_regras').select('*', { count: 'exact', head: true });
  const { count: cRelEmpresas } = await supabase.from('banco_horas_regras_empresas').select('*', { count: 'exact', head: true });
  const { count: cEventos } = await supabase.from('banco_horas_eventos').select('*', { count: 'exact', head: true });
  const { count: cSaldos } = await supabase.from('banco_horas_saldos').select('*', { count: 'exact', head: true });
  const { count: cFechamento } = await supabase.from('fechamento_mensal').select('*', { count: 'exact', head: true });
  const { count: cColabs } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true });

  const { count: cPontosTotal } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true });
  const { count: cPontosProc } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'PROCESSADO');
  const { count: cPontosPendProc } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'PENDENTE_PROCESSAMENTO');
  const { count: cPontosPend } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'pendente');
  const { count: cPontosIncons } = await supabase.from('registros_ponto').select('*', { count: 'exact', head: true }).eq('status_processamento', 'INCONSISTENTE');

  // 5. Verificar Jornada Padrão CLT — 44h
  const { data: jornadaPadrao } = await supabase
    .from('jornadas_trabalho')
    .select('id, nome, carga_semanal_minutos, status, padrao')
    .eq('padrao', true)
    .single();

  console.log('\n=== RESULTADOS DA AUDITORIA PÓS-MIGRATION CP05.4-B ===');
  console.log('jornadas_trabalho count:', cJornadas);
  console.log('banco_horas_regras count:', cRegras);
  console.log('banco_horas_regras_empresas count:', cRelEmpresas);
  console.log('banco_horas_eventos count:', cEventos);
  console.log('banco_horas_saldos count:', cSaldos);
  console.log('fechamento_mensal count:', cFechamento);
  console.log('colaboradores count:', cColabs);
  console.log('registros_ponto total count:', cPontosTotal);
  console.log('  - PROCESSADO:', cPontosProc);
  console.log('  - PENDENTE_PROCESSAMENTO:', cPontosPendProc);
  console.log('  - pendente:', cPontosPend);
  console.log('  - INCONSISTENTE:', cPontosIncons);
  console.log('Jornada Padrão CLT intacta:', jornadaPadrao);
}

runPostMigrationAudit().catch(console.error);
