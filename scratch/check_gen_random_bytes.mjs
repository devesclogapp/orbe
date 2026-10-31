import pg from 'pg';

async function main() {
  const c = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });
  await c.connect();

  const query = `
    SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        pg_get_function_identity_arguments(p.oid) AS arguments,
        e.extname AS extension_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    LEFT JOIN pg_extension e ON e.oid = d.refobjid
    WHERE p.proname = 'gen_random_bytes';
  `;

  const res = await c.query(query);
  console.log(res.rows);
  await c.end();
}

main();

