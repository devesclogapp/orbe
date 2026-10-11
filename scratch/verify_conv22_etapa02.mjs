import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Supabase auth error:', error);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const results = {};

  for (const vp of [{ width: 1440, height: 900, name: '1440x900' }, { width: 1366, height: 768, name: '1366x768' }]) {
    results[vp.name] = {};
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });

    const page = await context.newPage();

    // 1. DIARISTAS
    console.log(`\nVerifying Diaristas at ${vp.name}...`);
    await page.goto('http://localhost:8080/operacional/diaristas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const diaristasGeom = await page.evaluate(() => {
      const winW = window.innerWidth;
      const docW = document.documentElement.scrollWidth;
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fechar Período'));
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      return {
        winW,
        docW,
        hasPageHOverflow: docW > winW,
        btnExists: !!btn,
        btnLeft: btnRect ? Math.round(btnRect.left) : null,
        btnRight: btnRect ? Math.round(btnRect.right) : null,
        btnTop: btnRect ? Math.round(btnRect.top) : null,
        btnVisibleInsideViewport: btnRect ? (btnRect.right <= winW && btnRect.left >= 0) : false
      };
    });

    const shotDiaristas = `scratch/conv22_after_diaristas_${vp.name}.png`;
    await page.screenshot({ path: shotDiaristas });
    results[vp.name].diaristas = diaristasGeom;

    // 2. INADIMPLENCIA
    console.log(`Verifying Inadimplencia at ${vp.name}...`);
    await page.goto('http://localhost:8080/financeiro/inadimplencia', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const inadimplenciaGeom = await page.evaluate(() => {
      const winW = window.innerWidth;
      const docW = document.documentElement.scrollWidth;
      const tables = Array.from(document.querySelectorAll('table'));
      const tableInfo = tables.map(t => {
        const tr = t.getBoundingClientRect();
        const p = t.parentElement;
        const pStyle = p ? window.getComputedStyle(p) : null;
        return {
          width: Math.round(tr.width),
          parentOverflowX: pStyle ? pStyle.overflowX : '',
          isContainedInHScroll: pStyle ? (pStyle.overflowX === 'auto' || pStyle.overflowX === 'scroll') : false,
          overflowsWindow: tr.right > winW
        };
      });

      return {
        winW,
        docW,
        hasPageHOverflow: docW > winW,
        tableCount: tables.length,
        tables: tableInfo
      };
    });

    const shotInadimplencia = `scratch/conv22_after_inadimplencia_${vp.name}.png`;
    await page.screenshot({ path: shotInadimplencia });
    results[vp.name].inadimplencia = inadimplenciaGeom;

    await context.close();
  }

  await browser.close();
  fs.writeFileSync('scratch/conv22_etapa02_results.json', JSON.stringify(results, null, 2));
  console.log('\nVerification complete! Results:');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
