import pkg from 'pg';
const { Client } = pkg;

async function checkCols() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'intermitentes_lotes_fechamento'
    ORDER BY ordinal_position;
  `);
  console.log('Colunas de intermitentes_lotes_fechamento:', res.rows);
  await client.end();
}

checkCols();
