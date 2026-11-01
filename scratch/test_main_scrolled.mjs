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

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await context.newPage();
  await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Rola o main 150px para baixo
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 150;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/screenshot_main_scrolled_150.png' });

  // Rola o main até o fim
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/screenshot_main_scrolled_end.png' });

  await browser.close();
}

run().catch(console.error);
