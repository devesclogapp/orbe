// test_concorrencia_real_gate02a.cjs
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const MANIFEST_PATH = path.resolve(__dirname, 'hml_gate02a_manifest.json');

async function run() {
  if (!connectionString) {
    console.error("ERRO CRÍTICO: DATABASE_URL não configurada no ambiente.");
    process.exit(1);
  }

  let client1 = null;
  let client2 = null;
  let clientAuditor = null;

  const tenantId = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  const colaboradorId = 'd0a663d7-383e-4720-be53-1b8a1f162090';
  const competencia = '2099-01';

  const pontoId = crypto.randomUUID();
  const loteId = crypto.randomUUID();
  const chaveImportacao = `HML_GATE02A_CONC_${crypto.randomUUID()}`;

  let conexao1EmTransacao = false;
  let evidenciaLockComprovada = false;
  let rpcPromise = null;
  let testeAprovado = false;

  // REQUISITO 1: Manifest de recuperação persistido em disco ANTES de qualquer escrita remota
  const manifestData = {
    pontoId,
    loteId,
    chaveImportacao,
    tenantId,
    empresaId,
    colaboradorId,
    competencia,
    timestamp: new Date().toISOString(),
    status: 'INICIADO'
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`[MANIFEST] Manifesto persistido em disco antes das escritas: ${MANIFEST_PATH}`);

  try {
    // REQUISITO 2: Configuração de timeouts
    // statement_timeout geral de 15s para dar margem segura; lock_timeout desativado (0) na Conexão 2
    // para garantir que a espera legítima pelo advisory lock (3s) não seja abortada prematuramente.
    client1 = new Client({ connectionString, statement_timeout: 15000 });
    client2 = new Client({ connectionString, statement_timeout: 15000 });
    clientAuditor = new Client({ connectionString, statement_timeout: 15000 });

    await client1.connect();
    await client2.connect();
    await clientAuditor.connect();

    // Garante que o lock_timeout da Conexão 2 permita esperar pelo lock
    await client2.query("SET lock_timeout = 0;");
    await client2.query("SET statement_timeout = 15000;");

    const pid1Res = await client1.query('SELECT pg_backend_pid() as pid;');
    const pid2Res = await client2.query('SELECT pg_backend_pid() as pid;');
    const pid1 = parseInt(pid1Res.rows[0].pid, 10);
    const pid2 = parseInt(pid2Res.rows[0].pid, 10);

    const lockKeyRes = await client1.query(`
      SELECT public.fn_rh_competencia_lock_key($1, $2, $3) as lock_key;
    `, [tenantId, empresaId, competencia]);
    const lockKey = lockKeyRes.rows[0].lock_key;

    console.log(`[SETUP] Conexões ativas: PID1=${pid1}, PID2=${pid2}`);
    console.log(`[SETUP] Chave do Advisory Lock: ${lockKey}`);
    console.log(`[SETUP] IDs dinâmicos: Ponto=${pontoId}, Lote=${loteId}`);

    // Inserção do Ponto Sintético Inicial
    await client1.query(`
      INSERT INTO public.registros_ponto (
        id, tenant_id, empresa_id, colaborador_id, data, competencia,
        status, status_processamento, chave_importacao, entrada
      ) VALUES ($1, $2, $3, $4, '2099-01-15', $5, 'pendente', 'pendente', $6, '08:00');
    `, [pontoId, tenantId, empresaId, colaboradorId, competencia, chaveImportacao]);
    console.log('[ETAPA 1] Ponto sintético criado.');

    // Conexão 1 abre transação e insere lote financeiro (adquire advisory lock)
    await client1.query('BEGIN;');
    conexao1EmTransacao = true;

    await client1.query(`
      INSERT INTO public.rh_financeiro_lotes (
        id, tenant_id, empresa_id, competencia, origem, tipo, status, total_colaboradores, valor_total
      ) VALUES ($1, $2, $3, $4, 'RH', 'FOLHA_BASE', 'AGUARDANDO_FINANCEIRO', 1, 0.00);
    `, [loteId, tenantId, empresaId, competencia]);
    console.log('[CONEXÃO 1] Lote inserido em transação aberta (Advisory Lock adquirido).');

    // Conexão 2 dispara chamada à RPC tentando modificar entrada
    console.log('[CONEXÃO 2] Disparando RPC. Aguardando retenção no advisory lock...');
    const startRpc = Date.now();
    rpcPromise = client2.query(`
      SELECT public.rpc_atualizar_ponto_se_competencia_aberta(
        p_tenant_id => $1,
        p_registro_id => $2,
        p_empresa_id => $3,
        p_competencia => $4,
        p_payload => '{"entrada": "08:45"}'::jsonb
      ) as resultado;
    `, [tenantId, pontoId, empresaId, competencia]);

    // Auditoria específica no catálogo pg_locks via conexão auditora
    await new Promise(resolve => setTimeout(resolve, 1000));

    const locksAudit = await clientAuditor.query(`
      SELECT 
        pid, 
        locktype, 
        mode, 
        granted,
        (classid::bigint << 32) | (objid::bigint & 4294967295) as full_lock_key
      FROM pg_locks 
      WHERE locktype = 'advisory' 
        AND pid IN ($1, $2)
      ORDER BY pid;
    `, [pid1, pid2]);

    console.log('[AUDITORIA LOCKS] Registros em pg_locks:', locksAudit.rows);

    const lockConexao1 = locksAudit.rows.find(r => r.pid === pid1 && r.granted === true);
    const lockConexao2 = locksAudit.rows.find(r => r.pid === pid2 && r.granted === false);

    if (lockConexao1 && lockConexao2) {
      evidenciaLockComprovada = true;
      console.log(`✅ [AUDITORIA COMPROVADA] PID1 (${pid1}) com lock CONCEDIDO (granted=true) e PID2 (${pid2}) AGUARDANDO (granted=false).`);
    } else {
      console.error(`⚠️ [AUDITORIA FALHOU] Disputa de lock não evidenciada em pg_locks!`);
    }

    // Segura Conexão 1 por mais 2 segundos comprovando a espera
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Conexão 1 comita e libera o advisory lock
    console.log('[CONEXÃO 1] Executando COMMIT; (liberação do advisory lock)...');
    await client1.query('COMMIT;');
    conexao1EmTransacao = false;

    // Conexão 2 conclui
    const resRpc = await rpcPromise;
    const duracaoMs = Date.now() - startRpc;
    const resultado = resRpc.rows[0].resultado;

    console.log(`[CONEXÃO 2] RPC finalizada após ${duracaoMs}ms com resultado:`, resultado);

    // Validação de integridade do ponto: horário original (08:00) deve estar preservado
    const checkPontoRes = await clientAuditor.query('SELECT entrada FROM public.registros_ponto WHERE id = $1;', [pontoId]);
    const entradaFinal = checkPontoRes.rows[0]?.entrada;
    console.log(`[INTEGRIDADE PONTO] Horário de entrada do ponto após execução: ${entradaFinal}`);

    const bloqueioCorreto = resultado.status === 'COMPETENCIA_FECHADA';
    const pontoPreservado = entradaFinal === '08:00:00';

    if (evidenciaLockComprovada && bloqueioCorreto && pontoPreservado) {
      testeAprovado = true;
      console.log('======================================================================');
      console.log('✅ TESTE 3 APROVADO COM SUCESSO!');
      console.log('1. Disputa do advisory lock comprovada em pg_locks (PID1 granted=true, PID2 granted=false).');
      console.log('2. RPC rejeitou a alteração concorrente com status COMPETENCIA_FECHADA.');
      console.log('3. Horário original preservado intacto em 08:00:00.');
      console.log('======================================================================');
    } else {
      console.error('======================================================================');
      console.error('❌ TESTE 3 REPROVADO NOS CRITÉRIOS OBJETIVOS:');
      console.error(`- Evidência de lock comprovada: ${evidenciaLockComprovada}`);
      console.error(`- RPC retornou COMPETENCIA_FECHADA: ${bloqueioCorreto} (status=${resultado.status})`);
      console.error(`- Horário original preservado: ${pontoPreservado} (entrada=${entradaFinal})`);
      console.error('======================================================================');
    }

  } catch (err) {
    console.error('ERRO DURANTE A EXECUÇÃO DO TESTE 3:', err);
  } finally {
    // REQUISITO 3: Concorrência e encerramento seguro
    // Caso tenha ocorrido exceção antes da resolução da RPC, cancela a query pendente na Conexão 2
    if (client2 && rpcPromise) {
      try {
        await Promise.race([
          rpcPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout aguardando RPC no teardown')), 2000))
        ]).catch(async () => {
          if (clientAuditor) {
            console.log('[TEARDOWN] Cancelando consulta pendente na Conexão 2 via pg_cancel_backend...');
            const pid2Cancel = await client2.query('SELECT pg_backend_pid() as pid;').catch(() => null);
            if (pid2Cancel?.rows[0]?.pid) {
              await clientAuditor.query('SELECT pg_cancel_backend($1);', [pid2Cancel.rows[0].pid]).catch(() => {});
            }
          }
        });
      } catch (e) {
        // Ignora erros de cancelamento
      }
    }

    console.log('[TEARDOWN] Iniciando limpeza restrita exclusivamente aos UUIDs gerados...');
    
    // Se a Conexão 1 ficou com transação pendente, efetua ROLLBACK
    if (client1 && conexao1EmTransacao) {
      try {
        await client1.query('ROLLBACK;');
        console.log('[TEARDOWN] Transação aberta na Conexão 1 revertida com ROLLBACK.');
      } catch (rbErr) {
        console.error('[TEARDOWN ERRO ROLLBACK]', rbErr);
      }
    }

    // Limpeza cirúrgica via clientAuditor
    if (clientAuditor) {
      try {
        await clientAuditor.query('DELETE FROM public.rh_financeiro_lotes WHERE id = $1;', [loteId]);
        await clientAuditor.query('DELETE FROM public.registros_ponto WHERE id = $1;', [pontoId]);

        const checkP = await clientAuditor.query('SELECT count(*) FROM public.registros_ponto WHERE id = $1;', [pontoId]);
        const checkL = await clientAuditor.query('SELECT count(*) FROM public.rh_financeiro_lotes WHERE id = $1;', [loteId]);

        console.log(`[TEARDOWN] Auditoria de resíduos: Pontos=${checkP.rows[0].count}, Lotes=${checkL.rows[0].count}`);

        if (checkP.rows[0].count === '0' && checkL.rows[0].count === '0') {
          // Remove o manifesto local se tudo foi limpo com sucesso
          if (fs.existsSync(MANIFEST_PATH)) {
            fs.unlinkSync(MANIFEST_PATH);
            console.log('[MANIFEST] Manifesto removido com sucesso pós-limpeza.');
          }
        }
      } catch (cleanErr) {
        console.error('[TEARDOWN ERRO CLEANUP]', cleanErr);
      }
    }

    // Fechamento seguro dos sockets TCP
    if (client1) await client1.end().catch(() => {});
    if (client2) await client2.end().catch(() => {});
    if (clientAuditor) await clientAuditor.end().catch(() => {});
    console.log('[TEARDOWN] Conexões TCP encerradas com segurança.');

    // REQUISITO 3: Falha em qualquer critério resulta em código de saída diferente de zero
    if (!testeAprovado) {
      process.exit(1);
    }
  }
}

// Procedimento de recuperação de emergência caso executado com flag --cleanup-manifest
async function cleanupOrphanManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log('[RECOVERY] Nenhum manifesto pendente encontrado.');
    return;
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(raw);
  console.log('[RECOVERY] Manifesto de recuperação detectado:', manifest);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (manifest.loteId) {
      await client.query('DELETE FROM public.rh_financeiro_lotes WHERE id = $1;', [manifest.loteId]);
      console.log(`[RECOVERY] Lote ${manifest.loteId} removido.`);
    }
    if (manifest.pontoId) {
      await client.query('DELETE FROM public.registros_ponto WHERE id = $1;', [manifest.pontoId]);
      console.log(`[RECOVERY] Ponto ${manifest.pontoId} removido.`);
    }
    fs.unlinkSync(MANIFEST_PATH);
    console.log('[RECOVERY] Limpeza de emergência concluída e manifesto apagado.');
  } finally {
    await client.end();
  }
}

if (process.argv.includes('--cleanup-manifest')) {
  cleanupOrphanManifest().catch(err => {
    console.error('[RECOVERY ERRO]', err);
    process.exit(1);
  });
} else {
  run().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
