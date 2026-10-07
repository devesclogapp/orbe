const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY')).split('=')[1].trim();
const email = env.split('\n').find(l => l.startsWith('E2E_TEST_EMAIL'))?.split('=')[1]?.trim();
const password = env.split('\n').find(l => l.startsWith('E2E_TEST_PASSWORD'))?.split('=')[1]?.trim();

const supabase = createClient(url, key);

async function testAssert() {
  await supabase.auth.signInWithPassword({ email, password });

  const tenantId = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  // 1. Validar empresa
  const { data: empresa, error } = await supabase
    .from('empresas')
    .select('id, tenant_id')
    .eq('id', empresaId)
    .maybeSingle();

  console.log('EMPRESA FOUND:', empresa, 'ERROR:', error);

  // 2. getTestEmpresaIds
  const { data: testEmps } = await supabase
    .from('empresas')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_teste', true);
  const testIds = testEmps?.map(e => e.id) || [];
  console.log('TEST IDS IN TENANT:', testIds);

  // 3. Simular assert com 'production'
  try {
    if (!testIds.includes(empresaId)) {
      console.log('PROD: testIds does NOT include empresaId -> allowed');
    } else {
      throw new Error('ENVIRONMENT_MISMATCH: Empresa não encontrada ou não autorizada. (is_teste=true em ambiente PROD)');
    }
  } catch (err) {
    console.error('PROD REJECTED:', err.message);
  }

  // 4. Simular assert com 'homologacao'
  try {
    if (testIds.includes(empresaId)) {
      console.log('HML: testIds includes empresaId -> ALLOWED!');
    } else {
      throw new Error('ENVIRONMENT_MISMATCH: Empresa não encontrada ou não autorizada. (is_teste=false em ambiente HML)');
    }
  } catch (err) {
    console.error('HML REJECTED:', err.message);
  }
}
testAssert();
