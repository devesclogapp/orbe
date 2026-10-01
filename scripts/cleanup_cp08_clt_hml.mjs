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

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
const EXPECTED_SANDBOX_COMPANY_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const COMPETENCIA = '2026-10';

async function exactCount(table, filterFn) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filterFn) query = filterFn(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  console.log('=================================================================');
  console.log('CP08 — ENCERRAMENTO DA HOMOLOGAÇÃO CLT E LIMPEZA HML');
  console.log('=================================================================');

  // 1. Autenticação
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (authErr || !authData.user) {
    throw new Error(`Falha na autenticação: ${authErr?.message}`);
  }
  console.log(`[AUTH] Conectado: ${authData.user.email} (ID: ${authData.user.id})`);

  // 2. Trava de segurança fail-fast
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('id', EXPECTED_COLAB_ID)
    .single();

  if (colabErr || !colab || !colab.is_teste || colab.empresa_id !== EXPECTED_SANDBOX_COMPANY_ID) {
    throw new Error('[FAIL-FAST] Colaborador HML não encontrado ou não pertence à sandbox de teste!');
  }

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', EXPECTED_SANDBOX_COMPANY_ID)
    .single();

  if (empErr || !emp || !emp.is_teste) {
    throw new Error('[FAIL-FAST] Empresa sandbox não possui is_teste=true!');
  }

  // 3. Snapshot Pré-Limpeza HML
  console.log('\n--- 1. SNAPSHOT FINAL ANTES DA LIMPEZA ---');
  const { data: pontos } = await supabase
    .from('registros_ponto')
    .select('id, data, is_teste, minutos_extra, valor_hora_extra, status_processamento')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .order('data', { ascending: true });

  const { data: regul } = await supabase
    .from('registros_ponto_regularizacoes')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID);

  const { data: decis } = await supabase
    .from('registros_ponto_decisoes')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID);

  const { data: evBh } = await supabase
    .from('banco_horas_eventos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID);

  const { data: salBh } = await supabase
    .from('banco_horas_saldos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .maybeSingle();

  const { data: fech } = await supabase
    .from('fechamento_mensal')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .eq('ano', 2026)
    .eq('mes', 10)
    .maybeSingle();

  const { data: lotes } = await supabase
    .from('rh_financeiro_lotes')
    .select('*')
    .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
    .eq('competencia', COMPETENCIA)
    .eq('origem', 'RH');

  const loteIds = (lotes || []).map(l => l.id);

  const { data: itens } = await supabase
    .from('rh_financeiro_lote_itens')
    .select('*')
    .in('lote_id', loteIds.length ? loteIds : ['00000000-0000-0000-0000-000000000000']);

  const { data: hist } = await supabase
    .from('rh_financeiro_lote_historico')
    .select('*')
    .in('lote_id', loteIds.length ? loteIds : ['00000000-0000-0000-0000-000000000000']);

  const snapshotHml = {
    colaboradorHml: colab.nome,
    colaboradorId: colab.id,
    pontosCount: pontos?.length,
    regularizacoesCount: regul?.length,
    decisoesCount: decis?.length,
    eventosBhCount: evBh?.length,
    saldoBhMinutos: salBh?.saldo_atual_minutos,
    fechamentoMensalStatus: fech?.situacao,
    lotesCount: lotes?.length,
    itensCount: itens?.length,
    historicoCount: hist?.length,
    totalEconomico: lotes?.reduce((acc, l) => acc + Number(l.valor_total), 0),
  };
  console.log('Snapshot da massa HML a ser removida:');
  console.table(snapshotHml);

  // 4. Baseline de Produção e Outros Testes ANTES da exclusão
  const prodAntes = {
    colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    eventosBhReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    saldosBhReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    lotesFinanceirosReais: await exactCount('rh_financeiro_lotes', q => q.eq('tenant_id', PROD_TENANT_ID).neq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)),
    itensFinanceirosReais: await exactCount('rh_financeiro_lote_itens', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    outrosColaboradoresTeste: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true).neq('id', EXPECTED_COLAB_ID)),
  };
  console.log('\n--- 2. CONTAGENS DE PRODUÇÃO ANTES DA LIMPEZA ---');
  console.table(prodAntes);

  // 5. Execução da Limpeza em Ordem Estrita de Dependência
  console.log('\n--- 3. EXECUTANDO LIMPEZA CONTROLADA ---');

  // a. Histórico de lotes financeiros HML CLT
  if (loteIds.length > 0) {
    const { error: errHist } = await supabase
      .from('rh_financeiro_lote_historico')
      .delete()
      .in('lote_id', loteIds);
    if (errHist) throw new Error(`Erro ao excluir histórico de lotes: ${errHist.message}`);
    console.log(`[OK] rh_financeiro_lote_historico removido para ${loteIds.length} lotes`);

    // b. Itens financeiros HML CLT
    const { error: errItens } = await supabase
      .from('rh_financeiro_lote_itens')
      .delete()
      .in('lote_id', loteIds);
    if (errItens) throw new Error(`Erro ao excluir itens de lote: ${errItens.message}`);
    console.log(`[OK] rh_financeiro_lote_itens removido para ${loteIds.length} lotes`);

    // c. Lotes financeiros HML CLT
    const { error: errLotes } = await supabase
      .from('rh_financeiro_lotes')
      .delete()
      .in('id', loteIds);
    if (errLotes) throw new Error(`Erro ao excluir lotes: ${errLotes.message}`);
    console.log(`[OK] rh_financeiro_lotes removido (${loteIds.length} lotes)`);
  }

  // d. Fechamento mensal HML CLT
  const { error: errFech } = await supabase
    .from('fechamento_mensal')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  if (errFech) throw new Error(`Erro ao excluir fechamento_mensal: ${errFech.message}`);
  console.log('[OK] fechamento_mensal removido');

  // e. Decisões RH
  const { error: errDecis } = await supabase
    .from('registros_ponto_decisoes')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  if (errDecis) throw new Error(`Erro ao excluir decisões RH: ${errDecis.message}`);
  console.log('[OK] registros_ponto_decisoes removido');

  // f. Regularizações
  const { error: errRegul } = await supabase
    .from('registros_ponto_regularizacoes')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  if (errRegul) throw new Error(`Erro ao excluir regularizações: ${errRegul.message}`);
  console.log('[OK] registros_ponto_regularizacoes removido');

  // g. Eventos Banco de Horas
  const { error: errEvBh } = await supabase
    .from('banco_horas_eventos')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  if (errEvBh) throw new Error(`Erro ao excluir eventos BH: ${errEvBh.message}`);
  console.log('[OK] banco_horas_eventos removido');

  // h. Saldos Banco de Horas
  const { error: errSalBh } = await supabase
    .from('banco_horas_saldos')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID);
  if (errSalBh) throw new Error(`Erro ao excluir saldos BH: ${errSalBh.message}`);
  console.log('[OK] banco_horas_saldos removido');

  // i. Pontos C1–C9 (apenas se is_teste = true)
  const { error: errPontos } = await supabase
    .from('registros_ponto')
    .delete()
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .eq('is_teste', true);
  if (errPontos) throw new Error(`Erro ao excluir pontos C1-C9: ${errPontos.message}`);
  console.log('[OK] registros_ponto (C1–C9) removidos');

  // j. Colaborador CLT-HML-001 (apenas se is_teste = true)
  const { error: errColab } = await supabase
    .from('colaboradores')
    .delete()
    .eq('id', EXPECTED_COLAB_ID)
    .eq('is_teste', true);
  if (errColab) throw new Error(`Erro ao excluir colaborador CLT-HML-001: ${errColab.message}`);
  console.log('[OK] colaborador CLT-HML-001 removido');

  // 6. Auditoria Pós-Limpeza HML
  console.log('\n--- 4. AUDITORIA PÓS-LIMPEZA HML ---');
  const hmlDepois = {
    colaboradorHml: await exactCount('colaboradores', q => q.eq('id', EXPECTED_COLAB_ID)),
    pontosCount: await exactCount('registros_ponto', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    regularizacoesCount: await exactCount('registros_ponto_regularizacoes', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    decisoesCount: await exactCount('registros_ponto_decisoes', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    eventosBhCount: await exactCount('banco_horas_eventos', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    saldosBhCount: await exactCount('banco_horas_saldos', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    fechamentoMensalCount: await exactCount('fechamento_mensal', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
    lotesCount: await exactCount('rh_financeiro_lotes', q => q.eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID).eq('competencia', COMPETENCIA).eq('origem', 'RH')),
    itensCount: await exactCount('rh_financeiro_lote_itens', q => q.eq('colaborador_id', EXPECTED_COLAB_ID)),
  };
  console.table(hmlDepois);

  for (const [key, val] of Object.entries(hmlDepois)) {
    if (val !== 0) {
      throw new Error(`[FALHA DE LIMPEZA] Entidade ${key} ainda possui ${val} registro(s)!`);
    }
  }

  // 7. Auditoria de Isolamento de Produção
  console.log('\n--- 5. AUDITORIA DE ISOLAMENTO DE PRODUÇÃO PÓS-LIMPEZA ---');
  const prodDepois = {
    colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
    eventosBhReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    saldosBhReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    lotesFinanceirosReais: await exactCount('rh_financeiro_lotes', q => q.eq('tenant_id', PROD_TENANT_ID).neq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)),
    itensFinanceirosReais: await exactCount('rh_financeiro_lote_itens', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    outrosColaboradoresTeste: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true).neq('id', EXPECTED_COLAB_ID)),
  };

  const deltas = {
    colaboradoresReais: prodDepois.colaboradoresReais - prodAntes.colaboradoresReais,
    pontosReais: prodDepois.pontosReais - prodAntes.pontosReais,
    eventosBhReais: prodDepois.eventosBhReais - prodAntes.eventosBhReais,
    saldosBhReais: prodDepois.saldosBhReais - prodAntes.saldosBhReais,
    lotesFinanceirosReais: prodDepois.lotesFinanceirosReais - prodAntes.lotesFinanceirosReais,
    itensFinanceirosReais: prodDepois.itensFinanceirosReais - prodAntes.itensFinanceirosReais,
    outrosColaboradoresTeste: prodDepois.outrosColaboradoresTeste - prodAntes.outrosColaboradoresTeste,
  };

  console.table({
    'Antes': prodAntes,
    'Depois': prodDepois,
    'Delta (deve ser 0)': deltas,
  });

  for (const [key, delta] of Object.entries(deltas)) {
    if (delta !== 0) {
      throw new Error(`[FALHA DE ISOLAMENTO] Delta não nulo detectado em ${key}: ${delta}!`);
    }
  }

  console.log('\n[SUCESSO] Limpeza concluída e validada com 100% de isolamento.');
}

main().catch(err => {
  console.error('[ERRO]', err);
  process.exit(1);
});
