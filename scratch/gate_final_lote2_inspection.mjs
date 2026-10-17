import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function inspectGateFinal() {
  console.log('=== GATE FINAL LOTE 2 — INSPEÇÃO READ-ONLY SUPABASE OFICIAL ===\n');

  const sbAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sbAuth.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    return;
  }
  console.log('Autenticado como e2e-test@orbe.local. User ID:', authData.user.id);

  // 1. INSPEÇÃO DA OPERAÇÃO OP-0328D4A8
  const opId = '0328d4a8-6ed2-47f7-b45d-531af9a0674c';
  console.log(`\n[1] Consultando operacoes_producao para ID: ${opId}...`);
  const { data: opData, error: opErr } = await sbAuth
    .from('operacoes_producao')
    .select(`
      id,
      codigo,
      data_operacao,
      empresa_id,
      unidade_id,
      tipo_servico_id,
      quantidade,
      valor_unitario_snapshot,
      valor_descarga,
      valor_total,
      entrada_ponto,
      saida_ponto,
      status,
      status_rh,
      status_pagamento,
      data_pagamento,
      forma_pagamento_id,
      criado_em,
      atualizado_em,
      tenant_id
    `)
    .eq('id', opId)
    .single();

  if (opErr) {
    console.error('Erro ao consultar operação:', opErr.message);
  } else {
    console.log('Dados da Operação OP-0328D4A8:');
    console.log(JSON.stringify(opData, null, 2));
  }

  // 2. CONSULTA DO VÍNCULO EM receitas_operacionais_itens
  console.log(`\n[2] Consultando receitas_operacionais_itens para operacao_id: ${opId}...`);
  const { data: itemData, error: itemErr } = await sbAuth
    .from('receitas_operacionais_itens')
    .select('*')
    .eq('operacao_id', opId);

  if (itemErr) {
    console.error('Erro ao consultar item da receita:', itemErr.message);
  } else {
    console.log(`Itens encontrados: ${itemData.length}`);
    console.log(JSON.stringify(itemData, null, 2));
  }

  // 3. CONSULTA DA RECEITA EM receitas_operacionais
  if (itemData && itemData.length > 0) {
    const recId = itemData[0].receita_id;
    console.log(`\n[3] Consultando receitas_operacionais para ID: ${recId}...`);
    const { data: recData, error: recErr } = await sbAuth
      .from('receitas_operacionais')
      .select('*')
      .eq('id', recId)
      .single();

    if (recErr) {
      console.error('Erro ao consultar receita:', recErr.message);
    } else {
      console.log('Dados da Receita Operacional Vinculada:');
      console.log(JSON.stringify(recData, null, 2));
    }

    // 4. HISTÓRICO DA RECEITA
    console.log(`\n[4] Consultando receitas_operacionais_historico para ID: ${recId}...`);
    const { data: histData, error: histErr } = await sbAuth
      .from('receitas_operacionais_historico')
      .select('*')
      .eq('receita_id', recId)
      .order('created_at', { ascending: true });

    if (histErr) {
      console.error('Erro ao consultar historico da receita:', histErr.message);
    } else {
      console.log(`Eventos de histórico: ${histData.length}`);
      console.log(JSON.stringify(histData, null, 2));
    }
  }

  // 5. VERIFICAÇÃO SE EXISTE TABELA supabase_migrations ACESSÍVEL
  console.log('\n[5] Verificando registro no supabase_migrations (se legível)...');
  const { data: migData, error: migErr } = await sbAuth
    .from('supabase_migrations')
    .select('*')
    .limit(5);

  if (migErr) {
    console.log('supabase_migrations inacessível via API (comum por restrição de catálogo schema-internal):', migErr.message);
  } else {
    console.log('Registros em supabase_migrations:', migData);
  }
}

inspectGateFinal().catch(console.error);
