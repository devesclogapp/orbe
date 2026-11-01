import pg from 'pg';

async function main() {
  const client = new pg.Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  await client.connect();

  const query = `
    SELECT 
      p.proname, 
      pg_get_function_identity_arguments(p.oid) as args,
      count(d.objid) as dependent_count
    FROM pg_proc p
    LEFT JOIN pg_depend d ON d.refobjid = p.oid AND d.deptype = 'n'
    WHERE p.proname IN ('validate_invitation_token', 'accept_tenant_invitation', 'admin_create_invitation_with_activation_code')
      AND p.pronamespace = 'public'::regnamespace
    GROUP BY p.proname, p.oid;
  `;

  const res = await client.query(query);
  console.log('Function dependencies check:');
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);

