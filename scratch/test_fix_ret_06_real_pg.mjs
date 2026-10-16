import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

async function runE2EPostgresTest() {
  console.log('================================================================================');
  console.log('ERP ORBE — VALIDAÇÃO REAL E EXCLUSIVA EM POSTGRESQL 17 ISOLADO (127.0.0.1:54323)');
  console.log('Objeto: Execução completa da RPC rpc_aplicar_cnab_retorno (FIX-RET-06)');
  console.log('================================================================================\n');

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54323/postgres'
  });

  await client.connect();
  console.log('✅ Conexão estabelecida com sucesso com PostgreSQL 17 local (porta 54323)\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. APLICAR MIGRATION FIX-RET-04 (Check constraint)
  console.log('--- 1. Aplicando Migration FIX-RET-04 (Check Constraint) ---');
  const mig04Sql = fs.readFileSync('y:/2026/ERP ESC LOG/Orbe/supabase/migrations/20261016150000_fix_ret_04_compatibilidade_auditoria.sql', 'utf8');
  await client.query(mig04Sql);
  console.log('✅ FIX-RET-04 aplicada com sucesso.\n');

  // 2. APLICAR MIGRATION FIX-RET-06 (RPC Sem MAX(UUID) e FK Segura)
  console.log('--- 2. Aplicando Migration FIX-RET-06 (RPC Sem MAX(UUID) e FK Segura) ---');
  // Alinhar schema com produção: adicionar colunas que existem em produção
  await client.query(`
    ALTER TABLE public.cnab_remessa_itens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.cnab_remessa_itens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.cnab_retorno_arquivos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.cnab_retorno_arquivos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.cnab_auditoria_bancaria ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.intermitentes_lotes_fechamento ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.intermitentes_lotes_fechamento ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.lancamentos_intermitentes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.lancamentos_intermitentes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.rh_financeiro_lotes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.rh_financeiro_lotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `);
  const mig06Sql = fs.readFileSync('y:/2026/ERP ESC LOG/Orbe/supabase/migrations/20261016170000_fix_ret_06_compatibilidade_tipo_espelho.sql', 'utf8');
  await client.query(mig06Sql);
  console.log('✅ FIX-RET-06 aplicada com sucesso.\n');

  // 3. SETUP DO CENÁRIO DA NSA 10 NO POSTGRESQL ISOLADO
  console.log('--- 3. Configuração do Cenário Idêntico da NSA 10 ---');
  const tenantId = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  const userId = '41cab92a-4046-4e0a-8cf4-f3ff8210eeed';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  const contaId = 'faecb252-7b9e-407d-93a5-e10466d35b0e';
  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
  const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';
  const colab1Id = '7eaf4402-8954-471b-a2c8-914f12265c98';
  const colab2Id = '7035d08d-74b5-4172-87c2-3ba9a27d8b02';
  const remItem1Id = '8747f08b-282e-4421-bea0-56d51f34accc';
  const remItem2Id = 'e2988b43-9530-462b-b745-dbed11f70864';
  const lanc1Id = '80224654-3a19-4f81-b520-a56b3df7fa48';
  const lanc2Id = 'f832ee60-0d19-4821-93f7-067e0ca5955f';
  const espelhoItem1Id = 'f0536364-717a-49d2-888c-8a4b4cb850f3';
  const espelhoItem2Id = '68dcb504-13f5-439d-bedf-e03747ed64df';

  // Configura contexto da sessão
  await client.query(`SELECT set_config('app.current_user_id', '${userId}', false);`);
  await client.query(`SELECT set_config('app.current_tenant_id', '${tenantId}', false);`);
  await client.query(`SELECT set_config('app.current_user_role', 'Financeiro', false);`);

  // Limpeza de testes anteriores para garantir estado limpo
  await client.query(`DELETE FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${remessaId}';`);
  await client.query(`DELETE FROM public.cnab_retorno_arquivos WHERE remessa_arquivo_id = '${remessaId}';`);
  await client.query(`DELETE FROM public.cnab_auditoria_bancaria WHERE arquivo_id = '${remessaId}';`);

  // Garantir registros base no banco
  await client.query(`
    INSERT INTO public.tenants (id, nome) VALUES ('${tenantId}', 'Tenant Homologacao NSA10') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES ('${empresaId}', '${tenantId}', 'Empresa Teste HML', true)
    ON CONFLICT (id) DO UPDATE SET is_teste = true;

    INSERT INTO public.colaboradores (id, tenant_id, nome, is_teste) VALUES
      ('${colab1Id}', '${tenantId}', 'Homologação Itaú 001', true),
      ('${colab2Id}', '${tenantId}', 'Homologação Itaú 002', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, banco_codigo, banco_nome, ativo)
    VALUES ('${contaId}', '${tenantId}', '${empresaId}', '341', 'Banco Itau SA', true)
    ON CONFLICT (id) DO NOTHING;

    -- Lote Operacional Intermitentes (status CNAB_GERADO)
    INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, competencia, status)
    VALUES ('${loteOpId}', '${tenantId}', '${empresaId}', '2026-11', 'CNAB_GERADO')
    ON CONFLICT (id) DO UPDATE SET status = 'CNAB_GERADO';

    -- Lançamentos Intermitentes (status ENVIADO_FINANCEIRO)
    INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, valor_total, status_pipeline, lote_fechamento_id, colaborador_id)
    VALUES 
      ('${lanc1Id}', '${tenantId}', '${empresaId}', 150.00, 'ENVIADO_FINANCEIRO', '${loteOpId}', '${colab1Id}'),
      ('${lanc2Id}', '${tenantId}', '${empresaId}', 200.00, 'ENVIADO_FINANCEIRO', '${loteOpId}', '${colab2Id}')
    ON CONFLICT (id) DO UPDATE SET status_pipeline = 'ENVIADO_FINANCEIRO';

    -- Lote Espelho RH/Financeiro (status AGUARDANDO_PAGAMENTO)
    INSERT INTO public.rh_financeiro_lotes (id, tenant_id, empresa_id, competencia, tipo, valor_total, total_colaboradores, status)
    VALUES ('${loteRhId}', '${tenantId}', '${empresaId}', '2026-11', 'INTERMITENTES', 350.00, 2, 'AGUARDANDO_PAGAMENTO')
    ON CONFLICT (id) DO UPDATE SET status = 'AGUARDANDO_PAGAMENTO';

    -- Itens do Espelho RH (status PENDENTE)
    INSERT INTO public.rh_financeiro_lote_itens (id, tenant_id, lote_id, valor_calculado, status, referencia_evento_id, origem_evento, colaborador_id)
    VALUES
      ('${espelhoItem1Id}', '${tenantId}', '${loteRhId}', 150.00, 'PENDENTE', '${lanc1Id}', 'lancamentos_intermitentes', '${colab1Id}'),
      ('${espelhoItem2Id}', '${tenantId}', '${loteRhId}', 200.00, 'PENDENTE', '${lanc2Id}', 'lancamentos_intermitentes', '${colab2Id}')
    ON CONFLICT (id) DO UPDATE SET status = 'PENDENTE';

    -- Remessa NSA 10 (status baixado, modo homologacao, intermitentes_lote_id, lote_id = NULL)
    INSERT INTO public.cnab_remessas_arquivos (
      id, tenant_id, empresa_id, conta_bancaria_id, banco_codigo, modo, status, 
      total_valor, total_registros, sequencial_arquivo, intermitentes_lote_id, lote_id, diaristas_lote_id,
      nome_arquivo
    ) VALUES (
      '${remessaId}', '${tenantId}', '${empresaId}', '${contaId}', '341', 'homologacao', 'baixado',
      350.00, 2, 10, '${loteOpId}', NULL, NULL,
      'SIMULACAO_REMESSA_ITAU_20261015_SEQ000010.REM'
    )
    ON CONFLICT (id) DO UPDATE SET status = 'baixado', modo = 'homologacao', intermitentes_lote_id = '${loteOpId}', lote_id = NULL;

    -- Itens da Remessa (status remetido)
    INSERT INTO public.cnab_remessa_itens (id, tenant_id, remessa_id, empresa_id, valor, status, origem_tipo, origem_id)
    VALUES
      ('${remItem1Id}', '${tenantId}', '${remessaId}', '${empresaId}', 150.00, 'remetido', 'INTERMITENTE', '${lanc1Id}'),
      ('${remItem2Id}', '${tenantId}', '${remessaId}', '${empresaId}', 200.00, 'remetido', 'INTERMITENTE', '${lanc2Id}')
    ON CONFLICT (id) DO UPDATE SET status = 'remetido';
  `);
  console.log('✅ Cenário base da NSA 10 montado no PostgreSQL isolado.\n');

  // 4. EXECUÇÃO DA RPC COMPLETA NO POSTGRESQL REAL
  console.log('--- 4. Executando RPC rpc_aplicar_cnab_retorno ---');

  const itensRetornoPayload = JSON.stringify([
    {
      remessa_item_id: remItem1Id,
      valor_retornado: 150.00,
      codigo_ocorrencia: '00',
      status: 'pago',
      nome_favorecido: 'Homologação Itaú 001',
      linha_original: '3410001300001A00000034101234 0009876543210 HOMOLOGACAO ITAU 001'
    },
    {
      remessa_item_id: remItem2Id,
      valor_retornado: 200.00,
      codigo_ocorrencia: '00',
      status: 'pago',
      nome_favorecido: 'Homologação Itaú 002',
      linha_original: '3410001300003A00000034101234 0009876543220 HOMOLOGACAO ITAU 002'
    }
  ]);

  let rpcOutput;
  try {
    const res = await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empresaId}'::UUID,
        '${contaId}'::UUID,
        '341'::TEXT,
        'SIMULACAO_RETORNO_ITAU_20261015_SEQ000010.RET'::TEXT,
        'HASH_TESTE_E2E_REAL_PG_${Date.now()}'::TEXT,
        '${itensRetornoPayload}'::JSONB
      ) as resultado;
    `);
    rpcOutput = res.rows[0].resultado;
    console.log('Resultado retornado pela RPC:');
    console.log(JSON.stringify(rpcOutput, null, 2));
    assert(rpcOutput.sucesso === true, 'RPC retornou sucesso = true');
    assert(rpcOutput.total_processado === 2, 'Total de processados = 2');
    assert(rpcOutput.total_pagos === 2, 'Total de pagos = 2');
    assert(rpcOutput.quitacao_integral === true, 'Quitação integral = true');
    assert(rpcOutput.espelho_rh_sincronizado === true, 'Espelho RH sincronizado = true');
  } catch (rpcError) {
    console.error('❌ ERRO CRÍTICO NA EXECUÇÃO DA RPC:', rpcError);
    assert(false, `A RPC não deve lançar erro: ${rpcError.message}`);
    await client.end();
    process.exit(1);
  }

  // 5. AUDITORIA COMPLETA DO ESTADO DEPOIS NO POSTGRESQL REAL
  console.log('\n--- 5. Auditoria de Efeito do Estado DEPOIS ---');

  // A) Arquivo de retorno gravado
  const retArqRes = await client.query(`SELECT id, status, modo, total_processados, total_sucesso FROM public.cnab_retorno_arquivos WHERE id = '${rpcOutput.retorno_arquivo_id}';`);
  assert(retArqRes.rows.length === 1, 'Cabeçalho do retorno persistido');
  assert(retArqRes.rows[0].status === 'processado', 'Status do arquivo de retorno = processado');
  assert(retArqRes.rows[0].modo === 'homologacao', 'Modo do retorno = homologacao');

  // B) Itens de retorno gravados
  const retItensRes = await client.query(`SELECT id, status, status_conciliacao, valor_esperado, valor_retornado FROM public.cnab_retorno_itens WHERE retorno_arquivo_id = '${rpcOutput.retorno_arquivo_id}';`);
  assert(retItensRes.rows.length === 2, 'Dois itens de retorno gravados');
  assert(retItensRes.rows.every(r => r.status === 'pago' && r.status_conciliacao === 'conciliado'), 'Ambos os itens gravados com status pago / conciliado');

  // C) Remessa atualizada para homologado
  const remRes = await client.query(`SELECT status, modo FROM public.cnab_remessas_arquivos WHERE id = '${remessaId}';`);
  assert(remRes.rows[0].status === 'homologado', 'Remessa atualizada para status homologado');
  assert(remRes.rows[0].modo === 'homologacao', 'Remessa mantém modo homologacao');

  // D) Lote Operacional promovido para PAGO
  const loteOpRes = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${loteOpId}';`);
  assert(loteOpRes.rows[0].status === 'PAGO', 'Lote operacional de intermitentes promovido para PAGO');

  // E) Lançamentos Intermitentes promovidos para PAGO
  const lancRes = await client.query(`SELECT id, status_pipeline FROM public.lancamentos_intermitentes WHERE lote_fechamento_id = '${loteOpId}';`);
  assert(lancRes.rows.every(l => l.status_pipeline === 'PAGO'), 'Ambos os lançamentos intermitentes promovidos para PAGO');

  // F) Espelho RH/Financeiro promovido para PAGO
  const loteRhRes = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${loteRhId}';`);
  assert(loteRhRes.rows[0].status === 'PAGO', 'Lote espelho RH/Financeiro promovido para PAGO');

  // G) Itens do Espelho RH promovidos para PAGO
  const loteRhItensRes = await client.query(`SELECT status FROM public.rh_financeiro_lote_itens WHERE lote_id = '${loteRhId}';`);
  assert(loteRhItensRes.rows.every(i => i.status === 'PAGO'), 'Ambos os itens do espelho RH promovidos para PAGO');

  // H) AUDITORIA BANCÁRIA: GRAVAÇÃO COM SUCESSO E RESPEITO À FK
  const auditRes = await client.query(`SELECT id, acao, lote_id, arquivo_id, detalhes FROM public.cnab_auditoria_bancaria WHERE arquivo_id = '${remessaId}';`);
  assert(auditRes.rows.length === 1, 'Registro de auditoria bancária persistido');
  const auditRow = auditRes.rows[0];
  assert(auditRow.acao === 'RETORNO_PROCESSADO_SIMULADO', 'Ação na auditoria = RETORNO_PROCESSADO_SIMULADO (atende check constraint FIX-RET-04)');
  assert(auditRow.lote_id === null, 'cnab_auditoria_bancaria.lote_id é NULL (respeita estritamente FK lotes_remessa)');
  assert(auditRow.detalhes.intermitentes_lote_id === loteOpId, 'intermitentes_lote_id preservado com precisão no campo detalhes JSONB');
  assert(auditRow.detalhes.espelho_rh_sincronizado === true, 'detalhes.espelho_rh_sincronizado = true');

  console.log('\n================================================================================');
  console.log(`RESULTADO FINAL NO POSTGRESQL 17 ISOLADO: ${passed} PASSADOS, ${failed} FALHAS`);
  console.log('================================================================================\n');

  await client.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runE2EPostgresTest().catch(err => {
  console.error('Falha geral no teste do PostgreSQL isolado:', err);
  process.exit(1);
});
