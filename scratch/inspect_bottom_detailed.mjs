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

  const context = await browser.newContext({ viewport: { width: 1536, height: 695 } });
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await context.newPage();
  await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Inspeciona a faixa branca no final:
  // Vamos desenhar um canvas com a tela ou inspecionar todos os elementos entre y = 600 e y = 695
  const result = await page.evaluate(() => {
    // Coleta a árvore de elementos a partir do body
    const inspectElement = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: el.className,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, width: rect.width },
        bg: style.backgroundColor,
        overflow: style.overflow,
        overflowY: style.overflowY,
        boxShadow: style.boxShadow,
      };
    };

    const main = document.querySelector('main');
    const workspace = document.querySelector('.grid.grid-cols-1');
    const leftCol = document.querySelector('[data-testid="empresas-scroll-container"]');
    const rightCol = workspace ? workspace.children[1] : null;

    // Verifica todos os filhos de body, app-shell, etc.
    const allElementsNearBottom = Array.from(document.querySelectorAll('*')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom >= 650 && r.height > 10;
    }).map(inspectElement);

    return {
      main: main ? inspectElement(main) : null,
      workspace: workspace ? inspectElement(workspace) : null,
      leftCol: leftCol ? inspectElement(leftCol) : null,
      rightCol: rightCol ? inspectElement(rightCol) : null,
      allElementsNearBottom
    };
  });

  fs.writeFileSync('scratch/detailed_bottom_elements.json', JSON.stringify(result, null, 2), 'utf-8');
  console.log('Gravado!');

  await browser.close();
}

run().catch(console.error);
