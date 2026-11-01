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

  const results = {};

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

    // Medição 1: Estado Inicial
    const m1 = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      const main = document.querySelector('main');
      const articles = Array.from(document.querySelectorAll('article'));
      // O article de diagnóstico é o que contém "Situação Operacional" ou "Diagnóstico"
      const diagArticle = articles.find(a => a.textContent.includes('SITUAÇÃO OPERACIONAL') || a.textContent.includes('Impedimentos Identificados'));
      const lRect = list ? list.getBoundingClientRect() : null;
      const mRect = main ? main.getBoundingClientRect() : null;
      const dRect = diagArticle ? diagArticle.getBoundingClientRect() : null;

      return {
        windowH: window.innerHeight,
        visualViewportH: window.visualViewport ? window.visualViewport.height : window.innerHeight,
        list: {
          top: lRect ? lRect.top : 0,
          bottom: lRect ? lRect.bottom : 0,
          clientHeight: list ? list.clientHeight : 0,
          scrollHeight: list ? list.scrollHeight : 0,
          scrollTop: list ? list.scrollTop : 0,
          overflowY: list ? window.getComputedStyle(list).overflowY : '',
          marginToBottom: lRect ? window.innerHeight - lRect.bottom : 0
        },
        diagnostico: {
          top: dRect ? dRect.top : 0,
          bottom: dRect ? dRect.bottom : 0,
          clientHeight: diagArticle ? diagArticle.clientHeight : 0,
          scrollHeight: diagArticle ? diagArticle.scrollHeight : 0,
          overflowY: diagArticle ? window.getComputedStyle(diagArticle).overflowY : '',
          marginToBottom: dRect ? window.innerHeight - dRect.bottom : 0
        },
        main: {
          scrollHeight: main ? main.scrollHeight : 0,
          clientHeight: main ? main.clientHeight : 0,
          scrollTop: main ? main.scrollTop : 0,
          hasMainScroll: main ? main.scrollHeight > main.clientHeight : false
        }
      };
    });

    await page.screenshot({ path: `scratch/fix05_screenshot_${height}_initial.png` });

    // Medição 2: Rola lista até a última empresa
    await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      if (list) list.scrollTop = list.scrollHeight;
    });
    await page.waitForTimeout(400);

    const m2 = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="empresas-scroll-container"]');
      const cards = list ? list.querySelectorAll('article') : [];
      const lastCard = cards.length > 0 ? cards[cards.length - 1] : null;
      const lastRect = lastCard ? lastCard.getBoundingClientRect() : null;
      const listRect = list ? list.getBoundingClientRect() : null;

      return {
        scrollTopAfterScroll: list ? list.scrollTop : 0,
        lastCardVisible: lastRect && listRect ? (lastRect.bottom <= listRect.bottom + 5 && lastRect.top >= listRect.top) : false,
        lastCardName: lastCard ? lastCard.innerText.split('\n')[0] : null,
        totalCards: cards.length
      };
    });

    await page.screenshot({ path: `scratch/fix05_screenshot_${height}_scrolled.png` });

    // Medição 3: Teste de Drawer (apenas em 900px para economizar tempo ou em 768px)
    let drawerResult = null;
    if (height === 900 || height === 768) {
      // Abre Drawer
      const botaoDrawer = page.locator('button:has-text("Ver Detalhes do Fechamento")').first();
      if (await botaoDrawer.isVisible()) {
        await botaoDrawer.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `scratch/fix05_screenshot_${height}_drawer_open.png` });

        // Fecha Drawer
        const closeBtn = page.locator('button:has-text("Fechar"), [data-radix-collection-item], button[aria-label="Close"], button:has-text("Cancelar")').first();
        const escOrClose = page.locator('button:has(svg.lucide-x), [aria-label="Close"]').first();
        if (await escOrClose.isVisible()) {
          await escOrClose.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(600);
        await page.screenshot({ path: `scratch/fix05_screenshot_${height}_drawer_closed.png` });

        drawerResult = { drawerAbertoOk: true };
      }
    }

    results[`height_${height}`] = {
      initial: m1,
      afterScroll: m2,
      drawer: drawerResult
    };

    await context.close();
  }

  await browser.close();

  fs.writeFileSync('scratch/fix05_geometric_results.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Resultados Geométricos do FIX05 salvos com sucesso!');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
