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

  // Inspeciona os elementos na região inferior (y de 600 a 695)
  const bottomAnalysis = await page.evaluate(() => {
    const points = [
      { x: 100, y: 680 },
      { x: 400, y: 680 },
      { x: 800, y: 680 },
      { x: 1200, y: 680 },
      { x: 400, y: 660 },
      { x: 400, y: 690 },
    ];

    const elementsAtPoints = points.map(p => {
      const el = document.elementFromPoint(p.x, p.y);
      if (!el) return { point: p, el: null };
      const s = window.getComputedStyle(el);
      return {
        point: p,
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        bg: s.backgroundColor,
        position: s.position,
        zIndex: s.zIndex,
        rect: el.getBoundingClientRect(),
        outerHTML: el.outerHTML.substring(0, 200)
      };
    });

    // Procura todos os elementos com position fixed, absolute ou sticky
    const allEls = Array.from(document.querySelectorAll('*'));
    const positioned = allEls.filter(el => {
      const s = window.getComputedStyle(el);
      return (s.position === 'fixed' || s.position === 'absolute' || s.position === 'sticky') &&
        el.getBoundingClientRect().bottom > 500;
    }).map(el => {
      const s = window.getComputedStyle(el);
      return {
        tagName: el.tagName,
        className: el.className,
        position: s.position,
        bg: s.backgroundColor,
        rect: el.getBoundingClientRect(),
        outerHTML: el.outerHTML.substring(0, 200)
      };
    });

    const bodyRect = document.body.getBoundingClientRect();
    const htmlRect = document.documentElement.getBoundingClientRect();

    return {
      windowH: window.innerHeight,
      windowW: window.innerWidth,
      bodyScrollHeight: document.body.scrollHeight,
      htmlScrollHeight: document.documentElement.scrollHeight,
      bodyRect,
      htmlRect,
      elementsAtPoints,
      positioned
    };
  });

  fs.writeFileSync('scratch/bottom_analysis.json', JSON.stringify(bottomAnalysis, null, 2), 'utf-8');
  console.log('Análise gravada:', JSON.stringify(bottomAnalysis, null, 2));

  await browser.close();
}

run().catch(console.error);
