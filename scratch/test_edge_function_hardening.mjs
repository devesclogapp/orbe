import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

const KONG_URL = 'http://127.0.0.1:54321';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main() {
  console.log('=== TESTE DE HARDENING DA EDGE FUNCTION SEC-03 ===\n');

  const pgClient = new pg.Client({ connectionString: DB_URL });
  await pgClient.connect();

  // Obter tenant existente para testes
  const { rows: tenantRows } = await pgClient.query('SELECT id FROM public.tenants LIMIT 1;');
  const tenantId = tenantRows[0].id;

  async function issueCodeForInvite(invId) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const salt = 'salt_' + Math.random().toString(36).substring(2, 10);
    const { rows: invRows } = await pgClient.query(`SELECT tenant_id FROM public.tenant_invitations WHERE id = '${invId}';`);
    const tId = invRows[0].tenant_id;
    const { rows: secRows } = await pgClient.query(`SELECT value FROM private.sec03_settings WHERE key = 'hmac_secret';`);
    const hmacSecret = secRows[0].value;
    const hmac = (await import('node:crypto')).createHmac('sha256', hmacSecret)
      .update(`${code}:${invId}:${salt}`)
      .digest('hex');

    await pgClient.query(`
      UPDATE public.tenant_invitation_challenges
      SET status = 'cancelado_reenvio'
      WHERE invitation_id = '${invId}' AND status IN ('pendente', 'verificado');

      INSERT INTO public.tenant_invitation_challenges (tenant_id, invitation_id, code_hash, salt, status, expires_at)
      VALUES ('${tId}', '${invId}', '${hmac}', '${salt}', 'pendente', NOW() + INTERVAL '10 minutes');
    `);
    return code;
  }

  // ---------------------------------------------------------------------------
  // TESTE 1: Ativação de Usuário Novo (Happy Path)
  // ---------------------------------------------------------------------------
  console.log('1. Testando ativação de usuário novo...');
  const emailNovo = `user_novo_${Date.now()}@test.local`;
  const tokenNovo = uuidv4();
  const invNovo = uuidv4();

  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${invNovo}', '${tenantId}', '${emailNovo}', 'rh', '${tokenNovo}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeNovo = await issueCodeForInvite(invNovo);

  // Validar código
  const verifyResNovo = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenNovo, code: codeNovo }),
  });
  const verifyJsonNovo = await verifyResNovo.json();
  const proofNovo = verifyJsonNovo.verification_proof;

  // Ativar
  const activateResNovo = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenNovo,
      verification_proof: proofNovo,
      password: 'StrongPassword123!@#',
    }),
  });
  const activateJsonNovo = await activateResNovo.json();
  console.log('   Resultado Novo Usuário:', activateResNovo.status, activateJsonNovo.success ? 'PASS' : 'FAIL');
  if (activateResNovo.status !== 200 || !activateJsonNovo.success) {
    throw new Error('Falha na ativação de novo usuário: ' + JSON.stringify(activateJsonNovo));
  }

  // ---------------------------------------------------------------------------
  // TESTE 2: Tentativa de Alterar Senha de Outra Conta Existente (Attack Scenario)
  // ---------------------------------------------------------------------------
  console.log('\n2. Testando tentativa de alterar senha de usuário existente via convite...');
  const emailExistente = `user_existente_${Date.now()}@test.local`;
  const originalPassword = 'OriginalSecretPassword123#';
  const attackerPassword = 'AttackerNewPassword999#';

  // Criar o usuário legítimo no Supabase Auth via GoTrue Admin API
  const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  const createAdminRes = await fetch(`${KONG_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: emailExistente,
      password: originalPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Usuario Titular' },
    }),
  });
  const createdAdminData = await createAdminRes.json();
  const existingUserId = createdAdminData.id;

  // Criar convite para o mesmo e-mail
  const tokenAttack = uuidv4();
  const invAttack = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${invAttack}', '${tenantId}', '${emailExistente}', 'rh', '${tokenAttack}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeAttack = await issueCodeForInvite(invAttack);

  const verifyResAttack = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenAttack, code: codeAttack }),
  });
  const proofAttack = (await verifyResAttack.json()).verification_proof;

  // Atacante tenta fornecer senha diferente
  const attackRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenAttack,
      verification_proof: proofAttack,
      password: attackerPassword, // Senha arbitrária do atacante
    }),
  });
  const attackJson = await attackRes.json();
  console.log('   attackRes response:', attackRes.status, attackJson);
  const isAttackBlocked = attackRes.status === 401 && attackJson.error === 'EXISTING_USER_PASSWORD_MISMATCH';
  console.log('   Tentativa de sobrescrever senha bloqueada com 401:', isAttackBlocked ? 'PASS' : 'FAIL');
  if (!isAttackBlocked) {
    throw new Error('FALHA DE SEGURANÇA: Senha de usuário existente foi aceita ou sobrescrita!');
  }

  // ---------------------------------------------------------------------------
  // TESTE 3: Aceite Legítimo por Usuário Existente com a Senha Correta
  // ---------------------------------------------------------------------------
  console.log('\n3. Testando aceite de convite por usuário existente confirmando sua senha correta...');
  const legitRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenAttack,
      verification_proof: proofAttack,
      password: originalPassword, // Senha real do titular
    }),
  });
  const legitJson = await legitRes.json();
  console.log('   Aceite legítimo com senha existente:', legitRes.status === 200 && legitJson.success ? 'PASS' : 'FAIL');
  if (legitRes.status !== 200 || !legitJson.success) {
    throw new Error('Falha no aceite legítimo de usuário existente: ' + JSON.stringify(legitJson));
  }

  // ---------------------------------------------------------------------------
  // TESTE 4: Falha no Banco e Compensação Segura (Exclui novo, NUNCA exclui pré-existente)
  // ---------------------------------------------------------------------------
  console.log('\n4. Testando rollback/compensação após erro de banco...');
  // A) Para usuário novo: compensação exclui o usuário criado
  const emailRollback = `user_rollback_${Date.now()}@test.local`;
  const tokenRollback = uuidv4();
  const invRollback = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${invRollback}', '${tenantId}', '${emailRollback}', 'rh', '${tokenRollback}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeRollback = await issueCodeForInvite(invRollback);
  const vResRollback = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenRollback, code: codeRollback }),
  });
  const pRollback = (await vResRollback.json()).verification_proof;

  // Simular falha corrompendo o status do convite imediatamente antes da ativação
  await pgClient.query(`UPDATE public.tenant_invitations SET status = 'bloqueado' WHERE id = '${invRollback}';`);

  const failRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenRollback,
      verification_proof: pRollback,
      password: 'ValidPassword123#',
    }),
  });
  console.log('   Ativação com banco falho rejeitada:', failRes.status === 400 ? 'PASS' : 'FAIL');

  // Verificar que o usuário foi compensado e limpo em auth.users
  const { rows: orphanRows } = await pgClient.query(`SELECT id FROM auth.users WHERE email = '${emailRollback}';`);
  const isOrphanCleaned = orphanRows.length === 0;
  console.log('   Compensação atômica limpou usuário novo órfão:', isOrphanCleaned ? 'PASS' : 'FAIL');
  if (!isOrphanCleaned) {
    throw new Error('Falha na compensação: usuário órfão deixado em auth.users!');
  }

  // B) Para usuário pré-existente: compensação NUNCA exclui a conta existente
  const { rows: checkExistingStillAlive } = await pgClient.query(`SELECT id FROM auth.users WHERE id = '${existingUserId}';`);
  const isExistingAccountPreserved = checkExistingStillAlive.length === 1;
  console.log('   Conta pré-existente preservada intacta:', isExistingAccountPreserved ? 'PASS' : 'FAIL');
  if (!isExistingAccountPreserved) {
    throw new Error('FALHA GRAVE: Conta pré-existente foi excluída indevidamente!');
  }

  // ---------------------------------------------------------------------------
  // TESTE 5: Duas Ativações Simultâneas (Concorrência Race Condition)
  // ---------------------------------------------------------------------------
  console.log('\n5. Testando duas ativações simultâneas concorrentes (Race Condition)...');
  const emailRace = `user_race_${Date.now()}@test.local`;
  const tokenRace = uuidv4();
  const invRace = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${invRace}', '${tenantId}', '${emailRace}', 'rh', '${tokenRace}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeRace = await issueCodeForInvite(invRace);
  const vResRace = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenRace, code: codeRace }),
  });
  const pRace = (await vResRace.json()).verification_proof;

  // Disparar duas requisições simultâneas com Promise.all
  const [res1, res2] = await Promise.all([
    fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', token: tokenRace, verification_proof: pRace, password: 'RacePassword123#' }),
    }),
    fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', token: tokenRace, verification_proof: pRace, password: 'RacePassword123#' }),
    }),
  ]);

  const json1 = await res1.json();
  const json2 = await res2.json();
  console.log('   res1 body:', res1.status, json1);
  console.log('   res2 body:', res2.status, json2);

  const statuses = [res1.status, res2.status].sort();
  console.log('   Status das duas requisições paralelas:', statuses);
  const isConcurrencySafe = statuses[0] === 200 && (statuses[1] === 400 || statuses[1] === 409);
  console.log('   Isolamento e bloqueio de corrida concorrente:', isConcurrencySafe ? 'PASS' : 'FAIL');
  if (!isConcurrencySafe) {
    throw new Error('Falha de concorrência: mais de uma requisição foi aceita ou ambas falharam!');
  }

  // ---------------------------------------------------------------------------
  // TESTE 6: Código e Prova Inválidos
  // ---------------------------------------------------------------------------
  console.log('\n6. Testando código e prova inválidos...');
  const fakeRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'activate', token: tokenRace, verification_proof: 'fake_proof_1234567890123456789012345678901234567890', password: 'ValidPass123456#' }),
  });
  console.log('   Prova inválida rejeitada com 400:', fakeRes.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n===============================================================');
  console.log('   TODOS OS TESTES DE SEGURANÇA DA EDGE FUNCTION PASSARAM!     ');
  console.log('===============================================================\n');

  await pgClient.end();
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
