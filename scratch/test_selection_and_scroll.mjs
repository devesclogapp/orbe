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

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Scroll inicial:', await page.evaluate(() => window.scrollY));
  console.log('Linhas iniciais:', await page.locator('table tbody tr').count());
  console.log('Texto inicial:', await page.locator('text=Exibindo').textContent());

  // Rola até o seletor
  const trigger = page.locator('span:has-text("Linhas por página:")').locator('..').locator('button');
  await trigger.scrollIntoViewIfNeeded();
  const scrollBeforeClick = await page.evaluate(() => window.scrollY);
  console.log('Scroll antes do clique:', scrollBeforeClick);

  await trigger.click();
  await page.waitForTimeout(500);
  const scrollAfterOpen = await page.evaluate(() => window.scrollY);
  console.log('Scroll com menu aberto:', scrollAfterOpen);

  // Clica na opção 50
  const option50 = page.locator('div[role="option"]:has-text("50")');
  await option50.click({ force: true });
  await page.waitForTimeout(1000);

  const scrollAfterSelect = await page.evaluate(() => window.scrollY);
  console.log('Scroll após selecionar 50:', scrollAfterSelect);
  console.log('Linhas após selecionar 50:', await page.locator('table tbody tr').count());
  console.log('Texto após selecionar 50:', await page.locator('text=Exibindo').textContent());

  await browser.close();
}

test().catch(console.error);
