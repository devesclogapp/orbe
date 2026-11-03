import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  console.log('=== CONTAGEM EXATA E ANÁLISE DE VOLUMETRIA ===');

  // 1. registros_ponto
  const { count: countPonto, data: samplePonto } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log(`registros_ponto: ${countPonto} registros`);
  if (samplePonto && samplePonto.length > 0) {
    console.log('Colunas de registros_ponto:', Object.keys(samplePonto[0]));
    const sampleSize = Buffer.byteLength(JSON.stringify(samplePonto[0]), 'utf8');
    console.log(`Tamanho médio aproximado por linha: ~${sampleSize} bytes`);
    console.log(`Volume estimado dos dados (sem índices): ~${((sampleSize * countPonto) / 1024 / 1024).toFixed(2)} MB`);
  }

  // 2. historico_importacoes
  const { count: countImports, data: sampleImports } = await supabase
    .from('historico_importacoes')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log(`\nhistorico_importacoes: ${countImports} registros`);
  if (sampleImports && sampleImports.length > 0) {
    console.log('Colunas de historico_importacoes:', Object.keys(sampleImports[0]));
    const sampleSize = Buffer.byteLength(JSON.stringify(sampleImports[0]), 'utf8');
    console.log(`Tamanho médio aproximado por linha: ~${sampleSize} bytes`);
    console.log(`Volume estimado dos dados: ~${((sampleSize * countImports) / 1024 / 1024).toFixed(2)} MB`);
  }

  // 3. audit_log
  const { count: countAudit, data: sampleAudit } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log(`\naudit_log: ${countAudit} registros`);
  if (sampleAudit && sampleAudit.length > 0) {
    console.log('Colunas de audit_log:', Object.keys(sampleAudit[0]));
    const sampleSize = Buffer.byteLength(JSON.stringify(sampleAudit[0]), 'utf8');
    console.log(`Tamanho médio aproximado por linha: ~${sampleSize} bytes`);
    console.log(`Volume estimado dos dados: ~${((sampleSize * countAudit) / 1024 / 1024).toFixed(2)} MB`);
  }

  // 4. Supabase Storage buckets
  console.log('\n--- SUPABASE STORAGE BUCKETS ---');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('Erro ao listar buckets:', bErr.message);
  } else {
    console.log('Buckets existentes:', buckets);
    for (const b of buckets || []) {
      const { data: files, error: fErr } = await supabase.storage.from(b.name).list();
      console.log(`Bucket '${b.name}':`, fErr ? fErr.message : `${files?.length} itens na raiz`);
    }
  }

  // 5. Analisar distribuição de datas em registros_ponto
  const { data: minDate } = await supabase.from('registros_ponto').select('data').order('data', { ascending: true }).limit(1);
  const { data: maxDate } = await supabase.from('registros_ponto').select('data').order('data', { ascending: false }).limit(1);
  console.log('\nPeríodo coberto em registros_ponto:', minDate?.[0]?.data, 'até', maxDate?.[0]?.data);
}

run().catch(console.error);

