import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase.auth.signInWithPassword({ email, password });
  
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const viewports = [
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1440, height: 900, name: '900p' },
    { width: 1366, height: 768, name: '768p' },
    { width: 1280, height: 720, name: '720p' },
    { width: 1024, height: 768, name: '1024_768' },
    { width: 1536, height: 695, name: 'laptop_scale125' }, // 1080p a 150% ou 864p a 125%
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });

    const page = await context.newPage();
    await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `scratch/vp_${vp.name}.png` });

    const info = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      const main = document.querySelector('main');
      const diag = document.querySelector('section:has(h2)');
      const rightCol = document.querySelectorAll('section')[1];
      return {
        windowH: window.innerHeight,
        windowW: window.innerWidth,
        listRect: list ? list.getBoundingClientRect() : null,
        mainRect: main ? main.getBoundingClientRect() : null,
        mainScrollTop: main ? main.scrollTop : 0,
        mainScrollHeight: main ? main.scrollHeight : 0,
        mainClientHeight: main ? main.clientHeight : 0,
        rightColRect: rightCol ? rightCol.getBoundingClientRect() : null,
        availableListHeightStyle: list ? list.style.maxHeight : null,
      };
    });

    console.log(`Viewport ${vp.name}:`, info);
    await context.close();
  }

  await browser.close();
}

run().catch(console.error);
