import pg from 'pg';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

const KONG_URL = 'http://127.0.0.1:54321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main() {
  console.log('=== TESTE ESPECÍFICO DE RECUPERAÇÃO DE ATIVAÇÃO SEC-03 ===\n');

  const pgClient = new pg.Client({ connectionString: DB_URL });
  await pgClient.connect();

  const timestamp = Date.now();
  const emailNovo = `recov_novo_${timestamp}@test.local`;
  const originalPassword = 'SenhaOriginalForte123#';

  // 1. Criar Tenants de Teste
  const tenantAId = uuidv4();
  const tenantBId = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenants (id, nome, name, created_at)
    VALUES 
      ('${tenantAId}', 'Empresa Alpha Recuperacao', 'Empresa Alpha Recuperacao', NOW()),
      ('${tenantBId}', 'Empresa Beta Isolada', 'Empresa Beta Isolada', NOW());
  `);

  async function issueCodeForInvite(invId) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const salt = 'salt_' + Math.random().toString(36).substring(2, 10);
    const { rows: invRows } = await pgClient.query(`SELECT tenant_id FROM public.tenant_invitations WHERE id = '${invId}';`);
    const tId = invRows[0].tenant_id;
    const { rows: secRows } = await pgClient.query(`SELECT value FROM private.sec03_settings WHERE key = 'hmac_secret';`);
    const hmacSecret = secRows[0].value;
    const hmac = crypto.createHmac('sha256', hmacSecret)
      .update(`${code}:${invId}:${salt}`)
      .digest('hex');

    await pgClient.query(`
      INSERT INTO public.tenant_invitation_challenges 
        (id, tenant_id, invitation_id, code_hash, salt, status, expires_at, attempts, max_attempts)
      VALUES 
        ('${crypto.randomUUID()}', '${tId}', '${invId}', '${hmac}', '${salt}', 'pendente', NOW() + INTERVAL '10 minutes', 0, 5);
    `);
    return code;
  }

  console.log('1. Criando convite válido para usuário novo no Tenant A...');
  const inviteId = uuidv4();
  const token = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at, full_name)
    VALUES ('${inviteId}', '${tenantAId}', '${emailNovo}', 'rh', '${token}', 'pendente', NOW() + INTERVAL '7 days', 'Colaborador Recuperacao');
  `);

  const code = await issueCodeForInvite(inviteId);

  // Validar código OTP para gerar a verification_proof
  const verifyRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token, code }),
  });
  const verifyData = await verifyRes.json();
  const proof = verifyData.verification_proof;
  console.log('   Código validado. Proof obtida:', proof ? 'SIM' : 'NÃO');

  // 2, 3 e 4. Simular falha composta: criação no Auth tem sucesso, mas aceite no banco falha e compensação também falha
  console.log('\n2. Simulando criação bem-sucedida em auth.users com falha composta de compensação...');
  const createAuthRes = await fetch(`${KONG_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: emailNovo,
      password: originalPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Colaborador Recuperacao', provisioned_by: 'sec03_invite' },
    }),
  });
  const authUser = await createAuthRes.json();
  const orphanUserId = authUser.id;
  console.log('   Usuário criado em auth.users:', orphanUserId);

  // Verificar estado órfão inicial (falha antes de criar profile)
  const { rows: initialUsers } = await pgClient.query(`SELECT id, email FROM auth.users WHERE email = '${emailNovo}'`);
  const { rows: initialProfiles } = await pgClient.query(`SELECT id, tenant_id FROM public.profiles WHERE user_id = '${orphanUserId}'`);
  const { rows: initialInvites } = await pgClient.query(`SELECT id, status FROM public.tenant_invitations WHERE id = '${inviteId}'`);

  console.log('\n--- Estado Intermediário (Após Falha Composta e Sem Compensação) ---');
  console.log(`- auth.users: ${initialUsers.length} registro(s) encontrado(s) (ID: ${initialUsers[0]?.id})`);
  console.log(`- profiles: ${initialProfiles.length} registro(s) (Nenhum perfil ativo)`);
  console.log(`- tenant_invitations.status: '${initialInvites[0]?.status}' (Permanece pendente)`);

  if (initialProfiles.length !== 0 || initialInvites[0]?.status !== 'pendente') {
    throw new Error('Estado intermediário inválido para o teste de recuperação.');
  }

  // 5. Repetir a ativação com o mesmo convite e a senha originalmente definida
  console.log('\n3. Repetindo a ativação com o mesmo convite e a senha original...');
  const retryActivationRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: token,
      verification_proof: proof,
      password: originalPassword,
    }),
  });

  const retryStatus = retryActivationRes.status;
  const retryBody = await retryActivationRes.json();
  console.log(`   Código HTTP retornado: ${retryStatus}`);
  console.log('   Corpo da resposta:', retryBody);

  // 6. Confirmar recuperação, perfil, permissões e ausência de duplicidade
  console.log('\n4. Verificando estado final do banco de dados pós-recuperação...');
  const { rows: finalUsers } = await pgClient.query(`SELECT id, email, created_at FROM auth.users WHERE email = '${emailNovo}'`);
  const { rows: finalProfiles } = await pgClient.query(`SELECT id, user_id, tenant_id, role FROM public.profiles WHERE user_id = '${orphanUserId}'`);
  const { rows: finalPermissions } = await pgClient.query(`
    SELECT * FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_permissions';
  `);
  let permissionsCount = 0;
  if (finalPermissions.length > 0) {
    const { rows: pRows } = await pgClient.query(`SELECT COUNT(*) as cnt FROM public.user_permissions WHERE user_id = '${orphanUserId}'`);
    permissionsCount = parseInt(pRows[0]?.cnt || '0', 10);
  }

  const { rows: finalInvites } = await pgClient.query(`SELECT id, status FROM public.tenant_invitations WHERE id = '${inviteId}'`);

  console.log('\n--- Estado Final Auditado ---');
  console.log(`- auth.users: ${finalUsers.length} registro(s) (Duplicidade: ${finalUsers.length === 1 ? 'NÃO (Íntegro)' : 'SIM (Falha)'})`);
  console.log(`- profiles: ${finalProfiles.length} registro(s) (Vinculado ao Tenant: ${finalProfiles[0]?.tenant_id === tenantAId ? 'SIM (Alpha)' : 'NÃO'}) | Role: '${finalProfiles[0]?.role}'`);
  console.log(`- user_permissions: ${permissionsCount} permissões associadas`);
  console.log(`- tenant_invitations.status: '${finalInvites[0]?.status}' (Esperado: 'aceito')`);

  const isRecoverySuccessful = retryStatus === 200 &&
                               finalUsers.length === 1 &&
                               finalProfiles.length === 1 &&
                               finalProfiles[0].tenant_id === tenantAId &&
                               finalInvites[0].status === 'aceito';

  console.log('\n   Resultado da Recuperação de Conta Órfã:', isRecoverySuccessful ? 'PASS' : 'FAIL');
  if (!isRecoverySuccessful) {
    throw new Error('Falha na recuperação da conta órfã!');
  }

  // 7. Confirmar que uma conta legítima preexistente continua protegida contra alteração de senha e associação indevida
  console.log('\n5. Testando proteção da conta preexistente contra alteração de senha e associação indevida...');

  // Cenário 7A: Invasor tenta convidar a conta para Tenant B (Associação indevida entre empresas)
  const inviteTenantB = uuidv4();
  const tokenB = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${inviteTenantB}', '${tenantBId}', '${emailNovo}', 'financeiro', '${tokenB}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeB = await issueCodeForInvite(inviteTenantB);
  const vResB = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenB, code: codeB }),
  });
  const proofB = (await vResB.json()).verification_proof;

  const crossTenantRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenB,
      verification_proof: proofB,
      password: originalPassword,
    }),
  });
  const crossStatus = crossTenantRes.status;
  const crossBody = await crossTenantRes.json();
  console.log(`   Tentativa de associar a outro tenant (B): HTTP ${crossStatus}`, crossBody.error);
  const isCrossTenantBlocked = crossStatus === 409 && crossBody.error === 'USER_TENANT_CONFLICT';
  console.log('   Proteção contra associação indevida de tenant:', isCrossTenantBlocked ? 'PASS' : 'FAIL');

  // Cenário 7B: Atacante tenta fornecer senha diferente para sequestrar a conta no mesmo tenant
  const inviteAttack = uuidv4();
  const tokenAttack = uuidv4();
  await pgClient.query(`
    INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
    VALUES ('${inviteAttack}', '${tenantAId}', '${emailNovo}', 'rh', '${tokenAttack}', 'pendente', NOW() + INTERVAL '7 days');
  `);
  const codeAtt = await issueCodeForInvite(inviteAttack);
  const vResAtt = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify_code', token: tokenAttack, code: codeAtt }),
  });
  const proofAtt = (await vResAtt.json()).verification_proof;

  const attackPassRes = await fetch(`${KONG_URL}/functions/v1/sec03-activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'activate',
      token: tokenAttack,
      verification_proof: proofAtt,
      password: 'AttackerPassword999#', // Senha incorreta / arbitrária
    }),
  });
  const attackStatus = attackPassRes.status;
  const attackBody = await attackPassRes.json();
  console.log(`   Tentativa de sobrescrever senha com valor arbitrário: HTTP ${attackStatus}`, attackBody.error);
  const isAttackBlocked = attackStatus === 401 && attackBody.error === 'EXISTING_USER_PASSWORD_MISMATCH';
  console.log('   Proteção contra sobrescrita de senha:', isAttackBlocked ? 'PASS' : 'FAIL');

  // Cenário 7C: Confirmar que o titular ainda consegue autenticar com sua senha original
  const titularAuthRes = await fetch(`${KONG_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      email: emailNovo,
      password: originalPassword,
    }),
  });
  const titularAuthStatus = titularAuthRes.status;
  console.log(`   Login do titular com senha original: HTTP ${titularAuthStatus}`);
  const isPasswordPreserved = titularAuthStatus === 200;
  console.log('   Senha original permanece ativa e intacta:', isPasswordPreserved ? 'PASS' : 'FAIL');

  if (!isCrossTenantBlocked || !isAttackBlocked || !isPasswordPreserved) {
    throw new Error('Falha nos testes de proteção da conta preexistente!');
  }

  console.log('\n===============================================================');
  console.log('   TESTE DE RECUPERAÇÃO E PROTEÇÃO CONCLUÍDO COM SUCESSO!       ');
  console.log('===============================================================');

  await pgClient.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
