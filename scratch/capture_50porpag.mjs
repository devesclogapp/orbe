import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

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

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await ctx.newPage();
  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Foco no trigger do select de paginação
  const trigger = page.locator('span:has-text("Linhas por página:")').locator('..').locator('button');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForTimeout(300);

  // Pressiona seta para baixo duas vezes para ir de 15 -> 25 -> 50 e pressiona Enter
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.resolve('scratch/fix04_captures/03_cadastros_colaboradores_50porpag_1440.png'), fullPage: false });
  console.log('Salvo com sucesso: 03_cadastros_colaboradores_50porpag_1440.png');

  await browser.close();
}

run().catch(console.error);
