import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function runReviewSecuritySuite() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  const results = [];

  try {
    await client.query('BEGIN;');

    // 1. Setup multi-tenant
    const tenantA = uuidv4();
    const tenantB = uuidv4();

    await client.query(`
      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantA}', 'Empresa Alpha Log'),
        ('${tenantB}', 'Transportes Beta S/A');
    `);

    const adminA = uuidv4();
    const userA = uuidv4();
    const userB = uuidv4();

    await client.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${adminA}', 'admin@alpha.log', 'authenticated', 'authenticated'),
        ('${userA}', 'operador@alpha.log', 'authenticated', 'authenticated'),
        ('${userB}', 'invasor@beta.log', 'authenticated', 'authenticated');
    `);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ('${adminA}', '${tenantA}', 'Admin Alpha', 'admin'),
        ('${userA}', '${tenantA}', 'Operador Alpha', 'user'),
        ('${userB}', '${tenantB}', 'Operador Beta', 'user');
    `);

    const tokenA = 'tok_alpha_audit_secure_token_1111';
    const inviteA = uuidv4();
    await client.query(`
      INSERT INTO public.tenant_invitations (
        id, tenant_id, email, full_name, role, token, status, expires_at
      ) VALUES (
        '${inviteA}', '${tenantA}', 'convidado@alpha.log', 'Convidado Alpha', 'rh', '${tokenA}', 'pendente', NOW() + INTERVAL '7 days'
      );
    `);

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

    // =========================================================================
    // REVISÃO 1: Prova de Não Vazamento do Código OTP (Respostas, Banco e Logs)
    // =========================================================================
    await client.query('SAVEPOINT sp_rev1;');
    await setSession('anon');
    const reqRes = await client.query(`SELECT public.sec03_request_invitation_otp('${tokenA}') as r;`);
    const payload = reqRes.rows[0].r;
    await resetSession();

    // Inspecionar se o payload vazou code ou hash
    const leakedInPayload = 'code' in payload || 'code_hash' in payload;

    // Inspecionar logs gerados no audit_log
    const auditRows = await client.query(`
      SELECT descricao FROM public.audit_log 
      WHERE entidade = 'tenant_invitations' AND registro_id = '${inviteA}';
    `);
    const leakedInLogs = auditRows.rows.some(r => /\b\d{6}\b/.test(r.descricao));

    await client.query('ROLLBACK TO SAVEPOINT sp_rev1;');

    const rev1Passed = !leakedInPayload && !leakedInLogs;
    results.push({
      item: 'R1. Não vazamento do OTP (Client RPC, Resposta e Audit Log)',
      esperado: 'Payload anônimo mascara e-mail e omite código; audit_log registra ação sem expor os 6 dígitos',
      obtido: `Vazou no Payload: ${leakedInPayload} | Vazou no Audit Log: ${leakedInLogs} | Payload: ${JSON.stringify(payload)}`,
      status: rev1Passed ? 'PASS' : 'FAIL',
      severidade: 'CRÍTICA'
    });

    // =========================================================================
    // REVISÃO 2: Bloqueio Estrito de Acesso à RPC Interna Privilegiada
    // =========================================================================
    await client.query('SAVEPOINT sp_rev2_anon;');
    await setSession('anon');
    let r2AnonErr = null;
    try {
      await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    } catch (e) {
      r2AnonErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_rev2_anon;');

    await client.query('SAVEPOINT sp_rev2_auth;');
    await setSession('authenticated', userA);
    let r2AuthErr = null;
    try {
      await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);
    } catch (e) {
      r2AuthErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_rev2_auth;');

    const rev2Passed = r2AnonErr?.code === '42501' && r2AuthErr?.code === '42501';
    results.push({
      item: 'R2. Bloqueio de sec03_generate_invitation_challenge_internal para anon e authenticated',
      esperado: 'Rejeição SQLSTATE 42501 (Permission Denied) para todos exceto service_role',
      obtido: `Anon: ${r2AnonErr?.code} | Authenticated: ${r2AuthErr?.code}`,
      status: rev2Passed ? 'PASS' : 'FAIL',
      severidade: 'CRÍTICA'
    });

    // =========================================================================
    // REVISÃO 3: Renovação de Convite Invalida Desafio em Estado 'verificado'
    // =========================================================================
    await client.query('SAVEPOINT sp_rev3;');
    // Gera desafio
    const r3Gen = await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}') as p;`);
    const r3Code = r3Gen.rows[0].p.code;

    // Usuário valida com sucesso (vai para status 'verificado')
    const r3Verify = await client.query(`SELECT public.sec03_verify_invitation_otp('${tokenA}', '${r3Code}') as r;`);
    const r3Verified = r3Verify.rows[0].r.verified === true;

    // Administrador RENOVA o convite (gerando novo token)
    const newToken = 'tok_alpha_renewed_token_9999';
    await client.query(`
      UPDATE public.tenant_invitations 
      SET token = '${newToken}', expires_at = NOW() + INTERVAL '7 days'
      WHERE id = '${inviteA}';
    `);

    // Inspecionar status do desafio que estava 'verificado'
    const r3Check = await client.query(`
      SELECT status FROM public.tenant_invitation_challenges WHERE invitation_id = '${inviteA}';
    `);
    const r3FinalStatus = r3Check.rows[0]?.status;

    await client.query('ROLLBACK TO SAVEPOINT sp_rev3;');

    const rev3Passed = r3Verified && r3FinalStatus === 'cancelado_reenvio';
    results.push({
      item: 'R3. Invalidação de Desafio "verificado" após Renovação do Convite',
      esperado: 'Trigger cancela tanto desafios "pendente" quanto "verificado" ao alterar token (status="cancelado_reenvio")',
      obtido: `Verificado anteriormente: ${r3Verified} | Status pós-renovação: ${r3FinalStatus}`,
      status: rev3Passed ? 'PASS' : 'FAIL',
      severidade: 'ALTA'
    });

    // =========================================================================
    // REVISÃO 4: Tentativa de Acesso Cross-Tenant por Usuário Autenticado
    // =========================================================================
    await client.query('SAVEPOINT sp_rev4;');
    // User B autenticado tenta executar select na tabela de desafios ou chamar verificação
    await client.query(`SELECT public.sec03_generate_invitation_challenge_internal('${tokenA}');`);

    await setSession('authenticated', userB);
    let r4SelectErr = null;
    try {
      await client.query(`SELECT * FROM public.tenant_invitation_challenges WHERE tenant_id = '${tenantA}';`);
    } catch (e) {
      r4SelectErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_rev4;');

    const rev4Passed = r4SelectErr?.code === '42501';
    results.push({
      item: 'R4. Isolamento Multi-tenant estrito para tenant_invitation_challenges',
      esperado: 'Usuário de tenant distinto é categoricamente bloqueado por ausência de GRANT / RLS (42501)',
      obtido: `Código retornado para User B: ${r4SelectErr?.code} (${r4SelectErr?.message})`,
      status: rev4Passed ? 'PASS' : 'FAIL',
      severidade: 'ALTA'
    });

    // =========================================================================
    // REVISÃO 5: Verificação do search_path em todas as funções SEC-03
    // =========================================================================
    const searchPathQuery = await client.query(`
      SELECT proname, proconfig 
      FROM pg_proc 
      WHERE proname IN (
        'sec03_request_invitation_otp',
        'sec03_generate_invitation_challenge_internal',
        'sec03_verify_invitation_otp',
        'validate_invitation_token',
        'sec03_trg_sync_invitation_challenges'
      );
    `);

    const pathsOk = searchPathQuery.rows.every(r => 
      Array.isArray(r.proconfig) && r.proconfig.some(c => c.includes('search_path=public, extensions, pg_temp'))
    );

    results.push({
      item: 'R5. Endurecimento de search_path (public, extensions, pg_temp)',
      esperado: 'Todas as novas RPCs e triggers com search_path imutável contra sequestro de esquemas',
      obtido: `Funções inspecionadas: ${searchPathQuery.rows.length} | Todas com search_path restrito: ${pathsOk}`,
      status: pathsOk ? 'PASS' : 'FAIL',
      severidade: 'MÉDIA'
    });

    // =========================================================================
    // REVISÃO 6: Auditoria da Rota Antiga de Aceite (Vetor de Bypass)
    // =========================================================================
    const legacyFuncQuery = await client.query(`
      SELECT proname, prosecdef, pg_get_functiondef(oid) as def
      FROM pg_proc 
      WHERE proname = 'accept_tenant_invitation';
    `);
    const legacyDef = legacyFuncQuery.rows[0]?.def || '';
    const hasOtpCheckInLegacy = legacyDef.includes('tenant_invitation_challenges');

    results.push({
      item: 'R6. Avaliação de Risco: Vetor de Bypass via accept_tenant_invitation legada',
      esperado: 'Constatação técnica de que accept_tenant_invitation não valida OTP e DEVE ser revogada/bloqueada na FASE 02.2',
      obtido: `accept_tenant_invitation valida OTP atualmente? ${hasOtpCheckInLegacy ? 'SIM' : 'NÃO (Vulnerável a Bypass se exposta)'}`,
      status: 'AUDITADO',
      severidade: 'ALTA (Ação requerida na FASE 02.2)'
    });

    await client.query('ROLLBACK;');

    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Fatal error in review security suite:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runReviewSecuritySuite();

