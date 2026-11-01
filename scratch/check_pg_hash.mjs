import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;
const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');

async function test() {
  await client.connect();
  const testString = "ORBE_SIMULACAO_CNAB_V1\r\nMODALIDADE: INTERMITENTES\r\nTOTAL_VALOR: R$ 600.00\r\n";
  const nodeHash = crypto.createHash('sha256').update(testString, 'utf8').digest('hex');
  
  const res = await client.query("SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') as pg_hash;", [testString]);
  const pgHash = res.rows[0].pg_hash;

  console.log('Node hash: ', nodeHash);
  console.log('PG hash:   ', pgHash);
  console.log('Match?     ', nodeHash === pgHash);
  await client.end();
}
test();
