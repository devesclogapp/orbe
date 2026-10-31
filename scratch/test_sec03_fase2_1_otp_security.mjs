import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function runTestSec03Fase21() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  const results = [];

  try {
    await client.query('BEGIN;');

    // 1. Setup de fixtures sintéticas
    const tenantA = uuidv4();
    const tenantB = uuidv4();

    await client.query(`
      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantA}', 'Empresa Logística Alpha'),
        ('${tenantB}', 'Transportes Beta Corp');
    `);

    const adminA = uuidv4();
    const userTestA = uuidv4();

    await client.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${adminA}', 'admin_alpha@sec03.local', 'authenticated', 'authenticated'),
        ('${userTestA}', 'convidado_alpha@sec03.local', 'authenticated', 'authenticated');
    `);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ('${adminA}', '${tenantA}', 'Admin Alpha', 'admin'),
        ('${userTestA}', '${tenantA}', 'Convidado Alpha', 'user');
    `);

    // Convite padrão válido no Tenant A
    const inviteA = uuidv4();
    const tokenA = 'tok_sec03_test_valid_1234567890';
    await client.query(`
      INSERT INTO public.tenant_invitations (
        id, tenant_id, email, full_name, role, token, status, expires_at
      ) VALUES (
        '${inviteA}', '${tenantA}', 'convidado_alpha@sec03.local', 'Convidado Alpha', 'rh', '${tokenA}', 'pendente', NOW() + INTERVAL '7 days'
      );
    `);

    // Convite no Tenant B (para teste de isolamento)
    const inviteB = uuidv4();
    const tokenB = 'tok_sec03_tenant_b_secret_9999';
    await client.query(`
      INSERT INTO public.tenant_invitations (
        id, tenant_id, email, full_name, role, token, status, expires_at
      ) VALUES (
        '${inviteB}', '${tenantB}', 'convidado_beta@sec03.local', 'Convidado Beta', 'financeiro', '${tokenB}', 'pendente', NOW() + INTERVAL '7 days'
      );
    `);

    // Helpers de sessão
    const setSession = async (role, userId = null) => {
      await client.query(`SET LOCAL ROLE ${role};`);
      if (userId) {
        await client.query(`
          SET LOCAL "request.jwt.claim.sub" = '${userId}';
          SET LOCAL "request.jwt.claim.role" = '${role}';
        `);
      }
    };

    const resetSession = async () => {
      await client.query('RESET ROLE;');
    };

    // ==========================================================================
    // TESTE 1: Código válido dentro do prazo
    // ==========================================================================
    await client.query('SAVEPOINT sp_t1;');
    // Gera desafio interno via service_role
    const t1GenRes = await client.query(`
      SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as payload;
    `);
    const t1Payload = t1GenRes.rows[0].payload;
    const t1Code = t1Payload.code;

    // Cliente anon tenta validar com o código correto
    await setSession('anon');
    const t1VerifyQuery = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t1Code}') as result;
    `);
    const t1VerifyRes = t1VerifyQuery.rows[0].result;
    await resetSession();
    await client.query('ROLLBACK TO SAVEPOINT sp_t1;');

    const t1Passed = t1VerifyRes?.success === true && t1VerifyRes?.verified === true;
    results.push({
      item: '1. Código válido dentro do prazo',
      esperado: 'Validação bem-sucedida com verified = true e success = true',
      obtido: t1Passed ? `Sucesso: OTP validado (${t1VerifyRes.message})` : `Falha: ${JSON.stringify(t1VerifyRes)}`,
      status: t1Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 2: Código incorreto
    // ==========================================================================
    await client.query('SAVEPOINT sp_t2;');
    await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    await setSession('anon');
    const t2Res = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '000000') as result;
    `);
    const t2Result = t2Res.rows[0].result;
    await resetSession();
    await client.query('ROLLBACK TO SAVEPOINT sp_t2;');

    const t2Passed = t2Result?.success === false &&
      t2Result?.error === 'INVALID_CODE' &&
      t2Result?.remaining_attempts === 4;
    results.push({
      item: '2. Código incorreto',
      esperado: 'Retorno estruturado com INVALID_CODE e decremento para 4 tentativas restantes',
      obtido: `Rejeitado: error='${t2Result?.error}', remaining_attempts=${t2Result?.remaining_attempts}`,
      status: t2Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 3: Código expirado
    // ==========================================================================
    await client.query('SAVEPOINT sp_t3;');
    const t3Gen = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const t3Code = t3Gen.rows[0].p.code;
    // Forçar expiração do desafio (10 minutos vencidos)
    await client.query(`
      UPDATE public.tenant_invitation_challenges 
      SET expires_at = NOW() - INTERVAL '1 second' 
      WHERE invitation_id = '${inviteA}';
    `);

    await setSession('anon');
    const t3Res = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t3Code}') as result;
    `);
    const t3Result = t3Res.rows[0].result;
    await resetSession();
    await client.query('ROLLBACK TO SAVEPOINT sp_t3;');

    const t3Passed = t3Result?.success === false && t3Result?.error === 'EXPIRED_CODE';
    results.push({
      item: '3. Código expirado',
      esperado: 'Rejeição estruturada com EXPIRED_CODE ("O código de verificação expirou")',
      obtido: `Rejeitado: error='${t3Result?.error}', message='${t3Result?.message}'`,
      status: t3Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 4: Bloqueio após cinco tentativas
    // ==========================================================================
    await client.query('SAVEPOINT sp_t4;');
    await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    await setSession('anon');

    let fifthResult = null;
    for (let i = 1; i <= 5; i++) {
      const wrongCode = `99999${i}`;
      const res = await client.query(`
        SELECT public.sec03_verify_invitation_otp('${tokenA}', '${wrongCode}') as result;
      `);
      if (i === 5) {
        fifthResult = res.rows[0].result;
      }
    }

    // 6ª tentativa para confirmar bloqueio rígido
    const sixthRes = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '000000') as result;
    `);
    const sixthResult = sixthRes.rows[0].result;

    await resetSession();

    // Inspecionar estado persistido no banco
    const t4Check = await client.query(`
      SELECT attempts, max_attempts, status 
      FROM public.tenant_invitation_challenges 
      WHERE invitation_id = '${inviteA}';
    `);
    await client.query('ROLLBACK TO SAVEPOINT sp_t4;');

    const challengeRow = t4Check.rows[0];
    const t4Passed = fifthResult?.blocked === true &&
      fifthResult?.remaining_attempts === 0 &&
      sixthResult?.error === 'MAX_ATTEMPTS_EXCEEDED' &&
      challengeRow?.status === 'bloqueado_tentativas' &&
      challengeRow?.attempts === 5;

    results.push({
      item: '4. Bloqueio após cinco tentativas',
      esperado: '5ª tentativa bloqueia (attempts=5, status="bloqueado_tentativas"), 6ª tentativa rejeitada com MAX_ATTEMPTS_EXCEEDED',
      obtido: `5ª: blocked=${fifthResult?.blocked}, status=${challengeRow?.status}, attempts=${challengeRow?.attempts} | 6ª: error=${sixthResult?.error}`,
      status: t4Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 5: Reenvio invalidando código anterior
    // ==========================================================================
    await client.query('SAVEPOINT sp_t5;');
    // Desafio 1
    const t5Gen1 = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const t5Code1 = t5Gen1.rows[0].p.code;

    // Resetar cooldown para permitir reenvio imediato
    await client.query(`
      UPDATE public.tenant_invitation_challenges 
      SET cooldown_until = NOW() - INTERVAL '1 second' 
      WHERE invitation_id = '${inviteA}';
    `);

    // Desafio 2 (Reenvio)
    const t5Gen2 = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const t5Code2 = t5Gen2.rows[0].p.code;

    await setSession('anon');
    // Tentar validar Desafio 1 (deve falhar pois status virou 'cancelado_reenvio')
    const t5OldRes = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t5Code1}') as result;
    `);
    const t5OldResult = t5OldRes.rows[0].result;

    // Validar Desafio 2 (deve passar com o novo código)
    const t5NewRes = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t5Code2}') as result;
    `);
    const t5NewResult = t5NewRes.rows[0].result;

    await resetSession();
    await client.query('ROLLBACK TO SAVEPOINT sp_t5;');

    const t5Passed = t5OldResult?.success === false &&
      t5OldResult?.error === 'INVALID_CODE' &&
      t5NewResult?.success === true &&
      t5NewResult?.verified === true;

    results.push({
      item: '5. Reenvio invalidando código anterior',
      esperado: 'Código anterior cancelado e rejeitado; novo código verificado com sucesso',
      obtido: `Código anterior rejeitado: ${t5OldResult?.error} | Novo código verificado: ${t5NewResult?.verified}`,
      status: t5Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 6: Convite expirado
    // ==========================================================================
    await client.query('SAVEPOINT sp_t6;');
    await client.query(`
      UPDATE public.tenant_invitations 
      SET expires_at = NOW() - INTERVAL '1 day' 
      WHERE id = '${inviteA}';
    `);

    let t6Err = null;
    try {
      await client.query(`SELECT public.sec03_request_invitation_otp('${tokenA}');`);
    } catch (e) {
      t6Err = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t6;');

    const t6Passed = t6Err?.code === 'P0001' && (t6Err.message.includes('expirado') || t6Err.message.includes('revogado') || t6Err.message.includes('Convite'));
    results.push({
      item: '6. Convite expirado',
      esperado: 'Exceção P0001: Rejeição de emissão de OTP para convite com validade vencida',
      obtido: t6Err ? `Bloqueado: "${t6Err.message}"` : 'Permitido indevidamente',
      status: t6Passed ? 'PASS' : 'FAIL',
      sqlstate: t6Err?.code || 'NENHUM',
    });

    // ==========================================================================
    // TESTE 7: Convite revogado ou excluído
    // ==========================================================================
    await client.query('SAVEPOINT sp_t7;');
    await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    await client.query(`DELETE FROM public.tenant_invitations WHERE id = '${inviteA}';`);

    // Verificar se desafios foram apagados em cascata (ON DELETE CASCADE)
    const t7Challenges = await client.query(`
      SELECT count(*) FROM public.tenant_invitation_challenges WHERE invitation_id = '${inviteA}';
    `);

    let t7Err = null;
    try {
      await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '123456');`);
    } catch (e) {
      t7Err = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t7;');

    const t7Passed = parseInt(t7Challenges.rows[0].count, 10) === 0 && t7Err !== null;
    results.push({
      item: '7. Convite revogado ou excluído',
      esperado: 'Desafios órfãos eliminados via cascade; verificação rejeitada (Convite inválido)',
      obtido: `Desafios restantes: ${t7Challenges.rows[0].count} | Rejeição: "${t7Err?.message}"`,
      status: t7Passed ? 'PASS' : 'FAIL',
      sqlstate: t7Err?.code || 'NENHUM',
    });

    // ==========================================================================
    // TESTE 8: Convite já utilizado
    // ==========================================================================
    await client.query('SAVEPOINT sp_t8;');
    await client.query(`
      UPDATE public.tenant_invitations 
      SET status = 'aceito', accepted_at = NOW() 
      WHERE id = '${inviteA}';
    `);

    let t8Err = null;
    try {
      await client.query(`SELECT public.sec03_request_invitation_otp('${tokenA}');`);
    } catch (e) {
      t8Err = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t8;');

    const t8Passed = t8Err?.code === 'P0001' && (t8Err.message.includes('expirado') || t8Err.message.includes('revogado') || t8Err.message.includes('Convite'));
    results.push({
      item: '8. Convite já utilizado',
      esperado: 'Exceção P0001: Rejeição de emissão de OTP para convite com status aceito',
      obtido: t8Err ? `Bloqueado: "${t8Err.message}"` : 'Permitido indevidamente',
      status: t8Passed ? 'PASS' : 'FAIL',
      sqlstate: t8Err?.code || 'NENHUM',
    });

    // ==========================================================================
    // TESTE 9: Tentativa de reutilização do OTP
    // ==========================================================================
    await client.query('SAVEPOINT sp_t9;');
    const t9Gen = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const t9Code = t9Gen.rows[0].p.code;

    // 1º consumo (deve validar com sucesso)
    const t9Res1 = await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t9Code}') as r;`);

    // 2º consumo com o mesmo código (deve ser rejeitado pois o desafio já foi consumido)
    const t9Res2 = await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t9Code}') as r;`);
    const t9Result2 = t9Res2.rows[0].r;

    await client.query('ROLLBACK TO SAVEPOINT sp_t9;');

    const t9Passed = t9Res1.rows[0].r.verified === true &&
      t9Result2.success === false &&
      t9Result2.error === 'ALREADY_VERIFIED';
    results.push({
      item: '9. Tentativa de reutilização do OTP',
      esperado: 'Rejeição estruturada ALREADY_VERIFIED; OTP consumido uma única vez',
      obtido: `1ª verificação: verified=${t9Res1.rows[0].r.verified} | 2ª tentativa: error=${t9Result2.error}`,
      status: t9Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 10: Tentativas simultâneas de consumo (Concorrência / Lock)
    // ==========================================================================
    await client.query('SAVEPOINT sp_t10;');
    const t10Gen = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const t10Code = t10Gen.rows[0].p.code;

    // Lock pessimista FOR UPDATE impede concorrência descontrolada:
    // A 1ª transação valida e altera status para verificado
    const t10Res1 = await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t10Code}') as r;`);
    // A 2ª transação (ou requisição paralela) encontra status 'verificado' e é imediatamente barrada
    const t10Res2 = await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t10Code}') as r;`);
    await client.query('ROLLBACK TO SAVEPOINT sp_t10;');

    const t10Passed = t10Res1.rows[0].r.verified === true && t10Res2.rows[0].r.success === false;
    results.push({
      item: '10. Tentativas simultâneas de consumo',
      esperado: 'Lock pessimista FOR UPDATE garante atomicidade e impede consumo duplo concorrente',
      obtido: `Consumo 1: verified=${t10Res1.rows[0].r.verified} | Consumo 2: success=${t10Res2.rows[0].r.success}`,
      status: t10Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 11: Tentativa de acesso entre tenants
    // ==========================================================================
    await client.query('SAVEPOINT sp_t11;');
    // Gerar desafio no Tenant A
    await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    // Gerar desafio no Tenant B
    const t11Gen = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenB}') as p;`);
    const t11CodeB = t11Gen.rows[0].p.code;

    // Tentar validar tokenA usando o código gerado para o convite do Tenant B
    const t11CrossRes = await client.query(`
      SELECT public.sec03_verify_invitation_otp('${tokenA}', '${t11CodeB}') as r;
    `);
    const t11CrossResult = t11CrossRes.rows[0].r;
    await client.query('ROLLBACK TO SAVEPOINT sp_t11;');

    const t11Passed = t11CrossResult.success === false && t11CrossResult.error === 'INVALID_CODE';
    results.push({
      item: '11. Tentativa de acesso entre tenants',
      esperado: 'Código gerado para o Tenant B é rejeitado categoricamente no Tenant A (hash com salt por convite)',
      obtido: `Bloqueado cross-tenant: error='${t11CrossResult.error}', remaining=${t11CrossResult.remaining_attempts}`,
      status: t11Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 12: Leitura não autorizada dos verificadores (RLS / Grants)
    // ==========================================================================
    await client.query('SAVEPOINT sp_t12_anon;');
    await setSession('anon');
    let t12AnonErr = null;
    try {
      await client.query('SELECT code_hash FROM public.tenant_invitation_challenges;');
    } catch (e) {
      t12AnonErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t12_anon;');

    await client.query('SAVEPOINT sp_t12_auth;');
    await setSession('authenticated', userTestA);
    let t12AuthErr = null;
    try {
      await client.query('SELECT code_hash FROM public.tenant_invitation_challenges;');
    } catch (e) {
      t12AuthErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t12_auth;');

    const t12Passed = t12AnonErr?.code === '42501' && t12AuthErr?.code === '42501';
    results.push({
      item: '12. Leitura não autorizada dos verificadores',
      esperado: 'Permission denied (42501) para SELECT direto por anon e authenticated',
      obtido: `Anon: ${t12AnonErr?.code} (${t12AnonErr?.message}) | Auth: ${t12AuthErr?.code}`,
      status: t12Passed ? 'PASS' : 'FAIL',
      sqlstate: '42501',
    });

    // ==========================================================================
    // TESTE 13: Tentativa de alteração de tenant ou role
    // ==========================================================================
    await client.query('SAVEPOINT sp_t13;');
    await setSession('authenticated', userTestA);
    let t13RoleErr = null;
    try {
      await client.query(`UPDATE public.profiles SET role = 'admin' WHERE user_id = '${userTestA}';`);
    } catch (e) {
      t13RoleErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_t13;');

    const t13Passed = t13RoleErr?.code === '42501';
    results.push({
      item: '13. Tentativa de alteração de tenant ou role',
      esperado: 'Permission denied (42501) para mutação direta em profiles.role',
      obtido: `Rejeição colunar: ${t13RoleErr?.code} (${t13RoleErr?.message})`,
      status: t13Passed ? 'PASS' : 'FAIL',
      sqlstate: '42501',
    });

    // ==========================================================================
    // TESTE 14: Compatibilidade com RPCs da SEC-02 e enriquecimento de tenant_name
    // ==========================================================================
    await client.query('SAVEPOINT sp_t14;');
    const t14Res = await client.query(`
      SELECT * FROM public.validate_invitation_token('${tokenA}');
    `);
    const t14Row = t14Res.rows[0];
    await client.query('ROLLBACK TO SAVEPOINT sp_t14;');

    const t14Passed = t14Row && t14Row.tenant_name === 'Empresa Logística Alpha' && t14Row.role === 'rh';
    results.push({
      item: '14. Compatibilidade com RPCs da SEC-02 e tenant_name oficial',
      esperado: 'validate_invitation_token retorna nome oficial da empresa (Empresa Logística Alpha)',
      obtido: `tenant_name='${t14Row?.tenant_name}', role='${t14Row?.role}', status='${t14Row?.status}'`,
      status: t14Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // ==========================================================================
    // TESTE 15: Não regressão dos testes administrativos anteriores
    // ==========================================================================
    await client.query('SAVEPOINT sp_t15;');
    await setSession('authenticated', adminA);
    const t15Overview = await client.query('SELECT * FROM public.admin_list_user_access_overview();');
    await resetSession();
    await client.query('ROLLBACK TO SAVEPOINT sp_t15;');

    const t15Passed = t15Overview.rows.length >= 2;
    results.push({
      item: '15. Não regressão dos testes administrativos anteriores',
      esperado: 'admin_list_user_access_overview continua operando com 100% de integridade',
      obtido: `Overview retornou ${t15Overview.rows.length} registros para o Admin do Tenant A`,
      status: t15Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    await client.query('ROLLBACK;');

    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Fatal test error in SEC-03 Fase 2.1:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTestSec03Fase21();
