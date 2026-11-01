import pg from 'pg';

async function debugScenario7() {
  const c = new pg.Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  await c.connect();
  await c.query('BEGIN;');

  const tId = '33333333-3333-3333-3333-333333333333';
  const uId = '44444444-4444-4444-4444-444444444444';
  await c.query('INSERT INTO public.tenants (id, nome) VALUES ($1, $2);', [tId, 'Debug Tenant']);
  await c.query('INSERT INTO auth.users (id, email, role, aud) VALUES ($1, $2, $3, $4);', [uId, 'admin@debug.test', 'authenticated', 'authenticated']);
  await c.query('INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES ($1, $2, $3, $4);', [uId, tId, 'Admin Debug', 'admin']);
  await c.query('SET ROLE authenticated;');
  await c.query(`SET "request.jwt.claim.sub" = '${uId}';`);

  const res = await c.query('SELECT public.admin_create_invitation_with_activation_code($1, $2, $3, $4, $5, $6) as r;',
    ['User', 'user@debug.test', '11', 'rh', '{}', new Date(Date.now() + 86400000).toISOString()]);
  const inv = res.rows[0].r;
  await c.query('RESET ROLE;');

  // Run 5 wrong attempts
  for (let i = 0; i < 5; i++) {
    const r = await c.query('SELECT public.sec03_verify_invitation_activation_code($1, $2) as r;', [inv.token, '00000' + i]);
    console.log(`Attempt ${i+1}:`, r.rows[0].r);
  }
  const chs = await c.query('SELECT id, status, attempts, max_attempts FROM public.tenant_invitation_challenges WHERE invitation_id = $1;', [inv.invitation_id]);
  console.log('After 5 attempts:', chs.rows);

  const sixth = await c.query('SELECT public.sec03_verify_invitation_activation_code($1, $2) as r;', [inv.token, '999999']);
  console.log('6th attempt:', sixth.rows[0].r);

  await c.query('ROLLBACK;');
  await c.end();
}

debugScenario7().catch(console.error);

