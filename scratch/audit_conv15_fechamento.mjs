import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function auditFechamento() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Supabase auth error:', error);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const viewports = [
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1366, height: 768, name: '1366x768' }
  ];

  const auditReport = {};

  for (const vp of viewports) {
    console.log(`\nAuditing viewport ${vp.name}...`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });

    const page = await context.newPage();
    await page.goto('http://localhost:8080/banco-horas/fechamento', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Screenshot initial state
    const shotInitial = `scratch/conv22_fechamento_${vp.name}_initial.png`;
    await page.screenshot({ path: shotInitial, fullPage: false });

    // Geometric evaluation
    const geom = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;

      // Check horizontal overflow
      const horizontalOverflow = docW > winW;
      const horizontalDiff = docW - winW;

      // Check main container
      const main = document.querySelector('main');
      const listContainer = document.querySelector('[data-testid="empresas-scroll-container"]');
      const articles = Array.from(document.querySelectorAll('article'));
      const diagArticle = articles.find(a =>
        a.textContent.includes('Situação Operacional') ||
        a.textContent.includes('SITUAÇÃO OPERACIONAL') ||
        a.textContent.includes('Impedimentos Identificados')
      );

      // Elements overflowing horizontally
      const overflowingElements = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > winW + 2) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id || '',
            className: (el.className || '').toString().slice(0, 80),
            right: r.right,
            width: r.width
          });
        }
      });

      return {
        windowWidth: winW,
        windowHeight: winH,
        documentScrollWidth: docW,
        documentScrollHeight: docH,
        horizontalOverflow,
        horizontalDiff,
        overflowingCount: overflowingElements.length,
        overflowingSamples: overflowingElements.slice(0, 5),
        list: listContainer ? {
          top: listContainer.getBoundingClientRect().top,
          bottom: listContainer.getBoundingClientRect().bottom,
          clientHeight: listContainer.clientHeight,
          scrollHeight: listContainer.scrollHeight,
          hasScroll: listContainer.scrollHeight > listContainer.clientHeight
        } : null,
        diag: diagArticle ? {
          top: diagArticle.getBoundingClientRect().top,
          bottom: diagArticle.getBoundingClientRect().bottom,
          clientHeight: diagArticle.clientHeight,
          scrollHeight: diagArticle.scrollHeight,
          hasScroll: diagArticle.scrollHeight > diagArticle.clientHeight
        } : null,
        kpiCount: document.querySelectorAll('[data-testid^="kpi-"], .orbe-kpi-card, [class*="OrbeKpiCard"]').length
      };
    });

    // Test Drawer open
    let drawerGeom = null;
    const btnVerDetalhes = page.locator('button:has-text("Ver Detalhes do Fechamento")').first();
    const canOpenDrawer = await btnVerDetalhes.isVisible();
    if (canOpenDrawer) {
      await btnVerDetalhes.click();
      await page.waitForTimeout(1000);
      const shotDrawer = `scratch/conv22_fechamento_${vp.name}_drawer_open.png`;
      await page.screenshot({ path: shotDrawer });

      drawerGeom = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const sheet = document.querySelector('[role="dialog"]');
        const sheetContent = sheet ? sheet.getBoundingClientRect() : null;
        return {
          windowWidth: winW,
          documentScrollWidth: docW,
          hasHorizontalOverflow: docW > winW,
          sheetWidth: sheetContent ? sheetContent.width : 0,
          sheetRight: sheetContent ? sheetContent.right : 0
        };
      });

      // Close drawer
      const btnCancelar = page.locator('button:has-text("Cancelar")').last();
      if (await btnCancelar.isVisible()) {
        await btnCancelar.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(600);
    }

    auditReport[vp.name] = {
      viewport: vp,
      geometry: geom,
      drawer: drawerGeom,
      screenshotInitial: shotInitial
    };

    await context.close();
  }

  await browser.close();
  fs.writeFileSync('scratch/conv22_fechamento_audit.json', JSON.stringify(auditReport, null, 2));
  console.log('Fechamento Audit finished successfully:');
  console.log(JSON.stringify(auditReport, null, 2));
}

auditFechamento().catch(console.error);
