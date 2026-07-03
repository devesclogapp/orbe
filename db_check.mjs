import pg from 'pg';
const { Client } = pg;

async function check() {
    const client = new Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    try {
        await client.connect();
        const res = await client.query(`
      SELECT r.id, r.status, r.modalidade, r.competencia, r.vencimento, r.empresa_id, r.tenant_id,
      (SELECT count(*) FROM public.receitas_operacionais_itens ri WHERE ri.receita_id = r.id) as count_itens,
      (SELECT servico_extra_id FROM public.receitas_operacionais_itens ri WHERE ri.receita_id = r.id LIMIT 1) as servico_extra_id,
      (SELECT operacao_id FROM public.receitas_operacionais_itens ri WHERE ri.receita_id = r.id LIMIT 1) as operacao_id
      FROM public.receitas_operacionais r
      ORDER BY r.created_at ASC
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

check();
