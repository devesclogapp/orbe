import fetch from 'node:http'; // native fetch exists in Node 18+
import fs from 'node:fs';

async function runSmoke() {
  console.log('=== 1. VERIFICANDO DOMÍNIO DE PRODUÇÃO ===');
  const url = 'https://orbe-nu.vercel.app';
  const startTime = Date.now();
  const res = await globalThis.fetch(url);
  const latency = Date.now() - startTime;
  console.log(`URL: ${url}`);
  console.log(`Status HTTP: ${res.status} ${res.statusText}`);
  console.log(`Latência: ${latency}ms`);
  
  const headers = Object.fromEntries(res.headers.entries());
  console.log('Server / Cache headers:', {
    'server': headers['server'],
    'x-vercel-id': headers['x-vercel-id'],
    'content-type': headers['content-type'],
    'cache-control': headers['cache-control']
  });

  const html = await res.text();
  console.log(`Tamanho do HTML: ${html.length} bytes`);
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  console.log(`Título da página: ${titleMatch ? titleMatch[1] : 'NÃO ENCONTRADO'}`);

  console.log('\n=== 2. VERIFICANDO ASSETS JS E CSS PUBLICADOS ===');
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  const linkRegex = /<link[^>]+href=["']([^"']+)["']/gi;
  
  const scripts = [];
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  const links = [];
  while ((m = linkRegex.exec(html)) !== null) {
    links.push(m[1]);
  }

  console.log('Scripts referenciados:', scripts);
  console.log('Links referenciados:', links.filter(l => l.includes('.css') || l.includes('assets')));

  for (const s of scripts) {
    const sUrl = s.startsWith('http') ? s : `${url}${s.startsWith('/') ? '' : '/'}${s}`;
    const sRes = await globalThis.fetch(sUrl);
    console.log(`Asset JS: ${sUrl} -> Status ${sRes.status} (${(await sRes.text()).length} bytes)`);
  }

  for (const l of links.filter(l => l.endsWith('.css') || l.includes('/assets/'))) {
    const lUrl = l.startsWith('http') ? l : `${url}${l.startsWith('/') ? '' : '/'}${l}`;
    const lRes = await globalThis.fetch(lUrl);
    console.log(`Asset CSS: ${lUrl} -> Status ${lRes.status} (${(await lRes.text()).length} bytes)`);
  }
}

runSmoke().catch(console.error);

