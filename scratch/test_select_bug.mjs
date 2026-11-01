import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function test() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase.auth.signInWithPassword({ email, password });

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await ctx.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navegando para /cadastros?tab=colaboradores...');
  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Rola a página para baixo para que a barra de paginação fique visível
  await page.evaluate(() => window.scrollTo(0, 400));
  const scrollYBefore = await page.evaluate(() => window.scrollY);
  console.log('ScrollY antes de abrir o select:', scrollYBefore);

  const rowsBefore = await page.locator('table tbody tr').count();
  console.log('Quantidade de linhas antes:', rowsBefore);

  const textBefore = await page.locator('text=Exibindo').textContent();
  console.log('Texto de intervalo antes:', textBefore);

  // Localizar o trigger do select
  const selectTrigger = page.locator('span:has-text("Linhas por página:")').locator('..').locator('button');
  console.log('Clicando no trigger de Linhas por página...');
  await selectTrigger.click();
  await page.waitForTimeout(500);

  const scrollYDuringOpen = await page.evaluate(() => window.scrollY);
  console.log('ScrollY com o select aberto:', scrollYDuringOpen);

  // Clicar na opção 50
  console.log('Clicando na opção 50...');
  const option50 = page.locator('div[role="option"]:has-text("50")');
  await option50.click();
  await page.waitForTimeout(1000);

  const scrollYAfter = await page.evaluate(() => window.scrollY);
  console.log('ScrollY após selecionar 50:', scrollYAfter);

  const rowsAfter = await page.locator('table tbody tr').count();
  console.log('Quantidade de linhas após selecionar 50:', rowsAfter);

  const textAfter = await page.locator('text=Exibindo').textContent();
  console.log('Texto de intervalo após selecionar 50:', textAfter);

  await browser.close();
}

test().catch(console.error);
