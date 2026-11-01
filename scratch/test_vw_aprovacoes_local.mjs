import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function run() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54332,
    user: 'postgres',
    database: 'postgres'
  });

  await client.connect();
  console.log('✓ Connected to local PostgreSQL on port 54332');

  try {
    // 1. Create table registros_ponto if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.registros_ponto (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id UUID,
        data DATE NOT NULL DEFAULT current_date,
        jornada_calculada NUMERIC,
        competencia TEXT,
        status_processamento TEXT,
        status TEXT DEFAULT 'pendente',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Ensure operacoes_producao has deleted_at and colaborador_id
    await client.query(`
      ALTER TABLE public.operacoes_producao 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS colaborador_id UUID;
    `);

    // Ensure custos_extras_operacionais has all columns
    await client.query(`
      ALTER TABLE public.custos_extras_operacionais
      ADD COLUMN IF NOT EXISTS descricao TEXT,
      ADD COLUMN IF NOT EXISTS categoria_custo TEXT,
      ADD COLUMN IF NOT EXISTS total NUMERIC,
      ADD COLUMN IF NOT EXISTS empresa_nome TEXT,
      ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT now();
    `);

    // Ensure servicos_extras_operacionais has all columns
    await client.query(`
      ALTER TABLE public.servicos_extras_operacionais
      ADD COLUMN IF NOT EXISTS pipeline_status TEXT,
      ADD COLUMN IF NOT EXISTS descricao_servico TEXT,
      ADD COLUMN IF NOT EXISTS descricao TEXT,
      ADD COLUMN IF NOT EXISTS tipo_servico TEXT,
      ADD COLUMN IF NOT EXISTS tipo_servico_id UUID,
      ADD COLUMN IF NOT EXISTS empresa_nome TEXT,
      ADD COLUMN IF NOT EXISTS total NUMERIC,
      ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT now();
    `);

    // Ensure lancamentos_diaristas has all columns
    await client.query(`
      ALTER TABLE public.lancamentos_diaristas 
      ADD COLUMN IF NOT EXISTS lote_fechamento_id UUID,
      ADD COLUMN IF NOT EXISTS nome_colaborador TEXT,
      ADD COLUMN IF NOT EXISTS funcao_colaborador TEXT,
      ADD COLUMN IF NOT EXISTS valor_calculado NUMERIC,
      ADD COLUMN IF NOT EXISTS quantidade_diaria NUMERIC,
      ADD COLUMN IF NOT EXISTS diarista_id UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    `);

    // Ensure intermitentes_lotes_fechamento has all columns
    await client.query(`
      ALTER TABLE public.intermitentes_lotes_fechamento
      ADD COLUMN IF NOT EXISTS competencia TEXT,
      ADD COLUMN IF NOT EXISTS periodo_inicio DATE,
      ADD COLUMN IF NOT EXISTS valor_total NUMERIC,
      ADD COLUMN IF NOT EXISTS quantidade_registros INTEGER;
    `);

    // 2. Clear previous test records in tables for clean isolation
    await client.query(`
      DELETE FROM public.registros_ponto WHERE id IN ('11111111-1111-1111-1111-111111111111');
      DELETE FROM public.operacoes_producao WHERE id IN (
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225'
      );
      DELETE FROM public.custos_extras_operacionais WHERE id IN ('33333333-3333-3333-3333-333333333333');
      DELETE FROM public.servicos_extras_operacionais WHERE id IN ('44444444-4444-4444-4444-444444444444');
      DELETE FROM public.lancamentos_diaristas WHERE id IN ('55555555-5555-5555-5555-555555555555');
      DELETE FROM public.intermitentes_lotes_fechamento WHERE id IN ('66666666-6666-6666-6666-666666666666');
    `);

    // 3. Insert test fixtures
    // 3.1 Ponto CLT (Positive)
    await client.query(`
      INSERT INTO public.registros_ponto (id, data, jornada_calculada, status, status_processamento)
      VALUES ('11111111-1111-1111-1111-111111111111', '2026-10-15', 8.0, 'pendente', 'PENDENTE');
    `);

    // 3.2 Operações por Volume:
    const tenantId = '9c0cc0c8-a0c5-46f7-8778-023be2a5851b';
    const empresaId = 'af8715cf-97cb-4762-ba44-780afa7d22e2';
    const tipoServicoId = 'df459dde-8192-4775-9152-6cf45ab06f34';
    const transportadoraId = '2d1a838f-0da1-4bf4-96d1-81f98bd56867';
    const fornecedorId = '863a33cd-3438-49e7-a751-e9dadaf47e2f';

    const insertOp = (id, status, status_rh, valor, deleted_at = null) => {
      return client.query(`
        INSERT INTO public.operacoes_producao (
          id, tenant_id, empresa_id, tipo_servico_id, transportadora_id, fornecedor_id,
          quantidade, valor_unitario_snapshot, valor_descarga, valor_total,
          data_operacao, status, status_rh, criado_em, deleted_at
        ) VALUES (
          '${id}', '${tenantId}', '${empresaId}', '${tipoServicoId}', '${transportadoraId}', '${fornecedorId}',
          10, 10, ${valor}, ${valor},
          '2026-10-16', '${status}', '${status_rh}', now(), ${deleted_at ? `'${deleted_at}'` : 'NULL'}
        );
      `);
    };

    // Case A: RECEBIDO (Premature - MUST BE FILTERED OUT)
    await insertOp('22222222-2222-2222-2222-222222222221', 'RECEBIDO', 'PENDENTE_RH', 100.00);

    // Case B: EM_VALIDACAO (Premature - MUST BE FILTERED OUT)
    await insertOp('22222222-2222-2222-2222-222222222222', 'EM_VALIDACAO', 'PENDENTE_RH', 150.00);

    // Case C: Deleted (deleted_at IS NOT NULL - MUST BE FILTERED OUT)
    await insertOp('22222222-2222-2222-2222-222222222223', 'AGUARDANDO_FATURAMENTO', 'PENDENTE_RH', 200.00, '2026-10-16 12:00:00+00');

    // Case D: AGUARDANDO_FATURAMENTO (Approved operationally - MUST APPEAR)
    await insertOp('22222222-2222-2222-2222-222222222224', 'AGUARDANDO_FATURAMENTO', 'PENDENTE_RH', 250.00);

    // Case E: CONCLUIDO (Completed - MUST APPEAR)
    await insertOp('22222222-2222-2222-2222-222222222225', 'CONCLUIDO', 'VALIDADO_RH', 300.00);


    // 3.3 Custo Extra (Positive)
    await client.query(`
      INSERT INTO public.custos_extras_operacionais (id, tenant_id, empresa_id, data, descricao, categoria_custo, total, status_pagamento, criado_em)
      VALUES ('33333333-3333-3333-3333-333333333333', '${tenantId}', '${empresaId}', '2026-10-16', 'Combustivel', 'Transporte', 80.00, 'EM_ABERTO', now());
    `);

    // 3.4 Serviço Extra (Positive)
    await client.query(`
      INSERT INTO public.servicos_extras_operacionais (id, tenant_id, empresa_id, data, descricao_servico, total, pipeline_status, criado_em)
      VALUES ('44444444-4444-4444-4444-444444444444', '${tenantId}', '${empresaId}', '2026-10-16', 'Paletizacao Extra', 120.00, 'PENDENTE', now());
    `);

    // 3.5 Diarista (Positive)
    await client.query(`
      INSERT INTO public.lancamentos_diaristas (id, tenant_id, empresa_id, data_lancamento, valor_calculado, status, quantidade_diaria, created_at)
      VALUES ('55555555-5555-5555-5555-555555555555', '${tenantId}', '${empresaId}', '2026-10-16', 150.00, 'AGUARDANDO_VALIDACAO_RH', 1, now());
    `);

    // 3.6 Intermitente (Positive)
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, competencia, valor_total, status, quantidade_registros, created_at)
      VALUES ('66666666-6666-6666-6666-666666666666', '${tenantId}', '${empresaId}', '2026-10', 500.00, 'EM_ABERTO', 5, now());
    `);

    console.log('✓ Test fixtures inserted successfully.');

    // 4. Test OLD view behavior (without filter on status/deleted_at)
    // Run previous migration view definition
    const oldMigrationPath = path.resolve('supabase/migrations/20261013010000_fix_sec_01_contencao_exposicao_anonima.sql');
    const oldSqlContent = fs.readFileSync(oldMigrationPath, 'utf8');
    // Extract view creation block
    const viewRegex = /CREATE OR REPLACE VIEW public\.vw_aprovacoes_rh[\s\S]*?FROM combined c;/;
    const matchOld = oldSqlContent.match(viewRegex);
    if (!matchOld) throw new Error('Could not extract old view definition from SEC-01');

    await client.query(`DROP VIEW IF EXISTS public.vw_aprovacoes_rh;`);
    await client.query(matchOld[0]);
    console.log('✓ Old view created (SEC-01 baseline)');

    // Capture baseline OID and column layout
    const oldOidRes = await client.query(`SELECT 'public.vw_aprovacoes_rh'::regclass::oid AS oid;`);
    const oldOid = oldOidRes.rows[0].oid;

    const oldColsRes = await client.query(`
      SELECT column_name, data_type, ordinal_position
      FROM information_schema.columns
      WHERE table_name = 'vw_aprovacoes_rh'
      ORDER BY ordinal_position;
    `);
    const oldCols = oldColsRes.rows;
    console.log(`✓ Baseline view has OID ${oldOid} and ${oldCols.length} columns:`);
    oldCols.forEach(c => console.log(`   ${c.ordinal_position}. ${c.column_name} (${c.data_type})`));

    // Query old view
    const oldRes = await client.query(`
      SELECT id, tipo, raw_status, situacao 
      FROM public.vw_aprovacoes_rh 
      WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '66666666-6666-6666-6666-666666666666'
      );
    `);
    console.log(`Old view returned ${oldRes.rows.length} rows (includes 5 operations: premature RECEBIDO, EM_VALIDACAO, deleted, etc.)`);
    const oldOpCount = oldRes.rows.filter(r => r.tipo === 'OPERAÇÃO').length;
    console.log(`Old view operation count: ${oldOpCount} (Expected 5 in old view)`);

    // 5. Apply NEW migration: 20261017150000_fix_vw_aprovacoes_rh_operacoes_volume_stage.sql
    // Must NOT contain DROP VIEW
    const newMigrationPath = path.resolve('supabase/migrations/20261017150000_fix_vw_aprovacoes_rh_operacoes_volume_stage.sql');
    const newSqlContent = fs.readFileSync(newMigrationPath, 'utf8');
    if (newSqlContent.includes('DROP VIEW')) {
      throw new Error('FAIL: Migration still contains DROP VIEW!');
    }
    console.log('✓ Confirmed: Migration does NOT contain DROP VIEW.');

    // Execute in-place CREATE OR REPLACE VIEW
    await client.query(newSqlContent);
    console.log('✓ Applied new migration IN-PLACE without DROP VIEW: 20261017150000_fix_vw_aprovacoes_rh_operacoes_volume_stage.sql');

    // Verify OID is preserved (proves it was in-place replacement)
    const newOidRes = await client.query(`SELECT 'public.vw_aprovacoes_rh'::regclass::oid AS oid;`);
    const newOid = newOidRes.rows[0].oid;
    console.log(`View OID after migration: ${newOid}`);
    if (newOid !== oldOid) {
      throw new Error(`FAIL: View OID changed! Expected ${oldOid}, got ${newOid}`);
    }
    console.log('✓ In-place replacement confirmed: View OID was 100% PRESERVED.');

    // Verify column names, data types, and order
    const newColsRes = await client.query(`
      SELECT column_name, data_type, ordinal_position
      FROM information_schema.columns
      WHERE table_name = 'vw_aprovacoes_rh'
      ORDER BY ordinal_position;
    `);
    const newCols = newColsRes.rows;
    if (newCols.length !== oldCols.length) {
      throw new Error(`FAIL: Column count changed! Expected ${oldCols.length}, got ${newCols.length}`);
    }
    for (let i = 0; i < oldCols.length; i++) {
      if (oldCols[i].column_name !== newCols[i].column_name ||
          oldCols[i].data_type !== newCols[i].data_type ||
          oldCols[i].ordinal_position !== newCols[i].ordinal_position) {
        throw new Error(`FAIL: Column ${i + 1} mismatch: ${JSON.stringify(oldCols[i])} vs ${JSON.stringify(newCols[i])}`);
      }
    }
    console.log('✓ Column contract confirmed: All 16 columns have identical name, data type, and order.');

    // 6. Query NEW view and verify assertions
    const newRes = await client.query(`
      SELECT id, tipo, raw_status, situacao 
      FROM public.vw_aprovacoes_rh 
      WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '66666666-6666-6666-6666-666666666666'
      )
      ORDER BY tipo, id;
    `);

    console.log(`\nNew view returned ${newRes.rows.length} rows.`);
    newRes.rows.forEach(r => console.log(`  - [${r.tipo}] id: ${r.id.substring(0,8)} | raw_status: ${r.raw_status} | situacao: ${r.situacao}`));

    // Assertions
    const newOps = newRes.rows.filter(r => r.tipo === 'OPERAÇÃO');
    const returnedIds = new Set(newRes.rows.map(r => r.id));

    if (returnedIds.has('22222222-2222-2222-2222-222222222221')) {
      throw new Error('FAIL: Premature RECEBIDO operation was NOT filtered out!');
    }
    if (returnedIds.has('22222222-2222-2222-2222-222222222222')) {
      throw new Error('FAIL: Premature EM_VALIDACAO operation was NOT filtered out!');
    }
    if (returnedIds.has('22222222-2222-2222-2222-222222222223')) {
      throw new Error('FAIL: Deleted operation was NOT filtered out!');
    }
    if (!returnedIds.has('22222222-2222-2222-2222-222222222224')) {
      throw new Error('FAIL: Operation in AGUARDANDO_FATURAMENTO was incorrectly omitted!');
    }
    if (!returnedIds.has('22222222-2222-2222-2222-222222222225')) {
      throw new Error('FAIL: Operation in CONCLUIDO was incorrectly omitted!');
    }

    // Check all other domains
    if (!returnedIds.has('11111111-1111-1111-1111-111111111111')) throw new Error('FAIL: PONTO missing!');
    if (!returnedIds.has('33333333-3333-3333-3333-333333333333')) throw new Error('FAIL: CUSTO EXTRA missing!');
    if (!returnedIds.has('44444444-4444-4444-4444-444444444444')) throw new Error('FAIL: SERVICO EXTRA missing!');
    if (!returnedIds.has('55555555-5555-5555-5555-555555555555')) throw new Error('FAIL: DIARISTA missing!');
    if (!returnedIds.has('66666666-6666-6666-6666-666666666666')) throw new Error('FAIL: INTERMITENTE missing!');

    console.log('\n✓ ALL ASSERTIONS PASSED: Exactly 7 valid items returned (1 Ponto, 2 Operações válidas, 1 Custo, 1 Serviço, 1 Diarista, 1 Intermitente)');
    console.log('✓ All 3 premature/deleted operations strictly filtered out.');

    // 7. Verify security_invoker = on in pg_class
    const secRes = await client.query(`
      SELECT relname, reloptions 
      FROM pg_class 
      WHERE relname = 'vw_aprovacoes_rh';
    `);
    console.log('View reloptions:', secRes.rows[0].reloptions);
    if (!secRes.rows[0].reloptions || (!secRes.rows[0].reloptions.includes('security_invoker=on') && !secRes.rows[0].reloptions.includes('security_invoker=true'))) {
      throw new Error('FAIL: security_invoker is NOT on!');
    }
    console.log('✓ Verified: security_invoker is ACTIVE on vw_aprovacoes_rh');

    // 8. Test Rollback IN-PLACE: Applying old definition restores previous behavior without DROP VIEW
    await client.query(matchOld[0]);
    const rollbackRes = await client.query(`
      SELECT COUNT(*) AS total 
      FROM public.vw_aprovacoes_rh 
      WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '66666666-6666-6666-6666-666666666666'
      );
    `);
    if (parseInt(rollbackRes.rows[0].total) !== 10) {
      throw new Error('FAIL: Rollback did not restore all 10 rows!');
    }
    console.log('✓ Rollback verified: Exactly 10 rows restored when old definition re-applied.');

    // Reapply new migration so local state matches current codebase
    await client.query(newSqlContent);
    console.log('✓ Reapplied new migration to local test database.');

  } finally {
    // Cleanup test fixtures
    await client.query(`
      DELETE FROM public.registros_ponto WHERE id IN ('11111111-1111-1111-1111-111111111111');
      DELETE FROM public.operacoes_producao WHERE id IN (
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225'
      );
      DELETE FROM public.custos_extras_operacionais WHERE id IN ('33333333-3333-3333-3333-333333333333');
      DELETE FROM public.servicos_extras_operacionais WHERE id IN ('44444444-4444-4444-4444-444444444444');
      DELETE FROM public.lancamentos_diaristas WHERE id IN ('55555555-5555-5555-5555-555555555555');
      DELETE FROM public.intermitentes_lotes_fechamento WHERE id IN ('66666666-6666-6666-6666-666666666666');
    `);
    console.log('✓ Test fixtures cleaned up from local database.');
    await client.end();
  }
}

run().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
