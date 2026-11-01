import pkg from 'pg';
const { Client } = pkg;

async function check() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  
  // 1. Procurar dependências diretas de outros objetos no PostgreSQL (pg_depend)
  const res = await client.query(`
    SELECT 
      c.relname,
      c.relkind,
      d.deptype
    FROM pg_depend d
    JOIN pg_class c ON c.oid = d.objid
    WHERE d.refobjid = 'public.rpc_registrar_cnab_remessa'::regproc;
  `);
  console.log('Tabelas/Views dependentes:', res.rows);

  // 2. Procurar triggers
  const trig = await client.query(`
    SELECT tgname, relname 
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgfoid = 'public.rpc_registrar_cnab_remessa'::regproc;
  `);
  console.log('Triggers que chamam a RPC:', trig.rows);

  // 3. Procurar em definições de views (INFORMATION_SCHEMA.VIEWS)
  const views = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.views 
    WHERE view_definition ILIKE '%rpc_registrar_cnab_remessa%';
  `);
  console.log('Views que contêm a RPC no SQL:', views.rows);

  // 4. Procurar em outras funções/procedures (pg_proc)
  const procs = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE prosrc ILIKE '%rpc_registrar_cnab_remessa%' 
      AND proname <> 'rpc_registrar_cnab_remessa';
  `);
  console.log('Outras funções que chamam a RPC:', procs.rows);

  // 5. Verificar grants na RPC
  const grants = await client.query(`
    SELECT routine_name, grantee, privilege_type 
    FROM information_schema.routine_privileges 
    WHERE routine_name = 'rpc_registrar_cnab_remessa';
  `);
  console.log('Grants concedidos:', grants.rows);

  await client.end();
}

check().catch(console.error);
