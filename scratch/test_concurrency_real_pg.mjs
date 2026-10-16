import pg from 'pg';
import fs from 'fs';

const { Client } = pg;
const PG_CONN_STRING = 'postgresql://postgres:postgres@127.0.0.1:54323/postgres';

async function createClientInstance() {
  const c = new Client({ connectionString: PG_CONN_STRING });
  await c.connect();
  return c;
}

async function run() {
  console.log('================================================================================');
  console.log('TESTE REAL DE CONCORRÊNCIA POSTGRESQL (DUAS CONEXÕES SIMULTÂNEAS)');
  console.log('Banco de Dados: PostgreSQL 17 Isolado (127.0.0.1:54323)');
  console.log('================================================================================\n');

  // Inicializa conexão de setup
  const setupClient = await createClientInstance();

  // Garante que o schema e a migration estejam atualizados
  const migrationSql = fs.readFileSync('supabase/migrations/20261015180000_fix_ret_02_blindagem_retorno_simulado.sql', 'utf8');
  await setupClient.query(migrationSql);

  const tenantId = 'e0000000-0000-0000-0000-000000000001';
  const empresaId = '11111111-1111-1111-1111-111111111111';
  const contaId = '44444444-1111-1111-1111-111111111111';
  const userFinanceiro = 'a0000000-0000-0000-0000-000000000001';

  // Configura contexto da sessão de setup
  await setupClient.query(`
    SET app.current_user_id = '${userFinanceiro}';
    SET app.current_tenant_id = '${tenantId}';
    SET app.current_user_role = 'Financeiro';
  `);

  console.log('--- TESTE CONCORRENTE 1: DUAS CONEXÕES SIMULTÂNEAS COM O MESMO HASH ---');
  // Cria remessa de teste para este cenário
  const remId1 = 'a1111111-0000-0000-0000-000000000001';
  const itemRemId1 = 'b1111111-0000-0000-0000-000000000001';
  const hashMesmo = 'hash_simultaneo_concorrencia_real_001';

  await setupClient.query(`
    DELETE FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${remId1}';
    DELETE FROM public.cnab_retorno_arquivos WHERE remessa_arquivo_id = '${remId1}' OR hash_arquivo = '${hashMesmo}';
    DELETE FROM public.cnab_remessa_itens WHERE remessa_id = '${remId1}';
    DELETE FROM public.cnab_remessas_arquivos WHERE id = '${remId1}';

    INSERT INTO public.cnab_remessas_arquivos (
      id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo,
      hash_arquivo, total_registros, total_valor, banco_codigo, banco_nome, status, modo
    ) VALUES (
      '${remId1}', '${tenantId}', '${empresaId}', '${contaId}', 'REMESSA_CONC_1.TXT', 901,
      'hash_rem_conc_1', 1, 150.00, '341', 'Itaú', 'gerado', 'homologacao'
    );

    INSERT INTO public.cnab_remessa_itens (
      id, tenant_id, remessa_id, empresa_id, origem_tipo, origem_id, valor, status
    ) VALUES (
      '${itemRemId1}', '${tenantId}', '${remId1}', '${empresaId}', 'INTERMITENTE', gen_random_uuid(), 150.00, 'remetido'
    );
  `);

  // Abre duas conexões físicas simultâneas
  const conn1 = await createClientInstance();
  const conn2 = await createClientInstance();

  await conn1.query(`
    SET app.current_user_id = '${userFinanceiro}';
    SET app.current_tenant_id = '${tenantId}';
    SET app.current_user_role = 'Financeiro';
  `);
  await conn2.query(`
    SET app.current_user_id = '${userFinanceiro}';
    SET app.current_tenant_id = '${tenantId}';
    SET app.current_user_role = 'Financeiro';
  `);

  const payloadSameHash = JSON.stringify([{
    remessa_id: remId1,
    remessa_arquivo_id: remId1,
    remessa_item_id: itemRemId1,
    valor_esperado: 150.00,
    valor_retornado: 150.00,
    codigo_ocorrencia: '00',
    descricao_ocorrencia: 'Crédito ou Débito Efetivado',
    status: 'pago'
  }]);

  console.log(`Disparando duas transações em paralelo via conexões físicas distintas com hash "${hashMesmo}"...`);
  const t0 = Date.now();

  const promise1 = conn1.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empresaId}'::uuid,
      '${contaId}'::uuid,
      '341',
      'RETORNO_CONC_CONEXAO_1.RET',
      '${hashMesmo}',
      '${payloadSameHash}'::jsonb
    ) as result;
  `);

  const promise2 = conn2.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empresaId}'::uuid,
      '${contaId}'::uuid,
      '341',
      'RETORNO_CONC_CONEXAO_2.RET',
      '${hashMesmo}',
      '${payloadSameHash}'::jsonb
    ) as result;
  `);

  const results1 = await Promise.allSettled([promise1, promise2]);
  const duration1 = Date.now() - t0;
  console.log(`Execução concorrente finalizada em ${duration1}ms.`);

  const status1 = results1[0].status === 'fulfilled' ? 'SUCESSO' : 'REJEITADO: ' + results1[0].reason?.message;
  const status2 = results1[1].status === 'fulfilled' ? 'SUCESSO' : 'REJEITADO: ' + results1[1].reason?.message;

  console.log(`- Conexão 1: ${status1}`);
  console.log(`- Conexão 2: ${status2}`);

  const hasOneSuccess1 = (results1[0].status === 'fulfilled' && results1[1].status === 'rejected') ||
                        (results1[0].status === 'rejected' && results1[1].status === 'fulfilled');

  if (!hasOneSuccess1) {
    throw new Error('Falha no teste de concorrência 1: Ambas as conexões tiveram o mesmo resultado ou ambas passaram.');
  }

  // Verifica registros persistidos no banco
  const checkPersist1 = await setupClient.query(`
    SELECT id, nome_arquivo, hash_arquivo, status, created_at 
    FROM public.cnab_retorno_arquivos 
    WHERE hash_arquivo = '${hashMesmo}';
  `);
  console.log('\nRegistros persistidos em cnab_retorno_arquivos para o hash:');
  console.table(checkPersist1.rows);
  if (checkPersist1.rows.length !== 1) {
    throw new Error(`Esperado exatamente 1 registro persistido, encontrado: ${checkPersist1.rows.length}`);
  }
  console.log('✅ TESTE CONCORRENTE 1 APROVADO: Bloqueio transacional de concorrência evitou duplicidade com sucesso.\n');

  console.log('--- TESTE CONCORRENTE 2: DUAS CONEXÕES COM ARQUIVOS DIFERENTES DISPUTANDO O MESMO ITEM ---');
  // Cenário: dois arquivos distintos (hashes diferentes) tentam liquidar o mesmo item ao mesmo tempo
  const remId2 = 'a2222222-0000-0000-0000-000000000002';
  const itemRemId2 = 'b2222222-0000-0000-0000-000000000002';
  const hashA = 'hash_concorrente_diferente_A';
  const hashB = 'hash_concorrente_diferente_B';

  await setupClient.query(`
    DELETE FROM public.cnab_retorno_itens WHERE remessa_arquivo_id = '${remId2}';
    DELETE FROM public.cnab_retorno_arquivos WHERE remessa_arquivo_id = '${remId2}' OR hash_arquivo IN ('${hashA}', '${hashB}');
    DELETE FROM public.cnab_remessa_itens WHERE remessa_id = '${remId2}';
    DELETE FROM public.cnab_remessas_arquivos WHERE id = '${remId2}';

    INSERT INTO public.cnab_remessas_arquivos (
      id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo,
      hash_arquivo, total_registros, total_valor, banco_codigo, banco_nome, status, modo
    ) VALUES (
      '${remId2}', '${tenantId}', '${empresaId}', '${contaId}', 'REMESSA_CONC_2.TXT', 902,
      'hash_rem_conc_2', 1, 200.00, '341', 'Itaú', 'gerado', 'homologacao'
    );

    INSERT INTO public.cnab_remessa_itens (
      id, tenant_id, remessa_id, empresa_id, origem_tipo, origem_id, valor, status
    ) VALUES (
      '${itemRemId2}', '${tenantId}', '${remId2}', '${empresaId}', 'INTERMITENTE', gen_random_uuid(), 200.00, 'remetido'
    );
  `);

  const payloadItemA = JSON.stringify([{
    remessa_id: remId2,
    remessa_arquivo_id: remId2,
    remessa_item_id: itemRemId2,
    valor_esperado: 200.00,
    valor_retornado: 200.00,
    codigo_ocorrencia: '00',
    descricao_ocorrencia: 'Crédito ou Débito Efetivado',
    status: 'pago'
  }]);

  const payloadItemB = JSON.stringify([{
    remessa_id: remId2,
    remessa_arquivo_id: remId2,
    remessa_item_id: itemRemId2,
    valor_esperado: 200.00,
    valor_retornado: 200.00,
    codigo_ocorrencia: '00',
    descricao_ocorrencia: 'Crédito ou Débito Efetivado',
    status: 'pago'
  }]);

  console.log(`Disparando duas transações em paralelo disputando a liquidação do item "${itemRemId2}"...`);
  const t1 = Date.now();

  const promiseA = conn1.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empresaId}'::uuid,
      '${contaId}'::uuid,
      '341',
      'RETORNO_A.RET',
      '${hashA}',
      '${payloadItemA}'::jsonb
    ) as result;
  `);

  const promiseB = conn2.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empresaId}'::uuid,
      '${contaId}'::uuid,
      '341',
      'RETORNO_B.RET',
      '${hashB}',
      '${payloadItemB}'::jsonb
    ) as result;
  `);

  const results2 = await Promise.allSettled([promiseA, promiseB]);
  const duration2 = Date.now() - t1;
  console.log(`Execução concorrente finalizada em ${duration2}ms.`);

  const statusA = results2[0].status === 'fulfilled' ? 'SUCESSO' : 'REJEITADO: ' + results2[0].reason?.message;
  const statusB = results2[1].status === 'fulfilled' ? 'SUCESSO' : 'REJEITADO: ' + results2[1].reason?.message;

  console.log(`- Conexão 1 (Arquivo A): ${statusA}`);
  console.log(`- Conexão 2 (Arquivo B): ${statusB}`);

  const hasOneSuccess2 = (results2[0].status === 'fulfilled' && results2[1].status === 'rejected') ||
                         (results2[0].status === 'rejected' && results2[1].status === 'fulfilled');

  if (!hasOneSuccess2) {
    throw new Error('Falha no teste de concorrência 2: Uma das conexões deveria ser bloqueada contra re-liquidação.');
  }

  // Verifica persistência em cnab_retorno_itens
  const checkItensPersist = await setupClient.query(`
    SELECT id, retorno_arquivo_id, remessa_item_id, valor_retornado, status, created_at 
    FROM public.cnab_retorno_itens 
    WHERE remessa_item_id = '${itemRemId2}';
  `);
  console.log('\nRegistros persistidos em cnab_retorno_itens para o item em disputa:');
  console.table(checkItensPersist.rows);

  if (checkItensPersist.rows.length !== 1) {
    throw new Error(`Esperado exatamente 1 item liquidado no banco, encontrado: ${checkItensPersist.rows.length}`);
  }

  const checkRemessaItem = await setupClient.query(`
    SELECT id, status FROM public.cnab_remessa_itens WHERE id = '${itemRemId2}';
  `);
  console.log('Status final em cnab_remessa_itens:', checkRemessaItem.rows[0]);

  console.log('✅ TESTE CONCORRENTE 2 APROVADO: Serialização transacional (FOR UPDATE) e partial unique index garantiram liquidação única!');

  await conn1.end();
  await conn2.end();
  await setupClient.end();
  console.log('\n================================================================================');
  console.log('TESTES DE CONCORRÊNCIA EM DUAS CONEXÕES FÍSICAS SIMULTÂNEAS APROVADOS!');
  console.log('================================================================================');
}

run().catch((err) => {
  console.error('❌ ERRO NO TESTE DE CONCORRÊNCIA:', err);
  process.exit(1);
});
