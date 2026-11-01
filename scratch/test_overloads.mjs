import pg from 'pg';

async function testOverloads() {
  const c = new pg.Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  await c.connect();
  await c.query('BEGIN;');

  const tId = '11111111-1111-1111-1111-111111111111';
  const uId = '22222222-2222-2222-2222-222222222222';
  await c.query('INSERT INTO public.tenants (id, nome) VALUES ($1, $2);', [tId, 'Empresa Teste Overload']);
  await c.query('INSERT INTO auth.users (id, email, role, aud) VALUES ($1, $2, $3, $4);', [uId, 'admin@teste.overload', 'authenticated', 'authenticated']);
  await c.query('INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES ($1, $2, $3, $4);', [uId, tId, 'Admin Teste', 'admin']);

  await c.query('SET ROLE authenticated;');
  await c.query(`SET "request.jwt.claim.sub" = '${uId}';`);
  await c.query(`SET "request.jwt.claim.role" = 'authenticated';`);

  // Test 1: create without secret
  const res1 = await c.query(
    'SELECT public.admin_create_invitation_with_activation_code($1, $2, $3, $4, $5, $6) as r;',
    ['Convidado', 'convidado@teste.overload', '11999991234', 'rh', '{}', new Date(Date.now() + 86400000).toISOString()]
  );
  const data1 = res1.rows[0].r;
  console.log('Test 1 (create without secret):', data1.success, 'Code:', data1.code, 'Token:', data1.token);

  // Test 2: verify with 2 params (as anon)
  await c.query('RESET ROLE;');
  await c.query('SET ROLE anon;');
  const res2 = await c.query('SELECT public.sec03_verify_invitation_activation_code($1, $2) as r;', [data1.token, data1.code]);
  console.log('Test 2 (verify as anon):', res2.rows[0].r);

  // Test 3: reissue with 1 param (as admin)
  await c.query('RESET ROLE;');
  await c.query('UPDATE public.tenant_invitation_challenges SET cooldown_until = NOW() - INTERVAL \'1 second\' WHERE invitation_id = $1;', [data1.invitation_id]);
  await c.query('SET ROLE authenticated;');
  await c.query(`SET "request.jwt.claim.sub" = '${uId}';`);
  await c.query(`SET "request.jwt.claim.role" = 'authenticated';`);
  const res3 = await c.query('SELECT public.admin_issue_new_activation_code($1) as r;', [data1.invitation_id]);
  console.log('Test 3 (reissue):', res3.rows[0].r);

  await c.query('ROLLBACK;');
  await c.end();
}

testOverloads().catch(console.error);

