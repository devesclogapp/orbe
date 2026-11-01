import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function runSec03Fase211CompleteSuite() {
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  
  // Duas conexões independentes para testes de concorrência real (Cenário 15)
  const client1 = new pg.Client({ connectionString });
  const client2 = new pg.Client({ connectionString });

  await client1.connect();
  await client2.connect();

  const results = [];
  const SERVER_SECRET = 'backend_super_secret_master_key_for_hmac_sha256_orbe_2026';

  // 1. Setup multi-tenant sintético
  const tenantA = uuidv4();
  const tenantB = uuidv4();

  const adminA = uuidv4();
  const rhA = uuidv4();
  const finA = uuidv4();
  const encA = uuidv4();
  const guestUserA = uuidv4();
  const adminB = uuidv4();

  const setSession = async (client, role, userId = null) => {
    await client.query(`SET ROLE ${role};`);
    if (userId) {
      await client.query(`
        SET "request.jwt.claim.sub" = '${userId}';
        SET "request.jwt.claim.role" = '${role}';
      `);
    }
  };

  const resetSession = async (client) => {
    await client.query('RESET ROLE;');
    await client.query('RESET "request.jwt.claim.sub";');
    await client.query('RESET "request.jwt.claim.role";');
  };

  try {
    // Limpeza defensiva de execuções anteriores abortadas
    await client1.query(`DELETE FROM auth.users WHERE email LIKE '%@sec03.test';`);
    await client1.query(`DELETE FROM public.tenants WHERE nome IN ('Empresa Alpha Logística', 'Transportes Beta S/A');`);

    // Inserir fixtures compartilhadas
    await client1.query(`
      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantA}', 'Empresa Alpha Logística'),
        ('${tenantB}', 'Transportes Beta S/A');
    `);

    await client1.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${adminA}', 'admin_alpha@sec03.test', 'authenticated', 'authenticated'),
        ('${rhA}', 'rh_alpha@sec03.test', 'authenticated', 'authenticated'),
        ('${finA}', 'fin_alpha@sec03.test', 'authenticated', 'authenticated'),
        ('${encA}', 'enc_alpha@sec03.test', 'authenticated', 'authenticated'),
        ('${guestUserA}', 'convidado_alpha@sec03.test', 'authenticated', 'authenticated'),
        ('${adminB}', 'admin_beta@sec03.test', 'authenticated', 'authenticated');
    `);

    await client1.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ('${adminA}', '${tenantA}', 'Admin Alpha', 'admin'),
        ('${rhA}', '${tenantA}', 'RH Alpha', 'rh'),
        ('${finA}', '${tenantA}', 'Financeiro Alpha', 'financeiro'),
        ('${encA}', '${tenantA}', 'Encarregado Alpha', 'encarregado'),
        ('${adminB}', '${tenantB}', 'Admin Beta', 'admin');
    `);

    // =========================================================================
    // CENÁRIO 1: Administrador autorizado gera código
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c1Res = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colaborador Teste 1',
        'teste1@alpha.test',
        '11999990001',
        'rh',
        '{}'::jsonb,
        NOW() + INTERVAL '7 days',
        '${SERVER_SECRET}'
      ) as r;
    `);
    const c1Data = c1Res.rows[0].r;
    await client1.query('ROLLBACK;');

    const c1Passed = c1Data.success === true && 
                     /^\d{6}$/.test(c1Data.code) && 
                     c1Data.invitation_message.includes(c1Data.code) &&
                     c1Data.whatsapp_url === undefined &&
                     c1Data.tenant_name === 'Empresa Alpha Logística';
    results.push({
      id: 1,
      cenario: 'Administrador autorizado gera código',
      esperado: 'Sucesso, código de 6 dígitos gerado, mensagem pronta de convite e sem dependências de WhatsApp',
      obtido: `Sucesso: ${c1Data.success}, Código: ${c1Data.code}, Mensagem Pronta: ${Boolean(c1Data.invitation_message)}`,
      status: c1Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 2: RH sem autorização tenta gerar código
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', rhA);
    let c2Err = null;
    try {
      await client1.query(`
        SELECT public.admin_create_invitation_with_activation_code(
          'Teste RH', 'rh_inv@alpha.test', '11999990002', 'rh', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
        );
      `);
    } catch (e) {
      c2Err = e;
    }
    await client1.query('ROLLBACK;');

    const c2Passed = c2Err && (c2Err.message.includes('administrador') || c2Err.code === 'P0001');
    results.push({
      id: 2,
      cenario: 'RH sem autorização tenta gerar código',
      esperado: 'Rejeição P0001: Somente administradores do tenant podem executar esta ação',
      obtido: c2Err ? `Bloqueado: "${c2Err.message}"` : 'Permitido indevidamente',
      status: c2Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 3: Financeiro sem autorização tenta gerar código
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', finA);
    let c3Err = null;
    try {
      await client1.query(`
        SELECT public.admin_create_invitation_with_activation_code(
          'Teste Fin', 'fin_inv@alpha.test', '11999990003', 'financeiro', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
        );
      `);
    } catch (e) {
      c3Err = e;
    }
    await client1.query('ROLLBACK;');

    const c3Passed = c3Err && (c3Err.message.includes('administrador') || c3Err.code === 'P0001');
    results.push({
      id: 3,
      cenario: 'Financeiro sem autorização tenta gerar código',
      esperado: 'Rejeição P0001: Somente administradores do tenant podem executar esta ação',
      obtido: c3Err ? `Bloqueado: "${c3Err.message}"` : 'Permitido indevidamente',
      status: c3Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 4: Encarregado tenta acessar operação administrativa
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', encA);
    let c4Err = null;
    try {
      await client1.query(`
        SELECT public.admin_create_invitation_with_activation_code(
          'Teste Enc', 'enc_inv@alpha.test', '11999990004', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
        );
      `);
    } catch (e) {
      c4Err = e;
    }
    await client1.query('ROLLBACK;');

    const c4Passed = c4Err && (c4Err.message.includes('administrador') || c4Err.code === 'P0001');
    results.push({
      id: 4,
      cenario: 'Encarregado tenta acessar operação administrativa',
      esperado: 'Rejeição P0001: Encarregado isolado, sem acesso à governança',
      obtido: c4Err ? `Bloqueado: "${c4Err.message}"` : 'Permitido indevidamente',
      status: c4Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 5: Administrador de outro tenant tenta gerar código
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminB);
    const c5Res = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colaborador Beta', 'colab_beta@beta.test', '11999990005', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c5Data = c5Res.rows[0].r;
    const c5Invite = await client1.query(`SELECT tenant_id FROM public.tenant_invitations WHERE id = '${c5Data.invitation_id}';`);
    await client1.query('ROLLBACK;');

    const c5Passed = c5Data.tenant_name === 'Transportes Beta S/A' && c5Invite.rows[0].tenant_id === tenantB;
    results.push({
      id: 5,
      cenario: 'Administrador de outro tenant tenta gerar código',
      esperado: 'Isolamento estrito: convite criado exclusivamente no próprio tenant do Admin (Tenant B)',
      obtido: `Tenant atribuído: ${c5Invite.rows[0]?.tenant_id} (Beta: ${tenantB})`,
      status: c5Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 6: Usuário anônimo tenta obter código
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'anon');
    let c6Err = null;
    try {
      await client1.query(`
        SELECT public.admin_create_invitation_with_activation_code(
          'Hacker', 'anon@hacker.test', '11999990006', 'admin', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
        );
      `);
    } catch (e) {
      c6Err = e;
    }
    await client1.query('ROLLBACK;');

    const c6Passed = c6Err?.code === '42501';
    results.push({
      id: 6,
      cenario: 'Usuário anônimo tenta obter código',
      esperado: 'Permission Denied (42501) por ausência de GRANT para anon',
      obtido: `Rejeição: ${c6Err?.code} (${c6Err?.message})`,
      status: c6Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 7: Código correto (Verificação bem-sucedida)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c7Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 7', 'colab7@alpha.test', '11999990007', 'rh', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c7Token = c7Create.rows[0].r.token;
    const c7Code = c7Create.rows[0].r.code;

    await resetSession(client1);
    const c7Verify = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c7Token}', '${c7Code}', '${SERVER_SECRET}') as r;
    `);
    const c7VerifyRes = c7Verify.rows[0].r;
    await client1.query('ROLLBACK;');

    const c7Passed = c7VerifyRes.success === true && c7VerifyRes.verified === true;
    results.push({
      id: 7,
      cenario: 'Código correto',
      esperado: 'Verificação bem-sucedida (verified=true, success=true)',
      obtido: `Resultado: verified=${c7VerifyRes.verified}, success=${c7VerifyRes.success}`,
      status: c7Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 8: Código incorreto
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c8Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 8', 'colab8@alpha.test', '11999990008', 'financeiro', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c8Token = c8Create.rows[0].r.token;

    await resetSession(client1);
    const c8Verify = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c8Token}', '000000', '${SERVER_SECRET}') as r;
    `);
    const c8Result = c8Verify.rows[0].r;
    await client1.query('ROLLBACK;');

    const c8Passed = c8Result.success === false && c8Result.error === 'INVALID_CODE' && c8Result.remaining_attempts === 4;
    results.push({
      id: 8,
      cenario: 'Código incorreto',
      esperado: 'Retorno estruturado INVALID_CODE e decremento de tentativas para 4',
      obtido: `error=${c8Result.error}, remaining=${c8Result.remaining_attempts}, blocked=${c8Result.blocked}`,
      status: c8Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 9: Código expirado
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c9Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 9', 'colab9@alpha.test', '11999990009', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c9Token = c9Create.rows[0].r.token;
    const c9Code = c9Create.rows[0].r.code;
    const c9InviteId = c9Create.rows[0].r.invitation_id;

    await resetSession(client1);
    await client1.query(`
      UPDATE public.tenant_invitation_challenges 
      SET expires_at = NOW() - INTERVAL '1 second' 
      WHERE invitation_id = '${c9InviteId}';
    `);

    const c9Verify = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c9Token}', '${c9Code}', '${SERVER_SECRET}') as r;
    `);
    const c9Result = c9Verify.rows[0].r;
    await client1.query('ROLLBACK;');

    const c9Passed = c9Result.success === false && c9Result.error === 'EXPIRED_CODE';
    results.push({
      id: 9,
      cenario: 'Código expirado',
      esperado: 'Rejeição estruturada EXPIRED_CODE ("O código de ativação expirou")',
      obtido: `error=${c9Result.error}, message="${c9Result.message}"`,
      status: c9Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 10: Cinco tentativas inválidas (Bloqueio do código)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c10Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 10', 'colab10@alpha.test', '11999990010', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c10Token = c10Create.rows[0].r.token;
    const c10InviteId = c10Create.rows[0].r.invitation_id;

    await resetSession(client1);
    let c10Fifth = null;
    for (let i = 1; i <= 5; i++) {
      const res = await client1.query(`
        SELECT public.sec03_verify_invitation_activation_code('${c10Token}', '99999${i}', '${SERVER_SECRET}') as r;
      `);
      if (i === 5) c10Fifth = res.rows[0].r;
    }

    const c10Sixth = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c10Token}', '000000', '${SERVER_SECRET}') as r;
    `);
    const c10SixthRes = c10Sixth.rows[0].r;

    const c10Check = await client1.query(`
      SELECT status, attempts FROM public.tenant_invitation_challenges WHERE invitation_id = '${c10InviteId}';
    `);
    await client1.query('ROLLBACK;');

    const c10Passed = c10Fifth.blocked === true &&
                      c10SixthRes.error === 'MAX_ATTEMPTS_EXCEEDED' &&
                      c10Check.rows[0].status === 'bloqueado_tentativas' &&
                      c10Check.rows[0].attempts === 5;
    results.push({
      id: 10,
      cenario: 'Cinco tentativas inválidas',
      esperado: '5ª tentativa bloqueia (status=bloqueado_tentativas, attempts=5); 6ª tentativa rejeitada com MAX_ATTEMPTS_EXCEEDED',
      obtido: `5ª: blocked=${c10Fifth.blocked}, status=${c10Check.rows[0]?.status} | 6ª: ${c10SixthRes.error}`,
      status: c10Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 11: Reenvio e invalidação do código anterior
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c11Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 11', 'colab11@alpha.test', '11999990011', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c11Token = c11Create.rows[0].r.token;
    const c11Code1 = c11Create.rows[0].r.code;
    const c11InviteId = c11Create.rows[0].r.invitation_id;

    // Resetar cooldown via backend
    await resetSession(client1);
    await client1.query(`
      UPDATE public.tenant_invitation_challenges 
      SET cooldown_until = NOW() - INTERVAL '1 second' 
      WHERE invitation_id = '${c11InviteId}';
    `);

    // Admin reemite código
    await setSession(client1, 'authenticated', adminA);
    const c11Reissue = await client1.query(`
      SELECT public.admin_issue_new_activation_code('${c11InviteId}', '${SERVER_SECRET}') as r;
    `);
    const c11Code2 = c11Reissue.rows[0].r.code;

    await resetSession(client1);
    // Tentar validar código 1 (deve falhar pois status virou cancelado_reenvio)
    const c11V1 = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c11Token}', '${c11Code1}', '${SERVER_SECRET}') as r;
    `);
    const c11V1Res = c11V1.rows[0].r;

    // Validar código 2 (deve passar)
    const c11V2 = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c11Token}', '${c11Code2}', '${SERVER_SECRET}') as r;
    `);
    const c11V2Res = c11V2.rows[0].r;
    await client1.query('ROLLBACK;');

    const c11Passed = c11V1Res.success === false && c11V2Res.success === true && c11V2Res.verified === true;
    results.push({
      id: 11,
      cenario: 'Reenvio e invalidação do código anterior',
      esperado: 'Código 1 invalidado com cancelado_reenvio; novo Código 2 validado com sucesso',
      obtido: `Código 1 rejeitado: ${c11V1Res.error} | Código 2 verificado: ${c11V2Res.verified}`,
      status: c11Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 12: Limites acumulados de emissão (Rate limit de 10 em 24h)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c12Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 12', 'colab12@alpha.test', '11999990012', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c12InviteId = c12Create.rows[0].r.invitation_id;

    let c12LimitErr = null;
    for (let i = 2; i <= 11; i++) {
      await resetSession(client1);
      await client1.query(`
        UPDATE public.tenant_invitation_challenges 
        SET cooldown_until = NOW() - INTERVAL '1 second' 
        WHERE invitation_id = '${c12InviteId}';
      `);
      await setSession(client1, 'authenticated', adminA);
      try {
        await client1.query(`
          SELECT public.admin_issue_new_activation_code('${c12InviteId}', '${SERVER_SECRET}');
        `);
      } catch (e) {
        if (i === 11) c12LimitErr = e;
      }
    }
    await client1.query('ROLLBACK;');

    const c12Passed = c12LimitErr && (c12LimitErr.message.includes('Limite de 10') || c12LimitErr.code === 'P0001');
    results.push({
      id: 12,
      cenario: 'Limites acumulados de emissão',
      esperado: '11ª emissão em 24h bloqueada por limite cumulativo diário',
      obtido: c12LimitErr ? `Bloqueado no teto: "${c12LimitErr.message}"` : 'Teto não aplicado',
      status: c12Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 13: Revogação do convite
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c13Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 13', 'colab13@alpha.test', '11999990013', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c13Token = c13Create.rows[0].r.token;
    const c13InviteId = c13Create.rows[0].r.invitation_id;

    await client1.query(`SELECT public.admin_delete_tenant_invitation('${c13InviteId}');`);

    await resetSession(client1);
    const c13Count = await client1.query(`
      SELECT count(*) FROM public.tenant_invitation_challenges WHERE invitation_id = '${c13InviteId}';
    `);

    let c13VerifyErr = null;
    try {
      await client1.query(`
        SELECT public.sec03_verify_invitation_activation_code('${c13Token}', '123456', '${SERVER_SECRET}');
      `);
    } catch (e) {
      c13VerifyErr = e;
    }
    await client1.query('ROLLBACK;');

    const c13Passed = parseInt(c13Count.rows[0].count, 10) === 0 && c13VerifyErr !== null;
    results.push({
      id: 13,
      cenario: 'Revogação do convite',
      esperado: 'Desafios eliminados em cascata e verificação rejeitada (Convite inválido)',
      obtido: `Desafios órfãos: ${c13Count.rows[0].count} | Rejeição: "${c13VerifyErr?.message}"`,
      status: c13Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 14: Reutilização do código (Consumo único)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c14Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 14', 'colab14@alpha.test', '11999990014', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c14Token = c14Create.rows[0].r.token;
    const c14Code = c14Create.rows[0].r.code;

    await resetSession(client1);
    const c14V1 = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c14Token}', '${c14Code}', '${SERVER_SECRET}') as r;
    `);
    const c14V2 = await client1.query(`
      SELECT public.sec03_verify_invitation_activation_code('${c14Token}', '${c14Code}', '${SERVER_SECRET}') as r;
    `);
    await client1.query('ROLLBACK;');

    const c14Passed = c14V1.rows[0].r.verified === true && 
                      c14V2.rows[0].r.success === false && 
                      c14V2.rows[0].r.error === 'ALREADY_VERIFIED';
    results.push({
      id: 14,
      cenario: 'Reutilização do código',
      esperado: '1ª validação bem-sucedida; 2ª rejeitada com ALREADY_VERIFIED',
      obtido: `1ª: verified=${c14V1.rows[0].r.verified} | 2ª: error=${c14V2.rows[0].r.error}`,
      status: c14Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 15: Concorrência real em conexões independentes
    // =========================================================================
    // client1 cria o convite commitado para visibilidade entre conexões separadas
    await setSession(client1, 'authenticated', adminA);
    const c15ResSetup = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Colab 15 Concorrencia', 'colab15@alpha.test', '11999990015', 'user', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c15Token = c15ResSetup.rows[0].r.token;
    const c15Code = c15ResSetup.rows[0].r.code;
    const c15InviteId = c15ResSetup.rows[0].r.invitation_id;

    await resetSession(client1);
    await resetSession(client2);

    // Disparar duas tentativas de verificação concorrentes com conexões distintas em paralelo
    const [p1, p2] = await Promise.all([
      client1.query(`SELECT public.sec03_verify_invitation_activation_code('${c15Token}', '${c15Code}', '${SERVER_SECRET}') as r;`),
      client2.query(`SELECT public.sec03_verify_invitation_activation_code('${c15Token}', '${c15Code}', '${SERVER_SECRET}') as r;`)
    ]);

    const resConn1 = p1.rows[0].r;
    const resConn2 = p2.rows[0].r;

    // Limpar registro sintético do teste de concorrência
    await client1.query(`DELETE FROM public.tenant_invitations WHERE id = '${c15InviteId}';`);

    const c15Passed = (resConn1.verified === true && resConn2.success === false) ||
                      (resConn2.verified === true && resConn1.success === false);
    results.push({
      id: 15,
      cenario: 'Concorrência real em conexões independentes',
      esperado: 'Lock pessimista FOR UPDATE garante que exatamente UMA conexão valide e a outra seja rejeitada',
      obtido: `Conexão 1: verified=${resConn1.verified} | Conexão 2: success=${resConn2.success}, error=${resConn2.error}`,
      status: c15Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 16: Leitura não autorizada dos verificadores (RLS / Grants)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'anon');
    let c16AnonErr = null;
    try {
      await client1.query('SELECT code_hash, salt FROM public.tenant_invitation_challenges;');
    } catch (e) {
      c16AnonErr = e;
    }
    await client1.query('ROLLBACK;');

    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', rhA);
    let c16AuthErr = null;
    try {
      await client1.query('SELECT code_hash, salt FROM public.tenant_invitation_challenges;');
    } catch (e) {
      c16AuthErr = e;
    }
    await client1.query('ROLLBACK;');

    const c16Passed = c16AnonErr?.code === '42501' && c16AuthErr?.code === '42501';
    results.push({
      id: 16,
      cenario: 'Leitura não autorizada dos verificadores',
      esperado: 'Permission Denied (42501) para SELECT direto por anon e authenticated',
      obtido: `Anon: ${c16AnonErr?.code} | Authenticated: ${c16AuthErr?.code}`,
      status: c16Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 17: Tentativa de alterar role (Proteção Colunar)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', rhA);
    let c17Err = null;
    try {
      await client1.query(`UPDATE public.profiles SET role = 'admin' WHERE user_id = '${rhA}';`);
    } catch (e) {
      c17Err = e;
    }
    await client1.query('ROLLBACK;');

    const c17Passed = c17Err?.code === '42501';
    results.push({
      id: 17,
      cenario: 'Tentativa de alterar role',
      esperado: 'Permission Denied (42501) para mutação direta em profiles.role',
      obtido: `Rejeição colunar: ${c17Err?.code} (${c17Err?.message})`,
      status: c17Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 18: Tentativa de alterar tenant (Proteção Colunar)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', rhA);
    let c18Err = null;
    try {
      await client1.query(`UPDATE public.profiles SET tenant_id = '${tenantB}' WHERE user_id = '${rhA}';`);
    } catch (e) {
      c18Err = e;
    }
    await client1.query('ROLLBACK;');

    const c18Passed = c18Err?.code === '42501';
    results.push({
      id: 18,
      cenario: 'Tentativa de alterar tenant',
      esperado: 'Permission Denied (42501) para mutação direta em profiles.tenant_id',
      obtido: `Rejeição colunar: ${c18Err?.code} (${c18Err?.message})`,
      status: c18Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 19: Tentativa de contornar o OTP pelo fluxo antigo (accept_tenant_invitation sem OTP)
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c19Create = await client1.query(`
      SELECT public.admin_create_invitation_with_activation_code(
        'Convidado Bypass', 'convidado_alpha@sec03.test', '11999990019', 'rh', '{}'::jsonb, NOW() + INTERVAL '7 days', '${SERVER_SECRET}'
      ) as r;
    `);
    const c19Token = c19Create.rows[0].r.token;

    // Usuário tenta chamar accept_tenant_invitation DIRETAMENTE sem ter validado o código de ativação
    await setSession(client1, 'authenticated', guestUserA);
    let c19BypassErr = null;
    try {
      await client1.query(`SELECT public.accept_tenant_invitation('${c19Token}');`);
    } catch (e) {
      c19BypassErr = e;
    }
    await client1.query('ROLLBACK;');

    const c19Passed = c19BypassErr && (c19BypassErr.message.includes('ativa') || c19BypassErr.code === 'P0001');
    results.push({
      id: 19,
      cenario: 'Tentativa de contornar o OTP pelo fluxo antigo',
      esperado: 'Bloqueio imediato na RPC accept_tenant_invitation: exige código verificado',
      obtido: c19BypassErr ? `Bypass bloqueado: "${c19BypassErr.message}"` : 'Vulnerável a Bypass',
      status: c19Passed ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // CENÁRIO 20: Regressão das proteções SEC-02
    // =========================================================================
    await client1.query('BEGIN;');
    await setSession(client1, 'authenticated', adminA);
    const c20Overview = await client1.query('SELECT * FROM public.admin_list_user_access_overview();');
    await client1.query('ROLLBACK;');

    const c20Passed = c20Overview.rows.length >= 4;
    results.push({
      id: 20,
      cenario: 'Regressão das proteções SEC-02',
      esperado: 'admin_list_user_access_overview continua operando com 100% de integridade',
      obtido: `Visão geral retornou ${c20Overview.rows.length} registros para o Administrador`,
      status: c20Passed ? 'PASS' : 'FAIL'
    });

    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Fatal error in complete suite:', err);
    process.exit(1);
  } finally {
    // Limpeza rigorosa das fixtures sintéticas
    try {
      await client1.query(`DELETE FROM public.tenants WHERE id IN ('${tenantA}', '${tenantB}');`);
      await client1.query(`DELETE FROM auth.users WHERE id IN ('${adminA}', '${rhA}', '${finA}', '${encA}', '${guestUserA}', '${adminB}');`);
    } catch (cleanErr) {
      // ignore cleanup errors
    }
    await client1.end();
    await client2.end();
  }
}

runSec03Fase211CompleteSuite();
