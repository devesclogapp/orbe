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

    // Intercepta window.scrollTo, window.scroll e window.scrollBy
    const origScrollTo = window.scrollTo;
    window.scrollTo = function(...args) {
      console.log('TRACE scrollTo chamado com:', JSON.stringify(args), new Error().stack);
      return origScrollTo.apply(this, args);
    };

    // Intercepta focus() em elementos
    const origFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function(options) {
      console.log('TRACE focus em:', this.tagName, this.className, options, new Error().stack);
      return origFocus.apply(this, [options]);
    };

    window.addEventListener('scroll', () => {
      console.log('TRACE window scroll event, scrollY =', window.scrollY);
    });
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await ctx.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('TRACE')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('--- Rolando a página para 500 ---');
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);

  console.log('--- Clicando no trigger de Linhas por página ---');
  const trigger = page.locator('span:has-text("Linhas por página:")').locator('..').locator('button');
  await trigger.click();
  await page.waitForTimeout(1000);

  console.log('--- Fim do teste ---');
  await browser.close();
}

test().catch(console.error);
