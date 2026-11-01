const url = 'https://lifgjtcflzmspilhryap.supabase.co/rest/v1/';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function fetchSpec() {
  const res = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Accept': 'application/openapi+json'
    }
  });

  console.log('Status:', res.status, res.headers.get('content-type'));
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    const rpcs = Object.keys(data.paths || {}).filter(p => p.startsWith('/rpc/'));
    console.log('Total RPCs exposed in OpenAPI:', rpcs.length);
    console.log('RPCs:', rpcs.filter(p => p.includes('cnab') || p.includes('func') || p.includes('remessa') || p.includes('exec') || p.includes('query')));
    if (data.paths['/rpc/rpc_registrar_cnab_remessa']) {
      console.log('rpc_registrar_cnab_remessa:', JSON.stringify(data.paths['/rpc/rpc_registrar_cnab_remessa'], null, 2));
    }
  } catch (e) {
    console.log('Non-json response snippet:', text.slice(0, 500));
  }
}

fetchSpec();
