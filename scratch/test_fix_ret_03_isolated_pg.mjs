import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('================================================================================');
  console.log('ERP ORBE — FIX-RET-03: TESTES NO POSTGRESQL 17 ISOLADO (127.0.0.1:54323)');
  console.log('Objeto: Sincronização Atômica entre Lote Intermitentes e Espelho RH/Financeiro');
  console.log('================================================================================\n');

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54323/postgres'
  });

  await client.connect();
  console.log('✅ Conexão estabelecida com sucesso com PostgreSQL 17 local (porta 54323)\n');

  // 1. APLICAR MIGRATION INCREMENTAL FIX-RET-03
  console.log('--- 1. Aplicando Migration Incremental FIX-RET-03 ---');
  const migrationPath = path.resolve('y:/2026/ERP ESC LOG/Orbe/supabase/migrations/20261015200000_fix_ret_03_sync_espelho_intermitentes.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await client.query(migrationSql);
  console.log('✅ Migration 20261015200000_fix_ret_03_sync_espelho_intermitentes.sql aplicada com sucesso!\n');

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

  const tenantA = 'e0000000-0000-0000-0000-000000000001';
  const tenantB = 'e0000000-0000-0000-0000-000000000002';
  const userAdmin = 'a0000000-0000-0000-0000-000000000001';

  // Configura contexto da sessão
  await client.query(`SELECT set_config('app.current_user_id', '${userAdmin}', false);`);
  await client.query(`SELECT set_config('app.current_tenant_id', '${tenantA}', false);`);
  await client.query(`SELECT set_config('app.current_user_role', 'Financeiro', false);`);

  // Setup de Empresas e Contas Bancárias
  const empHmlId = '11111111-1111-1111-1111-111111111111';
  const empProdId = '22222222-2222-2222-2222-222222222222';
  const contaHmlId = '33333333-3333-3333-3333-333333333333';

  await client.query(`
    INSERT INTO public.tenants (id, nome) VALUES ('${tenantA}', 'Tenant Alpha'), ('${tenantB}', 'Tenant Beta') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES
      ('${empHmlId}', '${tenantA}', 'Empresa Homologação', true),
      ('${empProdId}', '${tenantA}', 'Empresa Produção', false)
    ON CONFLICT (id) DO UPDATE SET is_teste = EXCLUDED.is_teste;

    INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, banco_codigo, banco_nome, ativo) VALUES
      ('${contaHmlId}', '${tenantA}', '${empHmlId}', '341', 'Itaú Homologação', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  const colabId = '77777777-7777-7777-7777-777777777777';

  await client.query(`
    INSERT INTO public.colaboradores (id, tenant_id, nome, is_teste) VALUES
      ('${colabId}', '${tenantA}', 'Colaborador Teste', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    DELETE FROM public.cnab_retorno_itens WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.cnab_retorno_arquivos WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.cnab_remessa_itens WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.cnab_remessas_arquivos WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.rh_financeiro_lote_itens WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.rh_financeiro_lotes WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.lancamentos_intermitentes WHERE tenant_id IN ('${tenantA}', '${tenantB}');
    DELETE FROM public.intermitentes_lotes_fechamento WHERE tenant_id IN ('${tenantA}', '${tenantB}');
  `);

  // Helper para criar cenário completo de Intermitentes
  async function setupCenarioIntermitentes({
    suffix,
    valor1 = 150.00,
    valor2 = 200.00,
    criarEspelho = true,
    espelhoValorDivergente = false,
    espelhoMultiplo = false,
    espelhoTenantDivergente = false
  }) {
    const opLoteId = `40000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const lanc1Id = `41000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const lanc2Id = `42000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const remessaId = `50000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const remItem1Id = `51000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const remItem2Id = `52000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const rhLoteId = `60000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const rhItem1Id = `61000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const rhItem2Id = `62000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
    const rhLoteMultiploId = `69000000-0000-0000-0000-${suffix.padStart(12, '0')}`;

    const totalOp = valor1 + valor2;
    const totalEspelho = espelhoValorDivergente ? totalOp + 50 : totalOp;
    const tenantDoEspelho = espelhoTenantDivergente ? tenantB : tenantA;

    // Lote operacional
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, competencia, status)
      VALUES ('${opLoteId}', '${tenantA}', '${empHmlId}', '2026-11', 'CNAB_GERADO');

      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline)
      VALUES 
        ('${lanc1Id}', '${tenantA}', '${empHmlId}', '${opLoteId}', '${colabId}', 'PROCESSADO_RH'),
        ('${lanc2Id}', '${tenantA}', '${empHmlId}', '${opLoteId}', '${colabId}', 'PROCESSADO_RH');
    `);

    // Remessa
    await client.query(`
      INSERT INTO public.cnab_remessas_arquivos (id, tenant_id, empresa_id, conta_bancaria_id, intermitentes_lote_id, nome_arquivo, total_valor, total_registros, modo, status)
      VALUES ('${remessaId}', '${tenantA}', '${empHmlId}', '${contaHmlId}', '${opLoteId}', 'REM_${suffix}.REM', ${totalOp}, 2, 'homologacao', 'enviado_manual');

      INSERT INTO public.cnab_remessa_itens (id, tenant_id, remessa_id, empresa_id, origem_id, origem_tipo, valor, status)
      VALUES
        ('${remItem1Id}', '${tenantA}', '${remessaId}', '${empHmlId}', '${lanc1Id}', 'INTERMITENTE', ${valor1}, 'pendente'),
        ('${remItem2Id}', '${tenantA}', '${remessaId}', '${empHmlId}', '${lanc2Id}', 'INTERMITENTE', ${valor2}, 'pendente');
    `);

    // Espelho RH/Financeiro
    if (criarEspelho) {
      await client.query(`
        INSERT INTO public.rh_financeiro_lotes (id, tenant_id, empresa_id, competencia, origem, tipo, status, valor_total, total_colaboradores)
        VALUES ('${rhLoteId}', '${tenantDoEspelho}', '${empHmlId}', '2026-11', 'OPERACIONAL', 'INTERMITENTES', 'AGUARDANDO_PAGAMENTO', ${totalEspelho}, 2);

        INSERT INTO public.rh_financeiro_lote_itens (id, lote_id, tenant_id, origem_evento, referencia_evento_id, valor_calculado, status)
        VALUES
          ('${rhItem1Id}', '${rhLoteId}', '${tenantDoEspelho}', 'lancamentos_intermitentes', '${lanc1Id}', ${valor1}, 'PENDENTE'),
          ('${rhItem2Id}', '${rhLoteId}', '${tenantDoEspelho}', 'lancamentos_intermitentes', '${lanc2Id}', ${valor2}, 'PENDENTE');
      `);

      if (espelhoMultiplo) {
        await client.query(`
          INSERT INTO public.rh_financeiro_lotes (id, tenant_id, empresa_id, competencia, origem, tipo, status, valor_total, total_colaboradores)
          VALUES ('${rhLoteMultiploId}', '${tenantA}', '${empHmlId}', '2026-11', 'OPERACIONAL', 'INTERMITENTES', 'AGUARDANDO_PAGAMENTO', ${totalOp}, 1);

          INSERT INTO public.rh_financeiro_lote_itens (id, lote_id, tenant_id, origem_evento, referencia_evento_id, valor_calculado, status)
          VALUES ('71000000-0000-0000-0000-${suffix.padStart(12, '0')}', '${rhLoteMultiploId}', '${tenantA}', 'lancamentos_intermitentes', '${lanc1Id}', ${valor1}, 'PENDENTE');
        `);
      }
    }

    return {
      opLoteId, lanc1Id, lanc2Id, remessaId, remItem1Id, remItem2Id, rhLoteId, rhItem1Id, rhItem2Id
    };
  }

  // ==============================================================================
  // CENÁRIO 1: QUITAÇÃO INTEGRAL COM SINCRONIZAÇÃO ATÔMICA DO ESPELHO
  // ==============================================================================
  console.log('\n--- CENÁRIO 1: Quitação Integral com Sincronização Atômica Perfeita ---');
  const c1 = await setupCenarioIntermitentes({ suffix: '1001' });

  const itensRetornoC1 = JSON.stringify([
    {
      remessa_id: c1.remessaId,
      remessa_item_id: c1.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c1.remessaId,
      remessa_item_id: c1.remItem2Id,
      valor_pago: 200.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  const resC1 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlId}',
      '341',
      'RET_CENARIO_01.RET',
      'hash_cenario_01_integral',
      '${itensRetornoC1}'::jsonb
    ) as result;
  `);

  const r1 = resC1.rows[0].result;
  assert(r1.sucesso === true, 'C1: RPC retornou sucesso');
  assert(r1.quitacao_integral === true, 'C1: Quitação integral confirmada');
  assert(r1.espelho_rh_sincronizado === true, 'C1: espelho_rh_sincronizado = true');
  assert(r1.espelho_rh_lote_id === c1.rhLoteId, 'C1: espelho_rh_lote_id coincide com o lote espelho criado');

  const { rows: opRows1 } = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${c1.opLoteId}'`);
  assert(opRows1[0].status === 'PAGO', 'C1: intermitentes_lotes_fechamento atualizado para PAGO');

  const { rows: rhRows1 } = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${c1.rhLoteId}'`);
  assert(rhRows1[0].status === 'PAGO', 'C1: rh_financeiro_lotes atualizado atomicamente para PAGO');

  const { rows: rhItemRows1 } = await client.query(`SELECT status FROM public.rh_financeiro_lote_itens WHERE lote_id = '${c1.rhLoteId}'`);
  assert(rhItemRows1.every(i => i.status === 'PAGO'), 'C1: Todos os itens de rh_financeiro_lote_itens atualizados para PAGO');

  const { rows: remRows1 } = await client.query(`SELECT status FROM public.cnab_remessas_arquivos WHERE id = '${c1.remessaId}'`);
  assert(remRows1[0].status === 'homologado', 'C1: Remessa de homologação marcada como homologado');

  // ==============================================================================
  // CENÁRIO 2: QUITAÇÃO PARCIAL (NÃO PODE ATUALIZAR ESPELHO)
  // ==============================================================================
  console.log('\n--- CENÁRIO 2: Quitação Parcial (Não pode atualizar espelho para PAGO) ---');
  const c2 = await setupCenarioIntermitentes({ suffix: '1002' });

  const itensRetornoC2 = JSON.stringify([
    {
      remessa_id: c2.remessaId,
      remessa_item_id: c2.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c2.remessaId,
      remessa_item_id: c2.remItem2Id,
      valor_pago: 200.00,
      status: 'rejeitado',
      codigo_ocorrencia: 'RJ',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  const resC2 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlId}',
      '341',
      'RET_CENARIO_02.RET',
      'hash_cenario_02_parcial',
      '${itensRetornoC2}'::jsonb
    ) as result;
  `);

  const r2 = resC2.rows[0].result;
  assert(r2.quitacao_integral === false, 'C2: Quitação integral é false');
  assert(r2.espelho_rh_sincronizado === false, 'C2: espelho_rh_sincronizado = false');

  const { rows: opRows2 } = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${c2.opLoteId}'`);
  assert(opRows2[0].status === 'CNAB_GERADO', 'C2: Lote operacional PERMANECE CNAB_GERADO');

  const { rows: rhRows2 } = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${c2.rhLoteId}'`);
  assert(rhRows2[0].status === 'AGUARDANDO_PAGAMENTO', 'C2: rh_financeiro_lotes PERMANECE AGUARDANDO_PAGAMENTO');

  // ==============================================================================
  // CENÁRIO 3: AUSÊNCIA DE ESPELHO (EXIGE ROLLBACK TRANSACIONAL INTEGRAL)
  // ==============================================================================
  console.log('\n--- CENÁRIO 3: Ausência de Espelho (Exige Rollback Transacional Integral) ---');
  const c3 = await setupCenarioIntermitentes({ suffix: '1003', criarEspelho: false });

  const itensRetornoC3 = JSON.stringify([
    {
      remessa_id: c3.remessaId,
      remessa_item_id: c3.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c3.remessaId,
      remessa_item_id: c3.remItem2Id,
      valor_pago: 200.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  let c3Blocked = false;
  let c3ErrMsg = '';
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlId}',
        '341',
        'RET_CENARIO_03.RET',
        'hash_cenario_03_sem_espelho',
        '${itensRetornoC3}'::jsonb
      );
    `);
  } catch (err) {
    c3Blocked = true;
    c3ErrMsg = err.message;
  }

  assert(c3Blocked, 'C3: Transação abortada com exceção devido a ausência de espelho');
  assert(c3ErrMsg.includes('Falha de Integridade Transacional: Nenhum lote espelho'), 'C3: Mensagem de erro correta');

  // Validação de ROLLBACK INTEGRAL: nenhum dado persistido ou alterado
  const { rows: retArqsC3 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_arquivos WHERE hash_arquivo = 'hash_cenario_03_sem_espelho'`);
  assert(Number(retArqsC3[0].count) === 0, 'C3 Rollback: cnab_retorno_arquivos NÃO foi persistido (0 registros)');

  const { rows: retItensC3 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${c3.remessaId}'`);
  assert(Number(retItensC3[0].count) === 0, 'C3 Rollback: cnab_retorno_itens NÃO foi persistido (0 registros)');

  const { rows: opRows3 } = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${c3.opLoteId}'`);
  assert(opRows3[0].status === 'CNAB_GERADO', 'C3 Rollback: Lote operacional PERMANECE CNAB_GERADO (não foi pago)');

  const { rows: lancRows3 } = await client.query(`SELECT status_pipeline FROM public.lancamentos_intermitentes WHERE lote_fechamento_id = '${c3.opLoteId}'`);
  assert(lancRows3.every(l => l.status_pipeline === 'PROCESSADO_RH'), 'C3 Rollback: Lançamentos intermitentes PERMANECEM PROCESSADO_RH (não foram pagos)');

  const { rows: remRows3 } = await client.query(`SELECT status FROM public.cnab_remessas_arquivos WHERE id = '${c3.remessaId}'`);
  assert(remRows3[0].status === 'enviado_manual', 'C3 Rollback: Remessa PERMANECE enviado_manual (não homologada)');

  // ==============================================================================
  // CENÁRIO 4: AMBIGUIDADE COM MÚLTIPLOS ESPELHOS (EXIGE ROLLBACK INTEGRAL)
  // ==============================================================================
  console.log('\n--- CENÁRIO 4: Ambiguidade com Múltiplos Espelhos (Exige Rollback Integral) ---');
  const c4 = await setupCenarioIntermitentes({ suffix: '1004', espelhoMultiplo: true });

  const itensRetornoC4 = JSON.stringify([
    {
      remessa_id: c4.remessaId,
      remessa_item_id: c4.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c4.remessaId,
      remessa_item_id: c4.remItem2Id,
      valor_pago: 200.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  let c4Blocked = false;
  let c4ErrMsg = '';
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlId}',
        '341',
        'RET_CENARIO_04.RET',
        'hash_cenario_04_ambiguidade',
        '${itensRetornoC4}'::jsonb
      );
    `);
  } catch (err) {
    c4Blocked = true;
    c4ErrMsg = err.message;
  }

  assert(c4Blocked, 'C4: Transação abortada com exceção devido a ambiguidade de múltiplos espelhos');
  assert(c4ErrMsg.includes('Falha de Integridade Transacional: Ambiguidade detectada'), 'C4: Mensagem de erro correta');

  const { rows: retArqsC4 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_arquivos WHERE hash_arquivo = 'hash_cenario_04_ambiguidade'`);
  assert(Number(retArqsC4[0].count) === 0, 'C4 Rollback: cnab_retorno_arquivos NÃO foi persistido (0 registros)');

  const { rows: retItensC4 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${c4.remessaId}'`);
  assert(Number(retItensC4[0].count) === 0, 'C4 Rollback: cnab_retorno_itens NÃO foi persistido (0 registros)');

  const { rows: rhRows4 } = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${c4.rhLoteId}'`);
  assert(rhRows4[0].status === 'AGUARDANDO_PAGAMENTO', 'C4 Rollback: Lote espelho primário PERMANECE AGUARDANDO_PAGAMENTO');

  const { rows: opRows4 } = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${c4.opLoteId}'`);
  assert(opRows4[0].status === 'CNAB_GERADO', 'C4 Rollback: Lote operacional PERMANECE CNAB_GERADO (não foi pago)');

  const { rows: lancRows4 } = await client.query(`SELECT status_pipeline FROM public.lancamentos_intermitentes WHERE lote_fechamento_id = '${c4.opLoteId}'`);
  assert(lancRows4.every(l => l.status_pipeline === 'PROCESSADO_RH'), 'C4 Rollback: Lançamentos intermitentes PERMANECEM PROCESSADO_RH');

  const { rows: remRows4 } = await client.query(`SELECT status FROM public.cnab_remessas_arquivos WHERE id = '${c4.remessaId}'`);
  assert(remRows4[0].status === 'enviado_manual', 'C4 Rollback: Remessa PERMANECE enviado_manual (não homologada)');

  // ==============================================================================
  // CENÁRIO 5: DIVERGÊNCIA DE VALOR NO ESPELHO (EXIGE ROLLBACK INTEGRAL)
  // ==============================================================================
  console.log('\n--- CENÁRIO 5: Divergência de Valor no Espelho (Exige Rollback Integral) ---');
  const c5 = await setupCenarioIntermitentes({ suffix: '1005', espelhoValorDivergente: true });

  const itensRetornoC5 = JSON.stringify([
    {
      remessa_id: c5.remessaId,
      remessa_item_id: c5.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c5.remessaId,
      remessa_item_id: c5.remItem2Id,
      valor_pago: 200.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  let c5Blocked = false;
  let c5ErrMsg = '';
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlId}',
        '341',
        'RET_CENARIO_05.RET',
        'hash_cenario_05_valor_divergente',
        '${itensRetornoC5}'::jsonb
      );
    `);
  } catch (err) {
    c5Blocked = true;
    c5ErrMsg = err.message;
  }

  assert(c5Blocked, 'C5: Transação abortada com exceção devido a divergência de valor');
  assert(c5ErrMsg.includes('Falha de Integridade Transacional: Valor do espelho RH'), 'C5: Mensagem de erro correta');

  const { rows: retArqsC5 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_arquivos WHERE hash_arquivo = 'hash_cenario_05_valor_divergente'`);
  assert(Number(retArqsC5[0].count) === 0, 'C5 Rollback: cnab_retorno_arquivos NÃO foi persistido (0 registros)');

  const { rows: retItensC5 } = await client.query(`SELECT COUNT(*) as count FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${c5.remessaId}'`);
  assert(Number(retItensC5[0].count) === 0, 'C5 Rollback: cnab_retorno_itens NÃO foi persistido (0 registros)');

  const { rows: rhRows5 } = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${c5.rhLoteId}'`);
  assert(rhRows5[0].status === 'AGUARDANDO_PAGAMENTO', 'C5 Rollback: Lote espelho com valor divergente PERMANECE AGUARDANDO_PAGAMENTO');

  const { rows: opRows5 } = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${c5.opLoteId}'`);
  assert(opRows5[0].status === 'CNAB_GERADO', 'C5 Rollback: Lote operacional PERMANECE CNAB_GERADO (não foi pago)');

  const { rows: lancRows5 } = await client.query(`SELECT status_pipeline FROM public.lancamentos_intermitentes WHERE lote_fechamento_id = '${c5.opLoteId}'`);
  assert(lancRows5.every(l => l.status_pipeline === 'PROCESSADO_RH'), 'C5 Rollback: Lançamentos intermitentes PERMANECEM PROCESSADO_RH');

  const { rows: remRows5 } = await client.query(`SELECT status FROM public.cnab_remessas_arquivos WHERE id = '${c5.remessaId}'`);
  assert(remRows5[0].status === 'enviado_manual', 'C5 Rollback: Remessa PERMANECE enviado_manual (não homologada)');

  // ==============================================================================
  // CENÁRIO 6: ISOLAMENTO POR TENANT (EXIGE ROLLBACK INTEGRAL)
  // ==============================================================================
  console.log('\n--- CENÁRIO 6: Isolamento Estrito por Tenant (Exige Rollback Integral) ---');
  const c6 = await setupCenarioIntermitentes({ suffix: '1006', espelhoTenantDivergente: true });

  const itensRetornoC6 = JSON.stringify([
    {
      remessa_id: c6.remessaId,
      remessa_item_id: c6.remItem1Id,
      valor_pago: 150.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    },
    {
      remessa_id: c6.remessaId,
      remessa_item_id: c6.remItem2Id,
      valor_pago: 200.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: '341' + '0'.repeat(237)
    }
  ]);

  let c6Blocked = false;
  let c6ErrMsg = '';
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlId}',
        '341',
        'RET_CENARIO_06.RET',
        'hash_cenario_06_tenant_divergente',
        '${itensRetornoC6}'::jsonb
      );
    `);
  } catch (err) {
    c6Blocked = true;
    c6ErrMsg = err.message;
  }

  assert(c6Blocked, 'C6: Transação abortada devido a espelho pertencer a outro tenant');
  assert(c6ErrMsg.includes('Falha de Integridade Transacional: Nenhum lote espelho'), 'C6: Mensagem de erro correta');

  const { rows: rhRows6 } = await client.query(`SELECT status FROM public.rh_financeiro_lotes WHERE id = '${c6.rhLoteId}'`);
  assert(rhRows6[0].status === 'AGUARDANDO_PAGAMENTO', 'C6 Rollback: Lote do Tenant B PERMANECE AGUARDANDO_PAGAMENTO');

  // ==============================================================================
  // CENÁRIO 7: DUPLICIDADE DE ARQUIVO E CONCORRÊNCIA
  // ==============================================================================
  console.log('\n--- CENÁRIO 7: Duplicidade de Arquivo e Concorrência ---');
  let duplicateBlocked = false;
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlId}',
        '341',
        'RET_CENARIO_01.RET',
        'hash_cenario_01_integral',
        '${itensRetornoC1}'::jsonb
      );
    `);
  } catch (err) {
    if (err.message.includes('Arquivo de retorno duplicado')) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, 'C7: Retorno com hash duplicado foi sumariamente rejeitado');

  console.log('\n================================================================================');
  console.log(`RESULTADO FINAL DOS TESTES POSTGRESQL 17 ISOLADOS:`);
  console.log(`✅ APROVADOS: ${passed}`);
  console.log(`❌ FALHAS:    ${failed}`);
  console.log('================================================================================');

  await client.end();
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Erro fatal nos testes PostgreSQL:', err);
  process.exit(1);
});
