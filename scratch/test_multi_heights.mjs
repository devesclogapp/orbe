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

  for (const height of [768, 900, 1080]) {
    const context = await browser.newContext({ viewport: { width: 1440, height } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });

    const page = await context.newPage();
    await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Mede geometria
    const geo = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      const main = document.querySelector('main');
      const diag = document.querySelector('section:has(h2)');
      return {
        windowH: window.innerHeight,
        listRect: list ? list.getBoundingClientRect() : null,
        mainRect: main ? main.getBoundingClientRect() : null,
        mainScrollTop: main ? main.scrollTop : 0,
        mainScrollHeight: main ? main.scrollHeight : 0,
        mainClientHeight: main ? main.clientHeight : 0,
        listScrollHeight: list ? list.scrollHeight : 0,
        listClientHeight: list ? list.clientHeight : 0,
        availableListHeightStyle: list ? list.style.maxHeight : null,
      };
    });

    console.log(`Geometria em ${height}px:`, geo);
    await page.screenshot({ path: `scratch/screenshot_${height}.png` });

    // Testa scroll da lista até o final
    await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      if (list) list.scrollTop = list.scrollHeight;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `scratch/screenshot_${height}_scrolled.png` });

    await context.close();
  }

  await browser.close();
}

run().catch(console.error);
