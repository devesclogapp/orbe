import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

const routes = [
  '/operacoes-volume',
  '/operacional/servicos-extras',
  '/operacional/custos-extras',
  '/operacional/diaristas',
  '/operacional/intermitentes',
  '/rh/aprovacoes',
  '/inconsistencias',
  '/financeiro/inadimplencia',
  '/cadastros'
];

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase.auth.signInWithPassword({ email, password });

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await ctx.newPage();

  for (const r of routes) {
    await page.goto(`http://localhost:8080${r}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const clipped = await page.evaluate(() => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      return Array.from(document.querySelectorAll('button'))
        .filter(b => {
          const r = b.getBoundingClientRect();
          // Is it in the DOM and rendered?
          const style = window.getComputedStyle(b);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          if (r.width === 0 || r.height === 0) return false;
          // Ignore buttons that are intentionally inside a scrollable container (e.g. table rows that extend horizontally)
          const isInsideHScroll = !!b.closest('.overflow-x-auto, [style*="overflow-x: auto"]');
          return !isInsideHScroll && (r.right > winW || r.left < 0);
        })
        .map(b => ({
          text: b.innerText.slice(0, 30),
          left: b.getBoundingClientRect().left,
          right: b.getBoundingClientRect().right
        }));
    });

    console.log(`Route ${r}: ${clipped.length} outside buttons:`, clipped);
  }

  await browser.close();
}

run().catch(console.error);
