import pkg from 'pg';
const { Client } = pkg;

async function checkColabCols() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'colaboradores'
    ORDER BY ordinal_position;
  `);
  console.log('Colunas de colaboradores:', res.rows.map(r => r.column_name).join(', '));
  await client.end();
}

checkColabCols();
