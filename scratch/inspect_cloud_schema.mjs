import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
  const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

  console.log('Inspecting OpenAPI schema on Cloud URL:', url);
  const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const schema = await res.json();
  const rpcs = Object.keys(schema.paths || {}).filter((p) => p.startsWith('/rpc/'));
  const invitationRpcs = rpcs.filter((p) => p.includes('invitation'));
  console.log('Invitation RPCs currently registered in Cloud PostgREST:');
  console.log(invitationRpcs);

  for (const rpc of invitationRpcs) {
    const postDef = schema.paths[rpc]?.post;
    console.log(`\nRPC: ${rpc}`);
    console.log('Parameters:', postDef?.parameters);
    console.log('Description:', postDef?.description);
  }
}

main().catch(console.error);

