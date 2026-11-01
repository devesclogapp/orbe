import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[CONV-20 Etapa 02] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[CONV-20 Etapa 02] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/conv20_etapa02_captures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const createContext = async (width, height) => {
    const ctx = await browser.newContext({ viewport: { width, height } });
    await ctx.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });
    return ctx;
  };

  // --- 1. VIEWPORT 1440x900 ---
  console.log('\n--- Capturando Viewport 1440x900 ---');
  const ctx1440 = await createContext(1440, 900);
  const page1440 = await ctx1440.newPage();

  // 1.1 Regras Operacionais - Tab Operacional com Design System e Paginação
  console.log('[1/4] Operacional (1440x900) - Geral com filtros e paginação...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=operacional', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '01_etapa02_operacional_1440x900.png'), fullPage: false });

  // 1.2 Regras Operacionais - Com Filtro aplicado (ex: busca por texto)
  console.log('[2/4] Operacional (1440x900) - Filtro de busca...');
  const searchInput = page1440.locator('input[placeholder*="Buscar por empresa"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('Descarga');
    await page1440.waitForTimeout(500);
    await page1440.screenshot({ path: path.join(outputDir, '02_etapa02_filtro_busca_1440x900.png'), fullPage: false });
    // Limpar filtro
    const clearBtn = page1440.locator('button[title="Limpar busca"]').first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page1440.waitForTimeout(300);
    }
  }

  // --- 2. VIEWPORT 1366x768 (HD NOTEBOOK) ---
  console.log('\n--- Capturando Viewport 1366x768 (Notebook HD) ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  console.log('[3/4] Operacional (1366x768) - Visão Completa...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=operacional', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '03_etapa02_operacional_1366x768.png'), fullPage: false });

  console.log('[4/4] Operacional (1366x768) - Foco na Coluna de Ações e Paginação...');
  // Scroll do container da tabela para o extremo direito (se houver overflow) ou screenshot focado
  const tableContainer = page1366.locator('[data-testid="tabela-operacional-container"]').first();
  if (await tableContainer.isVisible()) {
    await tableContainer.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page1366.waitForTimeout(400);
  }
  await page1366.screenshot({ path: path.join(outputDir, '04_etapa02_acoes_acessiveis_1366x768.png'), fullPage: false });

  await browser.close();
  console.log('\n[CONV-20 Etapa 02] Capturas concluídas em scratch/conv20_etapa02_captures!');
}

run().catch((err) => {
  console.error('[CONV-20 Etapa 02] Erro:', err);
  process.exit(1);
});
