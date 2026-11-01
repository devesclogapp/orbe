import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

  console.log('=== AUDITORIA READ-ONLY SUPABASE CLOUD ===');
  console.log('Project URL:', url);

  const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
  if (!res.ok) {
    console.error('Falha ao obter schema OpenAPI:', res.status, res.statusText);
    return;
  }

  const schema = await res.json();
  const paths = Object.keys(schema.paths || {});
  
  // 1. Tabelas disponíveis via PostgREST
  const tables = paths.filter(p => !p.startsWith('/rpc/')).map(p => p.replace('/', ''));
  console.log('\nTabelas public disponíveis via PostgREST no Cloud:');
  const targetTables = ['tenants', 'profiles', 'user_permissions', 'tenant_invitations', 'audit_log', 'tenant_invitation_challenges'];
  for (const t of targetTables) {
    const exists = tables.includes(t);
    console.log(`- ${t}: ${exists ? 'EXISTE' : 'NÃO EXISTE'}`);
    if (exists && schema.definitions?.[t]) {
      const def = schema.definitions[t];
      console.log(`  Colunas de ${t}:`, Object.keys(def.properties || {}));
      console.log(`  Required:`, def.required || []);
    }
  }

  // 2. RPCs / Funções registradas no Cloud
  const rpcs = paths.filter(p => p.startsWith('/rpc/')).map(p => p.replace('/rpc/', ''));
  console.log('\nRPCs de Governança/Autenticação/Convite existentes no Cloud:');
  const secObjects = rpcs.filter(r => r.includes('sec0') || r.includes('invitation') || r.includes('tenant') || r.includes('user'));
  console.log(secObjects);

  // 3. Verificar especificamente objetos SEC-03
  console.log('\nVerificando objetos específicos SEC-03:');
  const sec03Candidates = [
    'sec03_verify_invitation_activation_code',
    'sec03_issue_invitation_activation_code',
    'sec03_revoke_invitation',
    'sec03_get_auth_user_by_email',
    'tenant_invitation_challenges'
  ];
  for (const obj of sec03Candidates) {
    const inRpc = rpcs.includes(obj);
    const inTables = tables.includes(obj);
    console.log(`- ${obj}: ${inRpc || inTables ? 'PRESENTE (Alerta)' : 'AUSENTE (Base Limpa)'}`);
  }

  // 4. Testar leitura de tenant_invitations e tenants com anon key
  console.log('\nTestando consulta anônima em tenant_invitations:');
  const invRes = await fetch(`${url}/rest/v1/tenant_invitations?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log(`- GET /tenant_invitations: HTTP ${invRes.status} (${invRes.statusText})`);

  console.log('\nTestando consulta anônima em tenants:');
  const tenRes = await fetch(`${url}/rest/v1/tenants?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log(`- GET /tenants: HTTP ${tenRes.status} (${tenRes.statusText})`);
  if (tenRes.ok) {
    const tenData = await tenRes.json();
    console.log('  Estrutura de registro tenants:', tenData[0] ? Object.keys(tenData[0]) : 'Tabela vazia ou RLS restrito');
  }

  // 5. Testar validate_invitation_token
  console.log('\nTestando RPC validate_invitation_token:');
  const valRes = await fetch(`${url}/rest/v1/rpc/validate_invitation_token`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: '00000000-0000-0000-0000-000000000000' })
  });
  console.log(`- POST /rpc/validate_invitation_token: HTTP ${valRes.status}`);
  if (valRes.ok) {
    const valData = await valRes.json();
    console.log('  Retorno:', valData);
  } else {
    const errText = await valRes.text();
    console.log('  Retorno:', errText);
  }
}

main().catch(console.error);
