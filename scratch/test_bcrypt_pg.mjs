import pg from 'pg';

async function testBcrypt() {
  const c = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });
  await c.connect();

  const res = await c.query("SELECT extensions.crypt('123456', extensions.gen_salt('bf', 8)) AS hash;");
  const hash = res.rows[0].hash;
  console.log('Bcrypt hash:', hash);

  const verifyMatch = await c.query(`SELECT (extensions.crypt('123456', '${hash}') = '${hash}') AS matches;`);
  console.log('Matches 123456:', verifyMatch.rows[0].matches);

  const verifyWrong = await c.query(`SELECT (extensions.crypt('654321', '${hash}') = '${hash}') AS matches;`);
  console.log('Matches 654321:', verifyWrong.rows[0].matches);

  await c.end();
}

testBcrypt();

