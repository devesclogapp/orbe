import pg from 'pg';

async function main() {
  const client = new pg.Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  await client.connect();

  const query = `
    SELECT 
      min(code) as min_code, 
      max(code) as max_code, 
      min(length(code)) as min_len,
      max(length(code)) as max_len,
      count(distinct code) as unique_codes,
      count(*) as total
    FROM (
      SELECT lpad((((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000) + 100000)::text), 6, '0') as code
      FROM generate_series(1, 20000)
    ) s;
  `;

  const res = await client.query(query);
  console.log('CSPRNG Stats across 20,000 runs:', res.rows[0]);
  await client.end();
}

main().catch(console.error);

