import pkg from 'pg';
const { Client } = pkg;

async function checkAllCols() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  for (const table of ['lancamentos_intermitentes', 'rh_financeiro_lotes', 'rh_financeiro_lote_itens', 'cnab_remessas_arquivos', 'cnab_remessa_itens', 'cnab_auditoria_bancaria']) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${table}'
      ORDER BY ordinal_position;
    `);
    console.log(`Colunas de ${table}:`, res.rows.map(r => r.column_name).join(', '));
  }
  await client.end();
}

checkAllCols();
