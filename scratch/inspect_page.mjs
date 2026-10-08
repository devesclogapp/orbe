import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('Autenticando no Supabase via API...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error || !data.session) {
    console.error('Erro de autenticação:', error);
    return;
  }
  console.log('Sessão obtida para:', data.user.email);

  console.log('Iniciando Chromium com Chrome nativo...');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Injeta token no localStorage para a origem http://localhost:8080
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await context.newPage();
  
  console.log('Navegando para http://localhost:8080/banco-horas/fechamento ...');
  await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });

  // Aguarda 4 segundos para carregar empresas e queries
  await page.waitForTimeout(4000);

  // Tira screenshot em 900px
  await page.screenshot({ path: 'scratch/screenshot_fechamento_900.png', fullPage: false });
  console.log('Screenshot 900px tirado!');

  // Inspeciona DOM
  const inspection = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="empresas-scroll-container"]');
    const main = document.querySelector('main');
    const appShell = document.querySelector('.min-h-screen');

    // Identifica todos os elementos na parte inferior
    const bottomCenterEl = document.elementFromPoint(720, 890);
    const bottomLeftEl = document.elementFromPoint(300, 890);
    const listBottomEl = list ? document.elementFromPoint(300, Math.floor(list.getBoundingClientRect().bottom - 5)) : null;
    const belowListEl = list ? document.elementFromPoint(300, Math.floor(list.getBoundingClientRect().bottom + 15)) : null;

    // Busca se existe algum elemento com bg-white ou overlay horizontal
    const allDivs = Array.from(document.querySelectorAll('div, footer, section'));
    const wideWhiteElements = allDivs.filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isWhiteBg = style.backgroundColor.includes('255, 255, 255') || style.backgroundColor === 'rgb(255, 255, 255)';
      const isWide = rect.width > 800;
      const isNearBottom = rect.bottom >= 800;
      return isWide && isNearBottom;
    }).map(el => ({
      tagName: el.tagName,
      className: el.className,
      rect: el.getBoundingClientRect(),
      bg: window.getComputedStyle(el).backgroundColor,
      position: window.getComputedStyle(el).position,
      zIndex: window.getComputedStyle(el).zIndex,
    }));

    return {
      currentUrl: window.location.href,
      windowInnerHeight: window.innerHeight,
      windowScrollY: window.scrollY,
      mainScrollTop: main ? main.scrollTop : null,
      mainScrollHeight: main ? main.scrollHeight : null,
      mainClientHeight: main ? main.clientHeight : null,
      mainBoundingRect: main ? main.getBoundingClientRect() : null,
      listBoundingRect: list ? list.getBoundingClientRect() : null,
      listClientHeight: list ? list.clientHeight : null,
      listScrollHeight: list ? list.scrollHeight : null,
      listStyleMaxHeight: list ? list.style.maxHeight : null,
      listComputedOverflowY: list ? getComputedStyle(list).overflowY : null,
      bottomCenterEl: bottomCenterEl ? {
        tagName: bottomCenterEl.tagName,
        className: bottomCenterEl.className,
        rect: bottomCenterEl.getBoundingClientRect(),
      } : null,
      bottomLeftEl: bottomLeftEl ? {
        tagName: bottomLeftEl.tagName,
        className: bottomLeftEl.className,
        rect: bottomLeftEl.getBoundingClientRect(),
      } : null,
      belowListEl: belowListEl ? {
        tagName: belowListEl.tagName,
        className: belowListEl.className,
        rect: belowListEl.getBoundingClientRect(),
      } : null,
      wideWhiteElements
    };
  });

  fs.writeFileSync('scratch/inspection_auth_900.json', JSON.stringify(inspection, null, 2), 'utf-8');
  console.log('Inspeção gravada:', JSON.stringify(inspection, null, 2));

  await browser.close();
}

run().catch(console.error);
