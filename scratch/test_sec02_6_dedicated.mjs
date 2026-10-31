import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function testDedicatedRenewSecurity() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  const results = [];

  try {
    await client.query('BEGIN;');

    const tenantA = uuidv4();
    const tenantB = uuidv4();

    await client.query(`
      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantA}', 'Tenant A Renew Security'),
        ('${tenantB}', 'Tenant B Renew Security');
    `);

    const adminA = uuidv4();
    const rhA = uuidv4();
    const finA = uuidv4();
    const encA = uuidv4();
    const adminB = uuidv4();

    await client.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${adminA}', 'admin_a@sec.local', 'authenticated', 'authenticated'),
        ('${rhA}', 'rh_a@sec.local', 'authenticated', 'authenticated'),
        ('${finA}', 'fin_a@sec.local', 'authenticated', 'authenticated'),
        ('${encA}', 'enc_a@sec.local', 'authenticated', 'authenticated'),
        ('${adminB}', 'admin_b@sec.local', 'authenticated', 'authenticated');
    `);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ('${adminA}', '${tenantA}', 'Admin A', 'admin'),
        ('${rhA}', '${tenantA}', 'RH A', 'rh'),
        ('${finA}', '${tenantA}', 'Financeiro A', 'financeiro'),
        ('${encA}', '${tenantA}', 'Encarregado A', 'encarregado'),
        ('${adminB}', '${tenantB}', 'Admin B', 'admin');
    `);

    const inviteA = uuidv4();
    const inviteB = uuidv4();

    await client.query(`
      INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at) VALUES
        ('${inviteA}', '${tenantA}', 'invite_a@sec.local', 'user', 'tok_a_123', 'pendente', NOW() + INTERVAL '5 days'),
        ('${inviteB}', '${tenantB}', 'invite_b@sec.local', 'user', 'tok_b_123', 'pendente', NOW() + INTERVAL '5 days');
    `);

    const runAsUser = async (userId, queryText) => {
      await client.query(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${userId}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
      `);
      return client.query(queryText);
    };

    // 1. Renovação por RH
    await client.query('SAVEPOINT sp_rh;');
    let rhErr = null;
    try {
      await runAsUser(rhA, `SELECT * FROM public.admin_renew_tenant_invitation('${inviteA}'::uuid, NOW() + INTERVAL '10 days');`);
    } catch (e) {
      rhErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_rh;');

    // 2. Renovação por Financeiro
    await client.query('SAVEPOINT sp_fin;');
    let finErr = null;
    try {
      await runAsUser(finA, `SELECT * FROM public.admin_renew_tenant_invitation('${inviteA}'::uuid, NOW() + INTERVAL '10 days');`);
    } catch (e) {
      finErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_fin;');

    // 3. Renovação por Encarregado
    await client.query('SAVEPOINT sp_enc;');
    let encErr = null;
    try {
      await runAsUser(encA, `SELECT * FROM public.admin_renew_tenant_invitation('${inviteA}'::uuid, NOW() + INTERVAL '10 days');`);
    } catch (e) {
      encErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_enc;');

    // 4. Renovação Cross-Tenant por Admin A no Invite B
    await client.query('SAVEPOINT sp_cross;');
    let crossErr = null;
    try {
      await runAsUser(adminA, `SELECT * FROM public.admin_renew_tenant_invitation('${inviteB}'::uuid, NOW() + INTERVAL '10 days');`);
    } catch (e) {
      crossErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_cross;');

    // 5. Renovação Legítima pelo Admin A no Invite A
    await client.query('SAVEPOINT sp_ok;');
    let okRes = null;
    let okErr = null;
    try {
      const res = await runAsUser(adminA, `SELECT * FROM public.admin_renew_tenant_invitation('${inviteA}'::uuid, NOW() + INTERVAL '14 days');`);
      okRes = res.rows[0];
    } catch (e) {
      okErr = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_ok;');

    await client.query('ROLLBACK;');

    const checks = [
      {
        teste: 'Rejeição de renovação por perfil RH',
        status: rhErr?.message.includes('Acesso restrito ao administrador da conta.') ? 'PASS' : 'FAIL',
        sqlstate: rhErr?.code,
        msg: rhErr?.message
      },
      {
        teste: 'Rejeição de renovação por perfil Financeiro',
        status: finErr?.message.includes('Acesso restrito ao administrador da conta.') ? 'PASS' : 'FAIL',
        sqlstate: finErr?.code,
        msg: finErr?.message
      },
      {
        teste: 'Rejeição de renovação por perfil Encarregado',
        status: encErr?.message.includes('Acesso restrito ao administrador da conta.') ? 'PASS' : 'FAIL',
        sqlstate: encErr?.code,
        msg: encErr?.message
      },
      {
        teste: 'Bloqueio de renovação cross-tenant (Admin A -> Convite Tenant B)',
        status: crossErr?.message.includes('Convite não encontrado para renovação') ? 'PASS' : 'FAIL',
        sqlstate: crossErr?.code,
        msg: crossErr?.message
      },
      {
        teste: 'Renovação bem-sucedida pelo Administrador legítimo do mesmo tenant',
        status: (!okErr && okRes && okRes.status === 'pendente') ? 'PASS' : 'FAIL',
        sqlstate: okErr ? okErr.code : '00000',
        msg: okRes ? `Sucesso: token regenerado com tamanho ${okRes.token?.length} caracteres` : okErr?.message
      }
    ];

    console.log(JSON.stringify(checks, null, 2));

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Fatal error in dedicated renew test:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testDedicatedRenewSecurity();

