import pg from 'pg';
const { Client } = pg;

async function check() {
    const client = new Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    try {
        await client.connect();
        const res = await client.query("SELECT to_regclass('public.jornadas_trabalho') as regclass;");
        console.log("Local postgres 54322 connected! Result:", res.rows);
    } catch (err) {
        console.log("Local postgres 54322 not accessible:", err.message);
    } finally {
        try { await client.end(); } catch (e) {}
    }
}

check();
